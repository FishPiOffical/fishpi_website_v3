#!/usr/bin/env python3
"""低频本地 HTTP 耐久测试；不改变服务器时钟、不向生产发送请求。"""
import argparse
from collections import deque
from copy import deepcopy
from assertions import assert_activity_rewards, assert_history, assert_pages, assert_unchanged, delta
import hashlib
import http.cookiejar
import json
import os
from pathlib import Path
import signal
import sys
import time
import traceback
import urllib.error
import urllib.request
import uuid

BASE = 'http://localhost:8081'
directory, config, accounts, end = None, {}, [], 0
stopped = False
request_times = deque()
summary = {}


def configure(run_directory):
    """仅显式启动时读取本地夹具，导入模块不会登录、联网或执行命令。"""
    global directory, config, accounts, end, stopped
    directory = Path(run_directory).resolve()
    config = json.loads((directory / 'config.json').read_text())
    assert config['api'] == BASE and '.temp/pet-soak/' in str(directory)
    accounts = json.loads((directory / 'accounts.private.json').read_text())
    assert len(accounts) == 4 and all(a['name'].startswith('petSoak') for a in accounts)
    end, stopped = config['endsAt'] / 1000, False
    request_times.clear()
    summary.clear()
    summary.update(status='running', requests=0, checks=0, failures=[], coverage={}, actors=[],
                   startedActivities=[], completedActivities=[], startedAt=time.time())
    return accounts


class StopRun(Exception):
    def __init__(self, reason, kind):
        super().__init__(reason)
        self.kind = kind

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *arguments):
        raise AssertionError('禁止跟随本地接口重定向')

def halt(*_):
    global stopped
    stopped = True

def checkpoint():
    if stopped or (directory / 'STOP').exists():
        raise StopRun('收到停止指令', 'manual')
    if time.time() >= end:
        raise StopRun('预定测试时间已结束', 'deadline')

def wait(seconds):
    until = time.monotonic() + max(0, seconds)
    while time.monotonic() < until:
        checkpoint()
        # 两次取时之间可能恰好越过截止点，不能把负数传给 sleep。
        time.sleep(max(0, min(1, until - time.monotonic())))

def wait_request_slot():
    # 等待后重新计算窗口；刷新令牌也使用同一配额，不能提前占用业务请求的时间戳。
    while True:
        checkpoint()
        now = time.monotonic()
        while request_times and now - request_times[0] >= 60:
            request_times.popleft()
        delay = max(0, 60 - (now - request_times[0]) + .1) if len(request_times) >= 30 else 0
        if request_times:
            delay = max(delay, .5 - (now - request_times[-1]))
        if delay <= 0:
            return
        wait(delay)

def save():
    summary['updatedAt'] = time.time()
    temp = directory / 'live-summary.tmp'
    temp.write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    temp.chmod(0o600)
    temp.replace(directory / 'live-summary.json')

def record(kind, label, **details):
    entry = {'at': time.time(), 'kind': kind, 'label': label, **details}
    with (directory / 'live-events.jsonl').open('a') as file:
        file.write(json.dumps(entry, ensure_ascii=False) + '\n')
    if kind == 'pass':
        summary['checks'] += 1
        summary['coverage'][label] = summary['coverage'].get(label, 0) + 1
    save()

def check(condition, label):
    if not condition:
        # label 仅由受控断言构造，不记录任意异常正文或请求凭据。
        summary.setdefault('failedChecks', []).append(label)
        record('failure', label)
        raise AssertionError(label)
    record('pass', label)

class Actor:
    def __init__(self, account, index):
        self.account, self.index = account, index
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect(), urllib.request.HTTPCookieProcessor(self.jar))
        self.token, self.expires = None, 0
        self.state, self.catalog = None, None
        self.planned, self.last_journal = 0, 0
        self.done = set()
        self.last_id, self.experience = None, 0
        self.coins = None
        self.wait_until = 0
        self.operations, self.claims = [], []
        self.last_write_before = self.last_write_after = self.last_write_receipt = None
        self.login()

    def request(self, path, body=None, key=None, method=None, auth=True):
        checkpoint()
        assert path.startswith('/api/v3/') and '://' not in path and '\n' not in path
        # 全部账号共用每分钟 30 次上限，登录与刷新也计入；不做压测轰炸。
        while True:
            wait_request_slot()
            # 限流等待期间也可能过期。刷新请求 auth=False，结束后重新排队业务请求。
            if auth and time.time() >= self.expires:
                self.refresh_token()
                continue
            break
        checkpoint()
        request_times.append(time.monotonic())
        # urllib 不把 localhost 视为安全上下文，仅在这个固定 loopback 夹具模拟浏览器 Cookie 传输。
        for cookie in self.jar:
            cookie.secure = False
        headers = {'Origin': BASE, 'User-Agent': 'Pet-local-soak/1', 'Accept': 'application/json'}
        if body is not None:
            headers['Content-Type'] = 'application/json'
        if auth and self.token:
            headers['Authorization'] = 'Bearer ' + self.token
        if key:
            headers['Idempotency-Key'] = key
        request = urllib.request.Request(BASE + path, data=None if body is None else json.dumps(body).encode(), headers=headers, method=method)
        summary['requests'] += 1
        try:
            response = self.opener.open(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(2_000_001)
            if len(raw) > 2_000_000:
                raise AssertionError('接口响应超过测试预算')
            status = response.status
        try:
            result = json.loads(raw)
        except ValueError:
            raise AssertionError('本地接口未返回完整 JSON') from None
        check(isinstance(result, dict), '接口响应为 JSON 对象')
        record('request', path, actor=self.index, status=status, code=result.get('code'))
        if status in (401, 403, 429):
            summary['status'] = 'blocked'
            raise StopRun('身份或限流响应，已停止后续请求：' + str(status), 'blocked')
        if status >= 500:
            summary['status'] = 'failed'
            raise StopRun('本地服务异常，停止写入：' + str(status), 'service_error')
        return status, result

    def login(self):
        status, result = self.request('/api/v3/auth/login', {
            'nameOrEmail': self.account['name'],
            'userPassword': hashlib.md5(self.account['password'].encode()).hexdigest(), 'mfaCode': ''}, auth=False)
        check(status == 200 and result.get('code') == 0, '临时普通账号登录')
        self.set_token(result['data'])

    def set_token(self, data):
        check(isinstance(data.get('accessToken'), str) and bool(data['accessToken'])
              and type(data.get('expiresIn')) is int and data['expiresIn'] > 60, '令牌有效期可安全续期')
        self.token = data['accessToken']
        self.expires = time.time() + data['expiresIn'] - 60

    def refresh_token(self):
        if time.time() < self.expires:
            return
        status, result = self.request('/api/v3/auth/refresh', {}, auth=False)
        check(status == 200 and result.get('code') == 0, '刷新 Cookie 正常轮换')
        self.set_token(result['data'])

    def get(self, path):
        status, result = self.request(path)
        check(status == 200 and result.get('code') == 0, '公开协议与本人资源响应')
        return result['data']

    def read(self):
        self.state = self.get('/api/v3/me/pet')
        state, pet = self.state, self.state['pet']
        check(isinstance(state['wallet']['coins'], int) and state['wallet']['coins'] >= 0, '钱包非负整数')
        check(state['income']['earned'] + state['income']['remaining'] == state['income']['limit'], '工作共享额度守恒')
        check(len({x['itemId'] for x in state['inventory']}) == len(state['inventory']) and all(x['quantity'] >= 0 for x in state['inventory']), '库存唯一且非负')
        if pet:
            check(all(0 <= pet[field] <= 100 for field in ('hunger', 'water', 'mood', 'energy', 'friendship')), '日常状态有界')
            check(0 <= pet['growthToday']['used'] <= pet['growthToday']['limit'], '每日照顾成长上限')
            if self.last_id == pet['id']:
                check(pet['experience'] >= self.experience, '同一宠物经验不倒退')
            self.last_id, self.experience = pet['id'], pet['experience']
        row = {'index': self.index, 'coins': state['wallet']['coins'], 'experience': pet['experience'] if pet else None,
               'level': pet['level'] if pet else None, 'activity': pet['activity']['kind'] if pet and pet['activity'] else None}
        while len(summary['actors']) <= self.index:
            summary['actors'].append({})
        summary['actors'][self.index] = row
        save()
        return state

    def write(self, endpoint, body, method='POST', expected=200):
        # 拒绝写也必须有写前快照，不能只检验返回码。
        before = deepcopy(self.read() if expected != 200 else self.state)
        key = 'soak:' + uuid.uuid4().hex
        command_file = directory / ('pending-' + str(self.index) + '.json')
        check(not command_file.exists(), '未完成命令不得被新操作覆盖')
        # 为已开始操作的限流等待、回执重放和读取核验留出收尾时间，不延长本轮截止时间。
        if end - time.time() < 90:
            wait(max(0, end - time.time()))
            checkpoint()
        command = {'path': endpoint, 'method': method, 'body': body, 'key': key, 'phase': 'unconfirmed'}
        def save_command():
            temp = command_file.with_suffix('.tmp')
            temp.write_text(json.dumps(command))
            temp.chmod(0o600)
            temp.replace(command_file)
        # 写前保存原命令；若请求中断，仅留档，不生成新键，也不自动再扣费。
        save_command()
        status, result = self.request('/api/v3/me/pet/' + endpoint, body, key, method)
        # 后置 GET 失败属于核验未完成，不再把这次操作当成未知写入或自动重写。
        if status == 200 and result.get('code') == 0:
            command.update(phase='confirmed_verification_pending', outcome='committed', verification='first-read')
            save_command()
        elif status == expected and expected != 200:
            command.update(phase='confirmed_verification_pending', outcome='rejected', verification='first-read')
            save_command()
        check(status == expected, '预期写入状态 ' + endpoint + ' ' + str(expected))
        if expected == 200:
            check(result.get('code') == 0, '写回执成功 ' + endpoint)
        if expected == 200:
            self.read()
            confirmed_state = deepcopy(self.state)
            command['verification'] = 'confirmed-replay'
            save_command()
            # 测试明确重复同一已成功命令，再核对实际资产没有发生第二次变化。
            status2, result2 = self.request('/api/v3/me/pet/' + endpoint, body, key, method)
            check(status2 == 200 and result['data'] == result2['data'], '同键回执不变 ' + endpoint)
            command['verification'] = 'replayed-read'
            save_command()
        self.read()
        if expected == 200:
            assert_unchanged(confirmed_state, self.state, check, '同键重放 ' + endpoint + '：')
            operation = {'endpoint': endpoint, 'before': before, 'after': deepcopy(confirmed_state), 'receipt': deepcopy(result['data'])}
            self.operations.append(operation)
            if endpoint == 'activities/claim':
                activity = before['pet']['activity']
                expected_rewards = assert_activity_rewards(before, confirmed_state, activity, check)
                self.claims.append({'before': before, 'activity': deepcopy(activity), 'expected': expected_rewards})
            self.last_write_before, self.last_write_after, self.last_write_receipt = before, deepcopy(confirmed_state), deepcopy(result['data'])
        else:
            check(result.get('code') != 0, '拒绝写返回明确业务错误 ' + endpoint)
            assert_unchanged(before, self.state, check, '拒绝写 ' + endpoint + '：')
        command_file.unlink()
        return result

    def care(self, action, item=None):
        body = {'petId': self.state['pet']['id'], 'action': action}
        if item:
            body['itemId'] = item
        self.write('actions', body)

    def initialize(self):
        self.catalog = self.get('/api/v3/pets/catalog')
        check(len(self.catalog['species']) == 4 and len(self.catalog['jobs']) == 6 and len(self.catalog['courses']) == 12, '四宠六工作十二课程目录')
        self.read()
        check(self.state['pet'] is None, '测试账号初始无宠物')
        self.write('adoption', {'speciesId': self.catalog['species'][self.index]['id'], 'name': '耐久伙伴' + str(self.index + 1)})
        check(self.state['wallet']['coins'] == self.catalog['rules']['initialCoins'], '首次奖励只发一次')
        self.write('name', {'petId': self.state['pet']['id'], 'name': '测试伙伴' + str(self.index + 1)}, 'PUT')
        self.write('purchases', {'petId': self.state['pet']['id'], 'itemId': 'food', 'quantity': 0, 'catalogVersion': self.catalog['version']}, expected=422)
        self.write('adoption', {'speciesId': self.catalog['species'][self.index]['id'], 'name': '重复'}, expected=409)
        self.write('supplies', {'expectedDate': self.state['today']})
        # 刚领养时饱食/水分均为100，普通喂食饮水留到自然衰减后验证。
        self.care('pet')
        self.care('rest')
        self.care('wake')
        self.write('purchases', {'petId': self.state['pet']['id'], 'itemId': 'fruit', 'quantity': 1, 'catalogVersion': self.catalog['version']})
        self.care('feed', 'fruit')
        check(self.care_story()['completedSteps'] == 1, '陪伴旅程先完成喂食')
        self.wait_until = 0

    def care_story(self):
        return next(story for story in self.state['stories'] if story['id'] == 'care-companion')

    def claim_story(self, story_id):
        before = deepcopy(self.state)
        body = {'petId': before['pet']['id'], 'storyId': story_id, 'catalogVersion': self.catalog['version']}
        self.write('stories/claim', body)
        expected = next(story for story in self.catalog['stories'] if story['id'] == story_id)['rewards']['items']
        check(delta(before['inventory'], self.state['inventory']) == {row['itemId']: row['quantity'] for row in expected}, '旅程奖励物品准确到账')
        check(next(story for story in self.state['stories'] if story['id'] == story_id)['status'] == 'claimed', '旅程奖励标记已领取')
        # 同键回放由 write 覆盖；再用新键验证业务层也拒绝重复发奖。
        self.write('stories/claim', body, expected=409)

    def advance_care_story(self):
        story, pet = self.care_story(), self.state['pet']
        if story['status'] != 'active':
            return
        if story['completedSteps'] == 1 and pet['water'] <= 99:
            self.care('water')
            check(self.care_story()['completedSteps'] == 2, '陪伴旅程第二步饮水')
        if self.care_story()['completedSteps'] == 2 and self.state['pet']['cooldowns']['play'] <= self.state['serverNow']:
            self.care('play')
            check(self.care_story()['completedSteps'] == 3 and self.care_story()['status'] == 'claimable', '陪伴旅程最后玩耍后才可领取')

    def audit_history(self, require_multiple_pages=False):
        def pages(resource):
            first = self.get('/api/v3/me/pet/' + resource + '?kind=all&p=1&size=10')
            count = first['pagination']['pageCount']
            check(isinstance(count, int) and 1 <= count <= 200, '历史分页在有界读取预算内')
            values = [first]
            for page in range(2, count + 1):
                values.append(self.get('/api/v3/me/pet/' + resource + '?kind=all&p=' + str(page) + '&size=10'))
            return assert_pages(values, check, resource, require_multiple_pages)
        journal, activities = pages('journal'), pages('activities')
        assert_history(journal, activities, self.operations, self.claims, check)
        record('history-audit', '全页日志与活动成果对账完成', actor=self.index, journal=len(journal), activities=len(activities))
        return journal, activities

    def eligible(self, entry):
        skills = {s['id']: s['experience'] for s in self.state['pet']['skills']}
        requirements = list(entry.get('requirements', []))
        if entry.get('requirement'):
            requirements.append(entry['requirement'])
        return all(skills.get(r['skillId'], 0) >= r['experience'] for r in requirements)

    def step(self):
        self.refresh_token()
        self.read()
        pet, state = self.state['pet'], self.state
        activity = pet['activity']
        if activity:
            if activity['kind'] == 'rest':
                if pet['energy'] >= 85 or time.time() > end - 120:
                    self.care('wake')
                return
            if activity['status'] == 'claimable':
                before = pet['experience']
                reward = activity['rewards']['experience']
                self.write('activities/claim', {'petId': pet['id'], 'activityId': activity['id']})
                check(self.state['pet']['experience'] == before + reward, '自然计时领取冻结经验一次')
                def gains(before_rows, after_rows, key, field):
                    previous = {row[key]: row[field] for row in before_rows}
                    return [{key: row[key], field: row[field] - previous.get(row[key], 0)} for row in after_rows
                            if row[field] != previous.get(row[key], 0)]
                completed = {'actor': self.index, 'activityId': activity['id'], 'kind': activity['kind'],
                             'entryId': activity['entryId'], 'name': activity['name'], 'startedAt': activity['startedAt'],
                             'endsAt': activity['endsAt'], 'verifiedAt': self.state['serverNow'],
                             'rewards': {'experience': self.state['pet']['experience'] - before,
                                         'coins': self.state['wallet']['coins'] - state['wallet']['coins'],
                                         'items': gains(state['inventory'], self.state['inventory'], 'itemId', 'quantity'),
                                         'skills': gains(pet['skills'], self.state['pet']['skills'], 'id', 'experience'),
                                         'jobs': gains(pet['jobs'], self.state['pet']['jobs'], 'id', 'experience')}}
                summary['completedActivities'].append(completed)
                record('activity-complete', '自然计时活动成果已核验', activity=completed)
                self.done.add(activity['entryId'])
            return
        if not state['dailySupply']['claimed']:
            self.write('supplies', {'expectedDate': state['today']})
        self.advance_care_story()
        for story in self.state['stories']:
            if story['status'] == 'claimable':
                self.claim_story(story['id'])
        # 旅程可能刚完成饮水/玩耍，后续照顾必须使用新快照，避免再次饮水。
        pet = self.state['pet']
        food = next((i['quantity'] for i in self.state['inventory'] if i['itemId'] == 'food'), 0)
        if pet['hunger'] <= 65:
            if not food:
                self.write('purchases', {'petId': pet['id'], 'itemId': 'food', 'quantity': 1, 'catalogVersion': self.catalog['version']})
            self.care('feed', 'food')
        if pet['water'] <= 65:
            self.care('water')
        if pet['energy'] < 35:
            self.care('rest')
            return
        # 将不同课程分散到四个真实账号，测试期间不加速时钟；全部目录边界另由隔离专项覆盖。
        basics = [x for x in self.catalog['courses'] if x['durationMs'] == 600000]
        basic = basics[self.index % len(basics)]
        advanced = next(x for x in self.catalog['courses'] if x['durationMs'] > 600000 and x['rewards']['skills'][0]['id'] == basic['rewards']['skills'][0]['id'])
        job = next(x for x in self.catalog['jobs'] if x['requirement']['skillId'] == basic['rewards']['skills'][0]['id'])
        entries = [('course', basic), ('course', basic), ('course', advanced), ('work', job)]
        entries += [('outing', x) for x in self.catalog['places'] if self.eligible(x)]
        if self.planned >= len(entries):
            self.planned = 0
        kind, entry = entries[self.planned]
        self.planned += 1
        if not self.eligible(entry) or self.state['wallet']['coins'] < entry['cost']['coins']:
            return
        if kind == 'work' and self.state['income']['remaining'] == 0:
            return
        if time.time() + entry['durationMs'] / 1000 + 65 >= end:
            return
        if self.state['pet']['energy'] < entry['cost']['energy']:
            self.care('rest')
            return
        # 饱食/水分响应向上取整，预留一格避免临界值在限流等待期间跌破实际消耗。
        if any(self.state['pet'][field] <= entry['cost'][field] + 1 for field in ('hunger', 'water')):
            return
        self.write('activities', {'petId': pet['id'], 'kind': kind, 'entryId': entry['id'], 'activityVersion': self.catalog['activityVersion']})
        started = self.state['pet']['activity']
        check(started is not None and started['kind'] == kind and started['entryId'] == entry['id'], '活动开始后的当前快照一致')
        activity_record = {'actor': self.index, **{k: started[k] for k in ('kind', 'entryId', 'name', 'startedAt', 'endsAt', 'cost', 'rewards')},
                           'activityId': started['id']}
        summary['startedActivities'].append(activity_record)
        record('activity-start', '真实计时活动已开始', activity=activity_record)
        if time.monotonic() - self.last_journal > 600:
            self.audit_history()
            self.last_journal = time.monotonic()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--directory', required=True)
    args = parser.parse_args()
    configure(args.directory)
    signal.signal(signal.SIGTERM, halt)
    signal.signal(signal.SIGINT, halt)
    try:
        actors = []
        for index, account in enumerate(accounts):
            actor = Actor(account, index)
            actors.append(actor)
            actor.initialize()
        summary['initialized'] = True
        record('pass', '四种宠物真实接口初始化完成')
        while True:
            checkpoint()
            cycle_start = time.monotonic()
            for actor in actors:
                actor.step()
            wait(max(1, 60 - (time.monotonic() - cycle_start)))
    except StopRun as error:
        if summary['status'] == 'running':
            summary['status'] = 'complete' if error.kind == 'deadline' else 'stopped'
        summary['reason'] = str(error)
        summary['stopReason'] = error.kind
    except Exception as error:
        summary['status'] = 'failed'
        summary['stopReason'] = 'failure'
        # 只记录异常类型与堆栈位置，不记录异常正文、代码行或局部变量中的凭据。
        summary['failures'].append(type(error).__name__)
        summary['failureFrames'] = [{'file': Path(frame.filename).name, 'line': frame.lineno, 'function': frame.name}
                                    for frame in traceback.extract_tb(error.__traceback__)]
    finally:
        summary['pendingCommands'] = sorted(path.name for path in directory.glob('pending-*.json'))
        if summary['status'] == 'complete' and summary['pendingCommands']:
            summary['status'] = 'incomplete'
            summary['stopReason'] = 'pending'
            summary['reason'] = '到期时仍有未确认或未完成核验的操作，未视为完整通过'
        summary['finishedAt'] = time.time()
        save()
        print(json.dumps({'status': summary['status'], 'checks': summary['checks'], 'requests': summary['requests']}), flush=True)

    return 0 if summary['status'] == 'complete' else 2 if summary['status'] == 'stopped' else 1


if __name__ == '__main__':
    sys.exit(main())

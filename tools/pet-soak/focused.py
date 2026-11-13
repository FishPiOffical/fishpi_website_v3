#!/usr/bin/env python3
"""真实本地 HTTP 全目录专项；局部时间夹具与八小时自然观察分开报告。"""
import argparse
import copy
import hashlib
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import traceback
import uuid

import live
from focused_fixture import LocalFixture
from focused_lifecycle import acquire_run_lock, release_run_lock, stop_status


def inventory(state):
    return {item['itemId']: item['quantity'] for item in state['inventory']}


def item_delta(before, after):
    left, right = inventory(before), inventory(after)
    return {key: right.get(key, 0) - left.get(key, 0) for key in left.keys() | right.keys()
            if right.get(key, 0) != left.get(key, 0)}


def create_run(rhythm):
    root = Path(__file__).resolve().parents[2]
    base = root / '.temp/pet-soak'
    base.mkdir(parents=True, exist_ok=True)
    lock = acquire_run_lock(base)
    try:
        identifier = 'focused-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + uuid.uuid4().hex[:6]
        directory = base / identifier
        directory.mkdir(mode=0o700)
        config = {'id': identifier, 'api': live.BASE, 'mode': 'focused-local-http',
                  'startedAt': int(time.time() * 1000), 'endsAt': int((time.time() + 3600) * 1000),
                  'websiteHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
                  'rhythmHead': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=rhythm, text=True).strip(),
                  'limitations': ['专用账号前置资金与技能', '局部活动时间推进，不代表自然计时', '不包含真实浏览器性能验收']}
        for repo in (root, rhythm):
            assert subprocess.check_output(['git', 'branch', '--show-current'], cwd=repo, text=True).strip() == 'pet'
        (directory / 'config.json').write_text(json.dumps(config, ensure_ascii=False, indent=2))
        subprocess.run([sys.executable, str(Path(__file__).with_name('prepare-local.py')), '--rhythm', str(rhythm),
                        '--output', str(directory / 'accounts.private.json')], check=True, capture_output=True)
        return directory, lock
    except BaseException:
        release_run_lock(lock)
        raise


def audit_history(actor, directory, label, require_multiple_pages=False):
    journal, activities = actor.audit_history(require_multiple_pages=require_multiple_pages)
    # 留下无身份凭据的前后快照，方便以后只读重验新增断言，不重复执行收费命令。
    evidence = {'journal': journal, 'activities': activities, 'operations': actor.operations, 'claims': actor.claims}
    path = directory / ('audit-' + str(actor.index) + '-' + label + '.private.json')
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as stream:
        json.dump(evidence, stream, ensure_ascii=False)


def claim_stories(actor, result):
    for progress in list(actor.state['stories']):
        if progress['status'] != 'claimable':
            continue
        definition = next(story for story in actor.catalog['stories'] if story['id'] == progress['id'])
        before = copy.deepcopy(actor.state)
        command = {'petId': before['pet']['id'], 'storyId': progress['id'], 'catalogVersion': actor.catalog['version']}
        actor.write('stories/claim', command)
        expected = {item['itemId']: item['quantity'] for item in definition['rewards']['items']}
        live.check(item_delta(before, actor.state) == expected, '事件链奖励物品逐项守恒 ' + progress['id'])
        live.check(before['wallet'] == actor.state['wallet'] and before['income'] == actor.state['income'],
                   '事件链不发宠物币且不改变工作额度')
        # 同键成功回放由 Actor.write 核验；新键重复领取也必须拒绝且没有资产变化。
        actor.write('stories/claim', command, expected=409)
        result['stories'].append(progress['id'])


def complete_activity(actor, fixture, kind, entry, result, exercise_rejections=False):
    fixture.recover_condition(actor)
    body = {'petId': actor.state['pet']['id'], 'kind': kind, 'entryId': entry['id'],
            'activityVersion': actor.catalog['activityVersion']}
    before = copy.deepcopy(actor.state)
    actor.write('activities', body)
    activity = copy.deepcopy(actor.state['pet']['activity'])
    live.check(activity['entryId'] == entry['id'] and activity['kind'] == kind, '专项活动身份与目录一致')
    live.check(before['wallet']['coins'] - actor.state['wallet']['coins'] == entry['cost']['coins'],
               '专项开始活动仅扣一次冻结费用')
    claim = {'petId': actor.state['pet']['id'], 'activityId': activity['id']}
    if exercise_rejections:
        actor.write('activities/claim', claim, expected=409)
        actor.write('readoption', {'petId': actor.state['pet']['id'], 'speciesId': 'paixiaoyu', 'name': '活动未结束',
                                  'catalogVersion': actor.catalog['version'], 'resetAccepted': True}, expected=409)
    fixture.make_claimable(actor)
    frozen = copy.deepcopy(actor.state['pet']['activity'])
    live.check(frozen['rewards'] == activity['rewards'] and frozen['cost'] == activity['cost'],
               '局部时间推进没有改动冻结成本和奖励')
    actor.write('activities/claim', claim)
    # 领取对全部奖励和幂等回放的核验与自然观察脚本共用，不能只比较经验。
    result['activities'].append({'actor': actor.index, 'kind': kind, 'entryId': entry['id'],
                                 'activityId': activity['id'], 'rewards': frozen['rewards'],
                                 'timeMode': 'local-fixture'})
    live.record('focused-activity', '全目录真实 HTTP 开始与领取', kindName=kind, entryId=entry['id'])
    claim_stories(actor, result)


def craft_all(actor, result):
    for recipe in actor.catalog['recipes']:
        before = copy.deepcopy(actor.state)
        command = {'petId': before['pet']['id'], 'recipeId': recipe['id'], 'catalogVersion': actor.catalog['version']}
        actor.write('crafts', command)
        live.check(item_delta(before, actor.state) == {item['itemId']: -item['quantity'] for item in recipe['ingredients']},
                   '配方逐项消耗正确 ' + recipe['id'])
        live.check(before['wallet']['coins'] - actor.state['wallet']['coins'] == recipe['coins'], '制作费用正确')
        live.check({item['id'] for item in actor.state['collections']}
                   == {item['id'] for item in before['collections']} | {recipe['collectionId']}, '制作解锁唯一收藏')
        actor.write('crafts', command, expected=409)
        result['recipes'].append(recipe['id'])


def verify_readoption(actor, fixture, result):
    before = copy.deepcopy(actor.state)
    counts_before = fixture.counts(actor)
    old_id = before['pet']['id']
    command = {'petId': old_id, 'speciesId': 'paixiaoyu', 'name': '重新领养专项',
               'catalogVersion': actor.catalog['version'], 'resetAccepted': True}
    actor.write('readoption', command)
    after = actor.state
    live.check(after['pet']['id'] != old_id and after['pet']['speciesId'] == command['speciesId'], '重新领养更换宠物身份')
    live.check(after['wallet']['coins'] == before['wallet']['coins'] - actor.catalog['readoptionRules']['coins'],
               '重新领养只扣目录费用且不补发首次奖励')
    live.check(after['pet']['experience'] == 0 and after['pet']['friendship'] == 0
               and all(item['experience'] == 0 for item in after['pet']['skills'])
               and all(item['experience'] == 0 and item['completed'] == 0 for item in after['pet']['jobs']),
               '重新领养清空新宠物成长')
    for field in ('inventory', 'collections', 'stories', 'dailySupply', 'income'):
        live.check(after[field] == before[field], '重新领养保留账号资产或额度 ' + field)
    live.check(after['pet']['growthToday'] == before['pet']['growthToday']
               and after['pet']['cooldowns'] == before['pet']['cooldowns'], '重新领养保留照顾额度与冷却')
    counts_after = fixture.counts(actor)
    live.check(all(counts_after[key] == value + (1 if key in ('pet_archive', 'pet_journal') else 0)
                   for key, value in counts_before.items()), '重新领养保留活动历史与成果且只新增一次归档日志')
    actor.write('actions', {'petId': old_id, 'action': 'water'}, expected=404)
    actor.write('adoption', {'speciesId': 'momota', 'name': '不得重领'}, expected=409)
    for story_id in result['stories']:
        actor.write('stories/claim', {'petId': after['pet']['id'], 'storyId': story_id,
                                     'catalogVersion': actor.catalog['version']}, expected=409)
    result['readoption'] = True


def run(directory):
    accounts = live.configure(directory)
    previous_handlers = {kind: signal.signal(kind, live.halt) for kind in (signal.SIGINT, signal.SIGTERM)}
    hashes = {name: hashlib.sha256(Path(__file__).with_name(name).read_bytes()).hexdigest()
              for name in ('live.py', 'assertions.py', 'focused.py', 'focused_fixture.py', 'focused_lifecycle.py', 'prepare-local.py')}
    result = {'status': 'running', 'mode': 'focused-local-http', 'activities': [], 'stories': [], 'recipes': [],
              'loadedSourceHashes': hashes,
              'readoption': False, 'startedAt': time.time(), 'limitations': [
                  '本地专用账号的资金和技能为前置夹具；不证明自然成长速度',
                  '计时活动通过局部数据库时间推进；不替代此前八小时自然观察',
                  '未改宠物业务规则，未访问生产；本轮不含真实浏览器性能或真机测试']}
    fixture = None
    try:
        fixture = LocalFixture(directory, accounts)
        actors = []
        catalog = None
        for index, account in enumerate(accounts):
            actor = live.Actor(account, index)
            actor.catalog = catalog or actor.get('/api/v3/pets/catalog')
            catalog = actor.catalog
            actor.read()
            live.check(actor.state['pet'] is None, '专项新账号没有既有宠物')
            actor.write('adoption', {'speciesId': catalog['species'][index]['id'], 'name': '专项伙伴' + str(index + 1)})
            live.check(actor.state['wallet']['coins'] == catalog['rules']['initialCoins'], '四种宠物首次奖励正确')
            actors.append(actor)
        live.summary['initialized'] = True
        main, secondary = actors[:2]
        fixture.prepare_assets(main)
        fixture.prepare_assets(secondary)
        fixture.recover_condition(main)
        main.write('supplies', {'expectedDate': main.state['today']})
        main.write('name', {'petId': main.state['pet']['id'], 'name': '完整覆盖伙伴'}, method='PUT')
        main.write('purchases', {'petId': main.state['pet']['id'], 'itemId': 'food', 'quantity': 0,
                                 'catalogVersion': catalog['version']}, expected=422)
        main.care('feed', 'food')
        main.care('water')
        main.care('play')
        live.check(next(item for item in main.state['stories'] if item['id'] == 'care-companion')['status'] == 'claimable',
                   '喂食饮水玩耍按序完成陪伴旅程')
        claim_stories(main, result)
        main.care('rest')
        main.care('wake')
        # 先覆盖原八小时没有走到的课程与两种兼职，再继续补全其他目录。
        by_id = {entry['id']: (kind, entry) for group, kind in (('courses', 'course'), ('jobs', 'work'), ('places', 'outing'))
                 for entry in catalog[group]}
        priority = ['craft-basics', 'manners-basics', 'craft-assistant', 'care-assistant', 'craft-advanced', 'manners-advanced',
                    'nature-basics', 'lotus-pond', 'nature-advanced', 'deep-forest', 'tidal-flat']
        ordered = priority + [entry_id for entry_id in by_id if entry_id not in priority]
        work_count = 0
        for ordinal, entry_id in enumerate(ordered):
            kind, entry = by_id[entry_id]
            actor = main
            if kind == 'work':
                # 两个账号分摊六类兼职，保持真实每日工作额度，不修改产币规则。
                actor = main if work_count < 3 else secondary
                work_count += 1
            complete_activity(actor, fixture, kind, entry, result, exercise_rejections=ordinal == 0)
            print(json.dumps({'completed': len(result['activities']), 'total': len(ordered), 'entry': entry_id}), flush=True)
        craft_all(main, result)
        live.check(len(result['activities']) == 24 and len({item['entryId'] for item in result['activities']}) == 24,
                   '真实 HTTP 覆盖十二课程六兼职六地点')
        live.check(set(result['stories']) == {story['id'] for story in catalog['stories']}, '三个旅程完成领取及重复拒绝')
        live.check(set(result['recipes']) == {recipe['id'] for recipe in catalog['recipes']}, '全部配方与永久收藏验证')
        audit_history(main, directory, 'before-readoption', require_multiple_pages=True)
        audit_history(secondary, directory, 'final')
        verify_readoption(main, fixture, result)
        audit_history(main, directory, 'after-readoption', require_multiple_pages=True)
        for actor in actors:
            actor.read()
            offset = fixture.offsets.get(actor.index, {}).get('coins', 0)
            live.check(actor.state['wallet']['coins'] == fixture.ledger(actor) + offset,
                       '当前钱包与真实数据库流水及明确夹具偏移一致')
        live.check(not list(directory.glob('pending-*.json')), '专项没有未确认或未核验操作')
        result['status'] = 'passed'
        live.summary['status'] = 'complete'
        live.summary['stopReason'] = 'scenario-complete'
    except live.StopRun as error:
        result['status'] = stop_status(error.kind)
        result['stopReason'] = error.kind
        live.summary.update(status=result['status'], stopReason=error.kind, reason=str(error))
    except Exception as error:
        result['status'] = 'failed'
        result['errorType'] = type(error).__name__
        if isinstance(error, AssertionError):
            # 本专项断言只有预先编写的场景说明；传输及其他异常仍不输出消息正文。
            result['assertion'] = str(error)
        result['failureFrames'] = [{'file': Path(frame.filename).name, 'line': frame.lineno, 'function': frame.name}
                                  for frame in traceback.extract_tb(error.__traceback__)]
        live.summary['status'] = 'failed'
        live.summary['failures'].append(type(error).__name__)
        # 失败立即停写并保留 pending，不自动重新领养、清空账号或重发未知命令。
    finally:
        for kind, handler in previous_handlers.items():
            signal.signal(kind, handler)
        result.update(finishedAt=time.time(), requests=live.summary['requests'], checks=live.summary['checks'],
                      pendingCommands=sorted(path.name for path in directory.glob('pending-*.json')),
                      fixtureOffsets=fixture.offsets if fixture else {})
        live.summary['finishedAt'] = result['finishedAt']
        live.save()
        (directory / 'focused-summary.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
        rows = ['# 宠物本地 HTTP 针对性测试', '', '- 结果：' + result['status'],
                '- HTTP 请求：' + str(result['requests']), '- 断言：' + str(result['checks']),
                '- 完成活动：' + str(len(result['activities'])) + ' / 24',
                '- 旅程：' + '、'.join(result['stories']), '- 配方：' + '、'.join(result['recipes']),
                '- 重新领养：' + str(result['readoption']), '- 待核对命令：' + str(len(result['pendingCommands'])),
                '', '## 验证边界', ''] + ['- ' + item for item in result['limitations']]
        rows += ['', '## 实际完成目录', '', '| 类型 | 条目 |', '| --- | --- |']
        rows += ['| ' + item['kind'] + ' | ' + item['entryId'] + ' |' for item in result['activities']]
        (directory / 'focused-report.md').write_text('\n'.join(rows) + '\n')
        print(json.dumps({'status': result['status'], 'directory': str(directory), 'requests': result['requests'],
                          'checks': result['checks'], 'completedActivities': len(result['activities'])}), flush=True)
    return result['status'] == 'passed'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--rhythm', type=Path, required=True)
    args = parser.parse_args()
    directory, lock = create_run(args.rhythm.resolve())
    print(json.dumps({'directory': str(directory), 'mode': 'focused-local-http'}), flush=True)
    try:
        return 0 if run(directory) else 1
    finally:
        release_run_lock(lock)


if __name__ == '__main__':
    sys.exit(main())

"""专项 HTTP 的局部数据库夹具：只处理本轮新建的 petSoak 账号。"""
import json
import os
from pathlib import Path
import re
import subprocess
import time


class LocalFixture:
    def __init__(self, directory, accounts):
        self.directory = Path(directory).resolve()
        self.accounts = accounts
        config = json.loads((self.directory / 'config.json').read_text())
        assert config.get('mode') == 'focused-local-http'
        assert config.get('api') == 'http://localhost:8081'
        assert self.directory.name.startswith('focused-') and '.temp/pet-soak/' in str(self.directory)
        assert len(accounts) == 4
        assert all(re.fullmatch(r'petSoak[0-9a-f]{10}[0-3]', item['name'])
                   and re.fullmatch(r'[1-9][0-9]{12,18}', item['id']) for item in accounts)
        assert len({item['id'] for item in accounts}) == 4
        self.created_at = config['startedAt']
        # 专项只允许新建夹具，不能拿历史八小时账号补写覆盖率。
        assert all(int(item['id']) >= self.created_at for item in accounts)
        context = subprocess.check_output(['docker', 'context', 'show'], text=True).strip()
        endpoint = os.environ.get('DOCKER_HOST') or json.loads(subprocess.check_output(
            ['docker', 'context', 'inspect', context]))[0]['Endpoints']['docker']['Host']
        assert endpoint.startswith('unix://'), '专项只能连接本机 Docker'
        info = json.loads(subprocess.check_output(['docker', '--host', endpoint, 'inspect', 'rhythm-dev-mysql']))[0]
        assert info['State']['Running'] and info['Name'] == '/rhythm-dev-mysql'
        environment = dict(value.split('=', 1) for value in info['Config']['Env'] if '=' in value)
        self.environment = dict(os.environ, MYSQL_PWD=environment['MYSQL_ROOT_PASSWORD'])
        self.environment.pop('DOCKER_CONTEXT', None)
        self.command = ['docker', '--host', endpoint, 'exec', '-i', '-e', 'MYSQL_PWD', 'rhythm-dev-mysql', 'mysql',
                        '-uroot', environment.get('MYSQL_DATABASE', 'rhythm'), '-N', '-B']
        self.seeded = set()
        self.offsets = {}
        self.service_pid = self.local_service_pid()

    @staticmethod
    def local_service_pid():
        rows = subprocess.check_output(
            ['lsof', '-nP', '-iTCP:8081', '-sTCP:LISTEN', '-Fpc'], text=True).splitlines()
        pids = [line[1:] for line in rows if line.startswith('p')]
        commands = [line[1:] for line in rows if line.startswith('c')]
        assert len(pids) == 1 and commands == ['java'], '8081 必须是唯一的本地 Rhythm Java 服务'
        return pids[0]

    def sql(self, statement):
        assert self.local_service_pid() == self.service_pid, '测试期间服务发生变化，停止夹具写入'
        result = subprocess.run(self.command, input=statement, capture_output=True, text=True,
                                timeout=30, env=self.environment)
        if result.returncode:
            raise RuntimeError('本地专项数据库操作失败；不输出凭据或 SQL')
        return result.stdout.strip()

    def identity(self, actor):
        account = self.accounts[actor.index]
        assert actor.account == account
        uid = account['id']
        # 所有 SQL 标识均来自本轮清单，并额外核实真实用户、角色和宠物归属。
        expected = account['name'] + ':defaultRole:0'
        actual = self.sql("SELECT CONCAT(userName,':',userRole,':',userStatus) "
                          "FROM symphony_user WHERE oId='" + uid + "'")
        assert actual == expected, '夹具账号身份不一致'
        pet_id = actor.state['pet']['id']
        assert re.fullmatch(r'[1-9][0-9]{0,18}', pet_id)
        assert self.sql("SELECT oId FROM symphony_user_pet WHERE userId='" + uid + "'") == pet_id
        return uid, pet_id

    def transaction(self, actor, statements):
        uid, pet_id = self.identity(actor)
        # 与宠物服务相同先锁用户；仅本账号行被修改，整个夹具操作一次提交。
        self.sql("START TRANSACTION;\nSELECT oId FROM symphony_user WHERE oId='" + uid + "' FOR UPDATE;\n"
                 + '\n'.join(statements) + '\nCOMMIT;')
        return uid, pet_id

    def record(self, kind, actor, **fields):
        with (self.directory / 'fixture-events.jsonl').open('a') as stream:
            stream.write(json.dumps({'at': time.time(), 'kind': kind, 'actor': actor.index, **fields}) + '\n')

    def prepare_assets(self, actor):
        assert actor.index not in self.seeded, '前置资产只准备一次'
        uid, pet_id = self.identity(actor)
        assert actor.state['wallet']['coins'] == actor.catalog['rules']['initialCoins']
        assert actor.state['pet']['experience'] == 0 and all(item['experience'] == 0 for item in actor.state['pet']['skills'])
        now = int(time.time() * 1000)
        statements = ["UPDATE symphony_pet_account SET coins=coins+9900 WHERE oId='" + uid + "';"]
        for skill in ('vitality', 'exploration', 'knowledge', 'expression', 'crafting', 'kindness'):
            statements.append("INSERT INTO symphony_pet_skill(oId,userId,petId,skillId,experience,updatedAt) VALUES('"
                              + pet_id + ':' + skill + "','" + uid + "','" + pet_id + "','" + skill + "',20," + str(now) + ');')
        self.transaction(actor, statements)
        self.seeded.add(actor.index)
        self.offsets[actor.index] = {'coins': 9900, 'skills': 20, 'initialPetId': pet_id}
        self.record('explicit-assets', actor, coinsOffset=9900, skillExperiencePerKind=20,
                    note='前置夹具，不属于游戏奖励，不用于证明自然成长速度')
        actor.read()

    def recover_condition(self, actor):
        uid, pet_id = self.identity(actor)
        assert actor.state['pet']['activity'] is None, '不能覆盖正在进行的活动或休息'
        now = int(time.time() * 1000)
        self.transaction(actor, ["UPDATE symphony_user_pet SET hunger=80,water=80,mood=50,energy=100,lastCalculatedAt="
                                 + str(now) + " WHERE oId='" + pet_id + "' AND userId='" + uid + "';"])
        self.record('explicit-condition', actor, note='局部体力前置，不改成长/奖励/冷却/日限')
        actor.read()

    def make_claimable(self, actor):
        uid, pet_id = self.identity(actor)
        activity = actor.state['pet']['activity']
        assert activity and activity['kind'] in ('outing', 'course', 'work') and activity['status'] == 'running'
        activity_id = activity['id']
        assert re.fullmatch(r'[1-9][0-9]{0,18}', activity_id)
        duration = activity['endsAt'] - activity['startedAt']
        ends = int(time.time() * 1000) - 1000
        starts = ends - duration
        self.transaction(actor, ["UPDATE symphony_pet_activity SET startedAt=" + str(starts) + ',endsAt=' + str(ends)
                                 + " WHERE oId='" + activity_id + "' AND userId='" + uid + "' AND petId='" + pet_id
                                 + "' AND claimedAt=0 AND slotKey='active:" + uid + "';"])
        self.record('explicit-activity-time', actor, activityId=activity_id, originalStartedAt=activity['startedAt'],
                    originalEndsAt=activity['endsAt'], startedAt=starts, endsAt=ends,
                    note='只平移本次活动时间，保留原时长和冻结成本奖励；不是自然等待测试')
        actor.read()
        assert actor.state['pet']['activity']['status'] == 'claimable'

    def ledger(self, actor):
        uid, _ = self.identity(actor)
        return int(self.sql('SELECT COALESCE(SUM(coinDelta),0) FROM symphony_pet_ledger WHERE userId=\'' + uid + "'"))

    def counts(self, actor):
        uid, _ = self.identity(actor)
        tables = ('pet_activity', 'pet_activity_result', 'pet_journal', 'pet_collection', 'pet_archive')
        return {table: int(self.sql('SELECT COUNT(*) FROM symphony_' + table + " WHERE userId='" + uid + "'"))
                for table in tables}

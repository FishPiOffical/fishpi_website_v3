#!/usr/bin/env python3
"""只在固定本地开发库创建独立 soak 账号；凭据仅保存到忽略目录。"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--rhythm', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
output = Path(args.output).resolve()
assert '.temp/pet-soak/' in str(output), '输出必须在本地忽略的测试目录'
assert not output.exists(), '不能覆盖既有账号文件'
fixtures = json.loads((Path(args.rhythm) / '.idea/rhythm-local/sso-fixtures.json').read_text())
source = fixtures[0]
assert source['id'].isdigit() and source['name'].startswith('ssoLocal'), '仅允许临时账号模板'
docker_host = os.environ.get('DOCKER_HOST', '')
if not docker_host:
    context = subprocess.check_output(['docker', 'context', 'show'], text=True).strip()
    docker_host = json.loads(subprocess.check_output(['docker', 'context', 'inspect', context]))[0]['Endpoints']['docker']['Host']
assert docker_host.startswith('unix://'), '只能使用本机 Docker socket'
# 固定已经校验的本机 socket，后续切换 Docker context 也不能把测试账号写到别处。
docker = ['docker', '--host', docker_host]
info = json.loads(subprocess.check_output([*docker, 'inspect', 'rhythm-dev-mysql']))[0]
environment = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
mysql_environment = dict(os.environ, MYSQL_PWD=environment['MYSQL_ROOT_PASSWORD'])
command = [*docker, 'exec', '-i', '-e', 'MYSQL_PWD',
           'rhythm-dev-mysql', 'mysql', '-uroot', environment.get('MYSQL_DATABASE', 'rhythm'), '-N', '-B']

def sql(statement):
    result = subprocess.run(command, input=statement, capture_output=True, text=True, timeout=30, env=mysql_environment)
    if result.returncode:
        raise RuntimeError('本地测试库操作失败；未记录 SQL 或数据库凭据')
    return result.stdout.strip()

columns = [line.split('\t')[0] for line in sql('SHOW COLUMNS FROM symphony_user').splitlines()]
assert {'oId', 'userName', 'userPassword', 'userRole', 'userNo'}.issubset(columns)
assert sql(f"SELECT CONCAT(userRole,':',userStatus,':',userAppRole) FROM symphony_user WHERE oId='{source['id']}'") == 'defaultRole:0:0'
# 只复制既有临时普通用户的缺省设置；清空身份、隐私字段及历史计数。
accounts = []
statements = ['START TRANSACTION;', 'SET @pet_soak_no=(SELECT MAX(userNo) FROM symphony_user);']
for index in range(4):
    actor = str(int(time.time() * 1000) + index)
    name = 'petSoak' + secrets.token_hex(5) + str(index)
    password = secrets.token_urlsafe(24)
    values = {
        'oId': actor, 'userName': name, 'userNickname': '宠物耐久测试' + str(index + 1),
        'userEmail': name + '@example.invalid', 'userPassword': hashlib.md5(password.encode()).hexdigest(),
        'userPhone': '', 'userQQ': '', 'userURL': '', 'userIntro': '', 'userTags': '', 'secret2fa': '', 'mbti': '',
        'userRole': 'defaultRole', 'userOnlineFlag': '0', 'userAvatarURL': '',
        'userCountry': '', 'userProvince': '', 'userCity': '', 'userLatestLoginIP': '',
    }
    zero_fields = ['userPoint','userUsedPoint','userArticleCount','userCommentCount','userTagCount','userStatus',
                   'userAppRole','onlineMinute','userLatestArticleTime','userLatestCmtTime','userLatestLoginTime',
                   'userCheckinTime','userLongestCheckinStreakStart','userLongestCheckinStreakEnd',
                   'userCurrentCheckinStreakStart','userCurrentCheckinStreakEnd','userLongestCheckinStreak','userCurrentCheckinStreak']
    values.update({key: 0 for key in zero_fields})
    def expression(column):
        if column == 'userNo':
            return '@pet_soak_no+' + str(index + 1)
        if column in values:
            # 所有变量均为本地生成值，编码为十六进制字符串，避免 SQL 文本插值转义问题。
            value = values[column]
            return str(value) if isinstance(value, int) else "CONVERT(0x" + str(value).encode().hex() + " USING utf8mb4)" if value else "''"
        return '`' + column + '`'
    statements.append('INSERT INTO symphony_user (' + ','.join('`' + c + '`' for c in columns)
                      + ') SELECT ' + ','.join(expression(c) for c in columns)
                      + " FROM symphony_user WHERE oId='" + source['id'] + "';")
    accounts.append({'id': actor, 'name': name, 'password': password})
statements.append('COMMIT;')
sql('\n'.join(statements))
output.parent.mkdir(parents=True, exist_ok=True)
with os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as file:
    json.dump(accounts, file)
print(json.dumps({'created': len(accounts), 'scope': 'rhythm-dev-mysql / petSoak 普通测试账号', 'credentials': '仅本地私有文件'}))

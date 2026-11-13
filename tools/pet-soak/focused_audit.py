#!/usr/bin/env python3
"""只读复核专项事件与本地持久化数量，不补写历史测试结果。"""
import argparse
import json
import os
from pathlib import Path
from types import SimpleNamespace

from focused_fixture import LocalFixture


def successful_commands(events):
    counts = {}
    last_request = None
    prefix = '写回执成功 '
    for event in events:
        if event['kind'] == 'request':
            last_request = event
        elif event['kind'] == 'pass' and event['label'].startswith(prefix):
            endpoint = event['label'][len(prefix):]
            assert last_request and last_request['status'] == 200 and last_request['code'] == 0
            assert last_request['label'] == '/api/v3/me/pet/' + endpoint, '写回执缺少对应请求证据'
            actor = str(last_request['actor'])
            values = counts.setdefault(actor, {})
            values[endpoint] = values.get(endpoint, 0) + 1
            # 一次请求证据只能对应一次成功命令，重复 PASS 行不能制造第二次消费。
            last_request = None
    return counts


def audit(directory):
    directory = Path(directory).resolve()
    result = json.loads((directory / 'focused-summary.json').read_text())
    assert result['status'] == 'passed', '只为完整成功的专项生成最终对账，不覆盖失败记录'
    accounts = json.loads((directory / 'accounts.private.json').read_text())
    fixture = LocalFixture(directory, accounts)
    events = [json.loads(line) for line in (directory / 'live-events.jsonl').read_text().splitlines()]
    commands = successful_commands(events)
    checks = []
    for index, account in enumerate(accounts):
        uid = account['id']
        pet_id = fixture.sql("SELECT oId FROM symphony_user_pet WHERE userId='" + uid + "'")
        actor = SimpleNamespace(index=index, account=account, state={'pet': {'id': pet_id}})
        actual = fixture.counts(actor)
        operations = commands.get(str(index), {})
        expected = {
            'pet_activity': operations.get('activities', 0),
            'pet_activity_result': operations.get('activities/claim', 0),
            'pet_journal': sum(operations.get(endpoint, 0) for endpoint in
                               ('actions', 'purchases', 'crafts', 'stories/claim', 'readoption')),
            'pet_collection': operations.get('crafts', 0),
            'pet_archive': operations.get('readoption', 0),
        }
        assert actual == expected, '数据库记录数量与单次成功回执数量不一致'
        offset = result['fixtureOffsets'].get(str(index), {}).get('coins', 0)
        coins = int(fixture.sql("SELECT coins FROM symphony_pet_account WHERE oId='" + uid + "'"))
        ledger = fixture.ledger(actor)
        assert coins == ledger + offset, '钱包与流水及明确前置资金不一致'
        checks.append({'actor': index, 'successfulCommands': operations, 'databaseCounts': actual,
                       'wallet': coins, 'ledgerCoins': ledger, 'fixtureCoinsOffset': offset})
    report = {'status': 'passed', 'mode': 'read-only-local-database', 'actors': checks,
              'meaning': '按真实 HTTP 单次成功回执统计，核对日志/活动/成果/收藏/归档恰好一次及钱包流水；未重发命令'}
    output = directory / 'read-only-audit.json'
    with os.fdopen(os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2)
    print(json.dumps({'status': report['status'], 'actors': len(checks), 'output': str(output)}))
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory', type=Path, required=True)
    audit(parser.parse_args().directory)

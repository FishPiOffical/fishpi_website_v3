"""宠物耐久检查的纯断言；允许自然时间流逝，不掩盖额外消费或重复发奖。"""
from copy import deepcopy
import math


def quantities(rows, key='itemId', value='quantity'):
    result = {}
    for row in rows:
        result[row[key]] = result.get(row[key], 0) + row[value]
    return result


def delta(before, after, key='itemId', value='quantity'):
    left, right = quantities(before, key, value), quantities(after, key, value)
    return {name: right.get(name, 0) - left.get(name, 0) for name in left.keys() | right.keys()
            if right.get(name, 0) != left.get(name, 0)}


def assets(state, at=None):
    """不把自然衰减值混入资产；休息开始/结束时间仍属于必须保持的状态。"""
    pet = state['pet']
    result = {name: deepcopy(state[name]) for name in ('wallet', 'inventory', 'collections', 'stories')}
    for name in ('inventory', 'collections', 'stories'):
        result[name].sort(key=lambda row: str(sorted(row.items())))
    if pet is None:
        return {**result, 'pet': None}
    result['pet'] = {name: deepcopy(pet[name]) for name in
                     ('id', 'name', 'speciesId', 'experience', 'friendship', 'cooldowns', 'skills', 'jobs')}
    for name in ('skills', 'jobs'):
        result['pet'][name].sort(key=lambda row: row['id'])
    activity = deepcopy(pet['activity'])
    if activity:
        activity.pop('status', None)
        # 仅允许到期自然结束，绝不能把所有休息快照都排除在比较之外。
        if activity['kind'] == 'rest' and activity['endsAt'] <= (at if at is not None else state['serverNow']):
            activity = None
    result['pet']['activity'] = activity
    return result


def vital_range(before, after_time, field, gain=0):
    """公开饱食/水分/心情是 ceil，精力是 floor，因此用一格以内的真实量化区间。"""
    pet = before['pet']
    elapsed = max(0, after_time - before['serverNow']) / 3_600_000
    value = pet[field]
    if field == 'energy':
        activity = pet['activity']
        growth = 0
        if activity and activity['kind'] == 'rest':
            growth = max(0, min(after_time, activity['endsAt']) - max(before['serverNow'], activity['startedAt'])) / 3_600_000 * 20
        return (math.floor(min(100, value + growth) + 1e-9),
                math.floor(min(100, value + 1 - 1e-8 + growth) + 1e-9))
    loss = elapsed * {'hunger': 2, 'water': 3, 'mood': 1}[field]
    low = max(0, value - 1 + 1e-8 - loss)
    high = max(0, value - loss)
    return math.ceil(min(100, low + gain) - 1e-9), math.ceil(min(100, high + gain) - 1e-9)


def assert_unchanged(before, after, check, label):
    check(assets(before, after['serverNow']) == assets(after), label + '资产与活动时间不变')
    if before['today'] == after['today']:
        check(all(before[name] == after[name] for name in ('income', 'dailySupply')), label + '每日资源不变')
        if before['pet']:
            check(before['pet']['growthToday'] == after['pet']['growthToday'], label + '成长次数不变')
    if before['pet']:
        for field in ('hunger', 'water', 'mood', 'energy'):
            low, high = vital_range(before, after['serverNow'], field)
            check(low <= after['pet'][field] <= high, label + field + '仅自然变化')


def assert_activity_rewards(before, after, activity, check):
    reward, pet, current = activity['rewards'], before['pet'], after['pet']
    check(pet['id'] == current['id'] and current['activity'] is None, '领取保留宠物且释放活动位置')
    check(current['experience'] - pet['experience'] == reward['experience'], '冻结经验准确到账')
    limit = before['income']['remaining'] if before['today'] == after['today'] else before['income']['limit']
    coins = min(reward['coins'], limit) if activity['kind'] == 'work' else 0
    check(after['wallet']['coins'] - before['wallet']['coins'] == coins, '冻结薪酬按领取日额度准确到账')
    items = quantities(reward['items'])
    items['food'] = items.get('food', 0) + reward['food']
    items = {key: value for key, value in items.items() if value}
    check(delta(before['inventory'], after['inventory']) == items, '冻结口粮与材料准确到账')
    skills = quantities(reward['skills'], 'id', 'experience')
    check(delta(pet['skills'], current['skills'], 'id', 'experience') == skills, '冻结技能经验准确到账')
    jobs = {activity['entryId']: reward['proficiency']} if activity['kind'] == 'work' else {}
    check(delta(pet['jobs'], current['jobs'], 'id', 'experience') == jobs, '工作熟练度独立且准确到账')
    expected_completed = {activity['entryId']: 1} if activity['kind'] == 'work' else {}
    check(delta(pet['jobs'], current['jobs'], 'id', 'completed') == expected_completed, '工作完成次数只增加一次')
    check(current['friendship'] == pet['friendship'], '领取不额外增加亲密度')
    for field in ('hunger', 'water', 'mood', 'energy'):
        low, high = vital_range(before, after['serverNow'], field, reward['mood'] if field == 'mood' else 0)
        check(low <= current[field] <= high, '领取' + field + '符合奖励与自然变化')
    if before['today'] == after['today']:
        check(after['income']['earned'] - before['income']['earned'] == coins, '领取产币额度与钱包一致')
    return {'experience': reward['experience'], 'coins': coins, 'food': reward['food'],
            'items': deepcopy(reward['items']), 'skills': deepcopy(reward['skills']),
            'proficiency': reward['proficiency'], 'mood': reward['mood']}


def assert_pages(pages, check, label, require_multiple=False):
    check(bool(pages), label + '已读取真实分页')
    first = pages[0]['pagination']
    size, total, count = first['pageSize'], first['total'], first['pageCount']
    check(count == max(1, math.ceil(total / size)) and len(pages) == count, label + '分页总数完整')
    if require_multiple:
        check(count > 1, label + '实际覆盖多页')
    rows, seen = [], set()
    for index, page in enumerate(pages, 1):
        check(page['pagination'] == {'page': index, 'pageSize': size, 'total': total, 'pageCount': count}, label + '分页元数据一致')
        expected = min(size, max(0, total - (index - 1) * size))
        check(len(page['list']) == expected, label + '页内数量真实')
        for row in page['list']:
            identity = (row.get('recordType', 'activity'), row['id'])
            check(identity not in seen, label + '跨页无重复记录')
            seen.add(identity)
            rows.append(row)
    check(len(rows) == total, label + '所有记录不遗漏')
    order = [(row.get('occurredAt', row.get('startedAt')), int(row['id']), row.get('recordType', 'activity')) for row in rows]
    check(order == sorted(order, reverse=True), label + '时间倒序稳定')
    return rows


def assert_history(journal, activities, operations, claims, check):
    journal_activities = {row['id']: row for row in journal if row['recordType'] == 'activity'}
    check(set(journal_activities) == {row['id'] for row in activities}, '日志与活动历史 ID 完整对应')
    for row in activities:
        projected = {key: value for key, value in journal_activities[row['id']].items() if key != 'recordType'}
        # 读取两份分页期间可自然到期，但其余冻结/实际成果不能改变。
        check({k: v for k, v in projected.items() if k != 'status'} == {k: v for k, v in row.items() if k != 'status'}, '日志与活动历史冻结及实际成果一致')
    events = [row for row in journal if row['recordType'] == 'event']
    journal_endpoints = ('actions', 'purchases', 'crafts', 'stories/claim', 'readoption')
    # 这些专用新账号的所有写入均由本轮发起；额外不同 ID 的重复日志也不能漏掉。
    expected_events = [operation for operation in operations if operation['endpoint'] in journal_endpoints]
    check(len(events) == len(expected_events), '日志事件数量与成功命令一一对应')
    for operation in operations:
        before, after, receipt, endpoint = (operation[key] for key in ('before', 'after', 'receipt', 'endpoint'))
        if endpoint not in journal_endpoints:
            continue
        matches = [row for row in events if row['petId'] == receipt['petId'] and row['action'] == receipt['operation'] and row['occurredAt'] == receipt['committedAt']]
        check(len(matches) == 1, '成功命令对应唯一日志且重放不重复记账')
        row = matches[0]
        check(row['coinsDelta'] == after['wallet']['coins'] - before['wallet']['coins'], '日志币变化与写后资产一致')
        check(quantities(row['itemChanges']) == delta(before['inventory'], after['inventory']), '日志物品变化与写后背包一致')
        # 重新领养记录费用，不把新宠物成长归零伪装为负奖励。
        for field in ('experience', 'friendship'):
            expected = 0 if endpoint == 'readoption' else after['pet'][field] - before['pet'][field]
            check(row['effects'][field] == expected, '日志' + field + '变化与写后状态一致')
    history_by_id = {row['id']: row for row in activities}
    for claim in claims:
        row = history_by_id.get(claim['activity']['id'])
        check(row is not None and row['status'] == 'claimed' and row['actualRewards'] is not None, '已领奖活动保存真实成果')
        expected, actual = claim['expected'], row['actualRewards']
        check({k: v for k, v in actual.items() if k != 'mood'} == {k: v for k, v in expected.items() if k != 'mood'}, '实际成果各奖励字段与资产核验一致')
        before = claim['before']
        # 实际心情允许上限截断；公开状态舍入导致原值只可确定在一格以内。
        elapsed = max(0, row['claimedAt'] - before['serverNow']) / 3_600_000
        lower_mood = max(0, before['pet']['mood'] - 1 - elapsed)
        upper_mood = max(0, before['pet']['mood'] - elapsed)
        low, high = min(expected['mood'], 100 - upper_mood), min(expected['mood'], 100 - lower_mood)
        check(low - 1e-7 <= actual['mood'] <= high + 1e-7, '实际心情成果遵守上限而非伪造满额')

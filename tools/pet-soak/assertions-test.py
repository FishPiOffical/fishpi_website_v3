#!/usr/bin/env python3
"""只注入本地快照，不发 HTTP；证明报告新增断言能抓住错误，而非仅跑正常样本。"""
from copy import deepcopy
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from assertions import assert_activity_rewards, assert_history, assert_pages, assert_unchanged
import live


def verify(value, label):
    if not value:
        raise AssertionError(label)


def state():
    return {'serverNow': 1_000_000, 'today': '2026-11-13', 'wallet': {'coins': 100},
            'income': {'earned': 55, 'remaining': 5, 'limit': 60}, 'dailySupply': {'claimed': True},
            'inventory': [{'itemId': 'food', 'quantity': 5}], 'collections': [], 'stories': [],
            'pet': {'id': '1', 'name': '伙伴', 'speciesId': 'hexiaotun', 'experience': 20,
                    'friendship': 6, 'hunger': 80, 'water': 80, 'mood': 80, 'energy': 80,
                    'cooldowns': {'pet': 0, 'play': 0}, 'growthToday': {'used': 3, 'limit': 10},
                    'skills': [{'id': 'crafting', 'experience': 20}],
                    'jobs': [{'id': 'craft-assistant', 'experience': 4, 'completed': 1}], 'activity': None}}


def claimed_fixture():
    before = state()
    activity = {'id': '11', 'kind': 'work', 'entryId': 'craft-assistant', 'startedAt': 1,
                'endsAt': 999_999, 'cost': {'coins': 0, 'hunger': 0, 'water': 0, 'energy': 0},
                'rewards': {'experience': 10, 'coins': 12, 'food': 1, 'items': [{'itemId': 'food', 'quantity': 1}, {'itemId': 'reed', 'quantity': 2}],
                            'skills': [{'id': 'crafting', 'experience': 3}], 'proficiency': 5, 'mood': 8}}
    before['pet']['activity'] = activity
    after = deepcopy(before)
    after['serverNow'] += 1000
    after['wallet']['coins'] += 5
    after['income'].update(earned=60, remaining=0)
    after['inventory'] = [{'itemId': 'food', 'quantity': 7}, {'itemId': 'reed', 'quantity': 2}]
    after['pet'].update(activity=None, experience=30, mood=88,
                        skills=[{'id': 'crafting', 'experience': 23}],
                        jobs=[{'id': 'craft-assistant', 'experience': 9, 'completed': 2}])
    return before, after, activity


class AssertionsTest(unittest.TestCase):
    def test_import_has_no_account_or_network_side_effect(self):
        self.assertIsNone(live.directory)
        self.assertEqual(live.summary, {})

    def test_all_rewards_and_daily_cap_and_food_aggregation(self):
        before, after, activity = claimed_fixture()
        expected = assert_activity_rewards(before, after, activity, verify)
        self.assertEqual(expected['coins'], 5)
        self.assertEqual(expected['food'], 1)

    def test_reward_faults_are_rejected(self):
        before, after, activity = claimed_fixture()
        mutations = [lambda row: row['wallet'].update(coins=112),
                     lambda row: row['pet'].update(experience=29),
                     lambda row: row['inventory'][0].update(quantity=6),
                     lambda row: row['inventory'][1].update(quantity=1),
                     lambda row: row['pet']['skills'][0].update(experience=22),
                     lambda row: row['pet']['jobs'][0].update(experience=8),
                     lambda row: row['pet']['jobs'][0].update(completed=3),
                     lambda row: row['pet'].update(friendship=8),
                     lambda row: row['pet'].update(mood=85),
                     lambda row: row['income'].update(earned=59)]
        for change in mutations:
            with self.subTest(change=mutations.index(change)):
                faulty = deepcopy(after)
                change(faulty)
                with self.assertRaises(AssertionError):
                    assert_activity_rewards(before, faulty, activity, verify)

    def test_reward_cap_across_day(self):
        before, after, activity = claimed_fixture()
        after['today'] = '2026-11-14'
        after['wallet']['coins'] = 112
        after['income'].update(earned=12, remaining=48)
        assert_activity_rewards(before, after, activity, verify)

    def test_rejection_cannot_change_assets_or_daily_state(self):
        before = state()
        for mutation in [lambda x: x['wallet'].update(coins=99),
                         lambda x: x['inventory'][0].update(quantity=4),
                         lambda x: x['pet']['cooldowns'].update(play=888),
                         lambda x: x['pet']['growthToday'].update(used=4),
                         lambda x: x['pet'].update(mood=90),
                         lambda x: x['pet'].update(energy=75)]:
            after = deepcopy(before)
            mutation(after)
            with self.assertRaises(AssertionError):
                assert_unchanged(before, after, verify, '拒绝写')

    def test_rest_replay_keeps_start_and_end(self):
        before = state()
        before['pet']['activity'] = {'kind': 'rest', 'startedAt': 1_000_000, 'endsAt': 15_400_000}
        after = deepcopy(before)
        after['serverNow'] += 180_000
        after['pet']['energy'] += 1
        assert_unchanged(before, after, verify, '休息回放')
        after['pet']['activity']['startedAt'] += 1
        after['pet']['activity']['endsAt'] += 1
        with self.assertRaises(AssertionError):
            assert_unchanged(before, after, verify, '休息回放')

    def test_rest_can_naturally_end(self):
        before = state()
        before['pet']['activity'] = {'kind': 'rest', 'startedAt': -13_390_000, 'endsAt': 1_010_000}
        after = deepcopy(before)
        after['serverNow'] += 20_000
        after['pet']['activity'] = None
        assert_unchanged(before, after, verify, '休息到期')

    def test_expired_day_is_not_false_asset_failure(self):
        before, after = state(), state()
        after['today'] = '2026-11-14'
        after['income'].update(earned=0, remaining=60)
        after['dailySupply']['claimed'] = False
        after['pet']['growthToday']['used'] = 0
        assert_unchanged(before, after, verify, '跨日')

    def test_real_multiple_pages(self):
        pages = [{'pagination': {'page': 1, 'pageSize': 2, 'total': 3, 'pageCount': 2},
                  'list': [{'id': '3', 'startedAt': 3}, {'id': '2', 'startedAt': 2}]},
                 {'pagination': {'page': 2, 'pageSize': 2, 'total': 3, 'pageCount': 2},
                  'list': [{'id': '1', 'startedAt': 1}]}]
        self.assertEqual(len(assert_pages(pages, verify, '日志', True)), 3)
        mutations = [lambda p: p[1]['list'].__setitem__(0, deepcopy(p[0]['list'][1])),
                     lambda p: p.pop(), lambda p: p[1]['pagination'].update(total=4),
                     lambda p: p[0]['list'].reverse()]
        for change in mutations:
            faulty = deepcopy(pages)
            change(faulty)
            with self.assertRaises(AssertionError):
                assert_pages(faulty, verify, '日志', True)

    def test_history_receipts_actual_rewards_and_unique_journal(self):
        before, after, activity = claimed_fixture()
        expected = assert_activity_rewards(before, after, activity, verify)
        actual = deepcopy(expected)
        row = {**activity, 'status': 'claimed', 'petId': '1', 'claimedAt': 1_000_100, 'actualRewards': actual}
        claims = [{'before': before, 'activity': activity, 'expected': expected}]
        journal = [{**deepcopy(row), 'recordType': 'activity'}]
        assert_history(journal, [row], [], claims, verify)
        bad = deepcopy(row)
        bad['actualRewards']['food'] = 0
        with self.assertRaises(AssertionError):
            assert_history([{**bad, 'recordType': 'activity'}], [bad], [], claims, verify)
        p_before, p_after = state(), state()
        p_after['wallet']['coins'] -= 5
        p_after['inventory'][0]['quantity'] += 1
        operation = {'endpoint': 'purchases', 'before': p_before, 'after': p_after,
                     'receipt': {'operation': 'purchase', 'petId': '1', 'committedAt': 1_000_100}}
        event = {'recordType': 'event', 'id': '12', 'petId': '1', 'action': 'purchase', 'occurredAt': 1_000_100,
                 'coinsDelta': -5, 'itemChanges': [{'itemId': 'food', 'quantity': 1}],
                 'effects': {'experience': 0, 'friendship': 0}}
        assert_history([event], [], [operation], [], verify)
        with self.assertRaises(AssertionError):
            assert_history([event, deepcopy(event)], [], [operation], [], verify)
        event['coinsDelta'] = -10
        with self.assertRaises(AssertionError):
            assert_history([event], [], [operation], [], verify)

    def test_care_story_water_before_play(self):
        actor = live.Actor.__new__(live.Actor)
        actor.state = state()
        actor.state['stories'] = [{'id': 'care-companion', 'completedSteps': 1, 'status': 'active'}]
        order = []
        def care(action):
            order.append(action)
            actor.state['stories'][0]['completedSteps'] += 1
            if action == 'play':
                actor.state['stories'][0]['status'] = 'claimable'
        actor.care = care
        with patch.object(live, 'check', verify):
            actor.advance_care_story()
        self.assertEqual(order, ['water', 'play'])

    def test_care_story_uses_fresh_state_for_later_care(self):
        actor = live.Actor.__new__(live.Actor)
        actor.state = state()
        actor.state['pet']['water'] = 60
        actor.state['stories'] = [{'id': 'care-companion', 'completedSteps': 1, 'status': 'active'}]
        actor.refresh_token = lambda: None
        actor.read = lambda: actor.state
        actor.eligible = lambda _: False
        actor.index, actor.planned = 0, 0
        actor.catalog = {'courses': [
            {'durationMs': 600000, 'rewards': {'skills': [{'id': 'crafting'}]}},
            {'durationMs': 600001, 'rewards': {'skills': [{'id': 'crafting'}]}}],
            'jobs': [{'requirement': {'skillId': 'crafting'}}], 'places': []}
        calls = []
        def care(action):
            if action == 'water' and actor.state['pet']['water'] == 100:
                raise AssertionError('不能因旧快照重复饮水')
            calls.append(action)
            actor.state = deepcopy(actor.state)
            actor.state['stories'][0]['completedSteps'] += 1
            if action == 'water':
                actor.state['pet']['water'] = 100
            if action == 'play':
                actor.state['stories'][0]['status'] = 'claimable'
        actor.care = care
        actor.claim_story = lambda _: actor.state['stories'][0].update(status='claimed')
        with patch.object(live, 'check', verify):
            actor.step()
        self.assertEqual(calls, ['water', 'play'])

    def test_extra_journal_event_with_new_id_is_rejected(self):
        event = {'recordType': 'event', 'id': '9', 'petId': '1', 'action': 'water', 'occurredAt': 1_000_000,
                 'coinsDelta': 0, 'itemChanges': [], 'effects': {'experience': 0, 'friendship': 0}}
        with self.assertRaisesRegex(AssertionError, '日志事件数量'):
            assert_history([event], [], [], [], verify)

    def test_controlled_failure_label_is_recorded(self):
        with patch.object(live, 'summary', {}), patch.object(live, 'record') as record:
            with self.assertRaises(AssertionError):
                live.check(False, '固定断言标签')
            self.assertEqual(live.summary['failedChecks'], ['固定断言标签'])
            record.assert_called_once_with('failure', '固定断言标签')

    def test_stop_reason_deadline_manual_and_pending_command(self):
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(live, 'directory', Path(temp)), patch.object(live, 'end', time.time() - 1), patch.object(live, 'stopped', False):
                with self.assertRaises(live.StopRun) as error:
                    live.checkpoint()
                self.assertEqual(error.exception.kind, 'deadline')
                Path(temp, 'STOP').touch()
                with self.assertRaises(live.StopRun) as error:
                    live.checkpoint()
                self.assertEqual(error.exception.kind, 'manual')

    def test_committed_write_read_failure_never_resends(self):
        import json
        actor = live.Actor.__new__(live.Actor)
        actor.index, actor.state = 0, state()
        calls = []
        receipt = {'operation': 'rest', 'petId': '1', 'committedAt': 1_000_000}
        actor.request = lambda *args: (calls.append(args) or (200, {'code': 0, 'data': receipt}))
        def failed_read():
            raise OSError('模拟正文断流')
        actor.read = failed_read
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(live, 'directory', Path(temp)), patch.object(live, 'end', time.time() + 600), patch.object(live, 'check', verify):
                with self.assertRaises(OSError):
                    actor.write('actions', {'petId': '1', 'action': 'rest'})
                self.assertEqual(len(calls), 1)
                pending = json.loads(Path(temp, 'pending-0.json').read_text())
                self.assertEqual(pending['outcome'], 'committed')
                self.assertEqual(pending['verification'], 'first-read')
                self.assertEqual(pending['key'], calls[0][2])

    def test_rest_replay_http_uses_same_key_and_checks_timestamps(self):
        actor = live.Actor.__new__(live.Actor)
        actor.index, actor.state = 0, state()
        actor.operations, actor.claims = [], []
        calls, reads = [], []
        receipt = {'operation': 'rest', 'petId': '1', 'committedAt': 1_000_000}
        actor.request = lambda *args: (calls.append(args) or (200, {'code': 0, 'data': receipt}))
        def read():
            actor.state = deepcopy(actor.state)
            actor.state['pet']['activity'] = {'kind': 'rest', 'startedAt': 1_000_000 + len(reads), 'endsAt': 15_400_000 + len(reads)}
            reads.append(True)
            return actor.state
        actor.read = read
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(live, 'directory', Path(temp)), patch.object(live, 'end', time.time() + 600), patch.object(live, 'check', verify):
                with self.assertRaises(AssertionError):
                    actor.write('actions', {'petId': '1', 'action': 'rest'})
                self.assertEqual(len(calls), 2)
                self.assertEqual(calls[0][2], calls[1][2])
                self.assertTrue(Path(temp, 'pending-0.json').exists())

    def test_rejected_http_write_leaves_pending_if_assets_changed(self):
        actor = live.Actor.__new__(live.Actor)
        actor.index, actor.state = 0, state()
        calls = []
        def read():
            if calls:
                actor.state['wallet']['coins'] -= 1
            return actor.state
        actor.read = read
        actor.request = lambda *args: (calls.append(args) or (409, {'code': 'conflict'}))
        with tempfile.TemporaryDirectory() as temp:
            with patch.object(live, 'directory', Path(temp)), patch.object(live, 'end', time.time() + 600), patch.object(live, 'check', verify):
                with self.assertRaises(AssertionError):
                    actor.write('purchases', {}, expected=409)
                self.assertEqual(len(calls), 1)
                self.assertTrue(Path(temp, 'pending-0.json').exists())


if __name__ == '__main__':
    unittest.main(verbosity=2)

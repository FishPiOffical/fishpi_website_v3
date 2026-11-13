#!/usr/bin/env python3
"""持久化只读对账的 HTTP 证据计数回归；不运行 audit 或连接数据库。"""
from copy import deepcopy
import unittest

from focused_audit import successful_commands


def request(endpoint='actions', actor=0, status=200, code=0):
    return {'kind': 'request', 'label': '/api/v3/me/pet/' + endpoint,
            'actor': actor, 'status': status, 'code': code}


def confirmed(endpoint='actions'):
    return {'kind': 'pass', 'label': '写回执成功 ' + endpoint}


class SuccessfulCommandsTest(unittest.TestCase):
    def test_single_commands_count_per_actor_and_endpoint(self):
        events = [request(), confirmed(), request('crafts'), confirmed('crafts'),
                  request('activities', actor=1), confirmed('activities')]
        snapshot = deepcopy(events)
        self.assertEqual(successful_commands(events), {'0': {'actions': 1, 'crafts': 1}, '1': {'activities': 1}})
        self.assertEqual(events, snapshot)

    def test_same_key_replay_is_not_another_successful_command(self):
        events = [request(), confirmed(), request(),
                  {'kind': 'pass', 'label': '同键回执不变 actions'},
                  {'kind': 'pass', 'label': '同键重放 actions：资产与活动时间不变'}]
        self.assertEqual(successful_commands(events), {'0': {'actions': 1}})

    def test_expected_rejection_does_not_count_as_commit(self):
        events = [request('purchases', status=422, code='invalid_argument'),
                  {'kind': 'pass', 'label': '预期写入状态 purchases 422'},
                  {'kind': 'pass', 'label': '拒绝写 purchases：资产与活动时间不变'}]
        self.assertEqual(successful_commands(events), {})

    def test_success_label_requires_a_matching_successful_request(self):
        for events in (
            [confirmed()],
            [request(status=500, code='unavailable'), confirmed()],
            [request(status=200, code='rejected'), confirmed()],
            [request('purchases'), confirmed()],
        ):
            with self.subTest(events=events):
                with self.assertRaises(AssertionError):
                    successful_commands(events)

    def test_request_evidence_cannot_be_consumed_twice(self):
        with self.assertRaises(AssertionError):
            successful_commands([request(), confirmed(), confirmed()])

    def test_read_after_write_cannot_be_misused_as_write_evidence(self):
        events = [request(), confirmed(),
                  {'kind': 'request', 'label': '/api/v3/me/pet', 'actor': 0, 'status': 200, 'code': 0},
                  confirmed()]
        with self.assertRaises(AssertionError):
            successful_commands(events)


if __name__ == '__main__':
    unittest.main(verbosity=2)

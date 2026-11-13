#!/usr/bin/env python3
"""局部数据库夹具的安全边界回归；所有子进程均为替身，不连接数据库。"""
from copy import deepcopy
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from focused_fixture import LocalFixture


class LocalFixtureSafetyTest(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory(prefix='pet-fixture-safety-')
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name) / '.temp/pet-soak/focused-unit'
        self.directory.mkdir(parents=True)
        self.config = {'mode': 'focused-local-http', 'api': 'http://localhost:8081', 'startedAt': 1_700_000_000_000}
        self.accounts = [{'name': 'petSoak0123456789' + str(index), 'id': str(self.config['startedAt'] + index + 1)}
                         for index in range(4)]
        self.endpoint = 'unix:///tmp/pet-safety-test.sock'
        self.service_pid = '12345'
        self.container = {'Name': '/rhythm-dev-mysql', 'State': {'Running': True},
                          'Config': {'Env': ['MYSQL_ROOT_PASSWORD=fixture-only', 'MYSQL_DATABASE=rhythm']}}
        self.environment_patch = patch.dict(os.environ, {}, clear=True)
        self.environment_patch.start()
        self.addCleanup(self.environment_patch.stop)
        # 未列出的命令立即失败；测试不能意外调用真实 docker 或 lsof。
        self.output_patch = patch('focused_fixture.subprocess.check_output', side_effect=self.output)
        self.output_mock = self.output_patch.start()
        self.addCleanup(self.output_patch.stop)
        self.run_patch = patch('focused_fixture.subprocess.run', return_value=SimpleNamespace(returncode=0, stdout='0\n'))
        self.run_mock = self.run_patch.start()
        self.addCleanup(self.run_patch.stop)
        self.write_config()

    def write_config(self, directory=None):
        (directory or self.directory).joinpath('config.json').write_text(json.dumps(self.config))

    def output(self, arguments, **_):
        if arguments == ['docker', 'context', 'show']:
            return 'fixture-local\n'
        if arguments == ['docker', 'context', 'inspect', 'fixture-local']:
            return json.dumps([{'Endpoints': {'docker': {'Host': self.endpoint}}}])
        if arguments == ['docker', '--host', self.endpoint, 'inspect', 'rhythm-dev-mysql']:
            return json.dumps([self.container])
        if arguments == ['lsof', '-nP', '-iTCP:8081', '-sTCP:LISTEN', '-Fpc']:
            return 'p' + self.service_pid + '\ncjava\n'
        raise AssertionError('安全测试不允许未声明的子进程')

    def rejected(self, directory=None, accounts=None):
        with self.assertRaises(AssertionError):
            LocalFixture(directory or self.directory, accounts or self.accounts)
        self.run_mock.assert_not_called()

    def test_non_focused_mode_and_directory_are_rejected(self):
        self.config['mode'] = 'natural-eight-hour'
        self.write_config()
        self.rejected()
        self.config['mode'] = 'focused-local-http'
        for suffix in ('outside/focused-unit', '.temp/pet-soak/old-eight-hour-run'):
            with self.subTest(directory=suffix):
                directory = Path(self.temporary.name) / suffix
                directory.mkdir(parents=True)
                self.write_config(directory)
                self.rejected(directory=directory)
        self.output_mock.assert_not_called()

    def test_nonlocal_api_is_rejected_before_subprocess(self):
        for api in ('https://fishpi.cn', 'http://example.invalid:8081', 'http://localhost:8080'):
            with self.subTest(api=api):
                self.config['api'] = api
                self.write_config()
                self.rejected()
        self.output_mock.assert_not_called()

    def test_historical_accounts_are_rejected(self):
        accounts = deepcopy(self.accounts)
        accounts[0]['id'] = str(self.config['startedAt'] - 1)
        self.rejected(accounts=accounts)
        self.output_mock.assert_not_called()

    def test_unrelated_or_duplicate_accounts_are_rejected(self):
        for name in ('admin', 'fishpi', 'petSoakLegacy', "petSoak0123456789'0"):
            with self.subTest(name=name):
                accounts = deepcopy(self.accounts)
                accounts[0]['name'] = name
                self.rejected(accounts=accounts)
        accounts = deepcopy(self.accounts)
        accounts[1]['id'] = accounts[0]['id']
        self.rejected(accounts=accounts)
        self.output_mock.assert_not_called()

    def test_remote_docker_context_and_host_are_rejected(self):
        for endpoint in ('tcp://remote.invalid:2376', 'ssh://remote.invalid'):
            with self.subTest(endpoint=endpoint):
                self.endpoint = endpoint
                self.rejected()
                os.environ['DOCKER_HOST'] = endpoint
                self.rejected()
                del os.environ['DOCKER_HOST']
        self.assertFalse(any('inspect' in call.args[0] and 'rhythm-dev-mysql' in call.args[0]
                             for call in self.output_mock.call_args_list))

    def test_sql_keeps_verified_socket_after_environment_changes(self):
        os.environ['DOCKER_CONTEXT'] = 'fixture-local'
        fixture = LocalFixture(self.directory, self.accounts)
        self.assertEqual(fixture.command[:3], ['docker', '--host', self.endpoint])
        self.assertNotIn('DOCKER_CONTEXT', fixture.environment)
        self.assertNotIn('fixture-only', ' '.join(fixture.command))
        os.environ['DOCKER_CONTEXT'] = 'different-context'
        os.environ['DOCKER_HOST'] = 'tcp://remote.invalid:2376'
        self.assertEqual(fixture.sql('SELECT 0;'), '0')
        self.run_mock.assert_called_once()
        arguments, options = self.run_mock.call_args
        self.assertEqual(arguments[0][:3], ['docker', '--host', self.endpoint])
        self.assertEqual(options['input'], 'SELECT 0;')
        self.assertNotIn('DOCKER_CONTEXT', options['env'])

    def test_stopped_container_is_rejected(self):
        self.container['State']['Running'] = False
        self.rejected()

    def test_service_replacement_stops_sql(self):
        fixture = LocalFixture(self.directory, self.accounts)
        self.service_pid = '98765'
        with self.assertRaisesRegex(AssertionError, '服务发生变化'):
            fixture.sql('SELECT 0;')
        self.run_mock.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)

#!/usr/bin/env python3
"""专项生命周期回归：仅临时目录，不启动服务或发起 HTTP。"""
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Barrier
import unittest
from unittest.mock import patch

from focused_lifecycle import acquire_run_lock, release_run_lock, stop_status


class FocusedLifecycleTest(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory(prefix='pet-lifecycle-')
        self.addCleanup(self.temporary.cleanup)
        self.base = Path(self.temporary.name)

    def test_long_run_lock_blocks_focused_without_changing_owner(self):
        lock = self.base / 'active.lock'
        lock.mkdir()
        owner = {'id': 'existing-eight-hour-run', 'pid': 12345}
        (lock / 'owner.json').write_text(json.dumps(owner))
        with self.assertRaisesRegex(RuntimeError, '已有本地 HTTP 测试'):
            acquire_run_lock(self.base)
        self.assertEqual(json.loads((lock / 'owner.json').read_text()), owner)

    def test_focused_lock_blocks_long_run_atomic_directory_creation(self):
        lock = acquire_run_lock(self.base)
        # 长跑入口同样以 mkdir(active.lock) 独占，不依赖先检查再创建。
        with self.assertRaises(FileExistsError):
            (self.base / 'active.lock').mkdir()
        release_run_lock(lock)
        self.assertFalse((self.base / 'active.lock').exists())

    def test_simultaneous_focused_starts_have_exactly_one_owner(self):
        barrier = Barrier(8)
        def contender(_):
            barrier.wait()
            try:
                return acquire_run_lock(self.base)
            except RuntimeError:
                return None
        with ThreadPoolExecutor(max_workers=8) as executor:
            results = list(executor.map(contender, range(8)))
        winners = [result for result in results if result is not None]
        self.assertEqual(len(winners), 1)
        self.assertEqual(json.loads((self.base / 'active.lock/owner.json').read_text()), winners[0]['owner'])
        release_run_lock(winners[0])

    def test_changed_owner_cannot_be_released(self):
        lock = acquire_run_lock(self.base)
        replacement = {**lock['owner'], 'token': 'different-run-token'}
        (lock['path'] / 'owner.json').write_text(json.dumps(replacement))
        with self.assertRaisesRegex(RuntimeError, '归属已变化'):
            release_run_lock(lock)
        self.assertTrue(lock['path'].is_dir())
        self.assertEqual(json.loads((lock['path'] / 'owner.json').read_text()), replacement)

    def test_legacy_focused_lock_is_preserved_and_blocks_new_run(self):
        legacy = self.base / 'focused.lock'
        legacy.mkdir()
        (legacy / 'marker').write_text('existing process')
        with self.assertRaisesRegex(RuntimeError, '已有专项测试锁'):
            acquire_run_lock(self.base)
        self.assertFalse((self.base / 'active.lock').exists())
        self.assertEqual((legacy / 'marker').read_text(), 'existing process')

    def test_empty_failed_owner_write_releases_only_empty_directory(self):
        with patch.object(Path, 'open', side_effect=OSError('fixture-write-error')):
            with self.assertRaises(OSError):
                acquire_run_lock(self.base)
        self.assertFalse((self.base / 'active.lock').exists())

    def test_failed_owner_write_does_not_recursively_delete_foreign_file(self):
        def failed_open(path, *_args, **_kwargs):
            # 模拟创建锁后其他诊断进程放入文件，失败清理必须保留现场。
            (path.parent / 'external-marker').touch()
            raise OSError('fixture-write-error')
        with patch.object(Path, 'open', failed_open):
            with self.assertRaises(OSError):
                acquire_run_lock(self.base)
        self.assertTrue((self.base / 'active.lock/external-marker').exists())

    def test_stop_reasons_never_claim_scenario_success(self):
        expected = {
            'manual': 'stopped', 'deadline': 'incomplete', 'blocked': 'blocked',
            'failure': 'failed', 'service_error': 'failed', 'pending': 'failed', 'unknown': 'failed',
        }
        for reason, status in expected.items():
            with self.subTest(reason=reason):
                self.assertEqual(stop_status(reason), status)
                self.assertNotIn(stop_status(reason), ('passed', 'complete'))


if __name__ == '__main__':
    unittest.main(verbosity=2)

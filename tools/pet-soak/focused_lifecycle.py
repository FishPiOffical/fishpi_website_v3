"""专项与八小时 HTTP 测试共用目录锁；停止原因不冒充场景通过。"""
import json
import os
from pathlib import Path
import uuid


def acquire_run_lock(base):
    base = Path(base)
    # 兼容本次修复前遗留的专项锁；正常新运行只使用共用的原子目录锁。
    if (base / 'focused.lock').exists():
        raise RuntimeError('已有专项测试锁，先检查对应进程')
    path = base / 'active.lock'
    try:
        path.mkdir(mode=0o700)
    except FileExistsError:
        raise RuntimeError('已有本地 HTTP 测试，请勿同时启动') from None
    owner = {'mode': 'focused-local-http', 'pid': os.getpid(), 'token': uuid.uuid4().hex}
    try:
        with (path / 'owner.json').open('x') as stream:
            json.dump(owner, stream)
    except BaseException:
        # 锁写入失败时不做递归删除，以免误删外部放入的文件；保留现场便于核对。
        if not list(path.iterdir()):
            path.rmdir()
        raise
    return {'path': path, 'owner': owner}


def release_run_lock(lock):
    path = lock['path']
    actual = json.loads((path / 'owner.json').read_text())
    if actual != lock['owner']:
        raise RuntimeError('测试锁归属已变化，未删除其他进程的锁')
    (path / 'owner.json').unlink()
    path.rmdir()


def stop_status(kind):
    # 专项要求全部场景完成；碰到一小时保护截止点不能算完成。
    return {'manual': 'stopped', 'deadline': 'incomplete', 'blocked': 'blocked'}.get(kind, 'failed')

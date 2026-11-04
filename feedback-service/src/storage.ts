import { DatabaseSync, backup } from 'node:sqlite'
import { existsSync, copyFileSync, writeFileSync } from 'node:fs'
const [mode,target] = process.argv.slice(2)
const path = process.env.FEEDBACK_DB || 'data/feedback.sqlite'
if (!target || !['backup','restore','export'].includes(mode!)) throw new Error('用法: npm run backup|restore|export -- 目标路径；restore 必须先停服务且目标库不存在')
if (mode === 'restore') {
  if (existsSync(path) || existsSync(path+'-wal') || existsSync(path+'-shm')) throw new Error('请先停服务并移走原数据库及WAL/SHM文件')
  const source = new DatabaseSync(target,{readOnly:true})
  if (source.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok') throw new Error('备份损坏')
  source.close(); copyFileSync(target,path)
} else {
  const db = new DatabaseSync(path,{readOnly:true})
  if (mode === 'backup') { if (existsSync(target)) throw new Error('备份目标已存在'); await backup(db,target) }
  else { db.exec('BEGIN'); writeFileSync(target,JSON.stringify({ version:1, requests:db.prepare('SELECT * FROM requests').all(), votes:db.prepare('SELECT * FROM votes').all(), moderation:db.prepare('SELECT * FROM moderation_log').all() },null,2),{flag:'wx',mode:0o600}); db.exec('COMMIT') }
  db.close()
}

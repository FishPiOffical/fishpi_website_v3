import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import { createHash, randomUUID } from 'node:crypto'
import { transaction, type DB } from './db.ts'
export const categories = ['feature', 'bug', 'experience']
export const statuses = ['pending', 'planned', 'in_progress', 'done', 'declined']
export type Identity = { id: string; userName: string; userNickname?: string }
class HttpError extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } }
function fail(status: number, message: string): never { throw new HttpError(status, message) }
function text(value: unknown, min: number, max: number) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || /\u0000/.test(value)) fail(422, `文字长度须为 ${min}～${max}`)
  return value as string
}
function choice(value: unknown, values: string[]) { if (typeof value !== 'string' || !values.includes(value)) fail(422, '选项不合法'); return value as string }
export function rhythmVerifier(origin: string, mode: 'v1' | 'v3' = 'v3'): (token: string) => Promise<Identity> {
  const url = new URL(mode === 'v1' ? '/api/user' : '/api/v3/me', origin)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('身份服务必须使用 HTTPS 或本机地址')
  return async token => {
    try {
      const target=new URL(url)
      if(mode==='v1') target.searchParams.set('apiKey',token)
      const r = await fetch(target, { headers: mode==='v1'?{}:{ Authorization: token }, redirect: 'error', signal: AbortSignal.timeout(5000) })
      if (r.status === 401 || r.status === 403) fail(401, '请重新登录')
      if (!r.ok) fail(503, '身份服务暂不可用')
      if (!r.body) fail(503, '身份响应异常')
      const reader = r.body!.getReader(), chunks: Uint8Array[] = []
      let size = 0
      try {
        while (true) {
          const part = await reader.read()
          if (part.done) break
          size += part.value.byteLength
          if (size > 65536) { await reader.cancel(); fail(503, '身份响应异常') }
          chunks.push(part.value)
        }
      } finally { reader.releaseLock() }
      const raw = Buffer.concat(chunks).toString('utf8')
      const data = JSON.parse(raw)
      if (mode==='v1' && data.code===-1) fail(401,'请重新登录')
      if(mode==='v1' && data.data) data.data.id=data.data.oId
      if (data.code !== 0 || typeof data.data?.id !== 'string' || typeof data.data?.userName !== 'string' || !data.data.id || !data.data.userName) fail(503, '身份响应异常')
      return { id: data.data.id, userName: data.data.userName, userNickname: typeof data.data.userNickname === 'string' ? data.data.userNickname : undefined }
    } catch (e) { if (e instanceof HttpError) throw e; fail(503, '身份服务暂不可用') }
  }
}
const projection = `SELECT r.id,r.title,r.category,r.description,r.author_name AS authorName,r.author_nickname AS authorNickname,
  r.status,r.note,r.created_at AS createdAt,r.updated_at AS updatedAt,
  (SELECT count(*) FROM votes WHERE request_id=r.id AND choice='support') AS support,
  (SELECT count(*) FROM votes WHERE request_id=r.id AND choice='oppose') AS oppose FROM requests r`
export function createApp(options: { db: DB; verify: (token: string) => Promise<Identity>; verifyLegacy?: (key:string) => Promise<Identity>; admins: Set<string>; enabled?: boolean; limits?: boolean }) {
  const { db, verify, admins } = options
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
  app.use((_req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); if (options.enabled === false) return res.status(503).json({ error: '需求反馈未启用' }); next() })
  // Same-origin only. Reverse proxies must preserve the browser Host/Origin tuple.
  app.use((req, _res, next) => {
    if (!['GET','HEAD'].includes(req.method) && req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) return next(new HttpError(403, '不允许跨站写入')) } catch { return next(new HttpError(403, '来源不合法')) }
    }
    next()
  })
  const buckets = new Map<string, { count: number; expires: number }>()
  function limit(key: string, max: number) {
    if (options.limits === false) return
    const now = Date.now()
    for (const [k, v] of buckets) if (v.expires < now) buckets.delete(k)
    const row = buckets.get(key) || { count: 0, expires: now + 60000 }
    if (++row.count > max) fail(429, '操作太频繁，请稍后重试')
    if (buckets.size >= 10000 && !buckets.has(key)) fail(429, '服务繁忙，请稍后重试')
    buckets.set(key, row)
  }
  app.use((req, _res, next) => { try { limit(`ip:${req.ip}`, 180); next() } catch (e) { next(e) } })
  app.use(express.json({ limit: '32kb', strict: true }))
  const router = express.Router()
  router.get('/health', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ ok: true }) })
  function current(id: string) { return db.prepare(`${projection} WHERE r.id=? AND r.hidden=0`).get(id) || fail(404, '需求不存在或已隐藏') }
  async function identity(req: Request) {
    if(req.headers['x-fp-api-mode']==='v1') {
      if(req.headers.authorization) fail(400,'v1请求不能携带Bearer')
      const key=req.headers['x-fp-legacy-key']
      if(typeof key!=='string' || !key || key.length>8192 || /\s/.test(key)) fail(401,'请先登录')
      if(!options.verifyLegacy) fail(503,'v1身份核验未配置')
      const user=await options.verifyLegacy!(key as string)
      limit(`user:${user.id}:${req.method === 'POST' ? 'create' : 'other'}`,req.method==='POST'?10:90)
      return user
    }
    if(req.headers['x-fp-legacy-key']) fail(400,'旧凭据必须明确选择v1协议')
    const token = req.headers.authorization
    if (!token || !/^Bearer [^\s]{1,8192}$/.test(token)) fail(401, '请先登录')
    const user = await verify(token!)
    limit(`user:${user.id}:${req.method === 'POST' ? 'create' : 'other'}`, req.method === 'POST' ? 10 : 90)
    return user
  }
  function command(req: Request, user: Identity, input: unknown, work: () => unknown) {
    const key = req.headers['idempotency-key']
    if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(key)) fail(422, '缺少有效幂等键')
    const fingerprint = createHash('sha256').update(JSON.stringify([req.method,req.path,input])).digest('hex')
    return transaction(db, () => {
      const old = db.prepare('SELECT fingerprint,response FROM commands WHERE actor=? AND key=?').get(user.id, key!)
      if (old) { if (old.fingerprint !== fingerprint) fail(409, '同一操作键不能更改内容'); return JSON.parse(String(old.response)) }
      const result = work()
      db.prepare('INSERT INTO commands VALUES(?,?,?,?)').run(user.id, key!, fingerprint, JSON.stringify(result))
      return result
    })
  }
  router.get('/requests', (req, res) => {
    const page = Number(req.query.page ?? 1), size = Number(req.query.size ?? 20)
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000 || !Number.isSafeInteger(size) || size < 1 || size > 50) fail(422, '分页参数不合法')
    const category = req.query.category ? choice(req.query.category,categories) : ''
    const status = req.query.status ? choice(req.query.status,statuses) : ''
    const q = req.query.q ? text(req.query.q,1,100) : ''
    const sort = choice(req.query.sort ?? 'latest',['latest','support'])
    const where = ` WHERE r.hidden=0 AND (?='' OR r.category=?) AND (?='' OR r.status=?) AND (?='' OR instr(lower(r.title || ' ' || r.description),lower(?))>0)`
    const args = [category,category,status,status,q,q]
    const total = Number(db.prepare('SELECT count(*) AS n FROM requests r' + where).get(...args)!.n)
    const items = db.prepare(projection + where + ` ORDER BY ${sort === 'support' ? 'support DESC,' : ''} r.created_at DESC,r.id DESC LIMIT ? OFFSET ?`).all(...args,size,(page-1)*size)
    res.json({ items, page, size, total, pageCount: Math.ceil(total/size) })
  })
  router.get('/requests/:id', (req, res) => { res.json(current(String(req.params.id))) })
  router.get('/requests/:id/me', async (req, res) => {
    const user = await identity(req); const id = String(req.params.id); const admin = admins.has(user.id)
    const row = db.prepare('SELECT hidden,status,note FROM requests WHERE id=?').get(id)
    if (!row || (row.hidden && !admin)) fail(404,'需求不存在或已隐藏')
    res.json({ vote: db.prepare('SELECT choice FROM votes WHERE request_id=? AND user_id=?').get(id,user.id)?.choice ?? 'none', canModerate: admin,
      ...(admin ? { moderation: { hidden: Boolean(row.hidden), status: row.status, note: row.note } } : {}) })
  })
  router.post('/requests', async (req, res) => {
    const user = await identity(req)
    const input = { title: text(req.body?.title,5,100), category: choice(req.body?.category,categories), description: text(req.body?.description,10,5000) }
    res.json(command(req,user,input,() => {
      const id = randomUUID(), now = new Date().toISOString()
      db.prepare('INSERT INTO requests(id,title,category,description,author_id,author_name,author_nickname,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,input.title,input.category,input.description,user.id,user.userName,user.userNickname || '',now,now)
      return { id }
    }))
  })
  router.put('/requests/:id/vote', async (req, res) => {
    const user = await identity(req), id = String(req.params.id), value = choice(req.body?.choice,['support','oppose','none'])
    transaction(db, () => {
      current(id)
      if (value === 'none') db.prepare('DELETE FROM votes WHERE request_id=? AND user_id=?').run(id,user.id)
      else db.prepare('INSERT INTO votes VALUES(?,?,?) ON CONFLICT(request_id,user_id) DO UPDATE SET choice=excluded.choice').run(id,user.id,value)
    })
    res.json({ ok: true })
  })
  router.patch('/requests/:id/moderation', async (req, res) => {
    const user = await identity(req)
    if (!admins.has(user.id)) fail(403,'仅管理员可处理需求')
    const id = String(req.params.id)
    const input = { status: choice(req.body?.status,statuses), note: text(req.body?.note,0,2000), hidden: req.body?.hidden }
    if (typeof input.hidden !== 'boolean') fail(422,'隐藏状态不合法')
    res.json(command(req,user,input,() => {
      if (!db.prepare('SELECT id FROM requests WHERE id=?').get(id)) fail(404,'需求不存在')
      const now = new Date().toISOString()
      db.prepare('UPDATE requests SET status=?,note=?,hidden=?,updated_at=? WHERE id=?').run(input.status,input.note,Number(input.hidden),now,id)
      db.prepare('INSERT INTO moderation_log(request_id,actor,input,created_at) VALUES(?,?,?,?)').run(id,user.id,JSON.stringify(input),now)
      return { id }
    }))
  })
  app.use('/feedback-api/v1',router)
  app.use((_req,res) => { res.status(404).json({ error: '接口不存在' }) })
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = err instanceof HttpError ? err.status : (err as { status?: number })?.status === 413 ? 413 : err instanceof SyntaxError ? 400 : 500
    res.status(status).json({ error: err instanceof HttpError ? err.message : status === 413 ? '请求内容过大' : status === 400 ? 'JSON格式不合法' : '反馈服务暂不可用' })
  })
  return app
}

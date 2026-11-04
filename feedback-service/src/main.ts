import { createApp, rhythmVerifier } from './app.ts'
import { openDatabase } from './db.ts'
const db = openDatabase(process.env.FEEDBACK_DB || 'data/feedback.sqlite')
const app = createApp({ db, verifyLegacy: rhythmVerifier(process.env.RHYTHM_V1_ORIGIN || 'https://fishpi.cn','v1'), verify: rhythmVerifier(process.env.RHYTHM_ORIGIN || 'https://fishpi.cn'),
  admins: new Set((process.env.FEEDBACK_ADMIN_IDS || '').split(',').map(s=>s.trim()).filter(Boolean)), enabled: process.env.FEEDBACK_ENABLED === 'true' })
const server = app.listen(Number(process.env.PORT || 5174),'127.0.0.1',()=>console.log('Feedback service listening'))
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=> { db.close(); process.exit(0) }))

import { createApp } from './app.ts'
import { openDatabase } from './db.ts'
const db = openDatabase(process.env.FEEDBACK_DB || 'data/feedback.sqlite')
const app = createApp({ db, cookieSecure: process.env.FEEDBACK_COOKIE_SECURE !== 'false',
  enabled: process.env.FEEDBACK_ENABLED === 'true' })
const server = app.listen(Number(process.env.PORT || 5174),'127.0.0.1',()=>console.log('Feedback service listening'))
for (const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=> { db.close(); process.exit(0) }))

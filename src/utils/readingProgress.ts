/** Local chapter IDs only; never store titles, bodies or authorization data. */
const KEY='fp.reading-progress.v1'
const valid=(id:string)=>/^[A-Za-z0-9_-]{1,64}$/.test(id)
export function readChapterProgress(column:string):string {
  if(!valid(column)||typeof localStorage==='undefined')return ''
  try { const value=JSON.parse(localStorage.getItem(KEY)||'{}')[column];return typeof value==='string'&&/^[1-9][0-9]{0,18}$/.test(value)?value:'' } catch { return '' }
}
export function rememberChapter(column:string,chapter:string){
  if(!valid(column)||!/^[1-9][0-9]{0,18}$/.test(chapter)||typeof localStorage==='undefined')return
  try { const old=JSON.parse(localStorage.getItem(KEY)||'{}'), next:Record<string,string>={};if(old&&typeof old==='object'&&!Array.isArray(old))for(const [key,value]of Object.entries(old).slice(-99))if(key!==column&&valid(key)&&typeof value==='string'&&/^[1-9][0-9]{0,18}$/.test(value))next[key]=value;next[column]=chapter;localStorage.setItem(KEY,JSON.stringify(next)) } catch { /* Optional browser preference. */ }
}

/** Display only: keep API timestamps, calendar dates and expiry sentinel semantics intact. */
export type TimeValue = string | number | Date | null | undefined
export const DISPLAY_TIME_ZONE = 'Asia/Shanghai'
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: DISPLAY_TIME_ZONE, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' })
function parseTime(value: TimeValue): Date | null {
  if(value === null || value === undefined || value === '') return null
  let source: string | number | Date = value
  if(typeof source === 'string') {
    source=source.trim()
    const legacy=/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) ([A-Z][a-z]{2}) (\d{2}) (\d{2}:\d{2}:\d{2}) (CST|UTC|GMT) (\d{4})$/.exec(source)
    if(legacy) {
      const month=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(legacy[1]!) + 1
      if(!month)return null
      source=`${legacy[5]}-${String(month).padStart(2,'0')}-${legacy[2]}T${legacy[3]}${legacy[4]==='CST'?'+08:00':'Z'}`
    }
    const calendar=/^(\d{4})-(\d{2})-(\d{2})/.exec(source)
    if(calendar) {
      const year=Number(calendar[1]),month=Number(calendar[2]),day=Number(calendar[3])
      if(year<1000||month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate())return null
    }
    // Rhythm legacy wall-clock values are Beijing time, never host-local time.
    if(/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)?$/.test(source)) {
      const [day,time]=source.split(/[ T]/)
      source=`${day}T${time ? time.length===5 ? time+':00' : time : '00:00:00'}+08:00`
    } else if(!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:?\d{2})$/.test(source)) return null
  }
  const date=new Date(source instanceof Date ? source.getTime() : source)
  return Number.isFinite(date.getTime()) ? date : null
}
export function formatDateTime(value: TimeValue, fallback='时间未知'): string {
  const date=parseTime(value)
  if(!date)return fallback
  const parts=Object.fromEntries(clock.formatToParts(date).map(p=>[p.type,p.value]))
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`
}
export function formatDate(value: TimeValue, fallback='时间未知'): string {
  const full=formatDateTime(value,'')
  return full ? full.slice(0,10) : fallback
}
export function formatDisplayTime(value: TimeValue, fallback='时间未知'): string {
  if(typeof value==='string' && /^(?:刚刚|刚才|\d+\s*(?:秒|分钟|小时|天|周|个月|年)前)$/.test(value.trim()))return value.trim()
  return formatDateTime(value,fallback)
}
export function timeISO(value: TimeValue): string | undefined { return parseTime(value)?.toISOString() }

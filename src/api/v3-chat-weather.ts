import {ApiError,request} from './http'
export const WEATHER_OPTIONS=[['CLEAR_DAY','晴（白天）'],['CLEAR_NIGHT','晴（夜间）'],['PARTLY_CLOUDY_DAY','多云（白天）'],['PARTLY_CLOUDY_NIGHT','多云（夜间）'],['CLOUDY','阴'],['LIGHT_HAZE','轻度雾霾'],['MODERATE_HAZE','中度雾霾'],['HEAVY_HAZE','重度雾霾'],['LIGHT_RAIN','小雨'],['MODERATE_RAIN','中雨'],['HEAVY_RAIN','大雨'],['STORM_RAIN','暴雨'],['FOG','雾'],['LIGHT_SNOW','小雪'],['MODERATE_SNOW','中雪'],['HEAVY_SNOW','大雪'],['STORM_SNOW','暴雪'],['DUST','浮尘'],['SAND','沙尘'],['WIND','大风']] as const
export interface ChatWeatherDay{date:string;code:string;min:number;max:number}
export interface ChatWeatherInput{city:string;description:string;days:ChatWeatherDay[]}
export interface ChatWeatherCommand{input:ChatWeatherInput;key:string}
export interface ChatWeatherReceipt{id:string;createdAt:number}
const invalid=()=>new ApiError('天气卡片参数不合法，请检查五日日期、天气及温度',422)
const unicode=(s:string)=>!/[\u0000-\u001f\u007f-\u009f]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(s)
function text(s:string,max:number,optional=false){if(typeof s!=='string'||!unicode(s))throw invalid();const v=s.replace(/^[ \u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+|[ \u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]+$/gu,'');if(!optional&&!v||v.length>max||/<[^>]*>/su.test(v))throw invalid();return v}
function date(value:string){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw invalid()
 const year=Number(value.slice(0,4)),month=Number(value.slice(5,7)),day=Number(value.slice(8,10)),d=new Date(0)
 d.setUTCHours(0,0,0,0);d.setUTCFullYear(year,month-1,day)
 if(year<1||year>9999||d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)throw invalid()
 return d
}
export function weatherDates(first:string):string[]{const start=date(first),days:string[]=[];for(let i=0;i<5;i++){const d=new Date(start.getTime()+i*86400000);if(d.getUTCFullYear()>9999)throw invalid();days.push(d.toISOString().slice(0,10))}return days}
export function weatherInput(input:ChatWeatherInput):ChatWeatherInput{
 if(!input||typeof input!=='object'||Array.isArray(input)||!Array.isArray(input.days)||input.days.length!==5)throw invalid()
 const dates=weatherDates(input.days[0]?.date??''),codes=new Set<string>(WEATHER_OPTIONS.map(([code])=>code))
 const days=Array.from(input.days).map((d,i)=>{if(!d||typeof d!=='object'||Array.isArray(d)||d.date!==dates[i]||typeof d.code!=='string'||!codes.has(d.code)||typeof d.min!=='number'||!Number.isInteger(d.min)||d.min< -100||d.min>100||typeof d.max!=='number'||!Number.isInteger(d.max)||d.max< -100||d.max>100||d.min>d.max)throw invalid();return{date:d.date,code:d.code,min:d.min,max:d.max}})
 return{city:text(input.city,64),description:text(input.description,128,true),days}
}
export async function sendChatWeather(command:ChatWeatherCommand):Promise<ChatWeatherReceipt>{
 const input=weatherInput(command.input)
 if(typeof command.key!=='string'||!/^[A-Za-z0-9._:-]{1,128}$/.test(command.key))throw invalid()
 const r=await request<{code:number;data?:{id?:unknown;createdAt?:unknown}}>('/api/v3/chat/weather',{method:'POST',headers:{'Idempotency-Key':command.key},body:JSON.stringify(input)}),d=r?.data
 if(r?.code!==0||typeof d?.id!=='string'||!/^\d{1,32}$/.test(d.id)||typeof d.createdAt!=='number'||!Number.isSafeInteger(d.createdAt)||d.createdAt<0)throw new ApiError('天气卡片回执不正确',502)
 return{id:d.id,createdAt:d.createdAt}
}

<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {getAuthContextVersion} from '@/api/http'
import {useAuthStore} from '@/stores/auth'
import {useV3ChatWeatherStore} from '@/stores/v3ChatWeather'
import {weatherInput,weatherDates,WEATHER_OPTIONS,type ChatWeatherInput} from '@/api/v3-chat-weather'
const auth=useAuthStore(),store=useV3ChatWeatherStore(),emit=defineEmits<{close:[]}>(),city=ref(''),description=ref(''),firstDate=ref(''),error=ref('')
const emptyDays=()=>Array.from({length:5},()=>({code:'',min:'' as number|string,max:'' as number|string})),days=ref(emptyDays()),frozen=computed(()=>store.busy||!!store.pending)
const dates=computed(()=>{try{return weatherDates(firstDate.value)}catch{return[]}})
let submitted=''
const input=()=>({city:city.value,description:description.value,days:days.value.map((d,i)=>({...d,date:dates.value[i]||''}))} as ChatWeatherInput)
function clear(){city.value=description.value=firstDate.value='';days.value=emptyDays();error.value='';submitted=''}
async function send(){if(!auth.accessToken||!auth.account?.oId||frozen.value)return;error.value='';try{const normalized=weatherInput(input());submitted=JSON.stringify(normalized);await store.send(normalized)}catch(e){error.value=e instanceof Error?e.message:'天气卡片不合法'}}
watch(()=>store.completed,command=>{if(!command||JSON.stringify(command.input)!==submitted)return;try{if(JSON.stringify(weatherInput(input()))===submitted){clear();emit('close')}}catch{}})
watch(()=>JSON.stringify([getAuthContextVersion(),!!auth.accessToken,auth.account?.oId||'']),clear,{flush:'sync'})
</script>
<template><form class="weather-editor" @submit.prevent="send"><label>城市<input v-model="city" maxlength="64" :disabled="frozen" required /></label><label>说明（可空）<input v-model="description" maxlength="128" :disabled="frozen" /></label><label>第一天日期<input v-model="firstDate" type="date" min="0001-01-01" max="9999-12-27" :disabled="frozen" required /></label><p>分享你填写的连续五天天气数据，不提供天气查询。每一天都需要选择天气并填写温度。</p><fieldset v-for="(day,index) in days" :key="index" :disabled="frozen"><legend>{{ dates[index]||`第${index+1}天` }}</legend><label>天气<select v-model="day.code" required><option value="" disabled>请选择</option><option v-for="[code,name] in WEATHER_OPTIONS" :key="code" :value="code">{{ name }}</option></select></label><label>最低温度<input v-model.number="day.min" type="number" min="-100" max="100" step="1" required /></label><label>最高温度<input v-model.number="day.max" type="number" min="-100" max="100" step="1" required /></label></fieldset><p v-if="error" role="alert">{{ error }}</p><div><button type="submit" :disabled="frozen||!city.trim()||dates.length!==5">发送天气卡片</button><button type="button" @click="emit('close')">取消</button></div></form></template>
<style scoped lang="scss">.weather-editor{display:flex;flex-direction:column;gap:8px;padding:8px 0;min-width:0}label{display:flex;flex-direction:column;min-width:0;font-size:13px;gap:4px}fieldset{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin:0;padding:8px;border:1px solid var(--fp-border);border-radius:5px;min-width:0}legend{font-size:12px}input,select{box-sizing:border-box;width:100%;min-width:0}button,input,select{font:inherit;border:1px solid var(--fp-border);border-radius:5px;padding:6px;background:var(--fp-card);color:var(--fp-text)}button{margin-right:6px}button:disabled,fieldset:disabled,input:disabled{opacity:.5}p{font-size:12px;margin:0;color:var(--fp-muted)}[role=alert]{color:#bd503c}@media(max-width:420px){fieldset{grid-template-columns:1fr 1fr}fieldset>label:first-of-type{grid-column:1/-1}}</style>

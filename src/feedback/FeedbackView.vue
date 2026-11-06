<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion, onAccessTokenChange } from '@/api/http'
import { categories, statuses, feedbackEnabled, feedbackApi, type Feedback, type FeedbackList, type Personal, type Vote } from './api'
import { useFeedbackStore } from './store'
import { useFeedbackPanelStore } from './panel'
const props=defineProps<{embedded?:boolean}>()
if(!props.embedded) useHead({ title: '需求反馈 - 摸鱼派', meta: [{ name: 'robots', content: 'noindex' }] })
const browserRoute=useRoute(), router=useRouter(), auth=useAuthStore(), store=useFeedbackStore(), panel=useFeedbackPanelStore()
const route=computed(()=>props.embedded?panel.location:browserRoute)
async function navigate(path:string) {if(props.embedded) {panel.navigate(path);return} return router.push(path)}
const mounted=ref(false), loading=ref(false), error=ref(''), actionError=ref(''), personalError=ref(''), voting=ref(false)
const list=ref<FeedbackList|null>(null), item=ref<Feedback|null>(null), personal=ref<Personal|null>(null)
const filter=reactive({q:'',category:'',status:'',sort:'latest'}), page=ref(1)
const moderation=reactive({status:'pending',note:'',hidden:false})
const mode=computed(()=>route.value.path==='/feedback/new'?'new':route.value.params.id?'detail':'list')
let sequence=0, personalSequence=0, controller:AbortController|null=null, moderationOwner=''
const message=(e:unknown)=>e instanceof Error?e.message:'请求失败，请重试'
function login() {
  const target=props.embedded?browserRoute.fullPath:route.value.fullPath
  if(props.embedded) {panel.loginReturnPath=target;panel.hide()}
  void router.push({path:'/login',query:{redirect:target}})
}
async function loadPersonal() {
  const seq=++personalSequence, id=String(route.value.params.id || ''), context=getAuthContextVersion()
  personal.value=null; personalError.value=''
  if(mode.value!=='detail' || !auth.isLoggedIn || !id) return
  try {
    const value=await feedbackApi<Personal>(`/requests/${encodeURIComponent(id)}/me`,{private:true})
    if(seq!==personalSequence || context!==getAuthContextVersion()) return
    personal.value=value
    if(value.moderation && moderationOwner!==`${context}:${id}`) { Object.assign(moderation,value.moderation); moderationOwner=`${context}:${id}` }
  } catch(e) { if(seq===personalSequence && context===getAuthContextVersion()) personalError.value=message(e) }
}
async function load() {
  if(!mounted.value || !feedbackEnabled) return
  const seq=++sequence; personalSequence++; controller?.abort(); controller=new AbortController()
  loading.value=true; error.value=''; list.value=null; item.value=null; personal.value=null
  try {
    if(mode.value==='detail') {
      const data=await feedbackApi<Feedback>(`/requests/${encodeURIComponent(String(route.value.params.id))}`,{signal:controller.signal})
      if(seq===sequence) item.value=data
    } else if(mode.value==='list') {
      const query=new URLSearchParams({page:String(page.value),size:'20',sort:filter.sort})
      for(const key of ['q','category','status'] as const) if(filter[key]) query.set(key,filter[key])
      const data=await feedbackApi<FeedbackList>('/requests?'+query,{signal:controller.signal})
      if(seq===sequence) list.value=data
    }
  } catch(e) { if(seq===sequence) error.value=message(e) }
  finally { if(seq===sequence) { loading.value=false; void loadPersonal() } }
}
async function navigateResult(id:string) {
  const failure=await navigate('/feedback/'+encodeURIComponent(id))
  if(failure && route.value.params.id!==id) throw new Error('已保存，页面跳转失败，可点击查看结果重试')
  store.acknowledge(); await load()
}
async function submit() {
  if(!auth.isLoggedIn) return login()
  const context=getAuthContextVersion()
  actionError.value=''
  try {
    const result=store.result || await store.run({path:'/requests',method:'POST',body:store.draft})
    if(result) await navigateResult(result.id)
  } catch(e) { if(context===getAuthContextVersion()) actionError.value=message(e) }
}
async function resume() {
  const context=getAuthContextVersion()
  actionError.value=''
  try { const result=store.result || await store.run(); if(result) await navigateResult(result.id) } catch(e) { if(context===getAuthContextVersion()) actionError.value=message(e) }
}
async function vote(value:Vote) {
  if(!auth.isLoggedIn) return login()
  if(voting.value || !personal.value || !item.value) return
  const id=item.value.id, context=getAuthContextVersion()
  voting.value=true; actionError.value=''
  try {
    await feedbackApi(`/requests/${encodeURIComponent(id)}/vote`,{method:'PUT',private:true,body:{choice:personal.value.vote===value?'none':value}})
    if(context===getAuthContextVersion() && String(route.value.params.id)===id) {
      const fresh=await feedbackApi<Feedback>(`/requests/${encodeURIComponent(id)}`)
      if(context===getAuthContextVersion() && String(route.value.params.id)===id) { item.value=fresh; await loadPersonal() }
    }
  } catch(e) { if(context===getAuthContextVersion()) actionError.value=message(e) }
  finally { voting.value=false }
}
async function moderate() {
  if(!personal.value?.canModerate || !route.value.params.id) return
  const context=getAuthContextVersion()
  actionError.value=''
  try { const result=await store.run({path:`/requests/${encodeURIComponent(String(route.value.params.id))}/moderation`,method:'PATCH',body:moderation}); if(result) {store.acknowledge(); await load()} } catch(e) {if(context===getAuthContextVersion()) actionError.value=message(e)}
}
function search() { page.value=1; void load() }
watch(()=>route.value.fullPath,()=>{actionError.value=''; void load()})
let identity=getAuthContextVersion()
const off=onAccessTokenChange(()=>{
  if(identity!==getAuthContextVersion()) {identity=getAuthContextVersion(); personalSequence++; personal.value=null; personalError.value=''; actionError.value=''; moderationOwner=''; Object.assign(moderation,{status:'pending',note:'',hidden:false})}
  if(mounted.value) void loadPersonal()
})
watch(()=>auth.isLoggedIn,()=>{if(mounted.value) void loadPersonal()})
onMounted(()=>{mounted.value=true; void load()})
onUnmounted(()=>{sequence++;personalSequence++;controller?.abort();off()})
</script>
<template>
  <main class="feedback fp-page fp-ui">
    <header class="feedback-head fp-page-heading"><div><span class="eyebrow">一起打磨摸鱼派</span><h1 class="fp-page-title">需求反馈</h1><p>记录问题，分享想法，让每一份建议有回音。</p></div><a v-if="mode !== 'new' && feedbackEnabled" class="primary fp-link-action" href="/feedback/new" @click.prevent="navigate('/feedback/new')">＋ 提需求</a></header>
    <p v-if="!feedbackEnabled" class="notice">需求反馈暂未启用。</p>
    <template v-else-if="mounted">
      <a v-if="mode !== 'list'" href="/feedback" @click.prevent="navigate('/feedback')">← 返回需求列表</a>
      <div v-if="store.pending || store.result" class="notice"><span>{{ store.result?'操作已保存，可查看结果。':'有一项操作尚未确认，重试会使用原内容和操作键。' }}</span><button class="fp-control" :disabled="store.busy" @click="resume">{{store.result?'查看结果':'重试原操作'}}</button></div>
      <p v-if="actionError" role="alert" class="error">{{actionError}}</p>
      <form v-if="mode==='new'" class="panel form" @submit.prevent="submit">
        <h2>说说你的想法</h2><p class="muted">请描述使用场景、遇到的问题或期望的效果。请勿填写密码、令牌等私密信息。</p>
        <label>分类<select class="fp-control" v-model="store.draft.category" :disabled="!!store.pending"><option v-for="(name,key) in categories" :key="key" :value="key">{{name}}</option></select></label>
        <label>标题<input class="fp-control" v-model="store.draft.title" minlength="5" maxlength="100" required :disabled="!!store.pending" placeholder="用一句话概括需求（5～100 字）"></label>
        <label>详细说明<textarea class="fp-control" v-model="store.draft.description" minlength="10" maxlength="5000" rows="9" required :disabled="!!store.pending" placeholder="使用场景、当前表现、期望效果（10～5000 字）" /></label>
        <button class="primary fp-control" :disabled="store.busy || !!store.pending || !!store.result">{{auth.isLoggedIn?'提交需求':'登录后提交'}}</button>
      </form>
      <template v-else>
        <form v-if="mode==='list'" class="filters" @submit.prevent="search"><input class="fp-control" v-model="filter.q" maxlength="100" placeholder="搜索需求" aria-label="搜索需求"><select class="fp-control" v-model="filter.category" aria-label="需求分类"><option value="">全部分类</option><option v-for="(name,key) in categories" :key="key" :value="key">{{name}}</option></select><select class="fp-control" v-model="filter.status" aria-label="处理状态"><option value="">全部状态</option><option v-for="(name,key) in statuses" :key="key" :value="key">{{name}}</option></select><select class="fp-control" v-model="filter.sort" aria-label="排序方式"><option value="latest">最新</option><option value="support">最多支持</option></select><button class="fp-control">查找</button></form>
        <p v-if="loading" role="status">正在读取需求…</p>
        <div v-else-if="error" class="notice error" role="alert">{{error}}<button class="fp-control" @click="load">重试读取</button></div>
        <template v-else-if="mode==='list' && list">
          <p class="muted">共 {{list.total}} 条需求</p><p v-if="!list.items.length" class="panel fp-card fp-state">暂无符合条件的需求，欢迎分享你的想法。</p>
          <article v-for="row in list.items" :key="row.id" class="panel request-row fp-card"><div class="score"><b>{{row.support}}</b><span>支持</span><small>{{row.oppose}} 反对</small></div><div class="summary"><div class="badges"><span>{{categories[row.category]}}</span><span>{{statuses[row.status]}}</span></div><h2><a :href="'/feedback/'+row.id" @click.prevent="navigate('/feedback/'+row.id)">{{row.title}}</a></h2><p class="excerpt">{{row.description}}</p><small class="muted">{{row.authorNickname || row.authorName}} · {{new Date(row.createdAt).toLocaleString()}}</small></div></article>
          <nav class="pagination fp-pagination" aria-label="需求分页"><button class="fp-control" :disabled="page<=1" @click="page--;load()">上一页</button><span>{{list.page}} / {{Math.max(1,list.pageCount)}}</span><button class="fp-control" :disabled="page>=list.pageCount" @click="page++;load()">下一页</button></nav>
        </template>
        <article v-else-if="item" class="panel detail fp-card"><div class="badges"><span>{{categories[item.category]}}</span><span>{{statuses[item.status]}}</span></div><h2>{{item.title}}</h2><p class="muted">{{item.authorNickname || item.authorName}} · {{new Date(item.createdAt).toLocaleString()}}</p><div class="prose">{{item.description}}</div><div class="votes"><button class="fp-control" :aria-pressed="personal?.vote==='support'" :class="{selected:personal?.vote==='support'}" :disabled="voting || (auth.isLoggedIn && !personal)" @click="vote('support')">支持 {{item.support}}</button><button class="fp-control" :aria-pressed="personal?.vote==='oppose'" :class="{selected:personal?.vote==='oppose'}" :disabled="voting || (auth.isLoggedIn && !personal)" @click="vote('oppose')">反对 {{item.oppose}}</button><span class="muted">{{auth.isLoggedIn?'再次点击可撤销':'登录后可投票'}}</span></div><section v-if="item.note" class="notice"><div><h3>处理说明</h3><p class="prose">{{item.note}}</p></div></section></article>
        <p v-if="personalError" class="error" role="alert">本人状态读取失败：{{personalError}} <button class="fp-control" @click="loadPersonal">重试</button></p>
        <form v-if="mode==='detail' && personal?.canModerate" class="panel form" @submit.prevent="moderate"><h2>处理需求</h2><label>状态<select class="fp-control" v-model="moderation.status"><option v-for="(name,key) in statuses" :key="key" :value="key">{{name}}</option></select></label><label>处理说明<textarea class="fp-control" v-model="moderation.note" maxlength="2000" rows="4" /></label><label class="check"><input v-model="moderation.hidden" type="checkbox">隐藏此需求（公开列表和详情均不可见）</label><button class="primary fp-control" :disabled="store.busy || !!store.pending || !!store.result">保存处理结果</button></form>
      </template>
    </template><p v-else role="status">准备读取需求…</p>
  </main>
</template>
<style scoped>
.feedback{margin:0 auto;color:var(--fp-text)}.feedback-head{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:var(--fp-page-gap)}.feedback-head h1{margin:6px 0;font-size:var(--fp-page-title-size)}.feedback-head p,.muted{color:var(--fp-muted)}.eyebrow{font-size:12px;color:var(--fp-accent);letter-spacing:2px}.panel{padding:24px;margin:18px 0;background:var(--fp-card,var(--fp-bg));border:1px solid var(--fp-border);border-radius: var(--fp-panel-radius)}.panel h2{font-size:19px;margin:8px 0 12px}.form{display:grid;gap:18px}.form label{display:grid;gap:8px;font-size:14px}input,select,textarea,button,.primary{font:inherit;border:1px solid var(--fp-border);border-radius:8px;padding:10px 14px;color:inherit;background:var(--fp-bg);min-width:0}textarea{resize:vertical}button,.primary{cursor:pointer;display:inline-block;text-align:center}button:disabled{opacity:.5;cursor:default}.primary{background:var(--fp-primary);color:white;border-color:var(--fp-primary)}.selected{background:var(--fp-primary-soft);color:var(--fp-primary);border-color:var(--fp-primary)}.form>.primary{justify-self:start}.filters{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}.filters input{flex:1;min-width:180px}.request-row{display:flex;gap:24px;align-items:center}.score{display:grid;gap:5px;text-align:center;flex:none;min-width:55px;color:var(--fp-accent)}.score b{font-size:25px}.score span,.score small{font-size:12px}.score small{color:var(--fp-muted)}.summary{min-width:0}.summary h2 a{color:inherit}.summary h2 a:hover{text-decoration:underline}.excerpt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--fp-muted);font-size:14px;line-height:1.7}.badges{display:flex;gap:8px;font-size:12px;color:var(--fp-muted)}.badges span{padding:4px 9px;background:var(--fp-hover);border-radius:5px}.prose{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.9;margin:22px 0}.votes,.pagination{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.pagination{justify-content:center;margin-top:25px}.notice{display:flex;gap:12px;align-items:center;padding:18px;background:var(--fp-hover);border-radius:9px;margin:18px 0}.error{color: var(--fp-danger)}.check{display:flex!important;align-items:center}.check input{margin:0}.detail h2{font-size:25px;overflow-wrap:anywhere}@media(max-width:600px){.feedback{padding:0}.panel{padding:18px}.request-row{gap:14px}.feedback-head h1{font-size:var(--fp-page-title-size)}.feedback-head p{font-size:13px}.filters select{flex:1}}
</style>

<style scoped>
@media (max-width:640px) {
  .filters { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px; }
  .filters input { grid-column:1 / -1;width:100%;min-width:0; }
  .filters select, .filters button { width:100%;min-width:0; }
}
</style>

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
function selectCategory(cat:string) { filter.category=cat; search() }
function formatTime(raw:string) {
  if(!raw) return ''
  const d=new Date(raw)
  if(Number.isNaN(d.getTime())) return raw
  const pad=(n:number)=>String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const categoryIcons:Record<string,string>={feature:'💡',bug:'🐛',experience:'✨'}
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
  <main class="feedback fp-page fp-ui" :class="{'is-embedded': embedded}">
    <header class="feedback-head fp-page-heading">
      <div class="head-brand">
        <span class="head-icon" aria-hidden="true">💬</span>
        <div class="head-titles">
          <div class="head-title-row">
            <h1 class="fp-page-title">需求反馈</h1>
            <span class="eyebrow">一起打磨摸鱼派</span>
          </div>
          <p class="head-sub">记录问题，分享想法，让每一份建议有回音。</p>
        </div>
      </div>
      <div class="head-actions">
        <a v-if="mode !== 'list' && feedbackEnabled" class="back-btn fp-link-action" href="/feedback" @click.prevent="navigate('/feedback')">← 返回需求列表</a>
        <a v-if="mode !== 'new' && feedbackEnabled" class="primary fp-link-action" href="/feedback/new" @click.prevent="navigate('/feedback/new')">＋ 提需求</a>
        <slot name="head-end" />
      </div>
    </header>

    <div class="feedback-body">
      <p v-if="!feedbackEnabled" class="notice">需求反馈暂未启用。</p>
      <template v-else-if="mounted">
        <div v-if="store.pending || store.result" class="notice notice--pending">
          <span class="notice-text">{{ store.result ? '操作已保存，可查看结果。' : '有一项操作尚未确认，重试会使用原内容和操作键。' }}</span>
          <button class="fp-control primary-ghost" :disabled="store.busy" @click="resume">{{ store.result ? '查看结果' : '重试原操作' }}</button>
        </div>
        <p v-if="actionError" role="alert" class="notice error">{{ actionError }}</p>

        <form v-if="mode==='new'" class="panel form fp-card" @submit.prevent="submit">
          <div class="form-head">
            <h2>说说你的想法</h2>
            <p class="muted">请描述使用场景、遇到的问题或期望的效果。请勿填写密码、令牌等私密信息。</p>
          </div>

          <div class="field-group">
            <span class="field-label">反馈分类</span>
            <div class="cat-picker" role="group" aria-label="选择反馈分类">
              <button
                v-for="(name,key) in categories"
                :key="key"
                type="button"
                class="cat-pill"
                :class="{active: store.draft.category===key}"
                :disabled="!!store.pending"
                @click="store.draft.category=String(key)"
              >
                <span aria-hidden="true">{{ categoryIcons[key] || '📌' }}</span>
                <span>{{ name }}</span>
              </button>
            </div>
            <label class="sr-select">
              分类
              <select class="fp-control" v-model="store.draft.category" :disabled="!!store.pending">
                <option v-for="(name,key) in categories" :key="key" :value="key">{{ name }}</option>
              </select>
            </label>
          </div>

          <label class="field-group">
            <span class="field-label-row">
              <span class="field-label">需求标题</span>
              <small class="char-count">{{ store.draft.title.length }} / 100</small>
            </span>
            <input class="fp-control" v-model="store.draft.title" minlength="5" maxlength="100" required :disabled="!!store.pending" placeholder="用一句话概括需求（5～100 字）">
          </label>

          <label class="field-group">
            <span class="field-label-row">
              <span class="field-label">详细说明</span>
              <small class="char-count">{{ store.draft.description.length }} / 5000</small>
            </span>
            <textarea class="fp-control" v-model="store.draft.description" minlength="10" maxlength="5000" rows="7" required :disabled="!!store.pending" placeholder="使用场景、当前表现、期望效果（10～5000 字）" />
          </label>

          <div class="form-footer">
            <a class="cancel-link fp-link-action" href="/feedback" @click.prevent="navigate('/feedback')">取消</a>
            <button class="primary fp-control" :disabled="store.busy || !!store.pending || !!store.result">{{ auth.isLoggedIn ? '提交需求' : '登录后提交' }}</button>
          </div>
        </form>

        <template v-else>
          <div v-if="mode==='list'" class="toolbar-card fp-card">
            <div class="cat-tabs" role="tablist" aria-label="按分类筛选">
              <button type="button" class="cat-tab" :class="{active: filter.category===''}" @click="selectCategory('')">全部</button>
              <button v-for="(name,key) in categories" :key="key" type="button" class="cat-tab" :class="{active: filter.category===key}" @click="selectCategory(String(key))">
                <span aria-hidden="true">{{ categoryIcons[key] }}</span>
                <span>{{ name }}</span>
              </button>
              <span v-if="list" class="total-badge">共 <b>{{ list.total }}</b> 条</span>
            </div>

            <form class="filters" @submit.prevent="search">
              <div class="search-wrap">
                <span class="search-icon" aria-hidden="true">🔍</span>
                <input class="fp-control search-input" v-model="filter.q" maxlength="100" placeholder="搜索需求标题或描述…" aria-label="搜索需求">
              </div>
              <select class="fp-control filter-cat-select" v-model="filter.category" aria-label="需求分类" @change="search">
                <option value="">全部分类</option>
                <option v-for="(name,key) in categories" :key="key" :value="key">{{ name }}</option>
              </select>
              <select class="fp-control" v-model="filter.status" aria-label="处理状态" @change="search">
                <option value="">全部状态</option>
                <option v-for="(name,key) in statuses" :key="key" :value="key">{{ name }}</option>
              </select>
              <select class="fp-control" v-model="filter.sort" aria-label="排序方式" @change="search">
                <option value="latest">最新发布</option>
                <option value="support">最多支持</option>
              </select>
              <button class="fp-control filter-submit">查找</button>
            </form>
          </div>

          <div v-if="loading" class="state-box fp-card fp-state" role="status">
            <span class="loading-dot" aria-hidden="true" />
            <span>正在读取需求…</span>
          </div>
          <div v-else-if="error" class="notice error" role="alert">
            <span>{{ error }}</span>
            <button class="fp-control" @click="load">重试读取</button>
          </div>

          <template v-else-if="mode==='list' && list">
            <div v-if="!list.items.length" class="panel fp-card fp-state empty-box">
              <span class="empty-emoji" aria-hidden="true">📭</span>
              <p>暂无符合条件的需求，欢迎分享你的想法。</p>
            </div>
            <div v-else class="request-list">
              <article v-for="row in list.items" :key="row.id" class="panel request-row fp-card" @click="navigate('/feedback/'+row.id)">
                <div class="score" :class="{'has-support': row.support > 0}">
                  <span class="score-arrow" aria-hidden="true">▲</span>
                  <b>{{ row.support }}</b>
                  <span class="score-label">支持</span>
                  <small v-if="row.oppose > 0" class="score-oppose">{{ row.oppose }} 反对</small>
                </div>
                <div class="summary">
                  <div class="summary-top">
                    <div class="badges">
                      <span class="badge badge-cat" :data-category="row.category">{{ categoryIcons[row.category] }} {{ categories[row.category] || row.category }}</span>
                      <span class="badge badge-status" :data-status="row.status">{{ statuses[row.status] || row.status }}</span>
                    </div>
                    <small class="meta-inline muted">{{ row.authorNickname || row.authorName }} · {{ formatTime(row.createdAt) }}</small>
                  </div>
                  <h2><a :href="'/feedback/'+row.id" @click.stop.prevent="navigate('/feedback/'+row.id)">{{ row.title }}</a></h2>
                  <p class="excerpt">{{ row.description }}</p>
                </div>
              </article>
            </div>
            <nav v-if="list.pageCount > 1 || list.items.length > 0" class="pagination fp-pagination" aria-label="需求分页">
              <button class="fp-control" :disabled="page<=1" @click="page--;load()">上一页</button>
              <span class="page-indicator">第 <b>{{ list.page }}</b> / {{ Math.max(1,list.pageCount) }} 页</span>
              <button class="fp-control" :disabled="page>=list.pageCount" @click="page++;load()">下一页</button>
            </nav>
          </template>

          <article v-else-if="item" class="panel detail fp-card">
            <div class="detail-head">
              <div class="badges">
                <span class="badge badge-cat" :data-category="item.category">{{ categoryIcons[item.category] }} {{ categories[item.category] || item.category }}</span>
                <span class="badge badge-status" :data-status="item.status">{{ statuses[item.status] || item.status }}</span>
              </div>
              <h2>{{ item.title }}</h2>
              <p class="detail-meta muted">
                <span class="meta-author">{{ item.authorNickname || item.authorName }}</span>
                <span>·</span>
                <time :datetime="item.createdAt">发布于 {{ formatTime(item.createdAt) }}</time>
              </p>
            </div>

            <div class="prose">{{ item.description }}</div>

            <div class="votes">
              <button
                class="fp-control vote-btn vote-support"
                :aria-pressed="personal?.vote==='support'"
                :class="{selected:personal?.vote==='support'}"
                :disabled="voting || (auth.isLoggedIn && !personal)"
                @click="vote('support')"
              >
                <span aria-hidden="true">▲</span>
                <span>支持 {{ item.support }}</span>
              </button>
              <button
                class="fp-control vote-btn vote-oppose"
                :aria-pressed="personal?.vote==='oppose'"
                :class="{selected:personal?.vote==='oppose'}"
                :disabled="voting || (auth.isLoggedIn && !personal)"
                @click="vote('oppose')"
              >
                <span aria-hidden="true">▼</span>
                <span>反对 {{ item.oppose }}</span>
              </button>
              <span class="vote-hint muted">{{ auth.isLoggedIn ? '再次点击可撤销投票' : '登录后可参与投票' }}</span>
            </div>

            <section v-if="item.note" class="official-note">
              <div class="official-note-head">
                <span class="official-badge">官方回复 / 处理说明</span>
              </div>
              <p class="prose">{{ item.note }}</p>
            </section>
          </article>

          <p v-if="personalError" class="notice error" role="alert">
            <span>本人状态读取失败：{{ personalError }}</span>
            <button class="fp-control" @click="loadPersonal">重试</button>
          </p>

          <form v-if="mode==='detail' && personal?.canModerate" class="panel form moderate-form fp-card" @submit.prevent="moderate">
            <div class="form-head">
              <h2>⚙️ 处理需求（管理员）</h2>
            </div>
            <div class="moderate-grid">
              <label class="field-group">
                <span class="field-label">状态</span>
                <select class="fp-control" v-model="moderation.status">
                  <option v-for="(name,key) in statuses" :key="key" :value="key">{{ name }}</option>
                </select>
              </label>
              <label class="check">
                <input v-model="moderation.hidden" type="checkbox">
                <span>隐藏此需求（公开列表和详情均不可见）</span>
              </label>
            </div>
            <label class="field-group">
              <span class="field-label">处理说明</span>
              <textarea class="fp-control" v-model="moderation.note" maxlength="2000" rows="3" placeholder="填写处理进展或回复说明（选填）" />
            </label>
            <div class="form-footer">
              <button class="primary fp-control" :disabled="store.busy || !!store.pending || !!store.result">保存处理结果</button>
            </div>
          </form>
        </template>
      </template>
      <div v-else class="state-box fp-card fp-state" role="status">准备读取需求…</div>
    </div>
  </main>
</template>
<style scoped>
.feedback {
  margin: 0 auto;
  color: var(--fp-text);
}

/* Header */
.feedback-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.head-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.head-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--fp-primary-soft);
  color: var(--fp-primary);
  font-size: 20px;
  flex-shrink: 0;
}

.head-titles {
  min-width: 0;
}

.head-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.feedback-head h1 {
  margin: 0 !important;
  font-size: 19px !important;
  font-weight: 600;
  line-height: 1.3;
  color: var(--fp-title);
}

.eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--fp-accent-soft);
  color: var(--fp-accent);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.head-sub {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: var(--fp-muted);
  line-height: 1.4;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.head-actions > :is(a, button) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px !important;
  min-height: 36px !important;
  margin: 0;
  box-sizing: border-box;
  border-radius: 8px !important;
  line-height: 1;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  height: 36px;
  min-height: 36px;
  padding: 0 14px !important;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-elevated, var(--fp-bg));
  color: var(--fp-text);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.back-btn:hover {
  background: var(--fp-hover);
  border-color: var(--fp-border-strong);
  text-decoration: none;
}

/* Controls & Buttons */
input,
select,
textarea,
button,
.primary {
  font: inherit;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  padding: 7px 12px;
  color: inherit;
  background: var(--fp-bg);
  min-width: 0;
}

textarea {
  resize: vertical;
}

button,
.primary {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
}

button:disabled {
  opacity: 0.5;
  cursor: default;
}

.primary {
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 14px !important;
  box-sizing: border-box;
  background: var(--fp-primary);
  color: #fff;
  border-color: var(--fp-primary);
  border-radius: 8px !important;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  text-decoration: none;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.primary:hover:not(:disabled) {
  background: var(--fp-primary-hover);
  border-color: var(--fp-primary-hover);
  text-decoration: none;
}

/* Toolbar & Filters */
.toolbar-card {
  padding: 14px 16px;
  margin-bottom: 14px;
  background: var(--fp-elevated, var(--fp-card));
  border: 1px solid var(--fp-border);
  border-radius: 12px;
}

.cat-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding-bottom: 12px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--fp-border);
}

.cat-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--fp-muted);
  font-size: 12.5px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.cat-tab:hover {
  background: var(--fp-hover);
  color: var(--fp-text);
}

.cat-tab.active {
  background: var(--fp-primary-soft);
  border-color: color-mix(in srgb, var(--fp-primary) 35%, transparent);
  color: var(--fp-primary);
  font-weight: 600;
}

.total-badge {
  margin-left: auto;
  font-size: 12px;
  color: var(--fp-muted);
}

.total-badge b {
  color: var(--fp-title);
  font-weight: 600;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.filters :is(input.fp-control, select.fp-control, button.fp-control) {
  height: 36px !important;
  min-height: 36px !important;
  box-sizing: border-box;
  margin: 0;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 180px;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 10px;
  font-size: 12px;
  opacity: 0.6;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding-left: 30px !important;
}

.filter-cat-select {
  display: none !important;
}

.filter-submit {
  background: var(--fp-card);
  border-color: var(--fp-border-strong, var(--fp-border));
  color: var(--fp-title);
  padding: 0 14px !important;
}

.filter-submit:hover {
  background: var(--fp-hover);
}

/* Request List & Cards */
.request-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel {
  padding: 16px 18px;
  margin: 0;
  background: var(--fp-card, var(--fp-bg));
  border: 1px solid var(--fp-border);
  border-radius: 12px;
}

.request-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease;
}

.request-row:hover {
  border-color: var(--fp-border-strong);
  background: var(--fp-elevated, var(--fp-card));
}

.score {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 58px;
  padding: 8px 6px;
  border-radius: 10px;
  background: var(--fp-elevated, var(--fp-hover));
  border: 1px solid var(--fp-border);
  color: var(--fp-muted);
  text-align: center;
  flex-shrink: 0;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.score.has-support {
  background: var(--fp-primary-soft);
  border-color: color-mix(in srgb, var(--fp-primary) 30%, transparent);
  color: var(--fp-primary);
}

.score-arrow {
  font-size: 10px;
  line-height: 1;
}

.score b {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.score-label {
  font-size: 11px;
  opacity: 0.85;
}

.score-oppose {
  margin-top: 2px;
  padding-top: 2px;
  border-top: 1px dashed var(--fp-border);
  font-size: 10px;
  color: var(--fp-muted);
}

.summary {
  flex: 1;
  min-width: 0;
}

.summary-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 500;
  background: var(--fp-hover);
  color: var(--fp-muted);
  border: 1px solid transparent;
}

.badge-cat {
  background: var(--fp-elevated, var(--fp-hover));
  border-color: var(--fp-border);
  color: var(--fp-text);
}

.badge-status[data-status='pending'] {
  background: var(--fp-hover);
  color: var(--fp-muted);
}

.badge-status[data-status='planned'] {
  background: color-mix(in srgb, var(--fp-link) 15%, transparent);
  color: var(--fp-link);
}

.badge-status[data-status='in_progress'] {
  background: var(--fp-accent-soft);
  color: var(--fp-accent);
}

.badge-status[data-status='done'] {
  background: var(--fp-primary-soft);
  color: var(--fp-primary);
}

.badge-status[data-status='declined'] {
  background: var(--fp-danger-soft);
  color: var(--fp-danger);
}

.meta-inline {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.summary h2 {
  margin: 0 0 5px;
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--fp-title);
}

.summary h2 a {
  color: inherit;
  text-decoration: none;
}

.summary h2 a:hover {
  color: var(--fp-primary);
  text-decoration: none;
}

.excerpt {
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  color: var(--fp-muted);
  font-size: 13px;
  line-height: 1.6;
}

/* Detail View */
.detail {
  padding: 22px;
}

.detail-head {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--fp-border);
}

.detail h2 {
  margin: 10px 0 8px;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--fp-title);
  overflow-wrap: anywhere;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 12.5px;
}

.meta-author {
  color: var(--fp-text);
  font-weight: 500;
}

.prose {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.8;
  font-size: 14px;
  color: var(--fp-text);
  margin: 18px 0;
}

.votes {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  padding-top: 16px;
  border-top: 1px solid var(--fp-border);
}

.vote-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 14px;
  border-radius: 999px !important;
  background: var(--fp-elevated, var(--fp-bg));
  border: 1px solid var(--fp-border);
  font-size: 13px;
  font-weight: 500;
}

.vote-btn:hover:not(:disabled) {
  border-color: var(--fp-border-strong);
  background: var(--fp-hover);
}

.selected,
.vote-support.selected {
  background: var(--fp-primary-soft) !important;
  color: var(--fp-primary) !important;
  border-color: var(--fp-primary) !important;
  font-weight: 600;
}

.vote-oppose.selected {
  background: var(--fp-danger-soft) !important;
  color: var(--fp-danger) !important;
  border-color: var(--fp-danger) !important;
}

.vote-hint {
  font-size: 12px;
  margin-left: 4px;
}

.official-note {
  margin-top: 18px;
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--fp-primary) 30%, var(--fp-border));
  border-left: 3px solid var(--fp-primary);
  background: color-mix(in srgb, var(--fp-primary-soft) 45%, var(--fp-elevated, var(--fp-bg)));
}

.official-note-head {
  margin-bottom: 6px;
}

.official-badge {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--fp-primary);
}

.official-note .prose {
  margin: 0;
  font-size: 13.5px;
}

/* Forms (New & Moderate) */
.form {
  display: grid;
  gap: 16px;
  padding: 20px 22px;
}

.moderate-form {
  margin-top: 14px;
}

.form-head h2 {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 600;
  color: var(--fp-title);
}

.form-head p {
  margin: 0;
  font-size: 12.5px;
}

.field-group {
  display: grid;
  gap: 7px;
  font-size: 13.5px;
}

.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.field-label {
  font-weight: 500;
  color: var(--fp-title);
}

.char-count {
  font-size: 11.5px;
  color: var(--fp-muted);
  font-variant-numeric: tabular-nums;
}

.cat-picker {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.cat-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 38px;
  border-radius: 10px;
  border: 1px solid var(--fp-border);
  background: var(--fp-elevated, var(--fp-bg));
  color: var(--fp-text);
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.cat-pill:hover:not(:disabled) {
  border-color: var(--fp-border-strong);
  background: var(--fp-hover);
}

.cat-pill.active {
  background: var(--fp-primary-soft);
  border-color: var(--fp-primary);
  color: var(--fp-primary);
  font-weight: 600;
}

.sr-select {
  display: none !important;
}

.moderate-grid {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.moderate-grid .field-group {
  min-width: 180px;
}

.check {
  display: inline-flex !important;
  align-items: center;
  gap: 8px;
  height: 36px;
  font-size: 13px;
  color: var(--fp-text);
  cursor: pointer;
}

.check input {
  margin: 0;
}

.form-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--fp-border);
}

.cancel-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px !important;
  min-height: 36px !important;
  padding: 0 14px !important;
  box-sizing: border-box;
  border: 1px solid var(--fp-border);
  border-radius: 8px !important;
  background: transparent;
  color: var(--fp-muted);
  font-size: 13px;
  line-height: 1;
  text-decoration: none;
}

.cancel-link:hover {
  background: var(--fp-hover);
  color: var(--fp-text);
}

/* Notices, States & Pagination */
.muted {
  color: var(--fp-muted);
}

.notice {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: var(--fp-elevated, var(--fp-hover));
  border: 1px solid var(--fp-border);
  border-radius: 10px;
  margin: 0 0 14px;
  font-size: 13px;
}

.notice--pending {
  border-color: color-mix(in srgb, var(--fp-accent) 40%, var(--fp-border));
  background: var(--fp-accent-soft);
}

.error {
  color: var(--fp-danger);
  border-color: color-mix(in srgb, var(--fp-danger) 35%, var(--fp-border));
  background: var(--fp-danger-soft);
}

.state-box,
.empty-box {
  min-height: 180px;
}

.empty-emoji {
  font-size: 28px;
  line-height: 1;
}

.loading-dot {
  width: 18px;
  height: 18px;
  border: 2px solid var(--fp-border-strong);
  border-top-color: var(--fp-primary);
  border-radius: 50%;
  animation: fp-spin 0.75s linear infinite;
}

@keyframes fp-spin {
  to {
    transform: rotate(360deg);
  }
}

.pagination {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  margin-top: 16px;
  padding-top: 14px;
}

.page-indicator b {
  color: var(--fp-title);
}

@media (max-width: 640px) {
  .feedback-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .head-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .cat-picker {
    grid-template-columns: 1fr;
  }
  .filters {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .search-wrap {
    grid-column: 1 / -1;
    width: 100%;
    min-width: 0;
  }
  .filters select,
  .filters button {
    width: 100%;
    min-width: 0;
  }
  .request-row {
    gap: 12px;
    padding: 14px;
  }
  .score {
    min-width: 50px;
    padding: 6px 4px;
  }
}
</style>

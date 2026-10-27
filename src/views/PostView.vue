<script setup lang="ts">
import { computed,onMounted,onBeforeUnmount,ref,watch } from 'vue'
import { RouterLink,useRoute,useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { postSource,draftPage,draftSource,postInput,emptyPost,type PostFields,type PostSource,type PostCommand,type PostReceipt,type DraftSummary } from '@/api/v3-posts'
import { getAuthContextVersion } from '@/api/http'
import { useV3PostsStore } from '@/stores/v3Posts'
import { fpConfirm } from '@/composables/useDialog'
import { clearCache } from '@/utils/swr'
import EmojiPicker from '@/components/EmojiPicker.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import AuthorColumnPicker from '@/components/posts/AuthorColumnPicker.vue'
import TagInput from '@/components/posts/TagInput.vue'
import { useAuthStore } from '@/stores/auth'
const TYPES = [
  { value: 0, label: '帖子', tip: '分享对别人有帮助的经验与见解' },
  { value: 1, label: '机要', tip: '邀请好友在私密空间中进行交流' },
  { value: 2, label: '同城广播', tip: '发起你所在城市的招聘、Meetup 等，需消耗积分' },
  { value: 5, label: '问答', tip: '总有一个人知道这个问题的答案' },
]
const TYPE_LABELS: Record<number, string> = { 0: '帖子', 1: '机要', 2: '同城广播', 3: '思绪', 4: '历史类型（4）', 5: '问答', 6: '长文章' }
const STATEMENTS = [
  { value: 0, label: '无声明' },
  { value: 1, label: '包含 AI 辅助创作' },
  { value: 2, label: '包含剧透' },
  { value: 3, label: '虚构演绎，仅供娱乐' },
]

const OP_LABELS={'publish':'发布文章','edit':'编辑文章','draft-save':'保存草稿','draft-delete':'删除草稿'}
const auth=useAuthStore(),{accessToken,account,isLoggedIn}=storeToRefs(auth),operations=useV3PostsStore(),router=useRouter(),route=useRoute()
const editId=computed(()=>typeof route.params.id==='string'?route.params.id:'')
const title=ref(''),tags=ref(''),content=ref(''),type=ref(0),offer=ref(0),rewardOpen=ref(false),rewardContent=ref(''),rewardPoint=ref<number|null>(0)
const anonymous=ref(false),commentable=ref(true),notifyFollowers=ref(false),showInList=ref(true),statement=ref(0)
const columnMode=ref<''|'__NEW__'|'existing'>(''),columnId=ref(''),columnTitle=ref(''),chapterNo=ref(''),columnCoverURL=ref(''),thoughtContent=ref('')
const drafts=ref<DraftSummary[]>([]),draftPagination=ref({p:1,size:20,total:0,pageCount:0}),draftPageNo=ref(1),draftId=ref(''),draftsError=ref(''),draftsLoading=ref(false)
const source=ref<PostSource|null>(null),sourceLoading=ref(false),sourceError=ref(''),error=ref(''),mounted=ref(false),initialDraftResolved=ref(false),sourceTarget=ref(''),loadConfirming=ref(false),published=ref(false),needsReload=ref(false)
const editorRef=ref<InstanceType<typeof MarkdownEditor>|null>(null),commandOrigin=Symbol('post-view')
const typeTip=computed(()=>TYPES.find(t=>t.value===type.value)?.tip||''),isLong=computed(()=>type.value===6),allowAnonymous=computed(()=>![2,5,6].includes(type.value))
const heading=computed(()=>isLong.value?(editId.value?'编辑长文章':'发布长文章'):(editId.value?'编辑帖子':'发帖'))
const ready=computed(()=>mounted.value&&isLoggedIn.value&&!sourceLoading.value&&!sourceError.value&&(editId.value?source.value?.id===editId.value:initialDraftResolved.value))
const locked=computed(()=>operations.busy||operations.confirming||!!operations.pending||loadConfirming.value)
const retainedReward=computed(()=>!!editId.value&&!!source.value&&source.value.rewardPoint>0)
let generation=0,listSequence=0,sourceSequence=0,boundary='',initialForm='',localKey='',loadConfirmation:AbortController|null=null
function identity(){return`${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId||''}:${route.fullPath}`}
function current(reader:string,version:number){return mounted.value&&isLoggedIn.value&&reader===identity()&&version===generation}
function snapshot():PostFields{
  const reward=editId.value?retainedReward.value||rewardOpen.value:rewardOpen.value&&!isLong.value&&type.value!==5
  return{title:title.value,content:content.value,tags:tags.value,type:type.value,rewardContent:reward?rewardContent.value:'',rewardPoint:reward?Number(rewardPoint.value??0):0,qnaOfferPoint:editId.value?Number(offer.value):type.value===5?Number(offer.value):0,commentable:commentable.value,showInList:showInList.value?1:0,statement:statement.value,anonymous:editId.value?anonymous.value:allowAnonymous.value&&anonymous.value,notifyFollowers:notifyFollowers.value,columnId:columnMode.value==='existing'?columnId.value.trim():'',columnTitle:columnMode.value?columnTitle.value:'',chapterNo:columnMode.value?chapterNo.value:'',columnCoverURL:columnCoverURL.value,thoughtContent:thoughtContent.value}
}
function apply(value:PostFields){title.value=value.title;tags.value=value.tags;content.value=value.content;type.value=value.type;offer.value=value.qnaOfferPoint;rewardContent.value=value.rewardContent;rewardPoint.value=value.rewardPoint;rewardOpen.value=value.rewardPoint>0||!!value.rewardContent;anonymous.value=value.anonymous;commentable.value=value.commentable;showInList.value=value.showInList===1;statement.value=value.statement;notifyFollowers.value=value.notifyFollowers;columnId.value=value.columnId;columnTitle.value=value.columnTitle;columnMode.value=value.columnId?'existing':value.columnTitle?'__NEW__':'';chapterNo.value=value.chapterNo;columnCoverURL.value=value.columnCoverURL;thoughtContent.value=value.thoughtContent}
function reset(){generation++;sourceSequence++;listSequence++;loadConfirmation?.abort();loadConfirmation=null;loadConfirming.value=false;sourceTarget.value='';operations.cancelConfirmation(commandOrigin);source.value=null;sourceLoading.value=false;sourceError.value='';error.value='';draftsError.value='';drafts.value=[];draftPagination.value={p:1,size:20,total:0,pageCount:0};draftPageNo.value=1;draftsLoading.value=false;draftId.value='';localKey='';initialDraftResolved.value=false;published.value=false;needsReload.value=false;apply(emptyPost());initialForm=''}
async function loadDrafts(p=draftPageNo.value){
  if(!mounted.value||!isLoggedIn.value||editId.value)return
  const reader=identity(),version=generation,sequence=++listSequence;draftsLoading.value=true;draftsError.value='';draftPageNo.value=p
  try{const result=await draftPage(p);if(current(reader,version)&&sequence===listSequence){drafts.value=result.list;draftPagination.value=result.pagination}}
  catch(reason){if(current(reader,version)&&sequence===listSequence){drafts.value=[];draftsError.value=reason instanceof Error?reason.message:'草稿列表读取失败'}}
  finally{if(current(reader,version)&&sequence===listSequence)draftsLoading.value=false}
}
async function loadDraft(id:string,initial=false){
  if(!mounted.value||!isLoggedIn.value||editId.value||((locked.value||sourceLoading.value)&&!initial))return
  const reader=identity(),version=generation,sequence=++sourceSequence
  loadConfirmation?.abort();loadConfirmation=null
  if(!initial&&JSON.stringify(snapshot())!==initialForm){const controller=new AbortController();loadConfirmation=controller;loadConfirming.value=true;let accepted=false;try{accepted=await fpConfirm({signal:controller.signal,title:'载入草稿',message:'载入会替换当前输入，是否继续？',confirmText:'载入'})}catch(reason){if(current(reader,version))error.value=reason instanceof Error?reason.message:'载入已取消';return}finally{if(loadConfirmation===controller){loadConfirmation=null;loadConfirming.value=false}}if(operations.pending||operations.busy||operations.confirming||!accepted||controller.signal.aborted||!current(reader,version)||sequence!==sourceSequence)return}
  sourceLoading.value=true;sourceError.value='';sourceTarget.value=id
  try{const result=await draftSource(id);if(current(reader,version)&&sequence===sourceSequence){apply(result);draftId.value=result.id;published.value=false;initialDraftResolved.value=true;initialForm=JSON.stringify(snapshot())}}
  catch(reason){if(current(reader,version)&&sequence===sourceSequence)sourceError.value=reason instanceof Error?reason.message:'草稿读取失败'}
  finally{if(current(reader,version)&&sequence===sourceSequence)sourceLoading.value=false}
}
async function loadEdit(){
  if(!mounted.value||!isLoggedIn.value||!editId.value)return
  const reader=identity(),version=generation,sequence=++sourceSequence;sourceLoading.value=true;sourceError.value=''
  try{const result=await postSource(editId.value);if(current(reader,version)&&sequence===sourceSequence){source.value=result;apply(result);needsReload.value=false;initialDraftResolved.value=true;initialForm=JSON.stringify(snapshot())}}
  catch(reason){if(current(reader,version)&&sequence===sourceSequence)sourceError.value=reason instanceof Error?reason.message:'原文读取失败'}
  finally{if(current(reader,version)&&sequence===sourceSequence)sourceLoading.value=false}
}
async function initialize(skipDraft=false){
  reset();if(!mounted.value||!isLoggedIn.value)return
  if(editId.value){await loadEdit();return}
  if(route.meta.long)type.value=6;else{const q=Number(route.query.type);if(TYPES.some(t=>t.value===q))type.value=q}
  if(typeof route.query.tags==='string')tags.value=route.query.tags
  const q=!skipDraft&&typeof route.query.draft==='string'?route.query.draft:'';initialDraftResolved.value=!q;initialForm=JSON.stringify(snapshot())
  if(q)void loadDraft(q,true)
  void loadDrafts(1)
}
async function reloadEdit(){
  if(locked.value||sourceLoading.value)return
  const reader=identity(),version=generation
  if(JSON.stringify(snapshot())!==initialForm){const controller=new AbortController();loadConfirmation=controller;loadConfirming.value=true;let accepted=false;try{accepted=await fpConfirm({signal:controller.signal,title:'重新读取原文',message:'重新读取将替换当前输入，是否继续？',confirmText:'重新读取'})}finally{if(loadConfirmation===controller){loadConfirmation=null;loadConfirming.value=false}}if(!accepted||controller.signal.aborted||!current(reader,version)||operations.pending||operations.busy)return}
  await loadEdit()
}
function retrySource(){if(editId.value)void loadEdit();else{const q=sourceTarget.value||draftId.value||String(route.query.draft||'');if(q)void loadDraft(q,true)}}
async function after(result:PostReceipt|null,command:PostCommand|null,reader:string,version:number,owned:boolean){
  if(!result||!command||!current(reader,version))return
  clearCache()
  if(result.op==='draft-save'){
    if(owned&&draftId.value===command.id){draftId.value=result.id;try{if(JSON.stringify(postInput('draft-save',snapshot(),null))===JSON.stringify(command.input))initialForm=JSON.stringify(snapshot())}catch{}}
    await loadDrafts();return
  }
  if(result.op==='draft-delete'){if(draftId.value===command.id)draftId.value='';await loadDrafts();return}
  let matches=false;try{matches=JSON.stringify(postInput(command.op,snapshot(),source.value,draftId.value))===JSON.stringify(command.input)}catch{}
  if(result.op==='publish'&&owned){published.value=true;if(draftId.value===command.input.draftId)draftId.value=''}
  if(result.op==='edit'&&editId.value===result.id)needsReload.value=true
  if(owned&&matches&&current(reader,version))await router.replace('/article/'+result.id)
}
async function run(op:PostCommand['op'],id:string){
  if(!ready.value||locked.value||(op==='publish'&&published.value)||(op==='edit'&&needsReload.value)||op==='draft-save'&&!!editId.value)return
  error.value='';const reader=identity(),version=generation
  try{const input=postInput(op,snapshot(),source.value,draftId.value);const result=await operations.start(op,id,input,commandOrigin);if(!current(reader,version))return;localKey=operations.pending?.key||'';await after(result,operations.completed,reader,version,true)}
  catch(reason){if(current(reader,version))error.value=reason instanceof Error?reason.message:'操作失败'}
}
function submit(){void run(editId.value?'edit':'publish',editId.value)}
function saveDraft(){void run('draft-save',draftId.value)}
async function dropDraft(id:string){
  if(locked.value||sourceLoading.value||!mounted.value||!isLoggedIn.value)return
  const reader=identity(),version=generation
  try{const result=await operations.start('draft-delete',id,{},commandOrigin);if(!current(reader,version))return;localKey=operations.pending?.key||'';await after(result,operations.completed,reader,version,true)}catch(reason){if(current(reader,version))error.value=reason instanceof Error?reason.message:'删除失败'}
}
async function restore(){const command=operations.pending;if(!command||operations.busy)return;const owned=localKey===command.key,reader=identity(),version=generation;const result=await operations.retry();await after(result,operations.completed,reader,version,owned)}
async function blank(){if(locked.value)return;const reader=identity();const query={...route.query};delete query.draft;await router.replace({path:route.path,query});if(mounted.value&&reader===identity())await initialize(true)}
watch([accessToken,()=>account.value?.oId,()=>route.fullPath],()=>{const next=identity();if(next===boundary)return;boundary=next;void initialize()},{flush:'sync'})
onMounted(()=>{mounted.value=true;boundary=identity();void initialize()})
onBeforeUnmount(()=>{mounted.value=false;reset()})
</script>

<template>
  <form class="card" @submit.prevent="submit">
    <h1>{{ heading }}</h1>
    <p v-if="!isLoggedIn" class="hint">请先登录。</p>
    <template v-else>
      <template v-if="operations.pending">
        <p role="status">上次{{ OP_LABELS[operations.pending.op] }}结果待确认，目标 {{ operations.pending.id||'新内容' }}；恢复仍提交原先的内容。</p>
        <button type="button" :aria-disabled="operations.busy" @click="restore()">恢复本次操作</button>
      </template>
      <p v-if="operations.message" role="status">{{ operations.message }}</p><p v-if="operations.error" role="alert">{{ operations.error }}</p>
      <p v-if="operations.receipt&&(operations.receipt.op==='publish'||operations.receipt.op==='edit')">文章 {{ operations.receipt.id }} 已确认。<RouterLink :to="'/article/'+operations.receipt.id">查看文章</RouterLink></p>
      <button v-if="operations.receipt?.op==='draft-save'&&!editId" type="button" :aria-disabled="locked" @click="loadDraft(operations.receipt.id)">载入已保存草稿 {{ operations.receipt.id }}</button>
      <section v-if="!editId" class="drafts">
        <h2>草稿</h2><p v-if="draftsLoading" role="status">正在读取草稿…</p><p v-if="draftsError" role="alert">{{ draftsError }}</p>
        <button type="button" :aria-disabled="draftsLoading" @click="!draftsLoading&&loadDrafts()">{{ draftsError?'重试草稿列表':'刷新草稿列表' }}</button>
        <div v-for="d in drafts" :key="d.id"><button type="button" class="ghost" :aria-disabled="locked||sourceLoading" @click="loadDraft(d.id)">{{ d.title||'无标题' }}</button><button type="button" class="ghost" :aria-disabled="locked||sourceLoading" @click="dropDraft(d.id)">删除草稿 {{ d.id }}</button></div>
        <p v-if="!draftsLoading&&!draftsError&&!drafts.length">{{ draftPagination.total===0?'暂无草稿':'本页无草稿' }}</p>
        <nav v-if="draftPagination.pageCount>1||draftPageNo>1"><button type="button" :aria-disabled="draftsLoading||draftPageNo<=1" @click="!draftsLoading&&draftPageNo>1&&loadDrafts(draftPageNo-1)">上一页草稿</button><span>第 {{ draftPageNo }} 页<span v-if="!draftsError&&!draftsLoading"> · 共 {{ draftPagination.total }}份</span></span><button type="button" :aria-disabled="draftsLoading||draftPageNo>=draftPagination.pageCount" @click="!draftsLoading&&draftPageNo<draftPagination.pageCount&&loadDrafts(draftPageNo+1)">下一页草稿</button></nav>
      </section>
      <p v-if="sourceLoading" role="status">正在读取原文…</p><p v-if="sourceError" role="alert">{{ sourceError }}</p>
      <button v-if="sourceError" type="button" @click="retrySource()">重试原文</button><button v-if="!editId&&sourceError&&initialDraftResolved" type="button" @click="sourceError=''">保留当前输入</button><button v-if="!editId&&sourceError" type="button" @click="blank()">新建空白文章</button>
      <template v-if="ready">
      <p v-if="published" role="status">本次文章已发布。<button type="button" @click="published=false">将当前输入作为新文章</button></p>
      <p v-if="needsReload" role="status">编辑已确认，继续编辑前请重新读取原文。<button type="button" @click="reloadEdit()">重新读取原文后继续编辑</button></p>
      <p v-if="source&&source.status!==0" role="status">当前文章不可编辑，可查看源码。</p>
      <p class="type-tip">
        <b>{{ TYPE_LABELS[type] || '帖子' }}</b>
        <span v-if="typeTip">{{ typeTip }}</span>
        <span v-if="isLong">适合创作小说、长篇故事等</span>
      </p>

      <input v-model="title" class="title-input" required placeholder="标题" />
      <textarea v-if="type===3" v-model="content" aria-label="思绪回放记录" rows="12" /><p v-if="type===3" class="hint">思绪回放记录修改需保留原格式，不能作为普通 Markdown 发布。</p>
      <MarkdownEditor v-else
        ref="editorRef"
        v-model="content"
        :api-key="null"
        :height="500"
        outline
        :placeholder="type === 1 ? '机要内容仅被 @ 的用户可见' : '支持 Markdown，可直接粘贴或拖拽上传图片'"
      />
      <div class="tools">
        <EmojiPicker @insert="(md) => editorRef?.insert(md)" />
      </div>

      <section v-if="isLong" class="column-form">
        <p class="type-tip">专栏设置（可选）：可将长文归入已有专栏，或新建专栏进行章节连载。</p>
        <label class="inline-field">
          所属专栏
          <select v-model="columnMode">
            <option value="">不归属专栏（独立长文）</option>
            <option value="existing">已有专栏</option>
            <option value="__NEW__">+ 新建专栏</option>
          </select>
        </label>
        <AuthorColumnPicker v-if="columnMode === 'existing'" :model-value="columnId" :current-title="columnTitle" :disabled="locked" @select="column => { columnId=column.id; columnTitle=column.title }" />
        <label v-if="columnMode === '__NEW__'" class="inline-field">
          新专栏名称
          <input v-model="columnTitle" maxlength="64" placeholder="请输入专栏名称（例如：《三体》）" />
        </label>
        <label v-if="columnMode" class="inline-field">
          章节号
          <input v-model="chapterNo" inputmode="numeric" placeholder="可选，留空自动排在该专栏末尾" />
        </label>
        <p class="type-tip">同一专栏按章节号排序，阅读页将自动显示章节目录与上下章跳转。</p>
      </section>

      <template v-if="!isLong">
      <TagInput v-model="tags" />
      <label v-if="type === 5" class="inline-field">
        悬赏积分
        <input v-model.number="offer" type="number" min="20" max="2147483647" placeholder="采纳答案时奖励给回答者" />
      </label>
      <section v-else class="reward">
        <button type="button" class="ghost reward-toggle" @click="rewardOpen = !rewardOpen">
          {{ rewardOpen ? retainedReward ? '收起打赏设置' : '取消打赏' : '打赏' }}
        </button>
        <template v-if="rewardOpen">
          <p class="type-tip">打赏内容仅对打赏过的用户可见。</p>
          <MarkdownEditor v-model="rewardContent" :api-key="null" :height="200" placeholder="打赏后可见的内容" />
          <label class="inline-field">
            打赏积分
            <input v-model.number="rewardPoint" type="number" min="1" max="2147483647" placeholder="打赏积分" />
          </label>
        </template>
      </section>

      <section class="settings">
        <label class="inline-field">
          创作声明
          <select v-model.number="statement">
            <option v-for="s in STATEMENTS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </label>
        <label v-if="allowAnonymous" class="check">
          <input v-model="anonymous" type="checkbox" :disabled="Boolean(editId)" />匿名
        </label>
        <label class="check"><input v-model="showInList" type="checkbox" />在列表展示</label>
        <label class="check"><input v-model="commentable" type="checkbox" />允许回帖</label>
        <label class="check"><input v-model="notifyFollowers" type="checkbox" />通知关注者</label>
      </section>
      </template>

      <p v-if="error" class="err">{{ error }}</p>
      <div class="tools">
        <button v-if="!editId" type="button" class="ghost" :aria-disabled="locked||!ready" @click="saveDraft">
          {{ operations.busy ? '保存中…' : '存草稿' }}
        </button>
        <button type="submit" :aria-disabled="locked||!ready||published||needsReload||!!source&&source.status!==0">
          {{ operations.busy ? '提交中…' : editId ? '保存' : '发布' }}
        </button>
      </div>
      </template>
    </template>
  </form>
</template>

<style scoped lang="scss">
.card {
  width: 100%;
  max-width: 960px;
  box-sizing: border-box;
  margin: 0 auto;
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  box-shadow: var(--fp-card-shadow);
  border-radius: var(--fp-radius-lg, 10px);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--fp-muted);
  font-size: 13px;
}
input:not([type='checkbox']):not([type='radio']):not([type='file']),
select,
textarea {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: var(--fp-radius-md, 8px);
  padding: 8px 12px;
  outline: none;
  transition: border-color 0.16s ease, box-shadow 0.16s ease;
}
input:not([type='checkbox']):not([type='radio']):not([type='file']):hover,
select:hover,
textarea:hover {
  border-color: var(--fp-border-strong, var(--fp-border));
}
input:not([type='checkbox']):not([type='radio']):not([type='file']):focus,
select:focus,
textarea:focus {
  border-color: var(--fp-primary);
  box-shadow: var(--fp-focus-ring);
}
button {
  border: 1px solid var(--fp-primary);
  background: var(--fp-primary);
  color: #fff;
  border-radius: var(--fp-radius-sm, 6px);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}
button:hover:not(:disabled) {
  background: var(--fp-primary-hover, var(--fp-primary));
  border-color: var(--fp-primary-hover, var(--fp-primary));
  box-shadow: 0 4px 12px color-mix(in srgb, var(--fp-primary) 28%, transparent);
}
button:disabled,button[aria-disabled='true'] {
  opacity: 0.5;
  cursor: not-allowed;
}
.ghost {
  background: transparent;
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
}
.ghost:hover:not(:disabled) {
  background: var(--fp-hover);
  border-color: var(--fp-border-strong, var(--fp-border));
  color: var(--fp-title);
  box-shadow: none;
}
.tools {
  display: flex;
  gap: 8px;
  align-items: center;
}
.hint,
.err {
  font-size: 13px;
}
.err {
  color: #e07a5f;
}
.drafts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.drafts h2 {
  margin: 0;
  font-size: 13px;
  color: var(--fp-muted);
}
.drafts span {
  margin-left: 8px;
  color: var(--fp-muted);
}
.hints {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.type-tip {
  margin: 0;
  font-size: 13px;
  color: var(--fp-muted);
}
.type-tip b {
  margin-right: 8px;
  color: var(--fp-title);
}
.title-input {
  font-size: 16px;
  padding: 10px 12px;
}
.inline-field {
  flex-direction: row;
  align-items: center;
  gap: 10px;
}
.inline-field input {
  width: 160px;
}
.reward {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.column-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px dashed var(--fp-border);
}
.column-form .inline-field input {
  width: 280px;
}
.reward-toggle {
  align-self: flex-start;
  padding: 6px 14px;
}
.settings {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  padding: 12px 0;
  border-top: 1px dashed var(--fp-border);
}
.check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  color: var(--fp-text);
  cursor: pointer;
  user-select: none;
}
.card { min-width: 0; overflow-wrap: anywhere; }
.drafts { min-width: 0; nav { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; } }
.tools { flex-wrap: wrap; }
@media (max-width: 600px) { .card { padding: 16px; } .inline-field { flex-wrap: wrap; } .column-form .inline-field input { max-width: 100%; min-width: 0; box-sizing: border-box; } }
</style>

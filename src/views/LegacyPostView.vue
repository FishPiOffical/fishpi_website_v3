<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { getAuthContextVersion } from '@/api/http'
import { emptyPost, type PostFields } from '@/api/v3-posts'
import { legacyDraftList, legacyDraftSource, legacyPostInput, type LegacyDraft, type LegacyPostCommand } from '@/api/legacy/posts'
import { useLegacyPostsStore } from '@/stores/legacyPosts'
import { useAuthStore } from '@/stores/auth'
import { fpConfirm } from '@/composables/useDialog'
import { usePageSeo } from '@/composables/usePageSeo'
import { clearCache } from '@/utils/swr'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import TagInput from '@/components/posts/TagInput.vue'
import AuthorColumnPicker from '@/components/posts/AuthorColumnPicker.vue'
const auth=useAuthStore(),store=useLegacyPostsStore(),route=useRoute(),router=useRouter(),mounted=ref(false)
const form=ref<PostFields>(emptyPost()),draftId=ref(''),drafts=ref<LegacyDraft[]>([]),listLoading=ref(false),listError=ref(''),sourceLoading=ref(false),sourceError=ref(''),sourceTarget=ref(''),error=ref(''),confirming=ref(false),publishedId=ref('')
const preview=ref<(PostFields&{id:string})|null>(null),previewLoading=ref(false),previewError=ref('')
const editor=ref<InstanceType<typeof MarkdownEditor>|null>(null),rewardEditor=ref<InstanceType<typeof MarkdownEditor>|null>(null)
const editId=computed(()=>typeof route.params.id==='string'?route.params.id:''),active=computed(()=>mounted.value&&auth.isLoggedIn&&!!auth.apiKey&&!editId.value),locked=computed(()=>store.busy||!!store.pending||confirming.value||sourceLoading.value)
const heading=computed(()=>editId.value?'编辑文章':form.value.type===6?'发布长文章':'发帖')
usePageSeo(()=>({title:heading.value,path:route.path,robots:'noindex'}))
const types=[{value:0,label:'帖子'},{value:1,label:'机要'},{value:2,label:'同城广播'},{value:5,label:'问答'},{value:6,label:'长文章'}]
const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId,route.fullPath])
let generation=0,listSequence=0,sourceSequence=0,previewSequence=0,confirmation:AbortController|null=null,initial=''
function guard(){const reader=identity(),run=generation;return()=>active.value&&reader===identity()&&run===generation}
function cancel(){confirmation?.abort();confirmation=null;confirming.value=false}
async function confirm(message:string){const valid=guard(),controller=new AbortController();confirmation=controller;confirming.value=true;try{return await fpConfirm({title:'确认文章操作',message,confirmText:'确认继续',signal:controller.signal})&&!controller.signal.aborted&&valid()}finally{if(confirmation===controller){confirmation=null;confirming.value=false}}}
function flush(){if(form.value.type!==3&&editor.value)form.value.content=editor.value.flush();if(rewardEditor.value)form.value.rewardContent=rewardEditor.value.flush()}
async function loadList(){if(!active.value||!auth.account?.oId||listLoading.value)return;const valid=guard(),run=++listSequence;listLoading.value=true;listError.value='';drafts.value=[];try{const result=await legacyDraftList(auth.account.oId);if(valid()&&run===listSequence)drafts.value=result}catch(failure){if(valid()&&run===listSequence)listError.value=failure instanceof Error?failure.message:'草稿列表读取失败'}finally{if(valid()&&run===listSequence)listLoading.value=false}}
async function loadDraft(id:string,first=false){
 if(!active.value||!auth.account?.oId||locked.value)return
 error.value='';try{flush()}catch(failure){error.value=failure instanceof Error?failure.message:'编辑器读取失败';return}
 const valid=guard();if(!first&&JSON.stringify(form.value)!==initial&&!await confirm('载入草稿将替换当前输入，是否继续？'))return
 if(!valid()||store.pending)return
 sourceTarget.value=id;const run=++sourceSequence;sourceLoading.value=true;sourceError.value=''
 try{const result=await legacyDraftSource(id,auth.account.oId);if(valid()&&run===sourceSequence){const{id:loaded,...fields}=result;draftId.value=loaded;form.value=fields;initial=JSON.stringify(fields);publishedId.value=''}}catch(failure){if(valid()&&run===sourceSequence)sourceError.value=failure instanceof Error?failure.message:'草稿读取失败'}finally{if(valid()&&run===sourceSequence)sourceLoading.value=false}
}
async function peekDraft(id:string){
 if(!active.value||!auth.account?.oId)return
 const valid=guard(),run=++previewSequence;preview.value=null;previewLoading.value=true;previewError.value=''
 try{const result=await legacyDraftSource(id,auth.account.oId);if(valid()&&run===previewSequence)preview.value=result}catch(failure){if(valid()&&run===previewSequence)previewError.value=failure instanceof Error?failure.message:'云端草稿读取失败'}finally{if(valid()&&run===previewSequence)previewLoading.value=false}
}
async function run(op:LegacyPostCommand['op'],id=''){
 if(!active.value||locked.value||sourceError.value||op==='publish'&&publishedId.value)return
 const valid=guard();error.value=''
 try{
  flush();const snapshot=JSON.parse(JSON.stringify(form.value)) as PostFields,input=legacyPostInput(op,snapshot,draftId.value)
  if(op!=='draft-save'&&!await confirm(op==='draft-delete'?'删除草稿后无法恢复，是否继续？':'发布会按平台规则结算积分。旧接口没有幂等恢复，提交期间请勿重复发布，是否继续？'))return
  if(!valid()||store.pending)return
  const result=await store.submit({op,id,input});if(!valid()||!result)return
  clearCache()
  if(result.op==='draft-save'){draftId.value=result.id;if(JSON.stringify(form.value)===JSON.stringify(snapshot))initial=JSON.stringify(snapshot);await loadList()}
  else if(result.op==='draft-delete'){if(draftId.value===id)draftId.value='';await loadList()}
  else{publishedId.value=result.id;if(!result.warning)draftId.value='';await loadList();if(valid()&&!result.warning&&JSON.stringify(form.value)===JSON.stringify(snapshot))await router.replace('/article/'+result.id)}
 }catch(failure){if(valid())error.value=failure instanceof Error?failure.message:'文章操作失败'}
}
function reset(){generation++;listSequence++;sourceSequence++;previewSequence++;preview.value=null;previewLoading.value=false;previewError.value='';cancel();form.value=emptyPost();draftId.value='';drafts.value=[];listLoading.value=sourceLoading.value=false;listError.value=sourceError.value=error.value='';publishedId.value='';sourceTarget.value='';if(route.meta.long)form.value.type=6;else{const t=Number(route.query.type);if(types.some(v=>v.value===t))form.value.type=t}if(typeof route.query.tags==='string')form.value.tags=route.query.tags;initial=JSON.stringify(form.value)}
function initialize(){reset();if(active.value){void loadList();if(typeof route.query.draft==='string'&&route.query.draft)void loadDraft(route.query.draft,true)}}
watch(identity,initialize,{flush:'sync'})
onMounted(()=>{mounted.value=true;initialize()})
onScopeDispose(()=>{mounted.value=false;reset()})
</script>
<template>
 <form class="card" @submit.prevent="run('publish')"><h1>{{ heading }}</h1>
 <p v-if="!mounted||!auth.isLoggedIn" class="hint">请先登录。</p>
 <p v-else-if="editId" role="status">旧接口缺少完整的本人文章编辑JSON，不能用公开正文补齐打赏、匿名和专栏设置。当前v1模式暂不提供已有文章编辑，v3编辑功能保留。</p>
 <template v-else>
  <p class="hint">旧版发帖与云草稿。草稿列表最多显示最近50份，不代表全部草稿。发布权限、积分和审核由服务端判断。</p>
  <p v-if="store.pending" role="status">上次操作结果未确认，请先核对文章或刷新草稿；已锁定新提交，刷新页面会丢失本机锁定。</p><p v-if="store.error||error" role="alert">{{ store.error||error }}</p>
  <p v-if="store.receipt" role="status">{{ store.receipt.op==='publish'?'文章已发布':store.receipt.op==='draft-save'?'草稿保存已确认':'草稿删除已确认' }}。<RouterLink v-if="store.receipt.op==='publish'" :to="'/article/'+store.receipt.id">查看文章</RouterLink> {{ store.receipt.warning }}</p>
  <section class="drafts"><h2>最近草稿</h2><button type="button" :aria-disabled="listLoading" @click="loadList">刷新草稿列表</button><p v-if="listLoading" role="status">正在读取草稿…</p><p v-if="listError" role="alert">{{ listError }}</p><p v-if="!listLoading&&!listError&&!drafts.length">最近列表没有草稿。</p>
   <div v-for="d in drafts" :key="d.id"><button type="button" class="ghost" :aria-disabled="locked" @click="loadDraft(d.id)">{{ d.title||'无标题' }}</button><button type="button" class="ghost" :aria-disabled="locked" @click="run('draft-delete',d.id)">删除草稿 {{ d.id }}</button><button type="button" class="ghost" @click="peekDraft(d.id)">查看云端草稿 {{ d.id }}</button></div>
  </section>
  <p v-if="previewLoading" role="status">正在读取云端草稿…</p><p v-if="previewError" role="alert">{{ previewError }}</p>
  <section v-if="preview" class="cloud-preview"><h2>云端草稿 {{ preview.id }}（仅核对，不替换当前输入）</h2><p>{{ preview.title }} · 标签：{{ preview.tags }}</p><textarea :value="preview.content" aria-label="当前云端草稿正文" rows="5" readonly /><textarea v-if="preview.rewardContent" :value="preview.rewardContent" aria-label="当前云端草稿打赏正文" rows="3" readonly /><textarea v-if="preview.thoughtContent" :value="preview.thoughtContent" aria-label="当前云端草稿思绪记录" rows="3" readonly /><button type="button" class="ghost" @click="preview=null">关闭草稿预览</button></section>
  <p v-if="sourceLoading" role="status">正在载入草稿…</p><p v-if="sourceError" role="alert">{{ sourceError }} <button type="button" @click="loadDraft(sourceTarget,true)">重试草稿</button></p>
  <fieldset :disabled="locked||!!sourceError||!!publishedId" class="legacy-fields">
   <input v-model="form.title" class="title-input" maxlength="255" placeholder="标题" aria-label="标题" />
   <label class="inline-field">文章类型<select v-model.number="form.type"><option v-for="t in types" :key="t.value" :value="t.value">{{ t.label }}</option><option v-if="form.type===3||form.type===4" :value="form.type">历史类型 {{ form.type }}（可保存草稿）</option></select></label>
   <textarea v-if="form.type===3" v-model="form.content" aria-label="思绪回放记录" rows="10" /><MarkdownEditor v-else ref="editor" v-model="form.content" :height="420" :api-key="auth.apiKey" outline placeholder="支持Markdown，可粘贴图片" />
   <TagInput v-model="form.tags" />
   <section v-if="form.type===6" class="column-form"><p class="type-tip">专栏：选择或填写已有专栏ID，或留空ID并填写名称新建专栏。</p><AuthorColumnPicker :model-value="form.columnId" :current-title="form.columnTitle" :disabled="locked||!!sourceError||!!publishedId" @select="form.columnId=$event.id;form.columnTitle=$event.title" /><label class="inline-field">已有专栏ID<input v-model="form.columnId" inputmode="numeric" maxlength="19" placeholder="留空可新建专栏" /></label><label class="inline-field">新专栏名称<input v-model="form.columnTitle" maxlength="64" placeholder="仅新建专栏时使用" :disabled="!!form.columnId" /></label><label class="inline-field">章节号<input v-model="form.chapterNo" inputmode="numeric" maxlength="32" placeholder="留空自动安排" /></label><label class="inline-field">封面地址<input v-model="form.columnCoverURL" maxlength="1024" placeholder="可选HTTPS图片地址" /></label></section>
   <label v-if="form.type===5" class="inline-field">悬赏积分<input v-model.number="form.qnaOfferPoint" type="number" min="20" /></label>
   <section class="reward"><label class="inline-field">打赏积分<input v-model.number="form.rewardPoint" type="number" min="0" /></label><template v-if="form.rewardPoint>0||form.rewardContent"><p class="type-tip">打赏后可见内容；取消时将积分及内容都清空。</p><MarkdownEditor ref="rewardEditor" v-model="form.rewardContent" :height="180" :api-key="auth.apiKey" /></template></section>
   <section class="settings"><label class="inline-field">创作声明<select v-model.number="form.statement"><option :value="0">无声明</option><option :value="1">包含AI辅助创作</option><option :value="2">包含剧透</option><option :value="3">虚构演绎，仅供娱乐</option></select></label><label class="check"><input v-model="form.anonymous" type="checkbox" />匿名</label><label class="check"><input v-model="form.commentable" type="checkbox" />允许回帖</label><label class="check"><input v-model="form.notifyFollowers" type="checkbox" />通知关注者</label><label class="check"><input :checked="form.showInList===1" type="checkbox" @change="form.showInList=($event.target as HTMLInputElement).checked?1:0" />在列表展示</label></section>
  </fieldset>
  <div class="tools"><button type="button" class="ghost" :aria-disabled="locked||!!sourceError||!!publishedId" @click="!publishedId&&run('draft-save',draftId)">存草稿</button><button type="submit" :aria-disabled="locked||!!sourceError||!!publishedId">{{ store.busy?'提交中…':'发布' }}</button></div>
 </template></form>
</template>
<style scoped lang="scss" src="./post-form.scss"></style>
<style scoped>.legacy-fields{display:flex;flex-direction:column;gap:14px;border:0;padding:0;margin:0;min-width:0}.legacy-fields:disabled{opacity:.65}.cloud-preview{display:flex;flex-direction:column;gap:8px;min-width:0}.cloud-preview h2{font-size:14px;margin:0}</style>

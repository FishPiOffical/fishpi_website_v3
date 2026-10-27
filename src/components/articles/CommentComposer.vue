<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { readV3CommentSource, type CommentInput } from '@/api/v3-comments'
import { useAuthStore } from '@/stores/auth'
import { useV3CommentsStore } from '@/stores/v3Comments'
import ChatComposer from '@/components/ChatComposer.vue'
const props=withDefaults(defineProps<{articleId:string;editId?:string;parentId?:string;paragraphId?:string;replyLabel?:string}>(),{editId:'',parentId:'',paragraphId:'',replyLabel:''})
const emit=defineEmits<{cancel:[];saved:[];clearReply:[]}>()
const {accessToken,account}=storeToRefs(useAuthStore()),operations=useV3CommentsStore(),mounted=ref(false),draft=ref(''),anonymous=ref(false),visible=ref(false),editVisibility=ref('preserve'),sourceLoading=ref(false),sourceReady=ref(false),localError=ref('')
const editor=ref<InstanceType<typeof ChatComposer>|null>(null),origin=Symbol('comment-composer')
const ready=computed(()=>mounted.value&&!!accessToken.value&&!!account.value),locked=computed(()=>operations.busy||operations.confirming||!!operations.pending||sourceLoading.value)
const applicable=computed(()=>operations.pending?.articleId===props.articleId)
let sequence=0,boundary='',submitted:{key:string;draft:string}|null=null
function identity(){return `${getAuthContextVersion()}:${!!accessToken.value}:${account.value?.oId||''}:${props.articleId}:${props.editId}`}
function clear(){sequence++;operations.cancelConfirmation(origin);draft.value='';anonymous.value=false;visible.value=false;editVisibility.value='preserve';localError.value='';sourceLoading.value=false;sourceReady.value=false;submitted=null}
async function source(){if(!ready.value||!props.editId)return;const current=++sequence,reader=identity();sourceLoading.value=true;sourceReady.value=false;localError.value='';draft.value='';try{const text=await readV3CommentSource(props.editId,props.articleId);if(mounted.value&&reader===identity()&&current===sequence){draft.value=text;sourceReady.value=true}}catch(err){if(mounted.value&&reader===identity()&&current===sequence)localError.value=err instanceof Error?err.message:'原文读取失败'}finally{if(mounted.value&&reader===identity()&&current===sequence)sourceLoading.value=false}}
async function save(){if(!ready.value||locked.value||props.editId&&!sourceReady.value)return;const reader=identity();localError.value='';const input:CommentInput={content:draft.value};if(props.editId){if(editVisibility.value!=='preserve')input.visible=editVisibility.value==='author'}else{input.anonymous=anonymous.value;input.visible=visible.value;if(props.parentId)input.parentId=props.parentId;if(props.paragraphId)input.paragraphId=props.paragraphId}try{await operations.save(props.articleId,input,props.editId,origin)}catch(err){if(mounted.value&&reader===identity())localError.value=err instanceof Error?err.message:'评论参数不合法'}}
watch([accessToken,()=>account.value?.oId,()=>props.articleId,()=>props.editId],()=>{const next=identity();if(next===boundary)return;boundary=next;clear();void source()},{flush:'sync'})
watch([()=>props.parentId,()=>props.paragraphId],()=>operations.cancelConfirmation(origin),{flush:'sync'})
watch(()=>operations.pending,command=>{if(command&&command.articleId===props.articleId&&command.operation!=='delete'&&command.id===props.editId&&command.input.content===draft.value)submitted={key:command.key,draft:draft.value}},{flush:'sync'})
watch(()=>operations.completed,command=>{if(command&&submitted?.key===command.key){if(draft.value===submitted.draft)draft.value='';submitted=null;emit('saved')}},{flush:'sync'})
onMounted(()=>{mounted.value=true;boundary=identity();void source()})
onBeforeUnmount(()=>{mounted.value=false;clear()})
defineExpose({reveal:()=>editor.value?.reveal()})
</script>
<template>
  <div class="comment-composer">
    <p v-if="!ready">正在准备评论…</p>
    <template v-else>
      <template v-if="operations.pending"><p>上次{{ operations.pending.operation==='delete'?'删除':operations.pending.operation==='update'?'编辑':'发布' }}评论结果待确认，所属文章 {{ operations.pending.articleId }}。请恢复同一次操作。</p><p v-if="operations.pending.input.content" class="pending-content">{{ operations.pending.input.content }}</p><button type="button" :disabled="operations.busy" @click="operations.retry()">{{ operations.busy?'正在确认…':'恢复本次评论操作' }}</button><p v-if="!applicable">恢复成功后请返回原文章核对，当前文章不会套用原结果。</p></template>
      <template v-else-if="editId&&!sourceReady"><p v-if="sourceLoading">正在读取评论原文…</p><button v-else type="button" @click="source()">重读评论原文</button></template>
      <template v-else>
        <p v-if="parentId">回复 {{ replyLabel || `评论 ${parentId}` }}<button type="button" :disabled="locked" @click="emit('clearReply')">取消回复</button></p>
        <p v-else-if="paragraphId">发表当前段落的独立段评</p>
        <ChatComposer ref="editor" v-model="draft" :disabled="locked" :sending="operations.busy" :allow-empty="true" :height="180" :submit-text="editId?'保存修改':'发表评论'" placeholder="Markdown评论，最多4096个UTF-16字符" @submit="save" />
        <div class="options">
          <template v-if="!editId"><label><input v-model="anonymous" type="checkbox" :disabled="locked" />匿名（需相应权限）</label><label><input v-model="visible" type="checkbox" :disabled="locked" />仅楼主及本人可见</label></template>
          <label v-else>可见范围<select v-model="editVisibility" :disabled="locked"><option value="preserve">保持现有范围</option><option value="all">公开</option><option value="author">仅楼主及本人</option></select></label>
          <span>{{ draft.length }} / 4096</span>
        </div>
      </template>
      <button v-if="editId" type="button" :disabled="operations.busy" @click="emit('cancel')">取消编辑</button>
      <p v-if="localError||operations.error" role="alert">{{ localError||operations.error }}</p><p v-if="operations.message" role="status">{{ operations.message }}</p>
      <p v-if="operations.receipt" role="status">已确认评论编号 {{ operations.receipt.id }}（文章 {{ operations.receipt.articleId }}）。<span v-if="operations.receipt.operation==='create'">新回复可能位于其他页，请通过分页查看。</span></p>
      <p>发布、匿名资格、编辑费用和五分钟规则由平台在提交时校验；整页刷新或退出会清除本地恢复信息，请先核对原操作。</p>
    </template>
  </div>
</template>
<style scoped lang="scss">
.comment-composer { min-width: 0; max-width: 100%; p { overflow-wrap: anywhere; } .pending-content { white-space: pre-wrap; } .options { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 8px 0; } button,select { color: var(--fp-text); background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 6px; padding: 6px 9px; margin: 4px; } button:disabled { opacity: .5; } [role='alert'] { color: #c34a36; } }
</style>

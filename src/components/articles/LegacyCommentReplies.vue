<script setup lang="ts">
import { computed,onMounted,onScopeDispose,ref,watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { legacyCommentReplies } from '@/api/legacy/long-reading'
import type { ArticleComment } from '@/api/fishpi'
import V3ReactionBar from '@/components/V3ReactionBar.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import ImageLightbox from '@/components/ImageLightbox.vue'
import VipNickname from '@/components/user/VipNickname.vue'
const props=withDefaults(defineProps<{articleId:string;rootId:string;paragraphId?:string;writable?:boolean;revision?:number}>(),{paragraphId:'',writable:false,revision:0})
const emit=defineEmits<{reply:[comment:ArticleComment]}>(),auth=useAuthStore(),mounted=ref(false),open=ref(false),loading=ref(false),error=ref(''),list=ref<ArticleComment[]>([]),page=ref(1),pageCount=ref(0),total=ref<number|null>(null)
const zoomed=ref('')
function onBodyClick(event:MouseEvent){const img=(event.target as HTMLElement|null)?.closest('img');if(img&&!img.classList.contains('emoji')&&!img.closest('a'))zoomed.value=img.currentSrc||img.src}
const canReply=computed(()=>props.writable&&!!auth.apiKey&&!!auth.account?.oId)
const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId,props.articleId,props.rootId,props.paragraphId]);let sequence=0,controller:AbortController|null=null
function clear(){zoomed.value='';sequence++;controller?.abort();controller=null;loading.value=false;list.value=[];error.value='';total.value=null;pageCount.value=0;page.value=1}
async function load(p=page.value){
 if(!mounted.value||!open.value)return
 controller?.abort();const abort=new AbortController();controller=abort;const reader=identity(),run=++sequence
 page.value=p;list.value=[];total.value=null;loading.value=true;error.value=''
 const valid=()=>mounted.value&&open.value&&!abort.signal.aborted&&reader===identity()&&run===sequence
 try{const result=await legacyCommentReplies(props.articleId,props.rootId,props.paragraphId,p,abort.signal);if(valid()){list.value=result.list;pageCount.value=result.pagination.pageCount;total.value=result.pagination.total}}
 catch(failure){if(valid())error.value=failure instanceof Error?failure.message:'回复读取失败'}
 finally{if(valid()){loading.value=false;if(controller===abort)controller=null}}
}
function toggle(){if(open.value){open.value=false;clear()}else{open.value=true;void load(1)}}
watch(identity,()=>{clear();if(open.value)void load(1)},{flush:'sync'})
watch(()=>props.revision,()=>{if(open.value){clear();void load(1)}},{flush:'sync'})
onMounted(()=>{mounted.value=true})
onScopeDispose(()=>{mounted.value=false;clear()})
</script>
<template><section class="legacy-replies"><button type="button" :aria-expanded="open" @click="toggle">{{ open?'收起回复':'查看全部回复' }}</button><template v-if="open"><p v-if="loading" role="status">正在读取回复…</p><p v-if="error" role="alert">{{ error }} <button type="button" @click="load(page)">重试本页回复</button><button v-if="page>1" type="button" @click="load(1)">返回首屏回复</button></p><template v-if="!loading&&!error"><p v-if="!list.length">暂无回复。</p><p v-else>共 {{ total }} 条回复 · 第 {{ page }} 页</p><article v-for="reply in list" :id="'comment'+reply.oId" :key="reply.oId" class="legacy-reply"><header><RouterLink v-if="reply.commentAuthorId" :to="'/member/'+reply.commentAuthorName"><VipNickname :user-id="reply.commentAuthorId" :user-name="reply.commentAuthorName" :text="reply.commentAuthorNickname||reply.commentAuthorName" /></RouterLink><span v-else>匿名用户</span><time>{{ reply.commentCreateTimeStr }}</time></header><small v-if="reply.commentOriginalCommentId!==rootId">回复评论 {{ reply.commentOriginalCommentId }}</small><div class="legacy-reply-body" v-html="reply.commentContent" @click="onBodyClick" /><div class="reply-actions"><V3ReactionBar kind="comment" :target-id="reply.oId" :source="{articleId,paragraphId,page:1}" /><button v-if="canReply" type="button" @click="canReply&&emit('reply',reply)">回复这条消息</button><ReportDialog v-if="auth.apiKey&&auth.account?.oId" :data-id="reply.oId" :data-type="1" /></div></article></template><nav v-if="pageCount>1||page>1" aria-label="楼中楼回复分页"><button type="button" :disabled="loading||page<=1" @click="!loading&&page>1&&load(page-1)">上一页回复</button><span>{{ page }}<template v-if="!error&&!loading"> / {{ pageCount }}</template></span><button type="button" :disabled="loading||page>=pageCount" @click="!loading&&page<pageCount&&load(page+1)">下一页回复</button></nav></template><ImageLightbox v-model="zoomed" /></section></template>
<style scoped lang="scss">.legacy-replies{min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:10px;overflow-wrap:anywhere}button{font:inherit;font-size:12px;padding:5px 9px;border:1px solid var(--fp-border);border-radius:6px;background:var(--fp-card);color:var(--fp-text);cursor:pointer}button:disabled{opacity:.5;cursor:default}p{margin:4px 0;font-size:12px}[role=alert]{color:#c34a36}.legacy-reply{width:100%;min-width:0;border-left:2px solid var(--fp-border);padding:8px 0 8px 12px;box-sizing:border-box}header,nav,.reply-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}header{font-size:12px}time,small{color:var(--fp-muted);font-size:11px}.legacy-reply-body{font-size:13px;line-height:1.65;:deep(img){max-width:100%;height:auto}:deep(pre){overflow-x:auto}:deep(p){margin:6px 0}}</style>

<script setup lang="ts">
import {computed,nextTick,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {useAuthStore} from '@/stores/auth'
import {getAuthContextVersion} from '@/api/http'
import {commentTarget,fetchCommentLocation,type CommentLocation} from '@/api/v3-comment-location'
import type {ArticleDetail} from '@/api/fishpi'
const props=defineProps<{articleId:string;article:ArticleDetail|null;commentPage:number}>()
const emit=defineEmits<{located:[location:CommentLocation];reset:[]}>(),route=useRoute(),auth=useAuthStore()
defineOptions({ render: () => null })
const location=ref<CommentLocation|null>(null)
let mounted=false,generation=0,abort:AbortController|null=null,scrolled=''
const binding=()=>JSON.stringify([props.articleId,route.query.comment,route.hash,getAuthContextVersion(),auth.accessToken,auth.account?.oId||''])
const requested=computed(()=>{
 try{return commentTarget(route.query.comment,route.hash)}catch{return ''}
})
async function read(){
 if(!mounted)return
 const current=++generation,owner=binding();abort?.abort();abort=null;location.value=null;scrolled='';emit('reset')
 const target=requested.value
 if(!target)return
 const controller=new AbortController();abort=controller
 try {
  const value=await fetchCommentLocation(target,props.articleId,controller.signal,true)
  if(mounted&&current===generation&&owner===binding()&&!controller.signal.aborted){location.value=value;emit('located',value)}
 } catch {
  // 自动定位只辅助跳转，失败时继续显示文章。
 }
}
async function scroll(){
 const value=location.value;if(!mounted||!value||value.type!==0||props.article?.oId!==value.articleId||props.commentPage!==value.page||props.article.pagination?.paginationCurrentPageNum!==value.page)return
 const current=generation,owner=binding();await nextTick()
 if(!mounted||current!==generation||owner!==binding())return
 const exists=props.article?.articleComments?.some(c=>c.oId===(value.thread?.rootId ?? value.id))
 if(!exists||value.thread?.replyPage)return
 const key=`${owner}:${value.page}:${value.id}`;if(scrolled===key)return
 const element=document.getElementById('comment'+value.id)
 if(element){element.scrollIntoView({block:'center'});scrolled=key}
}
watch(binding,()=>{void read()},{flush:'post'})
watch([location,()=>props.article,()=>props.commentPage],()=>{void scroll()},{flush:'post'})
onMounted(()=>{mounted=true;void read()})
onBeforeUnmount(()=>{mounted=false;generation++;abort?.abort();location.value=null})
</script>

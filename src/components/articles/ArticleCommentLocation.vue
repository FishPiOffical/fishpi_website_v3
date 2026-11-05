<script setup lang="ts">
import {computed,nextTick,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {useAuthStore} from '@/stores/auth'
import {getAuthContextVersion} from '@/api/http'
import {getApiMode} from '@/api/mode'
import {fetchLegacyCommentLocation} from '@/api/legacy/comment-location'
import {commentTarget,fetchCommentLocation,type CommentLocation} from '@/api/v3-comment-location'
import type {ArticleDetail} from '@/api/fishpi'
const props=defineProps<{articleId:string;article:ArticleDetail|null;commentPage:number}>()
const emit=defineEmits<{located:[location:CommentLocation];reset:[]}>(),route=useRoute(),auth=useAuthStore()
const location=ref<CommentLocation|null>(null),error=ref(''),loading=ref(false),placement=ref('')
let mounted=false,generation=0,abort:AbortController|null=null,scrolled=''
const binding=()=>JSON.stringify([props.articleId,route.query.comment,route.hash,getApiMode(),getAuthContextVersion(),getApiMode()==='v1'?auth.apiKey:auth.accessToken,auth.account?.oId||''])
const requested=computed(()=>{try{return{target:commentTarget(route.query.comment,route.hash),error:''}}catch(e){return{target:'',error:e instanceof Error?e.message:'评论定位参数不合法'}}})
async function read(){
 if(!mounted)return
 const current=++generation,owner=binding();abort?.abort();abort=null;location.value=null;error.value='';placement.value='';scrolled='';loading.value=false;emit('reset')
 if(requested.value.error){error.value=requested.value.error;return}if(!requested.value.target)return
 if(getApiMode()==='v1'&&!props.article){placement.value='等待当前文章加载后定位评论。';return}
 const controller=new AbortController();abort=controller;loading.value=true
 try{const value=getApiMode()==='v1'?await fetchLegacyCommentLocation(requested.value.target,props.articleId,props.article,controller.signal):await fetchCommentLocation(requested.value.target,props.articleId,controller.signal);if(mounted&&current===generation&&owner===binding()&&!controller.signal.aborted){location.value=value;emit('located',value)}}
 catch(e){if(mounted&&current===generation&&owner===binding()&&!controller.signal.aborted)error.value=e instanceof Error?e.message:'评论定位失败'}
 finally{if(mounted&&current===generation&&owner===binding())loading.value=false}
}
async function scroll(){
 const value=location.value;if(!mounted||!value||value.type!==0||props.article?.oId!==value.articleId||props.commentPage!==value.page||props.article.pagination?.paginationCurrentPageNum!==value.page)return
 const current=generation,owner=binding();await nextTick()
 if(!mounted||current!==generation||owner!==binding())return
 const exists=props.article?.articleComments?.some(c=>c.oId===value.id)
 if(!exists){placement.value='评论位置已变化或本页暂不可见，请重新定位。';return}
 const key=`${owner}:${value.page}:${value.id}`;if(scrolled===key)return
 const element=document.getElementById('comment'+value.id)
 if(element){element.scrollIntoView({block:'center'});scrolled=key;placement.value=''}
 else placement.value='评论当前无法在页面中定位，请重新定位。'
}
watch(binding,()=>{void read()},{flush:'post'})
watch(()=>getApiMode()==='v1'?props.article:null,()=>{void read()},{flush:'post'})
watch([location,()=>props.article,()=>props.commentPage],()=>{void scroll()},{flush:'post'})
onMounted(()=>{mounted=true;void read()})
onBeforeUnmount(()=>{mounted=false;generation++;abort?.abort();location.value=null})
</script>
<template><div v-if="requested.target||requested.error" class="comment-location" role="status"><span v-if="loading">正在定位评论…</span><span v-else-if="error">{{ error }}</span><span v-else-if="placement">{{ placement }}</span><span v-else-if="location">评论位置已读取。</span><button v-if="!loading" type="button" @click="read">重新定位评论</button></div></template>
<style scoped lang="scss">.comment-location{padding:8px 0;color:var(--fp-muted);font-size:13px;overflow-wrap:anywhere}button{margin-left:8px;color:var(--fp-text);background:var(--fp-card);border:1px solid var(--fp-border);border-radius:5px;padding:4px 8px}</style>

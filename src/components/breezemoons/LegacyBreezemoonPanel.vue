<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {useAuthStore} from '@/stores/auth'
import {useLegacyBreezemoonsStore} from '@/stores/legacyBreezemoons'
import {legacyMoonPage,type LegacyMoonPage} from '@/api/legacy/breezemoons'
import {getAuthContextVersion} from '@/api/http'
import {fpConfirm} from '@/composables/useDialog'
import BreezemoonList from './BreezemoonList.vue'
const props=withDefaults(defineProps<{size?:number;compact?:boolean;manage?:boolean}>(),{size:20,compact:false,manage:false})
const auth=useAuthStore(),writes=useLegacyBreezemoonsStore(),route=useRoute(),mounted=ref(false),value=ref<LegacyMoonPage|null>(null),page=ref(1),loading=ref(false),error=ref(''),notice=ref(''),editor=ref<{id:string;content:string}|null>(null)
const confirming=ref(false)
let generation=0,confirmation:AbortController|null=null
const content=computed({get:()=>editor.value?.content ?? writes.draft,set:(v:string)=>{if(editor.value)editor.value.content=v;else writes.draft=v}})
const locked=computed(()=>writes.busy||!!writes.uncertain||confirming.value)
function validIdentity(){const version=getAuthContextVersion(),key=auth.apiKey,owner=auth.account?.oId;return()=>mounted.value&&version===getAuthContextVersion()&&key===auth.apiKey&&owner===auth.account?.oId}
async function read(p=page.value) {
  if(!mounted.value)return
  const current=++generation,valid=validIdentity();page.value=p;value.value=null;loading.value=true;error.value=''
  try{const result=await legacyMoonPage(p,props.size);if(current===generation&&valid())value.value=result}
  catch(e){if(current===generation&&valid())error.value=e instanceof Error?e.message:'清风读取失败'}
  finally{if(current===generation&&valid())loading.value=false}
}
function edit(id:string){if(locked.value)return;const row=value.value?.list.find(x=>x.id===id);if(!row||row.author.id!==auth.account?.oId)return;editor.value={id,content:row.content}}
async function save(){if(locked.value||!auth.isLoggedIn)return;notice.value='';const valid=validIdentity();const draft=content.value,id=editor.value?.id || '';if(await writes.execute({kind:id?'update':'create',id,content:draft})&&valid())notice.value='操作成功。'}
async function remove(id:string){
  if(locked.value||!auth.isLoggedIn)return
  const row=value.value?.list.find(x=>x.id===id);if(!row||row.author.id!==auth.account?.oId)return
  const valid=validIdentity(),controller=new AbortController();confirmation=controller;confirming.value=true
  try {
    const accepted=await fpConfirm({title:'删除清风明月',message:'确定删除这条动态？删除后不可恢复。',confirmText:'删除',tone:'danger',signal:controller.signal})
    if(!accepted||!valid()||writes.busy||writes.uncertain)return
    if(await writes.execute({kind:'delete',id,content:''})&&valid())notice.value='删除操作成功。'
  } finally {if(confirmation===controller){confirmation=null;confirming.value=false}}

}
watch(()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId]),()=>{generation++;confirmation?.abort();confirmation=null;confirming.value=false;value.value=null;editor.value=null;notice.value='';if(mounted.value)void read(1)},{flush:'sync'})
watch(()=>writes.revision,()=>{if(!mounted.value||!writes.completed)return;const command=writes.completed;if(command.kind==='update'&&editor.value?.id===command.id&&editor.value.content===command.content)editor.value=null;void read(command.kind==='create'?1:page.value)})
onMounted(()=>{mounted.value=true;void read()})
onUnmounted(()=>{mounted.value=false;generation++;confirmation?.abort();confirmation=null})
</script>
<template>
  <section class="legacy-moon" :class="{compact}">
    <template v-if="mounted">
      <form v-if="auth.isLoggedIn" @submit.prevent="save"><label>{{editor?'编辑清风明月':'记录此刻'}}<textarea v-model="content" maxlength="512" :rows="compact?2:3" required :disabled="locked" placeholder="分享生活中的一刻…" /></label><div class="controls"><button :disabled="locked">{{writes.busy?'提交中…':editor?'保存修改':'发布'}}</button><button v-if="editor" type="button" :disabled="locked" @click="editor=null">取消编辑</button><span>{{content.length}} / 512</span></div></form>
      <RouterLink v-else :to="{path:'/login',query:{redirect:route.fullPath}}">登录后发布清风明月</RouterLink>
    </template>
    <p v-if="writes.error" role="alert">{{writes.error}}</p><div v-if="writes.uncertain" class="uncertain"><p>请核对列表或原站的当前结果。解除锁定不会再次发送请求。</p><button type="button" @click="read(1)">重新读取第一页</button><button type="button" @click="writes.release()">我已核对，解除锁定</button></div>
    <p v-if="notice" role="status">{{notice}}</p>
    <div class="controls"><button type="button" :disabled="loading" @click="read()">重新读取清风</button><span v-if="!compact">旧接口未提供总条数与总页数</span></div>
    <p v-if="!mounted||loading" role="status">正在读取清风明月…</p><div v-else-if="error" role="alert"><p>{{error}}</p><button @click="read()">重试本页</button></div>
    <template v-else-if="value"><BreezemoonList v-if="value.list.length" :items="value.list" :compact="compact"><template #actions="{item}"><template v-if="manage&&auth.isLoggedIn&&item.author.id===auth.account?.oId"><button :disabled="locked" @click="edit(item.id)">编辑</button><button :disabled="locked" @click="remove(item.id)">删除</button></template></template></BreezemoonList><p v-else>{{page===1?'暂无清风明月动态':'本页没有动态，可返回上一页。'}}</p><nav v-if="!compact" class="controls" aria-label="清风明月分页"><button :disabled="loading||page<=1" @click="read(page-1)">上一页</button><span>第 {{page}} 页</span><button :disabled="loading||!value.list.length||page>=1000000" @click="read(page+1)">读取下一页</button></nav></template>
  </section>
</template>
<style scoped>
.legacy-moon{min-width:0;padding:0 18px 18px}.legacy-moon > .controls{display:none}.compact{padding:0 4px;font-size:12px}.compact .controls{display:none}.compact form .controls{display:flex;margin:4px 0 6px}form,label{display:grid;gap:6px}textarea{width:100%;box-sizing:border-box;resize:vertical;padding:6px 8px;border:1px solid var(--fp-border);border-radius:6px;background:var(--fp-bg);color:var(--fp-text);font:inherit}.controls{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0}.controls span{font-size:12px;color:var(--fp-muted)}button{padding:4px 9px;border:1px solid var(--fp-border);border-radius:6px;background:var(--fp-card);color:var(--fp-text);cursor:pointer}button:disabled{opacity:.5;cursor:default}[role=alert]{color:#c34a36}p{overflow-wrap:anywhere}.uncertain{padding:12px;background:var(--fp-hover);border-radius:8px}.uncertain button{margin-right:8px}
</style>

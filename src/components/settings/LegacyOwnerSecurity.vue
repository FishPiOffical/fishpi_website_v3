<script setup lang="ts">
import { computed,onMounted,onScopeDispose,ref,watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion } from '@/api/http'
import { readLegacyMfa,prepareLegacyMfa,writeLegacyMfa,legacyMfaCode,type LegacyMfaPreparation } from '@/api/legacy/mfa'
import { fpConfirm } from '@/composables/useDialog'
const auth=useAuthStore(),router=useRouter(),mounted=ref(false),enabled=ref<boolean|null>(null),preparation=ref<LegacyMfaPreparation|null>(null),code=ref(''),loading=ref(false),busy=ref(false),error=ref('')
const blocked=computed(()=>loading.value||busy.value||enabled.value===null)
const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId])
let generation=0,sequence=0,controller:AbortController|null=null,confirmation:AbortController|null=null
function erase(){preparation.value=null;code.value=''}
function clear(){generation++;sequence++;controller?.abort();controller=null;confirmation?.abort();confirmation=null;erase();enabled.value=null;loading.value=busy.value=false;error.value=''}
function capture(){const owner=identity(),run=generation;return()=>mounted.value&&!!auth.apiKey&&!!auth.account?.oId&&identity()===owner&&generation===run}
async function load(){
 const valid=capture();if(!valid()||busy.value)return
 controller?.abort();const abort=new AbortController();controller=abort;const read=++sequence;enabled.value=null;loading.value=true;error.value='';erase()
 try{const current=await readLegacyMfa(abort.signal);if(valid()&&read===sequence)enabled.value=current}catch(failure){if(valid()&&read===sequence)error.value=failure instanceof Error?failure.message:'两步验证读取失败'}finally{if(valid()&&read===sequence){loading.value=false;if(controller===abort)controller=null}}
}
async function prepare(){
 const valid=capture();if(!valid()||blocked.value||enabled.value!==false||!auth.account?.oId)return
 const owner=auth.account.oId,abort=new AbortController();controller=abort;busy.value=true;error.value='';erase()
 try{const result=await prepareLegacyMfa(owner,abort.signal);if(valid())preparation.value=result}catch(failure){if(valid())error.value=failure instanceof Error?failure.message:'绑定资料准备失败'}finally{if(valid()){busy.value=false;if(controller===abort)controller=null}}
}
async function change(enable:boolean){
 const valid=capture();if(!valid()||blocked.value||enable&&(!preparation.value||enabled.value!==false)||!enable&&enabled.value!==true)return
 let value='';error.value=''
 try{if(enable)value=legacyMfaCode(code.value)}catch(failure){error.value=failure instanceof Error?failure.message:'验证码不正确';return}
 const original=preparation.value,approve=new AbortController();confirmation=approve;busy.value=true
 let accepted=false
 try{accepted=await fpConfirm({title:enable?'启用两步验证':'停用两步验证',message:enable?'请确认已在本地验证器保存密钥。提交成功或结果未确认后，将清除本机登录并要求重新登录核对；旧接口不保证其他设备授权失效。是否继续？':'停用后登录将不再要求验证器验证码。旧接口仅凭当前登录授权停用，不提供当前密码复核；提交后会清除本机登录并要求重新登录核对。是否继续？',confirmText:enable?'确认启用':'确认停用',signal:approve.signal})}
 catch(failure){if(valid())error.value=failure instanceof Error?failure.message:'确认未完成'}
 finally{if(confirmation===approve)confirmation=null}
 if(!accepted||approve.signal.aborted||!valid()||enable&&preparation.value!==original){if(valid())busy.value=false;return}
 const owner=identity(),ownerValid=()=>!!auth.apiKey&&!!auth.account?.oId&&identity()===owner,abort=new AbortController();controller=abort
 try{
  const current=await readLegacyMfa(abort.signal)
  if(!valid()){value='';return}
  if(current!==!enable){enabled.value=current;erase();error.value='两步验证状态已变化，尚未提交，请重新核对。';busy.value=false;value='';if(controller===abort)controller=null;return}
 }catch(failure){if(valid()){error.value=(failure instanceof Error?failure.message:'两步验证读取失败')+'。尚未提交，请先重读状态。';busy.value=false}value='';if(controller===abort)controller=null;return}
 erase();let reason='legacy-security-updated'
 try{await writeLegacyMfa(enable,value,abort.signal)}catch{reason='legacy-security-unconfirmed'}
 finally{value='';if(controller===abort)controller=null}
 // Even after leaving this view, a sent security command must invalidate this same local login.
 if(!ownerValid())return
 const navigate=valid();erase();await auth.logout()
 if(navigate)try{await router.replace({path:'/login',query:{redirect:'/settings/account',reason}})}catch{/* Login is already cleared; never resubmit the security command after navigation failure. */}
}
watch(identity,()=>{clear();if(mounted.value)void load()},{flush:'sync'})
onMounted(()=>{mounted.value=true;void load()})
onScopeDispose(()=>{mounted.value=false;clear()})
</script>
<template><section class="owner-security"><h2>账号安全</h2><p class="hint">旧模式目前支持两步验证。修改密码、手机及邮箱仍缺少可直接使用apiKey的完整协议。</p><h3>两步验证</h3><p v-if="loading" role="status">正在读取两步验证状态…</p><p v-else-if="enabled!==null" role="status">{{ enabled?'已启用两步验证':'未启用两步验证' }}</p><button type="button" :disabled="loading||busy" @click="load">重新读取两步验证状态</button><button v-if="enabled===false" type="button" :disabled="blocked" @click="prepare">准备验证器密钥</button><button v-if="enabled===true" type="button" :disabled="blocked" @click="change(false)">确认停用两步验证</button>
 <template v-if="preparation"><p class="hint">在本地验证器手动录入下列密钥。绑定资料仅保存在当前页面，离页或换号会清除；旧服务没有返回到期时间，缓存可能被服务端淘汰，请以提交结果为准。</p><label>验证器手动密钥<input :value="preparation.secret" aria-label="旧验证器手动密钥" readonly autocomplete="off" spellcheck="false" /></label><label>本地绑定URI<textarea :value="preparation.otpauthUri" aria-label="旧验证器本地绑定URI" readonly spellcheck="false" /></label><label>新验证器验证码<input v-model="code" aria-label="旧新验证器验证码" inputmode="numeric" autocomplete="one-time-code" maxlength="6" :disabled="busy" /></label><button type="button" :disabled="blocked" @click="change(true)">确认启用两步验证</button></template>
 <p v-if="error" role="alert" class="error">{{ error }}</p><p class="hint">旧接口没有幂等恢复；提交失败也可能是服务异常，不能自动重复提交。提交后请重新登录核实。本页不会加载第三方二维码图片。</p></section></template>
<style scoped lang="scss" src="./owner-security.scss"></style>

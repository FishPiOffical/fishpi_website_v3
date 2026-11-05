<script setup lang="ts">
import { nextTick, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { accountCode, referralName } from '@/api/v3-account-access'
import { passwordDigest } from '@/api/v3-security'
import { completeLegacyRegistration, legacyRegistrationInput, requestLegacyRegistration, type LegacyRegistrationInput } from '@/api/legacy/registration'
import { FISHPI_GEETEST_ID, useGeetest4 } from '@/composables/useGeetest4'
import { useAuthStore } from '@/stores/auth'
const auth=useAuthStore(),route=useRoute(),stage=ref<'request'|'verify'|'done'|'uncertain'>('request')
const userName=ref(''),phone=ref(''),invitecode=ref(''),referral=ref(''),role=ref(0),code=ref(''),password=ref(''),repeat=ref(''),agreed=ref(false)
const busy=ref(false),checking=ref(false),error=ref(''),notice=ref(''),captchaEl=ref<HTMLElement|null>(null),snapshot=ref<LegacyRegistrationInput|null>(null)
const captcha=useGeetest4(captchaEl,proof=>{void send(proof)})
let mounted=false,sequence=0,controller:AbortController|null=null
const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId])
function erase(){code.value=password.value=repeat.value='';captcha.destroy();checking.value=false}
function clear(){sequence++;controller?.abort();controller=null;busy.value=false;erase();userName.value=phone.value=invitecode.value=referral.value='';snapshot.value=null;agreed.value=false}
function cancel(){if(busy.value)return;sequence++;checking.value=false;captcha.destroy();snapshot.value=null}
async function prepare(){
 if(!mounted||busy.value||checking.value||!agreed.value)return
 const actor=identity(),run=++sequence;error.value=notice.value=''
 try{snapshot.value=legacyRegistrationInput({userName:userName.value,userPhone:phone.value,invitecode:invitecode.value,referral:referral.value,userAppRole:role.value});checking.value=true;await nextTick();if(!mounted||actor!==identity()||run!==sequence)return
  const id=import.meta.env.VITE_LEGACY_GEETEST_ID||FISHPI_GEETEST_ID;if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw new Error('旧版人机验证配置不正确，请联系站点维护者。')
  await captcha.mount('float',id);if(mounted&&actor===identity()&&run===sequence&&captcha.error.value){error.value=captcha.error.value;checking.value=false}
 }catch(e){if(mounted&&actor===identity()&&run===sequence){error.value=e instanceof Error?e.message:'无法启动注册验证';checking.value=false;captcha.destroy()}}
}
async function send(proof:unknown){
 if(!mounted||busy.value||!checking.value||!snapshot.value||!agreed.value)return
 const input={...snapshot.value},actor=identity(),run=++sequence,abort=new AbortController();controller=abort;busy.value=true;error.value=''
 const current=()=>mounted&&actor===identity()&&run===sequence
 try{await requestLegacyRegistration(input,proof,abort.signal);if(current()){stage.value='verify';notice.value='注册短信已申请，请收到验证码后继续。'}}
 catch(e){if(current()){stage.value='verify';notice.value='注册申请未确认，可能已创建待激活账号。若收到短信可继续；不要立即重复申请。';error.value=e instanceof Error?e.message:'注册申请失败'}}
 finally{if(current()){busy.value=false;checking.value=false;controller=null;captcha.destroy()}}
}
function resume(){if(busy.value||checking.value)return;try{referral.value=referralName(referral.value);snapshot.value=null;stage.value='verify';error.value='';notice.value='将按短信验证码激活对应账号，请核对邀请人及角色。'}catch(e){error.value=e instanceof Error?e.message:'邀请人不合法'}}
async function complete(){
 if(!mounted||busy.value||stage.value!=='verify'||!agreed.value)return
 error.value=notice.value=''
 try{accountCode(code.value);passwordDigest(password.value);if(password.value!==repeat.value)throw new Error('两次输入的密码不一致');referralName(snapshot.value?.referral??referral.value);if(role.value!==0&&role.value!==1)throw new Error('请选择有效角色')}catch(e){error.value=e instanceof Error?e.message:'请检查输入';return}
 const sms=code.value,secret=password.value,referrer=snapshot.value?.referral??referral.value,selectedRole=role.value,actor=identity(),run=++sequence,abort=new AbortController();controller=abort;busy.value=true;erase()
 const current=()=>mounted&&actor===identity()&&run===sequence
 try{await completeLegacyRegistration(sms,secret,selectedRole,referrer,abort.signal);if(current()){stage.value='done';notice.value='注册已完成，请登录新账号。';clear();void auth.logout()}}
 catch(e){if(current()){erase();if(e instanceof ApiError&&e.code==='legacy_registration_unknown'){stage.value='uncertain';notice.value=e.message;clear();void auth.logout()}else error.value=e instanceof Error?e.message:'注册预检失败，请重新填写验证码和密码。'}}
 finally{if(current()){busy.value=false;controller=null}}
}
function restart(){if(busy.value)return;clear();stage.value='request';error.value=notice.value=''}
watch(identity,()=>{clear();error.value='';if(stage.value!=='done'&&stage.value!=='uncertain'){stage.value='request';notice.value='登录状态已变化，请重新填写。'}},{flush:'sync'})
onMounted(()=>{mounted=true;const name=route.query.referral??route.query.r;if(typeof name==='string')try{referral.value=referralName(name)}catch{error.value='邀请链接中的用户名不合法'}})
onScopeDispose(()=>{mounted=false;clear()})
</script>
<template>
 <section class="legacy-registration">
  <h1>注册</h1><p>注册开放状态、邀请码要求及账号资格由平台在提交时校验。</p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <form v-if="stage==='request'" @submit.prevent="prepare"><fieldset :disabled="busy||checking"><label>用户名<input v-model="userName" autocomplete="username" maxlength="64" required /></label><p>1至64位英文字母、数字或连字符；保留名由平台校验。</p><label>手机号码<input v-model="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="11" required /></label><label>邀请人用户名（可选）<input v-model="referral" maxlength="64" /></label><label>邀请码（按平台要求提供）<input v-model="invitecode" maxlength="16" /></label><button :disabled="!agreed">验证并申请注册短信</button><button type="button" @click="resume">已收到验证码，继续注册</button></fieldset></form>
  <div v-if="checking"><p>请完成人机验证以申请注册短信。</p><div ref="captchaEl" /><p v-if="captcha.error.value" role="alert">{{ captcha.error.value }}</p><button type="button" :disabled="busy" @click="cancel">取消验证</button></div>
  <template v-if="stage==='verify'">
   <p v-if="snapshot">账号：{{ snapshot.userName }}；手机号：{{ snapshot.userPhone }}。邀请人：{{ snapshot.referral||'未填写' }}。</p>
   <form @submit.prevent="complete"><fieldset :disabled="busy"><label v-if="!snapshot">邀请人用户名（可选）<input v-model="referral" maxlength="64" /></label><label>短信验证码<input v-model="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required /></label><label>密码<input v-model="password" type="password" autocomplete="new-password" minlength="6" maxlength="128" required /></label><label>确认密码<input v-model="repeat" type="password" autocomplete="new-password" minlength="6" maxlength="128" required /></label><label>角色<select v-model.number="role"><option :value="0">程序员</option><option :value="1">设计师</option></select></label><p>密码6至128个字符，保留首尾空白，不含控制字符。</p><button :disabled="!agreed">{{ busy?'正在提交…':'完成注册' }}</button></fieldset></form>
  </template>
  <label v-if="stage==='request'||stage==='verify'" class="agreement"><input v-model="agreed" type="checkbox" :disabled="busy||checking" /><span>我已阅读并同意 <RouterLink to="/agreement" target="_blank">用户协议</RouterLink> 和 <RouterLink to="/privacy" target="_blank">隐私政策</RouterLink></span></label>
  <p v-if="error" role="alert">{{ error }}</p><button v-if="stage==='verify'||stage==='uncertain'" type="button" :disabled="busy" @click="restart">重新填写注册资料</button>
  <nav><RouterLink to="/login">前往登录</RouterLink><RouterLink to="/forget-pwd">找回密码</RouterLink></nav>
 </section>
</template>
<style scoped>
.legacy-registration{max-width:440px;margin:32px auto;padding:24px;background:var(--fp-card);border:1px solid var(--fp-border);border-radius:10px;overflow-wrap:anywhere}h1{font-size:23px}p{font-size:14px;color:var(--fp-muted);line-height:1.7}fieldset{border:0;padding:0;display:grid;gap:12px;min-width:0}label{display:grid;gap:8px;margin:8px 0}input,select,button{box-sizing:border-box;font:inherit;padding:9px 12px;border:1px solid var(--fp-border);border-radius:6px;color:var(--fp-text);background:var(--fp-bg);min-width:0;max-width:100%}button{margin:8px 8px 8px 0;cursor:pointer}button:disabled{opacity:.5;cursor:default}[role=alert]{color:#bd503c}.agreement{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.7}.agreement input{margin-top:5px}nav{display:flex;gap:12px;margin-top:16px}@media(max-width:600px){.legacy-registration{margin:16px 12px;padding:18px}}
</style>

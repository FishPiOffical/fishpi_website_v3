<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { accountCode, accountPhone } from '@/api/v3-account-access'
import { passwordDigest } from '@/api/v3-security'
import { requestLegacyPasswordReset, resetLegacyPassword } from '@/api/legacy/password-reset'
import { FISHPI_GEETEST_ID, useGeetest4 } from '@/composables/useGeetest4'
import { useAuthStore } from '@/stores/auth'
const props = defineProps<{receivedCode?:boolean}>(), auth = useAuthStore()
const phone=ref(''), code=ref(''), password=ref(''), repeat=ref(''), busy=ref(false), checking=ref(false), error=ref(''), notice=ref(''), stage=ref<'request'|'reset'|'done'|'uncertain'>(props.receivedCode?'reset':'request'), captchaEl=ref<HTMLElement|null>(null)
const captcha=useGeetest4(captchaEl,value=>{void send(value)}), title=computed(()=>stage.value==='request'?'找回密码':'重置密码')
let mounted=false, sequence=0, controller:AbortController|null=null, targetPhone=''
const identity=()=>JSON.stringify([getAuthContextVersion(),auth.apiKey,auth.account?.oId])
function erase(){code.value=password.value=repeat.value='';targetPhone='';captcha.destroy();checking.value=false}
function cancel(){if(busy.value)return;sequence++;controller?.abort();controller=null;captcha.destroy();checking.value=false;targetPhone=''}
async function prepare(){
 if(!mounted||busy.value||checking.value)return
 error.value=notice.value='';const run=++sequence,actor=identity()
 try{targetPhone=accountPhone(phone.value);checking.value=true;await nextTick();if(!mounted||run!==sequence||actor!==identity())return
  const id=import.meta.env.VITE_LEGACY_GEETEST_ID||FISHPI_GEETEST_ID
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id))throw new Error('旧版人机验证配置不正确，请联系站点维护者。')
  await captcha.mount('float',id);if(mounted&&run===sequence&&actor===identity()&&captcha.error.value){error.value=captcha.error.value;checking.value=false}
 }catch(e){if(mounted&&run===sequence&&actor===identity()){error.value=e instanceof Error?e.message:'无法启动人机验证';checking.value=false;captcha.destroy()}}
}
async function send(proof:unknown){
 if(!mounted||busy.value||!checking.value||!targetPhone)return
 const actor=identity(),run=++sequence,abort=new AbortController(),target=targetPhone;controller=abort;busy.value=true;error.value=''
 const current=()=>mounted&&actor===identity()&&run===sequence
 try{await requestLegacyPasswordReset(target,proof,abort.signal);if(current()){stage.value='reset';notice.value='验证码已申请，请收到短信后填写。'}}
 catch(e){if(current()){stage.value='reset';notice.value='短信申请未确认。若已收到验证码可继续；未收到请稍后手动重新申请，不会自动重发。';error.value=e instanceof Error?e.message:'短信申请失败'}}
 finally{if(current()){busy.value=false;checking.value=false;controller=null;captcha.destroy()}}
}
async function complete(){
 if(!mounted||busy.value||stage.value!=='reset')return
 error.value=notice.value=''
 try{accountCode(code.value);passwordDigest(password.value);if(password.value!==repeat.value)throw new Error('两次输入的新密码不一致')}catch(e){error.value=e instanceof Error?e.message:'请检查输入';return}
 const sms=code.value,secret=password.value,actor=identity(),run=++sequence,abort=new AbortController();controller=abort;busy.value=true;code.value=password.value=repeat.value=''
 const current=()=>mounted&&actor===identity()&&run===sequence
 try{await resetLegacyPassword(sms,secret,abort.signal);if(current()){erase();stage.value='done';notice.value='密码已重置，请重新登录。';void auth.logout()}}
 catch(e){if(current()){erase();if(e instanceof ApiError&&e.code==='legacy_reset_unknown'){stage.value='uncertain';notice.value=e.message;void auth.logout()}else error.value=e instanceof Error?e.message:'重置预检失败，请重新填写验证码和新密码。'}}
 finally{if(current()){busy.value=false;controller=null}}
}
function restart(){if(busy.value)return;cancel();erase();stage.value='request';phone.value='';error.value=notice.value=''}
watch(identity,()=>{sequence++;controller?.abort();controller=null;busy.value=false;phone.value='';erase();error.value='';if(stage.value!=='done'&&stage.value!=='uncertain'){stage.value=props.receivedCode?'reset':'request';notice.value='登录状态已变化，请重新填写。'}},{flush:'sync'})
onMounted(()=>{mounted=true});onScopeDispose(()=>{mounted=false;sequence++;controller?.abort();erase();phone.value=''})
</script>
<template>
 <section class="legacy-reset">
  <h1>{{ title }}</h1>
  <p>使用账号绑定的手机号找回密码。验证码和新密码仅用于本次操作，不会自动重试。</p>
  <p v-if="notice" role="status">{{ notice }}</p>
  <template v-if="stage==='request'">
   <form @submit.prevent="prepare"><label>绑定的手机号<input v-model="phone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="11" :disabled="busy||checking" required /></label><button :disabled="busy||checking">验证并申请短信</button></form>
   <div v-if="checking"><p>请完成人机验证以申请短信。</p><div ref="captchaEl" /><p v-if="captcha.error.value" role="alert">{{ captcha.error.value }}</p><button type="button" :disabled="busy" @click="cancel">取消验证</button></div>
   <RouterLink to="/reset-pwd">已收到短信验证码</RouterLink>
  </template>
  <form v-if="stage==='reset'" @submit.prevent="complete">
   <fieldset :disabled="busy"><label>短信验证码<input v-model="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required /></label><label>新密码<input v-model="password" type="password" autocomplete="new-password" minlength="6" maxlength="128" required /></label><label>确认新密码<input v-model="repeat" type="password" autocomplete="new-password" minlength="6" maxlength="128" required /></label><p>密码6至128个字符，保留首尾空白，不含控制字符。</p><button>{{ busy?'正在提交…':'确认重置密码' }}</button></fieldset>
  </form>
  <p v-if="error" role="alert">{{ error }}</p>
  <button v-if="stage==='reset'||stage==='uncertain'" type="button" :disabled="busy" @click="restart">重新申请验证码</button>
  <nav><RouterLink to="/login">前往登录</RouterLink><RouterLink to="/register">注册</RouterLink></nav>
 </section>
</template>
<style scoped>
.legacy-reset{max-width:440px;margin:32px auto;padding:24px;background:var(--fp-card);border:1px solid var(--fp-border);border-radius:10px;overflow-wrap:anywhere}h1{font-size:23px}p{font-size:14px;color:var(--fp-muted);line-height:1.7}fieldset{border:0;padding:0;margin:0;display:grid;gap:14px;min-width:0}label{display:grid;gap:8px;margin:12px 0}input,button{box-sizing:border-box;font:inherit;padding:9px 12px;border:1px solid var(--fp-border);border-radius:6px;color:var(--fp-text);background:var(--fp-bg);min-width:0;max-width:100%}button{margin:8px 8px 8px 0;cursor:pointer}button:disabled{opacity:.5;cursor:default}[role=alert]{color:#bd503c}nav{display:flex;gap:12px;margin-top:16px}@media(max-width:600px){.legacy-reset{margin:16px 12px;padding:18px}}
</style>

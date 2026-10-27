<script setup lang="ts">
import { computed, nextTick, onMounted, onScopeDispose, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { ApiError, getAuthContextVersion } from '@/api/http'
import { accountCode, accountPhone, accountOutcomeUnknown, completePasswordReset, completeRegistration, fetchAccountCaptchaId, fetchRegistrationOptions, referralName, registrationInput, requestPasswordReset, requestRegistration, type RegistrationInput, type RegistrationOptions } from '@/api/v3-account-access'
import { passwordDigest } from '@/api/v3-security'
import { useGeetest4 } from '@/composables/useGeetest4'
import { useAuthStore } from '@/stores/auth'
const props = defineProps<{ registration?: boolean; receivedCode?: boolean }>()
const route = useRoute(), auth = useAuthStore(), stage = ref<'form' | 'verify' | 'done' | 'uncertain'>(props.receivedCode ? 'verify' : 'form')
const userName = ref(''), phone = ref(''), invitecode = ref(''), referral = ref(''), code = ref(''), password = ref(''), repeatPassword = ref(''), role = ref(0)
const options = ref<RegistrationOptions | null>(null), optionsLoading = ref(false), busy = ref(false), error = ref(''), notice = ref(''), captchaEl = ref<HTMLElement | null>(null), checking = ref(false)
const captcha = useGeetest4(captchaEl, value => { void send(value) })
let alive = true, sequence = 0, optionsSequence = 0
const snapshot = ref<RegistrationInput | null>(null), resetPhone = ref('')
const title = computed(() => props.registration ? '注册' : props.receivedCode ? '重置密码' : '找回密码'), blocked = computed(() => busy.value || checking.value || optionsLoading.value)
function erase() { phone.value = ''; code.value = password.value = repeatPassword.value = ''; snapshot.value = null; resetPhone.value = ''; captcha.destroy(); checking.value = false }
async function loadOptions() {
  if (!props.registration || !alive || busy.value) return
  const run = ++optionsSequence; options.value = null; optionsLoading.value = true; error.value = ''
  try { const value = await fetchRegistrationOptions(referral.value); if (alive && run === optionsSequence) { options.value = value; role.value = value.appRoles[0]!.value } }
  catch (e) { if (alive && run === optionsSequence) error.value = e instanceof Error ? e.message : '注册选项读取失败' }
  finally { if (alive && run === optionsSequence) optionsLoading.value = false }
}
async function prepare() {
  if (blocked.value || !alive) return
  error.value = notice.value = ''; const run = ++sequence
  try {
    if (props.registration) { await loadOptions(); if (!alive || run !== sequence || !options.value) return; snapshot.value = registrationInput({ userName: userName.value, userPhone: phone.value, invitecode: invitecode.value, referral: referral.value }, options.value) }
    else resetPhone.value = accountPhone(phone.value)
    checking.value = true; await nextTick(); if (!alive || run !== sequence) return; const id = await fetchAccountCaptchaId()
    if (!alive || run !== sequence) return
    await captcha.mount('float', id)
    if (captcha.error.value) { error.value = captcha.error.value; checking.value = false }
  } catch (e) { if (alive && run === sequence) { checking.value = false; error.value = e instanceof Error ? e.message : '验证组件不可用' } }
}
function cancelCaptcha() { if (busy.value) return; sequence++; checking.value = false; captcha.destroy(); snapshot.value = null; resetPhone.value = '' }
async function send(value: unknown) {
  if (!alive || busy.value || !checking.value) return
  const run = ++sequence, input = snapshot.value, target = resetPhone.value; busy.value = true; error.value = ''
  try {
    if (props.registration) { if (!input) throw new ApiError('注册资料已变化，请重新申请', 422); await requestRegistration(input, value) }
    else await requestPasswordReset(target, value)
    if (alive && run === sequence) { stage.value = 'verify'; notice.value = '申请已受理；请收到短信后填写验证码。' }
  } catch (e) {
    if (alive && run === sequence) {
      if (accountOutcomeUnknown(e)) { stage.value = 'verify'; notice.value = '短信申请结果未确认。若已收到短信可继续；未收到时请稍后手动重新申请，不会自动重发。' }
      else error.value = e instanceof Error ? e.message : '短信申请失败'
    }
  } finally { if (alive && run === sequence) { busy.value = false; checking.value = false; captcha.destroy() } }
}
async function complete() {
  if (!alive || busy.value || stage.value !== 'verify') return
  error.value = ''; const authVersion = getAuthContextVersion()
  try {
    const target = props.registration ? snapshot.value?.userPhone : resetPhone.value || accountPhone(phone.value), sms = accountCode(code.value)
    if (!target) throw new ApiError('注册资料缺失，请重新申请短信', 422)
    passwordDigest(password.value)
    if (password.value !== repeatPassword.value) throw new ApiError('两次输入的新密码不一致', 422)
    const secret = password.value, run = ++sequence; password.value = repeatPassword.value = ''; busy.value = true
    try {
      if (props.registration) await completeRegistration(target, sms, secret, role.value, snapshot.value!.referral)
      else await completePasswordReset(target, sms, secret)
      if (!alive || run !== sequence) return
      erase(); stage.value = 'done'; notice.value = props.registration ? '注册已完成，请登录。' : '密码已重置，请重新登录。'
      if (!props.registration && authVersion === getAuthContextVersion()) void auth.logout()
    } catch (e) {
      if (!alive || run !== sequence) return
      if (accountOutcomeUnknown(e)) { erase(); stage.value = 'uncertain'; notice.value = props.registration ? '注册结果未确认，请先尝试登录。不要直接重复注册；无法登录时再重新获取验证码。' : '重置结果未确认，请先尝试使用新密码登录，或重新获取验证码。'; if (!props.registration && authVersion === getAuthContextVersion()) void auth.logout() }
      else error.value = e instanceof Error ? e.message : '提交失败'
    } finally { if (alive && run === sequence) busy.value = false }
  } catch (e) { error.value = e instanceof Error ? e.message : '请检查输入' }
}
function restart() { if (busy.value) return; sequence++; erase(); phone.value = ''; stage.value = 'form'; error.value = notice.value = ''; void loadOptions() }
watch(referral, () => { if (stage.value === 'form') { optionsSequence++; options.value = null; optionsLoading.value = false; cancelCaptcha() } })
onMounted(() => { if (props.registration) { const value = route.query.referral ?? route.query.r; if (typeof value === 'string') { try { referral.value = referralName(value) } catch { error.value = '邀请链接中的用户名不合法' } } void loadOptions() } })
onScopeDispose(() => { alive = false; sequence++; optionsSequence++; erase(); phone.value = userName.value = invitecode.value = referral.value = '' })
</script>
<template>
  <section class="account-access">
    <h1>{{ title }}</h1>
    <p v-if="stage === 'done' || stage === 'uncertain'" role="status">{{ notice }}</p>
    <template v-else>
      <p v-if="optionsLoading" role="status">正在读取注册选项…</p>
      <p v-if="registration && options?.mode === 'closed'">当前注册已关闭。</p>
      <form v-if="stage === 'form'" @submit.prevent="prepare">
        <fieldset :disabled="blocked">
          <template v-if="registration">
            <label>用户名<input v-model="userName" autocomplete="username" :minlength="options?.username.minLength || 1" :maxlength="options?.username.maxLength || 64" required /></label>
            <p v-if="options">{{ options.username.minLength }}至{{ options.username.maxLength }}位英文字母、数字或连字符。</p>
            <label>邀请人用户名（可选）<input v-model="referral" maxlength="64" /></label>
            <label v-if="!options || options.mode === 'invitation'">邀请码{{ !options ? '（要求待读取）' : options.inviteCodeRequired ? '（必填）' : '（可选）' }}<input v-model="invitecode" maxlength="16" :required="options?.inviteCodeRequired" /></label>
          </template>
          <label>手机号码<input v-model="phone" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel" required /></label>
          <button type="submit" :disabled="registration && options?.mode === 'closed'">{{ blocked ? '请稍候…' : '验证并申请短信' }}</button>
        </fieldset>
      </form>
      <div v-if="checking"><p>请完成人机验证以申请短信。</p><div ref="captchaEl" class="captcha" /><p v-if="captcha.error.value" role="alert">{{ captcha.error.value }}</p><button type="button" :disabled="busy" @click="cancelCaptcha">取消验证</button></div>
      <template v-if="stage === 'verify'">
        <p role="status">{{ notice || '请输入已收到验证码的手机号。' }}</p>
        <p v-if="registration">账号：{{ snapshot?.userName }}；手机号：{{ snapshot?.userPhone }}</p>
        <p v-else-if="resetPhone">接收短信的手机号：{{ resetPhone }}</p>
        <form @submit.prevent="complete"><fieldset :disabled="busy">
          <label v-if="!registration && !resetPhone">接收验证码的手机号<input v-model="phone" type="tel" inputmode="numeric" maxlength="11" autocomplete="tel" required /></label>
          <label>短信验证码<input v-model="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" required /></label>
          <label>新密码<input v-model="password" type="password" minlength="6" maxlength="128" autocomplete="new-password" required /></label>
          <label>确认新密码<input v-model="repeatPassword" type="password" minlength="6" maxlength="128" autocomplete="new-password" required /></label>
          <p>密码6至128个字符，保留首尾空白，不含控制字符。</p>
          <label v-if="registration">角色<select v-model.number="role"><option v-for="item in options?.appRoles || []" :key="item.value" :value="item.value">{{ item.label }}</option></select></label>
          <button type="submit">{{ busy ? '提交中…' : registration ? '完成注册' : '确认重置密码' }}</button>
        </fieldset></form>
      </template>
      <p v-if="notice && stage === 'form'" role="status">{{ notice }}</p>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
    <button v-if="registration && stage === 'form' && !checking" type="button" :disabled="blocked" @click="loadOptions">重新读取注册选项</button>
    <button v-if="stage === 'verify' || stage === 'uncertain'" type="button" :disabled="busy" @click="restart">重新填写并申请短信</button>
    <nav><RouterLink to="/login">前往登录</RouterLink><RouterLink v-if="!registration" to="/register">注册</RouterLink><RouterLink v-else to="/forget-pwd">找回密码</RouterLink><RouterLink to="/agreement">用户协议</RouterLink><RouterLink to="/privacy">隐私政策</RouterLink></nav>
  </section>
</template>
<style scoped lang="scss">
.account-access { max-width: 440px; margin: 32px auto; padding: 24px; background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 10px; color: var(--fp-text); overflow-wrap: anywhere; h1 { font-size: 23px; } p { font-size: 14px; color: var(--fp-muted); line-height: 1.6; } [role=alert] { color: #bd503c; } }
fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 16px; min-width: 0; } label { display: grid; gap: 8px; } input, select, button { font: inherit; padding: 9px 12px; border: 1px solid var(--fp-border); border-radius: 6px; color: var(--fp-text); background: var(--fp-bg); min-width: 0; max-width: 100%; } button { cursor: pointer; margin: 8px 8px 8px 0; &:disabled { opacity: .5; cursor: default; } } nav { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; } a { color: var(--fp-link); } .captcha { min-height: 44px; }
@media(max-width: 600px) { .account-access { margin: 16px 12px; padding: 18px; } }
</style>

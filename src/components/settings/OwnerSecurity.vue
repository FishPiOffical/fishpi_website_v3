<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { getAuthContextVersion, ApiError } from '@/api/http'
import { securityProof, passwordDigest, fetchV3MfaState, changeV3Password, prepareV3Mfa, setV3Mfa, contactTarget, requestV3ContactCode, changeV3Contact, type MfaPreparation } from '@/api/v3-security'
import { profileOperationKey } from '@/api/v3-profile'
import { useGeetest4 } from '@/composables/useGeetest4'
import { fpConfirm } from '@/composables/useDialog'
const auth = useAuthStore(), { accessToken, account } = storeToRefs(auth), router = useRouter(), route = useRoute()
type Mode = 'password' | 'mfa' | 'phone' | 'email'
const mode = ref<Mode>('password'), labels = { password: '修改密码', mfa: '两步验证', phone: '修改手机', email: '修改邮箱' }
const currentPassword = ref(''), currentTotp = ref(''), newPassword = ref(''), repeatPassword = ref(''), newTotp = ref(''), target = ref(''), contactCode = ref('')
const enabled = ref<boolean | null>(null), loading = ref(false), busy = ref(false), error = ref(''), message = ref(''), preparation = ref<MfaPreparation | null>(null)
const captchaEl = ref<HTMLElement | null>(null), challenge = ref(false), codeTarget = ref(''), codeExpiresAt = ref(0), now = ref(Date.now())
let generation = 0, statusRead = 0, mounted = false, boundary = getAuthContextVersion(), owner = account.value?.oId, timer: ReturnType<typeof setInterval> | undefined, confirmation: AbortController | null = null
const captcha = useGeetest4(captchaEl, value => { void sendCode(value) })
const contactMode = computed(() => mode.value === 'phone' || mode.value === 'email')
const blocked = computed(() => busy.value || loading.value || enabled.value === null)
function eraseProof() { currentPassword.value = currentTotp.value = '' }
function clearSecrets() { confirmation?.abort(); confirmation = null; eraseProof(); newPassword.value = repeatPassword.value = newTotp.value = target.value = contactCode.value = codeTarget.value = ''; preparation.value = null; challenge.value = false; codeExpiresAt.value = 0; captcha.destroy() }
function clear() { generation++; statusRead++; clearSecrets(); enabled.value = null; loading.value = busy.value = false; error.value = message.value = '' }
function capture() { const g = generation, context = getAuthContextVersion(), id = account.value?.oId; return () => mounted && !!accessToken.value && !!id && id === account.value?.oId && context === getAuthContextVersion() && generation === g }
watch([accessToken, () => account.value?.oId], () => { const context = getAuthContextVersion(), id = account.value?.oId; if (!accessToken.value || context !== boundary || id !== owner) clear(); boundary = context; owner = id }, { flush: 'sync' })
function select(value: Mode) { if (busy.value || loading.value || value === mode.value) return; generation++; clearSecrets(); error.value = message.value = ''; mode.value = value }
function hashMode() { const next = route.hash === '#bind-phone' ? 'phone' : route.hash === '#bind-email' ? 'email' : route.hash === '#mfaCode' ? 'mfa' : null; if (next) select(next) }
watch(() => route.hash, hashMode)
async function loadStatus() { const valid = capture(), read = ++statusRead; if (!valid() || busy.value) return; enabled.value = null; loading.value = true; error.value = ''; try { const result = await fetchV3MfaState(); if (valid() && read === statusRead) { enabled.value = result; if (result) { preparation.value = null; newTotp.value = '' } } } catch (e) { if (valid() && read === statusRead) error.value = e instanceof Error ? e.message : '安全状态读取失败' } finally { if (valid() && read === statusRead) loading.value = false } }
async function reauthenticate(reason: 'security-updated' | 'security-unconfirmed') { clearSecrets(); void auth.logout(); await router.replace({ path: '/login', query: { redirect: '/settings/account', reason } }) }
async function run(action: () => Promise<void>, revokes: boolean) {
  const valid = capture(); if (!valid() || blocked.value) return
  busy.value = true; error.value = message.value = ''; eraseProof()
  try { await action(); if (valid() && revokes) await reauthenticate('security-updated') }
  catch (e) { if (valid()) { if (revokes && (!(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.status === 401)) await reauthenticate('security-unconfirmed'); else error.value = e instanceof Error ? e.message : '安全设置失败' } }
  finally { if (valid()) busy.value = false }
}
function proof() { if (enabled.value === null) throw new ApiError('请先读取安全状态', 422); return securityProof(currentPassword.value, currentTotp.value, enabled.value) }
function localFailure(e: unknown) { error.value = e instanceof Error ? e.message : '输入不合法' }
async function confirm(options: Parameters<typeof fpConfirm>[0]) { const valid = capture(); if (!valid() || blocked.value) return false; const controller = new AbortController(); confirmation = controller; busy.value = true; try { return await fpConfirm({ ...(typeof options === 'string' ? { message: options } : options), signal: controller.signal }) && valid() } finally { if (confirmation === controller) confirmation = null; if (valid()) busy.value = false } }
async function changePassword() {
  if (blocked.value) return
  try {
    const p = proof(), digest = passwordDigest(newPassword.value)
    if (newPassword.value !== repeatPassword.value) throw new ApiError('两次输入的新密码不一致', 422)
    const valid = capture(); if (!await confirm({ title: '确认修改密码', message: '成功后所有设备与应用的已有登录授权失效，需要使用新密码重新登录。', confirmText: '确认修改' }) || !valid()) return
    newPassword.value = repeatPassword.value = ''; await run(() => changeV3Password(p, digest), true)
  } catch (e) { localFailure(e) }
}
async function prepare() {
  if (blocked.value) return
  try { const p = proof(); preparation.value = null; newTotp.value = ''; await run(async () => { const valid = capture(), value = await prepareV3Mfa(p); if (valid()) { preparation.value = value; message.value = '请在本地验证器手动录入密钥，再重新填写当前密码和新验证码以启用。' } }, false) }
  catch (e) { localFailure(e) }
}
async function mfa(enable: boolean) {
  if (blocked.value) return
  try {
    const p = proof(), prepared = preparation.value, code = newTotp.value
    if (enable && (!prepared || prepared.expiresAt <= Date.now() || !/^[0-9]{6}$/.test(code))) throw new ApiError('请重新准备或填写6位新验证码', 422)
    const valid = capture(); if (!await confirm({ title: enable ? '确认启用两步验证' : '确认停用两步验证', message: '成功后所有设备与应用的已有登录授权失效，需要重新登录。', confirmText: '确认修改' }) || !valid()) return
    newTotp.value = ''; const key = profileOperationKey(); await run(() => setV3Mfa(p, enable, key, prepared?.preparationId, code), true)
  } catch (e) { localFailure(e) }
}
async function startCode() {
  if (blocked.value || challenge.value) return
  const valid = capture()
  try { proof(); if (!contactMode.value) return; target.value = contactTarget(mode.value as 'phone' | 'email', target.value); challenge.value = true; await nextTick(); if (valid()) await captcha.mount() }
  catch (e) { localFailure(e) }
}
async function sendCode(value: unknown) {
  if (!challenge.value || !contactMode.value) return
  try {
    const p = proof(), kind = mode.value as 'phone' | 'email', frozen = contactTarget(kind, target.value), valid = capture()
    await run(async () => { await requestV3ContactCode(kind, frozen, p, value); if (valid()) { codeTarget.value = frozen; contactCode.value = ''; codeExpiresAt.value = Date.now() + 600000; message.value = '发送申请已受理，请输入新联系方式收到的6位验证码；确认修改时需再次填写当前密码及已有验证器码。' } }, false)
    if (valid()) { challenge.value = false; captcha.destroy() }
  } catch (e) { localFailure(e) }
}
async function applyContact() {
  if (blocked.value || challenge.value) return
  try {
    const p = proof(); if (!contactMode.value || !codeTarget.value || codeExpiresAt.value <= Date.now()) throw new ApiError('请重新申请绑定验证码', 422)
    const kind = mode.value as 'phone' | 'email', frozen = codeTarget.value, code = contactCode.value
    if (!/^[0-9]{6}$/.test(code)) throw new ApiError('验证码须为6位数字', 422)
    const valid = capture(); if (!await confirm({ title: labels[kind], message: `将绑定修改为 ${frozen}，成功后所有设备与应用的已有登录授权失效，需要重新登录。`, confirmText: '确认修改' }) || !valid()) return
    contactCode.value = ''; await run(() => changeV3Contact(kind, frozen, p, code), true)
  } catch (e) { localFailure(e) }
}
onMounted(() => { mounted = true; hashMode(); void loadStatus(); timer = setInterval(() => { now.value = Date.now(); if (preparation.value && preparation.value.expiresAt <= now.value) { preparation.value = null; newTotp.value = ''; message.value = '绑定资料已过期，请重新准备。' } if (codeExpiresAt.value && codeExpiresAt.value <= now.value) { codeTarget.value = ''; codeExpiresAt.value = 0; contactCode.value = ''; message.value = '绑定验证码可能已过期，请重新申请。' } }, 1000) })
onBeforeUnmount(() => { mounted = false; if (timer) clearInterval(timer); clear() })
</script>
<template>
  <section class="owner-security" aria-label="账号安全设置">
    <h2>账号安全</h2><p class="hint">每次操作需当前密码；已启用两步验证时还需当前验证器码。密码、手机、邮箱或两步验证修改成功后，所有设备与应用需要重新登录授权。</p>
    <nav aria-label="安全设置类型"><button v-for="(label, value) in labels" :key="value" type="button" :disabled="busy || loading" :aria-pressed="mode === value" @click="select(value)">{{ label }}</button></nav>
    <p v-if="loading">正在读取安全状态…</p><p v-else-if="enabled !== null">两步验证：{{ enabled ? '已启用' : '未启用' }}</p><button type="button" :disabled="busy || loading" @click="loadStatus">重新读取安全状态</button>
    <fieldset :disabled="blocked"><label>当前密码<input v-model="currentPassword" aria-label="安全设置当前密码" type="password" autocomplete="current-password" /></label><label>当前验证器码（已启用时必填）<input v-model="currentTotp" aria-label="安全设置当前验证器码" inputmode="numeric" maxlength="6" autocomplete="one-time-code" /></label></fieldset>
    <form v-if="mode === 'password'" @submit.prevent="changePassword"><h3>修改密码</h3><fieldset :disabled="blocked"><label>新密码<input v-model="newPassword" aria-label="安全设置新密码" type="password" minlength="6" maxlength="128" autocomplete="new-password" /></label><label>确认新密码<input v-model="repeatPassword" aria-label="安全设置确认新密码" type="password" minlength="6" maxlength="128" autocomplete="new-password" /></label><p class="hint">6至128个字符，保留首尾空白，不能包含控制字符。</p><button type="submit">核对并修改密码</button></fieldset></form>
    <section v-else-if="mode === 'mfa'" id="mfaCode"><h3>两步验证</h3><p class="hint">绑定资料仅当次返回、十分钟有效。使用本地验证器手动录入密钥；新准备会废弃旧准备，离开页面会清除本地资料。</p><button v-if="enabled === false" type="button" :disabled="blocked" @click="prepare">准备新的验证器密钥</button><button v-if="enabled === true" type="button" :disabled="blocked" @click="mfa(false)">核对并停用两步验证</button>
      <template v-if="preparation"><label>验证器手动密钥<input :value="preparation.secret" aria-label="验证器手动密钥" readonly autocomplete="off" /></label><label>本地绑定URI<textarea :value="preparation.otpauthUri" aria-label="本地验证器绑定URI" readonly spellcheck="false" /></label><p>绑定资料到期：{{ new Date(preparation.expiresAt).toLocaleString() }}</p><fieldset :disabled="blocked"><label>新验证器验证码<input v-model="newTotp" aria-label="新验证器验证码" maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></label><button type="button" @click="mfa(true)">核对并启用两步验证</button></fieldset></template>
    </section>
    <form v-else :id="mode === 'phone' ? 'bind-phone' : 'bind-email'" @submit.prevent="applyContact"><h3>{{ labels[mode] }}</h3><fieldset :disabled="blocked"><label>{{ mode === 'phone' ? '新手机号' : '新邮箱' }}<input v-model="target" :aria-label="mode === 'phone' ? '安全设置新手机号' : '安全设置新邮箱'" :type="mode === 'phone' ? 'tel' : 'email'" :maxlength="mode === 'phone' ? 11 : 255" :readonly="challenge || !!codeTarget" autocomplete="off" /></label><button type="button" :disabled="challenge" @click="startCode">{{ codeTarget ? '重新申请验证码' : '申请绑定验证码' }}</button><div v-if="challenge" ref="captchaEl" class="captcha" /><button v-if="challenge" type="button" @click="challenge = false; captcha.destroy()">取消本次验证</button><p v-if="captcha.error.value" role="alert" class="error">{{ captcha.error.value }}</p><template v-if="codeTarget"><p>验证码目标：{{ codeTarget }}。新码受理后旧码失效，请在十分钟内完成修改。</p><label>收到的绑定验证码<input v-model="contactCode" aria-label="联系方式绑定验证码" maxlength="6" inputmode="numeric" autocomplete="one-time-code" /></label><button type="submit" :disabled="challenge">核对并修改绑定</button></template><button type="button" @click="generation++; clearSecrets(); error = message = ''">取消本次绑定并清除输入</button></fieldset></form>
    <p v-if="error" role="alert" class="error">{{ error }}</p><p v-if="message" role="status">{{ message }}</p>
  </section>
</template>
<style scoped lang="scss">
.owner-security { margin: 24px 0; } nav { display: flex; flex-wrap: wrap; gap: 8px; } fieldset { border: 0; padding: 0; margin: 0; } label { display: grid; gap: 6px; margin: 12px 0; } input, textarea { padding: 9px 12px; max-width: 100%; box-sizing: border-box; color: var(--fp-text); background: var(--fp-bg); border: 1px solid var(--fp-border); border-radius: 8px; } textarea { min-height: 90px; resize: vertical; } button { margin: 6px 8px 6px 0; padding: 8px 12px; color: var(--fp-text); background: transparent; border: 1px solid var(--fp-border); border-radius: 8px; cursor: pointer; } button:disabled { opacity: .5; cursor: default; } button[aria-pressed='true'] { color: var(--fp-brand); } .hint { color: var(--fp-muted); font-size: 13px; } .error { color: #c34a36; } h2 { font-size: 18px; }
</style>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { fetchV3Profile, saveV3Profile, fetchV3Personality, fetchV3PersonalityOptions, saveV3Personality,
  fetchV3Avatar, saveV3Avatar, displayAvatar, uploadV3Avatar, profileOperationKey, fetchV3Qq, saveV3Qq, fetchV3ProfileTags, saveV3ProfileTags } from '@/api/v3-profile'

const props = defineProps<{ mode: 'profile' | 'avatar' }>()
const auth = useAuthStore(), { accessToken } = storeToRefs(auth)
const nickname = ref(''), intro = ref(''), website = ref(''), mbti = ref(''), options = ref<string[]>([])
const avatar = ref(''), avatarDraft = ref(''), busy = ref(false), loading = ref(false)
const qq = ref('')
const tags = ref('')
const loaded = ref({ profile: false, personality: false, avatar: false, qq: false, tags: false })
const errors = ref({ profile: '', personality: '', avatar: '', qq: '', tags: '' }), messages = ref({ profile: '', personality: '', avatar: '', qq: '', tags: '' })
type Resource = keyof typeof loaded.value
let mounted = false, generation = 0, uploadAbort: AbortController | null = null
const intentions = new Map<Resource, { fingerprint: string; key: string }>()
const errorText = (error: unknown) => error instanceof Error ? error.message : '设置操作失败，请重试'
function reset() {
  generation++; uploadAbort?.abort(); uploadAbort = null; intentions.clear()
  nickname.value = intro.value = website.value = mbti.value = avatar.value = avatarDraft.value = ''; options.value = []
  qq.value = tags.value = ''
  loaded.value = { profile: false, personality: false, avatar: false, qq: false, tags: false }
  errors.value = { profile: '', personality: '', avatar: '', qq: '', tags: '' }; messages.value = { profile: '', personality: '', avatar: '', qq: '', tags: '' }
  busy.value = loading.value = false
}
async function load() {
  const token = accessToken.value, current = ++generation
  if (!token) return
  loading.value = true
  const valid = () => mounted && current === generation && token === accessToken.value
  async function read<T>(group: Resource, fetcher: () => Promise<T>, apply: (value: T) => void) {
    loaded.value[group] = false; errors.value[group] = ''; messages.value[group] = ''
    try { const value = await fetcher(); if (valid()) { apply(value); loaded.value[group] = true } }
    catch (error) { if (valid()) errors.value[group] = errorText(error) }
  }
  if (props.mode === 'avatar') await read('avatar', fetchV3Avatar, value => { avatar.value = avatarDraft.value = value })
  else await Promise.all([
    read('profile', fetchV3Profile, value => { nickname.value = value.userNickname; intro.value = value.userIntro; website.value = value.userURL }),
    read('qq', fetchV3Qq, value => { qq.value = value }),
    read('tags', fetchV3ProfileTags, value => { tags.value = value }),
    read('personality', () => Promise.all([fetchV3Personality(), fetchV3PersonalityOptions()]), ([value, choices]) => {
      mbti.value = value; options.value = choices.types.flatMap(type => [type, ...choices.variants.map(variant => `${type}-${variant}`)])
    }),
  ])
  if (valid()) loading.value = false
}
async function write<T>(group: Resource, body: unknown, action: (key: string) => Promise<T>, apply: (value: T) => void) {
  if (busy.value || loading.value || !accessToken.value || !loaded.value[group]) return
  const token = accessToken.value, current = generation, fingerprint = JSON.stringify(body)
  const valid = () => mounted && current === generation && token === accessToken.value
  busy.value = true; errors.value[group] = ''; messages.value[group] = ''
  try {
    let intent = intentions.get(group)
    if (!intent || intent.fingerprint !== fingerprint) { intent = { fingerprint, key: profileOperationKey() }; intentions.set(group, intent) }
    const result = await action(intent.key)
    if (valid()) {
      intentions.delete(group); apply(result); messages.value[group] = '已保存'
      // A refresh failure does not turn an already committed setting into a failed save.
      void auth.reloadAccount().catch(() => {})
    }
  } catch (error) { if (valid()) errors.value[group] = errorText(error) }
  finally { if (valid()) busy.value = false }
}
function saveProfile() {
  const body = { userNickname: nickname.value.trim(), userIntro: intro.value.trim(), userURL: website.value.trim() }
  return write('profile', body, key => saveV3Profile(body, key), value => { nickname.value = value.userNickname; intro.value = value.userIntro; website.value = value.userURL })
}
function savePersonality() {
  const value = mbti.value.trim().toUpperCase()
  if (value && !options.value.includes(value)) { errors.value.personality = '请选择目录中的 MBTI 类型，或留空清除'; return }
  return write('personality', { mbti: value }, key => saveV3Personality(value, key), value => { mbti.value = value })
}
function persistAvatar(value: string) {
  return write('avatar', { avatarURL: value }, key => saveV3Avatar(value, key), saved => { avatar.value = avatarDraft.value = saved })
}
function saveQq() {
  const value = qq.value.trim()
  if (value && !/^[0-9]{1,12}$/.test(value)) { errors.value.qq = 'QQ 只能填写1至12位数字，或留空清除'; return }
  return write('qq', { qq: value }, key => saveV3Qq(value, key), saved => { qq.value = saved })
}
function saveTags() {
  const value = tags.value.trim()
  return write('tags', { tags: value }, key => saveV3ProfileTags(value, key), saved => { tags.value = saved })
}
function saveAvatar() { return persistAvatar(avatarDraft.value.trim()) }
async function onUpload(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  input.value = ''
  if (!file || busy.value || loading.value || !loaded.value.avatar || !accessToken.value) return
  const token = accessToken.value, current = generation, controller = new AbortController()
  const valid = () => mounted && current === generation && token === accessToken.value
  uploadAbort = controller; busy.value = true; errors.value.avatar = messages.value.avatar = ''
  let url: string | undefined
  try { url = await uploadV3Avatar(file, controller.signal); if (valid()) avatarDraft.value = url }
  catch (error) { if (valid()) errors.value.avatar = errorText(error) }
  finally { if (uploadAbort === controller) uploadAbort = null; if (valid()) busy.value = false }
  // Keep the uploaded URL on a save failure so retry does not re-upload the file.
  if (url && valid()) await persistAvatar(url)
}
onMounted(() => { mounted = true; void load() })
watch(accessToken, () => { reset(); if (mounted) void load() }, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
</script>

<template>
  <div class="owner-profile">
    <p v-if="loading" role="status">正在读取设置…</p>
    <button type="button" :disabled="loading || busy" @click="load">重新读取</button>
    <template v-if="mode === 'profile'">
      <form @submit.prevent="saveProfile">
        <fieldset :disabled="loading || busy || !loaded.profile">
          <label>昵称<input v-model="nickname" maxlength="20" /></label>
          <label>网址<input v-model="website" maxlength="100" placeholder="https://" /></label>
          <label>简介<textarea v-model="intro" rows="3" maxlength="255" /></label>
          <button type="submit">保存资料</button>
        </fieldset>
        <p v-if="errors.profile" role="alert" class="error">{{ errors.profile }}</p>
        <p v-if="messages.profile" role="status">{{ messages.profile }}</p>
      </form>
      <form @submit.prevent="savePersonality">
        <fieldset :disabled="loading || busy || !loaded.personality">
          <label>MBTI<input v-model="mbti" list="owner-mbti-options" maxlength="6" placeholder="如 ENFP-A，留空清除" /></label>
          <datalist id="owner-mbti-options"><option v-for="choice in options" :key="choice" :value="choice" /></datalist>
          <button type="submit">保存 MBTI</button>
        </fieldset>
        <p v-if="errors.personality" role="alert" class="error">{{ errors.personality }}</p>
        <p v-if="messages.personality" role="status">{{ messages.personality }}</p>
      </form>
      <form @submit.prevent="saveTags">
        <fieldset :disabled="loading || busy || !loaded.tags">
          <label>个人标签<input v-model="tags" maxlength="128" placeholder="逗号分隔，留空清除" /></label>
          <button type="submit">保存个人标签</button>
        </fieldset>
        <p>支持中英文逗号、顿号及分号，最多4项，每项最多12字符，白名单标签除外。</p>
        <p v-if="errors.tags" role="alert" class="error">{{ errors.tags }}</p>
        <p v-if="messages.tags" role="status">{{ messages.tags }}</p>
      </form>
      <form @submit.prevent="saveQq">
        <fieldset :disabled="loading || busy || !loaded.qq">
          <label>QQ<input v-model="qq" inputmode="numeric" maxlength="12" placeholder="留空清除" /></label>
          <button type="submit">保存 QQ</button>
        </fieldset>
        <p>QQ 仅供本人查看和编辑。</p>
        <p v-if="errors.qq" role="alert" class="error">{{ errors.qq }}</p>
        <p v-if="messages.qq" role="status">{{ messages.qq }}</p>
      </form>
    </template>
    <template v-else>
      <img class="owner-avatar" :src="displayAvatar(avatar) || '/favicon.svg'" alt="当前头像" />
      <form @submit.prevent="saveAvatar">
        <fieldset :disabled="loading || busy || !loaded.avatar">
          <label>头像图片地址<input v-model="avatarDraft" maxlength="255" placeholder="https://" /></label>
          <button type="submit">保存头像地址</button>
          <label>上传头像<input type="file" accept="image/jpeg,image/png,image/gif" @change="onUpload" /></label>
        </fieldset>
      </form>
      <p>支持 JPEG、PNG、GIF，也可填写 HTTPS 图片地址。</p>
      <p v-if="busy" role="status">正在处理，请稍候…</p>
      <p v-if="errors.avatar" role="alert" class="error">{{ errors.avatar }}</p>
      <p v-if="messages.avatar" role="status">{{ messages.avatar }}</p>
    </template>
  </div>
</template>

<style scoped lang="scss">
form { margin-top: 16px; }
fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 12px; }
label { display: grid; gap: 6px; }
input, textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--fp-border); border-radius: 8px; background: var(--fp-bg); color: var(--fp-text); padding: 9px 12px; }
button { width: fit-content; border: 1px solid var(--fp-border); border-radius: 8px; background: transparent; color: var(--fp-text); padding: 7px 14px; cursor: pointer; }
button:disabled { opacity: .5; cursor: default; }
.error { color: #c34a36; }
.owner-avatar { display: block; width: 80px; height: 80px; object-fit: cover; border-radius: 50%; margin: 16px 0; }
</style>

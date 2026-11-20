<script setup lang="ts">
import { avatarThumbnail, fallbackAvatar } from '@/utils/avatar'
import { memberSnapshotKey, removePublicSnapshot } from '@/utils/publicSnapshots'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { getAuthContextVersion } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { fetchV3Profile, saveV3Profile, fetchV3Personality, fetchV3PersonalityOptions, saveV3Personality,
  fetchV3Avatar, saveV3Avatar, displayAvatar, uploadV3Avatar, profileOperationKey, fetchV3Qq, saveV3Qq, fetchV3ProfileTags, saveV3ProfileTags } from '@/api/v3-profile'

const props = defineProps<{ mode: 'profile' | 'avatar' }>()
const auth = useAuthStore(), { accessToken, account } = storeToRefs(auth)
const nickname = ref(''), intro = ref(''), website = ref(''), mbti = ref(''), options = ref<string[]>([])
const avatar = ref(''), avatarDraft = ref(''), busy = ref(false), loading = ref(false)
const qq = ref('')
const tags = ref('')
const loaded = ref({ profile: false, personality: false, avatar: false, qq: false, tags: false })
const errors = ref({ profile: '', personality: '', avatar: '', qq: '', tags: '' }), messages = ref({ profile: '', personality: '', avatar: '', qq: '', tags: '' })
type Resource = keyof typeof loaded.value
let mounted = false, generation = 0, uploadAbort: AbortController | null = null
function identity() { return JSON.stringify([getAuthContextVersion(), !!accessToken.value, account.value?.oId || '']) }
let boundary = identity()
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
  const owner = identity(), current = ++generation
  if (!accessToken.value) return
  loading.value = true
  const valid = () => mounted && current === generation && owner === identity()
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
  const publicName = account.value?.userName
  const owner = identity(), current = generation, fingerprint = JSON.stringify(body)
  const valid = () => mounted && current === generation && owner === identity()
  busy.value = true; errors.value[group] = ''; messages.value[group] = ''
  try {
    let intent = intentions.get(group)
    if (!intent || intent.fingerprint !== fingerprint) { intent = { fingerprint, key: profileOperationKey() }; intentions.set(group, intent) }
    const result = await action(intent.key)
    if (publicName && (group === 'profile' || group === 'avatar')) removePublicSnapshot(memberSnapshotKey(publicName))
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
  const owner = identity(), current = generation, controller = new AbortController()
  const valid = () => mounted && current === generation && owner === identity()
  uploadAbort = controller; busy.value = true; errors.value.avatar = messages.value.avatar = ''
  let url: string | undefined
  try { url = await uploadV3Avatar(file, controller.signal); if (valid()) avatarDraft.value = url }
  catch (error) { if (valid()) errors.value.avatar = errorText(error) }
  finally { if (uploadAbort === controller) uploadAbort = null; if (valid()) busy.value = false }
  // Keep the uploaded URL on a save failure so retry does not re-upload the file.
  if (url && valid()) await persistAvatar(url)
}
onMounted(() => { mounted = true; void load() })
watch([accessToken, () => account.value?.oId], () => {
  const current = identity()
  if (current === boundary) return
  boundary = current; reset()
  if (mounted) { void load() }
}, { flush: 'sync' })
onBeforeUnmount(() => { mounted = false; reset() })
</script>

<template>
  <div class="owner-profile">
    <header class="settings-section-head"><h2>{{ mode === 'avatar' ? '更换头像' : '基本资料' }}</h2><button class="fp-control settings-refresh" type="button" :disabled="loading || busy" @click="load" title="刷新"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2" /></svg><span class="settings-visually-hidden">重新读取</span></button></header>
    <p v-if="loading" role="status">正在读取设置…</p>
    <template v-if="mode === 'profile'">
      <form @submit.prevent="saveProfile" aria-label="公开资料">
        <fieldset :disabled="loading || busy || !loaded.profile">
          <legend class="settings-visually-hidden">公开资料</legend>
          <label>昵称<input class="fp-control" v-model="nickname" maxlength="20" autocomplete="nickname" /></label>
          <label>网址<input class="fp-control" v-model="website" maxlength="100" placeholder="https://" inputmode="url" autocapitalize="none" spellcheck="false" /></label>
          <label>简介<textarea class="fp-control" v-model="intro" rows="3" maxlength="255" /></label>
          <button data-tone="primary" class="fp-control" type="submit">保存资料</button>
        </fieldset>
        <p v-if="errors.profile" role="alert" class="error">{{ errors.profile }}</p>
        <p v-if="messages.profile" role="status">{{ messages.profile }}</p>
      </form>
      <form class="profile-inline-form" @submit.prevent="savePersonality" aria-label="MBTI">
        <fieldset class="inline-fields" :disabled="loading || busy || !loaded.personality">
          <legend class="settings-visually-hidden">MBTI</legend>
          <label>MBTI<input class="fp-control" v-model="mbti" list="owner-mbti-options" maxlength="6" placeholder="如 ENFP-A，留空清除" spellcheck="false" /></label>
          <datalist id="owner-mbti-options"><option v-for="choice in options" :key="choice" :value="choice" /></datalist>
          <button class="fp-control" type="submit">保存 MBTI</button>
        </fieldset>
        <p v-if="errors.personality" role="alert" class="error">{{ errors.personality }}</p>
        <p v-if="messages.personality" role="status">{{ messages.personality }}</p>
      </form>
      <form class="profile-inline-form" @submit.prevent="saveTags" aria-label="个人标签">
        <fieldset class="inline-fields" :disabled="loading || busy || !loaded.tags">
          <legend class="settings-visually-hidden">个人标签</legend>
          <label>个人标签<input class="fp-control" v-model="tags" maxlength="128" placeholder="逗号分隔，留空清除" aria-describedby="profile-tags-hint" /></label>
          <button class="fp-control" type="submit">保存个人标签</button>
        </fieldset>
        <p id="profile-tags-hint">支持中英文逗号、顿号及分号，最多4项，每项最多12字符，白名单标签除外。</p>
        <p v-if="errors.tags" role="alert" class="error">{{ errors.tags }}</p>
        <p v-if="messages.tags" role="status">{{ messages.tags }}</p>
      </form>
      <form class="profile-inline-form" @submit.prevent="saveQq" aria-label="QQ">
        <fieldset class="inline-fields" :disabled="loading || busy || !loaded.qq">
          <legend class="settings-visually-hidden">QQ</legend>
          <label>QQ<input class="fp-control" v-model="qq" inputmode="numeric" maxlength="12" placeholder="留空清除" aria-describedby="profile-qq-hint" /></label>
          <button class="fp-control" type="submit">保存 QQ</button>
        </fieldset>
        <p id="profile-qq-hint">QQ 仅供本人查看和编辑。</p>
        <p v-if="errors.qq" role="alert" class="error">{{ errors.qq }}</p>
        <p v-if="messages.qq" role="status">{{ messages.qq }}</p>
      </form>
    </template>
    <template v-else>
      <form aria-label="头像设置" @submit.prevent="saveAvatar">
        <fieldset :disabled="loading || busy || !loaded.avatar">
          <legend class="settings-visually-hidden">头像设置</legend>
          <div class="settings-wide-field avatar-preview">
            <img class="owner-avatar" :src="avatarThumbnail(displayAvatar(avatar), 80)" width="80" height="80" alt="当前头像" @error="fallbackAvatar" />
            <div class="avatar-upload-field">
              <label class="avatar-upload">
                <input class="settings-visually-hidden" type="file" accept="image/jpeg,image/png,image/gif" aria-describedby="avatar-upload-hint" @change="onUpload" />
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4m-4 4 4-4 4 4M5 16v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" /></svg>
                上传头像
              </label>
              <small id="avatar-upload-hint">JPEG、PNG、GIF，最大 1 MB</small>
            </div>
          </div>
          <label class="settings-wide-field">头像图片地址<input class="fp-control" v-model="avatarDraft" maxlength="255" placeholder="https://" inputmode="url" autocapitalize="none" spellcheck="false" /></label>
          <button data-tone="primary" class="fp-control" type="submit">保存头像地址</button>
        </fieldset>
      </form>
      <p v-if="busy" role="status">正在处理，请稍候…</p>
      <p v-if="errors.avatar" role="alert" class="error">{{ errors.avatar }}</p>
      <p v-if="messages.avatar" role="status">{{ messages.avatar }}</p>
    </template>
  </div>
</template>

<style scoped>
.owner-profile {
  container-type: inline-size;
}
.owner-profile form button[type=submit] {
  margin: 0;
}
.owner-profile .profile-inline-form > .inline-fields {
  grid-template-columns: minmax(0, 1fr) 8rem;
  align-items: end;
  gap: 8px 12px;
}
.owner-profile form.profile-inline-form + .profile-inline-form {
  padding-block-start: 16px;
  margin-block-start: 16px;
}
.owner-profile input.fp-control {
  block-size: max(40px, 2.5em);
}
.owner-profile .profile-inline-form button[type=submit] {
  grid-column: 2;
  width: 100%;
  min-height: 40px;
  background: var(--fp-card);
  border-color: var(--fp-border);
  color: var(--fp-text);
}
.owner-profile .profile-inline-form button[type=submit]:hover:enabled {
  background: var(--fp-hover);
  color: var(--fp-title);
}
@container (max-width: 28rem) {
  .owner-profile .profile-inline-form > .inline-fields {
    grid-template-columns: minmax(0, 1fr) 7rem;
  }
  .owner-profile .profile-inline-form button[type=submit] {
    padding-inline: 10px;
  }
}
.avatar-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  padding-block-end: 16px;
  border-block-end: 1px solid var(--fp-divider);
}
.owner-profile .avatar-preview img.owner-avatar {
  flex: none;
  width: 80px;
  height: 80px;
  margin: 0;
}
.avatar-upload-field { display: grid; justify-items: start; gap: 6px; }
.avatar-upload-field small { color: var(--fp-muted); }
.avatar-upload {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  background: var(--fp-card);
  color: var(--fp-text);
  cursor: pointer;
}
.avatar-upload svg { width: 16px; height: 16px; }
.avatar-upload:has(input:enabled):hover { border-color: var(--fp-primary); }
.avatar-upload:focus-within { outline: 2px solid var(--fp-primary); outline-offset: 2px; }
.avatar-upload:has(input:disabled) { opacity: .5; cursor: default; }
</style>

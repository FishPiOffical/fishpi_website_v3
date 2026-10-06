<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppearancePicker from '@/components/packs/AppearancePicker.vue'
import { fetchUserProfile, updateAvatar, updateProfile, uploadFiles } from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey, account, isLoggedIn } = storeToRefs(auth)

const nickname = ref('')
const intro = ref('')
const url = ref('')
const tags = ref('')
const mbti = ref('')
const avatar = ref('')
const saving = ref(false)
const uploading = ref(false)
const msg = ref('')
const err = ref('')

function fill() {
  nickname.value = account.value?.userNickname || ''
  intro.value = account.value?.userIntro || ''
  url.value = account.value?.userURL || ''
  tags.value = account.value?.userTags || ''
  mbti.value = account.value?.mbti || ''
  avatar.value = account.value?.userAvatarURL || ''
}

watch(account, fill, { immediate: true })
onMounted(async () => {
  if (apiKey.value && !account.value) await auth.restore()
  const name = account.value?.userName
  if (apiKey.value && name) {
    try {
      const p = await fetchUserProfile(name, apiKey.value)
      nickname.value = p.userNickname || nickname.value
      intro.value = p.userIntro || intro.value
      url.value = p.userURL || url.value
      tags.value = p.userTags || tags.value
      avatar.value = p.userAvatarURL || avatar.value
    } catch {
      /* keep /api/user fields */
    }
  }
})

async function save() {
  if (!apiKey.value) return
  saving.value = true
  msg.value = ''
  err.value = ''
  try {
    await updateProfile(apiKey.value, {
      userNickname: nickname.value,
      userIntro: intro.value,
      userURL: url.value,
      userTag: tags.value,
      mbti: mbti.value,
    })
    await auth.reloadAccount()
    msg.value = '资料已保存'
  } catch (e) {
    err.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function onAvatar(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !apiKey.value) return
  uploading.value = true
  err.value = ''
  msg.value = ''
  try {
    const urls = await uploadFiles(apiKey.value, [file])
    const next = urls[0]
    if (!next) throw new Error('未返回头像地址')
    await updateAvatar(apiKey.value, next)
    avatar.value = next
    await auth.reloadAccount()
    msg.value = '头像已更新'
  } catch (e) {
    err.value = e instanceof Error ? e.message : '上传失败'
  } finally {
    uploading.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}
</script>

<template>
  <div class="page">
    <section v-if="isLoggedIn" class="card">
      <h1>资料</h1>
      <p class="hint">保存走 <code>POST /api/settings/profiles</code>，头像走图床票据后 <code>/api/settings/avatar</code>。</p>
      <div class="avatar-row">
        <img class="fp-avatar" :src="avatar || '/favicon.svg'" alt="" />
        <label class="file">
          {{ uploading ? '上传中…' : '更换头像' }}
          <input type="file" accept="image/*" :disabled="uploading" @change="onAvatar" />
        </label>
      </div>
      <form @submit.prevent="save">
        <label>昵称<input v-model="nickname" maxlength="32" /></label>
        <label>签名<textarea v-model="intro" rows="3" maxlength="256" /></label>
        <label>个人主页<input v-model="url" placeholder="https://" /></label>
        <label>标签<input v-model="tags" placeholder="逗号分隔" /></label>
        <label>MBTI<input v-model="mbti" maxlength="8" /></label>
        <p v-if="msg" class="ok">{{ msg }}</p>
        <p v-if="err" class="err">{{ err }}</p>
        <button type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存资料' }}</button>
      </form>
    </section>
    <section v-else class="card">
      <p class="hint">登录后可编辑昵称、签名和头像。</p>
    </section>
    <section class="card">
      <h1>外观</h1>
      <p class="hint">主题免费。对话框和头像框的进阶样式后期仅 VIP 可用。</p>
      <AppearancePicker />
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 720px;
}
.card {
  background: var(--fp-card);
  border: 1px solid var(--fp-border);
  border-radius: 12px;
  padding: 24px;
}
h1 {
  margin: 0 0 8px;
  font-size: 18px;
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}
.fp-avatar {
  width: 64px;
  height: 64px;
}
.file {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--fp-border);
  border-radius: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 13px;
}
.file input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--fp-muted);
  font-size: 13px;
}
input,
textarea {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px 10px;
}
button {
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 8px;
  padding: 10px;
  cursor: pointer;
}
.ok {
  color: var(--fp-primary);
  font-size: 13px;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
</style>

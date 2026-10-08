<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AppearancePicker from '@/components/packs/AppearancePicker.vue'
import EmojiPacks from '@/components/EmojiPacks.vue'
import {
  fetchProfessionMe,
  fetchUserProfile,
  setProfessionPrimary,
  setProfessionPrivacy,
  updateAvatar,
  updateGeoStatus,
  updatePassword,
  updateProfile,
  uploadFiles,
  type ProfessionProgress,
} from '@/api/fishpi'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const { apiKey, account, isLoggedIn } = storeToRefs(auth)

const nickname = ref('')
const intro = ref('')
const url = ref('')
const tags = ref('')
const mbti = ref('')
const qq = ref('')
const avatar = ref('')
const saving = ref(false)
const uploading = ref(false)
const msg = ref('')
const err = ref('')
const jobs = ref<ProfessionProgress[]>([])
const availableJobs = ref<ProfessionProgress[]>([])
const primaryJob = ref('')
const privacy = ref('ALL_PUBLIC')
const jobBusy = ref(false)
const jobMsg = ref('')
const geoPublic = ref(true)
const geoBusy = ref(false)
const geoMsg = ref('')
const oldPwd = ref('')
const newPwd = ref('')
const newPwd2 = ref('')
const pwdBusy = ref(false)
const pwdMsg = ref('')
const pwdErr = ref('')

const privacyOptions = [
  { value: 'ALL_PUBLIC', label: '全部公开' },
  { value: 'LEVEL_ONLY', label: '仅等级' },
  { value: 'PRIMARY_ONLY', label: '仅主职业' },
  { value: 'SELF_ONLY', label: '仅自己可见' },
  { value: 'FULLY_HIDDEN', label: '完全隐藏' },
]

function fill() {
  nickname.value = account.value?.userNickname || ''
  intro.value = account.value?.userIntro || ''
  url.value = account.value?.userURL || ''
  tags.value = account.value?.userTags || ''
  mbti.value = account.value?.mbti || ''
  qq.value = account.value?.userQQ || ''
  avatar.value = account.value?.userAvatarURL || ''
  geoPublic.value = Number(account.value?.userGeoStatus ?? 0) !== 1
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
    await loadJobs()
  }
})

async function loadJobs() {
  if (!apiKey.value) return
  try {
    const me = await fetchProfessionMe(apiKey.value)
    jobs.value = me?.progress || []
    availableJobs.value = me?.availableProfessions || me?.progress || []
    primaryJob.value = me?.primaryProfessionId || ''
    privacy.value = me?.privacyPreset || 'ALL_PUBLIC'
  } catch {
    jobs.value = []
    availableJobs.value = []
  }
}

async function savePrimary() {
  if (!apiKey.value || !primaryJob.value) return
  jobBusy.value = true
  jobMsg.value = ''
  try {
    await setProfessionPrimary(apiKey.value, primaryJob.value)
    await loadJobs()
    jobMsg.value = '主职业已更新'
  } catch (e) {
    jobMsg.value = e instanceof Error ? e.message : '主职业设置失败'
  } finally {
    jobBusy.value = false
  }
}

async function savePrivacy() {
  if (!apiKey.value) return
  jobBusy.value = true
  jobMsg.value = ''
  try {
    await setProfessionPrivacy(apiKey.value, privacy.value)
    await loadJobs()
    jobMsg.value = '职业隐私已更新'
  } catch (e) {
    jobMsg.value = e instanceof Error ? e.message : '隐私设置失败'
  } finally {
    jobBusy.value = false
  }
}

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
      userQQ: qq.value,
    })
    await auth.reloadAccount()
    msg.value = '资料已保存'
  } catch (e) {
    err.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    saving.value = false
  }
}

async function saveGeo() {
  if (!apiKey.value) return
  geoBusy.value = true
  geoMsg.value = ''
  try {
    await updateGeoStatus(apiKey.value, geoPublic.value ? 0 : 1)
    await auth.reloadAccount()
    geoMsg.value = '地理位置设置已保存'
  } catch (e) {
    geoMsg.value = e instanceof Error ? e.message : '地理位置设置失败'
  } finally {
    geoBusy.value = false
  }
}

async function savePassword() {
  if (!apiKey.value) return
  pwdMsg.value = ''
  pwdErr.value = ''
  if (newPwd.value.length < 6) {
    pwdErr.value = '新密码至少 6 位'
    return
  }
  if (newPwd.value !== newPwd2.value) {
    pwdErr.value = '两次输入的新密码不一致'
    return
  }
  pwdBusy.value = true
  try {
    await updatePassword(apiKey.value, oldPwd.value, newPwd.value)
    oldPwd.value = ''
    newPwd.value = ''
    newPwd2.value = ''
    pwdMsg.value = '密码已更新'
  } catch (e) {
    pwdErr.value = e instanceof Error ? e.message : '修改密码失败'
  } finally {
    pwdBusy.value = false
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
        <label>QQ<input v-model="qq" maxlength="20" /></label>
        <label>MBTI<input v-model="mbti" maxlength="8" /></label>
        <p v-if="account?.userCity" class="hint">当前城市：{{ account.userCity }}（由定位/城市页更新）</p>
        <p v-if="msg" class="ok">{{ msg }}</p>
        <p v-if="err" class="err">{{ err }}</p>
        <button type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存资料' }}</button>
      </form>
      <div class="jobs">
        <h2>地理位置</h2>
        <p class="hint">POST <code>/settings/geo/status</code>（page-auth CSRF）。</p>
        <label class="check">
          <input v-model="geoPublic" type="checkbox" :disabled="geoBusy" />
          公开我的地理位置
        </label>
        <button type="button" :disabled="geoBusy" @click="saveGeo">
          {{ geoBusy ? '提交中…' : '保存地理位置设置' }}
        </button>
        <p v-if="geoMsg" :class="geoMsg.includes('失败') ? 'err' : 'ok'">{{ geoMsg }}</p>
      </div>
      <div class="jobs">
        <h2>修改密码</h2>
        <p class="hint">POST <code>/settings/password</code>（MD5 + CSRF）。</p>
        <label>当前密码<input v-model="oldPwd" type="password" autocomplete="current-password" /></label>
        <label>新密码<input v-model="newPwd" type="password" autocomplete="new-password" minlength="6" /></label>
        <label>确认新密码<input v-model="newPwd2" type="password" autocomplete="new-password" minlength="6" /></label>
        <p v-if="pwdMsg" class="ok">{{ pwdMsg }}</p>
        <p v-if="pwdErr" class="err">{{ pwdErr }}</p>
        <button type="button" :disabled="pwdBusy || !oldPwd || !newPwd" @click="savePassword">
          {{ pwdBusy ? '提交中…' : '更新密码' }}
        </button>
      </div>
      <div class="jobs">
        <h2>职业成长</h2>
        <p class="hint">读取 <code>GET /api/profession/me</code>，写入主职业/隐私。</p>
        <ul v-if="jobs.length">
          <li v-for="job in jobs" :key="job.professionId || job.displayName">
            {{ job.displayName || job.shortName }}
            <em v-if="job.levelName">{{ job.levelName }}</em>
            <span v-if="job.professionId === primaryJob">主职业</span>
          </li>
        </ul>
        <p v-else class="hint">暂无职业进度。</p>
        <label>
          主职业
          <select v-model="primaryJob" :disabled="jobBusy">
            <option disabled value="">选择职业</option>
            <option
              v-for="job in availableJobs"
              :key="job.professionId || job.displayName"
              :value="job.professionId"
            >
              {{ job.displayName || job.shortName || job.professionId }}
            </option>
          </select>
        </label>
        <button type="button" :disabled="jobBusy || !primaryJob" @click="savePrimary">
          {{ jobBusy ? '提交中…' : '保存主职业' }}
        </button>
        <label>
          隐私
          <select v-model="privacy" :disabled="jobBusy">
            <option v-for="opt in privacyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </label>
        <button type="button" :disabled="jobBusy" @click="savePrivacy">
          {{ jobBusy ? '提交中…' : '保存隐私' }}
        </button>
        <p v-if="jobMsg" :class="jobMsg.includes('失败') ? 'err' : 'ok'">{{ jobMsg }}</p>
      </div>
    </section>
    <section v-else class="card">
      <p class="hint">登录后可编辑昵称、签名和头像。</p>
    </section>
    <EmojiPacks v-if="isLoggedIn" />
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
textarea,
select {
  background: var(--fp-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  border-radius: 8px;
  padding: 8px 10px;
}
.jobs label {
  margin-top: 10px;
}
.jobs button {
  margin-top: 8px;
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
h2 {
  margin: 16px 0 8px;
  font-size: 16px;
}
.jobs ul {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}
.jobs li {
  padding: 6px 0;
  font-size: 13px;
}
.jobs em,
.jobs span {
  margin-left: 8px;
  color: var(--fp-muted);
  font-style: normal;
}
.check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
}
.check input {
  width: auto;
}
</style>

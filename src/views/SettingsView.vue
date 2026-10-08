<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import AppearancePicker from '@/components/packs/AppearancePicker.vue'
import EmojiPacks from '@/components/EmojiPacks.vue'
import {
  bindEmail,
  bindPhone,
  buyInvitecode,
  exportPosts,
  fetchProfessionMe,
  fetchUserProfile,
  queryInvitecode,
  requestEmailBindCode,
  requestPhoneBindCode,
  setProfessionPrimary,
  setProfessionPrivacy,
  submitIdentity,
  transferPoints,
  updateAvatar,
  updateFunctionSettings,
  updateGeoStatus,
  updateI18nSettings,
  updatePassword,
  updatePrivacySettings,
  updateProfile,
  updateUsername,
  uploadFiles,
  type PrivacySettings,
  type ProfessionProgress,
} from '@/api/fishpi'
import { useGeetest4 } from '@/composables/useGeetest4'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const auth = useAuthStore()
const { apiKey, account, isLoggedIn } = storeToRefs(auth)

const tabs = [
  { id: 'profile', to: '/settings', label: '资料' },
  { id: 'system', to: '/settings/system', label: '个性化' },
  { id: 'avatar', to: '/settings/avatar', label: '头像' },
  { id: 'account', to: '/settings/account', label: '账号' },
  { id: 'function', to: '/settings/function', label: '功能' },
  { id: 'point', to: '/settings/point', label: '积分' },
  { id: 'invite', to: '/settings/invite', label: '邀请' },
  { id: 'identity', to: '/settings/identity', label: '认证' },
  { id: 'data', to: '/settings/data', label: '数据' },
  { id: 'i18n', to: '/settings/i18n', label: '语言' },
  { id: 'privacy', to: '/settings/privacy', label: '隐私' },
  { id: 'profession', to: '/settings/profession', label: '职业' },
  { id: 'help', to: '/settings/help', label: '帮助' },
] as const

const languageOptions = [
  { value: 'zh_CN', label: '简体中文' },
  { value: 'en_US', label: 'English' },
]
const timezoneOptions = [
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Hong_Kong', label: 'Asia/Hong_Kong' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York' },
  { value: 'Europe/London', label: 'Europe/London' },
]
const helpLinks = [
  { to: '/article/1630569106133', title: '快速开始', tip: '新人上手' },
  { to: '/article/1630575841478', title: '基础功能', tip: '发帖与互动' },
  { to: '/article/1631459254239', title: '快捷键', tip: '键盘操作' },
  { to: '/article/1631460144004', title: 'Markdown 教程', tip: '排版指南' },
]
const identityPlaceholder =
  'https://file.fishpi.cn/id/%E8%90%A5%E4%B8%9A%E6%89%A7%E7%85%A7%E5%89%AF%E6%9C%AC%E5%A4%8D%E5%8D%B0%E4%BB%B6.png'

const tab = computed(() => String(route.meta.settingsTab || 'profile'))

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

const privacyOptions = [
  { value: 'ALL_PUBLIC', label: '全部公开' },
  { value: 'LEVEL_ONLY', label: '仅等级' },
  { value: 'PRIMARY_ONLY', label: '仅主职业' },
  { value: 'SELF_ONLY', label: '仅自己可见' },
  { value: 'FULLY_HIDDEN', label: '完全隐藏' },
]

const geoStatus = ref<0 | 1>(0)
const geoBusy = ref(false)
const geoMsg = ref('')
const privacyBusy = ref(false)
const privacyMsg = ref('')
const privacyFlags = ref<PrivacySettings>({
  userArticleStatus: true,
  userCommentStatus: true,
  userFollowingUserStatus: true,
  userFollowingTagStatus: true,
  userFollowingArticleStatus: true,
  userWatchingArticleStatus: true,
  userFollowerStatus: true,
  userBreezemoonStatus: true,
  userPointStatus: true,
  userOnlineStatus: true,
  userJoinPointRank: true,
  userJoinUsedPointRank: true,
  userUAStatus: true,
})
const privacyItems: { key: keyof PrivacySettings; label: string }[] = [
  { key: 'userArticleStatus', label: '公开帖子列表' },
  { key: 'userCommentStatus', label: '公开回帖列表' },
  { key: 'userFollowingUserStatus', label: '公开关注用户列表' },
  { key: 'userFollowingTagStatus', label: '公开关注标签列表' },
  { key: 'userFollowingArticleStatus', label: '公开收藏帖子列表' },
  { key: 'userWatchingArticleStatus', label: '公开关注帖子列表' },
  { key: 'userFollowerStatus', label: '公开关注者列表' },
  { key: 'userPointStatus', label: '公开积分列表' },
  { key: 'userUAStatus', label: '公开 UA 信息' },
  { key: 'userOnlineStatus', label: '公开在线状态' },
  { key: 'userBreezemoonStatus', label: '公开清风明月列表' },
  { key: 'userJoinPointRank', label: '参与财富排行' },
  { key: 'userJoinUsedPointRank', label: '参与消费排行' },
]

const oldPwd = ref('')
const newPwd = ref('')
const newPwd2 = ref('')
const pwdBusy = ref(false)
const pwdMsg = ref('')
const pwdErr = ref('')

const newUsername = ref('')
const nameBusy = ref(false)
const nameMsg = ref('')

const displayPhone = computed(() => account.value?.userPhone || '')
const displayEmail = computed(() => {
  const e = account.value?.userEmail || ''
  if (!e || e.endsWith('@sym.b3log.org')) return ''
  return e
})
const phoneInput = ref('')
const phoneCode = ref('')
const phoneBindOpen = ref(false)
const phoneCodeReady = ref(false)
const phoneBusy = ref(false)
const phoneMsg = ref('')
const phoneCaptchaEl = ref<HTMLElement | null>(null)

const emailInput = ref('')
const emailCode = ref('')
const emailBindOpen = ref(false)
const emailCodeReady = ref(false)
const emailBusy = ref(false)
const emailMsg = ref('')
const emailCaptchaEl = ref<HTMLElement | null>(null)

const { error: phoneGtError, mount: mountPhoneGt, destroy: destroyPhoneGt } = useGeetest4(
  phoneCaptchaEl,
  (v) => void onPhoneCaptcha(v),
)
const { error: emailGtError, mount: mountEmailGt, destroy: destroyEmailGt } = useGeetest4(
  emailCaptchaEl,
  (v) => void onEmailCaptcha(v),
)

const listPageSize = ref(20)
const commentViewMode = ref(0)
const avatarViewMode = ref(0)
const listViewMode = ref(1)
const indexRedirect = ref('')
const notifyOn = ref(true)
const subMailOn = ref(true)
const keyboardOn = ref(true)
const replyWatchOn = ref(true)
const forwardPageOn = ref(true)
const chatPicOn = ref(true)
const fnBusy = ref(false)
const fnMsg = ref('')

const transferTo = ref('')
const transferAmount = ref(5)
const transferMemo = ref('请你吃鱼丸')
const transferBusy = ref(false)
const transferMsg = ref('')

const inviteLink = computed(() => {
  if (typeof window === 'undefined' || !account.value?.userName) return ''
  return `${window.location.origin}/register?r=${encodeURIComponent(account.value.userName)}`
})
const boughtCodes = ref<{ code: string; memo: string }[]>([])
const inviteQuery = ref('')
const inviteBusy = ref(false)
const inviteMsg = ref('')
const copyMsg = ref('')

const idCertUrl = ref('')
const idFile = ref<HTMLInputElement | null>(null)
const idBusy = ref(false)
const idMsg = ref('')

const exportBusy = ref(false)
const exportMsg = ref('')

const userLanguage = ref('zh_CN')
const userTimezone = ref('Asia/Shanghai')
const i18nBusy = ref(false)
const i18nMsg = ref('')

function enabled(status?: number) {
  return Number(status ?? 0) === 0
}

function fill() {
  nickname.value = account.value?.userNickname || ''
  intro.value = account.value?.userIntro || ''
  url.value = account.value?.userURL || ''
  tags.value = account.value?.userTags || ''
  mbti.value = account.value?.mbti || ''
  qq.value = account.value?.userQQ || ''
  avatar.value = account.value?.userAvatarURL || ''
  geoStatus.value = Number(account.value?.userGeoStatus ?? 0) === 1 ? 1 : 0
  privacyFlags.value = {
    userArticleStatus: enabled(account.value?.userArticleStatus),
    userCommentStatus: enabled(account.value?.userCommentStatus),
    userFollowingUserStatus: enabled(account.value?.userFollowingUserStatus),
    userFollowingTagStatus: enabled(account.value?.userFollowingTagStatus),
    userFollowingArticleStatus: enabled(account.value?.userFollowingArticleStatus),
    userWatchingArticleStatus: enabled(account.value?.userWatchingArticleStatus),
    userFollowerStatus: enabled(account.value?.userFollowerStatus),
    userBreezemoonStatus: enabled(account.value?.userBreezemoonStatus),
    userPointStatus: enabled(account.value?.userPointStatus),
    userOnlineStatus: enabled(account.value?.userOnlineStatus),
    userJoinPointRank: enabled(account.value?.userJoinPointRank),
    userJoinUsedPointRank: enabled(account.value?.userJoinUsedPointRank),
    userUAStatus: enabled(account.value?.userUAStatus),
  }
  if (!phoneBindOpen.value) phoneInput.value = displayPhone.value
  if (!emailBindOpen.value) emailInput.value = displayEmail.value
  listPageSize.value = Number(account.value?.userListPageSize || 20)
  commentViewMode.value = Number(account.value?.userCommentViewMode || 0)
  avatarViewMode.value = Number(account.value?.userAvatarViewMode || 0)
  listViewMode.value = Number(account.value?.userListViewMode ?? 1)
  indexRedirect.value = account.value?.userIndexRedirectURL || ''
  notifyOn.value = enabled(account.value?.userNotifyStatus)
  subMailOn.value = enabled(account.value?.userSubMailStatus)
  keyboardOn.value = enabled(account.value?.userKeyboardShortcutsStatus)
  replyWatchOn.value = enabled(account.value?.userReplyWatchArticleStatus)
  forwardPageOn.value = enabled(account.value?.userForwardPageStatus)
  chatPicOn.value = enabled(account.value?.chatRoomPictureStatus)
}

watch(account, fill, { immediate: true })

watch(
  () => route.query.to,
  (v) => {
    if (typeof v === 'string' && v) transferTo.value = v
  },
  { immediate: true },
)

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
      /* keep /api/user */
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

async function saveJobPrivacy() {
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

async function saveGeo() {
  if (!apiKey.value) return
  geoBusy.value = true
  geoMsg.value = ''
  try {
    await updateGeoStatus(apiKey.value, geoStatus.value)
    await auth.reloadAccount()
    geoMsg.value = '地理位置设置已保存'
  } catch (e) {
    geoMsg.value = e instanceof Error ? e.message : '地理位置设置失败'
  } finally {
    geoBusy.value = false
  }
}

async function savePrivacy() {
  if (!apiKey.value) return
  privacyBusy.value = true
  privacyMsg.value = ''
  try {
    await updatePrivacySettings(apiKey.value, { ...privacyFlags.value })
    await auth.reloadAccount()
    privacyMsg.value = '隐私设置已保存'
  } catch (e) {
    privacyMsg.value = e instanceof Error ? e.message : '隐私设置失败'
  } finally {
    privacyBusy.value = false
  }
}

async function saveUsername() {
  if (!apiKey.value || !newUsername.value.trim()) return
  nameBusy.value = true
  nameMsg.value = ''
  try {
    await updateUsername(apiKey.value, newUsername.value.trim())
    await auth.reloadAccount()
    nameMsg.value = '用户名已更新'
    newUsername.value = ''
  } catch (e) {
    nameMsg.value = e instanceof Error ? e.message : '修改用户名失败'
  } finally {
    nameBusy.value = false
  }
}

async function openPhoneBind() {
  phoneBindOpen.value = true
  phoneCodeReady.value = false
  phoneCode.value = ''
  phoneMsg.value = ''
  phoneInput.value = displayPhone.value
  await nextTick()
  destroyPhoneGt()
  await mountPhoneGt()
}

async function onPhoneCaptcha(captcha: unknown) {
  if (!apiKey.value) return
  const p = phoneInput.value.trim()
  if (!/^1\d{10}$/.test(p)) {
    phoneMsg.value = '手机号码不合法'
    return
  }
  phoneBusy.value = true
  phoneMsg.value = ''
  try {
    phoneMsg.value = await requestPhoneBindCode(apiKey.value, p, captcha)
    phoneCodeReady.value = true
  } catch (e) {
    phoneMsg.value = e instanceof Error ? e.message : '发送失败'
  } finally {
    phoneBusy.value = false
  }
}

async function submitPhoneBind() {
  if (!apiKey.value || !phoneCode.value.trim()) return
  phoneBusy.value = true
  phoneMsg.value = ''
  try {
    phoneMsg.value = await bindPhone(apiKey.value, phoneInput.value.trim(), phoneCode.value.trim())
    phoneBindOpen.value = false
    phoneCodeReady.value = false
    destroyPhoneGt()
    await auth.reloadAccount()
  } catch (e) {
    phoneMsg.value = e instanceof Error ? e.message : '绑定失败'
  } finally {
    phoneBusy.value = false
  }
}

async function openEmailBind() {
  emailBindOpen.value = true
  emailCodeReady.value = false
  emailCode.value = ''
  emailMsg.value = ''
  emailInput.value = displayEmail.value
  await nextTick()
  destroyEmailGt()
  await mountEmailGt()
}

async function onEmailCaptcha(captcha: unknown) {
  if (!apiKey.value) return
  const e = emailInput.value.trim()
  if (!e.includes('@')) {
    emailMsg.value = '邮箱不合法'
    return
  }
  emailBusy.value = true
  emailMsg.value = ''
  try {
    emailMsg.value = await requestEmailBindCode(apiKey.value, e, captcha)
    emailCodeReady.value = true
  } catch (err) {
    emailMsg.value = err instanceof Error ? err.message : '发送失败'
  } finally {
    emailBusy.value = false
  }
}

async function submitEmailBind() {
  if (!apiKey.value || !emailCode.value.trim()) return
  emailBusy.value = true
  emailMsg.value = ''
  try {
    emailMsg.value = await bindEmail(apiKey.value, emailInput.value.trim(), emailCode.value.trim())
    emailBindOpen.value = false
    emailCodeReady.value = false
    destroyEmailGt()
    await auth.reloadAccount()
  } catch (e) {
    emailMsg.value = e instanceof Error ? e.message : '绑定失败'
  } finally {
    emailBusy.value = false
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

async function saveFunction() {
  if (!apiKey.value) return
  fnBusy.value = true
  fnMsg.value = ''
  try {
    await updateFunctionSettings(apiKey.value, {
      userListPageSize: listPageSize.value,
      userCommentViewMode: commentViewMode.value,
      userAvatarViewMode: avatarViewMode.value,
      userListViewMode: listViewMode.value,
      userIndexRedirectURL: indexRedirect.value.trim(),
      userNotifyStatus: notifyOn.value,
      userSubMailStatus: subMailOn.value,
      userKeyboardShortcutsStatus: keyboardOn.value,
      userReplyWatchArticleStatus: replyWatchOn.value,
      userForwardPageStatus: forwardPageOn.value,
      chatRoomPictureStatus: chatPicOn.value,
    })
    await auth.reloadAccount()
    fnMsg.value = '功能设置已保存'
  } catch (e) {
    fnMsg.value = e instanceof Error ? e.message : '功能设置失败'
  } finally {
    fnBusy.value = false
  }
}

async function submitTransfer() {
  if (!apiKey.value || !transferTo.value.trim()) return
  transferBusy.value = true
  transferMsg.value = ''
  try {
    await transferPoints(
      apiKey.value,
      transferTo.value.trim(),
      Number(transferAmount.value),
      transferMemo.value,
    )
    transferMsg.value = '转账成功'
    await auth.reloadAccount()
  } catch (e) {
    transferMsg.value = e instanceof Error ? e.message : '转账失败'
  } finally {
    transferBusy.value = false
  }
}

async function copyInvite() {
  if (!inviteLink.value) return
  copyMsg.value = ''
  try {
    await navigator.clipboard.writeText(inviteLink.value)
    copyMsg.value = '已复制'
    setTimeout(() => {
      copyMsg.value = ''
    }, 2000)
  } catch {
    copyMsg.value = '复制失败，请手动选择链接'
  }
}

async function doBuyInvite() {
  if (!apiKey.value) return
  inviteBusy.value = true
  inviteMsg.value = ''
  try {
    const msgText = await buyInvitecode(apiKey.value)
    const code = msgText.split(/\s+/)[0] || msgText
    boughtCodes.value = [{ code, memo: msgText }, ...boughtCodes.value]
    inviteMsg.value = msgText
    await auth.reloadAccount()
  } catch (e) {
    inviteMsg.value = e instanceof Error ? e.message : '兑换失败'
  } finally {
    inviteBusy.value = false
  }
}

async function doQueryInvite() {
  if (!apiKey.value || !inviteQuery.value.trim()) return
  inviteBusy.value = true
  inviteMsg.value = ''
  try {
    const r = await queryInvitecode(apiKey.value, inviteQuery.value.trim())
    inviteMsg.value = r.msg
  } catch (e) {
    inviteMsg.value = e instanceof Error ? e.message : '查询失败'
  } finally {
    inviteBusy.value = false
  }
}

async function onIdCert(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !apiKey.value) return
  idBusy.value = true
  idMsg.value = ''
  try {
    const urls = await uploadFiles(apiKey.value, [file])
    idCertUrl.value = urls[0] || ''
    if (!idCertUrl.value) throw new Error('上传未返回地址')
    idMsg.value = '资料已上传，可提交审核'
  } catch (e2) {
    idMsg.value = e2 instanceof Error ? e2.message : '上传失败'
  } finally {
    idBusy.value = false
    ;(e.target as HTMLInputElement).value = ''
  }
}

async function doSubmitIdentity() {
  if (!apiKey.value) return
  if (!idCertUrl.value) {
    idMsg.value = '请先上传营业执照复印件'
    return
  }
  idBusy.value = true
  idMsg.value = ''
  try {
    idMsg.value = await submitIdentity(apiKey.value, {
      type: '企业入驻认证',
      idCert: idCertUrl.value,
    })
  } catch (e) {
    idMsg.value = e instanceof Error ? e.message : '提交失败'
  } finally {
    idBusy.value = false
  }
}

async function doExport() {
  if (!apiKey.value) return
  exportBusy.value = true
  exportMsg.value = ''
  try {
    const url = await exportPosts(apiKey.value)
    exportMsg.value = '导出成功，正在打开下载…'
    window.open(url, '_blank', 'noopener')
  } catch (e) {
    exportMsg.value = e instanceof Error ? e.message : '导出失败'
  } finally {
    exportBusy.value = false
  }
}

async function saveI18n() {
  if (!apiKey.value) return
  i18nBusy.value = true
  i18nMsg.value = ''
  try {
    await updateI18nSettings(apiKey.value, {
      userLanguage: userLanguage.value,
      userTimezone: userTimezone.value,
    })
    i18nMsg.value = '已保存'
  } catch (e) {
    i18nMsg.value = e instanceof Error ? e.message : '保存失败'
  } finally {
    i18nBusy.value = false
  }
}
</script>

<template>
  <div class="page">
    <aside class="side">
      <nav class="menu">
        <RouterLink
          v-for="item in tabs"
          :key="item.id"
          :to="item.to"
          :class="{ current: tab === item.id || (item.id === 'profile' && tab === 'profile') }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <div class="main">
      <p v-if="!isLoggedIn" class="card hint">
        <RouterLink :to="{ path: '/login', query: { redirect: route.fullPath } }">登录</RouterLink>
        后可修改设置。游客仍可调整本机主题外观。
      </p>

      <section v-if="tab === 'profile'" class="card">
        <header class="mod-head">
          <RouterLink v-if="account?.userName" :to="`/member/${account.userName}`">{{ account.userName }}</RouterLink>
          <h1>资料</h1>
        </header>
        <form v-if="isLoggedIn" class="form" @submit.prevent="save">
          <label>昵称<input v-model="nickname" maxlength="32" /></label>
          <label>标签<input v-model="tags" placeholder="逗号分隔" /></label>
          <label>URL<input v-model="url" placeholder="https://" /></label>
          <label>简介<textarea v-model="intro" rows="3" maxlength="256" /></label>
          <label>QQ<input v-model="qq" maxlength="20" /></label>
          <label>MBTI<input v-model="mbti" maxlength="16" placeholder="如 ENTP / ENFP-A" /></label>
          <p v-if="account?.userCity" class="hint">当前城市：{{ account.userCity }}</p>
          <p v-if="msg" class="ok">{{ msg }}</p>
          <p v-if="err" class="err">{{ err }}</p>
          <button type="submit" class="primary" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
        </form>
      </section>

      <section v-if="tab === 'system'" class="card">
        <h1>个性化</h1>
        <p class="hint">主题免费。对话框和头像框的进阶样式后期仅 VIP 可用。</p>
        <AppearancePicker />
      </section>

      <section v-if="tab === 'avatar'" class="card">
        <h1>头像</h1>
        <template v-if="isLoggedIn">
          <div class="avatar-row">
            <img class="fp-avatar" :src="avatar || '/favicon.svg'" alt="" />
            <label class="file">
              {{ uploading ? '上传中…' : '更换头像' }}
              <input type="file" accept="image/*" :disabled="uploading" @change="onAvatar" />
            </label>
          </div>
          <p class="hint">经 RhyPic 上传后写入 <code>/api/settings/avatar</code>。</p>
          <p v-if="msg" class="ok">{{ msg }}</p>
          <p v-if="err" class="err">{{ err }}</p>
        </template>
      </section>

      <section v-if="tab === 'account'" class="card">
        <h1>账号</h1>
        <template v-if="isLoggedIn">
          <h2>用户名</h2>
          <label>当前用户名<input :value="account?.userName" type="text" readonly /></label>
          <label>新用户名<input v-model="newUsername" maxlength="20" placeholder="谨慎修改，有次数限制" /></label>
          <p v-if="nameMsg" :class="nameMsg.includes('失败') ? 'err' : 'ok'">{{ nameMsg }}</p>
          <button type="button" class="primary" :disabled="nameBusy || !newUsername.trim()" @click="saveUsername">
            {{ nameBusy ? '提交中…' : '保存用户名' }}
          </button>

          <h2>修改密码</h2>
          <label>当前密码<input v-model="oldPwd" type="password" autocomplete="current-password" /></label>
          <label>新密码<input v-model="newPwd" type="password" autocomplete="new-password" minlength="6" /></label>
          <label>确认新密码<input v-model="newPwd2" type="password" autocomplete="new-password" minlength="6" /></label>
          <p v-if="pwdMsg" class="ok">{{ pwdMsg }}</p>
          <p v-if="pwdErr" class="err">{{ pwdErr }}</p>
          <button type="button" class="primary" :disabled="pwdBusy || !oldPwd || !newPwd" @click="savePassword">
            {{ pwdBusy ? '提交中…' : '更新密码' }}
          </button>

          <h2>绑定手机</h2>
          <label>
            手机号
            <input v-model="phoneInput" type="tel" maxlength="11" :readonly="!phoneBindOpen || phoneCodeReady" />
          </label>
          <button v-if="!phoneBindOpen" type="button" class="primary" @click="openPhoneBind">
            {{ displayPhone ? '修改绑定手机' : '绑定手机' }}
          </button>
          <template v-else>
            <div v-show="!phoneCodeReady" ref="phoneCaptchaEl" class="captcha" />
            <p v-if="phoneGtError" class="err">{{ phoneGtError }}</p>
            <label v-if="phoneCodeReady">
              短信验证码
              <input v-model="phoneCode" maxlength="16" autocomplete="one-time-code" />
            </label>
            <button
              v-if="phoneCodeReady"
              type="button"
              class="primary"
              :disabled="phoneBusy || !phoneCode.trim()"
              @click="submitPhoneBind"
            >
              {{ phoneBusy ? '提交中…' : '确认绑定' }}
            </button>
            <button type="button" class="ghost-btn" @click="phoneBindOpen = false; destroyPhoneGt()">取消</button>
          </template>
          <p v-if="phoneMsg" :class="phoneMsg.includes('失败') || phoneMsg.includes('不合法') ? 'err' : 'ok'">
            {{ phoneMsg }}
          </p>

          <h2>绑定邮箱</h2>
          <label>
            邮箱
            <input
              v-model="emailInput"
              type="email"
              :readonly="!emailBindOpen || emailCodeReady"
              placeholder="未绑定"
            />
          </label>
          <button v-if="!emailBindOpen" type="button" class="primary" @click="openEmailBind">
            {{ displayEmail ? '修改绑定邮箱' : '绑定邮箱' }}
          </button>
          <template v-else>
            <div v-show="!emailCodeReady" ref="emailCaptchaEl" class="captcha" />
            <p v-if="emailGtError" class="err">{{ emailGtError }}</p>
            <label v-if="emailCodeReady">
              邮箱验证码
              <input v-model="emailCode" maxlength="16" autocomplete="one-time-code" />
            </label>
            <button
              v-if="emailCodeReady"
              type="button"
              class="primary"
              :disabled="emailBusy || !emailCode.trim()"
              @click="submitEmailBind"
            >
              {{ emailBusy ? '提交中…' : '确认绑定' }}
            </button>
            <button type="button" class="ghost-btn" @click="emailBindOpen = false; destroyEmailGt()">取消</button>
          </template>
          <p v-if="emailMsg" :class="emailMsg.includes('失败') || emailMsg.includes('不合法') ? 'err' : 'ok'">
            {{ emailMsg }}
          </p>

          <p class="hint">
            两步验证 / 背包 / 勋章佩戴请暂用
            <a href="https://fishpi.cn/settings/account" target="_blank" rel="noopener">现网账号页</a>。
          </p>
        </template>
      </section>

      <section v-if="tab === 'function'" class="card">
        <h1>功能</h1>
        <template v-if="isLoggedIn">
          <p class="hint">POST <code>/settings/function</code></p>
          <label>每页帖子数<input v-model.number="listPageSize" type="number" min="10" max="96" /></label>
          <label>
            评论展示
            <select v-model.number="commentViewMode">
              <option :value="0">传统</option>
              <option :value="1">实时</option>
            </select>
          </label>
          <label>
            头像显示
            <select v-model.number="avatarViewMode">
              <option :value="0">原图</option>
              <option :value="1">静态图</option>
            </select>
          </label>
          <label>
            列表模式
            <select v-model.number="listViewMode">
              <option :value="0">仅标题</option>
              <option :value="1">标题与摘要</option>
            </select>
          </label>
          <label>首页跳转 URL<input v-model="indexRedirect" placeholder="站内路径，可选" /></label>
          <div class="checks">
            <label class="check"><input v-model="notifyOn" type="checkbox" />启用通知</label>
            <label class="check"><input v-model="subMailOn" type="checkbox" />邮件订阅</label>
            <label class="check"><input v-model="keyboardOn" type="checkbox" />键盘快捷键</label>
            <label class="check"><input v-model="replyWatchOn" type="checkbox" />回复时关注帖</label>
            <label class="check"><input v-model="forwardPageOn" type="checkbox" />使用跳转页</label>
            <label class="check"><input v-model="chatPicOn" type="checkbox" />聊天室显示图片</label>
          </div>
          <p v-if="fnMsg" :class="fnMsg.includes('失败') ? 'err' : 'ok'">{{ fnMsg }}</p>
          <button type="button" class="primary" :disabled="fnBusy" @click="saveFunction">
            {{ fnBusy ? '保存中…' : '保存功能设置' }}
          </button>
          <h2>表情包</h2>
          <EmojiPacks />
        </template>
      </section>

      <section v-if="tab === 'privacy'" class="card">
        <h1>隐私</h1>
        <template v-if="isLoggedIn">
          <p class="hint">我们会尊重和保护你的隐私。勾选表示对该项公开。</p>
          <div class="checks">
            <label v-for="item in privacyItems" :key="item.key" class="check">
              <input v-model="privacyFlags[item.key]" type="checkbox" />
              {{ item.label }}
            </label>
          </div>
          <p v-if="privacyMsg" :class="privacyMsg.includes('失败') ? 'err' : 'ok'">{{ privacyMsg }}</p>
          <button type="button" class="primary" :disabled="privacyBusy" @click="savePrivacy">
            {{ privacyBusy ? '保存中…' : '保存隐私设置' }}
          </button>

          <h2>地理位置</h2>
          <p class="hint">地理位置信息会根据当前 IP 进行自动定位。</p>
          <label>
            当前城市
            <input :value="account?.userCity || '未知'" type="text" readonly />
          </label>
          <label>
            可见性
            <select v-model.number="geoStatus" :disabled="geoBusy">
              <option :value="0">公开</option>
              <option :value="1">私密</option>
            </select>
          </label>
          <button type="button" class="primary" :disabled="geoBusy" @click="saveGeo">
            {{ geoBusy ? '提交中…' : '保存地理位置' }}
          </button>
          <p v-if="geoMsg" :class="geoMsg.includes('失败') ? 'err' : 'ok'">{{ geoMsg }}</p>
        </template>
      </section>

      <section v-if="tab === 'profession'" class="card">
        <h1>职业成长</h1>
        <template v-if="isLoggedIn">
          <p class="hint">读取 <code>GET /api/profession/me</code>，写入主职业/隐私。</p>
          <ul v-if="jobs.length" class="jobs">
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
          <button type="button" class="primary" :disabled="jobBusy || !primaryJob" @click="savePrimary">
            {{ jobBusy ? '提交中…' : '保存主职业' }}
          </button>
          <label>
            隐私
            <select v-model="privacy" :disabled="jobBusy">
              <option v-for="opt in privacyOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </label>
          <button type="button" class="primary" :disabled="jobBusy" @click="saveJobPrivacy">
            {{ jobBusy ? '提交中…' : '保存隐私' }}
          </button>
          <p v-if="jobMsg" :class="jobMsg.includes('失败') ? 'err' : 'ok'">{{ jobMsg }}</p>
        </template>
      </section>

      <section v-if="tab === 'point'" class="card">
        <header class="mod-head">
          <h1>积分转账</h1>
          <RouterLink to="/points">流水</RouterLink>
        </header>
        <template v-if="isLoggedIn">
          <p class="hint">
            当前余额约 {{ account?.userPoint ?? '—' }} 积分。转账收取 1% 手续费（100
            积分以内固定 1 积分；VIP4 免税）。
          </p>
          <label>收款用户名<input v-model="transferTo" maxlength="64" placeholder="userName" /></label>
          <label>数量<input v-model.number="transferAmount" type="number" min="1" /></label>
          <label>备注<input v-model="transferMemo" maxlength="64" /></label>
          <p v-if="transferMsg" :class="transferMsg.includes('失败') ? 'err' : 'ok'">{{ transferMsg }}</p>
          <button
            type="button"
            class="primary"
            :disabled="transferBusy || !transferTo.trim()"
            @click="submitTransfer"
          >
            {{ transferBusy ? '提交中…' : '确认转账' }}
          </button>
        </template>
      </section>

      <section v-if="tab === 'invite'" class="card">
        <h1>邀请</h1>
        <template v-if="isLoggedIn">
          <h2>邀请链接</h2>
          <label>
            分享给好友注册
            <input :value="inviteLink" type="text" readonly @focus="($event.target as HTMLInputElement).select()" />
          </label>
          <button type="button" class="primary" :disabled="!inviteLink" @click="copyInvite">
            {{ copyMsg || '复制链接' }}
          </button>
          <h2>积分兑换邀请码</h2>
          <button type="button" class="primary danger" :disabled="inviteBusy" @click="doBuyInvite">
            {{ inviteBusy ? '处理中…' : '确认兑换' }}
          </button>
          <ul v-if="boughtCodes.length" class="code-list">
            <li v-for="(item, i) in boughtCodes" :key="i">
              <code>{{ item.code }}</code>
              <span>{{ item.memo }}</span>
            </li>
          </ul>
          <h2>查询邀请码状态</h2>
          <label>邀请码<input v-model="inviteQuery" placeholder="输入邀请码" /></label>
          <button type="button" class="primary" :disabled="inviteBusy || !inviteQuery.trim()" @click="doQueryInvite">
            查询
          </button>
          <p v-if="inviteMsg" :class="inviteMsg.includes('失败') || inviteMsg.includes('不') ? 'err' : 'ok'">
            {{ inviteMsg }}
          </p>
        </template>
      </section>

      <section v-if="tab === 'identity'" class="card">
        <h1>官方身份认证</h1>
        <template v-if="isLoggedIn">
          <p class="hint">
            摸鱼派为企业入驻等场景提供官方认证。通过后可领取对应勋章。审核材料仅审核员可见，审核后销毁。详见
            <RouterLink to="/privacy">隐私政策</RouterLink>。
          </p>
          <label>
            认证类别
            <select disabled>
              <option selected>企业入驻认证</option>
            </select>
          </label>
          <p class="hint">申请后我们会通过私信联系你补交企业信息、官网、Logo 等，用于定制专属勋章。</p>
          <div class="id-upload">
            <button
              type="button"
              class="id-thumb"
              :style="{ backgroundImage: `url(${idCertUrl || identityPlaceholder})` }"
              :disabled="idBusy"
              @click="idFile?.click()"
            />
            <input ref="idFile" type="file" accept="image/*" class="hidden" @change="onIdCert" />
            <span class="hint">点击上传营业执照复印件</span>
          </div>
          <p v-if="idMsg" :class="idMsg.includes('失败') || idMsg.includes('请先') ? 'err' : 'ok'">{{ idMsg }}</p>
          <button type="button" class="primary" :disabled="idBusy" @click="doSubmitIdentity">
            {{ idBusy ? '处理中…' : '提交审核' }}
          </button>
        </template>
      </section>

      <section v-if="tab === 'data'" class="card">
        <h1>数据导出</h1>
        <template v-if="isLoggedIn">
          <p class="hint">
            帖子：{{ account?.userArticleCount ?? '—' }}　　评论：{{ account?.userCommentCount ?? '—' }}
          </p>
          <button type="button" class="primary danger" :disabled="exportBusy" @click="doExport">
            {{ exportBusy ? '导出中…' : '导出' }}
          </button>
          <p v-if="exportMsg" :class="exportMsg.includes('失败') ? 'err' : 'ok'">{{ exportMsg }}</p>
        </template>
      </section>

      <section v-if="tab === 'i18n'" class="card">
        <h1>语言与时区</h1>
        <template v-if="isLoggedIn">
          <label>
            语言
            <select v-model="userLanguage">
              <option v-for="opt in languageOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </label>
          <label>
            时区
            <select v-model="userTimezone">
              <option v-for="opt in timezoneOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </label>
          <p v-if="i18nMsg" :class="i18nMsg.includes('失败') ? 'err' : 'ok'">{{ i18nMsg }}</p>
          <button type="button" class="primary" :disabled="i18nBusy" @click="saveI18n">
            {{ i18nBusy ? '保存中…' : '保存' }}
          </button>
        </template>
      </section>

      <section v-if="tab === 'help'" class="card">
        <h1>使用指南</h1>
        <ul class="help-list">
          <li v-for="item in helpLinks" :key="item.to">
            <RouterLink :to="item.to">{{ item.title }}</RouterLink>
            <span>{{ item.tip }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
  max-width: 960px;
}
.side {
  position: sticky;
  top: calc(var(--fp-nav-h) + 12px);
}
.menu {
  display: flex;
  flex-direction: column;
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 8px;
  overflow: hidden;
}
.menu a {
  padding: 10px 14px;
  color: var(--fp-text);
  text-decoration: none;
  font-size: 14px;
  border-left: 3px solid transparent;
}
.menu a:hover {
  background: var(--fp-hover);
}
.menu a.current {
  color: var(--fp-primary);
  border-left-color: var(--fp-primary);
  font-weight: 600;
  background: var(--fp-hover);
}
.main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.card {
  background: var(--fp-card);
  box-shadow: var(--fp-card-shadow);
  border-radius: 8px;
  padding: 18px 20px;
}
.mod-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.mod-head a {
  color: var(--fp-link);
  text-decoration: none;
}
h1 {
  margin: 0 0 12px;
  font-size: 18px;
  color: var(--fp-head);
}
h2 {
  margin: 18px 0 8px;
  font-size: 15px;
  color: var(--fp-head);
}
.hint {
  color: var(--fp-muted);
  font-size: 13px;
}
.form,
.card {
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
  border-radius: 6px;
  padding: 8px 10px;
}
input[readonly] {
  opacity: 0.75;
}
.checks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.check {
  flex-direction: row;
  align-items: center;
  gap: 8px;
}
.check input {
  width: auto;
}
.avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.fp-avatar {
  width: 72px;
  height: 72px;
}
.file {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--fp-border);
  border-radius: 6px;
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
.primary {
  align-self: flex-end;
  border: 0;
  background: var(--fp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
}
.primary.danger {
  background: #c45c4a;
}
.ghost-btn {
  align-self: flex-end;
  border: 1px solid var(--fp-border);
  background: transparent;
  color: var(--fp-muted);
  border-radius: 6px;
  padding: 8px 16px;
  cursor: pointer;
}
.captcha {
  min-height: 44px;
}
.code-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 13px;
}
.code-list li {
  padding: 6px 0;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.code-list code {
  background: var(--fp-bg);
  padding: 2px 6px;
  border-radius: 4px;
}
.id-upload {
  display: flex;
  align-items: center;
  gap: 12px;
}
.id-thumb {
  width: 96px;
  height: 96px;
  border: 1px dashed var(--fp-border);
  border-radius: 8px;
  background-size: cover;
  background-position: center;
  cursor: pointer;
  padding: 0;
}
.hidden {
  display: none;
}
.help-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.help-list li {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 0;
  border-bottom: 1px solid var(--fp-border);
}
.help-list a {
  color: var(--fp-link);
  text-decoration: none;
  font-size: 15px;
}
.help-list span {
  font-size: 12px;
  color: var(--fp-muted);
}
.ok {
  color: var(--fp-primary);
  font-size: 13px;
}
.err {
  color: #e07a5f;
  font-size: 13px;
}
.jobs {
  list-style: none;
  margin: 0;
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
@media (max-width: 800px) {
  .page {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
  }
  .menu {
    flex-direction: row;
    flex-wrap: wrap;
  }
  .menu a {
    border-left: 0;
    border-bottom: 2px solid transparent;
  }
  .menu a.current {
    border-bottom-color: var(--fp-primary);
  }
  .checks {
    grid-template-columns: 1fr;
  }
}
</style>

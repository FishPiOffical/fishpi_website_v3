<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useMemberPage } from '@/composables/useMemberPage'
import { usePageSeo } from '@/composables/usePageSeo'
import ArticleFeed from '@/components/articles/ArticleFeed.vue'
import { commentLink } from '@/api/v3-comment-location'
import BreezemoonList from '@/components/breezemoons/BreezemoonList.vue'
import PublicProfessions from '@/components/profession/PublicProfessions.vue'
import VipNickname from '@/components/user/VipNickname.vue'
import UserFollowButton from '@/components/user/UserFollowButton.vue'
import ReportDialog from '@/components/ReportDialog.vue'
import PointTransfer from '@/components/settings/PointTransfer.vue'
import { avatarUrl, DEFAULT_AVATAR } from '@/utils/avatar'
function onAvatarError(event: Event) {
  const image = event.currentTarget as HTMLImageElement | null
  if (image && image.getAttribute('src') !== DEFAULT_AVATAR) image.src = DEFAULT_AVATAR
}
const route = useRoute(), auth = useAuthStore(), userName = computed(() => String(route.params.userName || ''))
const activeTab = computed(() => String(route.meta.memberTab || 'home')), moonId = computed(() => String(route.params.breezemoonId || ''))
const { profile, profileError, profileLoading, content, moon, contentError, contentLoading, p, readProfile, readContent } = useMemberPage(userName, activeTab, moonId)
const base = computed(() => `/member/${encodeURIComponent(userName.value)}`), viewSelf = computed(() => !!profile.value && auth.account?.oId === profile.value.id)
const showTransfer = ref(false), panel = ref<HTMLElement | null>(null)
watch([userName, () => auth.account?.oId, () => auth.accessToken], () => { showTransfer.value = false })
let lastPage = 1
watch(content, data => { if (!data) return; const moved = lastPage !== data.p; lastPage = data.p; if (moved) void nextTick(() => { if (content.value === data) panel.value?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }) }) })
const tabs = computed(() => [['', '帖子'], ['long', '长文章'], ['comments', '回帖'], ['breezemoons', '清风明月'], ['profession', '职业资料'], ['medals', '公开勋章'], ['following/users', '关注用户'], ['followers', '关注者'], ['following/tags', '关注标签'], ['watching/articles', '关注帖子'], ['following/articles', '收藏帖子'], ...(viewSelf.value ? [['articles/anonymous', '匿贴'], ['comments/anonymous', '匿回']] : [])])
usePageSeo(() => ({ title: `${profile.value?.userNickname || userName.value} 的主页`, description: profile.value?.userIntro || `${userName.value} 在摸鱼派的个人主页`, path: route.path, image: profile.value?.userAvatarURL, type: 'profile' }))
</script>
<template>
  <div class="member-page">
    <aside class="member-profile">
      <p v-if="profileLoading" role="status">正在读取用户资料…</p>
      <div v-if="profileError" role="alert"><p>{{ profileError }}</p><button type="button" @click="readProfile">重试用户资料</button></div>
      <template v-else-if="profile">
        <img :key="avatarUrl(profile)" class="member-avatar" :src="avatarUrl(profile)" alt="" :data-user-card="profile.userName" @error="onAvatarError" />
        <h1><VipNickname :user-id="profile.id" :user-name="profile.userName" :text="profile.userNickname || profile.userName" /></h1>
        <p>@{{ profile.userName }}</p><p class="intro">{{ profile.userIntro }}</p>
        <a v-if="profile.userURL" :href="profile.userURL" target="_blank" rel="noopener noreferrer">个人主页</a>
        <div v-if="auth.isLoggedIn" class="member-actions">
          <RouterLink v-if="viewSelf" to="/settings">编辑资料</RouterLink>
          <template v-else>
            <UserFollowButton :user-name="profile.userName" :user-id="profile.id" />
            <RouterLink :to="`/chat?toUser=${encodeURIComponent(profile.userName)}`">发私信</RouterLink>
            <button type="button" @click="showTransfer = !showTransfer">转账</button>
            <ReportDialog :data-id="profile.id" :data-type="2" />
          </template>
        </div>
      </template>
      <p v-else-if="!profileLoading && !profileError" role="status">用户资料尚未读取。</p>
    </aside>
    <PointTransfer v-if="showTransfer && profile && auth.isLoggedIn && !viewSelf" :initial-recipient="profile.userName" />
    <main ref="panel" class="member-content">
      <nav aria-label="用户主页栏目"><RouterLink v-for="tab in tabs" :key="tab[0]" :to="`${base}${tab[0] ? '/' + tab[0] : ''}`">{{ tab[1] }}</RouterLink><RouterLink v-if="viewSelf" to="/points">我的积分</RouterLink></nav>
      <PublicProfessions v-if="activeTab === 'profession'" :user-name="userName" />
      <p v-else-if="activeTab === 'points'">积分流水仅本人可在<RouterLink to="/points">我的积分</RouterLink>查看。</p>
      <template v-else>
        <h2>{{ activeTab === 'long' ? '长文章' : activeTab === 'comments' ? '公开回帖' : activeTab === 'breezemoons' ? '清风明月' : '公开帖子' }}</h2>
        <button type="button" class="refresh-member-btn" :disabled="contentLoading" @click="readContent()">刷新用户内容</button>
        <p v-if="contentLoading" role="status">正在读取用户内容…</p>
        <div v-else-if="contentError" role="alert"><p>{{ contentError }}</p><button type="button" @click="readContent()">重试用户内容</button><button v-if="p > 1" type="button" @click="readContent(1)">返回第一页</button></div>
        <template v-else-if="moon"><BreezemoonList :items="[moon]" /><RouterLink :to="`${base}/breezemoons`">查看全部清风明月</RouterLink></template>
        <template v-else-if="content">
          <p>共 {{ content.total }} 条</p>
          <ArticleFeed v-if="activeTab === 'home' || activeTab === 'long'" :items="content.articles" empty="本页没有可见文章" />
          <BreezemoonList v-else-if="activeTab === 'breezemoons'" :items="content.moons"><template #actions="{ item }"><RouterLink :to="`${base}/breezemoons/${item.id}`">查看这条清风</RouterLink></template></BreezemoonList>
          <ul v-else class="member-comments"><li v-for="item in content.comments" :key="item.id"><RouterLink :to="commentLink(item.articleId,item.id)">{{ item.article.articleTitle }}</RouterLink><time :datetime="item.comment.commentCreateTimeStr">{{ item.comment.commentCreateTimeStr }}</time><div v-if="item.comment.commentContentVisible" class="comment-body" v-html="item.comment.commentContent" /><p v-else>私密评论正文不可见。</p></li></ul>
          <p v-if="!content.total && activeTab !== 'home' && activeTab !== 'long'">没有可见记录。</p>
          <div class="member-pager"><button type="button" :disabled="p <= 1" @click="readContent(p - 1)">上一页用户内容</button><span>第 {{ p }} 页 / 共 {{ content.pageCount }} 页</span><button type="button" :disabled="p >= content.pageCount" @click="readContent(p + 1)">下一页用户内容</button></div>
        </template>
        <p v-else role="status">用户内容尚未读取。</p>
      </template>
    </main>
  </div>
</template>
<style scoped lang="scss">
.member-page { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 24px; padding: 20px; max-width: 1200px; margin: auto; align-items: start; }
.member-profile { padding: 20px; background: var(--fp-card); border: 1px solid var(--fp-border); border-radius: 10px; overflow-wrap: anywhere; h1 { font-size: 22px; } .intro { white-space: pre-wrap; } }
.member-avatar { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; }
.member-content { min-width: 0; scroll-margin-top: 88px; .refresh-member-btn { display: none; } } nav, .member-actions, .member-pager { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; } nav .router-link-exact-active { font-weight: 700; text-decoration: underline; } nav { padding-bottom: 16px; border-bottom: 1px solid var(--fp-border); } a { color: var(--fp-link); text-decoration: none; } p, time { color: var(--fp-muted); } time { display: block; font-size: 12px; margin-top: 8px; } button { padding: 7px 10px; border: 1px solid var(--fp-border); border-radius: 6px; background: var(--fp-card); color: var(--fp-text); cursor: pointer; &:disabled { opacity: .5; cursor: default; } } [role=alert] { color: #bd503c; }
.member-comments { list-style: none; margin: 16px 0; padding: 0; li { padding: 16px 0; border-bottom: 1px solid var(--fp-border); } } .comment-body { overflow-wrap: anywhere; overflow: auto; :deep(img) { max-width: 100%; height: auto; } :deep(pre) { overflow: auto; } }
@media(max-width: 900px) { .member-page { grid-template-columns: minmax(0, 1fr); padding: 12px; } }
</style>

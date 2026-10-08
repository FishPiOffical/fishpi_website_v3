import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  type RouteLocation,
  type RouterHistory,
} from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAppearanceStore } from '@/stores/appearance'

const routes = [
  { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { robots: 'noindex' } },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/views/RegisterView.vue'),
    meta: { robots: 'noindex' },
  },
  {
    path: '/cr',
    name: 'chatroom',
    component: () => import('@/views/ChatroomView.vue'),
    meta: { robots: 'noindex' },
  },
  { path: '/article/:id', name: 'article', component: () => import('@/views/ArticleView.vue') },
  { path: '/hot', component: () => import('@/views/ArticleListView.vue'), meta: { title: '热门', list: 'hot' } },
  {
    path: '/recent',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '最新', list: 'recent' },
  },
  {
    path: '/recent/hot',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '热门', list: 'hot' },
  },
  {
    path: '/recent/good',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '好评', list: 'good' },
  },
  {
    path: '/recent/reply',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '最近回帖', list: 'reply' },
  },
  {
    path: '/recent/long',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '专栏', list: 'long' },
  },
  {
    path: '/column',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '专栏', list: 'long' },
  },
  {
    path: '/top/checkin',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '连签榜' },
  },
  {
    path: '/top/online',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '在线榜' },
  },
  {
    path: '/top/balance',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '财富榜' },
  },
  {
    path: '/top/consumption',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '消费榜' },
  },
  {
    path: '/top/profession',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '职业榜' },
  },
  {
    path: '/top/donate',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '鱼排续命师' },
  },
  {
    path: '/top/perfect',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '优选排行' },
  },
  {
    path: '/top/invite',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '邀请排行' },
  },
  {
    path: '/top/xiaoice',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '小冰游戏排行' },
  },
  {
    path: '/top/evolve',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '进化排行榜' },
  },
  {
    path: '/top/adr',
    component: () => import('@/views/TopView.vue'),
    meta: { title: 'ADR 游戏总分排行' },
  },
  {
    path: '/top/mofish',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '摸鱼大闯关排行' },
  },
  {
    path: '/top/smallmofish',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '摸鱼小闯关排行' },
  },
  {
    path: '/top/lifeRestart',
    component: () => import('@/views/TopView.vue'),
    meta: { title: '人生重开模拟器排行' },
  },
  {
    path: '/top/emoji',
    component: () => import('@/views/TopView.vue'),
    meta: { title: 'Emoji 真假小黄脸排行' },
  },
  { path: '/qna', component: () => import('@/views/ArticleListView.vue'), meta: { title: '问答', list: 'qna' } },
  {
    path: '/perfect',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '优选', list: 'perfect' },
  },
  {
    path: '/search',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '搜索', list: 'search', robots: 'noindex' },
  },
  {
    path: '/domain/:uri',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '领域', list: 'domain' },
  },
  {
    path: '/pre-post',
    component: () => import('@/views/PrePostView.vue'),
    meta: { auth: true, robots: 'noindex' },
  },
  {
    path: '/post/long',
    component: () => import('@/views/PostView.vue'),
    meta: { auth: true, robots: 'noindex', long: true },
  },
  {
    path: '/post/:id',
    name: 'edit-post',
    component: () => import('@/views/PostView.vue'),
    meta: { auth: true, robots: 'noindex' },
  },
  { path: '/post', name: 'post', component: () => import('@/views/PostView.vue'), meta: { auth: true, robots: 'noindex' } },
  { path: '/good', component: () => import('@/views/ArticleListView.vue'), meta: { title: '点赞', list: 'good' } },
  {
    path: '/tags/:tag',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '标签', list: 'tag' },
  },
  {
    path: '/stars',
    name: 'stars',
    component: () => import('@/views/CollectionsView.vue'),
    meta: { auth: true, robots: 'noindex' },
  },
  {
    path: '/points',
    name: 'points',
    component: () => import('@/views/PointsView.vue'),
    meta: { auth: true, robots: 'noindex' },
  },
  {
    path: '/forget-pwd',
    name: 'forget-pwd',
    component: () => import('@/views/ForgetPwdView.vue'),
    meta: { robots: 'noindex' },
  },
  {
    path: '/reset-pwd',
    name: 'reset-pwd',
    component: () => import('@/views/ResetPwdView.vue'),
    meta: { robots: 'noindex' },
  },
  { path: '/following', redirect: '/watch' },
  ...([['/watch', 'tags'], ['/watch/users', 'users'], ['/watch/breezemoons', 'breezemoons']] as const).map(
    ([path, watchTab]) => ({
      path,
      component: () => import('@/views/WatchView.vue'),
      meta: { auth: true, robots: 'noindex', watchTab },
    }),
  ),
  {
    path: '/activity',
    name: 'activity',
    component: () => import('@/views/ActivityView.vue'),
  },
  {
    path: '/download',
    name: 'download',
    component: () => import('@/views/DownloadView.vue'),
  },
  {
    path: '/agreement',
    name: 'agreement',
    component: () => import('@/views/LegalView.vue'),
    meta: { legal: 'agreement' },
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('@/views/LegalView.vue'),
    meta: { legal: 'privacy' },
  },
  {
    path: '/city/:cityName',
    name: 'city',
    component: () => import('@/views/CityView.vue'),
    meta: { robots: 'noindex' },
  },
  { path: '/member/:userName/following', redirect: (to: RouteLocation) => `/member/${String(to.params.userName)}/following/users` },
  ...(
    [
      ['long', 'long'],
      ['comments', 'comments'],
      ['articles/anonymous', 'articlesAnonymous'],
      ['comments/anonymous', 'commentsAnonymous'],
      ['watching/articles', 'watchingArticles'],
      ['following/users', 'followingUsers'],
      ['following/tags', 'followingTags'],
      ['following/articles', 'followingArticles'],
      ['followers', 'followers'],
      ['breezemoons', 'breezemoons'],
      ['breezemoons/:breezemoonId', 'breezemoons'],
      ['points', 'points'],
      ['profession', 'profession'],
    ] as const
  ).map(([sub, memberTab]) => ({
    path: `/member/:userName/${sub}`,
    component: () => import('@/views/MemberView.vue'),
    meta: { memberTab },
  })),
  {
    path: '/member/:userName/medals',
    name: 'medals',
    component: () => import('@/views/MedalsView.vue'),
  },
  { path: '/domains', component: () => import('@/views/DomainView.vue') },
  { path: '/tags', component: () => import('@/views/TagsView.vue') },
  { path: '/breezemoons', component: () => import('@/views/BreezemoonView.vue') },
  { path: '/repeater', component: () => import('@/views/RepeaterView.vue') },
  { path: '/logs', component: () => import('@/views/LogsView.vue'), meta: { auth: true, robots: 'noindex' } },
  { path: '/top', component: () => import('@/views/TopView.vue') },
  { path: '/member/:userName', name: 'member', component: () => import('@/views/MemberView.vue') },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('@/views/NotificationsView.vue'),
    meta: { auth: true, robots: 'noindex' },
  },
  {
    path: '/chat/:userName',
    name: 'whisper',
    component: () => import('@/views/WhisperView.vue'),
    meta: { auth: true, robots: 'noindex' },
  },
  {
    path: '/chat',
    name: 'whispers',
    component: () => import('@/views/WhisperListView.vue'),
    meta: { auth: true, robots: 'noindex' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'profile' },
  },
  {
    path: '/settings/account',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'account' },
  },
  {
    path: '/settings/function',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'function' },
  },
  {
    path: '/settings/system',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'system' },
  },
  {
    path: '/settings/avatar',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'avatar' },
  },
  {
    path: '/settings/profession',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'profession' },
  },
  {
    path: '/settings/privacy',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'privacy' },
  },
  {
    path: '/settings/point',
    name: 'transfer',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'point' },
  },
  {
    path: '/settings/invite',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'invite' },
  },
  {
    path: '/settings/identity',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'identity' },
  },
  {
    path: '/settings/data',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'data' },
  },
  {
    path: '/settings/i18n',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'i18n' },
  },
  {
    path: '/settings/help',
    component: () => import('@/views/SettingsView.vue'),
    meta: { robots: 'noindex', settingsTab: 'help' },
  },
  {
    path: '/column/:columnId',
    name: 'column',
    component: () => import('@/views/ColumnView.vue'),
  },
  {
    path: '/charge/point',
    name: 'charge-point',
    component: () => import('@/views/ChargePointView.vue'),
    meta: { robots: 'noindex' },
  },
  {
    path: '/games',
    name: 'games',
    component: () => import('@/views/GamesView.vue'),
  },
  {
    path: '/vips',
    name: 'vips',
    component: () => import('@/views/VipView.vue'),
    meta: { robots: 'noindex' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { robots: 'noindex' },
  },
]

export function createAppRouter(history?: RouterHistory) {
  const router = createRouter({
    history: history || (import.meta.env.SSR ? createMemoryHistory() : createWebHistory()),
    routes,
  })

  router.beforeEach(async (to) => {
    // SSR 不知道登录态：需登录页由 AppShell 输出空占位，客户端再决定渲染或跳登录。
    if (import.meta.env.SSR) return true
    const auth = useAuthStore()
    if (!auth.account && auth.apiKey) {
      await auth.restore()
      useAppearanceStore().enforceVip()
    }
    if (to.meta.auth && !auth.isLoggedIn) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
    return true
  })

  return router
}

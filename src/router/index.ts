import { createMemoryHistory, createRouter, createWebHistory, type RouterHistory } from 'vue-router'
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
    meta: { auth: true, robots: 'noindex' },
  },
  { path: '/article/:id', name: 'article', component: () => import('@/views/ArticleView.vue') },
  { path: '/hot', component: () => import('@/views/ArticleListView.vue'), meta: { title: '热门', list: 'hot' } },
  {
    path: '/recent/long',
    component: () => import('@/views/ArticleListView.vue'),
    meta: { title: '专栏', list: 'long' },
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
    path: '/settings/point',
    name: 'transfer',
    component: () => import('@/views/TransferView.vue'),
    meta: { auth: true, robots: 'noindex' },
  },
  {
    path: '/following',
    name: 'following-feed',
    component: () => import('@/views/FollowingView.vue'),
    meta: { auth: true, robots: 'noindex' },
  },
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
  {
    path: '/member/:userName/following',
    component: () => import('@/views/PeopleView.vue'),
    meta: { people: 'following' },
  },
  {
    path: '/member/:userName/followers',
    component: () => import('@/views/PeopleView.vue'),
    meta: { people: 'followers' },
  },
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
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { robots: 'noindex' } },
]

export function createAppRouter(history?: RouterHistory) {
  const router = createRouter({
    history: history || (import.meta.env.SSR ? createMemoryHistory() : createWebHistory()),
    routes,
  })

  router.beforeEach(async (to) => {
    if (import.meta.env.SSR) {
      if (to.meta.auth) return { path: '/login', query: { redirect: to.fullPath } }
      return true
    }
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

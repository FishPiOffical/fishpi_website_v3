import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    { path: '/register', name: 'register', component: () => import('@/views/RegisterView.vue') },
    {
      path: '/cr',
      name: 'chatroom',
      component: () => import('@/views/ChatroomView.vue'),
      meta: { auth: true },
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
    { path: '/search', component: () => import('@/views/ArticleListView.vue'), meta: { title: '搜索', list: 'search' } },
    {
      path: '/domain/:uri',
      component: () => import('@/views/ArticleListView.vue'),
      meta: { title: '领域', list: 'domain' },
    },
    { path: '/post', name: 'post', component: () => import('@/views/PostView.vue'), meta: { auth: true } },
    { path: '/domains', component: () => import('@/views/DomainView.vue') },
    { path: '/breezemoons', component: () => import('@/views/BreezemoonView.vue') },
    { path: '/top', component: () => import('@/views/TopView.vue') },
    { path: '/member/:userName', name: 'member', component: () => import('@/views/MemberView.vue') },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('@/views/NotificationsView.vue'),
      meta: { auth: true },
    },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.account && auth.apiKey) await auth.restore()
  if (to.meta.auth && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router

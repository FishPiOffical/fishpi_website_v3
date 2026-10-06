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
    { path: '/hot', component: () => import('@/views/PlaceholderView.vue'), meta: { title: '热门' } },
    { path: '/recent/long', component: () => import('@/views/PlaceholderView.vue'), meta: { title: '专栏' } },
    { path: '/domains', component: () => import('@/views/PlaceholderView.vue'), meta: { title: '领域' } },
    { path: '/breezemoons', component: () => import('@/views/PlaceholderView.vue'), meta: { title: '清风明月' } },
    { path: '/qna', component: () => import('@/views/PlaceholderView.vue'), meta: { title: '问答' } },
    { path: '/perfect', component: () => import('@/views/PlaceholderView.vue'), meta: { title: '优选' } },
    { path: '/top', component: () => import('@/views/PlaceholderView.vue'), meta: { title: '总榜' } },
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

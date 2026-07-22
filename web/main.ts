import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { trpc, trpcClient } from './providers/trpc'
import { useAuth } from './composables/useAuth'
import App from './App.vue'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min before refetch
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

const app = createApp(App)

app.use(VueQueryPlugin, { queryClient })
app.use(trpc, { client: trpcClient })

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./pages/Home.vue') },
    { path: '/users', name: 'users', component: () => import('./pages/Users.vue') },
    { path: '/posts', name: 'posts', component: () => import('./pages/Posts.vue') },
    { path: '/comments', name: 'comments', component: () => import('./pages/Comments.vue') },
    { path: '/albums', name: 'albums', component: () => import('./pages/Albums.vue') },
    { path: '/photos', name: 'photos', component: () => import('./pages/Photos.vue') },
    { path: '/todos', name: 'todos', component: () => import('./pages/Todos.vue') },
    { path: '/admin/settings', name: 'admin-settings', component: () => import('./pages/Settings.vue'), meta: { requiresAuth: true } },
  ],
})

router.beforeEach((to) => {
  const { isAuthenticated } = useAuth()
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    return { name: 'home' }
  }
})

app.use(router)
app.mount('#root')

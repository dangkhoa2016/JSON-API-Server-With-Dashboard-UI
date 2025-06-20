import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { TRPCUntypedClient, httpBatchLink } from '@trpc/client'
import superjson from 'superjson'
import { trpc } from './providers/trpc'
import App from './App.vue'
import './index.css'
import type { AppRouter } from '../api/router'

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
app.use(trpc, {
  client: new TRPCUntypedClient<AppRouter>({
    links: [
      httpBatchLink({
        url: '/api/trpc',
        transformer: superjson,
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: 'include',
          })
        },
      }),
    ],
  }),
})

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
  ],
})

app.use(router)
app.mount('#root')

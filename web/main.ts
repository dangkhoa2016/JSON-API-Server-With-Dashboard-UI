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
  routes: [],
})

app.use(router)
app.mount('#root')

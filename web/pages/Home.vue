<script setup lang="ts">
import { computed, watch, type Component } from 'vue'
import { trpc } from '@/providers/trpc'
import {
  Users,
  FileText,
  MessageSquare,
  Image,
  Images,
  CheckSquare,
  Database,
  Zap,
  Shield,
} from '@lucide/vue'
import { toast } from 'vue-sonner'

const { data: countsData, isLoading, isError } = trpc.json.getCounts.useQuery(undefined, {
  staleTime: 30_000,
})

watch(() => isError.value, (err) => {
  if (err) toast.error('Failed to load dashboard counts')
})

const loading = computed(() => isLoading.value)

const counts = computed<Record<string, number>>(() => ({
  users: countsData.value?.users ?? 0,
  posts: countsData.value?.posts ?? 0,
  comments: countsData.value?.comments ?? 0,
  albums: countsData.value?.albums ?? 0,
  photos: countsData.value?.photos ?? 0,
  todos: countsData.value?.todos ?? 0,
}))

interface FeatureCard {
  key: string
  label: string
  description: string
  icon: Component
  iconBg: string
  iconColor: string
  healthy?: boolean
}

const iconMap: Record<string, Component> = { Database, Zap, Shield }

const { data: featureCardsData, isLoading: isFeatureCardsLoading } = trpc.json.getFeatureCards.useQuery()

const featureCards = computed<FeatureCard[]>(() =>
  (featureCardsData.value ?? []).map((card: Record<string, unknown>) => ({
    key: card.key as string,
    label: card.label as string,
    description: card.description as string,
    icon: iconMap[card.icon as string] || Database,
    iconBg: (card.iconBg as string) || 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: (card.iconColor as string) || 'text-blue-600 dark:text-blue-400',
    healthy: card.healthy as boolean | undefined,
  }))
)

const resourceCards = [
  { name: 'Users', path: '/users', icon: Users, color: 'bg-blue-500', resource: 'users' },
  { name: 'Posts', path: '/posts', icon: FileText, color: 'bg-green-500', resource: 'posts' },
  { name: 'Comments', path: '/comments', icon: MessageSquare, color: 'bg-purple-500', resource: 'comments' },
  { name: 'Albums', path: '/albums', icon: Image, color: 'bg-orange-500', resource: 'albums' },
  { name: 'Photos', path: '/photos', icon: Images, color: 'bg-pink-500', resource: 'photos' },
  { name: 'Todos', path: '/todos', icon: CheckSquare, color: 'bg-teal-500', resource: 'todos' },
]

const resources = resourceCards.map(c => c.resource)
</script>

<template>
  <div class="space-y-8">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">
        Local JSON Server API with SQLite, Redis cache, and rate limiting
      </p>
    </div>

    <!-- Feature Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <template v-if="isFeatureCardsLoading">
        <div
          v-for="i in 3"
          :key="'skel-' + i"
          class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse" />
            <div class="flex-1 space-y-2">
              <div class="h-4 w-28 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
              <div class="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
            </div>
          </div>
          <div class="space-y-2">
            <div class="h-3 w-full bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
            <div class="h-3 w-3/4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
          </div>
        </div>
      </template>
      <template v-else>
        <div
          v-for="card in featureCards"
          :key="card.key"
          class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
        >
          <div class="flex items-center gap-3 mb-3">
            <div
              class="w-10 h-10 rounded-lg flex items-center justify-center"
              :class="card.iconBg"
            >
              <component :is="card.icon" class="w-5 h-5" :class="card.iconColor" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold text-gray-900 dark:text-white truncate">{{ card.label }}</h3>
                <span
                  v-if="card.healthy !== undefined"
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-none"
                  :class="card.healthy
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full"
                    :class="card.healthy ? 'bg-green-500' : 'bg-red-500'"
                  />
                  {{ card.healthy ? 'Enabled' : 'Disabled' }}
                </span>
              </div>
            </div>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line leading-relaxed">{{ card.description }}</p>
        </div>
      </template>
    </div>

    <!-- Resource Cards -->
    <div>
      <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Resources</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <router-link
          v-for="card in resourceCards"
          :key="card.path"
          :to="card.path"
          class="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow group"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div :class="`w-12 h-12 ${card.color} rounded-xl flex items-center justify-center`">
                <component :is="card.icon" class="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {{ card.name }}
                </h3>
                <p
                  v-if="!loading"
                  class="text-2xl font-bold text-gray-900 dark:text-white mt-0.5"
                >
                  {{ counts[card.resource] }}
                </p>
                <div v-else class="mt-1.5">
                  <div class="h-7 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </router-link>
      </div>
    </div>

    <!-- API Endpoints -->
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="p-5 border-b border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">API Endpoints</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          REST API and tRPC endpoints available for all resources
        </p>
      </div>
      <div class="p-5 space-y-3">
        <div
          v-for="resource in resources"
          :key="resource"
          class="flex items-center justify-between p-3 bg-muted dark:bg-muted/50 rounded-lg"
        >
          <code class="text-sm font-mono text-blue-600 dark:text-blue-400">
            GET /api/{{ resource }}
          </code>
          <code class="text-sm font-mono text-blue-600 dark:text-blue-400">
            GET /api/{{ resource }}/:id
          </code>
          <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">
            trpc.json.{{ resource }}.list
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

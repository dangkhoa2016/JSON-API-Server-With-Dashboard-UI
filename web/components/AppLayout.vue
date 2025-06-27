<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  Image,
  Images,
  CheckSquare,
  Server,
  ExternalLink,
  Menu,
  X,
} from '@lucide/vue'

const route = useRoute()
const sidebarOpen = ref(false)

function closeSidebar() {
  sidebarOpen.value = false
}

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/users', icon: Users, label: 'Users' },
  { path: '/posts', icon: FileText, label: 'Posts' },
  { path: '/comments', icon: MessageSquare, label: 'Comments' },
  { path: '/albums', icon: Image, label: 'Albums' },
  { path: '/photos', icon: Images, label: 'Photos' },
  { path: '/todos', icon: CheckSquare, label: 'Todos' },
]
</script>

<template>
  <div class="flex h-screen bg-muted dark:bg-gray-900">
    <!-- Mobile backdrop -->
    <Transition name="fade">
      <div
        v-if="sidebarOpen"
        class="fixed inset-0 bg-black/50 z-40 lg:hidden"
        @click="closeSidebar"
      />
    </Transition>

    <!-- Mobile hamburger button -->
    <button
      class="fixed top-4 left-4 z-50 lg:hidden w-10 h-10 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex items-center justify-center shadow-sm hover:bg-muted dark:hover:bg-gray-700 transition-colors"
      @click="sidebarOpen = !sidebarOpen"
      aria-label="Toggle sidebar"
    >
      <Menu class="w-5 h-5 text-gray-600 dark:text-gray-300" />
    </button>

    <!-- Sidebar -->
    <aside
      :class="[
        'w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0',
        'transition-transform duration-300 ease-in-out',
        'fixed inset-y-0 left-0 z-50 lg:static',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <!-- Header -->
      <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Server class="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 class="font-bold text-base md:text-lg whitespace-nowrap text-gray-900 dark:text-white leading-tight">
              JSON API Server
            </h1>
            <p class="text-xs text-gray-500 dark:text-gray-400">With Dashboard UI</p>
          </div>
        </div>
        <button
          class="lg:hidden w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
          @click="closeSidebar"
          aria-label="Close sidebar"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-3 space-y-1" @click="closeSidebar">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
            route.path === item.path
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/50',
          ]"
        >
          <component :is="item.icon" class="w-5 h-5" />
          {{ item.label }}
        </router-link>
      </nav>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-200 dark:border-gray-700">
        <a
          href="https://github.com/typicode/json-server"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ExternalLink class="w-4 h-4" />
          Inspired by json-server
        </a>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-auto">
      <div class="p-6 pt-16 lg:pt-6 max-w-7xl mx-auto">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

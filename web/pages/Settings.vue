<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Settings as SettingsIcon, Loader2, LogIn, LogOut, Save, RotateCcw, Eye, EyeOff, Trash2, AlertTriangle, Pencil } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Dialog from '@/components/ui/Dialog.vue'
import { trpc } from '@/providers/trpc'
import { useQueryClient } from '@tanstack/vue-query'
import { useAuth } from '@/composables/useAuth'
import { toast } from 'vue-sonner'

const { isAuthenticated, isAdmin, login, logout } = useAuth()

const showLoginDialog = ref(false)
const loginUsername = ref('')
const loginPassword = ref('')
const loginError = ref('')
const visibleKeys = ref<string[]>([])
const revealedValues = ref<Record<string, string>>({})

const revealMutation = trpc.admin.settings.reveal.useMutation()

async function toggleVisible(key: string) {
  const idx = visibleKeys.value.indexOf(key)
  if (idx === -1) {
    try {
      const result = await revealMutation.mutateAsync({ key })
      if (result) {
        revealedValues.value[key] = result.value
      }
      visibleKeys.value.push(key)
    } catch {
      toast.error('Failed to reveal setting value')
    }
  } else {
    visibleKeys.value.splice(idx, 1)
  }
}

function isVisible(key: string) {
  return visibleKeys.value.includes(key)
}

const settingsQuery = trpc.admin.settings.list.useQuery()
const settings = settingsQuery.data
const isLoading = settingsQuery.isLoading
const refetch = settingsQuery.refetch

const queryClient = useQueryClient()

const invalidateFeatureCards = () => {
  queryClient.invalidateQueries({
    queryKey: [{ subsystem: 'trpc', path: 'json.getFeatureCards', input: undefined }],
  })
}

const updateMutation = trpc.admin.settings.update.useMutation({
  onSuccess: (result) => {
    if (result.ok) {
      toast.success('Setting updated')
      refetch()
      invalidateFeatureCards()
    } else {
      toast.error(result.message ?? 'Failed to update setting')
    }
  },
  onError: () => {
    toast.error('Failed to update setting')
  },
})

const resetMutation = trpc.admin.settings.reset.useMutation({
  onSuccess: (result) => {
    if (result.ok) {
      toast.success('Setting reset to default')
      refetch()
      invalidateFeatureCards()
    } else {
      toast.error(result.message ?? 'Failed to reset setting')
    }
  },
  onError: () => {
    toast.error('Failed to reset setting')
  },
})

const showResetConfirmDialog = ref(false)

const resetDatabaseMutation = trpc.admin.data.resetDatabase.useMutation({
  onSuccess: (result) => {
    showResetConfirmDialog.value = false
    if (result.ok) {
      toast.success('Database reset and re-seeded successfully')
      refetch()
    } else {
      toast.error('Failed to reset database')
    }
  },
  onError: () => {
    showResetConfirmDialog.value = false
    toast.error('Failed to reset database')
  },
})

const editingValues = ref<Record<string, string>>({})

async function doLogin() {
  loginError.value = ''
  const ok = await login(loginUsername.value, loginPassword.value)
  if (ok) {
    showLoginDialog.value = false
    loginUsername.value = ''
    loginPassword.value = ''
    refetch()
    toast.success('Logged in as admin')
  } else {
    loginError.value = 'Invalid username or password'
  }
}

function startEdit(key: string, value: string) {
  editingValues.value[key] = value
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(`[data-edit-key="${key}"]`)
    el?.focus()
  })
}

function cancelEdit(key: string) {
  delete editingValues.value[key]
}

function saveEdit(key: string) {
  const value = editingValues.value[key]
  if (value !== undefined) {
    updateMutation.mutate({ key, value })
    delete editingValues.value[key]
  }
}

function doReset(key: string) {
  resetMutation.mutate({ key })
}

function doLogout() {
  logout()
  refetch()
  toast.success('Logged out')
}

function openResetConfirm() {
  showResetConfirmDialog.value = true
}

function doResetDatabase() {
  resetDatabaseMutation.mutate()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
          <SettingsIcon class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">Application configuration</p>
        </div>
      </div>
      <div v-if="isAuthenticated" class="flex items-center gap-3">
        <span class="text-sm text-gray-500 dark:text-gray-400">Logged in as <strong>admin</strong></span>
        <Button variant="destructive" size="sm" @click="openResetConfirm" :disabled="resetDatabaseMutation.isPending.value">
          <Trash2 class="w-4 h-4" />
          Reset Database
        </Button>
        <Button variant="outline" size="sm" class="dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-700" @click="doLogout">
          <LogOut class="w-4 h-4" />
          Logout
        </Button>
      </div>
    </div>

    <!-- Guest banner -->
    <div
      v-if="!isAuthenticated"
      class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between"
    >
      <p class="text-sm text-amber-800 dark:text-amber-300">
        You are viewing settings as a guest. Login as admin to modify configuration.
      </p>
      <Button variant="default" size="sm" @click="showLoginDialog = true">
        <LogIn class="w-4 h-4" />
        Login
      </Button>
    </div>

    <!-- Settings list -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="w-6 h-6 animate-spin text-gray-400" />
    </div>

    <div v-else-if="settings && settings.length > 0" class="space-y-4">
      <div
        v-for="setting in settings"
        :key="setting.key"
        class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ setting.label || setting.key }}</h3>
              <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{{ setting.group }}</span>
              <span v-if="!setting.isPublic" class="text-xs px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">sensitive</span>
            </div>
            <p v-if="setting.description" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ setting.description }}</p>
            <div class="mt-2">
              <div v-if="editingValues[setting.key] !== undefined && isAdmin" class="bg-muted dark:bg-muted/50 rounded-lg p-3 -mx-1">
                <div class="flex items-center gap-2">
                  <div class="relative flex-1">
                    <Input
                      :type="!setting.isPublic ? (isVisible(setting.key) ? 'text' : 'password') : 'text'"
                      v-model="editingValues[setting.key]"
                      :data-edit-key="setting.key"
                      class="w-full pr-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500"
                    />
                    <Button
                      v-if="!setting.isPublic"
                      size="icon-sm"
                      variant="ghost"
                      class="absolute right-0 top-0 h-full rounded-l-none border-l border-input"
                      title="Toggle password visibility"
                      @click="toggleVisible(setting.key)"
                    >
                      <Eye v-if="isVisible(setting.key)" class="w-4 h-4" />
                      <EyeOff v-else class="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div class="flex items-center gap-2 mt-3">
                  <Button size="sm" @click="saveEdit(setting.key)" :disabled="updateMutation.isPending.value">
                    <Save class="w-3 h-3" />
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" class="text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20" @click="cancelEdit(setting.key)">Cancel</Button>
                </div>
              </div>
              <div v-else-if="isAdmin" class="flex items-center gap-2">
                <code
                  class="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex-1 truncate"
                  @click="startEdit(setting.key, setting.value)"
                >
                  {{ !setting.isPublic && !isVisible(setting.key) ? '••••••••' : (revealedValues[setting.key] || setting.value || '\u00a0') }}
                </code>
                <button
                  v-if="!setting.isPublic"
                  class="inline-flex cursor-pointer items-center justify-center rounded-lg h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors duration-150"
                  :title="isVisible(setting.key) ? 'Hide value' : 'Show value'"
                  @click="toggleVisible(setting.key)"
                >
                  <Eye v-if="isVisible(setting.key)" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </button>
                <button
                  class="inline-flex cursor-pointer items-center justify-center rounded-lg h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors duration-150"
                  title="Edit"
                  @click="startEdit(setting.key, setting.value)"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  class="inline-flex cursor-pointer items-center justify-center rounded-lg h-8 w-8 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 transition-colors duration-150"
                  title="Reset to default"
                  @click="doReset(setting.key)"
                >
                  <RotateCcw class="w-4 h-4" />
                </button>
              </div>
              <div v-else>
                <code
                  class="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded flex-1 truncate block"
                >
                  {{ setting.isPublic ? (setting.value || '\u00a0') : '••••••••' }}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
      No settings found.
    </div>

    <!-- Reset Database Confirm Dialog -->
    <Dialog v-model="showResetConfirmDialog">
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <AlertTriangle class="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Reset Database</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">This action will clear all data and re-seed from the API.</p>
          </div>
        </div>

        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p class="text-sm text-red-700 dark:text-red-400">
            <strong>Warning:</strong> All users, posts, comments, albums, photos, and todos will be permanently deleted. This action cannot be undone.
          </p>
        </div>

        <div class="flex items-center justify-end gap-2">
          <Button variant="outline" @click="showResetConfirmDialog = false" :disabled="resetDatabaseMutation.isPending.value">Cancel</Button>
          <Button variant="default" class="bg-red-600 hover:bg-red-700 text-white" @click="doResetDatabase" :disabled="resetDatabaseMutation.isPending.value">
            <Loader2 v-if="resetDatabaseMutation.isPending.value" class="w-4 h-4 animate-spin" />
            <Trash2 v-else class="w-4 h-4" />
            {{ resetDatabaseMutation.isPending.value ? 'Resetting...' : 'Reset Database' }}
          </Button>
        </div>
      </div>
    </Dialog>

    <!-- Login Dialog -->
    <Dialog v-model="showLoginDialog">
      <div class="space-y-4">
        <div>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Admin Login</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">Enter admin credentials to modify settings.</p>
        </div>

        <div class="space-y-3">
          <div class="space-y-1">
            <Label>Username</Label>
            <Input v-model="loginUsername" placeholder="Enter username" @keyup.enter="doLogin" />
          </div>
          <div class="space-y-1">
            <Label>Password</Label>
            <Input
              v-model="loginPassword"
              type="password"
              placeholder="Enter password"
              @keyup.enter="doLogin"
            />
          </div>
        </div>

        <p v-if="loginError" class="text-sm text-red-600 dark:text-red-400">{{ loginError }}</p>

        <div class="flex items-center justify-end gap-2">
          <Button variant="outline" @click="showLoginDialog = false">Cancel</Button>
          <Button @click="doLogin">Login</Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

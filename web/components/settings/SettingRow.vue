<script setup lang="ts">
import { Save, Eye, EyeOff, Pencil, RotateCcw } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'

interface Setting {
  key: string
  value: string
  type: string
  label?: string
  description?: string
  group: string
  isPublic: boolean
}

defineProps<{
  setting: Setting
  isAdmin: boolean
  editingValue: string | undefined
  isVisible: boolean
  revealedValue: string | undefined
  isUpdatePending: boolean
  hasChanges: boolean
}>()

const emit = defineEmits<{
  edit: [key: string, value: string]
  cancel: [key: string]
  save: [key: string]
  toggleVisible: [key: string]
  reset: [key: string]
  'update:editingValue': [key: string, value: string]
}>()
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ setting.label || setting.key }}</h3>
          <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">{{ setting.group }}</span>
          <span v-if="setting.value === '********'" class="text-xs px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">sensitive</span>
        </div>
        <p v-if="setting.description" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{{ setting.description }}</p>
        <div class="mt-2">
          <div v-if="editingValue !== undefined && isAdmin" class="bg-muted dark:bg-muted/50 rounded-lg p-3 -mx-1">
            <div class="flex items-center gap-2">
              <div class="relative flex-1">
                <Input
                  :type="setting.value === '********' ? (isVisible ? 'text' : 'password') : 'text'"
                  :model-value="editingValue"
                  :data-edit-key="setting.key"
                  class="w-full pr-10 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500"
                  @update:model-value="emit('update:editingValue', setting.key, $event)"
                />
                <Button
                  v-if="setting.value === '********'"
                  size="icon-sm"
                  variant="ghost"
                  class="absolute right-0 top-0 h-full rounded-l-none border-l border-input"
                  title="Toggle password visibility"
                  @click="emit('toggleVisible', setting.key)"
                >
                  <Eye v-if="isVisible" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div class="flex items-center gap-2 mt-3">
              <Button size="sm" @click="emit('save', setting.key)" :disabled="isUpdatePending || !hasChanges">
                <Save class="w-3 h-3" />
                Save
              </Button>
              <Button size="sm" variant="outline" class="text-gray-700 border-gray-300 hover:text-red-600 hover:bg-red-50 hover:border-red-300 dark:text-gray-300 dark:border-gray-600 dark:hover:text-red-400 dark:hover:bg-red-900/20 dark:hover:border-red-800" @click="emit('cancel', setting.key)">Cancel</Button>
            </div>
          </div>
          <div v-else-if="isAdmin" class="flex items-center gap-2">
            <code
              class="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors flex-1 truncate"
              @click="emit('edit', setting.key, revealedValue || setting.value)"
            >
              {{ setting.value === '********' && !isVisible ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : (isVisible ? (revealedValue || '\u00a0') : (setting.value || '\u00a0')) }}
            </code>
            <button
              v-if="setting.value === '********'"
              class="inline-flex cursor-pointer items-center justify-center rounded-lg h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors duration-150"
              :title="isVisible ? 'Hide value' : 'Reveal value'"
              @click="emit('toggleVisible', setting.key)"
            >
              <Eye v-if="isVisible" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
            <button
              class="inline-flex cursor-pointer items-center justify-center rounded-lg h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors duration-150"
              title="Edit"
              @click="emit('edit', setting.key, revealedValue || setting.value)"
            >
              <Pencil class="w-4 h-4" />
            </button>
            <button
              class="inline-flex cursor-pointer items-center justify-center rounded-lg h-8 w-8 text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/20 transition-colors duration-150"
              title="Reset to default"
              @click="emit('reset', setting.key)"
            >
              <RotateCcw class="w-4 h-4" />
            </button>
          </div>
          <div v-else>
            <code
              class="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded flex-1 truncate block"
            >
              {{ setting.value === '********' ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : (setting.value || '\u00a0') }}
            </code>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

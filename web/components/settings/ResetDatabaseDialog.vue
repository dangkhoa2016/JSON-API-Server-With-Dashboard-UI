<script setup lang="ts">
import { Loader2, Trash2, AlertTriangle } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'

defineProps<{
  modelValue: boolean
  isProcessing: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
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
        <Button variant="outline" @click="emit('cancel')" :disabled="isProcessing">Cancel</Button>
        <Button variant="default" class="bg-red-600 hover:bg-red-700 text-white" @click="emit('confirm')" :disabled="isProcessing">
          <Loader2 v-if="isProcessing" class="w-4 h-4 animate-spin" />
          <Trash2 v-else class="w-4 h-4" />
          {{ isProcessing ? 'Resetting...' : 'Reset Database' }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>

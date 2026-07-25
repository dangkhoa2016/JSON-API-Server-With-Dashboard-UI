<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Dialog from '@/components/ui/Dialog.vue'

defineProps<{
  modelValue: boolean
  title: string
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
      <h2 class="text-lg font-semibold">Delete {{ title }}</h2>
      <p class="text-gray-600 dark:text-gray-400">
        Are you sure you want to delete this item? This action cannot be undone.
      </p>
      <div class="flex justify-end gap-3">
        <Button variant="outline" @click="emit('cancel')">Cancel</Button>
        <Button variant="destructive" @click="emit('confirm')">Delete</Button>
      </div>
    </div>
  </Dialog>
</template>

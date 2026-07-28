<script setup lang="ts">
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Dialog from '@/components/ui/Dialog.vue'

defineProps<{
  modelValue: boolean
  username: string
  password: string
  error: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:username': [value: string]
  'update:password': [value: string]
  login: []
  cancel: []
}>()
</script>

<template>
  <Dialog :model-value="modelValue" @update:model-value="emit('update:modelValue', $event)">
    <div class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Admin Login</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">Enter admin credentials to modify settings.</p>
      </div>

      <div class="space-y-3">
        <div class="space-y-1">
          <Label>Username</Label>
          <Input :model-value="username" placeholder="Enter username" @update:model-value="emit('update:username', $event)" @keyup.enter="emit('login')" />
        </div>
        <div class="space-y-1">
          <Label>Password</Label>
          <Input
            :model-value="password"
            type="password"
            placeholder="Enter password"
            @update:model-value="emit('update:password', $event)"
            @keyup.enter="emit('login')"
          />
        </div>
      </div>

      <p v-if="error" class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>

      <div class="flex items-center justify-end gap-2">
        <Button variant="outline" @click="emit('cancel')">Cancel</Button>
        <Button @click="emit('login')">Login</Button>
      </div>
    </div>
  </Dialog>
</template>

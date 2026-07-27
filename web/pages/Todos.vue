<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { CheckSquare } from '@lucide/vue'

const fields = [
  { key: 'title', label: 'Title', type: 'text' as const, required: true },
  { key: 'completed', label: 'Completed', type: 'boolean' as const },
  { key: 'userId', label: 'User ID', type: 'number' as const, required: true },
]
</script>

<template>
  <CrudPage resource="todos" title="Todos" :icon="CheckSquare" :fields="fields" />
</template>

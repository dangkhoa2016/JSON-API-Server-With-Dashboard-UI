<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { FileText } from '@lucide/vue'

const fields = [
  { key: 'title', label: 'Title', type: 'text' as const, required: true },
  { key: 'body', label: 'Body', type: 'textarea' as const, required: true },
  { key: 'userId', label: 'User ID', type: 'number' as const, required: true },
]
</script>

<template>
  <CrudPage resource="posts" title="Posts" :icon="FileText" :fields="fields" />
</template>

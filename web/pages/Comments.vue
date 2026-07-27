<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { MessageSquare } from '@lucide/vue'

const fields = [
  { key: 'name', label: 'Name', type: 'text' as const, required: true },
  { key: 'email', label: 'Email', type: 'email' as const, required: true },
  { key: 'body', label: 'Body', type: 'textarea' as const, required: true },
  { key: 'postId', label: 'Post ID', type: 'number' as const, required: true },
]
</script>

<template>
  <CrudPage resource="comments" title="Comments" :icon="MessageSquare" :fields="fields" />
</template>

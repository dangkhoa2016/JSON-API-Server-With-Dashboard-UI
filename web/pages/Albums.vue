<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { Image } from '@lucide/vue'

const fields = [
  { key: 'title', label: 'Title', type: 'text' as const, required: true },
  { key: 'userId', label: 'User ID', type: 'number' as const, required: true },
]
</script>

<template>
  <CrudPage resource="albums" title="Albums" :icon="Image" :fields="fields" />
</template>

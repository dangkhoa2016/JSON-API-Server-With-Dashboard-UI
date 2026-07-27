<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { Images } from '@lucide/vue'

const fields = [
  { key: 'title', label: 'Title', type: 'text' as const, required: true },
  { key: 'url', label: 'URL', type: 'text' as const, required: true },
  { key: 'thumbnailUrl', label: 'Thumbnail URL', type: 'text' as const, required: true },
  { key: 'albumId', label: 'Album ID', type: 'number' as const, required: true },
]
</script>

<template>
  <CrudPage resource="photos" title="Photos" :icon="Images" :fields="fields" />
</template>

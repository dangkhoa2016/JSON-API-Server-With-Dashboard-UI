<script setup lang="ts">
import ResourcePage from '@/components/ResourcePage.vue'
import { useResourceCrud } from '@/composables/useResourceCrud'
import { Image } from '@lucide/vue'

const fields = [
  { key: 'title', label: 'Title', type: 'text' as const, required: true },
  { key: 'userId', label: 'User ID', type: 'number' as const, required: true },
]

const { list, create, update, handleCreate, handleUpdate, handleDelete } = useResourceCrud('albums')
</script>

<template>
  <ResourcePage
    title="Albums"
    :fields="fields"
    :items="list.data.value"
    :is-loading="list.isLoading.value"
    :is-creating="create.isPending.value"
    :is-updating="update.isPending.value"
    :icon="Image"
    @create="handleCreate"
    @update="handleUpdate"
    @delete="handleDelete"
  />
</template>

<script setup lang="ts">
import ResourcePage from '@/components/ResourcePage.vue'
import { useResourceCrud } from '@/composables/useResourceCrud'
import { Images } from '@lucide/vue'

const fields = [
  { key: 'title', label: 'Title', type: 'text' as const, required: true },
  { key: 'url', label: 'URL', type: 'text' as const, required: true },
  { key: 'thumbnailUrl', label: 'Thumbnail URL', type: 'text' as const, required: true },
  { key: 'albumId', label: 'Album ID', type: 'number' as const, required: true },
]

const { list, create, update, handleCreate, handleUpdate, handleDelete, page, perPage } = useResourceCrud('photos')
</script>

<template>
  <ResourcePage
    title="Photos"
    :fields="fields"
    :items="list.data.value?.data"
    :total="list.data.value?.total ?? 0"
    v-model:page="page"
    :per-page="perPage"
    :is-loading="list.isLoading.value"
    :is-creating="create.isPending.value"
    :is-updating="update.isPending.value"
    :icon="Images"
    @create="handleCreate"
    @update="handleUpdate"
    @delete="handleDelete"
  />
</template>

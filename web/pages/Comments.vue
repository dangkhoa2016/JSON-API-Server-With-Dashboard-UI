<script setup lang="ts">
import ResourcePage from '@/components/ResourcePage.vue'
import { useResourceCrud } from '@/composables/useResourceCrud'
import { MessageSquare } from '@lucide/vue'

const fields = [
  { key: 'name', label: 'Name', type: 'text' as const, required: true },
  { key: 'email', label: 'Email', type: 'email' as const, required: true },
  { key: 'body', label: 'Body', type: 'textarea' as const, required: true },
  { key: 'postId', label: 'Post ID', type: 'number' as const, required: true },
]

const crud = useResourceCrud('comments')
defineExpose({ searchQuery: crud.searchQuery, sortField: crud.sortField, sortOrder: crud.sortOrder })
const { list, create, update, handleCreate, handleUpdate, handleDelete, handleSearch, handleSort, page, perPage } = crud
</script>

<template>
  <ResourcePage
    title="Comments"
    :fields="fields"
    :items="list.data.value?.data"
    :total="list.data.value?.total ?? 0"
    v-model:page="page"
    :per-page="perPage"
    :is-loading="list.isLoading.value"
    :is-creating="create.isPending.value"
    :is-updating="update.isPending.value"
    :icon="MessageSquare"
    @create="handleCreate"
    @update="handleUpdate"
    @delete="handleDelete"
    @search="handleSearch"
    @update:sort="handleSort"
  />
</template>

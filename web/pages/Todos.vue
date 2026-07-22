<script setup lang="ts">
import ResourcePage from '@/components/ResourcePage.vue'
import { useResourceCrud } from '@/composables/useResourceCrud'
import { CheckSquare } from '@lucide/vue'

const fields = [
  { key: 'title', label: 'Title', type: 'text' as const, required: true },
  { key: 'completed', label: 'Completed', type: 'boolean' as const },
  { key: 'userId', label: 'User ID', type: 'number' as const, required: true },
]

const crud = useResourceCrud('todos')
defineExpose({ searchQuery: crud.searchQuery, sortField: crud.sortField, sortOrder: crud.sortOrder })
const { list, create, update, handleCreate, handleUpdate, handleDelete, handleSearch, handleSort, page, perPage } = crud
</script>

<template>
  <ResourcePage
    title="Todos"
    :fields="fields"
    :items="list.data.value?.data"
    :total="list.data.value?.total ?? 0"
    v-model:page="page"
    :per-page="perPage"
    :is-loading="list.isLoading.value"
    :is-creating="create.isPending.value"
    :is-updating="update.isPending.value"
    :icon="CheckSquare"
    @create="handleCreate"
    @update="handleUpdate"
    @delete="handleDelete"
    @search="handleSearch"
    @update:sort="handleSort"
  />
</template>

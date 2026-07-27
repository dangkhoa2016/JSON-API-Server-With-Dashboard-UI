<script setup lang="ts">
import ResourcePage from '@/components/ResourcePage.vue'
import { useResourceCrud, type ResourceName } from '@/composables/useResourceCrud'
import type { Component } from 'vue'

const props = defineProps<{
  resource: ResourceName
  title: string
  icon: Component
  fields: { key: string; label: string; type: 'text' | 'number' | 'email' | 'textarea' | 'boolean'; required?: boolean }[]
}>()

const crud = useResourceCrud(props.resource)
defineExpose({ searchQuery: crud.searchQuery, sortField: crud.sortField, sortOrder: crud.sortOrder })
const { list, create, update, handleCreate, handleUpdate, handleDelete, handleSearch, handleSort, page, perPage } = crud
</script>

<template>
  <ResourcePage
    :title="title"
    :fields="fields"
    :items="list.data.value?.data"
    :total="list.data.value?.total ?? 0"
    v-model:page="page"
    :per-page="perPage"
    :is-loading="list.isLoading.value"
    :is-creating="create.isPending.value"
    :is-updating="update.isPending.value"
    :icon="icon"
    @create="handleCreate"
    @update="handleUpdate"
    @delete="handleDelete"
    @search="handleSearch"
    @update:sort="handleSort"
  />
</template>

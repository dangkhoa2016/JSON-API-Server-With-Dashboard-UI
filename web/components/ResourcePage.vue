<script setup lang="ts">
import { ref, computed, useSlots, provide, type Component } from 'vue'
import Button from '@/components/ui/Button.vue'
import ResourceTable from '@/components/ResourceTable.vue'
import ResourceSearch from '@/components/ResourceSearch.vue'
import ResourceFormDialog from '@/components/resource/ResourceFormDialog.vue'
import ResourceDeleteDialog from '@/components/resource/ResourceDeleteDialog.vue'
import { Plus } from '@lucide/vue'

interface Field {
  key: string
  label: string
  type: 'text' | 'number' | 'email' | 'textarea' | 'boolean'
  required?: boolean
}

interface ResourceItem {
  id: number;
  [key: string]: unknown;
}

const props = withDefaults(defineProps<{
  title: string
  fields: Field[]
  items?: ResourceItem[]
  total: number
  page: number
  perPage: number
  isLoading: boolean
  isCreating: boolean
  isUpdating: boolean
  icon?: Component
  canDelete?: boolean
}>(), {
  canDelete: true,
})

const emit = defineEmits<{
  create: [data: Record<string, unknown>]
  update: [id: number, data: Record<string, unknown>]
  delete: [id: number]
  'update:page': [page: number]
  'update:searchMode': [mode: 'client' | 'server']
  'update:sort': [field: string | undefined, order: 'asc' | 'desc']
  search: [query: string]
}>()

const slots = useSlots()

const resourceParentSlots: Record<string, (scope: Record<string, unknown>) => unknown> = {}
for (const key of Object.keys(slots)) {
  if (key.startsWith('field-')) {
    resourceParentSlots[key] = slots[key]!
  }
}
provide('resource-parent-slots', resourceParentSlots)

const search = ref('')
const searchMode = ref<'client' | 'server'>('client')
const sortField = ref<string | undefined>(undefined)
const sortOrder = ref<'asc' | 'desc'>('asc')
const isCreateOpen = ref(false)
const editingId = ref<number | null>(null)
const pendingDeleteId = ref<number | null>(null)
const deleteConfirmOpen = ref(false)
const formData = ref<Record<string, unknown>>({})
const validationErrors = ref<Record<string, string>>({})

function validateForm(): boolean {
  const errors: Record<string, string> = {}
  for (const field of props.fields) {
    if (!field.required) continue
    const value = formData.value[field.key]
    if (field.type === 'boolean') continue
    if (field.type === 'number') {
      if (value === '' || value === null || value === undefined || isNaN(Number(value))) {
        errors[field.key] = `${field.label} is required`
      }
    } else if (!value || String(value).trim() === '') {
      errors[field.key] = `${field.label} is required`
    }
  }
  validationErrors.value = errors
  return Object.keys(errors).length === 0
}

function openCreate() {
  validationErrors.value = {}
  formData.value = {}
  isCreateOpen.value = true
}

function handleCreate() {
  if (!validateForm()) return
  emit('create', { ...formData.value })
  isCreateOpen.value = false
  formData.value = {}
  validationErrors.value = {}
}

function handleUpdate() {
  if (!editingId.value) return
  if (!validateForm()) return
  emit('update', editingId.value, { ...formData.value })
  editingId.value = null
  formData.value = {}
  validationErrors.value = {}
}

function handleDelete(id: number) {
  pendingDeleteId.value = id
  deleteConfirmOpen.value = true
}

function confirmDelete() {
  if (pendingDeleteId.value !== null) {
    emit('delete', pendingDeleteId.value)
    pendingDeleteId.value = null
  }
}

function openEdit(item: ResourceItem) {
  validationErrors.value = {}
  editingId.value = item.id
  const editData: Record<string, unknown> = {}
  props.fields.forEach((f) => {
    if (item[f.key] !== undefined) editData[f.key] = item[f.key]
  })
  formData.value = editData
}

function setFormField(key: string, value: unknown) {
  formData.value = { ...formData.value, [key]: value }
}

function goToPage(p: number) {
  const max = Math.max(1, Math.ceil(props.total / props.perPage))
  if (p < 1 || p > max) return
  emit('update:page', p)
}

function localSort(items: ResourceItem[]): ResourceItem[] {
  if (!sortField.value) return items
  return [...items].sort((a, b) => {
    const aVal = a[sortField.value!]
    const bVal = b[sortField.value!]
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = typeof aVal === 'number' && typeof bVal === 'number'
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal))
    return sortOrder.value === 'asc' ? cmp : -cmp
  })
}

const sortedItems = computed(() => {
  if (!props.items) return []
  if (searchMode.value === 'server') {
    return localSort(props.items)
  }
  const filtered = props.items.filter((item: ResourceItem) =>
    props.fields.some((f) =>
      String(item[f.key] || '')
        .toLowerCase()
        .includes(search.value.toLowerCase()),
    ),
  )
  return localSort(filtered)
})

function onSearchModeChange(mode: 'client' | 'server') {
  searchMode.value = mode
  emit('update:searchMode', mode)
}

function onSearch(query: string) {
  if (searchMode.value === 'server') {
    emit('search', query)
  }
}

function onSort(field: string | undefined, order: 'asc' | 'desc') {
  sortField.value = field
  sortOrder.value = order
  emit('update:sort', field, order)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <component :is="icon" v-if="icon" class="w-8 h-8 text-blue-600" />
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ title }}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ total }} {{ total === 1 ? 'item' : 'items' }} in database
          </p>
        </div>
      </div>
      <Button @click="openCreate">
        <Plus class="w-4 h-4 mr-2" />
        Add {{ title }}
      </Button>
    </div>

    <!-- Search -->
    <ResourceSearch
      :model-value="search"
      :search-mode="searchMode"
      @update:model-value="search = $event"
      @update:search-mode="onSearchModeChange"
      @search="onSearch"
    />

    <ResourceFormDialog
      v-model="isCreateOpen"
      :title="title"
      :fields="fields"
      :form-data="formData"
      :validation-errors="validationErrors"
      :is-processing="isCreating"
      mode="create"
      @confirm="handleCreate"
      @cancel="isCreateOpen = false"
      @update:field="setFormField"
    />

    <ResourceFormDialog
      :model-value="!!editingId"
      :title="title"
      :fields="fields"
      :form-data="formData"
      :validation-errors="validationErrors"
      :is-processing="isUpdating"
      mode="edit"
      @confirm="handleUpdate"
      @cancel="editingId = null"
      @update:field="setFormField"
      @update:model-value="editingId = null"
    />

    <ResourceDeleteDialog
      v-model="deleteConfirmOpen"
      :title="title"
      @confirm="confirmDelete"
      @cancel="deleteConfirmOpen = false"
    />

    <ResourceTable
      :fields="fields"
      :items="sortedItems"
      :is-loading="isLoading"
      :title="title"
      :page="page"
      :total="total"
      :per-page="perPage"
      :sort-field="sortField"
      :sort-order="sortOrder"
      :can-delete="canDelete"
      @edit="openEdit"
      @delete="handleDelete"
      @update:page="goToPage"
      @update:sort="onSort"
    />
  </div>
</template>

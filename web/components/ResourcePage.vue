<script setup lang="ts">
import { ref, computed, useSlots, type Component } from 'vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Dialog from '@/components/ui/Dialog.vue'
import ResourceTable from '@/components/ResourceTable.vue'
import ResourceSearch from '@/components/ResourceSearch.vue'
import { Plus, Loader2 } from '@lucide/vue'

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

const props = defineProps<{
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
}>()

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

function hasCustomSlot(key: string): boolean {
  return !!slots[`field-${key}`]
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

    <!-- Create Dialog -->
    <Dialog v-model="isCreateOpen">
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Create {{ title }}</h2>
        <div v-for="field in fields" :key="field.key" class="space-y-1">
          <Label :for="field.key">
            {{ field.label }}
            <span v-if="field.required" class="text-red-500">*</span>
          </Label>

          <slot
            v-if="hasCustomSlot(field.key)"
            :name="`field-${field.key}`"
            :value="formData[field.key]"
            :update="(v: unknown) => setFormField(field.key, v)"
          />

          <textarea
            v-else-if="field.type === 'textarea'"
            :id="field.key"
            class="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            rows="3"
            :value="formData[field.key] || ''"
            @input="setFormField(field.key, ($event.target as HTMLTextAreaElement).value)"
          />
          <input
            v-else-if="field.type === 'boolean'"
            :id="field.key"
            type="checkbox"
            class="mt-2 w-4 h-4"
            :checked="!!formData[field.key]"
            @change="setFormField(field.key, ($event.target as HTMLInputElement).checked)"
          />
          <Input
            v-else
            :id="field.key"
            :type="field.type"
            class="mt-1"
            :model-value="formData[field.key] || ''"
            @update:model-value="setFormField(field.key, $event)"
          />
          <p v-if="validationErrors[field.key]" class="text-sm text-red-500 mt-1">{{ validationErrors[field.key] }}</p>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <Button variant="outline" @click="isCreateOpen = false">Cancel</Button>
          <Button :disabled="isCreating" @click="handleCreate">
            <Loader2 v-if="isCreating" class="w-4 h-4 animate-spin" />
            Create
          </Button>
        </div>
      </div>
    </Dialog>

    <!-- Edit Dialog -->
    <Dialog :model-value="!!editingId" @update:model-value="editingId = null">
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Edit {{ title }}</h2>
        <div v-for="field in fields" :key="field.key" class="space-y-1">
          <Label :for="'edit-' + field.key">
            {{ field.label }}
            <span v-if="field.required" class="text-red-500">*</span>
          </Label>

          <slot
            v-if="hasCustomSlot(field.key)"
            :name="`field-${field.key}`"
            :value="formData[field.key]"
            :update="(v: unknown) => setFormField(field.key, v)"
          />

          <textarea
            v-else-if="field.type === 'textarea'"
            :id="'edit-' + field.key"
            class="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            rows="3"
            :value="formData[field.key] || ''"
            @input="setFormField(field.key, ($event.target as HTMLTextAreaElement).value)"
          />
          <input
            v-else-if="field.type === 'boolean'"
            :id="'edit-' + field.key"
            type="checkbox"
            class="mt-2 w-4 h-4"
            :checked="!!formData[field.key]"
            @change="setFormField(field.key, ($event.target as HTMLInputElement).checked)"
          />
          <Input
            v-else
            :id="'edit-' + field.key"
            :type="field.type"
            class="mt-1"
            :model-value="formData[field.key] || ''"
            @update:model-value="setFormField(field.key, $event)"
          />
          <p v-if="validationErrors[field.key]" class="text-sm text-red-500 mt-1">{{ validationErrors[field.key] }}</p>
        </div>
        <div class="flex justify-end gap-3 pt-2">
          <Button variant="outline" @click="editingId = null">Cancel</Button>
          <Button :disabled="isUpdating" @click="handleUpdate">
            <Loader2 v-if="isUpdating" class="w-4 h-4 animate-spin" />
            Update
          </Button>
        </div>
      </div>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model="deleteConfirmOpen">
      <div class="space-y-4">
        <h2 class="text-lg font-semibold">Delete {{ title }}</h2>
        <p class="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete this item? This action cannot be undone.
        </p>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="deleteConfirmOpen = false">Cancel</Button>
          <Button variant="destructive" @click="confirmDelete">Delete</Button>
        </div>
      </div>
    </Dialog>

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
      @edit="openEdit"
      @delete="handleDelete"
      @update:page="goToPage"
      @update:sort="onSort"
    />
  </div>
</template>

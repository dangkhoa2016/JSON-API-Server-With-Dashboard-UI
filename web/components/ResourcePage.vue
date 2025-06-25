<script setup lang="ts">
import { ref, computed, useSlots } from 'vue'
import Button from '@/components/ui/Button.vue'
import Input from '@/components/ui/Input.vue'
import Label from '@/components/ui/Label.vue'
import Dialog from '@/components/ui/Dialog.vue'
import ResourceTable from '@/components/ResourceTable.vue'
import { Plus, Search, Loader2 } from '@lucide/vue'

interface Field {
  key: string
  label: string
  type: 'text' | 'number' | 'email' | 'textarea' | 'boolean'
  required?: boolean
}

const props = defineProps<{
  title: string
  fields: Field[]
  items?: any[]
  total: number
  page: number
  perPage: number
  isLoading: boolean
  isCreating: boolean
  isUpdating: boolean
  icon?: any
}>()

const emit = defineEmits<{
  create: [data: Record<string, any>]
  update: [id: number, data: Record<string, any>]
  delete: [id: number]
  'update:page': [page: number]
}>()

const slots = useSlots()

const search = ref('')
const isCreateOpen = ref(false)
const editingId = ref<number | null>(null)
const pendingDeleteId = ref<number | null>(null)
const deleteConfirmOpen = ref(false)
const formData = ref<Record<string, any>>({})

function handleCreate() {
  emit('create', { ...formData.value })
  isCreateOpen.value = false
  formData.value = {}
}

function handleUpdate() {
  if (!editingId.value) return
  emit('update', editingId.value, { ...formData.value })
  editingId.value = null
  formData.value = {}
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

function openEdit(item: any) {
  editingId.value = item.id
  const editData: Record<string, any> = {}
  props.fields.forEach((f) => {
    if (item[f.key] !== undefined) editData[f.key] = item[f.key]
  })
  formData.value = editData
}

function setFormField(key: string, value: any) {
  formData.value = { ...formData.value, [key]: value }
}

function hasCustomSlot(key: string): boolean {
  return !!slots[`field-${key}`]
}

function goToPage(p: number) {
  if (p < 1 || p > totalPages.value) return
  emit('update:page', p)
}

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))

const filteredItems = computed(() => {
  if (!props.items) return []
  return props.items.filter((item: any) =>
    props.fields.some((f) =>
      String(item[f.key] || '')
        .toLowerCase()
        .includes(search.value.toLowerCase()),
    ),
  )
})
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
      <Button @click="isCreateOpen = true">
        <Plus class="w-4 h-4 mr-2" />
        Add {{ title }}
      </Button>
    </div>

    <!-- Search -->
    <div class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <Input
        :model-value="search"
        @update:model-value="search = $event"
        :placeholder="`Search current page...`"
        class="pl-10 max-w-md"
      />
    </div>

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
            :update="(v: any) => setFormField(field.key, v)"
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
        </div>
        <Button :disabled="isCreating" class="mt-4" @click="handleCreate">
          <Loader2 v-if="isCreating" class="w-4 h-4 mr-2 animate-spin" />
          Create
        </Button>
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
            :update="(v: any) => setFormField(field.key, v)"
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
        </div>
        <Button :disabled="isUpdating" class="mt-4" @click="handleUpdate">
          <Loader2 v-if="isUpdating" class="w-4 h-4 mr-2 animate-spin" />
          Update
        </Button>
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
      :items="filteredItems"
      :is-loading="isLoading"
      :title="title"
      :page="page"
      :total="total"
      :per-page="perPage"
      @edit="openEdit"
      @delete="handleDelete"
      @update:page="goToPage"
    />
  </div>
</template>

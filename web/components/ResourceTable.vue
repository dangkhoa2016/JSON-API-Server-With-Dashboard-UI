<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { Pencil, Trash2, Inbox, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from '@lucide/vue'

interface Field {
  key: string
  label: string
  type: 'text' | 'number' | 'email' | 'textarea' | 'boolean'
  required?: boolean
}

interface TableItem {
  id: number;
  [key: string]: unknown;
}

const props = defineProps<{
  fields: Field[]
  items: TableItem[]
  isLoading: boolean
  title: string
  page: number
  total: number
  perPage: number
  sortField?: string
  sortOrder?: 'asc' | 'desc'
  maxDisplayFields?: number
}>()

const emit = defineEmits<{
  edit: [item: TableItem]
  delete: [id: number]
  'update:page': [page: number]
  'update:sort': [field: string, order: 'asc' | 'desc']
}>()

const slots = useSlots()

function hasCellSlot(key: string): boolean {
  return !!slots[`cell-${key}`]
}

function formatValue(item: TableItem, field: Field): string {
  const val = item[field.key]
  if (val === null || val === undefined) return '\u2014'
  if (field.type === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}

const displayFields = computed(() => props.fields.slice(0, props.maxDisplayFields ?? 4))

const skeletonRows = [0, 1, 2, 3, 4]

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.perPage)))

const startRow = computed(() => (props.page - 1) * props.perPage + 1)
const endRow = computed(() => Math.min(props.page * props.perPage, props.total))

function handleSort(field: string) {
  if (props.sortField === field) {
    const newOrder = props.sortOrder === 'asc' ? 'desc' : 'asc'
    emit('update:sort', field, newOrder)
  } else {
    emit('update:sort', field, 'asc')
  }
}

function sortIcon(field: string) {
  if (props.sortField !== field) return ArrowUpDown
  return props.sortOrder === 'asc' ? ArrowUp : ArrowDown
}

function goToPage(p: number) {
  if (p < 1 || p > totalPages.value || p === props.page) return
  emit('update:page', p)
}

const visiblePages = computed(() => {
  const pages: number[] = []
  const current = props.page
  const last = totalPages.value
  let start = Math.max(1, current - 2)
  let end = Math.min(last, current + 2)
  if (end - start < 4) {
    if (start === 1) end = Math.min(last, start + 4)
    else start = Math.max(1, end - 4)
  }
  for (let i = start; i <= end; i++) pages.push(i)
  return pages
})
</script>

<template>
  <div
    class="bg-white dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700/60 shadow-sm overflow-hidden"
  >
    <!-- Loading state -->
    <div v-if="isLoading" class="divide-y divide-gray-100 dark:divide-gray-700/50">
      <div
        v-for="i in skeletonRows"
        :key="i"
        class="flex items-center gap-4 px-6 py-4 animate-pulse"
      >
        <div class="h-4 w-12 rounded bg-gray-200 dark:bg-gray-700" />
        <div
          v-for="j in displayFields.length"
          :key="j"
          class="h-4 rounded bg-gray-200 dark:bg-gray-700"
          :class="j === 1 ? 'flex-1' : 'w-24'"
        />
        <div class="ml-auto flex gap-2">
          <div class="h-8 w-8 rounded-md bg-gray-200 dark:bg-gray-700" />
          <div class="h-8 w-8 rounded-md bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="items.length === 0"
      class="flex flex-col items-center justify-center py-16 px-6"
    >
      <div class="w-14 h-14 rounded-full bg-gray-100 dark:bg-gray-700/60 flex items-center justify-center mb-4">
        <Inbox class="w-7 h-7 text-gray-400 dark:text-gray-500" />
      </div>
      <p class="text-base font-medium text-gray-900 dark:text-gray-200">No {{ title.toLowerCase() }} found</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Try adjusting your search or add a new entry.</p>
    </div>

    <!-- Table -->
    <div v-else class="overflow-x-auto">
      <table class="w-full caption-bottom text-sm">
        <thead>
          <tr class="border-b border-gray-200 dark:border-gray-700/60 bg-muted/80 dark:bg-muted/50">
            <th
              class="h-11 px-5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-16 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150 whitespace-nowrap"
              @click="handleSort('id')"
            >
              <div class="inline-flex items-center gap-1">
                ID
                <component :is="sortIcon('id')" class="size-3.5" />
              </div>
            </th>
              <th
                v-for="f in displayFields"
                :key="f.key"
                class="h-11 px-5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors duration-150 whitespace-nowrap"
                @click="handleSort(f.key)"
              >
                <div class="inline-flex items-center gap-1">
                  {{ f.label }}
                  <component :is="sortIcon(f.key)" class="size-3.5" />
                </div>
              </th>
            <th class="h-11 px-5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 w-24 whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100 dark:divide-gray-700/40">
          <tr
            v-for="(item, index) in items"
            :key="item.id"
            :class="[
              'transition-colors duration-150',
              index % 2 === 0
                ? 'bg-white dark:bg-gray-800/40'
                : 'bg-muted/50 dark:bg-muted/20',
              'hover:bg-blue-50/60 dark:hover:bg-blue-900/10',
            ]"
          >
            <td class="px-5 py-3.5">
              <span class="inline-flex items-center justify-center min-w-[2rem] h-6 px-1.5 rounded-md bg-gray-100 dark:bg-gray-700/60 text-xs font-mono font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                {{ item.id }}
              </span>
            </td>
            <td
              v-for="f in displayFields"
              :key="f.key"
              class="px-5 py-3.5 max-w-xs"
            >
              <slot
                v-if="hasCellSlot(f.key)"
                :name="`cell-${f.key}`"
                :item="item"
                :value="item[f.key]"
              />
              <span
                v-else-if="f.type === 'boolean'"
                :class="[
                  'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
                  item[f.key]
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400 ring-1 ring-inset ring-emerald-600/20 dark:ring-emerald-500/20'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700/50 dark:text-gray-400 ring-1 ring-inset ring-gray-300/40 dark:ring-gray-600/30',
                ]"
              >
                <span
                  :class="[
                    'w-1.5 h-1.5 rounded-full',
                    item[f.key] ? 'bg-emerald-500' : 'bg-gray-400 dark:bg-gray-500',
                  ]"
                />
                {{ item[f.key] ? "Yes" : "No" }}
              </span>
              <span v-else class="text-gray-700 dark:text-gray-300 truncate block" :title="String(item[f.key] || '')">
                {{ formatValue(item, f) }}
              </span>
            </td>
            <td class="px-5 py-3.5">
              <div class="flex items-center justify-end gap-1">
                <button
                  class="inline-flex cursor-pointer items-center justify-center rounded-lg h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-colors duration-150"
                  title="Edit"
                  @click="emit('edit', item)"
                >
                  <Pencil class="w-4 h-4" />
                </button>
                <button
                  class="inline-flex cursor-pointer items-center justify-center rounded-lg h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors duration-150"
                  title="Delete"
                  @click="emit('delete', item.id)"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination footer -->
      <div class="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700/40 bg-muted/50 dark:bg-muted/30">
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Showing
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ startRow }}</span>
          to
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ endRow }}</span>
          of
          <span class="font-medium text-gray-700 dark:text-gray-300">{{ total }}</span>
          {{ total === 1 ? 'row' : 'rows' }}
        </p>

        <div class="flex items-center gap-1">
          <button
            class="inline-flex cursor-pointer items-center justify-center rounded-lg h-8 w-8 text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
            :disabled="page <= 1"
            title="Previous page"
            @click="goToPage(page - 1)"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>

          <template v-for="p in visiblePages" :key="p">
            <button
              class="inline-flex cursor-pointer items-center justify-center rounded-lg min-w-[2rem] h-8 px-2 text-sm font-medium transition-colors duration-150"
              :class="p === page
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'"
              @click="goToPage(p)"
            >
              {{ p }}
            </button>
          </template>

          <button
            class="inline-flex cursor-pointer items-center justify-center rounded-lg h-8 w-8 text-gray-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
            :disabled="page >= totalPages"
            title="Next page"
            @click="goToPage(page + 1)"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

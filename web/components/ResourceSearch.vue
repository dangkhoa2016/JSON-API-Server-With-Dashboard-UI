<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { Search } from '@lucide/vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  searchMode?: 'client' | 'server'
  placeholder?: string
}>(), {
  modelValue: '',
  searchMode: 'client',
  placeholder: 'Search...',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:searchMode': [mode: 'client' | 'server']
  'search': [value: string]
}>()

const localValue = ref(props.modelValue)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  localValue.value = value
  emit('update:modelValue', value)
  clearDebounce()
  debounceTimer = setTimeout(() => {
    emit('search', value)
  }, 300)
}

function clearSearch() {
  localValue.value = ''
  emit('update:modelValue', '')
  clearDebounce()
  emit('search', '')
}

function clearDebounce() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}

function onEsc() {
  clearSearch()
}

function switchMode(mode: 'client' | 'server') {
  emit('update:searchMode', mode)
  clearDebounce()
  emit('search', localValue.value)
}

watch(() => props.modelValue, (val) => {
  localValue.value = val
})

onUnmounted(() => {
  clearDebounce()
})
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- Radio group -->
    <fieldset class="flex items-center gap-0 rounded-lg border border-input bg-background p-0.5 shadow-xs">
      <label
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors duration-150"
        :class="searchMode === 'client'
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-muted-foreground hover:text-foreground'"
      >
        <input
          type="radio"
          name="searchMode"
          value="client"
          :checked="searchMode === 'client'"
          class="sr-only"
          @change="switchMode('client')"
        />
        On table
      </label>
      <label
        class="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md cursor-pointer transition-colors duration-150"
        :class="searchMode === 'server'
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-muted-foreground hover:text-foreground'"
      >
        <input
          type="radio"
          name="searchMode"
          value="server"
          :checked="searchMode === 'server'"
          class="sr-only"
          @change="switchMode('server')"
        />
        From server
      </label>
    </fieldset>

    <!-- Search input -->
    <div
      class="relative flex-1 max-w-md group"
      @keydown.esc="onEsc"
    >
      <div
        class="flex items-center gap-2 rounded-xl border border-input bg-background px-3.5 py-0 shadow-xs transition-all duration-150 focus-within:border-blue-400 focus-within:ring-[3px] focus-within:ring-blue-400/20 dark:focus-within:border-blue-500 dark:focus-within:ring-blue-500/20"
      >
        <Search class="size-4 shrink-0 text-muted-foreground/60 group-focus-within:text-blue-500 transition-colors duration-150" />
        <input
          :value="localValue"
          @input="onInput"
          :placeholder="placeholder"
          class="h-9 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/50"
        />
        <button
          v-if="localValue"
          class="flex items-center justify-center size-5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-accent transition-colors duration-150"
          @click="clearSearch"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="2" y1="2" x2="10" y2="10" />
            <line x1="10" y1="2" x2="2" y2="10" />
          </svg>
        </button>
        <kbd
          v-else
          class="hidden sm:inline-flex items-center justify-center h-5 min-w-[1.25rem] rounded-md border border-input bg-muted/50 px-1.5 text-[11px] font-medium text-muted-foreground/60 leading-none"
        >
          /
        </kbd>
      </div>
    </div>
  </div>
</template>

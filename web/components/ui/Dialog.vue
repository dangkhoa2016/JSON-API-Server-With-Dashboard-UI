<script setup lang="ts">
import { cn } from '@/lib/utils'
import { X } from '@lucide/vue'

interface Props {
  class?: string
}

const props = defineProps<Props>()

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="model" class="fixed inset-0 z-50 flex items-center justify-center">
        <div
          class="fixed inset-0 bg-black/50"
          @click="model = false"
        />
        <div
          data-slot="dialog-content"
          :class="cn(
            'bg-background fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 outline-none sm:max-w-lg',
            props.class,
          )"
        >
          <slot />
          <button
            data-slot="dialog-close"
            class="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=\'size-\'])]:size-4"
            @click="model = false"
          >
            <X class="size-4" />
            <span class="sr-only">Close</span>
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

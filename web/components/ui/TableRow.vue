<script setup lang="ts">
import { cn } from '@/lib/utils'

interface Props {
  class?: string
}

const props = defineProps<Props>()
</script>

<template>
  <tr :class="cn('hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors', props.class)">
    <slot />
  </tr>
</template>

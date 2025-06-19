<script setup lang="ts">
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 shrink-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] active:scale-[0.97] select-none',
  {
    variants: {
      variant: {
        default:
          'bg-blue-600 text-white shadow-sm hover:shadow-md hover:bg-blue-700 focus-visible:ring-blue-400/50 dark:bg-blue-600 dark:hover:bg-blue-500',
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:shadow-md hover:bg-destructive/90 focus-visible:ring-destructive/30 dark:bg-destructive/80',
        outline:
          'border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20 dark:bg-transparent dark:hover:bg-accent/50',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:shadow-sm hover:bg-secondary/80',
        ghost:
          'text-foreground/70 hover:text-foreground hover:bg-accent dark:hover:bg-accent/50',
        link:
          'text-primary underline-offset-4 hover:underline hover:text-primary/80',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md gap-1.5 px-3',
        lg: 'h-10 rounded-lg px-6',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonVariants = VariantProps<typeof buttonVariants>

interface Props {
  variant?: ButtonVariants['variant']
  size?: ButtonVariants['size']
  class?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'default',
})
</script>

<template>
  <button
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </button>
</template>

<style scoped>
button > svg {
  pointer-events: none;
  flex-shrink: 0;
}
</style>

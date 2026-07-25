<script setup lang="ts">
import AppLayout from '@/components/AppLayout.vue'
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'
</script>

<template>
  <AppLayout>
    <router-view />
    <Toaster
      position="top-right"
      closeButton
      richColors
      :duration="10000"
      :visibleToasts="5"
      :expand="false"
      :gap="8"
    />
  </AppLayout>
</template>

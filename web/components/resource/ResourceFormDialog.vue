<script setup lang="ts">
import { inject } from "vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Dialog from "@/components/ui/Dialog.vue";
import { Loader2 } from "@lucide/vue";

interface Field {
  key: string;
  label: string;
  type: "text" | "number" | "email" | "textarea" | "boolean";
  required?: boolean;
}

defineProps<{
  modelValue: boolean;
  title: string;
  fields: Field[];
  formData: Record<string, unknown>;
  validationErrors: Record<string, string>;
  isProcessing: boolean;
  mode: "create" | "edit";
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
  cancel: [];
  "update:field": [key: string, value: unknown];
}>();

const parentSlots = inject<
  Record<string, (scope: Record<string, unknown>) => unknown>
>("resource-parent-slots", {});

function setFormField(key: string, value: unknown) {
  emit("update:field", key, value);
}

function hasCustomSlot(key: string): boolean {
  return !!parentSlots[`field-${key}`];
}

function renderCustomSlot(
  key: string,
  value: unknown,
  update: (v: unknown) => void
) {
  const slotFn = parentSlots[`field-${key}`];
  return { render: () => slotFn({ value, update }) };
}
</script>

<template>
  <Dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">
        {{ mode === "create" ? "Create" : "Edit" }} {{ title }}
      </h2>
      <div v-for="field in fields" :key="field.key" class="space-y-1">
        <Label :for="mode === 'edit' ? 'edit-' + field.key : field.key">
          {{ field.label }}
          <span v-if="field.required" class="text-red-500">*</span>
        </Label>

        <component
          v-if="hasCustomSlot(field.key)"
          :is="
            renderCustomSlot(field.key, formData[field.key], (v: unknown) =>
              setFormField(field.key, v)
            )
          "
        />

        <textarea
          v-else-if="field.type === 'textarea'"
          :id="mode === 'edit' ? 'edit-' + field.key : field.key"
          class="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          rows="3"
          :value="(formData[field.key] as string) || ''"
          @input="
            setFormField(
              field.key,
              ($event.target as HTMLTextAreaElement).value
            )
          "
        />
        <input
          v-else-if="field.type === 'boolean'"
          :id="mode === 'edit' ? 'edit-' + field.key : field.key"
          type="checkbox"
          class="mt-2 w-4 h-4"
          :checked="!!formData[field.key]"
          @change="
            setFormField(field.key, ($event.target as HTMLInputElement).checked)
          "
        />
        <Input
          v-else
          :id="mode === 'edit' ? 'edit-' + field.key : field.key"
          :type="field.type"
          class="mt-1"
          :model-value="(formData[field.key] as string) || ''"
          @update:model-value="setFormField(field.key, $event)"
        />
        <p v-if="validationErrors[field.key]" class="text-sm text-red-500 mt-1">
          {{ validationErrors[field.key] }}
        </p>
      </div>
      <div class="flex justify-end gap-3 pt-2">
        <Button variant="outline" @click="emit('cancel')">Cancel</Button>
        <Button :disabled="isProcessing" @click="emit('confirm')">
          <Loader2 v-if="isProcessing" class="w-4 h-4 animate-spin" />
          {{ mode === "create" ? "Create" : "Update" }}
        </Button>
      </div>
    </div>
  </Dialog>
</template>

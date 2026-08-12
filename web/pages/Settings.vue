<script setup lang="ts">
import { nextTick, ref } from "vue";
import {
  Settings as SettingsIcon,
  Loader2,
  LogIn,
  LogOut,
  Trash2,
} from "@lucide/vue";
import Button from "@/components/ui/Button.vue";
import SettingRow from "@/components/settings/SettingRow.vue";
import AdminLoginDialog from "@/components/settings/AdminLoginDialog.vue";
import ResetDatabaseDialog from "@/components/settings/ResetDatabaseDialog.vue";
import { trpc } from "@/providers/trpc";
import { validateRedisUrl } from "@db/redis-url";
import { useQueryClient } from "@tanstack/vue-query";
import { useAuth } from "@/composables/useAuth";
import { toast } from "vue-sonner";

const { isAuthenticated, isAdmin, login, logout } = useAuth();

const showLoginDialog = ref(false);
const loginUsername = ref("");
const loginPassword = ref("");
const loginError = ref("");
const visibleKeys = ref<string[]>([]);
const revealedValues = ref<Record<string, string>>({});

const revealMutation = trpc.admin.settings.reveal.useMutation();

async function toggleVisible(key: string) {
  const idx = visibleKeys.value.indexOf(key);
  if (idx === -1) {
    try {
      const result = await revealMutation.mutateAsync({ key });
      if (result) {
        revealedValues.value[key] = result.value;
        if (key in editingValues.value) {
          editingValues.value[key] = result.value;
        }
      }
      visibleKeys.value.push(key);
    } catch {
      toast.error("Failed to reveal setting value");
    }
  } else {
    visibleKeys.value.splice(idx, 1);
  }
}

function isVisible(key: string) {
  return visibleKeys.value.includes(key);
}

const settingsQuery = trpc.admin.settings.list.useQuery();
const settings = settingsQuery.data;
const isLoading = settingsQuery.isLoading;

const queryClient = useQueryClient();

const invalidateFeatureCards = () => {
  queryClient.invalidateQueries({
    queryKey: [
      { subsystem: "trpc", path: "json.getFeatureCards", input: undefined },
    ],
  });
};

const updateMutation = trpc.admin.settings.update.useMutation({
  onSuccess: result => {
    if (result.ok) {
      toast.success("Setting updated");
      queryClient.invalidateQueries({
        queryKey: [{ subsystem: "trpc", path: "admin.settings.list" }],
      });
      invalidateFeatureCards();
    } else {
      toast.error(result.message ?? "Failed to update setting");
    }
  },
  onError: () => {
    toast.error("Failed to update setting");
  },
});

const resetMutation = trpc.admin.settings.reset.useMutation({
  onSuccess: result => {
    if (result.ok) {
      toast.success("Setting reset to default");
      queryClient.invalidateQueries({
        queryKey: [{ subsystem: "trpc", path: "admin.settings.list" }],
      });
      invalidateFeatureCards();
    } else {
      toast.error(result.message ?? "Failed to reset setting");
    }
  },
  onError: () => {
    toast.error("Failed to reset setting");
  },
});

const showResetConfirmDialog = ref(false);

const resetDatabaseMutation = trpc.admin.data.resetDatabase.useMutation({
  onSuccess: result => {
    showResetConfirmDialog.value = false;
    if (result.ok) {
      toast.success("Database reset and re-seeded successfully");
      settingsQuery.refetch();
    } else {
      toast.error("Failed to reset database");
    }
  },
  onError: () => {
    showResetConfirmDialog.value = false;
    toast.error("Failed to reset database");
  },
});

const editingValues = ref<Record<string, string>>({});
const originalValues = ref<Record<string, string>>({});

function hasChanges(key: string): boolean {
  if (!(key in editingValues.value)) return false;
  return editingValues.value[key] !== originalValues.value[key];
}

async function doLogin() {
  loginError.value = "";
  const result = await login(loginUsername.value, loginPassword.value);
  if (result.ok) {
    showLoginDialog.value = false;
    loginUsername.value = "";
    loginPassword.value = "";
    settingsQuery.refetch();
    toast.success("Logged in as admin");
  } else {
    loginError.value = result.message || "Invalid username or password";
  }
}

function startEdit(key: string, value: string) {
  editingValues.value[key] = value;
  originalValues.value[key] = value;
  nextTick(() => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-edit-key="${key}"]`
    );
    el?.focus();
  });
}

function cancelEdit(key: string) {
  delete editingValues.value[key];
  delete originalValues.value[key];
}

function saveEdit(key: string) {
  const value = editingValues.value[key];
  if (value !== undefined) {
    if (!value.trim()) {
      toast.error("Value cannot be empty");
      return;
    }
    if (/^\*+$/.test(value)) {
      toast.error("Value cannot be all asterisks");
      return;
    }
    if (key === "ADMIN_PASSWORD_HASH" && value.startsWith("$argon2")) {
      toast.error(
        "Password hash detected. Please enter a plain text password instead."
      );
      return;
    }
    if (key === "REDIS_URL") {
      const error = validateRedisUrl(value);
      if (error) {
        toast.error(error);
        return;
      }
    }
    updateMutation.mutate({ key, value });
    delete editingValues.value[key];
    delete originalValues.value[key];
    delete revealedValues.value[key];
    const idx = visibleKeys.value.indexOf(key);
    if (idx !== -1) visibleKeys.value.splice(idx, 1);
  }
}

function doReset(key: string) {
  resetMutation.mutate({ key });
  delete revealedValues.value[key];
  const idx = visibleKeys.value.indexOf(key);
  if (idx !== -1) visibleKeys.value.splice(idx, 1);
}

function doLogout() {
  logout();
  settingsQuery.refetch();
  toast.success("Logged out");
}

function openResetConfirm() {
  showResetConfirmDialog.value = true;
}

function doResetDatabase() {
  resetDatabaseMutation.mutate();
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center"
        >
          <SettingsIcon class="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Settings
          </h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Application configuration
          </p>
        </div>
      </div>
      <div v-if="isAuthenticated" class="flex items-center gap-3">
        <span class="text-sm text-gray-500 dark:text-gray-400"
          >Logged in as <strong>admin</strong></span
        >
        <Button
          variant="destructive"
          size="sm"
          @click="openResetConfirm"
          :disabled="resetDatabaseMutation.isPending.value"
        >
          <Trash2 class="w-4 h-4" />
          Reset Database
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="dark:border-gray-500 dark:text-gray-200 dark:hover:bg-gray-700"
          @click="doLogout"
        >
          <LogOut class="w-4 h-4" />
          Logout
        </Button>
      </div>
    </div>

    <!-- Guest banner -->
    <div
      v-if="!isAuthenticated"
      class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between"
    >
      <p class="text-sm text-amber-800 dark:text-amber-300">
        You are viewing settings as a guest. Login as admin to modify
        configuration.
      </p>
      <Button variant="default" size="sm" @click="showLoginDialog = true">
        <LogIn class="w-4 h-4" />
        Login
      </Button>
    </div>

    <!-- Settings list -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Loader2 class="w-6 h-6 animate-spin text-gray-400" />
    </div>

    <div v-else-if="settings && settings.length > 0" class="space-y-4">
      <SettingRow
        v-for="setting in settings"
        :key="setting.key"
        :setting="setting"
        :is-admin="!!isAdmin"
        :editing-value="editingValues[setting.key]"
        :is-visible="isVisible(setting.key)"
        :revealed-value="revealedValues[setting.key]"
        :is-update-pending="updateMutation?.isPending?.value ?? false"
        :has-changes="hasChanges(setting.key)"
        @edit="startEdit"
        @cancel="cancelEdit"
        @save="saveEdit"
        @toggle-visible="toggleVisible"
        @reset="doReset"
        @update:editing-value="(key, val) => (editingValues[key] = val)"
      />
    </div>

    <div v-else class="text-center py-12 text-gray-500 dark:text-gray-400">
      No settings found.
    </div>

    <ResetDatabaseDialog
      v-model="showResetConfirmDialog"
      :is-processing="resetDatabaseMutation.isPending.value"
      @confirm="doResetDatabase"
      @cancel="showResetConfirmDialog = false"
    />

    <AdminLoginDialog
      v-model="showLoginDialog"
      :username="loginUsername"
      :password="loginPassword"
      :error="loginError"
      @login="doLogin"
      @cancel="showLoginDialog = false"
      @update:username="loginUsername = $event"
      @update:password="loginPassword = $event"
    />
  </div>
</template>

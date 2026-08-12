// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import Settings from "@/pages/Settings.vue";
import {
  authState,
  isResetDbPending,
  updateMutate,
  resetMutate,
  queryState,
  resetAllMocks,
} from "./Settings.helpers";

vi.mock("@/lib/utils", async () => {
  const { utilsMockFactory } = await import("./Settings.helpers");
  return utilsMockFactory();
});
vi.mock("vue-sonner", async () => {
  const { sonnerMockFactory } = await import("./Settings.helpers");
  return sonnerMockFactory();
});
vi.mock("@/composables/useAuth", async () => {
  const { authMockFactory } = await import("./Settings.helpers");
  return authMockFactory();
});
vi.mock("@tanstack/vue-query", async () => {
  const { queryClientMockFactory } = await import("./Settings.helpers");
  return queryClientMockFactory();
});
vi.mock("@/providers/trpc", async () => {
  const { trpcMockFactory } = await import("./Settings.helpers");
  return trpcMockFactory();
});

const iconStub = { template: '<span class="icon-stub" />' };
const uiStubs = {
  Button: {
    name: "Button",
    props: ["disabled"],
    emits: ["click"],
    template:
      '<button class="btn-stub" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
  },
  Input: {
    name: "Input",
    props: ["modelValue"],
    emits: ["update:modelValue", "keyup"],
    template:
      '<input class="input-stub" :value="modelValue" @keyup="$emit(\'keyup\', $event)" />',
  },
  Label: {
    name: "Label",
    template: '<label class="label-stub"><slot /></label>',
  },
  Dialog: {
    name: "Dialog",
    props: ["modelValue"],
    emits: ["update:modelValue"],
    template: '<div class="dialog-stub" v-if="modelValue"><slot /></div>',
  },
};

function createMountWrapper(options?: Record<string, boolean>) {
  const authenticated = options?.authenticated ?? false;
  const admin = options?.admin ?? false;
  authState._authenticated = authenticated;
  authState._admin = admin;
  return mount(Settings, {
    global: {
      stubs: {
        SettingsIcon: iconStub,
        Loader2: iconStub,
        LogIn: iconStub,
        LogOut: iconStub,
        Save: iconStub,
        RotateCcw: iconStub,
        Eye: iconStub,
        EyeOff: iconStub,
        Trash2: iconStub,
        AlertTriangle: iconStub,
        Pencil: iconStub,
        ...uiStubs,
      },
    },
  });
}

describe("Settings.vue — edit interactions", () => {
  beforeEach(() => resetAllMocks());

  it("admin sees edit interface when editing", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "edited-value");
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Save");
    expect(wrapper.text()).toContain("Cancel");
  });

  it("admin can start editing via startEdit", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "edited-value");
    await wrapper.vm.$nextTick();
    expect(vm.editingValues["REDIS_ENABLED"]).toBe("edited-value");
  });

  it("clicking edit button starts editing", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    await wrapper.vm.$nextTick();
    const editBtn = wrapper.find('button[title="Edit"]');
    await editBtn.trigger("click");
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as any;
    expect(Object.keys(vm.editingValues).length).toBeGreaterThan(0);
  });

  it("clicking code element starts editing", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    await wrapper.vm.$nextTick();
    const code = wrapper.find("code");
    await code.trigger("click");
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as any;
    expect(Object.keys(vm.editingValues).length).toBeGreaterThan(0);
  });

  it("editing input v-model handler updates editing value", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    const vm = wrapper.vm as any;
    await wrapper.vm.$nextTick();
    const editBtn = wrapper.find('button[title="Edit"]');
    await editBtn.trigger("click");
    await wrapper.vm.$nextTick();
    const editingInput = wrapper.findComponent({ name: "Input" });
    editingInput.vm.$emit("update:modelValue", "new-value");
    await wrapper.vm.$nextTick();
    expect(vm.editingValues["REDIS_ENABLED"]).toBe("new-value");
  });

  it("clicking save button calls saveEdit", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    await wrapper.vm.$nextTick();
    const editBtn = wrapper.find('button[title="Edit"]');
    await editBtn.trigger("click");
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as any;
    vm.editingValues["REDIS_ENABLED"] = "changed-value";
    await wrapper.vm.$nextTick();
    const saveBtn = wrapper
      .findAllComponents({ name: "Button" })
      .filter(b => b.text() === "Save")[0];
    saveBtn.vm.$emit("click");
    await wrapper.vm.$nextTick();
    expect(updateMutate).toHaveBeenCalled();
  });

  it("saveEdit rejects all-asterisk values", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "***");
    await wrapper.vm.$nextTick();
    const saveBtn = wrapper
      .findAllComponents({ name: "Button" })
      .filter(b => b.text() === "Save")[0];
    saveBtn.vm.$emit("click");
    await wrapper.vm.$nextTick();
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("Save button is disabled when value has not changed", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    await wrapper.vm.$nextTick();
    const editBtn = wrapper.find('button[title="Edit"]');
    await editBtn.trigger("click");
    await wrapper.vm.$nextTick();
    const saveBtn = wrapper
      .findAllComponents({ name: "Button" })
      .filter(b => b.text() === "Save")[0];
    expect(saveBtn.props("disabled")).toBe(true);
  });

  it("Save button is enabled when value changes", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    await wrapper.vm.$nextTick();
    const editBtn = wrapper.find('button[title="Edit"]');
    await editBtn.trigger("click");
    await wrapper.vm.$nextTick();
    const vm = wrapper.vm as any;
    vm.editingValues["REDIS_ENABLED"] = "changed";
    await wrapper.vm.$nextTick();
    const saveBtn = wrapper
      .findAllComponents({ name: "Button" })
      .filter(b => b.text() === "Save")[0];
    expect(saveBtn.props("disabled")).toBe(false);
  });

  it("clicking cancel in edit mode triggers cancelEdit via click", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "edited-value");
    await wrapper.vm.$nextTick();
    const cancelBtn = wrapper
      .findAllComponents({ name: "Button" })
      .filter(b => b.text() === "Cancel")[0];
    await cancelBtn.trigger("click");
    await wrapper.vm.$nextTick();
    expect(vm.editingValues["REDIS_ENABLED"]).toBeUndefined();
  });

  it("clicking reset button calls doReset", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    await wrapper.vm.$nextTick();
    const resetBtn = wrapper.find('button[title="Reset to default"]');
    await resetBtn.trigger("click");
    await wrapper.vm.$nextTick();
    expect(resetMutate).toHaveBeenCalled();
  });

  it("does not render reset button for ADMIN_PASSWORD_HASH", async () => {
    queryState.data = [
      {
        key: "ADMIN_PASSWORD_HASH",
        value: "********",
        type: "string",
        label: "Admin Password Hash",
        description: "Argon2 hash",
        group: "auth",
        isPublic: false,
      },
      {
        key: "REDIS_ENABLED",
        value: "false",
        type: "boolean",
        label: "Redis Enabled",
        description: "Enable Redis caching",
        group: "redis",
        isPublic: true,
      },
      {
        key: "API_KEY",
        value: "sk-123456",
        type: "string",
        label: "API Key",
        description: "API key",
        group: "api",
        isPublic: true,
      },
    ];
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    await wrapper.vm.$nextTick();

    expect(wrapper.findAll('button[title="Reset to default"]').length).toBe(2);
  });
});

describe("Settings.vue — reset confirm dialog", () => {
  beforeEach(() => resetAllMocks());

  it("reset confirm dialog opens and shows warning", async () => {
    const wrapper = createMountWrapper({ authenticated: true });
    const vm = wrapper.vm as any;
    vm.openResetConfirm();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Reset Database");
    expect(wrapper.text()).toContain("Warning");
  });

  it("closing reset confirm dialog emits update:modelValue", async () => {
    const wrapper = createMountWrapper({ authenticated: true });
    const vm = wrapper.vm as any;
    vm.openResetConfirm();
    await wrapper.vm.$nextTick();
    const dialog = wrapper.findComponent({ name: "Dialog" });
    dialog.vm.$emit("update:modelValue", false);
    await wrapper.vm.$nextTick();
    expect(vm.showResetConfirmDialog).toBe(false);
  });

  it("clicking cancel in reset confirm dialog closes it", async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true });
    const vm = wrapper.vm as any;
    vm.openResetConfirm();
    await wrapper.vm.$nextTick();
    const buttons = wrapper.findAllComponents({ name: "Button" });
    const cancelBtn = buttons.filter(b => b.text() === "Cancel")[0];
    await cancelBtn.trigger("click");
    await wrapper.vm.$nextTick();
    expect(vm.showResetConfirmDialog).toBe(false);
  });

  it("reset database button shows pending state", async () => {
    const wrapper = createMountWrapper({ authenticated: true });
    const vm = wrapper.vm as any;
    vm.openResetConfirm();
    isResetDbPending.value = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Resetting");
  });
});

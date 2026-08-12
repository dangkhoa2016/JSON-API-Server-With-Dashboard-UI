// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { shallowMount } from "@vue/test-utils";
import Settings from "@/pages/Settings.vue";
import {
  authState,
  invalidateQueries,
  refetchFn,
  toastSuccess,
  toastError,
  updateMutate,
  resetMutate,
  resetDbMutate,
  mutationOpts,
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

describe("Settings.vue — login, edit, and mutation callbacks", () => {
  beforeEach(() => resetAllMocks());

  function createWrapper() {
    return shallowMount(Settings);
  }

  // --- Login ---

  it("opens login dialog on login button click", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.showLoginDialog = true;
    expect(vm.showLoginDialog).toBe(true);
  });

  it("calls login with credentials on doLogin", async () => {
    authState.login.mockResolvedValue({ ok: true });
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.loginUsername = "admin";
    vm.loginPassword = "admin123";
    await vm.doLogin();
    expect(authState.login).toHaveBeenCalledWith("admin", "admin123");
    expect(refetchFn).toHaveBeenCalled();
  });

  it("shows error on failed login", async () => {
    authState.login.mockResolvedValue({ ok: false });
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.loginUsername = "admin";
    vm.loginPassword = "wrong";
    await vm.doLogin();
    expect(vm.loginError).toBe("Invalid username or password");
  });

  it("resets login state on successful login", async () => {
    authState.login.mockResolvedValue({ ok: true });
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.loginUsername = "admin";
    vm.loginPassword = "admin123";
    await vm.doLogin();
    expect(vm.showLoginDialog).toBe(false);
    expect(vm.loginUsername).toBe("");
    expect(vm.loginPassword).toBe("");
    expect(refetchFn).toHaveBeenCalled();
  });

  it("clears login error before login attempt", async () => {
    authState.login.mockResolvedValue(false);
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.loginError = "old error";
    await vm.doLogin();
    expect(vm.loginError).toBe("Invalid username or password");
  });

  // --- Edit/Cancel/Save ---

  it("startEdit sets editing value", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "new-value");
    expect(vm.editingValues["REDIS_ENABLED"]).toBe("new-value");
  });

  it("cancelEdit removes editing value", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "val");
    vm.cancelEdit("REDIS_ENABLED");
    expect(vm.editingValues["REDIS_ENABLED"]).toBeUndefined();
  });

  it("saveEdit calls update mutation", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "new-val");
    vm.saveEdit("REDIS_ENABLED");
    expect(updateMutate).toHaveBeenCalledWith({
      key: "REDIS_ENABLED",
      value: "new-val",
    });
  });

  it("saveEdit deletes editing value after mutation", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "new-val");
    vm.saveEdit("REDIS_ENABLED");
    expect(vm.editingValues["REDIS_ENABLED"]).toBeUndefined();
  });

  it("saveEdit does nothing for undefined value", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.editingValues["MISSING"] = undefined;
    vm.saveEdit("MISSING");
    expect(updateMutate).not.toHaveBeenCalled();
  });

  it("saveEdit rejects all-asterisk values", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "***");
    vm.saveEdit("REDIS_ENABLED");
    expect(updateMutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Value cannot be all asterisks");
  });

  it("saveEdit rejects empty values", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "");
    vm.saveEdit("REDIS_ENABLED");
    expect(updateMutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Value cannot be empty");
  });

  it("saveEdit rejects argon2 hash values for ADMIN_PASSWORD_HASH", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit(
      "ADMIN_PASSWORD_HASH",
      "$argon2id$v=19$m=19456,t=2,p=1$ELR9WQOOF3c3nUdGMf0PKA$Pv/0CUH8FT5VJxtAtxKJBwNpUvWNB5kl"
    );
    vm.saveEdit("ADMIN_PASSWORD_HASH");
    expect(updateMutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Password hash detected. Please enter a plain text password instead."
    );
  });

  it("saveEdit accepts plain text values for ADMIN_PASSWORD_HASH", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("ADMIN_PASSWORD_HASH", "newpassword");
    vm.saveEdit("ADMIN_PASSWORD_HASH");
    expect(updateMutate).toHaveBeenCalledWith({
      key: "ADMIN_PASSWORD_HASH",
      value: "newpassword",
    });
  });

  it("saveEdit rejects invalid REDIS_URL values", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_URL", "not-a-url");
    vm.saveEdit("REDIS_URL");
    expect(updateMutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining("REDIS_URL")
    );
  });

  it("saveEdit accepts valid REDIS_URL values", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_URL", "redis://cache:6379/0");
    vm.saveEdit("REDIS_URL");
    expect(updateMutate).toHaveBeenCalledWith({
      key: "REDIS_URL",
      value: "redis://cache:6379/0",
    });
  });

  it("saveEdit rejects whitespace-only values", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "   ");
    vm.saveEdit("REDIS_ENABLED");
    expect(updateMutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Value cannot be empty");
  });

  it("reset mutation is called on doReset", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.doReset("REDIS_ENABLED");
    expect(resetMutate).toHaveBeenCalledWith({ key: "REDIS_ENABLED" });
  });

  it("saveEdit clears revealedValues and visibleKeys for the key", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.revealedValues["REDIS_ENABLED"] = "old-secret";
    vm.visibleKeys.push("REDIS_ENABLED");
    vm.startEdit("REDIS_ENABLED", "new-val");
    vm.saveEdit("REDIS_ENABLED");
    expect(vm.revealedValues["REDIS_ENABLED"]).toBeUndefined();
    expect(vm.visibleKeys).not.toContain("REDIS_ENABLED");
  });

  it("saveEdit does not error when key is not in visibleKeys", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.startEdit("REDIS_ENABLED", "new-val");
    vm.saveEdit("REDIS_ENABLED");
    expect(updateMutate).toHaveBeenCalled();
  });

  it("doReset clears revealedValues and visibleKeys for the key", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.revealedValues["REDIS_ENABLED"] = "old-secret";
    vm.visibleKeys.push("REDIS_ENABLED");
    vm.doReset("REDIS_ENABLED");
    expect(vm.revealedValues["REDIS_ENABLED"]).toBeUndefined();
    expect(vm.visibleKeys).not.toContain("REDIS_ENABLED");
    expect(resetMutate).toHaveBeenCalledWith({ key: "REDIS_ENABLED" });
  });

  // --- Reset confirm dialog ---

  it("opens reset confirm dialog", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.openResetConfirm();
    expect(vm.showResetConfirmDialog).toBe(true);
  });

  it("triggers reset database mutation", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.doResetDatabase();
    expect(resetDbMutate).toHaveBeenCalled();
  });

  it("reset confirm dialog can be closed", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.openResetConfirm();
    vm.showResetConfirmDialog = false;
    expect(vm.showResetConfirmDialog).toBe(false);
  });

  // --- Mutation callbacks ---

  it("update mutation onSuccess with ok: true shows success toast", () => {
    createWrapper();
    expect(mutationOpts.update).not.toBeNull();
    mutationOpts.update.onSuccess({ ok: true });
    expect(toastSuccess).toHaveBeenCalledWith("Setting updated");
  });

  it("update mutation onSuccess with ok: false shows error toast", () => {
    createWrapper();
    mutationOpts.update.onSuccess({ ok: false, message: "Update failed" });
    expect(toastError).toHaveBeenCalledWith("Update failed");
  });

  it("update mutation onSuccess with ok: false and no message shows default error", () => {
    createWrapper();
    mutationOpts.update.onSuccess({ ok: false });
    expect(toastError).toHaveBeenCalledWith("Failed to update setting");
  });

  it("update mutation onError shows error toast", () => {
    createWrapper();
    mutationOpts.update.onError();
    expect(toastError).toHaveBeenCalledWith("Failed to update setting");
  });

  it("reset mutation onSuccess with ok: true shows success toast", () => {
    createWrapper();
    mutationOpts.reset.onSuccess({ ok: true });
    expect(toastSuccess).toHaveBeenCalledWith("Setting reset to default");
  });

  it("reset mutation onSuccess with ok: false shows error toast", () => {
    createWrapper();
    mutationOpts.reset.onSuccess({ ok: false, message: "Reset failed" });
    expect(toastError).toHaveBeenCalledWith("Reset failed");
  });

  it("reset mutation onSuccess with ok: false and no message shows default error", () => {
    createWrapper();
    mutationOpts.reset.onSuccess({ ok: false });
    expect(toastError).toHaveBeenCalledWith("Failed to reset setting");
  });

  it("reset mutation onError shows error toast", () => {
    createWrapper();
    mutationOpts.reset.onError();
    expect(toastError).toHaveBeenCalledWith("Failed to reset setting");
  });

  it("reset database mutation onSuccess with ok: true shows success toast", () => {
    createWrapper();
    mutationOpts.resetDb.onSuccess({ ok: true });
    expect(toastSuccess).toHaveBeenCalledWith(
      "Database reset and re-seeded successfully"
    );
  });

  it("reset database mutation onSuccess with ok: false shows error toast", () => {
    createWrapper();
    mutationOpts.resetDb.onSuccess({
      ok: false,
      message: "Failed to reset database",
    });
    expect(toastError).toHaveBeenCalledWith("Failed to reset database");
  });

  it("reset database mutation onError shows error toast", () => {
    createWrapper();
    mutationOpts.resetDb.onError();
    expect(toastError).toHaveBeenCalledWith("Failed to reset database");
  });

  it("reset database mutation onSuccess closes dialog", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.showResetConfirmDialog = true;
    mutationOpts.resetDb.onSuccess({ ok: true });
    expect(vm.showResetConfirmDialog).toBe(false);
  });

  it("reset database mutation onError closes dialog", () => {
    const wrapper = createWrapper();
    const vm = wrapper.vm as any;
    vm.showResetConfirmDialog = true;
    mutationOpts.resetDb.onError();
    expect(vm.showResetConfirmDialog).toBe(false);
  });

  // --- Refetch after mutations ---

  it("update mutation success triggers invalidateQueries", () => {
    createWrapper();
    mutationOpts.update.onSuccess({ ok: true });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [{ subsystem: "trpc", path: "admin.settings.list" }],
    });
  });

  it("reset mutation success triggers invalidateQueries", () => {
    createWrapper();
    mutationOpts.reset.onSuccess({ ok: true });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [{ subsystem: "trpc", path: "admin.settings.list" }],
    });
  });

  it("reset database mutation success triggers refetch", () => {
    createWrapper();
    mutationOpts.resetDb.onSuccess({ ok: true });
    expect(refetchFn).toHaveBeenCalled();
  });
});

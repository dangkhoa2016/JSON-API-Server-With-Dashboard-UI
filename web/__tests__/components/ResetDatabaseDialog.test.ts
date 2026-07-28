// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ResetDatabaseDialog from "@/components/settings/ResetDatabaseDialog.vue";

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(" "),
}));

describe("ResetDatabaseDialog", () => {
  it("renders when open", () => {
    const wrapper = mount(ResetDatabaseDialog, {
      props: { modelValue: true, isProcessing: false },
      attachTo: document.body,
    });
    expect(document.body.innerHTML).toContain("Reset Database");
    expect(document.body.innerHTML).toContain("Warning");
    wrapper.unmount();
  });

  it("does not render when closed", () => {
    mount(ResetDatabaseDialog, {
      props: { modelValue: false, isProcessing: false },
    });
    expect(document.body.innerHTML).not.toContain("Reset Database");
  });

  it("shows Resetting... text when processing", () => {
    const wrapper = mount(ResetDatabaseDialog, {
      props: { modelValue: true, isProcessing: true },
      attachTo: document.body,
    });
    expect(document.body.innerHTML).toContain("Resetting...");
    wrapper.unmount();
  });

  it("emits cancel on Cancel click", async () => {
    const wrapper = mount(ResetDatabaseDialog, {
      props: { modelValue: true, isProcessing: false },
      attachTo: document.body,
    });
    const cancelBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent === "Cancel",
    );
    cancelBtn?.click();
    expect(wrapper.emitted("cancel")).toBeTruthy();
    wrapper.unmount();
  });

  it("emits confirm on Reset Database click", async () => {
    const wrapper = mount(ResetDatabaseDialog, {
      props: { modelValue: true, isProcessing: false },
      attachTo: document.body,
    });
    const resetBtn = Array.from(document.body.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Reset Database"),
    );
    resetBtn?.click();
    expect(wrapper.emitted("confirm")).toBeTruthy();
    wrapper.unmount();
  });
});

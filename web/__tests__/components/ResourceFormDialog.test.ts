// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ResourceFormDialog from "@/components/resource/ResourceFormDialog.vue";

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(" "),
}));

const baseProps = {
  modelValue: true,
  title: "Post",
  fields: [
    { key: "title", label: "Title", type: "text" as const, required: true },
  ],
  formData: { title: "Hello" },
  validationErrors: {},
  isProcessing: false,
  mode: "edit" as const,
};

describe("ResourceFormDialog", () => {
  it("renders when open", () => {
    const wrapper = mount(ResourceFormDialog, {
      props: baseProps,
      attachTo: document.body,
    });
    expect(document.body.innerHTML).toContain("Edit Post");
    wrapper.unmount();
  });

  it("emits update:field on input change", async () => {
    const wrapper = mount(ResourceFormDialog, {
      props: baseProps,
      attachTo: document.body,
    });
    const input = document.body.querySelector('input');
    if (input) {
      input.value = 'New Title';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    expect(wrapper.emitted("update:field")).toHaveLength(1);
    expect(wrapper.emitted("update:field")[0]).toEqual(["title", "New Title"]);
    wrapper.unmount();
  });

  it("emits cancel and confirm", async () => {
    const wrapper = mount(ResourceFormDialog, {
      props: baseProps,
      attachTo: document.body,
    });
    const buttons = document.body.querySelectorAll("button");
    const cancelBtn = Array.from(buttons).find((b) => b.textContent?.trim() === "Cancel");
    cancelBtn?.click();
    expect(wrapper.emitted("cancel")).toBeTruthy();
    const updateBtn = Array.from(buttons).find((b) => b.textContent?.includes("Update"));
    updateBtn?.click();
    expect(wrapper.emitted("confirm")).toBeTruthy();
    wrapper.unmount();
  });

  it("renders field content without custom slot", () => {
    const wrapper = mount(ResourceFormDialog, {
      props: {
        ...baseProps,
        fields: [
          { key: "custom_field", label: "Custom", type: "text" },
        ],
      },
      global: {
        provide: {
          "resource-parent-slots": {},
        },
      },
      attachTo: document.body,
    });
    expect(document.body.innerHTML).toContain("Custom");
    wrapper.unmount();
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import ResourceDeleteDialog from "@/components/resource/ResourceDeleteDialog.vue";

vi.mock("@/lib/utils", () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(" "),
}));

describe("ResourceDeleteDialog", () => {
  it("renders content when open", () => {
    const wrapper = mount(ResourceDeleteDialog, {
      props: { modelValue: true, title: "Post" },
      attachTo: document.body,
    });
    expect(document.body.innerHTML).toContain("Delete Post");
    expect(document.body.innerHTML).toContain("Are you sure");
    wrapper.unmount();
  });

  it("does not render when closed", () => {
    mount(ResourceDeleteDialog, {
      props: { modelValue: false, title: "Post" },
    });
    expect(document.body.innerHTML).not.toContain("Delete Post");
  });

  it("emits cancel on Cancel click", async () => {
    const wrapper = mount(ResourceDeleteDialog, {
      props: { modelValue: true, title: "Post" },
      attachTo: document.body,
    });
    const buttons = document.body.querySelectorAll("button");
    const cancelBtn = Array.from(buttons).find((b) => b.textContent === "Cancel");
    cancelBtn?.click();
    expect(wrapper.emitted("cancel")).toBeTruthy();
    wrapper.unmount();
  });

  it("emits confirm on Delete click", async () => {
    const wrapper = mount(ResourceDeleteDialog, {
      props: { modelValue: true, title: "Post" },
      attachTo: document.body,
    });
    const buttons = document.body.querySelectorAll("button");
    const deleteBtn = Array.from(buttons).find((b) => b.textContent === "Delete");
    deleteBtn?.click();
    expect(wrapper.emitted("confirm")).toBeTruthy();
    wrapper.unmount();
  });
});

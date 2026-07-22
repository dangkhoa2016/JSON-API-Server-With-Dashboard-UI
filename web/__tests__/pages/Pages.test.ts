// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { shallowMount, mount } from '@vue/test-utils'
import Albums from '@/pages/Albums.vue'
import Comments from '@/pages/Comments.vue'
import Photos from '@/pages/Photos.vue'
import Posts from '@/pages/Posts.vue'
import Todos from '@/pages/Todos.vue'

vi.mock('@/composables/useResourceCrud', () => ({
  useResourceCrud: () => ({
    list: { data: { value: { data: [] } }, isLoading: { value: false } },
    create: { isPending: { value: false } },
    update: { isPending: { value: false } },
    handleCreate: vi.fn(),
    handleUpdate: vi.fn(),
    handleDelete: vi.fn(),
    handleSearch: vi.fn(),
    handleSort: vi.fn(),
    page: { value: 1, __v_isRef: true },
    perPage: 25,
  }),
}))

vi.mock('@lucide/vue', () => ({
  Image: { name: 'Image', render: () => null },
  MessageSquare: { name: 'MessageSquare', render: () => null },
  FileText: { name: 'FileText', render: () => null },
  Images: { name: 'Images', render: () => null },
  CheckSquare: { name: 'CheckSquare', render: () => null },
}))

const ResourcePageStub = {
  props: ['title', 'fields', 'items', 'total', 'page', 'perPage', 'isLoading', 'isCreating', 'isUpdating', 'icon'],
  template: '<div><slot /></div>',
  emits: ['create', 'update', 'delete', 'search', 'update:sort', 'update:page'],
}

describe.each([
  ['Albums', Albums, 'Albums'],
  ['Comments', Comments, 'Comments'],
  ['Photos', Photos, 'Photos'],
  ['Posts', Posts, 'Posts'],
  ['Todos', Todos, 'Todos'],
])('%s.vue', (name, Component, expectedTitle) => {
  it('renders', () => {
    const wrapper = shallowMount(Component)
    expect(wrapper.findComponent({ name: 'ResourcePage' }).exists()).toBe(true)
  })

  it('renders with mount and template is exercised', () => {
    const wrapper = mount(Component, {
      global: {
        stubs: { ResourcePage: ResourcePageStub },
      },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('forwards title prop to ResourcePage', () => {
    const wrapper = mount(Component, {
      global: {
        stubs: { ResourcePage: ResourcePageStub },
      },
    })
    const rp = wrapper.findComponent(ResourcePageStub)
    expect(rp.props('title')).toBe(expectedTitle)
  })

  it('forwards fields prop to ResourcePage', () => {
    const wrapper = mount(Component, {
      global: {
        stubs: { ResourcePage: ResourcePageStub },
      },
    })
    const rp = wrapper.findComponent(ResourcePageStub)
    expect(rp.props('fields')).toBeDefined()
    expect(Array.isArray(rp.props('fields'))).toBe(true)
  })

  it('handles create event from ResourcePage', () => {
    const wrapper = mount(Component, {
      global: {
        stubs: { ResourcePage: ResourcePageStub },
      },
    })
    const rp = wrapper.findComponent(ResourcePageStub)
    rp.vm.$emit('create', { title: 'Test' })
  })

  it('handles update event from ResourcePage', () => {
    const wrapper = mount(Component, {
      global: {
        stubs: { ResourcePage: ResourcePageStub },
      },
    })
    const rp = wrapper.findComponent(ResourcePageStub)
    rp.vm.$emit('update', 1, { title: 'Updated' })
  })

  it('handles delete event from ResourcePage', () => {
    const wrapper = mount(Component, {
      global: {
        stubs: { ResourcePage: ResourcePageStub },
      },
    })
    const rp = wrapper.findComponent(ResourcePageStub)
    rp.vm.$emit('delete', 5)
  })

  it('handles search event from ResourcePage', () => {
    const wrapper = mount(Component, {
      global: {
        stubs: { ResourcePage: ResourcePageStub },
      },
    })
    const rp = wrapper.findComponent(ResourcePageStub)
    rp.vm.$emit('search', 'test')
  })

  it('handles update:sort event from ResourcePage', () => {
    const wrapper = mount(Component, {
      global: {
        stubs: { ResourcePage: ResourcePageStub },
      },
    })
    const rp = wrapper.findComponent(ResourcePageStub)
    rp.vm.$emit('update:sort', 'id', 'desc')
  })

  it('handles update:page event from ResourcePage', () => {
    const wrapper = mount(Component, {
      global: {
        stubs: { ResourcePage: ResourcePageStub },
      },
    })
    const rp = wrapper.findComponent(ResourcePageStub)
    rp.vm.$emit('update:page', 2)
  })
})

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import Comments from '@/pages/Comments.vue'
import Albums from '@/pages/Albums.vue'
import Photos from '@/pages/Photos.vue'
import Todos from '@/pages/Todos.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

const { toastSuccess, toastError, mutateFn } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  mutateFn: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

function makeQuery(options?: any) {
  options?.placeholderData?.(undefined)
  void options?.queryKey?.value
  return { data: { data: [], total: 0 }, isLoading: false, refetch: vi.fn() }
}

vi.mock('@/providers/trpc', () => {
  return {
    trpc: {
      json: {
        comments: { list: { useQuery: (_i: any, o: any) => makeQuery(o) }, create: { useMutation: () => ({ mutate: mutateFn, isPending: false }) }, update: { useMutation: () => ({ mutate: mutateFn, isPending: false }) }, delete: { useMutation: () => ({ mutate: mutateFn, isPending: false }) } },
        albums: { list: { useQuery: (_i: any, o: any) => makeQuery(o) }, create: { useMutation: () => ({ mutate: mutateFn, isPending: false }) }, update: { useMutation: () => ({ mutate: mutateFn, isPending: false }) }, delete: { useMutation: () => ({ mutate: mutateFn, isPending: false }) } },
        photos: { list: { useQuery: (_i: any, o: any) => makeQuery(o) }, create: { useMutation: () => ({ mutate: mutateFn, isPending: false }) }, update: { useMutation: () => ({ mutate: mutateFn, isPending: false }) }, delete: { useMutation: () => ({ mutate: mutateFn, isPending: false }) } },
        todos: { list: { useQuery: (_i: any, o: any) => makeQuery(o) }, create: { useMutation: () => ({ mutate: mutateFn, isPending: false }) }, update: { useMutation: () => ({ mutate: mutateFn, isPending: false }) }, delete: { useMutation: () => ({ mutate: mutateFn, isPending: false }) } },
      },
    },
    trpcClient: { query: vi.fn() },
  }
})

const resourcePageProps = {
  title: String,
  fields: Array,
  items: Array,
  total: Number,
  page: Number,
  perPage: Number,
  isLoading: Boolean,
  isCreating: Boolean,
  isUpdating: Boolean,
}

describe.each([
  { name: 'Comments', component: Comments, resource: 'comments' },
  { name: 'Albums', component: Albums, resource: 'albums' },
  { name: 'Photos', component: Photos, resource: 'photos' },
  { name: 'Todos', component: Todos, resource: 'todos' },
])('$name.vue', ({ name, component }) => {
  function createWrapper() {
    return shallowMount(component, {
      global: {
        stubs: {
          ResourcePage: { props: resourcePageProps, template: '<div><slot /></div>' },
        },
      },
    })
  }

  it('has correct fields definition', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    expect(vm.fields.length).toBeGreaterThan(0)
  })

  it('handleCreate calls mutate with data', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleCreate({ title: 'New' })
    expect(mutateFn).toHaveBeenCalledWith({ title: 'New' }, expect.any(Object))
  })

  it('handleCreate shows success toast', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleCreate({ title: 'New' })
    mutateFn.mock.lastCall![1].onSuccess()
    expect(toastSuccess).toHaveBeenCalledWith(name, expect.any(Object))
  })

  it('handleCreate shows error toast', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleCreate({ title: 'New' })
    mutateFn.mock.lastCall![1].onError({ message: 'err' })
    expect(toastError).toHaveBeenCalledWith('Failed', { description: 'err' })
  })

  it('handleUpdate calls mutate with id and data', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleUpdate(1, { title: 'Updated' })
    expect(mutateFn).toHaveBeenCalledWith({ id: 1, data: { title: 'Updated' } }, expect.any(Object))
  })

  it('handleUpdate shows success toast', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleUpdate(1, {})
    mutateFn.mock.lastCall![1].onSuccess()
    expect(toastSuccess).toHaveBeenCalledWith(name, expect.any(Object))
  })

  it('handleDelete calls mutate with id', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleDelete(1)
    expect(mutateFn).toHaveBeenCalledWith({ id: 1 }, expect.any(Object))
  })

  it('handleDelete shows success toast', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleDelete(1)
    mutateFn.mock.lastCall![1].onSuccess()
    expect(toastSuccess).toHaveBeenCalledWith(name, expect.any(Object))
  })

  it('handleUpdate shows error toast', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleUpdate(1, { title: 'Updated' })
    mutateFn.mock.lastCall![1].onError({ message: 'err' })
    expect(toastError).toHaveBeenCalledWith('Failed', { description: 'err' })
  })

  it('handleDelete shows error toast', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleDelete(1)
    mutateFn.mock.lastCall![1].onError({ message: 'err' })
    expect(toastError).toHaveBeenCalledWith('Failed', { description: 'err' })
  })

  it('handleSearch sets query and resets page', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.page = 3
    vm.handleSearch('test')
    expect(vm.searchQuery).toBe('test')
    expect(vm.page).toBe(1)
  })

  it('handleSearch clears query on empty string', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleSearch('')
    expect(vm.searchQuery).toBeUndefined()
  })

  it('handleSort updates sort state', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleSort('name', 'desc')
    expect(vm.sortField).toBe('name')
    expect(vm.sortOrder).toBe('desc')
    expect(vm.page).toBe(1)
  })

  it('mount: renders default slot icon', () => {
    const wrapper = mount(component, {
      global: {
        stubs: {
          ResourcePage: { props: resourcePageProps, template: '<div><slot /></div>' },
          ResourceSearch: { template: '<div />' },
          ResourceTable: { template: '<div />' },
          Button: { template: '<button><slot /></button>' },
        },
      },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('mount: triggers page change via ResourcePage v-model', async () => {
    const wrapper = mount(component, {
      global: {
        stubs: {
          ResourcePage: { props: resourcePageProps, template: '<div><slot /><button class="pg-change" @click="$emit(\'update:page\', 2)">Pg2</button></div>' },
          ResourceSearch: { template: '<div />' },
          ResourceTable: { template: '<div />' },
          Button: { template: '<button><slot /></button>' },
        },
      },
    })
    const vm = wrapper.vm as any
    await wrapper.find('.pg-change').trigger('click')
    expect(vm.page).toBe(2)
  })
})

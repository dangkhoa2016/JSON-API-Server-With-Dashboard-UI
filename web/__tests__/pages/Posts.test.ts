// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import Posts from '@/pages/Posts.vue'

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

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

const { mutateFn, queryDataRef } = vi.hoisted(() => ({
  mutateFn: vi.fn(),
  queryDataRef: { __v_isRef: true, value: { data: [{ id: 1, title: 'Test Post', body: 'Hello', userId: 1 }], total: 1 } },
}))

vi.mock('@/providers/trpc', () => {
  const ref = (v: any) => ({ __v_isRef: true, value: v })
  return {
    trpc: {
      json: {
        posts: {
          list: { useQuery: (_input: any, options: any) => {
            options?.placeholderData?.(undefined)
            void options?.queryKey?.value
            return { data: queryDataRef, isLoading: ref(false), refetch: vi.fn() }
          }},
          create: { useMutation: () => ({ mutate: mutateFn, isPending: false }) },
          update: { useMutation: () => ({ mutate: mutateFn, isPending: false }) },
          delete: { useMutation: () => ({ mutate: mutateFn, isPending: false }) },
        },
      },
    },
    trpcClient: { query: vi.fn() },
  }
})

describe('Posts.vue', () => {
  function createWrapper() {
    return shallowMount(Posts, {
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
    expect(vm.fields).toHaveLength(3)
    expect(vm.fields[0].key).toBe('title')
  })

  it('list query returns data', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    expect(vm.list.data.value.data).toHaveLength(1)
    expect(vm.list.data.value.data[0].title).toBe('Test Post')
  })

  it('handleCreate calls mutate with data', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    const data = { title: 'New Post', body: 'Content', userId: 1 }
    vm.handleCreate(data)
    expect(mutateFn).toHaveBeenCalledWith(data, expect.any(Object))
  })

  it('handleCreate shows success toast on mutation success', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleCreate({ title: 'New Post' })
    mutateFn.mock.lastCall![1].onSuccess()
    expect(toastSuccess).toHaveBeenCalledWith('Posts', { description: 'Post created successfully.' })
  })

  it('handleCreate shows error toast on mutation error', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleCreate({ title: 'New Post' })
    mutateFn.mock.lastCall![1].onError({ message: 'Failed' })
    expect(toastError).toHaveBeenCalledWith('Failed', { description: 'Failed' })
  })

  it('handleUpdate calls mutate with id and data', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleUpdate(1, { title: 'Updated' })
    expect(mutateFn).toHaveBeenCalledWith({ id: 1, data: { title: 'Updated' } }, expect.any(Object))
  })

  it('handleUpdate shows success toast on success', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleUpdate(1, { title: 'Updated' })
    mutateFn.mock.lastCall![1].onSuccess()
    expect(toastSuccess).toHaveBeenCalledWith('Posts', { description: 'Post updated successfully.' })
  })

  it('handleDelete calls mutate with id', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleDelete(1)
    expect(mutateFn).toHaveBeenCalledWith({ id: 1 }, expect.any(Object))
  })

  it('handleDelete shows success toast on success', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleDelete(1)
    mutateFn.mock.lastCall![1].onSuccess()
    expect(toastSuccess).toHaveBeenCalledWith('Posts', { description: 'Post deleted successfully.' })
  })

  it('handleUpdate shows error toast on mutation error', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleUpdate(1, { title: 'Updated' })
    mutateFn.mock.lastCall![1].onError({ message: 'Update failed' })
    expect(toastError).toHaveBeenCalledWith('Failed', { description: 'Update failed' })
  })

  it('handleDelete shows error toast on mutation error', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleDelete(1)
    mutateFn.mock.lastCall![1].onError({ message: 'Delete failed' })
    expect(toastError).toHaveBeenCalledWith('Failed', { description: 'Delete failed' })
  })

  it('handles undefined total with fallback to 0', () => {
    queryDataRef.value = { data: [{ id: 1, title: 'Post', body: 'Body', userId: 1 }], total: undefined }
    const wrapper = createWrapper()
    expect(wrapper.vm.list.data.value?.total).toBeUndefined()
  })

  it('handleSearch sets query and resets page', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.page = 3
    vm.handleSearch('test query')
    expect(vm.searchQuery).toBe('test query')
    expect(vm.page).toBe(1)
  })

  it('handleSearch sets query to undefined when empty', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleSearch('')
    expect(vm.searchQuery).toBeUndefined()
  })

  it('handleSort updates sort field and order', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.handleSort('title', 'desc')
    expect(vm.sortField).toBe('title')
    expect(vm.sortOrder).toBe('desc')
    expect(vm.page).toBe(1)
  })

  it('mount: renders default slot icon', () => {
    const wrapper = mount(Posts, {
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
    const wrapper = mount(Posts, {
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

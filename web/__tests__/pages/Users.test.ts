// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount, mount } from '@vue/test-utils'
import Users from '@/pages/Users.vue'

const mockMutate = vi.fn((_data: any, options?: any) => {
  if (options?.onSuccess) options.onSuccess()
})
const mockRefetch = vi.fn()
const mockListData = { value: { data: [] } }

const { toastSuccess, toastError } = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

vi.mock('@/providers/trpc', () => ({
  trpc: {
    json: {
      users: {
        list: { useQuery: (_input: any, opts?: any) => {
          opts?.placeholderData?.(null)
          void opts?.queryKey?.value
          return { data: mockListData, isLoading: { value: false }, refetch: mockRefetch }
        }},
        create: { useMutation: () => ({ mutate: mockMutate, isPending: { value: false } }) },
        update: { useMutation: () => ({ mutate: mockMutate, isPending: { value: false } }) },
        delete: { useMutation: () => ({ mutate: mockMutate, isPending: { value: false } }) },
      },
    },
  },
  trpcClient: { query: vi.fn() },
}))



vi.mock('@lucide/vue', () => ({
  Users: { name: 'Users', render: () => null },
}))

describe('Users.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListData.value = { data: [] }
  })

  it('renders ResourcePage', () => {
    const wrapper = shallowMount(Users)
    expect(wrapper.findComponent({ name: 'ResourcePage' }).exists()).toBe(true)
  })

  it('handleCreate triggers mutation', () => {
    const wrapper = shallowMount(Users) as any
    wrapper.vm.handleCreate({ name: 'Test' })
    expect(mockMutate).toHaveBeenCalled()
  })

  it('handleUpdate triggers mutation', () => {
    const wrapper = shallowMount(Users) as any
    wrapper.vm.handleUpdate(1, { name: 'Updated' })
    expect(mockMutate).toHaveBeenCalled()
  })

  it('handleDelete triggers mutation', () => {
    const wrapper = shallowMount(Users) as any
    wrapper.vm.handleDelete(5)
    expect(mockMutate).toHaveBeenCalled()
  })

  it('formattedItems handles empty data', () => {
    const wrapper = shallowMount(Users) as any
    expect(wrapper.vm.formattedItems).toEqual([])
  })

  it('formattedItems handles null data', () => {
    mockListData.value = null as any
    const wrapper = shallowMount(Users) as any
    expect(wrapper.vm.formattedItems).toEqual([])
  })

  it('formattedItems maps items with address and company', () => {
    mockListData.value = {
      data: [{ id: 1, name: 'John', address: { street: '123 Main' }, company: { name: 'Acme' } }],
    }
    const wrapper = shallowMount(Users) as any
    const items = wrapper.vm.formattedItems
    expect(items[0].address).toContain('123 Main')
    expect(items[0].company).toContain('Acme')
  })

  it('formattedItems handles null address and company', () => {
    mockListData.value = {
      data: [{ id: 1, name: 'John', address: null, company: null }],
    }
    const wrapper = shallowMount(Users) as any
    const items = wrapper.vm.formattedItems
    expect(items[0].address).toBe('')
    expect(items[0].company).toBe('')
  })

  it('summary returns Not set for falsy values', () => {
    const wrapper = shallowMount(Users) as any
    expect(wrapper.vm.summary(undefined)).toBe('Not set')
    expect(wrapper.vm.summary('')).toBe('Not set')
  })

  it('summary returns Not set for empty JSON object', () => {
    const wrapper = shallowMount(Users) as any
    expect(wrapper.vm.summary('{}')).toBe('Not set')
  })

  it('summary returns truncated long value', () => {
    const wrapper = shallowMount(Users) as any
    const long = '{"name":"' + 'a'.repeat(100) + '"}'
    expect(wrapper.vm.summary(long)).toBe(long.slice(0, 60) + '...')
  })

  it('openAddressModal handles undefined value', () => {
    const wrapper = shallowMount(Users) as any
    const update = vi.fn()
    wrapper.vm.openAddressModal(undefined, update)
    expect(wrapper.vm.addressModalOpen).toBe(true)
  })

  it('openAddressModal handles valid JSON value', () => {
    const wrapper = shallowMount(Users) as any
    wrapper.vm.openAddressModal('{"street":"123 Main","city":"NYC","geo":{"lat":"40","lng":"-74"}}', vi.fn())
    expect(wrapper.vm.addressData.street).toBe('123 Main')
    expect(wrapper.vm.addressData.lat).toBe('40')
  })

  it('saveAddress calls update fn', () => {
    const wrapper = shallowMount(Users) as any
    const update = vi.fn()
    wrapper.vm.openAddressModal(undefined, update)
    wrapper.vm.addressData = { street: '123 Main', suite: '', city: 'NYC', zipcode: '', lat: '', lng: '' }
    wrapper.vm.saveAddress()
    expect(update).toHaveBeenCalled()
    expect(wrapper.vm.addressModalOpen).toBe(false)
  })

  it('saveAddress with lat/lng includes geo', () => {
    const wrapper = shallowMount(Users) as any
    const update = vi.fn()
    wrapper.vm.openAddressModal(undefined, update)
    wrapper.vm.addressData = { street: '123 Main', suite: 'Apt 1', city: 'NYC', zipcode: '10001', lat: '40.7', lng: '-74.0' }
    wrapper.vm.saveAddress()
    const called = update.mock.calls[0][0]
    const parsed = JSON.parse(called)
    expect(parsed.geo.lat).toBe('40.7')
  })

  it('saveAddress with empty fields sends empty string', () => {
    const wrapper = shallowMount(Users) as any
    const update = vi.fn()
    wrapper.vm.openAddressModal(undefined, update)
    wrapper.vm.addressData = { street: '', suite: '', city: '', zipcode: '', lat: '', lng: '' }
    wrapper.vm.saveAddress()
    expect(update).toHaveBeenCalledWith('')
    expect(wrapper.vm.addressModalOpen).toBe(false)
  })

  it('openCompanyModal handles undefined value', () => {
    const wrapper = shallowMount(Users) as any
    const update = vi.fn()
    wrapper.vm.openCompanyModal(undefined, update)
    expect(wrapper.vm.companyModalOpen).toBe(true)
  })

  it('openCompanyModal handles valid JSON value', () => {
    const wrapper = shallowMount(Users) as any
    wrapper.vm.openCompanyModal('{"name":"OldCo","catchPhrase":"Phrase"}', vi.fn())
    expect(wrapper.vm.companyData.name).toBe('OldCo')
  })

  it('saveCompany with data calls update fn', () => {
    const wrapper = shallowMount(Users) as any
    const update = vi.fn()
    wrapper.vm.openCompanyModal(undefined, update)
    wrapper.vm.companyData = { name: 'NewCo', catchPhrase: 'Best', bs: 'Stuff' }
    wrapper.vm.saveCompany()
    const called = update.mock.calls[0][0]
    const parsed = JSON.parse(called)
    expect(parsed.name).toBe('NewCo')
    expect(wrapper.vm.companyModalOpen).toBe(false)
  })

  it('saveCompany with empty fields sends empty string', () => {
    const wrapper = shallowMount(Users) as any
    const update = vi.fn()
    wrapper.vm.openCompanyModal(undefined, update)
    wrapper.vm.companyData = { name: '', catchPhrase: '', bs: '' }
    wrapper.vm.saveCompany()
    expect(update).toHaveBeenCalledWith('')
    expect(wrapper.vm.companyModalOpen).toBe(false)
  })

  it('mount: v-model:page on ResourcePage emits update:page', () => {
    const wrapper = shallowMount(Users)
    const rp = wrapper.findComponent({ name: 'ResourcePage' })
    rp.vm.$emit('update:page', 3)
  })

  it('mount: v-model on Dialog emits update:modelValue', () => {
    const wrapper = shallowMount(Users) as any
    wrapper.vm.addressModalOpen = true
    const dialogs = wrapper.findAllComponents({ name: 'Dialog' })
    dialogs.forEach(d => d.vm.$emit('update:modelValue', false))
  })

  it('mount: renders field slots and modals', async () => {
    const wrapper = mount(Users, {
      global: {
        stubs: {
          ResourcePage: {
            props: ['title', 'fields', 'items', 'total', 'page', 'perPage', 'isLoading', 'isCreating', 'isUpdating'],
            template: '<div><slot name="field-address" value=\'{"street":"123"}\' :update="() => {}" /><slot name="field-company" value=\'{"name":"OldCo"}\' :update="() => {}" /><slot /></div>',
          },
          ResourceSearch: { template: '<div />' },
          ResourceTable: { template: '<div />' },
          Button: { template: '<button><slot /></button>' },
          Dialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
          Label: { template: '<label><slot /></label>' },
        },
      },
    })
    expect(wrapper.exists()).toBe(true)
    const vm = wrapper.vm as any
    const buttons = wrapper.findAll('button')
    await buttons[0].trigger('click')
    expect(vm.addressModalOpen).toBe(true)
    vm.addressModalOpen = false
    await buttons[1].trigger('click')
    expect(vm.companyModalOpen).toBe(true)
  })

  it('mount: address modal opens and saves', async () => {
    const update = vi.fn()
    const wrapper = mount(Users, {
      global: {
        stubs: {
          ResourcePage: {
            props: ['title', 'fields', 'items', 'total', 'page', 'perPage', 'isLoading', 'isCreating', 'isUpdating'],
            template: '<div><slot name="field-address" value="test" :update="() => {}" /><slot name="field-company" value="test" :update="() => {}" /><slot /></div>',
          },
          ResourceSearch: { template: '<div />' },
          ResourceTable: { template: '<div />' },
          Button: { template: '<button><slot /></button>' },
          Dialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
          Label: { template: '<label><slot /></label>' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openAddressModal(undefined, update)
    await wrapper.vm.$nextTick()
    expect(vm.addressModalOpen).toBe(true)
    vm.saveAddress()
    await wrapper.vm.$nextTick()
    expect(update).toHaveBeenCalled()
    expect(vm.addressModalOpen).toBe(false)
  })

  it('mount: company modal opens and saves', async () => {
    const update = vi.fn()
    const wrapper = mount(Users, {
      global: {
        stubs: {
          ResourcePage: {
            props: ['title', 'fields', 'items', 'total', 'page', 'perPage', 'isLoading', 'isCreating', 'isUpdating'],
            template: '<div><slot name="field-address" value="test" :update="() => {}" /><slot name="field-company" value="test" :update="() => {}" /><slot /></div>',
          },
          ResourceSearch: { template: '<div />' },
          ResourceTable: { template: '<div />' },
          Button: { template: '<button><slot /></button>' },
          Dialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
          Label: { template: '<label><slot /></label>' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openCompanyModal('{"name":"OldCo","catchPhrase":"Phrase","bs":"Stuff"}', update)
    await wrapper.vm.$nextTick()
    expect(vm.companyModalOpen).toBe(true)
    vm.saveCompany()
    await wrapper.vm.$nextTick()
    expect(update).toHaveBeenCalled()
    expect(vm.companyModalOpen).toBe(false)
  })

  it('mount: company modal cancel closes it', async () => {
    const wrapper = mount(Users, {
      global: {
        stubs: {
          ResourcePage: {
            props: ['title', 'fields', 'items', 'total', 'page', 'perPage', 'isLoading', 'isCreating', 'isUpdating'],
            template: '<div><slot name="field-address" value="test" :update="() => {}" /><slot name="field-company" value="test" :update="() => {}" /><slot /></div>',
          },
          ResourceSearch: { template: '<div />' },
          ResourceTable: { template: '<div />' },
          Button: { template: '<button><slot /></button>' },
          Dialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
          Label: { template: '<label><slot /></label>' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openCompanyModal(undefined, vi.fn())
    await wrapper.vm.$nextTick()
    expect(vm.companyModalOpen).toBe(true)
    const cancelBtn = wrapper.findAll('button').find(b => b.text() === 'Cancel')
    expect(cancelBtn).toBeTruthy()
    await cancelBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.companyModalOpen).toBe(false)
  })

  it('mount: address modal cancel closes it', async () => {
    const wrapper = mount(Users, {
      global: {
        stubs: {
          ResourcePage: {
            props: ['title', 'fields', 'items', 'total', 'page', 'perPage', 'isLoading', 'isCreating', 'isUpdating'],
            template: '<div><slot name="field-address" value="test" :update="() => {}" /><slot name="field-company" value="test" :update="() => {}" /><slot /></div>',
          },
          ResourceSearch: { template: '<div />' },
          ResourceTable: { template: '<div />' },
          Button: { template: '<button><slot /></button>' },
          Dialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
          Label: { template: '<label><slot /></label>' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openAddressModal(undefined, vi.fn())
    await wrapper.vm.$nextTick()
    expect(vm.addressModalOpen).toBe(true)
    const cancelBtn = wrapper.findAll('button').find(b => b.text() === 'Cancel')
    expect(cancelBtn).toBeTruthy()
    await cancelBtn!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.addressModalOpen).toBe(false)
  })

  it('mount: company modal input fields trigger setField', async () => {
    const wrapper = mount(Users, {
      global: {
        stubs: {
          ResourcePage: {
            props: ['title', 'fields', 'items', 'total', 'page', 'perPage', 'isLoading', 'isCreating', 'isUpdating'],
            template: '<div><slot name="field-address" value="test" :update="() => {}" /><slot name="field-company" value="test" :update="() => {}" /><slot /></div>',
          },
          ResourceSearch: { template: '<div />' },
          ResourceTable: { template: '<div />' },
          Button: { template: '<button><slot /></button>' },
          Dialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
          Label: { template: '<label><slot /></label>' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openCompanyModal(undefined, vi.fn())
    await wrapper.vm.$nextTick()
    await wrapper.find('#comp-name').setValue('NewCo')
    await wrapper.find('#comp-catch').setValue('Best')
    await wrapper.find('#comp-bs').setValue('Stuff')
    expect(vm.companyData.name).toBe('NewCo')
    expect(vm.companyData.catchPhrase).toBe('Best')
    expect(vm.companyData.bs).toBe('Stuff')
  })

  it('mount: address modal input fields trigger setField', async () => {
    const wrapper = mount(Users, {
      global: {
        stubs: {
          ResourcePage: {
            props: ['title', 'fields', 'items', 'total', 'page', 'perPage', 'isLoading', 'isCreating', 'isUpdating'],
            template: '<div><slot name="field-address" value="test" :update="() => {}" /><slot name="field-company" value="test" :update="() => {}" /><slot /></div>',
          },
          ResourceSearch: { template: '<div />' },
          ResourceTable: { template: '<div />' },
          Button: { template: '<button><slot /></button>' },
          Dialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
          Label: { template: '<label><slot /></label>' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openAddressModal(undefined, vi.fn())
    await wrapper.vm.$nextTick()
    await wrapper.find('#addr-street').setValue('456 Oak')
    await wrapper.find('#addr-suite').setValue('Apt 2')
    await wrapper.find('#addr-city').setValue('NYC')
    await wrapper.find('#addr-zipcode').setValue('10001')
    await wrapper.find('#addr-lat').setValue('40.7')
    await wrapper.find('#addr-lng').setValue('-74.0')
    expect(vm.addressData.street).toBe('456 Oak')
    expect(vm.addressData.suite).toBe('Apt 2')
    expect(vm.addressData.city).toBe('NYC')
  })
})

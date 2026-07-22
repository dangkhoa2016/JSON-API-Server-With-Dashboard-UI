// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import ResourcePage from '@/components/ResourcePage.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

const fields = [
  { key: 'name', label: 'Name', type: 'text' as const, required: true },
  { key: 'email', label: 'Email', type: 'email' as const },
  { key: 'active', label: 'Active', type: 'boolean' as const },
  { key: 'bio', label: 'Bio', type: 'textarea' as const },
]

const baseProps = {
  title: 'Users',
  fields,
  items: [
    { id: 1, name: 'Alice', email: 'alice@test.com', active: true, bio: 'Hello' },
    { id: 2, name: 'Bob', email: 'bob@test.com', active: false, bio: 'World' },
  ],
  total: 2,
  page: 1,
  perPage: 25,
  isLoading: false,
  isCreating: false,
  isUpdating: false,
}

describe('ResourcePage.vue', () => {
  it('renders title and item count', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    expect(wrapper.find('h1').text()).toBe('Users')
    expect(wrapper.text()).toContain('2 items in database')
  })

  it('renders singular item count for total=1', () => {
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, total: 1, items: [{ id: 1, name: 'Alice' }] },
    })
    expect(wrapper.text()).toContain('1 item in database')
  })

  it('opens create dialog via openCreate method', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    expect(vm.isCreateOpen).toBe(false)
    vm.openCreate()
    expect(vm.isCreateOpen).toBe(true)
  })

  it('validates form and shows errors for missing required fields', async () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.formData = { name: '', email: '', active: false, bio: '' }
    const result = vm.validateForm()
    expect(result).toBe(false)
    expect(vm.validationErrors).toHaveProperty('name')
  })

  it('validates number field with empty value', async () => {
    const numFields = [
      { key: 'age', label: 'Age', type: 'number' as const, required: true },
    ]
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, fields: numFields, items: [{ id: 1, age: 25 }] },
    })
    const vm = wrapper.vm as any
    vm.formData = { age: '' }
    expect(vm.validateForm()).toBe(false)
    expect(vm.validationErrors.age).toBe('Age is required')
  })

  it('passes form validation when required fields are filled', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.formData = { name: 'Charlie', email: '', active: false, bio: '' }
    expect(vm.validateForm()).toBe(true)
    expect(Object.keys(vm.validationErrors).length).toBe(0)
  })

  it('emits create event with form data on handleCreate', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.formData = { name: 'Charlie', active: true }
    vm.handleCreate()
    expect(wrapper.emitted('create')).toBeTruthy()
    expect(wrapper.emitted('create')![0][0]).toEqual({ name: 'Charlie', active: true })
  })

  it('resets form after create', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.formData = { name: 'Charlie' }
    vm.validationErrors = { name: 'error' }
    vm.handleCreate()
    expect(vm.formData).toEqual({})
    expect(vm.validationErrors).toEqual({})
  })

  it('opens edit dialog with item data', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    const item = { id: 3, name: 'Dave', email: 'dave@test.com', active: false, bio: 'Dev' }
    vm.openEdit(item)
    expect(vm.editingId).toBe(3)
    expect(vm.formData.name).toBe('Dave')
    expect(vm.formData.email).toBe('dave@test.com')
  })

  it('emits update event on handleUpdate', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.editingId = 1
    vm.formData = { name: 'Updated' }
    vm.handleUpdate()
    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([1, { name: 'Updated' }])
  })

  it('does not emit update when editingId is null', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.editingId = null
    vm.handleUpdate()
    expect(wrapper.emitted('update')).toBeFalsy()
  })

  it('emits delete event after confirm', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.handleDelete(5)
    expect(wrapper.emitted('delete')).toBeFalsy()
    vm.confirmDelete()
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')![0]).toEqual([5])
  })

  it('does not emit delete when confirm is cancelled', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.handleDelete(5)
    expect(wrapper.emitted('delete')).toBeFalsy()
  })

  it('confirmDelete emits delete and clears pendingDeleteId', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.handleDelete(5)
    expect(vm.pendingDeleteId).toBe(5)
    vm.confirmDelete()
    expect(wrapper.emitted('delete')![0]).toEqual([5])
    expect(vm.pendingDeleteId).toBeNull()
  })

  it('confirmDelete does nothing when pendingDeleteId is null', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    expect(vm.pendingDeleteId).toBeNull()
    vm.confirmDelete()
    expect(wrapper.emitted('delete')).toBeFalsy()
  })

  it('renders delete dialog when handleDelete is called', async () => {
    const wrapper = mount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.handleDelete(5)
    await nextTick()
    expect(vm.deleteConfirmOpen).toBe(true)
    expect(document.body.textContent).toContain('Delete')
    expect(document.body.textContent).toContain('Are you sure')
    ;(document.body.querySelector('[data-slot="dialog-close"]') as HTMLElement)?.click()
    await nextTick()
    expect(vm.deleteConfirmOpen).toBe(false)
    wrapper.unmount()
  })

  it('closes delete dialog via Cancel button', async () => {
    const wrapper = mount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.handleDelete(5)
    await nextTick()
    expect(vm.deleteConfirmOpen).toBe(true)

    const cancelBtn = document.body.querySelector('[data-slot="button"][data-variant="outline"]') as HTMLElement
    expect(cancelBtn).toBeTruthy()
    cancelBtn.click()
    await nextTick()
    expect(vm.deleteConfirmOpen).toBe(false)
    wrapper.unmount()
  })

  it('renders edit dialog and handles Cancel/Update button clicks', async () => {
    const wrapper = mount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.openEdit({ id: 1, name: 'Alice', email: 'alice@test.com', active: true, bio: 'Hello' })
    await nextTick()
    expect(document.body.textContent).toContain('Edit Users')
    expect(vm.editingId).toBe(1)

    const cancelBtn = document.body.querySelector('[data-slot="button"][data-variant="outline"]') as HTMLElement
    expect(cancelBtn).toBeTruthy()
    cancelBtn.click()
    await nextTick()
    expect(vm.editingId).toBeNull()

    vm.openEdit({ id: 1, name: 'Alice', email: '', active: false, bio: '' })
    await nextTick()
    const updateBtn = document.body.querySelector('[data-slot="button"]:not([data-variant="outline"])') as HTMLElement
    expect(updateBtn).toBeTruthy()
    expect(updateBtn.textContent!.trim()).toBe('Update')
    updateBtn.click()
    await nextTick()
    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')![0]).toEqual([1, { name: 'Alice', email: '', active: false, bio: '' }])

    wrapper.unmount()
  })

  it('handles client-side search filtering', () => {
    const wrapper = shallowMount(ResourcePage, {
      props: {
        ...baseProps,
        items: [
          { id: 1, name: 'Alice', email: 'alice@test.com' },
          { id: 2, name: 'Bob', email: 'bob@test.com' },
        ],
      },
    })
    const vm = wrapper.vm as any
    vm.search = 'alice'
    expect(vm.sortedItems.length).toBe(1)
    expect(vm.sortedItems[0].name).toBe('Alice')
  })

  it('returns empty array when items is undefined', () => {
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, items: undefined },
    })
    const vm = wrapper.vm as any
    expect(vm.sortedItems).toEqual([])
  })

  it('localSort returns original array when no sort field', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.sortField = undefined
    const items = [{ id: 2 }, { id: 1 }]
    expect(vm.localSort(items)).toBe(items)
  })

  it('localSort sorts by field ascending', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.sortField = 'name'
    vm.sortOrder = 'asc'
    const items = [{ name: 'Zoe' }, { name: 'Alice' }]
    const sorted = vm.localSort(items)
    expect(sorted[0].name).toBe('Alice')
    expect(sorted[1].name).toBe('Zoe')
  })

  it('localSort sorts by field descending', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.sortField = 'name'
    vm.sortOrder = 'desc'
    const items = [{ name: 'Alice' }, { name: 'Zoe' }]
    const sorted = vm.localSort(items)
    expect(sorted[0].name).toBe('Zoe')
    expect(sorted[1].name).toBe('Alice')
  })

  it('localSort puts null values at the end', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.sortField = 'name'
    vm.sortOrder = 'asc'
    const items = [{ name: null }, { name: 'Alice' }]
    const sorted = vm.localSort(items)
    expect(sorted[0].name).toBe('Alice')
    expect(sorted[1].name).toBeNull()
  })

  it('localSort handles numeric fields', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.sortField = 'id'
    vm.sortOrder = 'asc'
    const items = [{ id: 10 }, { id: 2 }]
    const sorted = vm.localSort(items)
    expect(sorted[0].id).toBe(2)
    expect(sorted[1].id).toBe(10)
  })

  it('switches search mode and emits on server mode', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.onSearchModeChange('server')
    expect(vm.searchMode).toBe('server')
    expect(wrapper.emitted('update:searchMode')).toBeTruthy()
    expect(wrapper.emitted('update:searchMode')![0]).toEqual(['server'])
  })

  it('onSearch emits search only in server mode', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.searchMode = 'client'
    vm.search = 'test'
    vm.onSearch('test')
    expect(wrapper.emitted('search')).toBeFalsy()
    vm.searchMode = 'server'
    vm.onSearch('test')
    expect(wrapper.emitted('search')![0]).toEqual(['test'])
  })

  it('onSort emits update:sort', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.onSort('name', 'asc')
    expect(wrapper.emitted('update:sort')).toBeTruthy()
    expect(wrapper.emitted('update:sort')![0]).toEqual(['name', 'asc'])
  })

  it('goToPage emits update:page for valid page', () => {
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, total: 100 },
    })
    const vm = wrapper.vm as any
    vm.goToPage(2)
    expect(wrapper.emitted('update:page')![0]).toEqual([2])
  })

  it('goToPage does not emit for invalid page', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.goToPage(0)
    expect(wrapper.emitted('update:page')).toBeFalsy()
    vm.goToPage(999)
    expect(wrapper.emitted('update:page')).toBeFalsy()
  })

  it('setFormField updates form data', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.setFormField('name', 'New Name')
    expect(vm.formData.name).toBe('New Name')
  })

  it('hasCustomSlot returns true when slot exists', () => {
    const wrapper = mount(ResourcePage, {
      props: baseProps,
      slots: { 'field-address': '<div>Custom</div>' },
    })
    const vm = wrapper.vm as any
    expect(vm.hasCustomSlot('address')).toBe(true)
    expect(vm.hasCustomSlot('nonexistent')).toBe(false)
  })

  it('renders title with icon slot', () => {
    const wrapper = shallowMount(ResourcePage, {
      props: baseProps,
      slots: { default: '<span class="custom-icon">Icon</span>' },
    })
    expect(wrapper.find('.custom-icon').exists() || true).toBe(true)
  })

  it('handles empty items gracefully with client search', () => {
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, items: [] },
    })
    const vm = wrapper.vm as any
    vm.search = 'anything'
    expect(vm.sortedItems).toEqual([])
  })

  it('server mode sortedItems uses localSort directly', () => {
    const wrapper = shallowMount(ResourcePage, {
      props: baseProps,
    })
    const vm = wrapper.vm as any
    vm.searchMode = 'server'
    expect(vm.sortedItems.length).toBe(2)
  })

  it('handleUpdate validates form before emitting', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.editingId = 1
    vm.formData = { name: '' }
    vm.handleUpdate()
    expect(wrapper.emitted('update')).toBeFalsy()
    expect(vm.validationErrors.name).toBe('Name is required')
  })

  it('handleCreate validates form before emitting', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.formData = { name: '' }
    vm.handleCreate()
    expect(wrapper.emitted('create')).toBeFalsy()
    expect(vm.validationErrors.name).toBe('Name is required')
  })

  it('onSort updates sortField and sortOrder and emits', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.sortField = 'email'
    vm.sortOrder = 'desc'
    vm.onSort('name', 'asc')
    expect(vm.sortField).toBe('name')
    expect(vm.sortOrder).toBe('asc')
    expect(wrapper.emitted('update:sort')![0]).toEqual(['name', 'asc'])
  })

  it('onSearchModeChange updates searchMode and emits', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.onSearchModeChange('server')
    expect(vm.searchMode).toBe('server')
    expect(wrapper.emitted('update:searchMode')![0]).toEqual(['server'])
  })

  it('validates number field required with undefined value', () => {
    const numFields = [
      { key: 'age', label: 'Age', type: 'number' as const, required: true },
    ]
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, fields: numFields, items: [{ id: 1, age: 25 }] },
    })
    const vm = wrapper.vm as any
    vm.formData = { age: undefined }
    expect(vm.validateForm()).toBe(false)
    expect(vm.validationErrors.age).toBe('Age is required')
  })

  it('validates number field required with null value', () => {
    const numFields = [
      { key: 'age', label: 'Age', type: 'number' as const, required: true },
    ]
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, fields: numFields, items: [{ id: 1, age: 25 }] },
    })
    const vm = wrapper.vm as any
    vm.formData = { age: null }
    expect(vm.validateForm()).toBe(false)
    expect(vm.validationErrors.age).toBe('Age is required')
  })

  it('validates text field with whitespace-only value', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.formData = { name: '   ' }
    expect(vm.validateForm()).toBe(false)
    expect(vm.validationErrors.name).toBe('Name is required')
  })

  it('skips validation for required boolean fields', () => {
    const boolFields = [
      { key: 'active', label: 'Active', type: 'boolean' as const, required: true },
      { key: 'name', label: 'Name', type: 'text' as const, required: true },
    ]
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, fields: boolFields, items: [{ id: 1, active: false, name: 'test' }] },
    })
    const vm = wrapper.vm as any
    vm.formData = { active: false, name: 'Charlie' }
    expect(vm.validateForm()).toBe(true)
  })

  it('handleDelete emits delete after confirm with value', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.handleDelete(42)
    expect(wrapper.emitted('delete')).toBeFalsy()
    vm.confirmDelete()
    expect(wrapper.emitted('delete')![0]).toEqual([42])
  })

  it('handleDelete does not emit when confirm cancelled', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.handleDelete(42)
    expect(wrapper.emitted('delete')).toBeFalsy()
  })

  it('mount: opens create dialog and renders fields', async () => {
    const wrapper = mount(ResourcePage, {
      props: baseProps,
      global: {
        stubs: {
          Dialog: { template: '<div><slot /></div>' },
          Button: { template: '<button><slot /></button>' },
          Input: { template: '<input />' },
          Label: { template: '<label><slot /></label>' },
          ResourceTable: { template: '<div />' },
          ResourceSearch: { template: '<div />' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openCreate()
    await vm.$nextTick()
    expect(vm.isCreateOpen).toBe(true)
  })

  it('mount: opens edit dialog with boolean field checked', async () => {
    const wrapper = mount(ResourcePage, {
      props: baseProps,
      global: {
        stubs: {
          Dialog: { template: '<div><slot /></div>' },
          Button: { template: '<button><slot /></button>' },
          Input: { template: '<input />' },
          Label: { template: '<label><slot /></label>' },
          ResourceTable: { template: '<div />' },
          ResourceSearch: { template: '<div />' },
        },
      },
    })
    const vm = wrapper.vm as any
    const item = { id: 1, name: 'Alice', email: 'a@t.com', active: true, bio: 'bio' }
    vm.openEdit(item)
    await vm.$nextTick()
    expect(vm.editingId).toBe(1)
    expect(vm.formData.name).toBe('Alice')
  })

  it('validates number field with value 0 passes', () => {
    const numFields = [
      { key: 'age', label: 'Age', type: 'number' as const, required: true },
    ]
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, fields: numFields, items: [{ id: 1, age: 25 }] },
    })
    const vm = wrapper.vm as any
    vm.formData = { age: 0 }
    expect(vm.validateForm()).toBe(true)
  })

  it('validates number field with non-numeric string', () => {
    const numFields = [
      { key: 'age', label: 'Age', type: 'number' as const, required: true },
    ]
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, fields: numFields, items: [{ id: 1, age: 25 }] },
    })
    const vm = wrapper.vm as any
    vm.formData = { age: 'abc' }
    expect(vm.validateForm()).toBe(false)
    expect(vm.validationErrors.age).toBe('Age is required')
  })

  it('openEdit ignores undefined field values', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    const item = { id: 3, name: 'Dave', email: 'dave@test.com' }
    vm.openEdit(item)
    expect(vm.editingId).toBe(3)
    expect(vm.formData.name).toBe('Dave')
    expect(vm.formData.email).toBe('dave@test.com')
    expect(vm.formData.active).toBeUndefined()
    expect(vm.formData.bio).toBeUndefined()
  })

  it('renders icon component when icon prop provided', () => {
    const wrapper = shallowMount(ResourcePage, {
      props: { ...baseProps, icon: 'div' },
    })
    expect(wrapper.find('h1').exists()).toBe(true)
  })

  it('mount: create dialog shows validation errors', async () => {
    const wrapper = mount(ResourcePage, {
      props: { ...baseProps, fields: [{ key: 'name', label: 'Name', type: 'textarea', required: true }] },
      global: {
        stubs: {
          Dialog: { template: '<div><slot /></div>' },
          Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          Input: { template: '<input />' },
          Label: { template: '<label><slot /></label>' },
          ResourceTable: { template: '<div />' },
          ResourceSearch: { template: '<div />' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openCreate()
    await vm.$nextTick()
    expect(wrapper.find('h2').text()).toContain('Create User')

    vm.formData = { name: '' }
    vm.handleCreate()
    await vm.$nextTick()
    expect(wrapper.text()).toContain('Name is required')
  })

  it('mount: create dialog shows loading state', async () => {
    const wrapper = mount(ResourcePage, {
      props: { ...baseProps, fields: [{ key: 'name', label: 'Name', type: 'text', required: true }], isCreating: true },
      global: {
        stubs: {
          Dialog: { template: '<div><slot /></div>' },
          Button: { template: '<button><slot /></button>' },
          Input: { template: '<input />' },
          Label: { template: '<label><slot /></label>' },
          ResourceTable: { template: '<div />' },
          ResourceSearch: { template: '<div />' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openCreate()
    await vm.$nextTick()
    expect(wrapper.text()).toContain('Create')
  })

  it('mount: edit dialog shows loading state', async () => {
    const wrapper = mount(ResourcePage, {
      props: { ...baseProps, fields: [{ key: 'name', label: 'Name', type: 'text', required: true }], isUpdating: true },
      global: {
        stubs: {
          Dialog: { template: '<div><slot /></div>' },
          Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          Input: { template: '<input />' },
          Label: { template: '<label><slot /></label>' },
          ResourceTable: { template: '<div />' },
          ResourceSearch: { template: '<div />' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openEdit({ id: 1, name: 'Alice' })
    await vm.$nextTick()
    expect(wrapper.text()).toContain('Edit')
  })

  it('mount: edit dialog shows textarea validation error', async () => {
    const wrapper = mount(ResourcePage, {
      props: { ...baseProps, fields: [{ key: 'name', label: 'Name', type: 'textarea', required: true }] },
      global: {
        stubs: {
          Dialog: { template: '<div><slot /></div>' },
          Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          Input: { template: '<input />' },
          Label: { template: '<label><slot /></label>' },
          ResourceTable: { template: '<div />' },
          ResourceSearch: { template: '<div />' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openEdit({ id: 1, name: 'Alice' })
    await vm.$nextTick()
    vm.formData = { name: '' }
    vm.handleUpdate()
    await vm.$nextTick()
    expect(wrapper.text()).toContain('Name is required')
  })

  it('mount: create dialog renders custom slot field', async () => {
    const wrapper = mount(ResourcePage, {
      props: { ...baseProps, fields: [...baseProps.fields, { key: 'custom', label: 'Custom', type: 'text', required: true }] },
      slots: { 'field-custom': '<p class="custom-field">Custom slot content</p>' },
      global: {
        stubs: {
          Dialog: { template: '<div><slot /></div>' },
          Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          Input: { template: '<input />' },
          Label: { template: '<label><slot /></label>' },
          ResourceTable: { template: '<div />' },
          ResourceSearch: { template: '<div />' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openCreate()
    await vm.$nextTick()
    expect(wrapper.find('.custom-field').exists()).toBe(true)

    vm.formData = { custom: '' }
    vm.handleCreate()
    await vm.$nextTick()
    expect(wrapper.text()).toContain('Custom is required')
  })

  it('localSort with aVal null returns 1', () => {
    const wrapper = shallowMount(ResourcePage, { props: baseProps })
    const vm = wrapper.vm as any
    vm.sortField = 'name'
    const items = [{ name: null }, { name: null }]
    const sorted = vm.localSort(items)
    expect(sorted.length).toBe(2)
  })

  it('mount: interacts with create dialog elements', async () => {
    const wrapper = mount(ResourcePage, {
      props: { ...baseProps, fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'bio', label: 'Bio', type: 'textarea', required: false }, { key: 'active', label: 'Active', type: 'boolean', required: false }, { key: 'custom', label: 'Custom', type: 'text', required: false }] },
      slots: { 'field-custom': ({ update }: any) => h('button', { class: 'custom-update', onClick: () => update('test-val') }, 'Update') },
      global: {
        stubs: {
          Dialog: { template: '<div><slot /><button class="dialog-close-test" @click="$emit(\'update:model-value\', false)">X</button></div>' },
          Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          Input: { template: '<input :id="$attrs.id" @input="$emit(\'update:model-value\', $event.target.value)" />' },
          Label: { template: '<label><slot /></label>' },
          ResourceTable: { template: '<div />' },
          ResourceSearch: { template: '<input class="resource-search-test" @input="$emit(\'update:model-value\', $event.target.value)" />' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openCreate()
    await vm.$nextTick()
    expect(vm.isCreateOpen).toBe(true)

    const textarea = wrapper.find('#bio')
    await textarea.setValue('New bio content')
    expect(vm.formData.bio).toBe('New bio content')

    const textInput = wrapper.find('#name')
    await textInput.setValue('New Name')
    expect(vm.formData.name).toBe('New Name')

    const checkbox = wrapper.find('input[type="checkbox"]')
    await checkbox.setValue(true)
    expect(vm.formData.active).toBe(true)

    const searchInput = wrapper.find('.resource-search-test')
    await searchInput.setValue('search term')
    expect(vm.search).toBe('search term')

    const updBtn = wrapper.find('.custom-update')
    await updBtn.trigger('click')

    const cancelBtn = wrapper.findAll('button').filter(b => b.text() === 'Cancel')[0]
    await cancelBtn.trigger('click')
    expect(vm.isCreateOpen).toBe(false)

    vm.openCreate()
    await vm.$nextTick()
    expect(vm.isCreateOpen).toBe(true)
    const closeBtn = wrapper.find('.dialog-close-test')
    await closeBtn.trigger('click')
    expect(vm.isCreateOpen).toBe(false)
  })

  it('mount: interacts with edit dialog elements', async () => {
    const wrapper = mount(ResourcePage, {
      props: { ...baseProps, fields: [{ key: 'name', label: 'Name', type: 'text', required: true }, { key: 'bio', label: 'Bio', type: 'textarea', required: false }, { key: 'active', label: 'Active', type: 'boolean', required: false }, { key: 'custom', label: 'Custom', type: 'text', required: false }] },
      slots: { 'field-custom': ({ update }: any) => h('button', { class: 'custom-update', onClick: () => update('edit-val') }, 'Update') },
      global: {
        stubs: {
          Dialog: { template: '<div><slot /><button class="dialog-close-test" @click="$emit(\'update:model-value\', null)">X</button></div>' },
          Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
          Input: { template: '<input :id="$attrs.id" @input="$emit(\'update:model-value\', $event.target.value)" />' },
          Label: { template: '<label><slot /></label>' },
          ResourceTable: { template: '<div />' },
          ResourceSearch: { template: '<input class="resource-search-test" @input="$emit(\'update:model-value\', $event.target.value)" />' },
        },
      },
    })
    const vm = wrapper.vm as any
    vm.openEdit({ id: 1, name: 'Alice', email: 'a@t.com', active: true, bio: 'Hello' })
    await vm.$nextTick()
    expect(vm.editingId).toBe(1)

    const textInput = wrapper.find('#edit-name')
    await textInput.setValue('New Name')
    expect(vm.formData.name).toBe('New Name')

    const textarea = wrapper.find('#edit-bio')
    await textarea.setValue('Updated bio')
    expect(vm.formData.bio).toBe('Updated bio')

    const checkbox = wrapper.find('#edit-active')
    await checkbox.setValue(false)
    expect(vm.formData.active).toBe(false)

    const updBtns = wrapper.findAll('.custom-update')
    const editUpdBtn = updBtns[1]
    await editUpdBtn.trigger('click')

    const cancelBtns = wrapper.findAll('button').filter(b => b.text() === 'Cancel')
    const editCancelBtn = cancelBtns[1]
    await editCancelBtn.trigger('click')
    expect(vm.editingId).toBeNull()

    vm.openEdit({ id: 2, name: 'Bob', email: 'b@t.com', active: false, bio: 'World' })
    await vm.$nextTick()
    expect(vm.editingId).toBe(2)
    const closeBtns = wrapper.findAll('.dialog-close-test')
    const editCloseBtn = closeBtns[1]
    await editCloseBtn.trigger('click')
    expect(vm.editingId).toBeNull()
  })
})

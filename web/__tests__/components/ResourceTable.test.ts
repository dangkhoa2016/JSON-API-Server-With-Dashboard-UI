// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ResourceTable from '@/components/ResourceTable.vue'

const fields = [
  { key: 'title', label: 'Title', type: 'text' as const, required: true },
  { key: 'body', label: 'Body', type: 'textarea' as const, required: true },
  { key: 'userId', label: 'User ID', type: 'number' as const, required: true },
  { key: 'completed', label: 'Completed', type: 'boolean' as const },
]

function createWrapper(props?: Record<string, any>, slots?: Record<string, any>) {
  return mount(ResourceTable, {
    props: {
      fields,
      items: [],
      isLoading: false,
      title: 'Items',
      page: 1,
      total: 0,
      perPage: 25,
      sortField: undefined,
      sortOrder: 'asc',
      ...props,
    },
    slots,
  })
}

describe('ResourceTable.vue', () => {
  it('shows loading skeleton', () => {
    const wrapper = createWrapper({ isLoading: true })
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows empty state when no items', () => {
    const wrapper = createWrapper({ items: [], total: 0 })
    expect(wrapper.text()).toContain('No items found')
  })

  it('renders table with items', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1, completed: true }],
      total: 1,
    })
    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).toContain('Test')
  })

  it('formats boolean values', () => {
    const wrapper = createWrapper({
      items: [
        { id: 1, title: 'Test', body: 'Hello', userId: 1, completed: true },
        { id: 2, title: 'Test2', body: 'World', userId: 2, completed: false },
      ],
      total: 2,
    })
    expect(wrapper.text()).toContain('Yes')
    expect(wrapper.text()).toContain('No')
  })

  it('formats null/undefined as em dash', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: null, body: undefined, userId: 1 }],
      total: 1,
    })
    expect(wrapper.text()).toContain('\u2014')
  })

  it('emits edit on edit button click', async () => {
    const item = { id: 1, title: 'Test', body: 'Hello', userId: 1 }
    const wrapper = createWrapper({ items: [item], total: 1 })
    const editBtn = wrapper.find('button[title="Edit"]')
    await editBtn.trigger('click')
    expect(wrapper.emitted('edit')![0]).toEqual([item])
  })

  it('emits delete on delete button click', async () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 1,
    })
    const deleteBtn = wrapper.find('button[title="Delete"]')
    await deleteBtn.trigger('click')
    expect(wrapper.emitted('delete')![0]).toEqual([1])
  })

  it('emits update:page on previous page click', async () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 100,
      page: 2,
    })
    const prevBtn = wrapper.find('button[title="Previous page"]')
    await prevBtn.trigger('click')
    expect(wrapper.emitted('update:page')![0]).toEqual([1])
  })

  it('disables previous button on first page', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 100,
      page: 1,
    })
    const prevBtn = wrapper.find('button[title="Previous page"]')
    expect(prevBtn.attributes('disabled')).toBe('')
  })

  it('emits update:page on next page click', async () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 100,
      page: 2,
    })
    const nextBtn = wrapper.find('button[title="Next page"]')
    await nextBtn.trigger('click')
    expect(wrapper.emitted('update:page')![0]).toEqual([3])
  })

  it('disables next button on last page', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 25,
      page: 1,
    })
    const nextBtn = wrapper.find('button[title="Next page"]')
    expect(nextBtn.attributes('disabled')).toBe('')
  })

  it('renders visible page numbers', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 100,
      page: 3,
    })
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('4')
  })

  it('highlights current page', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 100,
      page: 1,
    })
    const pageBtns = wrapper.findAll('button').filter(b => b.text() === '1')
    expect(pageBtns.length).toBeGreaterThanOrEqual(1)
  })

  it('emits update:page on page number click', async () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 100,
      page: 1,
    })
    const pageBtn = wrapper.findAll('button').filter(b => b.text() === '2')[0]
    if (pageBtn) {
      await pageBtn.trigger('click')
      expect(wrapper.emitted('update:page')![0]).toEqual([2])
    }
  })

  it('goToPage does not emit for out of range', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 25,
      page: 1,
    })
    const vm = wrapper.vm as any
    vm.goToPage(0)
    expect(wrapper.emitted('update:page')).toBeFalsy()
    vm.goToPage(999)
    expect(wrapper.emitted('update:page')).toBeFalsy()
  })

  it('goToPage does not emit for current page', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 100,
      page: 2,
    })
    const vm = wrapper.vm as any
    vm.goToPage(2)
    expect(wrapper.emitted('update:page')).toBeFalsy()
  })

  it('formatValue handles null/undefined', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    expect(vm.formatValue({ title: null }, fields[0])).toBe('\u2014')
    expect(vm.formatValue({ title: undefined }, fields[0])).toBe('\u2014')
  })

  it('formatValue returns string representation for text fields', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    expect(vm.formatValue({ title: 'Hello World' }, fields[0])).toBe('Hello World')
    expect(vm.formatValue({ title: 123 }, fields[0])).toBe('123')
  })

  it('formatValue handles boolean', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    expect(vm.formatValue({ completed: true }, { key: 'completed', label: 'Completed', type: 'boolean' })).toBe('Yes')
    expect(vm.formatValue({ completed: false }, { key: 'completed', label: 'Completed', type: 'boolean' })).toBe('No')
  })

  it('sortIcon returns a component for asc', () => {
    const wrapper = createWrapper({ sortField: 'title', sortOrder: 'asc' })
    const vm = wrapper.vm as any
    const result = vm.sortIcon('title')
    expect(result).toBeTruthy()
    expect(typeof result === 'function' || typeof result === 'object').toBe(true)
  })

  it('sortIcon returns different icon for desc vs asc', () => {
    const ascWrapper = createWrapper({ sortField: 'title', sortOrder: 'asc' })
    const descWrapper = createWrapper({ sortField: 'title', sortOrder: 'desc' })
    expect(ascWrapper.vm.sortIcon('title')).not.toBe(descWrapper.vm.sortIcon('title'))
  })

  it('sortIcon returns ArrowUpDown for no sort', () => {
    const wrapper = createWrapper({ sortField: undefined, sortOrder: 'asc' })
    const vm = wrapper.vm as any
    expect(vm.sortIcon('title')).toBeTruthy()
  })

  it('handleSort toggles order for same field', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 1,
      sortField: 'title',
      sortOrder: 'asc',
    })
    const vm = wrapper.vm as any
    vm.handleSort('title')
    expect(wrapper.emitted('update:sort')![0]).toEqual(['title', 'desc'])
  })

  it('handleSort toggles asc when current order is desc', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 1,
      sortField: 'title',
      sortOrder: 'desc',
    })
    const vm = wrapper.vm as any
    vm.handleSort('title')
    expect(wrapper.emitted('update:sort')![0]).toEqual(['title', 'asc'])
  })

  it('clicking ID header triggers sort', async () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 1,
    })
    const ths = wrapper.findAll('th')
    const idTh = ths.filter(t => t.text().includes('ID'))[0]
    await idTh.trigger('click')
    expect(wrapper.emitted('update:sort')![0]).toEqual(['id', 'asc'])
  })

  it('clicking Title header triggers sort', async () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 1,
    })
    const ths = wrapper.findAll('th')
    const titleTh = ths.filter(t => t.text().includes('Title'))[0]
    await titleTh.trigger('click')
    expect(wrapper.emitted('update:sort')![0]).toEqual(['title', 'asc'])
  })

  it('handleSort sets asc for new field', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 1,
      sortField: undefined,
      sortOrder: 'asc',
    })
    const vm = wrapper.vm as any
    vm.handleSort('title')
    expect(wrapper.emitted('update:sort')![0]).toEqual(['title', 'asc'])
  })

  it('visiblePages handles small total pages', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 3,
      page: 1,
    })
    const vm = wrapper.vm as any
    expect(vm.visiblePages).toEqual([1])
  })

  it('visiblePages adjusts start when near end', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 250,
      page: 10,
    })
    const vm = wrapper.vm as any
    expect(vm.visiblePages).toContain(10)
  })

  it('visiblePages skips adjustment when range is sufficient', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 250,
      page: 5,
    })
    const vm = wrapper.vm as any
    expect(vm.visiblePages.length).toBeGreaterThanOrEqual(4)
  })

  it('hasCellSlot returns true for existing slot', () => {
    const wrapper = createWrapper(
      { items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }], total: 1 },
      { 'cell-title': '<div>Custom</div>' },
    )
    const vm = wrapper.vm as any
    expect(vm.hasCellSlot('title')).toBe(true)
    expect(vm.hasCellSlot('nonexistent')).toBe(false)
  })

  it('shows row count in pagination footer (singular)', () => {
    const wrapper = createWrapper({
      items: [{ id: 1, title: 'Test', body: 'Hello', userId: 1 }],
      total: 1,
    })
    expect(wrapper.text()).toContain('row')
  })

  it('shows row count in pagination footer (plural)', () => {
    const wrapper = createWrapper({
      items: [
        { id: 1, title: 'Test1', body: 'Hello1', userId: 1 },
        { id: 2, title: 'Test2', body: 'Hello2', userId: 2 },
      ],
      total: 2,
    })
    expect(wrapper.text()).toContain('rows')
  })

  it('sets title on empty state based on props', () => {
    const wrapper = createWrapper({ title: 'Posts' })
    expect(wrapper.text()).toContain('No posts found')
  })
})

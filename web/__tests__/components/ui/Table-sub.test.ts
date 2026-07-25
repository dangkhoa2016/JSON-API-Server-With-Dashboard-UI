// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import TableBody from '@/components/ui/TableBody.vue'
import TableCell from '@/components/ui/TableCell.vue'
import TableHead from '@/components/ui/TableHead.vue'
import TableHeader from '@/components/ui/TableHeader.vue'
import TableRow from '@/components/ui/TableRow.vue'
import Table from '@/components/ui/Table.vue'

vi.mock('@/lib/utils', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }))

describe('TableBody.vue', () => {
  it('renders tbody with slot', () => {
    const wrapper = mount(TableBody, {
      slots: { default: '<tr><td>Hello</td></tr>' },
    })
    expect(wrapper.find('tbody').exists()).toBe(true)
    expect(wrapper.text()).toContain('Hello')
  })

  it('accepts custom class', () => {
    const wrapper = mount(TableBody, { props: { class: 'my-body' } })
    expect(wrapper.find('tbody').classes()).toContain('my-body')
  })
})

describe('TableCell.vue', () => {
  it('renders td with slot', () => {
    const wrapper = mount(TableCell, {
      slots: { default: 'Content' },
    })
    expect(wrapper.find('td').exists()).toBe(true)
    expect(wrapper.text()).toContain('Content')
  })

  it('accepts custom class', () => {
    const wrapper = mount(TableCell, { props: { class: 'my-cell' } })
    expect(wrapper.find('td').classes()).toContain('my-cell')
  })
})

describe('TableHead.vue', () => {
  it('renders th with slot', () => {
    const wrapper = mount(TableHead, {
      slots: { default: 'Name' },
    })
    expect(wrapper.find('th').exists()).toBe(true)
    expect(wrapper.text()).toContain('Name')
  })

  it('accepts custom class', () => {
    const wrapper = mount(TableHead, { props: { class: 'my-head' } })
    expect(wrapper.find('th').classes()).toContain('my-head')
  })
})

describe('TableHeader.vue', () => {
  it('renders thead with slot', () => {
    const wrapper = mount(TableHeader, {
      slots: { default: '<tr><th>H</th></tr>' },
    })
    expect(wrapper.find('thead').exists()).toBe(true)
    expect(wrapper.text()).toContain('H')
  })

  it('accepts custom class', () => {
    const wrapper = mount(TableHeader, { props: { class: 'my-header' } })
    expect(wrapper.find('thead').classes()).toContain('my-header')
  })
})

describe('TableRow.vue', () => {
  it('renders tr with slot', () => {
    const wrapper = mount(TableRow, {
      slots: { default: '<td>Data</td>' },
    })
    expect(wrapper.find('tr').exists()).toBe(true)
    expect(wrapper.text()).toContain('Data')
  })

  it('accepts custom class', () => {
    const wrapper = mount(TableRow, { props: { class: 'my-row' } })
    expect(wrapper.find('tr').classes()).toContain('my-row')
  })
})

describe('Table + all sub-components integrated', () => {
  it('renders full table with all sub-components', () => {
    const wrapper = mount(Table, {
      slots: {
        default: `
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>1</TableCell>
              <TableCell>Alice</TableCell>
            </TableRow>
          </TableBody>
        `,
      },
      global: {
        stubs: {
          TableHeader, TableRow, TableHead, TableBody, TableCell,
        },
      },
    })
    expect(wrapper.text()).toContain('ID')
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('1')
    expect(wrapper.text()).toContain('Alice')
  })
})

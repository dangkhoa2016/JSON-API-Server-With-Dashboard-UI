import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useResourceCrud } from '@/composables/useResourceCrud'

const mockMutate = vi.fn((_data: any, options?: any) => {
  if (options?.onSuccess) options.onSuccess()
})
const mockRefetch = vi.fn()

const { toastSuccess, toastError } = vi.hoisted(() => ({ toastSuccess: vi.fn(), toastError: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

vi.mock('@/providers/trpc', () => ({
  trpc: {
    json: {
      albums: {
        list: { useQuery: (_input: any, opts?: any) => {
          opts?.placeholderData?.(null)
          void opts?.queryKey?.value
          return { data: { value: { data: [] } }, isLoading: { value: false }, refetch: mockRefetch }
        }},
        create: { useMutation: () => ({ mutate: mockMutate, isPending: { value: false } }) },
        update: { useMutation: () => ({ mutate: mockMutate, isPending: { value: false } }) },
        delete: { useMutation: () => ({ mutate: mockMutate, isPending: { value: false } }) },
      },
    },
  },
  trpcClient: { query: vi.fn() },
}))

describe('useResourceCrud', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns default perPage 25', () => {
    const crud = useResourceCrud('albums')
    expect(crud.perPage).toBe(25)
  })

  it('accepts custom perPage via opts', () => {
    const crud = useResourceCrud('albums', { perPage: 50 })
    expect(crud.perPage).toBe(50)
  })

  it('handleCreate calls mutate with onSuccess', () => {
    const crud = useResourceCrud('albums')
    crud.handleCreate({ title: 'New Album' })
    expect(mockMutate).toHaveBeenCalledWith(
      { title: 'New Album' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
  })

  it('handleCreate onSuccess calls refetch and toast', () => {
    const crud = useResourceCrud('albums')
    crud.handleCreate({ title: 'New Album' })
    expect(mockRefetch).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Albums', { description: 'Album created successfully.' })
  })

  it('handleCreate onError calls toast.error', () => {
    mockMutate.mockImplementationOnce((_data: any, options?: any) => options?.onError?.(new Error('Fail')))
    const crud = useResourceCrud('albums')
    crud.handleCreate({ title: 'New Album' })
    expect(toastError).toHaveBeenCalledWith('Failed', { description: 'Fail' })
  })

  it('handleUpdate calls mutate with id and data', () => {
    const crud = useResourceCrud('albums')
    crud.handleUpdate(1, { title: 'Updated' })
    expect(mockMutate).toHaveBeenCalledWith(
      { id: 1, data: { title: 'Updated' } },
      expect.any(Object),
    )
  })

  it('handleUpdate onSuccess calls refetch and toast', () => {
    const crud = useResourceCrud('albums')
    crud.handleUpdate(1, { title: 'Updated' })
    expect(mockRefetch).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Albums', { description: 'Album updated successfully.' })
  })

  it('handleUpdate onError calls toast.error', () => {
    mockMutate.mockImplementationOnce((_data: any, options?: any) => options?.onError?.(new Error('Update fail')))
    const crud = useResourceCrud('albums')
    crud.handleUpdate(1, { title: 'Updated' })
    expect(toastError).toHaveBeenCalledWith('Failed', { description: 'Update fail' })
  })

  it('handleDelete calls mutate with id', () => {
    const crud = useResourceCrud('albums')
    crud.handleDelete(5)
    expect(mockMutate).toHaveBeenCalledWith({ id: 5 }, expect.any(Object))
  })

  it('handleDelete onSuccess calls refetch and toast', () => {
    const crud = useResourceCrud('albums')
    crud.handleDelete(5)
    expect(mockRefetch).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Albums', { description: 'Album deleted successfully.' })
  })

  it('handleDelete onError calls toast.error', () => {
    mockMutate.mockImplementationOnce((_data: any, options?: any) => options?.onError?.(new Error('Delete fail')))
    const crud = useResourceCrud('albums')
    crud.handleDelete(5)
    expect(toastError).toHaveBeenCalledWith('Failed', { description: 'Delete fail' })
  })

  it('handleSearch resets page to 1', () => {
    const crud = useResourceCrud('albums')
    crud.page.value = 3
    crud.handleSearch('test')
    expect(crud.page.value).toBe(1)
  })

  it('handleSearch with empty string does not throw', () => {
    const crud = useResourceCrud('albums')
    expect(() => crud.handleSearch('')).not.toThrow()
  })

  it('handleSort does not throw', () => {
    const crud = useResourceCrud('albums')
    expect(() => crud.handleSort('id', 'desc')).not.toThrow()
  })
})

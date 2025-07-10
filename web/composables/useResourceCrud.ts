import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import { toast } from 'vue-sonner'
import { trpc } from '@/providers/trpc'

type ResourceName = 'albums' | 'comments' | 'photos' | 'posts' | 'todos' | 'users'

const labels: Record<ResourceName, { title: string; singular: string }> = {
  albums: { title: 'Albums', singular: 'Album' },
  comments: { title: 'Comments', singular: 'Comment' },
  photos: { title: 'Photos', singular: 'Photo' },
  posts: { title: 'Posts', singular: 'Post' },
  todos: { title: 'Todos', singular: 'Todo' },
  users: { title: 'Users', singular: 'User' },
}

interface ListQuery {
  data: Ref<{ data: unknown[]; total: number } | undefined>;
  isLoading: Ref<boolean>;
  refetch: () => void;
}

export function useResourceCrud(resource: ResourceName, opts?: { perPage?: number }) {
  type JsonApi = typeof trpc.json
  type Api = JsonApi[ResourceName]
  const api: Api = (trpc.json as Pick<JsonApi, ResourceName>)[resource]

  const page = ref(1)
  const perPage = opts?.perPage ?? 25
  const searchQuery = ref<string | undefined>(undefined)
  const sortField = ref<string | undefined>(undefined)
  const sortOrder = ref<'asc' | 'desc'>('asc')

  const list = (api.list as unknown as { useQuery: (input: Record<string, unknown>, opts?: Record<string, unknown>) => ListQuery }).useQuery(
    { filters: {}, limit: perPage, page, q: searchQuery, sort: sortField, order: sortOrder },
    {
      placeholderData: (prev: unknown) => prev,
      queryKey: computed(() => [{ subsystem: 'trpc', path: `json.${resource}.list`, page: page.value, filters: {}, q: searchQuery.value, sort: sortField.value, order: sortOrder.value }]),
    },
  )
  const create = api.create.useMutation()
  const update = api.update.useMutation()
  const del = api.delete.useMutation()

  const { title, singular } = labels[resource]

  function handleCreate(data: Record<string, unknown>) {
    create.mutate(data as never, {
      onSuccess: () => {
        list.refetch()
        toast.success(title, { description: `${singular} created successfully.` })
      },
      onError: (err: { message: string }) => {
        toast.error('Failed', { description: err.message })
      },
    })
  }

  function handleUpdate(id: number, data: Record<string, unknown>) {
    update.mutate({ id, data } as never, {
      onSuccess: () => {
        list.refetch()
        toast.success(title, { description: `${singular} updated successfully.` })
      },
      onError: (err: { message: string }) => {
        toast.error('Failed', { description: err.message })
      },
    })
  }

  function handleDelete(id: number) {
    del.mutate({ id }, {
      onSuccess: () => {
        list.refetch()
        toast.success(title, { description: `${singular} deleted successfully.` })
      },
      onError: (err: { message: string }) => {
        toast.error('Failed', { description: err.message })
      },
    })
  }

  function handleSearch(q: string) {
    searchQuery.value = q || undefined
    page.value = 1
  }

  function handleSort(field: string | undefined, order: 'asc' | 'desc') {
    sortField.value = field
    sortOrder.value = order
  }

  return { list, create, update, handleCreate, handleUpdate, handleDelete, handleSearch, handleSort, searchQuery, sortField, sortOrder, page, perPage }
}

import { ref, computed } from 'vue'
import { toast } from 'vue-sonner'
import { trpc } from '@/providers/trpc'

type ResourceName = 'albums' | 'comments' | 'photos' | 'posts' | 'todos'

const labels: Record<ResourceName, { title: string; singular: string }> = {
  albums: { title: 'Albums', singular: 'Album' },
  comments: { title: 'Comments', singular: 'Comment' },
  photos: { title: 'Photos', singular: 'Photo' },
  posts: { title: 'Posts', singular: 'Post' },
  todos: { title: 'Todos', singular: 'Todo' },
}

export function useResourceCrud(resource: ResourceName, opts?: { perPage?: number }) {
  type Api = typeof trpc.json.albums
  const api: Api = (trpc.json as any)[resource]

  const page = ref(1)
  const perPage = opts?.perPage ?? 25

  const list = api.list.useQuery(
    { filters: {}, limit: perPage, page },
    {
      placeholderData: (prev: any) => prev,
      queryKey: computed(() => [{ subsystem: 'trpc', path: `json.${resource}.list`, page: page.value, filters: {} }]),
    },
  )
  const create = api.create.useMutation()
  const update = api.update.useMutation()
  const del = api.delete.useMutation()

  const { title, singular } = labels[resource]

  function handleCreate(data: any) {
    create.mutate(data, {
      onSuccess: () => {
        list.refetch()
        toast.success(title, { description: `${singular} created successfully.` })
      },
      onError: (err: any) => {
        toast.error('Failed', { description: err.message })
      },
    })
  }

  function handleUpdate(id: number, data: any) {
    update.mutate({ id, data }, {
      onSuccess: () => {
        list.refetch()
        toast.success(title, { description: `${singular} updated successfully.` })
      },
      onError: (err: any) => {
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
      onError: (err: any) => {
        toast.error('Failed', { description: err.message })
      },
    })
  }

  return { list, create, update, handleCreate, handleUpdate, handleDelete, page, perPage }
}

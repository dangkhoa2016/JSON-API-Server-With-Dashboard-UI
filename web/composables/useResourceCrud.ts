import { ref, computed } from 'vue'
import { trpc } from '@/providers/trpc'

type ResourceName = 'albums' | 'comments' | 'photos' | 'posts' | 'todos'

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

  function handleCreate(data: any) {
    create.mutate(data, { onSuccess: () => list.refetch() })
  }

  function handleUpdate(id: number, data: any) {
    update.mutate({ id, data }, { onSuccess: () => list.refetch() })
  }

  function handleDelete(id: number) {
    del.mutate({ id }, { onSuccess: () => list.refetch() })
  }

  return { list, create, update, handleCreate, handleUpdate, handleDelete, page, perPage }
}

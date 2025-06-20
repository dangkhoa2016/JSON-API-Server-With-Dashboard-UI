import { trpc } from '@/providers/trpc'

type ResourceName = 'albums' | 'comments' | 'photos' | 'posts' | 'todos'

export function useResourceCrud(resource: ResourceName) {
  type Api = typeof trpc.json.albums
  const api: Api = (trpc.json as any)[resource]

  const list = api.list.useQuery({ filters: {} })
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

  return { list, create, update, del, handleCreate, handleUpdate, handleDelete }
}

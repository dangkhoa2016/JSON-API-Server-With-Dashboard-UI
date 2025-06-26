<script setup lang="ts">
import { ref, computed } from 'vue'
import { trpc } from '@/providers/trpc'
import ResourcePage from '@/components/ResourcePage.vue'
import Button from '@/components/ui/Button.vue'
import Label from '@/components/ui/Label.vue'
import Dialog from '@/components/ui/Dialog.vue'
import { Users } from '@lucide/vue'
import { toast } from 'vue-sonner'

const fields = [
  { key: 'name', label: 'Name', type: 'text' as const, required: true },
  { key: 'username', label: 'Username', type: 'text' as const },
  { key: 'email', label: 'Email', type: 'email' as const },
  { key: 'phone', label: 'Phone', type: 'text' as const },
  { key: 'website', label: 'Website', type: 'text' as const },
  { key: 'address', label: 'Address', type: 'text' as const },
  { key: 'company', label: 'Company', type: 'text' as const },
]

const title = 'Users'
const page = ref(1)
const perPage = 25

const list = trpc.json.users.list.useQuery(
  { filters: {}, limit: perPage, page },
  {
    /* v8 ignore next */
    placeholderData: (prev) => prev,
    /* v8 ignore next */
    queryKey: computed(() => [{ subsystem: "trpc", path: "json.users.list", page: page.value, filters: {} }]),
  },
)
const create = trpc.json.users.create.useMutation()
const update = trpc.json.users.update.useMutation()
const del = trpc.json.users.delete.useMutation()

function handleCreate(data: any) {
  create.mutate(data, {
    onSuccess: () => {
      list.refetch()
      toast.success(title, { description: 'User created successfully.' })
    },
    onError: (err) => {
      toast.error('Failed', { description: err.message })
    },
  })
}

function handleUpdate(id: number, data: any) {
  update.mutate({ id, data }, {
    onSuccess: () => {
      list.refetch()
      toast.success(title, { description: 'User updated successfully.' })
    },
    onError: (err) => {
      toast.error('Failed', { description: err.message })
    },
  })
}

function handleDelete(id: number) {
  del.mutate({ id }, {
    onSuccess: () => {
      list.refetch()
      toast.success(title, { description: 'User deleted successfully.' })
    },
    onError: (err) => {
      toast.error('Failed', { description: err.message })
    },
  })
}

const formattedItems = computed(() => {
  if (!list.data.value?.data) return []
  return list.data.value.data.map((item: any) => ({
    ...item,
    address: item.address ? JSON.stringify(item.address, null, 2) : '',
    company: item.company ? JSON.stringify(item.company, null, 2) : '',
  }))
})

// ── Address modal ──────────────────────────────────────────────
const addressModalOpen = ref(false)
const addressData = ref({ street: '', suite: '', city: '', zipcode: '', lat: '', lng: '' })
let addressUpdateFn: ((v: string) => void) | null = null

function openAddressModal(value: string | undefined, update: (v: string) => void) {
  addressUpdateFn = update
  const obj = typeof value === 'string' && value ? tryParseJson(value) : {}
  addressData.value = {
    street: obj?.street || '',
    suite: obj?.suite || '',
    city: obj?.city || '',
    zipcode: obj?.zipcode || '',
    lat: obj?.geo?.lat || '',
    lng: obj?.geo?.lng || '',
  }
  addressModalOpen.value = true
}

function saveAddress() {
  const geo: Record<string, string> = {}
  if (addressData.value.lat) geo.lat = addressData.value.lat
  if (addressData.value.lng) geo.lng = addressData.value.lng
  const obj: Record<string, any> = {}
  if (addressData.value.street) obj.street = addressData.value.street
  if (addressData.value.suite) obj.suite = addressData.value.suite
  if (addressData.value.city) obj.city = addressData.value.city
  if (addressData.value.zipcode) obj.zipcode = addressData.value.zipcode
  if (Object.keys(geo).length) obj.geo = geo
  const json = Object.keys(obj).length ? JSON.stringify(obj) : ''
  addressUpdateFn?.(json)
  addressModalOpen.value = false
}

// ── Company modal ──────────────────────────────────────────────
const companyModalOpen = ref(false)
const companyData = ref({ name: '', catchPhrase: '', bs: '' })
let companyUpdateFn: ((v: string) => void) | null = null

function openCompanyModal(value: string | undefined, update: (v: string) => void) {
  companyUpdateFn = update
  const obj = typeof value === 'string' && value ? tryParseJson(value) : {}
  companyData.value = {
    name: obj?.name || '',
    catchPhrase: obj?.catchPhrase || '',
    bs: obj?.bs || '',
  }
  companyModalOpen.value = true
}

function saveCompany() {
  const obj: Record<string, string> = {}
  if (companyData.value.name) obj.name = companyData.value.name
  if (companyData.value.catchPhrase) obj.catchPhrase = companyData.value.catchPhrase
  if (companyData.value.bs) obj.bs = companyData.value.bs
  const json = Object.keys(obj).length ? JSON.stringify(obj) : ''
  companyUpdateFn?.(json)
  companyModalOpen.value = false
}

function tryParseJson(str: string): any {
  try { return JSON.parse(str) } catch { return {} }
}

function summary(value: string | undefined): string {
  if (!value) return 'Not set'
  const obj = tryParseJson(value)
  if (!obj || !Object.keys(obj).length) return 'Not set'
  return value.length > 60 ? value.slice(0, 60) + '...' : value
}

function setAddr(field: string, e: Event) {
  const val = (e.target as HTMLInputElement).value
  addressData.value = { ...addressData.value, [field]: val }
}

function setComp(field: string, e: Event) {
  const val = (e.target as HTMLInputElement).value
  companyData.value = { ...companyData.value, [field]: val }
}
</script>

<template>
  <ResourcePage
    title="Users"
    :fields="fields"
    :items="formattedItems"
    :total="list.data.value?.total ?? 0"
    v-model:page="page"
    :per-page="perPage"
    :is-loading="list.isLoading.value"
    :is-creating="create.isPending.value"
    :is-updating="update.isPending.value"
    :icon="Users"
    @create="handleCreate"
    @update="handleUpdate"
    @delete="handleDelete"
  >
    <template #field-address="{ value, update }">
      <div class="flex items-center gap-2 mt-1">
        <span class="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">{{ summary(value) }}</span>
        <Button size="sm" variant="outline" @click="openAddressModal(value, update)">Edit</Button>
      </div>
    </template>

    <template #field-company="{ value, update }">
      <div class="flex items-center gap-2 mt-1">
        <span class="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">{{ summary(value) }}</span>
        <Button size="sm" variant="outline" @click="openCompanyModal(value, update)">Edit</Button>
      </div>
    </template>
  </ResourcePage>

  <!-- Address Modal -->
  <Dialog v-model="addressModalOpen">
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">Edit Address</h2>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-1 col-span-2">
          <Label for="addr-street">Street</Label>
          <input
            id="addr-street"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            :value="addressData.street"
            @input="setAddr('street', $event)"
          />
        </div>
        <div class="space-y-1">
          <Label for="addr-suite">Suite</Label>
          <input
            id="addr-suite"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            :value="addressData.suite"
            @input="setAddr('suite', $event)"
          />
        </div>
        <div class="space-y-1">
          <Label for="addr-city">City</Label>
          <input
            id="addr-city"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            :value="addressData.city"
            @input="setAddr('city', $event)"
          />
        </div>
        <div class="space-y-1">
          <Label for="addr-zipcode">Zipcode</Label>
          <input
            id="addr-zipcode"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            :value="addressData.zipcode"
            @input="setAddr('zipcode', $event)"
          />
        </div>
        <div class="space-y-1">
          <Label for="addr-lat">Latitude</Label>
          <input
            id="addr-lat"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            :value="addressData.lat"
            @input="setAddr('lat', $event)"
          />
        </div>
        <div class="space-y-1">
          <Label for="addr-lng">Longitude</Label>
          <input
            id="addr-lng"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            :value="addressData.lng"
            @input="setAddr('lng', $event)"
          />
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="outline" @click="addressModalOpen = false">Cancel</Button>
        <Button @click="saveAddress">Save Address</Button>
      </div>
    </div>
  </Dialog>

  <!-- Company Modal -->
  <Dialog v-model="companyModalOpen">
    <div class="space-y-4">
      <h2 class="text-lg font-semibold">Edit Company</h2>
      <div class="space-y-3">
        <div class="space-y-1">
          <Label for="comp-name">Name</Label>
          <input
            id="comp-name"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            :value="companyData.name"
            @input="setComp('name', $event)"
          />
        </div>
        <div class="space-y-1">
          <Label for="comp-catch">Catch Phrase</Label>
          <input
            id="comp-catch"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            :value="companyData.catchPhrase"
            @input="setComp('catchPhrase', $event)"
          />
        </div>
        <div class="space-y-1">
          <Label for="comp-bs">BS</Label>
          <input
            id="comp-bs"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            :value="companyData.bs"
            @input="setComp('bs', $event)"
          />
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="outline" @click="companyModalOpen = false">Cancel</Button>
        <Button @click="saveCompany">Save Company</Button>
      </div>
    </div>
  </Dialog>
</template>

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import Home from '@/pages/Home.vue'

const mockData = vi.hoisted(() => ({
  users: 42,
  posts: 15,
  comments: 7,
  albums: 3,
  photos: 99,
  todos: 10,
}))

const mockFeatureCardsData = vi.hoisted(() => [
  {
    key: 'feature_card_sqlite',
    label: 'SQLite Database',
    description: 'Local SQLite database with Drizzle ORM. All data persists in a local file.',
    icon: 'Database',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    key: 'feature_card_redis',
    label: 'Redis Cache',
    description: 'Host: localhost:6379\nTTL: 3600s',
    icon: 'Zap',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    iconColor: 'text-orange-600 dark:text-orange-400',
    healthy: false,
  },
  {
    key: 'feature_card_ratelimit',
    label: 'Rate Limiting',
    description: 'Max: 100 requests\nWindow: 60000ms',
    icon: 'Shield',
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-400',
    healthy: true,
  },
])

const toastError = vi.hoisted(() => vi.fn())

const mockRefs = vi.hoisted(() => ({}) as any)

vi.mock('@/providers/trpc', async () => {
  const { ref } = await import('vue')

  const data = ref({ ...mockData })
  const isLoading = ref(false)
  const isError = ref(false)
  const featureCardsData = ref(mockFeatureCardsData)
  const isFeatureCardsLoading = ref(false)

  mockRefs.data = data
  mockRefs.isLoading = isLoading
  mockRefs.isError = isError
  mockRefs.featureCardsData = featureCardsData
  mockRefs.isFeatureCardsLoading = isFeatureCardsLoading

  return {
    trpc: {
      json: {
        getCounts: { useQuery: () => ({ data, isLoading, isError }) },
        getFeatureCards: { useQuery: () => ({ data: featureCardsData, isLoading: isFeatureCardsLoading }) },
      },
    },
    trpcClient: { query: vi.fn() },
  }
})

vi.mock('@lucide/vue', () => ({
  Users: { name: 'Users', render: () => null },
  FileText: { name: 'FileText', render: () => null },
  MessageSquare: { name: 'MessageSquare', render: () => null },
  Image: { name: 'Image', render: () => null },
  Images: { name: 'Images', render: () => null },
  CheckSquare: { name: 'CheckSquare', render: () => null },
  Database: { name: 'Database', render: () => null },
  Zap: { name: 'Zap', render: () => null },
  Shield: { name: 'Shield', render: () => null },
}))

vi.mock('vue-sonner', () => ({
  toast: { error: toastError },
}))

const RouterLinkStub = { name: 'RouterLink', template: '<a><slot /></a>' }
const mountOptions = {
  global: { components: { 'router-link': RouterLinkStub } },
}

afterEach(() => {
  mockRefs.data.value = { ...mockData }
  mockRefs.isLoading.value = false
  mockRefs.isError.value = false
  mockRefs.featureCardsData.value = mockFeatureCardsData
  mockRefs.isFeatureCardsLoading.value = false
  toastError.mockClear()
})

function mountHome() {
  const wrapper = mount(Home, mountOptions)
  return wrapper
}

describe('Home.vue', () => {
  it('renders dashboard header', () => {
    const wrapper = mountHome()
    expect(wrapper.text()).toContain('Dashboard')
  })

  it('renders 6 resource cards', () => {
    const wrapper = mountHome()
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(6)
  })

  it('renders resource count for users', () => {
    const wrapper = mountHome()
    expect(wrapper.text()).toContain('42')
  })

  it('renders feature cards with titles and badges', () => {
    const wrapper = mountHome()
    expect(wrapper.text()).toContain('SQLite Database')
    expect(wrapper.text()).toContain('Redis Cache')
    expect(wrapper.text()).toContain('Rate Limiting')
    expect(wrapper.text()).toContain('Disabled')
    expect(wrapper.text()).toContain('Enabled')
  })

  it('does not render badge for card without healthy field', () => {
    const wrapper = mountHome()
    const badges = wrapper.findAll('span.inline-flex')
    expect(badges).toHaveLength(2)
  })

  it('renders API endpoints section', () => {
    const wrapper = mountHome()
    expect(wrapper.text()).toContain('API Endpoints')
  })

  it('renders endpoint for each resource', () => {
    const wrapper = mountHome()
    expect(wrapper.text()).toContain('GET /api/users')
    expect(wrapper.text()).toContain('GET /api/posts')
    expect(wrapper.text()).toContain('GET /api/todos')
  })

  it('renders counts from single query', () => {
    const wrapper = mountHome() as any
    expect(wrapper.vm.counts).toEqual({
      users: 42,
      posts: 15,
      comments: 7,
      albums: 3,
      photos: 99,
      todos: 10,
    })
  })

  it('counts handles null data with fallback to 0', () => {
    mockRefs.data.value = null as any
    const wrapper = mountHome() as any
    expect(wrapper.vm.counts).toEqual({
      users: 0,
      posts: 0,
      comments: 0,
      albums: 0,
      photos: 0,
      todos: 0,
    })
  })

  it('shows skeleton when counts loading', () => {
    mockRefs.data.value = null as any
    mockRefs.isLoading.value = true
    const wrapper = mountHome()
    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
  })

  it('shows skeleton cards when feature cards loading', () => {
    mockRefs.isFeatureCardsLoading.value = true
    const wrapper = mountHome()
    const pulses = wrapper.findAll('.animate-pulse')
    expect(pulses.length).toBeGreaterThanOrEqual(6)
  })

  it('shows toast error when counts fetch fails', async () => {
    mountHome()
    mockRefs.isError.value = true
    await nextTick()
    expect(toastError).toHaveBeenCalledWith('Failed to load dashboard counts')
  })

  it('renders no feature cards when backend returns null', () => {
    mockRefs.featureCardsData.value = null as any
    const wrapper = mountHome()
    const featureSection = wrapper.find('div.grid.grid-cols-1.md\\:grid-cols-3')
    const cardDivs = featureSection.findAll('div.bg-white')
    expect(cardDivs).toHaveLength(0)
  })

  it('renders no feature cards when backend returns empty array', () => {
    mockRefs.featureCardsData.value = []
    const wrapper = mountHome()
    const featureSection = wrapper.find('div.grid.grid-cols-1.md\\:grid-cols-3')
    const cardDivs = featureSection.findAll('div.bg-white')
    expect(cardDivs).toHaveLength(0)
  })

  it('falls back to Database icon for unknown icon name', () => {
    mockRefs.featureCardsData.value = [
      {
        key: 'feature_card_custom',
        label: 'Custom',
        description: 'A custom card',
        icon: 'UnknownIcon',
        iconBg: 'bg-gray-100 dark:bg-gray-900/30',
        iconColor: 'text-gray-600 dark:text-gray-400',
      },
    ]
    const wrapper = mountHome() as any
    const card = wrapper.vm.featureCards.find((c: any) => c.key === 'feature_card_custom')
    expect(card.icon.name).toBe('Database')
  })

  it('uses default iconBg and iconColor when missing', () => {
    mockRefs.featureCardsData.value = [
      {
        key: 'feature_card_minimal',
        label: 'Minimal',
        description: 'No style fields',
        icon: 'Database',
      },
    ]
    const wrapper = mountHome() as any
    const card = wrapper.vm.featureCards.find((c: any) => c.key === 'feature_card_minimal')
    expect(card.iconBg).toBe('bg-blue-100 dark:bg-blue-900/30')
    expect(card.iconColor).toBe('text-blue-600 dark:text-blue-400')
  })

  it('healthy defaults to undefined when not present', () => {
    mockRefs.featureCardsData.value = [
      {
        key: 'feature_card_no_healthy',
        label: 'No Health',
        description: 'No healthy field',
        icon: 'Database',
        iconBg: 'bg-gray-100 dark:bg-gray-900/30',
        iconColor: 'text-gray-600 dark:text-gray-400',
      },
    ]
    const wrapper = mountHome() as any
    const card = wrapper.vm.featureCards.find((c: any) => c.key === 'feature_card_no_healthy')
    expect(card.healthy).toBeUndefined()
  })
})

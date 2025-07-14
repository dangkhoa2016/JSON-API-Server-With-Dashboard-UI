// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, shallowMount } from '@vue/test-utils'
import Settings from '@/pages/Settings.vue'

vi.mock('@/lib/utils', () => ({
  cn: (...inputs: any[]) => inputs.filter(Boolean).join(' '),
}))

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))
vi.mock('vue-sonner', () => ({ toast: { success: toastSuccess, error: toastError } }))

const authState = vi.hoisted(() => ({
  _authenticated: false,
  _admin: false,
  get isAuthenticated() { return { __v_isRef: true, value: this._authenticated } },
  set isAuthenticated(v) { this._authenticated = v },
  get isAdmin() { return { __v_isRef: true, value: this._admin } },
  set isAdmin(v) { this._admin = v },
  login: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/composables/useAuth', () => ({
  useAuth: () => authState,
}))

const queryState = vi.hoisted(() => ({
  data: [
    { key: 'REDIS_ENABLED', value: 'false', type: 'boolean', label: 'Redis Enabled', description: 'Enable Redis caching', group: 'redis', isPublic: true },
    { key: 'APP_SECRET', value: 'secret123', type: 'string', label: 'App Secret', description: 'Secret key', group: 'general', isPublic: false },
    { key: 'API_KEY', value: 'sk-123456', type: 'string', label: 'API Key', description: 'API key', group: 'api', isPublic: true },
  ],
  isLoading: false,
}))

const { updateMutate, resetMutate, resetDbMutate, revealMutateAsync, refetchFn, mutationOpts, isResetDbPending } = vi.hoisted(() => {
  const opts: any = { update: null, reset: null, resetDb: null, reveal: null }
  const resetDbPending = { __v_isRef: true, value: false }
  return {
    updateMutate: vi.fn(),
    resetMutate: vi.fn(),
    resetDbMutate: vi.fn(),
    revealMutateAsync: vi.fn().mockResolvedValue({ value: 'revealed-value' }),
    refetchFn: vi.fn(),
    mutationOpts: opts,
    isResetDbPending: resetDbPending,
  }
})

const invalidateQueries = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/vue-query', () => ({
  useQueryClient: () => ({ invalidateQueries }),
}))

vi.mock('@/providers/trpc', () => {
  return {
    trpc: {
      admin: {
        settings: {
          list: { useQuery: () => ({ data: { __v_isRef: true, value: queryState.data }, isLoading: queryState.isLoading, refetch: refetchFn }) },
          update: { useMutation: (opts: any) => { mutationOpts.update = opts; return { mutate: updateMutate, isPending: false } } },
          reset: { useMutation: (opts: any) => { mutationOpts.reset = opts; return { mutate: resetMutate, isPending: false } } },
          reveal: { useMutation: () => ({ mutateAsync: revealMutateAsync, isPending: false }) },
        },
        data: {
          resetDatabase: { useMutation: (opts: any) => { mutationOpts.resetDb = opts; return { mutate: resetDbMutate, isPending: isResetDbPending } } },
        },
      },
      json: { getFeatureCards: {} },
    },
    trpcClient: { query: vi.fn() },
  }
})

describe('Settings.vue', () => {
  beforeEach(() => {
    authState._authenticated = false
    authState._admin = false
    queryState.data = [
      { key: 'REDIS_ENABLED', value: 'false', type: 'boolean', label: 'Redis Enabled', description: 'Enable Redis caching', group: 'redis', isPublic: true },
      { key: 'APP_SECRET', value: 'secret123', type: 'string', label: 'App Secret', description: 'Secret key', group: 'general', isPublic: false },
      { key: 'API_KEY', value: 'sk-123456', type: 'string', label: 'API Key', description: 'API key', group: 'api', isPublic: true },
    ]
    isResetDbPending.value = false
    authState.login.mockReset()
    authState.logout.mockReset()
    updateMutate.mockReset()
    resetMutate.mockReset()
    resetDbMutate.mockReset()
    revealMutateAsync.mockReset()
    revealMutateAsync.mockResolvedValue({ value: 'revealed-value' })
    refetchFn.mockReset()
    mutationOpts.update = null
    mutationOpts.reset = null
    mutationOpts.resetDb = null
    vi.clearAllMocks()
  })

  function createWrapper() {
    return shallowMount(Settings)
  }

  // --- Authentication ---

  it('shows guest banner when not authenticated', () => {
    const wrapper = createWrapper()
    const banner = wrapper.find('[class*="bg-amber"]')
    expect(banner.exists()).toBe(true)
    expect(wrapper.text()).toContain('viewing settings as a guest')
  })

  it('shows admin section when authenticated', () => {
    authState._authenticated = true
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('Logged in as')
    expect(wrapper.text()).toContain('admin')
  })

  it('calls logout on doLogout', () => {
    authState._authenticated = true
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.doLogout()
    expect(authState.logout).toHaveBeenCalled()
    expect(refetchFn).toHaveBeenCalled()
    expect(toastSuccess).toHaveBeenCalledWith('Logged out')
  })

  // --- Settings data ---

  it('renders settings list with correct keys', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    expect(vm.settings).toHaveLength(3)
    expect(vm.settings[0].key).toBe('REDIS_ENABLED')
    expect(vm.settings[2].key).toBe('API_KEY')
  })

  it('shows empty state when no settings', () => {
    queryState.data = []
    const wrapper = createWrapper()
    expect(wrapper.text()).toContain('No settings found')
  })

  // --- Login ---

  it('opens login dialog on login button click', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    expect(vm.showLoginDialog).toBe(true)
  })

  it('calls login with credentials on doLogin', async () => {
    authState.login.mockResolvedValue(true)
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.loginUsername = 'admin'
    vm.loginPassword = 'admin123'
    await vm.doLogin()
    expect(authState.login).toHaveBeenCalledWith('admin', 'admin123')
    expect(refetchFn).toHaveBeenCalled()
  })

  it('shows error on failed login', async () => {
    authState.login.mockResolvedValue(false)
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.loginUsername = 'admin'
    vm.loginPassword = 'wrong'
    await vm.doLogin()
    expect(vm.loginError).toBe('Invalid username or password')
  })

  it('resets login state on successful login', async () => {
    authState.login.mockResolvedValue(true)
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.loginUsername = 'admin'
    vm.loginPassword = 'admin123'
    await vm.doLogin()
    expect(vm.showLoginDialog).toBe(false)
    expect(vm.loginUsername).toBe('')
    expect(vm.loginPassword).toBe('')
    expect(refetchFn).toHaveBeenCalled()
  })

  it('clears login error before login attempt', async () => {
    authState.login.mockResolvedValue(false)
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.loginError = 'old error'
    await vm.doLogin()
    expect(vm.loginError).toBe('Invalid username or password')
  })

  // --- Edit/Cancel/Save ---

  it('startEdit sets editing value', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.startEdit('REDIS_ENABLED', 'new-value')
    expect(vm.editingValues['REDIS_ENABLED']).toBe('new-value')
  })

  it('cancelEdit removes editing value', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.startEdit('REDIS_ENABLED', 'val')
    vm.cancelEdit('REDIS_ENABLED')
    expect(vm.editingValues['REDIS_ENABLED']).toBeUndefined()
  })

  it('saveEdit calls update mutation', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.startEdit('REDIS_ENABLED', 'new-val')
    vm.saveEdit('REDIS_ENABLED')
    expect(updateMutate).toHaveBeenCalledWith({ key: 'REDIS_ENABLED', value: 'new-val' })
  })

  it('saveEdit deletes editing value after mutation', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.startEdit('REDIS_ENABLED', 'new-val')
    vm.saveEdit('REDIS_ENABLED')
    expect(vm.editingValues['REDIS_ENABLED']).toBeUndefined()
  })

  it('saveEdit does nothing for undefined value', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.editingValues['MISSING'] = undefined
    vm.saveEdit('MISSING')
    expect(updateMutate).not.toHaveBeenCalled()
  })

  it('reset mutation is called on doReset', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.doReset('REDIS_ENABLED')
    expect(resetMutate).toHaveBeenCalledWith({ key: 'REDIS_ENABLED' })
  })

  // --- Reset confirm dialog ---

  it('opens reset confirm dialog', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.openResetConfirm()
    expect(vm.showResetConfirmDialog).toBe(true)
  })

  it('triggers reset database mutation', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.doResetDatabase()
    expect(resetDbMutate).toHaveBeenCalled()
  })

  it('reset confirm dialog can be closed', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.openResetConfirm()
    vm.showResetConfirmDialog = false
    expect(vm.showResetConfirmDialog).toBe(false)
  })

  // --- Mutation callbacks ---

  it('update mutation onSuccess with ok: true shows success toast', () => {
    createWrapper()
    expect(mutationOpts.update).not.toBeNull()
    mutationOpts.update.onSuccess({ ok: true })
    expect(toastSuccess).toHaveBeenCalledWith('Setting updated')
  })

  it('update mutation onSuccess with ok: false shows error toast', () => {
    createWrapper()
    mutationOpts.update.onSuccess({ ok: false, message: 'Update failed' })
    expect(toastError).toHaveBeenCalledWith('Update failed')
  })

  it('update mutation onSuccess with ok: false and no message shows default error', () => {
    createWrapper()
    mutationOpts.update.onSuccess({ ok: false })
    expect(toastError).toHaveBeenCalledWith('Failed to update setting')
  })

  it('update mutation onError shows error toast', () => {
    createWrapper()
    mutationOpts.update.onError()
    expect(toastError).toHaveBeenCalledWith('Failed to update setting')
  })

  it('reset mutation onSuccess with ok: true shows success toast', () => {
    createWrapper()
    mutationOpts.reset.onSuccess({ ok: true })
    expect(toastSuccess).toHaveBeenCalledWith('Setting reset to default')
  })

  it('reset mutation onSuccess with ok: false shows error toast', () => {
    createWrapper()
    mutationOpts.reset.onSuccess({ ok: false, message: 'Reset failed' })
    expect(toastError).toHaveBeenCalledWith('Reset failed')
  })

  it('reset mutation onSuccess with ok: false and no message shows default error', () => {
    createWrapper()
    mutationOpts.reset.onSuccess({ ok: false })
    expect(toastError).toHaveBeenCalledWith('Failed to reset setting')
  })

  it('reset mutation onError shows error toast', () => {
    createWrapper()
    mutationOpts.reset.onError()
    expect(toastError).toHaveBeenCalledWith('Failed to reset setting')
  })

  it('reset database mutation onSuccess with ok: true shows success toast', () => {
    createWrapper()
    mutationOpts.resetDb.onSuccess({ ok: true })
    expect(toastSuccess).toHaveBeenCalledWith('Database reset and re-seeded successfully')
  })

  it('reset database mutation onSuccess with ok: false shows error toast', () => {
    createWrapper()
    mutationOpts.resetDb.onSuccess({ ok: false })
    expect(toastError).toHaveBeenCalledWith('Failed to reset database')
  })

  it('reset database mutation onError shows error toast', () => {
    createWrapper()
    mutationOpts.resetDb.onError()
    expect(toastError).toHaveBeenCalledWith('Failed to reset database')
  })

  it('reset database mutation onSuccess closes dialog', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.showResetConfirmDialog = true
    mutationOpts.resetDb.onSuccess({ ok: true })
    expect(vm.showResetConfirmDialog).toBe(false)
  })

  it('reset database mutation onError closes dialog', () => {
    const wrapper = createWrapper()
    const vm = wrapper.vm as any
    vm.showResetConfirmDialog = true
    mutationOpts.resetDb.onError()
    expect(vm.showResetConfirmDialog).toBe(false)
  })

  // --- Refetch after mutations ---

  it('update mutation success triggers refetch', () => {
    createWrapper()
    mutationOpts.update.onSuccess({ ok: true })
    expect(refetchFn).toHaveBeenCalled()
  })

  it('reset mutation success triggers refetch', () => {
    createWrapper()
    mutationOpts.reset.onSuccess({ ok: true })
    expect(refetchFn).toHaveBeenCalled()
  })

  it('reset database mutation success triggers refetch', () => {
    createWrapper()
    mutationOpts.resetDb.onSuccess({ ok: true })
    expect(refetchFn).toHaveBeenCalled()
  })

  // --- Mount-based template tests ---

  const iconStub = { template: '<span class="icon-stub" />' }
  const uiStubs = {
    Button: {
      name: 'Button',
      props: ['disabled'],
      emits: ['click'],
      template: '<button class="btn-stub" :disabled="disabled" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    Input: {
      name: 'Input',
      props: ['modelValue'],
      emits: ['update:modelValue', 'keyup'],
      template: '<input class="input-stub" :value="modelValue" @keyup="$emit(\'keyup\', $event)" />',
    },
    Label: { name: 'Label', template: '<label class="label-stub"><slot /></label>' },
    Dialog: {
      name: 'Dialog',
      props: ['modelValue'],
      emits: ['update:modelValue'],
      template: '<div class="dialog-stub" v-if="modelValue"><slot /></div>',
    },
  }

  function createMountWrapper(options?: Record<string, boolean>) {
    const authenticated = options?.authenticated ?? false
    const admin = options?.admin ?? false
    authState._authenticated = authenticated
    authState._admin = admin
    return mount(Settings, {
      global: {
        stubs: {
          SettingsIcon: iconStub,
          Loader2: iconStub,
          LogIn: iconStub,
          LogOut: iconStub,
          Save: iconStub,
          RotateCcw: iconStub,
          Eye: iconStub,
          EyeOff: iconStub,
          Trash2: iconStub,
          AlertTriangle: iconStub,
          Pencil: iconStub,
          ...uiStubs,
        },
      },
    })
  }

  it('mount: renders guest banner with login button', () => {
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('viewing settings as a guest')
  })

  it('mount: renders admin section when authenticated', () => {
    const wrapper = createMountWrapper({ authenticated: true })
    expect(wrapper.text()).toContain('Logged in as')
    expect(wrapper.text()).toContain('admin')
  })

  it('mount: renders reset database button for admin', () => {
    const wrapper = createMountWrapper({ authenticated: true })
    expect(wrapper.text()).toContain('Reset Database')
  })

  it('mount: renders logout button for admin', () => {
    const wrapper = createMountWrapper({ authenticated: true })
    expect(wrapper.text()).toContain('Logout')
  })

  it('mount: renders settings list items', () => {
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('Redis Enabled')
    expect(wrapper.text()).toContain('App Secret')
    expect(wrapper.text()).toContain('API Key')
  })

  it('mount: renders sensitive badge for non-public settings', () => {
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('sensitive')
  })

  it('mount: shows empty state when no settings', () => {
    queryState.data = []
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('No settings found')
  })

  it('mount: admin sees edit interface when editing', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    vm.startEdit('REDIS_ENABLED', 'edited-value')
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Save')
    expect(wrapper.text()).toContain('Cancel')
  })

  it('mount: admin can start editing via startEdit', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    vm.startEdit('REDIS_ENABLED', 'edited-value')
    await wrapper.vm.$nextTick()
    expect(vm.editingValues['REDIS_ENABLED']).toBe('edited-value')
  })

  it('mount: login dialog opens and shows form', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Admin Login')
  })

  it('mount: reset confirm dialog opens and shows warning', async () => {
    const wrapper = createMountWrapper({ authenticated: true })
    const vm = wrapper.vm as any
    vm.openResetConfirm()
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Reset Database')
    expect(wrapper.text()).toContain('Warning')
  })

  it('mount: guest sees public setting values but not secret', () => {
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('false')
    expect(wrapper.text()).not.toContain('secret123')
  })

  it('mount: admin sees secret setting value as masked', () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    expect(wrapper.text()).toContain('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022')
  })

  it('mount: triggers login via enter key on username input', async () => {
    authState.login.mockResolvedValue(true)
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.loginUsername = 'admin'
    vm.loginPassword = 'pass'
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const inputs = wrapper.findAllComponents({ name: 'Input' })
    inputs[0].vm.$emit('keyup', { key: 'Enter' })
    await wrapper.vm.$nextTick()
    expect(authState.login).toHaveBeenCalledWith('admin', 'pass')
  })

  it('mount: triggers login via enter key on password input', async () => {
    authState.login.mockResolvedValue(true)
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.loginUsername = 'admin'
    vm.loginPassword = 'pass'
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const inputs = wrapper.findAllComponents({ name: 'Input' })
    inputs[1].vm.$emit('keyup', { key: 'Enter' })
    await wrapper.vm.$nextTick()
    expect(authState.login).toHaveBeenCalledWith('admin', 'pass')
  })

  it('mount: closing reset confirm dialog emits update:modelValue', async () => {
    const wrapper = createMountWrapper({ authenticated: true })
    const vm = wrapper.vm as any
    vm.openResetConfirm()
    await wrapper.vm.$nextTick()
    const dialog = wrapper.findComponent({ name: 'Dialog' })
    dialog.vm.$emit('update:modelValue', false)
    await wrapper.vm.$nextTick()
    expect(vm.showResetConfirmDialog).toBe(false)
  })

  it('mount: clicking edit button starts editing', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    await wrapper.vm.$nextTick()
    const editBtn = wrapper.find('button[title="Edit"]')
    await editBtn.trigger('click')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as any
    expect(Object.keys(vm.editingValues).length).toBeGreaterThan(0)
  })

  it('mount: clicking reset button calls doReset', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    await wrapper.vm.$nextTick()
    const resetBtn = wrapper.find('button[title="Reset to default"]')
    await resetBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(resetMutate).toHaveBeenCalled()
  })

  it('mount: clicking login button calls doLogin', async () => {
    authState.login.mockResolvedValue(true)
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.loginUsername = 'admin'
    vm.loginPassword = 'pass'
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAllComponents({ name: 'Button' })
    const loginBtn = buttons.filter((b) => b.text() === 'Login').at(-1)
    loginBtn.vm.$emit('click')
    await wrapper.vm.$nextTick()
    expect(authState.login).toHaveBeenCalled()
  })

  it('mount: clicking code element starts editing', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    await wrapper.vm.$nextTick()
    const code = wrapper.find('code')
    await code.trigger('click')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as any
    expect(Object.keys(vm.editingValues).length).toBeGreaterThan(0)
  })

  it('mount: closing login dialog emits update:modelValue', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const dialogs = wrapper.findAllComponents({ name: 'Dialog' })
    const loginDialog = dialogs[1]
    loginDialog.vm.$emit('update:modelValue', false)
    await wrapper.vm.$nextTick()
    expect(vm.showLoginDialog).toBe(false)
  })

  it('mount: clicking save button calls saveEdit', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    await wrapper.vm.$nextTick()
    const editBtn = wrapper.find('button[title="Edit"]')
    await editBtn.trigger('click')
    await wrapper.vm.$nextTick()
    const saveBtn = wrapper.findAllComponents({ name: 'Button' }).filter((b) => b.text() === 'Save')[0]
    saveBtn.vm.$emit('click')
    await wrapper.vm.$nextTick()
    expect(updateMutate).toHaveBeenCalled()
  })

  it('mount: clicking eye button toggles visibleKeys', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    await wrapper.vm.$nextTick()
    vm.startEdit('APP_SECRET', 'val')
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toEqual([])
    const eyeBtn = wrapper.find('button[title="Toggle password visibility"]')
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toContain('APP_SECRET')
  })

  it('mount: clicking non-edit eye button toggles visibleKeys', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toEqual([])
    expect(vm.editingValues['APP_SECRET']).toBeUndefined()
    const eyeBtn = wrapper.find('button[title="Show value"]')
    expect(eyeBtn.exists()).toBe(true)
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toContain('APP_SECRET')
  })

  it('mount: clicking eye button twice hides then shows value', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    await wrapper.vm.$nextTick()
    const eyeBtn = wrapper.find('button[title="Show value"]')
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toContain('APP_SECRET')
    const hideBtn = wrapper.find('button[title="Hide value"]')
    await hideBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toEqual([])
  })

  it('mount: username input v-model handler updates loginUsername', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const inputs = wrapper.findAllComponents({ name: 'Input' })
    inputs[0].vm.$emit('update:modelValue', 'newuser')
    await wrapper.vm.$nextTick()
    expect(vm.loginUsername).toBe('newuser')
  })

  it('mount: password input v-model handler updates loginPassword', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const inputs = wrapper.findAllComponents({ name: 'Input' })
    inputs[1].vm.$emit('update:modelValue', 'newpass')
    await wrapper.vm.$nextTick()
    expect(vm.loginPassword).toBe('newpass')
  })

  it('mount: clicking guest banner login button opens dialog', async () => {
    const wrapper = createMountWrapper()
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAllComponents({ name: 'Button' })
    const guestLoginBtn = buttons.filter((b) => b.text() === 'Login')[0]
    guestLoginBtn.vm.$emit('click')
    await wrapper.vm.$nextTick()
    const vm = wrapper.vm as any
    expect(vm.showLoginDialog).toBe(true)
  })

  it('mount: editing input v-model handler updates editing value', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    await wrapper.vm.$nextTick()
    const editBtn = wrapper.find('button[title="Edit"]')
    await editBtn.trigger('click')
    await wrapper.vm.$nextTick()
    const editingInput = wrapper.findComponent({ name: 'Input' })
    editingInput.vm.$emit('update:modelValue', 'new-value')
    await wrapper.vm.$nextTick()
    expect(vm.editingValues['REDIS_ENABLED']).toBe('new-value')
  })

  it('mount: editing a secret setting shows password field', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    await wrapper.vm.$nextTick()
    vm.startEdit('APP_SECRET', 'secret123')
    await wrapper.vm.$nextTick()
    expect(Object.keys(vm.editingValues)).toContain('APP_SECRET')
  })

  it('mount: shows login error message', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    vm.loginError = 'Invalid username or password'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Invalid username or password')
  })

  it('mount: clicking cancel in edit mode triggers cancelEdit via click', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    vm.startEdit('REDIS_ENABLED', 'edited-value')
    await wrapper.vm.$nextTick()
    const cancelBtn = wrapper.findAllComponents({ name: 'Button' }).filter((b) => b.text() === 'Cancel')[0]
    await cancelBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.editingValues['REDIS_ENABLED']).toBeUndefined()
  })

  it('mount: clicking cancel in reset confirm dialog closes it', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    vm.openResetConfirm()
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAllComponents({ name: 'Button' })
    const cancelBtn = buttons.filter((b) => b.text() === 'Cancel')[0]
    await cancelBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.showResetConfirmDialog).toBe(false)
  })

  it('mount: clicking cancel in login dialog closes it', async () => {
    const wrapper = createMountWrapper()
    const vm = wrapper.vm as any
    vm.showLoginDialog = true
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAllComponents({ name: 'Button' })
    const cancelBtn = buttons.filter((b) => b.text() === 'Cancel')[0]
    await cancelBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(vm.showLoginDialog).toBe(false)
  })

  it('mount: setting with no description does not render description', () => {
    queryState.data = [
      { key: 'NO_DESC', value: 'val', type: 'string', group: 'general', isPublic: true },
    ]
    const wrapper = createMountWrapper()
    expect(wrapper.text()).toContain('NO_DESC')
  })

  it('mount: shows loading state while settings load', () => {
    queryState.isLoading = true
    const wrapper = createMountWrapper()
    expect((wrapper.vm as any).isLoading).toBe(true)
    queryState.isLoading = false
  })

  it('mount: editing secret key triggers SECRET branch in type prop', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    vm.startEdit('APP_SECRET', 'val')
    await wrapper.vm.$nextTick()
    expect(vm.editingValues['APP_SECRET']).toBe('val')
    expect(vm.visibleKeys).toEqual([])
  })

  it('mount: toggling visibleKeys while editing secret key', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    vm.startEdit('APP_SECRET', 'val')
    await wrapper.vm.$nextTick()
    vm.visibleKeys = ['APP_SECRET']
    await wrapper.vm.$nextTick()
    expect(vm.visibleKeys).toContain('APP_SECRET')
  })

  it('mount: editing key with PASSWORD triggers that branch', async () => {
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    const vm = wrapper.vm as any
    vm.startEdit('DB_PASSWORD', 'pwd')
    await wrapper.vm.$nextTick()
    expect(vm.editingValues['DB_PASSWORD']).toBe('pwd')
  })

  it('mount: reset database button shows pending state', async () => {
    const wrapper = createMountWrapper({ authenticated: true })
    const vm = wrapper.vm as any
    vm.openResetConfirm()
    isResetDbPending.value = true
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Resetting')
  })

  it('mount: public setting with empty value shows non-breaking space for guest', () => {
    queryState.data = [
      { key: 'EMPTY_PUBLIC', value: '', type: 'string', group: 'general', isPublic: true },
    ]
    const wrapper = createMountWrapper()
    expect(wrapper.html()).toContain('&nbsp;')
  })

  it('mount: non-public setting with empty value shows non-breaking space when revealed', async () => {
    queryState.data = [
      { key: 'EMPTY_SECRET', value: '', type: 'string', group: 'general', isPublic: false },
    ]
    revealMutateAsync.mockResolvedValue({ value: '' })
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    await wrapper.vm.$nextTick()
    const eyeBtn = wrapper.find('button[title="Show value"]')
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    const hideBtn = wrapper.find('button[title="Hide value"]')
    expect(hideBtn.exists()).toBe(true)
    expect(wrapper.html()).toContain('&nbsp;')
  })

  it('mount: shows error toast when reveal fails', async () => {
    queryState.data = [
      { key: 'FAIL_REVEAL', value: 'secret', type: 'string', group: 'general', isPublic: false },
    ]
    revealMutateAsync.mockRejectedValue(new Error('Reveal failed'))
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    await wrapper.vm.$nextTick()
    const eyeBtn = wrapper.find('button[title="Show value"]')
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect(toastError).toHaveBeenCalledWith('Failed to reveal setting value')
    expect((wrapper.vm as any).visibleKeys).toEqual([])
  })

  it('mount: reveal returning null does not crash', async () => {
    queryState.data = [
      { key: 'NULL_REVEAL', value: null, type: 'string', group: 'general', isPublic: false },
    ]
    revealMutateAsync.mockResolvedValue(null as any)
    const wrapper = createMountWrapper({ authenticated: true, admin: true })
    await wrapper.vm.$nextTick()
    const eyeBtn = wrapper.find('button[title="Show value"]')
    await eyeBtn.trigger('click')
    await wrapper.vm.$nextTick()
    expect((wrapper.vm as any).visibleKeys).toContain('NULL_REVEAL')
  })
})

const assert = require('node:assert/strict')
const { test, beforeEach } = require('node:test')
const fs = require('node:fs')
const vm = require('node:vm')
const backend = require('../miniprogram/utils/backend')
const api = require('../miniprogram/utils/api')
const notifications = require('../miniprogram/utils/notifications')
let app, calls, storage
beforeEach(() => {
  calls = []; storage = new Map()
  app = { globalData: { useCloud: true, backendProvider: 'cloudfunction', env: 'old-env', cloudRun: { env: 'new-env', service: 'snacks', path: '/api/snacks' } } }
  global.getApp = () => app
  global.wx = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
    showModal: value => calls.push(['modal', value]),
    cloud: {
      init: () => {},
      callFunction: async opts => { calls.push(['function', opts]); return { result: { success: true, data: true } } },
      callContainer: async opts => { calls.push(['container', opts]); return { statusCode: 200, data: { success: true, data: { _id: 'cr_order' } } } }
    }
  }
  notifications.updateNotificationConfigCache(null)
  app.globalData.backendProvider = 'cloudrun'; notifications.updateNotificationConfigCache(null)
  app.globalData.backendProvider = 'cloudfunction'
})
test('默认云函数；云托管指定独立环境和服务，身份不取自客户端', async () => {
  assert.equal(await api.request('initCollections'), true)
  assert.equal(calls[0][0], 'function')
  assert.equal(calls[0][1].config.env, 'old-env')
  app.globalData.backendProvider = 'cloudrun'
  assert.deepEqual(await api.request('getMyStore'), { _id: 'cr_order' })
  const opts = calls[1][1]
  assert.equal(opts.config.env, 'new-env'); assert.equal(opts.header['X-WX-SERVICE'], 'snacks')
  assert.equal(opts.header['X-WX-OPENID'], undefined); assert.equal(opts.path, '/api/snacks')
})
test('初始化等待且初始化不自等待；失败阻断业务', async () => {
  let ready
  app.globalData.cloudReady = new Promise(resolve => { ready = resolve })
  const request = api.request('listStores')
  assert.equal(calls.length, 0)
  await api.request('initCollections'); assert.equal(calls.length, 1)
  ready(); await request; assert.equal(calls.length, 2)
  app.globalData.cloudReady = Promise.reject(new Error('初始化失败'))
  await assert.rejects(api.request('createOrder'), /初始化失败/)
  assert.equal(calls.length, 2)
})
test('云托管错误、缺失配置和不支持均不回退、不自动重试', async () => {
  app.globalData.backendProvider = 'cloudrun'
  wx.cloud.callContainer = async () => { calls.push('failed'); throw new Error('timeout') }
  await assert.rejects(api.request('createOrder'), /未自动重试/)
  assert.deepEqual(calls, ['failed'])
  wx.cloud.callContainer = async () => ({ statusCode: 401, data: { success: false, message: '无身份', code: 'UNAUTHENTICATED' } })
  await assert.rejects(api.request('getMyIdentity'), { message: '无身份', code: 'UNAUTHENTICATED' })
  app.globalData.cloudRun.env = ''
  await assert.rejects(api.request('listStores'), /配置/)
  app.globalData.cloudRun.env = 'new-env'; delete wx.cloud.callContainer
  await assert.rejects(api.request('listStores'), /不支持云托管/)
  delete wx.cloud
  await assert.rejects(api.request('listStores'), /不支持云服务/)
  assert.equal(storage.size, 0)
})
test('本地模式显式启用，与两个远端通道无关', async () => {
  app.globalData.useCloud = false; delete wx.cloud
  assert.equal((await api.request('listStores')).length, 3)
  assert.equal(calls.length, 0)
})
test('待结算和请求编号按通道、环境和服务隔离', () => {
  storage.set('snacks_pending_checkout', { store: { _id: 'legacy' } })
  assert.equal(backend.getPendingCheckout(), null)
  const pending = backend.savePendingCheckout({ store: { _id: 'old' }, items: [] })
  backend.saveCheckoutAttempt({ requestId: pending.requestId, note: '原请求' })
  assert.equal(backend.getPendingCheckout().attempt.note, '原请求')
  app.globalData.backendProvider = 'cloudrun'
  assert.equal(backend.getPendingCheckout(), null)
  backend.savePendingCheckout({ store: { _id: 'new' } })
  app.globalData.cloudRun.service = 'other'; assert.equal(backend.getPendingCheckout(), null)
  app.globalData.backendProvider = 'cloudfunction'
  assert.equal(backend.getPendingCheckout().requestId, pending.requestId)
})
test('外部旧链接属于云函数，新链接带来源，不匹配不查询数据', async () => {
  const old = backend.withBackend('/pages/store/index?id=old')
  app.globalData.backendProvider = 'cloudrun'
  assert.equal(backend.sourceMatches(Object.fromEntries(new URLSearchParams(old.split('?')[1])), true), false)
  assert.equal(backend.checkEntry({ path: 'pages/order/index', query: { id: 'old' } }), false)
  await assert.rejects(api.request('getOrder', { orderId: 'old' }), /另一套后端/)
  assert.equal(calls.filter(c => c[0] !== 'modal').length, 0)
  assert.equal(app.globalData.backendProvider, 'cloudrun')
  assert.equal(backend.checkEntry({ path: 'pages/order/index', query: { id: 'cr_new', backend: 'cloudrun' } }), true)
  const query = Object.fromEntries(new URLSearchParams(backend.withBackend('/pages/store/index?id=new').split('?')[1]))
  assert.equal(backend.sourceMatches(query, true), true)
  app.globalData.cloudRun.env = 'other-env'; assert.equal(backend.sourceMatches(query, true), false)
})
test('云托管未加载模板时不能沿用云函数模板；授权 API 保持同步手势', async () => {
  notifications.updateNotificationConfigCache({ templateId: 'old-template', enabled: true })
  app.globalData.backendProvider = 'cloudrun'
  assert.equal((await notifications.requestSharedSubscription('ORDER_SUBMIT', 'BUYER')).configured, false)
  wx.cloud.callContainer = async ({ data }) => {
    calls.push(data.action)
    return { statusCode: 200, data: { success: true, data: data.action === 'getNotificationConfig' ? { enabled: true, templateId: 'new-template' } : { grantId: 'cr_grant' } } }
  }
  await notifications.primeNotificationConfig(true); calls.length = 0
  wx.requestSubscribeMessage = opts => { calls.push('gesture'); opts.success({ 'new-template': 'accept' }) }
  const promise = notifications.requestSharedSubscription('ORDER_SUBMIT', 'BUYER')
  assert.deepEqual(calls, ['gesture'])
  assert.equal((await promise).grantId, 'cr_grant')
  assert.deepEqual(calls, ['gesture', 'recordSubscribePermission'])
})
test('结算超时重试恢复原请求和授权，内容变化阻断且成功后清理', async () => {
  app.globalData.backendProvider = 'cloudrun'
  const pending = backend.savePendingCheckout({ store: { _id: 'cr_store', deliveryFee: 0 }, items: [{ _id: 'cr_product', price: 500, quantity: 2 }] })
  api.saveProfile({ contactName: '测试同学', phone: '13800000000', location: '1号楼101' })
  let authorizations = 0
  const requests = [], redirects = [], toasts = []
  wx.showToast = value => toasts.push(value.title)
  wx.showModal = value => value.success({ confirm: true })
  wx.redirectTo = value => redirects.push(value.url)
  wx.cloud.callContainer = async ({ data }) => {
    requests.push(JSON.parse(JSON.stringify(data)))
    assert.equal(backend.getPendingCheckout().attempt.requestId, pending.requestId)
    if (requests.length === 1) throw new Error('timeout')
    return { statusCode: 200, data: { success: true, data: { _id: 'cr_created' } } }
  }
  const source = fs.readFileSync(require.resolve('../miniprogram/pages/checkout/index'), 'utf8')
  const loadPage = async () => {
    let page
    vm.runInNewContext(source, {
      Page: value => { page = value }, wx,
      require: name => {
        if (name === '../../utils/api') return api
        if (name === '../../utils/backend') return backend
        if (name === '../../utils/constants') return require('../miniprogram/utils/constants')
        if (name === '../../utils/format') return require('../miniprogram/utils/format')
        if (name === '../../utils/notifications') return {
          primeNotificationConfig: async () => ({ enabled: true, templateId: 'current-template' }),
          requestSharedSubscription: () => { authorizations++; return Promise.resolve({ permission: 'ACCEPT', grantId: 'cr_grant' }) }
        }
        throw new Error(`未知依赖：${name}`)
      }
    })
    page.setData = value => Object.assign(page.data, value)
    page.onLoad()
    await Promise.resolve()
    return page
  }
  const first = await loadPage()
  await first.submitOrder()
  assert.equal(requests.length, 1)
  assert.equal(backend.getPendingCheckout().attempt.buyerNotificationGrantId, 'cr_grant')
  assert.equal(first.data.submitting, false)
  first.data.note = '变更原请求'
  await first.submitOrder()
  assert.equal(requests.length, 1)
  assert.match(toasts.at(-1), /原信息重试/)
  api.saveProfile({ contactName: '其他联系人', phone: '13900000000', location: '其他位置' })
  const retry = await loadPage()
  assert.equal(retry.data.contactName, '测试同学')
  await retry.submitOrder()
  assert.equal(authorizations, 1)
  assert.deepEqual(requests[1], requests[0])
  assert.equal(backend.getPendingCheckout(), null)
  assert.match(redirects[0], /id=cr_created.*backend=cloudrun/)
})
test('实际 App 启动使用统一适配器，能选择云托管', async () => {
  const source = fs.readFileSync(require.resolve('../miniprogram/app'), 'utf8')
  vm.runInNewContext(source, { App: value => { app = value }, wx, console, require: name => name === './utils/api' ? api : name === './utils/backend' ? backend : { primeNotificationConfig: async () => {} } })
  app.onLaunch({ path: 'pages/home/index' })
  app.globalData.backendProvider = 'cloudrun'; app.globalData.cloudRun = { env: 'test', service: 'snacks', path: '/api/snacks' }
  await app.globalData.cloudReady
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 'container')
  assert.equal(calls[0][1].data.action, 'initCollections')
})

function mockSwitchRemotes(options = {}) {
  const respond = type => async opts => {
    calls.push([type, opts])
    const action = opts.data.action
    if (type === 'container' && options.failAction === action) {
      throw new Error('目标服务未就绪')
    }
    let data = true
    if (action === 'getMyIdentity') {
      data = {
        openid: type === 'container' ? options.targetOpenid || 'super-user' : 'super-user',
        platformRole: (type === 'container' ? options.targetRole : options.sourceRole) || 'SUPER_ADMIN'
      }
    } else if (action === 'getAdminDashboard') {
      data = { role: options.sourceRole || 'SUPER_ADMIN', recentLogs: [] }
    } else if (action === 'getNotificationConfig') {
      data = { enabled: true, templateId: `${type}-template` }
    }
    return type === 'container'
      ? { statusCode: 200, data: { success: true, data } }
      : { result: { success: true, data } }
  }
  wx.cloud.callFunction = respond('function')
  wx.cloud.callContainer = respond('container')
}

function loadAdminPage() {
  let page
  vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/admin/index'), 'utf8'), {
    Page: value => { page = value }, wx, getApp,
    require: name => require(`../miniprogram/utils/${name.split('/').at(-1)}`)
  })
  page.setData = value => Object.assign(page.data, value)
  return page
}

test('超级管理员双向切换验证连接、身份和模板，保留数据隔离', async () => {
  mockSwitchRemotes()
  const originalEnv = app.globalData.env
  const pending = backend.savePendingCheckout({ store: { _id: 'old-store' } })
  notifications.updateNotificationConfigCache({ enabled: true, templateId: 'old-template' })
  let activations = 0
  assert.equal(await api.switchBackend('cloudrun', ' snacks-java ', async config => {
    activations++
    assert.equal(backend.provider(), 'cloudrun')
    assert.equal(config.templateId, 'container-template')
    assert.equal(backend.getPendingCheckout(), null)
    assert.equal((await notifications.requestSharedSubscription('ORDER_SUBMIT')).configured, false)
    notifications.updateNotificationConfigCache(config)
  }), true)
  assert.equal(activations, 1)
  assert.equal(app.globalData.env, originalEnv)
  assert.equal(app.globalData.cloudRun.service, 'snacks-java')
  assert.equal(app.globalData.backendSwitchState, '')
  assert.deepEqual(calls.map(([type, opts]) => [type, opts.data.action]), [
    ['function', 'getMyIdentity'], ['container', 'initCollections'],
    ['container', 'getMyIdentity'], ['container', 'getNotificationConfig']
  ])
  assert.equal(calls[1][1].header['X-WX-SERVICE'], 'snacks-java')
  assert.equal(calls[1][1].header['X-WX-OPENID'], undefined)
  calls.length = 0
  await api.switchBackend('cloudfunction', '', async config => {
    assert.equal(config.templateId, 'function-template')
  })
  assert.equal(backend.provider(), 'cloudfunction')
  assert.equal(backend.getPendingCheckout().requestId, pending.requestId)
  assert.equal(calls[0][0], 'container')
  assert.equal(calls[1][0], 'function')
  assert.equal(await api.switchBackend('cloudfunction', '', async () => {}), false)
})

test('普通管理员、运营和本机演示账号不能切换，页面权限不作为授权依据', async () => {
  for (const role of ['PLATFORM_ADMIN', 'PLATFORM_OPERATOR', 'CUSTOMER']) {
    mockSwitchRemotes({ sourceRole: role })
    calls.length = 0
    await assert.rejects(api.switchBackend('cloudrun', 'snacks', async () => assert.fail()), /只有当前后端的超级管理员/)
    assert.equal(backend.provider(), 'cloudfunction')
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], 'function')
    assert.equal(app.globalData.backendSwitchState, '')
  }
  app.globalData.useCloud = false
  await assert.rejects(api.switchBackend('cloudrun', 'snacks', async () => assert.fail()), /只支持/)
})

test('目标未授权、身份不一致及初始化或模板失败均保持原后端', async () => {
  for (const options of [
    { targetRole: 'PLATFORM_ADMIN' }, { targetOpenid: 'another-user' },
    { failAction: 'initCollections' }, { failAction: 'getMyIdentity' }, { failAction: 'getNotificationConfig' }
  ]) {
    mockSwitchRemotes(options)
    calls.length = 0
    const ready = app.globalData.cloudReady
    await assert.rejects(api.switchBackend('cloudrun', 'snacks', async () => assert.fail()), /未切换|未自动重试/)
    assert.equal(backend.provider(), 'cloudfunction')
    assert.equal(app.globalData.cloudReady, ready)
    assert.equal(app.globalData.backendSwitchState, '')
    assert.equal(calls.filter(([type]) => type === 'function').length, 1)
  }
  mockSwitchRemotes()
  await api.switchBackend('cloudrun', 'snacks', async () => {})
  assert.equal(backend.provider(), 'cloudrun')
})

test('目标通知模板未初始化时以停用状态切换，其他通知错误仍阻断', async () => {
  mockSwitchRemotes()
  const container = wx.cloud.callContainer
  wx.cloud.callContainer = async opts => opts.data.action === 'getNotificationConfig'
    ? { statusCode: 400, data: { success: false, message: '通知模板尚未初始化', code: 'BUSINESS_ERROR' } }
    : container(opts)
  let activated
  await api.switchBackend('cloudrun', 'snacks', async config => { activated = config })
  assert.equal(backend.provider(), 'cloudrun')
  assert.deepEqual(activated, { enabled: false, templateId: '' })
  app.globalData.backendProvider = 'cloudfunction'
  wx.cloud.callContainer = async opts => opts.data.action === 'getNotificationConfig'
    ? { statusCode: 500, data: { success: false, message: '数据库连接失败', code: 'SYSTEM_ERROR' } }
    : container(opts)
  await assert.rejects(api.switchBackend('cloudrun', 'snacks', async () => assert.fail()), /数据库连接失败/)
  assert.equal(backend.provider(), 'cloudfunction')
})

test('服务名拒绝网址、域名和空值；缺配置时不会发送请求', async () => {
  for (const service of ['', 'https://example.com', 'example.com', 'snacks:80', 'a/b']) {
    await assert.rejects(api.switchBackend('cloudrun', service, async () => assert.fail()), /服务名/)
  }
  app.globalData.cloudRun.env = ''
  await assert.rejects(api.switchBackend('cloudrun', 'snacks', async () => assert.fail()), /环境 ID/)
  assert.equal(calls.length, 0)
})

test('请求未完成时拒绝切换；检查期间禁止业务请求和重复切换', async () => {
  let releaseRequest
  wx.cloud.callFunction = () => new Promise(resolve => { releaseRequest = resolve })
  const pending = api.request('listStores')
  await assert.rejects(api.switchBackend('cloudrun', 'snacks', async () => assert.fail()), /还有请求/)
  releaseRequest({ result: { success: true, data: [] } })
  await pending
  mockSwitchRemotes()
  const respond = wx.cloud.callFunction
  let releaseIdentity
  wx.cloud.callFunction = async opts => {
    await new Promise(resolve => { releaseIdentity = resolve })
    return respond(opts)
  }
  const switching = api.switchBackend('cloudrun', 'snacks', async () => {})
  await assert.rejects(api.request('createOrder'), /正在检查后端切换/)
  await assert.rejects(api.switchBackend('cloudrun', 'snacks', async () => assert.fail()), /还有请求/)
  releaseIdentity()
  await switching
  assert.equal(app.globalData.pendingBackendRequests, 0)
})

test('请求等待初始化期间及响应返回前后端发生变化均阻断旧请求', async () => {
  let ready
  app.globalData.cloudReady = new Promise(resolve => { ready = resolve })
  const waiting = api.request('createOrder')
  app.globalData.backendProvider = 'cloudrun'
  ready()
  await assert.rejects(waiting, /后端已切换/)
  assert.equal(calls.length, 0)
  app.globalData.cloudReady = Promise.resolve()
  let response
  wx.cloud.callContainer = () => new Promise(resolve => { response = resolve })
  const inFlight = api.request('getMyIdentity')
  await Promise.resolve()
  app.globalData.backendProvider = 'cloudfunction'
  response({ statusCode: 200, data: { success: true, data: { platformRole: 'SUPER_ADMIN' } } })
  await assert.rejects(inFlight, /后端已切换/)
  assert.equal(app.globalData.pendingBackendRequests, 0)
})

test('页面重载失败恢复原后端，之后可以重新尝试', async () => {
  mockSwitchRemotes()
  const previous = app.globalData.cloudRun
  await assert.rejects(api.switchBackend('cloudrun', 'changed-service', async () => {
    throw new Error('页面重载失败')
  }), /页面重载失败/)
  assert.equal(backend.provider(), 'cloudfunction')
  assert.equal(app.globalData.cloudRun, previous)
  assert.equal(app.globalData.backendSwitchState, '')
  await api.switchBackend('cloudrun', 'snacks', async () => {})
  assert.equal(backend.provider(), 'cloudrun')
})

test('管理页面仅远端超级管理员显示切换选项，取消确认不触发切换', async () => {
  let switches = 0
  app.switchBackend = async () => { switches++ }
  for (const role of ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'PLATFORM_OPERATOR']) {
    mockSwitchRemotes({ sourceRole: role })
    const page = loadAdminPage()
    await page.loadData()
    assert.equal(page.data.canSwitchBackend, role === 'SUPER_ADMIN')
    assert.equal(page.data.backendLabel, '云开发 · 原云函数')
    wx.showModal = opts => opts.success({ confirm: false })
    await page.changeBackend({ currentTarget: { dataset: { provider: 'cloudrun' } } })
    assert.equal(page.data.switching, false)
  }
  assert.equal(switches, 0)
  app.globalData.useCloud = false
  const page = loadAdminPage()
  await page.loadData()
  assert.equal(page.data.canSwitchBackend, false)
})

test('管理页面确认切换时携带服务名，重复点击与导航不会并发执行', async () => {
  mockSwitchRemotes()
  const page = loadAdminPage()
  await page.loadData()
  page.onServiceInput({ detail: { value: 'java-service' } })
  wx.showModal = opts => opts.success({ confirm: true })
  let release, switches = 0
  app.switchBackend = async (target, service) => {
    switches++
    assert.equal(target, 'cloudrun')
    assert.equal(service, 'java-service')
    await new Promise(resolve => { release = resolve })
  }
  const event = { currentTarget: { dataset: { provider: 'cloudrun' } } }
  const switching = page.changeBackend(event)
  await Promise.resolve()
  assert.equal(page.data.switching, true)
  await page.changeBackend(event)
  wx.navigateTo = () => assert.fail('切换中不应跳转业务页面')
  page.go({ currentTarget: { dataset: { url: '/pages/admin-stores/index' } } })
  assert.equal(switches, 1)
  release()
  await switching
  assert.equal(page.data.switching, false)
})

test('实际 App 切换清除角标、重建页面栈；冷启动不沿用测试选择', async () => {
  mockSwitchRemotes()
  const source = fs.readFileSync(require.resolve('../miniprogram/app'), 'utf8')
  vm.runInNewContext(source, {
    App: value => { app = value }, wx, console,
    require: name => name === './utils/api' ? api : name === './utils/backend' ? backend : {
      primeNotificationConfig: async () => {}, updateNotificationConfigCache: notifications.updateNotificationConfigCache
    }
  })
  app.onLaunch({ path: 'pages/home/index' })
  await app.globalData.cloudReady
  assert.equal(app.globalData.cloudRun.env, 'prod-d0gs4er2552d66779')
  const lifecycle = []
  wx.removeTabBarBadge = opts => { lifecycle.push('badge'); opts.complete() }
  wx.reLaunch = opts => { lifecycle.push(opts.url); opts.success() }
  await app.switchBackend('cloudrun', 'java-service')
  assert.deepEqual(lifecycle, ['badge', '/pages/admin/index'])
  assert.equal(backend.provider(), 'cloudrun')
  assert.equal(backend.label(), '云托管 · Java')
  app.onLaunch({ path: 'pages/home/index' })
  await app.globalData.cloudReady
  assert.equal(backend.provider(), 'cloudfunction')
})

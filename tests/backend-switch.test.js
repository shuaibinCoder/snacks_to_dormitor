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
test('已就绪会话按选中的通道请求，云托管身份不取自客户端', async () => {
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
  await api.initializeBackend(app.globalData); assert.equal(calls.length, 1)
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
    await page.onLoad()
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
test('响应返回前会话被意外改变时拒绝旧响应且不重发', async () => {
  let release
  wx.cloud.callFunction = () => new Promise(resolve => { release = resolve })
  const pending = api.request('getMyIdentity')
  app.globalData.backendProvider = 'cloudrun'
  release({ result: { success: true, data: {} } })
  await assert.rejects(pending, /后端已切换/)
  assert.equal(app.globalData.pendingBackendRequests, 0)
})

const path = require('node:path')
const root = path.resolve(__dirname, '../miniprogram')
const tick = () => new Promise(resolve => setImmediate(resolve))
const event = provider => ({ currentTarget: { dataset: { provider } } })

// 独立加载真实 App/Page；每台设备的模块、存储、身份和通知缓存互不共享。
function client({ role = 'SUPER_ADMIN', storage = new Map() } = {}) {
  let instance, page
  const modules = new Map()
  const c = { calls: [], modals: [], actions: [], errors: [], storage, hook: null, role }
  const request = async (kind, opts) => {
    c.calls.push({ kind, opts })
    if (kind === 'container') {
      assert.equal(opts.path, '/api/snacks')
      assert.equal(opts.method, 'POST')
      assert.equal(opts.config.env, 'prod-d0gs4er2552d66779')
      assert.equal(opts.header['X-WX-SERVICE'], 'springboot-7j2n')
      assert.equal(opts.header['X-WX-OPENID'], undefined)
    }
    if (c.hook) {
      const result = await c.hook(kind, opts)
      if (result !== undefined) return result
    }
    let data = []
    switch (opts.data.action) {
      case 'initCollections': data = true; break
      case 'getMyIdentity': data = { openid: 'same-user', platformRole: c.role }; break
      case 'getAdminDashboard': data = { role: c.role, recentLogs: [] }; break
      case 'getNotificationConfig': data = { enabled: false, templateId: '' }; break
      case 'getUnreadNotificationCount': data = { total: 0 }; break
    }
    return kind === 'container' ? { statusCode: 200, data: { success: true, data } } : { result: { success: true, data } }
  }
  c.wx = {
    getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: key => storage.delete(key),
    cloud: { init: () => {}, callContainer: opts => request('container', opts), callFunction: opts => request('function', opts) },
    showModal: opts => {
      c.modals.push(opts)
      assert.ok([...(opts.confirmText || '确定')].length <= 4)
      if (opts.success) opts.success({ confirm: !!c.confirm })
    },
    showToast: opts => c.actions.push(['toast', opts.title]),
    reLaunch: opts => { c.actions.push(['reLaunch', opts.url]); if (opts.success) opts.success() },
    navigateTo: opts => c.actions.push(['navigateTo', opts.url]),
    removeTabBarBadge: opts => { if (opts.complete) opts.complete() },
    stopPullDownRefresh: () => {}
  }
  function load(file) {
    const resolved = path.resolve(root, file.endsWith('.js') ? file : `${file}.js`)
    if (modules.has(resolved)) return modules.get(resolved).exports
    const module = { exports: {} }
    modules.set(resolved, module)
    vm.runInNewContext(fs.readFileSync(resolved, 'utf8'), {
      module, exports: module.exports, wx: c.wx, getApp: () => instance,
      App: value => { instance = value }, Page: value => { page = value },
      console: { error: (...args) => c.errors.push(args), warn: (...args) => c.errors.push(args) },
      setTimeout, clearTimeout,
      require: name => load(path.relative(root, path.resolve(path.dirname(resolved), name)))
    }, { filename: resolved })
    return module.exports
  }
  load('app')
  Object.assign(c, { app: instance, api: load('utils/api'), backend: load('utils/backend'), notifications: load('utils/notifications') })
  c.start = async (options = { path: 'pages/home/index' }) => {
    instance.onLaunch(options)
    instance.onShow(options)
    await instance.globalData.cloudReady
    await tick()
  }
  c.page = name => {
    modules.delete(path.resolve(root, `pages/${name}/index.js`))
    load(`pages/${name}/index`)
    page.setData = value => Object.assign(page.data, value)
    return page
  }
  c.switchTo = async provider => {
    const admin = c.page('admin')
    await admin.loadData()
    c.confirm = true
    await admin.changeBackend(event(provider))
    return admin
  }
  return c
}

test('默认 Java，本机按钮双向切换；其他设备不变，热启动保留、冷启动恢复 Java', async () => {
  const a = client(), b = client()
  await Promise.all([a.start(), b.start()])
  assert.equal(a.backend.provider(), 'cloudrun')
  assert.ok(a.calls.every(call => call.kind === 'container'))
  const before = new Map([...a.storage].map(([key, value]) => [key, JSON.stringify(value)]))
  await a.switchTo('cloudfunction')
  assert.equal(a.backend.provider(), 'cloudfunction')
  assert.equal(b.backend.provider(), 'cloudrun')
  for (const [key, value] of before) assert.equal(JSON.stringify(a.storage.get(key)), value)
  // 只允许新增目标通道的通知缓存，不能写入持久化后端选择。
  for (const key of a.storage.keys()) {
    if (!before.has(key)) assert.ok(key.startsWith('snacks_notification_config_cache_v2:'))
  }
  assert.equal(a.actions.at(-1)[0], 'reLaunch')
  await a.api.request('listStores'); assert.equal(a.calls.at(-1).kind, 'function')
  a.app.onShow({ path: 'pages/profile/index', scene: 1007 })
  assert.equal(a.backend.provider(), 'cloudfunction')
  const panel = a.page('admin'); await panel.loadData()
  assert.equal(panel.data.backendProvider, 'cloudfunction')
  await a.switchTo('cloudrun')
  assert.equal(a.backend.provider(), 'cloudrun')
  await a.switchTo('cloudfunction')
  await a.start()
  assert.equal(a.backend.provider(), 'cloudrun')
  const restarted = client({ storage: a.storage }); await restarted.start()
  assert.equal(restarted.backend.provider(), 'cloudrun')
})

test('当前角色非超级管理员不显示切换；绕过页面也不能切换', async () => {
  const c = client({ role: 'PLATFORM_ADMIN' }); await c.start()
  const admin = c.page('admin'); await admin.loadData()
  assert.equal(admin.data.canSwitchBackend, false)
  c.confirm = true; await admin.changeBackend(event('cloudfunction'))
  await assert.rejects(c.app.switchBackend('cloudfunction'), /只有当前后端的超级管理员/)
  assert.equal(c.backend.provider(), 'cloudrun')
  assert.equal(c.calls.some(call => call.kind === 'function'), false)
})

test('目标无超级管理员权限或身份不一致时保留原后端', async () => {
  for (const identity of [{ openid: 'same-user', platformRole: null }, { openid: 'another-user', platformRole: 'SUPER_ADMIN' }]) {
    const c = client(); await c.start()
    c.hook = (kind, opts) => kind === 'function' && opts.data.action === 'getMyIdentity'
      ? { result: { success: true, data: identity } } : undefined
    await c.switchTo('cloudfunction')
    assert.equal(c.backend.provider(), 'cloudrun')
    assert.match(c.modals.at(-1).content, /目标后端/)
    assert.equal(c.actions.some(action => action[0] === 'reLaunch'), false)
  }
})

test('取消确认、确认框 SDK 错误均不请求目标；显示 errMsg 与错误码', async () => {
  const c = client(); await c.start()
  const admin = c.page('admin'); await admin.loadData()
  let count = c.calls.length
  await admin.changeBackend(event('cloudfunction'))
  assert.equal(c.calls.length, count)
  assert.equal(admin.data.switching, false)
  c.wx.showModal = opts => {
    c.modals.push(opts)
    if (opts.fail) opts.fail({ errMsg: 'showModal:fail SDK错误', errCode: 0 })
  }
  await admin.changeBackend(event('cloudfunction'))
  assert.equal(c.calls.length, count)
  assert.match(c.modals.at(-1).content, /显示切换确认框.*SDK错误.*0/)
})

test('检查过程中防重复点击和新请求，有在途业务请求时不能切换', async () => {
  const c = client(); await c.start()
  let release
  c.hook = (kind, opts) => opts.data.action === 'listStores' ? new Promise(resolve => { release = resolve }) : undefined
  const pending = c.api.request('listStores'); await tick()
  await assert.rejects(c.app.switchBackend('cloudfunction'), /还有请求/)
  release({ statusCode: 200, data: { success: true, data: [] } }); await pending
  c.hook = (kind, opts) => kind === 'function' && opts.data.action === 'initCollections'
    ? new Promise(resolve => { release = resolve }) : undefined
  const admin = c.page('admin'); await admin.loadData(); c.confirm = true
  const changing = admin.changeBackend(event('cloudfunction')); await tick()
  const count = c.calls.length
  await admin.changeBackend(event('cloudfunction'))
  await assert.rejects(c.api.request('createOrder'), /正在检查后端切换/)
  assert.equal(c.calls.length, count)
  release({ result: { success: true, data: true } }); await changing
  assert.equal(c.backend.provider(), 'cloudfunction')
  assert.equal(c.app.globalData.backendSwitchState, '')
})

test('目标连接失败或返回 HTML 保留原后端，不自动回退或重发', async () => {
  for (const response of [null, { statusCode: 502, data: '<html>bad gateway</html>' }]) {
    const c = client(); await c.start(); await c.switchTo('cloudfunction')
    c.hook = kind => {
      if (kind !== 'container') return
      if (response) return response
      throw { errMsg: 'callContainer:fail timeout', errCode: -501 }
    }
    await c.switchTo('cloudrun')
    assert.equal(c.backend.provider(), 'cloudfunction')
    assert.match(c.modals.at(-1).content, response ? /格式不正确/ : /timeout.*501/)
    assert.equal(c.app.globalData.backendSwitchState, '')
  }
})

test('目标通知模板缺失可切换但不借用旧模板；其他通知错误阻断切换', async () => {
  for (const message of ['通知模板尚未初始化', '通知服务异常']) {
    const c = client(); await c.start(); await c.switchTo('cloudfunction')
    c.notifications.updateNotificationConfigCache({ enabled: true, templateId: 'old-template' })
    c.hook = (kind, opts) => kind === 'container' && opts.data.action === 'getNotificationConfig'
      ? { statusCode: 200, data: { success: false, message } } : undefined
    await c.switchTo('cloudrun')
    assert.equal(c.backend.provider(), message === '通知模板尚未初始化' ? 'cloudrun' : 'cloudfunction')
    if (message === '通知模板尚未初始化') {
      assert.equal((await c.notifications.requestSharedSubscription('ORDER_SUBMIT', 'BUYER')).configured, false)
    }
  }
})

test('页面重载失败恢复原后端与通知命名空间', async () => {
  const c = client(); await c.start()
  c.notifications.updateNotificationConfigCache({ enabled: true, templateId: 'java-template' })
  c.wx.reLaunch = opts => opts.fail({ errMsg: 'reLaunch:fail' })
  await c.switchTo('cloudfunction')
  assert.equal(c.backend.provider(), 'cloudrun')
  assert.match(c.modals.at(-1).content, /页面重载失败.*恢复原后端/)
  assert.equal(c.app.globalData.backendSwitchState, '')
  let called = false
  c.wx.requestSubscribeMessage = opts => { called = true; assert.equal(opts.tmplIds[0], 'java-template'); opts.success({ 'java-template': 'reject' }) }
  await c.notifications.requestSharedSubscription('ORDER_SUBMIT', 'BUYER')
  assert.equal(called, true)
})

test('Java 启动失败阻断业务且不回退，主动重试不会重发原下单', async () => {
  const c = client()
  c.hook = () => { throw { errMsg: 'callContainer:fail timeout' } }
  c.app.onLaunch()
  await assert.rejects(c.api.request('createOrder'), /timeout/)
  await tick()
  assert.equal(c.app.globalData.startupState, 'failed')
  assert.equal(c.backend.provider(), 'cloudrun')
  assert.equal(c.calls.length, 1)
  c.hook = null
  await c.app.startBackend(true); await tick()
  assert.equal(c.app.globalData.startupState, 'ready')
  assert.equal(c.calls.some(call => call.opts.data.action === 'createOrder'), false)
})

test('普通页面恢复不误判旧库，图片等待启动并仍使用原云存储', async () => {
  const c = client(); let release, uploaded
  c.wx.cloud.init = () => new Promise(resolve => { release = resolve })
  c.wx.cloud.uploadFile = async opts => { uploaded = opts; return { fileID: 'cloud://original/image' } }
  c.app.onLaunch({ path: 'pages/profile/index', scene: 1007 })
  const image = c.api.uploadProductImage('/tmp/product.png')
  await tick(); assert.equal(uploaded, undefined)
  release(); assert.equal(await image, 'cloud://original/image')
  assert.equal(uploaded.config.env, 'smooth-kiwi-d3gjwm74v84784b65')
  assert.equal(c.app.globalData.backendEntryError, '')
  c.app.onShow({ path: 'pages/admin/index', scene: 1007 })
  assert.equal(c.app.globalData.backendEntryError, '')
})

test('未读数失败不隐藏当前业务管理员身份', async () => {
  const c = client(); await c.start()
  c.hook = (kind, opts) => {
    if (opts.data.action === 'getUnreadNotificationCount') throw new Error('未读数失败')
  }
  const profile = c.page('profile'); await profile.loadData(); await tick()
  assert.equal(profile.data.identity.platformRole, 'SUPER_ADMIN')
  assert.equal(profile.data.unreadCount, 0)
  assert.equal(profile.data.backendLabel, '云托管 · Java')
})

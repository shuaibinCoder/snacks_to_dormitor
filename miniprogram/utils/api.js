const { PRODUCT_EMOJIS } = require('./constants')

const KEYS = {
  stores: 'snacks_mvp_stores',
  products: 'snacks_mvp_products',
  orders: 'snacks_mvp_orders',
  myStoreId: 'snacks_mvp_my_store_id',
  profile: 'snacks_mvp_profile',
  application: 'snacks_mvp_merchant_application',
  platformUsers: 'snacks_mvp_platform_users',
  notifications: 'snacks_mvp_notifications',
  notificationPreference: 'snacks_mvp_notification_preference',
  notificationTemplate: 'snacks_mvp_notification_template'
}

const now = () => Date.now()
const clone = data => JSON.parse(JSON.stringify(data))
const id = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

const seedStores = [
  {
    _id: 'store_demo_1',
    name: '阿豪的深夜补给站',
    logoEmoji: '🦊',
    notice: '晚上熄灯也不怕，泡面饮料送到门口～',
    ownerName: '阿豪',
    phone: '13800000001',
    businessHours: '19:00 - 00:30',
    deliveryMinutes: 12,
    minimumOrder: 500,
    deliveryFee: 0,
    rating: 4.9,
    monthlySales: 126,
    isOpen: true,
    auditStatus: 'APPROVED',
    createdAt: now() - 86400000 * 30
  },
  {
    _id: 'store_demo_2',
    name: '琪琪零食铺',
    logoEmoji: '🐰',
    notice: '薯片、巧克力、牛奶都有，22点后可送',
    ownerName: '琪琪',
    phone: '13800000002',
    businessHours: '20:00 - 23:50',
    deliveryMinutes: 18,
    minimumOrder: 0,
    deliveryFee: 100,
    rating: 4.8,
    monthlySales: 88,
    isOpen: true,
    auditStatus: 'APPROVED',
    createdAt: now() - 86400000 * 18
  },
  {
    _id: 'store_demo_3',
    name: '307应急杂货箱',
    logoEmoji: '🐻',
    notice: '泡面、纸巾、数据线，急用来搜我',
    ownerName: '小陈',
    phone: '13800000003',
    businessHours: '18:30 - 23:30',
    deliveryMinutes: 15,
    minimumOrder: 300,
    deliveryFee: 0,
    rating: 4.7,
    monthlySales: 54,
    isOpen: false,
    auditStatus: 'APPROVED',
    createdAt: now() - 86400000 * 9
  }
]

const seedProducts = [
  { _id: 'p_1', storeId: 'store_demo_1', category: '饮料', name: '冰镇可乐 500ml', price: 350, stock: 16, sold: 42, emoji: '🥤', status: 'ON' },
  { _id: 'p_2', storeId: 'store_demo_1', category: '泡面', name: '红烧牛肉面', price: 550, stock: 12, sold: 35, emoji: '🍜', status: 'ON' },
  { _id: 'p_3', storeId: 'store_demo_1', category: '零食', name: '原味薯片', price: 650, stock: 8, sold: 27, emoji: '🥔', status: 'ON' },
  { _id: 'p_4', storeId: 'store_demo_1', category: '零食', name: '巧克力威化', price: 450, stock: 20, sold: 18, emoji: '🍫', status: 'ON' },
  { _id: 'p_5', storeId: 'store_demo_1', category: '日用', name: '便携纸巾', price: 200, stock: 30, sold: 16, emoji: '🧻', status: 'ON' },
  { _id: 'p_6', storeId: 'store_demo_2', category: '零食', name: '海盐小饼干', price: 500, stock: 12, sold: 23, emoji: '🍪', status: 'ON' },
  { _id: 'p_7', storeId: 'store_demo_2', category: '饮料', name: '纯牛奶 250ml', price: 380, stock: 10, sold: 20, emoji: '🥛', status: 'ON' },
  { _id: 'p_8', storeId: 'store_demo_2', category: '零食', name: '水果软糖', price: 600, stock: 5, sold: 19, emoji: '🍬', status: 'ON' },
  { _id: 'p_9', storeId: 'store_demo_3', category: '日用', name: 'Type-C 数据线', price: 1500, stock: 3, sold: 7, emoji: '🔌', status: 'ON' },
  { _id: 'p_10', storeId: 'store_demo_3', category: '泡面', name: '酸菜牛肉面', price: 550, stock: 9, sold: 11, emoji: '🍜', status: 'ON' }
]

function initLocalData() {
  if (!wx.getStorageSync(KEYS.stores)) wx.setStorageSync(KEYS.stores, seedStores)
  if (!wx.getStorageSync(KEYS.products)) wx.setStorageSync(KEYS.products, seedProducts)
  if (!wx.getStorageSync(KEYS.orders)) wx.setStorageSync(KEYS.orders, [])
  if (!wx.getStorageSync(KEYS.notifications)) wx.setStorageSync(KEYS.notifications, [])
  if (!wx.getStorageSync(KEYS.profile)) {
    wx.setStorageSync(KEYS.profile, { nickname: '同学', phone: '', contactName: '', location: '' })
  }
}

function cloudEnabled() {
  try {
    const app = getApp()
    return !!(app.globalData && app.globalData.useCloud && wx.cloud)
  } catch (e) {
    return false
  }
}

async function request(action, data = {}) {
  if (cloudEnabled()) {
    let response
    try {
      const app = getApp()
      if (action !== 'initCollections' && app.globalData.cloudReady) await app.globalData.cloudReady
      response = await wx.cloud.callFunction({ name: 'snacksApi', data: { action, ...data } })
    } catch (error) {
      console.error(`Cloud action failed: ${action}`, error)
      const message = error && error.errMsg && error.errMsg.includes('FunctionName')
        ? '云函数 snacksApi 未部署或部署到了其他环境'
        : '云服务连接失败，请检查云环境与云函数部署'
      throw new Error(message)
    }
    if (response.result && response.result.success) return response.result.data
    throw new Error((response.result && response.result.message) || `云服务请求失败：${action}`)
  }
  return localRequest(action, data)
}

function localRequest(action, data) {
  initLocalData()
  let stores = wx.getStorageSync(KEYS.stores) || []
  let products = wx.getStorageSync(KEYS.products) || []
  let orders = wx.getStorageSync(KEYS.orders) || []

  switch (action) {
    case 'getNotificationConfig': {
      const template = wx.getStorageSync(KEYS.notificationTemplate) || { templateId: '', enabled: false }
      return { templateKey: 'SHARED_BUSINESS_NOTICE', templateId: template.templateId || '', enabled: !!template.enabled, keyLabel: '统一业务状态通知模板' }
    }
    case 'recordSubscribePermission': {
      const preference = { permission: data.permission, scene: data.scene, updatedAt: now() }
      wx.setStorageSync(KEYS.notificationPreference, preference)
      return clone(preference)
    }
    case 'listNotifications': {
      let list = wx.getStorageSync(KEYS.notifications) || []
      if (data.category && data.category !== 'ALL') list = list.filter(item => item.category === data.category)
      return clone(list.sort((a, b) => b.createdAt - a.createdAt))
    }
    case 'getUnreadNotificationCount': {
      const unread = (wx.getStorageSync(KEYS.notifications) || []).filter(item => item.readStatus === 'UNREAD')
      return { total: unread.length, categories: {} }
    }
    case 'markNotificationRead': {
      const list = wx.getStorageSync(KEYS.notifications) || []
      const index = list.findIndex(item => item._id === data.notificationId)
      if (index >= 0) { list[index].readStatus = 'READ'; list[index].readStatusLabel = '已读'; list[index].readAt = now(); wx.setStorageSync(KEYS.notifications, list) }
      return true
    }
    case 'markAllNotificationsRead': {
      const list = (wx.getStorageSync(KEYS.notifications) || []).map(item => Object.assign({}, item, { readStatus: 'READ', readStatusLabel: '已读', readAt: now() }))
      wx.setStorageSync(KEYS.notifications, list)
      return true
    }
    case 'getNotificationAdminConfig':
      return clone(wx.getStorageSync(KEYS.notificationTemplate) || { _id: 'SHARED_BUSINESS_NOTICE', templateId: '', enabled: false, fields: { titleKey: 'thing1', statusKey: 'phrase2', timeKey: 'time3', remarkKey: 'thing4' } })
    case 'saveNotificationTemplate':
      wx.setStorageSync(KEYS.notificationTemplate, data.template); return clone(data.template)
    case 'getMyIdentity': {
      const myStoreId = wx.getStorageSync(KEYS.myStoreId)
      const myStore = stores.find(item => item._id === myStoreId) || null
      const application = wx.getStorageSync(KEYS.application) || null
      const platformUsers = wx.getStorageSync(KEYS.platformUsers) || []
      const platformUser = platformUsers.find(item => item.openid === 'local_demo_user' && item.status === 'ACTIVE')
      return {
        openid: 'local_demo_user',
        roles: myStore ? ['CUSTOMER', 'MERCHANT_OWNER'] : ['CUSTOMER'],
        platformRole: platformUser ? platformUser.role : null,
        permissions: myStore ? ['ORDER_CREATE', 'STORE_MANAGE_SELF'] : ['ORDER_CREATE', 'MERCHANT_APPLY'],
        merchantApplication: clone(application),
        store: clone(myStore)
      }
    }
    case 'submitMerchantApplication': {
      const timestamp = now()
      const application = Object.assign({}, wx.getStorageSync(KEYS.application) || {}, data.application, {
        _id: (wx.getStorageSync(KEYS.application) || {})._id || id('application'),
        applicantOpenid: 'local_demo_user',
        status: 'SUBMITTED',
        publicMessage: '申请已提交，平台工作人员将通过电话联系。',
        submittedAt: timestamp,
        updatedAt: timestamp,
        createdAt: (wx.getStorageSync(KEYS.application) || {}).createdAt || timestamp
      })
      wx.setStorageSync(KEYS.application, application)
      return clone(application)
    }
    case 'getMyMerchantApplication':
      return clone(wx.getStorageSync(KEYS.application) || null)
    case 'getAdminDashboard':
      return { role: 'SUPER_ADMIN', pendingApplications: 0, paymentPending: 0, approvalPending: 0, activeStores: stores.length, recentLogs: [] }
    case 'listMerchantApplications': {
      const application = wx.getStorageSync(KEYS.application)
      return application ? [clone(application)] : []
    }
    case 'listAdminStores':
      return clone(stores)
    case 'listPlatformUsers':
      return clone(wx.getStorageSync(KEYS.platformUsers) || [])
    case 'savePlatformUser': {
      const list = wx.getStorageSync(KEYS.platformUsers) || []
      const input = data.platformUser
      const index = list.findIndex(item => item.openid === input.openid)
      const saved = Object.assign({}, index >= 0 ? list[index] : { _id: id('platform') }, input, { updatedAt: now(), createdAt: index >= 0 ? list[index].createdAt : now() })
      if (index >= 0) list[index] = saved
      else list.unshift(saved)
      wx.setStorageSync(KEYS.platformUsers, list)
      return true
    }
    case 'listStores': {
      const query = String(data.query || '').trim().toLowerCase()
      return clone(stores.filter(store => store.auditStatus === 'APPROVED' && (!query || store.name.toLowerCase().includes(query) || store.notice.toLowerCase().includes(query))))
    }
    case 'getStore': {
      const store = stores.find(item => item._id === data.storeId)
      if (!store) throw new Error('店铺不存在')
      return { store: clone(store), products: clone(products.filter(item => item.storeId === data.storeId && item.status === 'ON')) }
    }
    case 'getMyStore': {
      const storeId = wx.getStorageSync(KEYS.myStoreId)
      return clone(stores.find(item => item._id === storeId) || null)
    }
    case 'saveStore': {
      let store
      if (data.store && data.store._id) {
        const index = stores.findIndex(item => item._id === data.store._id)
        store = Object.assign({}, stores[index], data.store, { updatedAt: now() })
        stores[index] = store
      } else {
        const storeInput = Object.assign({}, data.store)
        delete storeInput._id
        store = Object.assign({
          _id: id('store'),
          logoEmoji: ['🐱', '🐶', '🐼', '🦁'][Math.floor(Math.random() * 4)],
          rating: 5,
          monthlySales: 0,
          isOpen: true,
          auditStatus: 'APPROVED',
          deliveryMinutes: 15,
          minimumOrder: 0,
          deliveryFee: 0,
          createdAt: now()
        }, storeInput)
        stores.unshift(store)
        wx.setStorageSync(KEYS.myStoreId, store._id)
      }
      wx.setStorageSync(KEYS.stores, stores)
      return clone(store)
    }
    case 'setStoreOpen': {
      const index = stores.findIndex(item => item._id === data.storeId)
      if (index < 0) throw new Error('店铺不存在')
      stores[index].isOpen = !!data.isOpen
      wx.setStorageSync(KEYS.stores, stores)
      return clone(stores[index])
    }
    case 'listProducts':
      return clone(products.filter(item => item.storeId === data.storeId))
    case 'getProduct':
      return clone(products.find(item => item._id === data.productId) || null)
    case 'saveProduct': {
      let product
      if (data.product && data.product._id) {
        const index = products.findIndex(item => item._id === data.product._id)
        product = Object.assign({}, products[index], data.product, { updatedAt: now() })
        products[index] = product
      } else {
        const productInput = Object.assign({}, data.product)
        delete productInput._id
        product = Object.assign({
          _id: id('product'),
          emoji: PRODUCT_EMOJIS[Math.floor(Math.random() * PRODUCT_EMOJIS.length)],
          sold: 0,
          status: 'ON',
          createdAt: now()
        }, productInput)
        products.unshift(product)
      }
      wx.setStorageSync(KEYS.products, products)
      return clone(product)
    }
    case 'toggleProduct': {
      const index = products.findIndex(item => item._id === data.productId)
      if (index < 0) throw new Error('商品不存在')
      products[index].status = data.status
      wx.setStorageSync(KEYS.products, products)
      return clone(products[index])
    }
    case 'createOrder': {
      const store = stores.find(item => item._id === data.order.storeId)
      if (!store || !store.isOpen) throw new Error('店铺当前未营业')
      const items = []
      let goodsAmount = 0
      data.order.items.forEach(input => {
        const product = products.find(item => item._id === input.productId && item.storeId === store._id)
        if (!product || product.status !== 'ON') throw new Error('部分商品已下架')
        if (product.stock < input.quantity) throw new Error(`${product.name}库存不足`)
        product.stock -= input.quantity
        items.push({ productId: product._id, name: product.name, price: product.price, quantity: input.quantity, emoji: product.emoji, image: product.image || '' })
        goodsAmount += product.price * input.quantity
      })
      if (goodsAmount < store.minimumOrder) throw new Error('未达到起送金额')
      const order = Object.assign({}, data.order, {
        _id: id('order'),
        orderNo: `${Date.now()}${Math.floor(Math.random() * 90 + 10)}`,
        storeName: store.name,
        storeLogoEmoji: store.logoEmoji,
        items,
        goodsAmount,
        deliveryFee: store.deliveryFee || 0,
        totalAmount: goodsAmount + (store.deliveryFee || 0),
        status: 'CREATED',
        statusHistory: [{ status: 'CREATED', time: now() }],
        createdAt: now(),
        updatedAt: now()
      })
      orders.unshift(order)
      wx.setStorageSync(KEYS.products, products)
      wx.setStorageSync(KEYS.orders, orders)
      return clone(order)
    }
    case 'listOrders': {
      const myStoreId = wx.getStorageSync(KEYS.myStoreId)
      const list = data.role === 'merchant' ? orders.filter(item => item.storeId === myStoreId) : orders
      return clone(list)
    }
    case 'getOrder':
      return clone(orders.find(item => item._id === data.orderId) || null)
    case 'updateOrderStatus': {
      const index = orders.findIndex(item => item._id === data.orderId)
      if (index < 0) throw new Error('订单不存在')
      const oldStatus = orders[index].status
      const newStatus = data.status
      if (['CANCELED', 'REJECTED'].includes(newStatus) && !['CANCELED', 'REJECTED'].includes(oldStatus)) {
        orders[index].items.forEach(orderItem => {
          const product = products.find(item => item._id === orderItem.productId)
          if (product) product.stock += orderItem.quantity
        })
        wx.setStorageSync(KEYS.products, products)
      }
      if (newStatus === 'COMPLETED' && oldStatus !== 'COMPLETED') {
        orders[index].items.forEach(orderItem => {
          const product = products.find(item => item._id === orderItem.productId)
          if (product) product.sold = Number(product.sold || 0) + orderItem.quantity
        })
        const storeIndex = stores.findIndex(item => item._id === orders[index].storeId)
        if (storeIndex >= 0) stores[storeIndex].monthlySales = Number(stores[storeIndex].monthlySales || 0) + 1
        wx.setStorageSync(KEYS.products, products)
        wx.setStorageSync(KEYS.stores, stores)
      }
      orders[index].status = newStatus
      orders[index].updatedAt = now()
      orders[index].statusHistory = orders[index].statusHistory || []
      orders[index].statusHistory.push({ status: newStatus, time: now() })
      wx.setStorageSync(KEYS.orders, orders)
      return clone(orders[index])
    }
    case 'getMerchantStats': {
      const storeId = wx.getStorageSync(KEYS.myStoreId)
      const storeOrders = orders.filter(item => item.storeId === storeId)
      const today = new Date().toDateString()
      const todayOrders = storeOrders.filter(item => new Date(item.createdAt).toDateString() === today)
      return {
        pending: storeOrders.filter(item => item.status === 'CREATED').length,
        delivering: storeOrders.filter(item => ['ACCEPTED', 'DELIVERING', 'DELIVERED'].includes(item.status)).length,
        todayOrders: todayOrders.length,
        todayAmount: todayOrders.filter(item => item.status === 'COMPLETED').reduce((sum, item) => sum + item.totalAmount, 0),
        lowStock: products.filter(item => item.storeId === storeId && item.status === 'ON' && item.stock <= 3).length
      }
    }
    default:
      throw new Error(`Unsupported action: ${action}`)
  }
}


async function uploadProductImage(tempFilePath) {
  if (cloudEnabled()) {
    const suffix = (tempFilePath.match(/\.[a-zA-Z0-9]+$/) || ['.jpg'])[0]
    const result = await wx.cloud.uploadFile({
      cloudPath: `products/${Date.now()}_${Math.random().toString(36).slice(2, 8)}${suffix}`,
      filePath: tempFilePath
    })
    return result.fileID
  }
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager()
    fs.saveFile({ tempFilePath, success: result => resolve(result.savedFilePath), fail: reject })
  })
}

function getProfile() {
  initLocalData()
  return wx.getStorageSync(KEYS.profile)
}

function saveProfile(profile) {
  wx.setStorageSync(KEYS.profile, profile)
}

function resetDemoData() {
  Object.values(KEYS).forEach(key => wx.removeStorageSync(key))
  initLocalData()
}

module.exports = { request, initLocalData, uploadProductImage, getProfile, saveProfile, resetDemoData, KEYS }

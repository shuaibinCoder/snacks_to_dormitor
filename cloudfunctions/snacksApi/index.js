const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const COLLECTIONS = ['stores', 'products', 'orders']

function ok(data) { return { success: true, data } }
function fail(message, code = 'BUSINESS_ERROR') { return { success: false, message, code } }
function context() { return cloud.getWXContext() }
function orderNo() { return `${Date.now()}${Math.floor(Math.random() * 90 + 10)}` }

async function getOwnedStore(openid) {
  const result = await db.collection('stores').where({ ownerOpenid: openid }).limit(1).get()
  return result.data[0] || null
}

async function requireOwnedStore(openid, storeId) {
  const store = await db.collection('stores').doc(storeId).get().then(res => res.data).catch(() => null)
  if (!store || store.ownerOpenid !== openid) throw new Error('无权操作该店铺')
  return store
}

async function initCollections() {
  for (const name of COLLECTIONS) {
    try { await db.createCollection(name) } catch (error) { /* collection already exists */ }
  }
  return true
}

async function listStores(event) {
  const query = String(event.query || '').trim()
  const where = { auditStatus: 'APPROVED' }
  if (query) where.name = db.RegExp({ regexp: query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' })
  const result = await db.collection('stores').where(where).limit(50).get()
  return result.data.sort((a, b) => Number(b.monthlySales || 0) - Number(a.monthlySales || 0))
}

async function getStore(event) {
  const store = await db.collection('stores').doc(event.storeId).get().then(res => res.data).catch(() => null)
  if (!store || store.auditStatus !== 'APPROVED') throw new Error('店铺不存在或暂未开放')
  const products = await db.collection('products').where({ storeId: event.storeId, status: 'ON' }).limit(100).get()
  return { store, products: products.data.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)) }
}

async function getMyStore(openid) {
  return getOwnedStore(openid)
}

async function saveStore(event, openid) {
  const input = event.store || {}
  const allowed = {
    name: String(input.name || '').trim(),
    ownerName: String(input.ownerName || '').trim(),
    phone: String(input.phone || ''),
    notice: String(input.notice || '').trim(),
    businessHours: String(input.businessHours || ''),
    minimumOrder: Math.max(0, Number(input.minimumOrder || 0)),
    deliveryFee: Math.max(0, Number(input.deliveryFee || 0)),
    deliveryMinutes: Math.max(1, Number(input.deliveryMinutes || 15)),
    updatedAt: db.serverDate()
  }
  if (!allowed.name || !allowed.ownerName || !/^1\d{10}$/.test(allowed.phone)) throw new Error('店铺信息不完整')

  if (input._id) {
    await requireOwnedStore(openid, input._id)
    await db.collection('stores').doc(input._id).update({ data: allowed })
    return db.collection('stores').doc(input._id).get().then(res => res.data)
  }

  const existing = await getOwnedStore(openid)
  if (existing) throw new Error('每个账号只能创建一家店铺')
  const logos = ['🐱', '🐶', '🐼', '🦁', '🦊', '🐰']
  const data = {
    ...allowed,
    ownerOpenid: openid,
    logoEmoji: logos[Math.floor(Math.random() * logos.length)],
    rating: 5,
    monthlySales: 0,
    isOpen: true,
    auditStatus: 'APPROVED',
    createdAt: db.serverDate()
  }
  const added = await db.collection('stores').add({ data })
  return db.collection('stores').doc(added._id).get().then(res => res.data)
}

async function setStoreOpen(event, openid) {
  await requireOwnedStore(openid, event.storeId)
  await db.collection('stores').doc(event.storeId).update({ data: { isOpen: !!event.isOpen, updatedAt: db.serverDate() } })
  return db.collection('stores').doc(event.storeId).get().then(res => res.data)
}

async function listProducts(event, openid) {
  await requireOwnedStore(openid, event.storeId)
  const result = await db.collection('products').where({ storeId: event.storeId }).limit(100).get()
  return result.data.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

async function getProduct(event, openid) {
  const product = await db.collection('products').doc(event.productId).get().then(res => res.data).catch(() => null)
  if (!product) return null
  await requireOwnedStore(openid, product.storeId)
  return product
}

async function saveProduct(event, openid) {
  const input = event.product || {}
  await requireOwnedStore(openid, input.storeId)
  const data = {
    storeId: input.storeId,
    name: String(input.name || '').trim(),
    category: String(input.category || '其他'),
    price: Math.max(1, Number(input.price || 0)),
    stock: Math.max(0, Math.floor(Number(input.stock || 0))),
    emoji: String(input.emoji || '🍪'),
    image: String(input.image || ''),
    status: input.status === 'OFF' ? 'OFF' : 'ON',
    updatedAt: db.serverDate()
  }
  if (!data.name) throw new Error('商品名称不能为空')
  if (input._id) {
    const old = await db.collection('products').doc(input._id).get().then(res => res.data).catch(() => null)
    if (!old || old.storeId !== input.storeId) throw new Error('商品不存在')
    await db.collection('products').doc(input._id).update({ data })
    return db.collection('products').doc(input._id).get().then(res => res.data)
  }
  const added = await db.collection('products').add({ data: { ...data, sold: 0, createdAt: db.serverDate() } })
  return db.collection('products').doc(added._id).get().then(res => res.data)
}

async function toggleProduct(event, openid) {
  const product = await db.collection('products').doc(event.productId).get().then(res => res.data).catch(() => null)
  if (!product) throw new Error('商品不存在')
  await requireOwnedStore(openid, product.storeId)
  await db.collection('products').doc(event.productId).update({ data: { status: event.status === 'OFF' ? 'OFF' : 'ON', updatedAt: db.serverDate() } })
  return true
}

async function createOrder(event, openid) {
  const input = event.order || {}
  const requested = Array.isArray(input.items) ? input.items : []
  if (!requested.length) throw new Error('购物车为空')

  return db.runTransaction(async transaction => {
    const store = await transaction.collection('stores').doc(input.storeId).get().then(res => res.data).catch(() => null)
    if (!store || !store.isOpen || store.auditStatus !== 'APPROVED') throw new Error('店铺当前无法接单')

    let goodsAmount = 0
    const items = []
    for (const requestedItem of requested) {
      const quantity = Math.max(1, Math.floor(Number(requestedItem.quantity || 1)))
      const product = await transaction.collection('products').doc(requestedItem.productId).get().then(res => res.data).catch(() => null)
      if (!product || product.storeId !== store._id || product.status !== 'ON') throw new Error('部分商品已下架')
      if (Number(product.stock || 0) < quantity) throw new Error(`${product.name}库存不足`)
      await transaction.collection('products').doc(product._id).update({ data: { stock: _.inc(-quantity), updatedAt: db.serverDate() } })
      items.push({ productId: product._id, name: product.name, price: product.price, quantity, emoji: product.emoji, image: product.image || '' })
      goodsAmount += product.price * quantity
    }
    if (goodsAmount < Number(store.minimumOrder || 0)) throw new Error('未达到起送金额')

    const timestamp = Date.now()
    const order = {
      orderNo: orderNo(),
      buyerOpenid: openid,
      sellerOpenid: store.ownerOpenid,
      storeId: store._id,
      storeName: store.name,
      storeLogoEmoji: store.logoEmoji,
      items,
      goodsAmount,
      deliveryFee: Number(store.deliveryFee || 0),
      totalAmount: goodsAmount + Number(store.deliveryFee || 0),
      contactName: String(input.contactName || '').trim(),
      phone: String(input.phone || ''),
      location: String(input.location || '').trim(),
      deliveryMethod: String(input.deliveryMethod || ''),
      note: String(input.note || '').trim(),
      status: 'CREATED',
      statusHistory: [{ status: 'CREATED', time: timestamp }],
      createdAt: timestamp,
      updatedAt: timestamp
    }
    const added = await transaction.collection('orders').add({ data: order })
    return { _id: added._id, ...order }
  })
}

async function listOrders(event, openid) {
  const where = event.role === 'merchant' ? { sellerOpenid: openid } : { buyerOpenid: openid }
  const result = await db.collection('orders').where(where).limit(100).get()
  return result.data.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

async function getOrder(event, openid) {
  const order = await db.collection('orders').doc(event.orderId).get().then(res => res.data).catch(() => null)
  if (!order) return null
  if (order.buyerOpenid !== openid && order.sellerOpenid !== openid) throw new Error('无权查看该订单')
  return order
}

async function updateOrderStatus(event, openid) {
  const order = await getOrder(event, openid)
  if (!order) throw new Error('订单不存在')
  const isSeller = order.sellerOpenid === openid
  const isBuyer = order.buyerOpenid === openid
  const target = event.status
  const sellerTransitions = { CREATED: ['ACCEPTED', 'REJECTED'], ACCEPTED: ['DELIVERING'], DELIVERING: ['DELIVERED'], DELIVERED: ['COMPLETED'] }
  const buyerTransitions = { CREATED: ['CANCELED'], DELIVERED: ['COMPLETED'] }
  const allowed = isSeller ? sellerTransitions[order.status] : isBuyer ? buyerTransitions[order.status] : []
  if (!allowed || !allowed.includes(target)) throw new Error('当前订单状态不允许此操作')

  await db.runTransaction(async transaction => {
    if (['CANCELED', 'REJECTED'].includes(target)) {
      for (const item of order.items) await transaction.collection('products').doc(item.productId).update({ data: { stock: _.inc(item.quantity), updatedAt: db.serverDate() } })
    }
    if (target === 'COMPLETED' && order.status !== 'COMPLETED') {
      for (const item of order.items) await transaction.collection('products').doc(item.productId).update({ data: { sold: _.inc(item.quantity), updatedAt: db.serverDate() } })
      await transaction.collection('stores').doc(order.storeId).update({ data: { monthlySales: _.inc(1), updatedAt: db.serverDate() } })
    }
    await transaction.collection('orders').doc(order._id).update({ data: { status: target, statusHistory: _.push({ status: target, time: Date.now() }), updatedAt: Date.now() } })
  })
  return db.collection('orders').doc(order._id).get().then(res => res.data)
}

async function getMerchantStats(openid) {
  const store = await getOwnedStore(openid)
  if (!store) return { pending: 0, delivering: 0, todayOrders: 0, todayAmount: 0, lowStock: 0 }
  const orders = await db.collection('orders').where({ storeId: store._id }).limit(100).get()
  const products = await db.collection('products').where({ storeId: store._id, status: 'ON' }).limit(100).get()
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const todayOrders = orders.data.filter(item => Number(item.createdAt) >= start.getTime())
  return {
    pending: orders.data.filter(item => item.status === 'CREATED').length,
    delivering: orders.data.filter(item => ['ACCEPTED', 'DELIVERING', 'DELIVERED'].includes(item.status)).length,
    todayOrders: todayOrders.length,
    todayAmount: todayOrders.filter(item => item.status === 'COMPLETED').reduce((sum, item) => sum + item.totalAmount, 0),
    lowStock: products.data.filter(item => Number(item.stock || 0) <= 3).length
  }
}

exports.main = async event => {
  const { OPENID } = context()
  try {
    switch (event.action) {
      case 'initCollections': return ok(await initCollections())
      case 'listStores': return ok(await listStores(event))
      case 'getStore': return ok(await getStore(event))
      case 'getMyStore': return ok(await getMyStore(OPENID))
      case 'saveStore': return ok(await saveStore(event, OPENID))
      case 'setStoreOpen': return ok(await setStoreOpen(event, OPENID))
      case 'listProducts': return ok(await listProducts(event, OPENID))
      case 'getProduct': return ok(await getProduct(event, OPENID))
      case 'saveProduct': return ok(await saveProduct(event, OPENID))
      case 'toggleProduct': return ok(await toggleProduct(event, OPENID))
      case 'createOrder': return ok(await createOrder(event, OPENID))
      case 'listOrders': return ok(await listOrders(event, OPENID))
      case 'getOrder': return ok(await getOrder(event, OPENID))
      case 'updateOrderStatus': return ok(await updateOrderStatus(event, OPENID))
      case 'getMerchantStats': return ok(await getMerchantStats(OPENID))
      default: return fail('未知操作', 'UNKNOWN_ACTION')
    }
  } catch (error) {
    console.error(event.action, error)
    return fail(error.message || '服务异常')
  }
}

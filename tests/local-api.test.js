const assert = require('assert')

const storage = new Map()
global.wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key)
}
global.getApp = () => ({ globalData: { useCloud: false } })

const api = require('../miniprogram/utils/api')

async function run() {
  api.resetDemoData()
  const search = await api.request('listStores', { query: '阿豪' })
  assert.strictEqual(search.length, 1)
  assert.strictEqual(search[0]._id, 'store_demo_1')

  const store = await api.request('saveStore', { store: {
    name: '测试宿舍小店', ownerName: '测试同学', phone: '13812345678',
    notice: '测试公告', businessHours: '20:00 - 23:00', minimumOrder: 0,
    deliveryFee: 0, deliveryMinutes: 10
  } })
  assert.ok(store._id)
  assert.strictEqual((await api.request('getMyStore'))._id, store._id)

  const product = await api.request('saveProduct', { product: {
    storeId: store._id, name: '测试可乐', category: '饮料', price: 300,
    stock: 5, emoji: '🥤', status: 'ON'
  } })
  assert.ok(product._id)

  const order = await api.request('createOrder', { order: {
    storeId: store._id, items: [{ productId: product._id, quantity: 2 }],
    contactName: '买家', phone: '13800000000', location: '3楼307',
    deliveryMethod: '送到寝室门口', note: ''
  } })
  assert.strictEqual(order.status, 'CREATED')
  assert.strictEqual(order.totalAmount, 600)
  assert.strictEqual((await api.request('getProduct', { productId: product._id })).stock, 3)

  await api.request('updateOrderStatus', { orderId: order._id, status: 'CANCELED' })
  assert.strictEqual((await api.request('getProduct', { productId: product._id })).stock, 5)

  const order2 = await api.request('createOrder', { order: {
    storeId: store._id, items: [{ productId: product._id, quantity: 1 }],
    contactName: '买家', phone: '13800000000', location: '3楼307',
    deliveryMethod: '送到寝室门口', note: ''
  } })
  for (const status of ['ACCEPTED', 'DELIVERING', 'DELIVERED', 'COMPLETED']) {
    await api.request('updateOrderStatus', { orderId: order2._id, status })
  }
  const completedProduct = await api.request('getProduct', { productId: product._id })
  assert.strictEqual(completedProduct.stock, 4)
  assert.strictEqual(completedProduct.sold, 1)

  console.log('Local API MVP flow: PASS')
}

run().catch(error => { console.error(error); process.exit(1) })

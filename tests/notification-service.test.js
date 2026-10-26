const assert = require('assert')
const { createNotificationService } = require('../cloudfunctions/snacksApi/notifications')

const collections = {}
let sequence = 0
function rows(name) { return collections[name] || (collections[name] = []) }
function applyUpdate(target, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '__inc')) target[key] = Number(target[key] || 0) + value.__inc
    else target[key] = value
  }
}
const db = {
  collection(name) {
    return {
      doc(id) {
        return {
          async get() { const item = rows(name).find(row => row._id === id); if (!item) throw new Error('not found'); return { data: { ...item } } },
          async set({ data }) { const list = rows(name); const index = list.findIndex(row => row._id === id); const item = { _id: id, ...data }; if (index >= 0) list[index] = item; else list.push(item); return {} },
          async update({ data }) { const item = rows(name).find(row => row._id === id); if (!item) throw new Error('not found'); applyUpdate(item, data); return {} }
        }
      },
      where(query) {
        return { limit() { return { async get() { return { data: rows(name).filter(row => Object.entries(query).every(([key, value]) => row[key] === value)).map(row => ({ ...row })) } } } } }
      },
      async add({ data }) { const _id = `${name}_${++sequence}`; rows(name).push({ _id, ...data }); return { _id } }
    }
  }
}

const sent = []
const cloud = { openapi: { subscribeMessage: { async send(payload) { sent.push(payload); return {} } } } }
const labels = {
  USER_ROLE: { CUSTOMER: '普通用户', MERCHANT_OWNER: '商家店主' },
  NOTIFICATION_CATEGORY: { ORDER: '订单消息' },
  NOTIFICATION_TYPE: { NEW_ORDER: '新订单提醒' },
  NOTIFICATION_PRIORITY: { URGENT: '紧急' },
  NOTIFICATION_BIZ_TYPE: { ORDER: '订单' },
  NOTIFICATION_READ_STATUS: { UNREAD: '未读', READ: '已读' },
  NOTIFICATION_CHANNEL: { IN_APP: '小程序站内消息', WECHAT_SUBSCRIBE: '微信订阅消息' },
  NOTIFICATION_DELIVERY_STATUS: { SUCCESS: '发送成功', SKIPPED: '已跳过', FAILED_FINAL: '发送失败' },
  SUBSCRIBE_PERMISSION: { ACCEPT: '已同意', REJECT: '已拒绝' }
}
const service = createNotificationService({
  cloud,
  db,
  command: { inc: value => ({ __inc: value }) },
  now: (() => { let time = 1792684800000; return () => ++time })(),
  getEnumLabel: (type, code) => labels[type] && labels[type][code] || code
})

async function run() {
  await service.ensureSharedTemplate()
  await service.saveNotificationTemplate({
    templateId: 'template-test-id', enabled: true, miniprogramState: 'developer',
    fields: { titleKey: 'thing1', statusKey: 'phrase2', timeKey: 'time3', remarkKey: 'thing4' }
  })
  await service.recordSubscribePermission('merchant-openid', 'ACCEPT', 'MERCHANT_START_BUSINESS')
  const first = await service.createNotification({
    recipientOpenid: 'merchant-openid', recipientRole: 'MERCHANT_OWNER', category: 'ORDER', type: 'NEW_ORDER', priority: 'URGENT',
    title: '你有一个新订单', summary: '订单金额12.50元', statusText: '待接单', bizType: 'ORDER', bizId: 'order-1',
    pagePath: '/pages/order/index?id=order-1&mode=merchant', dedupeKey: 'NEW_ORDER:order-1'
  })
  const duplicate = await service.createNotification({
    recipientOpenid: 'merchant-openid', recipientRole: 'MERCHANT_OWNER', category: 'ORDER', type: 'NEW_ORDER', priority: 'URGENT',
    title: '重复消息', summary: '', statusText: '待接单', bizType: 'ORDER', bizId: 'order-1', dedupeKey: 'NEW_ORDER:order-1'
  })

  assert.strictEqual(rows('notifications').length, 1)
  assert.strictEqual(first._id, duplicate._id)
  assert.strictEqual(rows('notification_deliveries').length, 2)
  assert.strictEqual(sent.length, 1)
  assert.strictEqual(sent[0].templateId, 'template-test-id')
  assert.strictEqual(sent[0].page, 'pages/order/index?id=order-1&mode=merchant')
  assert.strictEqual(rows('notification_preferences')[0].grantedCount, 0)
  assert.strictEqual((await service.getUnreadNotificationCount('merchant-openid')).total, 1)
  await service.markNotificationRead('merchant-openid', first._id)
  assert.strictEqual((await service.getUnreadNotificationCount('merchant-openid')).total, 0)
  console.log('Notification service flow: PASS')
}
run().catch(error => { console.error(error); process.exit(1) })

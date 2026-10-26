const assert = require('assert')

const storage = new Map()
const calls = []
global.wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  requestSubscribeMessage(options) {
    calls.push('wx.requestSubscribeMessage')
    options.success({ 'template-id': 'accept' })
  },
  showToast() {}, showModal() {}, openSetting() {},
  setTabBarBadge({ complete }) { if (complete) complete() },
  removeTabBarBadge({ complete }) { if (complete) complete() }
}
global.getApp = () => ({ globalData: { useCloud: false } })

const api = require('../miniprogram/utils/api')
const originalRequest = api.request
api.request = async (action, data) => {
  calls.push(`api.${action}`)
  if (action === 'recordSubscribePermission') {
    assert.strictEqual(data.permission, 'ACCEPT')
    assert.strictEqual(data.subscriptionRole, 'BUYER')
    return true
  }
  return originalRequest(action, data)
}

const notifications = require('../miniprogram/utils/notifications')
notifications.updateNotificationConfigCache({ enabled: true, templateId: 'template-id' })

async function run() {
  const promise = notifications.requestSharedSubscription('TEST_SCENE', 'BUYER')
  assert.strictEqual(calls[0], 'wx.requestSubscribeMessage', '微信授权API必须在任何异步请求前同步调用')
  const result = await promise
  assert.strictEqual(result.permission, 'ACCEPT')
  assert.deepStrictEqual(calls.slice(0, 2), ['wx.requestSubscribeMessage', 'api.recordSubscribePermission'])
  console.log('Notification client gesture flow: PASS')
}

run().catch(error => { console.error(error); process.exit(1) })

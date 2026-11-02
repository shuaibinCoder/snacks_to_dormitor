const assert = require('assert')
const fs = require('node:fs')
const vm = require('node:vm')

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
  await testAdminPushFeedback()
  console.log('Notification client gesture and admin push diagnostics: PASS')
}

/** 加载真实页面验证按钮链路；微信发送及服务响应都使用替身，不消耗实际授权。 */
async function testAdminPushFeedback() {
  let page, sends = 0, loads = 0, modal
  let diagnosticFailure = false
  let deliveries = [{ notificationId: 'notice', channel: 'WECHAT_SUBSCRIBE', deliveryStatus: 'UNKNOWN', lastErrorCode: 'HTTP_502', lastErrorMessage: '微信接口返回 HTTP 502' }]
  const pageApi = {
    async request(action) {
      calls.push(`page.${action}`)
      if (action === 'sendTestNotification') { sends++; return { _id: 'notice', wechatSent: false } }
      if (action === 'getNotificationAdminConfig') return { enabled: true, templateId: 'template-id', miniprogramState: 'trial' }
      if (action === 'getMyNotificationDiagnostics') {
        loads++
        if (diagnosticFailure) throw new Error('诊断请求失败')
        return { config: {}, latestDeliveries: deliveries }
      }
      throw new Error(`未预期请求 ${action}`)
    }
  }
  const pageWx = {
    showLoading() {}, hideLoading() {}, showToast() {},
    showModal(value) { modal = value }
  }
  vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/admin-notification/index'), 'utf8'), {
    Page(value) { page = value }, wx: pageWx,
    require(name) {
      if (name === '../../utils/api') return pageApi
      if (name === '../../utils/notifications') return notifications
      if (name === '../../utils/format') return { formatTime: () => '测试时间' }
      throw new Error(`未预期依赖 ${name}`)
    }
  })
  page.setData = value => Object.assign(page.data, value)
  calls.length = 0
  const request = page.testSubscribe()
  assert.strictEqual(calls[0], 'wx.requestSubscribeMessage', '真实按钮链路必须先同步弹授权')
  await page.testSubscribe()
  await request
  assert.strictEqual(sends, 1, '重复点击不能重复发送')
  assert.strictEqual(loads, 1)
  assert.strictEqual(page.data.testing, false)
  assert.strictEqual(modal.title, '推送结果尚未确认')
  assert.match(modal.content, /HTTP_502/)
  assert.match(modal.content, /不会自动重发/)
  assert(calls.indexOf('api.recordSubscribePermission') < calls.indexOf('page.sendTestNotification'))

  deliveries = [{ notificationId: 'notice', channel: 'WECHAT_SUBSCRIBE', deliveryStatus: 'FAILED_FINAL', lastErrorCode: '-604101', lastErrorMessage: 'api permission denied' }]
  await page.testSubscribe()
  assert.strictEqual(modal.title, '微信推送失败')
  assert.match(modal.content, /-604101.*api permission denied/)
  assert.match(modal.content, /cgi-bin\/message\/subscribe\/send/)

  for (const status of ['PENDING', 'SENDING', 'UNKNOWN', 'SKIPPED', 'SUCCESS']) {
    const result = page.testResult({ _id: 'notice', wechatSent: false }, {
      latestDeliveries: [{ notificationId: 'notice', channel: 'WECHAT_SUBSCRIBE', deliveryStatus: status }]
    })
    assert.strictEqual(result.title === '测试消息已发送', status === 'SUCCESS')
  }
  assert.strictEqual(page.testResult({ wechatSent: true }, null).title, '测试消息已发送')
  const unrelated = page.testResult({ _id: 'notice', wechatSent: false }, {
    latestDeliveries: [
      { notificationId: 'other', channel: 'WECHAT_SUBSCRIBE', deliveryStatus: 'SUCCESS' },
      { notificationId: 'notice', channel: 'IN_APP', deliveryStatus: 'SUCCESS' }
    ]
  })
  assert.strictEqual(unrelated.title, '推送结果尚未确认', '不能借用其他通知或站内消息的成功状态')
  diagnosticFailure = true
  await page.testSubscribe()
  assert.strictEqual(modal.title, '推送结果尚未确认', '诊断请求失败不能沿用缓存中的旧失败')
  assert(!modal.content.includes('-604101'))
  assert.strictEqual(sends, 3, '每次主动测试仅请求一次发送，不自动补发')
  assert.strictEqual(page.data.testing, false)

  const wxml = fs.readFileSync(require.resolve('../miniprogram/pages/admin-notification/index.wxml'), 'utf8')
  assert(wxml.includes(`wx:if="{{item.deliveryStatus === 'SUCCESS'}}"`), '成功提示必须由成功状态控制')
  assert(!wxml.includes('wx:if="{{!item.lastErrorMessage}}" class="delivery-success"'))
}

run().catch(error => { console.error(error); process.exit(1) })

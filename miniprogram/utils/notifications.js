const api = require('./api')
const { formatTime } = require('./format')

const CONFIG_CACHE_KEY = 'snacks_notification_config_cache'
let configCache = null

function readCachedConfig() {
  if (configCache) return configCache
  try {
    configCache = wx.getStorageSync(CONFIG_CACHE_KEY) || null
  } catch (error) {
    configCache = null
  }
  return configCache
}

function updateNotificationConfigCache(config) {
  configCache = config || null
  try {
    if (config) wx.setStorageSync(CONFIG_CACHE_KEY, config)
    else wx.removeStorageSync(CONFIG_CACHE_KEY)
  } catch (error) {
    console.warn('cache notification config failed', error)
  }
  return configCache
}

async function primeNotificationConfig(force = false) {
  if (!force) {
    const cached = readCachedConfig()
    if (cached) return cached
  }
  try {
    const config = await api.request('getNotificationConfig')
    return updateNotificationConfigCache(config)
  } catch (error) {
    console.warn('load notification config failed', error)
    return readCachedConfig()
  }
}

function classifySubscribeError(error) {
  const errMsg = String(error && (error.errMsg || error.message) || '订阅消息请求失败')
  const errCode = String(error && (error.errCode || error.code) || '')
  if (/TAP gesture/i.test(errMsg)) return { reason: 'TAP_GESTURE_REQUIRED', errorMessage: '订阅授权必须由你直接点击按钮触发，请再次点击。' }
  if (/main switch|20004/i.test(`${errCode} ${errMsg}`)) return { reason: 'MAIN_SWITCH_OFF', errorMessage: '微信中的订阅消息总开关已关闭，请前往设置开启。' }
  if (/template|10004|20001/i.test(`${errCode} ${errMsg}`)) return { reason: 'INVALID_TEMPLATE', errorMessage: '订阅消息模板无效或不属于当前小程序，请管理员检查模板ID。' }
  if (/cancel/i.test(errMsg)) return { reason: 'CANCELED', errorMessage: '你取消了本次订阅授权。' }
  return { reason: 'REQUEST_FAILED', errorMessage: errMsg, errorCode: errCode }
}

/**
 * 必须直接在 bindtap / 用户点击事件链路中调用。
 * 此方法在调用 wx.requestSubscribeMessage 之前不会执行任何异步请求，
 * 否则微信会认为已经脱离用户点击手势并拒绝弹出授权框。
 */
function requestSharedSubscription(scene, subscriptionRole = 'GENERAL') {
  const config = readCachedConfig()
  if (!config) {
    primeNotificationConfig(true)
    return Promise.resolve({ configured: false, permission: 'UNKNOWN', reason: 'CONFIG_NOT_READY', errorMessage: '消息配置正在加载，请稍后再次点击。' })
  }
  if (!config.enabled || !config.templateId) {
    return Promise.resolve({ configured: false, permission: 'UNKNOWN', reason: 'TEMPLATE_NOT_CONFIGURED', errorMessage: '平台尚未启用微信订阅消息模板。' })
  }
  if (typeof wx.requestSubscribeMessage !== 'function') {
    return Promise.resolve({ configured: true, permission: 'UNKNOWN', reason: 'UNSUPPORTED', errorMessage: '当前微信版本不支持订阅消息，请升级微信后重试。' })
  }

  // Promise执行器同步运行，因此API仍处在本次用户点击手势中。
  let subscribeRequest
  try {
    subscribeRequest = new Promise((resolve, reject) => {
      wx.requestSubscribeMessage({ tmplIds: [config.templateId], success: resolve, fail: reject })
    })
  } catch (error) {
    const classified = classifySubscribeError(error)
    return Promise.resolve({ configured: true, permission: 'UNKNOWN', error, ...classified })
  }

  return subscribeRequest.then(async result => {
    const rawPermission = String(result[config.templateId] || 'unknown').toLowerCase()
    const permissionMap = { accept: 'ACCEPT', reject: 'REJECT', ban: 'BAN', filter: 'FILTER' }
    const permission = permissionMap[rawPermission] || 'UNKNOWN'
    try {
      await api.request('recordSubscribePermission', { permission, scene, subscriptionRole })
    } catch (error) {
      console.warn('record subscribe permission failed', error)
    }
    return {
      configured: true,
      permission,
      reason: permission === 'ACCEPT' ? 'ACCEPTED' : permission,
      rawPermission,
      templateId: config.templateId,
      subscriptionRole
    }
  }).catch(error => {
    console.warn('request subscribe message failed', error)
    const classified = classifySubscribeError(error)
    return { configured: true, permission: 'UNKNOWN', error, ...classified }
  })
}

function openSubscribeSetting() {
  if (typeof wx.openSetting !== 'function') return
  wx.openSetting({ withSubscriptions: true, fail: error => console.warn('open subscription settings failed', error) })
}

function showSubscribeFeedback(result, successText = '已开启一次微信提醒') {
  const response = result || { permission: 'UNKNOWN', reason: 'REQUEST_FAILED' }
  if (response.permission === 'ACCEPT') {
    wx.showToast({ title: successText, icon: 'success' })
    return
  }
  if (response.permission === 'BAN' || response.reason === 'MAIN_SWITCH_OFF') {
    wx.showModal({
      title: '订阅消息未开启',
      content: '微信订阅消息开关已关闭。请前往设置，在“订阅消息”中允许接收通知。站内消息仍会正常收到。',
      confirmText: '去设置',
      success: modal => { if (modal.confirm) openSubscribeSetting() }
    })
    return
  }
  if (response.permission === 'REJECT') {
    wx.showModal({
      title: '本次未授权',
      content: '你拒绝了本次微信提醒授权。微信订阅消息通常按次授权，可以稍后再次点击开启；站内消息不受影响。',
      showCancel: false
    })
    return
  }
  if (response.permission === 'FILTER') {
    wx.showModal({ title: '模板不可用', content: '该订阅模板已被微信过滤或不可用，请联系平台管理员检查模板配置。', showCancel: false })
    return
  }
  wx.showModal({
    title: '未能开启微信提醒',
    content: `${response.errorMessage || '暂时无法获取订阅授权。'}\n\n站内消息仍会正常收到。`,
    showCancel: false
  })
}

async function refreshUnreadBadge() {
  try {
    const result = await api.request('getUnreadNotificationCount')
    const total = Number(result.total || 0)
    if (total > 0) {
      await new Promise(resolve => wx.setTabBarBadge({ index: 2, text: total > 99 ? '99+' : String(total), complete: resolve }))
    } else {
      await new Promise(resolve => wx.removeTabBarBadge({ index: 2, complete: resolve }))
    }
    return result
  } catch (error) {
    console.warn('refresh unread badge failed', error)
    return { total: 0, categories: {} }
  }
}

function decorateNotification(item) {
  return Object.assign({}, item, {
    createdAtText: formatTime(item.createdAt),
    unread: item.readStatus === 'UNREAD',
    icon: item.category === 'ORDER' ? '🧾' : item.category === 'MERCHANT_APPLICATION' ? '🏪' : item.category === 'STORE' ? '📦' : item.category === 'PLATFORM' ? '🛡️' : '🔔'
  })
}

module.exports = {
  primeNotificationConfig,
  updateNotificationConfigCache,
  requestSharedSubscription,
  showSubscribeFeedback,
  refreshUnreadBadge,
  decorateNotification
}

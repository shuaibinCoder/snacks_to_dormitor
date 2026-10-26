const api = require('./api')
const { formatTime } = require('./format')

async function requestSharedSubscription(scene) {
  try {
    const config = await api.request('getNotificationConfig')
    if (!config || !config.enabled || !config.templateId) return { configured: false, permission: 'UNKNOWN' }
    const result = await new Promise((resolve, reject) => {
      wx.requestSubscribeMessage({ tmplIds: [config.templateId], success: resolve, fail: reject })
    })
    const permission = String(result[config.templateId] || 'unknown').toUpperCase()
    await api.request('recordSubscribePermission', { permission, scene })
    return { configured: true, permission }
  } catch (error) {
    console.warn('request subscribe message failed', error)
    return { configured: true, permission: 'UNKNOWN', error }
  }
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

module.exports = { requestSharedSubscription, refreshUnreadBadge, decorateNotification }

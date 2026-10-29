// 默认 Java 云托管；超级管理员仅切换本机本次运行，不持久化或跟随外部链接换库。
function settings() {
  try { return getApp().globalData || {} } catch (error) { return {} }
}
function provider(config = settings()) {
  if (!config.useCloud) return 'local'
  const value = config.backendProvider || 'cloudrun'
  if (!['cloudfunction', 'cloudrun'].includes(value)) throw new Error('后端配置不正确')
  return value
}
/** 页面读取结算、通知等后端命名空间前，必须先等待冷启动完成。 */
async function ready(config = settings()) {
  if (config.useCloud && config.cloudReady) await config.cloudReady
  provider(config)
}
function label(config = settings()) {
  return { cloudfunction: '云开发 · 原云函数', cloudrun: '云托管 · Java', local: '本机演示数据' }[provider(config)]
}
function namespace(config = settings()) {
  const type = provider(config)
  const run = config.cloudRun || {}
  return JSON.stringify([type, type === 'cloudrun' ? run.env || '' : type === 'cloudfunction' ? config.env || '' : '', type === 'cloudrun' ? run.service || '' : ''])
}
function cacheKey(name, config = settings()) { return `${name}:${encodeURIComponent(namespace(config))}` }
function withBackend(path) {
  return `${path}${path.includes('?') ? '&' : '?'}backend=${provider()}&backendScope=${encodeURIComponent(namespace())}`
}
function sourceMatches(query = {}, external = false, config = settings()) {
  if (!external && !query.backend && !query.backendScope) return true
  return (query.backend || 'cloudfunction') === provider(config) && (!query.backendScope || query.backendScope === namespace(config))
}
function checkEntry(options = {}, config = settings()) {
  const query = options.query || {}
  // App 的入口参数来自外部启动/唤醒；普通页内跳转不调用此入口。
  // 无记录 ID、无来源标记的普通页面可以恢复，不能仅凭页面或场景码推断为旧库链接。
  const external = ['id', 'storeId', 'orderId', 'productId', 'applicationId', 'backend', 'backendScope'].some(key => !!query[key])
  const matches = sourceMatches(query, external, config)
  if (!matches) {
    const alreadyShown = !!config.backendEntryError
    config.backendEntryError = '此链接属于另一套后端数据，请使用对应版本打开。当前后端未切换。'
    if (!alreadyShown) wx.showModal({ title: '数据来源不匹配', content: config.backendEntryError, showCancel: false })
  } else {
    config.backendEntryError = ''
  }
  return matches
}
function savePendingCheckout(value) {
  const saved = { ...value, source: namespace(), requestId: `checkout_${Date.now()}_${Math.random().toString(36).slice(2, 12)}` }
  wx.setStorageSync(cacheKey('snacks_pending_checkout'), saved)
  return saved
}
function getPendingCheckout() {
  const saved = wx.getStorageSync(cacheKey('snacks_pending_checkout'))
  return saved && saved.source === namespace() ? saved : null
}
function saveCheckoutAttempt(order) {
  const pending = getPendingCheckout()
  if (!pending || pending.requestId !== order.requestId) throw new Error('待结算数据已变化，请重新进入结算页')
  wx.setStorageSync(cacheKey('snacks_pending_checkout'), { ...pending, attempt: order })
}
function clearPendingCheckout() { wx.removeStorageSync(cacheKey('snacks_pending_checkout')) }
function errorDetail(error) {
  const detail = String(error && (error.message || error.errMsg) || (typeof error === 'string' ? error : '') || '未知错误')
  const code = error && (error.errCode === undefined ? error.code : error.errCode)
  return `${detail}${code === undefined || code === null ? '' : `（${code}）`}`
}
module.exports = { settings, ready, provider, label, namespace, cacheKey, withBackend, sourceMatches, checkEntry, savePendingCheckout, getPendingCheckout, saveCheckoutAttempt, clearPendingCheckout, errorDetail }

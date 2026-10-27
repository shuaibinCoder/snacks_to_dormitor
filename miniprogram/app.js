const { initLocalData, request, switchBackend } = require('./utils/api')
const backend = require('./utils/backend')
const { primeNotificationConfig, updateNotificationConfigCache } = require('./utils/notifications')

App({
  onLaunch(options) {
    this.globalData = {
      // 填入云开发环境 ID 后，将 useCloud 改为 true 即可使用云端数据。
      env: 'smooth-kiwi-d3gjwm74v84784b65',
      useCloud: true,
      backendProvider: 'cloudfunction', // 验证云托管时改为 cloudrun，重新编译后生效。
      cloudRun: { env: 'prod-d0gs4er2552d66779', service: 'springboot-7j2n', path: '/api/snacks' },
      appName: '宿舍补给站',
      cloudReady: Promise.resolve()
    }

    backend.checkEntry(options, this.globalData)
    initLocalData()
    // 初始化也走统一通道；失败保留拒绝状态，后续业务不会绕过初始化。
    this.globalData.cloudReady = Promise.resolve().then(() => {
      if (wx.cloud) wx.cloud.init({ env: this.globalData.env || undefined, traceUser: true })
      return request('initCollections', {}, this.globalData)
    })
    this.globalData.cloudReady.then(() => primeNotificationConfig(true)).catch(error => {
      console.warn('后端初始化失败：', error)
      wx.showModal({ title: '后端初始化失败', content: error.message || '请检查后端配置并重新启动', showCancel: false })
    })
  },

  onShow(options) { backend.checkEntry(options, this.globalData) },

  /** 验证通过后重建整个页面栈，避免旧订单、商品或身份留在页面中。 */
  switchBackend(target, service) {
    return switchBackend(target, service, async config => {
      updateNotificationConfigCache(config)
      await new Promise(resolve => wx.removeTabBarBadge({ index: 2, complete: resolve }))
      await new Promise((resolve, reject) => {
        wx.reLaunch({
          url: '/pages/admin/index',
          success: resolve,
          fail: () => reject(new Error('页面重载失败，已恢复原后端，请稍后重试'))
        })
      })
    }, this.globalData)
  },

  globalData: {}
})

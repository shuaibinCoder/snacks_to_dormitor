const { initLocalData, initializeBackend, switchBackend } = require('./utils/api')
const backend = require('./utils/backend')
const { primeNotificationConfig, updateNotificationConfigCache } = require('./utils/notifications')

App({
  onLaunch(options = {}) {
    this.globalData = {
      env: 'smooth-kiwi-d3gjwm74v84784b65',
      useCloud: true, // 仅本机演示时改为 false。
      backendProvider: 'cloudrun', // 冷启动默认 Java，管理员切换只影响本机本次运行。
      backendConfigured: false, startupState: 'idle',
      cloudRun: { env: 'prod-d0gs4er2552d66779', service: 'springboot-7j2n', path: '/api/snacks' },
      appName: '宿舍补给站'
    }
    this._entryOptions = options
    initLocalData()
    this.startBackend()
  },

  onShow(options = {}) {
    this._entryOptions = options
    if (this.globalData.backendConfigured) backend.checkEntry(options, this.globalData)
  },

  /** 初始化代码指定的会话后端；失败不自动换库，主动重试不重发业务请求。 */
  startBackend(retry = false) {
    const config = this.globalData
    if (config.startupState === 'loading' || config.startupState === 'ready') return config.cloudReady
    if (retry) this._entryOptions = { path: 'pages/home/index' }
    config.startupState = 'loading'
    config.backendConfigured = false
    let stage = '初始化微信云能力'
    config.cloudReady = Promise.resolve().then(async () => {
      if (config.useCloud) {
        if (!wx.cloud) throw new Error('当前微信版本不支持云服务')
        await wx.cloud.init({ env: config.env, traceUser: true })
      }
      config.backendConfigured = true
      backend.checkEntry(this._entryOptions, config)
      stage = '初始化本次运行后端'
      await initializeBackend(config)
      config.startupState = 'ready'
    })
    // 通知是可选能力；它等待业务就绪，但不会让初始化 Promise 等待自身。
    config.cloudReady.then(() => {
      primeNotificationConfig(true).catch(error => console.warn('通知配置加载失败', error))
      if (retry) wx.reLaunch({ url: '/pages/home/index', fail: error => wx.showToast({ title: backend.errorDetail(error), icon: 'none' }) })
    }, error => {
      config.startupState = 'failed'
      console.error('小程序启动失败', { stage, error })
      wx.showModal({
        title: '后端启动失败', content: `${stage}失败：${backend.errorDetail(error)}。未自动回退或重试业务请求。`,
        confirmText: '重试启动', cancelText: '稍后再试',
        success: result => { if (result.confirm) this.startBackend(true) }
      })
    }).catch(error => console.warn('启动提示或导航失败', error))
    return config.cloudReady
  },

  /** 本机测试切换成功后重建页面栈，避免旧身份、订单和商品留在页面中。 */
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

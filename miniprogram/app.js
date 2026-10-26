const { initLocalData } = require('./utils/api')
const { primeNotificationConfig } = require('./utils/notifications')

App({
  onLaunch() {
    this.globalData = {
      // 填入云开发环境 ID 后，将 useCloud 改为 true 即可使用云端数据。
      env: 'smooth-kiwi-d3gjwm74v84784b65',
      useCloud: true,
      appName: '宿舍补给站',
      cloudReady: Promise.resolve()
    }

    if (wx.cloud) {
      wx.cloud.init({
        env: this.globalData.env || undefined,
        traceUser: true
      })
      if (this.globalData.useCloud) {
        this.globalData.cloudReady = wx.cloud.callFunction({ name: 'snacksApi', data: { action: 'initCollections' } }).catch(error => {
          console.warn('云端集合初始化失败，请确认 snacksApi 已部署：', error)
        })
        this.globalData.cloudReady.then(() => primeNotificationConfig(true))
      }
    }

    initLocalData()
  },

  globalData: {}
})

const api = require('../../utils/api')

Page({
  data: { activeTab: 'schemas', schemas: [], dictionaries: [], loading: true, syncing: false, canSync: false },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const [schemas, dictionaries, identity] = await Promise.all([
        api.request('listCollectionSchemas'),
        api.request('listSystemDictionaries'),
        api.request('getMyIdentity')
      ])
      this.setData({ schemas, dictionaries, canSync: ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(identity.platformRole), loading: false })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },
  switchTab(event) { this.setData({ activeTab: event.currentTarget.dataset.tab }) },
  async syncLabels() {
    if (this.data.syncing) return
    this.setData({ syncing: true }); wx.showLoading({ title: '同步中' })
    try {
      await api.request('syncChineseDescriptions')
      wx.showToast({ title: '中文说明已同步' })
      await this.loadData()
    } catch (error) {
      wx.showToast({ title: error.message || '同步失败', icon: 'none' })
    } finally {
      wx.hideLoading(); this.setData({ syncing: false })
    }
  }
})

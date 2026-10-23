const api = require('../../utils/api')
const { formatTime } = require('../../utils/format')

Page({
  data: { stores: [], loading: true, canManage: false },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const [stores, identity] = await Promise.all([api.request('listAdminStores'), api.request('getMyIdentity')])
      this.setData({ stores: stores.map(item => ({ ...item, updatedAtText: formatTime(item.updatedAt || item.createdAt) })), canManage: ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(identity.platformRole), loading: false })
    } catch (error) { this.setData({ loading: false }); wx.showToast({ title: error.message || '加载失败', icon: 'none' }) }
  },
  preview(event) { wx.navigateTo({ url: `/pages/store/index?id=${event.currentTarget.dataset.id}` }) },
  toggle(event) {
    if (!this.data.canManage) return wx.showToast({ title: '只有管理员可以操作', icon: 'none' })
    const store = this.data.stores.find(item => item._id === event.currentTarget.dataset.id)
    const next = store.platformStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    wx.showModal({ title: next === 'ACTIVE' ? '恢复店铺' : '暂停店铺', content: next === 'ACTIVE' ? '恢复后店铺将重新对学生可见。' : '暂停后店铺将从学生端隐藏且无法接单。', success: async result => { if (!result.confirm) return; try { await api.request('setStorePlatformStatus', { storeId: store._id, platformStatus: next, reason: '管理员后台操作' }); await this.loadData(); wx.showToast({ title: next === 'ACTIVE' ? '已恢复' : '已暂停' }) } catch (error) { wx.showToast({ title: error.message || '操作失败', icon: 'none' }) } } })
  }
})

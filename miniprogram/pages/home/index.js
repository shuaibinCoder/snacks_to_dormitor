const api = require('../../utils/api')
const backend = require('../../utils/backend')
const { decorateStore } = require('../../utils/format')
const { refreshUnreadBadge } = require('../../utils/notifications')

Page({
  data: {
    query: '',
    stores: [],
    loading: true,
    searched: false
  },

  onLoad(options) {
    if (options.storeId) {
      wx.navigateTo({ url: `/pages/store/index?id=${options.storeId}` })
    }
  },

  onShow() {
    this.loadStores()
    refreshUnreadBadge()
  },

  onPullDownRefresh() {
    this.loadStores().finally(() => wx.stopPullDownRefresh())
  },

  async loadStores() {
    this.setData({ loading: true })
    try {
      const stores = await api.request('listStores', { query: this.data.query })
      this.setData({ stores: stores.map(decorateStore), loading: false, searched: !!this.data.query })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  onInput(event) {
    this.setData({ query: event.detail.value })
  },

  onSearch() {
    this.loadStores()
  },

  clearSearch() {
    this.setData({ query: '' }, () => this.loadStores())
  },

  openStore(event) {
    wx.navigateTo({ url: `/pages/store/index?id=${event.currentTarget.dataset.id}` })
  },

  async goOpenStore() {
    try {
      const identity = await api.request('getMyIdentity')
      const approvedStore = identity.store && identity.store.approvalStatus === 'APPROVED'
      wx.navigateTo({ url: approvedStore ? '/pages/merchant/index' : '/pages/merchant-apply/index' })
    } catch (error) {
      wx.showToast({ title: error.message || '身份加载失败', icon: 'none' })
    }
  },

  onShareAppMessage() {
    return {
      title: '宿舍里的零食铺，搜店名就能下单',
      path: backend.withBackend('/pages/home/index')
    }
  }
})

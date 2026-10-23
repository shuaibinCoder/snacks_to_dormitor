const api = require('../../utils/api')
const { money } = require('../../utils/format')

Page({
  data: { store: null, stats: { pending:0, delivering:0, todayOrders:0, todayAmount:0, lowStock:0 }, todayAmountText: '0.00' },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    const store = await api.request('getMyStore')
    if (!store || store.approvalStatus !== 'APPROVED') return wx.redirectTo({ url: '/pages/merchant-apply/index' })
    const stats = await api.request('getMerchantStats')
    this.setData({ store, stats, todayAmountText: money(stats.todayAmount) })
  },
  async toggleOpen() { const store = await api.request('setStoreOpen', { storeId: this.data.store._id, isOpen: !this.data.store.isOpen }); this.setData({ store }); wx.showToast({ title: store.isOpen ? '已开始营业' : '已打烊' }) },
  go(event) { wx.navigateTo({ url: event.currentTarget.dataset.url }) },
  previewStore() { wx.navigateTo({ url: `/pages/store/index?id=${this.data.store._id}` }) },
  onShareAppMessage() { const store = this.data.store; return { title: `${store.name}｜零食送到寝室`, path: `/pages/store/index?id=${store._id}` } }
})

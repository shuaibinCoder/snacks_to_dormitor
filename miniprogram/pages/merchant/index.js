const api = require('../../utils/api')
const { money } = require('../../utils/format')
const { requestSharedSubscription, showSubscribeFeedback, primeNotificationConfig } = require('../../utils/notifications')

Page({
  data: { store: null, unreadCount: 0, stats: { pending:0, delivering:0, todayOrders:0, todayAmount:0, lowStock:0 }, todayAmountText: '0.00' },
  onShow() { this.loadData(); primeNotificationConfig() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    const store = await api.request('getMyStore')
    if (!store || store.approvalStatus !== 'APPROVED') return wx.redirectTo({ url: '/pages/merchant-apply/index' })
    const [stats, unread] = await Promise.all([api.request('getMerchantStats'), api.request('getUnreadNotificationCount')])
    this.setData({ store, stats, unreadCount: Number(unread.total || 0), todayAmountText: money(stats.todayAmount) })
  },
  async toggleOpen() { const willOpen = !this.data.store.isOpen; if (willOpen) await requestSharedSubscription('MERCHANT_START_BUSINESS', 'MERCHANT'); const store = await api.request('setStoreOpen', { storeId: this.data.store._id, isOpen: willOpen }); this.setData({ store }); wx.showToast({ title: store.isOpen ? '已开始营业' : '已打烊' }) },
  async enableMerchantNotice() { const result = await requestSharedSubscription('MERCHANT_MANUAL_ENABLE', 'MERCHANT'); showSubscribeFeedback(result, '已开启一次新订单提醒') },
  goMessages() { wx.navigateTo({ url: '/pages/messages/index' }) },
  go(event) { wx.navigateTo({ url: event.currentTarget.dataset.url }) },
  previewStore() { wx.navigateTo({ url: `/pages/store/index?id=${this.data.store._id}` }) },
  onShareAppMessage() { const store = this.data.store; return { title: `${store.name}｜零食送到寝室`, path: `/pages/store/index?id=${store._id}` } }
})

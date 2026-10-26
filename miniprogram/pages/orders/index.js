const api = require('../../utils/api')
const { decorateOrder } = require('../../utils/format')
const { refreshUnreadBadge } = require('../../utils/notifications')

Page({
  data: { tabs: ['全部', '进行中', '已完成'], activeTab: 0, orders: [], displayOrders: [], loading: true },
  onShow() { this.loadOrders(); refreshUnreadBadge() },
  onPullDownRefresh() { this.loadOrders().finally(() => wx.stopPullDownRefresh()) },
  async loadOrders() {
    try {
      const orders = (await api.request('listOrders', { role: 'buyer' })).map(decorateOrder)
      this.setData({ orders, loading: false }, () => this.filterOrders())
    } catch (error) { this.setData({ loading: false }); wx.showToast({ title: '订单加载失败', icon: 'none' }) }
  },
  switchTab(event) { this.setData({ activeTab: Number(event.currentTarget.dataset.index) }, () => this.filterOrders()) },
  filterOrders() {
    const active = this.data.activeTab
    const displayOrders = this.data.orders.filter(order => active === 0 || (active === 1 && ['CREATED','ACCEPTED','DELIVERING','DELIVERED'].includes(order.status)) || (active === 2 && ['COMPLETED','CANCELED','REJECTED'].includes(order.status)))
    this.setData({ displayOrders })
  },
  openOrder(event) { wx.navigateTo({ url: `/pages/order/index?id=${event.currentTarget.dataset.id}` }) },
  goHome() { wx.switchTab({ url: '/pages/home/index' }) }
})

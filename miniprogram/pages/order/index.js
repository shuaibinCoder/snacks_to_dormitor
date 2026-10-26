const api = require('../../utils/api')
const { decorateOrder, formatTime } = require('../../utils/format')
const { ORDER_STATUS } = require('../../utils/constants')

const nextActions = {
  CREATED: { text: '接单', status: 'ACCEPTED', secondaryText: '拒绝订单', secondaryStatus: 'REJECTED' },
  ACCEPTED: { text: '开始配送', status: 'DELIVERING' },
  DELIVERING: { text: '已送达', status: 'DELIVERED' },
  DELIVERED: { text: '确认订单完成', status: 'COMPLETED' }
}

Page({
  data: { orderId: '', order: null, merchantMode: false, action: null, created: false },
  onLoad(options) { this.setData({ orderId: options.id, merchantMode: options.mode === 'merchant', created: options.created === '1' }); this.loadOrder() },
  onPullDownRefresh() { this.loadOrder().finally(() => wx.stopPullDownRefresh()) },
  async loadOrder() {
    try {
      const raw = await api.request('getOrder', { orderId: this.data.orderId })
      if (!raw) throw new Error('订单不存在')
      const order = decorateOrder(raw)
      order.timeline = (raw.statusHistory || []).map(item => ({ text: (ORDER_STATUS[item.status] || {}).text || item.status, time: formatTime(item.time) })).reverse()
      let action = null
      if (this.data.merchantMode) action = nextActions[order.status] || null
      else if (order.status === 'CREATED') action = { text: '取消订单', status: 'CANCELED', danger: true }
      else if (order.status === 'DELIVERED') action = { text: '确认收货', status: 'COMPLETED' }
      this.setData({ order, action })
    } catch (error) { wx.showToast({ title: error.message || '加载失败', icon: 'none' }) }
  },
  updateStatus(event) {
    const status = event.currentTarget.dataset.status
    const copy = { CANCELED: ['取消订单', '确认取消这个订单吗？'], REJECTED: ['拒绝订单', '拒绝后库存将自动恢复，确认继续吗？'], COMPLETED: ['确认完成', '请确认商品已经交付并完成线下付款。'] }
    const modal = copy[status]
    if (modal) wx.showModal({ title: modal[0], content: modal[1], success: res => { if (res.confirm) this.doUpdate(status) } })
    else this.doUpdate(status)
  },
  async doUpdate(status) {
    wx.showLoading({ title: '处理中' })
    try { await api.request('updateOrderStatus', { orderId: this.data.orderId, status }); await this.loadOrder(); wx.showToast({ title: '操作成功' }) }
    catch (error) { wx.showToast({ title: error.message || '操作失败', icon: 'none' }) }
    finally { wx.hideLoading() }
  },
  callMerchant() {
    if (!this.data.order.phone) return
    wx.makePhoneCall({ phoneNumber: this.data.order.phone })
  },
  goOrders() { wx.switchTab({ url: '/pages/orders/index' }) }
})

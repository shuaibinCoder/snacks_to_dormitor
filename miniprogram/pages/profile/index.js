const api = require('../../utils/api')

Page({
  data: { profile: {}, myStore: null },
  onShow() { this.loadData() },
  async loadData() { this.setData({ profile: api.getProfile() || {}, myStore: await api.request('getMyStore') }) },
  goOrders() { wx.switchTab({ url: '/pages/orders/index' }) },
  goMerchant() { wx.navigateTo({ url: this.data.myStore ? '/pages/merchant/index' : '/pages/merchant-store/index' }) },
  resetDemo() {
    wx.showModal({ title: '重置体验数据', content: '会清空本机订单和你创建的店铺，恢复演示数据。', success: res => { if (res.confirm) { api.resetDemoData(); this.loadData(); wx.showToast({ title: '已重置' }) } } })
  },
  about() { wx.showModal({ title: '宿舍补给站 MVP', content: '搜索学生代理的小店，线上下单，送达后线下付款。\n\n当前版本为MVP体验版。', showCancel: false }) }
})

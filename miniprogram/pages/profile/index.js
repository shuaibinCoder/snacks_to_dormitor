const api = require('../../utils/api')
const { PLATFORM_ROLE_NAMES, decorateApplication } = require('../../utils/roles')
const { refreshUnreadBadge } = require('../../utils/notifications')

Page({
  data: { profile: {}, identity: null, myStore: null, application: null, platformRoleName: '', unreadCount: 0 },
  onShow() { this.loadData() },
  async loadData() {
    try {
      const [identity, unread] = await Promise.all([api.request('getMyIdentity'), api.request('getUnreadNotificationCount')])
      this.setData({
        profile: api.getProfile() || {}, identity, myStore: identity.store || null,
        application: decorateApplication(identity.merchantApplication),
        platformRoleName: PLATFORM_ROLE_NAMES[identity.platformRole] || '',
        unreadCount: Number(unread.total || 0)
      })
      refreshUnreadBadge()
    } catch (error) { wx.showToast({ title: error.message || '身份加载失败', icon: 'none' }) }
  },
  goMessages() { wx.navigateTo({ url: '/pages/messages/index' }) },
  goOrders() { wx.switchTab({ url: '/pages/orders/index' }) },
  goMerchant() {
    if (this.data.myStore && this.data.myStore.approvalStatus === 'APPROVED') wx.navigateTo({ url: '/pages/merchant/index' })
    else wx.navigateTo({ url: '/pages/merchant-apply/index' })
  },
  goAdmin() { wx.navigateTo({ url: '/pages/admin/index' }) },
  copyIdentity() {
    if (!this.data.identity) return
    wx.setClipboardData({ data: this.data.identity.openid, success: () => wx.showToast({ title: '身份ID已复制' }) })
  },
  resetDemo() {
    wx.showModal({ title: '重置体验数据', content: '只影响关闭云端模式时的本机体验数据。', success: res => { if (res.confirm) { api.resetDemoData(); this.loadData(); wx.showToast({ title: '已重置' }) } } })
  },
  about() { wx.showModal({ title: '宿舍补给站 MVP', content: '学生搜索店铺下单，商家经平台联系、线下付款和审核通过后上线。订单送达后双方线下付款。', showCancel: false }) }
})

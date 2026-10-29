const api = require('../../utils/api')
const backend = require('../../utils/backend')
const { PLATFORM_ROLE_NAMES, decorateApplication } = require('../../utils/roles')
const { refreshUnreadBadge } = require('../../utils/notifications')

Page({
  data: { profile: {}, identity: null, myStore: null, application: null, platformRoleName: '', unreadCount: 0, backendLabel: '' },
  onShow() { this.loadData() },
  async loadData() {
    if (this._loading) return
    this._loading = true
    try {
      try { await backend.ready(); this.setData({ backendLabel: backend.label() }) } catch (error) {
        this.setData({ backendLabel: '启动尚未完成' })
      }
      const [identityResult, unreadResult] = await Promise.allSettled([
        api.request('getMyIdentity'), api.request('getUnreadNotificationCount')
      ])
      if (identityResult.status === 'fulfilled') {
        const identity = identityResult.value
        this.setData({
          profile: api.getProfile() || {}, identity, myStore: identity.store || null,
          application: decorateApplication(identity.merchantApplication),
          platformRoleName: PLATFORM_ROLE_NAMES[identity.platformRole] || ''
        })
      } else {
        this.setData({ identity: null, myStore: null, application: null, platformRoleName: '' })
        wx.showToast({ title: backend.errorDetail(identityResult.reason), icon: 'none' })
      }
      this.setData({ unreadCount: unreadResult.status === 'fulfilled' ? Number(unreadResult.value.total || 0) : 0 })
      refreshUnreadBadge()
    } finally {
      this._loading = false
    }
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

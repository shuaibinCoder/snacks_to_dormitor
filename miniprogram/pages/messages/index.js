const api = require('../../utils/api')
const { requestSharedSubscription, showSubscribeFeedback, primeNotificationConfig, refreshUnreadBadge, decorateNotification } = require('../../utils/notifications')

Page({
  data: {
    tabs: [
      { key: 'ALL', text: '全部' },
      { key: 'ORDER', text: '订单' },
      { key: 'MERCHANT_APPLICATION', text: '入驻' },
      { key: 'STORE', text: '店铺' },
      { key: 'PLATFORM', text: '平台' }
    ],
    activeTab: 'ALL', notifications: [], loading: true, unreadCount: 0
  },
  onShow() { this.loadData(); primeNotificationConfig() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const [list, unread] = await Promise.all([
        api.request('listNotifications', { category: this.data.activeTab }),
        api.request('getUnreadNotificationCount')
      ])
      this.setData({ notifications: list.map(decorateNotification), unreadCount: unread.total || 0, loading: false })
      refreshUnreadBadge()
    } catch (error) { this.setData({ loading: false }); wx.showToast({ title: error.message || '消息加载失败', icon: 'none' }) }
  },
  selectTab(event) { this.setData({ activeTab: event.currentTarget.dataset.key }, () => this.loadData()) },
  async openMessage(event) {
    const notification = this.data.notifications.find(item => item._id === event.currentTarget.dataset.id)
    if (!notification) return
    try { if (notification.unread) await api.request('markNotificationRead', { notificationId: notification._id }) } catch (error) { console.warn(error) }
    refreshUnreadBadge()
    if (notification.pagePath) wx.navigateTo({ url: notification.pagePath, fail: () => wx.switchTab({ url: notification.pagePath.split('?')[0] }) })
  },
  markAllRead() {
    if (!this.data.unreadCount) return
    wx.showModal({ title: '全部标记已读', content: '确认将当前账号的所有消息标记为已读吗？', success: async result => { if (!result.confirm) return; try { await api.request('markAllNotificationsRead'); await this.loadData(); wx.showToast({ title: '已全部标记为已读' }) } catch (error) { wx.showToast({ title: error.message || '操作失败', icon: 'none' }) } } })
  },
  async enableWechatNotice() {
    const result = await requestSharedSubscription('MESSAGE_CENTER', 'GENERAL')
    showSubscribeFeedback(result, '已开启一次微信提醒')
  }
})

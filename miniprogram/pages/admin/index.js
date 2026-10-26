const api = require('../../utils/api')
const { PLATFORM_ROLE_NAMES } = require('../../utils/roles')
const { formatTime } = require('../../utils/format')
const { requestSharedSubscription, showSubscribeFeedback, primeNotificationConfig } = require('../../utils/notifications')

Page({
  data: { loading: true, dashboard: null, roleName: '', canApprove: false, canManageTeam: false },
  onShow() { this.loadData(); primeNotificationConfig() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const dashboard = await api.request('getAdminDashboard')
      dashboard.recentLogs = (dashboard.recentLogs || []).map(item => ({ ...item, createdAtText: formatTime(item.createdAt) }))
      this.setData({
        dashboard,
        roleName: PLATFORM_ROLE_NAMES[dashboard.role] || dashboard.role,
        canApprove: ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(dashboard.role),
        canManageTeam: ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(dashboard.role),
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showModal({ title: '无法进入管理后台', content: error.message || '当前微信用户没有平台管理权限', showCancel: false, success: () => wx.navigateBack() })
    }
  },
  go(event) { wx.navigateTo({ url: event.currentTarget.dataset.url }) },
  async enableApprovalNotice() { const result = await requestSharedSubscription('PLATFORM_APPROVAL_NOTICE', 'PLATFORM'); showSubscribeFeedback(result, '已开启一次审批提醒') }
})

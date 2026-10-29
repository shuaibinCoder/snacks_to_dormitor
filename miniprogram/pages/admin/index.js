const api = require('../../utils/api')
const backend = require('../../utils/backend')
const { PLATFORM_ROLE_NAMES } = require('../../utils/roles')
const { formatTime } = require('../../utils/format')

Page({
  data: {
    loading: true, dashboard: null, roleName: '', canApprove: false, canManageTeam: false,
    canSwitchBackend: false, switching: false, backendProvider: '', backendLabel: '',
    cloudRunEnv: '', cloudRunService: '', dashboardError: ''
  },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    if (this.data.switching || this._loading) return
    this._loading = true
    this.setData({ loading: true, canSwitchBackend: false, dashboardError: '' })
    const config = backend.settings()
    this.setData({
      backendProvider: backend.provider(config), backendLabel: backend.label(config),
      cloudRunEnv: (config.cloudRun || {}).env || '', cloudRunService: (config.cloudRun || {}).service || ''
    })
    try {
      await backend.ready(config)
      const dashboard = await api.request('getAdminDashboard')
      dashboard.recentLogs = (dashboard.recentLogs || []).map(item => ({ ...item, createdAtText: formatTime(item.createdAt) }))
      this.setData({
        dashboard, roleName: PLATFORM_ROLE_NAMES[dashboard.role] || dashboard.role,
        canApprove: ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(dashboard.role),
        canManageTeam: ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(dashboard.role),
        canSwitchBackend: config.useCloud && dashboard.role === 'SUPER_ADMIN'
      })
    } catch (error) {
      this.setData({ dashboard: null, roleName: '', canApprove: false, canManageTeam: false,
        dashboardError: backend.errorDetail(error) })
    } finally {
      this._loading = false
      this.setData({ loading: false })
    }
  },
  async changeBackend(event) {
    if (!this.data.canSwitchBackend || this.data.switching || this.data.loading) {
      return
    }
    const target = event.currentTarget.dataset.provider
    if (!['cloudfunction', 'cloudrun'].includes(target) || target === this.data.backendProvider) {
      return
    }
    this.setData({ switching: true })
    let stage = '显示切换确认框'
    try {
      const targetLabel = target === 'cloudrun' ? '云托管 Java' : '原云开发'
      const modal = await new Promise((resolve, reject) => {
        wx.showModal({
          title: `本机切换到${targetLabel}？`,
          content: '仅影响本机本次运行，不影响其他用户。成功后重新进入管理页，冷启动恢复 Java 云托管。两套订单、库存、角色及通知不同步；当前账号须在两套后端都有超级管理员权限。',
          // 微信确认按钮最多允许 4 个汉字，超长会在请求后端之前失败。
          confirmText: '确认切换', success: resolve, fail: reject
        })
      })
      if (!modal.confirm) {
        return
      }
      stage = '检查权限并切换本机后端'
      await getApp().switchBackend(target, this.data.cloudRunService)
    } catch (error) {
      const detail = backend.errorDetail(error)
      console.error('本机后端切换失败', { stage, target, message: detail })
      wx.showModal({ title: '切换失败', content: `${stage}失败：${detail}。本次仍使用${backend.label()}。`, showCancel: false })
    } finally {
      this.setData({ switching: false })
    }
  },
  go(event) {
    if (!this.data.switching) {
      wx.navigateTo({ url: event.currentTarget.dataset.url })
    }
  }
})

const api = require('../../utils/api')
const backend = require('../../utils/backend')
const { PLATFORM_ROLE_NAMES } = require('../../utils/roles')
const { formatTime } = require('../../utils/format')

Page({
  data: {
    loading: true, dashboard: null, roleName: '', canApprove: false, canManageTeam: false,
    canSwitchBackend: false, switching: false, backendProvider: '', backendLabel: '',
    cloudRunEnv: '', cloudRunService: ''
  },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    if (this.data.switching) {
      return
    }
    const config = backend.settings()
    this.setData({
      loading: true, canSwitchBackend: false,
      backendProvider: backend.provider(config), backendLabel: backend.label(config),
      cloudRunEnv: (config.cloudRun || {}).env || '',
      cloudRunService: (config.cloudRun || {}).service || ''
    })
    try {
      const dashboard = await api.request('getAdminDashboard')
      dashboard.recentLogs = (dashboard.recentLogs || []).map(item => ({ ...item, createdAtText: formatTime(item.createdAt) }))
      this.setData({
        dashboard,
        roleName: PLATFORM_ROLE_NAMES[dashboard.role] || dashboard.role,
        canApprove: ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(dashboard.role),
        canManageTeam: ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(dashboard.role),
        canSwitchBackend: dashboard.role === 'SUPER_ADMIN' && backend.provider() !== 'local',
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false, dashboard: null, canSwitchBackend: false })
      wx.showModal({ title: '无法进入管理后台', content: error.message || '当前微信用户没有平台管理权限', showCancel: false, success: () => wx.navigateBack() })
    }
  },
  onServiceInput(event) {
    if (!this.data.switching && this.data.canSwitchBackend) {
      this.setData({ cloudRunService: event.detail.value })
    }
  },
  async changeBackend(event) {
    if (!this.data.canSwitchBackend || this.data.switching || this.data.loading) {
      return
    }
    const target = event.currentTarget.dataset.provider
    if (!['cloudfunction', 'cloudrun'].includes(target) || target === backend.provider()) {
      return
    }
    this.setData({ switching: true })
    let stage = '显示切换确认框'
    try {
      const targetLabel = target === 'cloudrun' ? '云托管 Java' : '原云开发'
      const modal = await new Promise((resolve, reject) => {
        wx.showModal({
          title: `切换到${targetLabel}？`,
          content: '仅影响当前设备的本次运行。两套订单、库存、角色与通知独立，不同步数据；已有页面将关闭，未保存的编辑会丢失。目标后端也须为当前账号配置超级管理员权限。完全退出并重新启动后恢复默认后端。',
          // 微信确认按钮最多允许 4 个汉字，超长会在请求后端之前失败。
          confirmText: '确认切换', success: resolve, fail: reject
        })
      })
      if (!modal.confirm) {
        return
      }
      stage = '校验后端并重载页面'
      await getApp().switchBackend(target, this.data.cloudRunService)
    } catch (error) {
      // 微信 SDK 使用 errMsg，不能只读取 JavaScript Error 的 message。
      const detail = String(error && (error.message || error.errMsg) ||
        (typeof error === 'string' ? error : '') || '切换失败，当前后端保持不变')
      const code = error && (error.errCode === undefined ? error.code : error.errCode)
      const suffix = code === undefined || code === null ? '' : `（${code}）`
      console.error('后端切换失败', { stage, target, message: detail, code })
      wx.showModal({ title: '未切换后端', content: `${stage}失败：${detail}${suffix}`, showCancel: false })
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

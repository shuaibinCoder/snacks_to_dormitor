const api = require('../../utils/api')
const { requestSharedSubscription, showSubscribeFeedback, updateNotificationConfigCache, primeNotificationConfig } = require('../../utils/notifications')
const { formatTime } = require('../../utils/format')

Page({
  data: {
    templateId: '', enabled: false,
    states: ['developer', 'trial', 'formal'], stateNames: ['开发版', '体验版', '正式版'], stateIndex: 1,
    buyerStages: ['ACCEPTED', 'DELIVERED'], buyerStageNames: ['商家接单时通知', '商品送达时通知'], buyerStageIndex: 1,
    titleKey: 'thing1', statusKey: 'phrase2', timeKey: 'time3', remarkKey: 'thing4',
    saving: false, testing: false, diagnostics: null, latestDeliveries: []
  },
  onLoad() { this.loadData() },
  async loadData() {
    try {
      const [config, diagnostics] = await Promise.all([
        api.request('getNotificationAdminConfig'),
        api.request('getMyNotificationDiagnostics')
      ])
      const fields = config.fields || {}
      const stateIndex = Math.max(0, this.data.states.indexOf(config.miniprogramState || 'trial'))
      const buyerStageIndex = Math.max(0, this.data.buyerStages.indexOf(config.buyerOrderPushStage || 'DELIVERED'))
      updateNotificationConfigCache(config)
      this.setData({
        templateId: config.templateId || '', enabled: !!config.enabled, stateIndex, buyerStageIndex,
        titleKey: fields.titleKey || 'thing1', statusKey: fields.statusKey || 'phrase2',
        timeKey: fields.timeKey || 'time3', remarkKey: fields.remarkKey || 'thing4',
        diagnostics: this.decorateDiagnostics(diagnostics),
        latestDeliveries: (diagnostics.latestDeliveries || []).map(item => ({ ...item, createdAtText: formatTime(item.createdAt) }))
      })
    } catch (error) { wx.showToast({ title: error.message || '加载失败', icon: 'none' }) }
  },
  decorateDiagnostics(diagnostics) {
    const roleOrder = ['BUYER']
    const preferences = diagnostics.preferences || []
    const roleNames = { BUYER: '购买者微信提醒' }
    return {
      configReady: !!(diagnostics.config && diagnostics.config.enabled && diagnostics.config.templateId),
      templateId: diagnostics.config && diagnostics.config.templateId || '',
      stateName: diagnostics.config && diagnostics.config.miniprogramState === 'trial' ? '体验版' : diagnostics.config && diagnostics.config.miniprogramState === 'formal' ? '正式版' : '开发版',
      rolePreferences: roleOrder.map(role => {
        const preference = preferences.find(item => (item.subscriptionRole || 'GENERAL') === role) || {}
        return { role, roleName: roleNames[role], permissionLabel: preference.lastPermissionLabel || '尚未授权', grantedCount: Number(preference.grantedCount || 0) }
      })
    }
  },
  onField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  onSwitch(event) { this.setData({ enabled: event.detail.value }) },
  onState(event) { this.setData({ stateIndex: Number(event.detail.value) }) },
  onBuyerStage(event) { this.setData({ buyerStageIndex: Number(event.detail.value) }) },
  async save() {
    if (!this.data.templateId.trim()) return wx.showToast({ title: '请填写微信模板ID', icon: 'none' })
    this.setData({ saving: true })
    try {
      const config = await api.request('saveNotificationTemplate', {
        template: {
          templateId: this.data.templateId.trim(), enabled: this.data.enabled,
          miniprogramState: this.data.states[this.data.stateIndex],
          buyerOrderPushStage: this.data.buyerStages[this.data.buyerStageIndex],
          fields: { titleKey: this.data.titleKey.trim(), statusKey: this.data.statusKey.trim(), timeKey: this.data.timeKey.trim(), remarkKey: this.data.remarkKey.trim() }
        }
      })
      updateNotificationConfigCache(config)
      wx.showToast({ title: '模板配置已保存' })
      await this.loadData()
    } catch (error) { wx.showToast({ title: error.message || '保存失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },
  async testSubscribe() {
    if (this.data.testing) return
    this.setData({ testing: true })
    const result = await requestSharedSubscription('ADMIN_TEMPLATE_TEST', 'BUYER')
    if (result.permission !== 'ACCEPT') {
      showSubscribeFeedback(result, '订阅授权成功')
      this.setData({ testing: false })
      return
    }
    wx.showLoading({ title: '发送测试消息' })
    try {
      const notification = await api.request('sendTestNotification', { subscriptionRole: 'BUYER' })
      if (notification.wechatSent) {
        wx.showModal({ title: '测试消息已发送', content: '请返回微信首页，在“服务通知”中查看测试消息。如果没有立即出现，请稍等片刻。', showCancel: false })
      } else {
        wx.showModal({ title: '授权成功但推送失败', content: '已生成站内测试消息，但微信推送未成功。请查看下方“最近推送记录”的失败原因。', showCancel: false })
      }
      await this.loadData()
    } catch (error) {
      wx.showModal({ title: '测试发送失败', content: error.message || '请检查云函数部署和模板配置。', showCancel: false })
    } finally {
      wx.hideLoading(); this.setData({ testing: false })
    }
  },
  async refreshConfig() { await primeNotificationConfig(true); await this.loadData(); wx.showToast({ title: '配置已刷新' }) }
})

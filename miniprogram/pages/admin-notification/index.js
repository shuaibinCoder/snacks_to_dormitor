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
      return diagnostics
    } catch (error) { wx.showToast({ title: error.message || error.errMsg || '加载失败', icon: 'none' }); return null }
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
  // 只匹配本次通知，避免把另一条历史记录的成功或失败当成本次结果。
  testResult(notification, diagnostics) {
    const delivery = notification._id && ((diagnostics && diagnostics.latestDeliveries) || [])
      .find(item => item.notificationId === notification._id && item.channel === 'WECHAT_SUBSCRIBE')
    if (notification.wechatSent === true || (delivery && delivery.deliveryStatus === 'SUCCESS')) {
      return { title: '测试消息已发送', content: '微信接口已确认成功，请返回微信首页，在“服务通知”中查看；如果未立即出现，请稍等片刻。' }
    }
    const status = delivery && delivery.deliveryStatus
    const code = String(delivery && delivery.lastErrorCode || '')
    const message = delivery && delivery.lastErrorMessage || '尚未取得本次推送的明确结果，请刷新诊断或检查云托管日志。'
    const hints = {
      '-604101': '请在云托管控制台配置云调用权限 /cgi-bin/message/subscribe/send，并核对开放接口服务是否开启。',
      '48001': '请核对当前小程序的订阅消息接口权限及云托管云调用权限。',
      '41001': 'Java 使用云托管免令牌调用，请核对开放接口服务是否开启，并按控制台要求使服务版本配置生效。',
      '40001': '请核对云托管开放接口服务及其所属小程序，不要在前端传入 access_token。',
      '40037': '请核对模板 ID 是否属于当前小程序并已在平台模板列表中启用。',
      '43101': '微信未找到可用订阅次数；先核对模板和账号，再由本人主动授权，不能复用已消耗的授权。',
      '47003': '请核对关键词编号、字段类型和内容长度是否与公众平台模板完全一致。'
    }
    const unknown = !['FAILED_FINAL', 'SKIPPED'].includes(status)
    return {
      title: unknown ? '推送结果尚未确认' : status === 'SKIPPED' ? '测试消息未推送' : '微信推送失败',
      content: `站内测试消息已生成。\n${code ? code + ' · ' : ''}${message}${hints[code] ? '\n\n' + hints[code] : ''}\n\n${unknown ? '请先查看微信“服务通知”，不要连续点击；系统不会自动重发。' : '请处理上述原因后再主动测试，系统不会自动重发。'}`
    }
  },
  async testSubscribe() {
    if (this.data.testing) return
    this.setData({ testing: true })
    try {
      // 授权 API 仍在点击手势中同步调用，前面不插入异步预检。
      const result = await requestSharedSubscription('ADMIN_TEMPLATE_TEST', 'BUYER')
      if (result.permission !== 'ACCEPT') {
        showSubscribeFeedback(result, '订阅授权成功')
        return
      }
      wx.showLoading({ title: '发送测试消息' })
      const notification = await api.request('sendTestNotification', { subscriptionRole: 'BUYER' })
      const diagnostics = await this.loadData()
      wx.hideLoading()
      wx.showModal({ ...this.testResult(notification, diagnostics), showCancel: false })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '测试请求未完成', content: error.message || error.errMsg || '请检查当前后端服务与推送诊断，不要连续点击重试。', showCancel: false })
    } finally {
      this.setData({ testing: false })
    }
  },
  async refreshConfig() { await primeNotificationConfig(true); await this.loadData(); wx.showToast({ title: '配置已刷新' }) }
})

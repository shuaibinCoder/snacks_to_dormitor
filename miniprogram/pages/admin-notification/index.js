const api = require('../../utils/api')
const { requestSharedSubscription } = require('../../utils/notifications')

Page({
  data: { templateId: '', enabled: false, states: ['developer', 'trial', 'formal'], stateNames: ['开发版', '体验版', '正式版'], stateIndex: 0, titleKey: 'thing1', statusKey: 'phrase2', timeKey: 'time3', remarkKey: 'thing4', saving: false },
  onLoad() { this.loadData() },
  async loadData() {
    try {
      const config = await api.request('getNotificationAdminConfig')
      const fields = config.fields || {}
      const stateIndex = Math.max(0, this.data.states.indexOf(config.miniprogramState || 'developer'))
      this.setData({ templateId: config.templateId || '', enabled: !!config.enabled, stateIndex, titleKey: fields.titleKey || 'thing1', statusKey: fields.statusKey || 'phrase2', timeKey: fields.timeKey || 'time3', remarkKey: fields.remarkKey || 'thing4' })
    } catch (error) { wx.showToast({ title: error.message || '加载失败', icon: 'none' }) }
  },
  onField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  onSwitch(event) { this.setData({ enabled: event.detail.value }) },
  onState(event) { this.setData({ stateIndex: Number(event.detail.value) }) },
  async save() {
    if (!this.data.templateId.trim()) return wx.showToast({ title: '请填写微信模板ID', icon: 'none' })
    this.setData({ saving: true })
    try { await api.request('saveNotificationTemplate', { template: { templateId: this.data.templateId.trim(), enabled: this.data.enabled, miniprogramState: this.data.states[this.data.stateIndex], fields: { titleKey: this.data.titleKey.trim(), statusKey: this.data.statusKey.trim(), timeKey: this.data.timeKey.trim(), remarkKey: this.data.remarkKey.trim() } } }); wx.showToast({ title: '模板配置已保存' }) }
    catch (error) { wx.showToast({ title: error.message || '保存失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },
  async testSubscribe() { const result = await requestSharedSubscription('ADMIN_TEMPLATE_TEST'); wx.showToast({ title: result.permission === 'ACCEPT' ? '授权成功' : '未获得授权', icon: 'none' }) }
})

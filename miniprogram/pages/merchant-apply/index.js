const api = require('../../utils/api')
const { decorateApplication } = require('../../utils/roles')
const { money } = require('../../utils/format')
const { requestSharedSubscription } = require('../../utils/notifications')

const EDITABLE_STATUSES = ['DRAFT', 'NEED_MORE_INFO', 'REJECTED', 'CONTACT_FAILED']

Page({
  data: {
    loading: true,
    submitting: false,
    identity: null,
    application: null,
    editable: true,
    storeName: '', ownerName: '', phone: '', wechatContact: '',
    businessHours: '19:00 - 00:00', categoriesText: '零食、饮料',
    serviceDescription: '', notice: '', minimumOrderYuan: '0', deliveryFeeYuan: '0', deliveryMinutes: '15'
  },

  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },

  async loadData() {
    try {
      const identity = await api.request('getMyIdentity')
      const application = decorateApplication(identity.merchantApplication)
      const editable = !application || EDITABLE_STATUSES.includes(application.status)
      const patch = { identity, application, editable, loading: false }
      if (application) {
        Object.assign(patch, {
          storeName: application.storeName || '', ownerName: application.ownerName || '', phone: application.phone || '',
          wechatContact: application.wechatContact || '', businessHours: application.businessHours || '19:00 - 00:00',
          categoriesText: (application.businessCategories || []).join('、'), serviceDescription: application.serviceDescription || '',
          notice: application.notice || '', minimumOrderYuan: money(application.minimumOrder || 0),
          deliveryFeeYuan: money(application.deliveryFee || 0), deliveryMinutes: String(application.deliveryMinutes || 15)
        })
      }
      this.setData(patch)
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  onField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },

  async submit() {
    if (this.data.submitting) return
    if (this.data.storeName.trim().length < 2) return wx.showToast({ title: '店铺名至少2个字', icon: 'none' })
    if (!this.data.ownerName.trim()) return wx.showToast({ title: '请填写经营者姓名', icon: 'none' })
    if (!/^1\d{10}$/.test(this.data.phone)) return wx.showToast({ title: '请输入正确手机号', icon: 'none' })
    this.setData({ submitting: true })
    try {
      await requestSharedSubscription('MERCHANT_APPLICATION_SUBMIT')
      const application = await api.request('submitMerchantApplication', {
        application: {
          storeName: this.data.storeName.trim(), ownerName: this.data.ownerName.trim(), phone: this.data.phone,
          wechatContact: this.data.wechatContact.trim(), businessHours: this.data.businessHours.trim(),
          businessCategories: this.data.categoriesText.split(/[、,，\s]+/).filter(Boolean),
          serviceDescription: this.data.serviceDescription.trim(), notice: this.data.notice.trim(),
          minimumOrder: Math.round(Number(this.data.minimumOrderYuan || 0) * 100),
          deliveryFee: Math.round(Number(this.data.deliveryFeeYuan || 0) * 100),
          deliveryMinutes: Math.max(1, Number(this.data.deliveryMinutes || 15))
        }
      })
      this.setData({ application: decorateApplication(application), editable: false })
      wx.showToast({ title: '申请已提交' })
      await this.loadData()
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' })
    } finally { this.setData({ submitting: false }) }
  },

  callPlatform() {
    wx.showModal({ title: '联系平台', content: '请等待平台工作人员通过你填写的手机号联系。若已与平台建立联系，请按沟通方式完成线下付款。', showCancel: false })
  },

  goMerchant() { wx.redirectTo({ url: '/pages/merchant/index' }) }
})

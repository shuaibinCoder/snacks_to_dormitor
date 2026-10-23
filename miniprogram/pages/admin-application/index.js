const api = require('../../utils/api')
const { decorateApplication, PLATFORM_ROLE_NAMES } = require('../../utils/roles')
const { formatTime, money } = require('../../utils/format')

Page({
  data: { applicationId: '', application: null, payments: [], identity: null, canApprove: false, feeAmountYuan: '0.00', paymentInstruction: '请按电话沟通方式完成线下付款，付款后联系平台确认。', processing: false },
  onLoad(options) { this.setData({ applicationId: options.id }); this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const [detail, identity] = await Promise.all([
        api.request('getMerchantApplicationDetail', { applicationId: this.data.applicationId }),
        api.request('getMyIdentity')
      ])
      const application = decorateApplication(detail.application)
      this.setData({
        application,
        payments: (detail.payments || []).map(item => ({ ...item, amountText: money(item.amount), createdAtText: formatTime(item.createdAt) })),
        identity,
        canApprove: ['PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(identity.platformRole),
        feeAmountYuan: money(application.feeAmount || 0),
        paymentInstruction: application.paymentInstruction || this.data.paymentInstruction
      })
      wx.setNavigationBarTitle({ title: application.storeName })
    } catch (error) { wx.showToast({ title: error.message || '加载失败', icon: 'none' }) }
  },
  onField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  callApplicant() { wx.makePhoneCall({ phoneNumber: this.data.application.phone }) },
  async action(action, payload = {}) {
    if (this.data.processing) return
    this.setData({ processing: true }); wx.showLoading({ title: '处理中' })
    try { await api.request(action, { applicationId: this.data.applicationId, ...payload }); await this.loadData(); wx.showToast({ title: '操作成功' }) }
    catch (error) { wx.showToast({ title: error.message || '操作失败', icon: 'none' }) }
    finally { wx.hideLoading(); this.setData({ processing: false }) }
  },
  markContacted() { this.action('markApplicationContacted') },
  markContactFailed() { this.prompt('联系未成功', '填写联系失败原因', value => this.action('markApplicationContactFailed', { note: value })) },
  setPaymentPending() {
    const feeAmount = Math.max(0, Math.round(Number(this.data.feeAmountYuan || 0) * 100))
    wx.showModal({ title: '设置待付款', content: `确认通知商家线下支付 ¥${money(feeAmount)} 吗？`, success: result => { if (result.confirm) this.action('setPaymentPending', { feeAmount, paymentInstruction: this.data.paymentInstruction }) } })
  },
  confirmPayment() {
    const amount = Math.max(0, Math.round(Number(this.data.feeAmountYuan || 0) * 100))
    wx.showModal({ title: '确认线下收款', content: `确认平台已收到 ¥${money(amount)} 吗？确认后申请将进入最终审核。`, success: result => { if (result.confirm) this.action('confirmOfflinePayment', { amount, paymentMethod: 'WECHAT_OFFLINE' }) } })
  },
  approve() { wx.showModal({ title: '审核通过', content: '确认后将授予商家权限、创建店铺并立即在平台上线。', success: result => { if (result.confirm) this.action('approveMerchantApplication') } }) },
  reject() { this.prompt('审核拒绝', '填写申请人可见的拒绝原因', value => { if (value) this.action('rejectMerchantApplication', { reason: value }) }) },
  requestInfo() { this.prompt('补充资料', '填写申请人需要补充的内容', value => { if (value) this.action('requestMoreInformation', { message: value }) }) },
  prompt(title, placeholder, callback) { wx.showModal({ title, editable: true, placeholderText: placeholder, success: result => { if (result.confirm) callback((result.content || '').trim()) } }) }
})

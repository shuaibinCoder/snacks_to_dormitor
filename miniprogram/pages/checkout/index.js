const api = require('../../utils/api')
const { DELIVERY_METHODS } = require('../../utils/constants')
const { money } = require('../../utils/format')
const { requestSharedSubscription, primeNotificationConfig } = require('../../utils/notifications')

Page({
  data: {
    store: null, items: [], goodsTotal: '0.00', total: '0.00', methods: DELIVERY_METHODS, methodIndex: 0,
    contactName: '', phone: '', location: '', note: '', submitting: false, notificationLoading: true,
    buyerPushLabel: '商品送达时通知', notificationConfigured: false
  },

  onLoad() {
    primeNotificationConfig(true).then(config => {
      this.setData({
        buyerPushLabel: config && config.buyerOrderPushStageLabel || '商品送达时通知',
        notificationConfigured: !!(config && config.enabled && config.templateId),
        notificationLoading: false
      })
    }).catch(() => this.setData({ notificationLoading: false }))
    const pending = wx.getStorageSync('snacks_pending_checkout')
    if (!pending || !pending.store) return wx.navigateBack()
    const profile = api.getProfile() || {}
    const goods = pending.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    this.setData({
      store: pending.store, items: pending.items, goodsTotal: money(goods), total: money(goods + (pending.store.deliveryFee || 0)),
      contactName: profile.contactName || '', phone: profile.phone || '', location: profile.location || ''
    })
  },

  onField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  onMethod(event) { this.setData({ methodIndex: Number(event.detail.value) }) },

  requestBuyerOrderNotice() {
    if (!this.data.notificationConfigured) return Promise.resolve({ permission: 'UNKNOWN', grantId: '' })
    return new Promise(resolve => {
      wx.showModal({
        title: '订阅本单微信提醒',
        content: `是否订阅“${this.data.buyerPushLabel}”？每笔订单需要单独确认，本次授权只用于当前订单。`,
        confirmText: '订阅提醒',
        cancelText: '暂不订阅',
        success: modal => {
          if (!modal.confirm) return resolve({ permission: 'SKIP', grantId: '' })
          // 必须直接在用户点击本弹窗“订阅提醒”的回调中调用微信授权API。
          const request = requestSharedSubscription('ORDER_SUBMIT', 'BUYER')
          request.then(resolve).catch(error => resolve({ permission: 'UNKNOWN', grantId: '', errorMessage: error.message }))
        },
        fail: () => resolve({ permission: 'SKIP', grantId: '' })
      })
    })
  },

  async submitOrder() {
    if (this.data.submitting || this._submitting) return
    const { contactName, phone, location, methodIndex, methods } = this.data
    if (!contactName.trim()) return wx.showToast({ title: '请填写联系人', icon: 'none' })
    if (!/^1\d{10}$/.test(phone)) return wx.showToast({ title: '请输入正确手机号', icon: 'none' })
    if (!location.trim() && methods[methodIndex] !== '到店自取') return wx.showToast({ title: '请填写送达位置', icon: 'none' })
    if (this.data.notificationLoading) return wx.showToast({ title: '微信提醒配置加载中，请稍后再点', icon: 'none' })

    this._submitting = true
    try {
      const subscribeResult = await this.requestBuyerOrderNotice()
      this.setData({ submitting: true })
      if (subscribeResult.permission !== 'ACCEPT' && subscribeResult.permission !== 'SKIP') {
        wx.showToast({ title: subscribeResult.errorMessage || '微信提醒未开启，将使用站内消息', icon: 'none' })
      }

      api.saveProfile(Object.assign({}, api.getProfile(), { contactName, phone, location }))
      const order = await api.request('createOrder', {
        order: {
          storeId: this.data.store._id,
          items: this.data.items.map(item => ({ productId: item._id, quantity: item.quantity })),
          contactName: contactName.trim(), phone, location: location.trim(),
          deliveryMethod: methods[methodIndex], note: this.data.note.trim(),
          buyerNotificationGrantId: subscribeResult.permission === 'ACCEPT' ? String(subscribeResult.grantId || '') : ''
        }
      })
      wx.removeStorageSync('snacks_pending_checkout')
      wx.redirectTo({ url: `/pages/order/index?id=${order._id}&created=1` })
    } catch (error) {
      wx.showToast({ title: error.message || '下单失败', icon: 'none' })
    } finally {
      this._submitting = false
      this.setData({ submitting: false })
    }
  }
})

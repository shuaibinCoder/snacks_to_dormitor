const api = require('../../utils/api')
const { DELIVERY_METHODS } = require('../../utils/constants')
const { money } = require('../../utils/format')
const { requestSharedSubscription } = require('../../utils/notifications')

Page({
  data: {
    store: null, items: [], goodsTotal: '0.00', total: '0.00', methods: DELIVERY_METHODS, methodIndex: 0,
    contactName: '', phone: '', location: '', note: '', submitting: false
  },

  onLoad() {
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

  async submitOrder() {
    if (this.data.submitting) return
    const { contactName, phone, location, methodIndex, methods } = this.data
    if (!contactName.trim()) return wx.showToast({ title: '请填写联系人', icon: 'none' })
    if (!/^1\d{10}$/.test(phone)) return wx.showToast({ title: '请输入正确手机号', icon: 'none' })
    if (!location.trim() && methods[methodIndex] !== '到店自取') return wx.showToast({ title: '请填写送达位置', icon: 'none' })

    this.setData({ submitting: true })
    try {
      await requestSharedSubscription('ORDER_SUBMIT')
      api.saveProfile(Object.assign({}, api.getProfile(), { contactName, phone, location }))
      const order = await api.request('createOrder', {
        order: {
          storeId: this.data.store._id,
          items: this.data.items.map(item => ({ productId: item._id, quantity: item.quantity })),
          contactName: contactName.trim(), phone, location: location.trim(),
          deliveryMethod: methods[methodIndex], note: this.data.note.trim()
        }
      })
      wx.removeStorageSync('snacks_pending_checkout')
      wx.redirectTo({ url: `/pages/order/index?id=${order._id}&created=1` })
    } catch (error) {
      wx.showToast({ title: error.message || '下单失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})

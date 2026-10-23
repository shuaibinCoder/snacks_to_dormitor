const api = require('../../utils/api')
const { money } = require('../../utils/format')

Page({
  data: { store: null, name: '', ownerName: '', phone: '', notice: '', businessHours: '19:00 - 00:00', minimumOrderYuan: '0', deliveryFeeYuan: '0', deliveryMinutes: '15', saving: false },
  async onLoad() {
    const store = await api.request('getMyStore')
    if (!store || store.approvalStatus !== 'APPROVED') return wx.redirectTo({ url: '/pages/merchant-apply/index' })
    if (store) this.setData({ store, name: store.name, ownerName: store.ownerName, phone: store.phone, notice: store.notice, businessHours: store.businessHours, minimumOrderYuan: money(store.minimumOrder), deliveryFeeYuan: money(store.deliveryFee), deliveryMinutes: String(store.deliveryMinutes) })
    wx.setNavigationBarTitle({ title: store ? '店铺设置' : '开设小店' })
  },
  onField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  async save() {
    if (this.data.saving) return
    if (this.data.name.trim().length < 2) return wx.showToast({ title: '店铺名至少2个字', icon: 'none' })
    if (!this.data.ownerName.trim()) return wx.showToast({ title: '请填写经营者姓名', icon: 'none' })
    if (!/^1\d{10}$/.test(this.data.phone)) return wx.showToast({ title: '请输入正确手机号', icon: 'none' })
    this.setData({ saving: true })
    try {
      const store = await api.request('saveStore', { store: { _id: this.data.store && this.data.store._id, name: this.data.name.trim(), ownerName: this.data.ownerName.trim(), phone: this.data.phone, notice: this.data.notice.trim() || '欢迎光临我的宿舍小店', businessHours: this.data.businessHours.trim(), minimumOrder: Math.max(0, Math.round(Number(this.data.minimumOrderYuan || 0) * 100)), deliveryFee: Math.max(0, Math.round(Number(this.data.deliveryFeeYuan || 0) * 100)), deliveryMinutes: Math.max(1, Number(this.data.deliveryMinutes || 15)) } })
      wx.showToast({ title: this.data.store ? '保存成功' : '开店成功' })
      setTimeout(() => wx.redirectTo({ url: '/pages/merchant/index' }), 500)
      this.setData({ store })
    } catch (error) { wx.showToast({ title: error.message || '保存失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  }
})

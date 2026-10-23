const api = require('../../utils/api')
const { PLATFORM_ROLE_NAMES } = require('../../utils/roles')

Page({
  data: { identity: null, users: [], roles: ['PLATFORM_OPERATOR', 'PLATFORM_ADMIN'], roleNames: ['平台运营', '平台管理员'], roleIndex: 0, openid: '', displayName: '', phone: '', saving: false },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const [users, identity] = await Promise.all([api.request('listPlatformUsers'), api.request('getMyIdentity')])
      const canCreateAdmin = identity.platformRole === 'SUPER_ADMIN'
      this.setData({
        users: users.map(item => ({ ...item, roleName: PLATFORM_ROLE_NAMES[item.role] || item.role })),
        identity,
        roles: canCreateAdmin ? ['PLATFORM_OPERATOR', 'PLATFORM_ADMIN'] : ['PLATFORM_OPERATOR'],
        roleNames: canCreateAdmin ? ['平台运营', '平台管理员'] : ['平台运营'],
        roleIndex: 0
      })
    } catch (error) { wx.showToast({ title: error.message || '加载失败', icon: 'none' }) }
  },
  onField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  onRole(event) { this.setData({ roleIndex: Number(event.detail.value) }) },
  async save() {
    if (!this.data.openid.trim()) return wx.showToast({ title: '请填写身份ID', icon: 'none' })
    this.setData({ saving: true })
    try {
      await api.request('savePlatformUser', { platformUser: { openid: this.data.openid.trim(), displayName: this.data.displayName.trim(), phone: this.data.phone.trim(), role: this.data.roles[this.data.roleIndex], status: 'ACTIVE' } })
      this.setData({ openid: '', displayName: '', phone: '' }); await this.loadData(); wx.showToast({ title: '权限已保存' })
    } catch (error) { wx.showToast({ title: error.message || '保存失败', icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  }
})

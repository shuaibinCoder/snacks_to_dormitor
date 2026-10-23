const api = require('../../utils/api')
const { decorateApplication } = require('../../utils/roles')
const { formatTime } = require('../../utils/format')

Page({
  data: {
    filters: [
      { key: 'ALL', text: '全部' }, { key: 'SUBMITTED', text: '待联系' },
      { key: 'PAYMENT_PENDING', text: '待付款' }, { key: 'PAID', text: '待审核' },
      { key: 'APPROVED', text: '已通过' }
    ],
    activeFilter: 'ALL', applications: [], loading: true
  },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    try {
      const list = await api.request('listMerchantApplications', { status: this.data.activeFilter })
      this.setData({ applications: list.map(item => ({ ...decorateApplication(item), updatedAtText: formatTime(item.updatedAt) })), loading: false })
    } catch (error) { this.setData({ loading: false }); wx.showToast({ title: error.message || '加载失败', icon: 'none' }) }
  },
  selectFilter(event) { this.setData({ activeFilter: event.currentTarget.dataset.key }, () => this.loadData()) },
  openDetail(event) { wx.navigateTo({ url: `/pages/admin-application/index?id=${event.currentTarget.dataset.id}` }) }
})

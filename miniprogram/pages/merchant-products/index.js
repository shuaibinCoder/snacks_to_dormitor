const api = require('../../utils/api')
const { decorateProduct, decorateOrder } = require('../../utils/format')

Page({
  data: { activeTab: 'products', store: null, products: [], orders: [], orderFilter: 'all' },
  onLoad(options) { if (options.tab === 'orders') this.setData({ activeTab: 'orders' }) },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    const store = await api.request('getMyStore')
    if (!store || store.approvalStatus !== 'APPROVED') return wx.redirectTo({ url: '/pages/merchant-apply/index' })
    const [products, orders] = await Promise.all([api.request('listProducts', { storeId: store._id }), api.request('listOrders', { role: 'merchant' })])
    this.setData({ store, products: products.map(decorateProduct), orders: orders.map(decorateOrder) })
  },
  switchTab(event) { this.setData({ activeTab: event.currentTarget.dataset.tab }); wx.setNavigationBarTitle({ title: event.currentTarget.dataset.tab === 'products' ? '商品库存' : '订单管理' }) },
  editProduct(event) { const id = event.currentTarget.dataset.id; wx.navigateTo({ url: `/pages/merchant-product/index${id ? '?id=' + id : ''}` }) },
  toggleProduct(event) {
    const item = this.data.products.find(product => product._id === event.currentTarget.dataset.id)
    if (!item) return
    const nextStatus = item.status === 'ON' ? 'OFF' : 'ON'
    wx.showModal({
      title: nextStatus === 'ON' ? '上架商品' : '下架商品',
      content: nextStatus === 'ON'
        ? `确认上架“${item.name}”吗？上架后学生可以在店铺中看到并下单。`
        : `确认下架“${item.name}”吗？下架后学生将看不到该商品。`,
      success: async result => {
        if (!result.confirm) return
        try {
          await api.request('toggleProduct', { productId: item._id, status: nextStatus })
          await this.loadData()
          wx.showToast({ title: nextStatus === 'ON' ? '已上架' : '已下架' })
        } catch (error) {
          wx.showToast({ title: error.message || '操作失败', icon: 'none' })
        }
      }
    })
  },
  openOrder(event) { wx.navigateTo({ url: `/pages/order/index?id=${event.currentTarget.dataset.id}&mode=merchant` }) }
})

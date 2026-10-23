const api = require('../../utils/api')
const { decorateProduct, decorateOrder } = require('../../utils/format')

Page({
  data: { activeTab: 'products', store: null, products: [], orders: [], orderFilter: 'all' },
  onLoad(options) { if (options.tab === 'orders') this.setData({ activeTab: 'orders' }) },
  onShow() { this.loadData() },
  onPullDownRefresh() { this.loadData().finally(() => wx.stopPullDownRefresh()) },
  async loadData() {
    const store = await api.request('getMyStore')
    if (!store) return wx.redirectTo({ url: '/pages/merchant-store/index' })
    const [products, orders] = await Promise.all([api.request('listProducts', { storeId: store._id }), api.request('listOrders', { role: 'merchant' })])
    this.setData({ store, products: products.map(decorateProduct), orders: orders.map(decorateOrder) })
  },
  switchTab(event) { this.setData({ activeTab: event.currentTarget.dataset.tab }); wx.setNavigationBarTitle({ title: event.currentTarget.dataset.tab === 'products' ? '商品库存' : '订单管理' }) },
  editProduct(event) { const id = event.currentTarget.dataset.id; wx.navigateTo({ url: `/pages/merchant-product/index${id ? '?id=' + id : ''}` }) },
  async toggleProduct(event) { const item = this.data.products.find(p => p._id === event.currentTarget.dataset.id); await api.request('toggleProduct', { productId: item._id, status: item.status === 'ON' ? 'OFF' : 'ON' }); this.loadData() },
  openOrder(event) { wx.navigateTo({ url: `/pages/order/index?id=${event.currentTarget.dataset.id}&mode=merchant` }) }
})

const api = require('../../utils/api')
const backend = require('../../utils/backend')
const { decorateStore, decorateProduct, money } = require('../../utils/format')

Page({
  data: {
    storeId: '', store: null, products: [], categories: [], activeCategory: '全部', displayProducts: [],
    cartMap: {}, cartItems: [], cartCount: 0, cartTotal: '0.00', loading: true, loadError: ''
  },

  onLoad(options) {
    this.setData({ storeId: options.id || '' })
    this.loadStore()
  },

  onShow() {
    if (this._hasLoaded && this.data.storeId) this.loadStore()
  },

  onPullDownRefresh() {
    this.loadStore().finally(() => wx.stopPullDownRefresh())
  },

  async loadStore() {
    if (!this.data.storeId) return
    try {
      this.setData({ loadError: '' })
      const result = await api.request('getStore', { storeId: this.data.storeId })
      const products = result.products.map(decorateProduct)
      const categories = ['全部', ...Array.from(new Set(products.map(item => item.category)))]
      wx.setNavigationBarTitle({ title: result.store.name })
      this._hasLoaded = true
      this.setData({ store: decorateStore(result.store), products, categories, loading: false }, () => this.filterProducts())
    } catch (error) {
      this.setData({ loading: false, loadError: error.message || '店铺加载失败' })
      wx.showToast({ title: error.message || '店铺加载失败', icon: 'none' })
    }
  },

  selectCategory(event) {
    this.setData({ activeCategory: event.currentTarget.dataset.category }, () => this.filterProducts())
  },

  filterProducts() {
    const displayProducts = this.data.products
      .filter(item => this.data.activeCategory === '全部' || item.category === this.data.activeCategory)
      .map(item => Object.assign({}, item, { cartQuantity: this.data.cartMap[item._id] || 0 }))
    this.setData({ displayProducts })
  },

  changeCart(event) {
    const productId = event.currentTarget.dataset.id
    const delta = Number(event.currentTarget.dataset.delta)
    const product = this.data.products.find(item => item._id === productId)
    const cartMap = Object.assign({}, this.data.cartMap)
    const next = Math.max(0, Math.min(product.stock, Number(cartMap[productId] || 0) + delta))
    if (next === product.stock && delta > 0) wx.showToast({ title: '已经是全部库存啦', icon: 'none' })
    if (next) cartMap[productId] = next
    else delete cartMap[productId]
    this.setData({ cartMap }, () => { this.rebuildCart(); this.filterProducts() })
  },

  rebuildCart() {
    const cartItems = this.data.products.filter(item => this.data.cartMap[item._id]).map(item => ({ ...item, quantity: this.data.cartMap[item._id] }))
    const count = cartItems.reduce((sum, item) => sum + item.quantity, 0)
    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    this.setData({ cartItems, cartCount: count, cartTotal: money(total) })
  },

  goCheckout() {
    if (!this.data.store.isOpen) return wx.showToast({ title: '店铺已打烊', icon: 'none' })
    if (!this.data.cartCount) return
    const total = this.data.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
    if (total < this.data.store.minimumOrder) return wx.showToast({ title: `还差${money(this.data.store.minimumOrder - total)}元起送`, icon: 'none' })
    backend.savePendingCheckout({ store: this.data.store, items: this.data.cartItems })
    wx.navigateTo({ url: '/pages/checkout/index' })
  },

  onShareAppMessage() {
    const store = this.data.store
    return { title: store ? `${store.name}｜宿舍零食送到门口` : '宿舍零食铺', path: backend.withBackend(`/pages/store/index?id=${this.data.storeId}`) }
  }
})

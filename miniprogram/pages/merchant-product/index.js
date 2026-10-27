const api = require('../../utils/api')
const { PRODUCT_EMOJIS } = require('../../utils/constants')
const { money } = require('../../utils/format')

Page({
  data: { store: null, product: null, name: '', category: '零食', priceYuan: '', stock: '', emoji: '🍪', image: '', uploading: false, categories: ['零食','饮料','泡面','日用','其他'], categoryIndex: 0, emojis: PRODUCT_EMOJIS, saving: false },
  async onLoad(options) {
    const store = await api.request('getMyStore'); this.setData({ store })
    if (options.id) { const product = await api.request('getProduct', { productId: options.id }); const categoryIndex = Math.max(0, this.data.categories.indexOf(product.category)); this.setData({ product, name: product.name, category: product.category, categoryIndex, priceYuan: money(product.price), stock: String(product.stock), emoji: product.emoji, image: product.image || '' }) }
    wx.setNavigationBarTitle({ title: options.id ? '编辑商品' : '添加商品' })
  },
  onField(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value }) },
  onCategory(event) { const index = Number(event.detail.value); this.setData({ categoryIndex:index, category:this.data.categories[index] }) },
  selectEmoji(event) { this.setData({ emoji: event.currentTarget.dataset.emoji, image: '' }) },
  chooseImage() {
    wx.chooseMedia({ count: 1, mediaType: ['image'], sourceType: ['album', 'camera'], success: async result => {
      const tempFilePath = result.tempFiles[0].tempFilePath
      this.setData({ uploading: true })
      try {
        const image = await api.uploadProductImage(tempFilePath)
        this.setData({ image })
      } catch (error) {
        wx.showToast({ title: '图片保存失败', icon: 'none' })
      } finally {
        this.setData({ uploading: false })
      }
    } })
  },
  async save() {
    if (!this.data.name.trim()) return wx.showToast({ title:'请填写商品名称',icon:'none' })
    if (!(Number(this.data.priceYuan)>0)) return wx.showToast({ title:'价格需要大于0',icon:'none' })
    if (Number(this.data.stock)<0 || this.data.stock==='') return wx.showToast({ title:'请填写库存',icon:'none' })
    this.setData({saving:true})
    try { await api.request('saveProduct',{product:{_id:this.data.product&&this.data.product._id,storeId:this.data.store._id,version:this.data.product&&this.data.product.version,name:this.data.name.trim(),category:this.data.category,price:Math.round(Number(this.data.priceYuan)*100),stock:Math.floor(Number(this.data.stock)),emoji:this.data.emoji,image:this.data.image,status:this.data.product?this.data.product.status:'ON'}}); wx.showToast({title:'保存成功'}); setTimeout(()=>wx.navigateBack(),400) }
    catch(error){wx.showToast({title:error.message||'保存失败',icon:'none'})}
    finally{this.setData({saving:false})}
  }
})

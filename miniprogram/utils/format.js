const { ORDER_STATUS } = require('./constants')

function money(cents) {
  return (Number(cents || 0) / 100).toFixed(2)
}

function formatTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const pad = n => String(n).padStart(2, '0')
  return `${date.getMonth() + 1}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function decorateStore(store) {
  return Object.assign({}, store, {
    minimumOrderText: money(store.minimumOrder || 0),
    deliveryFeeText: store.deliveryFee ? money(store.deliveryFee) : '免配送费'
  })
}

function decorateProduct(product) {
  return Object.assign({}, product, { priceText: money(product.price) })
}

function decorateOrder(order) {
  const status = ORDER_STATUS[order.status] || { text: order.status, className: 'status-muted' }
  return Object.assign({}, order, {
    statusText: status.text,
    statusClass: status.className,
    totalText: money(order.totalAmount),
    goodsAmountText: money(order.goodsAmount),
    deliveryFeeText: money(order.deliveryFee),
    createdAtText: formatTime(order.createdAt),
    items: (order.items || []).map(item => Object.assign({}, item, {
      priceText: money(item.price),
      subtotalText: money(item.price * item.quantity)
    }))
  })
}

module.exports = { money, formatTime, decorateStore, decorateProduct, decorateOrder }

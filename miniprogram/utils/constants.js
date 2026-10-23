const ORDER_STATUS = {
  CREATED: { text: '待商家接单', className: 'status-warn' },
  ACCEPTED: { text: '备货中', className: 'status-info' },
  DELIVERING: { text: '配送中', className: 'status-info' },
  DELIVERED: { text: '待确认收货', className: 'status-warn' },
  COMPLETED: { text: '已完成', className: 'status-success' },
  CANCELED: { text: '已取消', className: 'status-muted' },
  REJECTED: { text: '商家已拒单', className: 'status-muted' }
}

const DELIVERY_METHODS = ['送到寝室门口', '楼层公共区域交付', '送到一楼', '到店自取']
const PRODUCT_EMOJIS = ['🥤', '🍜', '🍪', '🍫', '🥛', '🍬', '🧻', '🔌', '🥔', '🍞']

module.exports = { ORDER_STATUS, DELIVERY_METHODS, PRODUCT_EMOJIS }

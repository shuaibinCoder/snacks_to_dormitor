const DICTIONARY_VERSION = '2026-10-23-v3'

const DICTIONARIES = {
  USER_ROLE: {
    name: '用户角色',
    description: '决定普通微信用户可以使用哪些业务功能。一个用户可以同时拥有多个角色。',
    items: [
      { code: 'CUSTOMER', label: '普通用户', description: '可以搜索店铺、浏览商品、下单和查看自己的订单。' },
      { code: 'MERCHANT_OWNER', label: '商家店主', description: '商家入驻审核通过后获得，可以管理自己的店铺、商品和订单。' }
    ]
  },
  PLATFORM_ROLE: {
    name: '平台角色',
    description: '决定微信用户是否可以进入平台运营后台以及可以执行哪些管理操作。',
    items: [
      { code: 'PLATFORM_OPERATOR', label: '平台运营', description: '可以联系申请人、登记付款、查看店铺，但不能最终审核商家。' },
      { code: 'PLATFORM_ADMIN', label: '平台管理员', description: '可以审核商家、暂停店铺、管理平台运营人员。' },
      { code: 'SUPER_ADMIN', label: '超级管理员', description: '平台最高权限，通常由开发者持有，可以分配管理员权限。' }
    ]
  },
  ACCOUNT_STATUS: {
    name: '账号状态',
    description: '用户或平台人员账号是否可以正常使用。',
    items: [
      { code: 'ACTIVE', label: '正常', description: '账号可正常使用相应权限。' },
      { code: 'DISABLED', label: '已停用', description: '账号权限已被停用。' }
    ]
  },
  APPLICATION_STATUS: {
    name: '商家申请状态',
    description: '商家从提交申请到正式上线所处的审批阶段。',
    items: [
      { code: 'DRAFT', label: '草稿', description: '申请尚未正式提交。' },
      { code: 'SUBMITTED', label: '待平台联系', description: '申请已提交，等待平台工作人员电话联系。' },
      { code: 'CONTACT_FAILED', label: '联系未成功', description: '平台暂时没有联系到申请人。' },
      { code: 'CONTACTED', label: '已完成联系', description: '平台已经完成电话沟通，等待确认入驻和付款信息。' },
      { code: 'NEED_MORE_INFO', label: '待补充资料', description: '申请人需要修改或补充资料后重新提交。' },
      { code: 'PAYMENT_PENDING', label: '待线下付款', description: '等待申请人按照平台说明完成线下付款。' },
      { code: 'PAID', label: '已付款待审核', description: '平台已经确认收款，等待管理员最终审核。' },
      { code: 'APPROVED', label: '审核通过', description: '商家已通过审核并获得店铺经营权限。' },
      { code: 'REJECTED', label: '审核未通过', description: '商家申请被管理员拒绝。' },
      { code: 'SUSPENDED', label: '申请已暂停', description: '已通过的商家申请或资格被暂停。' }
    ]
  },
  STORE_APPROVAL_STATUS: {
    name: '店铺审批状态',
    description: '表示店铺是否通过平台入驻审批。',
    items: [
      { code: 'PENDING', label: '待审核', description: '店铺尚未通过平台审核，不能公开展示。' },
      { code: 'APPROVED', label: '审核通过', description: '店铺已通过平台审核。' },
      { code: 'REJECTED', label: '审核拒绝', description: '店铺未通过平台审核。' }
    ]
  },
  STORE_PLATFORM_STATUS: {
    name: '店铺平台状态',
    description: '平台对店铺实施的运营治理状态。',
    items: [
      { code: 'ACTIVE', label: '平台正常', description: '店铺可以在平台展示和经营。' },
      { code: 'SUSPENDED', label: '平台暂停', description: '店铺被平台临时暂停，不能展示或接单。' },
      { code: 'BANNED', label: '平台封禁', description: '店铺因严重违规被平台封禁。' }
    ]
  },
  STORE_BUSINESS_STATUS: {
    name: '店铺营业状态',
    description: '由商家控制的当前营业状态。',
    items: [
      { code: 'OPEN', label: '营业中', description: '店铺当前可以接受订单。' },
      { code: 'CLOSED', label: '已打烊', description: '店铺当前不接受新订单。' }
    ]
  },
  PRODUCT_STATUS: {
    name: '商品状态',
    description: '商品是否在学生端公开展示和允许下单。',
    items: [
      { code: 'ON', label: '已上架', description: '商品可以在店铺中展示并下单。' },
      { code: 'OFF', label: '已下架', description: '商品不会在学生端展示。' }
    ]
  },
  ORDER_STATUS: {
    name: '订单履约状态',
    description: '订单从提交到完成所处的履约阶段。',
    items: [
      { code: 'CREATED', label: '待商家接单', description: '用户已提交订单，等待商家确认。' },
      { code: 'ACCEPTED', label: '备货中', description: '商家已接单并开始备货。' },
      { code: 'READY', label: '待自取', description: '自取订单已经准备完成。' },
      { code: 'DELIVERING', label: '配送中', description: '商家正在配送商品。' },
      { code: 'DELIVERED', label: '待确认收货', description: '商家已交付，等待用户确认。' },
      { code: 'COMPLETED', label: '已完成', description: '商品已交付并完成线下付款确认。' },
      { code: 'CANCELED', label: '用户已取消', description: '订单被购买者取消，库存已恢复。' },
      { code: 'REJECTED', label: '商家已拒单', description: '商家拒绝订单，库存已恢复。' },
      { code: 'TIMEOUT_CLOSED', label: '超时关闭', description: '商家未及时接单，系统关闭订单。' },
      { code: 'DISPUTED', label: '争议处理中', description: '订单存在投诉或付款争议。' },
      { code: 'CLOSED', label: '异常关闭', description: '订单由平台结束处理。' }
    ]
  },
  CONTACT_RESULT: {
    name: '电话联系结果',
    description: '平台运营人员联系商家申请人的结果。',
    items: [
      { code: 'CONTACTED', label: '联系成功', description: '已经通过电话或其他约定方式联系到申请人。' },
      { code: 'CONTACT_FAILED', label: '联系未成功', description: '本次没有成功联系到申请人。' }
    ]
  },
  PAYMENT_STATUS: {
    name: '付款记录状态',
    description: '商家入驻线下付款记录的确认状态。',
    items: [
      { code: 'PENDING', label: '待确认', description: '付款记录等待平台核实。' },
      { code: 'CONFIRMED', label: '已确认', description: '平台已经确认收到线下付款。' },
      { code: 'REJECTED', label: '确认失败', description: '付款记录未通过平台核实。' }
    ]
  },
  PAYMENT_METHOD: {
    name: '付款方式',
    description: '商家向平台支付入驻费用的线下方式。',
    items: [
      { code: 'WECHAT_OFFLINE', label: '微信线下转账', description: '双方通过微信私下完成转账，平台仅登记结果。' },
      { code: 'ALIPAY_OFFLINE', label: '支付宝线下转账', description: '双方通过支付宝私下完成转账。' },
      { code: 'CASH', label: '现金', description: '双方通过现金完成付款。' },
      { code: 'OTHER', label: '其他方式', description: '由平台备注说明的其他线下付款方式。' }
    ]
  },
  AUDIT_ACTION: {
    name: '平台操作类型',
    description: '平台人员在运营后台执行的重要操作。',
    items: [
      { code: 'MARK_APPLICATION_CONTACTED', label: '标记申请已联系', description: '平台人员确认已经电话联系申请人。' },
      { code: 'MARK_APPLICATION_CONTACT_FAILED', label: '标记联系未成功', description: '平台人员没有成功联系申请人。' },
      { code: 'REQUEST_MORE_INFORMATION', label: '要求补充资料', description: '平台要求申请人补充或修改入驻资料。' },
      { code: 'SET_PAYMENT_PENDING', label: '设置待线下付款', description: '平台设置入驻费用和付款说明。' },
      { code: 'CONFIRM_OFFLINE_PAYMENT', label: '确认线下收款', description: '平台确认已经收到申请人的线下付款。' },
      { code: 'APPROVE_MERCHANT_APPLICATION', label: '审核通过商家申请', description: '管理员批准申请并上线店铺。' },
      { code: 'REJECT_MERCHANT_APPLICATION', label: '拒绝商家申请', description: '管理员拒绝商家入驻申请。' },
      { code: 'SUSPEND_STORE', label: '暂停店铺', description: '管理员暂停店铺展示和接单。' },
      { code: 'RESUME_STORE', label: '恢复店铺', description: '管理员恢复店铺展示和接单资格。' },
      { code: 'SAVE_PLATFORM_USER', label: '配置平台人员权限', description: '新增或修改平台运营、管理员角色。' },
      { code: 'SYNC_CHINESE_DESCRIPTIONS', label: '同步数据库中文说明', description: '将枚举中文名称和说明同步到现有数据库记录。' }
    ]
  },
  AUDIT_TARGET_TYPE: {
    name: '平台操作对象类型',
    description: '审计日志中的操作目标属于哪一种业务数据。',
    items: [
      { code: 'MERCHANT_APPLICATION', label: '商家入驻申请', description: '操作对象是商家申请记录。' },
      { code: 'STORE', label: '店铺', description: '操作对象是店铺记录。' },
      { code: 'PRODUCT', label: '商品', description: '操作对象是商品记录。' },
      { code: 'ORDER', label: '订单', description: '操作对象是订单记录。' },
      { code: 'PLATFORM_USER', label: '平台人员', description: '操作对象是平台运营或管理员账号。' },
      { code: 'SYSTEM_DICTIONARY', label: '系统数据字典', description: '操作对象是数据库字段和枚举中文说明。' }
    ]
  }
}

function getEnumItem(type, code) {
  const dictionary = DICTIONARIES[type]
  return dictionary ? dictionary.items.find(item => item.code === code) || null : null
}

function getEnumLabel(type, code) {
  const item = getEnumItem(type, code)
  return item ? item.label : code || ''
}

function dictionaryDocuments() {
  return Object.keys(DICTIONARIES).map(type => ({
    _id: type,
    type,
    name: DICTIONARIES[type].name,
    description: DICTIONARIES[type].description,
    items: DICTIONARIES[type].items,
    version: DICTIONARY_VERSION,
    updatedAt: Date.now()
  }))
}

module.exports = { DICTIONARY_VERSION, DICTIONARIES, getEnumItem, getEnumLabel, dictionaryDocuments }

const SCHEMA_VERSION = '2026-10-23-v3'

const COLLECTION_SCHEMAS = {
  users: {
    name: '用户',
    description: '保存每个微信用户的基础业务身份和普通业务角色。',
    fields: [
      { field: '_id', label: '记录ID', type: 'string', description: '云数据库自动生成的用户记录唯一ID。' },
      { field: 'openid', label: '微信用户身份ID', type: 'string', description: '当前小程序下微信用户的唯一身份，只能由云函数获取。' },
      { field: 'roles', label: '用户角色编码', type: 'string[]', enumType: 'USER_ROLE', description: '用户拥有的普通业务角色编码数组。' },
      { field: 'roleLabels', label: '用户角色中文名称', type: 'string[]', description: 'roles中每个角色对应的中文名称。' },
      { field: 'status', label: '账号状态编码', type: 'string', enumType: 'ACCOUNT_STATUS', description: '账号是否可以正常使用。' },
      { field: 'statusLabel', label: '账号状态中文名称', type: 'string', description: 'status对应的中文名称。' },
      { field: 'createdAt', label: '创建时间', type: 'number', description: '记录创建时的毫秒时间戳。' },
      { field: 'updatedAt', label: '更新时间', type: 'number', description: '记录最后修改时的毫秒时间戳。' }
    ]
  },
  platform_users: {
    name: '平台人员',
    description: '保存平台运营、管理员和超级管理员权限。',
    fields: [
      { field: 'openid', label: '微信用户身份ID', type: 'string', description: '被授予平台权限的微信用户OPENID。' },
      { field: 'role', label: '平台角色编码', type: 'string', enumType: 'PLATFORM_ROLE', description: '决定平台后台管理权限。' },
      { field: 'roleLabel', label: '平台角色中文名称', type: 'string', description: 'role对应的中文名称。' },
      { field: 'displayName', label: '平台人员姓名', type: 'string', description: '后台展示的运营或管理员姓名。' },
      { field: 'phone', label: '联系电话', type: 'string', description: '平台人员联系电话，可选。' },
      { field: 'status', label: '账号状态编码', type: 'string', enumType: 'ACCOUNT_STATUS', description: '平台权限是否启用。' },
      { field: 'statusLabel', label: '账号状态中文名称', type: 'string', description: 'status对应的中文名称。' },
      { field: 'createdBy', label: '授权人身份ID', type: 'string', description: '创建该平台人员记录的管理员OPENID。' },
      { field: 'createdAt', label: '创建时间', type: 'number', description: '记录创建毫秒时间戳。' },
      { field: 'updatedAt', label: '更新时间', type: 'number', description: '记录最后修改毫秒时间戳。' }
    ]
  },
  merchant_applications: {
    name: '商家入驻申请',
    description: '保存学生申请开店、电话联系、付款和最终审核流程。',
    fields: [
      { field: 'applicantOpenid', label: '申请人身份ID', type: 'string', description: '提交商家申请的微信用户OPENID。' },
      { field: 'storeName', label: '申请店铺名称', type: 'string', description: '审核通过后使用的店铺名称。' },
      { field: 'ownerName', label: '经营者姓名', type: 'string', description: '申请人填写的真实经营者姓名。' },
      { field: 'phone', label: '联系电话', type: 'string', description: '平台电话联系申请人使用。' },
      { field: 'wechatContact', label: '联系微信号', type: 'string', description: '申请人补充的微信联系方式，可选。' },
      { field: 'businessHours', label: '计划营业时间', type: 'string', description: '店铺计划营业时间，例如19:00-00:00。' },
      { field: 'businessCategories', label: '主营品类', type: 'string[]', description: '申请人计划销售的商品类型。' },
      { field: 'serviceDescription', label: '服务范围说明', type: 'string', description: '例如本栋宿舍配送。' },
      { field: 'notice', label: '店铺公告', type: 'string', description: '审核通过后作为店铺公告初始内容。' },
      { field: 'minimumOrder', label: '起送金额', type: 'number', description: '单位为分，例如1000表示10元。' },
      { field: 'deliveryFee', label: '配送费', type: 'number', description: '单位为分。' },
      { field: 'deliveryMinutes', label: '预计送达分钟数', type: 'number', description: '商家预计完成配送需要的分钟数。' },
      { field: 'status', label: '申请状态编码', type: 'string', enumType: 'APPLICATION_STATUS', description: '申请当前所处的审批阶段。' },
      { field: 'statusLabel', label: '申请状态中文名称', type: 'string', description: 'status对应的中文名称。' },
      { field: 'publicMessage', label: '申请人可见提示', type: 'string', description: '申请人在小程序中看到的状态说明。' },
      { field: 'internalNote', label: '平台内部备注', type: 'string', description: '只供平台人员查看，不向申请人展示。' },
      { field: 'feeAmount', label: '入驻费用', type: 'number', description: '线下入驻费用，单位为分。' },
      { field: 'paymentInstruction', label: '线下付款说明', type: 'string', description: '平台向申请人展示的付款说明。' },
      { field: 'assignedOperatorOpenid', label: '负责运营身份ID', type: 'string', description: '负责联系和跟进该申请的平台人员。' },
      { field: 'contactLogs', label: '电话联系记录', type: 'object[]', enumType: 'CONTACT_RESULT', description: '记录每次联系结果、中文名称、备注、操作人和时间。' },
      { field: 'storeId', label: '审核后店铺ID', type: 'string', description: '审核通过后创建或激活的店铺ID。' },
      { field: 'approvedBy', label: '审核管理员身份ID', type: 'string', description: '最终审核通过的管理员OPENID。' },
      { field: 'submittedAt', label: '提交时间', type: 'number', description: '申请正式提交的毫秒时间戳。' },
      { field: 'contactedAt', label: '联系时间', type: 'number', description: '平台完成电话联系的毫秒时间戳。' },
      { field: 'paidAt', label: '确认付款时间', type: 'number', description: '平台确认收到线下付款的时间。' },
      { field: 'approvedAt', label: '审核通过时间', type: 'number', description: '管理员审核通过的时间。' }
    ]
  },
  merchant_payments: {
    name: '商家线下付款记录',
    description: '平台登记商家入驻费用的线下付款结果，不代表小程序在线收款。',
    fields: [
      { field: 'applicationId', label: '商家申请ID', type: 'string', description: '该付款所属的入驻申请。' },
      { field: 'applicantOpenid', label: '申请人身份ID', type: 'string', description: '付款商家的微信用户OPENID。' },
      { field: 'amount', label: '付款金额', type: 'number', description: '单位为分。' },
      { field: 'paymentMethod', label: '付款方式编码', type: 'string', enumType: 'PAYMENT_METHOD', description: '线下付款方式。' },
      { field: 'paymentMethodLabel', label: '付款方式中文名称', type: 'string', description: 'paymentMethod对应的中文名称。' },
      { field: 'status', label: '付款状态编码', type: 'string', enumType: 'PAYMENT_STATUS', description: '付款记录是否已经核实。' },
      { field: 'statusLabel', label: '付款状态中文名称', type: 'string', description: 'status对应的中文名称。' },
      { field: 'confirmedBy', label: '确认人身份ID', type: 'string', description: '确认收到线下付款的平台人员OPENID。' },
      { field: 'voucherFileId', label: '付款凭证文件ID', type: 'string', description: '云存储中的付款凭证，可选。' },
      { field: 'note', label: '付款备注', type: 'string', description: '平台人员填写的付款说明。' },
      { field: 'paymentTime', label: '实际付款时间', type: 'number', description: '商家实际付款的毫秒时间戳。' },
      { field: 'createdAt', label: '记录创建时间', type: 'number', description: '平台登记付款记录的时间。' }
    ]
  },
  stores: {
    name: '店铺',
    description: '保存审核通过后的店铺资料、营业和平台治理状态。',
    fields: [
      { field: 'ownerOpenid', label: '店主身份ID', type: 'string', description: '店铺所属微信用户OPENID。' },
      { field: 'applicationId', label: '来源申请ID', type: 'string', description: '创建该店铺的商家入驻申请ID。' },
      { field: 'name', label: '店铺名称', type: 'string', description: '学生搜索和店铺页面展示的名称。' },
      { field: 'logoEmoji', label: '店铺图标', type: 'string', description: 'MVP使用的店铺Emoji图标。' },
      { field: 'notice', label: '店铺公告', type: 'string', description: '学生进入店铺时展示的公告。' },
      { field: 'ownerName', label: '经营者姓名', type: 'string', description: '店铺经营者姓名。' },
      { field: 'phone', label: '店铺联系电话', type: 'string', description: '处理订单和平台联系使用。' },
      { field: 'minimumOrder', label: '起送金额', type: 'number', description: '单位为分。' },
      { field: 'deliveryFee', label: '配送费', type: 'number', description: '单位为分。' },
      { field: 'deliveryMinutes', label: '预计送达分钟数', type: 'number', description: '预计完成配送的分钟数。' },
      { field: 'approvalStatus', label: '店铺审批状态编码', type: 'string', enumType: 'STORE_APPROVAL_STATUS', description: '店铺是否通过平台审核。' },
      { field: 'approvalStatusLabel', label: '店铺审批状态中文名称', type: 'string', description: 'approvalStatus对应的中文名称。' },
      { field: 'platformStatus', label: '店铺平台状态编码', type: 'string', enumType: 'STORE_PLATFORM_STATUS', description: '店铺是否被平台暂停或封禁。' },
      { field: 'platformStatusLabel', label: '店铺平台状态中文名称', type: 'string', description: 'platformStatus对应的中文名称。' },
      { field: 'businessStatus', label: '店铺营业状态编码', type: 'string', enumType: 'STORE_BUSINESS_STATUS', description: '商家当前是否营业。' },
      { field: 'businessStatusLabel', label: '店铺营业状态中文名称', type: 'string', description: 'businessStatus对应的中文名称。' },
      { field: 'isOpen', label: '是否营业兼容字段', type: 'boolean', description: '旧版兼容字段，true表示营业中。' },
      { field: 'rating', label: '店铺评分', type: 'number', description: '店铺综合评分。' },
      { field: 'monthlySales', label: '月销量', type: 'number', description: '用于店铺展示的月度完成订单数量。' }
    ]
  },
  products: {
    name: '商品',
    description: '保存商家商品、价格、图片、库存和上下架状态。',
    fields: [
      { field: 'storeId', label: '所属店铺ID', type: 'string', description: '商品所属店铺。' },
      { field: 'name', label: '商品名称', type: 'string', description: '学生端展示的商品名称。' },
      { field: 'category', label: '商品分类', type: 'string', description: '例如零食、饮料、泡面或日用。' },
      { field: 'price', label: '商品价格', type: 'number', description: '单位为分，例如400表示4元。' },
      { field: 'stock', label: '当前库存', type: 'number', description: '当前可下单商品数量。' },
      { field: 'sold', label: '累计销量', type: 'number', description: '完成订单后累计增加的销售数量。' },
      { field: 'image', label: '商品图片', type: 'string', description: '云存储文件ID或本地体验图片路径。' },
      { field: 'emoji', label: '商品图标', type: 'string', description: '没有上传图片时使用的Emoji图标。' },
      { field: 'status', label: '商品状态编码', type: 'string', enumType: 'PRODUCT_STATUS', description: '商品是否上架。' },
      { field: 'statusLabel', label: '商品状态中文名称', type: 'string', description: 'status对应的中文名称。' }
    ]
  },
  orders: {
    name: '订单',
    description: '保存学生下单、商家履约和线下付款确认过程。',
    fields: [
      { field: 'orderNo', label: '订单编号', type: 'string', description: '向用户和商家展示的业务订单编号。' },
      { field: 'buyerOpenid', label: '购买者身份ID', type: 'string', description: '下单微信用户OPENID。' },
      { field: 'sellerOpenid', label: '商家身份ID', type: 'string', description: '接收订单的店主OPENID。' },
      { field: 'storeId', label: '店铺ID', type: 'string', description: '订单所属店铺。' },
      { field: 'items', label: '商品快照', type: 'object[]', description: '下单时商品名称、单价、数量和图片的快照。' },
      { field: 'goodsAmount', label: '商品总金额', type: 'number', description: '不含配送费，单位为分。' },
      { field: 'deliveryFee', label: '配送费', type: 'number', description: '单位为分。' },
      { field: 'totalAmount', label: '订单应付总额', type: 'number', description: '双方线下结算金额，单位为分。' },
      { field: 'contactName', label: '联系人', type: 'string', description: '订单履约联系人。' },
      { field: 'phone', label: '联系电话', type: 'string', description: '商家配送联系使用。' },
      { field: 'location', label: '送达位置', type: 'string', description: '宿舍房间或约定交付位置。' },
      { field: 'deliveryMethod', label: '交付方式', type: 'string', description: '送到门口、公共区域、一楼或自取。' },
      { field: 'note', label: '订单备注', type: 'string', description: '购买者提交的订单补充说明。' },
      { field: 'status', label: '订单状态编码', type: 'string', enumType: 'ORDER_STATUS', description: '订单当前履约阶段。' },
      { field: 'statusLabel', label: '订单状态中文名称', type: 'string', description: 'status对应的中文名称。' },
      { field: 'statusHistory', label: '订单状态历史', type: 'object[]', description: '记录每次状态变化的编码、中文名称和时间。' }
    ]
  },
  notifications: {
    name: '站内消息',
    description: '保存订单、商家入驻、店铺和平台审批通知，是可靠消息主通道。',
    fields: [
      { field: 'recipientOpenid', label: '接收人身份ID', type: 'string', description: '消息接收人的微信OPENID。' },
      { field: 'recipientRole', label: '接收人角色编码', type: 'string', description: '接收消息时用户所处角色。' },
      { field: 'recipientRoleLabel', label: '接收人角色中文名称', type: 'string', description: 'recipientRole对应的中文名称。' },
      { field: 'category', label: '消息分类编码', type: 'string', enumType: 'NOTIFICATION_CATEGORY', description: '订单、商家入驻、店铺、平台或系统消息。' },
      { field: 'categoryLabel', label: '消息分类中文名称', type: 'string', description: 'category对应的中文名称。' },
      { field: 'type', label: '消息类型编码', type: 'string', enumType: 'NOTIFICATION_TYPE', description: '具体触发消息的业务事件。' },
      { field: 'typeLabel', label: '消息类型中文名称', type: 'string', description: 'type对应的中文名称。' },
      { field: 'priority', label: '消息优先级编码', type: 'string', enumType: 'NOTIFICATION_PRIORITY', description: '消息紧急程度。' },
      { field: 'priorityLabel', label: '消息优先级中文名称', type: 'string', description: 'priority对应的中文名称。' },
      { field: 'title', label: '消息标题', type: 'string', description: '消息列表展示标题。' },
      { field: 'summary', label: '消息摘要', type: 'string', description: '消息列表和订阅消息展示摘要。' },
      { field: 'statusText', label: '业务状态简述', type: 'string', description: '统一微信模板中的简短状态文字。' },
      { field: 'bizType', label: '业务对象编码', type: 'string', enumType: 'NOTIFICATION_BIZ_TYPE', description: '消息关联的业务类型。' },
      { field: 'bizId', label: '业务记录ID', type: 'string', description: '关联订单、申请或店铺ID。' },
      { field: 'pagePath', label: '跳转页面', type: 'string', description: '点击消息后进入的小程序页面路径。' },
      { field: 'readStatus', label: '已读状态编码', type: 'string', enumType: 'NOTIFICATION_READ_STATUS', description: '消息是否已经查看。' },
      { field: 'readStatusLabel', label: '已读状态中文名称', type: 'string', description: 'readStatus对应的中文名称。' },
      { field: 'dedupeKey', label: '消息去重键', type: 'string', description: '防止同一业务事件重复创建消息。' },
      { field: 'createdAt', label: '创建时间', type: 'number', description: '消息创建毫秒时间戳。' }
    ]
  },
  notification_deliveries: {
    name: '消息发送记录',
    description: '记录站内消息和微信订阅消息是否发送成功以及失败原因。',
    fields: [
      { field: 'notificationId', label: '站内消息ID', type: 'string', description: '对应notifications记录ID。' },
      { field: 'recipientOpenid', label: '接收人身份ID', type: 'string', description: '消息接收人的微信OPENID。' },
      { field: 'channel', label: '发送通道编码', type: 'string', enumType: 'NOTIFICATION_CHANNEL', description: '站内或微信订阅消息。' },
      { field: 'channelLabel', label: '发送通道中文名称', type: 'string', description: 'channel对应的中文名称。' },
      { field: 'templateKey', label: '消息模板键', type: 'string', description: '当前统一使用SHARED_BUSINESS_NOTICE。' },
      { field: 'templateId', label: '微信模板ID', type: 'string', description: '公众平台配置的订阅消息模板ID。' },
      { field: 'deliveryStatus', label: '发送状态编码', type: 'string', enumType: 'NOTIFICATION_DELIVERY_STATUS', description: '发送成功、失败或跳过。' },
      { field: 'deliveryStatusLabel', label: '发送状态中文名称', type: 'string', description: 'deliveryStatus对应的中文名称。' },
      { field: 'attemptCount', label: '发送尝试次数', type: 'number', description: '调用消息通道的次数。' },
      { field: 'lastErrorCode', label: '最后错误码', type: 'string', description: '微信接口返回的错误码。' },
      { field: 'lastErrorMessage', label: '最后错误说明', type: 'string', description: '发送失败或跳过原因。' },
      { field: 'sentAt', label: '发送成功时间', type: 'number', description: '发送成功毫秒时间戳。' }
    ]
  },
  notification_preferences: {
    name: '消息订阅授权',
    description: '记录用户对统一微信订阅消息模板的授权和剩余可用次数。',
    fields: [
      { field: 'openid', label: '用户身份ID', type: 'string', description: '授权用户的微信OPENID。' },
      { field: 'templateKey', label: '消息模板键', type: 'string', description: '统一业务状态通知模板键。' },
      { field: 'lastPermission', label: '最后授权结果编码', type: 'string', enumType: 'SUBSCRIBE_PERMISSION', description: '最近一次请求订阅的结果。' },
      { field: 'lastPermissionLabel', label: '授权结果中文名称', type: 'string', description: 'lastPermission对应的中文名称。' },
      { field: 'grantedCount', label: '可用授权次数', type: 'number', description: '当前可尝试发送的模板消息次数。' },
      { field: 'lastScene', label: '最后授权场景', type: 'string', description: '下单、营业、提交申请或平台审批。' }
    ]
  },
  notification_templates: {
    name: '消息模板配置',
    description: '配置站内消息和统一微信订阅消息模板。',
    fields: [
      { field: 'key', label: '模板键', type: 'string', description: '统一使用SHARED_BUSINESS_NOTICE。' },
      { field: 'keyLabel', label: '模板中文名称', type: 'string', description: '模板用途中文说明。' },
      { field: 'templateId', label: '微信模板ID', type: 'string', description: '从微信公众平台订阅消息模板库取得。' },
      { field: 'enabled', label: '是否启用', type: 'boolean', description: '只有开启且配置模板ID后才发送微信订阅消息。' },
      { field: 'fields', label: '模板字段映射', type: 'object', description: '标题、状态、时间和备注对应的微信模板关键词。' }
    ]
  },
  audit_logs: {
    name: '平台审计日志',
    description: '记录平台人员执行的审批、收款、店铺治理和权限配置操作。',
    fields: [
      { field: 'operatorOpenid', label: '操作者身份ID', type: 'string', description: '执行平台操作的微信用户OPENID。' },
      { field: 'operatorRole', label: '操作者角色编码', type: 'string', enumType: 'PLATFORM_ROLE', description: '操作发生时操作者的平台角色。' },
      { field: 'operatorRoleLabel', label: '操作者角色中文名称', type: 'string', description: 'operatorRole对应的中文名称。' },
      { field: 'action', label: '操作类型编码', type: 'string', enumType: 'AUDIT_ACTION', description: '平台执行了什么操作。' },
      { field: 'actionLabel', label: '操作类型中文名称', type: 'string', description: 'action对应的中文名称。' },
      { field: 'targetType', label: '操作对象类型编码', type: 'string', enumType: 'AUDIT_TARGET_TYPE', description: '被操作的数据类型。' },
      { field: 'targetTypeLabel', label: '操作对象中文名称', type: 'string', description: 'targetType对应的中文名称。' },
      { field: 'targetId', label: '操作对象ID', type: 'string', description: '被操作记录的ID。' },
      { field: 'before', label: '操作前数据', type: 'object', description: '关键操作发生前的数据快照。' },
      { field: 'after', label: '操作后数据', type: 'object', description: '关键操作发生后的数据摘要。' },
      { field: 'reason', label: '操作原因', type: 'string', description: '管理员填写的原因或备注。' },
      { field: 'createdAt', label: '操作时间', type: 'number', description: '操作发生的毫秒时间戳。' }
    ]
  }
}

function schemaDocuments() {
  return Object.keys(COLLECTION_SCHEMAS).map(collection => ({
    _id: collection,
    collection,
    name: COLLECTION_SCHEMAS[collection].name,
    description: COLLECTION_SCHEMAS[collection].description,
    fields: COLLECTION_SCHEMAS[collection].fields,
    version: SCHEMA_VERSION,
    updatedAt: Date.now()
  }))
}

module.exports = { SCHEMA_VERSION, COLLECTION_SCHEMAS, schemaDocuments }

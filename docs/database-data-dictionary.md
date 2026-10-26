# 宿舍补给站数据库中文数据字典

- 更新日期：2026-10-23
- 字段说明版本：2026-10-23-v3
- 枚举说明版本：2026-10-23-v5

> 数据库存储英文编码用于程序稳定判断，同时使用 `xxxLabel` 字段保存中文名称。完整中文说明也会同步到 `system_collection_schemas` 和 `system_dictionaries` 集合。

## 一、集合与字段

### 用户 `users`

保存每个微信用户的基础业务身份和普通业务角色。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `_id` | 记录ID | `string` | — | 云数据库自动生成的用户记录唯一ID。 |
| `openid` | 微信用户身份ID | `string` | — | 当前小程序下微信用户的唯一身份，只能由云函数获取。 |
| `roles` | 用户角色编码 | `string[]` | `USER_ROLE` | 用户拥有的普通业务角色编码数组。 |
| `roleLabels` | 用户角色中文名称 | `string[]` | — | roles中每个角色对应的中文名称。 |
| `status` | 账号状态编码 | `string` | `ACCOUNT_STATUS` | 账号是否可以正常使用。 |
| `statusLabel` | 账号状态中文名称 | `string` | — | status对应的中文名称。 |
| `createdAt` | 创建时间 | `number` | — | 记录创建时的毫秒时间戳。 |
| `updatedAt` | 更新时间 | `number` | — | 记录最后修改时的毫秒时间戳。 |

### 平台人员 `platform_users`

保存平台运营、管理员和超级管理员权限。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `openid` | 微信用户身份ID | `string` | — | 被授予平台权限的微信用户OPENID。 |
| `role` | 平台角色编码 | `string` | `PLATFORM_ROLE` | 决定平台后台管理权限。 |
| `roleLabel` | 平台角色中文名称 | `string` | — | role对应的中文名称。 |
| `displayName` | 平台人员姓名 | `string` | — | 后台展示的运营或管理员姓名。 |
| `phone` | 联系电话 | `string` | — | 平台人员联系电话，可选。 |
| `status` | 账号状态编码 | `string` | `ACCOUNT_STATUS` | 平台权限是否启用。 |
| `statusLabel` | 账号状态中文名称 | `string` | — | status对应的中文名称。 |
| `createdBy` | 授权人身份ID | `string` | — | 创建该平台人员记录的管理员OPENID。 |
| `createdAt` | 创建时间 | `number` | — | 记录创建毫秒时间戳。 |
| `updatedAt` | 更新时间 | `number` | — | 记录最后修改毫秒时间戳。 |

### 商家入驻申请 `merchant_applications`

保存学生申请开店、电话联系、付款和最终审核流程。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `applicantOpenid` | 申请人身份ID | `string` | — | 提交商家申请的微信用户OPENID。 |
| `storeName` | 申请店铺名称 | `string` | — | 审核通过后使用的店铺名称。 |
| `ownerName` | 经营者姓名 | `string` | — | 申请人填写的真实经营者姓名。 |
| `phone` | 联系电话 | `string` | — | 平台电话联系申请人使用。 |
| `wechatContact` | 联系微信号 | `string` | — | 申请人补充的微信联系方式，可选。 |
| `businessHours` | 计划营业时间 | `string` | — | 店铺计划营业时间，例如19:00-00:00。 |
| `businessCategories` | 主营品类 | `string[]` | — | 申请人计划销售的商品类型。 |
| `serviceDescription` | 服务范围说明 | `string` | — | 例如本栋宿舍配送。 |
| `notice` | 店铺公告 | `string` | — | 审核通过后作为店铺公告初始内容。 |
| `minimumOrder` | 起送金额 | `number` | — | 单位为分，例如1000表示10元。 |
| `deliveryFee` | 配送费 | `number` | — | 单位为分。 |
| `deliveryMinutes` | 预计送达分钟数 | `number` | — | 商家预计完成配送需要的分钟数。 |
| `status` | 申请状态编码 | `string` | `APPLICATION_STATUS` | 申请当前所处的审批阶段。 |
| `statusLabel` | 申请状态中文名称 | `string` | — | status对应的中文名称。 |
| `publicMessage` | 申请人可见提示 | `string` | — | 申请人在小程序中看到的状态说明。 |
| `internalNote` | 平台内部备注 | `string` | — | 只供平台人员查看，不向申请人展示。 |
| `feeAmount` | 入驻费用 | `number` | — | 线下入驻费用，单位为分。 |
| `paymentInstruction` | 线下付款说明 | `string` | — | 平台向申请人展示的付款说明。 |
| `assignedOperatorOpenid` | 负责运营身份ID | `string` | — | 负责联系和跟进该申请的平台人员。 |
| `contactLogs` | 电话联系记录 | `object[]` | `CONTACT_RESULT` | 记录每次联系结果、中文名称、备注、操作人和时间。 |
| `storeId` | 审核后店铺ID | `string` | — | 审核通过后创建或激活的店铺ID。 |
| `approvedBy` | 审核管理员身份ID | `string` | — | 最终审核通过的管理员OPENID。 |
| `submittedAt` | 提交时间 | `number` | — | 申请正式提交的毫秒时间戳。 |
| `contactedAt` | 联系时间 | `number` | — | 平台完成电话联系的毫秒时间戳。 |
| `paidAt` | 确认付款时间 | `number` | — | 平台确认收到线下付款的时间。 |
| `approvedAt` | 审核通过时间 | `number` | — | 管理员审核通过的时间。 |

### 商家线下付款记录 `merchant_payments`

平台登记商家入驻费用的线下付款结果，不代表小程序在线收款。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `applicationId` | 商家申请ID | `string` | — | 该付款所属的入驻申请。 |
| `applicantOpenid` | 申请人身份ID | `string` | — | 付款商家的微信用户OPENID。 |
| `amount` | 付款金额 | `number` | — | 单位为分。 |
| `paymentMethod` | 付款方式编码 | `string` | `PAYMENT_METHOD` | 线下付款方式。 |
| `paymentMethodLabel` | 付款方式中文名称 | `string` | — | paymentMethod对应的中文名称。 |
| `status` | 付款状态编码 | `string` | `PAYMENT_STATUS` | 付款记录是否已经核实。 |
| `statusLabel` | 付款状态中文名称 | `string` | — | status对应的中文名称。 |
| `confirmedBy` | 确认人身份ID | `string` | — | 确认收到线下付款的平台人员OPENID。 |
| `voucherFileId` | 付款凭证文件ID | `string` | — | 云存储中的付款凭证，可选。 |
| `note` | 付款备注 | `string` | — | 平台人员填写的付款说明。 |
| `paymentTime` | 实际付款时间 | `number` | — | 商家实际付款的毫秒时间戳。 |
| `createdAt` | 记录创建时间 | `number` | — | 平台登记付款记录的时间。 |

### 店铺 `stores`

保存审核通过后的店铺资料、营业和平台治理状态。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `ownerOpenid` | 店主身份ID | `string` | — | 店铺所属微信用户OPENID。 |
| `applicationId` | 来源申请ID | `string` | — | 创建该店铺的商家入驻申请ID。 |
| `name` | 店铺名称 | `string` | — | 学生搜索和店铺页面展示的名称。 |
| `logoEmoji` | 店铺图标 | `string` | — | MVP使用的店铺Emoji图标。 |
| `notice` | 店铺公告 | `string` | — | 学生进入店铺时展示的公告。 |
| `ownerName` | 经营者姓名 | `string` | — | 店铺经营者姓名。 |
| `phone` | 店铺联系电话 | `string` | — | 处理订单和平台联系使用。 |
| `minimumOrder` | 起送金额 | `number` | — | 单位为分。 |
| `deliveryFee` | 配送费 | `number` | — | 单位为分。 |
| `deliveryMinutes` | 预计送达分钟数 | `number` | — | 预计完成配送的分钟数。 |
| `approvalStatus` | 店铺审批状态编码 | `string` | `STORE_APPROVAL_STATUS` | 店铺是否通过平台审核。 |
| `approvalStatusLabel` | 店铺审批状态中文名称 | `string` | — | approvalStatus对应的中文名称。 |
| `platformStatus` | 店铺平台状态编码 | `string` | `STORE_PLATFORM_STATUS` | 店铺是否被平台暂停或封禁。 |
| `platformStatusLabel` | 店铺平台状态中文名称 | `string` | — | platformStatus对应的中文名称。 |
| `businessStatus` | 店铺营业状态编码 | `string` | `STORE_BUSINESS_STATUS` | 商家当前是否营业。 |
| `businessStatusLabel` | 店铺营业状态中文名称 | `string` | — | businessStatus对应的中文名称。 |
| `isOpen` | 是否营业兼容字段 | `boolean` | — | 旧版兼容字段，true表示营业中。 |
| `rating` | 店铺评分 | `number` | — | 店铺综合评分。 |
| `monthlySales` | 月销量 | `number` | — | 用于店铺展示的月度完成订单数量。 |

### 商品 `products`

保存商家商品、价格、图片、库存和上下架状态。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `storeId` | 所属店铺ID | `string` | — | 商品所属店铺。 |
| `name` | 商品名称 | `string` | — | 学生端展示的商品名称。 |
| `category` | 商品分类 | `string` | — | 例如零食、饮料、泡面或日用。 |
| `price` | 商品价格 | `number` | — | 单位为分，例如400表示4元。 |
| `stock` | 当前库存 | `number` | — | 当前可下单商品数量。 |
| `sold` | 累计销量 | `number` | — | 完成订单后累计增加的销售数量。 |
| `image` | 商品图片 | `string` | — | 云存储文件ID或本地体验图片路径。 |
| `emoji` | 商品图标 | `string` | — | 没有上传图片时使用的Emoji图标。 |
| `status` | 商品状态编码 | `string` | `PRODUCT_STATUS` | 商品是否上架。 |
| `statusLabel` | 商品状态中文名称 | `string` | — | status对应的中文名称。 |

### 订单 `orders`

保存学生下单、商家履约和线下付款确认过程。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `orderNo` | 订单编号 | `string` | — | 向用户和商家展示的业务订单编号。 |
| `buyerOpenid` | 购买者身份ID | `string` | — | 下单微信用户OPENID。 |
| `sellerOpenid` | 商家身份ID | `string` | — | 接收订单的店主OPENID。 |
| `storeId` | 店铺ID | `string` | — | 订单所属店铺。 |
| `items` | 商品快照 | `object[]` | — | 下单时商品名称、单价、数量和图片的快照。 |
| `goodsAmount` | 商品总金额 | `number` | — | 不含配送费，单位为分。 |
| `deliveryFee` | 配送费 | `number` | — | 单位为分。 |
| `totalAmount` | 订单应付总额 | `number` | — | 双方线下结算金额，单位为分。 |
| `contactName` | 联系人 | `string` | — | 订单履约联系人。 |
| `phone` | 联系电话 | `string` | — | 商家配送联系使用。 |
| `location` | 送达位置 | `string` | — | 宿舍房间或约定交付位置。 |
| `deliveryMethod` | 交付方式 | `string` | — | 送到门口、公共区域、一楼或自取。 |
| `note` | 订单备注 | `string` | — | 购买者提交的订单补充说明。 |
| `status` | 订单状态编码 | `string` | `ORDER_STATUS` | 订单当前履约阶段。 |
| `statusLabel` | 订单状态中文名称 | `string` | — | status对应的中文名称。 |
| `statusHistory` | 订单状态历史 | `object[]` | — | 记录每次状态变化的编码、中文名称和时间。 |

### 站内消息 `notifications`

保存订单、商家入驻、店铺和平台审批通知，是可靠消息主通道。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `recipientOpenid` | 接收人身份ID | `string` | — | 消息接收人的微信OPENID。 |
| `recipientRole` | 接收人角色编码 | `string` | — | 接收消息时用户所处角色。 |
| `recipientRoleLabel` | 接收人角色中文名称 | `string` | — | recipientRole对应的中文名称。 |
| `category` | 消息分类编码 | `string` | `NOTIFICATION_CATEGORY` | 订单、商家入驻、店铺、平台或系统消息。 |
| `categoryLabel` | 消息分类中文名称 | `string` | — | category对应的中文名称。 |
| `type` | 消息类型编码 | `string` | `NOTIFICATION_TYPE` | 具体触发消息的业务事件。 |
| `typeLabel` | 消息类型中文名称 | `string` | — | type对应的中文名称。 |
| `priority` | 消息优先级编码 | `string` | `NOTIFICATION_PRIORITY` | 消息紧急程度。 |
| `priorityLabel` | 消息优先级中文名称 | `string` | — | priority对应的中文名称。 |
| `title` | 消息标题 | `string` | — | 消息列表展示标题。 |
| `summary` | 消息摘要 | `string` | — | 消息列表和订阅消息展示摘要。 |
| `statusText` | 业务状态简述 | `string` | — | 统一微信模板中的简短状态文字。 |
| `bizType` | 业务对象编码 | `string` | `NOTIFICATION_BIZ_TYPE` | 消息关联的业务类型。 |
| `bizId` | 业务记录ID | `string` | — | 关联订单、申请或店铺ID。 |
| `pagePath` | 跳转页面 | `string` | — | 点击消息后进入的小程序页面路径。 |
| `readStatus` | 已读状态编码 | `string` | `NOTIFICATION_READ_STATUS` | 消息是否已经查看。 |
| `readStatusLabel` | 已读状态中文名称 | `string` | — | readStatus对应的中文名称。 |
| `dedupeKey` | 消息去重键 | `string` | — | 防止同一业务事件重复创建消息。 |
| `createdAt` | 创建时间 | `number` | — | 消息创建毫秒时间戳。 |

### 消息发送记录 `notification_deliveries`

记录站内消息和微信订阅消息是否发送成功以及失败原因。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `notificationId` | 站内消息ID | `string` | — | 对应notifications记录ID。 |
| `recipientOpenid` | 接收人身份ID | `string` | — | 消息接收人的微信OPENID。 |
| `channel` | 发送通道编码 | `string` | `NOTIFICATION_CHANNEL` | 站内或微信订阅消息。 |
| `channelLabel` | 发送通道中文名称 | `string` | — | channel对应的中文名称。 |
| `templateKey` | 消息模板键 | `string` | — | 当前统一使用SHARED_BUSINESS_NOTICE。 |
| `templateId` | 微信模板ID | `string` | — | 公众平台配置的订阅消息模板ID。 |
| `deliveryStatus` | 发送状态编码 | `string` | `NOTIFICATION_DELIVERY_STATUS` | 发送成功、失败或跳过。 |
| `deliveryStatusLabel` | 发送状态中文名称 | `string` | — | deliveryStatus对应的中文名称。 |
| `attemptCount` | 发送尝试次数 | `number` | — | 调用消息通道的次数。 |
| `lastErrorCode` | 最后错误码 | `string` | — | 微信接口返回的错误码。 |
| `lastErrorMessage` | 最后错误说明 | `string` | — | 发送失败或跳过原因。 |
| `sentAt` | 发送成功时间 | `number` | — | 发送成功毫秒时间戳。 |

### 消息订阅授权 `notification_preferences`

记录用户对统一微信订阅消息模板的授权和剩余可用次数。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `openid` | 用户身份ID | `string` | — | 授权用户的微信OPENID。 |
| `templateKey` | 消息模板键 | `string` | — | 统一业务状态通知模板键。 |
| `lastPermission` | 最后授权结果编码 | `string` | `SUBSCRIBE_PERMISSION` | 最近一次请求订阅的结果。 |
| `lastPermissionLabel` | 授权结果中文名称 | `string` | — | lastPermission对应的中文名称。 |
| `grantedCount` | 可用授权次数 | `number` | — | 当前可尝试发送的模板消息次数。 |
| `lastScene` | 最后授权场景 | `string` | — | 下单、营业、提交申请或平台审批。 |

### 消息模板配置 `notification_templates`

配置站内消息和统一微信订阅消息模板。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `key` | 模板键 | `string` | — | 统一使用SHARED_BUSINESS_NOTICE。 |
| `keyLabel` | 模板中文名称 | `string` | — | 模板用途中文说明。 |
| `templateId` | 微信模板ID | `string` | — | 从微信公众平台订阅消息模板库取得。 |
| `enabled` | 是否启用 | `boolean` | — | 只有开启且配置模板ID后才发送微信订阅消息。 |
| `fields` | 模板字段映射 | `object` | — | 标题、状态、时间和备注对应的微信模板关键词。 |

### 平台审计日志 `audit_logs`

记录平台人员执行的审批、收款、店铺治理和权限配置操作。

| 字段 | 中文名称 | 类型 | 枚举 | 含义 |
|---|---|---|---|---|
| `operatorOpenid` | 操作者身份ID | `string` | — | 执行平台操作的微信用户OPENID。 |
| `operatorRole` | 操作者角色编码 | `string` | `PLATFORM_ROLE` | 操作发生时操作者的平台角色。 |
| `operatorRoleLabel` | 操作者角色中文名称 | `string` | — | operatorRole对应的中文名称。 |
| `action` | 操作类型编码 | `string` | `AUDIT_ACTION` | 平台执行了什么操作。 |
| `actionLabel` | 操作类型中文名称 | `string` | — | action对应的中文名称。 |
| `targetType` | 操作对象类型编码 | `string` | `AUDIT_TARGET_TYPE` | 被操作的数据类型。 |
| `targetTypeLabel` | 操作对象中文名称 | `string` | — | targetType对应的中文名称。 |
| `targetId` | 操作对象ID | `string` | — | 被操作记录的ID。 |
| `before` | 操作前数据 | `object` | — | 关键操作发生前的数据快照。 |
| `after` | 操作后数据 | `object` | — | 关键操作发生后的数据摘要。 |
| `reason` | 操作原因 | `string` | — | 管理员填写的原因或备注。 |
| `createdAt` | 操作时间 | `number` | — | 操作发生的毫秒时间戳。 |

## 二、固定枚举

### 用户角色 `USER_ROLE`

决定普通微信用户可以使用哪些业务功能。一个用户可以同时拥有多个角色。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `CUSTOMER` | 普通用户 | 可以搜索店铺、浏览商品、下单和查看自己的订单。 |
| `MERCHANT_OWNER` | 商家店主 | 商家入驻审核通过后获得，可以管理自己的店铺、商品和订单。 |

### 平台角色 `PLATFORM_ROLE`

决定微信用户是否可以进入平台运营后台以及可以执行哪些管理操作。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `PLATFORM_OPERATOR` | 平台运营 | 可以联系申请人、登记付款、查看店铺，但不能最终审核商家。 |
| `PLATFORM_ADMIN` | 平台管理员 | 可以审核商家、暂停店铺、管理平台运营人员。 |
| `SUPER_ADMIN` | 超级管理员 | 平台最高权限，通常由开发者持有，可以分配管理员权限。 |

### 账号状态 `ACCOUNT_STATUS`

用户或平台人员账号是否可以正常使用。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `ACTIVE` | 正常 | 账号可正常使用相应权限。 |
| `DISABLED` | 已停用 | 账号权限已被停用。 |

### 商家申请状态 `APPLICATION_STATUS`

商家从提交申请到正式上线所处的审批阶段。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `DRAFT` | 草稿 | 申请尚未正式提交。 |
| `SUBMITTED` | 待平台联系 | 申请已提交，等待平台工作人员电话联系。 |
| `CONTACT_FAILED` | 联系未成功 | 平台暂时没有联系到申请人。 |
| `CONTACTED` | 已完成联系 | 平台已经完成电话沟通，等待确认入驻和付款信息。 |
| `NEED_MORE_INFO` | 待补充资料 | 申请人需要修改或补充资料后重新提交。 |
| `PAYMENT_PENDING` | 待线下付款 | 等待申请人按照平台说明完成线下付款。 |
| `PAID` | 已付款待审核 | 平台已经确认收款，等待管理员最终审核。 |
| `APPROVED` | 审核通过 | 商家已通过审核并获得店铺经营权限。 |
| `REJECTED` | 审核未通过 | 商家申请被管理员拒绝。 |
| `SUSPENDED` | 申请已暂停 | 已通过的商家申请或资格被暂停。 |

### 店铺审批状态 `STORE_APPROVAL_STATUS`

表示店铺是否通过平台入驻审批。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `PENDING` | 待审核 | 店铺尚未通过平台审核，不能公开展示。 |
| `APPROVED` | 审核通过 | 店铺已通过平台审核。 |
| `REJECTED` | 审核拒绝 | 店铺未通过平台审核。 |

### 店铺平台状态 `STORE_PLATFORM_STATUS`

平台对店铺实施的运营治理状态。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `ACTIVE` | 平台正常 | 店铺可以在平台展示和经营。 |
| `SUSPENDED` | 平台暂停 | 店铺被平台临时暂停，不能展示或接单。 |
| `BANNED` | 平台封禁 | 店铺因严重违规被平台封禁。 |

### 店铺营业状态 `STORE_BUSINESS_STATUS`

由商家控制的当前营业状态。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `OPEN` | 营业中 | 店铺当前可以接受订单。 |
| `CLOSED` | 已打烊 | 店铺当前不接受新订单。 |

### 商品状态 `PRODUCT_STATUS`

商品是否在学生端公开展示和允许下单。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `ON` | 已上架 | 商品可以在店铺中展示并下单。 |
| `OFF` | 已下架 | 商品不会在学生端展示。 |

### 订单履约状态 `ORDER_STATUS`

订单从提交到完成所处的履约阶段。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `CREATED` | 待商家接单 | 用户已提交订单，等待商家确认。 |
| `ACCEPTED` | 备货中 | 商家已接单并开始备货。 |
| `READY` | 待自取 | 自取订单已经准备完成。 |
| `DELIVERING` | 配送中 | 商家正在配送商品。 |
| `DELIVERED` | 待确认收货 | 商家已交付，等待用户确认。 |
| `COMPLETED` | 已完成 | 商品已交付并完成线下付款确认。 |
| `CANCELED` | 用户已取消 | 订单被购买者取消，库存已恢复。 |
| `REJECTED` | 商家已拒单 | 商家拒绝订单，库存已恢复。 |
| `TIMEOUT_CLOSED` | 超时关闭 | 商家未及时接单，系统关闭订单。 |
| `DISPUTED` | 争议处理中 | 订单存在投诉或付款争议。 |
| `CLOSED` | 异常关闭 | 订单由平台结束处理。 |

### 电话联系结果 `CONTACT_RESULT`

平台运营人员联系商家申请人的结果。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `CONTACTED` | 联系成功 | 已经通过电话或其他约定方式联系到申请人。 |
| `CONTACT_FAILED` | 联系未成功 | 本次没有成功联系到申请人。 |

### 付款记录状态 `PAYMENT_STATUS`

商家入驻线下付款记录的确认状态。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `PENDING` | 待确认 | 付款记录等待平台核实。 |
| `CONFIRMED` | 已确认 | 平台已经确认收到线下付款。 |
| `REJECTED` | 确认失败 | 付款记录未通过平台核实。 |

### 付款方式 `PAYMENT_METHOD`

商家向平台支付入驻费用的线下方式。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `WECHAT_OFFLINE` | 微信线下转账 | 双方通过微信私下完成转账，平台仅登记结果。 |
| `ALIPAY_OFFLINE` | 支付宝线下转账 | 双方通过支付宝私下完成转账。 |
| `CASH` | 现金 | 双方通过现金完成付款。 |
| `OTHER` | 其他方式 | 由平台备注说明的其他线下付款方式。 |

### 消息分类 `NOTIFICATION_CATEGORY`

站内消息所属的业务分类。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `ORDER` | 订单消息 | 下单、接单、配送和取消等订单消息。 |
| `MERCHANT_APPLICATION` | 商家入驻消息 | 入驻申请、付款和审核进度消息。 |
| `STORE` | 店铺经营消息 | 店铺暂停、恢复和经营状态消息。 |
| `PLATFORM` | 平台审批消息 | 平台运营和管理员需要处理的消息。 |
| `SYSTEM` | 系统通知 | 平台系统级通知。 |

### 消息类型 `NOTIFICATION_TYPE`

触发站内消息和微信订阅消息的具体业务事件。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `NEW_ORDER` | 新订单提醒 | 购买者提交订单后通知商家。 |
| `ORDER_ACCEPTED` | 商家已接单 | 商家接受订单后通知购买者。 |
| `ORDER_REJECTED` | 商家拒绝订单 | 商家拒单后通知购买者。 |
| `ORDER_DELIVERING` | 商品开始配送 | 订单进入配送状态后通知购买者。 |
| `ORDER_DELIVERED` | 商品已经送达 | 商家标记送达后通知购买者。 |
| `BUYER_CANCELED_ORDER` | 用户取消订单 | 购买者取消订单后通知商家。 |
| `APPLICATION_SUBMITTED` | 入驻申请已提交 | 通知申请人入驻申请已经提交。 |
| `NEW_MERCHANT_APPLICATION` | 新商家申请 | 通知平台人员出现新的入驻申请。 |
| `APPLICATION_RESUBMITTED` | 商家重新提交资料 | 通知平台人员申请人已经补充资料。 |
| `APPLICATION_CONTACTED` | 平台已完成联系 | 通知申请人平台已电话联系。 |
| `APPLICATION_CONTACT_FAILED` | 平台暂未联系成功 | 通知申请人检查联系电话。 |
| `APPLICATION_NEED_MORE_INFO` | 需要补充资料 | 通知申请人补充入驻资料。 |
| `APPLICATION_PAYMENT_PENDING` | 待完成线下付款 | 通知申请人查看付款金额和说明。 |
| `APPLICATION_PAYMENT_CONFIRMED` | 平台已确认收款 | 通知申请人等待最终审核。 |
| `APPLICATION_PAID_PENDING_APPROVAL` | 已付款待最终审核 | 通知管理员处理已付款申请。 |
| `APPLICATION_APPROVED` | 入驻审核通过 | 通知申请人店铺已经上线。 |
| `APPLICATION_REJECTED` | 入驻审核未通过 | 通知申请人审核拒绝原因。 |
| `STORE_SUSPENDED` | 店铺被平台暂停 | 通知商家店铺已暂停。 |
| `STORE_RESUMED` | 店铺恢复上线 | 通知商家店铺已恢复。 |

### 消息优先级 `NOTIFICATION_PRIORITY`

消息处理的紧急程度。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `URGENT` | 紧急 | 需要立即处理，例如新订单或店铺暂停。 |
| `HIGH` | 高优先级 | 用户明显关心或需要采取行动。 |
| `NORMAL` | 普通 | 普通进度或结果通知。 |
| `LOW` | 低优先级 | 可延迟处理的提示。 |

### 消息业务对象 `NOTIFICATION_BIZ_TYPE`

消息点击后关联的业务数据类型。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `ORDER` | 订单 | 关联订单详情。 |
| `MERCHANT_APPLICATION` | 商家入驻申请 | 关联入驻申请或审批详情。 |
| `STORE` | 店铺 | 关联店铺或商家工作台。 |
| `SYSTEM` | 系统 | 不关联具体业务记录。 |

### 消息已读状态 `NOTIFICATION_READ_STATUS`

站内消息是否已被接收人查看。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `UNREAD` | 未读 | 消息尚未被打开。 |
| `READ` | 已读 | 消息已经被打开。 |

### 消息发送通道 `NOTIFICATION_CHANNEL`

消息通过哪种方式触达用户。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `IN_APP` | 小程序站内消息 | 保存在小程序消息中心。 |
| `WECHAT_SUBSCRIBE` | 微信订阅消息 | 用户离开小程序后通过微信服务通知触达。 |

### 消息发送状态 `NOTIFICATION_DELIVERY_STATUS`

消息通道发送结果。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `PENDING` | 待发送 | 等待调用发送通道。 |
| `SUCCESS` | 发送成功 | 消息通道返回成功。 |
| `FAILED_FINAL` | 发送失败 | 模板、授权或接口错误导致最终失败。 |
| `SKIPPED` | 已跳过 | 模板未配置或用户没有可用授权次数。 |

### 订阅消息授权状态 `SUBSCRIBE_PERMISSION`

用户对统一微信订阅消息模板的授权结果。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `ACCEPT` | 已同意 | 用户同意接收一次模板消息。 |
| `REJECT` | 已拒绝 | 用户拒绝本次订阅请求。 |
| `BAN` | 永久拒绝 | 用户选择不再询问或被微信限制。 |
| `UNKNOWN` | 未知 | 尚未请求授权或无法判断。 |

### 平台操作类型 `AUDIT_ACTION`

平台人员在运营后台执行的重要操作。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `MARK_APPLICATION_CONTACTED` | 标记申请已联系 | 平台人员确认已经电话联系申请人。 |
| `MARK_APPLICATION_CONTACT_FAILED` | 标记联系未成功 | 平台人员没有成功联系申请人。 |
| `REQUEST_MORE_INFORMATION` | 要求补充资料 | 平台要求申请人补充或修改入驻资料。 |
| `SET_PAYMENT_PENDING` | 设置待线下付款 | 平台设置入驻费用和付款说明。 |
| `CONFIRM_OFFLINE_PAYMENT` | 确认线下收款 | 平台确认已经收到申请人的线下付款。 |
| `APPROVE_MERCHANT_APPLICATION` | 审核通过商家申请 | 管理员批准申请并上线店铺。 |
| `REJECT_MERCHANT_APPLICATION` | 拒绝商家申请 | 管理员拒绝商家入驻申请。 |
| `SUSPEND_STORE` | 暂停店铺 | 管理员暂停店铺展示和接单。 |
| `RESUME_STORE` | 恢复店铺 | 管理员恢复店铺展示和接单资格。 |
| `SAVE_PLATFORM_USER` | 配置平台人员权限 | 新增或修改平台运营、管理员角色。 |
| `SYNC_CHINESE_DESCRIPTIONS` | 同步数据库中文说明 | 将枚举中文名称和说明同步到现有数据库记录。 |
| `SAVE_NOTIFICATION_TEMPLATE` | 配置订阅消息模板 | 管理员配置统一微信订阅消息模板。 |

### 平台操作对象类型 `AUDIT_TARGET_TYPE`

审计日志中的操作目标属于哪一种业务数据。

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `MERCHANT_APPLICATION` | 商家入驻申请 | 操作对象是商家申请记录。 |
| `STORE` | 店铺 | 操作对象是店铺记录。 |
| `PRODUCT` | 商品 | 操作对象是商品记录。 |
| `ORDER` | 订单 | 操作对象是订单记录。 |
| `PLATFORM_USER` | 平台人员 | 操作对象是平台运营或管理员账号。 |
| `SYSTEM_DICTIONARY` | 系统数据字典 | 操作对象是数据库字段和枚举中文说明。 |
| `NOTIFICATION_TEMPLATE` | 通知模板 | 操作对象是站内或微信订阅消息模板。 |

## 三、金额和时间约定

- 所有金额字段统一使用“分”为单位的整数。例如 `400` 表示4元，`1000` 表示10元。
- 所有时间字段使用毫秒时间戳。
- `OPENID` 是微信用户在当前小程序内的唯一身份。
- 数据库中的英文枚举编码不能随意改成中文，应使用对应的 `xxxLabel` 字段查看中文含义。

## 四、查看入口

`我的 → 平台管理后台 → 数据库中文说明`

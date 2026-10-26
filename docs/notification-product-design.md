# 宿舍补给站——消息通知产品设计方案

- 文档版本：V1.0
- 编写日期：2026-10-23
- 适用阶段：云端MVP
- 设计目标：让购买者、商家申请人、商家、平台运营和管理员及时感知需要处理的业务变化

---

## 1. 当前问题

目前订单、商家审批、付款确认等状态已经记录在云数据库中，但只有用户主动进入对应页面后才能看到变化，存在以下问题：

- 商家不知道有新订单，无法及时接单；
- 购买者不知道商家是否接单、拒单或已经送达；
- 商家申请人不知道资料是否需要补充、是否待付款、是否审核通过；
- 平台管理员不知道出现了新的商家申请或已付款待审核申请；
- 所有角色都需要反复进入列表页刷新；
- 重要业务状态缺少统一消息记录，发生争议时无法确认是否生成或发送过提醒。

消息能力不能只理解为“微信推送”。完整方案需要同时具备：

1. 小程序内消息中心；
2. 未读红点和数量；
3. 前台实时提醒；
4. 微信订阅消息；
5. 发送记录、失败重试和审计；
6. 用户授权和通知设置。

---

## 2. 设计原则

### 2.1 站内消息是业务事实来源

每个需要用户感知的业务事件，首先写入小程序自己的 `notifications` 集合。

即使微信订阅消息发送失败，用户下次进入小程序仍然能看到完整通知。

### 2.2 微信订阅消息是增强通道

微信订阅消息用于用户离开小程序后的重要提醒，但不作为唯一通知方式。

发送微信消息失败不能导致下单、接单、审批等主业务回滚。

### 2.3 只通知需要用户处理或明显影响用户的变化

避免所有字段变化都发消息，减少打扰。

应重点通知：

- 需要立即处理；
- 业务责任发生变化；
- 用户关心的结果已经产生；
- 存在超时风险；
- 审批或付款结果发生变化。

### 2.4 消息内容最小化

微信订阅消息和锁屏通知中不展示：

- 完整手机号；
- 具体寝室房间号；
- 身份材料；
- 平台内部备注；
- 付款凭证图片；
- 其他敏感信息。

消息只展示必要摘要，点击后进入小程序查看详情。

### 2.5 消息必须可追踪

每条消息需要记录：

- 为什么产生；
- 发给谁；
- 站内消息是否创建；
- 微信订阅消息是否尝试发送；
- 是否发送成功；
- 失败原因；
- 用户是否已读；
- 点击进入了哪个业务页面。

---

## 3. 通知通道

### 3.1 小程序站内消息

特点：

- 不需要额外授权；
- 可以永久保留一段时间；
- 支持未读、已读；
- 支持跳转订单、申请、店铺和后台详情；
- 是MVP必须实现的通道。

入口建议：

- “我的”页面顶部消息入口；
- 首页右上角消息图标；
- 商家工作台右上角消息图标；
- 平台后台右上角消息图标；
- 底部Tab使用红点或未读数字提醒。

### 3.2 小程序前台即时提醒

当用户正在使用小程序时，可以使用：

- Toast；
- 顶部横幅；
- 弹窗；
- 震动；
- 页面红点；
- 自动刷新订单或申请状态。

MVP不建议使用长连接作为唯一机制，可以在以下时机主动拉取：

- 页面 `onShow`；
- 下拉刷新；
- 商家订单页短周期刷新；
- 用户点击“刷新”；
- 完成业务操作后立即更新。

### 3.3 微信订阅消息

用于用户已经退出小程序后的关键提醒。

需要在微信公众平台选择订阅消息模板，取得模板ID，并由用户在明确操作场景下授权。授权结果可能是接受、拒绝或永久拒绝，因此产品不能强制要求用户同意才能继续业务。

建议授权触发点：

| 用户行为 | 请求的消息类型 |
|---|---|
| 购买者点击“提交订单” | 接单结果、配送状态、订单完成提醒 |
| 商家点击“开始营业”或“开启接单提醒” | 新订单、用户取消订单 |
| 申请人点击“提交入驻申请” | 申请进度、审核结果 |
| 平台人员点击“开启审批提醒” | 新申请、已付款待审核 |

微信订阅消息授权应由用户主动点击触发；用户拒绝后仍应允许下单、营业或提交申请。

### 3.4 后续增强通道

商家和平台管理员对及时性要求更高，可以在后续增加：

- 短信；
- 企业微信机器人；
- 平台运营工作群机器人；
- 电话告警；
- 独立Web后台浏览器通知。

MVP建议先实现“站内消息 + 微信订阅消息”。

---

## 4. 角色消息场景

## 4.1 购买者消息

| 消息编码 | 中文名称 | 触发条件 | 优先级 | 跳转页面 |
|---|---|---|---|---|
| `ORDER_ACCEPTED` | 商家已接单 | 商家将订单改为 `ACCEPTED` | 高 | 订单详情 |
| `ORDER_REJECTED` | 商家拒绝订单 | 商家将订单改为 `REJECTED` | 高 | 订单详情 |
| `ORDER_DELIVERING` | 商品开始配送 | 商家将订单改为 `DELIVERING` | 高 | 订单详情 |
| `ORDER_DELIVERED` | 商品已经送达 | 商家将订单改为 `DELIVERED` | 高 | 订单详情 |
| `ORDER_COMPLETED` | 订单已经完成 | 订单进入 `COMPLETED` | 普通 | 订单详情 |
| `ORDER_TIMEOUT_CLOSED` | 订单超时关闭 | 商家未及时接单 | 高 | 订单详情 |
| `STORE_SUSPENDED_ORDER_NOTICE` | 店铺异常提醒 | 店铺暂停影响进行中订单 | 高 | 订单详情 |

示例文案：

```text
标题：商家已接单
内容：文武小店已接受你的订单，正在准备商品。
操作：查看订单
```

```text
标题：商品已经送达
内容：商家已到达约定位置，请及时确认收货并完成线下付款。
操作：确认收货
```

---

## 4.2 商家消息

| 消息编码 | 中文名称 | 触发条件 | 优先级 | 跳转页面 |
|---|---|---|---|---|
| `NEW_ORDER` | 新订单提醒 | 购买者提交订单成功 | 紧急 | 商家订单详情 |
| `BUYER_CANCELED_ORDER` | 用户取消订单 | 待接单订单被购买者取消 | 高 | 商家订单详情 |
| `ORDER_CANCEL_REQUESTED` | 用户申请取消 | 已接单订单申请取消 | 高 | 商家订单详情 |
| `ORDER_AUTO_COMPLETED` | 订单自动完成 | 到达自动完成时间 | 普通 | 商家订单详情 |
| `PRODUCT_LOW_STOCK` | 商品库存不足 | 商品库存降至预警值 | 普通 | 商品编辑 |
| `PRODUCT_SOLD_OUT` | 商品已经售罄 | 库存变为0 | 普通 | 商品编辑 |
| `STORE_SUSPENDED` | 店铺被平台暂停 | 管理员暂停店铺 | 紧急 | 商家工作台 |
| `STORE_RESUMED` | 店铺恢复上线 | 管理员恢复店铺 | 高 | 商家工作台 |

新订单提醒建议包含：

- 店铺名；
- 订单金额；
- 商品件数；
- 下单时间；
- “请尽快接单”；
- 不展示完整寝室地址。

商家进入订单详情后才能查看履约所需的送达位置和电话。

---

## 4.3 商家申请人消息

| 消息编码 | 中文名称 | 触发条件 | 优先级 | 跳转页面 |
|---|---|---|---|---|
| `APPLICATION_SUBMITTED` | 入驻申请已提交 | 用户提交申请成功 | 普通 | 入驻进度 |
| `APPLICATION_CONTACT_FAILED` | 平台暂未联系成功 | 运营标记联系失败 | 高 | 入驻进度 |
| `APPLICATION_CONTACTED` | 平台已完成联系 | 运营标记已联系 | 普通 | 入驻进度 |
| `APPLICATION_NEED_MORE_INFO` | 需要补充资料 | 平台要求补资料 | 高 | 入驻申请编辑 |
| `APPLICATION_PAYMENT_PENDING` | 待完成线下付款 | 平台设置付款金额 | 高 | 入驻进度 |
| `APPLICATION_PAYMENT_CONFIRMED` | 平台已确认收款 | 平台登记付款成功 | 高 | 入驻进度 |
| `APPLICATION_APPROVED` | 入驻审核通过 | 管理员审核通过 | 高 | 商家工作台 |
| `APPLICATION_REJECTED` | 入驻审核未通过 | 管理员拒绝申请 | 高 | 入驻进度 |

示例文案：

```text
标题：需要补充入驻资料
内容：平台审核时发现部分资料需要补充，请进入小程序查看具体要求。
操作：补充资料
```

```text
标题：店铺审核通过
内容：你的店铺“文武小店”已经审核通过并正式上线。
操作：进入商家工作台
```

---

## 4.4 平台运营消息

| 消息编码 | 中文名称 | 触发条件 | 优先级 | 跳转页面 |
|---|---|---|---|---|
| `NEW_MERCHANT_APPLICATION` | 新商家申请 | 用户提交入驻申请 | 高 | 申请详情 |
| `APPLICATION_RESUBMITTED` | 商家重新提交资料 | 补充资料后重新提交 | 高 | 申请详情 |
| `APPLICATION_CONTACT_OVERDUE` | 商家申请联系超时 | 超过平台联系时限 | 高 | 申请详情 |
| `MERCHANT_PAYMENT_REPORTED` | 商家反馈已付款 | 后续支持商家上传付款凭证 | 高 | 申请详情 |

运营人员只接收其职责范围内的消息。后续支持分配运营人员时，优先发送给 `assignedOperatorOpenid`。

---

## 4.5 平台管理员消息

| 消息编码 | 中文名称 | 触发条件 | 优先级 | 跳转页面 |
|---|---|---|---|---|
| `APPLICATION_PAID_PENDING_APPROVAL` | 已付款待最终审核 | 运营确认线下收款 | 高 | 申请详情 |
| `HIGH_RISK_STORE_EVENT` | 店铺风险提醒 | 投诉或违规达到阈值 | 紧急 | 店铺管理 |
| `STORE_SUSPENSION_REVIEW` | 店铺暂停复核 | 运营提交暂停建议 | 高 | 店铺管理 |
| `PLATFORM_USER_CHANGED` | 平台权限发生变化 | 新增或修改平台人员 | 普通 | 平台人员管理 |

管理员消息应支持发送给多个管理员，但每个管理员产生独立的站内消息记录，分别记录已读状态。

---

## 5. 消息优先级

| 编码 | 中文名称 | 含义 | 示例 |
|---|---|---|---|
| `URGENT` | 紧急 | 需要立即处理，延迟会明显影响履约 | 新订单、店铺被暂停 |
| `HIGH` | 高优先级 | 用户明显关心或需要采取行动 | 接单、送达、待付款、待审批 |
| `NORMAL` | 普通 | 结果通知或无需立即处理 | 订单完成、付款确认 |
| `LOW` | 低优先级 | 运营提示，可合并或延迟 | 经营数据、普通系统公告 |

站内消息列表中紧急和高优先级消息可以置顶，但不能无限置顶。

---

## 6. 消息中心设计

### 6.1 入口

建议在“我的”页面增加：

```text
消息通知        3条未读  ›
```

商家工作台和平台后台顶部增加铃铛按钮：

```text
🔔 3
```

底部Tab可使用红点或未读数字，但数字建议最多显示 `99+`。

### 6.2 消息列表

消息中心支持分类：

- 全部；
- 订单；
- 商家入驻；
- 店铺经营；
- 平台审批；
- 系统通知。

单条消息展示：

- 未读圆点；
- 图标；
- 标题；
- 摘要；
- 时间；
- 业务状态；
- 点击后的目标页面。

### 6.3 消息操作

- 点击消息：标记已读并跳转业务详情；
- 单条标记已读；
- 全部标记已读；
- 删除普通消息；
- 重要业务消息不建议物理删除，只允许隐藏；
- 已失效消息点击后展示“业务状态已更新”。

### 6.4 空状态

```text
暂时没有新消息
订单、商家申请和审核进度会在这里通知你
```

---

## 7. 微信订阅授权设计

### 7.1 授权不能作为业务前置条件

用户拒绝订阅消息后：

- 仍然允许提交订单；
- 仍然允许商家开始营业；
- 仍然允许提交入驻申请；
- 站内消息照常产生。

### 7.2 购买者授权

购买者点击“提交订单”后，在同一用户操作链路中请求：

- 接单结果；
- 配送状态；
- 订单完成。

授权完成或关闭后继续创建订单，不阻塞主流程。

### 7.3 商家授权

在商家工作台增加：

```text
接单提醒：未开启 / 已授权 / 需要重新授权
```

商家点击“开启接单提醒”或“开始营业”时请求新订单提醒。

由于商家会持续接收多笔订单，不能假设一次授权可以永久发送。产品应提供明显的重新授权入口，并将微信订阅消息定位为“尽力提醒”。

### 7.4 商家申请人授权

点击“提交入驻申请”时请求：

- 审核进度；
- 付款提醒；
- 审核结果。

### 7.5 平台人员授权

平台管理首页增加：

```text
审批提醒：开启
```

平台人员主动点击后请求新申请或待审批消息授权。

---

## 8. 数据模型

## 8.1 站内消息 `notifications`

```json
{
  "_id": "消息ID",
  "recipientOpenid": "接收人OPENID",
  "recipientRole": "MERCHANT_OWNER",
  "recipientRoleLabel": "商家店主",
  "category": "ORDER",
  "categoryLabel": "订单消息",
  "type": "NEW_ORDER",
  "typeLabel": "新订单提醒",
  "priority": "URGENT",
  "priorityLabel": "紧急",
  "title": "你有一个新订单",
  "summary": "订单金额12.50元，请尽快处理。",
  "bizType": "ORDER",
  "bizTypeLabel": "订单",
  "bizId": "订单ID",
  "pagePath": "/pages/order/index?id=xxx&mode=merchant",
  "readStatus": "UNREAD",
  "readStatusLabel": "未读",
  "readAt": 0,
  "hidden": false,
  "dedupeKey": "NEW_ORDER:orderId",
  "createdAt": 0,
  "expireAt": 0
}
```

### 消息分类 `category`

| 编码 | 中文名称 |
|---|---|
| `ORDER` | 订单消息 |
| `MERCHANT_APPLICATION` | 商家入驻消息 |
| `STORE` | 店铺经营消息 |
| `PLATFORM` | 平台审批消息 |
| `SYSTEM` | 系统通知 |

### 已读状态 `readStatus`

| 编码 | 中文名称 |
|---|---|
| `UNREAD` | 未读 |
| `READ` | 已读 |

---

## 8.2 通知发送记录 `notification_deliveries`

```json
{
  "_id": "发送记录ID",
  "notificationId": "站内消息ID",
  "recipientOpenid": "接收人OPENID",
  "channel": "WECHAT_SUBSCRIBE",
  "channelLabel": "微信订阅消息",
  "templateKey": "ORDER_STATUS_NOTICE",
  "templateId": "微信模板ID",
  "deliveryStatus": "SUCCESS",
  "deliveryStatusLabel": "发送成功",
  "attemptCount": 1,
  "lastErrorCode": "",
  "lastErrorMessage": "",
  "sentAt": 0,
  "createdAt": 0,
  "updatedAt": 0
}
```

### 通知通道 `channel`

| 编码 | 中文名称 |
|---|---|
| `IN_APP` | 小程序站内消息 |
| `WECHAT_SUBSCRIBE` | 微信订阅消息 |
| `SMS` | 短信 |
| `WECom_BOT` | 企业微信机器人 |

### 发送状态 `deliveryStatus`

| 编码 | 中文名称 | 含义 |
|---|---|---|
| `PENDING` | 待发送 | 已进入发送队列 |
| `SENDING` | 发送中 | 正在调用外部通道 |
| `SUCCESS` | 发送成功 | 外部通道返回成功 |
| `FAILED_RETRYABLE` | 发送失败可重试 | 网络或服务暂时异常 |
| `FAILED_FINAL` | 最终失败 | 用户拒绝、模板无效或重试耗尽 |
| `SKIPPED` | 已跳过 | 用户未授权或该通道未启用 |

---

## 8.3 通知授权与偏好 `notification_preferences`

```json
{
  "_id": "偏好记录ID",
  "openid": "用户OPENID",
  "role": "MERCHANT_OWNER",
  "inAppEnabled": true,
  "wechatSubscribeEnabled": true,
  "templatePermissions": {
    "NEW_ORDER_NOTICE": "ACCEPT",
    "ORDER_STATUS_NOTICE": "REJECT"
  },
  "quietHoursEnabled": false,
  "quietHoursStart": "00:30",
  "quietHoursEnd": "08:00",
  "createdAt": 0,
  "updatedAt": 0
}
```

订阅授权结果建议使用：

| 编码 | 中文名称 |
|---|---|
| `ACCEPT` | 已同意 |
| `REJECT` | 已拒绝 |
| `BAN` | 永久拒绝或被禁止 |
| `UNKNOWN` | 未请求或状态未知 |

紧急订单消息不建议受普通“免打扰”完全屏蔽，但微信通道仍然必须尊重用户授权。

---

## 8.4 通知模板配置 `notification_templates`

```json
{
  "_id": "NEW_ORDER",
  "type": "NEW_ORDER",
  "typeLabel": "新订单提醒",
  "category": "ORDER",
  "recipientRoles": ["MERCHANT_OWNER"],
  "titleTemplate": "你有一个新订单",
  "summaryTemplate": "订单金额{{totalAmount}}元，请尽快处理。",
  "wechatTemplateId": "微信订阅消息模板ID",
  "pagePathTemplate": "/pages/order/index?id={{orderId}}&mode=merchant",
  "enabledChannels": ["IN_APP", "WECHAT_SUBSCRIBE"],
  "priority": "URGENT",
  "enabled": true,
  "updatedAt": 0
}
```

微信模板的字段名称由公众平台实际选择的模板决定，不能在产品方案阶段假设固定字段。

---

## 8.5 业务事件发件箱 `notification_outbox`

推荐使用发件箱避免通知发送影响业务事务：

```json
{
  "_id": "事件ID",
  "eventType": "ORDER_STATUS_CHANGED",
  "eventTypeLabel": "订单状态变化",
  "bizType": "ORDER",
  "bizId": "订单ID",
  "payload": {},
  "processStatus": "PENDING",
  "processStatusLabel": "待处理",
  "attemptCount": 0,
  "dedupeKey": "ORDER_STATUS_CHANGED:orderId:ACCEPTED",
  "createdAt": 0,
  "processedAt": 0
}
```

业务云函数只负责：

1. 完成订单或审批状态变更；
2. 写入唯一业务事件；
3. 不等待微信推送结果。

通知处理函数再负责创建站内消息和调用微信订阅消息。

---

## 9. 事件处理流程

### 9.1 新订单

```text
购买者提交订单
→ 创建订单并扣减库存
→ 写入 NEW_ORDER 业务事件
→ 为商家创建站内消息
→ 更新商家未读数量
→ 尝试发送微信订阅消息
→ 记录发送结果
→ 商家点击消息进入订单详情
→ 消息标记已读
```

### 9.2 商家接单

```text
商家点击接单
→ 订单状态变为 ACCEPTED
→ 写入 ORDER_ACCEPTED 事件
→ 为购买者创建站内消息
→ 尝试发送微信订阅消息
→ 购买者点击后进入订单详情
```

### 9.3 商家审核通过

```text
管理员审核通过
→ 申请状态变为 APPROVED
→ 创建或激活店铺
→ 授予商家角色
→ 写入 APPLICATION_APPROVED 事件
→ 为申请人创建站内消息
→ 尝试发送微信订阅消息
→ 申请人点击后进入商家工作台
```

---

## 10. 幂等与防重复

每个业务通知需要生成唯一 `dedupeKey`。

示例：

```text
NEW_ORDER:orderId
ORDER_ACCEPTED:orderId
ORDER_DELIVERED:orderId
APPLICATION_APPROVED:applicationId
APPLICATION_PAYMENT_PENDING:applicationId:feeVersion
```

创建通知前先检查相同 `dedupeKey + recipientOpenid` 是否已经存在。

即使云函数重试，也不能向同一用户重复创建消息或重复发送同一状态提醒。

---

## 11. 失败处理与重试

### 站内消息创建失败

属于系统异常，应记录日志并重试。

### 微信订阅消息发送失败

不能回滚业务状态。

处理规则：

- 网络或服务临时失败：最多重试3次；
- 用户未授权：标记 `SKIPPED`；
- 用户拒绝或禁止：标记 `FAILED_FINAL`；
- 模板无效：标记 `FAILED_FINAL` 并通知平台管理员；
- 页面路径无效：记录配置错误；
- 超过消息有效时间：停止重试。

建议重试间隔：

```text
第1次：立即
第2次：1分钟后
第3次：5分钟后
```

订单新消息如果超过履约时效，不应继续发送过期提醒。

---

## 12. 未读数量设计

### 查询方式

用户进入小程序时调用：

```text
getUnreadNotificationCount
```

返回：

```json
{
  "total": 5,
  "order": 3,
  "merchantApplication": 1,
  "platform": 1
}
```

### 红点展示

- 未读数为0：不展示；
- 1～99：展示具体数字；
- 超过99：展示 `99+`；
- 紧急消息可以额外展示红色标记。

### 已读时机

建议点击消息后立即标记已读，不要求用户必须完成业务操作。

进入业务详情页不应自动将同业务的所有消息都标记已读，避免误清理。

---

## 13. 消息设置

“我的”页面增加：

```text
消息设置
├─ 站内消息：开启
├─ 微信订阅消息：去授权
├─ 订单提醒
├─ 商家申请提醒
├─ 店铺经营提醒
└─ 平台审批提醒
```

角色不同，展示的设置不同：

- 普通用户：订单提醒；
- 商家：订单提醒、库存提醒、店铺状态提醒；
- 申请人：入驻进度提醒；
- 平台运营：申请跟进提醒；
- 管理员：待审批和风险提醒。

系统级安全和店铺封禁消息不能被站内关闭。

---

## 14. 微信模板建议

实际模板名称和关键词需要在微信公众平台订阅消息模板库中选择。产品层建议抽象为以下模板键：

| 模板键 | 用途 | 主要接收角色 |
|---|---|---|
| `NEW_ORDER_NOTICE` | 新订单提醒 | 商家 |
| `ORDER_STATUS_NOTICE` | 接单、配送、送达等订单状态 | 购买者 |
| `MERCHANT_APPLICATION_PROGRESS` | 联系、补资料、待付款 | 申请人 |
| `MERCHANT_APPLICATION_RESULT` | 审核通过或拒绝 | 申请人 |
| `ADMIN_PENDING_APPROVAL` | 已付款待最终审核 | 管理员 |

模板ID不要硬编码在小程序前端，建议保存在：

- 云函数环境变量；或
- `notification_templates` 配置集合。

---

## 15. 云函数设计

建议新增云函数操作：

```text
listNotifications
getUnreadNotificationCount
markNotificationRead
markAllNotificationsRead
hideNotification
saveNotificationPreference
getNotificationPreference
recordSubscribePermission
createBusinessNotification
processNotificationOutbox
retryNotificationDelivery
listNotificationDeliveries
```

所有查询必须使用云函数上下文中的 `OPENID`，普通用户不能传入其他用户的OPENID查询消息。

平台管理员只能在排查问题时查看发送记录，不应随意查看普通用户完整消息内容。

---

## 16. 消息产生位置

| 当前业务接口 | 需要新增的通知事件 |
|---|---|
| `createOrder` | `NEW_ORDER` 发给商家 |
| `updateOrderStatus → ACCEPTED` | `ORDER_ACCEPTED` 发给购买者 |
| `updateOrderStatus → REJECTED` | `ORDER_REJECTED` 发给购买者 |
| `updateOrderStatus → DELIVERING` | `ORDER_DELIVERING` 发给购买者 |
| `updateOrderStatus → DELIVERED` | `ORDER_DELIVERED` 发给购买者 |
| `updateOrderStatus → CANCELED` | `BUYER_CANCELED_ORDER` 发给商家 |
| `submitMerchantApplication` | `NEW_MERCHANT_APPLICATION` 发给运营；`APPLICATION_SUBMITTED` 发给申请人 |
| `markApplicationContacted` | `APPLICATION_CONTACTED` 发给申请人 |
| `requestMoreInformation` | `APPLICATION_NEED_MORE_INFO` 发给申请人 |
| `setPaymentPending` | `APPLICATION_PAYMENT_PENDING` 发给申请人 |
| `confirmOfflinePayment` | `APPLICATION_PAYMENT_CONFIRMED` 发给申请人；`APPLICATION_PAID_PENDING_APPROVAL` 发给管理员 |
| `approveMerchantApplication` | `APPLICATION_APPROVED` 发给申请人 |
| `rejectMerchantApplication` | `APPLICATION_REJECTED` 发给申请人 |
| `setStorePlatformStatus → SUSPENDED` | `STORE_SUSPENDED` 发给商家 |
| `setStorePlatformStatus → ACTIVE` | `STORE_RESUMED` 发给商家 |

---

## 17. 管理后台消息能力

平台后台增加：

### 消息发送记录

可以按照以下条件筛选：

- 接收角色；
- 消息类型；
- 业务ID；
- 发送通道；
- 发送状态；
- 时间范围。

### 模板配置

管理员可以：

- 开启或关闭某类通知；
- 配置微信模板ID；
- 查看模板适用角色；
- 测试模板；
- 查看最近失败原因。

### 失败告警

以下情况应提示管理员：

- 微信模板ID失效；
- 大量发送失败；
- 消息队列长时间未处理；
- 新订单消息延迟超过阈值；
- 同一事件产生大量重复消息。

---

## 18. 消息保留策略

建议：

- 订单消息：至少保留1年；
- 商家审批消息：至少保留2年；
- 平台操作和消息发送日志：至少保留2年；
- 普通系统运营消息：保留90天；
- 隐藏消息不立即物理删除；
- 消息到期后可以归档，减少前台查询压力。

具体保存期限应与平台最终合规和运营规则保持一致。

---

## 19. MVP范围

第一版建议实现：

1. `notifications` 站内消息集合；
2. 消息中心列表；
3. 未读数量和红点；
4. 点击消息跳转业务详情；
5. 全部已读；
6. 新订单提醒商家；
7. 订单状态提醒购买者；
8. 商家审批进度提醒申请人；
9. 新申请和已付款待审核提醒平台人员；
10. 微信订阅消息授权入口；
11. 微信发送结果记录；
12. 防重复 `dedupeKey`。

第一版暂不实现：

- 短信；
- 企业微信机器人；
- 浏览器通知；
- 复杂免打扰规则；
- 营销消息；
- 群发运营消息；
- 消息撤回。

---

## 20. 版本规划

### V0.1 站内消息闭环

- 消息集合；
- 订单和审批事件；
- 消息列表；
- 未读红点；
- 详情跳转；
- 已读状态。

### V0.2 微信订阅消息

- 模板配置；
- 用户授权；
- 云端发送；
- 发送记录；
- 失败状态；
- 重新授权入口。

### V0.3 可靠性增强

- 业务事件发件箱；
- 定时重试；
- 去重；
- 消息延迟监控；
- 平台发送记录后台。

### V1.0 多通道增强

- 短信；
- 企业微信机器人；
- 独立运营后台通知；
- 角色化通知设置；
- 运营公告。

---

## 21. 验收标准

1. 用户下单后，商家站内消息立即出现新订单；
2. 商家接单后，购买者收到站内消息；
3. 商家配送和送达后，购买者收到对应消息；
4. 商家申请状态变化后，申请人收到消息；
5. 用户提交新申请后，平台运营收到消息；
6. 平台确认付款后，管理员收到待审批消息；
7. 每条消息有中文类型、中文状态和业务跳转页面；
8. 同一业务事件不会重复创建消息；
9. 微信订阅消息失败不影响订单或审批状态；
10. 用户拒绝订阅消息后仍能正常使用业务功能；
11. 普通用户不能读取其他人的消息；
12. 商家不能读取其他商家的消息；
13. 点击消息后只标记该消息已读；
14. 未读数量与消息列表保持一致；
15. 发送失败原因可以在平台后台查询。

---

## 22. 最终建议

本项目的通知体系应采用：

```text
站内消息作为可靠主通道
+
微信订阅消息作为离开小程序后的增强提醒
+
前台刷新和红点作为实时交互反馈
```

最优先实施的三个场景是：

1. 新订单通知商家；
2. 接单、配送和送达通知购买者；
3. 商家申请和审核结果通知申请人与平台管理员。

不要直接从业务接口只调用微信推送而不保存站内消息，否则用户拒绝授权、模板失效或发送失败后，平台将没有可靠的消息补偿机制。

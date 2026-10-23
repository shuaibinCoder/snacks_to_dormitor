# 宿舍补给站——用户角色、商家审批与平台运营后台设计方案

- 文档版本：V1.0
- 编写日期：2026-10-23
- 适用阶段：MVP云端版

---

## 1. 设计目标

本方案解决三个问题：

1. 如何根据不同微信用户识别购买者、商家和平台管理者；
2. 商家创建店铺后如何经过电话联系、线下付款和平台审批再上线；
3. 哪些角色能够进入运营后台，以及不同角色可以执行哪些操作。

核心原则：

- 微信用户身份以云函数获取的 `OPENID` 为准；
- 角色和权限保存在云数据库，前端不能自行声明；
- “申请成为商家”和“已经是商家”是两个不同状态；
- 店铺创建成功不等于已经上线；
- 平台审批、收款登记、店铺上线等敏感操作必须由云函数校验权限；
- 所有管理操作必须记录审计日志。

---

## 2. 身份、角色与业务状态的区别

### 2.1 微信身份

每个微信用户第一次进入小程序时，云函数通过微信上下文取得：

- `OPENID`：当前小程序内用户的唯一身份；
- `UNIONID`：满足微信条件时可用，用于跨应用统一身份；
- 昵称和头像：由用户授权后获得，仅用于展示。

业务数据库不能相信前端传入的 `openid`。所有云函数都应使用：

```js
const { OPENID } = cloud.getWXContext()
```

作为当前操作者身份。

### 2.2 角色

角色表示用户可以做什么，例如：

- 普通用户可以下单；
- 已审核商家可以管理自己的店铺；
- 平台运营可以查看商家申请；
- 平台管理员可以审核商家和分配运营人员权限。

### 2.3 业务状态

业务状态表示某个申请、店铺或订单目前处于什么阶段，例如：

- 商家申请待联系；
- 商家已线下付款；
- 店铺审核通过；
- 店铺被暂停；
- 商品已上架。

不能简单地把“申请状态”直接当作“角色”。申请提交后，用户仍然不是正式商家。

---

## 3. 建议角色模型

### 3.1 `CUSTOMER` 普通用户

所有进入小程序的微信用户默认拥有该角色。

权限：

- 搜索店铺；
- 浏览已上线店铺和商品；
- 提交订单；
- 查看自己的订单；
- 取消订单、确认收货；
- 提交商家入驻申请。

### 3.2 `MERCHANT_APPLICANT` 商家申请人

用户提交商家申请后获得的业务身份，不代表已经有商家权限。

权限：

- 查看自己的申请进度；
- 补充申请资料；
- 查看平台联系方式；
- 申请被退回时重新提交；
- 不能管理正式店铺；
- 不能让店铺出现在搜索结果中。

该身份可以由申请记录推导，不一定要永久写进用户角色数组。

### 3.3 `MERCHANT_OWNER` 商家店主

平台审核通过后授予。

权限：

- 管理自己名下的店铺；
- 添加和编辑商品；
- 上架、下架商品；
- 修改库存；
- 接单和配送；
- 查看自己店铺的经营数据；
- 分享自己的店铺；
- 不能访问其他商家的店铺、订单和用户数据；
- 不能审核其他商家。

### 3.4 `PLATFORM_OPERATOR` 平台运营

负责日常商家联系和资料整理，但不一定拥有最终审批权。

权限：

- 查看商家申请列表；
- 查看申请人联系方式和申请材料；
- 标记“已电话联系”；
- 填写沟通备注；
- 登记线下付款信息；
- 查看店铺和商品；
- 查看平台订单概览；
- 无权添加管理员；
- 是否可以最终审批由平台决定，建议MVP阶段不可最终审批。

### 3.5 `PLATFORM_ADMIN` 平台管理员

由开发者或平台负责人担任。

权限：

- 拥有运营人员的所有权限；
- 审核通过或拒绝商家申请；
- 暂停和恢复店铺；
- 下架违规商品；
- 查看必要的订单与投诉信息；
- 配置平台公告和禁售规则；
- 查看审计日志；
- 授予或撤销普通运营角色；
- 无权修改或删除超级管理员。

### 3.6 `SUPER_ADMIN` 超级管理员

项目的最高权限角色，首期由开发者本人持有。

权限：

- 拥有全部平台权限；
- 添加、禁用平台管理员和运营人员；
- 设置角色和权限；
- 处理高风险操作；
- 查看完整审计日志；
- 配置平台关键参数。

首个超级管理员不能通过前端自助申请，必须由开发者在云数据库或安全配置中手工初始化。

---

## 4. 权限矩阵

| 功能 | 普通用户 | 申请人 | 商家 | 运营人员 | 平台管理员 | 超级管理员 |
|---|---:|---:|---:|---:|---:|---:|
| 搜索店铺和下单 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 提交商家申请 | ✓ | ✓ | - | - | - | - |
| 查看本人申请 | - | ✓ | ✓ | - | ✓ | ✓ |
| 管理本人店铺 | - | - | ✓ | 只读 | ✓ | ✓ |
| 管理其他店铺 | - | - | - | 只读 | ✓ | ✓ |
| 管理本人商品 | - | - | ✓ | 只读 | ✓ | ✓ |
| 查看商家申请列表 | - | - | - | ✓ | ✓ | ✓ |
| 电话联系登记 | - | - | - | ✓ | ✓ | ✓ |
| 线下付款登记 | - | - | - | ✓ | ✓ | ✓ |
| 最终审核通过 | - | - | - | - | ✓ | ✓ |
| 暂停店铺 | - | - | - | - | ✓ | ✓ |
| 分配运营角色 | - | - | - | - | 可选 | ✓ |
| 分配管理员角色 | - | - | - | - | - | ✓ |
| 查看审计日志 | - | - | - | 部分 | ✓ | ✓ |

---

## 5. 商家入驻审批流程

### 5.1 用户提交申请

用户点击“我要开店”，填写：

- 店铺名称；
- 经营者姓名；
- 联系电话；
- 微信号或其他联系说明（可选）；
- 店铺公告；
- 预计营业时间；
- 主营商品类型；
- 服务范围说明；
- 申请备注；
- 平台要求的资质或承诺材料。

提交后创建一条 `merchant_applications` 记录，状态为：

```text
SUBMITTED
```

页面提示：

> 申请已提交。平台工作人员将在约定时间内电话联系，请保持手机畅通。

此时不能创建正式上线的店铺，也不能进入商家工作台。

### 5.2 平台电话联系

运营人员在后台查看申请，点击“联系申请人”，可以直接拨打电话。

联系后填写：

- 联系结果；
- 联系时间；
- 沟通人员；
- 商家经营范围；
- 线下付款金额；
- 付款方式说明；
- 需要补充的资料；
- 运营备注。

申请状态更新为：

```text
CONTACTED
```

如果联系不上，可设置：

```text
CONTACT_FAILED
```

并填写下次联系时间。

### 5.3 等待线下付款

确认商家符合入驻条件后，运营将申请状态设置为：

```text
PAYMENT_PENDING
```

申请人在小程序中看到：

- 平台联系人；
- 联系电话；
- 应付金额；
- 付款说明；
- “付款后请联系平台确认”的提示。

小程序首期不处理这笔入驻费用的在线支付，只登记线下付款结果。

### 5.4 平台登记收款

平台收到线下付款后，由运营或管理员填写付款记录：

- 付款金额；
- 付款方式；
- 付款时间；
- 收款确认人；
- 付款流水备注；
- 凭证图片（可选）；
- 付款状态。

申请状态更新为：

```text
PAID
```

建议收款登记和最终审核分成两个按钮，避免误操作。

### 5.5 管理员最终审核

平台管理员检查：

- 联系信息是否真实；
- 经营内容是否允许；
- 付款是否确认；
- 店铺名称是否合适；
- 是否存在重复店铺；
- 商品和经营规则是否已告知商家。

管理员可以选择：

#### 审核通过

状态更新为：

```text
APPROVED
```

系统同时执行：

1. 给用户增加 `MERCHANT_OWNER` 角色；
2. 创建或激活店铺；
3. 将店铺 `approvalStatus` 设置为 `APPROVED`；
4. 将店铺 `platformStatus` 设置为 `ACTIVE`；
5. 给申请人发送审核通过通知；
6. 记录管理员审计日志。

#### 退回补充材料

状态更新为：

```text
NEED_MORE_INFO
```

申请人可以修改资料并再次提交。

#### 审核拒绝

状态更新为：

```text
REJECTED
```

必须填写拒绝原因。用户可以查看原因，但不能看到平台内部备注。

---

## 6. 商家申请状态机

```text
DRAFT
  ↓ 提交
SUBMITTED
  ↓ 运营联系
CONTACTED
  ↓ 确认入驻条件
PAYMENT_PENDING
  ↓ 平台确认收到线下付款
PAID
  ↓ 管理员审核
APPROVED
```

异常分支：

```text
SUBMITTED → CONTACT_FAILED
SUBMITTED / CONTACTED → NEED_MORE_INFO → SUBMITTED
SUBMITTED / CONTACTED / PAID → REJECTED
APPROVED → SUSPENDED
SUSPENDED → APPROVED
```

状态变更规则必须在云函数中校验，不能由前端传入任意目标状态。

---

## 7. 店铺状态拆分

建议不要继续只使用一个 `auditStatus` 字段。店铺至少拆分成三个状态：

### 7.1 审批状态 `approvalStatus`

```text
PENDING
APPROVED
REJECTED
```

表示平台是否允许该店铺入驻。

### 7.2 平台状态 `platformStatus`

```text
ACTIVE
SUSPENDED
BANNED
```

表示店铺是否被平台暂停或封禁。

### 7.3 营业状态 `businessStatus`

```text
OPEN
CLOSED
```

由商家控制当前是否接单。

### 7.4 店铺公开和接单规则

店铺可以出现在搜索结果中的条件：

```text
approvalStatus === APPROVED
&& platformStatus === ACTIVE
```

店铺可以接单的条件：

```text
approvalStatus === APPROVED
&& platformStatus === ACTIVE
&& businessStatus === OPEN
```

即使商家自己设置“营业中”，未经平台审批也不能出现在学生端。

---

## 8. 商品状态设计

为避免“上架”按钮语义混乱，商品列表应同时展示状态和操作。

### 已上架商品

```text
状态：已上架
操作按钮：下架
```

### 已下架商品

```text
状态：已下架
操作按钮：上架
```

商品可以被学生看到的完整条件：

```text
product.status === ON
&& store.approvalStatus === APPROVED
&& store.platformStatus === ACTIVE
```

商品库存为0时可以显示为售罄，也可以自动隐藏。MVP建议显示售罄，避免商家误以为商品被删除。

---

## 9. 用户和角色数据模型

### 9.1 用户集合 `users`

```json
{
  "_id": "用户记录ID",
  "openid": "微信OPENID",
  "nickname": "微信昵称",
  "avatar": "头像",
  "roles": ["CUSTOMER", "MERCHANT_OWNER"],
  "status": "ACTIVE",
  "createdAt": 0,
  "updatedAt": 0
}
```

注意：

- `roles` 只能由受保护的云函数修改；
- 小程序前端不能直接更新；
- 普通用户不能通过修改请求参数把自己变成管理员。

### 9.2 平台人员集合 `platform_users`

建议将平台角色单独保存，避免与普通用户资料混在一起：

```json
{
  "_id": "平台人员记录ID",
  "openid": "微信OPENID",
  "role": "SUPER_ADMIN",
  "permissions": [],
  "displayName": "平台负责人",
  "phone": "联系电话",
  "status": "ACTIVE",
  "createdBy": "创建人的OPENID",
  "createdAt": 0,
  "updatedAt": 0
}
```

`role` 可选：

```text
PLATFORM_OPERATOR
PLATFORM_ADMIN
SUPER_ADMIN
```

### 9.3 商家申请集合 `merchant_applications`

```json
{
  "_id": "申请ID",
  "applicantOpenid": "申请人OPENID",
  "storeName": "文武小店",
  "ownerName": "张三",
  "phone": "13800000000",
  "wechatContact": "可选",
  "businessHours": "10:00 - 00:00",
  "businessCategories": ["零食", "饮料"],
  "serviceDescription": "本栋宿舍配送",
  "notice": "店铺公告",
  "status": "PAYMENT_PENDING",
  "publicMessage": "请完成线下付款后联系平台",
  "internalNote": "仅平台人员可见",
  "assignedOperatorOpenid": "负责运营人员",
  "submittedAt": 0,
  "contactedAt": 0,
  "paidAt": 0,
  "approvedAt": 0,
  "approvedBy": "管理员OPENID",
  "createdAt": 0,
  "updatedAt": 0
}
```

### 9.4 线下付款记录 `merchant_payments`

```json
{
  "_id": "付款记录ID",
  "applicationId": "商家申请ID",
  "applicantOpenid": "申请人OPENID",
  "amount": 10000,
  "paymentMethod": "WECHAT_OFFLINE",
  "paymentTime": 0,
  "voucherFileId": "可选凭证",
  "status": "CONFIRMED",
  "confirmedBy": "确认人OPENID",
  "note": "备注",
  "createdAt": 0
}
```

金额继续使用“分”为单位的整数。

### 9.5 审计日志 `audit_logs`

```json
{
  "_id": "日志ID",
  "operatorOpenid": "操作者OPENID",
  "operatorRole": "PLATFORM_ADMIN",
  "action": "APPROVE_MERCHANT_APPLICATION",
  "targetType": "MERCHANT_APPLICATION",
  "targetId": "申请ID",
  "before": {},
  "after": {},
  "reason": "审核通过",
  "createdAt": 0
}
```

关键操作必须记录：

- 分配角色；
- 登记付款；
- 审核通过或拒绝；
- 暂停和恢复店铺；
- 平台下架商品；
- 修改平台配置。

---

## 10. 平台运营后台形态

### 10.1 MVP推荐：小程序内置运营后台

首期平台人员较少，可以直接在同一个小程序中增加管理页面。

“我的”页面根据云端权限动态展示：

普通用户：

```text
我的订单
我要开店 / 入驻进度
```

商家：

```text
我的订单
商家工作台
```

运营人员：

```text
商家申请处理
店铺查询
运营数据
```

平台管理员：

```text
平台管理后台
商家审批
店铺管理
角色管理
审计日志
```

即使普通用户手动输入管理页面路径，云函数也必须拒绝其数据请求。

### 10.2 后续版本：独立Web管理后台

当商家和运营人员增加后，建议开发独立Web后台，主要原因：

- 电脑端审核资料更方便；
- 列表、搜索和数据统计适合大屏幕；
- 可以使用更细的后台菜单和权限；
- 可以管理大量商家和订单；
- 审计和导出能力更完整。

小程序和Web后台可以共用同一套云数据库和服务端权限接口。

### 10.3 推荐阶段选择

| 阶段 | 推荐方案 |
|---|---|
| 1～20家商户 | 小程序内置运营后台 |
| 20～100家商户 | 小程序后台 + 简单Web后台 |
| 100家以上 | 独立Web运营后台为主 |

当前MVP建议先实现小程序内置后台。

---

## 11. 小程序管理端页面

建议增加以下页面：

### 平台人员入口

- 平台管理首页；
- 待处理申请数量；
- 待确认付款数量；
- 待最终审核数量；
- 营业店铺数量；
- 今日订单数量。

### 商家申请列表

筛选项：

- 待联系；
- 联系失败；
- 待付款；
- 已付款待审核；
- 已通过；
- 已拒绝。

### 商家申请详情

展示：

- 申请人资料；
- 联系电话；
- 店铺资料；
- 申请时间；
- 当前状态；
- 沟通记录；
- 付款记录；
- 审核历史。

操作：

- 拨打电话；
- 标记已联系；
- 要求补充资料；
- 设置待付款；
- 确认线下收款；
- 审核通过；
- 审核拒绝。

### 店铺管理

- 搜索店铺；
- 查看店铺商品；
- 暂停店铺；
- 恢复店铺；
- 平台下架商品；
- 查看违规记录。

### 平台人员管理

仅超级管理员可见：

- 添加运营人员；
- 添加平台管理员；
- 暂停平台账号；
- 查看最近操作；
- 撤销权限。

---

## 12. 云函数权限设计

### 12.1 获取当前身份

增加云函数操作：

```text
getMyIdentity
```

返回：

```json
{
  "openid": "脱敏或不返回完整值",
  "roles": ["CUSTOMER", "MERCHANT_OWNER"],
  "platformRole": null,
  "permissions": ["STORE_MANAGE_SELF"],
  "merchantApplicationStatus": "APPROVED",
  "storeId": "store_xxx"
}
```

小程序根据返回值展示入口，但入口隐藏不等于安全控制。

### 12.2 权限中间件

云函数中增加统一方法：

```js
async function requirePlatformRole(openid, allowedRoles) {
  const result = await db.collection('platform_users')
    .where({ openid, status: 'ACTIVE' })
    .limit(1)
    .get()

  const user = result.data[0]
  if (!user || !allowedRoles.includes(user.role)) {
    throw new Error('无平台管理权限')
  }
  return user
}
```

商家权限：

```js
async function requireStoreOwner(openid, storeId) {
  const store = await db.collection('stores').doc(storeId).get()
  if (store.data.ownerOpenid !== openid) {
    throw new Error('无权管理该店铺')
  }
  if (store.data.approvalStatus !== 'APPROVED') {
    throw new Error('店铺尚未通过审核')
  }
  return store.data
}
```

### 12.3 管理接口

建议增加：

```text
submitMerchantApplication
getMyMerchantApplication
listMerchantApplications
getMerchantApplicationDetail
markApplicationContacted
requestMoreInformation
setPaymentPending
confirmOfflinePayment
approveMerchantApplication
rejectMerchantApplication
suspendStore
resumeStore
listPlatformUsers
savePlatformUser
getAuditLogs
```

每个接口必须在云函数中校验对应角色。

---

## 13. 超级管理员初始化

首次上线时数据库中还没有管理员，需要安全地创建第一个超级管理员。

推荐流程：

1. 开发者在小程序中调用仅返回本人身份的 `getOpenId` 或 `getMyIdentity`；
2. 在云开发控制台手工创建 `platform_users` 记录；
3. 将开发者的 `openid` 写入；
4. 设置：

```json
{
  "role": "SUPER_ADMIN",
  "status": "ACTIVE"
}
```

5. 之后所有运营和管理员账号都由超级管理员在后台添加；
6. 不提供“申请成为平台管理员”的公开入口。

不能把管理员权限只写在小程序前端，例如：

```js
if (nickname === '管理员')
```

也不能只通过隐藏按钮保护管理后台。

---

## 14. 隐私和数据可见范围

### 普通用户

只能查看：

- 公开店铺信息；
- 公开商品信息；
- 自己的地址和订单。

### 商家

只能查看：

- 自己店铺的信息；
- 自己店铺的商品；
- 自己店铺收到的订单；
- 履约必要的联系人、电话和送达位置。

### 运营人员

可以查看：

- 商家申请的联系方式；
- 商家申请资料；
- 入驻沟通和付款状态。

原则上不能批量导出普通购买者手机号和宿舍位置。

### 平台管理员

因投诉或运营需要可查询订单，但需要：

- 权限控制；
- 查询日志；
- 敏感字段脱敏；
- 不允许无目的批量查看。

---

## 15. 当前项目改造建议

当前项目是“创建店铺后立即 `APPROVED`”，需要改为：

### 当前逻辑

```text
用户创建店铺
→ 自动审核通过
→ 立即出现在搜索结果
```

### 目标逻辑

```text
用户提交商家申请
→ 等待平台联系
→ 等待线下付款
→ 平台确认收款
→ 管理员审核
→ 创建/激活店铺
→ 授予商家角色
→ 店铺在平台上线
```

### 数据迁移

现有测试店铺可以统一处理为：

```json
{
  "approvalStatus": "APPROVED",
  "platformStatus": "ACTIVE",
  "businessStatus": "OPEN"
}
```

现有 `auditStatus` 可暂时保留兼容，完成迁移后再移除。

现有商品状态统一为：

```text
ON：已上架
OFF：已下架
```

---

## 16. MVP实施顺序

### 第一阶段：角色基础

- 新增 `users`；
- 新增 `platform_users`；
- 新增 `getMyIdentity`；
- 初始化超级管理员；
- “我的”页面按权限显示不同入口。

### 第二阶段：商家申请

- 创建商家申请页；
- 创建申请进度页；
- 新增 `merchant_applications`；
- 未审核用户不能进入商家工作台。

### 第三阶段：小程序运营后台

- 管理首页；
- 商家申请列表；
- 申请详情；
- 电话联系记录；
- 线下付款确认；
- 审核通过/拒绝。

### 第四阶段：店铺治理

- 暂停店铺；
- 恢复店铺；
- 平台下架商品；
- 操作日志；
- 角色管理。

---

## 17. MVP验收标准

1. 任意微信用户默认只能使用普通用户功能；
2. 提交商家申请后不能直接进入商家工作台；
3. 未审核店铺不会出现在搜索结果；
4. 运营人员可以电话联系并记录结果；
5. 运营人员可以登记线下付款；
6. 只有平台管理员可以最终审核通过；
7. 审核通过后用户获得商家权限；
8. 商家只能管理自己的店铺；
9. 普通用户即使手动进入后台路径也无法读取管理数据；
10. 平台管理员可以暂停店铺；
11. 被暂停店铺不能接单；
12. 商品明确显示“已上架/已下架”；
13. 所有审批、付款和权限操作都有审计日志；
14. 只有超级管理员可以添加平台管理员；
15. 前端传入伪造角色不能绕过云函数权限。

---

## 18. 最终推荐

当前阶段建议采用：

- 同一个微信小程序承载购买者端、商家端和MVP运营后台；
- 微信 `OPENID` 作为基础身份；
- `platform_users` 控制运营和管理员权限；
- 开发者本人作为首个 `SUPER_ADMIN`；
- 商家申请必须经过“提交申请—电话联系—线下付款—管理员审核”流程；
- 审核通过后才创建或激活店铺并授予 `MERCHANT_OWNER`；
- 所有权限判断都在云函数完成；
- 商家规模扩大后，再将运营后台迁移为独立Web管理端。

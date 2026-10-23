const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const { DICTIONARY_VERSION, getEnumLabel, dictionaryDocuments } = require('./enums')
const { SCHEMA_VERSION, schemaDocuments } = require('./schemas')

const COLLECTIONS = [
  'users',
  'platform_users',
  'merchant_applications',
  'merchant_payments',
  'audit_logs',
  'system_dictionaries',
  'system_collection_schemas',
  'stores',
  'products',
  'orders'
]

const PLATFORM_ROLES = {
  OPERATOR: 'PLATFORM_OPERATOR',
  ADMIN: 'PLATFORM_ADMIN',
  SUPER: 'SUPER_ADMIN'
}

const APPLICATION_STATUS = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  CONTACT_FAILED: 'CONTACT_FAILED',
  CONTACTED: 'CONTACTED',
  NEED_MORE_INFO: 'NEED_MORE_INFO',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAID: 'PAID',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED'
}

function ok(data) { return { success: true, data } }
function fail(message, code = 'BUSINESS_ERROR') { return { success: false, message, code } }
function context() { return cloud.getWXContext() }
function now() { return Date.now() }
function orderNo() { return `${Date.now()}${Math.floor(Math.random() * 90 + 10)}` }
function unique(list) { return Array.from(new Set(list || [])) }

async function initCollections() {
  for (const name of COLLECTIONS) {
    try { await db.createCollection(name) } catch (error) { /* collection already exists */ }
  }
  await seedSystemDictionaries()
  await seedCollectionSchemas()
  return true
}

async function seedSystemDictionaries() {
  const meta = await db.collection('system_dictionaries').doc('__meta__').get().then(res => res.data).catch(() => null)
  if (meta && meta.version === DICTIONARY_VERSION) return false
  for (const document of dictionaryDocuments()) {
    const { _id, ...data } = document
    await db.collection('system_dictionaries').doc(_id).set({ data })
  }
  await db.collection('system_dictionaries').doc('__meta__').set({
    data: {
      type: '__meta__',
      name: '数据字典版本',
      description: '记录固定枚举中文说明的当前版本。',
      version: DICTIONARY_VERSION,
      updatedAt: now()
    }
  })
  await backfillChineseLabels()
  return true
}

async function seedCollectionSchemas() {
  const meta = await db.collection('system_collection_schemas').doc('__meta__').get().then(res => res.data).catch(() => null)
  if (meta && meta.version === SCHEMA_VERSION) return false
  for (const document of schemaDocuments()) {
    const { _id, ...data } = document
    await db.collection('system_collection_schemas').doc(_id).set({ data })
  }
  await db.collection('system_collection_schemas').doc('__meta__').set({
    data: {
      collection: '__meta__',
      name: '字段说明版本',
      description: '记录数据库集合与字段中文说明的当前版本。',
      version: SCHEMA_VERSION,
      updatedAt: now()
    }
  })
  return true
}

async function backfillCollection(collectionName, decorator) {
  const result = await db.collection(collectionName).limit(100).get()
  for (const item of result.data) {
    const labels = decorator(item)
    if (labels && Object.keys(labels).length) await db.collection(collectionName).doc(item._id).update({ data: labels })
  }
}

async function backfillChineseLabels() {
  await backfillCollection('users', item => ({
    roleLabels: (item.roles || []).map(code => getEnumLabel('USER_ROLE', code)),
    statusLabel: getEnumLabel('ACCOUNT_STATUS', item.status)
  }))
  await backfillCollection('platform_users', item => ({
    roleLabel: getEnumLabel('PLATFORM_ROLE', item.role),
    statusLabel: getEnumLabel('ACCOUNT_STATUS', item.status)
  }))
  await backfillCollection('merchant_applications', item => ({ statusLabel: getEnumLabel('APPLICATION_STATUS', item.status) }))
  await backfillCollection('merchant_payments', item => ({
    statusLabel: getEnumLabel('PAYMENT_STATUS', item.status),
    paymentMethodLabel: getEnumLabel('PAYMENT_METHOD', item.paymentMethod)
  }))
  await backfillCollection('stores', item => {
    const store = normalizeStore(item)
    return {
      approvalStatusLabel: getEnumLabel('STORE_APPROVAL_STATUS', store.approvalStatus),
      platformStatusLabel: getEnumLabel('STORE_PLATFORM_STATUS', store.platformStatus),
      businessStatusLabel: getEnumLabel('STORE_BUSINESS_STATUS', store.businessStatus)
    }
  })
  await backfillCollection('products', item => ({ statusLabel: getEnumLabel('PRODUCT_STATUS', item.status || 'ON') }))
  await backfillCollection('orders', item => ({
    statusLabel: getEnumLabel('ORDER_STATUS', item.status),
    statusHistory: (item.statusHistory || []).map(history => ({ ...history, statusLabel: getEnumLabel('ORDER_STATUS', history.status) }))
  }))
  await backfillCollection('audit_logs', item => ({
    operatorRoleLabel: getEnumLabel('PLATFORM_ROLE', item.operatorRole),
    actionLabel: getEnumLabel('AUDIT_ACTION', item.action),
    targetTypeLabel: getEnumLabel('AUDIT_TARGET_TYPE', item.targetType)
  }))
}

function normalizeStore(store) {
  if (!store) return null
  const approvalStatus = store.approvalStatus || (store.auditStatus === 'APPROVED' ? 'APPROVED' : 'PENDING')
  const platformStatus = store.platformStatus || 'ACTIVE'
  const businessStatus = store.businessStatus || (store.isOpen ? 'OPEN' : 'CLOSED')
  return {
    ...store,
    approvalStatus,
    platformStatus,
    businessStatus,
    auditStatus: approvalStatus,
    isOpen: businessStatus === 'OPEN',
    approvalStatusLabel: getEnumLabel('STORE_APPROVAL_STATUS', approvalStatus),
    platformStatusLabel: getEnumLabel('STORE_PLATFORM_STATUS', platformStatus),
    businessStatusLabel: getEnumLabel('STORE_BUSINESS_STATUS', businessStatus)
  }
}

function storeIsPublic(store) {
  const normalized = normalizeStore(store)
  return normalized && normalized.approvalStatus === 'APPROVED' && normalized.platformStatus === 'ACTIVE'
}

function storeCanTakeOrders(store) {
  const normalized = normalizeStore(store)
  return storeIsPublic(normalized) && normalized.businessStatus === 'OPEN'
}

async function getUser(openid) {
  const result = await db.collection('users').where({ openid }).limit(1).get()
  return result.data[0] || null
}

async function ensureUser(openid) {
  let user = await getUser(openid)
  if (!user) {
    const timestamp = now()
    const data = {
      openid,
      roles: ['CUSTOMER'],
      roleLabels: [getEnumLabel('USER_ROLE', 'CUSTOMER')],
      status: 'ACTIVE',
      statusLabel: getEnumLabel('ACCOUNT_STATUS', 'ACTIVE'),
      createdAt: timestamp,
      updatedAt: timestamp
    }
    const added = await db.collection('users').add({ data })
    user = { _id: added._id, ...data }
  }

  // 兼容旧版中已经自动审核通过的商家。
  const legacyStoreResult = await db.collection('stores').where({ ownerOpenid: openid }).limit(1).get()
  const legacyStore = legacyStoreResult.data[0]
  if (legacyStore && storeIsPublic(legacyStore) && !(user.roles || []).includes('MERCHANT_OWNER')) {
    const roles = unique([...(user.roles || ['CUSTOMER']), 'MERCHANT_OWNER'])
    await db.collection('users').doc(user._id).update({ data: { roles, roleLabels: roles.map(code => getEnumLabel('USER_ROLE', code)), updatedAt: now() } })
    user.roles = roles
  }
  return user
}

async function getPlatformUser(openid) {
  const result = await db.collection('platform_users').where({ openid }).limit(10).get()
  return result.data.find(item => item.status === 'ACTIVE') || null
}

async function requirePlatformRole(openid, allowedRoles) {
  const platformUser = await getPlatformUser(openid)
  if (!platformUser || !allowedRoles.includes(platformUser.role)) throw new Error('无平台管理权限')
  return platformUser
}

async function writeAudit(operator, action, targetType, targetId, before, after, reason = '') {
  await db.collection('audit_logs').add({
    data: {
      operatorOpenid: operator.openid,
      operatorRole: operator.role,
      operatorRoleLabel: getEnumLabel('PLATFORM_ROLE', operator.role),
      action,
      actionLabel: getEnumLabel('AUDIT_ACTION', action),
      targetType,
      targetTypeLabel: getEnumLabel('AUDIT_TARGET_TYPE', targetType),
      targetId,
      before: before || null,
      after: after || null,
      reason,
      createdAt: now()
    }
  })
}

async function getOwnedStore(openid) {
  const result = await db.collection('stores').where({ ownerOpenid: openid }).limit(1).get()
  return normalizeStore(result.data[0] || null)
}

async function requireOwnedStore(openid, storeId, requireApproved = true) {
  const raw = await db.collection('stores').doc(storeId).get().then(res => res.data).catch(() => null)
  const store = normalizeStore(raw)
  if (!store || store.ownerOpenid !== openid) throw new Error('无权操作该店铺')
  if (requireApproved && store.approvalStatus !== 'APPROVED') throw new Error('店铺尚未通过平台审核')
  if (requireApproved && store.platformStatus !== 'ACTIVE') throw new Error('店铺已被平台暂停')
  return store
}

async function getLatestApplication(openid) {
  const result = await db.collection('merchant_applications').where({ applicantOpenid: openid }).limit(20).get()
  return result.data.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null
}

function publicApplication(application) {
  if (!application) return null
  const copy = { ...application, statusLabel: getEnumLabel('APPLICATION_STATUS', application.status) }
  delete copy.internalNote
  delete copy.contactLogs
  return copy
}

function permissionsFor(platformRole, roles) {
  const permissions = ['ORDER_CREATE', 'ORDER_VIEW_SELF', 'MERCHANT_APPLY']
  if ((roles || []).includes('MERCHANT_OWNER')) permissions.push('STORE_MANAGE_SELF', 'PRODUCT_MANAGE_SELF', 'ORDER_MANAGE_STORE')
  if ([PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER].includes(platformRole)) {
    permissions.push('APPLICATION_LIST', 'APPLICATION_CONTACT', 'PAYMENT_CONFIRM', 'STORE_VIEW_ALL')
  }
  if ([PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER].includes(platformRole)) {
    permissions.push('APPLICATION_APPROVE', 'STORE_SUSPEND', 'PRODUCT_MODERATE', 'AUDIT_LOG_VIEW')
  }
  if (platformRole === PLATFORM_ROLES.SUPER) permissions.push('PLATFORM_USER_MANAGE', 'PLATFORM_CONFIG_MANAGE')
  return unique(permissions)
}

async function getMyIdentity(openid) {
  const user = await ensureUser(openid)
  const [platformUser, application, store] = await Promise.all([
    getPlatformUser(openid),
    getLatestApplication(openid),
    getOwnedStore(openid)
  ])
  return {
    openid,
    roles: user.roles || ['CUSTOMER'],
    platformRole: platformUser ? platformUser.role : null,
    permissions: permissionsFor(platformUser && platformUser.role, user.roles),
    merchantApplication: publicApplication(application),
    store
  }
}

async function submitMerchantApplication(event, openid) {
  const input = event.application || {}
  const storeName = String(input.storeName || '').trim()
  const ownerName = String(input.ownerName || '').trim()
  const phone = String(input.phone || '').trim()
  if (storeName.length < 2) throw new Error('店铺名称至少2个字')
  if (!ownerName) throw new Error('请填写经营者姓名')
  if (!/^1\d{10}$/.test(phone)) throw new Error('请输入正确手机号')

  const existingStore = await getOwnedStore(openid)
  if (existingStore && existingStore.approvalStatus === 'APPROVED') throw new Error('你已经拥有审核通过的店铺')

  const existing = await getLatestApplication(openid)
  const editableStatuses = [
    APPLICATION_STATUS.DRAFT,
    APPLICATION_STATUS.NEED_MORE_INFO,
    APPLICATION_STATUS.REJECTED,
    APPLICATION_STATUS.CONTACT_FAILED
  ]
  if (existing && !editableStatuses.includes(existing.status)) throw new Error('当前申请正在处理中，请勿重复提交')

  const timestamp = now()
  const data = {
    applicantOpenid: openid,
    storeName,
    ownerName,
    phone,
    wechatContact: String(input.wechatContact || '').trim(),
    businessHours: String(input.businessHours || '19:00 - 00:00').trim(),
    businessCategories: Array.isArray(input.businessCategories) ? input.businessCategories : [],
    serviceDescription: String(input.serviceDescription || '').trim(),
    notice: String(input.notice || '欢迎光临我的宿舍小店').trim(),
    minimumOrder: Math.max(0, Number(input.minimumOrder || 0)),
    deliveryFee: Math.max(0, Number(input.deliveryFee || 0)),
    deliveryMinutes: Math.max(1, Number(input.deliveryMinutes || 15)),
    status: APPLICATION_STATUS.SUBMITTED,
    statusLabel: getEnumLabel('APPLICATION_STATUS', APPLICATION_STATUS.SUBMITTED),
    publicMessage: '申请已提交，平台工作人员将通过电话联系，请保持手机畅通。',
    submittedAt: timestamp,
    updatedAt: timestamp
  }

  if (existing) {
    await db.collection('merchant_applications').doc(existing._id).update({ data })
    return publicApplication({ ...existing, ...data })
  }

  const added = await db.collection('merchant_applications').add({ data: { ...data, createdAt: timestamp } })
  return publicApplication({ _id: added._id, ...data, createdAt: timestamp })
}

async function getMyMerchantApplication(openid) {
  return publicApplication(await getLatestApplication(openid))
}

async function listMerchantApplications(event, openid) {
  await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  let result
  if (event.status && event.status !== 'ALL') {
    result = await db.collection('merchant_applications').where({ status: event.status }).limit(100).get()
  } else {
    result = await db.collection('merchant_applications').limit(100).get()
  }
  return result.data.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
}

async function getMerchantApplicationDetail(event, openid) {
  await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const application = await db.collection('merchant_applications').doc(event.applicationId).get().then(res => res.data).catch(() => null)
  if (!application) throw new Error('申请不存在')
  const paymentResult = await db.collection('merchant_payments').where({ applicationId: application._id }).limit(20).get()
  return { application, payments: paymentResult.data.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)) }
}

async function markApplicationContacted(event, openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const application = await db.collection('merchant_applications').doc(event.applicationId).get().then(res => res.data).catch(() => null)
  if (!application) throw new Error('申请不存在')
  if (![APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.CONTACT_FAILED].includes(application.status)) throw new Error('当前状态不能标记为已联系')
  const timestamp = now()
  const contactLog = { operatorOpenid: openid, result: 'CONTACTED', resultLabel: getEnumLabel('CONTACT_RESULT', 'CONTACTED'), note: String(event.note || ''), time: timestamp }
  const after = {
    status: APPLICATION_STATUS.CONTACTED,
    statusLabel: getEnumLabel('APPLICATION_STATUS', APPLICATION_STATUS.CONTACTED),
    publicMessage: '平台已完成电话联系，正在确认入驻和付款信息。',
    assignedOperatorOpenid: openid,
    contactedAt: timestamp,
    contactLogs: _.push(contactLog),
    updatedAt: timestamp
  }
  await db.collection('merchant_applications').doc(application._id).update({ data: after })
  await writeAudit(operator, 'MARK_APPLICATION_CONTACTED', 'MERCHANT_APPLICATION', application._id, application, { status: APPLICATION_STATUS.CONTACTED }, event.note)
  return true
}

async function markApplicationContactFailed(event, openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const application = await db.collection('merchant_applications').doc(event.applicationId).get().then(res => res.data).catch(() => null)
  if (!application) throw new Error('申请不存在')
  const timestamp = now()
  await db.collection('merchant_applications').doc(application._id).update({
    data: {
      status: APPLICATION_STATUS.CONTACT_FAILED,
      statusLabel: getEnumLabel('APPLICATION_STATUS', APPLICATION_STATUS.CONTACT_FAILED),
      publicMessage: '平台暂未联系到你，请保持电话畅通或检查联系电话。',
      contactLogs: _.push({ operatorOpenid: openid, result: 'CONTACT_FAILED', resultLabel: getEnumLabel('CONTACT_RESULT', 'CONTACT_FAILED'), note: String(event.note || ''), time: timestamp }),
      updatedAt: timestamp
    }
  })
  await writeAudit(operator, 'MARK_APPLICATION_CONTACT_FAILED', 'MERCHANT_APPLICATION', application._id, application, { status: APPLICATION_STATUS.CONTACT_FAILED }, event.note)
  return true
}

async function requestMoreInformation(event, openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const application = await db.collection('merchant_applications').doc(event.applicationId).get().then(res => res.data).catch(() => null)
  if (!application) throw new Error('申请不存在')
  const message = String(event.message || '').trim()
  if (!message) throw new Error('请填写需要补充的内容')
  await db.collection('merchant_applications').doc(application._id).update({
    data: { status: APPLICATION_STATUS.NEED_MORE_INFO, statusLabel: getEnumLabel('APPLICATION_STATUS', APPLICATION_STATUS.NEED_MORE_INFO), publicMessage: message, internalNote: String(event.internalNote || ''), updatedAt: now() }
  })
  await writeAudit(operator, 'REQUEST_MORE_INFORMATION', 'MERCHANT_APPLICATION', application._id, application, { status: APPLICATION_STATUS.NEED_MORE_INFO }, message)
  return true
}

async function setPaymentPending(event, openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const application = await db.collection('merchant_applications').doc(event.applicationId).get().then(res => res.data).catch(() => null)
  if (!application) throw new Error('申请不存在')
  if (![APPLICATION_STATUS.CONTACTED, APPLICATION_STATUS.SUBMITTED].includes(application.status)) throw new Error('请先完成电话联系')
  const feeAmount = Math.max(0, Math.floor(Number(event.feeAmount || 0)))
  const paymentInstruction = String(event.paymentInstruction || '请按电话沟通方式完成线下付款，付款后联系平台确认。').trim()
  await db.collection('merchant_applications').doc(application._id).update({
    data: {
      status: APPLICATION_STATUS.PAYMENT_PENDING,
      statusLabel: getEnumLabel('APPLICATION_STATUS', APPLICATION_STATUS.PAYMENT_PENDING),
      feeAmount,
      paymentInstruction,
      publicMessage: paymentInstruction,
      updatedAt: now()
    }
  })
  await writeAudit(operator, 'SET_PAYMENT_PENDING', 'MERCHANT_APPLICATION', application._id, application, { status: APPLICATION_STATUS.PAYMENT_PENDING, feeAmount }, '')
  return true
}

async function confirmOfflinePayment(event, openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const application = await db.collection('merchant_applications').doc(event.applicationId).get().then(res => res.data).catch(() => null)
  if (!application) throw new Error('申请不存在')
  if (application.status !== APPLICATION_STATUS.PAYMENT_PENDING) throw new Error('当前申请不处于待付款状态')
  const amount = Math.max(0, Math.floor(Number(event.amount === undefined ? application.feeAmount : event.amount)))
  const timestamp = now()
  const payment = {
    applicationId: application._id,
    applicantOpenid: application.applicantOpenid,
    amount,
    paymentMethod: String(event.paymentMethod || 'WECHAT_OFFLINE'),
    paymentTime: Number(event.paymentTime || timestamp),
    voucherFileId: String(event.voucherFileId || ''),
    status: 'CONFIRMED',
    statusLabel: getEnumLabel('PAYMENT_STATUS', 'CONFIRMED'),
    paymentMethodLabel: getEnumLabel('PAYMENT_METHOD', String(event.paymentMethod || 'WECHAT_OFFLINE')),
    confirmedBy: openid,
    note: String(event.note || ''),
    createdAt: timestamp
  }
  await db.collection('merchant_payments').add({ data: payment })
  await db.collection('merchant_applications').doc(application._id).update({
    data: { status: APPLICATION_STATUS.PAID, statusLabel: getEnumLabel('APPLICATION_STATUS', APPLICATION_STATUS.PAID), paidAt: timestamp, publicMessage: '平台已确认收到线下付款，等待管理员最终审核。', updatedAt: timestamp }
  })
  await writeAudit(operator, 'CONFIRM_OFFLINE_PAYMENT', 'MERCHANT_APPLICATION', application._id, application, { status: APPLICATION_STATUS.PAID, amount }, event.note)
  return true
}

async function approveMerchantApplication(event, openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const application = await db.collection('merchant_applications').doc(event.applicationId).get().then(res => res.data).catch(() => null)
  if (!application) throw new Error('申请不存在')
  if (application.status !== APPLICATION_STATUS.PAID) throw new Error('只有已确认付款的申请可以审核通过')

  const existingStore = await getOwnedStore(application.applicantOpenid)
  const applicantUser = await getUser(application.applicantOpenid)
  const timestamp = now()
  let storeId = existingStore && existingStore._id

  await db.runTransaction(async transaction => {
    if (existingStore) {
      await transaction.collection('stores').doc(existingStore._id).update({
        data: {
          name: application.storeName,
          ownerName: application.ownerName,
          phone: application.phone,
          notice: application.notice,
          businessHours: application.businessHours,
          minimumOrder: Number(application.minimumOrder || 0),
          deliveryFee: Number(application.deliveryFee || 0),
          deliveryMinutes: Number(application.deliveryMinutes || 15),
          approvalStatus: 'APPROVED',
          approvalStatusLabel: getEnumLabel('STORE_APPROVAL_STATUS', 'APPROVED'),
          auditStatus: 'APPROVED',
          platformStatus: 'ACTIVE',
          platformStatusLabel: getEnumLabel('STORE_PLATFORM_STATUS', 'ACTIVE'),
          businessStatus: 'OPEN',
          businessStatusLabel: getEnumLabel('STORE_BUSINESS_STATUS', 'OPEN'),
          isOpen: true,
          approvedAt: timestamp,
          approvedBy: openid,
          updatedAt: timestamp
        }
      })
    } else {
      const logos = ['🐱', '🐶', '🐼', '🦁', '🦊', '🐰']
      const added = await transaction.collection('stores').add({
        data: {
          ownerOpenid: application.applicantOpenid,
          applicationId: application._id,
          name: application.storeName,
          logoEmoji: logos[Math.floor(Math.random() * logos.length)],
          notice: application.notice,
          ownerName: application.ownerName,
          phone: application.phone,
          businessHours: application.businessHours,
          deliveryMinutes: Number(application.deliveryMinutes || 15),
          minimumOrder: Number(application.minimumOrder || 0),
          deliveryFee: Number(application.deliveryFee || 0),
          rating: 5,
          monthlySales: 0,
          approvalStatus: 'APPROVED',
          approvalStatusLabel: getEnumLabel('STORE_APPROVAL_STATUS', 'APPROVED'),
          auditStatus: 'APPROVED',
          platformStatus: 'ACTIVE',
          platformStatusLabel: getEnumLabel('STORE_PLATFORM_STATUS', 'ACTIVE'),
          businessStatus: 'OPEN',
          businessStatusLabel: getEnumLabel('STORE_BUSINESS_STATUS', 'OPEN'),
          isOpen: true,
          approvedAt: timestamp,
          approvedBy: openid,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      })
      storeId = added._id
    }

    if (applicantUser) {
      const roles = unique([...(applicantUser.roles || ['CUSTOMER']), 'MERCHANT_OWNER'])
      await transaction.collection('users').doc(applicantUser._id).update({ data: { roles, roleLabels: roles.map(code => getEnumLabel('USER_ROLE', code)), updatedAt: timestamp } })
    } else {
      await transaction.collection('users').add({ data: { openid: application.applicantOpenid, roles: ['CUSTOMER', 'MERCHANT_OWNER'], roleLabels: [getEnumLabel('USER_ROLE', 'CUSTOMER'), getEnumLabel('USER_ROLE', 'MERCHANT_OWNER')], status: 'ACTIVE', statusLabel: getEnumLabel('ACCOUNT_STATUS', 'ACTIVE'), createdAt: timestamp, updatedAt: timestamp } })
    }

    await transaction.collection('merchant_applications').doc(application._id).update({
      data: {
        status: APPLICATION_STATUS.APPROVED,
        statusLabel: getEnumLabel('APPLICATION_STATUS', APPLICATION_STATUS.APPROVED),
        storeId,
        approvedAt: timestamp,
        approvedBy: openid,
        publicMessage: '入驻申请已审核通过，店铺已正式上线。',
        updatedAt: timestamp
      }
    })
  })

  await writeAudit(operator, 'APPROVE_MERCHANT_APPLICATION', 'MERCHANT_APPLICATION', application._id, application, { status: APPLICATION_STATUS.APPROVED, storeId }, String(event.note || ''))
  return { storeId }
}

async function rejectMerchantApplication(event, openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const application = await db.collection('merchant_applications').doc(event.applicationId).get().then(res => res.data).catch(() => null)
  if (!application) throw new Error('申请不存在')
  if (application.status === APPLICATION_STATUS.APPROVED) throw new Error('已通过的申请不能直接拒绝，请暂停店铺')
  const reason = String(event.reason || '').trim()
  if (!reason) throw new Error('请填写拒绝原因')
  await db.collection('merchant_applications').doc(application._id).update({
    data: { status: APPLICATION_STATUS.REJECTED, statusLabel: getEnumLabel('APPLICATION_STATUS', APPLICATION_STATUS.REJECTED), publicMessage: reason, rejectedAt: now(), rejectedBy: openid, updatedAt: now() }
  })
  await writeAudit(operator, 'REJECT_MERCHANT_APPLICATION', 'MERCHANT_APPLICATION', application._id, application, { status: APPLICATION_STATUS.REJECTED }, reason)
  return true
}

async function listStores(event) {
  const query = String(event.query || '').trim().toLowerCase()
  // MVP阶段最多读取100家已审核店铺后在云函数中按名称过滤，避免复合索引配置差异。
  const result = await db.collection('stores').where({ auditStatus: 'APPROVED' }).limit(100).get()
  return result.data
    .map(normalizeStore)
    .filter(store => storeIsPublic(store) && (!query || String(store.name || '').toLowerCase().includes(query)))
    .sort((a, b) => Number(b.monthlySales || 0) - Number(a.monthlySales || 0))
}

async function getStore(event) {
  const storeId = String(event.storeId || '').trim()
  if (!storeId) throw new Error('缺少店铺ID')
  const rawStore = await db.collection('stores').doc(storeId).get().then(res => res.data).catch(() => null)
  const store = normalizeStore(rawStore)
  if (!store || !storeIsPublic(store)) throw new Error('店铺不存在或暂未开放')
  const result = await db.collection('products').where({ storeId }).limit(100).get()
  const products = result.data
    .filter(product => product.status !== 'OFF')
    .map(product => ({ ...product, status: product.status || 'ON', category: product.category || '其他' }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
  return { store, products, apiVersion: '2.0.0' }
}

async function getMyStore(openid) {
  return getOwnedStore(openid)
}

async function saveStore(event, openid) {
  const input = event.store || {}
  if (!input._id) throw new Error('请先提交商家申请并等待平台审核')
  await requireOwnedStore(openid, input._id)
  const data = {
    name: String(input.name || '').trim(),
    ownerName: String(input.ownerName || '').trim(),
    phone: String(input.phone || ''),
    notice: String(input.notice || '').trim(),
    businessHours: String(input.businessHours || ''),
    minimumOrder: Math.max(0, Number(input.minimumOrder || 0)),
    deliveryFee: Math.max(0, Number(input.deliveryFee || 0)),
    deliveryMinutes: Math.max(1, Number(input.deliveryMinutes || 15)),
    updatedAt: now()
  }
  if (!data.name || !data.ownerName || !/^1\d{10}$/.test(data.phone)) throw new Error('店铺信息不完整')
  await db.collection('stores').doc(input._id).update({ data })
  return normalizeStore(await db.collection('stores').doc(input._id).get().then(res => res.data))
}

async function setStoreOpen(event, openid) {
  const store = await requireOwnedStore(openid, event.storeId)
  const businessStatus = event.isOpen ? 'OPEN' : 'CLOSED'
  await db.collection('stores').doc(store._id).update({ data: { isOpen: !!event.isOpen, businessStatus, businessStatusLabel: getEnumLabel('STORE_BUSINESS_STATUS', businessStatus), updatedAt: now() } })
  return normalizeStore(await db.collection('stores').doc(store._id).get().then(res => res.data))
}

async function listProducts(event, openid) {
  await requireOwnedStore(openid, event.storeId)
  const result = await db.collection('products').where({ storeId: event.storeId }).limit(100).get()
  return result.data.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

async function getProduct(event, openid) {
  const product = await db.collection('products').doc(event.productId).get().then(res => res.data).catch(() => null)
  if (!product) return null
  await requireOwnedStore(openid, product.storeId)
  return product
}

async function saveProduct(event, openid) {
  const input = event.product || {}
  await requireOwnedStore(openid, input.storeId)
  const data = {
    storeId: input.storeId,
    name: String(input.name || '').trim(),
    category: String(input.category || '其他'),
    price: Math.max(1, Number(input.price || 0)),
    stock: Math.max(0, Math.floor(Number(input.stock || 0))),
    emoji: String(input.emoji || '🍪'),
    image: String(input.image || ''),
    status: input.status === 'OFF' ? 'OFF' : 'ON',
    statusLabel: getEnumLabel('PRODUCT_STATUS', input.status === 'OFF' ? 'OFF' : 'ON'),
    updatedAt: now()
  }
  if (!data.name) throw new Error('商品名称不能为空')
  if (input._id) {
    const old = await db.collection('products').doc(input._id).get().then(res => res.data).catch(() => null)
    if (!old || old.storeId !== input.storeId) throw new Error('商品不存在')
    await db.collection('products').doc(input._id).update({ data })
    return db.collection('products').doc(input._id).get().then(res => res.data)
  }
  const added = await db.collection('products').add({ data: { ...data, sold: 0, createdAt: now() } })
  return db.collection('products').doc(added._id).get().then(res => res.data)
}

async function toggleProduct(event, openid) {
  const product = await db.collection('products').doc(event.productId).get().then(res => res.data).catch(() => null)
  if (!product) throw new Error('商品不存在')
  await requireOwnedStore(openid, product.storeId)
  await db.collection('products').doc(event.productId).update({ data: { status: event.status === 'OFF' ? 'OFF' : 'ON', statusLabel: getEnumLabel('PRODUCT_STATUS', event.status === 'OFF' ? 'OFF' : 'ON'), updatedAt: now() } })
  return true
}

async function createOrder(event, openid) {
  const input = event.order || {}
  const requested = Array.isArray(input.items) ? input.items : []
  if (!requested.length) throw new Error('购物车为空')

  return db.runTransaction(async transaction => {
    const rawStore = await transaction.collection('stores').doc(input.storeId).get().then(res => res.data).catch(() => null)
    const store = normalizeStore(rawStore)
    if (!store || !storeCanTakeOrders(store)) throw new Error('店铺当前无法接单')

    let goodsAmount = 0
    const items = []
    for (const requestedItem of requested) {
      const quantity = Math.max(1, Math.floor(Number(requestedItem.quantity || 1)))
      const product = await transaction.collection('products').doc(requestedItem.productId).get().then(res => res.data).catch(() => null)
      if (!product || product.storeId !== store._id || product.status === 'OFF') throw new Error('部分商品已下架')
      if (Number(product.stock || 0) < quantity) throw new Error(`${product.name}库存不足`)
      await transaction.collection('products').doc(product._id).update({ data: { stock: _.inc(-quantity), updatedAt: now() } })
      items.push({ productId: product._id, name: product.name, price: product.price, quantity, emoji: product.emoji, image: product.image || '' })
      goodsAmount += product.price * quantity
    }
    if (goodsAmount < Number(store.minimumOrder || 0)) throw new Error('未达到起送金额')

    const timestamp = now()
    const order = {
      orderNo: orderNo(),
      buyerOpenid: openid,
      sellerOpenid: store.ownerOpenid,
      storeId: store._id,
      storeName: store.name,
      storeLogoEmoji: store.logoEmoji,
      items,
      goodsAmount,
      deliveryFee: Number(store.deliveryFee || 0),
      totalAmount: goodsAmount + Number(store.deliveryFee || 0),
      contactName: String(input.contactName || '').trim(),
      phone: String(input.phone || ''),
      location: String(input.location || '').trim(),
      deliveryMethod: String(input.deliveryMethod || ''),
      note: String(input.note || '').trim(),
      status: 'CREATED',
      statusLabel: getEnumLabel('ORDER_STATUS', 'CREATED'),
      statusHistory: [{ status: 'CREATED', statusLabel: getEnumLabel('ORDER_STATUS', 'CREATED'), time: timestamp }],
      createdAt: timestamp,
      updatedAt: timestamp
    }
    const added = await transaction.collection('orders').add({ data: order })
    return { _id: added._id, ...order }
  })
}

async function listOrders(event, openid) {
  const where = event.role === 'merchant' ? { sellerOpenid: openid } : { buyerOpenid: openid }
  const result = await db.collection('orders').where(where).limit(100).get()
  return result.data.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
}

async function getOrder(event, openid) {
  const order = await db.collection('orders').doc(event.orderId).get().then(res => res.data).catch(() => null)
  if (!order) return null
  const platformUser = await getPlatformUser(openid)
  if (order.buyerOpenid !== openid && order.sellerOpenid !== openid && !platformUser) throw new Error('无权查看该订单')
  return order
}

async function updateOrderStatus(event, openid) {
  const order = await getOrder(event, openid)
  if (!order) throw new Error('订单不存在')
  const isSeller = order.sellerOpenid === openid
  const isBuyer = order.buyerOpenid === openid
  const target = event.status
  const sellerTransitions = { CREATED: ['ACCEPTED', 'REJECTED'], ACCEPTED: ['DELIVERING'], DELIVERING: ['DELIVERED'], DELIVERED: ['COMPLETED'] }
  const buyerTransitions = { CREATED: ['CANCELED'], DELIVERED: ['COMPLETED'] }
  const allowed = isSeller ? sellerTransitions[order.status] : isBuyer ? buyerTransitions[order.status] : []
  if (!allowed || !allowed.includes(target)) throw new Error('当前订单状态不允许此操作')

  await db.runTransaction(async transaction => {
    if (['CANCELED', 'REJECTED'].includes(target)) {
      for (const item of order.items) await transaction.collection('products').doc(item.productId).update({ data: { stock: _.inc(item.quantity), updatedAt: now() } })
    }
    if (target === 'COMPLETED' && order.status !== 'COMPLETED') {
      for (const item of order.items) await transaction.collection('products').doc(item.productId).update({ data: { sold: _.inc(item.quantity), updatedAt: now() } })
      await transaction.collection('stores').doc(order.storeId).update({ data: { monthlySales: _.inc(1), updatedAt: now() } })
    }
    await transaction.collection('orders').doc(order._id).update({ data: { status: target, statusLabel: getEnumLabel('ORDER_STATUS', target), statusHistory: _.push({ status: target, statusLabel: getEnumLabel('ORDER_STATUS', target), time: now() }), updatedAt: now() } })
  })
  return db.collection('orders').doc(order._id).get().then(res => res.data)
}

async function getMerchantStats(openid) {
  const store = await getOwnedStore(openid)
  if (!store || store.approvalStatus !== 'APPROVED') return { pending: 0, delivering: 0, todayOrders: 0, todayAmount: 0, lowStock: 0 }
  const orders = await db.collection('orders').where({ storeId: store._id }).limit(100).get()
  const products = await db.collection('products').where({ storeId: store._id }).limit(100).get()
  const visibleProducts = products.data.filter(item => item.status !== 'OFF')
  const start = new Date(); start.setHours(0, 0, 0, 0)
  const todayOrders = orders.data.filter(item => Number(item.createdAt) >= start.getTime())
  return {
    pending: orders.data.filter(item => item.status === 'CREATED').length,
    delivering: orders.data.filter(item => ['ACCEPTED', 'DELIVERING', 'DELIVERED'].includes(item.status)).length,
    todayOrders: todayOrders.length,
    todayAmount: todayOrders.filter(item => item.status === 'COMPLETED').reduce((sum, item) => sum + item.totalAmount, 0),
    lowStock: visibleProducts.filter(item => Number(item.stock || 0) <= 3).length
  }
}

async function getAdminDashboard(openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const [applications, stores, logs] = await Promise.all([
    db.collection('merchant_applications').limit(100).get(),
    db.collection('stores').limit(100).get(),
    db.collection('audit_logs').limit(20).get()
  ])
  const pendingStatuses = [APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.CONTACT_FAILED, APPLICATION_STATUS.CONTACTED, APPLICATION_STATUS.PAYMENT_PENDING, APPLICATION_STATUS.PAID]
  return {
    role: operator.role,
    pendingApplications: applications.data.filter(item => pendingStatuses.includes(item.status)).length,
    paymentPending: applications.data.filter(item => item.status === APPLICATION_STATUS.PAYMENT_PENDING).length,
    approvalPending: applications.data.filter(item => item.status === APPLICATION_STATUS.PAID).length,
    activeStores: stores.data.map(normalizeStore).filter(item => item.platformStatus === 'ACTIVE' && item.approvalStatus === 'APPROVED').length,
    recentLogs: logs.data.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)).slice(0, 10)
  }
}

async function listAdminStores(openid) {
  await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const result = await db.collection('stores').limit(100).get()
  return result.data.map(normalizeStore).sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
}

async function setStorePlatformStatus(event, openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const store = normalizeStore(await db.collection('stores').doc(event.storeId).get().then(res => res.data).catch(() => null))
  if (!store) throw new Error('店铺不存在')
  const platformStatus = event.platformStatus === 'ACTIVE' ? 'ACTIVE' : 'SUSPENDED'
  await db.collection('stores').doc(store._id).update({ data: { platformStatus, platformStatusLabel: getEnumLabel('STORE_PLATFORM_STATUS', platformStatus), updatedAt: now() } })
  await writeAudit(operator, platformStatus === 'ACTIVE' ? 'RESUME_STORE' : 'SUSPEND_STORE', 'STORE', store._id, store, { platformStatus }, String(event.reason || ''))
  return true
}

async function listPlatformUsers(openid) {
  await requirePlatformRole(openid, [PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const result = await db.collection('platform_users').limit(100).get()
  return result.data.sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0))
}

async function savePlatformUser(event, openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const input = event.platformUser || {}
  const targetOpenid = String(input.openid || '').trim()
  const targetRole = String(input.role || '')
  if (!targetOpenid) throw new Error('请输入用户身份ID')
  if (![PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN].includes(targetRole)) throw new Error('角色不正确')
  if (operator.role !== PLATFORM_ROLES.SUPER && targetRole !== PLATFORM_ROLES.OPERATOR) throw new Error('只有超级管理员可以添加平台管理员')

  const existingResult = await db.collection('platform_users').where({ openid: targetOpenid }).limit(1).get()
  const existing = existingResult.data[0]
  if (existing && existing.role === PLATFORM_ROLES.SUPER) throw new Error('不能修改超级管理员')
  const data = {
    openid: targetOpenid,
    role: targetRole,
    roleLabel: getEnumLabel('PLATFORM_ROLE', targetRole),
    displayName: String(input.displayName || '').trim() || '平台人员',
    phone: String(input.phone || '').trim(),
    status: input.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    statusLabel: getEnumLabel('ACCOUNT_STATUS', input.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'),
    updatedAt: now()
  }
  if (existing) await db.collection('platform_users').doc(existing._id).update({ data })
  else await db.collection('platform_users').add({ data: { ...data, createdBy: openid, createdAt: now() } })
  await writeAudit(operator, 'SAVE_PLATFORM_USER', 'PLATFORM_USER', existing ? existing._id : targetOpenid, existing, data, '')
  return true
}


async function listCollectionSchemas(openid) {
  await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const result = await db.collection('system_collection_schemas').limit(100).get()
  return result.data
    .filter(item => item.collection !== '__meta__')
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
}

async function listSystemDictionaries(openid) {
  await requirePlatformRole(openid, [PLATFORM_ROLES.OPERATOR, PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  const result = await db.collection('system_dictionaries').limit(100).get()
  return result.data
    .filter(item => item.type !== '__meta__')
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
}

async function syncChineseDescriptions(openid) {
  const operator = await requirePlatformRole(openid, [PLATFORM_ROLES.ADMIN, PLATFORM_ROLES.SUPER])
  await seedSystemDictionaries()
  await backfillChineseLabels()
  await writeAudit(operator, 'SYNC_CHINESE_DESCRIPTIONS', 'SYSTEM_DICTIONARY', DICTIONARY_VERSION, null, { version: DICTIONARY_VERSION }, '同步数据库中文说明')
  return { version: DICTIONARY_VERSION }
}

exports.main = async event => {
  const { OPENID } = context()
  try {
    switch (event.action) {
      case 'initCollections': return ok(await initCollections())
      case 'getMyIdentity': return ok(await getMyIdentity(OPENID))
      case 'submitMerchantApplication': return ok(await submitMerchantApplication(event, OPENID))
      case 'getMyMerchantApplication': return ok(await getMyMerchantApplication(OPENID))
      case 'listMerchantApplications': return ok(await listMerchantApplications(event, OPENID))
      case 'getMerchantApplicationDetail': return ok(await getMerchantApplicationDetail(event, OPENID))
      case 'markApplicationContacted': return ok(await markApplicationContacted(event, OPENID))
      case 'markApplicationContactFailed': return ok(await markApplicationContactFailed(event, OPENID))
      case 'requestMoreInformation': return ok(await requestMoreInformation(event, OPENID))
      case 'setPaymentPending': return ok(await setPaymentPending(event, OPENID))
      case 'confirmOfflinePayment': return ok(await confirmOfflinePayment(event, OPENID))
      case 'approveMerchantApplication': return ok(await approveMerchantApplication(event, OPENID))
      case 'rejectMerchantApplication': return ok(await rejectMerchantApplication(event, OPENID))
      case 'listStores': return ok(await listStores(event))
      case 'getStore': return ok(await getStore(event))
      case 'getMyStore': return ok(await getMyStore(OPENID))
      case 'saveStore': return ok(await saveStore(event, OPENID))
      case 'setStoreOpen': return ok(await setStoreOpen(event, OPENID))
      case 'listProducts': return ok(await listProducts(event, OPENID))
      case 'getProduct': return ok(await getProduct(event, OPENID))
      case 'saveProduct': return ok(await saveProduct(event, OPENID))
      case 'toggleProduct': return ok(await toggleProduct(event, OPENID))
      case 'createOrder': return ok(await createOrder(event, OPENID))
      case 'listOrders': return ok(await listOrders(event, OPENID))
      case 'getOrder': return ok(await getOrder(event, OPENID))
      case 'updateOrderStatus': return ok(await updateOrderStatus(event, OPENID))
      case 'getMerchantStats': return ok(await getMerchantStats(OPENID))
      case 'getAdminDashboard': return ok(await getAdminDashboard(OPENID))
      case 'listAdminStores': return ok(await listAdminStores(OPENID))
      case 'setStorePlatformStatus': return ok(await setStorePlatformStatus(event, OPENID))
      case 'listPlatformUsers': return ok(await listPlatformUsers(OPENID))
      case 'savePlatformUser': return ok(await savePlatformUser(event, OPENID))
      case 'listSystemDictionaries': return ok(await listSystemDictionaries(OPENID))
      case 'listCollectionSchemas': return ok(await listCollectionSchemas(OPENID))
      case 'syncChineseDescriptions': return ok(await syncChineseDescriptions(OPENID))
      default: return fail('未知操作', 'UNKNOWN_ACTION')
    }
  } catch (error) {
    console.error(event.action, error)
    return fail(error.message || '服务异常')
  }
}

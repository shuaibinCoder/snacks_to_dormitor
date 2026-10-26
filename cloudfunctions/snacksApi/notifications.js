const SHARED_TEMPLATE_KEY = 'SHARED_BUSINESS_NOTICE'

function createNotificationService({ cloud, db, command, now, getEnumLabel }) {
  const _ = command

  function truncate(value, length) {
    const text = String(value || '').trim()
    return text.length > length ? `${text.slice(0, Math.max(1, length - 1))}…` : text
  }

  function formatDateTime(timestamp) {
    const date = new Date(timestamp || now())
    const pad = value => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }

  async function ensureSharedTemplate() {
    const existing = await db.collection('notification_templates').doc(SHARED_TEMPLATE_KEY).get().then(res => res.data).catch(() => null)
    if (existing) return existing
    const data = {
      key: SHARED_TEMPLATE_KEY,
      keyLabel: '统一业务状态通知模板',
      description: '订单、商家入驻、店铺和平台审批消息共用的微信订阅消息模板。',
      templateId: '',
      enabled: false,
      miniprogramState: 'trial',
      fields: {
        titleKey: 'thing1',
        statusKey: 'phrase2',
        timeKey: 'time3',
        remarkKey: 'thing4'
      },
      createdAt: now(),
      updatedAt: now()
    }
    await db.collection('notification_templates').doc(SHARED_TEMPLATE_KEY).set({ data })
    return { _id: SHARED_TEMPLATE_KEY, ...data }
  }

  async function getNotificationConfig() {
    const config = await ensureSharedTemplate()
    return {
      templateKey: SHARED_TEMPLATE_KEY,
      templateId: config.templateId || '',
      enabled: !!(config.enabled && config.templateId),
      keyLabel: config.keyLabel,
      description: config.description
    }
  }

  async function saveNotificationTemplate(input) {
    const old = await ensureSharedTemplate()
    const fields = input.fields || {}
    const data = {
      key: SHARED_TEMPLATE_KEY,
      keyLabel: '统一业务状态通知模板',
      description: '订单、商家入驻、店铺和平台审批消息共用的微信订阅消息模板。',
      templateId: String(input.templateId || '').trim(),
      enabled: !!input.enabled,
      miniprogramState: ['developer', 'trial', 'formal'].includes(input.miniprogramState) ? input.miniprogramState : 'trial',
      fields: {
        titleKey: String(fields.titleKey || 'thing1').trim(),
        statusKey: String(fields.statusKey || 'phrase2').trim(),
        timeKey: String(fields.timeKey || 'time3').trim(),
        remarkKey: String(fields.remarkKey || 'thing4').trim()
      },
      createdAt: old.createdAt || now(),
      updatedAt: now()
    }
    await db.collection('notification_templates').doc(SHARED_TEMPLATE_KEY).set({ data })
    return { _id: SHARED_TEMPLATE_KEY, ...data }
  }

  function getSubscriptionRole(notification) {
    if (notification.subscriptionRole) return notification.subscriptionRole
    if (notification.recipientRole === 'MERCHANT_OWNER') return 'MERCHANT'
    if (['PLATFORM_OPERATOR', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(notification.recipientRole)) return 'PLATFORM'
    if (notification.category === 'MERCHANT_APPLICATION') return 'APPLICANT'
    if (notification.category === 'ORDER') return 'BUYER'
    return 'GENERAL'
  }

  async function listPreferences(openid) {
    const result = await db.collection('notification_preferences').where({ openid }).limit(20).get()
    return result.data.filter(item => item.templateKey === SHARED_TEMPLATE_KEY)
  }

  async function getPreference(openid, subscriptionRole = 'GENERAL', allowGeneralFallback = false) {
    const preferences = await listPreferences(openid)
    const exact = preferences.find(item => (item.subscriptionRole || 'GENERAL') === subscriptionRole)
    if (exact) return exact
    if (allowGeneralFallback && subscriptionRole !== 'GENERAL') {
      return preferences.find(item => (item.subscriptionRole || 'GENERAL') === 'GENERAL') || null
    }
    return null
  }

  async function recordSubscribePermission(openid, result, scene, subscriptionRole = 'GENERAL') {
    const permission = String(result || 'UNKNOWN').toUpperCase()
    const role = String(subscriptionRole || 'GENERAL').toUpperCase()
    const existing = await getPreference(openid, role)
    const accepted = permission === 'ACCEPT'
    const data = {
      openid,
      templateKey: SHARED_TEMPLATE_KEY,
      templateKeyLabel: '统一业务状态通知模板',
      subscriptionRole: role,
      subscriptionRoleLabel: getEnumLabel('NOTIFICATION_SUBSCRIPTION_ROLE', role),
      lastPermission: permission,
      lastPermissionLabel: getEnumLabel('SUBSCRIBE_PERMISSION', permission),
      grantedCount: Math.max(0, Number(existing && existing.grantedCount || 0) + (accepted ? 1 : 0)),
      lastScene: String(scene || ''),
      updatedAt: now()
    }
    if (existing) await db.collection('notification_preferences').doc(existing._id).update({ data })
    else await db.collection('notification_preferences').add({ data: { ...data, createdAt: now() } })
    return data
  }

  async function addDelivery(notification, channel, status, extra = {}) {
    const subscriptionRole = extra.subscriptionRole || getSubscriptionRole(notification)
    await db.collection('notification_deliveries').add({
      data: {
        notificationId: notification._id,
        recipientOpenid: notification.recipientOpenid,
        recipientRole: notification.recipientRole,
        recipientRoleLabel: notification.recipientRoleLabel,
        subscriptionRole,
        subscriptionRoleLabel: getEnumLabel('NOTIFICATION_SUBSCRIPTION_ROLE', subscriptionRole),
        channel,
        channelLabel: getEnumLabel('NOTIFICATION_CHANNEL', channel),
        templateKey: SHARED_TEMPLATE_KEY,
        templateId: extra.templateId || '',
        deliveryStatus: status,
        deliveryStatusLabel: getEnumLabel('NOTIFICATION_DELIVERY_STATUS', status),
        attemptCount: Number(extra.attemptCount || 0),
        lastErrorCode: String(extra.lastErrorCode || ''),
        lastErrorMessage: String(extra.lastErrorMessage || ''),
        sentAt: extra.sentAt || 0,
        createdAt: now(),
        updatedAt: now()
      }
    })
  }

  async function consumeGrant(preference) {
    if (!preference || Number(preference.grantedCount || 0) <= 0) return
    await db.collection('notification_preferences').doc(preference._id).update({
      data: { grantedCount: _.inc(-1), updatedAt: now() }
    })
  }

  async function sendSubscribe(notification) {
    const config = await ensureSharedTemplate()
    const subscriptionRole = getSubscriptionRole(notification)
    const preference = await getPreference(notification.recipientOpenid, subscriptionRole, true)
    if (!config.enabled || !config.templateId) {
      await addDelivery(notification, 'WECHAT_SUBSCRIBE', 'SKIPPED', { subscriptionRole, lastErrorMessage: '统一订阅消息模板尚未配置或未启用' })
      return false
    }
    if (!preference || Number(preference.grantedCount || 0) <= 0) {
      await addDelivery(notification, 'WECHAT_SUBSCRIBE', 'SKIPPED', { subscriptionRole, templateId: config.templateId, lastErrorMessage: `${getEnumLabel('NOTIFICATION_SUBSCRIPTION_ROLE', subscriptionRole)}暂无可用订阅授权次数` })
      return false
    }

    const fields = config.fields || {}
    const data = {}
    if (fields.titleKey) data[fields.titleKey] = { value: truncate(notification.title, 20) }
    if (fields.statusKey) data[fields.statusKey] = { value: truncate(notification.statusText || notification.typeLabel, 5) }
    if (fields.timeKey) data[fields.timeKey] = { value: formatDateTime(notification.createdAt) }
    if (fields.remarkKey) data[fields.remarkKey] = { value: truncate(notification.summary, 20) }

    try {
      await cloud.openapi.subscribeMessage.send({
        touser: notification.recipientOpenid,
        page: String(notification.pagePath || '/pages/messages/index').replace(/^\//, ''),
        lang: 'zh_CN',
        miniprogramState: config.miniprogramState || 'trial',
        templateId: config.templateId,
        data
      })
      await consumeGrant(preference)
      await addDelivery(notification, 'WECHAT_SUBSCRIBE', 'SUCCESS', { subscriptionRole, templateId: config.templateId, attemptCount: 1, sentAt: now() })
      return true
    } catch (error) {
      const errorCode = error.errCode || error.code || ''
      const errorMessage = error.errMsg || error.message || '订阅消息发送失败'
      if (String(errorCode) === '43101' || /user refuse|subscribe/i.test(errorMessage)) {
        await db.collection('notification_preferences').doc(preference._id).update({ data: { grantedCount: 0, lastPermission: 'REJECT', lastPermissionLabel: getEnumLabel('SUBSCRIBE_PERMISSION', 'REJECT'), updatedAt: now() } })
      }
      await addDelivery(notification, 'WECHAT_SUBSCRIBE', 'FAILED_FINAL', { subscriptionRole, templateId: config.templateId, attemptCount: 1, lastErrorCode: errorCode, lastErrorMessage: errorMessage })
      console.error('subscribeMessage.send failed', error)
      return false
    }
  }

  async function findDuplicate(recipientOpenid, dedupeKey) {
    if (!dedupeKey) return null
    const result = await db.collection('notifications').where({ dedupeKey }).limit(20).get()
    return result.data.find(item => item.recipientOpenid === recipientOpenid) || null
  }

  async function createNotification(input) {
    if (!input || !input.recipientOpenid) return null
    const duplicate = await findDuplicate(input.recipientOpenid, input.dedupeKey)
    if (duplicate) return duplicate

    const timestamp = now()
    const data = {
      recipientOpenid: input.recipientOpenid,
      recipientRole: input.recipientRole || 'CUSTOMER',
      recipientRoleLabel: getEnumLabel(input.recipientRole && input.recipientRole.startsWith('PLATFORM_') || input.recipientRole === 'SUPER_ADMIN' ? 'PLATFORM_ROLE' : 'USER_ROLE', input.recipientRole || 'CUSTOMER'),
      category: input.category || 'SYSTEM',
      categoryLabel: getEnumLabel('NOTIFICATION_CATEGORY', input.category || 'SYSTEM'),
      type: input.type,
      typeLabel: getEnumLabel('NOTIFICATION_TYPE', input.type),
      priority: input.priority || 'NORMAL',
      priorityLabel: getEnumLabel('NOTIFICATION_PRIORITY', input.priority || 'NORMAL'),
      title: String(input.title || getEnumLabel('NOTIFICATION_TYPE', input.type)),
      summary: String(input.summary || ''),
      statusText: String(input.statusText || ''),
      bizType: input.bizType || 'SYSTEM',
      bizTypeLabel: getEnumLabel('NOTIFICATION_BIZ_TYPE', input.bizType || 'SYSTEM'),
      bizId: String(input.bizId || ''),
      pagePath: String(input.pagePath || '/pages/messages/index'),
      readStatus: 'UNREAD',
      readStatusLabel: getEnumLabel('NOTIFICATION_READ_STATUS', 'UNREAD'),
      readAt: 0,
      hidden: false,
      dedupeKey: String(input.dedupeKey || `${input.type}:${input.bizId}:${timestamp}`),
      createdAt: timestamp,
      expireAt: Number(input.expireAt || timestamp + 365 * 24 * 60 * 60 * 1000)
    }
    const added = await db.collection('notifications').add({ data })
    const notification = { _id: added._id, ...data }
    await addDelivery(notification, 'IN_APP', 'SUCCESS', { attemptCount: 1, sentAt: timestamp })
    const wechatSent = await sendSubscribe(notification)
    return { ...notification, wechatSent }
  }

  async function sendTestNotification(openid, subscriptionRole = 'GENERAL') {
    const timestamp = now()
    return createNotification({
      recipientOpenid: openid,
      recipientRole: subscriptionRole === 'PLATFORM' ? 'PLATFORM_ADMIN' : subscriptionRole === 'MERCHANT' ? 'MERCHANT_OWNER' : 'CUSTOMER',
      subscriptionRole,
      category: 'SYSTEM',
      type: 'TEST_NOTIFICATION',
      priority: 'NORMAL',
      title: '微信提醒测试',
      summary: '如果你收到这条服务通知，说明统一订阅消息模板配置正常。',
      statusText: '测试成功',
      bizType: 'SYSTEM',
      bizId: String(timestamp),
      pagePath: '/pages/messages/index',
      dedupeKey: `TEST_NOTIFICATION:${openid}:${timestamp}`,
      expireAt: timestamp + 10 * 60 * 1000
    })
  }

  async function getMyNotificationDiagnostics(openid) {
    const [config, preferences, deliveries] = await Promise.all([
      ensureSharedTemplate(),
      listPreferences(openid),
      db.collection('notification_deliveries').where({ recipientOpenid: openid }).limit(50).get()
    ])
    return {
      config: {
        templateId: config.templateId || '',
        enabled: !!config.enabled,
        miniprogramState: config.miniprogramState || 'trial',
        fields: config.fields || {}
      },
      preferences,
      preference: preferences.find(item => (item.subscriptionRole || 'GENERAL') === 'PLATFORM') || preferences[0] || null,
      latestDeliveries: deliveries.data
        .filter(item => item.channel === 'WECHAT_SUBSCRIBE')
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        .slice(0, 10)
    }
  }

  async function notifyPlatformUsers(input, roles) {
    const result = await db.collection('platform_users').limit(100).get()
    const recipients = result.data.filter(item => item.status === 'ACTIVE' && (!roles || roles.includes(item.role)))
    for (const recipient of recipients) {
      await createNotification({ ...input, recipientOpenid: recipient.openid, recipientRole: recipient.role, dedupeKey: `${input.dedupeKey}:${recipient.openid}` })
    }
    return recipients.length
  }

  async function listNotifications(openid, event) {
    const result = await db.collection('notifications').where({ recipientOpenid: openid }).limit(100).get()
    let list = result.data.filter(item => !item.hidden)
    if (event.category && event.category !== 'ALL') list = list.filter(item => item.category === event.category)
    if (event.unreadOnly) list = list.filter(item => item.readStatus === 'UNREAD')
    return list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
  }

  async function getUnreadNotificationCount(openid) {
    const result = await db.collection('notifications').where({ recipientOpenid: openid }).limit(100).get()
    const unread = result.data.filter(item => !item.hidden && item.readStatus === 'UNREAD')
    const categories = {}
    unread.forEach(item => { categories[item.category] = Number(categories[item.category] || 0) + 1 })
    return { total: unread.length, categories }
  }

  async function markNotificationRead(openid, notificationId) {
    const notification = await db.collection('notifications').doc(notificationId).get().then(res => res.data).catch(() => null)
    if (!notification || notification.recipientOpenid !== openid) throw new Error('消息不存在或无权操作')
    await db.collection('notifications').doc(notificationId).update({
      data: { readStatus: 'READ', readStatusLabel: getEnumLabel('NOTIFICATION_READ_STATUS', 'READ'), readAt: now() }
    })
    return true
  }

  async function markAllNotificationsRead(openid) {
    const result = await db.collection('notifications').where({ recipientOpenid: openid }).limit(100).get()
    for (const item of result.data.filter(row => row.readStatus === 'UNREAD')) {
      await db.collection('notifications').doc(item._id).update({ data: { readStatus: 'READ', readStatusLabel: getEnumLabel('NOTIFICATION_READ_STATUS', 'READ'), readAt: now() } })
    }
    return true
  }

  return {
    ensureSharedTemplate,
    getNotificationConfig,
    saveNotificationTemplate,
    recordSubscribePermission,
    createNotification,
    sendTestNotification,
    getMyNotificationDiagnostics,
    notifyPlatformUsers,
    listNotifications,
    getUnreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead
  }
}

module.exports = { SHARED_TEMPLATE_KEY, createNotificationService }

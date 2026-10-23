const APPLICATION_STATUS = {
  DRAFT: { text: '草稿', tone: 'muted', step: 0 },
  SUBMITTED: { text: '待平台联系', tone: 'warn', step: 1 },
  CONTACT_FAILED: { text: '联系未成功', tone: 'warn', step: 1 },
  CONTACTED: { text: '已完成联系', tone: 'info', step: 2 },
  NEED_MORE_INFO: { text: '待补充资料', tone: 'warn', step: 1 },
  PAYMENT_PENDING: { text: '待线下付款', tone: 'warn', step: 3 },
  PAID: { text: '已付款待审核', tone: 'info', step: 4 },
  APPROVED: { text: '审核通过', tone: 'success', step: 5 },
  REJECTED: { text: '审核未通过', tone: 'muted', step: 1 },
  SUSPENDED: { text: '已暂停', tone: 'muted', step: 5 }
}

const PLATFORM_ROLE_NAMES = {
  PLATFORM_OPERATOR: '平台运营',
  PLATFORM_ADMIN: '平台管理员',
  SUPER_ADMIN: '超级管理员'
}

function decorateApplication(application) {
  if (!application) return null
  const meta = APPLICATION_STATUS[application.status] || { text: application.status, tone: 'muted', step: 0 }
  return Object.assign({}, application, {
    statusText: meta.text,
    statusTone: meta.tone,
    currentStep: meta.step,
    feeAmountText: (Number(application.feeAmount || 0) / 100).toFixed(2)
  })
}

module.exports = { APPLICATION_STATUS, PLATFORM_ROLE_NAMES, decorateApplication }

const assert = require('assert')
const { createNotificationService } = require('../cloudfunctions/snacksApi/notifications')

const collections = {}; let seq = 0
const rows = name => collections[name] || (collections[name] = [])
function updateObject(target, data) { Object.entries(data).forEach(([key, value]) => { target[key] = value && value.__inc !== undefined ? Number(target[key] || 0) + value.__inc : value }) }
const db = {
  collection(name) {
    return {
      doc(id) {
        return {
          async get() {
            const item = rows(name).find(row => row._id === id)
            if (!item) throw new Error('not found')
            return { data: { ...item } }
          },
          async set({ data }) {
            const list = rows(name)
            const index = list.findIndex(row => row._id === id)
            const item = { _id: id, ...data }
            if (index >= 0) list[index] = item
            else list.push(item)
          },
          async update({ data }) {
            const item = rows(name).find(row => row._id === id)
            updateObject(item, data)
          }
        }
      },
      where(query) {
        return {
          limit() {
            return {
              async get() {
                return { data: rows(name).filter(row => Object.entries(query).every(([key, value]) => row[key] === value)).map(row => ({ ...row })) }
              }
            }
          }
        }
      },
      async add({ data }) {
        const _id = `${name}_${++seq}`
        rows(name).push({ _id, ...data })
        return { _id }
      }
    }
  }
}
const sent=[]
const cloud={openapi:{subscribeMessage:{async send(payload){sent.push(payload)}}}}
const label=(type,code)=>code
const service=createNotificationService({cloud,db,command:{inc:n=>({__inc:n})},now:(()=>{let n=1000;return()=>++n})(),getEnumLabel:label})

async function run(){
  await service.ensureSharedTemplate()
  await service.saveNotificationTemplate({templateId:'tmpl',enabled:true,miniprogramState:'trial',buyerOrderPushStage:'DELIVERED',fields:{titleKey:'thing1',statusKey:'phrase2',timeKey:'time3',remarkKey:'thing4'}})
  const openid='same-wechat-openid'
  await service.recordSubscribePermission(openid,'ACCEPT','ORDER_SUBMIT','BUYER')

  // 新订单给商家只生成站内消息，不发送微信，也不消耗购买者授权。
  await service.createNotification({recipientOpenid:openid,recipientRole:'MERCHANT_OWNER',subscriptionRole:'MERCHANT',category:'ORDER',type:'NEW_ORDER',priority:'URGENT',wechatEnabled:false,title:'新订单',summary:'请接单',statusText:'待接单',bizType:'ORDER',bizId:'o1',pagePath:'/pages/order/index?id=o1&mode=merchant',dedupeKey:'NEW_ORDER:o1'})
  let prefs=rows('notification_preferences')
  assert.strictEqual(prefs.find(p=>p.subscriptionRole==='BUYER').grantedCount,1)
  assert.strictEqual(sent.length,0)

  // 配置为送达时推送：接单只发站内信，送达才消耗唯一一次购买者授权。
  assert.strictEqual(await service.shouldSendBuyerOrderStatus('ACCEPTED'),false)
  assert.strictEqual(await service.shouldSendBuyerOrderStatus('DELIVERED'),true)
  await service.createNotification({recipientOpenid:openid,recipientRole:'CUSTOMER',subscriptionRole:'BUYER',category:'ORDER',type:'ORDER_ACCEPTED',priority:'HIGH',wechatEnabled:false,title:'已接单',summary:'正在备货',statusText:'备货中',bizType:'ORDER',bizId:'o1',pagePath:'/pages/order/index?id=o1',dedupeKey:'ORDER_ACCEPTED:o1'})
  assert.strictEqual(prefs.find(p=>p.subscriptionRole==='BUYER').grantedCount,1)
  await service.createNotification({recipientOpenid:openid,recipientRole:'CUSTOMER',subscriptionRole:'BUYER',category:'ORDER',type:'ORDER_DELIVERED',priority:'HIGH',wechatEnabled:true,title:'已送达',summary:'请确认收货',statusText:'待收货',bizType:'ORDER',bizId:'o1',pagePath:'/pages/order/index?id=o1',dedupeKey:'ORDER_DELIVERED:o1'})
  prefs=rows('notification_preferences')
  assert.strictEqual(prefs.find(p=>p.subscriptionRole==='BUYER').grantedCount,0)
  assert.strictEqual(sent.length,1)
  const deliveries=rows('notification_deliveries').filter(d=>d.channel==='WECHAT_SUBSCRIBE')
  assert.deepStrictEqual(deliveries.map(d=>d.subscriptionRole),['BUYER'])
  console.log('Buyer-only WeChat push policy: PASS')
}
run().catch(e=>{console.error(e);process.exit(1)})

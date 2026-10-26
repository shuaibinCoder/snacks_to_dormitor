const assert = require('assert')
const { createNotificationService } = require('../cloudfunctions/snacksApi/notifications')

const collections = {}; let seq = 0
const rows = name => collections[name] || (collections[name] = [])
function update(target, data) { Object.entries(data).forEach(([k,v]) => { target[k] = v && v.__inc !== undefined ? Number(target[k] || 0) + v.__inc : v }) }
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
            if (!item) throw new Error('not found')
            update(item, data)
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
const service=createNotificationService({cloud,db,command:{inc:n=>({__inc:n})},now:(()=>{let n=100;return()=>++n})(),getEnumLabel:(type,code)=>code})

async function run(){
  await service.ensureSharedTemplate()
  await service.saveNotificationTemplate({templateId:'tmpl',enabled:true,miniprogramState:'trial',buyerOrderPushStage:'DELIVERED',fields:{titleKey:'phrase8',statusKey:'phrase23',timeKey:'time3',remarkKey:'thing2'}})
  const openid='buyer-openid'

  // 本单明确同意：授权凭证绑定订单后才能推送。
  const accepted=await service.recordSubscribePermission(openid,'ACCEPT','ORDER_SUBMIT','BUYER')
  assert.ok(accepted.grantId)
  await service.bindGrantToBusiness(openid,accepted.grantId,'ORDER','order-1')
  const sentNotice=await service.createNotification({recipientOpenid:openid,recipientRole:'CUSTOMER',subscriptionRole:'BUYER',subscriptionGrantId:accepted.grantId,requireSpecificGrant:true,wechatEnabled:true,category:'ORDER',type:'ORDER_DELIVERED',priority:'HIGH',title:'商品已经送达',summary:'请确认收货',statusText:'待收货',bizType:'ORDER',bizId:'order-1',pagePath:'/pages/order/index?id=order-1',dedupeKey:'ORDER_DELIVERED:order-1'})
  assert.strictEqual(sentNotice.wechatSent,true)
  assert.strictEqual(sent.length,1)
  assert.strictEqual(rows('notification_grants').find(g=>g._id===accepted.grantId).status,'CONSUMED')

  // 即使账号还有历史授权，当前订单没绑定凭证也绝不能直接推送。
  await service.recordSubscribePermission(openid,'ACCEPT','OLD_ORDER','BUYER')
  const skipped=await service.createNotification({recipientOpenid:openid,recipientRole:'CUSTOMER',subscriptionRole:'BUYER',subscriptionGrantId:'',requireSpecificGrant:true,wechatEnabled:true,category:'ORDER',type:'ORDER_DELIVERED',priority:'HIGH',title:'商品已经送达',summary:'请确认收货',statusText:'待收货',bizType:'ORDER',bizId:'order-2',pagePath:'/pages/order/index?id=order-2',dedupeKey:'ORDER_DELIVERED:order-2'})
  assert.strictEqual(skipped.wechatSent,false)
  assert.strictEqual(sent.length,1)
  const lastDelivery=rows('notification_deliveries').filter(d=>d.channel==='WECHAT_SUBSCRIBE').pop()
  assert.strictEqual(lastDelivery.deliveryStatus,'SKIPPED')
  assert.match(lastDelivery.lastErrorMessage,/没有绑定本次下单时/)
  console.log('Order-bound subscription grant: PASS')
}
run().catch(error=>{console.error(error);process.exit(1)})

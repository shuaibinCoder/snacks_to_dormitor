# 云端部署检查清单

更新日期：2026-10-23

1. 右键 `cloudfunctions/snacksApi`。
2. 选择“上传并部署：云端安装依赖”。
3. 等待云函数部署完成。
4. 重新编译小程序。
5. 确认数据库出现 `users`、`platform_users`、`merchant_applications`、`merchant_payments`、`audit_logs`、`system_dictionaries`、`system_collection_schemas`、`stores`、`products`、`orders`。
6. 在“我的”复制开发者身份ID。
7. 在 `platform_users` 手工初始化首个 `SUPER_ADMIN`。
8. 重新进入“我的”，验证平台管理入口出现。
9. 使用另一个微信账号提交商家申请。
10. 使用管理员账号依次测试：电话联系、设置待付款、确认收款、审核通过。
11. 验证申请人获得商家工作台，店铺出现在搜索结果中。
12. 验证普通用户无法调用管理接口。

13. 进入“平台管理后台 → 数据库中文说明”，点击“同步中文说明到现有数据”。
14. 在云数据库中确认旧记录已经增加 `statusLabel`、`roleLabel`、`actionLabel` 等中文字段。

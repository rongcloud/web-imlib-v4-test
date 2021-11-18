# Web IMLib V4 Test
## SDK 依赖

```html
  <script src="https://cdn.ronghub.com/RongIMLib-4.5.1.prod.js"></script>
```

## 使用说明

1. 使用 App Key 和 Token 登录

2. 点击相应 API 按钮输入相关参数配置即可

## 参数说明

### AppKey 获取

[可在融云开发者后台 - 服务管理](https://developer.rongcloud.cn/app/appService/8zkf1JD8NLF0gxOV3S0NuA)中创建一个应用，填入应用对应的 `appkey`

### Token 获取

[可在融云开发者后台 - 服务管理 - API 调用 - 获取 Token](https://developer.rongcloud.cn/apitool/bj4hYt7YBcwvXteZeVi7aQ) 中，输入 `userId`，从提交后返回的数据中取 `token` 字段值

## 私有云用户特殊配置

私有云用户需要单独配置 `navi` 地址以连接到私有云的 IM 服务

> 私有云用户需联系商务获取私有云 sdk 的 cdn 文件
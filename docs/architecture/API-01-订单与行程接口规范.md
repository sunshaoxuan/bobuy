# API-01 订单与行程接口规范

## 1. 目标与范围
- 覆盖订单与行程的核心 API。
- 给出请求/响应示例、错误码与状态流转规则。

## 2. 通用约定

### 2.1 基础信息
- Base URL: `/api`
- Content-Type: `application/json`
- 多语言：通过 `Accept-Language` 指定语言（例如 `zh-CN` / `en-US`）。

### 2.2 统一响应结构

成功响应：
```json
{
  "status": "success",
  "data": { },
  "meta": { "total": 1 }
}
```

错误响应：
```json
{
  "status": "error",
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "订单不存在。"
}
```

### 2.3 错误码定义

| 错误码 | 说明 | HTTP 状态码 |
| --- | --- | --- |
| RESOURCE_NOT_FOUND | 资源不存在 | 404 |
| INVALID_REQUEST | 参数无效 | 400 |
| INVALID_STATUS | 状态流转非法 | 400 |
| INTERNAL_ERROR | 系统异常 | 500 |

## 3. 订单接口

### 3.1 获取订单列表
- `GET /api/orders`

响应：
```json
{
  "status": "success",
  "data": [
    {
      "id": 3000,
      "customerId": 1001,
      "tripId": 2000,
      "itemName": "Matcha Kit",
      "quantity": 2,
      "unitPrice": 32.5,
      "serviceFee": 6.0,
      "estimatedTax": 2.3,
      "currency": "CNY",
      "status": "CONFIRMED",
      "statusUpdatedAt": "2026-01-15T10:12:00"
    }
  ],
  "meta": { "total": 1 }
}
```

### 3.2 创建订单
- `POST /api/orders`

请求：
```json
{
  "customerId": 1001,
  "tripId": 2000,
  "itemName": "Matcha Kit",
  "quantity": 2,
  "unitPrice": 32.5,
  "serviceFee": 6.0,
  "estimatedTax": 2.3,
  "currency": "CNY",
  "status": "NEW"
}
```

### 3.3 更新订单
- `PUT /api/orders/{id}`

### 3.4 更新订单状态
- `PATCH /api/orders/{id}/status`

请求：
```json
{
  "status": "CONFIRMED"
}
```

**状态流转规则**：
```
NEW -> CONFIRMED -> PURCHASED -> DELIVERED -> SETTLED
```

### 3.5 删除订单
- `DELETE /api/orders/{id}`

## 4. 行程接口

### 4.1 获取行程列表
- `GET /api/trips`

### 4.2 创建区域送货安排
- `POST /api/trips`，仅 AGENT 可调用，归属取认证账号。

请求：
```json
{"deliveryArea":"上海市区及周边","deliveryDate":"2026-11-01"}
```

响应保留内部 `id`、`agentId`、`status`、`statusUpdatedAt` 与冻结信息，显示区域及送货日期。
客户端传入 `agentId`、`status`、`origin`、`destination`、`departDate` 或任何容量字段均返回 400。

### 4.3 更新区域送货安排
- `PUT /api/trips/{id}`，请求与创建相同。归属及状态不能修改，冻结安排拒绝编辑。
- `DELETE /api/trips/{id}` 保留既有删除与关联约束。
- 容量预留接口及行程手工状态接口已移除。

## 5. 自动流程
- `PUBLISHED`：接单中。新建、无有效订单及全部取消时保持此状态。
- `IN_PROGRESS`：任一有效订单出现采购数量，或进入 PURCHASED/DELIVERED/SETTLED。
- `COMPLETED`：至少一个有效订单，且全部有效订单已 DELIVERED/SETTLED。进入交付完成阶段，区域、订单和采购内容锁定；收货/账单确认及登记收款继续开放，最终 SETTLED 后财务只读。
- `SETTLED`：实际结算成功后进入；重复结算不会重复付款。
- 取消订单不参与进度判断；日期到期不会自动代表送达。历史 COMPLETED/SETTLED 冻结保留。
- 同账号可建立多个独立登录会话；刷新令牌及退出按会话隔离。保留角色与账套权限检查。

结构升级及发布边界见 [PLAN-63](../plans/PLAN-63-区域送货行程与自动流程.md)。

---
name: ecommerce-fulfillment-operations
description: Finds paid but unfulfilled ecommerce orders and supports fulfillment exception investigation. Use when the user asks about fulfillment backlog, waiting time, delayed orders, or operational exceptions.
---

## Usage

下列 Toolbox 能力通过对应 Agent runtime 自己维护的 MCP connection 暴露。加载本 skill 后，在当前 runtime 内调用对应 Tool；不要绕过 Agent 直接连接数据库。

## Workflow

1. 要求或确认不超过 31 天的 UTC `[from, to)` 时间窗，并设置有界 `limit`。
2. 调用 `list-ecommerce-fulfillment-exceptions` 获取已支付未履约订单。
3. 将 `to` 解释为等待时长的参考时间，不要当作当前系统时间。
4. 需要订单项时，仅对具体异常订单调用 `get-ecommerce-order-detail`。

## Available Toolbox tools

### get-ecommerce-order-detail

Return one synthetic ecommerce order with its customer business context and line items.
Use this tool only when the user provides a concrete orderNumber.

#### Parameters

| Name        | Type   | Description                                                 | Required | Default |
| :---------- | :----- | :---------------------------------------------------------- | :------- | :------ |
| orderNumber | string | Concrete ecommerce order number, for example EC20260601001. | Yes      |         |

---

### list-ecommerce-fulfillment-exceptions

List paid synthetic ecommerce orders that have not yet been fulfilled in a bounded UTC time window.
Use this read-only tool for fulfillment-operations validation.

#### Parameters

| Name  | Type    | Description                                                                  | Required | Default |
| :---- | :------ | :--------------------------------------------------------------------------- | :------- | :------ |
| from  | string  | Inclusive ISO-8601 UTC paid-order window start.                              | Yes      |         |
| to    | string  | Exclusive ISO-8601 UTC paid-order window end and the waiting-time reference. | Yes      |         |
| limit | integer | Maximum number of fulfillment exceptions to return.                          | No       | `50`    |

---

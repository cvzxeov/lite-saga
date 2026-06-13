# 🌟 lite-saga

A magical, zero-dependency, strongly typed Saga pattern (compensating transactions) for Node.js and Browser.

[![npm version](https://img.shields.io/npm/v/lite-saga.svg)](https://www.npmjs.com/package/lite-saga)
[![License](https://img.shields.io/npm/l/lite-saga.svg)](https://github.com/your-repo/lite-saga)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

`lite-saga` helps you manage complex, distributed transactions across microservices, databases, or third-party APIs. If one step of a complex process fails, `lite-saga` automatically rolls back all previously successful steps in reverse order, ensuring your system remains in a consistent state.

## ✨ Features

- 📦 **Zero Dependencies:** Ultra-lightweight and fast.
- 🛡️ **Strongly Typed:** First-class TypeScript support with context propagation.
- 🔄 **Compensating Transactions:** Automatic rollback on failure.
- ⚡ **Parallel Execution:** Run independent steps concurrently.
- 🔀 **Conditional Steps:** Skip steps based on dynamic runtime conditions.
- 🧅 **Nested Sagas:** Compose complex sagas from smaller, reusable sub-sagas.
- ⏳ **Resilience built-in:** Retries, timeouts, and delays out of the box.
- 🔌 **Middlewares:** Intercept steps for logging, profiling, or state snapshots.
- 🎣 **Lifecycle Hooks:** Tap into `onStart`, `onStepSuccess`, `onFailure`, etc.

---

## 📦 Installation

```bash
npm install lite-saga
```
*or using yarn / pnpm:*
```bash
yarn add lite-saga
pnpm add lite-saga
```

---

## 🚀 Quick Start

Imagine an e-commerce order process: you need to save the order to the database, charge the user's credit card, and send an email. If charging the card fails, you **must** delete the order from the database.

```typescript
import { SagaBuilder } from 'lite-saga';

// 1. Define your shared context (state)
interface OrderContext {
  orderId?: string;
  userId: string;
  amount: number;
}

// 2. Build your saga
const orderSaga = new SagaBuilder<OrderContext>()
  .step(
    'Create DB Order',
    async (ctx) => {
      const order = await db.createOrder(ctx.userId, ctx.amount);
      ctx.orderId = order.id; // Share data with next steps
      return order;
    },
    async (ctx) => {
      // Rollback: if subsequent steps fail, delete the order
      if (ctx.orderId) await db.deleteOrder(ctx.orderId);
    }
  )
  .step(
    'Charge Credit Card',
    async (ctx) => {
      await stripe.charge(ctx.userId, ctx.amount);
    },
    async (ctx) => {
      // Rollback: Refund the money
      await stripe.refund(ctx.userId, ctx.amount);
    }
  )
  .build();

// 3. Execute the saga
try {
  const finalState = await orderSaga.execute({ userId: 'user-123', amount: 150 });
  console.log('Order processed successfully!', finalState.orderId);
} catch (error) {
  // If Stripe fails, the DB order is automatically deleted!
  console.error('Order failed, all actions rolled back:', error.message);
}
```

---

## 📚 Advanced Usage

### ⚡ Parallel Execution
You can group independent steps to run them concurrently. If *any* step in the parallel group fails, the saga will wait for the others to finish, and then correctly roll back *all* successful steps.

```typescript
sagaBuilder.parallel('Book Travel', [
  {
    name: 'Book Flight',
    action: api.bookFlight,
    compensation: api.cancelFlight,
  },
  {
    name: 'Book Hotel',
    action: api.bookHotel,
    compensation: api.cancelHotel,
  }
])
```

### 🔀 Conditional Steps (`stepIf`)
Execute a step only if a certain condition is met. If the condition is `false`, the step is skipped (and won't be rolled back).

```typescript
sagaBuilder.stepIf(
  (ctx) => ctx.isVipUser, // Condition
  'Add VIP Bonus Points',
  async (ctx) => { /* Add points */ },
  async (ctx) => { /* Remove points */ }
)
```

### ⏳ Timeouts and Retries
Network requests can be flaky. Add resilience to your steps natively:

```typescript
sagaBuilder.step(
  'External API Call',
  async () => fetch('https://flaky-api.com/data'),
  async () => fetch('https://flaky-api.com/rollback'),
  {
    retries: 3,        // Try up to 3 times before failing
    retryDelay: 1000,  // Wait 1 second between retries
    timeout: 5000      // Cancel step if it takes more than 5 seconds
  }
)
```

### 🔌 Middlewares (Plugins)
`lite-saga` supports an Onion Middleware architecture (similar to Koa or Redux). 

You can use the built-in `loggerMiddleware` or write your own to measure execution time, integrate with Sentry, or take state snapshots.

```typescript
import { SagaBuilder, loggerMiddleware } from 'lite-saga';

const saga = new SagaBuilder()
  .use(loggerMiddleware) // Ready-to-use console logger
  .use(async (step, ctx, next) => {
    console.log(`Before step: ${step.name}`);
    
    const result = await next(); // Wait for the step and next middlewares
    
    console.log(`After step: ${step.name}`);
    return result;
  })
  // .step(...)
  .build();
```

### 🎣 Lifecycle Hooks
Attach global hooks for monitoring and metrics:

```typescript
sagaBuilder.withHooks({
  onStart: (ctx) => console.log('Saga started'),
  onStepSuccess: (stepName, result, ctx) => console.log(`${stepName} succeeded`),
  onFailure: (error, ctx) => console.error('Saga failed globally', error),
  onCompensationFailed: (stepName, err) => console.error(`CRITICAL: Rollback failed for ${stepName}`, err),
})
```

---

## 📄 License

CVZXEOV 2026. See the LICENSE file for details.
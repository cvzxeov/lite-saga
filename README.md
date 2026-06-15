# 🌟 @cvzxeov/lite-saga

A magical, zero-dependency, strongly typed Saga pattern (compensating transactions) for Node.js and Browser.

[![npm version](https://img.shields.io/npm/v/@cvzxeov/lite-saga.svg)](https://www.npmjs.com/package/@cvzxeov/lite-saga)
[![npm downloads](https://img.shields.io/npm/dm/@cvzxeov/lite-saga.svg)](https://www.npmjs.com/package/@cvzxeov/lite-saga)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

`@cvzxeov/lite-saga` helps you manage complex, distributed transactions across microservices, databases, or third-party APIs. If one step of a complex process fails, `@cvzxeov/lite-saga` automatically rolls back all previously successful steps in reverse order, ensuring your system remains in a consistent state.

## 📖 Table of Contents

- ✨ Features
- 🤔 What is a Saga? (For Beginners)
- 📦 Installation
- 🚀 Quick Start
- 🌐 Using with Axios / Fetch
- 📚 Advanced Usage
  - ⚡ Parallel Execution
  - 🔀 Conditional Steps (`stepIf`)
  - ⏳ Timeouts and Retries
  - 🚑 Fallbacks & Compensation Retries
  - 🛑 Canceling Sagas (`AbortController`)
  - 🔌 Middlewares (Plugins)
  - 🎣 Lifecycle Hooks
- 📄 License

---

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
- 🚑 **Fallbacks:** Provide alternative actions to prevent saga failures.
- 🛑 **Abortable:** Safely cancel running sagas using `AbortController`.
- 🛡️ **Reliable Rollbacks:** Built-in compensation retries.

---

## 🤔 What is a Saga? (For Beginners)

In modern web development (especially with microservices), a single user action might require calling multiple different APIs or databases. 

**The Problem:** What happens if Step 1 and Step 2 succeed, but Step 3 fails? Your system is now in a broken, half-finished state. A simple `try/catch` won't magically undo the database changes made in Step 1!

**The Solution:** The **Saga Pattern**! A Saga is a sequence of transactions. Each step has two parts:
1. **Action:** Do the work (e.g., *charge a card, create a user*).
2. **Compensation (Rollback):** Undo the work (e.g., *refund the card, delete the user*).

If *any* step fails, `@cvzxeov/lite-saga` catches the error and **automatically runs the compensations for all previously completed steps in reverse order**. Your system goes back to exactly how it was before, keeping your data clean and safe!

---

## 📦 Installation

```bash
npm install @cvzxeov/lite-saga
```
*or using yarn / pnpm:*
```bash
yarn add @cvzxeov/lite-saga
pnpm add @cvzxeov/lite-saga
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

## 🌐 Using with Axios / Fetch

`lite-saga` is completely agnostic to how you make your network requests. It works perfectly with `axios`, `fetch`, `got`, or any Promise-based library.

Since `axios` automatically throws an error for HTTP statuses outside the `2xx` range, it integrates flawlessly with `lite-saga`. If a request fails, the saga automatically stops and starts rolling back!

```typescript
import axios from 'axios';
import { SagaBuilder } from 'lite-saga';

interface UserContext {
  userData: { name: string; email: string };
  createdUserId?: string;
}

const userRegistrationSaga = new SagaBuilder<UserContext>()
  .step(
    'Create User in Auth Service',
    async (ctx) => {
      // Axios throws on 4xx/5xx. If this fails, the saga halts here.
      const response = await axios.post('https://api.example.com/users', ctx.userData);
      
      // Save the new User ID to the context so we can delete it during rollback!
      ctx.createdUserId = response.data.id;
    },
    async (ctx) => {
      // ROLLBACK: This runs ONLY if a future step fails.
      // We use the ID saved in the main action to undo the operation.
      if (ctx.createdUserId) {
        await axios.delete(`https://api.example.com/users/${ctx.createdUserId}`);
      }
    }
  )
  .step(
    'Send Welcome Email',
    async (ctx) => {
      // If this email service returns a 500 Error, this step fails.
      // The saga will then automatically execute the 'Create User' rollback above!
      await axios.post('https://api.example.com/emails/welcome', { to: ctx.userData.email });
    }
  )
  .build();
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
  async () => fetch('https://api.example.com/data'),
  async () => fetch('https://api.example.com/rollback'),
  {
    retries: 3,        // Try up to 3 times before failing
    retryDelay: 1000,  // Wait 1 second between retries
    timeout: 5000      // Cancel step if it takes more than 5 seconds
  }
)
```

For production systems, you can also use **Exponential Backoff** by passing a function to `retryDelay`:

```typescript
sagaBuilder.step(
  'External API Call',
  async () => fetch('https://api.example.com/data'),
  async () => fetch('https://api.example.com/rollback'),
  {
    retries: 3,
    // Attempt 1: wait 1s, Attempt 2: wait 2s, Attempt 3: wait 3s
    retryDelay: (attempt) => attempt * 1000, 
    compensationRetries: 3,
    // 2s, 4s, 8s backoff for rollback
    compensationRetryDelay: (attempt) => Math.pow(2, attempt) * 1000 
  }
)
```

### 🚑 Fallbacks & Compensation Retries
Make your sagas bulletproof by providing fallback actions when the main step fails, and retrying rollback actions to prevent inconsistent states.

```typescript
sagaBuilder.step(
  'Charge User',
  async () => api.chargeWithStripe(),
  async () => api.refundWithStripe(),
  {
    retries: 2,
    fallback: async () => api.chargeWithPayPal(), // If Stripe fails, try PayPal
    compensationRetries: 3, // If refund fails, retry up to 3 times
    compensationRetryDelay: 1000
  }
)
```

### 🛑 Canceling Sagas (`AbortController`)
You can safely cancel a running saga. This immediately aborts the execution and automatically triggers the rollback process for all previously successful steps to maintain data consistency.

```typescript
const controller = new AbortController();

saga.execute({ userId: 1 }, { signal: controller.signal })
  .catch(err => console.log('Saga aborted:', err.message));

// Cancel the saga execution after 2 seconds
setTimeout(() => controller.abort(), 2000);
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
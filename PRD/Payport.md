Here's a fairly complete product/engineering requirements doc you can hand to an AI coding agent (Cursor, Claude Code,
Codex, etc.).

---

# RFC: Payport – Polar.sh Payment Integration Layer

## Overview

Create a new package called **`payport`**.

`payport` is the canonical payment abstraction layer for the Ottabase ecosystem.

Phase 1 ships with **Polar.sh as the sole payment provider**. The architecture must be provider-agnostic so Stripe,
Paddle, LemonSqueezy, Chargebee, etc. can be added later without changing application code.

Application code should never call Polar APIs directly.

Instead applications interact only with Payport APIs, events, hooks and domain objects.

---

# Goals

## Primary Goals

1. First-class Polar.sh integration.
2. Deep subscription + plan integration with Otta Web template apps.
3. Unified event system independent of payment provider.
4. Full webhook coverage for all Polar events.
5. Provider abstraction layer for future extensibility.
6. Strong TypeScript typing.
7. Server-first architecture.
8. Multi-tenant ready.
9. Cloudflare compatible.
10. Idempotent event processing.

---

# Non Goals

Not required in v1:

- Usage metering UI
- Invoice PDF rendering
- Marketplace payments
- Connected accounts
- Tax engine
- Accounting exports

Design APIs so these can be added later.

---

# Package Structure

```txt
packages/payport/

src/
  providers/
    polar/

  core/
    customer/
    subscriptions/
    checkout/
    plans/
    entitlements/
    events/

  webhooks/
  adapters/
  hooks/
  types/
  db/
```

---

# Core Concepts

## Provider

Represents external billing system.

```ts
type Provider = 'polar' | 'stripe' | 'paddle' | 'lemonsqueezy';
```

---

## Customer

Represents a paying user.

```ts
interface PaymentCustomer {
    id: string;
    provider: Provider;

    externalCustomerId: string;

    userId: string;

    email: string;

    metadata?: Record<string, string>;
}
```

---

## Product

Represents sellable item.

```ts
interface Product {
    id: string;
    name: string;
    description?: string;
}
```

---

## Plan

Application-level plan.

Example:

```ts
free;
starter;
pro;
team;
enterprise;
```

Payport owns mapping between application plans and provider products.

```ts
interface Plan {
    id: string;
    slug: string;

    providerProductId: string;

    features: string[];
}
```

---

## Subscription

Unified subscription model.

```ts
interface Subscription {
    id: string;

    userId: string;

    provider: Provider;

    externalSubscriptionId: string;

    planId: string;

    status: 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled' | 'expired';

    currentPeriodStart: Date;
    currentPeriodEnd: Date;
}
```

---

# Provider Architecture

Applications should depend on:

```ts
Payport;
```

Never:

```ts
PolarSDK;
StripeSDK;
```

Example:

```ts
await payport.createCheckout(...)
```

instead of

```ts
polar.checkout.create(...)
```

---

# Provider Interface

```ts
interface PaymentProvider {
  createCheckout(...)

  createCustomer(...)

  getCustomer(...)

  getSubscription(...)

  cancelSubscription(...)

  updateSubscription(...)

  listProducts(...)

  verifyWebhook(...)

  handleWebhook(...)
}
```

Polar implements this contract.

Future providers must satisfy same interface.

---

# Polar Provider

Create:

```txt
providers/polar/
```

Responsibilities:

- API wrapper
- webhook verification
- event normalization
- checkout creation
- subscription management
- customer sync

Must use official Polar API.

Reference:

[Polar API Documentation](https://polar.sh/docs/api-reference/introduction?utm_source=chatgpt.com)

---

# Checkout API

Unified checkout creation.

Example:

```ts
await payport.checkout.create({
    userId,

    plan: 'pro',

    successUrl,
    cancelUrl,
});
```

Returns:

```ts
{
    checkoutUrl;
}
```

Provider-specific details hidden.

---

# Customer APIs

```ts
createCustomer();

getCustomer();

syncCustomer();

updateCustomer();
```

Support:

- metadata
- email updates
- provider reconciliation

---

# Subscription APIs

```ts
createSubscription();

cancelSubscription();

resumeSubscription();

changePlan();

getSubscription();

listSubscriptions();
```

---

# Plan System Integration

Deep integration with Otta Web template.

Applications define plans once.

Example:

```ts
export const plans = definePlans({
  free: {...},
  starter: {...},
  pro: {...},
  team: {...}
});
```

Payport consumes configuration.

---

# Entitlements System

Plan features should be resolvable directly.

Example:

```ts
hasFeature(userId, 'advanced_export');
```

or

```ts
can(userId, 'ai_generation');
```

No provider-specific logic exposed.

---

# Required Hooks

Applications subscribe to lifecycle events.

Example:

```ts
onSubscriptionActivated();

onSubscriptionCancelled();

onPlanChanged();
```

---

# Universal Event Bus

All payment providers map into unified events.

Application code only sees:

```ts
payment.customer.created;

payment.customer.updated;

payment.checkout.created;

payment.checkout.completed;

payment.subscription.created;

payment.subscription.trial_started;

payment.subscription.activated;

payment.subscription.updated;

payment.subscription.paused;

payment.subscription.resumed;

payment.subscription.cancelled;

payment.subscription.expired;

payment.subscription.past_due;

payment.subscription.payment_failed;

payment.subscription.payment_succeeded;

payment.plan.changed;

payment.refund.created;

payment.refund.completed;

payment.invoice.created;

payment.invoice.paid;

payment.invoice.failed;

payment.entitlement.granted;

payment.entitlement.revoked;
```

---

# Webhook Support

Support ALL Polar webhook events.

Requirements:

- verification
- idempotency
- retries
- logging
- dead-letter support
- event replay support

Every Polar webhook must map to:

1. Raw event
2. Normalized Payport event

Store both.

---

# Event Storage

Persist every incoming webhook.

Schema:

```ts
PaymentEvent;
```

Fields:

```ts
id;
provider;
eventType;
rawPayload;
normalizedPayload;
processedAt;
status;
attemptCount;
```

---

# Idempotency

Required everywhere.

Prevent duplicate:

- webhooks
- checkout completion
- subscription activation
- customer creation

Store idempotency keys.

---

# Database Models

Add models for:

```txt
PaymentCustomer
PaymentSubscription
PaymentProduct
PaymentPlan
PaymentEvent
PaymentEntitlement
PaymentCheckout
```

Provider-neutral naming.

---

# React Hooks

Provide frontend helpers.

```ts
useSubscription();

usePlan();

useEntitlements();

useBillingPortal();

useCheckout();
```

---

# Server Helpers

```ts
getUserSubscription();

requirePlan();

requireFeature();

requireActiveSubscription();
```

Example:

```ts
await requirePlan(userId, 'pro');
```

---

# Route Helpers

```ts
withSubscription();

withFeature();

withPlan();
```

Example:

```ts
export default withFeature('advanced_reports', handler);
```

---

# Billing Portal

Expose provider-neutral API.

```ts
createBillingPortalSession();
```

Returns URL.

Internally uses Polar customer portal.

---

# Admin APIs

```ts
listCustomers();

listSubscriptions();

listEvents();

replayEvent();

syncCustomer();

syncSubscription();
```

---

# Security

Required:

- webhook signature verification
- timing-safe comparison
- encrypted secrets
- server-only provider credentials
- audit logging
- rate limiting

---

# Observability

Structured logs:

```txt
provider
customerId
subscriptionId
eventType
duration
status
```

Metrics:

- checkout created
- checkout converted
- active subscriptions
- MRR
- churn
- failed payments
- webhook failures

---

# Testing

Required:

### Unit Tests

- provider adapters
- event mapping
- entitlement resolution

### Integration Tests

- checkout flow
- subscription lifecycle
- webhook processing

### Contract Tests

Verify provider implementation satisfies:

```ts
PaymentProvider;
```

contract.

---

# Developer Experience

Provide:

```ts
npx payport sync-products
npx payport sync-customers
npx payport replay-event
npx payport validate-config
```

---

# Future Provider Support

Architecture must allow:

```ts
registerProvider('stripe', StripeProvider);
```

without changing:

- hooks
- event names
- entitlement logic
- subscription APIs
- application code

Provider-specific concerns remain isolated inside adapter layer.

---

# Acceptance Criteria

- New `payport` package created.
- Polar.sh fully integrated.
- All Polar webhooks supported.
- Unified event model implemented.
- Otta Web plans integrated.
- Entitlements system implemented.
- Billing portal supported.
- Subscription hooks available.
- React hooks available.
- Idempotent webhook processing.
- Provider abstraction layer complete.
- Future providers can be added without application changes.
- Comprehensive tests and documentation included.

This gives the agent enough direction to build a production-grade payment foundation rather than "just a Polar
integration," while keeping Polar as the initial backend.

IMP: It's important we keep code modular and ottaweb should work even if Payport is disabled, or the premium package
isn't installed. Payport should be an optional dependency that apps can choose to use or not.

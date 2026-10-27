import type { LegalSection } from '../types';

/**
 * Refund and Cancellation Policy. Published only when `features.paidPlans` is set. The refund window comes from
 * `refundWindowDays`; 0 publishes a no-refund policy that still preserves statutory rights. `refundPercent` below 100
 * publishes a partial refund with the retained share named as a service fee. Trial and lifetime clauses follow their
 * flags.
 */

const REFUND_ONCE =
    'One refund per customer under this policy; renewals after the first paid period are refundable only where the law requires it or where a fault on our side prevented you from using the Service.';
const REFUND_MECHANICS =
    'Refunds go back to the original payment method and may take 5 to 10 business days to appear, depending on your bank. We may decline a refund where we find abuse of this policy, such as repeated purchases and refunds.';

export const REFUNDS: LegalSection[] = [
    {
        id: 'intro',
        body: 'This Refund and Cancellation Policy applies to paid plans and purchases on {{appName}} and supplements our [Terms of Service]({{legalBase}}/terms). Nothing in it limits rights you have under the consumer protection laws of the country where you live.',
    },
    {
        id: 'subscriptions',
        title: 'Subscriptions and renewals',
        body: 'Paid plans are billed in advance for each billing period and renew automatically at the end of it until you cancel. The renewal charge is made to the payment method on file, at the price in effect at renewal, plus applicable taxes. We send a receipt for every charge.',
    },
    {
        id: 'free-trial',
        title: 'Free trials',
        when: (c) => !!c.features?.freeTrial,
        body: 'If your plan started with a free trial, you are not charged until the trial ends. Cancel before then and you owe nothing. Once the trial converts to a paid plan, the policy below applies to the first charge like any other.',
    },
    {
        id: 'cancellations',
        title: 'Cancellations',
        body: 'You can cancel at any time from your account settings, or by writing to [{{contactEmail}}](mailto:{{contactEmail}}). Cancellation stops future renewals. You keep access to paid features until the end of the billing period you have already paid for, and your account then continues on the free plan where one exists. We do not prorate or refund the unused part of a billing period except as set out below or where the law requires it.',
    },
    {
        id: 'refunds',
        title: 'Refunds',
        when: (c) => (c.refundWindowDays ?? 14) > 0 && (c.refundPercent ?? 100) >= 100,
        body: [
            `If the Service does not work for you, contact us at [{{contactEmail}}](mailto:{{contactEmail}}) within {{refundWindowDays}} days of a charge and we will refund it. ${REFUND_ONCE}`,
            REFUND_MECHANICS,
        ].join('\n\n'),
    },
    {
        id: 'refunds-partial',
        title: 'Refunds',
        when: (c) => (c.refundWindowDays ?? 14) > 0 && (c.refundPercent ?? 100) < 100,
        body: [
            `If the Service does not work for you, contact us at [{{contactEmail}}](mailto:{{contactEmail}}) within {{refundWindowDays}} days of a charge and we will refund {{refundPercent}}% of it. We retain {{refundRetainedPercent}}% as a service fee covering payment processing and the use you have already had of the Service. ${REFUND_ONCE}`,
            REFUND_MECHANICS,
        ].join('\n\n'),
    },
    {
        id: 'no-refunds',
        title: 'Refunds',
        when: (c) => (c.refundWindowDays ?? 14) <= 0,
        body: 'Charges are non-refundable, and we do not prorate or refund partial billing periods, except where a fault on our side prevented you from using the Service, where this policy says otherwise, or where the law requires a refund. If you believe a charge was made in error, contact [{{contactEmail}}](mailto:{{contactEmail}}) and we will look into it.',
    },
    {
        id: 'lifetime',
        title: 'Lifetime purchases',
        when: (c) => !!c.features?.lifetimePlans,
        body: 'A lifetime purchase is a one-time payment, not a subscription, so there is nothing to cancel. It is refundable under the same window and conditions as a first charge above. After that it is non-refundable, except where the law requires otherwise.',
    },
    {
        id: 'statutory',
        title: 'Your statutory rights',
        body: 'If you are a consumer in the European Union, the United Kingdom or another jurisdiction with a statutory withdrawal or cooling-off period, you may have the right to withdraw from a purchase within that period, usually 14 days, regardless of this policy. By asking us to start the service immediately you may be asked to acknowledge that this right is lost once the service is fully performed, or that a proportionate amount is payable for the service used. These rights apply in addition to this policy and are not reduced by it.',
    },
    {
        id: 'chargebacks',
        title: 'Disputes and chargebacks',
        body: 'If you think a charge is wrong, contact us first at [{{contactEmail}}](mailto:{{contactEmail}}); most issues are resolved within a few days. A chargeback filed with your bank on a charge that was correct may lead us to suspend the account until it is resolved.',
    },
    {
        id: 'changes',
        title: 'Changes to this policy',
        body: 'We may update this policy from time to time. Changes apply to charges made after the change takes effect. This policy was last updated on {{lastUpdated}}.',
    },
    {
        id: 'contact',
        title: 'Contact us',
        body: 'Questions about billing, cancellations or refunds? Contact [{{contactEmail}}](mailto:{{contactEmail}}).',
    },
];

# Member Email Notifications

Transactional emails for organization member lifecycle events. Built on the shared `@ottabase/email` engine and the
`minimalist` template (same pattern as `org-invite`).

## When they fire

| Email                  | Trigger                                                                         | Sent to        |
| ---------------------- | ------------------------------------------------------------------------------- | -------------- |
| Member added (welcome) | `POST /api/admin/organizations/:id/members` — always, if the user has email     | New member     |
| Member removed         | `DELETE /api/admin/organizations/:id/members/:userId` with `notifyMember: true` | Removed member |

Email sending is best effort: send failures are caught internally and never fail the API request (matching
`admin-organization-invites.ts`).

## Builders (`apps/otta-web/src/email/`)

```ts
buildMemberAddedEmail({
    organizationName, memberName, role,
    inviterName?, dashboardUrl?,
}) // → { subject, template: 'minimalist', variables, content }

buildMemberRemovedEmail({
    organizationName, memberName, role,
    reason?, // one of: left_company | role_change | contract_ended | security_concern | duplicate_account | other
})
```

Unknown `reason` codes are dropped — only whitelisted codes are rendered. All user- controlled fields (including URLs
inside `href`) are passed through `escapeHtml`.

## Senders (`apps/otta-web/worker/lib/member-emails.ts`)

```ts
sendMemberAddedEmail(env, { to, ...opts });
sendMemberRemovedEmail(env, { to, ...opts });
```

Both resolve the configured mailer via `resolveMailer(env)` and return `{ ok: boolean; error?: string }`.

## Tests

```bash
cd apps/otta-web && npx vitest run src/email/__tests__/member-emails.test.ts
```

Covers: rendering, conditional sections, reason whitelist, HTML escaping (incl. URL attributes), and the privacy rule
that the admin's email is never included in the removal notification.

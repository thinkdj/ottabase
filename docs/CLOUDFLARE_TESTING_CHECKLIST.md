# Cloudflare Workers Deployment - Testing Checklist

Use this checklist to verify your Cloudflare Workers deployment is working correctly.

## Pre-Deployment Checklist

### GitHub Setup
- [ ] Repository has `CLOUDFLARE_API_TOKEN` secret
- [ ] Repository has `CLOUDFLARE_ACCOUNT_ID` secret
- [ ] Workflow file exists at `.github/workflows/deploy-cloudflare.yml`
- [ ] Workflow has proper permissions in repository settings

### Cloudflare Account
- [ ] Account is active and verified
- [ ] API token has correct permissions:
  - [ ] Workers Scripts: Edit
  - [ ] Workers KV Storage: Edit
  - [ ] Workers R2 Storage: Edit
  - [ ] D1: Edit
  - [ ] Cloudflare Queues: Edit
  - [ ] Account Settings: Read
- [ ] Account ID is correct

## Deployment Testing

### 1. Trigger Deployment
- [ ] Push to main branch triggers workflow
- [ ] Manual workflow dispatch works
- [ ] Workflow runs without errors

### 2. Build Phase
- [ ] Dependencies install successfully
- [ ] Prisma client generates
- [ ] Packages build (no TypeScript errors)
- [ ] Template app builds
- [ ] OpenNext transformation completes

### 3. Service Provisioning
Check in GitHub Actions logs or Cloudflare Dashboard:

**D1 Database**
- [ ] `ottabase-db` created or exists
- [ ] Database ID is valid UUID
- [ ] Database appears in Cloudflare Dashboard

**R2 Buckets**
- [ ] `ottabase-bucket` created or exists
- [ ] `ottabase-bucket-preview` created or exists
- [ ] Buckets appear in Cloudflare Dashboard

**KV Namespaces**
- [ ] `ottabase-template-app-MY_KV` created or exists
- [ ] `ottabase-template-app-MY_KV_preview` created or exists
- [ ] Namespaces have valid IDs
- [ ] Namespaces appear in Cloudflare Dashboard

**Queue**
- [ ] `ottabase-queue` created or exists
- [ ] Queue appears in Cloudflare Dashboard

**Durable Objects**
- [ ] `RealtimeActor` class is exported
- [ ] Migrations are applied

### 4. Deployment
- [ ] Wrangler deploy succeeds
- [ ] No binding errors
- [ ] Worker appears in Cloudflare Dashboard
- [ ] Deployment ID is generated

## Post-Deployment Testing

### 1. Basic Connectivity
- [ ] Worker URL is accessible: `https://ottabase-template-app.*.workers.dev`
- [ ] Homepage loads without errors
- [ ] Static assets load correctly
- [ ] CSS and JS files are served

### 2. Service Integration Tests

**D1 Database**
```
Test URL: /demo/cloudflare/d1
```
- [ ] Page loads
- [ ] Can view users table
- [ ] Can create new user
- [ ] Can read user data
- [ ] Can update user
- [ ] Can delete user
- [ ] SQL queries execute without errors

**KV Storage**
```
Test URL: /demo/cloudflare/kv
```
- [ ] Page loads
- [ ] Can write key-value pair
- [ ] Can read value by key
- [ ] Can list keys
- [ ] Can delete key
- [ ] TTL works correctly

**R2 Storage**
```
Test URL: /demo/cloudflare/r2
```
- [ ] Page loads
- [ ] Can upload file
- [ ] Can download file
- [ ] Can list files
- [ ] Can delete file
- [ ] File metadata is correct

**Queue**
```
Test URL: /demo/cloudflare/queue
```
- [ ] Page loads
- [ ] Can send message to queue
- [ ] Message is received
- [ ] Batch processing works
- [ ] Consumer processes messages

**Rate Limiting**
```
Test URL: /demo/cloudflare/rate-limit
```
- [ ] Page loads
- [ ] Rate limit is enforced
- [ ] Limit resets after period
- [ ] Error messages are appropriate

**Durable Objects (Realtime)**
```
Test URL: /demo/cloudflare/realtime or /demo/realtime
```
- [ ] WebSocket connection establishes
- [ ] Can send messages
- [ ] Can receive messages
- [ ] Multiple clients can connect
- [ ] State persists across requests

### 3. API Routes

**Health Check**
```bash
curl https://your-app.workers.dev/api/health
```
- [ ] Returns 200 OK
- [ ] Returns JSON with status

**Cloudflare Context**
```bash
curl https://your-app.workers.dev/api/cloudflare/test
```
- [ ] Returns environment info
- [ ] Shows available bindings
- [ ] No sensitive data exposed

### 4. Performance

**Response Time**
- [ ] Homepage: < 200ms
- [ ] API routes: < 100ms
- [ ] Static assets: < 50ms
- [ ] Database queries: < 50ms

**Global Edge Performance**
Test from multiple regions:
- [ ] North America
- [ ] Europe
- [ ] Asia
- [ ] South America

### 5. Error Handling

**404 Pages**
- [ ] Custom 404 page displays
- [ ] Proper error message
- [ ] Navigation works

**500 Errors**
- [ ] Errors are logged to Wrangler tail
- [ ] Error page displays (not raw error)
- [ ] Stack trace not exposed to users

**Rate Limit Errors**
- [ ] 429 status returned
- [ ] Retry-After header present
- [ ] Clear error message

## Monitoring

### Real-time Logs
```bash
cd apps/ottabase-template-app
pnpm wrangler tail
```
- [ ] Logs stream in real-time
- [ ] Request logs appear
- [ ] Error logs appear
- [ ] Console.log outputs visible

### Analytics (Cloudflare Dashboard)
- [ ] Request count updates
- [ ] Error rate is tracked
- [ ] CPU time is monitored
- [ ] Data transfer is recorded

### Deployment History
```bash
pnpm wrangler deployments list
```
- [ ] Shows recent deployments
- [ ] Deployment IDs are correct
- [ ] Timestamps are accurate

## Rollback Testing

**If deployment fails:**
- [ ] Previous version still accessible
- [ ] Can rollback via dashboard
- [ ] Can redeploy previous commit

**Manual rollback:**
```bash
pnpm wrangler rollback [deployment-id]
```

## Security Testing

### Environment Variables
- [ ] No secrets in code
- [ ] Environment variables accessible
- [ ] Secrets work via `wrangler secret put`

### CORS
- [ ] CORS headers configured correctly
- [ ] Only allowed origins accepted
- [ ] Preflight requests work

### Rate Limiting
- [ ] Rate limits are enforced
- [ ] Per-IP limiting works
- [ ] Can handle burst traffic

## Continuous Deployment

### Subsequent Deployments
- [ ] Push triggers new deployment
- [ ] Services not recreated (already exist)
- [ ] Deployment completes faster
- [ ] Zero-downtime deployment
- [ ] Old version stays up until new is ready

### Service Updates
- [ ] Can update service bindings manually
- [ ] Can add new services
- [ ] Can remove services
- [ ] Changes reflected in next deployment

## Documentation Verification

- [ ] Setup guide is accurate
- [ ] Quick reference is helpful
- [ ] Architecture doc matches implementation
- [ ] Code examples work
- [ ] Troubleshooting guide covers common issues

## Final Verification

### User Experience
- [ ] App loads quickly
- [ ] All features work
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Dark mode works (if applicable)

### Developer Experience
- [ ] Documentation is clear
- [ ] Setup is straightforward
- [ ] Examples are helpful
- [ ] Errors are informative

### Production Readiness
- [ ] All tests pass
- [ ] Performance is acceptable
- [ ] Security is adequate
- [ ] Monitoring is in place
- [ ] Backups configured (if needed)

## Success Criteria

✅ **Deployment is successful if:**
1. Workflow completes without errors
2. All services are provisioned
3. App is accessible at Workers URL
4. All demo pages work
5. No runtime errors in logs
6. Performance is within acceptable range

## Next Steps After Successful Deployment

1. [ ] Add custom domain (optional)
2. [ ] Set up monitoring alerts
3. [ ] Configure backup strategy
4. [ ] Plan scaling approach
5. [ ] Document any customizations
6. [ ] Train team on deployment process
7. [ ] Set up staging environment (optional)
8. [ ] Implement additional features

## Support Resources

If any test fails, check:
1. GitHub Actions logs for build/deploy errors
2. Cloudflare Dashboard for service status
3. `pnpm wrangler tail` for runtime errors
4. [Troubleshooting Guide](CLOUDFLARE_CICD_SETUP.md#troubleshooting)
5. [Architecture Documentation](CLOUDFLARE_ARCHITECTURE.md)

## Notes

Record any issues or observations during testing:

```
Date: _______________
Tester: _______________

Issues Found:
- 
- 
- 

Resolved:
- 
- 
- 

Additional Notes:
- 
- 
```

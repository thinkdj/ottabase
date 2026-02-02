# Error Handling Enhancement Guide

## Overview
This document describes the enhanced error handling patterns implemented for the RBAC UI components.

## Components Created

### 1. LoadingSkeletons.tsx (`src/components/LoadingSkeletons.tsx`)
Provides skeleton loaders for better UX during loading states:

- **TableSkeleton**: For table data loading
- **CardListSkeleton**: For card-based lists
- **FormSkeleton**: For form loading states
- **PageHeaderSkeleton**: For page headers
- **GridSkeleton**: For grid layouts
- **PageLoadingSkeleton**: Full page loading state

**Usage**:
```typescript
{loading && organizations.length === 0 ? (
    <TableSkeleton rows={5} columns={6} />
) : (
    // ... render table
)}
```

### 2. useRBACToast Hook (`src/hooks/useToast.ts`)
Centralized toast notifications with RBAC-specific messages:

**Features**:
- `success()`, `error()`, `warning()`, `info()` - Generic toasts
- `rbac.*` - Pre-built RBAC-specific toasts
- `promise()` - Toast with loading/success/error states

**Usage**:
```typescript
const toast = useRBACToast();

// On success
toast.rbac.organizationCreated();

// On error
toast.error('Operation failed', error.message);

// With promise
toast.promise(
    api('/api/...'),
    {
        loading: 'Creating organization...',
        success: 'Organization created',
        error: 'Failed to create organization'
    }
);
```

### 3. ErrorBoundary & ApiErrorDisplay
Already exist in `src/components/ErrorBoundary.tsx`:

- **ErrorBoundary**: Catches React errors and displays fallback UI
- **ApiErrorDisplay**: Formats API errors with retry/dismiss buttons

**Usage**:
```typescript
// Wrap components
<ErrorBoundary>
    <YourComponent />
</ErrorBoundary>

// Display API errors
{error && (
    <ApiErrorDisplay
        error={error}
        onRetry={() => refetch()}
        onDismiss={() => setError(null)}
    />
)}
```

## Implementation Pattern

### Step 1: Import Required Utilities
```typescript
import { ApiErrorDisplay } from '@/components/ErrorBoundary';
import { TableSkeleton } from '@/components/LoadingSkeletons';
import { useRBACToast } from '@/hooks/useToast';
```

### Step 2: Add Toast Hook
```typescript
export function YourComponent() {
    const toast = useRBACToast();
    // ... rest of component
}
```

### Step 3: Update Error State Type
```typescript
// Before
const [error, setError] = useState<string | null>(null);

// After
const [error, setError] = useState<Error | null>(null);
```

### Step 4: Update Fetch Error Handling
```typescript
try {
    // ... api call
} catch (err) {
    const error = err instanceof Error ? err : new Error('Failed to...');
    setError(error);
}
```

### Step 5: Update Submit Handlers with Toast
```typescript
try {
    await api('/api/...');
    toast.rbac.organizationCreated(); // or appropriate toast
    // ... rest of success logic
} catch (err) {
    const error = err instanceof Error ? err : new Error('Failed to...');
    toast.error('Operation failed', error.message);
}
```

### Step 6: Update UI Rendering
```typescript
{error && (
    <ApiErrorDisplay
        error={error}
        onRetry={() => refetch()}
        onDismiss={() => setError(null)}
        className="mb-4"
    />
)}

{loading && data.length === 0 ? (
    <TableSkeleton rows={5} columns={6} />
) : data.length === 0 ? (
    <div>No data found</div>
) : (
    // ... render data
)}
```

## Components Enhanced

### ✅ Fully Enhanced
1. **OrganizationsPage** - Complete with all error handling patterns

### ⏳ Needs Enhancement (Follow the pattern above)
2. **OrganizationMembersPage**
3. **RBACRolesPage**
4. **OrganizationForm**
5. **InviteMemberForm**

## Testing Checklist

### Error Scenarios to Test
- [ ] **Network Error**: Disconnect network, verify error display with retry button
- [ ] **API Error**: Mock 404/500 errors, verify ApiErrorDisplay shows proper message
- [ ] **Loading State**: Verify skeleton appears during loading
- [ ] **Empty State**: Verify empty state message when no data
- [ ] **Success Toast**: Verify toast appears after successful operations
- [ ] **Error Toast**: Verify error toast appears on failures
- [ ] **Retry**: Click retry button, verify refetch occurs
- [ ] **Dismiss**: Click dismiss button, verify error clears

### UX Improvements Achieved
✅ **Loading States**: Skeleton loaders instead of plain "Loading..." text
✅ **Error Display**: Rich error messages with retry/dismiss options
✅ **User Feedback**: Toast notifications for all operations
✅ **Error Recovery**: Retry buttons for failed operations
✅ **Graceful Degradation**: Error boundaries prevent full app crashes

## Best Practices

1. **Always use Error type** for error state, not string
2. **Always provide retry** functionality for transient errors
3. **Use skeleton loaders** for initial loading (data.length === 0)
4. **Use toast notifications** for operation feedback
5. **Wrap page-level components** with ErrorBoundary
6. **Test error states** during development

## Future Enhancements

### Recommended Additions
- [ ] **Global Error Handler**: Catch-all for unhandled promise rejections
- [ ] **Error Logging Service**: Send errors to monitoring service (Sentry, etc.)
- [ ] **Offline Detection**: Special handling for offline state
- [ ] **Rate Limit Handling**: Special UI for 429 errors
- [ ] **Optimistic UI**: Update UI before API response for better UX
- [ ] **Error Analytics**: Track error rates and patterns

## Quick Reference

### Toast Messages Available
```typescript
toast.rbac.organizationCreated()
toast.rbac.organizationUpdated()
toast.rbac.organizationDeleted()
toast.rbac.memberInvited()
toast.rbac.memberUpdated()
toast.rbac.memberRemoved()
toast.rbac.roleCreated()
toast.rbac.roleUpdated()
toast.rbac.roleDeleted()
toast.rbac.permissionGranted()
toast.rbac.permissionRevoked()
```

### Skeleton Components Available
```typescript
<TableSkeleton rows={5} columns={6} />
<CardListSkeleton count={3} />
<FormSkeleton fields={4} />
<PageHeaderSkeleton />
<GridSkeleton items={6} columns={3} />
<PageLoadingSkeleton />
```

## Migration Timeline

**Priority 1** (Completed):
- ✅ Create skeleton components
- ✅ Create toast hook
- ✅ Enhance OrganizationsPage

**Priority 2** (Next 30 min):
- [ ] Enhance OrganizationMembersPage
- [ ] Enhance RBACRolesPage
- [ ] Enhance forms (OrganizationForm, InviteMemberForm)

**Priority 3** (Future):
- [ ] Add ErrorBoundary wrappers to route components
- [ ] Implement global error handler
- [ ] Add error logging service

## Support

For questions or issues with error handling:
1. Check this guide first
2. Reference ErrorBoundary.tsx for API error patterns
3. Reference OrganizationsPage.tsx for complete implementation example
4. Test with mock errors to verify behavior

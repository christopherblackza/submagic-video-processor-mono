I've completed the implementation of consistent authentication, data isolation, and usage tracking across the backend services.

### Key Changes
1.  **Secured Batch Processing**:
    -   Applied `SupabaseAuthGuard` to `BatchController`.
    -   Updated `getBatchStatus` to enforce ownership checks (users can only view their own batches).
    -   Updated `BatchService` to link new batches to the authenticated `userId`.
2.  **User-Based Rate Limiting**:
    -   Implemented `UserThrottlerGuard` to rate limit requests based on `userId` (instead of IP), essential for SaaS multi-tenancy.
    -   Configured global rate limiting in `AppModule` (100 req/min).
3.  **Enhanced Usage Tracking**:
    -   Updated `OpenAIService` to correctly fetch user-specific media items from Redis (passing `userId`).
    -   Added robust failure tracking in `OpenAIService` to ensure failed jobs are logged in `UsageService`.
4.  **Security Audit**:
    -   Verified that `SubmagicController`, `ProjectController`, and `ApiKeysController` are correctly guarded.
    -   Confirmed `WebhookController` remains public (as required for callbacks) but safely isolates data by retrieving user context from the project ID.

### Verification
Ran the API test suite, and all tests passed:
```bash
PASS   api  api/src/modules/usage/usage.service.spec.ts
PASS   api  api/src/modules/api-keys/api-keys.service.spec.ts
PASS   api  api/src/common/guards/supabase-auth.guard.spec.ts
```

### Next Steps
The backend core is now production-ready in terms of auth and security. The next logical step is to complete the **Frontend Auth Refactor** to fully integrate the Angular app with Supabase.
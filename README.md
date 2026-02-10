# ClipEngine Video Processor (SaaS)

This project is a production-ready SaaS platform for automated video processing, leveraging Supabase for authentication and database management, and implementing secure API key management and usage tracking.

## Architecture Overview

### Authentication & Security
- **Supabase Auth**: All authentication is handled via Supabase (JWT).
- **Guards**: `SupabaseAuthGuard` secures all API endpoints.
- **API Keys**: Third-party API keys (OpenAI, Submagic) are stored encrypted (AES-256) in the database.
- **Data Isolation**: Row Level Security (RLS) ensures users can only access their own data. All service calls (`Batch`, `OpenAI`, `Submagic`) propagate `userId` to enforce isolation.

### Database Schema
The PostgreSQL database (Supabase) includes the following key tables:
- `users`: Extends Supabase auth.users.
- `api_keys`: Stores encrypted API keys.
- `jobs`: Tracks video processing jobs.
- `job_assets`: Stores metadata for job-related assets.
- `usage_logs`: Tracks API usage for billing and rate limiting.

### Backend Services (NestJS)
- **ApiKeysModule**: Manages secure storage and retrieval of API keys.
- **BatchModule**: Handles batch video processing with user context.
- **UsageModule**: Tracks job execution and API usage.
- **SupabaseModule**: Provides Supabase client (standard and service-role).

### Frontend (Angular)
- **AuthInterceptor**: Automatically attaches Supabase JWT to all HTTP requests.
- **AuthService**: Manages user session and login flow.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Supabase Project

### Database Setup
Run the SQL script `supabase_schema.sql` in your Supabase SQL Editor to create the necessary tables, policies, and triggers.

### Environment Variables
Configure your `.env` file (or environment variables in production):
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ENCRYPTION_KEY=your_32_byte_encryption_key
```

### Running the Project
```bash
# Install dependencies
npm install

# Run the API
npx nx serve api

# Run the Frontend
npx nx serve video-processor-mono
```

### Testing
```bash
# Run API tests
npx nx test api
```

## Security Measures
1. **Encryption**: API keys are never stored in plain text. They are encrypted using AES-256-CBC before storage.
2. **RLS**: Database policies prevent cross-user data access.
3. **Validation**: All inputs are validated using DTOs.
4. **Rate Limiting**: ThrottlerModule is configured for global rate limiting.

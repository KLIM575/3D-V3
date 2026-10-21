# Supabase Configuration for KLIM DUSHKIN Portfolio

## Project Setup

1. **Create Supabase Project**
   - Go to https://supabase.com/dashboard
   - Create new project
   - Note down Project URL and API keys from Settings > API

2. **Run Database Schema**
   - Go to SQL Editor in Supabase Dashboard
   - Copy and run the contents of `supabase/schema.sql`

3. **Configure Storage**
   - Go to Storage in Supabase Dashboard
   - Create bucket `portfolio-images` (or run the SQL which does it automatically)
   - Set bucket to public

4. **Deploy Edge Functions**
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Login
   supabase login
   
   # Link to your project
   supabase link --project-ref YOUR_PROJECT_REF
   
   # Deploy functions
   supabase functions deploy ai-chat
   supabase functions deploy send-email
   supabase functions deploy contact
   ```

5. **Set Environment Variables**
   - In Supabase Dashboard: Settings > Edge Functions > Environment Variables
   - Add: `OPENAI_API_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`, `ADMIN_EMAIL`, `AUTO_REPLY_ENABLED`
   - Or use `supabase secrets set` command

## Local Development

1. **Start Supabase locally**
   ```bash
   supabase start
   ```

2. **Set local environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your local values
   ```

3. **Run migrations locally**
   ```bash
   supabase db reset
   ```

4. **Serve functions locally**
   ```bash
   supabase functions serve
   ```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | Yes (frontend) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes (frontend) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (keep secret!) | Yes (scripts, admin) |
| `OPENAI_API_KEY` | OpenAI API key for AI chat | Yes (ai-chat function) |
| `RESEND_API_KEY` | Resend API key for emails | Yes (send-email function) |
| `FROM_EMAIL` | Sender email address | Yes (send-email function) |
| `ADMIN_EMAIL` | Admin email for notifications | Yes (contact function) |
| `AUTO_REPLY_ENABLED` | Send auto-reply to users | No (default: false) |

## Data Migration

To migrate existing data from JS files to Supabase:

```bash
# Set environment variables
export VITE_SUPABASE_URL=your-url
export SUPABASE_SERVICE_ROLE_KEY=your-service-key

# Run migration script
node supabase/scripts/migrate-data.js
```

## Admin Access

1. Go to Supabase Dashboard > Authentication > Users
2. Create a user with your email
3. Go to Table Editor > admin_profiles
4. Insert a row with the user's UUID from auth.users
5. Set role = 'admin'

Now you can access the admin UI at Supabase Dashboard > Table Editor to manage all content.

## Frontend Integration

The frontend now uses Supabase for:
- ✅ Fetching projects, services, skills, timeline, process steps
- ✅ Contact form submission (via Edge Function)
- ✅ AI Chat with streaming responses (via Edge Function + OpenAI)
- ✅ Image uploads to Storage (for future admin UI)

## Deployment Checklist

- [ ] Supabase project created
- [ ] Schema applied (SQL Editor)
- [ ] Edge Functions deployed
- [ ] Environment variables set in Supabase Dashboard
- [ ] Environment variables set in hosting platform (Vercel/Netlify)
- [ ] Domain configured
- [ ] SSL enabled
- [ ] Admin user created in admin_profiles table

## Useful Commands

```bash
# View function logs
supabase functions logs ai-chat

# Deploy single function
supabase functions deploy contact

# Generate types from database
supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/supabase.ts

# Database diff
supabase db diff --schema public

# Backup database
supabase db dump --schema public > backup.sql
```
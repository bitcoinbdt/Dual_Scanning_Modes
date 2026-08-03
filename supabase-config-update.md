# Supabase URL Configuration Guide

## Method 1: Using Supabase Dashboard (Standard Path)

1. **Go to Project Settings**:
   - URL: https://supabase.com/dashboard/project/sanpifotyozeinatpyki/settings/auth
   - Or: Dashboard → Project Settings (gear icon at bottom left) → Authentication

2. **Configure URLs**:
   ```
   Site URL: https://scanner.coinxera.com
   
   Additional Redirect URLs (one per line):
   https://scanner.coinxera.com/**
   http://localhost:3000/**
   http://localhost:5173/**
   ```

## Method 2: Using Supabase Management API

If you can't find the UI option, use the Supabase Management API with a curl command:

```bash
curl -X PATCH 'https://api.supabase.com/v1/projects/sanpifotyozeinatpyki/config/auth' \
  -H "Authorization: Bearer YOUR_SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "SITE_URL": "https://scanner.coinxera.com",
    "ADDITIONAL_REDIRECT_URLS": [
      "https://scanner.coinxera.com/**",
      "http://localhost:3000/**"
    ]
  }'
```

To get your access token:
1. Go to: https://supabase.com/dashboard/account/tokens
2. Generate a new access token
3. Use it in the curl command above

## Method 3: Contact Supabase Support

If neither method works, you can:
1. Go to: https://supabase.com/dashboard/support
2. Request help configuring redirect URLs for your project
3. Provide them with:
   - Project ID: sanpifotyozeinatpyki
   - Required Site URL: https://scanner.coinxera.com
   - Required Redirect URLs: https://scanner.coinxera.com/**

## Method 4: Update in Supabase Config (if self-hosting)

If you're self-hosting Supabase, add to your `config.toml`:

```toml
[auth]
site_url = "https://scanner.coinxera.com"
additional_redirect_urls = ["https://scanner.coinxera.com/**"]
```

## Verification

After configuration, test the OAuth flow:
1. Clear browser cache and cookies
2. Go to https://scanner.coinxera.com
3. Click "Sign in with Google"
4. Complete Google authentication
5. Should redirect to https://scanner.coinxera.com/auth/callback
6. Should then redirect to https://scanner.coinxera.com with successful login

## Troubleshooting

If still not working:
- Check browser console for errors
- Check Supabase logs: Dashboard → Logs → Auth
- Verify Google OAuth settings include the Supabase callback URL

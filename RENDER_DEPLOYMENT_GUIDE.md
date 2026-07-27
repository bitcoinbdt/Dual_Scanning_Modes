# 🚀 Render Deployment Guide - Frontend (Next.js)

Complete step-by-step guide to deploy the OnChain Alpha Scanner frontend on Render.

---

## 📋 Prerequisites

### Required Accounts & Tools
- ✅ [Render Account](https://render.com/register) (Free tier available)
- ✅ [GitHub Account](https://github.com) with your code pushed
- ✅ [Supabase Project](https://supabase.com) (for authentication)
- ✅ Backend API deployed (or running locally for testing)

### Required Information
- 🔗 GitHub repository URL: `https://github.com/bitcoinbdt/Dual_Scanning_Modes`
- 🔑 Supabase project URL and anon key
- 💰 Solana treasury wallet address (for payments)
- 🌐 Backend API URL (if deployed separately)

---

## 🎯 Part 1: Prepare Your Project for Render

### Step 1: Update package.json Scripts

Render requires specific build and start scripts. Let's verify they're correct:

**Your current `package.json` should have**:
```json
{
  "scripts": {
    "dev": "next dev -p 5176",
    "build": "next build",
    "start": "next start -p 5176",
    "lint": "next lint"
  }
}
```

**For Render deployment, we need to modify the start script**:
```json
{
  "scripts": {
    "dev": "next dev -p 5176",
    "build": "next build",
    "start": "next start -p ${PORT:-3000}",
    "lint": "next lint"
  }
}
```

This allows Render to set the port dynamically.

### Step 2: Create a Render Configuration File (Optional but Recommended)

Create a file named `render.yaml` in your project root:

```yaml
services:
  - type: web
    name: onchain-scanner-frontend
    env: node
    region: oregon
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: NEXT_PUBLIC_BACKEND_URL
        sync: false
      - key: NEXT_PUBLIC_TREASURY_WALLET
        sync: false
      - key: NEXT_PUBLIC_SUPABASE_URL
        sync: false
      - key: NEXT_PUBLIC_SUPABASE_ANON_KEY
        sync: false
```

### Step 3: Push Changes to GitHub

If you modified package.json or added render.yaml:

```bash
git add .
git commit -m "Configure for Render deployment"
git push origin main
```

---

## 🌐 Part 2: Deploy on Render

### Step 1: Sign Up / Log In to Render

1. Go to https://render.com
2. Click **"Get Started"** or **"Sign In"**
3. Sign up with GitHub (recommended for easy repo access)
4. Authorize Render to access your GitHub repositories

### Step 2: Create a New Web Service

1. From the Render Dashboard, click **"New +"** button (top right)
2. Select **"Web Service"**
3. You'll see a list of your GitHub repositories

### Step 3: Connect Your Repository

1. Find `Dual_Scanning_Modes` in the list
2. Click **"Connect"** button next to it
3. If you don't see it, click **"Configure account"** and grant access

### Step 4: Configure Service Settings

Fill in the following details:

#### Basic Settings:
- **Name**: `onchain-scanner` (or your preferred name)
  - This will become your URL: `https://onchain-scanner.onrender.com`
- **Region**: `Oregon (US West)` (or closest to your users)
- **Branch**: `main`
- **Root Directory**: `.` (leave blank if scanner is in root)
- **Environment**: `Node`

#### Build & Deploy Settings:
- **Build Command**: 
  ```bash
  npm install && npm run build
  ```
- **Start Command**: 
  ```bash
  npm start
  ```
- **Auto-Deploy**: `Yes` (recommended - deploys on every git push)

#### Instance Type:
- **Plan**: Select **Free** (or Starter for better performance)
  - Free: 512 MB RAM, shared CPU, goes to sleep after 15 min inactivity
  - Starter ($7/mo): 512 MB RAM, always on, better performance

### Step 5: Add Environment Variables

Click **"Advanced"** and add the following environment variables:

| Key | Value | Description |
|-----|-------|-------------|
| `NODE_ENV` | `production` | Enables production optimizations |
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-backend.onrender.com` or `http://localhost:3000` | Your backend API URL |
| `NEXT_PUBLIC_TREASURY_WALLET` | `Your_Solana_Wallet_Address` | Solana wallet for receiving payments |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | From your Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | From your Supabase project settings (anon/public key) |

**How to add environment variables**:
1. Click **"Add Environment Variable"**
2. Enter Key and Value
3. Repeat for all variables
4. Click **"Save"**

### Step 6: Create Web Service

1. Review all settings
2. Click **"Create Web Service"** button at the bottom
3. Render will start building and deploying your app

---

## ⏱️ Part 3: Monitor Deployment

### Step 1: Watch the Build Process

You'll see a live log of the deployment process:

```
==> Cloning from https://github.com/bitcoinbdt/Dual_Scanning_Modes...
==> Checking out commit ccbd1d8...
==> Running build command 'npm install && npm run build'...
==> Installing dependencies...
==> Building Next.js application...
==> Build successful!
==> Starting application...
==> Your service is live at https://onchain-scanner.onrender.com
```

**Build typically takes**: 5-8 minutes

### Step 2: Common Build Issues & Solutions

#### Issue 1: Build Fails Due to TypeScript Errors
**Solution**: Add to build command:
```bash
npm install && npm run build || npm run build --no-lint
```

#### Issue 2: Missing Dependencies
**Solution**: Verify all dependencies in package.json, especially:
- `@supabase/supabase-js`
- `next`
- `react`
- `react-dom`

#### Issue 3: Port Binding Error
**Solution**: Ensure your start script uses `${PORT:-3000}` or just let Render assign the port

### Step 3: Deployment Status

Once deployed, you'll see:
- ✅ **Status**: `Live`
- 🌐 **URL**: `https://onchain-scanner.onrender.com`
- 📊 **Metrics**: CPU, Memory, Response time

---

## ✅ Part 4: Post-Deployment Verification

### Step 1: Test Your Deployment

1. **Visit your site**: `https://onchain-scanner.onrender.com`
2. **Check Scanner Loads**: Homepage should display scanner interface
3. **Test Authentication**: 
   - Click login/signup
   - Try email/password signup
   - Try Google OAuth login (must be configured in Supabase)
4. **Test Theme Switching**: Verify all 3 themes work
5. **Check Credit Store**: Open credit store modal
6. **Test Responsive Design**: Check on mobile view

### Step 2: Verify Environment Variables

Check browser console for errors. If you see:
- "Supabase environment variables are not set" → Add SUPABASE variables
- "Cannot connect to backend" → Check NEXT_PUBLIC_BACKEND_URL

### Step 3: Check Logs

In Render dashboard:
1. Click on your service
2. Go to **"Logs"** tab
3. Look for any errors or warnings

---

## 🔧 Part 5: Configuration & Optimization

### Enable Custom Domain (Optional)

1. Go to your service in Render dashboard
2. Click **"Settings"** tab
3. Scroll to **"Custom Domain"**
4. Click **"Add Custom Domain"**
5. Enter your domain: `scanner.onchain-alpha.com`
6. Add DNS records at your domain provider:
   ```
   Type: CNAME
   Name: scanner
   Value: onchain-scanner.onrender.com
   ```
7. Wait for DNS propagation (5-60 minutes)
8. Render auto-provisions SSL certificate

### Enable HTTP/2 & Compression

These are enabled by default on Render, but verify in Settings:
- ✅ HTTP/2 Support: Enabled
- ✅ Brotli Compression: Enabled
- ✅ HTTPS Redirect: Enabled

### Configure Health Checks

1. Go to **"Settings"** → **"Health Check"**
2. Enable **"Health Check Path"**: `/`
3. Expected status code: `200`
4. Interval: `30 seconds`
5. Timeout: `10 seconds`
6. Failures before unhealthy: `3`

### Set Up Notifications

1. Go to **"Settings"** → **"Notifications"**
2. Enable **"Deploy notifications"**
3. Enable **"Service health notifications"**
4. Add your email or Slack webhook

---

## 💰 Part 6: Cost & Performance

### Free Tier Limitations

**Render Free Tier Includes**:
- ✅ 750 hours/month (enough for 1 service running 24/7)
- ✅ 100 GB bandwidth/month
- ✅ Automatic SSL certificates
- ✅ GitHub auto-deploy
- ❌ Service spins down after 15 min of inactivity
- ❌ Slower cold start (30-60 seconds first request)
- ❌ Shared CPU and memory

**Limitations Impact**:
- First visitor after inactivity: 30-60 second wait time
- Subsequent visitors: Fast response times
- Best for: Development, staging, low-traffic sites

### Starter Tier ($7/month)

**Benefits**:
- ✅ Always-on (no spin down)
- ✅ Faster response times
- ✅ 400 hours/month (upgradable)
- ✅ Better for production with regular traffic

### Performance Optimization Tips

1. **Keep Service Warm** (Free tier workaround):
   - Use [UptimeRobot](https://uptimerobot.com) (free)
   - Ping your site every 5-10 minutes
   - Prevents cold starts

2. **Enable Caching**:
   - Next.js automatically caches static assets
   - Configure in `next.config.js`

3. **Optimize Images**:
   - Use Next.js `<Image>` component
   - Compress images before uploading

4. **Monitor Performance**:
   - Use Render's built-in metrics
   - Add Google Analytics for user metrics

---

## 🔄 Part 7: Continuous Deployment

### Automatic Deployments

When you push to GitHub, Render automatically:
1. Detects the push
2. Pulls latest code
3. Runs build command
4. Deploys new version
5. Performs zero-downtime switch

### Manual Deployment

To manually trigger a deployment:
1. Go to your service in Render dashboard
2. Click **"Manual Deploy"** dropdown (top right)
3. Select **"Deploy latest commit"**
4. Confirm deployment

### Rollback to Previous Version

If something goes wrong:
1. Go to **"Deploys"** tab
2. Find the working version
3. Click **"Redeploy"** next to it
4. Confirm rollback

---

## 🐛 Part 8: Troubleshooting

### Issue: "Service Unavailable" Error

**Causes**:
- Service is spinning up (free tier)
- Build failed
- Application crashed

**Solutions**:
1. Check Logs tab for errors
2. Verify all environment variables are set
3. Check if build completed successfully
4. Restart service manually

### Issue: "Cannot GET /" Error

**Cause**: Next.js not starting properly

**Solutions**:
1. Verify start command: `npm start`
2. Check package.json has correct scripts
3. Ensure build completed without errors
4. Check logs for port binding issues

### Issue: Blank Page / White Screen

**Causes**:
- Environment variables missing
- JavaScript errors
- API connection issues

**Solutions**:
1. Open browser console (F12)
2. Check for JavaScript errors
3. Verify all NEXT_PUBLIC_* variables are set
4. Test backend API separately

### Issue: Authentication Not Working

**Causes**:
- Supabase variables incorrect
- OAuth redirect URL not configured
- Supabase project not accessible

**Solutions**:
1. Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
2. Add Render URL to Supabase redirect URLs:
   - Go to Supabase dashboard
   - Authentication → URL Configuration
   - Add: `https://onchain-scanner.onrender.com/auth/callback`
3. Test with email/password first before OAuth

### Issue: Slow Performance

**Causes**:
- Free tier spinning up from sleep
- Large bundle size
- Unoptimized assets

**Solutions**:
1. Upgrade to Starter tier ($7/mo)
2. Use UptimeRobot to keep service warm
3. Optimize bundle size with code splitting
4. Compress images and assets

### Issue: Environment Variables Not Loading

**Cause**: Variables not prefixed with NEXT_PUBLIC_

**Solution**: All client-side environment variables MUST start with `NEXT_PUBLIC_`

Example:
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ❌ `SUPABASE_URL`

---

## 📊 Part 9: Monitoring & Maintenance

### Monitor Service Health

**Built-in Render Metrics**:
1. Go to your service dashboard
2. View real-time metrics:
   - CPU usage
   - Memory usage
   - HTTP response times
   - Request count
   - Error rate

### Set Up Alerts

1. Go to **"Settings"** → **"Notifications"**
2. Configure alerts for:
   - Deployment failures
   - Service crashes
   - High memory usage
   - High response times

### View Logs

**Access Logs**:
1. Click **"Logs"** tab
2. Filter by:
   - Build logs
   - Application logs
   - System logs
3. Search for specific errors
4. Download logs for offline analysis

**Log Retention**:
- Free tier: 7 days
- Starter tier: 30 days
- Pro tier: 90 days

### Regular Maintenance Tasks

**Weekly**:
- Check deployment status
- Review error logs
- Monitor response times

**Monthly**:
- Review bandwidth usage
- Check for security updates
- Update dependencies
- Review performance metrics

---

## 🔒 Part 10: Security Best Practices

### Environment Variables Security

- ✅ Never commit `.env.local` to Git (already in .gitignore)
- ✅ Use Render's environment variable system
- ✅ Rotate Supabase keys if exposed
- ✅ Use different keys for dev/staging/production

### HTTPS & SSL

- ✅ Render provides free SSL certificates
- ✅ Automatic HTTPS redirect enabled
- ✅ Certificate auto-renewal

### API Security

1. **Enable CORS** on backend:
   ```javascript
   // Backend must allow requests from Render domain
   app.enableCors({
     origin: 'https://onchain-scanner.onrender.com',
     credentials: true
   });
   ```

2. **Use HTTPS URLs** for all external APIs

3. **Validate Input** on both client and server

### Supabase Security

1. **Row Level Security (RLS)**: Enable on all tables
2. **Anon Key**: Safe to expose (limited permissions)
3. **Service Role Key**: NEVER expose to frontend
4. **OAuth Redirect URLs**: Whitelist only your domains

---

## 📋 Part 11: Deployment Checklist

### Pre-Deployment Checklist

- [ ] Code pushed to GitHub repository
- [ ] Supabase project created and configured
- [ ] OAuth providers configured in Supabase (if using)
- [ ] Solana treasury wallet address ready
- [ ] Backend API deployed and accessible (or localhost for testing)
- [ ] Environment variables documented
- [ ] package.json scripts configured correctly

### Deployment Checklist

- [ ] Render account created
- [ ] GitHub repository connected
- [ ] Web service created
- [ ] Build and start commands configured
- [ ] All environment variables added
- [ ] Service deployed successfully
- [ ] Deployment logs checked for errors

### Post-Deployment Checklist

- [ ] Site loads correctly at Render URL
- [ ] Authentication works (signup/login)
- [ ] Google OAuth works (if configured)
- [ ] Theme switching works
- [ ] Credit store modal opens
- [ ] Scanner functionality works (if backend connected)
- [ ] Responsive design verified on mobile
- [ ] Browser console has no errors
- [ ] Custom domain configured (optional)
- [ ] Health checks enabled
- [ ] Notifications configured
- [ ] Performance monitored

---

## 🎉 Success!

Your OnChain Alpha Scanner is now live on Render!

**Your URLs**:
- 🌐 **Frontend**: `https://onchain-scanner.onrender.com`
- 📊 **Dashboard**: https://dashboard.render.com

**Next Steps**:
1. Configure Supabase authentication
2. Deploy backend API (if not already)
3. Test end-to-end scanning workflow
4. Set up custom domain (optional)
5. Monitor performance and usage

---

## 📞 Support Resources

### Render Documentation
- [Render Docs](https://render.com/docs)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Custom Domains](https://render.com/docs/custom-domains)

### Community Support
- [Render Community Forum](https://community.render.com)
- [Render Status Page](https://status.render.com)
- [Render Discord](https://discord.gg/render)

### Project Documentation
- [README.md](README.md) - Project overview
- [SUPABASE_MIGRATION_SUMMARY.md](SUPABASE_MIGRATION_SUMMARY.md) - Supabase setup
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Full stack deployment

---

**Last Updated**: July 27, 2026  
**Deployment Platform**: Render  
**Framework**: Next.js 15  
**Status**: Production Ready ✅
# 🚀 Deployment Guide: Vercel + Render

This guide will help you deploy the OnChain Alpha Scanner with:
- **Frontend**: Vercel (Next.js)
- **Backend**: Render (NestJS)

---

## 📋 Prerequisites

### Required Accounts:
- ✅ [Vercel Account](https://vercel.com/signup) (Free tier works)
- ✅ [Render Account](https://render.com/register) (Free tier available)
- ✅ [GitHub Account](https://github.com) (for connecting repositories)

### Required Information:
- 🔑 Supabase credentials (project URL and anon key)
- 💰 Solana treasury wallet address
- 🗄️ PostgreSQL database (Supabase provides free tier)
- 📦 Redis instance (Render provides free tier)

---

## 🎯 Part 1: Deploy Backend to Render

### Step 1: Prepare Backend Repository

1. **Push backend code to GitHub** (if not already):
   ```bash
   cd e:\onchain-alpha-sniper\onchain\backend
   git init
   git add .
   git commit -m "Initial backend commit"
   git remote add origin https://github.com/YOUR_USERNAME/onchain-backend.git
   git push -u origin main
   ```

### Step 2: Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `onchain-scanner-db`
   - **Database**: `onchain_scanner`
   - **User**: `onchain_user`
   - **Region**: `Oregon (US West)`
   - **Plan**: `Free` (or Starter for production)
4. Click **"Create Database"**
5. **Copy the Internal Database URL** (starts with `postgresql://`)

### Step 3: Create Redis Instance on Render

1. Click **"New +"** → **"Redis"**
2. Configure:
   - **Name**: `onchain-scanner-redis`
   - **Region**: `Oregon (US West)`
   - **Plan**: `Free` (max 25MB)
3. Click **"Create Redis"**
4. **Copy the Internal Redis URL** (starts with `redis://`)

### Step 4: Deploy Backend on Render

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `onchain-scanner-backend`
   - **Region**: `Oregon (US West)`
   - **Branch**: `main`
   - **Root Directory**: `onchain/backend` (if monorepo)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:prod`
   - **Plan**: `Starter` ($7/mo) or `Free`

4. **Add Environment Variables**:
   ```bash
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=<paste-internal-database-url>
   REDIS_URL=<paste-internal-redis-url>
   JWT_SECRET=<generate-random-string>
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```

5. Click **"Create Web Service"**
6. Wait for deployment (5-10 minutes)
7. **Copy your backend URL**: `https://onchain-scanner-backend.onrender.com`

### Step 5: Run Database Migrations

1. In Render dashboard, go to your backend service
2. Click **"Shell"** tab
3. Run:
   ```bash
   npx prisma migrate deploy
   npx prisma generate
   ```

---

## 🎨 Part 2: Deploy Frontend to Vercel

### Step 1: Prepare Frontend Repository

1. **Push frontend code to GitHub** (if not already):
   ```bash
   cd e:\onchain-alpha-sniper\onchain\scanner
   git init
   git add .
   git commit -m "Initial scanner frontend commit"
   git remote add origin https://github.com/YOUR_USERNAME/onchain-scanner.git
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com/new
2. **Import Git Repository**
3. Select your `onchain-scanner` repository
4. Configure:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `./` (or `onchain/scanner` if monorepo)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

5. **Add Environment Variables**:
   ```bash
   NEXT_PUBLIC_BACKEND_URL=https://onchain-scanner-backend.onrender.com
   NEXT_PUBLIC_TREASURY_WALLET=YOUR_SOLANA_WALLET_ADDRESS
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key-here
   ```

6. Click **"Deploy"**
7. Wait for deployment (2-3 minutes)
8. **Copy your frontend URL**: `https://onchain-scanner.vercel.app`

### Step 3: Update Backend CORS

1. Go back to Render backend dashboard
2. Update `CORS_ORIGIN` environment variable:
   ```bash
   CORS_ORIGIN=https://onchain-scanner.vercel.app
   ```
3. Redeploy backend (click "Manual Deploy" → "Deploy latest commit")

---

## 🔗 Part 3: Connect Frontend and Backend

### Update Backend URL in Frontend

If your Vercel URL or Render URL changes:

1. In Vercel dashboard → Your project → Settings → Environment Variables
2. Update `NEXT_PUBLIC_BACKEND_URL` to your Render backend URL
3. Redeploy frontend

### Update CORS in Backend

If your frontend URL changes:

1. In Render dashboard → Your backend service → Environment
2. Update `CORS_ORIGIN` to your Vercel frontend URL
3. Redeploy backend

---

## 🔐 Part 4: Configure Backend CORS (Code Level)

Update `main.ts` in backend to handle production CORS:

```typescript
// backend/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS Configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5176',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend running on port ${port}`);
}
bootstrap();
```

---

## ✅ Part 5: Verification Checklist

### Backend Health Check:
- [ ] Visit `https://your-backend.onrender.com/` - Should return app info
- [ ] Check Render logs - No errors
- [ ] Database connected - Run migrations successfully
- [ ] Redis connected - No connection errors

### Frontend Health Check:
- [ ] Visit `https://your-frontend.vercel.app` - Scanner loads
- [ ] Login works - Supabase authentication
- [ ] Credit badge appears after login
- [ ] Open credit store modal - Packages display
- [ ] Connect Phantom wallet - No CORS errors
- [ ] Check browser console - No backend connection errors

### Integration Check:
- [ ] Backend URL in frontend environment variables is correct
- [ ] CORS origin in backend matches frontend URL
- [ ] API calls from frontend reach backend
- [ ] Credit system works (local state + Phantom)

---

## 🔧 Part 6: Custom Domains (Optional)

### Add Custom Domain to Vercel:

1. Vercel Dashboard → Your project → Settings → Domains
2. Add your domain: `scanner.onchain-alpha.com`
3. Add DNS records at your domain provider:
   ```
   Type: CNAME
   Name: scanner
   Value: cname.vercel-dns.com
   ```
4. Wait for DNS propagation (5-60 minutes)

### Add Custom Domain to Render:

1. Render Dashboard → Your backend service → Settings
2. Add custom domain: `api.onchain-alpha.com`
3. Add DNS records:
   ```
   Type: CNAME
   Name: api
   Value: your-service.onrender.com
   ```
4. Update frontend `NEXT_PUBLIC_BACKEND_URL` to `https://api.onchain-alpha.com`
5. Update backend `CORS_ORIGIN` to `https://scanner.onchain-alpha.com`

---

## 📊 Part 7: Monitoring & Logs

### Vercel Monitoring:

- **Real-time logs**: Vercel Dashboard → Your project → Deployments → Click deployment → View function logs
- **Analytics**: Available on Pro plan
- **Error tracking**: Integrate Sentry (optional)

### Render Monitoring:

- **Real-time logs**: Render Dashboard → Your service → Logs tab
- **Metrics**: CPU, Memory, HTTP requests (on paid plans)
- **Alerts**: Set up in Settings → Notifications

### Log Important Events:

Backend should log:
```typescript
// Credit purchase
logger.log(`Credit purchase: user=${userId}, package=${packageId}, tx=${txSignature}`);

// Scanner API calls
logger.log(`Scan request: user=${userId}, type=${scanType}, address=${tokenAddress}`);
```

Frontend console logs:
```typescript
// Development only
if (process.env.NODE_ENV === 'development') {
  console.log('Credit deducted:', amount);
  console.log('Backend URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
}
```

---

## 💰 Cost Breakdown

### Render Costs:

| Service | Free Tier | Starter | Standard |
|---------|-----------|---------|----------|
| Web Service | 750hrs/mo | $7/mo | $25/mo |
| PostgreSQL | 1GB storage | $7/mo | $20/mo |
| Redis | 25MB | $10/mo | - |
| **Total** | **$0** (with limits) | **$17/mo** | **$45/mo** |

**Free Tier Limitations**:
- Spins down after 15 min inactivity
- 750 hours/month (enough for 1 service)
- 100GB bandwidth/month

**Recommendation**: Starter ($17/mo) for production

### Vercel Costs:

| Tier | Price | Features |
|------|-------|----------|
| Hobby | **Free** | Unlimited deployments, 100GB bandwidth |
| Pro | $20/mo | Analytics, 1TB bandwidth, no cold starts |
| Enterprise | Custom | Dedicated support, SLA |

**Recommendation**: Hobby (Free) is sufficient, Pro for serious traffic

**Total Estimated Cost**: $17-37/month (Render Starter + Vercel Free/Pro)

---

## 🐛 Troubleshooting

### Frontend can't connect to backend:

**Symptoms**: Network errors, API calls fail
**Fix**:
1. Check `NEXT_PUBLIC_BACKEND_URL` in Vercel environment variables
2. Verify backend is running on Render
3. Check browser console for CORS errors
4. Ensure backend `CORS_ORIGIN` matches frontend URL

### Backend crashes on startup:

**Symptoms**: Service keeps restarting
**Fix**:
1. Check Render logs for errors
2. Verify all environment variables are set
3. Check DATABASE_URL and REDIS_URL are correct
4. Run migrations: `npx prisma migrate deploy`

### Credit purchases fail:

**Symptoms**: Phantom transaction fails
**Fix**:
1. Check `NEXT_PUBLIC_TREASURY_WALLET` is set
2. Verify treasury wallet address is valid
3. Ensure user has enough SOL
4. Check Solana network (devnet vs mainnet)

### Render free tier sleeps:

**Symptoms**: First request is slow (30+ seconds)
**Fix**:
- Upgrade to Starter plan ($7/mo), OR
- Use a cron job to ping your backend every 10 minutes:
  ```bash
  # Use cron-job.org or similar
  GET https://your-backend.onrender.com/health
  ```

---

## 🚀 Deployment Commands Summary

### First Time Deployment:

```bash
# Backend
cd onchain/backend
git add .
git commit -m "Deploy backend to Render"
git push origin main

# Frontend
cd ../scanner
git add .
git commit -m "Deploy frontend to Vercel"
git push origin main
```

### Update Deployment:

```bash
# Backend (Render auto-deploys on push)
cd onchain/backend
git add .
git commit -m "Update backend"
git push origin main

# Frontend (Vercel auto-deploys on push)
cd ../scanner
git add .
git commit -m "Update frontend"
git push origin main
```

### Manual Redeploy:

- **Render**: Dashboard → Service → "Manual Deploy" button
- **Vercel**: Dashboard → Project → Deployments → "Redeploy" button

---

## 📞 Support & Resources

### Official Documentation:
- [Vercel Docs](https://vercel.com/docs)
- [Render Docs](https://render.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [NestJS Deployment](https://docs.nestjs.com/faq/deployment)

### Common Issues:
- Render Community: https://community.render.com
- Vercel Support: https://vercel.com/support
- GitHub Issues: Create in your repository

---

## ✅ Post-Deployment Checklist

- [ ] Frontend deployed to Vercel
- [ ] Backend deployed to Render
- [ ] Database migrations completed
- [ ] Redis connected
- [ ] Environment variables configured on both platforms
- [ ] CORS configured correctly
- [ ] Custom domains added (if applicable)
- [ ] SSL certificates active (automatic on both platforms)
- [ ] Login/Authentication working
- [ ] Credit system functional
- [ ] Phantom wallet integration working
- [ ] Scanner scanning tokens (if backend endpoints exist)
- [ ] Monitoring/logging set up
- [ ] Backup strategy in place for database

---

**🎉 Your scanner is now live and production-ready!**

**Frontend**: https://your-scanner.vercel.app
**Backend**: https://your-backend.onrender.com

---

**Last Updated**: January 2025
**Deployment Stack**: Vercel + Render
**Framework**: Next.js 15 + NestJS

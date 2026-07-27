# 🚀 Quick Deploy to Render - 5 Minutes

Fastest way to get your OnChain Alpha Scanner live on Render.

---

## ⚡ Quick Steps

### 1. Sign Up on Render
- Go to https://render.com
- Click "Get Started"
- Sign in with GitHub

### 2. Create New Web Service
- Click **"New +"** → **"Web Service"**
- Select `Dual_Scanning_Modes` repository
- Click **"Connect"**

### 3. Configure Service

**Basic Settings**:
```
Name: onchain-scanner
Region: Oregon (US West)
Branch: main
Environment: Node
```

**Build Settings**:
```
Build Command: npm install && npm run build
Start Command: npm start
```

**Instance Type**:
```
Plan: Free (or Starter $7/mo for production)
```

### 4. Add Environment Variables

Click **"Advanced"** and add these:

```env
NODE_ENV=production
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_TREASURY_WALLET=YOUR_SOLANA_WALLET_HERE
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Get Supabase credentials**:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → API
4. Copy **Project URL** and **anon/public key**

### 5. Deploy!

- Click **"Create Web Service"**
- Wait 5-8 minutes for build
- Your site will be live at: `https://onchain-scanner.onrender.com`

---

## ✅ Verify Deployment

1. **Visit your site**: Open the Render URL
2. **Check homepage**: Scanner interface should load
3. **Test login**: Try signing up with email
4. **Check themes**: Toggle between 3 themes

---

## 🐛 Quick Troubleshooting

**Site not loading?**
- Check Logs tab in Render dashboard
- Verify all environment variables are set
- Wait 30-60 seconds (free tier cold start)

**Authentication not working?**
- Verify Supabase URL and anon key
- Add your Render URL to Supabase redirect URLs:
  - Supabase Dashboard → Authentication → URL Configuration
  - Add: `https://your-app.onrender.com/auth/callback`

**Need more help?**
- See [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md) for detailed guide
- Check Render Logs for errors
- Visit https://community.render.com

---

## 🎯 What's Next?

1. **Set up Supabase** properly (see SUPABASE_MIGRATION_SUMMARY.md)
2. **Deploy backend** (if you have one)
3. **Add custom domain** (optional)
4. **Upgrade to Starter** for better performance ($7/mo)

---

**Your app is live!** 🎉

Frontend: `https://onchain-scanner.onrender.com`  
Dashboard: https://dashboard.render.com
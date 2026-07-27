# ⚡ Quick Deploy to Vercel - 5 Minutes

Fastest way to get your OnChain Alpha Scanner live on Vercel - the optimal platform for Next.js.

---

## 🚀 Super Quick Steps

### 1. Sign Up on Vercel
- Go to https://vercel.com
- Click **"Sign Up"**
- Choose **"Continue with GitHub"** (easiest)
- Authorize Vercel

### 2. Import Your Project
- Click **"Add New..."** → **"Project"**
- Find `Dual_Scanning_Modes` in the list
- Click **"Import"**

### 3. Configure (Auto-detected!)

Vercel automatically detects Next.js. Just verify:

```
Framework: Next.js ✅ (auto-detected)
Build Command: npm run build ✅
Output Directory: .next ✅
Install Command: npm install ✅
```

**Project Name**: `onchain-scanner` (becomes your URL)

### 4. Add Environment Variables

Click **"Environment Variables"** and add:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_TREASURY_WALLET=YOUR_SOLANA_WALLET
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**Get Supabase credentials**:
1. https://supabase.com/dashboard
2. Your Project → Settings → API
3. Copy **Project URL** and **anon public** key

### 5. Deploy! 🎉

- Click **"Deploy"** button
- Wait 1-3 minutes
- Your site is live at: `https://onchain-scanner.vercel.app`

---

## ✅ Verify Deployment

1. **Visit**: `https://onchain-scanner.vercel.app`
2. **Test Scanner**: Homepage should load with scanner interface
3. **Test Login**: Try signing up with email
4. **Test Themes**: Toggle between 3 themes
5. **Check Credit Store**: Modal should open

---

## 🔧 Configure Supabase Redirect

For authentication to work:

1. Go to https://supabase.com/dashboard
2. Select your project
3. **Authentication** → **URL Configuration**
4. Add redirect URL:
   ```
   https://onchain-scanner.vercel.app/auth/callback
   ```
5. For preview deployments, also add:
   ```
   https://*.vercel.app/auth/callback
   ```
6. Click **"Save"**

---

## 🎯 Auto-Deploy Setup

Already configured! Every time you push to GitHub:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Vercel automatically deploys to production! ✨

**Preview Deployments**:
- Create a branch → Push → Get unique preview URL
- Perfect for testing before merging

---

## 🌐 Add Custom Domain (Optional)

1. In Vercel dashboard → Your project
2. **Settings** → **Domains**
3. Click **"Add"**
4. Enter: `scanner.yourdomain.com`
5. Add DNS record at your domain provider:
   ```
   Type: CNAME
   Name: scanner
   Value: cname.vercel-dns.com
   ```
6. Wait 5-60 minutes for DNS propagation
7. SSL certificate auto-provisioned! 🔒

---

## 🐛 Quick Troubleshooting

### Authentication Not Working?
**Fix**: Add Vercel URL to Supabase redirect URLs (see above)

### Environment Variables Not Loading?
**Fix**: Ensure all variables start with `NEXT_PUBLIC_`
- ✅ `NEXT_PUBLIC_SUPABASE_URL`
- ❌ `SUPABASE_URL`

### Build Failed?
**Fix**: 
1. Check **"Deployments"** → Click failed deployment
2. View build logs for errors
3. Test build locally: `npm run build`

### Site Shows 404?
**Fix**: Verify Root Directory is `./` in Settings

---

## 💡 Pro Tips

### Keep Service Fast
- Vercel edge network = lightning fast
- No cold starts (unlike Render free tier)
- Global CDN with 100+ locations

### Free Tier Limits
- ✅ 100 GB bandwidth/month
- ✅ Unlimited deployments
- ✅ Automatic preview URLs
- ✅ Always-on (no sleep!)

### Upgrade to Pro ($20/mo)
- 📊 Web Analytics
- ⚡ Speed Insights
- 👥 Team collaboration
- 📈 1 TB bandwidth

---

## 🎯 What's Next?

1. ✅ **Deploy** - Done!
2. 🔐 **Set up Supabase** - Configure authentication properly
3. 🌐 **Deploy Backend** - Deploy your API (Render, Railway, etc.)
4. 🎨 **Custom Domain** - Add your own domain
5. 📊 **Monitor** - Watch analytics in Vercel dashboard

---

## 📚 Need More Help?

- **Full Guide**: [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md)
- **Vercel Docs**: https://vercel.com/docs
- **Vercel Support**: https://vercel.com/support
- **Community**: https://github.com/vercel/vercel/discussions

---

## 🎉 Congratulations!

Your OnChain Alpha Scanner is live on Vercel! 🚀

**Your URLs**:
- 🌐 **Live Site**: `https://onchain-scanner.vercel.app`
- 📊 **Dashboard**: https://vercel.com/dashboard

**Fun Fact**: You just deployed to the same platform that powers:
- Next.js documentation
- Notion
- TikTok
- Patreon
- And thousands more! 🌟
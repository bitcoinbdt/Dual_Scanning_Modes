# 🚀 Vercel Deployment Guide - Frontend (Next.js)

Complete step-by-step guide to deploy the OnChain Alpha Scanner on Vercel - the optimal platform for Next.js applications.

---

## 🌟 Why Vercel?

Vercel created Next.js, making it the **best platform** for Next.js deployments:

- ⚡ **Zero Configuration** - Automatic Next.js detection
- 🚀 **Edge Network** - Global CDN with 100+ locations
- 🔄 **Instant Deploys** - Push to deploy in seconds
- 📊 **Analytics** - Built-in performance monitoring (Pro plan)
- 🆓 **Generous Free Tier** - Perfect for personal projects
- 🔧 **Preview Deployments** - Automatic preview URLs for branches/PRs
- 🌐 **Custom Domains** - Free SSL certificates

---

## 📋 Prerequisites

### Required Accounts & Tools
- ✅ [Vercel Account](https://vercel.com/signup) (Free tier available)
- ✅ [GitHub Account](https://github.com) with your code pushed
- ✅ [Supabase Project](https://supabase.com) (for authentication)
- ✅ Backend API deployed (or running locally for testing)

### Required Information
- 🔗 GitHub repository: `https://github.com/bitcoinbdt/Dual_Scanning_Modes`
- 🔑 Supabase project URL and anon key
- 💰 Solana treasury wallet address
- 🌐 Backend API URL (if deployed)

---

## 🎯 Part 1: Prepare Your Project

### Step 1: Verify Next.js Configuration

Your `next.config.js` should be properly configured. Let's check:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: [], // Add any external image domains here
  },
}

module.exports = nextConfig
```

### Step 2: Create vercel.json (Optional)

For advanced configuration, create `vercel.json`:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

**Note**: This is optional. Vercel auto-detects Next.js projects.

### Step 3: Verify .gitignore

Ensure sensitive files are ignored (already configured):

```gitignore
# dependencies
/node_modules

# next.js
/.next/
/out/

# local env files
.env*.local
.env

# vercel
.vercel
```

---

## 🌐 Part 2: Deploy on Vercel

### Method 1: Deploy via Vercel Dashboard (Recommended)

#### Step 1: Sign Up / Log In

1. Go to https://vercel.com
2. Click **"Sign Up"** or **"Log In"**
3. Choose **"Continue with GitHub"** (recommended)
4. Authorize Vercel to access your GitHub account

#### Step 2: Import Project

1. From Vercel dashboard, click **"Add New..."** → **"Project"**
2. You'll see **"Import Git Repository"** section
3. Find `Dual_Scanning_Modes` in the list
4. Click **"Import"** next to it

**If you don't see your repository**:
- Click **"Adjust GitHub App Permissions"**
- Select repositories to grant access
- Refresh the page

#### Step 3: Configure Project

Vercel will auto-detect Next.js and pre-fill settings:

**Project Configuration**:
- **Framework Preset**: `Next.js` (auto-detected ✅)
- **Root Directory**: `./` (leave as is)
- **Build Command**: `npm run build` (auto-detected ✅)
- **Output Directory**: `.next` (auto-detected ✅)
- **Install Command**: `npm install` (auto-detected ✅)

**Project Name**:
- Enter: `onchain-scanner` (or your preferred name)
- This becomes your URL: `https://onchain-scanner.vercel.app`

#### Step 4: Add Environment Variables

Click **"Environment Variables"** to expand the section.

Add the following variables:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-backend.onrender.com` | Your backend API URL |
| `NEXT_PUBLIC_TREASURY_WALLET` | `Your_Solana_Wallet_Address` | Solana wallet for payments |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` | Supabase anon/public key |

**How to add**:
1. Enter variable name in "Key" field
2. Enter value in "Value" field
3. Select **"Production"**, **"Preview"**, and **"Development"** (or customize)
4. Click **"Add"**
5. Repeat for all variables

**Get Supabase Credentials**:
1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → API
4. Copy **Project URL** and **anon public** key

#### Step 5: Deploy

1. Review all settings
2. Click **"Deploy"** button
3. Vercel will:
   - Clone your repository
   - Install dependencies
   - Build your Next.js app
   - Deploy to global edge network

**Deployment Time**: 1-3 minutes ⚡

#### Step 6: Access Your Site

Once deployed, you'll see:
- ✅ Confetti animation (success!)
- 🌐 **Production URL**: `https://onchain-scanner.vercel.app`
- 🔗 **GitHub Integration**: Automatic deployments enabled

---

### Method 2: Deploy via Vercel CLI

#### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

#### Step 2: Login to Vercel

```bash
vercel login
```

Enter your email and verify through the link sent.

#### Step 3: Deploy from Terminal

```bash
# Navigate to your project
cd d:\scanner

# Deploy (interactive)
vercel

# Or deploy directly to production
vercel --prod
```

**Follow prompts**:
1. Set up and deploy? **Y**
2. Which scope? Select your account
3. Link to existing project? **N** (for first deployment)
4. Project name? `onchain-scanner`
5. Directory? `./`
6. Override settings? **N** (uses auto-detection)

#### Step 4: Add Environment Variables via CLI

```bash
# Add production environment variable
vercel env add NEXT_PUBLIC_SUPABASE_URL production

# You'll be prompted to enter the value
# Repeat for all environment variables
```

Or add them in the dashboard after deployment.

---

## ⚙️ Part 3: Advanced Configuration

### Custom Domain Setup

#### Step 1: Add Domain in Vercel

1. Go to your project in Vercel dashboard
2. Click **"Settings"** tab
3. Click **"Domains"** in sidebar
4. Click **"Add"** button
5. Enter your domain: `scanner.onchain-alpha.com`
6. Click **"Add"**

#### Step 2: Configure DNS

Vercel will provide DNS records. Add them at your domain provider:

**For subdomain** (e.g., scanner.onchain-alpha.com):
```
Type: CNAME
Name: scanner
Value: cname.vercel-dns.com
```

**For root domain** (e.g., onchain-alpha.com):
```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

#### Step 3: Verify & Wait

- Vercel automatically provisions SSL certificate (Let's Encrypt)
- DNS propagation: 5 minutes - 48 hours
- Certificate provisioning: instant - 20 minutes
- Status shown in Vercel dashboard

### Configure Redirects & Rewrites

Create `vercel.json` for advanced routing:

```json
{
  "redirects": [
    {
      "source": "/home",
      "destination": "/",
      "permanent": true
    }
  ],
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend.onrender.com/api/:path*"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### Enable Web Analytics (Pro Feature)

1. Go to project in Vercel dashboard
2. Click **"Analytics"** tab
3. Click **"Enable"** button
4. Analytics are injected automatically
5. View real-time data in dashboard

**Metrics Available**:
- Page views
- Unique visitors
- Top pages
- Referrers
- Devices & browsers
- Geographic distribution

---

## 🔄 Part 4: Continuous Deployment

### Automatic Deployments

Vercel automatically deploys when you push to GitHub:

**Production Deployments** (main branch):
```bash
git add .
git commit -m "Update feature"
git push origin main
# Vercel automatically deploys to production
```

**Preview Deployments** (other branches):
```bash
git checkout -b feature-branch
git add .
git commit -m "Test new feature"
git push origin feature-branch
# Vercel creates preview URL: https://onchain-scanner-git-feature-branch.vercel.app
```

**Pull Request Previews**:
- Create PR on GitHub
- Vercel bot comments with preview URL
- Test changes before merging
- Preview updates on every commit

### Deployment Settings

Configure in **Settings → Git**:

- **Production Branch**: `main` (default)
- **Automatic Deployments**: Enabled (recommended)
- **Deploy Hooks**: Create webhooks for manual triggers
- **Ignored Build Step**: Skip builds conditionally

**Example - Skip builds for docs changes**:
```bash
# In Settings → Git → Ignored Build Step
git diff HEAD^ HEAD --quiet . ':!*.md'
```

### Rollback to Previous Deployment

1. Go to **"Deployments"** tab
2. Find working deployment
3. Click **"..."** menu → **"Promote to Production"**
4. Confirm promotion
5. Instant rollback (no rebuild needed)

---

## 📊 Part 5: Monitoring & Analytics

### Deployment Logs

**Access Build Logs**:
1. Go to **"Deployments"** tab
2. Click on any deployment
3. View real-time build output
4. Check for errors or warnings

**Log Levels**:
- Info: Build steps
- Warning: Non-critical issues
- Error: Build failures

### Runtime Logs

**View Function Logs** (Serverless functions if any):
1. Go to deployment details
2. Click **"Functions"** tab
3. Select function to view logs
4. Real-time streaming available

### Performance Monitoring

**Built-in Metrics** (always available):
- Total bandwidth usage
- Function invocations
- Build minutes used
- Team member activity

**Web Analytics** (Pro plan):
- Real-time visitor data
- Page performance
- User journey tracking
- Custom events

**Speed Insights** (Pro plan):
- Core Web Vitals
- Performance scores
- Suggestions for optimization

---

## 🐛 Part 6: Troubleshooting

### Issue: Build Fails

**Common Causes**:
1. TypeScript errors
2. Missing dependencies
3. Environment variables not set
4. Build timeout (Free tier: 30s, Pro: 45 minutes)

**Solutions**:
```bash
# Check build locally first
npm run build

# If it works locally but fails on Vercel:
# - Check all dependencies are in package.json
# - Verify environment variables are set
# - Check for platform-specific code
```

### Issue: Environment Variables Not Loading

**Cause**: Variables without `NEXT_PUBLIC_` prefix

**Solution**: All client-side variables MUST start with `NEXT_PUBLIC_`

✅ Correct:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
```

❌ Wrong:
```env
SUPABASE_URL=https://xxx.supabase.co
```

### Issue: Site Shows 404

**Causes**:
- Wrong root directory
- Build output directory incorrect
- Routing misconfiguration

**Solutions**:
1. Verify **Root Directory** is `./`
2. Verify **Output Directory** is `.next`
3. Check Next.js pages are in `/app` or `/pages` directory

### Issue: Authentication Not Working

**Causes**:
- Supabase redirect URL not configured
- Wrong Supabase credentials
- CORS issues

**Solutions**:
1. Add Vercel URL to Supabase redirect URLs:
   - Supabase Dashboard → Authentication → URL Configuration
   - Add: `https://onchain-scanner.vercel.app/auth/callback`
   - Add: `https://*.vercel.app/auth/callback` (for previews)
2. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Check browser console for errors

### Issue: Slow Performance

**Causes**:
- Large bundle size
- Unoptimized images
- Missing caching headers
- Too many API calls

**Solutions**:
1. **Optimize Bundle**:
   ```bash
   # Analyze bundle size
   npm install -D @next/bundle-analyzer
   ```
   
2. **Optimize Images**: Use Next.js `<Image>` component
   
3. **Enable ISR** (Incremental Static Regeneration):
   ```javascript
   // In page component
   export const revalidate = 60; // Revalidate every 60 seconds
   ```

4. **Use SWR** for data fetching (built-in caching)

### Issue: CORS Errors

**Cause**: Backend not allowing Vercel domain

**Solution**: Update backend CORS settings:
```javascript
// Backend CORS configuration
app.enableCors({
  origin: [
    'https://onchain-scanner.vercel.app',
    'https://*.vercel.app', // Allow all preview deployments
    'http://localhost:5176' // Local development
  ],
  credentials: true
});
```

---

## 💰 Part 7: Pricing & Limits

### Free Tier (Hobby)

**Includes**:
- ✅ Unlimited deployments
- ✅ 100 GB bandwidth/month
- ✅ 100 GB-hours serverless function execution
- ✅ Automatic HTTPS
- ✅ Preview deployments
- ✅ Custom domains
- ✅ 1 concurrent build
- ✅ Community support

**Perfect for**:
- Personal projects
- Portfolios
- Side projects
- Testing and staging

### Pro Tier ($20/month)

**Includes everything in Free, plus**:
- ✅ 1 TB bandwidth/month
- ✅ 1000 GB-hours serverless execution
- ✅ Web Analytics
- ✅ Speed Insights
- ✅ Password protection
- ✅ 3 concurrent builds
- ✅ Advanced monitoring
- ✅ Email support
- ✅ Team collaboration

**Best for**:
- Production applications
- Business projects
- Team collaboration
- Advanced monitoring needs

### Enterprise (Custom pricing)

**Includes**:
- ✅ Everything in Pro
- ✅ Custom contracts
- ✅ SSO/SAML
- ✅ Advanced security
- ✅ SLA guarantee
- ✅ Dedicated support
- ✅ Custom regions

**Bandwidth Overage**:
- Free tier: Site disabled when exceeded
- Pro tier: $40 per 100 GB over limit

---

## 🔒 Part 8: Security Best Practices

### Environment Variables

**✅ Do**:
- Use Vercel's environment variable system
- Separate dev/preview/production variables
- Use `NEXT_PUBLIC_` prefix only when necessary
- Rotate secrets regularly

**❌ Don't**:
- Commit `.env.local` to Git (already in .gitignore)
- Expose sensitive keys to client
- Use same keys across environments

### HTTPS & SSL

- ✅ Automatic HTTPS for all deployments
- ✅ Free SSL certificates via Let's Encrypt
- ✅ Automatic certificate renewal
- ✅ HTTP to HTTPS redirect enabled by default

### Security Headers

Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=31536000; includeSubDomains"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ]
}
```

### DDoS Protection

Vercel provides built-in DDoS protection:
- ✅ Rate limiting
- ✅ Traffic anomaly detection
- ✅ Automatic mitigation
- ✅ Edge network distribution

### Supabase Security

1. **Row Level Security**: Enable on all tables
2. **Anon Key**: Safe for client-side (limited permissions)
3. **Service Role Key**: Never expose to frontend
4. **Redirect URLs**: Whitelist only your domains

---

## 🎯 Part 9: Optimization Tips

### Image Optimization

Use Next.js Image component:
```jsx
import Image from 'next/image'

<Image 
  src="/logo.png"
  width={500}
  height={300}
  alt="Logo"
  priority // For above-the-fold images
/>
```

**Benefits**:
- Automatic WebP/AVIF conversion
- Lazy loading
- Responsive sizes
- Blur placeholder

### Code Splitting

Next.js automatically code-splits by route. For additional optimization:

```jsx
// Dynamic imports for heavy components
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <LoadingSpinner />,
  ssr: false // Client-side only if needed
})
```

### Caching Strategy

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}
```

### Font Optimization

Use Next.js Font Optimization:
```jsx
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

---

## 📋 Part 10: Deployment Checklist

### Pre-Deployment

- [ ] Code pushed to GitHub
- [ ] All dependencies in package.json
- [ ] Supabase project created
- [ ] Supabase OAuth configured (if using)
- [ ] Environment variables documented
- [ ] .env.local not committed
- [ ] Build succeeds locally: `npm run build`
- [ ] App runs locally: `npm start`

### Deployment

- [ ] Vercel account created
- [ ] GitHub repository connected
- [ ] Project imported to Vercel
- [ ] Environment variables added
- [ ] Production deployment successful
- [ ] No build errors in logs

### Post-Deployment

- [ ] Site accessible at Vercel URL
- [ ] Homepage loads correctly
- [ ] Authentication works (signup/login)
- [ ] Google OAuth works (if configured)
- [ ] Theme switching functional
- [ ] Credit store opens
- [ ] Responsive on mobile
- [ ] No console errors
- [ ] Backend connection verified
- [ ] Custom domain configured (optional)
- [ ] SSL certificate active
- [ ] Performance acceptable

---

## 🚀 Quick Start Summary

### 5-Minute Deployment

1. **Sign up**: https://vercel.com (use GitHub)
2. **Import project**: New → Import Git Repository
3. **Select repo**: `Dual_Scanning_Modes`
4. **Add environment variables**:
   ```
   NEXT_PUBLIC_BACKEND_URL=your_backend_url
   NEXT_PUBLIC_TREASURY_WALLET=your_wallet
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```
5. **Deploy**: Click "Deploy" button
6. **Done**: Visit `https://your-app.vercel.app` ✨

---

## 📞 Support Resources

### Official Documentation
- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel CLI](https://vercel.com/docs/cli)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

### Community Support
- [Vercel Community](https://github.com/vercel/vercel/discussions)
- [Next.js Discord](https://discord.gg/nextjs)
- [Vercel Support](https://vercel.com/support)

### Project Documentation
- [README.md](README.md) - Project overview
- [SUPABASE_MIGRATION_SUMMARY.md](SUPABASE_MIGRATION_SUMMARY.md) - Supabase setup
- [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md) - Render alternative

---

## 🎉 Success!

Your OnChain Alpha Scanner is now live on Vercel!

**Your URLs**:
- 🌐 **Production**: `https://onchain-scanner.vercel.app`
- 📊 **Dashboard**: https://vercel.com/dashboard

**Next Steps**:
1. Configure Supabase authentication
2. Test all features end-to-end
3. Add custom domain (optional)
4. Enable Analytics (upgrade to Pro)
5. Monitor performance and usage

---

**Last Updated**: July 27, 2026  
**Platform**: Vercel  
**Framework**: Next.js 15  
**Status**: Production Ready ✅
# 🔧 Render Deployment Troubleshooting

Common issues and solutions for deploying to Render.

---

## ✅ **Issue FIXED: Cannot find module 'tailwindcss'**

### **Error Message**:
```
Error: Cannot find module 'tailwindcss'
Require stack:
- /opt/render/project/src/node_modules/next/dist/build/webpack/config/blocks/css/plugins.js
```

### **Root Cause**:
Render doesn't install `devDependencies` in production builds. TailwindCSS, PostCSS, and Autoprefixer were in `devDependencies` but are needed for the build.

### **Solution** ✅:
Moved build-time dependencies to `dependencies`:
- `tailwindcss`
- `postcss`
- `autoprefixer`
- `typescript`

**Status**: **FIXED** in commit `8d282f7`

---

## 🚀 **How to Deploy After Fix**

### **Automatic Deployment** (Recommended):
Since you have auto-deploy enabled, Render will automatically detect the new commit and redeploy.

**Check Status**:
1. Go to https://dashboard.render.com
2. Select your service
3. Check **"Deployments"** tab
4. Latest commit `8d282f7` should be deploying

### **Manual Deployment** (If needed):
1. Go to your service in Render dashboard
2. Click **"Manual Deploy"** dropdown (top right)
3. Select **"Deploy latest commit"**
4. Click **"Deploy"**

**Build Time**: 5-8 minutes

---

## 📋 **Other Common Render Issues**

### **Issue: Build Timeout**

**Error**: Build exceeded time limit

**Causes**:
- Large dependencies
- Free tier timeout (15 minutes)
- Network issues

**Solutions**:
1. **Optimize dependencies**:
   ```bash
   # Remove unused packages
   npm prune
   
   # Update package-lock.json
   npm install
   ```

2. **Use build cache** (Starter plan):
   - Upgrade to Starter ($7/mo)
   - Much faster builds with caching

3. **Split build command**:
   ```bash
   # In Render dashboard
   Build Command: npm ci && npm run build
   ```

### **Issue: Port Binding Error**

**Error**: Application failed to respond

**Cause**: App not listening on correct port

**Solution**: Verify `package.json` start script:
```json
{
  "scripts": {
    "start": "next start -p ${PORT:-3000}"
  }
}
```

✅ **Already fixed** in your project!

### **Issue: Environment Variables Not Loading**

**Error**: App crashes, "undefined" values

**Causes**:
- Variables not set in Render
- Typo in variable name
- Missing `NEXT_PUBLIC_` prefix

**Solutions**:
1. **Check Render Dashboard**:
   - Go to **Environment** tab
   - Verify all 4 variables are set:
     - `NEXT_PUBLIC_BACKEND_URL`
     - `NEXT_PUBLIC_TREASURY_WALLET`
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Verify variable names**:
   - ✅ `NEXT_PUBLIC_SUPABASE_URL`
   - ❌ `SUPABASE_URL` (missing prefix)

3. **Redeploy after adding variables**:
   - Changes require redeploy
   - Click "Manual Deploy" → "Deploy latest commit"

### **Issue: "npm ERR! Missing script: build"**

**Error**: Build fails with missing script error

**Cause**: Incorrect build command

**Solution**: Ensure `package.json` has:
```json
{
  "scripts": {
    "build": "next build"
  }
}
```

✅ **Already correct** in your project!

### **Issue: Cold Start Takes Too Long**

**Symptoms**: First request after inactivity takes 30-60 seconds

**Cause**: Free tier spins down after 15 minutes of inactivity

**Solutions**:
1. **Upgrade to Starter** ($7/mo):
   - Always-on
   - No cold starts
   - Better performance

2. **Keep service warm** (Free tier workaround):
   - Use [UptimeRobot](https://uptimerobot.com) (free)
   - Ping your site every 5-10 minutes
   - Prevents spin-down

3. **Accept cold starts**:
   - Acceptable for development/staging
   - Users wait 30-60s on first visit

### **Issue: "ECONNREFUSED" Backend Connection**

**Error**: Cannot connect to backend API

**Causes**:
- Backend URL incorrect
- Backend not deployed
- CORS not configured

**Solutions**:
1. **Verify Backend URL**:
   ```env
   NEXT_PUBLIC_BACKEND_URL=https://dual-scanning-modes.onrender.com
   ```

2. **Check backend is running**:
   - Visit backend URL in browser
   - Should return API response

3. **Configure CORS on backend**:
   ```javascript
   // Backend CORS config
   app.enableCors({
     origin: [
       'https://your-frontend.onrender.com',
       'http://localhost:5176'
     ],
     credentials: true
   });
   ```

### **Issue: Supabase Authentication Fails**

**Error**: Login/signup doesn't work

**Causes**:
- Redirect URL not configured
- Wrong Supabase credentials
- Supabase project not set up

**Solutions**:
1. **Add Render URL to Supabase**:
   - Go to Supabase Dashboard
   - **Authentication** → **URL Configuration**
   - Add: `https://your-app.onrender.com/auth/callback`

2. **Verify credentials**:
   - Check `NEXT_PUBLIC_SUPABASE_URL`
   - Check `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy from Supabase Dashboard → Settings → API

3. **Enable Email provider**:
   - Supabase Dashboard
   - **Authentication** → **Providers**
   - Enable **Email** provider

### **Issue: Build Succeeds But App Crashes**

**Error**: Build passes but service won't start

**Causes**:
- Runtime errors
- Missing environment variables
- Port binding issues

**Solutions**:
1. **Check Runtime Logs**:
   - Dashboard → **Logs** tab
   - Look for startup errors
   - Check for missing variables

2. **Test locally first**:
   ```bash
   npm run build
   npm start
   # Should work locally before deploying
   ```

3. **Check Node version compatibility**:
   - Render uses Node 24.14.1 by default
   - Specify version if needed (`.node-version` file)

---

## 🔍 **Debugging Steps**

### **Step 1: Check Build Logs**
1. Dashboard → Your service
2. **Deployments** tab
3. Click failed deployment
4. Review entire build log
5. Look for first error (usually root cause)

### **Step 2: Check Runtime Logs**
1. Dashboard → Your service
2. **Logs** tab
3. Filter by "Application Logs"
4. Look for startup errors
5. Check for environment variable issues

### **Step 3: Verify Configuration**
```bash
# Check package.json scripts
cat package.json | grep scripts -A 5

# Verify dependencies
cat package.json | grep dependencies -A 20

# Check environment variables in Render dashboard
```

### **Step 4: Test Locally**
```bash
# Install dependencies
npm install

# Build project
npm run build

# Start production server
npm start

# Should work locally before deploying
```

### **Step 5: Review Render Dashboard**
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment**: `Node`
- **Node Version**: 24.14.1 (or compatible)
- **Environment Variables**: All 4 set

---

## 📊 **Build Success Checklist**

After your fix, verify:

- [ ] Build completes without errors
- [ ] No "Cannot find module" errors
- [ ] Service starts successfully
- [ ] Homepage loads (visit your Render URL)
- [ ] Environment variables accessible
- [ ] Authentication works
- [ ] Theme switching works
- [ ] No console errors in browser

---

## 🎯 **Current Build Status**

### **✅ Fixed Issues**:
1. ✅ `tailwindcss` missing - Moved to dependencies
2. ✅ `postcss` missing - Moved to dependencies
3. ✅ `autoprefixer` missing - Moved to dependencies
4. ✅ `typescript` missing - Moved to dependencies

### **🔄 Expected Result**:
Your next deployment should succeed! 🎉

**Build Log Should Show**:
```
==> Running build command 'npm install && npm run build'...
added 481 packages, and audited 482 packages in 8s
✓ Creating an optimized production build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Collecting page data
✓ Generating static pages
✓ Finalizing page optimization
==> Build succeeded!
==> Starting service with 'npm start'...
Ready on http://0.0.0.0:10000
```

---

## 🚀 **Next Deployment**

### **Auto-Deploy** (If Enabled):
- Render detects new commit automatically
- Starts build within 1-2 minutes
- Check **Deployments** tab for status

### **Manual Deploy**:
1. Dashboard → Your service
2. **"Manual Deploy"** → **"Deploy latest commit"**
3. Monitor build logs
4. Should succeed this time! ✅

---

## 📞 **Still Having Issues?**

### **Get Help**:
1. **Check Render Status**: https://status.render.com
2. **Render Community**: https://community.render.com
3. **Render Docs**: https://render.com/docs/troubleshooting-deploys
4. **Next.js Docs**: https://nextjs.org/docs/deployment

### **Common Next.js + Render Resources**:
- [Deploying Next.js on Render](https://render.com/docs/deploy-nextjs-app)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Render Node.js Guide](https://render.com/docs/deploy-node-express-app)

---

## ✅ **Summary**

**Problem**: TailwindCSS missing during build  
**Cause**: Build dependencies in wrong section  
**Solution**: Moved to `dependencies`  
**Status**: **FIXED** ✅  
**Action**: Wait for auto-deploy or trigger manual deploy  
**Expected**: Build succeeds, app goes live! 🎉

Your next deployment should work perfectly! 🚀
# Deployment Guide - Vercel + MongoDB Atlas

## Architecture

```
React Frontend (Vercel)
       ↓
Node.js API (Vercel Serverless Functions)
       ↓
MongoDB Atlas (Cloud Database)
```

## Prerequisites

- GitHub account
- Vercel account (free)
- MongoDB Atlas account (free)
- GoDaddy domain (optional)

## Step 1: Push Code to GitHub

1. Initialize Git repository (if not already):
```bash
git init
git add .
git commit -m "Initial commit with MongoDB and security"
```

2. Create repository on GitHub
3. Push your code:
```bash
git remote add origin https://github.com/yourusername/pathology-app.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy Frontend to Vercel

1. Go to https://vercel.com
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click "Deploy"

Your frontend will be deployed at: `https://your-app.vercel.app`

## Step 3: Configure Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Click **Settings** → **Environment Variables**
3. Add the following variables:

| Name | Value |
|------|-------|
| `MONGODB_URI` | Your MongoDB Atlas connection string |
| `JWT_SECRET` | Generate a strong random string (see below) |
| `FRONTEND_URL` | https://patholabpro.online |

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**MongoDB Atlas Connection String:**
```
mongodb://admin:admin8118@ac-yyrjnud-shard-00-00.sij25zs.mongodb.net:27017,ac-yyrjnud-shard-00-01.sij25zs.mongodb.net:27017,ac-yyrjnud-shard-00-02.sij25zs.mongodb.net:27017/PathoLabDB?ssl=true&replicaSet=atlas-brasg8-shard-0&authSource=admin&appName=PathLabPro
```

## Step 4: Redeploy with Environment Variables

1. After adding environment variables, go to **Deployments**
2. Click the three dots next to latest deployment
3. Click **Redeploy**

## Step 5: Update Frontend API URL

The API will be available at the same Vercel URL as your frontend.

Update your frontend code to use the production API URL:

**For development (localhost):**
```javascript
const API_URL = 'http://localhost:5000';
```

**For production (Vercel):**
```javascript
const API_URL = window.location.origin; // Uses same domain
```

Or use environment variable:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
```

Add to `.env` in frontend:
```env
VITE_API_URL=https://your-app.vercel.app
```

## Step 6: Configure Custom Domain (GoDaddy)

### Option A: Use Vercel's Domain (Free)
Your app is already accessible at: `https://your-app.vercel.app`

### Option B: Use GoDaddy Domain

Your domain: **patholabpro.online**

1. In Vercel Dashboard → **Settings** → **Domains**
2. Click **Add Domain**
3. Enter: `patholabpro.online`
4. Vercel will show DNS records to add

### Add DNS Records in GoDaddy for patholabpro.online:

1. Log in to GoDaddy
2. Go to **My Products** → **DNS Management**
3. Add these records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| CNAME | www | cname.vercel-dns.com | 600 |
| A | @ | 76.76.21.21 | 600 |

5. Wait for DNS propagation (5-30 minutes)
6. Your app will be accessible at: `https://patholabpro.online`

## Step 7: Update MongoDB Atlas IP Whitelist

After deployment, you may need to whitelist Vercel's IP addresses or use "Allow Access from Anywhere" (0.0.0.0/0) in MongoDB Atlas Network Access.

## Testing the Deployment

1. **Health Check:**
   ```
   https://patholabpro.online/api/health
   ```
   Should return: `{"status":"ok"}`

2. **Login Test:**
   ```bash
   curl -X POST https://patholabpro.online/api/auth/login \
   -H "Content-Type: application/json" \
   -d '{"email":"admin@pathlab.com","password":"admin123"}'
   ```

3. **Frontend Test:**
   Open https://patholabpro.online in browser and test all features

## Important Notes

### Security
- ✅ Passwords are hashed with bcrypt
- ✅ JWT tokens for authentication
- ✅ Rate limiting enabled
- ✅ Security headers with Helmet
- ✅ CORS configured

### Environment Variables
- Never commit `.env` file to Git
- Use Vercel environment variables for production
- Generate a strong JWT_SECRET for production

### MongoDB Atlas
- Free tier: 512MB storage
- Automatic backups included
- Accessible from anywhere
- Monitor usage in Atlas dashboard

### Vercel Free Tier
- 100GB bandwidth per month
- Unlimited deployments
- Automatic SSL certificates
- Global CDN

## Troubleshooting

**API not working:**
- Check environment variables in Vercel
- Verify MongoDB connection string
- Check Vercel deployment logs

**Frontend not loading:**
- Check build logs in Vercel
- Verify build command is correct
- Check console for errors

**CORS errors:**
- Verify FRONTEND_URL matches your Vercel domain
- Check CORS configuration in api/index.js

**MongoDB connection errors:**
- Verify IP is whitelisted in Atlas
- Check connection string format
- Verify database user credentials

## Cost Summary

| Service | Cost |
|---------|------|
| Vercel (Frontend) | Free |
| Vercel (Serverless) | Free |
| MongoDB Atlas | Free (512MB) |
| GoDaddy Domain | ~$10-15/year (optional) |

**Total: Free (or ~$10-15/year with custom domain)**

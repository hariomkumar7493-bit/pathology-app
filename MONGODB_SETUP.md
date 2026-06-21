# MongoDB Atlas Setup Guide

## Step 1: Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Try Free" or "Sign Up"
3. Create an account (free tier includes 512MB storage)

## Step 2: Create a Cluster

1. After logging in, click "Build a Database"
2. Choose "M0" (Free tier) or select a paid tier if needed
3. Select a cloud provider (AWS, Google Cloud, or Azure)
4. Choose a region closest to your users
5. Name your cluster (e.g., "PathologyApp")
6. Click "Create"

## Step 3: Create Database User

1. Go to "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Enter username and password (save these!)
5. Select "Read and write to any database"
6. Click "Add User"

## Step 4: Whitelist IP Address

1. Go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. Choose "Allow Access from Anywhere" (0.0.0.0/0) for development
4. For production, add your server's specific IP
5. Click "Confirm"

**Your current IP to whitelist: 106.222.249.102/32**

## Step 5: Get Connection String

1. Go to "Database" in the left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Select Node.js version
5. Copy the connection string (it looks like: `mongodb+srv://username:password@cluster.mongodb.net/...`)

**If DNS resolution fails (ECONNREFUSED error):**
- Click "Connect" → "Connect via MongoDB Shell"
- Copy the connection string shown there (starts with `mongodb://` not `mongodb+srv://`)
- This direct connection format bypasses DNS SRV resolution

## Step 6: Update Environment Variables

1. Create a `.env` file in the `server` directory
2. Add your MongoDB connection string:

```env
MONGODB_URI=mongodb+srv://your_username:your_password@cluster0.xxxxx.mongodb.net/PathoLabDB?retryWrites=true&w=majority
PORT=5000
```

Replace:
- `your_username` with your Atlas username
- `your_password` with your Atlas password
- `cluster0.xxxxx` with your cluster name

## Step 7: Run Data Migration

### Option A: If you have local MongoDB installed first

1. Install MongoDB Community Server locally
2. Run migration to local MongoDB:
```bash
cd server
npm run migrate
```
3. Test with local MongoDB
4. Then export/import to Atlas (see below)

### Option B: Direct migration to Atlas

1. Update `.env` with your Atlas connection string
2. Run migration:
```bash
cd server
npm run migrate
```

## Step 8: Deploy to Hosting

### For Vercel/Netlify (Frontend) + Render/Railway (Backend)

**Backend Deployment (Render/Railway):**

1. Push your code to GitHub
2. Go to https://render.com or https://railway.app
3. Create a new Web Service
4. Connect your GitHub repository
5. Set build command: `cd server && npm install`
6. Set start command: `cd server && npm start`
7. Add environment variable: `MONGODB_URI` (your Atlas connection string)
8. Deploy

**Frontend Deployment (Vercel/Netlify):**

1. Push your code to GitHub
2. Go to https://vercel.com or https://netlify.com
3. Import your repository
4. Update API URL in frontend to point to your backend URL
5. Deploy

### For Single Platform (Railway/Render)

Both frontend and backend can be deployed on the same platform using monorepo setup.

## Step 9: Post-Migration Cleanup

After successful migration and testing, you can remove MSSQL dependencies:

1. Edit `server/package.json` and remove:
   - `"mssql": "^10.0.2"`
   - `"msnodesqlv8": "^5.2.0"`

2. Delete `server/migrate.js` (optional)

3. Run `npm install` to update dependencies

## Troubleshooting

**Connection Error:**
- Check IP whitelist in Atlas Network Access
- Verify username/password in connection string
- Ensure cluster is created and running

**Migration Error:**
- Ensure MSSQL server is accessible
- Check MSSQL credentials in `migrate.js`
- Verify MongoDB connection string is correct

**Performance Issues:**
- Consider adding indexes to MongoDB collections
- Use MongoDB Atlas performance monitoring
- Scale up cluster if needed (paid tiers)

## Security Best Practices

1. Never commit `.env` file to Git
2. Use strong passwords for MongoDB users
3. Restrict IP access in production
4. Enable MongoDB Atlas encryption
5. Use Atlas Data Explorer to manage data
6. Enable MongoDB Atlas backups

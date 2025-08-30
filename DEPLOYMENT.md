# Cloud Deployment Guide

Your paper trading platform is now configured for full cloud deployment on Vercel with no need for local services.

## Prerequisites

1. **GitHub Account** - Push your code to GitHub
2. **Vercel Account** - Sign up at vercel.com
3. **Supabase Account** - Sign up at supabase.com for free PostgreSQL database

## Step 1: Set Up Cloud Database (Supabase)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **Settings** > **Database** 
3. Copy the **Connection string** (looks like: `postgresql://postgres:[YOUR-PASSWORD]@[HOST]:[PORT]/postgres`)
4. Save this for Step 3

## Step 2: Deploy Backend to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) and import your repository
3. Select the `apps/backend` folder as the root directory
4. Add these environment variables in Vercel:
   - `DATABASE_URL`: Your Supabase connection string from Step 1
   - `NODE_ENV`: `production`
   - `CORS_ORIGIN`: `*` (or your frontend URL after Step 3)

5. Deploy and copy the deployed URL (e.g., `https://your-backend.vercel.app`)

## Step 3: Deploy Frontend to Vercel

1. In Vercel, create a new project for the frontend
2. Select the `apps/web` folder as the root directory  
3. Add this environment variable:
   - `VITE_API_URL`: Your backend URL from Step 2
4. Deploy and your app will be live!

## Step 4: Initialize Database

After both deployments are live:

1. In your backend Vercel dashboard, go to **Functions** > **View Function Logs**
2. Trigger a migration by visiting: `https://your-backend.vercel.app/api/accounts`
3. Or run the seed script locally with your cloud database:
   ```bash
   DATABASE_URL="your-supabase-url" npm run db:seed
   ```

## Architecture

- **Frontend**: Static React app on Vercel Edge Network
- **Backend**: Serverless Node.js functions on Vercel
- **Database**: PostgreSQL on Supabase (free tier: 500MB)
- **No Docker**: Everything runs serverlessly in the cloud

## Environment Files

- `.env.example` - Template for local development
- `.env.production` - Production environment template (update with real URLs)

Your app will now run 24/7 without your computer being on!

## Monitoring

- **Backend logs**: Vercel Dashboard > Functions > View Logs
- **Database**: Supabase Dashboard > Database > Logs
- **Frontend**: Vercel Dashboard > Functions (if using server-side features)

## Costs

- **Vercel**: Free tier (100GB bandwidth/month)
- **Supabase**: Free tier (500MB storage, 2GB bandwidth)
- **Total monthly cost**: $0 for typical demo usage
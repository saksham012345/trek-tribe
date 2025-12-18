# 🚀 Deployment Checklist

Use this checklist to deploy the RAG system step by step.

## Pre-Deployment

- [ ] All code changes committed to Git
- [ ] Tests passing locally (optional)
- [ ] Documentation reviewed
- [ ] Environment variables prepared

## Step 1: Deploy AI Service on Render

- [ ] Created new web service on Render
- [ ] Named service: `trek-tribe-ai-service`
- [ ] Connected GitHub repository
- [ ] Set root directory: `ai-service`
- [ ] Set build command: `pip install -r rag_system/requirements.txt`
- [ ] Set start command: `uvicorn rag_system.app:app --host 0.0.0.0 --port $PORT`
- [ ] Generated secure API key:
  ```powershell
  -join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
  ```
- [ ] Added environment variables (see ENV_VARIABLES_QUICK_REF.md)
- [ ] Clicked "Create Web Service"
- [ ] Waited for deployment (5-10 minutes)
- [ ] Verified health check:
  ```bash
  curl https://trek-tribe-ai-service.onrender.com/health
  ```
- [ ] Noted service URL: `https://trek-tribe-ai-service.onrender.com`

## Step 2: Update Backend on Render

- [ ] Opened `trek-tribe-38in` service settings
- [ ] Added `RAG_SERVICE_URL=https://trek-tribe-ai-service.onrender.com`
- [ ] Added `RAG_API_KEY=<same-key-as-ai-service>`
- [ ] Added `RAG_ENABLED=true`
- [ ] Saved changes
- [ ] Waited for auto-restart
- [ ] Verified health check:
  ```bash
  curl https://trek-tribe-38in.onrender.com/api/ai/rag/health
  ```

## Step 3: Update Frontend on Vercel

- [ ] Opened `trek-tribe` project settings
- [ ] Went to Environment Variables
- [ ] Added `REACT_APP_RAG_ENABLED=true`
- [ ] Added `REACT_APP_AI_SERVICE_URL=https://trek-tribe-ai-service.onrender.com`
- [ ] Saved changes

## Step 4: Push Code Changes

- [ ] Reviewed all changed files
- [ ] Committed with meaningful message
- [ ] Pushed to GitHub main branch:
  ```bash
  git push origin main
  ```
- [ ] Verified backend auto-deployed on Render
- [ ] Verified frontend auto-deployed on Vercel

## Step 5: Verify Deployment

### AI Service

- [ ] Health check returns 200:
  ```bash
  curl https://trek-tribe-ai-service.onrender.com/health
  ```
- [ ] Query returns answer:
  ```bash
  curl -X POST https://trek-tribe-ai-service.onrender.com/query \
    -H "Content-Type: application/json" \
    -H "X-API-Key: YOUR_KEY" \
    -d '{"query": "How do I create a trip?", "top_k": 3}'
  ```

### Backend

- [ ] Profile route works:
  ```bash
  curl https://trek-tribe-38in.onrender.com/profile/enhanced
  ```
- [ ] Support route works:
  ```bash
  curl -X POST https://trek-tribe-38in.onrender.com/api/support/human-agent/request
  ```
- [ ] RAG proxy works:
  ```bash
  curl https://trek-tribe-38in.onrender.com/api/ai/rag/health
  ```

### Frontend

- [ ] Site loads: https://trek-tribe.vercel.app
- [ ] Login works
- [ ] Profile page works (no 500 error)
- [ ] Chat widget opens
- [ ] Can send messages
- [ ] "Talk to human agent" works (no 404 error)

## Step 6: Integration Testing

- [ ] Logged in as organizer
- [ ] Asked in chat: "How do I create a trip?"
- [ ] Received 7-step guide
- [ ] Asked: "What are booking steps?"
- [ ] Received booking process
- [ ] Asked: "Tell me about CRM dashboard"
- [ ] Received dashboard features
- [ ] Clicked "Talk to human agent"
- [ ] Ticket created successfully
- [ ] Verified ticket in database

## Step 7: Performance Check

- [ ] First query completed in <5 seconds
- [ ] Subsequent queries in <3 seconds
- [ ] No errors in Render logs
- [ ] No errors in browser console
- [ ] All existing features still work

## Post-Deployment

- [ ] Updated internal documentation
- [ ] Notified team of new feature
- [ ] Set up monitoring alerts (optional)
- [ ] Scheduled follow-up review (1 week)

## Rollback Plan

If something goes wrong:

1. **AI Service Issues:**
   - [ ] Delete/pause trek-tribe-ai-service on Render
   - [ ] Remove RAG env vars from backend
   - [ ] Frontend will fall back to existing AI

2. **Backend Issues:**
   - [ ] Revert Git commit
   - [ ] Push to GitHub
   - [ ] Wait for auto-deploy

3. **Frontend Issues:**
   - [ ] Remove RAG env vars from Vercel
   - [ ] Redeploy previous version

## Success Criteria

All must be ✅ to consider deployment successful:

- [ ] No 500 errors on profile routes
- [ ] No 404 errors on support routes
- [ ] RAG service responds to queries
- [ ] Answers are accurate and relevant
- [ ] Response time < 5 seconds
- [ ] No breaking changes to existing features
- [ ] Ticket creation still works
- [ ] User satisfaction maintained

## Troubleshooting

If any check fails, see:
- [docs/COMPLETE_REPORT.md](COMPLETE_REPORT.md) - Full troubleshooting guide
- [docs/RAG_DEPLOYMENT.md](RAG_DEPLOYMENT.md) - Deployment details
- Render logs for specific errors
- Browser console for frontend issues

## Notes

Space for deployment notes:

```
Date: ___________
Deployed by: ___________
AI Service URL: ___________
Issues encountered: ___________
Resolution: ___________
```

---

**Total Time:** ~30 minutes  
**Difficulty:** Medium  
**Risk Level:** Low (graceful fallback)

✅ **Ready to deploy? Start with Step 1!**

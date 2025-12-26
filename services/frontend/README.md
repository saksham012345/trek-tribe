# services/frontend (Sandbox)

This folder contains a legacy/sandbox React app used for isolated development of payment flows and organizer pages. It is not part of the production deployment.

- Production frontend: `web`
- Deployment configs: `vercel.json` and `render.yaml` point to `web`
- Shared API base URL: controlled via `REACT_APP_API_URL`

If you need any component from here, migrate it into `web/src` and update imports. Otherwise, keep this folder for reference or remove it to avoid confusion.

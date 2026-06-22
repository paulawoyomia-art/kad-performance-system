# KAD Performance System — Pages deployment

## What this is
A React SPA deployed on Cloudflare Pages. Talks to your Worker API.

## One-time setup

### 1. Update the Worker with CORS
The updated `worker.bundled.js` already has CORS built in.
Deploy it via the Worker editor (paste and deploy) before setting up Pages.

### 2. Create the Pages project
- Cloudflare dashboard → **Pages → Create a project → Upload assets**
- Build the app locally first (you need Node for this step — do it once):
  ```
  npm install
  npm run build
  ```
  This creates a `dist/` folder.
- Upload the `dist/` folder contents when prompted.

### OR: Connect a GitHub repo (recommended for future updates)
- Push the `kad-ui` folder to a GitHub repo
- Pages → Create → Connect to Git → select the repo
- Build settings:
  - Framework preset: **Vite**
  - Build command: `npm run build`
  - Build output: `dist`

### 3. Add the environment variable
In the Pages project → **Settings → Environment variables → Add variable**:
- Name: `VITE_API_URL`
- Value: `https://kad-resource-utilization.paulawoyomia.workers.dev`

This tells the React app where your Worker lives.

### 4. Tell the Worker your Pages URL
In the Worker → **Settings → Variables → Add variable**:
- Name: `PAGES_ORIGIN`
- Value: your Pages URL (e.g. `https://kad-performance.pages.dev`)

This locks CORS to only allow your Pages app (rather than wildcard `*`).

### 5. Redeploy both
- Re-deploy the Worker (paste the bundle again, or just trigger a redeploy)
- Re-deploy Pages (it will pull the env var automatically)

## Local development
```
npm install
npm run dev
```
Vite proxies `/api/*` to your deployed Worker automatically, so you can
develop locally against the real database without any CORS issues.

## File structure
```
kad-ui/
  src/
    api/client.js       ← all API calls, one file
    auth/AuthContext.jsx ← session state, role helpers
    components/
      AppShell.jsx      ← sidebar, logo, nav, role badges
    views/
      LoginScreen.jsx       ← login with admin/employee toggle
      FirstLoginSetup.jsx   ← first-login password + recovery setup
      AdminDashboard.jsx    ← tabbed setup console (KADs → Allocations)
      StaffDashboard.jsx    ← employee portal + team view + flags
    App.jsx             ← routing: which view to show
    index.css           ← all design tokens and utility classes
    main.jsx            ← React entry point
  public/
    telinno-logo.png    ← the logo (white-inverted in the dark sidebar)
    _redirects          ← tells Pages to serve index.html for all routes
    _headers            ← security headers
  index.html
  vite.config.js
  package.json
```

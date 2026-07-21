# Rebuild branch — ready to upload

This is your full app, configured as the `rebuild` branch: the new Do/Track/
Report/More app is wired in as the operational default (src/App.jsx). Admin and
login are unchanged. It hits your SAME Worker + live database.

## Upload steps
1. On GitHub, create a branch called `rebuild` (from main).
2. Switch the branch selector to `rebuild`.
3. Upload the CONTENTS of this folder to the repo root, overwriting when asked.
   (Or upload just the changed files: all of src/, if unsure upload everything.)
   Commit to `rebuild` — never to main.
4. Cloudflare Pages auto-builds the branch → gives a preview URL like
   https://rebuild.kad-performance-system.pages.dev

## One required setting
In Cloudflare Pages → Settings → Environment variables, make sure VITE_API_URL
is set for the **Preview** environment (same Worker URL as Production). Without
it, the staging site builds but can't reach the backend.

## What you'll see
Log in with your no-hyphen HRBP email → lands on /app/do (the new split inbox).
Track/Report/More are stubs ("arrives in the next slice"). Admin unchanged.

## Safety
Same live DB — actions here are real writes. Fine to click around; avoid
confirming/accepting things you don't mean. Production `main` is untouched.

## Not included
node_modules and dist are intentionally excluded — Cloudflare installs and
builds them. Don't commit those.

# Live deploy status

## GitHub
https://github.com/deepakmaseeh/embed-video-downloader

## Render (live)

| Role | URL |
|------|-----|
| **API (backend)** | https://embed-downloader-api.onrender.com |
| **UI (frontend)** | https://embed-downloader-web.onrender.com |

Health: https://embed-downloader-api.onrender.com/health

Free Render services sleep after idle (~15 min). First request can take 30–60s.

## Vercel (UI alternative)

Vercel CLI login needs an interactive browser verification code on this machine, so the UI was also deployed on Render above.

To host the UI on Vercel instead/as well:

1. Open: https://vercel.com/new
2. Import `deepakmaseeh/embed-video-downloader`
3. **Root Directory:** `apps/web`
4. Env var: `NEXT_PUBLIC_API_URL` = `https://embed-downloader-api.onrender.com`
5. Deploy

Or from a terminal (after `vercel login`):

```powershell
cd apps/web
npx vercel --prod -e NEXT_PUBLIC_API_URL=https://embed-downloader-api.onrender.com
```

## Connect checklist

| Place | Variable | Value |
|-------|----------|--------|
| UI (Render or Vercel) | `NEXT_PUBLIC_API_URL` | `https://embed-downloader-api.onrender.com` |
| API (Render) | `FRONTEND_ORIGIN` | `*` (already set) or your exact UI origin |

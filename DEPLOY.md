# Deploy: Vercel (UI) + Render (API)

Yes — push this repo to GitHub, host **API on Render**, **UI on Vercel**, then connect with one env var.

## 1. GitHub

This folder is its own git repo (not the parent RMA project).

```powershell
cd downloder-video
git remote -v
```

## 2. Render (backend)

1. [Render](https://render.com) → **New** → **Blueprint** (uses `render.yaml`)  
   or **Web Service** → connect this GitHub repo  
   - **Root / Docker context:** `apps/api`  
   - **Dockerfile:** `apps/api/Dockerfile`
2. After deploy, copy the service URL, e.g. `https://embed-downloader-api.onrender.com`
3. Set env var:
   - `FRONTEND_ORIGIN` = your Vercel URL (e.g. `https://your-app.vercel.app`)
4. Optional: attach a **persistent disk** on `/app/downloads` so files survive restarts (paid plans). Free tier disk is ephemeral.

Health check: `GET /health`

## 3. Vercel (frontend)

1. [Vercel](https://vercel.com) → **Add New Project** → import this GitHub repo  
2. **Root Directory:** `apps/web`  
3. Framework: Next.js  
4. Environment variable:
   - `NEXT_PUBLIC_API_URL` = your Render URL (**no trailing slash**)  
     Example: `https://embed-downloader-api.onrender.com`
5. Deploy

## 4. Connect checklist

| Where | Variable | Value |
|-------|----------|--------|
| Vercel | `NEXT_PUBLIC_API_URL` | `https://….onrender.com` |
| Render | `FRONTEND_ORIGIN` | `https://….vercel.app` |

Then open the Vercel URL → Analyze → Download. Browser Save As and files live on the Render disk.

## Notes

- Render **free** services sleep after idle; first request can take ~30–60s.
- Large batch downloads need enough disk + a plan that allows long-running jobs.
- Do **not** commit `apps/api/downloads` (ignored; can be huge).
- Local Windows still works with `py -3.12 -m yt_dlp`; Docker/Render uses `python3 -m yt_dlp`.

# Abancool Travel — cPanel Deployment

This is a Vite + React SPA. Backend (database, auth, edge functions) runs on Lovable Cloud — cPanel only hosts the static frontend.

## 1. Build locally

```bash
npm install
npm run build
```

This produces a `dist/` folder.

## 2. Upload to cPanel

1. Log into cPanel → **File Manager**.
2. Open `public_html` (or your subdomain's docroot).
3. Upload **everything inside `dist/`** (not the `dist` folder itself) — including `index.html`, `assets/`, `favicon.png`, and `.htaccess`.
4. Make sure `.htaccess` is present (enable "Show hidden files" in File Manager settings if you don't see it).

## 3. SSL

Enable AutoSSL in cPanel → **SSL/TLS Status** → run AutoSSL on the domain. Once the certificate is active, edit `.htaccess` and uncomment the HTTPS redirect block.

## 4. Environment

The build already includes the public Supabase URL and anon key (safe to expose). No `.env` needed on the server.

## 5. Updating

Re-run `npm run build` and re-upload the contents of `dist/`. Old asset files in `assets/` can be left in place — Vite hashes filenames so cached clients still work.

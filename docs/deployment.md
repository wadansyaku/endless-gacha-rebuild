# Deployment

## Target

- Hosting は Cloudflare Pages を使う
- GitHub は `projects/endless-gacha` を独立 repo として接続する
- deploy artifact は `apps/web/dist`
- Pages project 名は `endless-gacha-rebuild` を使う

## Build

- install: `pnpm install`
- verify: `pnpm lint && pnpm typecheck && pnpm test:unit`
- build: `pnpm build`

## SPA Routing

- `BrowserRouter` を使っているため、Pages 側で SPA fallback が必要
- `apps/web/public/_redirects` に `/* /index.html 200` を置き、direct navigation を壊さない

## Environment Variables

- Cloud backup / leaderboard を使う場合だけ Firebase の browser env を設定する
- 必須候補:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
- 任意:
  - `VITE_FIREBASE_MEASUREMENT_ID`
  - `VITE_APP_URL`

## First Deploy

- Cloudflare Pages project name は `endless-gacha-rebuild`
- 初回 bootstrap は GitHub source を付けて Pages project を作る
- その後の one-off deploy として `wrangler pages deploy apps/web/dist --project-name endless-gacha-rebuild --branch main` を使える
- production branch は `main`

## GitHub Integration

- `projects/endless-gacha` を独立 git repo として扱う
- GitHub repo は `wadansyaku/endless-gacha-rebuild` を使う
- 初回 push 後、Pages project を GitHub source `wadansyaku/endless-gacha-rebuild` として作成済み

## Current Status

- GitHub: [wadansyaku/endless-gacha-rebuild](https://github.com/wadansyaku/endless-gacha-rebuild)
- Pages production domain: [endless-gacha-rebuild.pages.dev](https://endless-gacha-rebuild.pages.dev)
- Latest deployment URL: [112ddfaa.endless-gacha-rebuild.pages.dev](https://112ddfaa.endless-gacha-rebuild.pages.dev)

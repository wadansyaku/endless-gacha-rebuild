# Endless Gacha

`Endless Gacha` は、Google AI Studio 上で試作していた idle + gacha RPG を、
オフライン優先かつ versioned save / cloud backup 対応の構成で本格実装するための
独立 monorepo です。

## 原則

- 先に docs / ADR を更新し、その後に実装する
- ゲームルールは `packages/game-core` に閉じ込める
- コンテンツ定義は `packages/game-data` の JSON を source of truth にする
- UI は command API を呼ぶだけで、戦闘計算や進行計算を直接書かない
- Google ログインと Firestore は backup / leaderboard 用であり、gameplay の authority ではない
- single-player はローカルだけで完結可能に保つ

## ディレクトリ

- `apps/web`: React + Vite フロントエンド
- `packages/game-core`: pure reducer / command / selector
- `packages/game-data`: zod schema と JSON catalog
- `packages/firebase-adapter`: Firebase Auth / Firestore adapter
- `packages/shared`: 共通定数と共有 type
- `packages/ui`: 再利用 UI
- `docs`: architecture / design / ADR

## コマンド

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm dev
```

## Deploy

- Cloudflare Pages を想定しています
- 詳細は `docs/deployment.md`

## デプロイ

- 初回ターゲットは Cloudflare Pages
- 詳細は [docs/deployment.md](/Users/Yodai/Codex/projects/endless-gacha/docs/deployment.md)

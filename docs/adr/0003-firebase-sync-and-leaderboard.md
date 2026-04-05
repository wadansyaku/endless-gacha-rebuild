# ADR 0003: Firebase Sync And Leaderboard

## Status

Accepted

## Decision

- Firebase は optional adapter として使う
- Firestore の `saves/{uid}` に `VersionedSaveEnvelope`, `highestStage`, `displayName`, `updatedAt` を保存する
- leaderboard は `highestStage` を read するだけで、gameplay authority は持たない
- ログイン時に local save を自動上書きしない
- local と remote の進行 frontier は `lastProcessedAt` で比較する
- `updatedAt` は「クラウドへ upload された時刻」として UI に別表示する
- login 復元時も local save を自動上書きせず、user が upload / download を選ぶ

## Consequence

- single-player は常にローカルだけで継続できる
- backup と ranking を導入しても core を汚さない
- anti-cheat は Phase 2 へ切り出せる
- conflict UI の説明軸を `lastProcessedAt` と `updatedAt` で混同しにくくなる

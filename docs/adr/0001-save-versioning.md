# ADR 0001: Save Versioning

## Status

Accepted

## Decision

- localStorage と Firestore はともに `VersionedSaveEnvelope` を保存する
- save には `saveSchemaVersion`, `contentVersion`, `lastProcessedAt`, `snapshot` を必須で持たせる
- React component state の丸ごと保存は禁止する
- migration は `saveSchemaVersion` ベースで行い、`contentVersion` mismatch は warning と fallback 処理を分ける
- save 読込は strict parse を通し、壊れた save と migration 対象 save を区別する
- `contentVersion` は読込時に無条件で上書きしない
- schema v2 では expedition が `heroId` ではなく派遣中の `HeroInstance` を保持する

## Consequence

- local と cloud で同じ保存形式を使える
- save migration の責務が明確になる
- UI 変更が save を壊しにくい
- 読込失敗時に原因を特定しやすくなる
- expedition の所有権を保存形式でも一貫させられる

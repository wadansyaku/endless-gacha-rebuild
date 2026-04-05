# ADR 0002: Time Advancement And Offline Progress

## Status

Accepted

## Decision

- gameplay progression は `advanceSimulation(snapshot, now)` で進める
- core は wall clock を読まず、`lastProcessedAt` と `now` を入力として受ける
- offline progress は 24 時間で cap する
- daily reset は JST の日付切替で判定する
- expedition completion、boss timer、skill cooldown も同じ advancement で処理する

## Consequence

- offline reward と online 復帰時の整合性を保ちやすい
- テストで時間を固定できる
- `setInterval` に依存した UI 実装を避けられる

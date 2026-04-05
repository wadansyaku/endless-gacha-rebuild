# Architecture

## 目的

`Endless Gacha` は、縦持ち前提の idle / gacha RPG 体験をローカルだけでも成立させつつ、
将来的な cloud backup と leaderboard に耐える形で再構成する。

参照元の AI Studio 版は UI、進行、Firebase、保存、数式が単一コンポーネントに密結合していたため、
本リポジトリでは source of truth を package 単位で明確に分離する。

## Monorepo 構成

- `apps/web`
  - React Router による画面遷移
  - local save / cloud save conflict UI
  - command dispatch と selector 表示
- `packages/game-core`
  - versioned save schema
  - deterministic RNG
  - battle simulation
  - gacha / roster / meta progression
  - offline progress advancement
  - overflow inbox
- `packages/game-data`
  - heroes / enemies / missions / talents / artifacts / formations / expeditions / equipment tables の JSON
  - zod schema validation
- `packages/firebase-adapter`
  - Google sign-in
  - Firestore save / load
  - leaderboard read
- `packages/shared`
  - version constants
  - storage keys
  - shared domain enums
- `packages/ui`
  - route shell
  - summary cards
  - roster / inventory / progression widget

## 境界

- source of truth は `game-core` の `GameSnapshot`
- React は `advanceSimulation`, `tapEnemy`, `pullGacha`, `moveHero`, `mergeHeroes`,
  `levelHero`, `claimMission`, `prestige`, `dispatchExpedition`, `claimExpedition`,
  `equipItem`, `synthesizeEquipment` を呼ぶだけにする
- `Math.random()` と `Date.now()` は adapter 層でのみ使用し、core は注入された `rngState` と `now` で動く
- localStorage と Firestore はどちらも `VersionedSaveEnvelope` を保存し、React state を直接保存しない
- Firebase は gameplay authority にならず、offline play の可否に影響を与えない

## 画面責務

- `battle`: 敵進行、タップ、編成、即時行動
- `summon`: banner、pity、10-pull
- `progression`: upgrades、missions、prestige、talents、artifacts、formations
- `collection`: hero codex、awakenings
- `social`: login、cloud sync、leaderboard
- `settings`: local save reset、import/export、theme

## 保存と同期

- local save
  - `VersionedSaveEnvelope`
  - `saveSchemaVersion`, `contentVersion`, `lastProcessedAt`, `snapshot`
- cloud save
  - local と同 shape
  - 追加で `highestStage`, `displayName`, `updatedAt`
- login 時に自動上書きはしない
  - newer timestamp を比較し、upload / download / keep local を選択する

## オフライン進行

- `lastProcessedAt` と `now` の差分から simulation を進める
- 上限は 24 時間
- daily reset は JST 基準
- expedition completion と skill cooldown も同じ advancement で処理する

## 非目標

- server authoritative economy
- anti-cheat
- player-facing replay
- PvP

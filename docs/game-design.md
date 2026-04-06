# Game Design

## 作品方針

`Endless Gacha` は、ステージを押し上げながら編成とメタ進行を積み重ねる
single-player 向け idle / gacha RPG である。

元試作の良い部分である

- すぐ増える数字
- 3x3 編成の分かりやすさ
- ガチャ / 合成 / 転生の往復
- 縦持ちで完結する遊び

は維持しつつ、数式の一貫性、save 互換性、運用しやすいコンテンツ管理に寄せて再設計する。

## V1 機能マトリクス

| 機能 | V1 | 備考 |
| --- | --- | --- |
| battle progression | yes | idle tick + tap damage + boss timer |
| gacha | yes | normal / premium / pity |
| roster board / bench | yes | 3x3 board + bench + merge |
| hero leveling | yes | gold cost |
| missions | yes | daily / achievement |
| prestige | yes | permanent multiplier + talent points |
| talents | yes | persistent upgrades |
| artifacts | yes | shard gacha + direct upgrades |
| formations | yes | board pattern bonus |
| expeditions | yes | timed async reward |
| equipment | yes | boss drop + equip + synthesis |
| collection | yes | unlock + awakening + codex bonus |
| local save/load | yes | versioned save |
| Google login | yes | optional |
| cloud backup | yes | optional |
| leaderboard | yes | best-effort stage ranking |
| replay | no | Phase 2 |
| anti-cheat | no | Phase 2 |

## 体験優先で再設計する点

- 数式互換よりも一貫性を優先する
- UI overflow で報酬を silently drop しない
- save migration と contentVersion の整合を優先する
- 同じ情報を複数箇所で再計算しない
- leaderboards は別責務として切り出す

## コアループ

1. battle で stage を進める
2. gold / gems / equipment / shards を得る
3. summon, level, merge, equip, awaken で部隊を強くする
4. missions / prestige / talents / artifacts / formations でメタ成長する
5. expeditions と offline progress で不在時もリソースを得る
6. higher stage を leaderboard に残す

## 編成

- board: 3x3
- bench: 8 slot
- center slot は leader slot
- same hero + same star を merge
- overflow 時は inbox に退避

## バトル

- 常時 100ms tick 相当で進行
- enemy HP が 0 で次 stage
- boss は 10 stage ごと
- boss は time limit を持つ
- ボス失敗時は 1 stage 後退
- tap damage は battle 補助であり main source ではない

## 成長

- hero
  - rarity
  - level
  - star
  - awakening
  - equipment
- meta
  - upgrades
  - prestige multiplier
  - talents
  - artifacts
  - formations

## 収集と報酬

- normal summon: gold 消費、N-R-SR-SSR
- premium summon: gems 消費、R-SR-SSR-UR、pity あり
- boss drop: equipment / gems / artifact shards
- missions: daily と permanent achievement
- expeditions: idle 外報酬

## UX 原則

- mobile first
- route 分割で重い機能を分散
- battle を最短導線に置く
- progress 系は情報密度高めでも操作を単純に保つ
- cloud sync は確認付き

## UI / HUD 再設計方針

- UI は「SaaS ダッシュボード」ではなく「縦持ちのゲーム HUD」として組む
- 常設情報は上部 HUD と小さな signal rail に寄せ、中央のプレイフィールを優先する
- 各 route は equal-weight な複数カードではなく、1 つの主画面と 1 つの補助面を持つ
- 長文説明や低頻度操作は drawer / fold / compact list に逃がし、初期表示で全部開かない
- CTA は `packages/game-core` の selector を使って「必要資源」「次に増える値」「押せない理由」を明示する

## Route ごとの役割

- Battle
  - 主画面。enemy / board / reserve を最優先で見せる
  - onboarding も battle の中で完結させる
- Summon
  - 報酬演出面。banner の差、消費資源、直近獲得を強く見せる
- Progression
  - 管理画面ではなく war room として扱う
  - 「今回収できるもの」「次に伸ばす系統」「物流」を分離する
- Collection
  - codex / awakening の保管庫として静的に見せる
- Social / Settings
  - 補助機能。戦闘導線より前に出しすぎない

## UI State 供給原則

- React route は `full game context` を直接読むのではなく selector hook 経由で必要断面だけを購読する
- `actions` と `content` は安定参照に寄せ、battle tick ごとに再生成しない
- derived view は route 内で必要なものだけ計算し、未表示 section の list を常時 mount しない

## Progression Disclosure

- `War Room` は 1 枚の長い管理画面ではなく、`Urgent`, `Growth`, `Logistics`, `Archive` を切り替える command 面にする
- 初期表示は `Urgent`
- mobile では 1 section だけを見せ、desktop でも同時全展開を避ける

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

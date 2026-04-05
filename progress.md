Original prompt: 残っていることを実装しつつ、現状を深く分析し、批判的に吟味して、遊びながら確認できるようにしてください。

- 初期監査開始。現状の残課題は分析の明文化、プレイしながら検証できる QA 導線、ブラウザ操作での確認。
- docs 追加方針: `current-state-review.md` で現状批評を固定し、`playtest.md` で QA 導線を定義する。

- ブラウザ playtest 前。現在の気づき: 1) プレイ確認用の deterministic hook がない 2) QA 用の高速進行・資源注入導線がない 3) Settings は読込導線があるが reset / preset / state可視化が弱い。

- screenshot/state 取得確認。`render_game_to_text` は stage/resources/board/inventory/expedition を返している。次は preset と fast-forward を使った実プレイ検証。

- 設計修正を docs に反映。save 読込は strict parse + migration、派遣は `HeroInstance` 所有、conflict UI は progress frontier と upload 時刻を分離する方針に更新。

- 実装完了:
  - save schema を v2 に上げ、旧 expedition save の migration を追加
  - 壊れた save は黙って握りつぶさず `Save Notice` を出すように変更
  - expedition は bench の個体を所有し、帰還時に bench / overflow へ戻すよう変更
  - summon route に直近ガチャ結果カードを追加
  - battle route の overflow を折りたたみ表示に変更
  - Firebase の login 復元を追加
  - cloud conflict 表示を `lastProcessedAt` と `updatedAt` で分離
  - equip の inventory registry / bag order の扱いを修正
  - Midgame preset の overflow を 0 に抑える投入順へ調整

- 検証結果:
  - `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, `pnpm test:e2e` はすべて成功
  - 実ブラウザ確認で midgame preset は `stage 35`, `benchCount 4`, `inventoryCount 4`, `overflowCount 0`, `expeditionCount 2`

- 残留論点:
  - `GameProvider` は依然として大きく、route 単位の再描画境界はまだ粗い
  - `Progression` は情報密度が高く、Missions が縦に長い
  - lazy route の `Loading` fallback は一瞬見えるため、体感 polish 余地がある

- 次段:
  - `Progression` の mission 密度を下げる
  - route module の preload で `Loading` 露出を減らす
  - Cloudflare Pages 向け deploy 導線と GitHub 連携を整える

- 次ターン開始:
  - deploy 方針を `docs/deployment.md` に追加
  - GitHub は `projects/endless-gacha` を独立 repo として接続する前提に切り替え
  - 実装は `Progression` の mission 圧縮と nav prefetch を優先する

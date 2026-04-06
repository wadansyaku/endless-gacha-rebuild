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

- 追加実装:
  - `Progression` で mission を claimable / ongoing / done で圧縮表示
  - expedition は bench 個体を選んで dispatch できるように改善
  - route module を分離し、nav hover / focus で lazy route を preload
  - `apps/web/public/_redirects` を追加して Pages の SPA fallback を固定

- GitHub / Cloudflare:
  - `wadansyaku/endless-gacha-rebuild` へ `main` を初回 push
  - Cloudflare Pages project `endless-gacha-rebuild` を GitHub source 付きで作成
  - manual deploy を 1 回実行し、`https://0045a579.endless-gacha-rebuild.pages.dev` を取得
  - production domain `https://endless-gacha-rebuild.pages.dev` が `HTTP 200` を返すことを確認

- UI / UX 再設計:
  - `game-design.md` と `current-state-review.md` に「dashboard ではなく game HUD に寄せる」方針を追記
  - `AppShell` を header + equal-weight cards から、resource HUD / command dock / signal rail 構成へ変更
  - `Battle` は `Frontline` 面として再設計し、敵状況・前線 3x3・reserve・recovery queue を主従付きで整理
  - `Summon` は `Recruitment` 面として再設計し、banner ごとの差・費用・排出率・直近獲得を強く可視化
  - `Progression` は `War Room` として再設計し、urgent / growth / ascension / relay / forge の 5 面に再構成
  - CTA の費用表示は `packages/game-core` の selector export に寄せ、UI 側で独自計算しないよう調整
  - `packages/shared` の `EquipmentTierContent` に `synthesisTargetRarity` を追加し、data schema と型を整合

- 追加検証:
  - `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm build`, `pnpm test:e2e` は再度すべて成功
  - manual playtest は `http://127.0.0.1:4175` で実施
  - 証跡:
    - `output/playtest-manual/battle-frontline-redesign-20260406.png`
    - `output/playtest-manual/battle-midgame-redesign-20260406.png`
    - `output/playtest-manual/summon-redesign-after-pull-20260406.png`
    - `output/playtest-manual/progression-redesign-midgame-20260406.png`
    - `output/playtest-manual/ui-redesign-playtest-20260406.json`
  - midgame preset 後の snapshot は `stage 35`, `benchCount 4`, `inventoryCount 4`, `overflowCount 0`, `expeditionCount 2`
- 10 pull 後の snapshot は `benchCount 8`, `overflowCount 6` となり、recovery queue への退避導線を画面上で確認

- 深掘り改善:
  - `current-state-review.md` と `game-design.md` に、`GameProvider` の単一 context と `War Room` の disclosure 不足を追加で記録
  - `apps/web/src/lib/game-store.tsx` を external store + selector hook 構成へ変更し、`useGame()` に全断面 subscribe しなくても済む導線を追加
  - route 側は `useGameState`, `useGameSave`, `useGameActions`, `useGameBattle`, `useGameMissions`, `useGameHeroPlacements` へ分割して読ませるよう変更
  - `Progression` は section 全展開をやめ、`Urgent / Growth / Logistics / Archive` を tab 切替する command 面へ再設計
  - `styles.css` に section selector の visual language を追加

- 深掘り検証:
  - `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm build` は再度すべて成功
  - `output/playtest-manual/progression-urgent-section-20260406.png`
  - `output/playtest-manual/progression-growth-section-20260406.png`
  - `output/playtest-manual/progression-logistics-section-20260406.png`
  - `output/playtest-manual/progression-sections-playtest-20260406.json`
  - section 切替後に `Urgent Queue`, `Growth Tracks`, `Relay Bay / Forge Deck` がそれぞれ単独面として見えることを確認

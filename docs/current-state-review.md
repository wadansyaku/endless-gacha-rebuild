# Current State Review

## Review Date

- 2026-04-06

## 何が動いているか

- docs / ADR / monorepo の骨格は揃っている
- `packages/game-core` に battle / gacha / roster / prestige / expeditions / equipment の主要ルールが集約されている
- `packages/game-data` は JSON catalog + zod validate で読み込まれている
- `packages/firebase-adapter` は optional な Google login / cloud save / leaderboard を thin adapter として持つ
- `apps/web` は route split された SPA として最低限遊べる

## 高優先度の問題

### 1. 初回プレイの詰まりどころが強い

- battle 画面を開いた直後は board が空で、何をすべきかが分かりにくい
- summon 後も board への配置を理解しないと DPS が 0 のままになりやすい
- merge / formation / expedition の理解も route を跨いで初めて分かる

### 2. 検証しづらい

- 長時間の idle / expedition / boss / stage unlock を UI だけで確認するには時間がかかる
- deterministic な playtest hook がないため、ブラウザ自動検証と目視検証の両方がしづらい
- save import/export はあるが、reset / preset / time skip / stage jump がない

### 3. 現状の観測性が弱い

- 画面上で見えるのは一部の summary に限られ、現在の save / roster / mission / expedition 状態を横断して追いにくい
- `render_game_to_text` 相当のテキスト観測面がないため、Playwright から状態を安定して読み取りづらい

### 4. cloud 機能の重さが初期 bundle に漏れやすい

- Firebase は optional なのに、初期ロード時点で依存を引き込む設計だと client bundle が重くなる
- social route は lazy でも、store 初期化で adapter を同期 import すると分離効果が薄い

### 5. save/versioning の境界がまだ弱い

- `deserializeSave` が壊れた JSON と旧 schema を区別できないと、fallback で新規ゲームが始まり原因追跡が難しい
- `contentVersion` を読込時に即時上書きすると、mismatch 検知と migration 判断ができなくなる
- save 失敗を event / UI で見える形にしないと、検証と運用の両方で不透明になる

### 6. 派遣が「ヒーロー個体」を所有していない

- `heroId` ベースの派遣だと、戦闘中の同キャラをそのまま派遣できてしまう
- 同キャラ複数所持の差分が消え、編成・強化・装備の責務分離が崩れる
- V1 では派遣は bench 上の `HeroInstance` を持ち出す形へ揃える必要がある

### 7. 手応えの可視化が足りない

- ガチャ結果が route 上で見えないと、引いた報酬と roster 変化の対応が追いにくい
- overflow が大量に出た時に battle 画面を押し流すと、主導線の確認がしづらい
- cloud conflict も「進行時刻」と「upload 時刻」を混同すると説明が弱くなる

### 8. テストが危険箇所に届いていない

- shell 表示だけの E2E では summon result、overflow、save import、playtest preset の破綻を捕まえにくい
- core test も save migration、expedition ownership、equipment overflow の不変条件を踏めていない
- 画面から遊べるようにするだけでなく、その導線を自動化できる状態にしておく必要がある

### 9. 画面がゲーム HUD ではなく dashboard に寄りすぎている

- `Shell` の header / nav / sidebar / main が全部同じ重さで見え、主画面が立っていない
- Battle / Summon / Progression も同じ card 文法に揃いすぎて、画面ごとの気分転換と役割差が弱い
- 重要操作が row の右端ボタンに吸われ、reward や urgency よりも管理感が勝っている
- mission と expedition は存在しているが、「今やるべきこと」の面として収束していない
- cost や不足理由が押すまで分からず、手触りが command UI ではなく事務 UI に見える

### 10. `GameProvider` の単一 context が再描画境界を壊している

- `save`, `cloud`, `events`, `lastGachaResult` を 1 つの value に束ねているため、どの field が変わっても購読側が全更新される
- active route は battle tick によって 1 秒ごとに再描画され、必要ない cloud state 変更でも巻き込まれる
- V1 の規模なら動くが、今後 effect / animation / dense lists が増えるほど無駄な render が表面化する

### 11. `War Room` は整理されたが、まだ disclosure が弱い

- section を全部同時表示しているため、priority は改善しても route 全体の高さは依然として大きい
- mobile では `urgent` を見たいだけでも `growth` と `forge` まで同時に読む必要がある
- 「今処理する面」「育成を触る面」「物流を触る面」を切り替える command 面にした方がよい

## すぐ直す価値が高い方針

- battle 画面に onboarding と auto-deploy 導線を足す
- Settings に playtest lab を追加し、reset / preset / fast-forward / stage jump / resource grant を用意する
- `window.render_game_to_text` と `window.advanceTime(ms)` を公開する
- Firebase adapter は lazy load に寄せ、cloud 機能を使う時だけロードする
- save 読込は strict parse + migration にし、失敗時は黙って握りつぶさない
- 派遣は bench の `HeroInstance` を所有し、帰還時に bench / overflow へ戻す
- summon 結果と conflict の判断軸を UI 上で明示する
- HUD は上部 resource strip + 下部 command dock + 小さな signal rail に寄せる
- Progression は `urgent / growth / logistics` の 3 面に分け、mission を文章一覧のまま置かない
- CTA は `packages/game-core` の cost selector を通し、押せない理由を補助文で返す
- state 供給は selector ベースに寄せ、route が full context を掴まないようにする
- `War Room` は tab / segmented control で section を切り替え、常時全展開しない

## 今回の実装で確認したいこと

- summon -> deploy -> battle -> stage clear の最短導線
- fast-forward で offline progress / expedition / mission が破綻しないこと
- preset から formation / equipment / prestige 系の導線が詰まらないこと
- local save / import / reset の往復で save schema が壊れないこと

## 次に着手する優先項目

- Battle / Summon / Progression の visual language を分岐させ、route ごとの役割を画面で分かるようにする
- resource / stage / ready state を header ではなく HUD 化し、現在地を常時追えるようにする
- Growth 系 CTA に cost / next gain / disabled reason を追加し、押す前に判断できるようにする
- preloading は全 route 一括ではなく、隣接導線中心の先読みに絞る
- `GameProvider` を external store + selector hook に変え、`useGame()` の full subscribe をやめる
- `Progression` に section 切替を入れ、mobile で 1 画面 1 目的へ寄せる

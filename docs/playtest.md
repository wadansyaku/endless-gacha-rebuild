# Playtest Guide

## 目的

- 目視プレイと自動検証の両方で同じ状態を追えるようにする
- 通常プレイを壊さずに、QA 用の短縮導線を持つ

## UI 導線

- `Settings` に `Playtest Lab` を置く
- 以下を明示ボタンで提供する
  - reset run
  - starter preset
  - midgame preset
  - fast-forward
  - stage jump
  - resource grant
  - local save export / import
- `Summon` では直近の結果を見えるようにし、QA 中に「何が出たか」を route 上で確認できるようにする
- `Battle` では overflow を主導線と分離し、検証時に盤面が埋もれないようにする

## Browser Hooks

- `window.render_game_to_text()`
  - 現在の run / roster / inventory / expedition / meta の要点を JSON 文字列で返す
- `window.advanceTime(ms)`
  - 指定ミリ秒ぶん simulation を進める
- `window.__ENDLESS_GACHA__`
  - save export / import / reset / preset / debug command を呼べる playtest API

## 制約

- debug command は gameplay の本導線ではなく QA 導線である
- 直接 state mutate は避け、可能な限り `packages/game-core` の command を通す
- save schema を変える場合は別途 ADR を先に更新する
- playtest preset は「強い状態」だけでなく「見たい system が詰まらず触れる状態」を優先する

# ADR 0004: Expedition Instance Ownership

## Status

Accepted

## Decision

- expedition は `heroId` ではなく派遣中の `HeroInstance` を保持する
- V1 の派遣対象は bench 上のヒーロー個体に限定する
- 派遣開始時に bench から個体を取り外し、派遣完了時に bench へ戻す
- bench が満杯なら overflow inbox へ退避し、silent loss を起こさない

## Consequence

- 戦闘参加中の個体と派遣中の個体を混同しにくくなる
- 同キャラ複数所持でも個体ごとの差分を保てる
- save schema migration が必要になるが、編成・派遣・収集の責務が揃う

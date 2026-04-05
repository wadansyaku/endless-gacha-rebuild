# Content Schema

## Catalog 一覧

- `heroes.json`
  - hero 定義
  - rarity / faction / class / base stats / passive
- `banners.json`
  - summon banner
  - cost / pity / rarity rates / pool
- `missions.json`
  - daily / achievement
  - target / reward / reset policy
- `talents.json`
  - persistent meta upgrade
- `artifacts.json`
  - shard gacha / direct upgrade source
- `formations.json`
  - board pattern + bonus
- `expeditions.json`
  - duration / reward / unlock stage
- `equipment.json`
  - type / rarity / base bonus / sell price / synthesis target
- `stages.json`
  - enemy HP curve
  - enemy element / trait / boss affix tables

## Hero

```ts
type HeroContent = {
  id: string;
  name: string;
  rarity: "N" | "R" | "SR" | "SSR" | "UR";
  faction: "Fire" | "Water" | "Nature" | "Light" | "Dark";
  classType: "Warrior" | "Archer" | "Mage";
  baseDps: number;
  emoji: string;
  passive?: {
    id: string;
    name: string;
    kind: "adjacentBuff" | "selfCrit" | "factionBuff" | "classBuff";
    value: number;
    description: string;
  };
};
```

## Banner

```ts
type BannerContent = {
  id: string;
  kind: "normal" | "premium";
  currency: "gold" | "gems";
  cost: number;
  pityLimit?: number;
  guaranteeRarity?: "SR" | "SSR" | "UR";
  rates: Record<"N" | "R" | "SR" | "SSR" | "UR", number>;
  poolHeroIds: string[];
};
```

## Mission

```ts
type MissionContent = {
  id: string;
  kind: "daily" | "achievement";
  metric: "kills" | "gachaPulls" | "highestStage" | "prestigeCount";
  target: number;
  reward: {
    gold?: number;
    gems?: number;
    artifactShards?: number;
  };
  title: string;
  description: string;
  resetPolicy: "never" | "dailyJst";
};
```

## Talent / Artifact / Formation

```ts
type ScalingUpgradeContent = {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  effectKind: string;
  effectPerLevel: number;
};
```

```ts
type FormationContent = {
  id: string;
  name: string;
  description: string;
  requiredSlots: number[];
  bonus: {
    kind: "globalDps" | "frontDps" | "midDps" | "backDps";
    value: number;
  };
};
```

## Expedition

```ts
type ExpeditionContent = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  unlockStage: number;
  reward: {
    kind: "gold" | "gems" | "artifactShards";
    amount: number;
  };
};
```

## Equipment

```ts
type EquipmentTierContent = {
  id: string;
  type: "weapon" | "armor" | "accessory";
  rarity: "N" | "R" | "SR" | "SSR" | "UR";
  name: string;
  dpsBonus: number;
  dpsMultiplier: number;
  sellPrice: number;
};
```

## Stage Table

```ts
type StageRuleContent = {
  bossInterval: number;
  bossTimerSeconds: number;
  hpBase: number;
  hpGrowth: number;
  bossMultiplier: number;
  enemyElements: Array<"Fire" | "Water" | "Nature" | "Light" | "Dark">;
  bossElements: Array<"Fire" | "Water" | "Nature" | "Light" | "Dark">;
  bossAffixes: Array<"NONE" | "REGEN" | "ARMORED" | "BERSERK" | "EVASIVE">;
  enemyTraits: Array<"NONE" | "ARMORED" | "RESISTANT" | "EVASIVE">;
  offlineCapMinutes: number;
};
```

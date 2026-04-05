export const SAVE_SCHEMA_VERSION = 2;
export const DEFAULT_CONTENT_VERSION = "endless-gacha-v1";
export const LOCAL_SAVE_STORAGE_KEY = "endless-gacha/local-save";
export const TUTORIAL_STORAGE_KEY = "endless-gacha/tutorial-dismissed";
export const DEFAULT_OFFLINE_CAP_MINUTES = 24 * 60;
export const DEFAULT_BOARD_SIZE = 9;
export const DEFAULT_BENCH_SIZE = 8;
export const DEFAULT_INVENTORY_CAPACITY = 80;
export const JST_TIME_ZONE = "Asia/Tokyo";

export type Rarity = "N" | "R" | "SR" | "SSR" | "UR";
export type Faction = "Fire" | "Water" | "Nature" | "Light" | "Dark";
export type ClassType = "Warrior" | "Archer" | "Mage";
export type EquipmentType = "weapon" | "armor" | "accessory";
export type CurrencyKind = "gold" | "gems" | "artifactShards";
export type BannerKind = "normal" | "premium";
export type BossAffix = "NONE" | "REGEN" | "ARMORED" | "BERSERK" | "EVASIVE";
export type EnemyTrait = "NONE" | "ARMORED" | "RESISTANT" | "EVASIVE";
export type MissionKind = "daily" | "achievement";
export type MissionMetric = "kills" | "gachaPulls" | "highestStage" | "prestigeCount";
export type ResetPolicy = "never" | "dailyJst";
export type OverflowKind = "hero" | "equipment";

export type PassiveKind = "adjacentBuff" | "selfCrit" | "factionBuff" | "classBuff";
export type FormationBonusKind = "globalDps" | "frontDps" | "midDps" | "backDps";

export type HeroContent = {
  id: string;
  name: string;
  rarity: Rarity;
  faction: Faction;
  classType: ClassType;
  baseDps: number;
  emoji: string;
  passive?: {
    id: string;
    name: string;
    kind: PassiveKind;
    value: number;
    description: string;
  } | undefined;
};

export type BannerRates = Record<Rarity, number>;

export type BannerContent = {
  id: string;
  name: string;
  kind: BannerKind;
  currency: Extract<CurrencyKind, "gold" | "gems">;
  cost: number;
  pityLimit?: number | undefined;
  guaranteeRarity?: Extract<Rarity, "SR" | "SSR" | "UR"> | undefined;
  rates: BannerRates;
  poolHeroIds: string[];
};

export type MissionContent = {
  id: string;
  kind: MissionKind;
  metric: MissionMetric;
  target: number;
  reward: Partial<Record<CurrencyKind, number | undefined>>;
  title: string;
  description: string;
  resetPolicy: ResetPolicy;
};

export type ScalingUpgradeContent = {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  effectKind: string;
  effectPerLevel: number;
};

export type ArtifactContent = ScalingUpgradeContent;
export type TalentContent = ScalingUpgradeContent;

export type FormationContent = {
  id: string;
  name: string;
  description: string;
  unlockCost?: number | undefined;
  requiredSlots: number[];
  bonus: {
    kind: FormationBonusKind;
    value: number;
  };
};

export type ExpeditionContent = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  unlockStage: number;
  reward: {
    kind: CurrencyKind;
    amount: number;
  };
};

export type EquipmentTierContent = {
  id: string;
  type: EquipmentType;
  rarity: Rarity;
  name: string;
  dpsBonus: number;
  dpsMultiplier: number;
  sellPrice: number;
};

export type StageRuleContent = {
  bossInterval: number;
  bossTimerSeconds: number;
  hpBase: number;
  hpGrowth: number;
  bossMultiplier: number;
  enemyElements: Faction[];
  bossElements: Faction[];
  bossAffixes: BossAffix[];
  enemyTraits: EnemyTrait[];
  offlineCapMinutes: number;
};

export type GameContent = {
  contentVersion: string;
  heroes: HeroContent[];
  banners: BannerContent[];
  missions: MissionContent[];
  talents: TalentContent[];
  artifacts: ArtifactContent[];
  formations: FormationContent[];
  expeditions: ExpeditionContent[];
  equipment: EquipmentTierContent[];
  stageRules: StageRuleContent;
};

export const rarityOrder: Rarity[] = ["N", "R", "SR", "SSR", "UR"];

export const rarityIndex = (rarity: Rarity): number => rarityOrder.indexOf(rarity);

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const toRecord = <T extends { id: string }>(entries: T[]): Record<string, T> =>
  Object.fromEntries(entries.map((entry) => [entry.id, entry]));

export const getJstDayKey = (timestamp: number): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: JST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(timestamp);

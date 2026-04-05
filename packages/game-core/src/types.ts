import type {
  BannerContent,
  BossAffix,
  ClassType,
  EquipmentType,
  EnemyTrait,
  Faction,
  FormationContent,
  GameContent,
  OverflowKind,
  Rarity
} from "@endless-gacha/shared";

export type RngState = {
  seed: number;
};

export type EquipmentInstance = {
  instanceId: string;
  tierId: string;
};

export type HeroInstance = {
  instanceId: string;
  heroId: string;
  star: number;
  level: number;
  equipment: Partial<Record<EquipmentType, string>>;
};

export type OverflowInboxItem = {
  id: string;
  kind: OverflowKind;
  receivedAt: number;
  reason: string;
  hero?: HeroInstance;
  equipment?: EquipmentInstance;
};

export type ActiveExpedition = {
  dispatchId: string;
  expeditionId: string;
  hero: HeroInstance;
  startedAt: number;
  readyAt: number;
};

export type DailyStats = {
  dayKey: string;
  kills: number;
  gachaPulls: number;
};

export type LifetimeStats = {
  kills: number;
  gachaPulls: number;
};

export type RunState = {
  stage: number;
  highestStage: number;
  enemyHp: number;
  enemyMaxHp: number;
  bossTimeLeft: number | null;
  rngState: RngState;
};

export type RosterState = {
  board: Array<string | null>;
  bench: Array<string | null>;
  heroes: Record<string, HeroInstance>;
  unlockedHeroIds: string[];
  heroSoulByHeroId: Record<string, number>;
  heroAwakeningByHeroId: Record<string, number>;
};

export type UpgradeLevels = {
  tapDamage: number;
  heroDps: number;
};

export type MissionClaimState = {
  claimed: boolean;
  claimedDayKey?: string;
};

export type MetaState = {
  gold: number;
  gems: number;
  artifactShards: number;
  pityCounter: number;
  premiumPullCount: number;
  prestigePoints: number;
  prestigeMultiplier: number;
  prestigeCount: number;
  upgrades: UpgradeLevels;
  talentLevels: Record<string, number>;
  artifactLevels: Record<string, number>;
  formationLevels: Record<string, number>;
  activeFormationId: string | null;
  missionClaims: Record<string, MissionClaimState>;
  dailyStats: DailyStats;
  lifetimeStats: LifetimeStats;
  autoSellCommon: boolean;
};

export type InventoryState = {
  items: Record<string, EquipmentInstance>;
  order: string[];
  capacity: number;
  overflow: OverflowInboxItem[];
};

export type ExpeditionState = {
  active: Record<string, ActiveExpedition>;
  order: string[];
};

export type PreferencesState = {
  tutorialDismissed: boolean;
};

export type GameSnapshot = {
  run: RunState;
  roster: RosterState;
  meta: MetaState;
  inventory: InventoryState;
  expedition: ExpeditionState;
  preferences: PreferencesState;
};

export type VersionedSaveEnvelope = {
  saveSchemaVersion: number;
  contentVersion: string;
  lastProcessedAt: number;
  snapshot: GameSnapshot;
};

export type SlotRef = {
  area: "board" | "bench";
  index: number;
};

export type BattleDerivedState = {
  totalDps: number;
  tapDamage: number;
  enemyElement: Faction;
  enemyTrait: EnemyTrait;
  bossAffix: BossAffix;
  isBoss: boolean;
  synergies: {
    faction: Record<Faction, number>;
    classType: Record<ClassType, number>;
  };
  activeFormation: FormationContent | null;
};

export type MissionView = {
  id: string;
  title: string;
  description: string;
  kind: "daily" | "achievement";
  progress: number;
  target: number;
  claimed: boolean;
  claimable: boolean;
  reward: Partial<Record<"gold" | "gems" | "artifactShards", number | undefined>>;
};

export type LeaderBonus = {
  faction: Faction | null;
  classType: ClassType | null;
};

export type GachaResult = {
  banner: BannerContent;
  pulls: HeroInstance[];
};

export type CloudSaveDocument = {
  gameSave: VersionedSaveEnvelope;
  highestStage: number;
  displayName: string;
  updatedAt: number;
};

export type CommandResult<T = undefined> = {
  save: VersionedSaveEnvelope;
  events: string[];
  payload?: T;
};

export type SynthResult = {
  createdItemId: string;
  createdTierId: string;
};

export type BattleSummary = {
  stage: number;
  highestStage: number;
  enemyHp: number;
  enemyMaxHp: number;
  bossTimeLeft: number | null;
  totalDps: number;
  tapDamage: number;
  isBoss: boolean;
  enemyElement: Faction;
  enemyTrait: EnemyTrait;
  bossAffix: BossAffix;
};

export type CollectionEntry = {
  heroId: string;
  unlocked: boolean;
  awakeningLevel: number;
  soulCount: number;
  nextAwakeningCost: number;
};

export type SaveConflictResolution = "keepLocal" | "useRemote" | "useNewest";

export type SaveComparison = {
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  recommended: SaveConflictResolution;
};

export type ResourceGrant = Partial<
  Record<"gold" | "gems" | "artifactShards" | "prestigePoints", number>
>;

export type PlaytestPresetId = "starter" | "midgame";

export type PlaytestResourceGrant = Partial<
  Record<"gold" | "gems" | "artifactShards" | "prestigePoints", number>
>;

export type PlaytestPreset = "starter" | "midgame";

export type ContentLookups = {
  heroesById: Record<string, GameContent["heroes"][number]>;
  bannersById: Record<string, GameContent["banners"][number]>;
  missionsById: Record<string, GameContent["missions"][number]>;
  talentsById: Record<string, GameContent["talents"][number]>;
  artifactsById: Record<string, GameContent["artifacts"][number]>;
  formationsById: Record<string, GameContent["formations"][number]>;
  expeditionsById: Record<string, GameContent["expeditions"][number]>;
  equipmentByTierId: Record<string, GameContent["equipment"][number]>;
};

export type HeroPlacementView = {
  slot: SlotRef;
  instance: HeroInstance | null;
  rarity?: Rarity;
};

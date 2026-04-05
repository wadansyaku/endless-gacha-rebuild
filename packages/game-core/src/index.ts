import {
  DEFAULT_BENCH_SIZE,
  DEFAULT_BOARD_SIZE,
  DEFAULT_CONTENT_VERSION,
  DEFAULT_INVENTORY_CAPACITY,
  DEFAULT_OFFLINE_CAP_MINUTES,
  SAVE_SCHEMA_VERSION,
  clamp,
  getJstDayKey,
  rarityIndex,
  rarityOrder,
  toRecord,
  type BannerContent,
  type BossAffix,
  type ClassType,
  type EnemyTrait,
  type Faction,
  type FormationContent,
  type GameContent,
  type HeroContent,
  type MissionContent,
  type Rarity
} from "@endless-gacha/shared";
import { createSeed, nextRng } from "./rng";
import type {
  BattleDerivedState,
  BattleSummary,
  CollectionEntry,
  CommandResult,
  ContentLookups,
  EquipmentInstance,
  GachaResult,
  GameSnapshot,
  HeroInstance,
  HeroPlacementView,
  MissionView,
  OverflowInboxItem,
  PlaytestPreset,
  PlaytestResourceGrant,
  SaveComparison,
  SlotRef,
  SynthResult,
  VersionedSaveEnvelope
} from "./types";

const BOSS_REWARD_GEMS = 100;
const BOSS_REWARD_GEMS_PER_STAGE = 10;
const BOSS_REWARD_SHARDS_BASE = 1;

const emptyBoard = (): Array<string | null> =>
  Array.from({ length: DEFAULT_BOARD_SIZE }, () => null);

const emptyBench = (): Array<string | null> =>
  Array.from({ length: DEFAULT_BENCH_SIZE }, () => null);

const cloneSave = (save: VersionedSaveEnvelope): VersionedSaveEnvelope => structuredClone(save);

const createIdMap = <T extends { id: string }>(entries: T[]): Record<string, T> => toRecord(entries);

const getLookups = (content: GameContent): ContentLookups => ({
  heroesById: createIdMap(content.heroes),
  bannersById: createIdMap(content.banners),
  missionsById: createIdMap(content.missions),
  talentsById: createIdMap(content.talents),
  artifactsById: createIdMap(content.artifacts),
  formationsById: createIdMap(content.formations),
  expeditionsById: createIdMap(content.expeditions),
  equipmentByTierId: createIdMap(content.equipment)
});

const getHeroDefinition = (lookups: ContentLookups, heroId: string): HeroContent => {
  const hero = lookups.heroesById[heroId];
  if (!hero) {
    throw new Error(`Unknown hero definition: ${heroId}`);
  }
  return hero;
};

const isBossStage = (content: GameContent, stage: number): boolean =>
  stage % content.stageRules.bossInterval === 0;

const getEnemyElement = (content: GameContent, stage: number): Faction => {
  if (isBossStage(content, stage)) {
    const bossIndex = Math.floor(stage / content.stageRules.bossInterval - 1);
    return content.stageRules.bossElements[bossIndex % content.stageRules.bossElements.length] ?? "Fire";
  }
  return content.stageRules.enemyElements[(stage - 1) % content.stageRules.enemyElements.length] ?? "Dark";
};

const getEnemyTrait = (content: GameContent, stage: number): EnemyTrait => {
  if (isBossStage(content, stage)) {
    const affix = getBossAffix(content, stage);
    if (affix === "ARMORED") return "ARMORED";
    if (affix === "EVASIVE") return "EVASIVE";
    if (stage % (content.stageRules.bossInterval * 2) === 0) return "RESISTANT";
  }
  return content.stageRules.enemyTraits[(stage - 1) % content.stageRules.enemyTraits.length] ?? "NONE";
};

const getBossAffix = (content: GameContent, stage: number): BossAffix => {
  if (!isBossStage(content, stage)) {
    return "NONE";
  }
  return (
    content.stageRules.bossAffixes[
      Math.floor(stage / content.stageRules.bossInterval) % content.stageRules.bossAffixes.length
    ] ?? "NONE"
  );
};

const getElementalMultiplier = (attacker: Faction, defender: Faction): number => {
  if (attacker === "Fire" && defender === "Nature") return 1.5;
  if (attacker === "Nature" && defender === "Water") return 1.5;
  if (attacker === "Water" && defender === "Fire") return 1.5;
  if (attacker === "Light" && defender === "Dark") return 1.5;
  if (attacker === "Dark" && defender === "Light") return 1.5;

  if (attacker === "Fire" && defender === "Water") return 0.75;
  if (attacker === "Water" && defender === "Nature") return 0.75;
  if (attacker === "Nature" && defender === "Fire") return 0.75;

  return 1;
};

const createZeroLevelMap = <T extends { id: string }>(entries: T[]): Record<string, number> =>
  Object.fromEntries(entries.map((entry) => [entry.id, 0]));

const getBossHpReductionMultiplier = (save: VersionedSaveEnvelope): number =>
  Math.max(0.5, 1 - (save.snapshot.meta.artifactLevels.boss_sla ?? 0) * 0.05);

const calculateEnemyMaxHp = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  stage = save.snapshot.run.stage
): number => {
  const base = Math.floor(
    content.stageRules.hpBase * Math.pow(content.stageRules.hpGrowth, Math.max(stage - 1, 0))
  );
  if (!isBossStage(content, stage)) {
    return base;
  }
  return Math.floor(base * content.stageRules.bossMultiplier * getBossHpReductionMultiplier(save));
};

const normalizeRates = (rates: Record<Rarity, number>): Record<Rarity, number> => {
  const total = Object.values(rates).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return {
      N: 1,
      R: 0,
      SR: 0,
      SSR: 0,
      UR: 0
    };
  }
  return {
    N: rates.N / total,
    R: rates.R / total,
    SR: rates.SR / total,
    SSR: rates.SSR / total,
    UR: rates.UR / total
  };
};

const buildBannerRates = (
  save: VersionedSaveEnvelope,
  banner: BannerContent
): Record<Rarity, number> => {
  const rates = { ...banner.rates };
  if (banner.kind === "normal") {
    const srRateUp = (save.snapshot.meta.talentLevels.sr_rate_up ?? 0) * 0.001;
    rates.SR += srRateUp;
    rates.N = Math.max(0, rates.N - srRateUp);
  }
  return normalizeRates(rates);
};

export const getNormalBannerDiscount = (save: VersionedSaveEnvelope): number =>
  1 - (save.snapshot.meta.talentLevels.gacha_discount ?? 0) * 0.02;

const getUpgradeValue = (level: number, step: number): number =>
  1 + Math.max(0, level) * step;

export const getUpgradeEffect = (
  kind: keyof GameSnapshot["meta"]["upgrades"],
  level: number
): number => getUpgradeValue(level, kind === "tapDamage" ? 0.25 : 0.2);

export const getUpgradeCost = (level: number): number => Math.floor(100 * Math.pow(1.5, level - 1));

export const getHeroLevelUpCost = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  heroInstance: HeroInstance
): number => {
  const hero = content.heroes.find((entry) => entry.id === heroInstance.heroId);
  if (!hero) {
    throw new Error(`Unknown hero definition: ${heroInstance.heroId}`);
  }
  const baseCostByRarity: Record<Rarity, number> = {
    N: 100,
    R: 300,
    SR: 1000,
    SSR: 5000,
    UR: 20000
  };
  let cost = Math.floor(baseCostByRarity[hero.rarity] * Math.pow(1.15, heroInstance.level - 1));
  if (save.snapshot.meta.talentLevels.hero_level_discount) {
    cost = Math.floor(cost * (1 - save.snapshot.meta.talentLevels.hero_level_discount * 0.02));
  }
  return cost;
};

export const getArtifactUpgradeCost = (save: VersionedSaveEnvelope, content: GameContent, artifactId: string): number => {
  const artifact = content.artifacts.find((entry) => entry.id === artifactId);
  if (!artifact) {
    throw new Error(`Unknown artifact: ${artifactId}`);
  }
  const level = save.snapshot.meta.artifactLevels[artifactId] ?? 0;
  return Math.floor(artifact.baseCost * Math.pow(artifact.costMultiplier, level));
};

export const getTalentUpgradeCost = (save: VersionedSaveEnvelope, content: GameContent, talentId: string): number => {
  const talent = content.talents.find((entry) => entry.id === talentId);
  if (!talent) {
    throw new Error(`Unknown talent: ${talentId}`);
  }
  const level = save.snapshot.meta.talentLevels[talentId] ?? 0;
  return Math.floor(talent.baseCost * Math.pow(talent.costMultiplier, level));
};

export const getFormationUpgradeCost = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  formationId: string
): number => {
  const formation = content.formations.find((entry) => entry.id === formationId);
  if (!formation) {
    throw new Error(`Unknown formation: ${formationId}`);
  }
  const level = save.snapshot.meta.formationLevels[formationId] ?? 0;
  const base = formation.unlockCost ?? 500;
  return level === 0 ? base : Math.floor(base * (level + 1));
};

export const getBannerPullCost = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  bannerId: string,
  count: number
): number => {
  const banner = content.banners.find((entry) => entry.id === bannerId);
  if (!banner) {
    throw new Error(`Unknown banner definition: ${bannerId}`);
  }
  const costPerPull =
    banner.kind === "normal" ? Math.max(1, Math.floor(banner.cost * getNormalBannerDiscount(save))) : banner.cost;
  return costPerPull * Math.max(1, count);
};

export const getBannerRates = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  bannerId: string
): Record<Rarity, number> => {
  const banner = content.banners.find((entry) => entry.id === bannerId);
  if (!banner) {
    throw new Error(`Unknown banner definition: ${bannerId}`);
  }
  return buildBannerRates(save, banner);
};

const nextRoll = (save: VersionedSaveEnvelope): [number, VersionedSaveEnvelope] => {
  const [roll, rngState] = nextRng(save.snapshot.run.rngState);
  const nextSave = cloneSave(save);
  nextSave.snapshot.run.rngState = rngState;
  return [roll, nextSave];
};

const nextId = (save: VersionedSaveEnvelope, prefix: string): [string, VersionedSaveEnvelope] => {
  const [roll, nextSave] = nextRoll(save);
  return [`${prefix}_${Math.floor(roll * 1_000_000_000).toString(36)}`, nextSave];
};

const getEquipmentTier = (lookups: ContentLookups, tierId: string) => {
  const tier = lookups.equipmentByTierId[tierId];
  if (!tier) {
    throw new Error(`Unknown equipment tier: ${tierId}`);
  }
  return tier;
};

const getFormationIfActive = (
  save: VersionedSaveEnvelope,
  content: GameContent
): FormationContent | null => {
  const formationId = save.snapshot.meta.activeFormationId;
  if (!formationId) {
    return null;
  }
  const formation = content.formations.find((entry) => entry.id === formationId) ?? null;
  if (!formation) {
    return null;
  }
  if ((save.snapshot.meta.formationLevels[formation.id] ?? 0) <= 0) {
    return null;
  }
  const active = formation.requiredSlots.every((slot) => save.snapshot.roster.board[slot] !== null);
  return active ? formation : null;
};

const calculateSynergies = (
  save: VersionedSaveEnvelope,
  lookups: ContentLookups
): BattleDerivedState["synergies"] => {
  const faction: Record<Faction, number> = {
    Fire: 0,
    Water: 0,
    Nature: 0,
    Light: 0,
    Dark: 0
  };
  const classType: Record<ClassType, number> = {
    Warrior: 0,
    Archer: 0,
    Mage: 0
  };
  const uniqueHeroIds = new Set<string>();
  for (const instanceId of save.snapshot.roster.board) {
    if (!instanceId) continue;
    const instance = save.snapshot.roster.heroes[instanceId];
    if (!instance || uniqueHeroIds.has(instance.heroId)) continue;
    uniqueHeroIds.add(instance.heroId);
    const hero = getHeroDefinition(lookups, instance.heroId);
    faction[hero.faction] += 1;
    classType[hero.classType] += 1;
  }
  return { faction, classType };
};

const calculateEquipmentContribution = (
  save: VersionedSaveEnvelope,
  lookups: ContentLookups,
  instance: HeroInstance
): { flat: number; multiplier: number } => {
  let flat = 0;
  let multiplier = 1;
  for (const equipmentId of Object.values(instance.equipment)) {
    if (!equipmentId) continue;
    const equipmentInstance = save.snapshot.inventory.items[equipmentId];
    if (!equipmentInstance) continue;
    const tier = getEquipmentTier(lookups, equipmentInstance.tierId);
    flat += tier.dpsBonus;
    multiplier *= tier.dpsMultiplier;
  }

  const equippedItems = Object.values(instance.equipment)
    .map((equipmentId) => (equipmentId ? save.snapshot.inventory.items[equipmentId] : null))
    .filter(Boolean);
  if (equippedItems.length === 3) {
    const lowestRarityIndex = Math.min(
      ...equippedItems.map((item) =>
        rarityIndex(getEquipmentTier(lookups, item?.tierId ?? "").rarity)
      )
    );
    if (lowestRarityIndex >= rarityIndex("UR")) multiplier *= 4;
    else if (lowestRarityIndex >= rarityIndex("SSR")) multiplier *= 2;
    else if (lowestRarityIndex >= rarityIndex("SR")) multiplier *= 1.3;
    else if (lowestRarityIndex >= rarityIndex("R")) multiplier *= 1.15;
    else multiplier *= 1.05;
  }

  return { flat, multiplier };
};

const calculatePassiveMultiplier = (
  save: VersionedSaveEnvelope,
  lookups: ContentLookups,
  slotIndex: number,
  hero: HeroContent
): number => {
  let multiplier = 1;
  const row = Math.floor(slotIndex / 3);
  const col = slotIndex % 3;

  for (const [otherIndex, otherInstanceId] of save.snapshot.roster.board.entries()) {
    if (!otherInstanceId) continue;
    const otherInstance = save.snapshot.roster.heroes[otherInstanceId];
    if (!otherInstance) continue;
    const otherHero = getHeroDefinition(lookups, otherInstance.heroId);
    const passive = otherHero.passive;
    if (!passive) continue;

    if (passive.kind === "factionBuff" && otherHero.faction === hero.faction) {
      multiplier *= passive.value;
    } else if (passive.kind === "classBuff" && otherHero.classType === hero.classType) {
      multiplier *= passive.value;
    } else if (passive.kind === "adjacentBuff") {
      const otherRow = Math.floor(otherIndex / 3);
      const otherCol = otherIndex % 3;
      if (Math.abs(row - otherRow) + Math.abs(col - otherCol) === 1) {
        multiplier *= passive.value;
      }
    }
  }

  if (hero.passive?.kind === "selfCrit") {
    multiplier *= 1 + hero.passive.value;
  }

  return multiplier;
};

const calculateUnitMultiplier = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  lookups: ContentLookups,
  hero: HeroContent,
  instance: HeroInstance,
  slotIndex: number,
  activeFormation: FormationContent | null,
  synergies: BattleDerivedState["synergies"],
  enemyElement: Faction,
  enemyTrait: EnemyTrait,
  bossAffix: BossAffix
): number => {
  const artifactLevels = save.snapshot.meta.artifactLevels;
  const awakeningLevel = save.snapshot.roster.heroAwakeningByHeroId[hero.id] ?? 0;
  let multiplier = 1;

  if (slotIndex < 3 && hero.classType === "Warrior") multiplier *= 1.3;
  else if (slotIndex >= 3 && slotIndex <= 5) multiplier *= 1.1;
  else if (slotIndex > 5 && (hero.classType === "Archer" || hero.classType === "Mage")) multiplier *= 1.3;

  const leaderInstanceId = save.snapshot.roster.board[4];
  if (leaderInstanceId) {
    const leaderInstance = save.snapshot.roster.heroes[leaderInstanceId];
    if (leaderInstance) {
      const leader = getHeroDefinition(lookups, leaderInstance.heroId);
      if (leader.faction === hero.faction) multiplier *= 1.2;
      if (leader.classType === hero.classType) multiplier *= 1.2;
    }
  }

  const factionCount = synergies.faction[hero.faction];
  if (hero.faction === "Light" || hero.faction === "Dark") {
    if (factionCount >= 2) multiplier *= 1.5;
  } else if (factionCount >= 4) {
    multiplier *= 1.5;
  } else if (factionCount >= 2) {
    multiplier *= 1.2;
  }

  const classCount = synergies.classType[hero.classType];
  if (classCount >= 4) multiplier *= 1.4;
  else if (classCount >= 2) multiplier *= 1.15;

  multiplier *= 1 + (instance.level - 1) * 0.1;
  multiplier *= Math.pow(3, instance.star - 1);
  multiplier *= 1 + awakeningLevel * 0.5;

  const elementMultiplier = getElementalMultiplier(hero.faction, enemyElement);
  if (enemyTrait === "RESISTANT" && elementMultiplier <= 1) {
    multiplier *= elementMultiplier * 0.2;
  } else {
    multiplier *= elementMultiplier;
  }

  if (enemyTrait === "EVASIVE" || bossAffix === "EVASIVE") {
    multiplier *= 0.7;
  }

  multiplier *= 1 + (save.snapshot.meta.talentLevels.base_dps ?? 0) * 0.05;
  if (isBossStage(content, save.snapshot.run.stage)) {
    multiplier *= 1 + (save.snapshot.meta.talentLevels.boss_damage ?? 0) * 0.1;
  }
  multiplier *= save.snapshot.meta.prestigeMultiplier;
  multiplier *= getUpgradeValue(save.snapshot.meta.upgrades.heroDps, 0.2);

  if (hero.faction === "Fire") multiplier *= 1 + (artifactLevels.fire_pen ?? 0) * 0.1;
  if (hero.faction === "Water") multiplier *= 1 + (artifactLevels.water_cha ?? 0) * 0.1;
  if (hero.faction === "Nature") multiplier *= 1 + (artifactLevels.nature_shi ?? 0) * 0.1;
  if (hero.faction === "Light") multiplier *= 1 + (artifactLevels.light_swo ?? 0) * 0.1;
  if (hero.faction === "Dark") multiplier *= 1 + (artifactLevels.dark_rob ?? 0) * 0.1;
  if (hero.classType === "Warrior") multiplier *= 1 + (artifactLevels.warrior_bad ?? 0) * 0.1;
  if (hero.classType === "Archer") multiplier *= 1 + (artifactLevels.archer_bow ?? 0) * 0.1;
  if (hero.classType === "Mage") multiplier *= 1 + (artifactLevels.mage_sta ?? 0) * 0.1;

  if (activeFormation) {
    const formationLevel = save.snapshot.meta.formationLevels[activeFormation.id] ?? 0;
    const formationValue = activeFormation.bonus.value + Math.max(0, formationLevel - 1) * 0.05;
    if (activeFormation.bonus.kind === "globalDps") multiplier *= formationValue;
    else if (activeFormation.bonus.kind === "frontDps" && slotIndex < 3) multiplier *= formationValue;
    else if (activeFormation.bonus.kind === "midDps" && slotIndex >= 3 && slotIndex <= 5) multiplier *= formationValue;
    else if (activeFormation.bonus.kind === "backDps" && slotIndex > 5) multiplier *= formationValue;
  }

  return multiplier * calculatePassiveMultiplier(save, lookups, slotIndex, hero);
};

const calculateBattleDerivedState = (
  save: VersionedSaveEnvelope,
  content: GameContent
): BattleDerivedState => {
  const lookups = getLookups(content);
  const synergies = calculateSynergies(save, lookups);
  const enemyElement = getEnemyElement(content, save.snapshot.run.stage);
  const enemyTrait = getEnemyTrait(content, save.snapshot.run.stage);
  const bossAffix = getBossAffix(content, save.snapshot.run.stage);
  const activeFormation = getFormationIfActive(save, content);

  let totalDps = 0;
  for (const [slotIndex, instanceId] of save.snapshot.roster.board.entries()) {
    if (!instanceId) continue;
    const instance = save.snapshot.roster.heroes[instanceId];
    if (!instance) continue;
    const hero = getHeroDefinition(lookups, instance.heroId);
    const equipment = calculateEquipmentContribution(save, lookups, instance);
    const base = (hero.baseDps + equipment.flat) * equipment.multiplier;
    totalDps +=
      base *
      calculateUnitMultiplier(
        save,
        content,
        lookups,
        hero,
        instance,
        slotIndex,
        activeFormation,
        synergies,
        enemyElement,
        enemyTrait,
        bossAffix
      );
  }

  let tapDamage = Math.max(1, totalDps * 0.1) * getUpgradeValue(save.snapshot.meta.upgrades.tapDamage, 0.25);
  if (enemyTrait === "ARMORED") {
    tapDamage *= 0.1;
  }

  return {
    totalDps,
    tapDamage,
    enemyElement,
    enemyTrait,
    bossAffix,
    isBoss: isBossStage(content, save.snapshot.run.stage),
    synergies,
    activeFormation
  };
};

const getMissionProgress = (save: VersionedSaveEnvelope, mission: MissionContent): number => {
  if (mission.kind === "daily") {
    if (mission.metric === "kills") return save.snapshot.meta.dailyStats.kills;
    if (mission.metric === "gachaPulls") return save.snapshot.meta.dailyStats.gachaPulls;
  }
  if (mission.metric === "kills") return save.snapshot.meta.lifetimeStats.kills;
  if (mission.metric === "gachaPulls") return save.snapshot.meta.lifetimeStats.gachaPulls;
  if (mission.metric === "highestStage") return save.snapshot.run.highestStage;
  if (mission.metric === "prestigeCount") return save.snapshot.meta.prestigeCount;
  return 0;
};

const ensureDailyReset = (save: VersionedSaveEnvelope, now: number): VersionedSaveEnvelope => {
  const nextSave = cloneSave(save);
  const dayKey = getJstDayKey(now);
  if (nextSave.snapshot.meta.dailyStats.dayKey !== dayKey) {
    nextSave.snapshot.meta.dailyStats = {
      dayKey,
      kills: 0,
      gachaPulls: 0
    };
  }
  return nextSave;
};

const getGoldDrop = (save: VersionedSaveEnvelope): number => {
  const base = Math.floor(save.snapshot.run.enemyMaxHp * 0.08) + 10;
  const artifactMultiplier = 1 + (save.snapshot.meta.artifactLevels.gold_rin ?? 0) * 0.2;
  const talentMultiplier = 1 + (save.snapshot.meta.talentLevels.gold_gain ?? 0) * 0.1;
  return Math.max(1, Math.floor(base * artifactMultiplier * talentMultiplier));
};

const addOverflowItem = (
  save: VersionedSaveEnvelope,
  item: OverflowInboxItem
): VersionedSaveEnvelope => {
  const nextSave = cloneSave(save);
  nextSave.snapshot.inventory.overflow.unshift(item);
  return nextSave;
};

const addHeroToBenchOrOverflow = (
  save: VersionedSaveEnvelope,
  heroInstance: HeroInstance,
  receivedAt: number
): VersionedSaveEnvelope => {
  const nextSave = cloneSave(save);
  const benchIndex = nextSave.snapshot.roster.bench.findIndex((entry) => entry === null);
  if (benchIndex >= 0) {
    nextSave.snapshot.roster.heroes[heroInstance.instanceId] = heroInstance;
    nextSave.snapshot.roster.bench[benchIndex] = heroInstance.instanceId;
    return nextSave;
  }
  return addOverflowItem(nextSave, {
    id: `${heroInstance.instanceId}_overflow`,
    kind: "hero",
    receivedAt,
    reason: "benchFull",
    hero: heroInstance
  });
};

const findSlotIndex = (slots: Array<string | null>, instanceId: string): number =>
  slots.findIndex((entry) => entry === instanceId);

const extractBenchHero = (
  save: VersionedSaveEnvelope,
  heroInstanceId: string
): { save: VersionedSaveEnvelope; hero: HeroInstance | null } => {
  const nextSave = cloneSave(save);
  const benchIndex = findSlotIndex(nextSave.snapshot.roster.bench, heroInstanceId);
  if (benchIndex < 0) {
    return { save: nextSave, hero: null };
  }
  const hero = nextSave.snapshot.roster.heroes[heroInstanceId];
  if (!hero) {
    return { save: nextSave, hero: null };
  }
  nextSave.snapshot.roster.bench[benchIndex] = null;
  delete nextSave.snapshot.roster.heroes[heroInstanceId];
  return {
    save: nextSave,
    hero: structuredClone(hero)
  };
};

const addEquipmentToInventoryOrOverflow = (
  save: VersionedSaveEnvelope,
  equipment: EquipmentInstance,
  receivedAt: number
): VersionedSaveEnvelope => {
  const nextSave = cloneSave(save);
  if (nextSave.snapshot.inventory.order.length < nextSave.snapshot.inventory.capacity) {
    nextSave.snapshot.inventory.items[equipment.instanceId] = equipment;
    nextSave.snapshot.inventory.order.unshift(equipment.instanceId);
    return nextSave;
  }
  return addOverflowItem(nextSave, {
    id: `${equipment.instanceId}_overflow`,
    kind: "equipment",
    receivedAt,
    reason: "inventoryFull",
    equipment
  });
};

const stashUnequippedItem = (
  save: VersionedSaveEnvelope,
  equipment: EquipmentInstance,
  receivedAt: number
): VersionedSaveEnvelope => {
  const nextSave = cloneSave(save);
  if (nextSave.snapshot.inventory.order.length < nextSave.snapshot.inventory.capacity) {
    nextSave.snapshot.inventory.order.unshift(equipment.instanceId);
    return nextSave;
  }
  delete nextSave.snapshot.inventory.items[equipment.instanceId];
  return addOverflowItem(nextSave, {
    id: `${equipment.instanceId}_overflow`,
    kind: "equipment",
    receivedAt,
    reason: "inventoryFull",
    equipment
  });
};

const createHeroInstance = (
  save: VersionedSaveEnvelope,
  heroId: string
): [HeroInstance, VersionedSaveEnvelope] => {
  const [instanceId, nextSave] = nextId(save, "hero");
  return [
    {
      instanceId,
      heroId,
      star: 1,
      level: 1,
      equipment: {}
    },
    nextSave
  ];
};

const createEquipmentInstance = (
  save: VersionedSaveEnvelope,
  tierId: string
): [EquipmentInstance, VersionedSaveEnvelope] => {
  const [instanceId, nextSave] = nextId(save, "equipment");
  return [{ instanceId, tierId }, nextSave];
};

const rollWeightedRarity = (
  save: VersionedSaveEnvelope,
  rates: Record<Rarity, number>
): [Rarity, VersionedSaveEnvelope] => {
  const [roll, nextSave] = nextRoll(save);
  let cursor = 0;
  for (const rarity of rarityOrder) {
    cursor += rates[rarity];
    if (roll <= cursor) {
      return [rarity, nextSave];
    }
  }
  return ["N", nextSave];
};

const rollPoolHeroId = (
  save: VersionedSaveEnvelope,
  poolHeroIds: string[]
): [string, VersionedSaveEnvelope] => {
  const [roll, nextSave] = nextRoll(save);
  const index = Math.floor(roll * poolHeroIds.length) % Math.max(poolHeroIds.length, 1);
  return [poolHeroIds[index] ?? poolHeroIds[0] ?? "", nextSave];
};

const rollEquipmentDropTierId = (
  save: VersionedSaveEnvelope,
  content: GameContent
): [string | null, VersionedSaveEnvelope] => {
  const dropChance = 0.2 + (save.snapshot.meta.talentLevels.equipment_drop_rate ?? 0) * 0.01;
  const [dropRoll, chanceSave] = nextRoll(save);
  if (dropRoll > dropChance) {
    return [null, chanceSave];
  }

  const stage = chanceSave.snapshot.run.stage;
  const rarityRates: Record<Rarity, number> = {
    N: 0.5,
    R: stage >= 10 ? 0.35 : 0.2,
    SR: stage >= 30 ? 0.12 : 0.02,
    SSR: stage >= 50 ? 0.025 : 0.005,
    UR: stage >= 100 ? 0.005 : 0
  };
  const [rarity, raritySave] = rollWeightedRarity(chanceSave, normalizeRates(rarityRates));
  const candidates = content.equipment.filter((tier) => tier.rarity === rarity);
  if (candidates.length === 0) {
    return [null, raritySave];
  }
  const [tierRoll, tierSave] = nextRoll(raritySave);
  const tierIndex = Math.floor(tierRoll * candidates.length) % candidates.length;
  return [candidates[tierIndex]?.id ?? null, tierSave];
};

const applyBattleRewards = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  now: number
): CommandResult => {
  let nextSave = cloneSave(save);
  const events: string[] = [];
  nextSave.snapshot.meta.gold += getGoldDrop(nextSave);
  nextSave.snapshot.meta.lifetimeStats.kills += 1;
  nextSave.snapshot.meta.dailyStats.kills += 1;

  if (isBossStage(content, nextSave.snapshot.run.stage)) {
    nextSave.snapshot.meta.gems +=
      BOSS_REWARD_GEMS + nextSave.snapshot.run.stage * BOSS_REWARD_GEMS_PER_STAGE;
    nextSave.snapshot.meta.artifactShards +=
      BOSS_REWARD_SHARDS_BASE + Math.floor(nextSave.snapshot.run.stage / content.stageRules.bossInterval);
    const [tierId, tierSave] = rollEquipmentDropTierId(nextSave, content);
    nextSave = tierSave;
    if (tierId) {
      const [equipmentInstance, equipmentSave] = createEquipmentInstance(nextSave, tierId);
      nextSave = addEquipmentToInventoryOrOverflow(equipmentSave, equipmentInstance, now);
      events.push(`装備 ${tierId} を獲得した`);
    }
  }

  nextSave.snapshot.run.stage += 1;
  nextSave.snapshot.run.highestStage = Math.max(
    nextSave.snapshot.run.highestStage,
    nextSave.snapshot.run.stage
  );
  nextSave.snapshot.run.enemyMaxHp = calculateEnemyMaxHp(nextSave, content, nextSave.snapshot.run.stage);
  nextSave.snapshot.run.enemyHp = nextSave.snapshot.run.enemyMaxHp;
  nextSave.snapshot.run.bossTimeLeft = isBossStage(content, nextSave.snapshot.run.stage)
    ? content.stageRules.bossTimerSeconds
    : null;
  events.unshift("敵を撃破した");
  return { save: nextSave, events };
};

const settleBattleAfterDirectDamage = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  now: number
): CommandResult => {
  if (save.snapshot.run.enemyHp > 0) {
    return { save, events: [] };
  }
  return applyBattleRewards(save, content, now);
};

const createInitialSnapshot = (
  content: GameContent,
  now: number,
  seed: number
): GameSnapshot => {
  const emptySave: VersionedSaveEnvelope = {
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    contentVersion: content.contentVersion,
    lastProcessedAt: now,
    snapshot: {
      run: {
        stage: 1,
        highestStage: 1,
        enemyHp: 0,
        enemyMaxHp: 0,
        bossTimeLeft: null,
        rngState: { seed }
      },
      roster: {
        board: emptyBoard(),
        bench: emptyBench(),
        heroes: {},
        unlockedHeroIds: [],
        heroSoulByHeroId: {},
        heroAwakeningByHeroId: {}
      },
      meta: {
        gold: 500,
        gems: 1000,
        artifactShards: 0,
        pityCounter: 0,
        premiumPullCount: 0,
        prestigePoints: 0,
        prestigeMultiplier: 1,
        prestigeCount: 0,
        upgrades: {
          tapDamage: 1,
          heroDps: 1
        },
        talentLevels: createZeroLevelMap(content.talents),
        artifactLevels: createZeroLevelMap(content.artifacts),
        formationLevels: createZeroLevelMap(content.formations),
        activeFormationId: null,
        missionClaims: {},
        dailyStats: {
          dayKey: getJstDayKey(now),
          kills: 0,
          gachaPulls: 0
        },
        lifetimeStats: {
          kills: 0,
          gachaPulls: 0
        },
        autoSellCommon: false
      },
      inventory: {
        items: {},
        order: [],
        capacity: DEFAULT_INVENTORY_CAPACITY,
        overflow: []
      },
      expedition: {
        active: {},
        order: []
      },
      preferences: {
        tutorialDismissed: false
      }
    }
  };
  emptySave.snapshot.run.enemyMaxHp = calculateEnemyMaxHp(emptySave, content, 1);
  emptySave.snapshot.run.enemyHp = emptySave.snapshot.run.enemyMaxHp;
  return emptySave.snapshot;
};

export const createNewGame = (options: {
  now: number;
  content: GameContent;
  seed?: number | string;
  contentVersion?: string;
}): VersionedSaveEnvelope => {
  const seed = createSeed(options.seed ?? options.now);
  return {
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    contentVersion: options.contentVersion ?? options.content.contentVersion ?? DEFAULT_CONTENT_VERSION,
    lastProcessedAt: options.now,
    snapshot: createInitialSnapshot(options.content, options.now, seed)
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const readRecord = (value: unknown, path: string): Record<string, unknown> => {
  assertCondition(isRecord(value), `${path} must be an object`);
  return value;
};

const readNumber = (value: unknown, path: string): number => {
  assertCondition(typeof value === "number" && Number.isFinite(value), `${path} must be a finite number`);
  return value;
};

const readNonNegativeNumber = (value: unknown, path: string): number => {
  const numberValue = readNumber(value, path);
  assertCondition(numberValue >= 0, `${path} must be non-negative`);
  return numberValue;
};

const readString = (value: unknown, path: string): string => {
  assertCondition(typeof value === "string" && value.length > 0, `${path} must be a non-empty string`);
  return value;
};

const readNullableSlotArray = (value: unknown, path: string): Array<string | null> => {
  assertCondition(Array.isArray(value), `${path} must be an array`);
  return value.map((entry, index) => {
    assertCondition(entry === null || typeof entry === "string", `${path}[${index}] must be string|null`);
    return entry;
  });
};

const readStringArray = (value: unknown, path: string): string[] => {
  assertCondition(Array.isArray(value), `${path} must be an array`);
  return value.map((entry, index) => readString(entry, `${path}[${index}]`));
};

const readNumberRecord = (value: unknown, path: string): Record<string, number> => {
  const record = readRecord(value, path);
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, readNumber(entry, `${path}.${key}`)])
  );
};

const readEquipmentInstanceLike = (value: unknown, path: string): EquipmentInstance => {
  const record = readRecord(value, path);
  return {
    instanceId: readString(record.instanceId, `${path}.instanceId`),
    tierId: readString(record.tierId, `${path}.tierId`)
  };
};

const readHeroInstanceLike = (value: unknown, path: string): HeroInstance => {
  const record = readRecord(value, path);
  const equipmentRecord = readRecord(record.equipment ?? {}, `${path}.equipment`);
  Object.entries(equipmentRecord).forEach(([key, entry]) => {
    assertCondition(typeof entry === "string", `${path}.equipment.${key} must be a string`);
  });
  return {
    instanceId: readString(record.instanceId, `${path}.instanceId`),
    heroId: readString(record.heroId, `${path}.heroId`),
    star: readNonNegativeNumber(record.star, `${path}.star`),
    level: readNonNegativeNumber(record.level, `${path}.level`),
    equipment: equipmentRecord as HeroInstance["equipment"]
  };
};

const readOverflowItemLike = (value: unknown, path: string): void => {
  const record = readRecord(value, path);
  readString(record.id, `${path}.id`);
  const kind = readString(record.kind, `${path}.kind`);
  assertCondition(kind === "hero" || kind === "equipment", `${path}.kind must be hero|equipment`);
  readNonNegativeNumber(record.receivedAt, `${path}.receivedAt`);
  readString(record.reason, `${path}.reason`);
  if (record.hero !== undefined) {
    readHeroInstanceLike(record.hero, `${path}.hero`);
  }
  if (record.equipment !== undefined) {
    readEquipmentInstanceLike(record.equipment, `${path}.equipment`);
  }
};

const readMissionClaimsLike = (value: unknown, path: string): void => {
  const record = readRecord(value, path);
  Object.entries(record).forEach(([key, entry]) => {
    const claim = readRecord(entry, `${path}.${key}`);
    assertCondition(typeof claim.claimed === "boolean", `${path}.${key}.claimed must be boolean`);
    if (claim.claimedDayKey !== undefined) {
      readString(claim.claimedDayKey, `${path}.${key}.claimedDayKey`);
    }
  });
};

const readActiveExpeditionLike = (value: unknown, path: string): void => {
  const record = readRecord(value, path);
  readString(record.dispatchId, `${path}.dispatchId`);
  readString(record.expeditionId, `${path}.expeditionId`);
  readNonNegativeNumber(record.startedAt, `${path}.startedAt`);
  readNonNegativeNumber(record.readyAt, `${path}.readyAt`);
  if (record.hero !== undefined) {
    readHeroInstanceLike(record.hero, `${path}.hero`);
    return;
  }
  readString(record.heroId, `${path}.heroId`);
};

const readSnapshotLike = (value: unknown, path: string): void => {
  const snapshot = readRecord(value, path);
  const run = readRecord(snapshot.run, `${path}.run`);
  readNonNegativeNumber(run.stage, `${path}.run.stage`);
  readNonNegativeNumber(run.highestStage, `${path}.run.highestStage`);
  readNonNegativeNumber(run.enemyHp, `${path}.run.enemyHp`);
  readNonNegativeNumber(run.enemyMaxHp, `${path}.run.enemyMaxHp`);
  assertCondition(
    run.bossTimeLeft === null || (typeof run.bossTimeLeft === "number" && Number.isFinite(run.bossTimeLeft)),
    `${path}.run.bossTimeLeft must be number|null`
  );
  const rngState = readRecord(run.rngState, `${path}.run.rngState`);
  readNumber(rngState.seed, `${path}.run.rngState.seed`);

  const roster = readRecord(snapshot.roster, `${path}.roster`);
  readNullableSlotArray(roster.board, `${path}.roster.board`);
  readNullableSlotArray(roster.bench, `${path}.roster.bench`);
  const heroes = readRecord(roster.heroes, `${path}.roster.heroes`);
  Object.entries(heroes).forEach(([key, entry]) => {
    readHeroInstanceLike(entry, `${path}.roster.heroes.${key}`);
  });
  readStringArray(roster.unlockedHeroIds, `${path}.roster.unlockedHeroIds`);
  readNumberRecord(roster.heroSoulByHeroId ?? {}, `${path}.roster.heroSoulByHeroId`);
  readNumberRecord(roster.heroAwakeningByHeroId ?? {}, `${path}.roster.heroAwakeningByHeroId`);

  const meta = readRecord(snapshot.meta, `${path}.meta`);
  [
    "gold",
    "gems",
    "artifactShards",
    "pityCounter",
    "premiumPullCount",
    "prestigePoints",
    "prestigeMultiplier",
    "prestigeCount"
  ].forEach((field) => {
    readNumber(meta[field], `${path}.meta.${field}`);
  });
  const upgrades = readRecord(meta.upgrades, `${path}.meta.upgrades`);
  readNumber(upgrades.tapDamage, `${path}.meta.upgrades.tapDamage`);
  readNumber(upgrades.heroDps, `${path}.meta.upgrades.heroDps`);
  readNumberRecord(meta.talentLevels ?? {}, `${path}.meta.talentLevels`);
  readNumberRecord(meta.artifactLevels ?? {}, `${path}.meta.artifactLevels`);
  readNumberRecord(meta.formationLevels ?? {}, `${path}.meta.formationLevels`);
  assertCondition(
    meta.activeFormationId === null || typeof meta.activeFormationId === "string",
    `${path}.meta.activeFormationId must be string|null`
  );
  readMissionClaimsLike(meta.missionClaims ?? {}, `${path}.meta.missionClaims`);
  const dailyStats = readRecord(meta.dailyStats, `${path}.meta.dailyStats`);
  readString(dailyStats.dayKey, `${path}.meta.dailyStats.dayKey`);
  readNonNegativeNumber(dailyStats.kills, `${path}.meta.dailyStats.kills`);
  readNonNegativeNumber(dailyStats.gachaPulls, `${path}.meta.dailyStats.gachaPulls`);
  const lifetimeStats = readRecord(meta.lifetimeStats, `${path}.meta.lifetimeStats`);
  readNonNegativeNumber(lifetimeStats.kills, `${path}.meta.lifetimeStats.kills`);
  readNonNegativeNumber(lifetimeStats.gachaPulls, `${path}.meta.lifetimeStats.gachaPulls`);
  assertCondition(typeof meta.autoSellCommon === "boolean", `${path}.meta.autoSellCommon must be boolean`);

  const inventory = readRecord(snapshot.inventory, `${path}.inventory`);
  const items = readRecord(inventory.items, `${path}.inventory.items`);
  Object.entries(items).forEach(([key, entry]) => {
    readEquipmentInstanceLike(entry, `${path}.inventory.items.${key}`);
  });
  readStringArray(inventory.order, `${path}.inventory.order`);
  readNonNegativeNumber(inventory.capacity, `${path}.inventory.capacity`);
  assertCondition(Array.isArray(inventory.overflow), `${path}.inventory.overflow must be an array`);
  inventory.overflow.forEach((entry, index) => {
    readOverflowItemLike(entry, `${path}.inventory.overflow[${index}]`);
  });

  const expedition = readRecord(snapshot.expedition, `${path}.expedition`);
  const active = readRecord(expedition.active, `${path}.expedition.active`);
  Object.entries(active).forEach(([key, entry]) => {
    readActiveExpeditionLike(entry, `${path}.expedition.active.${key}`);
  });
  readStringArray(expedition.order, `${path}.expedition.order`);

  const preferences = readRecord(snapshot.preferences, `${path}.preferences`);
  assertCondition(
    typeof preferences.tutorialDismissed === "boolean",
    `${path}.preferences.tutorialDismissed must be boolean`
  );
};

const readVersionedSaveLike = (value: unknown): VersionedSaveEnvelope => {
  const save = readRecord(value, "save");
  readNonNegativeNumber(save.saveSchemaVersion, "save.saveSchemaVersion");
  readString(save.contentVersion, "save.contentVersion");
  readNonNegativeNumber(save.lastProcessedAt, "save.lastProcessedAt");
  readSnapshotLike(save.snapshot, "save.snapshot");
  return save as unknown as VersionedSaveEnvelope;
};

const migrateSaveV1ToV2 = (
  save: VersionedSaveEnvelope
): VersionedSaveEnvelope => {
  const nextSave = cloneSave(save);
  const legacyDispatches = nextSave.snapshot.expedition.active as unknown as Record<
    string,
    {
      dispatchId?: unknown;
      expeditionId?: unknown;
      heroId?: unknown;
      hero?: unknown;
      startedAt?: unknown;
      readyAt?: unknown;
    }
  >;
  const migratedActive: VersionedSaveEnvelope["snapshot"]["expedition"]["active"] = {};

  for (const dispatchId of nextSave.snapshot.expedition.order) {
    const legacyDispatch = legacyDispatches[dispatchId];
    if (!legacyDispatch) {
      continue;
    }

    let hero: HeroInstance;
    if (legacyDispatch.hero !== undefined) {
      hero = readHeroInstanceLike(legacyDispatch.hero, `save.snapshot.expedition.active.${dispatchId}.hero`);
    } else {
      const heroId = readString(legacyDispatch.heroId, `save.snapshot.expedition.active.${dispatchId}.heroId`);
      const matchingInstanceId =
        nextSave.snapshot.roster.bench.find((instanceId) => {
          if (!instanceId) return false;
          return nextSave.snapshot.roster.heroes[instanceId]?.heroId === heroId;
        }) ??
        nextSave.snapshot.roster.board.find((instanceId) => {
          if (!instanceId) return false;
          return nextSave.snapshot.roster.heroes[instanceId]?.heroId === heroId;
        }) ??
        null;

      if (matchingInstanceId) {
        const benchIndex = findSlotIndex(nextSave.snapshot.roster.bench, matchingInstanceId);
        if (benchIndex >= 0) {
          nextSave.snapshot.roster.bench[benchIndex] = null;
        }
        const boardIndex = findSlotIndex(nextSave.snapshot.roster.board, matchingInstanceId);
        if (boardIndex >= 0) {
          nextSave.snapshot.roster.board[boardIndex] = null;
        }
        const rosterHero = nextSave.snapshot.roster.heroes[matchingInstanceId];
        if (rosterHero) {
          hero = structuredClone(rosterHero);
          delete nextSave.snapshot.roster.heroes[matchingInstanceId];
        } else {
          hero = {
            instanceId: matchingInstanceId,
            heroId,
            star: 1,
            level: 1,
            equipment: {}
          };
        }
      } else {
        hero = {
          instanceId: `${dispatchId}_legacy`,
          heroId,
          star: 1,
          level: 1,
          equipment: {}
        };
      }
    }

    migratedActive[dispatchId] = {
      dispatchId,
      expeditionId: readString(
        legacyDispatch.expeditionId,
        `save.snapshot.expedition.active.${dispatchId}.expeditionId`
      ),
      hero,
      startedAt: readNonNegativeNumber(
        legacyDispatch.startedAt,
        `save.snapshot.expedition.active.${dispatchId}.startedAt`
      ),
      readyAt: readNonNegativeNumber(
        legacyDispatch.readyAt,
        `save.snapshot.expedition.active.${dispatchId}.readyAt`
      )
    };
  }

  nextSave.snapshot.expedition.active = migratedActive;
  nextSave.saveSchemaVersion = 2;
  return nextSave;
};

const migrateSave = (save: VersionedSaveEnvelope): VersionedSaveEnvelope => {
  let nextSave = cloneSave(save);
  if (nextSave.saveSchemaVersion > SAVE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported save schema version ${nextSave.saveSchemaVersion}. Current version is ${SAVE_SCHEMA_VERSION}.`
    );
  }

  while (nextSave.saveSchemaVersion < SAVE_SCHEMA_VERSION) {
    if (nextSave.saveSchemaVersion === 1) {
      nextSave = migrateSaveV1ToV2(nextSave);
      continue;
    }
    throw new Error(`No migration path for save schema version ${nextSave.saveSchemaVersion}.`);
  }

  return nextSave;
};

export const normalizeSave = (
  save: VersionedSaveEnvelope,
  content: GameContent
): VersionedSaveEnvelope => {
  const nextSave = cloneSave(save);
  nextSave.saveSchemaVersion = SAVE_SCHEMA_VERSION;
  nextSave.contentVersion ||= content.contentVersion;
  nextSave.snapshot.meta.talentLevels = {
    ...createZeroLevelMap(content.talents),
    ...nextSave.snapshot.meta.talentLevels
  };
  nextSave.snapshot.meta.artifactLevels = {
    ...createZeroLevelMap(content.artifacts),
    ...nextSave.snapshot.meta.artifactLevels
  };
  nextSave.snapshot.meta.formationLevels = {
    ...createZeroLevelMap(content.formations),
    ...nextSave.snapshot.meta.formationLevels
  };
  nextSave.snapshot.inventory.items = Object.fromEntries(
    Object.entries(nextSave.snapshot.inventory.items).filter(([, equipment]) => Boolean(equipment))
  );
  nextSave.snapshot.inventory.order = nextSave.snapshot.inventory.order.filter(
    (instanceId) => Boolean(nextSave.snapshot.inventory.items[instanceId])
  );
  nextSave.snapshot.expedition.order = nextSave.snapshot.expedition.order.filter(
    (dispatchId) => Boolean(nextSave.snapshot.expedition.active[dispatchId])
  );
  nextSave.snapshot.inventory.capacity ||= DEFAULT_INVENTORY_CAPACITY;
  nextSave.snapshot.meta.dailyStats.dayKey ||= getJstDayKey(nextSave.lastProcessedAt);
  nextSave.snapshot.run.enemyMaxHp = calculateEnemyMaxHp(nextSave, content, nextSave.snapshot.run.stage);
  nextSave.snapshot.run.enemyHp = clamp(nextSave.snapshot.run.enemyHp, 0, nextSave.snapshot.run.enemyMaxHp);
  return nextSave;
};

export const serializeSave = (save: VersionedSaveEnvelope): string => JSON.stringify(save);

export const deserializeSave = (raw: string, content: GameContent): VersionedSaveEnvelope => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(error instanceof Error ? `Invalid save JSON: ${error.message}` : "Invalid save JSON");
  }
  const versionedSave = readVersionedSaveLike(parsed);
  return normalizeSave(migrateSave(versionedSave), content);
};

export const compareSaveFreshness = (
  localSave: VersionedSaveEnvelope,
  remoteSave: VersionedSaveEnvelope
): SaveComparison => ({
  localUpdatedAt: localSave.lastProcessedAt,
  remoteUpdatedAt: remoteSave.lastProcessedAt,
  recommended:
    localSave.lastProcessedAt === remoteSave.lastProcessedAt
      ? "useNewest"
      : localSave.lastProcessedAt > remoteSave.lastProcessedAt
        ? "keepLocal"
        : "useRemote"
});

export const getBattleDerivedState = (
  save: VersionedSaveEnvelope,
  content: GameContent
): BattleDerivedState => calculateBattleDerivedState(save, content);

export const advanceByDuration = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  durationMs: number
): CommandResult<{ advancedMs: number }> => {
  const advancedMs = Math.max(0, Math.floor(durationMs));
  const result = advanceSimulation(save, content, save.lastProcessedAt + advancedMs);
  return {
    ...result,
    payload: {
      advancedMs
    }
  };
};

export const grantPlaytestResources = (
  save: VersionedSaveEnvelope,
  grant: PlaytestResourceGrant
): CommandResult => {
  const nextSave = cloneSave(save);
  nextSave.snapshot.meta.gold += Math.max(0, grant.gold ?? 0);
  nextSave.snapshot.meta.gems += Math.max(0, grant.gems ?? 0);
  nextSave.snapshot.meta.artifactShards += Math.max(0, grant.artifactShards ?? 0);
  nextSave.snapshot.meta.prestigePoints += Math.max(0, grant.prestigePoints ?? 0);
  return {
    save: nextSave,
    events: ["playtest resources を付与した"]
  };
};

export const setPlaytestStage = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  stage: number
): CommandResult<{ stage: number }> => {
  const nextSave = cloneSave(save);
  const nextStage = Math.max(1, Math.floor(stage));
  nextSave.snapshot.run.stage = nextStage;
  nextSave.snapshot.run.highestStage = Math.max(nextSave.snapshot.run.highestStage, nextStage);
  nextSave.snapshot.run.enemyMaxHp = calculateEnemyMaxHp(nextSave, content, nextStage);
  nextSave.snapshot.run.enemyHp = nextSave.snapshot.run.enemyMaxHp;
  nextSave.snapshot.run.bossTimeLeft = isBossStage(content, nextStage)
    ? content.stageRules.bossTimerSeconds
    : null;
  return {
    save: nextSave,
    events: [`playtest stage を ${nextStage} に変更した`],
    payload: { stage: nextStage }
  };
};

export const autoDeployBench = (save: VersionedSaveEnvelope): CommandResult<{ moved: number }> => {
  const nextSave = cloneSave(save);
  let moved = 0;
  let merged = 0;

  for (const [benchIndex, instanceId] of nextSave.snapshot.roster.bench.entries()) {
    if (!instanceId) {
      continue;
    }

    const sourceHero = nextSave.snapshot.roster.heroes[instanceId];
    if (!sourceHero) {
      continue;
    }

    const mergeIndex = nextSave.snapshot.roster.board.findIndex((boardInstanceId) => {
      if (!boardInstanceId || boardInstanceId === instanceId) {
        return false;
      }

      const targetHero = nextSave.snapshot.roster.heroes[boardInstanceId];
      return (
        targetHero !== undefined &&
        targetHero.heroId === sourceHero.heroId &&
        targetHero.star === sourceHero.star &&
        targetHero.star < 3
      );
    });

    if (mergeIndex >= 0) {
      const targetId = nextSave.snapshot.roster.board[mergeIndex];
      if (targetId) {
        nextSave.snapshot.roster.heroes[targetId]!.star += 1;
        delete nextSave.snapshot.roster.heroes[instanceId];
        nextSave.snapshot.roster.bench[benchIndex] = null;
        merged += 1;
        moved += 1;
      }
      continue;
    }

    const emptyBoardIndex = nextSave.snapshot.roster.board.findIndex((entry) => entry === null);
    if (emptyBoardIndex < 0) {
      break;
    }

    nextSave.snapshot.roster.board[emptyBoardIndex] = instanceId;
    nextSave.snapshot.roster.bench[benchIndex] = null;
    moved += 1;
  }

  const events: string[] = [];
  if (moved > 0) {
    events.push(`bench から ${moved} 体を盤面へ反映した`);
  }
  if (merged > 0) {
    events.push(`${merged} 件の merge を適用した`);
  }

  return {
    save: nextSave,
    events,
    payload: { moved }
  };
};

export const advanceSimulation = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  now: number
): CommandResult => {
  let nextSave = ensureDailyReset(normalizeSave(save, content), now);
  const events: string[] = [];
  const capMs =
    Math.max(content.stageRules.offlineCapMinutes, DEFAULT_OFFLINE_CAP_MINUTES) * 60 * 1000;
  let remainingSeconds = Math.max(0, Math.min(now - nextSave.lastProcessedAt, capMs)) / 1000;

  if (remainingSeconds <= 0) {
    nextSave.lastProcessedAt = now;
    return { save: nextSave, events };
  }

  let safety = 0;
  while (remainingSeconds > 0.0001 && safety < 5000) {
    safety += 1;
    const derived = calculateBattleDerivedState(nextSave, content);
    if (derived.totalDps <= 0) {
      break;
    }

    if (derived.isBoss && nextSave.snapshot.run.bossTimeLeft !== null) {
      const regenPerSecond =
        derived.bossAffix === "REGEN" ? nextSave.snapshot.run.enemyMaxHp * 0.01 : 0;
      const effectiveDps = Math.max(0, derived.totalDps - regenPerSecond);
      const killSeconds =
        effectiveDps > 0 ? nextSave.snapshot.run.enemyHp / effectiveDps : Number.POSITIVE_INFINITY;
      const timeoutSeconds = nextSave.snapshot.run.bossTimeLeft;
      const stepSeconds = Math.min(remainingSeconds, timeoutSeconds, killSeconds);

      if (Number.isFinite(stepSeconds) && effectiveDps > 0) {
        nextSave.snapshot.run.enemyHp = Math.max(
          0,
          nextSave.snapshot.run.enemyHp - effectiveDps * stepSeconds
        );
      }
      nextSave.snapshot.run.bossTimeLeft = Math.max(0, timeoutSeconds - stepSeconds);
      remainingSeconds -= stepSeconds;

      if (stepSeconds === killSeconds && nextSave.snapshot.run.enemyHp <= 0) {
        const result = applyBattleRewards(nextSave, content, now);
        nextSave = result.save;
        events.push(...result.events);
        continue;
      }

      if (stepSeconds === timeoutSeconds && (nextSave.snapshot.run.bossTimeLeft ?? 0) <= 0) {
        nextSave.snapshot.run.stage = Math.max(1, nextSave.snapshot.run.stage - 1);
        nextSave.snapshot.run.enemyMaxHp = calculateEnemyMaxHp(nextSave, content, nextSave.snapshot.run.stage);
        nextSave.snapshot.run.enemyHp = nextSave.snapshot.run.enemyMaxHp;
        nextSave.snapshot.run.bossTimeLeft = isBossStage(content, nextSave.snapshot.run.stage)
          ? content.stageRules.bossTimerSeconds
          : null;
        events.push("ボスに時間切れで敗北した");
        continue;
      }

      break;
    }

    const killSeconds = nextSave.snapshot.run.enemyHp / derived.totalDps;
    const stepSeconds = Math.min(remainingSeconds, killSeconds);
    nextSave.snapshot.run.enemyHp = Math.max(0, nextSave.snapshot.run.enemyHp - derived.totalDps * stepSeconds);
    remainingSeconds -= stepSeconds;
    if (stepSeconds === killSeconds && nextSave.snapshot.run.enemyHp <= 0) {
      const result = applyBattleRewards(nextSave, content, now);
      nextSave = result.save;
      events.push(...result.events);
    } else {
      break;
    }
  }

  nextSave.lastProcessedAt = now;
  return { save: nextSave, events };
};

export const tapEnemy = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  now: number
): CommandResult<{ damage: number; critical: boolean }> => {
  let nextSave = advanceSimulation(save, content, now).save;
  const [roll, rolledSave] = nextRoll(nextSave);
  nextSave = rolledSave;
  const derived = calculateBattleDerivedState(nextSave, content);
  const critical = roll < 0.1;
  const damage = derived.tapDamage * (critical ? 3 : 1);
  nextSave.snapshot.run.enemyHp = Math.max(0, nextSave.snapshot.run.enemyHp - damage);
  const settled = settleBattleAfterDirectDamage(nextSave, content, now);
  settled.save.lastProcessedAt = now;
  return {
    save: settled.save,
    events: [`${critical ? "クリティカル" : "タップ"}で ${Math.floor(damage)} ダメージ`, ...settled.events],
    payload: {
      damage,
      critical
    }
  };
};

export const pullGacha = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  bannerId: string,
  count: number,
  now: number
): CommandResult<GachaResult> => {
  const lookups = getLookups(content);
  const banner = lookups.bannersById[bannerId];
  if (!banner) {
    throw new Error(`Unknown banner: ${bannerId}`);
  }

  let nextSave = advanceSimulation(save, content, now).save;
  const totalCount = Math.max(1, count);
  const costPerPull =
    banner.kind === "normal" ? Math.max(1, Math.floor(banner.cost * getNormalBannerDiscount(nextSave))) : banner.cost;
  const totalCost = costPerPull * totalCount;
  if (banner.currency === "gold" && nextSave.snapshot.meta.gold < totalCost) {
    return { save: nextSave, events: ["ゴールドが不足している"], payload: { banner, pulls: [] } };
  }
  if (banner.currency === "gems" && nextSave.snapshot.meta.gems < totalCost) {
    return { save: nextSave, events: ["ジェムが不足している"], payload: { banner, pulls: [] } };
  }

  if (banner.currency === "gold") nextSave.snapshot.meta.gold -= totalCost;
  else nextSave.snapshot.meta.gems -= totalCost;

  const pulls: HeroInstance[] = [];
  for (let index = 0; index < totalCount; index += 1) {
    const rates = buildBannerRates(nextSave, banner);
    let rarity: Rarity;
    if (banner.kind === "premium") {
      nextSave.snapshot.meta.pityCounter += 1;
      if (nextSave.snapshot.meta.pityCounter >= (banner.pityLimit ?? 30)) {
        rarity = banner.guaranteeRarity ?? "SSR";
        nextSave.snapshot.meta.pityCounter = 0;
      } else {
        const rolled = rollWeightedRarity(nextSave, rates);
        rarity = rolled[0];
        nextSave = rolled[1];
        if (rarity === "SSR" || rarity === "UR") {
          nextSave.snapshot.meta.pityCounter = 0;
        }
      }
      nextSave.snapshot.meta.premiumPullCount += 1;
    } else {
      const rolled = rollWeightedRarity(nextSave, rates);
      rarity = rolled[0];
      nextSave = rolled[1];
    }

    nextSave.snapshot.meta.lifetimeStats.gachaPulls += 1;
    nextSave.snapshot.meta.dailyStats.gachaPulls += 1;

    if (nextSave.snapshot.meta.autoSellCommon && rarity === "N") {
      nextSave.snapshot.meta.gold += 10;
      continue;
    }

    const rarityPool = banner.poolHeroIds.filter(
      (heroId) => lookups.heroesById[heroId]?.rarity === rarity
    );
    const [heroId, poolSave] = rollPoolHeroId(nextSave, rarityPool.length > 0 ? rarityPool : banner.poolHeroIds);
    nextSave = poolSave;
    if (!heroId) {
      continue;
    }

    if (!nextSave.snapshot.roster.unlockedHeroIds.includes(heroId)) {
      nextSave.snapshot.roster.unlockedHeroIds.push(heroId);
    } else {
      nextSave.snapshot.roster.heroSoulByHeroId[heroId] =
        (nextSave.snapshot.roster.heroSoulByHeroId[heroId] ?? 0) + 1;
    }

    const [heroInstance, instanceSave] = createHeroInstance(nextSave, heroId);
    nextSave = addHeroToBenchOrOverflow(instanceSave, heroInstance, now);
    pulls.push(heroInstance);
  }

  nextSave.lastProcessedAt = now;
  return {
    save: nextSave,
    events: [`${banner.name} を ${totalCount} 回引いた`],
    payload: {
      banner,
      pulls
    }
  };
};

export const moveHero = (
  save: VersionedSaveEnvelope,
  from: SlotRef,
  to: SlotRef
): CommandResult => {
  const nextSave = cloneSave(save);
  const fromSlots = from.area === "board" ? nextSave.snapshot.roster.board : nextSave.snapshot.roster.bench;
  const toSlots = to.area === "board" ? nextSave.snapshot.roster.board : nextSave.snapshot.roster.bench;
  const sourceId = fromSlots[from.index];
  const targetId = toSlots[to.index];
  if (!sourceId) {
    return { save: nextSave, events: [] };
  }

  const sourceHero = nextSave.snapshot.roster.heroes[sourceId];
  const targetHero = targetId ? nextSave.snapshot.roster.heroes[targetId] : null;

  if (
    sourceHero &&
    targetHero &&
    sourceHero.heroId === targetHero.heroId &&
    sourceHero.star === targetHero.star &&
    sourceHero.star < 3
  ) {
    targetHero.star += 1;
    delete nextSave.snapshot.roster.heroes[sourceId];
    fromSlots[from.index] = null;
    return { save: nextSave, events: ["ヒーローを合成した"] };
  }

  fromSlots[from.index] = targetId ?? null;
  toSlots[to.index] = sourceId;
  return { save: nextSave, events: ["編成を入れ替えた"] };
};

export const levelHero = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  slot: SlotRef
): CommandResult => {
  const nextSave = cloneSave(save);
  const slots = slot.area === "board" ? nextSave.snapshot.roster.board : nextSave.snapshot.roster.bench;
  const instanceId = slots[slot.index];
  if (!instanceId) {
    return { save: nextSave, events: [] };
  }
  const heroInstance = nextSave.snapshot.roster.heroes[instanceId];
  if (!heroInstance) {
    return { save: nextSave, events: [] };
  }
  const cost = getHeroLevelUpCost(nextSave, content, heroInstance);
  if (nextSave.snapshot.meta.gold < cost) {
    return { save: nextSave, events: ["ゴールドが不足している"] };
  }
  nextSave.snapshot.meta.gold -= cost;
  heroInstance.level += 1;
  return { save: nextSave, events: [`Lv.${heroInstance.level} に強化した`] };
};

export const listMissionViews = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  now: number
): MissionView[] => {
  const dayKey = getJstDayKey(now);
  return content.missions.map((mission) => {
    const claimState = save.snapshot.meta.missionClaims[mission.id];
    const claimed =
      mission.kind === "daily"
        ? claimState?.claimedDayKey === dayKey
        : Boolean(claimState?.claimed);
    const progress = Math.min(getMissionProgress(save, mission), mission.target);
    return {
      id: mission.id,
      title: mission.title,
      description: mission.description,
      kind: mission.kind,
      progress,
      target: mission.target,
      claimed,
      claimable: !claimed && progress >= mission.target,
      reward: mission.reward
    };
  });
};

export const claimMission = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  missionId: string,
  now: number
): CommandResult => {
  const mission = content.missions.find((entry) => entry.id === missionId);
  if (!mission) {
    return { save, events: [] };
  }
  const nextSave = cloneSave(save);
  const missionView = listMissionViews(nextSave, content, now).find((entry) => entry.id === missionId);
  if (!missionView?.claimable) {
    return { save: nextSave, events: [] };
  }
  nextSave.snapshot.meta.gold += mission.reward.gold ?? 0;
  nextSave.snapshot.meta.gems += mission.reward.gems ?? 0;
  nextSave.snapshot.meta.artifactShards += mission.reward.artifactShards ?? 0;
  nextSave.snapshot.meta.missionClaims[missionId] =
    mission.kind === "daily"
      ? {
          claimed: true,
          claimedDayKey: getJstDayKey(now)
        }
      : {
          claimed: true
        };
  return { save: nextSave, events: [`${mission.title} の報酬を受け取った`] };
};

export const buyUpgrade = (
  save: VersionedSaveEnvelope,
  kind: keyof GameSnapshot["meta"]["upgrades"]
): CommandResult => {
  const nextSave = cloneSave(save);
  const currentLevel = nextSave.snapshot.meta.upgrades[kind];
  const cost = getUpgradeCost(currentLevel);
  if (nextSave.snapshot.meta.gold < cost) {
    return { save: nextSave, events: ["ゴールドが不足している"] };
  }
  nextSave.snapshot.meta.gold -= cost;
  nextSave.snapshot.meta.upgrades[kind] += 1;
  return { save: nextSave, events: [`${kind} を強化した`] };
};

export const prestige = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  now: number
): CommandResult => {
  const pointsToGain = Math.floor(save.snapshot.run.stage / content.stageRules.bossInterval);
  if (pointsToGain <= 0) {
    return { save, events: ["転生条件を満たしていない"] };
  }

  const nextSave = createNewGame({
    now,
    content,
    seed: save.snapshot.run.rngState.seed,
    contentVersion: save.contentVersion
  });
  const startingStageBonus = save.snapshot.meta.talentLevels.starting_stage ?? 0;
  const startStage = Math.max(
    1,
    Math.min(1 + startingStageBonus, Math.max(1, save.snapshot.run.stage - content.stageRules.bossInterval))
  );
  nextSave.snapshot.run.stage = startStage;
  nextSave.snapshot.run.highestStage = startStage;
  nextSave.snapshot.run.enemyMaxHp = calculateEnemyMaxHp(nextSave, content, startStage);
  nextSave.snapshot.run.enemyHp = nextSave.snapshot.run.enemyMaxHp;
  nextSave.snapshot.run.bossTimeLeft = isBossStage(content, startStage)
    ? content.stageRules.bossTimerSeconds
    : null;

  nextSave.snapshot.meta.prestigePoints = save.snapshot.meta.prestigePoints + pointsToGain;
  nextSave.snapshot.meta.prestigeMultiplier = save.snapshot.meta.prestigeMultiplier + pointsToGain * 0.1;
  nextSave.snapshot.meta.prestigeCount = save.snapshot.meta.prestigeCount + 1;
  nextSave.snapshot.meta.talentLevels = structuredClone(save.snapshot.meta.talentLevels);
  nextSave.snapshot.meta.artifactLevels = structuredClone(save.snapshot.meta.artifactLevels);
  nextSave.snapshot.meta.formationLevels = structuredClone(save.snapshot.meta.formationLevels);
  nextSave.snapshot.meta.activeFormationId = save.snapshot.meta.activeFormationId;
  nextSave.snapshot.meta.missionClaims = structuredClone(save.snapshot.meta.missionClaims);
  nextSave.snapshot.meta.lifetimeStats = structuredClone(save.snapshot.meta.lifetimeStats);
  nextSave.snapshot.meta.autoSellCommon = save.snapshot.meta.autoSellCommon;
  nextSave.snapshot.meta.artifactShards = save.snapshot.meta.artifactShards;
  nextSave.snapshot.roster.unlockedHeroIds = structuredClone(save.snapshot.roster.unlockedHeroIds);
  nextSave.snapshot.roster.heroSoulByHeroId = structuredClone(save.snapshot.roster.heroSoulByHeroId);
  nextSave.snapshot.roster.heroAwakeningByHeroId = structuredClone(save.snapshot.roster.heroAwakeningByHeroId);
  nextSave.lastProcessedAt = now;
  return { save: nextSave, events: [`転生して ${pointsToGain} ポイントを獲得した`] };
};

export const upgradeTalent = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  talentId: string
): CommandResult => {
  const talent = content.talents.find((entry) => entry.id === talentId);
  if (!talent) return { save, events: [] };
  const nextSave = cloneSave(save);
  const level = nextSave.snapshot.meta.talentLevels[talentId] ?? 0;
  if (level >= talent.maxLevel) return { save: nextSave, events: [] };
  const cost = getTalentUpgradeCost(nextSave, content, talentId);
  if (nextSave.snapshot.meta.prestigePoints < cost) {
    return { save: nextSave, events: ["転生ポイントが不足している"] };
  }
  nextSave.snapshot.meta.prestigePoints -= cost;
  nextSave.snapshot.meta.talentLevels[talentId] = level + 1;
  return { save: nextSave, events: [`${talent.name} を強化した`] };
};

export const upgradeArtifact = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  artifactId: string
): CommandResult => {
  const artifact = content.artifacts.find((entry) => entry.id === artifactId);
  if (!artifact) return { save, events: [] };
  const nextSave = cloneSave(save);
  const level = nextSave.snapshot.meta.artifactLevels[artifactId] ?? 0;
  if (level >= artifact.maxLevel) return { save: nextSave, events: [] };
  const cost = getArtifactUpgradeCost(nextSave, content, artifactId);
  if (nextSave.snapshot.meta.prestigePoints < cost) {
    return { save: nextSave, events: ["転生ポイントが不足している"] };
  }
  nextSave.snapshot.meta.prestigePoints -= cost;
  nextSave.snapshot.meta.artifactLevels[artifactId] = level + 1;
  return { save: nextSave, events: [`${artifact.name} を強化した`] };
};

export const artifactGacha = (
  save: VersionedSaveEnvelope,
  content: GameContent
): CommandResult<{ artifactId: string | null }> => {
  const nextSave = cloneSave(save);
  if (nextSave.snapshot.meta.artifactShards < 10) {
    return { save: nextSave, events: ["欠片が不足している"], payload: { artifactId: null } };
  }
  const candidates = content.artifacts.filter(
    (artifact) => (nextSave.snapshot.meta.artifactLevels[artifact.id] ?? 0) < artifact.maxLevel
  );
  if (candidates.length === 0) {
    return { save: nextSave, events: ["強化可能な遺物がない"], payload: { artifactId: null } };
  }
  nextSave.snapshot.meta.artifactShards -= 10;
  const [roll, rolledSave] = nextRoll(nextSave);
  const selected = candidates[Math.floor(roll * candidates.length) % candidates.length] ?? candidates[0]!;
  rolledSave.snapshot.meta.artifactLevels[selected.id] =
    (rolledSave.snapshot.meta.artifactLevels[selected.id] ?? 0) + 1;
  return { save: rolledSave, events: [`${selected.name} を引き当てた`], payload: { artifactId: selected.id } };
};

export const upgradeFormation = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  formationId: string
): CommandResult => {
  const formation = content.formations.find((entry) => entry.id === formationId);
  if (!formation) return { save, events: [] };
  const nextSave = cloneSave(save);
  const level = nextSave.snapshot.meta.formationLevels[formationId] ?? 0;
  const cost = getFormationUpgradeCost(nextSave, content, formationId);
  if (nextSave.snapshot.meta.gems < cost) {
    return { save: nextSave, events: ["ジェムが不足している"] };
  }
  nextSave.snapshot.meta.gems -= cost;
  nextSave.snapshot.meta.formationLevels[formationId] = level + 1;
  if (nextSave.snapshot.meta.activeFormationId === null) {
    nextSave.snapshot.meta.activeFormationId = formationId;
  }
  return { save: nextSave, events: [`${formation.name} を強化した`] };
};

export const setActiveFormation = (
  save: VersionedSaveEnvelope,
  formationId: string | null
): CommandResult => {
  const nextSave = cloneSave(save);
  if (formationId !== null && (nextSave.snapshot.meta.formationLevels[formationId] ?? 0) <= 0) {
    return { save: nextSave, events: ["陣形が未解放"] };
  }
  nextSave.snapshot.meta.activeFormationId = formationId;
  return { save: nextSave, events: [formationId ? "陣形を変更した" : "陣形を解除した"] };
};

export const dispatchExpedition = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  expeditionId: string,
  heroInstanceId: string,
  now: number
): CommandResult => {
  const expedition = content.expeditions.find((entry) => entry.id === expeditionId);
  if (!expedition) return { save, events: [] };
  const nextSave = advanceSimulation(save, content, now).save;
  if (nextSave.snapshot.run.highestStage < expedition.unlockStage) {
    return { save: nextSave, events: ["ステージ条件を満たしていない"] };
  }
  const alreadyDispatched = Object.values(nextSave.snapshot.expedition.active).some(
    (dispatch) => dispatch.hero.instanceId === heroInstanceId
  );
  if (alreadyDispatched) {
    return { save: nextSave, events: ["そのヒーローは既に派遣中"] };
  }
  const extracted = extractBenchHero(nextSave, heroInstanceId);
  if (!extracted.hero) {
    return { save: nextSave, events: ["bench のヒーローだけ派遣できる"] };
  }
  const [dispatchId, dispatchSave] = nextId(extracted.save, "dispatch");
  dispatchSave.snapshot.expedition.active[dispatchId] = {
    dispatchId,
    expeditionId,
    hero: extracted.hero,
    startedAt: now,
    readyAt: now + expedition.durationMinutes * 60 * 1000
  };
  dispatchSave.snapshot.expedition.order.unshift(dispatchId);
  dispatchSave.lastProcessedAt = now;
  return {
    save: dispatchSave,
    events: [`${extracted.hero.heroId} を ${expedition.name} へ派遣した`]
  };
};

export const applyPlaytestPreset = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  preset: PlaytestPreset,
  now: number
): CommandResult<{ preset: PlaytestPreset }> => {
  const baseSave = createNewGame({
    now,
    content,
    seed: save.snapshot.run.rngState.seed,
    contentVersion: save.contentVersion
  });
  const normalBannerId =
    content.banners.find((banner) => banner.kind === "normal")?.id ?? content.banners[0]?.id;
  const premiumBannerId =
    content.banners.find((banner) => banner.kind === "premium")?.id ??
    content.banners.find((banner) => banner.kind !== "normal")?.id ??
    content.banners[0]?.id;

  let nextSave = grantPlaytestResources(baseSave, {
    gold: 25_000,
    gems: 12_000,
    artifactShards: 120,
    prestigePoints: 40
  }).save;

  const deployBenchToBoard = (sourceSave: VersionedSaveEnvelope, slots: number[]): VersionedSaveEnvelope => {
    let deployedSave = sourceSave;
    for (const targetIndex of slots) {
      const benchIndex = deployedSave.snapshot.roster.bench.findIndex((instanceId) => instanceId !== null);
      if (benchIndex < 0) {
        break;
      }
      deployedSave = moveHero(
        deployedSave,
        { area: "bench", index: benchIndex },
        { area: "board", index: targetIndex }
      ).save;
    }
    return deployedSave;
  };

  if (normalBannerId) {
    nextSave = pullGacha(nextSave, content, normalBannerId, preset === "midgame" ? 6 : 4, now).save;
  }
  if (premiumBannerId) {
    nextSave = pullGacha(nextSave, content, premiumBannerId, 2, now).save;
  }
  nextSave = deployBenchToBoard(nextSave, preset === "midgame" ? [0, 1, 2, 3, 4, 5] : [0, 1, 2]);

  if (preset === "midgame") {
    if (normalBannerId) {
      nextSave = pullGacha(nextSave, content, normalBannerId, 2, now).save;
    }
    if (premiumBannerId) {
      nextSave = pullGacha(nextSave, content, premiumBannerId, 2, now).save;
    }
    nextSave = grantPlaytestResources(nextSave, {
      gold: 300_000,
      gems: 30_000,
      artifactShards: 400,
      prestigePoints: 120
    }).save;
    nextSave = setPlaytestStage(nextSave, content, 35).save;

    nextSave.snapshot.meta.talentLevels.base_dps = 5;
    nextSave.snapshot.meta.talentLevels.gold_gain = 4;
    nextSave.snapshot.meta.talentLevels.equipment_drop_rate = 5;
    nextSave.snapshot.meta.artifactLevels.gold_rin = 3;
    nextSave.snapshot.meta.artifactLevels.boss_sla = 2;
    nextSave.snapshot.meta.formationLevels.cross = 1;
    nextSave.snapshot.meta.activeFormationId = "cross";

    for (const tierId of ["weapon-r", "armor-r", "weapon-sr", "accessory-sr"]) {
      const [equipment, equipmentSave] = createEquipmentInstance(nextSave, tierId);
      nextSave = addEquipmentToInventoryOrOverflow(equipmentSave, equipment, now);
    }

    const expeditionCandidates = content.expeditions
      .filter((expedition) => expedition.unlockStage <= nextSave.snapshot.run.highestStage)
      .slice(0, 2);
    const availableHeroes = nextSave.snapshot.roster.bench.filter(
      (instanceId): instanceId is string => instanceId !== null
    );
    for (const [index, expedition] of expeditionCandidates.entries()) {
      const heroInstanceId = availableHeroes[index];
      if (!heroInstanceId) {
        break;
      }
      nextSave = dispatchExpedition(nextSave, content, expedition.id, heroInstanceId, now).save;
    }
  }

  return {
    save: nextSave,
    events: [`${preset} preset を適用した`],
    payload: { preset }
  };
};

export const claimExpedition = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  dispatchId: string,
  now: number
): CommandResult => {
  let nextSave = advanceSimulation(save, content, now).save;
  const dispatch = nextSave.snapshot.expedition.active[dispatchId];
  if (!dispatch || dispatch.readyAt > now) {
    return { save: nextSave, events: [] };
  }
  const expedition = content.expeditions.find((entry) => entry.id === dispatch.expeditionId);
  if (!expedition) {
    return { save: nextSave, events: [] };
  }
  if (expedition.reward.kind === "gold") nextSave.snapshot.meta.gold += expedition.reward.amount;
  if (expedition.reward.kind === "gems") nextSave.snapshot.meta.gems += expedition.reward.amount;
  if (expedition.reward.kind === "artifactShards")
    nextSave.snapshot.meta.artifactShards += expedition.reward.amount;
  delete nextSave.snapshot.expedition.active[dispatchId];
  nextSave.snapshot.expedition.order = nextSave.snapshot.expedition.order.filter((id) => id !== dispatchId);
  nextSave = addHeroToBenchOrOverflow(nextSave, dispatch.hero, now);
  nextSave.lastProcessedAt = now;
  return { save: nextSave, events: [`${dispatch.hero.heroId} が ${expedition.name} から帰還した`] };
};

export const claimAllExpeditions = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  now: number
): CommandResult<{ count: number }> => {
  let nextSave = advanceSimulation(save, content, now).save;
  let count = 0;
  for (const dispatchId of [...nextSave.snapshot.expedition.order]) {
    const dispatch = nextSave.snapshot.expedition.active[dispatchId];
    if (dispatch && dispatch.readyAt <= now) {
      const result = claimExpedition(nextSave, content, dispatchId, now);
      nextSave = result.save;
      count += 1;
    }
  }
  return {
    save: nextSave,
    events: count > 0 ? [`${count} 件の派遣報酬を受け取った`] : [],
    payload: { count }
  };
};

export const equipItem = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  heroInstanceId: string,
  equipmentInstanceId: string
): CommandResult => {
  const nextSave = cloneSave(save);
  const heroInstance = nextSave.snapshot.roster.heroes[heroInstanceId];
  const equipmentInstance = nextSave.snapshot.inventory.items[equipmentInstanceId];
  const isStoredInInventory = nextSave.snapshot.inventory.order.includes(equipmentInstanceId);
  if (!heroInstance || !equipmentInstance || !isStoredInInventory) {
    return { save: nextSave, events: [] };
  }
  const lookups = getLookups(content);
  const tier = getEquipmentTier(lookups, equipmentInstance.tierId);
  const previousItemId = heroInstance.equipment[tier.type];
  if (previousItemId === equipmentInstanceId) {
    return { save: nextSave, events: [] };
  }
  heroInstance.equipment[tier.type] = equipmentInstanceId;
  nextSave.snapshot.inventory.order = nextSave.snapshot.inventory.order.filter((id) => id !== equipmentInstanceId);
  if (previousItemId) {
    const previousItem = nextSave.snapshot.inventory.items[previousItemId];
    if (previousItem) {
      return {
        save: stashUnequippedItem(nextSave, structuredClone(previousItem), save.lastProcessedAt),
        events: [`${tier.name} を装備した`]
      };
    }
  }
  return { save: nextSave, events: [`${tier.name} を装備した`] };
};

export const sellEquipment = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  equipmentInstanceId: string
): CommandResult => {
  const nextSave = cloneSave(save);
  const equipmentInstance = nextSave.snapshot.inventory.items[equipmentInstanceId];
  if (!equipmentInstance) {
    return { save: nextSave, events: [] };
  }
  const lookups = getLookups(content);
  const tier = getEquipmentTier(lookups, equipmentInstance.tierId);
  nextSave.snapshot.meta.gold += tier.sellPrice;
  delete nextSave.snapshot.inventory.items[equipmentInstanceId];
  nextSave.snapshot.inventory.order = nextSave.snapshot.inventory.order.filter((id) => id !== equipmentInstanceId);
  return { save: nextSave, events: [`${tier.name} を売却した`] };
};

export const synthesizeEquipment = (
  save: VersionedSaveEnvelope,
  content: GameContent,
  equipmentInstanceIds: string[]
): CommandResult<SynthResult> => {
  if (equipmentInstanceIds.length !== 3) {
    return { save, events: ["装備は 3 個必要"] };
  }
  const nextSave = cloneSave(save);
  const lookups = getLookups(content);
  const instances = equipmentInstanceIds
    .map((id) => nextSave.snapshot.inventory.items[id])
    .filter(Boolean);
  if (instances.length !== 3) {
    return { save: nextSave, events: ["所持していない装備が含まれる"] };
  }
  const tiers = instances.map((instance) => getEquipmentTier(lookups, instance!.tierId));
  const sourceType = tiers[0]?.type;
  const sourceRarity = tiers[0]?.rarity;
  if (
    !sourceType ||
    !sourceRarity ||
    sourceRarity === "UR" ||
    !tiers.every((tier) => tier.type === sourceType && tier.rarity === sourceRarity)
  ) {
    return { save: nextSave, events: ["同じ部位・同じレアリティの装備 3 個が必要"] };
  }
  const targetRarity = rarityOrder[rarityIndex(sourceRarity) + 1];
  const targetTier = content.equipment.find(
    (tier) => tier.type === sourceType && tier.rarity === targetRarity
  );
  if (!targetTier) {
    return { save: nextSave, events: ["合成先の装備が見つからない"] };
  }
  for (const equipmentId of equipmentInstanceIds) {
    delete nextSave.snapshot.inventory.items[equipmentId];
    nextSave.snapshot.inventory.order = nextSave.snapshot.inventory.order.filter((id) => id !== equipmentId);
  }
  const [equipmentInstance, equipmentSave] = createEquipmentInstance(nextSave, targetTier.id);
  const insertedSave = addEquipmentToInventoryOrOverflow(equipmentSave, equipmentInstance, nextSave.lastProcessedAt);
  return {
    save: insertedSave,
    events: [`${targetTier.name} を合成した`],
    payload: {
      createdItemId: equipmentInstance.instanceId,
      createdTierId: targetTier.id
    }
  };
};

export const awakenHero = (
  save: VersionedSaveEnvelope,
  heroId: string
): CommandResult => {
  const nextSave = cloneSave(save);
  const currentLevel = nextSave.snapshot.roster.heroAwakeningByHeroId[heroId] ?? 0;
  const requiredSouls = (currentLevel + 1) * 5;
  const currentSouls = nextSave.snapshot.roster.heroSoulByHeroId[heroId] ?? 0;
  if (currentLevel >= 5 || currentSouls < requiredSouls) {
    return { save: nextSave, events: [] };
  }
  nextSave.snapshot.roster.heroSoulByHeroId[heroId] = currentSouls - requiredSouls;
  nextSave.snapshot.roster.heroAwakeningByHeroId[heroId] = currentLevel + 1;
  return { save: nextSave, events: [`${heroId} を覚醒した`] };
};

export const claimOverflowItem = (
  save: VersionedSaveEnvelope,
  itemId: string,
  now: number
): CommandResult => {
  const nextSave = cloneSave(save);
  const index = nextSave.snapshot.inventory.overflow.findIndex((item) => item.id === itemId);
  if (index < 0) {
    return { save: nextSave, events: [] };
  }
  const [item] = nextSave.snapshot.inventory.overflow.splice(index, 1);
  if (!item) {
    return { save: nextSave, events: [] };
  }
  if (item.hero) {
    const beforeLength = nextSave.snapshot.inventory.overflow.length;
    const insertedSave = addHeroToBenchOrOverflow(nextSave, item.hero, now);
    if (insertedSave.snapshot.inventory.overflow.length > beforeLength) {
      return { save: insertedSave, events: ["ベンチに空きがない"] };
    }
    return { save: insertedSave, events: ["オーバーフローからヒーローを回収した"] };
  }
  if (item.equipment) {
    const beforeLength = nextSave.snapshot.inventory.overflow.length;
    const insertedSave = addEquipmentToInventoryOrOverflow(nextSave, item.equipment, now);
    if (insertedSave.snapshot.inventory.overflow.length > beforeLength) {
      return { save: insertedSave, events: ["インベントリに空きがない"] };
    }
    return { save: insertedSave, events: ["オーバーフローから装備を回収した"] };
  }
  return { save: nextSave, events: [] };
};

export const toggleAutoSellCommon = (save: VersionedSaveEnvelope): CommandResult => {
  const nextSave = cloneSave(save);
  nextSave.snapshot.meta.autoSellCommon = !nextSave.snapshot.meta.autoSellCommon;
  return {
    save: nextSave,
    events: [`N 自動売却を ${nextSave.snapshot.meta.autoSellCommon ? "ON" : "OFF"} にした`]
  };
};

export const dismissTutorial = (save: VersionedSaveEnvelope): CommandResult => {
  const nextSave = cloneSave(save);
  nextSave.snapshot.preferences.tutorialDismissed = true;
  return { save: nextSave, events: [] };
};

export const getBattleSummary = (save: VersionedSaveEnvelope, content: GameContent): BattleSummary => {
  const derived = calculateBattleDerivedState(save, content);
  return {
    stage: save.snapshot.run.stage,
    highestStage: save.snapshot.run.highestStage,
    enemyHp: save.snapshot.run.enemyHp,
    enemyMaxHp: save.snapshot.run.enemyMaxHp,
    bossTimeLeft: save.snapshot.run.bossTimeLeft,
    totalDps: derived.totalDps,
    tapDamage: derived.tapDamage,
    isBoss: derived.isBoss,
    enemyElement: derived.enemyElement,
    enemyTrait: derived.enemyTrait,
    bossAffix: derived.bossAffix
  };
};

export const getCollectionEntries = (
  save: VersionedSaveEnvelope,
  content: GameContent
): CollectionEntry[] =>
  content.heroes.map((hero) => {
    const awakeningLevel = save.snapshot.roster.heroAwakeningByHeroId[hero.id] ?? 0;
    return {
      heroId: hero.id,
      unlocked: save.snapshot.roster.unlockedHeroIds.includes(hero.id),
      awakeningLevel,
      soulCount: save.snapshot.roster.heroSoulByHeroId[hero.id] ?? 0,
      nextAwakeningCost: (awakeningLevel + 1) * 5
    };
  });

export const getHeroPlacements = (
  save: VersionedSaveEnvelope,
  content: GameContent
): HeroPlacementView[] => {
  const lookups = getLookups(content);
  return [
    ...save.snapshot.roster.board.map((instanceId, index) => {
      const instance = instanceId ? save.snapshot.roster.heroes[instanceId] ?? null : null;
      return {
        slot: { area: "board" as const, index },
        instance,
        ...(instance ? { rarity: getHeroDefinition(lookups, instance.heroId).rarity } : {})
      };
    }),
    ...save.snapshot.roster.bench.map((instanceId, index) => {
      const instance = instanceId ? save.snapshot.roster.heroes[instanceId] ?? null : null;
      return {
        slot: { area: "bench" as const, index },
        instance,
        ...(instance ? { rarity: getHeroDefinition(lookups, instance.heroId).rarity } : {})
      };
    })
  ];
};

export { createSeed } from "./rng";
export * from "./types";

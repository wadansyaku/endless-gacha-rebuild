import { z } from "zod";

export const raritySchema = z.enum(["N", "R", "SR", "SSR", "UR"]);
export const factionSchema = z.enum(["Fire", "Water", "Nature", "Light", "Dark"]);
export const classTypeSchema = z.enum(["Warrior", "Archer", "Mage"]);
export const bannerKindSchema = z.enum(["normal", "premium"]);
export const missionKindSchema = z.enum(["daily", "achievement"]);
export const missionMetricSchema = z.enum(["kills", "gachaPulls", "highestStage", "prestigeCount"]);
export const resetPolicySchema = z.enum(["never", "dailyJst"]);
export const scalingEffectKindSchema = z.enum([
  "baseDps",
  "goldGain",
  "offlineEfficiency",
  "gachaDiscount",
  "srRateUp",
  "bossDamage",
  "heroLevelDiscount",
  "equipmentDropRate",
  "startingStage",
  "factionDps",
  "classDps",
  "bossHpReduction",
  "goldDrop"
]);
export const formationBonusKindSchema = z.enum(["globalDps", "frontDps", "midDps", "backDps"]);
export const expeditionRewardKindSchema = z.enum(["gold", "gems", "artifactShards"]);
export const equipmentTypeSchema = z.enum(["weapon", "armor", "accessory"]);
export const enemyTraitSchema = z.enum(["NONE", "ARMORED", "RESISTANT", "EVASIVE"]);
export const bossAffixSchema = z.enum(["REGEN", "ARMORED", "BERSERK", "EVASIVE"]);

export const heroSchema = z.object({
  id: z.string(),
  name: z.string(),
  rarity: raritySchema,
  faction: factionSchema,
  classType: classTypeSchema,
  baseDps: z.number().int().positive(),
  emoji: z.string(),
  passive: z
    .object({
      id: z.string(),
      name: z.string(),
      kind: z.enum(["adjacentBuff", "selfCrit", "factionBuff", "classBuff"]),
      value: z.number().positive(),
      description: z.string()
    })
    .optional()
});

export const bannerSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: bannerKindSchema,
  currency: z.enum(["gold", "gems"]),
  cost: z.number().int().positive(),
  pityLimit: z.number().int().positive().optional(),
  guaranteeRarity: z.enum(["SR", "SSR", "UR"]).optional(),
  rates: z.record(raritySchema, z.number().min(0)),
  poolHeroIds: z.array(z.string()).min(1)
});

export const missionSchema = z.object({
  id: z.string(),
  kind: missionKindSchema,
  metric: missionMetricSchema,
  target: z.number().int().positive(),
  reward: z.object({
    gold: z.number().int().nonnegative().optional(),
    gems: z.number().int().nonnegative().optional(),
    artifactShards: z.number().int().nonnegative().optional()
  }),
  title: z.string(),
  description: z.string(),
  resetPolicy: resetPolicySchema
});

export const talentSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  maxLevel: z.number().int().positive(),
  baseCost: z.number().int().positive(),
  costMultiplier: z.number().positive(),
  effectKind: scalingEffectKindSchema,
  effectPerLevel: z.number().positive()
});

export const artifactSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  maxLevel: z.number().int().positive(),
  baseCost: z.number().int().positive(),
  costMultiplier: z.number().positive(),
  effectKind: scalingEffectKindSchema,
  target: z.string().optional(),
  effectPerLevel: z.number().positive()
});

export const formationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  requiredSlots: z.array(z.number().int().min(0).max(8)).min(1),
  bonus: z.object({
    kind: formationBonusKindSchema,
    value: z.number().positive()
  })
});

export const expeditionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  durationMinutes: z.number().int().positive(),
  unlockStage: z.number().int().positive(),
  reward: z.object({
    kind: expeditionRewardKindSchema,
    amount: z.number().int().positive()
  })
});

export const equipmentSchema = z.object({
  id: z.string(),
  type: equipmentTypeSchema,
  rarity: raritySchema,
  name: z.string(),
  dpsBonus: z.number().int().nonnegative(),
  dpsMultiplier: z.number().positive(),
  sellPrice: z.number().int().nonnegative(),
  synthesisTargetRarity: raritySchema.optional()
});

export const stageRulesSchema = z.object({
  bossInterval: z.number().int().positive(),
  bossTimerSeconds: z.number().int().positive(),
  hpBase: z.number().int().positive(),
  hpGrowth: z.number().positive(),
  bossMultiplier: z.number().positive(),
  enemyElements: z.array(factionSchema).min(1),
  bossElements: z.array(factionSchema).min(1),
  bossAffixes: z.array(bossAffixSchema).min(1),
  enemyTraits: z.array(enemyTraitSchema).min(1),
  offlineCapMinutes: z.number().int().positive()
});

export const contentCatalogSchema = z.object({
  heroes: z.array(heroSchema).min(1),
  banners: z.array(bannerSchema).min(1),
  missions: z.array(missionSchema).min(1),
  talents: z.array(talentSchema).min(1),
  artifacts: z.array(artifactSchema).min(1),
  formations: z.array(formationSchema).min(1),
  expeditions: z.array(expeditionSchema).min(1),
  equipment: z.array(equipmentSchema).min(1),
  stageRules: stageRulesSchema
});

export type HeroContent = z.infer<typeof heroSchema>;
export type BannerContent = z.infer<typeof bannerSchema>;
export type MissionContent = z.infer<typeof missionSchema>;
export type TalentContent = z.infer<typeof talentSchema>;
export type ArtifactContent = z.infer<typeof artifactSchema>;
export type FormationContent = z.infer<typeof formationSchema>;
export type ExpeditionContent = z.infer<typeof expeditionSchema>;
export type EquipmentContent = z.infer<typeof equipmentSchema>;
export type StageRulesContent = z.infer<typeof stageRulesSchema>;
export type ContentCatalog = z.infer<typeof contentCatalogSchema>;

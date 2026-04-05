import type { GameContent } from "@endless-gacha/shared";
import heroesJson from "./data/heroes.json";
import bannersJson from "./data/banners.json";
import missionsJson from "./data/missions.json";
import talentsJson from "./data/talents.json";
import artifactsJson from "./data/artifacts.json";
import formationsJson from "./data/formations.json";
import expeditionsJson from "./data/expeditions.json";
import equipmentJson from "./data/equipment.json";
import stagesJson from "./data/stages.json";
import {
  artifactSchema,
  bannerSchema,
  contentCatalogSchema,
  equipmentSchema,
  expeditionSchema,
  formationSchema,
  heroSchema,
  missionSchema,
  stageRulesSchema,
  talentSchema,
  type ArtifactContent,
  type BannerContent,
  type ContentCatalog,
  type EquipmentContent,
  type ExpeditionContent,
  type FormationContent,
  type HeroContent,
  type MissionContent,
  type StageRulesContent,
  type TalentContent
} from "./schemas";

export const contentVersion = "endless-gacha-content-0.1.0";

export const heroes: HeroContent[] = heroSchema.array().parse(heroesJson);
export const banners: BannerContent[] = bannerSchema.array().parse(bannersJson);
export const missions: MissionContent[] = missionSchema.array().parse(missionsJson);
export const talents: TalentContent[] = talentSchema.array().parse(talentsJson);
export const artifacts: ArtifactContent[] = artifactSchema.array().parse(artifactsJson);
export const formations: FormationContent[] = formationSchema.array().parse(formationsJson);
export const expeditions: ExpeditionContent[] = expeditionSchema.array().parse(expeditionsJson);
export const equipment: EquipmentContent[] = equipmentSchema.array().parse(equipmentJson);
export const stageRules: StageRulesContent = stageRulesSchema.parse(stagesJson);

export const contentCatalog: ContentCatalog = contentCatalogSchema.parse({
  heroes,
  banners,
  missions,
  talents,
  artifacts,
  formations,
  expeditions,
  equipment,
  stageRules
});

export const gameContent: GameContent = {
  contentVersion,
  heroes,
  banners,
  missions,
  talents,
  artifacts,
  formations: formations.map((formation) => ({
    unlockCost: 500,
    ...formation
  })),
  expeditions,
  equipment,
  stageRules
};

const indexById = <T extends { id: string }>(entries: T[]): Map<string, T> =>
  new Map(entries.map((entry) => [entry.id, entry] as const));

const heroIndex = indexById(heroes);
const bannerIndex = indexById(banners);
const missionIndex = indexById(missions);
const talentIndex = indexById(talents);
const artifactIndex = indexById(artifacts);
const formationIndex = indexById(formations);
const expeditionIndex = indexById(expeditions);
const equipmentIndex = indexById(equipment);

export const getHeroDefinition = (id: string): HeroContent => {
  const hero = heroIndex.get(id);
  if (!hero) {
    throw new Error(`Unknown hero definition: ${id}`);
  }
  return hero;
};

export const getBannerDefinition = (id: string): BannerContent => {
  const banner = bannerIndex.get(id);
  if (!banner) {
    throw new Error(`Unknown banner definition: ${id}`);
  }
  return banner;
};

export const getMissionDefinition = (id: string): MissionContent => {
  const mission = missionIndex.get(id);
  if (!mission) {
    throw new Error(`Unknown mission definition: ${id}`);
  }
  return mission;
};

export const getTalentDefinition = (id: string): TalentContent => {
  const talent = talentIndex.get(id);
  if (!talent) {
    throw new Error(`Unknown talent definition: ${id}`);
  }
  return talent;
};

export const getArtifactDefinition = (id: string): ArtifactContent => {
  const artifact = artifactIndex.get(id);
  if (!artifact) {
    throw new Error(`Unknown artifact definition: ${id}`);
  }
  return artifact;
};

export const getFormationDefinition = (id: string): FormationContent => {
  const formation = formationIndex.get(id);
  if (!formation) {
    throw new Error(`Unknown formation definition: ${id}`);
  }
  return formation;
};

export const getExpeditionDefinition = (id: string): ExpeditionContent => {
  const expedition = expeditionIndex.get(id);
  if (!expedition) {
    throw new Error(`Unknown expedition definition: ${id}`);
  }
  return expedition;
};

export const getEquipmentDefinition = (id: string): EquipmentContent => {
  const item = equipmentIndex.get(id);
  if (!item) {
    throw new Error(`Unknown equipment definition: ${id}`);
  }
  return item;
};

export { artifactSchema, bannerSchema, contentCatalogSchema, equipmentSchema, expeditionSchema, formationSchema, heroSchema, missionSchema, stageRulesSchema, talentSchema };
export type {
  ArtifactContent,
  BannerContent,
  ContentCatalog,
  EquipmentContent,
  ExpeditionContent,
  FormationContent,
  HeroContent,
  MissionContent,
  StageRulesContent,
  TalentContent
} from "./schemas";

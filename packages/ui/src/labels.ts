import type { BannerKind, ClassType, Faction, MissionKind, Rarity, ResetPolicy } from "@endless-gacha/shared";

export const rarityLabels: Record<Rarity, string> = {
  N: "N",
  R: "R",
  SR: "SR",
  SSR: "SSR",
  UR: "UR"
};

export const factionLabels: Record<Faction, string> = {
  Fire: "Fire",
  Water: "Water",
  Nature: "Nature",
  Light: "Light",
  Dark: "Dark"
};

export const classLabels: Record<ClassType, string> = {
  Warrior: "Warrior",
  Archer: "Archer",
  Mage: "Mage"
};

export const bannerKindLabels: Record<BannerKind, string> = {
  normal: "Normal",
  premium: "Premium"
};

export const missionKindLabels: Record<MissionKind, string> = {
  daily: "Daily",
  achievement: "Mission"
};

export const resetPolicyLabels: Record<ResetPolicy, string> = {
  never: "Never",
  dailyJst: "Daily JST"
};

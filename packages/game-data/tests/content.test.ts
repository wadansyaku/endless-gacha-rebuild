import {
  artifacts,
  banners,
  contentVersion,
  equipment,
  expeditions,
  formations,
  getArtifactDefinition,
  getBannerDefinition,
  getEquipmentDefinition,
  getExpeditionDefinition,
  getFormationDefinition,
  getHeroDefinition,
  getMissionDefinition,
  heroes,
  missions,
  stageRules,
  talents
} from "../src/index";
import { describe, expect, it } from "vitest";

describe("game-data catalogs", () => {
  it("parses all catalogs and exports stable counts", () => {
    expect(contentVersion).toBe("endless-gacha-content-0.1.0");
    expect(heroes).toHaveLength(12);
    expect(banners).toHaveLength(2);
    expect(missions).toHaveLength(14);
    expect(talents).toHaveLength(9);
    expect(artifacts).toHaveLength(10);
    expect(formations).toHaveLength(4);
    expect(expeditions).toHaveLength(5);
    expect(equipment).toHaveLength(15);
    expect(stageRules.bossInterval).toBe(10);
  });

  it("provides lookup helpers", () => {
    expect(getHeroDefinition("h11").name).toBe("Solaris");
    expect(getBannerDefinition("premium").kind).toBe("premium");
    expect(getMissionDefinition("m6").metric).toBe("highestStage");
    expect(getArtifactDefinition("gold_rin").effectKind).toBe("goldDrop");
    expect(getFormationDefinition("cross").bonus.kind).toBe("globalDps");
    expect(getExpeditionDefinition("exp_shard_1").reward.kind).toBe("artifactShards");
    expect(getEquipmentDefinition("weapon-ur").rarity).toBe("UR");
  });
});

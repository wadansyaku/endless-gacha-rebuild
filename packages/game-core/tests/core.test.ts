import { DEFAULT_CONTENT_VERSION } from "@endless-gacha/shared";
import {
  advanceByDuration,
  applyPlaytestPreset,
  autoDeployBench,
  claimExpedition,
  createNewGame,
  deserializeSave,
  dispatchExpedition,
  equipItem,
  listMissionViews,
  prestige,
  pullGacha,
  synthesizeEquipment,
  tapEnemy
} from "../src/index";
import type { GameContent } from "@endless-gacha/shared";
import type { VersionedSaveEnvelope } from "../src/index";

const content: GameContent = {
  contentVersion: DEFAULT_CONTENT_VERSION,
  heroes: [
    { id: "h1", name: "Ignis", rarity: "N", faction: "Fire", classType: "Warrior", baseDps: 10, emoji: "A" },
    { id: "h2", name: "Blaze", rarity: "SSR", faction: "Fire", classType: "Mage", baseDps: 300, emoji: "B" }
  ],
  banners: [
    {
      id: "normal",
      name: "Normal",
      kind: "normal",
      currency: "gold",
      cost: 100,
      rates: { N: 1, R: 0, SR: 0, SSR: 0, UR: 0 },
      poolHeroIds: ["h1"]
    },
    {
      id: "premium",
      name: "Premium",
      kind: "premium",
      currency: "gems",
      cost: 300,
      pityLimit: 2,
      guaranteeRarity: "SSR",
      rates: { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 },
      poolHeroIds: ["h2"]
    }
  ],
  missions: [
    {
      id: "m1",
      kind: "achievement",
      metric: "gachaPulls",
      target: 2,
      reward: { gems: 10 },
      title: "pull",
      description: "pull",
      resetPolicy: "never"
    }
  ],
  talents: [],
  artifacts: [],
  formations: [],
  expeditions: [
    {
      id: "scout",
      name: "Scout",
      description: "short run",
      durationMinutes: 10,
      unlockStage: 1,
      reward: { kind: "gold", amount: 50 }
    }
  ],
  equipment: [
    { id: "weapon:N", type: "weapon", rarity: "N", name: "wood", dpsBonus: 10, dpsMultiplier: 1.02, sellPrice: 20 },
    { id: "weapon:R", type: "weapon", rarity: "R", name: "iron", dpsBonus: 50, dpsMultiplier: 1.05, sellPrice: 100 }
  ],
  stageRules: {
    bossInterval: 10,
    bossTimerSeconds: 30,
    hpBase: 50,
    hpGrowth: 1.2,
    bossMultiplier: 5,
    enemyElements: ["Dark"],
    bossElements: ["Fire"],
    bossAffixes: ["NONE"],
    enemyTraits: ["NONE"],
    offlineCapMinutes: 60
  }
};

describe("game-core", () => {
  it("premium banner pity guarantees rarity", () => {
    let save = createNewGame({ now: 0, content, seed: 1 });
    save.snapshot.meta.gems = 1000;
    save = pullGacha(save, content, "premium", 1, 100).save;
    const result = pullGacha(save, content, "premium", 1, 200);
    expect(result.payload?.pulls).toHaveLength(1);
    expect(result.payload?.pulls[0]?.heroId).toBe("h2");
  });

  it("mission progress follows lifetime stats", () => {
    let save = createNewGame({ now: 0, content, seed: 1 });
    save.snapshot.meta.gold = 500;
    save = pullGacha(save, content, "normal", 2, 100).save;
    const missions = listMissionViews(save, content, 100);
    expect(missions[0]?.progress).toBe(2);
    expect(missions[0]?.claimable).toBe(true);
  });

  it("prestige carries persistent progression", () => {
    const save = createNewGame({ now: 0, content, seed: 1 });
    save.snapshot.run.stage = 20;
    save.snapshot.meta.talentLevels.starting_stage = 2;
    const result = prestige(save, content, 1000).save;
    expect(result.snapshot.meta.prestigePoints).toBe(2);
    expect(result.snapshot.run.stage).toBe(3);
  });

  it("tap can defeat enemy and advance stage", () => {
    const save = createNewGame({ now: 0, content, seed: 1 });
    save.snapshot.run.enemyHp = 1;
    const result = tapEnemy(save, content, 100);
    expect(result.save.snapshot.run.stage).toBe(2);
  });

  it("synthesize combines three matching equipments", () => {
    const save = createNewGame({ now: 0, content, seed: 1 });
    save.snapshot.inventory.items.e1 = { instanceId: "e1", tierId: "weapon:N" };
    save.snapshot.inventory.items.e2 = { instanceId: "e2", tierId: "weapon:N" };
    save.snapshot.inventory.items.e3 = { instanceId: "e3", tierId: "weapon:N" };
    save.snapshot.inventory.order = ["e1", "e2", "e3"];
    const result = synthesizeEquipment(save, content, ["e1", "e2", "e3"]);
    expect(result.payload?.createdTierId).toBe("weapon:R");
    expect(result.save.snapshot.inventory.order).toHaveLength(1);
  });

  it("auto deploy moves bench units onto the board", () => {
    let save = createNewGame({ now: 0, content, seed: 1 });
    save.snapshot.meta.gold = 1_000;
    save = pullGacha(save, content, "normal", 2, 100).save;
    const result = autoDeployBench(save);
    expect(result.payload?.moved).toBeGreaterThan(0);
    expect(result.save.snapshot.roster.board.some((entry) => entry !== null)).toBe(true);
  });

  it("advanceByDuration progresses the logical clock", () => {
    const save = createNewGame({ now: 0, content, seed: 1 });
    const result = advanceByDuration(save, content, 10_000);
    expect(result.save.lastProcessedAt).toBe(10_000);
    expect(result.payload?.advancedMs).toBe(10_000);
  });

  it("playtest preset builds a playable midgame snapshot", () => {
    const save = createNewGame({ now: 0, content, seed: 1 });
    const result = applyPlaytestPreset(save, content, "midgame", 1_000);
    expect(result.payload?.preset).toBe("midgame");
    expect(result.save.snapshot.run.highestStage).toBeGreaterThanOrEqual(35);
    expect(result.save.snapshot.roster.board.some((entry) => entry !== null)).toBe(true);
    expect(result.save.snapshot.inventory.order.length).toBeGreaterThan(0);
  });

  it("migrates legacy expedition saves to instance ownership", () => {
    const legacy = createNewGame({ now: 0, content, seed: 1 }) as unknown as VersionedSaveEnvelope & {
      snapshot: VersionedSaveEnvelope["snapshot"] & {
        expedition: {
          active: Record<string, unknown>;
          order: string[];
        };
      };
    };
    legacy.saveSchemaVersion = 1;
    legacy.snapshot.roster.heroes.hero_legacy = {
      instanceId: "hero_legacy",
      heroId: "h1",
      star: 1,
      level: 3,
      equipment: {}
    };
    legacy.snapshot.roster.bench[0] = "hero_legacy";
    (legacy.snapshot.expedition.active as Record<string, unknown>).dispatch_legacy = {
      dispatchId: "dispatch_legacy",
      expeditionId: "scout",
      heroId: "h1",
      startedAt: 0,
      readyAt: 100
    };
    legacy.snapshot.expedition.order = ["dispatch_legacy"];

    const migrated = deserializeSave(JSON.stringify(legacy), content);
    expect(migrated.saveSchemaVersion).toBe(2);
    expect(migrated.snapshot.expedition.active.dispatch_legacy?.hero.heroId).toBe("h1");
    expect(migrated.snapshot.roster.bench[0]).toBeNull();
  });

  it("dispatches bench hero instances and returns them on claim", () => {
    let save = createNewGame({ now: 0, content, seed: 1 });
    save.snapshot.meta.gold = 500;
    save = pullGacha(save, content, "normal", 1, 100).save;
    const heroInstanceId = save.snapshot.roster.bench.find((entry) => entry !== null);
    expect(heroInstanceId).toBeTruthy();

    const dispatched = dispatchExpedition(save, content, "scout", heroInstanceId!, 200);
    const dispatchId = dispatched.save.snapshot.expedition.order[0];
    expect(dispatchId).toBeTruthy();
    expect(dispatched.save.snapshot.roster.bench.includes(heroInstanceId!)).toBe(false);
    expect(dispatched.save.snapshot.expedition.active[dispatchId!]?.hero.instanceId).toBe(heroInstanceId);

    const claimed = claimExpedition(dispatched.save, content, dispatchId!, 200 + 10 * 60_000);
    expect(claimed.save.snapshot.roster.bench.includes(heroInstanceId!)).toBe(true);
    expect(claimed.save.snapshot.meta.gold).toBeGreaterThan(save.snapshot.meta.gold);
  });

  it("keeps equipped items in the registry while removing them from bag order", () => {
    const save = createNewGame({ now: 0, content, seed: 1 });
    save.snapshot.roster.heroes.hero_1 = {
      instanceId: "hero_1",
      heroId: "h1",
      star: 1,
      level: 1,
      equipment: { weapon: "e_old" }
    };
    save.snapshot.roster.board[0] = "hero_1";
    save.snapshot.inventory.items.e_old = { instanceId: "e_old", tierId: "weapon:N" };
    save.snapshot.inventory.items.e_new = { instanceId: "e_new", tierId: "weapon:R" };
    save.snapshot.inventory.order = ["e_new"];
    save.snapshot.inventory.capacity = 1;

    const result = equipItem(save, content, "hero_1", "e_new").save;
    expect(result.snapshot.roster.heroes.hero_1?.equipment.weapon).toBe("e_new");
    expect(result.snapshot.inventory.items.e_new).toBeDefined();
    expect(result.snapshot.inventory.order).toContain("e_old");
    expect(result.snapshot.inventory.order).not.toContain("e_new");
  });
});

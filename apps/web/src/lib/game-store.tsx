import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import {
  LOCAL_SAVE_STORAGE_KEY,
  type GameContent
} from "@endless-gacha/shared";
import { gameContent } from "@endless-gacha/game-data";
import {
  advanceByDuration,
  advanceSimulation,
  applyPlaytestPreset,
  artifactGacha,
  autoDeployBench,
  awakenHero,
  buyUpgrade,
  claimAllExpeditions,
  claimExpedition,
  claimMission,
  claimOverflowItem,
  compareSaveFreshness,
  createNewGame,
  deserializeSave,
  dispatchExpedition,
  dismissTutorial,
  equipItem,
  grantPlaytestResources,
  getBattleSummary,
  getCollectionEntries,
  getHeroPlacements,
  levelHero,
  listMissionViews,
  moveHero,
  prestige,
  pullGacha,
  sellEquipment,
  serializeSave,
  setPlaytestStage,
  setActiveFormation,
  synthesizeEquipment,
  tapEnemy,
  toggleAutoSellCommon,
  upgradeArtifact,
  upgradeFormation,
  upgradeTalent,
  type CollectionEntry,
  type CommandResult,
  type GachaResult,
  type GameSnapshot,
  type HeroPlacementView,
  type MissionView,
  type PlaytestPreset,
  type PlaytestResourceGrant,
  type SaveConflictResolution,
  type SlotRef,
  type VersionedSaveEnvelope
} from "@endless-gacha/game-core";
import {
  type FirebaseLeaderboardEntry,
  type FirebaseSaveDocument,
  type FirebaseUserSummary
} from "@endless-gacha/firebase-adapter";
import { hasFirebaseConfig, loadFirebaseAdapter } from "./firebase";

type CloudConflict = {
  remote: FirebaseSaveDocument<GameSnapshot>;
  recommended: SaveConflictResolution;
};

type GameState = {
  save: VersionedSaveEnvelope;
  events: string[];
  saveNotice: string | null;
  lastGachaResult: GachaResult | null;
  cloudEnabled: boolean;
  cloudBusy: boolean;
  cloudError: string | null;
  user: FirebaseUserSummary | null;
  leaderboard: FirebaseLeaderboardEntry[];
  conflict: CloudConflict | null;
};

type GameActions = {
  tapEnemy: () => void;
  pullBanner: (bannerId: string, count: number) => void;
  moveHero: (from: SlotRef, to: SlotRef) => void;
  autoDeployBench: () => void;
  levelHero: (slot: SlotRef) => void;
  buyUpgrade: (kind: "tapDamage" | "heroDps") => void;
  claimMission: (missionId: string) => void;
  prestige: () => void;
  upgradeTalent: (talentId: string) => void;
  upgradeArtifact: (artifactId: string) => void;
  artifactGacha: () => void;
  upgradeFormation: (formationId: string) => void;
  setActiveFormation: (formationId: string | null) => void;
  dispatchExpedition: (expeditionId: string, heroInstanceId: string) => void;
  claimExpedition: (dispatchId: string) => void;
  claimAllExpeditions: () => void;
  equipItem: (heroInstanceId: string, equipmentInstanceId: string) => void;
  sellEquipment: (equipmentInstanceId: string) => void;
  synthesizeEquipment: (equipmentInstanceIds: string[]) => void;
  awakenHero: (heroId: string) => void;
  claimOverflowItem: (itemId: string) => void;
  toggleAutoSellCommon: () => void;
  dismissTutorial: () => void;
  resetRun: () => void;
  advancePlaytestTime: (durationMs: number) => void;
  setPlaytestStage: (stage: number) => void;
  grantPlaytestResources: (grant: PlaytestResourceGrant) => void;
  applyPlaytestPreset: (preset: PlaytestPreset) => void;
  reloadLocalSave: () => void;
  importSaveText: (saveText: string) => void;
  signInWithGoogle: () => Promise<void>;
  uploadLocalSave: () => Promise<void>;
  downloadCloudSave: () => Promise<void>;
  refreshLeaderboard: () => Promise<void>;
  dismissConflict: () => void;
};

type GameContextValue = GameState & {
  content: GameContent;
  battle: ReturnType<typeof getBattleSummary>;
  missions: MissionView[];
  collection: CollectionEntry[];
  heroPlacements: HeroPlacementView[];
  actions: GameActions;
};

const MAX_EVENT_LINES = 12;

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => string;
    __ENDLESS_GACHA__?: {
      exportSave: () => string;
      importSave: (raw: string) => void;
      resetRun: () => void;
      applyPreset: (preset: PlaytestPreset) => void;
      advanceTime: (ms: number) => string;
      setStage: (stage: number) => void;
      autoDeploy: () => void;
    };
  }
}

const GameContext = createContext<GameContextValue | null>(null);

const appendEvents = (current: string[], incoming: string[]): string[] => {
  const next = [...incoming.filter(Boolean), ...current];
  return next.slice(0, MAX_EVENT_LINES);
};

const documentToSave = (
  document: FirebaseSaveDocument<GameSnapshot>
): VersionedSaveEnvelope => ({
  saveSchemaVersion: document.saveSchemaVersion,
  contentVersion: document.contentVersion,
  lastProcessedAt: document.lastProcessedAt,
  snapshot: document.snapshot
});

type InitialLoadState = {
  save: VersionedSaveEnvelope;
  events: string[];
  saveNotice: string | null;
};

const readInitialSave = (): InitialLoadState => {
  const now = Date.now();

  if (typeof window === "undefined") {
    return {
      save: createNewGame({ now, content: gameContent, seed: "server-bootstrap" }),
      events: ["新しいランを開始した"],
      saveNotice: null
    };
  }

  const raw = window.localStorage.getItem(LOCAL_SAVE_STORAGE_KEY);
  if (!raw) {
    return {
      save: createNewGame({ now, content: gameContent, seed: now }),
      events: ["新しいランを開始した"],
      saveNotice: null
    };
  }

  try {
    return {
      save: advanceSimulation(deserializeSave(raw, gameContent), gameContent, now).save,
      events: ["ローカルセーブを読み込んだ"],
      saveNotice: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ローカルセーブの読込に失敗しました";
    return {
      save: createNewGame({ now, content: gameContent, seed: now }),
      events: [`ローカルセーブ読込失敗: ${message}`, "新しいランを開始した"],
      saveNotice: message
    };
  }
};

const createInitialState = (): GameState => {
  const initial = readInitialSave();
  return {
    save: initial.save,
    events: initial.events,
    saveNotice: initial.saveNotice,
    lastGachaResult: null,
    cloudEnabled: hasFirebaseConfig(),
    cloudBusy: false,
    cloudError: null,
    user: null,
    leaderboard: [],
    conflict: null
  };
};

const renderGameToText = (save: VersionedSaveEnvelope): string =>
  JSON.stringify({
    run: {
      stage: save.snapshot.run.stage,
      highestStage: save.snapshot.run.highestStage,
      enemyHp: Math.floor(save.snapshot.run.enemyHp),
      enemyMaxHp: Math.floor(save.snapshot.run.enemyMaxHp),
      bossTimeLeft: save.snapshot.run.bossTimeLeft
    },
    meta: {
      gold: save.snapshot.meta.gold,
      gems: save.snapshot.meta.gems,
      artifactShards: save.snapshot.meta.artifactShards,
      prestigePoints: save.snapshot.meta.prestigePoints,
      autoSellCommon: save.snapshot.meta.autoSellCommon
    },
    board: save.snapshot.roster.board.map((instanceId) => {
      const hero = instanceId ? save.snapshot.roster.heroes[instanceId] ?? null : null;
      return hero
        ? {
            heroId: hero.heroId,
            star: hero.star,
            level: hero.level
          }
        : null;
    }),
    benchCount: save.snapshot.roster.bench.filter((entry) => entry !== null).length,
    inventoryCount: save.snapshot.inventory.order.length,
    overflowCount: save.snapshot.inventory.overflow.length,
    expeditionCount: save.snapshot.expedition.order.length
  });

const readFirebaseUserSummary = async (): Promise<FirebaseUserSummary | null> => {
  const adapter = await loadFirebaseAdapter();
  const user = adapter?.auth.currentUser;
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null
  };
};

export function GameProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<GameState>(createInitialState);
  const saveRef = useRef(state.save);

  useEffect(() => {
    saveRef.current = state.save;
  }, [state.save]);

  useEffect(() => {
    window.localStorage.setItem(LOCAL_SAVE_STORAGE_KEY, serializeSave(state.save));
  }, [state.save]);

  const patchState = (patch: Partial<GameState>) => {
    startTransition(() => {
      setState((current) => ({
        ...current,
        ...patch
      }));
    });
  };

  const commitSave = (save: VersionedSaveEnvelope, events: string[]) => {
    saveRef.current = save;
    startTransition(() => {
      setState((current) => ({
        ...current,
        save,
        events: appendEvents(current.events, events)
      }));
    });
  };

  const commitResult = <TPayload,>(result: CommandResult<TPayload>): TPayload | undefined => {
    commitSave(result.save, result.events);
    return result.payload;
  };

  const tick = useEffectEvent(() => {
    const result = advanceSimulation(saveRef.current, gameContent, Date.now());
    commitResult(result);
  });

  const importSaveFromWindow = useEffectEvent((raw: string) => {
    const next = deserializeSave(raw, gameContent);
    commitSave(next, ["window hook 経由でセーブを読み込んだ"]);
    patchState({ saveNotice: null, lastGachaResult: null });
  });

  const resetRunFromWindow = useEffectEvent(() => {
    const next = createNewGame({
      now: Date.now(),
      content: gameContent,
      seed: saveRef.current.snapshot.run.rngState.seed,
      contentVersion: saveRef.current.contentVersion
    });
    commitSave(next, ["window hook 経由でリセットした"]);
    patchState({ saveNotice: null, lastGachaResult: null });
  });

  const applyPresetFromWindow = useEffectEvent((preset: PlaytestPreset) => {
    commitResult(applyPlaytestPreset(saveRef.current, gameContent, preset, Date.now()));
    patchState({ saveNotice: null, lastGachaResult: null });
  });

  const advanceTimeFromWindow = useEffectEvent((ms: number) => {
    const result = advanceByDuration(saveRef.current, gameContent, ms);
    commitResult(result);
    return renderGameToText(result.save);
  });

  const setStageFromWindow = useEffectEvent((stage: number) => {
    commitResult(setPlaytestStage(saveRef.current, gameContent, stage));
  });

  const autoDeployFromWindow = useEffectEvent(() => {
    commitResult(autoDeployBench(saveRef.current));
  });

  useEffect(() => {
    const handle = window.setInterval(() => {
      tick();
    }, 1000);

    return () => {
      window.clearInterval(handle);
    };
  }, []);

  useEffect(() => {
    if (!state.cloudEnabled) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const currentUser = await readFirebaseUserSummary();
      if (!currentUser || cancelled) {
        return;
      }

      const firebaseAdapter = await loadFirebaseAdapter();
      if (!firebaseAdapter || cancelled) {
        return;
      }

      try {
        const [remote, leaderboard] = await Promise.all([
          firebaseAdapter.loadGame<GameSnapshot>(currentUser.uid),
          firebaseAdapter.listLeaderboard(10)
        ]);

        if (cancelled) {
          return;
        }

        patchState({
          user: currentUser,
          leaderboard,
          conflict: remote
            ? {
                remote,
                recommended: compareSaveFreshness(saveRef.current, documentToSave(remote)).recommended
              }
            : null
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        patchState({
          cloudError: error instanceof Error ? error.message : "クラウド状態の復元に失敗しました"
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state.cloudEnabled]);

  useEffect(() => {
    window.render_game_to_text = () => renderGameToText(saveRef.current);
    window.advanceTime = (ms: number) => advanceTimeFromWindow(ms);
    window.__ENDLESS_GACHA__ = {
      exportSave: () => serializeSave(saveRef.current),
      importSave: (raw: string) => importSaveFromWindow(raw),
      resetRun: () => resetRunFromWindow(),
      applyPreset: (preset: PlaytestPreset) => applyPresetFromWindow(preset),
      advanceTime: (ms: number) => advanceTimeFromWindow(ms),
      setStage: (stage: number) => setStageFromWindow(stage),
      autoDeploy: () => autoDeployFromWindow()
    };

    return () => {
      delete window.render_game_to_text;
      delete window.advanceTime;
      delete window.__ENDLESS_GACHA__;
    };
  }, []);

  const run = <TPayload,>(command: (save: VersionedSaveEnvelope) => CommandResult<TPayload>) =>
    commitResult(command(saveRef.current));

  const runAtNow = <TPayload,>(command: (save: VersionedSaveEnvelope, now: number) => CommandResult<TPayload>) =>
    commitResult(command(saveRef.current, Date.now()));

  const actions: GameActions = {
    tapEnemy: () => {
      runAtNow((save, now) => tapEnemy(save, gameContent, now));
    },
    pullBanner: (bannerId, count) => {
      const result = runAtNow((save, now) => pullGacha(save, gameContent, bannerId, count, now));
      patchState({ lastGachaResult: result ?? null });
    },
    moveHero: (from, to) => {
      run((save) => moveHero(save, from, to));
    },
    autoDeployBench: () => {
      run((save) => autoDeployBench(save));
    },
    levelHero: (slot) => {
      run((save) => levelHero(save, gameContent, slot));
    },
    buyUpgrade: (kind) => {
      run((save) => buyUpgrade(save, kind));
    },
    claimMission: (missionId) => {
      runAtNow((save, now) => claimMission(save, gameContent, missionId, now));
    },
    prestige: () => {
      runAtNow((save, now) => prestige(save, gameContent, now));
    },
    upgradeTalent: (talentId) => {
      run((save) => upgradeTalent(save, gameContent, talentId));
    },
    upgradeArtifact: (artifactId) => {
      run((save) => upgradeArtifact(save, gameContent, artifactId));
    },
    artifactGacha: () => {
      run((save) => artifactGacha(save, gameContent));
    },
    upgradeFormation: (formationId) => {
      run((save) => upgradeFormation(save, gameContent, formationId));
    },
    setActiveFormation: (formationId) => {
      run((save) => setActiveFormation(save, formationId));
    },
    dispatchExpedition: (expeditionId, heroInstanceId) => {
      runAtNow((save, now) => dispatchExpedition(save, gameContent, expeditionId, heroInstanceId, now));
    },
    claimExpedition: (dispatchId) => {
      runAtNow((save, now) => claimExpedition(save, gameContent, dispatchId, now));
    },
    claimAllExpeditions: () => {
      runAtNow((save, now) => claimAllExpeditions(save, gameContent, now));
    },
    equipItem: (heroInstanceId, equipmentInstanceId) => {
      run((save) => equipItem(save, gameContent, heroInstanceId, equipmentInstanceId));
    },
    sellEquipment: (equipmentInstanceId) => {
      run((save) => sellEquipment(save, gameContent, equipmentInstanceId));
    },
    synthesizeEquipment: (equipmentInstanceIds) => {
      run((save) => synthesizeEquipment(save, gameContent, equipmentInstanceIds));
    },
    awakenHero: (heroId) => {
      run((save) => awakenHero(save, heroId));
    },
    claimOverflowItem: (itemId) => {
      runAtNow((save, now) => claimOverflowItem(save, itemId, now));
    },
    toggleAutoSellCommon: () => {
      run((save) => toggleAutoSellCommon(save));
    },
    dismissTutorial: () => {
      run((save) => dismissTutorial(save));
    },
    resetRun: () => {
      const next = createNewGame({
        now: Date.now(),
        content: gameContent,
        seed: saveRef.current.snapshot.run.rngState.seed,
        contentVersion: saveRef.current.contentVersion
      });
      commitSave(next, ["新しいランにリセットした"]);
      patchState({ saveNotice: null, lastGachaResult: null });
    },
    advancePlaytestTime: (durationMs) => {
      run((save) => advanceByDuration(save, gameContent, durationMs));
    },
    setPlaytestStage: (stage) => {
      run((save) => setPlaytestStage(save, gameContent, stage));
    },
    grantPlaytestResources: (grant) => {
      run((save) => grantPlaytestResources(save, grant));
    },
    applyPlaytestPreset: (preset) => {
      runAtNow((save, now) => applyPlaytestPreset(save, gameContent, preset, now));
      patchState({ saveNotice: null, lastGachaResult: null });
    },
    reloadLocalSave: () => {
      if (typeof window === "undefined") {
        patchState({ cloudError: "ブラウザ環境でのみ利用できます" });
        return;
      }

      const raw = window.localStorage.getItem(LOCAL_SAVE_STORAGE_KEY);
      if (!raw) {
        patchState({ cloudError: "ローカルセーブが見つかりません" });
        return;
      }

      try {
        const next = deserializeSave(raw, gameContent);
        commitSave(next, ["ローカルセーブを読み込んだ"]);
        patchState({ saveNotice: null, lastGachaResult: null });
      } catch (error) {
        patchState({
          saveNotice: error instanceof Error ? error.message : "ローカルセーブの読込に失敗しました",
          cloudError: error instanceof Error ? error.message : "ローカルセーブの読込に失敗しました"
        });
      }
    },
    importSaveText: (saveText) => {
      try {
        const next = deserializeSave(saveText, gameContent);
        commitSave(next, ["セーブ JSON を取り込んだ"]);
        patchState({ saveNotice: null, lastGachaResult: null });
      } catch (error) {
        patchState({
          saveNotice: error instanceof Error ? error.message : "セーブ JSON の読込に失敗しました",
          cloudError: error instanceof Error ? error.message : "セーブ JSON の読込に失敗しました"
        });
      }
    },
    signInWithGoogle: async () => {
      const firebaseAdapter = await loadFirebaseAdapter();
      if (!firebaseAdapter) {
        patchState({ cloudError: "Firebase 設定がありません" });
        return;
      }

      patchState({ cloudBusy: true, cloudError: null });
      try {
        const user = await firebaseAdapter.signInWithGoogle();
        const remote = await firebaseAdapter.loadGame<GameSnapshot>(user.uid);
        const leaderboard = await firebaseAdapter.listLeaderboard(10);

        patchState({
          cloudBusy: false,
          user,
          leaderboard,
          conflict: remote
            ? {
                remote,
                recommended: compareSaveFreshness(saveRef.current, documentToSave(remote)).recommended
              }
            : null
        });
      } catch (error) {
        patchState({
          cloudBusy: false,
          cloudError: error instanceof Error ? error.message : "Google ログインに失敗しました"
        });
      }
    },
    uploadLocalSave: async () => {
      const firebaseAdapter = await loadFirebaseAdapter();
      const currentUser = state.user ?? (await readFirebaseUserSummary());
      if (!firebaseAdapter || !currentUser) {
        patchState({ cloudError: "ログインしていません" });
        return;
      }

      patchState({ cloudBusy: true, cloudError: null });
      try {
        await firebaseAdapter.saveGame({
          uid: currentUser.uid,
          displayName: currentUser.displayName ?? "Player",
          highestStage: saveRef.current.snapshot.run.highestStage,
          save: saveRef.current
        });
        const leaderboard = await firebaseAdapter.listLeaderboard(10);
        patchState({
          cloudBusy: false,
          user: currentUser,
          leaderboard,
          conflict: null
        });
      } catch (error) {
        patchState({
          cloudBusy: false,
          cloudError: error instanceof Error ? error.message : "クラウド保存に失敗しました"
        });
      }
    },
    downloadCloudSave: async () => {
      const firebaseAdapter = await loadFirebaseAdapter();
      const currentUser = state.user ?? (await readFirebaseUserSummary());
      if (!firebaseAdapter || !currentUser) {
        patchState({ cloudError: "ログインしていません" });
        return;
      }

      patchState({ cloudBusy: true, cloudError: null });
      try {
        const remote =
          state.conflict?.remote ?? (await firebaseAdapter.loadGame<GameSnapshot>(currentUser.uid));
        if (!remote) {
          patchState({ cloudBusy: false, cloudError: "クラウドセーブが見つかりません" });
          return;
        }

        const normalized = deserializeSave(JSON.stringify(documentToSave(remote)), gameContent);
        commitSave(normalized, ["クラウドセーブを読み込んだ"]);
        const leaderboard = await firebaseAdapter.listLeaderboard(10);
        patchState({
          cloudBusy: false,
          saveNotice: null,
          user: currentUser,
          leaderboard,
          conflict: null
        });
      } catch (error) {
        patchState({
          cloudBusy: false,
          cloudError: error instanceof Error ? error.message : "クラウド読込に失敗しました"
        });
      }
    },
    refreshLeaderboard: async () => {
      const firebaseAdapter = await loadFirebaseAdapter();
      if (!firebaseAdapter) {
        patchState({ cloudError: "Firebase 設定がありません" });
        return;
      }

      patchState({ cloudBusy: true, cloudError: null });
      try {
        const leaderboard = await firebaseAdapter.listLeaderboard(10);
        patchState({
          cloudBusy: false,
          leaderboard
        });
      } catch (error) {
        patchState({
          cloudBusy: false,
          cloudError: error instanceof Error ? error.message : "ランキングの更新に失敗しました"
        });
      }
    },
    dismissConflict: () => {
      patchState({ conflict: null });
    }
  };

  const contextValue: GameContextValue = {
    ...state,
    content: gameContent,
    battle: getBattleSummary(state.save, gameContent),
    missions: listMissionViews(state.save, gameContent, state.save.lastProcessedAt),
    collection: getCollectionEntries(state.save, gameContent),
    heroPlacements: getHeroPlacements(state.save, gameContent),
    actions
  };

  return <GameContext.Provider value={contextValue}>{children}</GameContext.Provider>;
}

export const useGame = (): GameContextValue => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within GameProvider");
  }
  return context;
};

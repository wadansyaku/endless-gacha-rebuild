import { useDeferredValue } from "react";
import { Button, Card, PanelList, PanelRow } from "@endless-gacha/ui";
import { useGameActions, useGameCollection, useGameContent, useGameSave } from "../lib/game-store";

export default function CollectionRoute() {
  const collection = useGameCollection();
  const content = useGameContent();
  const save = useGameSave();
  const actions = useGameActions();
  const deferredCollection = useDeferredValue(collection);

  return (
    <Card title="Codex" subtitle="図鑑と覚醒素材の進捗">
      <PanelList>
        {deferredCollection.map((entry) => {
          const hero = content.heroes.find((candidate) => candidate.id === entry.heroId);
          const canAwaken = entry.soulCount >= entry.nextAwakeningCost && entry.awakeningLevel < 5;

          return (
            <PanelRow
              key={entry.heroId}
              primary={`${hero?.name ?? entry.heroId} · ${hero?.rarity ?? "-"} · ${hero?.faction ?? "-"}`}
              secondary={
                entry.unlocked
                  ? `Awaken ${entry.awakeningLevel} / Souls ${entry.soulCount} / Next ${entry.nextAwakeningCost}`
                  : "未解放"
              }
              right={
                canAwaken ? (
                  <Button onClick={() => actions.awakenHero(entry.heroId)}>Awaken</Button>
                ) : undefined
              }
            />
          );
        })}
      </PanelList>
      <p className="eg-muted">
        Unlocked {save.snapshot.roster.unlockedHeroIds.length} / {content.heroes.length}
      </p>
    </Card>
  );
}

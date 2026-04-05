import { useState } from "react";
import { Button, Card, EmptyState, PanelList, PanelRow, Progress, SplitGrid } from "@endless-gacha/ui";
import { useNavigate } from "react-router-dom";
import { useGame } from "../lib/game-store";
import { formatNumber } from "../lib/format";

const slotLabel = (index: number): string => `Slot ${index + 1}`;

export default function BattleRoute() {
  const navigate = useNavigate();
  const { battle, heroPlacements, save, actions } = useGame();
  const board = heroPlacements.filter((placement) => placement.slot.area === "board");
  const bench = heroPlacements.filter((placement) => placement.slot.area === "bench");
  const emptyBenchSlot = bench.find((placement) => !placement.instance)?.slot ?? null;
  const overflowItems = save.snapshot.inventory.overflow;
  const hasBoardUnits = board.some((placement) => placement.instance);
  const hasBenchUnits = bench.some((placement) => placement.instance);
  const [showAllOverflow, setShowAllOverflow] = useState(false);
  const visibleOverflowItems = showAllOverflow ? overflowItems : overflowItems.slice(0, 5);

  const findBoardTarget = (heroInstanceId: string, heroId: string, star: number) => {
    const mergeSlot = board.find(
      (placement) =>
        placement.instance &&
        placement.instance.instanceId !== heroInstanceId &&
        placement.instance.heroId === heroId &&
        placement.instance.star === star &&
        placement.instance.star < 3
    )?.slot;

    return mergeSlot ?? board.find((placement) => !placement.instance)?.slot ?? null;
  };

  return (
    <div className="eg-route-stack">
      <SplitGrid>
        <Card
          title={battle.isBoss ? "Boss Battle" : "Endless Battle"}
          subtitle={`${battle.enemyElement} / ${battle.enemyTrait}`}
          actions={<Button variant="primary" onClick={actions.tapEnemy}>Tap Attack</Button>}
        >
          <div className="eg-stat-grid">
            <div className="eg-kpi">
              <span>Tap Damage</span>
              <strong>{formatNumber(battle.tapDamage)}</strong>
            </div>
            <div className="eg-kpi">
              <span>Highest Stage</span>
              <strong>{battle.highestStage}</strong>
            </div>
            <div className="eg-kpi">
              <span>Boss Timer</span>
              <strong>{battle.bossTimeLeft ? `${battle.bossTimeLeft.toFixed(1)}s` : "-"}</strong>
            </div>
          </div>
          <Progress
            value={battle.enemyMaxHp - battle.enemyHp}
            max={battle.enemyMaxHp}
            label={`HP ${formatNumber(battle.enemyHp)} / ${formatNumber(battle.enemyMaxHp)}`}
            tone={battle.isBoss ? "gold" : "cyan"}
          />
          <div className="eg-toolbar">
            <Button onClick={() => actions.buyUpgrade("tapDamage")}>Tap Upgrade</Button>
            <Button onClick={() => actions.buyUpgrade("heroDps")}>Hero DPS Upgrade</Button>
            <Button variant="danger" onClick={actions.prestige}>Prestige</Button>
          </div>
        </Card>

        <Card title="Run Resources">
          <div className="eg-stat-grid">
            <div className="eg-kpi">
              <span>Gold</span>
              <strong>{formatNumber(save.snapshot.meta.gold)}</strong>
            </div>
            <div className="eg-kpi">
              <span>Gems</span>
              <strong>{formatNumber(save.snapshot.meta.gems)}</strong>
            </div>
            <div className="eg-kpi">
              <span>Prestige</span>
              <strong>{formatNumber(save.snapshot.meta.prestigePoints)}</strong>
            </div>
            <div className="eg-kpi">
              <span>Multiplier</span>
              <strong>{save.snapshot.meta.prestigeMultiplier.toFixed(2)}x</strong>
            </div>
          </div>
        </Card>
      </SplitGrid>

      <Card title="Board" subtitle="盤面上のユニットだけが戦闘に参加します">
        {!hasBoardUnits ? (
          <EmptyState
            title="部隊が未配置です"
            description={
              hasBenchUnits
                ? "Bench にユニットがあります。Auto Deploy ですぐ戦闘に参加できます。"
                : "まず Summon でユニットを引いてから盤面に配置してください。"
            }
            action={
              <div className="eg-toolbar">
                {hasBenchUnits ? (
                  <Button variant="primary" onClick={actions.autoDeployBench}>
                    Auto Deploy
                  </Button>
                ) : null}
                <Button onClick={() => navigate("/summon")}>Go Summon</Button>
              </div>
            }
          />
        ) : null}
        <div className="eg-slot-grid">
          {board.map((placement) => (
            <div key={`${placement.slot.area}-${placement.slot.index}`} className="eg-slot">
              <div className="eg-slot-title">{slotLabel(placement.slot.index)}</div>
              {placement.instance ? (
                <>
                  <div className="eg-slot-name">
                    {placement.instance.heroId} · ★{placement.instance.star} · Lv.{placement.instance.level}
                  </div>
                  <div className="eg-slot-actions">
                    <Button onClick={() => actions.levelHero(placement.slot)}>Level Up</Button>
                    {emptyBenchSlot ? (
                      <Button
                        variant="ghost"
                        onClick={() => actions.moveHero(placement.slot, emptyBenchSlot)}
                      >
                        Bench へ戻す
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="eg-slot-empty">空きスロット</div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Bench" subtitle="重複ユニットは盤面に重ねると合成されます">
        {bench.some((placement) => placement.instance) ? (
          <PanelList>
            {bench.map((placement) => {
              const hero = placement.instance;
              if (!hero) {
                return (
                  <PanelRow
                    key={`${placement.slot.area}-${placement.slot.index}`}
                    primary={`${slotLabel(placement.slot.index)} は空き`}
                  />
                );
              }

              const target = findBoardTarget(hero.instanceId, hero.heroId, hero.star);
              return (
                <PanelRow
                  key={hero.instanceId}
                  primary={`${hero.heroId} · ★${hero.star} · Lv.${hero.level}`}
                  secondary={target ? `配置先 ${slotLabel(target.index)}` : "配置先なし"}
                  right={
                    target ? (
                      <Button onClick={() => actions.moveHero(placement.slot, target)}>
                        配置 / Merge
                      </Button>
                    ) : undefined
                  }
                />
              );
            })}
          </PanelList>
        ) : (
          <EmptyState title="Bench は空です" description="ガチャで引いたユニットがここに届きます。" />
        )}
      </Card>

      <Card
        title="Overflow Inbox"
        subtitle={`満杯時に失われず退避された報酬 · ${overflowItems.length} items`}
        actions={
          overflowItems.length > 5 ? (
            <Button variant="ghost" onClick={() => setShowAllOverflow((current) => !current)}>
              {showAllOverflow ? "Show Less" : "Show All"}
            </Button>
          ) : undefined
        }
      >
        {overflowItems.length > 0 ? (
          <PanelList>
            {visibleOverflowItems.map((item) => (
              <PanelRow
                key={item.id}
                primary={item.hero ? `${item.hero.heroId} を保留中` : `${item.equipment?.tierId ?? "item"} を保留中`}
                secondary={item.reason}
                right={<Button onClick={() => actions.claimOverflowItem(item.id)}>回収</Button>}
              />
            ))}
          </PanelList>
        ) : (
          <EmptyState title="Overflow は空です" description="ベンチやインベントリが溢れたときだけここを使います。" />
        )}
      </Card>
    </div>
  );
}

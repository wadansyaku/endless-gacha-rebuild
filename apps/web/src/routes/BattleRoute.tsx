import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PanelList,
  PanelRow,
  Progress,
  SplitGrid,
  classLabels,
  factionLabels,
  rarityLabels
} from "@endless-gacha/ui";
import { getHeroLevelUpCost, getUpgradeCost, getUpgradeEffect } from "@endless-gacha/game-core";
import { useNavigate } from "react-router-dom";
import {
  useGameActions,
  useGameBattle,
  useGameContent,
  useGameHeroPlacements,
  useGameSave
} from "../lib/game-store";
import { formatNumber } from "../lib/format";

const slotLabel = (index: number): string => `Slot ${index + 1}`;

export default function BattleRoute() {
  const navigate = useNavigate();
  const battle = useGameBattle();
  const content = useGameContent();
  const heroPlacements = useGameHeroPlacements();
  const save = useGameSave();
  const actions = useGameActions();
  const board = heroPlacements.filter((placement) => placement.slot.area === "board");
  const bench = heroPlacements.filter((placement) => placement.slot.area === "bench");
  const heroById = new Map(content.heroes.map((hero) => [hero.id, hero] as const));
  const emptyBenchSlot = bench.find((placement) => !placement.instance)?.slot ?? null;
  const overflowItems = save.snapshot.inventory.overflow;
  const hasBoardUnits = board.some((placement) => placement.instance);
  const hasBenchUnits = bench.some((placement) => placement.instance);
  const [showAllOverflow, setShowAllOverflow] = useState(false);
  const visibleOverflowItems = showAllOverflow ? overflowItems : overflowItems.slice(0, 4);
  const tapUpgradeLevel = save.snapshot.meta.upgrades.tapDamage;
  const heroUpgradeLevel = save.snapshot.meta.upgrades.heroDps;
  const tapUpgradeCost = getUpgradeCost(tapUpgradeLevel);
  const heroUpgradeCost = getUpgradeCost(heroUpgradeLevel);
  const prestigeGain = Math.floor(save.snapshot.run.stage / content.stageRules.bossInterval);

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
    <div className="eg-route-stack eg-route-battle">
      <Card
        className="eg-battle-command-card"
        title={battle.isBoss ? "Boss Contact" : "Frontline Sweep"}
        subtitle={`${factionLabels[battle.enemyElement]} / ${battle.enemyTrait} ${battle.isBoss ? ` / ${battle.bossAffix}` : ""}`}
        actions={
          <div className="eg-inline-actions">
            <Badge tone={battle.isBoss ? "warn" : "accent"}>Stage {battle.stage}</Badge>
            <Badge tone="good">Highest {battle.highestStage}</Badge>
          </div>
        }
      >
        <div className="eg-battle-command-grid">
          <div className={`eg-stage-sigil ${battle.isBoss ? "is-boss" : ""}`}>
            <span className="eg-stage-sigil-label">{battle.isBoss ? "BOSS" : "RUN"}</span>
            <strong>{battle.stage}</strong>
            <span className="eg-stage-sigil-copy">{battle.isBoss ? "突破か後退かの局面です" : "前線を押し上げ続ける"}</span>
          </div>

          <div className="eg-battle-vitals">
            <div className="eg-vital-tile">
              <span>Tap Damage</span>
              <strong>{formatNumber(battle.tapDamage)}</strong>
            </div>
            <div className="eg-vital-tile">
              <span>Total DPS</span>
              <strong>{formatNumber(battle.totalDps)}</strong>
            </div>
            <div className="eg-vital-tile">
              <span>Boss Timer</span>
              <strong>{battle.bossTimeLeft ? `${battle.bossTimeLeft.toFixed(1)}s` : "-"}</strong>
            </div>
            <div className="eg-vital-tile">
              <span>Prestige Gain</span>
              <strong>{prestigeGain}</strong>
            </div>
          </div>
        </div>

        <Progress
          value={battle.enemyMaxHp - battle.enemyHp}
          max={battle.enemyMaxHp}
          label={`Enemy HP ${formatNumber(battle.enemyHp)} / ${formatNumber(battle.enemyMaxHp)}`}
          tone={battle.isBoss ? "gold" : "cyan"}
        />

        <div className="eg-command-row">
          <Button variant="primary" onClick={actions.tapEnemy}>
            Pulse Attack
          </Button>
          {hasBenchUnits && !hasBoardUnits ? (
            <Button onClick={actions.autoDeployBench}>Auto Deploy</Button>
          ) : null}
          <Button
            disabled={save.snapshot.meta.gold < tapUpgradeCost}
            onClick={() => actions.buyUpgrade("tapDamage")}
          >
            Tap Mk.{tapUpgradeLevel + 1} · {formatNumber(tapUpgradeCost)}
          </Button>
          <Button
            disabled={save.snapshot.meta.gold < heroUpgradeCost}
            onClick={() => actions.buyUpgrade("heroDps")}
          >
            DPS Mk.{heroUpgradeLevel + 1} · {formatNumber(heroUpgradeCost)}
          </Button>
          <Button variant="danger" disabled={prestigeGain <= 0} onClick={actions.prestige}>
            Prestige {prestigeGain > 0 ? `+${prestigeGain}` : ""}
          </Button>
        </div>

        <p className="eg-action-note">
          Tap x{getUpgradeEffect("tapDamage", tapUpgradeLevel).toFixed(2)} / Hero DPS x
          {getUpgradeEffect("heroDps", heroUpgradeLevel).toFixed(2)}
          {save.snapshot.meta.gold < tapUpgradeCost || save.snapshot.meta.gold < heroUpgradeCost
            ? ` · 次の強化まで Gold ${formatNumber(
                Math.max(0, Math.min(tapUpgradeCost, heroUpgradeCost) - save.snapshot.meta.gold)
              )} 不足`
            : " · どちらの即時強化も実行可能"}
        </p>

        {!hasBoardUnits ? (
          <div className="eg-objective-banner">
            <div>
              <strong>前線が空です。</strong>
              <span>
                {hasBenchUnits
                  ? "Reserve にユニットがあります。Auto Deploy ですぐ戦闘開始できます。"
                  : "まず Summon でユニットを確保し、3x3 盤面へ投入してください。"}
              </span>
            </div>
            <div className="eg-inline-actions">
              {hasBenchUnits ? (
                <Button variant="primary" onClick={actions.autoDeployBench}>
                  Auto Deploy
                </Button>
              ) : null}
              <Button onClick={() => navigate("/summon")}>Go Summon</Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="eg-frontline-card" title="Frontline Formation" subtitle="盤面上の 3x3 がそのまま戦闘出力になります">
        <div className="eg-tactical-grid">
          {board.map((placement) => {
            const hero = placement.instance;
            const definition = hero ? heroById.get(hero.heroId) : null;
            const levelCost = hero ? getHeroLevelUpCost(save, content, hero) : null;

            return (
              <div
                key={`${placement.slot.area}-${placement.slot.index}`}
                className={`eg-unit-slot ${hero ? `eg-rarity-frame-${definition?.rarity?.toLowerCase() ?? "n"}` : "is-empty"}`}
              >
                <div className="eg-unit-slot-head">
                  <span className="eg-slot-title">{slotLabel(placement.slot.index)}</span>
                  {definition ? <Badge tone="accent">{rarityLabels[definition.rarity]}</Badge> : null}
                </div>
                {hero && definition ? (
                  <>
                    <div className="eg-unit-portrait">{definition.emoji}</div>
                    <div className="eg-unit-name">{definition.name}</div>
                    <div className="eg-unit-meta">
                      {factionLabels[definition.faction]} / {classLabels[definition.classType]}
                    </div>
                    <div className="eg-unit-meta">★{hero.star} · Lv.{hero.level}</div>
                    <p className="eg-unit-passive">{definition.passive?.description ?? "固有効果なし"}</p>
                    <div className="eg-slot-actions">
                      <Button
                        disabled={levelCost !== null && save.snapshot.meta.gold < levelCost}
                        onClick={() => actions.levelHero(placement.slot)}
                      >
                        Level · {formatNumber(levelCost ?? 0)}
                      </Button>
                      {emptyBenchSlot ? (
                        <Button variant="ghost" onClick={() => actions.moveHero(placement.slot, emptyBenchSlot)}>
                          Bench
                        </Button>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="eg-unit-slot-empty">空きスロット</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <SplitGrid>
        <Card className="eg-reserve-card" title="Reserve Hangar" subtitle="重複は前線に重ねると Merge されます">
          {bench.some((placement) => placement.instance) ? (
            <div className="eg-reserve-grid">
              {bench.map((placement) => {
                const hero = placement.instance;
                if (!hero) {
                  return (
                    <div key={`${placement.slot.area}-${placement.slot.index}`} className="eg-reserve-tile is-empty">
                      <span>{slotLabel(placement.slot.index)}</span>
                      <strong>Empty</strong>
                    </div>
                  );
                }

                const definition = heroById.get(hero.heroId);
                const target = findBoardTarget(hero.instanceId, hero.heroId, hero.star);
                return (
                  <div
                    key={hero.instanceId}
                    className={`eg-reserve-tile eg-rarity-frame-${definition?.rarity?.toLowerCase() ?? "n"}`}
                  >
                    <div className="eg-reserve-head">
                      <span className="eg-recruit-emoji">{definition?.emoji ?? "?"}</span>
                      <Badge tone="accent">★{hero.star}</Badge>
                    </div>
                    <div className="eg-recruit-name">{definition?.name ?? hero.heroId}</div>
                    <div className="eg-recruit-meta">
                      Lv.{hero.level} · {definition ? rarityLabels[definition.rarity] : "?"}
                    </div>
                    <div className="eg-recruit-meta">
                      {target ? `配置先 ${slotLabel(target.index)}` : "前線が満杯"}
                    </div>
                    {target ? (
                      <Button onClick={() => actions.moveHero(placement.slot, target)}>
                        {board.some(
                          (entry) =>
                            entry.slot.index === target.index &&
                            entry.instance?.heroId === hero.heroId &&
                            entry.instance?.star === hero.star
                        )
                          ? "Merge"
                          : "Deploy"}
                      </Button>
                    ) : (
                      <p className="eg-action-note">空きまたは同星同名の枠が必要です。</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Reserve は空です" description="ガチャで引いたユニットがここに到着します。" />
          )}
        </Card>

        <Card
          className="eg-overflow-card"
          title="Recovery Queue"
          subtitle={`満杯時の退避報酬 ${overflowItems.length} 件`}
          actions={
            overflowItems.length > 4 ? (
              <Button variant="ghost" onClick={() => setShowAllOverflow((current) => !current)}>
                {showAllOverflow ? "Fold" : "Expand"}
              </Button>
            ) : undefined
          }
        >
          {overflowItems.length > 0 ? (
            <PanelList>
              {visibleOverflowItems.map((item) => (
                <PanelRow
                  key={item.id}
                  primary={
                    item.hero
                      ? `${heroById.get(item.hero.heroId)?.name ?? item.hero.heroId} を保留中`
                      : `${item.equipment?.tierId ?? "item"} を保留中`
                  }
                  secondary={item.reason}
                  right={<Button onClick={() => actions.claimOverflowItem(item.id)}>回収</Button>}
                />
              ))}
            </PanelList>
          ) : (
            <EmptyState title="Recovery Queue は空です" description="溢れた報酬があるときだけここに退避されます。" />
          )}
        </Card>
      </SplitGrid>
    </div>
  );
}

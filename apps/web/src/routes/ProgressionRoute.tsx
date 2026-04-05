import { useState } from "react";
import { Button, Card, Chip, EmptyState, PanelList, PanelRow, SectionLabel, SplitGrid } from "@endless-gacha/ui";
import { useGame } from "../lib/game-store";
import { formatNumber, formatRelativeDuration, formatTimestamp } from "../lib/format";

export default function ProgressionRoute() {
  const { content, missions, heroPlacements, save, actions } = useGame();
  const boardHeroes = heroPlacements
    .filter((placement) => placement.slot.area === "board" && placement.instance)
    .map((placement) => placement.instance!);
  const benchHeroes = heroPlacements
    .filter((placement) => placement.slot.area === "bench" && placement.instance)
    .map((placement) => placement.instance!);
  const leader = boardHeroes[0] ?? null;
  const [showAllMissions, setShowAllMissions] = useState(false);
  const [selectedDispatchHeroInstanceId, setSelectedDispatchHeroInstanceId] = useState<string | null>(null);
  const selectedDispatchHero =
    benchHeroes.find((hero) => hero.instanceId === selectedDispatchHeroInstanceId) ?? benchHeroes[0] ?? null;

  const claimableMissions = missions.filter((mission) => mission.claimable);
  const ongoingMissions = missions.filter((mission) => !mission.claimable && !mission.claimed);
  const completedMissions = missions.filter((mission) => mission.claimed);
  const prioritizedMissions = [...claimableMissions, ...ongoingMissions, ...completedMissions];
  const visibleMissions = showAllMissions ? prioritizedMissions : prioritizedMissions.slice(0, 6);

  const synthesisGroups = content.equipment.reduce<Record<string, string[]>>((groups, tier) => {
    const matchingItems = save.snapshot.inventory.order.filter((itemId) => {
      const item = save.snapshot.inventory.items[itemId];
      return item?.tierId === tier.id;
    });

    if (matchingItems.length >= 3) {
      groups[tier.id] = matchingItems;
    }

    return groups;
  }, {});

  return (
    <div className="eg-route-stack">
      <SplitGrid>
        <Card
          title="Missions"
          subtitle={`claimable ${claimableMissions.length} / ongoing ${ongoingMissions.length} / done ${completedMissions.length}`}
          actions={
            prioritizedMissions.length > 6 ? (
              <Button variant="ghost" onClick={() => setShowAllMissions((current) => !current)}>
                {showAllMissions ? "Show Less" : "Show All"}
              </Button>
            ) : undefined
          }
        >
          <div className="eg-choice-row">
            <Chip tone={claimableMissions.length > 0 ? "good" : "neutral"}>Claimable {claimableMissions.length}</Chip>
            <Chip tone="accent">Ongoing {ongoingMissions.length}</Chip>
            <Chip tone="warn">Done {completedMissions.length}</Chip>
          </div>
          <PanelList>
            {visibleMissions.map((mission) => (
              <PanelRow
                key={mission.id}
                primary={`${mission.claimable ? "READY" : mission.claimed ? "DONE" : "LIVE"} · ${mission.title} ${mission.progress}/${mission.target}`}
                secondary={`${mission.kind} · ${mission.description}`}
                right={
                  mission.claimable ? (
                    <Button onClick={() => actions.claimMission(mission.id)}>Claim</Button>
                  ) : undefined
                }
              />
            ))}
          </PanelList>
        </Card>

        <Card title="Core Upgrades">
          <PanelList>
            <PanelRow
              primary={`Tap Damage Lv.${save.snapshot.meta.upgrades.tapDamage}`}
              secondary={`Gold ${formatNumber(save.snapshot.meta.gold)}`}
              right={<Button onClick={() => actions.buyUpgrade("tapDamage")}>Buy</Button>}
            />
            <PanelRow
              primary={`Hero DPS Lv.${save.snapshot.meta.upgrades.heroDps}`}
              secondary={`Prestige Multiplier ${save.snapshot.meta.prestigeMultiplier.toFixed(2)}x`}
              right={<Button onClick={() => actions.buyUpgrade("heroDps")}>Buy</Button>}
            />
          </PanelList>
        </Card>
      </SplitGrid>

      <SplitGrid>
        <Card title="Talents">
          <PanelList>
            {content.talents.map((talent) => (
              <PanelRow
                key={talent.id}
                primary={`${talent.name} Lv.${save.snapshot.meta.talentLevels[talent.id] ?? 0}`}
                secondary={talent.description}
                right={<Button onClick={() => actions.upgradeTalent(talent.id)}>Upgrade</Button>}
              />
            ))}
          </PanelList>
        </Card>

        <Card
          title="Artifacts"
          actions={<Button onClick={actions.artifactGacha}>Shard Gacha</Button>}
        >
          <SectionLabel label="Shard Pool" meta={`${formatNumber(save.snapshot.meta.artifactShards)} shards`} />
          <PanelList>
            {content.artifacts.map((artifact) => (
              <PanelRow
                key={artifact.id}
                primary={`${artifact.name} Lv.${save.snapshot.meta.artifactLevels[artifact.id] ?? 0}`}
                secondary={artifact.description}
                right={<Button onClick={() => actions.upgradeArtifact(artifact.id)}>Upgrade</Button>}
              />
            ))}
          </PanelList>
        </Card>
      </SplitGrid>

      <SplitGrid>
        <Card title="Formations">
          <PanelList>
            {content.formations.map((formation) => {
              const level = save.snapshot.meta.formationLevels[formation.id] ?? 0;
              const isActive = save.snapshot.meta.activeFormationId === formation.id;
              return (
                <PanelRow
                  key={formation.id}
                  primary={`${formation.name} Lv.${level}`}
                  secondary={formation.description}
                  right={
                    <div className="eg-inline-actions">
                      <Button onClick={() => actions.upgradeFormation(formation.id)}>Upgrade</Button>
                      <Button
                        variant={isActive ? "primary" : "ghost"}
                        onClick={() => actions.setActiveFormation(isActive ? null : formation.id)}
                      >
                        {isActive ? "Unset" : "Equip"}
                      </Button>
                    </div>
                  }
                />
              );
            })}
          </PanelList>
        </Card>

        <Card
          title="Expeditions"
          subtitle={
            selectedDispatchHero
              ? `selected ${selectedDispatchHero.heroId} · Lv.${selectedDispatchHero.level} · ★${selectedDispatchHero.star}`
              : "bench の個体だけが派遣されます"
          }
          actions={<Button onClick={actions.claimAllExpeditions}>Claim All</Button>}
        >
          {benchHeroes.length > 0 ? (
            <div className="eg-choice-row">
              {benchHeroes.map((hero) => (
                <Button
                  key={hero.instanceId}
                  variant={selectedDispatchHero?.instanceId === hero.instanceId ? "primary" : "ghost"}
                  onClick={() => setSelectedDispatchHeroInstanceId(hero.instanceId)}
                >
                  {hero.heroId} ★{hero.star}
                </Button>
              ))}
            </div>
          ) : (
            <p className="eg-muted">派遣には bench に空いている個体が必要です。</p>
          )}
          <PanelList>
            {content.expeditions.map((expedition) => {
              const active = Object.values(save.snapshot.expedition.active).find(
                (dispatch) => dispatch.expeditionId === expedition.id
              );

              return (
                <PanelRow
                  key={expedition.id}
                  primary={active ? `${expedition.name} · ${active.hero.heroId}` : expedition.name}
                  secondary={
                    active
                      ? `ready ${formatTimestamp(active.readyAt)} (${formatRelativeDuration(active.readyAt - save.lastProcessedAt)})`
                      : `${expedition.reward.kind} +${formatNumber(expedition.reward.amount)}`
                  }
                  right={
                    active ? (
                      <Button onClick={() => actions.claimExpedition(active.dispatchId)}>Claim</Button>
                    ) : selectedDispatchHero ? (
                      <Button onClick={() => actions.dispatchExpedition(expedition.id, selectedDispatchHero.instanceId)}>
                        Dispatch {selectedDispatchHero.heroId}
                      </Button>
                    ) : undefined
                  }
                />
              );
            })}
          </PanelList>
        </Card>
      </SplitGrid>

      <SplitGrid>
        <Card title="Equipment Inventory" subtitle={`capacity ${save.snapshot.inventory.order.length}/${save.snapshot.inventory.capacity}`}>
          {save.snapshot.inventory.order.length > 0 ? (
            <PanelList>
              {save.snapshot.inventory.order.slice(0, 12).map((itemId) => {
                const item = save.snapshot.inventory.items[itemId];
                if (!item) {
                  return null;
                }

                return (
                  <PanelRow
                    key={item.instanceId}
                    primary={item.tierId}
                    secondary={leader ? `equip target ${leader.heroId}` : "board hero がいません"}
                    right={
                      <div className="eg-inline-actions">
                        {leader ? (
                          <Button onClick={() => actions.equipItem(leader.instanceId, item.instanceId)}>
                            Equip
                          </Button>
                        ) : null}
                        <Button variant="ghost" onClick={() => actions.sellEquipment(item.instanceId)}>
                          Sell
                        </Button>
                      </div>
                    }
                  />
                );
              })}
            </PanelList>
          ) : (
            <EmptyState title="装備はまだありません" description="ボス撃破と派遣で増えていきます。" />
          )}
        </Card>

        <Card title="Smithy" subtitle="同 tier の装備を 3 つで合成">
          {Object.entries(synthesisGroups).length > 0 ? (
            <PanelList>
              {Object.entries(synthesisGroups).map(([tierId, itemIds]) => (
                <PanelRow
                  key={tierId}
                  primary={`${tierId} x${itemIds.length}`}
                  secondary="先頭 3 個を消費します"
                  right={
                    <Button onClick={() => actions.synthesizeEquipment(itemIds.slice(0, 3))}>
                      Synthesize
                    </Button>
                  }
                />
              ))}
            </PanelList>
          ) : (
            <EmptyState title="合成候補なし" description="同じ装備が 3 つ揃うとここに出ます。" />
          )}
        </Card>
      </SplitGrid>
    </div>
  );
}

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  PanelList,
  PanelRow,
  SplitGrid,
  rarityLabels
} from "@endless-gacha/ui";
import {
  getArtifactUpgradeCost,
  getFormationUpgradeCost,
  getTalentUpgradeCost,
  getUpgradeCost,
  getUpgradeEffect
} from "@endless-gacha/game-core";
import {
  useGameActions,
  useGameContent,
  useGameHeroPlacements,
  useGameMissions,
  useGameSave
} from "../lib/game-store";
import { formatNumber, formatRelativeDuration, formatTimestamp } from "../lib/format";

type ProgressionSection = "urgent" | "growth" | "logistics" | "archive";

const sectionMeta: Record<
  ProgressionSection,
  { label: string; title: string; subtitle: string }
> = {
  urgent: {
    label: "Urgent",
    title: "Urgent Queue",
    subtitle: "回収、帰還、転生判断だけを先に処理する"
  },
  growth: {
    label: "Growth",
    title: "Growth Tracks",
    subtitle: "強化先と必要資源を比較しながら伸ばす"
  },
  logistics: {
    label: "Logistics",
    title: "Logistics Deck",
    subtitle: "派遣、装備、合成の物流だけを見る"
  },
  archive: {
    label: "Archive",
    title: "Archive",
    subtitle: "進行中と完了済みの backlog を確認する"
  }
};

const formatReward = (reward: Partial<Record<"gold" | "gems" | "artifactShards", number | undefined>>): string =>
  Object.entries(reward)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0)
    .map(([kind, amount]) => `${kind} +${formatNumber(amount)}`)
    .join(" · ");

export default function ProgressionRoute() {
  const content = useGameContent();
  const missions = useGameMissions();
  const heroPlacements = useGameHeroPlacements();
  const save = useGameSave();
  const actions = useGameActions();
  const [activeSection, setActiveSection] = useState<ProgressionSection>("urgent");
  const [selectedDispatchHeroInstanceId, setSelectedDispatchHeroInstanceId] = useState<string | null>(null);

  const boardHeroes = heroPlacements
    .filter((placement) => placement.slot.area === "board" && placement.instance)
    .map((placement) => placement.instance!);
  const benchHeroes = heroPlacements
    .filter((placement) => placement.slot.area === "bench" && placement.instance)
    .map((placement) => placement.instance!);
  const leader = boardHeroes[0] ?? null;
  const selectedDispatchHero =
    benchHeroes.find((hero) => hero.instanceId === selectedDispatchHeroInstanceId) ?? benchHeroes[0] ?? null;
  const claimableMissions = missions.filter((mission) => mission.claimable);
  const ongoingMissions = missions
    .filter((mission) => !mission.claimable && !mission.claimed)
    .sort((left, right) => right.progress / right.target - left.progress / left.target);
  const completedMissions = missions.filter((mission) => mission.claimed);
  const activeExpeditions = save.snapshot.expedition.order
    .map((dispatchId) => save.snapshot.expedition.active[dispatchId])
    .filter((dispatch): dispatch is NonNullable<typeof dispatch> => Boolean(dispatch));
  const readyExpeditions = activeExpeditions.filter((dispatch) => dispatch.readyAt <= save.lastProcessedAt);
  const ongoingExpeditions = activeExpeditions.filter((dispatch) => dispatch.readyAt > save.lastProcessedAt);
  const prestigeGain = Math.floor(save.snapshot.run.stage / content.stageRules.bossInterval);
  const equipmentById = new Map(content.equipment.map((tier) => [tier.id, tier] as const));
  const heroById = new Map(content.heroes.map((hero) => [hero.id, hero] as const));
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
  const activeSectionMeta = sectionMeta[activeSection];

  return (
    <div className="eg-route-stack eg-route-progression">
      <Card
        className="eg-war-room-card"
        title="War Room"
        subtitle="全部を同時に読むのではなく、いま必要な面だけを開く"
        actions={<Badge tone={claimableMissions.length > 0 || readyExpeditions.length > 0 ? "good" : "accent"}>{activeSectionMeta.label}</Badge>}
      >
        <div className="eg-brief-grid eg-war-room-glance">
          <div className="eg-brief-stat">
            <span>Mission Ready</span>
            <strong>{claimableMissions.length}</strong>
          </div>
          <div className="eg-brief-stat">
            <span>Relay Ready</span>
            <strong>{readyExpeditions.length}</strong>
          </div>
          <div className="eg-brief-stat">
            <span>Prestige</span>
            <strong>{prestigeGain}</strong>
          </div>
          <div className="eg-brief-stat">
            <span>Forge Queue</span>
            <strong>{Object.keys(synthesisGroups).length}</strong>
          </div>
        </div>

        <div className="eg-segment-row" role="tablist" aria-label="War Room sections">
          {(Object.keys(sectionMeta) as ProgressionSection[]).map((section) => (
            <button
              key={section}
              type="button"
              role="tab"
              aria-selected={activeSection === section}
              className={["eg-segment-button", activeSection === section ? "is-active" : ""].filter(Boolean).join(" ")}
              onClick={() => setActiveSection(section)}
            >
              <span className="eg-dock-kicker">{sectionMeta[section].label}</span>
              <span className="eg-dock-label">{sectionMeta[section].title}</span>
            </button>
          ))}
        </div>

        <div className="eg-note-card eg-section-intro">
          <strong>{activeSectionMeta.title}</strong>
          <span>{activeSectionMeta.subtitle}</span>
        </div>
      </Card>

      {activeSection === "urgent" ? (
        <Card className="eg-section-card" title="Urgent Queue" subtitle="即時に価値が返る対象だけを並べる">
          <div className="eg-urgent-grid">
            <div className="eg-urgent-column">
              <div className="eg-subsection-heading">
                <span>Mission Ready</span>
                <Chip tone={claimableMissions.length > 0 ? "good" : "neutral"}>{claimableMissions.length}</Chip>
              </div>
              {claimableMissions.length > 0 ? (
                <PanelList>
                  {claimableMissions.slice(0, 4).map((mission) => (
                    <PanelRow
                      key={mission.id}
                      primary={mission.title}
                      secondary={formatReward(mission.reward)}
                      right={<Button onClick={() => actions.claimMission(mission.id)}>Claim</Button>}
                    />
                  ))}
                </PanelList>
              ) : ongoingMissions[0] ? (
                <div className="eg-note-card">
                  <strong>{ongoingMissions[0].title}</strong>
                  <span>
                    {ongoingMissions[0].progress} / {ongoingMissions[0].target} · {formatReward(ongoingMissions[0].reward)}
                  </span>
                </div>
              ) : (
                <p className="eg-muted">現在 claimable な任務はありません。</p>
              )}
            </div>

            <div className="eg-urgent-column">
              <div className="eg-subsection-heading">
                <span>Relay Return</span>
                <Chip tone={readyExpeditions.length > 0 ? "good" : "accent"}>{readyExpeditions.length}</Chip>
              </div>
              {readyExpeditions.length > 0 ? (
                <PanelList>
                  {readyExpeditions.slice(0, 4).map((dispatch) => {
                    const expedition = content.expeditions.find((entry) => entry.id === dispatch.expeditionId);
                    return (
                      <PanelRow
                        key={dispatch.dispatchId}
                        primary={`${expedition?.name ?? dispatch.expeditionId} · ${heroById.get(dispatch.hero.heroId)?.name ?? dispatch.hero.heroId}`}
                        secondary={formatReward({ [expedition?.reward.kind ?? "gold"]: expedition?.reward.amount ?? 0 })}
                        right={<Button onClick={() => actions.claimExpedition(dispatch.dispatchId)}>Claim</Button>}
                      />
                    );
                  })}
                </PanelList>
              ) : ongoingExpeditions[0] ? (
                <div className="eg-note-card">
                  <strong>{content.expeditions.find((entry) => entry.id === ongoingExpeditions[0]?.expeditionId)?.name ?? "Expedition"}</strong>
                  <span>{formatRelativeDuration(ongoingExpeditions[0].readyAt - save.lastProcessedAt)} 後に帰還</span>
                </div>
              ) : (
                <p className="eg-muted">現在稼働中の派遣はありません。</p>
              )}
            </div>

            <div className="eg-urgent-column">
              <div className="eg-subsection-heading">
                <span>Ascension Window</span>
                <Chip tone={prestigeGain > 0 ? "warn" : "neutral"}>{prestigeGain} pt</Chip>
              </div>
              <div className="eg-note-card">
                <strong>Prestige Multiplier {save.snapshot.meta.prestigeMultiplier.toFixed(2)}x</strong>
                <span>
                  実行後 {prestigeGain > 0 ? `${(save.snapshot.meta.prestigeMultiplier + prestigeGain * 0.1).toFixed(2)}x` : "変化なし"}
                </span>
              </div>
              <Button variant="danger" disabled={prestigeGain <= 0} onClick={actions.prestige}>
                Prestige {prestigeGain > 0 ? `+${prestigeGain}` : ""}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {activeSection === "growth" ? (
        <SplitGrid>
          <Card className="eg-growth-track-card" title="Growth Tracks" subtitle="押す前に必要資源と次の値を比較する">
            <div className="eg-subsection-heading">
              <span>Growth Reserves</span>
              <Chip tone="accent">Gold / Gems / Prestige</Chip>
            </div>
            <div className="eg-brief-grid">
              <div className="eg-brief-stat">
                <span>Gold</span>
                <strong>{formatNumber(save.snapshot.meta.gold)}</strong>
              </div>
              <div className="eg-brief-stat">
                <span>Gems</span>
                <strong>{formatNumber(save.snapshot.meta.gems)}</strong>
              </div>
              <div className="eg-brief-stat">
                <span>Prestige</span>
                <strong>{formatNumber(save.snapshot.meta.prestigePoints)}</strong>
              </div>
              <div className="eg-brief-stat">
                <span>Shards</span>
                <strong>{formatNumber(save.snapshot.meta.artifactShards)}</strong>
              </div>
            </div>

            <div className="eg-subsection-heading">
              <span>Core Systems</span>
              <Chip tone="accent">Gold</Chip>
            </div>
            <PanelList>
              <PanelRow
                primary={`Tap Damage Lv.${save.snapshot.meta.upgrades.tapDamage}`}
                secondary={`x${getUpgradeEffect("tapDamage", save.snapshot.meta.upgrades.tapDamage).toFixed(2)} -> x${getUpgradeEffect("tapDamage", save.snapshot.meta.upgrades.tapDamage + 1).toFixed(2)} · ${formatNumber(getUpgradeCost(save.snapshot.meta.upgrades.tapDamage))} gold`}
                right={
                  <Button
                    disabled={save.snapshot.meta.gold < getUpgradeCost(save.snapshot.meta.upgrades.tapDamage)}
                    onClick={() => actions.buyUpgrade("tapDamage")}
                  >
                    Upgrade
                  </Button>
                }
              />
              <PanelRow
                primary={`Hero DPS Lv.${save.snapshot.meta.upgrades.heroDps}`}
                secondary={`x${getUpgradeEffect("heroDps", save.snapshot.meta.upgrades.heroDps).toFixed(2)} -> x${getUpgradeEffect("heroDps", save.snapshot.meta.upgrades.heroDps + 1).toFixed(2)} · ${formatNumber(getUpgradeCost(save.snapshot.meta.upgrades.heroDps))} gold`}
                right={
                  <Button
                    disabled={save.snapshot.meta.gold < getUpgradeCost(save.snapshot.meta.upgrades.heroDps)}
                    onClick={() => actions.buyUpgrade("heroDps")}
                  >
                    Upgrade
                  </Button>
                }
              />
            </PanelList>

            <div className="eg-subsection-heading">
              <span>Formations</span>
              <Chip tone="warn">{content.formations.length}</Chip>
            </div>
            <PanelList>
              {content.formations.map((formation) => {
                const level = save.snapshot.meta.formationLevels[formation.id] ?? 0;
                const cost = getFormationUpgradeCost(save, content, formation.id);
                const isActive = save.snapshot.meta.activeFormationId === formation.id;

                return (
                  <PanelRow
                    key={formation.id}
                    primary={`${formation.name} Lv.${level}`}
                    secondary={`${formation.description} · ${formatNumber(cost)} gems`}
                    right={
                      <div className="eg-inline-actions">
                        <Button
                          disabled={save.snapshot.meta.gems < cost}
                          onClick={() => actions.upgradeFormation(formation.id)}
                        >
                          Upgrade
                        </Button>
                        <Button
                          variant={isActive ? "primary" : "ghost"}
                          onClick={() => actions.setActiveFormation(isActive ? null : formation.id)}
                        >
                          {isActive ? "Equipped" : "Equip"}
                        </Button>
                      </div>
                    }
                  />
                );
              })}
            </PanelList>
          </Card>

          <Card className="eg-ascension-card" title="Ascension Lab" subtitle="転生資産の使い道をここへ集約する">
            <div className="eg-subsection-heading">
              <span>Talents</span>
              <Chip tone="accent">{formatNumber(save.snapshot.meta.prestigePoints)} pt</Chip>
            </div>
            <PanelList>
              {content.talents.slice(0, 6).map((talent) => {
                const level = save.snapshot.meta.talentLevels[talent.id] ?? 0;
                const cost = getTalentUpgradeCost(save, content, talent.id);
                const capped = level >= talent.maxLevel;

                return (
                  <PanelRow
                    key={talent.id}
                    primary={`${talent.name} Lv.${level}/${talent.maxLevel}`}
                    secondary={`${talent.description} · ${capped ? "MAX" : `${formatNumber(cost)} prestige`}`}
                    right={
                      <Button
                        disabled={capped || save.snapshot.meta.prestigePoints < cost}
                        onClick={() => actions.upgradeTalent(talent.id)}
                      >
                        {capped ? "MAX" : "Upgrade"}
                      </Button>
                    }
                  />
                );
              })}
            </PanelList>

            <div className="eg-subsection-heading">
              <span>Artifacts</span>
              <Chip tone="warn">{formatNumber(save.snapshot.meta.artifactShards)} shards</Chip>
            </div>
            <div className="eg-toolbar">
              <Button disabled={save.snapshot.meta.artifactShards < 10} onClick={actions.artifactGacha}>
                Shard Gacha · 10
              </Button>
            </div>
            <PanelList>
              {content.artifacts.slice(0, 6).map((artifact) => {
                const level = save.snapshot.meta.artifactLevels[artifact.id] ?? 0;
                const cost = getArtifactUpgradeCost(save, content, artifact.id);
                const capped = level >= artifact.maxLevel;

                return (
                  <PanelRow
                    key={artifact.id}
                    primary={`${artifact.name} Lv.${level}/${artifact.maxLevel}`}
                    secondary={`${artifact.description} · ${capped ? "MAX" : `${formatNumber(cost)} prestige`}`}
                    right={
                      <Button
                        disabled={capped || save.snapshot.meta.prestigePoints < cost}
                        onClick={() => actions.upgradeArtifact(artifact.id)}
                      >
                        {capped ? "MAX" : "Upgrade"}
                      </Button>
                    }
                  />
                );
              })}
            </PanelList>
          </Card>
        </SplitGrid>
      ) : null}

      {activeSection === "logistics" ? (
        <SplitGrid>
          <Card
            className="eg-relay-card"
            title="Relay Bay"
            subtitle={
              selectedDispatchHero
                ? `${heroById.get(selectedDispatchHero.heroId)?.name ?? selectedDispatchHero.heroId} を次の派遣候補に選択中`
                : "bench の個体だけが派遣されます"
            }
            actions={<Button onClick={actions.claimAllExpeditions}>Claim All</Button>}
          >
            {benchHeroes.length > 0 ? (
              <div className="eg-choice-row">
                {benchHeroes.map((hero) => {
                  const definition = heroById.get(hero.heroId);
                  return (
                    <Button
                      key={hero.instanceId}
                      variant={selectedDispatchHero?.instanceId === hero.instanceId ? "primary" : "ghost"}
                      onClick={() => setSelectedDispatchHeroInstanceId(hero.instanceId)}
                    >
                      {definition?.name ?? hero.heroId} {rarityLabels[definition?.rarity ?? "N"]} ★{hero.star}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <p className="eg-muted">派遣には bench の空き個体が必要です。</p>
            )}

            <PanelList>
              {content.expeditions.map((expedition) => {
                const active = Object.values(save.snapshot.expedition.active).find(
                  (dispatch) => dispatch.expeditionId === expedition.id
                );
                const unlocked = save.snapshot.run.highestStage >= expedition.unlockStage;
                const dispatchDisabled = !selectedDispatchHero || !unlocked;

                return (
                  <PanelRow
                    key={expedition.id}
                    primary={active ? `${expedition.name} · ${heroById.get(active.hero.heroId)?.name ?? active.hero.heroId}` : expedition.name}
                    secondary={
                      active
                        ? `ready ${formatTimestamp(active.readyAt)} (${formatRelativeDuration(active.readyAt - save.lastProcessedAt)})`
                        : unlocked
                          ? `${expedition.reward.kind} +${formatNumber(expedition.reward.amount)} · ${expedition.durationMinutes}m`
                          : `unlock stage ${expedition.unlockStage}`
                    }
                    right={
                      active ? (
                        <Button onClick={() => actions.claimExpedition(active.dispatchId)}>Claim</Button>
                      ) : (
                        <Button
                          disabled={dispatchDisabled}
                          onClick={() => {
                            if (selectedDispatchHero) {
                              actions.dispatchExpedition(expedition.id, selectedDispatchHero.instanceId);
                            }
                          }}
                        >
                          Dispatch
                        </Button>
                      )
                    }
                  />
                );
              })}
            </PanelList>
          </Card>

          <Card
            className="eg-forge-card"
            title="Forge Deck"
            subtitle={`inventory ${save.snapshot.inventory.order.length}/${save.snapshot.inventory.capacity}`}
          >
            {save.snapshot.inventory.order.length > 0 ? (
              <PanelList>
                {save.snapshot.inventory.order.slice(0, 8).map((itemId) => {
                  const item = save.snapshot.inventory.items[itemId];
                  const tier = item ? equipmentById.get(item.tierId) : null;
                  if (!item || !tier) {
                    return null;
                  }

                  return (
                    <PanelRow
                      key={item.instanceId}
                      primary={`${tier.name} · ${tier.type} · ${tier.rarity}`}
                      secondary={`+${formatNumber(tier.dpsBonus)} / x${tier.dpsMultiplier.toFixed(2)} · ${leader ? `${heroById.get(leader.heroId)?.name ?? leader.heroId} に装備` : "leader 不在"}`}
                      right={
                        <div className="eg-inline-actions">
                          {leader ? (
                            <Button onClick={() => actions.equipItem(leader.instanceId, item.instanceId)}>Equip</Button>
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
              <EmptyState title="装備はまだありません" description="ボス撃破と派遣で徐々に増えていきます。" />
            )}

            <div className="eg-subsection-heading">
              <span>Smithy Queue</span>
              <Chip tone="accent">{Object.keys(synthesisGroups).length}</Chip>
            </div>
            {Object.entries(synthesisGroups).length > 0 ? (
              <PanelList>
                {Object.entries(synthesisGroups).map(([tierId, itemIds]) => {
                  const tier = equipmentById.get(tierId);
                  const target = tier?.synthesisTargetRarity ?? "MAX";
                  return (
                    <PanelRow
                      key={tierId}
                      primary={`${tier?.name ?? tierId} x${itemIds.length}`}
                      secondary={`先頭 3 個を消費して ${target} へ進める`}
                      right={<Button onClick={() => actions.synthesizeEquipment(itemIds.slice(0, 3))}>Synthesize</Button>}
                    />
                  );
                })}
              </PanelList>
            ) : (
              <p className="eg-muted">同 tier の装備が 3 つ揃うとここに合成候補が出ます。</p>
            )}
          </Card>
        </SplitGrid>
      ) : null}

      {activeSection === "archive" ? (
        <SplitGrid>
          <Card className="eg-section-card" title="Mission Archive" subtitle="進行中と完了済みの backlog">
            <div className="eg-subsection-heading">
              <span>Ongoing Missions</span>
              <Chip tone="accent">{ongoingMissions.length}</Chip>
            </div>
            {ongoingMissions.length > 0 ? (
              <PanelList>
                {ongoingMissions.slice(0, 8).map((mission) => (
                  <PanelRow
                    key={mission.id}
                    primary={mission.title}
                    secondary={`${mission.progress}/${mission.target} · ${formatReward(mission.reward)}`}
                  />
                ))}
              </PanelList>
            ) : (
              <p className="eg-muted">進行中の任務はありません。</p>
            )}
          </Card>

          <Card className="eg-section-card" title="Ops Archive" subtitle="完了済みと稼働中の状態を確認する">
            <div className="eg-subsection-heading">
              <span>Completed Missions</span>
              <Chip tone="warn">{completedMissions.length}</Chip>
            </div>
            {completedMissions.length > 0 ? (
              <PanelList>
                {completedMissions.slice(0, 8).map((mission) => (
                  <PanelRow
                    key={mission.id}
                    primary={mission.title}
                    secondary="受領済み"
                  />
                ))}
              </PanelList>
            ) : (
              <p className="eg-muted">完了済み任務はまだありません。</p>
            )}

            <div className="eg-subsection-heading">
              <span>Active Expeditions</span>
              <Chip tone="accent">{activeExpeditions.length}</Chip>
            </div>
            {activeExpeditions.length > 0 ? (
              <PanelList>
                {activeExpeditions.map((dispatch) => (
                  <PanelRow
                    key={dispatch.dispatchId}
                    primary={`${content.expeditions.find((entry) => entry.id === dispatch.expeditionId)?.name ?? dispatch.expeditionId} · ${heroById.get(dispatch.hero.heroId)?.name ?? dispatch.hero.heroId}`}
                    secondary={`ready ${formatTimestamp(dispatch.readyAt)} (${formatRelativeDuration(dispatch.readyAt - save.lastProcessedAt)})`}
                  />
                ))}
              </PanelList>
            ) : (
              <p className="eg-muted">稼働中の派遣はありません。</p>
            )}
          </Card>
        </SplitGrid>
      ) : null}
    </div>
  );
}

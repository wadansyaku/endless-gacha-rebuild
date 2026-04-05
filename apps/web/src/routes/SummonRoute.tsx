import { Badge, Button, Card, PanelList, PanelRow, SplitGrid } from "@endless-gacha/ui";
import { useGame } from "../lib/game-store";
import { formatNumber } from "../lib/format";

export default function SummonRoute() {
  const { content, save, actions, lastGachaResult } = useGame();

  return (
    <div className="eg-route-stack">
      <SplitGrid>
        {content.banners.map((banner) => (
          <Card
            key={banner.id}
            title={banner.name}
            subtitle={`${banner.currency} · ${formatNumber(banner.cost)}`}
            actions={<Badge tone={banner.kind === "premium" ? "accent" : "neutral"}>{banner.kind}</Badge>}
          >
            <p className="eg-muted">
              {banner.kind === "premium"
                ? `Pity ${save.snapshot.meta.pityCounter} / ${banner.pityLimit ?? 30}`
                : "Gold banner with discount talents."}
            </p>
            <div className="eg-toolbar">
              <Button onClick={() => actions.pullBanner(banner.id, 1)}>1 Pull</Button>
              <Button variant="primary" onClick={() => actions.pullBanner(banner.id, 10)}>10 Pull</Button>
            </div>
            <PanelList>
              {banner.poolHeroIds.slice(0, 5).map((heroId) => (
                <PanelRow key={heroId} primary={heroId} />
              ))}
            </PanelList>
          </Card>
        ))}
      </SplitGrid>

      <Card title="Summon Status">
        <div className="eg-stat-grid">
          <div className="eg-kpi">
            <span>Total Pulls</span>
            <strong>{formatNumber(save.snapshot.meta.lifetimeStats.gachaPulls)}</strong>
          </div>
          <div className="eg-kpi">
            <span>Daily Pulls</span>
            <strong>{formatNumber(save.snapshot.meta.dailyStats.gachaPulls)}</strong>
          </div>
          <div className="eg-kpi">
            <span>Unlocked Heroes</span>
            <strong>{formatNumber(save.snapshot.roster.unlockedHeroIds.length)}</strong>
          </div>
          <div className="eg-kpi">
            <span>Auto Sell N</span>
            <strong>{save.snapshot.meta.autoSellCommon ? "ON" : "OFF"}</strong>
          </div>
        </div>
        <div className="eg-toolbar">
          <Button onClick={actions.toggleAutoSellCommon}>N 自動売却切替</Button>
        </div>
      </Card>

      <Card
        title="Latest Pull Result"
        subtitle={
          lastGachaResult
            ? `${lastGachaResult.banner.name} · ${lastGachaResult.pulls.length} pull`
            : "まだガチャ結果はありません"
        }
      >
        {lastGachaResult ? (
          <PanelList>
            {lastGachaResult.pulls.map((hero) => {
              const definition = content.heroes.find((entry) => entry.id === hero.heroId);
              return (
                <PanelRow
                  key={hero.instanceId}
                  primary={`${definition?.name ?? hero.heroId} · ${definition?.rarity ?? "?"}`}
                  secondary={`${definition?.faction ?? "Unknown"} / ${definition?.classType ?? "Unknown"} · instance ${hero.instanceId}`}
                />
              );
            })}
          </PanelList>
        ) : (
          <p className="eg-muted">1 Pull / 10 Pull の直後に、ここで結果を確認できます。</p>
        )}
      </Card>
    </div>
  );
}

import { Badge, Button, Card, SplitGrid, rarityLabels } from "@endless-gacha/ui";
import { getBannerPullCost, getBannerRates } from "@endless-gacha/game-core";
import { useGameActions, useGameContent, useGameSave, useGameState } from "../lib/game-store";
import { formatNumber } from "../lib/format";

const formatRate = (value: number): string => `${(value * 100).toFixed(value < 0.01 ? 1 : 0)}%`;

export default function SummonRoute() {
  const content = useGameContent();
  const save = useGameSave();
  const actions = useGameActions();
  const lastGachaResult = useGameState((state) => state.lastGachaResult);

  return (
    <div className="eg-route-stack eg-route-summon">
      <Card
        className="eg-recruitment-brief"
        title="Recruitment Chamber"
        subtitle="次の主力を補給し、直後の戦力上昇をここで確認する"
      >
        <div className="eg-brief-grid">
          <div className="eg-brief-stat">
            <span>Total Pulls</span>
            <strong>{formatNumber(save.snapshot.meta.lifetimeStats.gachaPulls)}</strong>
          </div>
          <div className="eg-brief-stat">
            <span>Daily Pulls</span>
            <strong>{formatNumber(save.snapshot.meta.dailyStats.gachaPulls)}</strong>
          </div>
          <div className="eg-brief-stat">
            <span>Unlocked</span>
            <strong>{formatNumber(save.snapshot.roster.unlockedHeroIds.length)}</strong>
          </div>
          <div className="eg-brief-stat">
            <span>Auto Sell N</span>
            <strong>{save.snapshot.meta.autoSellCommon ? "ON" : "OFF"}</strong>
          </div>
        </div>
        <div className="eg-toolbar">
          <Button onClick={actions.toggleAutoSellCommon}>
            N 自動売却 {save.snapshot.meta.autoSellCommon ? "OFF" : "ON"}
          </Button>
        </div>
      </Card>

      <SplitGrid>
        {content.banners.map((banner) => {
          const onePullCost = getBannerPullCost(save, content, banner.id, 1);
          const tenPullCost = getBannerPullCost(save, content, banner.id, 10);
          const currencyAmount = banner.currency === "gold" ? save.snapshot.meta.gold : save.snapshot.meta.gems;
          const onePullAffordable = currencyAmount >= onePullCost;
          const tenPullAffordable = currencyAmount >= tenPullCost;
          const rates = getBannerRates(save, content, banner.id);

          return (
            <Card
              key={banner.id}
              className={`eg-banner-card eg-banner-card-${banner.kind}`}
              title={banner.name}
              subtitle={banner.kind === "premium" ? "高位戦力を狙う高コスト補給" : "安価に枚数を伸ばす常設補給"}
              actions={
                <div className="eg-inline-actions">
                  <Badge tone={banner.kind === "premium" ? "accent" : "neutral"}>{banner.kind.toUpperCase()}</Badge>
                  <Badge tone={currencyAmount >= onePullCost ? "good" : "warn"}>
                    {banner.currency} {formatNumber(currencyAmount)}
                  </Badge>
                </div>
              }
            >
              <div className="eg-banner-body">
                <div className="eg-banner-panel">
                  <div className="eg-banner-kicker">Primary Odds</div>
                  <div className="eg-rate-row">
                    {Object.entries(rates).map(([rarity, rate]) => (
                      <span key={rarity} className={`eg-rate-pill eg-rarity-pill-${rarity.toLowerCase()}`}>
                        {rarityLabels[rarity as keyof typeof rarityLabels]} {formatRate(rate)}
                      </span>
                    ))}
                  </div>
                  <div className="eg-banner-copy">
                    {banner.kind === "premium" ? (
                      <p>
                        Pity {save.snapshot.meta.pityCounter} / {banner.pityLimit ?? 30}
                      </p>
                    ) : (
                      <p>Talent に応じて Gold 消費が軽くなります。</p>
                    )}
                  </div>
                  <div className="eg-toolbar">
                    <Button
                      disabled={!onePullAffordable}
                      onClick={() => actions.pullBanner(banner.id, 1)}
                    >
                      1 Pull · {formatNumber(onePullCost)}
                    </Button>
                    <Button
                      variant="primary"
                      disabled={!tenPullAffordable}
                      onClick={() => actions.pullBanner(banner.id, 10)}
                    >
                      10 Pull · {formatNumber(tenPullCost)}
                    </Button>
                  </div>
                  <p className="eg-action-note">
                    {tenPullAffordable
                      ? `10 連後も ${banner.currency} ${formatNumber(currencyAmount - tenPullCost)} を保持`
                      : `あと ${formatNumber(tenPullCost - currencyAmount)} ${banner.currency} で 10 連可能`}
                  </p>
                </div>

                <div className="eg-banner-roster">
                  {banner.poolHeroIds.slice(0, 6).map((heroId) => {
                    const hero = content.heroes.find((entry) => entry.id === heroId);
                    return (
                      <div key={heroId} className={`eg-recruit-card eg-rarity-frame-${hero?.rarity?.toLowerCase() ?? "n"}`}>
                        <div className="eg-recruit-emoji">{hero?.emoji ?? "?"}</div>
                        <div className="eg-recruit-name">{hero?.name ?? heroId}</div>
                        <div className="eg-recruit-meta">
                          {hero?.rarity ?? "?"} · {hero?.faction ?? "Unknown"} / {hero?.classType ?? "Unknown"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          );
        })}
      </SplitGrid>

      <Card
        className="eg-acquisition-card"
        title="Acquisition Feed"
        subtitle={
          lastGachaResult
            ? `${lastGachaResult.banner.name} · ${lastGachaResult.pulls.length} pull`
            : "まだ補給ログはありません"
        }
      >
        {lastGachaResult ? (
          <div className="eg-acquisition-grid">
            {lastGachaResult.pulls.map((hero) => {
              const definition = content.heroes.find((entry) => entry.id === hero.heroId);
              return (
                <div
                  key={hero.instanceId}
                  className={`eg-acquisition-tile eg-rarity-frame-${definition?.rarity?.toLowerCase() ?? "n"}`}
                >
                  <div className="eg-acquisition-head">
                    <span className="eg-acquisition-emoji">{definition?.emoji ?? "?"}</span>
                    <Badge tone="accent">{definition?.rarity ?? "?"}</Badge>
                  </div>
                  <div className="eg-acquisition-name">{definition?.name ?? hero.heroId}</div>
                  <div className="eg-acquisition-meta">
                    {definition?.faction ?? "Unknown"} / {definition?.classType ?? "Unknown"}
                  </div>
                  <div className="eg-acquisition-meta">instance {hero.instanceId}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="eg-muted">1 Pull または 10 Pull の直後に、ここへ直近の補給結果が表示されます。</p>
        )}
      </Card>
    </div>
  );
}

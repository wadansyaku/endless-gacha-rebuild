import { Suspense, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Badge, Card, PanelList, PanelRow, Shell } from "@endless-gacha/ui";
import { useGame } from "../lib/game-store";
import { formatNumber } from "../lib/format";
import { routePreloaders } from "./route-modules";

const navItems = [
  {
    id: "battle",
    label: "Frontline",
    kicker: "Battle",
    subtitle: "敵を押し返し、前線の 3x3 に戦力を送り込む",
    href: "/battle",
    preload: routePreloaders.battle
  },
  {
    id: "summon",
    label: "Recruitment",
    kicker: "Summon",
    subtitle: "補給線を開き、次の主力を引き当てる",
    href: "/summon",
    preload: routePreloaders.summon
  },
  {
    id: "progression",
    label: "War Room",
    kicker: "Progression",
    subtitle: "今回収するもの、次に伸ばすもの、物流を整理する",
    href: "/progression",
    preload: routePreloaders.progression
  },
  {
    id: "collection",
    label: "Codex",
    kicker: "Collection",
    subtitle: "解放済みユニットと覚醒進行を確認する",
    href: "/collection",
    preload: routePreloaders.collection
  },
  {
    id: "social",
    label: "Relay",
    kicker: "Social",
    subtitle: "クラウド保存とランキングの中継面",
    href: "/social",
    preload: routePreloaders.social
  },
  {
    id: "settings",
    label: "Lab",
    kicker: "Settings",
    subtitle: "playtest と保存操作を扱う検証面",
    href: "/settings",
    preload: routePreloaders.settings
  }
] as const;

const preloadGraph: Record<(typeof navItems)[number]["id"], Array<(typeof navItems)[number]["id"]>> = {
  battle: ["summon", "progression"],
  summon: ["battle", "progression"],
  progression: ["battle", "summon", "collection"],
  collection: ["progression", "social"],
  social: ["settings", "battle"],
  settings: ["battle", "social"]
};

const getActiveId = (pathname: string): (typeof navItems)[number]["id"] => {
  if (pathname.startsWith("/battle")) return "battle";
  if (pathname.startsWith("/summon")) return "summon";
  if (pathname.startsWith("/progression")) return "progression";
  if (pathname.startsWith("/collection")) return "collection";
  if (pathname.startsWith("/social")) return "social";
  if (pathname.startsWith("/settings")) return "settings";
  return "battle";
};

export function AppShell() {
  const location = useLocation();
  const { battle, content, events, missions, save, cloudEnabled, user, saveNotice } = useGame();
  const activeId = getActiveId(location.pathname);
  const activeNav = navItems.find((item) => item.id === activeId) ?? navItems[0];
  const boardCount = save.snapshot.roster.board.filter((entry) => entry !== null).length;
  const overflowCount = save.snapshot.inventory.overflow.length;
  const readyExpeditionCount = save.snapshot.expedition.order.filter((dispatchId) => {
    const dispatch = save.snapshot.expedition.active[dispatchId];
    return dispatch ? dispatch.readyAt <= save.lastProcessedAt : false;
  }).length;
  const activeFormation = content.formations.find((entry) => entry.id === save.snapshot.meta.activeFormationId) ?? null;
  const claimableMissionCount = missions.filter((mission) => mission.claimable).length;

  useEffect(() => {
    const preloadLikelyRoutes = () => {
      preloadGraph[activeId].forEach((routeId) => {
        const item = navItems.find((entry) => entry.id === routeId);
        if (item) {
          void item.preload();
        }
      });
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const callbackId = window.requestIdleCallback(preloadLikelyRoutes);
      return () => {
        window.cancelIdleCallback(callbackId);
      };
    }

    const timeoutId = globalThis.setTimeout(preloadLikelyRoutes, 180);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [activeId]);

  return (
    <Shell
      title={activeNav.label}
      subtitle={activeNav.subtitle}
      topActions={
        <div className="eg-command-hud">
          <div className="eg-hud-cluster">
            <div className="eg-hud-tile eg-hud-tile-stage">
              <span className="eg-hud-label">Stage</span>
              <strong>{battle.stage}</strong>
              <span className="eg-hud-hint">Highest {battle.highestStage}</span>
            </div>
            <div className="eg-hud-tile">
              <span className="eg-hud-label">DPS</span>
              <strong>{formatNumber(battle.totalDps)}</strong>
              <span className="eg-hud-hint">Tap {formatNumber(battle.tapDamage)}</span>
            </div>
            <div className="eg-hud-tile">
              <span className="eg-hud-label">Gold</span>
              <strong>{formatNumber(save.snapshot.meta.gold)}</strong>
              <span className="eg-hud-hint">Gems {formatNumber(save.snapshot.meta.gems)}</span>
            </div>
          </div>
          <div className="eg-hud-cluster eg-hud-cluster-compact">
            <Badge tone={claimableMissionCount > 0 ? "good" : "neutral"}>Mission {claimableMissionCount}</Badge>
            <Badge tone={readyExpeditionCount > 0 ? "good" : "accent"}>Relay {readyExpeditionCount}</Badge>
            <Badge tone={cloudEnabled ? "accent" : "warn"}>
              {cloudEnabled ? (user ? "Cloud Linked" : "Cloud Optional") : "Local Only"}
            </Badge>
          </div>
        </div>
      }
      nav={
        <div className="eg-command-dock">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.href}
              onMouseEnter={() => void item.preload()}
              onFocus={() => void item.preload()}
              className={({ isActive }) =>
                ["eg-tab", "eg-dock-tab", isActive || activeId === item.id ? "is-active" : ""].filter(Boolean).join(" ")
              }
            >
              <span className="eg-dock-kicker">{item.kicker}</span>
              <span className="eg-dock-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
      }
      sidebar={
        <div className="eg-signal-stack">
          <Card className="eg-signal-card" title="Signal Rail" subtitle="直近の優先状況">
            <div className="eg-signal-grid">
              <div className="eg-signal-pill">
                <span>Board</span>
                <strong>{boardCount}/9</strong>
              </div>
              <div className="eg-signal-pill">
                <span>Overflow</span>
                <strong>{overflowCount}</strong>
              </div>
              <div className="eg-signal-pill">
                <span>Shards</span>
                <strong>{formatNumber(save.snapshot.meta.artifactShards)}</strong>
              </div>
              <div className="eg-signal-pill">
                <span>Formation</span>
                <strong>{activeFormation?.name ?? "None"}</strong>
              </div>
            </div>
            <PanelList>
              <PanelRow primary={`回収待ち任務 ${claimableMissionCount}`} secondary="War Room から即回収できます" />
              <PanelRow primary={`帰還待ち派遣 ${readyExpeditionCount}`} secondary="ready な個体は Progression で回収" />
              {saveNotice ? <PanelRow primary="Save Notice" secondary={saveNotice} /> : null}
            </PanelList>
          </Card>

          <Card className="eg-feed-card" title="Combat Feed" subtitle="最新 8 件">
            <PanelList>
              {events.slice(0, 8).map((event, index) => (
                <PanelRow key={`${event}-${index}`} primary={event} />
              ))}
            </PanelList>
          </Card>
        </div>
      }
    >
      <Suspense
        fallback={
          <div className="eg-route-loading">
            <div className="eg-route-loading-kicker">{activeNav.kicker}</div>
            <div className="eg-route-loading-title">{activeNav.label} を展開中</div>
            <div className="eg-route-loading-bar">
              <span />
            </div>
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </Shell>
  );
}

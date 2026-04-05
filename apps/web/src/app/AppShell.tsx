import { Suspense, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Badge, Button, Card, PanelList, PanelRow, Progress, Shell, Stat } from "@endless-gacha/ui";
import { useGame } from "../lib/game-store";
import { formatNumber } from "../lib/format";
import { routePreloaders } from "./route-modules";

const navItems = [
  { id: "battle", label: "Battle", href: "/battle", preload: routePreloaders.battle },
  { id: "summon", label: "Summon", href: "/summon", preload: routePreloaders.summon },
  { id: "progression", label: "Progression", href: "/progression", preload: routePreloaders.progression },
  { id: "collection", label: "Collection", href: "/collection", preload: routePreloaders.collection },
  { id: "social", label: "Social", href: "/social", preload: routePreloaders.social },
  { id: "settings", label: "Settings", href: "/settings", preload: routePreloaders.settings }
] as const;

const getActiveId = (pathname: string): string => {
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
  const { battle, events, save, cloudEnabled, user, actions } = useGame();
  const activeId = getActiveId(location.pathname);

  useEffect(() => {
    const preloadNonActiveRoutes = () => {
      navItems.forEach((item) => {
        if (item.href !== location.pathname) {
          void item.preload();
        }
      });
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const callbackId = window.requestIdleCallback(preloadNonActiveRoutes);
      return () => {
        window.cancelIdleCallback(callbackId);
      };
    }

    const timeoutId = globalThis.setTimeout(preloadNonActiveRoutes, 300);
    return () => {
      globalThis.clearTimeout(timeoutId);
    };
  }, [location.pathname]);

  return (
    <Shell
      title="Endless Gacha"
      subtitle="戦闘・収集・転生を分離した client-authoritative 実装"
      topActions={
        <>
          <Badge tone="accent">Stage {battle.stage}</Badge>
          <Badge tone={cloudEnabled ? "good" : "warn"}>
            {cloudEnabled ? (user ? "Cloud Ready" : "Cloud Optional") : "Local Only"}
          </Badge>
        </>
      }
      nav={
        <div className="eg-tabs">
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.href}
              onMouseEnter={() => void item.preload()}
              onFocus={() => void item.preload()}
              className={({ isActive }) =>
                ["eg-tab", isActive || activeId === item.id ? "is-active" : ""].filter(Boolean).join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      }
      sidebar={
        <div className="eg-route-stack">
          <Card title="Run Summary">
            <div className="eg-stat-grid">
              <Stat label="Gold" value={formatNumber(save.snapshot.meta.gold)} />
              <Stat label="Gems" value={formatNumber(save.snapshot.meta.gems)} />
              <Stat label="Shards" value={formatNumber(save.snapshot.meta.artifactShards)} />
              <Stat label="DPS" value={formatNumber(battle.totalDps)} />
            </div>
            <Progress
              value={battle.enemyMaxHp - battle.enemyHp}
              max={battle.enemyMaxHp}
              label={`Enemy HP ${formatNumber(battle.enemyHp)} / ${formatNumber(battle.enemyMaxHp)}`}
              tone={battle.isBoss ? "gold" : "cyan"}
            />
            <div className="eg-toolbar">
              <Button variant="primary" onClick={actions.tapEnemy}>
                Tap
              </Button>
              <Button onClick={actions.prestige}>
                Prestige
              </Button>
            </div>
          </Card>

          <Card title="Event Feed" subtitle="最新 12 件">
            <PanelList>
              {events.map((event, index) => (
                <PanelRow key={`${event}-${index}`} primary={event} />
              ))}
            </PanelList>
          </Card>
        </div>
      }
    >
      <Suspense
        fallback={
          <Card title={`Loading ${navItems.find((item) => item.id === activeId)?.label ?? "Route"}`}>
            <p>次の画面を準備しています。</p>
          </Card>
        }
      >
        <Outlet />
      </Suspense>
    </Shell>
  );
}

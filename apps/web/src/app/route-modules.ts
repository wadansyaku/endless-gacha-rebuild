import { lazy } from "react";

const routeLoaders = {
  home: () => import("../routes/HomeRoute"),
  battle: () => import("../routes/BattleRoute"),
  summon: () => import("../routes/SummonRoute"),
  progression: () => import("../routes/ProgressionRoute"),
  collection: () => import("../routes/CollectionRoute"),
  social: () => import("../routes/SocialRoute"),
  settings: () => import("../routes/SettingsRoute")
} as const;

export const routePreloaders = routeLoaders;

export const HomeRoute = lazy(routeLoaders.home);
export const BattleRoute = lazy(routeLoaders.battle);
export const SummonRoute = lazy(routeLoaders.summon);
export const ProgressionRoute = lazy(routeLoaders.progression);
export const CollectionRoute = lazy(routeLoaders.collection);
export const SocialRoute = lazy(routeLoaders.social);
export const SettingsRoute = lazy(routeLoaders.settings);

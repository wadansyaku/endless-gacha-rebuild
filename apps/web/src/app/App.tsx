import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { GameProvider } from "../lib/game-store";
import { AppShell } from "./AppShell";
import {
  BattleRoute,
  CollectionRoute,
  HomeRoute,
  ProgressionRoute,
  SettingsRoute,
  SocialRoute,
  SummonRoute
} from "./route-modules";

export function App() {
  return (
    <GameProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomeRoute />} />
            <Route path="/battle" element={<BattleRoute />} />
            <Route path="/summon" element={<SummonRoute />} />
            <Route path="/progression" element={<ProgressionRoute />} />
            <Route path="/collection" element={<CollectionRoute />} />
            <Route path="/social" element={<SocialRoute />} />
            <Route path="/settings" element={<SettingsRoute />} />
            <Route path="*" element={<Navigate to="/battle" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </GameProvider>
  );
}

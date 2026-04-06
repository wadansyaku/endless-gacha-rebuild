import { useState } from "react";
import { Button, Card, PanelList, PanelRow } from "@endless-gacha/ui";
import { serializeSave } from "@endless-gacha/game-core";
import { useGameActions, useGameContent, useGameSave, useGameState } from "../lib/game-store";
import { formatTimestamp } from "../lib/format";

export default function SettingsRoute() {
  const save = useGameSave();
  const saveNotice = useGameState((state) => state.saveNotice);
  const cloudError = useGameState((state) => state.cloudError);
  const content = useGameContent();
  const actions = useGameActions();
  const [saveText, setSaveText] = useState("");
  const [isSaveEditorDirty, setIsSaveEditorDirty] = useState(false);
  const [stageInput, setStageInput] = useState("");
  const [goldGrant, setGoldGrant] = useState("10000");
  const [gemsGrant, setGemsGrant] = useState("3000");
  const [shardGrant, setShardGrant] = useState("100");
  const [prestigeGrant, setPrestigeGrant] = useState("25");
  const visibleSaveText = isSaveEditorDirty ? saveText : serializeSave(save);

  const copySave = async () => {
    await navigator.clipboard.writeText(serializeSave(save));
  };

  const applyGrant = () => {
    actions.grantPlaytestResources({
      gold: Number(goldGrant) || 0,
      gems: Number(gemsGrant) || 0,
      artifactShards: Number(shardGrant) || 0,
      prestigePoints: Number(prestigeGrant) || 0
    });
  };

  return (
    <div className="eg-route-stack">
      <Card title="Save Metadata">
        <PanelList>
          <PanelRow primary={`saveSchemaVersion ${save.saveSchemaVersion}`} />
          <PanelRow primary={`contentVersion ${save.contentVersion}`} />
          <PanelRow primary={`runtime contentVersion ${content.contentVersion}`} />
          <PanelRow primary={`lastProcessedAt ${formatTimestamp(save.lastProcessedAt)}`} />
        </PanelList>
        {saveNotice ? <p className="eg-error">Save Notice: {saveNotice}</p> : null}
        {save.contentVersion !== content.contentVersion ? (
          <p className="eg-muted">読込済み save の contentVersion と runtime catalog が一致していません。</p>
        ) : null}
        <div className="eg-toolbar">
          <Button onClick={() => void copySave()}>Copy Save JSON</Button>
          <Button onClick={actions.reloadLocalSave}>Reload Local Save</Button>
          <Button onClick={actions.resetRun}>Reset Run</Button>
          <Button onClick={actions.dismissTutorial}>Dismiss Tutorial Flag</Button>
          <Button onClick={actions.toggleAutoSellCommon}>Toggle Auto Sell</Button>
        </div>
      </Card>

      <Card title="Playtest Lab" subtitle="遊びながら検証するための短縮導線">
        <PanelList>
          <PanelRow
            primary="Preset"
            secondary="starter は初動確認用、midgame は systems 横断確認用"
            right={
              <div className="eg-inline-actions">
                <Button onClick={() => actions.applyPlaytestPreset("starter")}>Starter</Button>
                <Button variant="primary" onClick={() => actions.applyPlaytestPreset("midgame")}>
                  Midgame
                </Button>
              </div>
            }
          />
          <PanelRow
            primary="Fast Forward"
            secondary="offline progress / expedition / mission の確認用"
            right={
              <div className="eg-inline-actions">
                <Button onClick={() => actions.advancePlaytestTime(10 * 60_000)}>+10m</Button>
                <Button onClick={() => actions.advancePlaytestTime(60 * 60_000)}>+1h</Button>
                <Button onClick={() => actions.advancePlaytestTime(24 * 60 * 60_000)}>+24h</Button>
              </div>
            }
          />
          <PanelRow
            primary="Board Automation"
            secondary="Bench から空きマスへ自動配置、同条件なら merge"
            right={<Button onClick={actions.autoDeployBench}>Auto Deploy</Button>}
          />
        </PanelList>

        <div className="eg-form-grid">
          <label className="eg-field">
            <span>Stage</span>
            <input
              className="eg-input"
              value={stageInput}
              onChange={(event) => setStageInput(event.target.value)}
              placeholder={String(save.snapshot.run.stage)}
              inputMode="numeric"
            />
          </label>
          <Button onClick={() => actions.setPlaytestStage(Number(stageInput) || save.snapshot.run.stage)}>
            Jump Stage
          </Button>
        </div>

        <div className="eg-form-grid eg-form-grid-wide">
          <label className="eg-field">
            <span>Gold</span>
            <input className="eg-input" value={goldGrant} onChange={(event) => setGoldGrant(event.target.value)} inputMode="numeric" />
          </label>
          <label className="eg-field">
            <span>Gems</span>
            <input className="eg-input" value={gemsGrant} onChange={(event) => setGemsGrant(event.target.value)} inputMode="numeric" />
          </label>
          <label className="eg-field">
            <span>Shards</span>
            <input className="eg-input" value={shardGrant} onChange={(event) => setShardGrant(event.target.value)} inputMode="numeric" />
          </label>
          <label className="eg-field">
            <span>Prestige</span>
            <input className="eg-input" value={prestigeGrant} onChange={(event) => setPrestigeGrant(event.target.value)} inputMode="numeric" />
          </label>
        </div>
        <div className="eg-toolbar">
          <Button onClick={applyGrant}>Grant Resources</Button>
        </div>
      </Card>

      <Card title="Save Import" subtitle="ローカルの JSON を貼り付けて復元できます">
        <textarea
          className="eg-textarea"
          value={visibleSaveText}
          onChange={(event) => {
            setSaveText(event.target.value);
            setIsSaveEditorDirty(true);
          }}
          rows={10}
          spellCheck={false}
        />
        <div className="eg-toolbar">
          <Button
            variant="primary"
            onClick={() => {
              actions.importSaveText(visibleSaveText);
              setSaveText("");
              setIsSaveEditorDirty(false);
            }}
          >
            Import Save JSON
          </Button>
          <Button
            onClick={() => {
              setSaveText("");
              setIsSaveEditorDirty(false);
            }}
          >
            Load Current Save
          </Button>
        </div>
        {cloudError ? <p className="eg-error">{cloudError}</p> : null}
      </Card>

      <Card title="Operational Notes">
        <PanelList>
          <PanelRow primary="Daily reset" secondary="JST day key で管理" />
          <PanelRow primary="Offline progress" secondary="24h cap を core で強制" />
          <PanelRow primary="Simulation authority" secondary="UI から直接ダメージ計算しない" />
          <PanelRow primary="Cloud save" secondary="ログイン後も自動上書きしない" />
        </PanelList>
      </Card>
    </div>
  );
}

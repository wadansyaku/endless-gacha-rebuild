import { Badge, Button, Card, EmptyState, PanelList, PanelRow, SplitGrid } from "@endless-gacha/ui";
import { useGame } from "../lib/game-store";
import { formatTimestamp } from "../lib/format";

export default function SocialRoute() {
  const { cloudBusy, cloudEnabled, cloudError, conflict, leaderboard, user, actions } = useGame();

  return (
    <div className="eg-route-stack">
      <SplitGrid>
        <Card
          title="Cloud Save"
          subtitle="Google login + Firestore backup"
          actions={<Badge tone={cloudEnabled ? "good" : "warn"}>{cloudEnabled ? "Configured" : "Disabled"}</Badge>}
        >
          {!cloudEnabled ? (
            <EmptyState
              title="Cloud disabled"
              description=".env に Firebase client config を入れると有効になります。"
            />
          ) : (
            <>
              <p className="eg-muted">
                {user ? `Signed in as ${user.displayName ?? user.uid}` : "未ログイン。ローカルだけでも遊べます。"}
              </p>
              <div className="eg-toolbar">
                <Button onClick={() => void actions.signInWithGoogle()} disabled={cloudBusy}>
                  Google Sign In
                </Button>
                <Button onClick={() => void actions.uploadLocalSave()} disabled={!user || cloudBusy}>
                  Upload Local
                </Button>
                <Button onClick={() => void actions.downloadCloudSave()} disabled={!user || cloudBusy}>
                  Download Cloud
                </Button>
              </div>
              {cloudError ? <p className="eg-error">{cloudError}</p> : null}
            </>
          )}
        </Card>

        <Card title="Conflict Resolution">
          {conflict ? (
            <PanelList>
              <PanelRow
                primary={`Recommended: ${conflict.recommended}`}
                secondary={`Remote progressed until ${formatTimestamp(conflict.remote.lastProcessedAt)}`}
              />
              <PanelRow
                primary={`Stage ${conflict.remote.highestStage}`}
                secondary={`Cloud uploaded ${formatTimestamp(conflict.remote.updatedAt)}`}
                right={
                  <div className="eg-inline-actions">
                    <Button onClick={() => void actions.uploadLocalSave()}>Keep Local</Button>
                    <Button variant="primary" onClick={() => void actions.downloadCloudSave()}>
                      Use Remote
                    </Button>
                    <Button variant="ghost" onClick={actions.dismissConflict}>Later</Button>
                  </div>
                }
              />
            </PanelList>
          ) : (
            <EmptyState title="Conflict なし" description="ログイン後にローカルとクラウドの新しさを比較します。" />
          )}
        </Card>
      </SplitGrid>

      <Card
        title="Leaderboard"
        subtitle="best-effort client-trust"
        actions={<Button onClick={() => void actions.refreshLeaderboard()} disabled={!cloudEnabled || cloudBusy}>Refresh</Button>}
      >
        {leaderboard.length > 0 ? (
          <PanelList>
            {leaderboard.map((entry, index) => (
              <PanelRow
                key={entry.uid}
                primary={`#${index + 1} ${entry.displayName}`}
                secondary={`Stage ${entry.highestStage}`}
                right={formatTimestamp(entry.updatedAt)}
              />
            ))}
          </PanelList>
        ) : (
          <EmptyState title="ランキング未取得" description="Firebase が設定されていればここに表示されます。" />
        )}
      </Card>
    </div>
  );
}

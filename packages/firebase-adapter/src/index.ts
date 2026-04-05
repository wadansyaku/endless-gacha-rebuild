import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions
} from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
  type User
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  setDoc,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import type { VersionedSaveEnvelope } from "@endless-gacha/game-core";
import { SAVE_SCHEMA_VERSION } from "@endless-gacha/shared";
import { z } from "zod";

type SnapshotLike = VersionedSaveEnvelope["snapshot"];

export type FirebaseSaveDocument<TSnapshot = SnapshotLike> = Omit<VersionedSaveEnvelope, "snapshot"> & {
  snapshot: TSnapshot;
  highestStage: number;
  displayName: string;
  updatedAt: number;
};

export type FirebaseLeaderboardEntry = {
  uid: string;
  displayName: string;
  highestStage: number;
  updatedAt: number;
};

export type FirebaseUserSummary = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
};

export type FirebaseAdapterConfig = {
  firebaseOptions: FirebaseOptions;
  saveCollection?: string;
};

export type SaveGameInput<TSnapshot = SnapshotLike> = {
  uid: string;
  displayName: string;
  highestStage: number;
  save: Omit<VersionedSaveEnvelope, "snapshot"> & {
    snapshot: TSnapshot;
  };
};

export type FirebaseAdapter = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  saveGame: <TSnapshot = SnapshotLike>(
    input: SaveGameInput<TSnapshot>
  ) => Promise<FirebaseSaveDocument<TSnapshot>>;
  loadGame: <TSnapshot = SnapshotLike>(
    uid: string
  ) => Promise<FirebaseSaveDocument<TSnapshot> | null>;
  listLeaderboard: (limitCount?: number) => Promise<FirebaseLeaderboardEntry[]>;
  signInWithGoogle: () => Promise<FirebaseUserSummary>;
  signOut: () => Promise<void>;
};

export const VersionedSaveEnvelopeSchema = z.object({
  saveSchemaVersion: z.number().int().min(1).max(SAVE_SCHEMA_VERSION),
  contentVersion: z.string().min(1),
  lastProcessedAt: z.number().int().nonnegative(),
  snapshot: z.record(z.string(), z.unknown())
});

export const FirebaseSaveDocumentSchema = VersionedSaveEnvelopeSchema.extend({
  highestStage: z.number().int().min(1),
  displayName: z.string().min(1).max(80),
  updatedAt: z.number().int().nonnegative()
});

export const FirebaseLeaderboardEntrySchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().min(1).max(80),
  highestStage: z.number().int().min(1),
  updatedAt: z.number().int().nonnegative()
});

export const FirebaseUserSummarySchema = z.object({
  uid: z.string().min(1),
  displayName: z.string().nullable(),
  email: z.string().nullable(),
  photoURL: z.string().nullable()
});

const normalizeDisplayName = (value: string): string => value.trim().slice(0, 80) || "Player";

const normalizeLimit = (value: number | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 10;
  }

  return Math.max(1, Math.min(100, Math.floor(value)));
};

const toEpochMs = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    const maybeTimestamp = value as { toDate: () => Date };
    return maybeTimestamp.toDate().getTime();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  throw new Error("Unsupported timestamp value");
};

const createFirebaseServices = (config: FirebaseAdapterConfig) => {
  const app = getApps().length > 0 ? getApp() : initializeApp(config.firebaseOptions);
  return {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    saveCollection: config.saveCollection ?? "saves"
  };
};

const readUserSummary = (user: User): FirebaseUserSummary =>
  FirebaseUserSummarySchema.parse({
    uid: user.uid,
    displayName: user.displayName ?? null,
    email: user.email ?? null,
    photoURL: user.photoURL ?? null
  });

const readSaveDocument = <TSnapshot>(
  raw: DocumentData
): FirebaseSaveDocument<TSnapshot> => {
  const parsed = FirebaseSaveDocumentSchema.parse({
    saveSchemaVersion: raw.saveSchemaVersion,
    contentVersion: raw.contentVersion,
    lastProcessedAt: toEpochMs(raw.lastProcessedAt),
    snapshot: raw.snapshot,
    highestStage: raw.highestStage,
    displayName: raw.displayName,
    updatedAt: toEpochMs(raw.updatedAt)
  });

  return {
    ...parsed,
    displayName: normalizeDisplayName(parsed.displayName),
    snapshot: parsed.snapshot as TSnapshot
  };
};

const readLeaderboardEntry = (
  uid: string,
  raw: DocumentData
): FirebaseLeaderboardEntry | null => {
  try {
    return FirebaseLeaderboardEntrySchema.parse({
      uid,
      displayName: normalizeDisplayName(String(raw.displayName ?? "")),
      highestStage: raw.highestStage,
      updatedAt: toEpochMs(raw.updatedAt)
    });
  } catch {
    return null;
  }
};

export const createFirebaseAdapter = (config: FirebaseAdapterConfig): FirebaseAdapter => {
  const services = createFirebaseServices(config);

  const saveGame = async <TSnapshot = SnapshotLike>(
    input: SaveGameInput<TSnapshot>
  ): Promise<FirebaseSaveDocument<TSnapshot>> => {
    const payload = FirebaseSaveDocumentSchema.parse({
      saveSchemaVersion: input.save.saveSchemaVersion,
      contentVersion: input.save.contentVersion,
      lastProcessedAt: input.save.lastProcessedAt,
      snapshot: input.save.snapshot,
      highestStage: input.highestStage,
      displayName: normalizeDisplayName(input.displayName),
      updatedAt: Date.now()
    });

    await setDoc(doc(services.db, services.saveCollection, input.uid), payload, {
      merge: false
    });

    const saved = await getDoc(doc(services.db, services.saveCollection, input.uid));
    if (!saved.exists()) {
      return {
        ...payload,
        snapshot: payload.snapshot as TSnapshot
      };
    }

    return readSaveDocument<TSnapshot>(saved.data());
  };

  const loadGame = async <TSnapshot = SnapshotLike>(
    uid: string
  ): Promise<FirebaseSaveDocument<TSnapshot> | null> => {
    const snapshot = await getDoc(doc(services.db, services.saveCollection, uid));
    if (!snapshot.exists()) {
      return null;
    }

    return readSaveDocument<TSnapshot>(snapshot.data());
  };

  const listLeaderboard = async (limitCount = 10): Promise<FirebaseLeaderboardEntry[]> => {
    const leaderboardQuery = query(
      collection(services.db, services.saveCollection),
      orderBy("highestStage", "desc"),
      limit(normalizeLimit(limitCount))
    );

    const snapshot = await getDocs(leaderboardQuery);
    return snapshot.docs
      .map((document: QueryDocumentSnapshot<DocumentData>) =>
        readLeaderboardEntry(document.id, document.data())
      )
      .filter((entry): entry is FirebaseLeaderboardEntry => entry !== null);
  };

  const signInWithGoogle = async (): Promise<FirebaseUserSummary> => {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(services.auth, provider);
    return readUserSummary(credential.user);
  };

  const signOut = async (): Promise<void> => {
    await firebaseSignOut(services.auth);
  };

  return {
    app: services.app,
    auth: services.auth,
    db: services.db,
    saveGame,
    loadGame,
    listLeaderboard,
    signInWithGoogle,
    signOut
  };
};

export const parseFirebaseSaveDocument = <TSnapshot = SnapshotLike>(
  raw: DocumentData
): FirebaseSaveDocument<TSnapshot> => readSaveDocument<TSnapshot>(raw);

export const parseFirebaseLeaderboardEntry = (
  uid: string,
  raw: DocumentData
): FirebaseLeaderboardEntry | null => readLeaderboardEntry(uid, raw);

export const firebaseAdapterVersion = SAVE_SCHEMA_VERSION;

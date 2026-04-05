import type { FirebaseAdapter } from "@endless-gacha/firebase-adapter";

const requiredKeys = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
] as const;

let adapterPromise: Promise<FirebaseAdapter | null> | null = null;

export const hasFirebaseConfig = (): boolean =>
  requiredKeys.every((key) => {
    const value = import.meta.env[key];
    return typeof value === "string" && value.length > 0;
  });

export const loadFirebaseAdapter = async (): Promise<FirebaseAdapter | null> => {
  if (!hasFirebaseConfig()) {
    return null;
  }

  if (adapterPromise) {
    return adapterPromise;
  }

  adapterPromise = import("@endless-gacha/firebase-adapter").then(({ createFirebaseAdapter }) =>
    createFirebaseAdapter({
      firebaseOptions: {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY!,
        authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN!,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID!,
        storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET!,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID!,
        appId: import.meta.env.VITE_FIREBASE_APP_ID!,
        ...(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
          ? {
              measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
            }
          : {})
      }
    })
  );

  return adapterPromise;
};

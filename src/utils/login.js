import { getAuth, OAuthProvider } from "firebase/auth";
import { initializeApp } from "firebase/app";
import api from "../api/index.js";
import consola from "consola";

const FIREBASE_REQUIRED_FIELDS = [
  "__FIREBASE_API_KEY__",
  "__FIREBASE_AUTH_DOMAIN__",
  "__FIREBASE_PROJECT_ID__",
  "__FIREBASE_STORAGE_BUCKET__",
  "__FIREBASE_MESSAGING_SENDER_ID__",
  "__FIREBASE_APP_ID__",
];

const validateFirebaseConfig = (config) => {
  const missingFields = FIREBASE_REQUIRED_FIELDS.filter(
    (field) => !config[field],
  );
  if (missingFields.length > 0) {
    throw new Error(
      `Missing Firebase config fields: ${missingFields.join(", ")}`,
    );
  }
};

/* initialize firebase */
const initializeFirebase = (config) => {
  try {
    validateFirebaseConfig(config);
    const firebaseConfig = {
      apiKey: config.__FIREBASE_API_KEY__,
      authDomain: config.__FIREBASE_AUTH_DOMAIN__,
      projectId: config.__FIREBASE_PROJECT_ID__,
      storageBucket: config.__FIREBASE_STORAGE_BUCKET__,
      messagingSenderId: config.__FIREBASE_MESSAGING_SENDER_ID__,
      appId: config.__FIREBASE_APP_ID__,
      measurementId: config.__FIREBASE_MEASUREMENT_ID__,
    };
    if (firebaseConfig.authDomain === "LOCAL") {
      firebaseConfig.authDomain = window.location.host;
    }
    const firebaseApp = initializeApp(firebaseConfig);
    const auth = getAuth(firebaseApp);
    return { firebaseApp, auth };
  } catch {
    // consola.error("ERROR: Initialize Firebase");
    return { firebaseApp: null, auth: null };
  }
};

// JWT header parsing utility
const parseJwtHeader = (token) => {
  const [header] = token.split(".");
  if (!header) return null;
  try {
    return JSON.parse(atob(header.replace(/-/g, "+").replace(/_/g, "/")));
  } catch (e) {
    consola.error("JWT parsing error:", e);
    return null;
  }
};

const _handleFirebaseResult = async (result) => {
  if (!result) {
    consola.error("ERROR: Firebase Result", "No result");
    throw new Error("_handleFirebaseResult No result");
  }
  if (result.providerId === "google.com") {
    const user = result.user;
    const idToken = await user.getIdToken();
    const header = parseJwtHeader(idToken);
    const kid = header?.kid;

    return {
      token: idToken,
      kid,
      email: user.email,
      name: user.displayName,
    };
  }
  if (result.providerId === "apple.com") {
    const user = result.user;
    const credential = OAuthProvider.credentialFromResult(result);
    const idToken = credential?.idToken;
    const header = parseJwtHeader(idToken);
    const kid = header?.kid;

    return {
      token: idToken,
      kid,
      email: user.email,
      name: user.displayName,
    };
  }
  consola.error("ERROR: Firebase Result", "Unknown provider");
  throw new Error("_handleFirebaseResult Unknown provider");
};

const handleFirebaseResultEffect = async (result, successCallback) => {
  try {
    const { token, kid, email, name } = await _handleFirebaseResult(result);
    if (result.providerId === "google.com") {
      const data = await api.googleVerify({
        token,
        kid,
        email,
        name,
      });
      successCallback(data);
      return data;
    }
    if (result.providerId === "apple.com") {
      const data = await api.appleVerify({
        token,
        kid,
        email,
        name,
      });
      successCallback(data);
      return data;
    }
    consola.error("ERROR: handleFirebaseResultEffect", "Unknown provider");
    throw new Error("handleFirebaseResultEffect Unknown provider");
  } catch (error) {
    consola.error("ERROR: handleFirebaseResultEffect", error);
    throw error;
  }
};

export { initializeFirebase, parseJwtHeader, handleFirebaseResultEffect };

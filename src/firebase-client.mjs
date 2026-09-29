import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  connectAuthEmulator,
} from "firebase/auth";
import { credentials } from "../server/schema.mjs";
import { z } from "zod";
const loginCredentials = credentials.extend({
  password: z.string().min(1).max(128),
});
let setup;
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export async function client() {
  if (!setup)
    setup = (async () => {
      const response = await fetch("/api/config");
      if (!response.ok)
        fail(503, "Pilotens inloggning är inte aktiverad ännu.");
      const config = await response.json();
      const auth = getAuth(initializeApp(config.firebase));
      auth.languageCode = "sv";
      // Emulator connection is compiled out of real pilot builds.
      if (import.meta.env.MODE === "pilot-test")
        connectAuthEmulator(auth, "http://127.0.0.1:9099", {
          disableWarnings: true,
        });
      await auth.authStateReady();
      return { auth, config };
    })().catch((error) => {
      setup = null;
      throw error;
    });
  return setup;
}
function authError(error) {
  const messages = {
    "auth/invalid-credential": "Fel e-post eller lösenord.",
    "auth/user-not-found": "Fel e-post eller lösenord.",
    "auth/wrong-password": "Fel e-post eller lösenord.",
    "auth/email-already-in-use":
      "Kontot kunde inte skapas. Prova att logga in.",
    "auth/weak-password": "Välj ett starkare lösenord med minst 12 tecken.",
    "auth/invalid-email": "Kontrollera e-postadressen.",
    "auth/too-many-requests": "För många försök. Försök igen om en stund.",
    "auth/network-request-failed":
      "Kunde inte ansluta. Kontrollera din internetanslutning.",
    "auth/operation-not-allowed":
      "Den här inloggningsmetoden är inte aktiverad ännu.",
    "auth/popup-closed-by-user": "Inloggningen avbröts.",
    "auth/unauthorized-domain":
      "Den här webbadressen är inte godkänd för inloggning ännu.",
    "auth/user-disabled": "Kontot är avstängt.",
  };
  return Object.assign(
    new Error(
      messages[error.code] || error.message || "Inloggningen misslyckades.",
    ),
    { status: error.status || 400 },
  );
}
export async function response(path, options = {}, team = "") {
  const { auth } = await client();
  if (!auth.currentUser) fail(401, "Logga in för att fortsätta.");
  const token = await auth.currentUser.getIdToken();
  return fetch("/api" + path, {
    method: options.method || "GET",
    signal: options.signal,
    headers: {
      ...(options.body && !options.raw
        ? { "Content-Type": "application/json" }
        : {}),
      ...(team ? { "X-Team-Id": team } : {}),
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
    body:
      options.body && !options.raw
        ? JSON.stringify(options.body)
        : options.body,
  });
}
export async function request(path, options = {}, team = "") {
  try {
    const { auth, config } = await client();
    if (["/register", "/login"].includes(path)) {
      const p = (
        path === "/register" ? credentials : loginCredentials
      ).safeParse(options.body);
      if (!p.success || (path === "/register" && !p.data.name))
        fail(
          400,
          path === "/register"
            ? "Ange e-post och ett lösenord med minst 12 tecken."
            : "Ange e-post och lösenord.",
        );
      if (path === "/register") {
        const { user } = await createUserWithEmailAndPassword(
          auth,
          p.data.email,
          p.data.password,
        );
        await updateProfile(user, { displayName: p.data.name });
        await user.getIdToken(true);
      } else
        await signInWithEmailAndPassword(auth, p.data.email, p.data.password);
      return request("/me");
    }
    if (path === "/login/google") {
      if (!config.googleLogin)
        fail(400, "Google-inloggning är inte aktiverad.");
      await signInWithPopup(auth, new GoogleAuthProvider());
      return request("/me");
    }
    if (path === "/reset-password") {
      if (!options.body?.email) fail(400, "Ange din e-postadress först.");
      await sendPasswordResetEmail(auth, options.body.email);
      return { ok: true };
    }
    if (path === "/logout") {
      await signOut(auth);
      return { ok: true };
    }
    const res = await response(path, options, team);
    let data;
    try {
      data = await res.json();
    } catch {
      fail(res.status || 502, "Tjänsten svarade inte som väntat. Försök igen.");
    }
    if (!res.ok) fail(res.status, data.error || "Anropet misslyckades.");
    return data;
  } catch (error) {
    throw authError(error);
  }
}
export function subscribe(team, onReady, onChange, onError) {
  let stopped = false,
    socket,
    retry,
    renew,
    heartbeat,
    attempt = 0;
  async function connect() {
    try {
      const { ticket } = await request(
        "/socket-ticket",
        { method: "POST", body: { teamId: team } },
        team,
      );
      if (stopped) return;
      const url = new URL("/api/events", location.origin);
      url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("team", team);
      socket = new WebSocket(url, ["samplanering", "ticket." + ticket]);
      socket.onmessage = (event) => {
        if (event.data === "pong") return;
        const data = JSON.parse(event.data);
        if (data.type === "ready") {
          attempt = 0;
          onReady();
        }
        if (data.type === "change") onChange();
      };
      socket.onopen = () => {
        heartbeat = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send("ping");
        }, 25000);
        renew = setTimeout(() => socket.close(), 45 * 60000);
      };
      socket.onclose = () => {
        clearInterval(heartbeat);
        clearTimeout(renew);
        if (!stopped) {
          onError();
          retry = setTimeout(
            connect,
            Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)),
          );
        }
      };
      socket.onerror = () => onError();
    } catch {
      if (!stopped) {
        onError();
        retry = setTimeout(
          connect,
          Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)),
        );
      }
    }
  }
  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearTimeout(renew);
    clearInterval(heartbeat);
    socket?.close();
  };
}

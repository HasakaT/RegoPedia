import { firebaseConfig } from "./config.js";

export const isFirebaseConfigured = !String(firebaseConfig.apiKey).startsWith("ISI_");

let fb = null; // { auth, mod }
let listeners = [];
let currentUser = null;

const DEMO_USERS_KEY = "hp_demo_users";
const DEMO_SESSION_KEY = "hp_demo_session";

function emit(user) {
  currentUser = user;
  listeners.forEach((fn) => fn(user));
}

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function friendlyError(err) {
  const code = err?.code || err?.message || "";
  const map = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/missing-password": "Kata sandi wajib diisi.",
    "auth/weak-password": "Kata sandi terlalu lemah (minimal 6 karakter).",
    "auth/email-already-in-use": "Email sudah terdaftar. Silakan masuk.",
    "auth/invalid-credential": "Email atau kata sandi salah.",
    "auth/user-not-found": "Akun tidak ditemukan.",
    "auth/wrong-password": "Email atau kata sandi salah.",
    "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa saat.",
    "auth/network-request-failed": "Gagal terhubung ke jaringan.",
  };
  return map[code] || (err?.message?.startsWith("DEMO:") ? err.message.slice(5) : "Terjadi kesalahan. Coba lagi.");
}

export async function initAuth(onChange) {
  listeners.push(onChange);
  if (isFirebaseConfigured) {
    const base = "https://www.gstatic.com/firebasejs/10.12.2";
    const appMod = await import(`${base}/firebase-app.js`);
    const authMod = await import(`${base}/firebase-auth.js`);
    const app = appMod.initializeApp(firebaseConfig);
    const auth = authMod.getAuth(app);
    fb = { auth, mod: authMod };
    authMod.onAuthStateChanged(auth, (u) => emit(u ? { email: u.email, uid: u.uid } : null));
  } else {
    emit(readJSON(DEMO_SESSION_KEY, null));
  }
}

export async function login(email, password) {
  if (fb) return fb.mod.signInWithEmailAndPassword(fb.auth, email, password);
  const users = readJSON(DEMO_USERS_KEY, {});
  if (!users[email] || users[email] !== password) throw new Error("DEMO:Email atau kata sandi salah.");
  const user = { email, uid: "demo-" + email };
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  emit(user);
}

export async function register(email, password) {
  if (fb) return fb.mod.createUserWithEmailAndPassword(fb.auth, email, password);
  if (password.length < 6) throw { code: "auth/weak-password" };
  const users = readJSON(DEMO_USERS_KEY, {});
  if (users[email]) throw { code: "auth/email-already-in-use" };
  users[email] = password;
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
  const user = { email, uid: "demo-" + email };
  localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  emit(user);
}

export async function resetPassword(email) {
  if (fb) return fb.mod.sendPasswordResetEmail(fb.auth, email);
  throw new Error("DEMO:Reset kata sandi hanya tersedia setelah Firebase tersambung.");
}

export async function logout() {
  if (fb) return fb.mod.signOut(fb.auth);
  localStorage.removeItem(DEMO_SESSION_KEY);
  emit(null);
}

// Token ID Firebase — dikirim ke backend lewat header Authorization
export async function getToken() {
  if (fb && fb.auth.currentUser) return fb.auth.currentUser.getIdToken();
  return null;
}

export function getUser() { return currentUser; }

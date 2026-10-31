// ============================================================
// KONFIGURASI — isi bagian ini saat sudah siap menyambungkan
// ============================================================

// 1) Firebase (Firebase Console > Project settings > Your apps > Web app)
//    Selama apiKey masih "ISI_...", website berjalan dalam MODE DEMO
//    (login disimpan di localStorage browser, bukan Firebase).
export const firebaseConfig = {
  apiKey: "ISI_API_KEY",
  authDomain: "ISI_PROJECT_ID.firebaseapp.com",
  projectId: "ISI_PROJECT_ID",
  appId: "ISI_APP_ID",
};

// 2) URL backend kamu (tanpa garis miring di akhir), contoh:
//    "https://api.domainkamu.com"
//    Selama kosong, website memakai DATA CONTOH (mock) agar tampilan bisa dicoba.
export const API_BASE_URL = "";

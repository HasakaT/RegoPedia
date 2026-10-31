import { initAuth, login, register, resetPassword, logout, getUser, friendlyError, isFirebaseConfigured } from "./auth.js";
import { fetchCommodities, fetchPrediction } from "./api.js";

const $ = (sel) => document.querySelector(sel);
const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const fmtDate = (iso, opts = { day: "numeric", month: "short" }) =>
  new Date(iso + "T00:00:00").toLocaleDateString("id-ID", opts);

function esc(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}

function pctChip(pct) {
  const cls = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
  const arrow = pct > 0.05 ? "▲" : pct < -0.05 ? "▼" : "•";
  return `<span class="chip ${cls}">${arrow} ${Math.abs(pct).toFixed(2)}%</span>`;
}

/* ====================== LOGIN ====================== */
let mode = "login"; // "login" | "register"

function setMode(m) {
  mode = m;
  const isLogin = m === "login";
  $("#auth-submit").textContent = isLogin ? "Masuk" : "Daftar";
  $("#toggle-mode").textContent = isLogin ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk";
  $("#login-subtitle").textContent = isLogin
    ? "Masuk untuk melihat prediksi harga bahan pokok"
    : "Buat akun baru dengan email";
  $("#password").autocomplete = isLogin ? "current-password" : "new-password";
  showMsg("");
}

function showMsg(text, ok = false) {
  const el = $("#auth-msg");
  el.hidden = !text;
  el.textContent = text;
  el.classList.toggle("ok", ok);
}

$("#auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  if (!email || !password) return showMsg("Email dan kata sandi wajib diisi.");
  const btn = $("#auth-submit");
  btn.disabled = true;
  showMsg("");
  try {
    await (mode === "login" ? login(email, password) : register(email, password));
  } catch (err) {
    showMsg(friendlyError(err));
  } finally {
    btn.disabled = false;
  }
});

$("#toggle-mode").addEventListener("click", () => setMode(mode === "login" ? "register" : "login"));

$("#forgot").addEventListener("click", async () => {
  const email = $("#email").value.trim();
  if (!email) return showMsg("Isi email dulu, lalu klik “Lupa kata sandi?”.");
  try {
    await resetPassword(email);
    showMsg("Tautan reset kata sandi sudah dikirim ke email kamu.", true);
  } catch (err) {
    showMsg(friendlyError(err));
  }
});

$("#logout-btn").addEventListener("click", () => logout());

/* ====================== LAYOUT ====================== */
let commoditiesCache = null;
let chart = null;

function closeMenu() { $("#app-view").classList.remove("menu-open"); }
$("#menu-btn").addEventListener("click", () => $("#app-view").classList.toggle("menu-open"));
$("#backdrop").addEventListener("click", closeMenu);

function renderSidebar(activeId) {
  const items = commoditiesCache || [];
  $("#sidebar-nav").innerHTML = `
    <a class="nav-link ${!activeId ? "active" : ""}" href="#/beranda"><span class="nav-ico">🏠</span> Beranda</a>
    <div class="nav-title">Bahan Pokok</div>
    ${items.map((c) => `
      <a class="nav-link ${activeId === c.id ? "active" : ""}" href="#/komoditas/${encodeURIComponent(c.id)}">
        <span class="nav-ico">${esc(c.icon || "•")}</span> ${esc(c.name)}
      </a>`).join("")}
  `;
}

function setBreadcrumb(parts) {
  $("#breadcrumb").innerHTML = parts
    .map((p, i) => (p.href ? `<a href="${p.href}">${esc(p.label)}</a>` : `<span>${esc(p.label)}</span>`) + (i < parts.length - 1 ? `<span class="sep">/</span>` : ""))
    .join("");
}

function stateBox(html) { return `<div class="card"><div class="state">${html}</div></div>`; }

async function loadCommodities() {
  if (!commoditiesCache) commoditiesCache = await fetchCommodities();
  return commoditiesCache;
}

/* ====================== BERANDA ====================== */
async function renderHome() {
  setBreadcrumb([{ label: "Beranda" }]);
  renderSidebar(null);
  const content = $("#content");
  content.innerHTML = `
    <h2 class="page-title">Pilih Bahan Pokok</h2>
    <p class="page-sub">Klik salah satu untuk melihat prediksi harga besok dan grafik harga sebelumnya.</p>
    <div class="grid grid-commodities">${'<div class="skeleton"></div>'.repeat(8)}</div>`;
  try {
    const items = await loadCommodities();
    renderSidebar(null);
    content.querySelector(".grid").innerHTML = items.map((c) => `
      <a class="card commodity-card" href="#/komoditas/${encodeURIComponent(c.id)}">
        <div class="ico">${esc(c.icon || "🛒")}</div>
        <div class="name">${esc(c.name)}</div>
        <div class="price">${rupiah.format(c.currentPrice)} <span class="unit">/ ${esc(c.unit)}</span></div>
        ${pctChip(c.changePct)}
      </a>`).join("");
  } catch (err) {
    commoditiesCache = null;
    content.innerHTML = stateBox(`Gagal memuat daftar bahan pokok.<br><small>${esc(err.message)}</small><br><br><button class="btn btn-primary" id="retry">Coba lagi</button>`);
    $("#retry").addEventListener("click", renderHome);
  }
}

/* ====================== DETAIL ====================== */
async function renderDetail(id) {
  const content = $("#content");
  setBreadcrumb([{ label: "Beranda", href: "#/beranda" }, { label: "Memuat…" }]);
  content.innerHTML = stateBox(`<div class="spinner"></div>Memuat prediksi…`);
  loadCommodities().then(() => renderSidebar(id)).catch(() => {});
  renderSidebar(id);

  let data;
  try {
    data = await fetchPrediction(id);
  } catch (err) {
    setBreadcrumb([{ label: "Beranda", href: "#/beranda" }, { label: "Error" }]);
    content.innerHTML = stateBox(`Gagal memuat prediksi.<br><small>${esc(err.message)}</small><br><br><button class="btn btn-primary" id="retry">Coba lagi</button>`);
    $("#retry").addEventListener("click", () => renderDetail(id));
    return;
  }

  const diff = data.predictedPrice - data.currentPrice;
  const trendClass = diff > 0 ? "s-danger" : diff < 0 ? "s-success" : "";
  const history = data.history || [];
  const avg = history.length ? history.reduce((a, b) => a + b.price, 0) / history.length : data.currentPrice;
  const conf = typeof data.confidence === "number" ? `${Math.round(data.confidence * 100)}%` : "—";

  setBreadcrumb([{ label: "Beranda", href: "#/beranda" }, { label: data.name }]);
  content.innerHTML = `
    <h2 class="page-title">${esc(data.icon || "")} ${esc(data.name)}</h2>
    <p class="page-sub">Harga per ${esc(data.unit)}</p>

    <div class="grid grid-stats">
      <div class="card stat">
        <div class="label">Harga terakhir</div>
        <div class="value">${rupiah.format(data.currentPrice)}</div>
        <div class="hint">Rata-rata periode: ${rupiah.format(avg)}</div>
      </div>
      <div class="card stat ${trendClass}">
        <div class="label">Prediksi ${fmtDate(data.predictionDate, { weekday: "long", day: "numeric", month: "short" })}</div>
        <div class="value">${rupiah.format(data.predictedPrice)}</div>
        <div class="hint">${diff >= 0 ? "+" : "−"}${rupiah.format(Math.abs(diff))}</div>
      </div>
      <div class="card stat ${trendClass}">
        <div class="label">Perubahan</div>
        <div class="value">${data.changePct > 0 ? "+" : ""}${Number(data.changePct).toFixed(2)}%</div>
        <div class="hint">${diff > 0 ? "Diperkirakan naik" : diff < 0 ? "Diperkirakan turun" : "Diperkirakan stabil"}</div>
      </div>
      <div class="card stat s-warning">
        <div class="label">Tingkat keyakinan</div>
        <div class="value">${conf}</div>
        <div class="hint">Dari model prediksi</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span>Grafik harga</span>
        <div class="seg" id="range">
          <button data-days="7">7 hari</button>
          <button data-days="14">14 hari</button>
          <button data-days="30" class="active">30 hari</button>
        </div>
      </div>
      <div class="card-body"><div class="chart-box"><canvas id="price-chart"></canvas></div></div>
    </div>`;

  const draw = (days) => drawChart(data, days);
  draw(30);
  $("#range").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    $("#range").querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    draw(Number(btn.dataset.days));
  });
}

function drawChart(data, days) {
  if (chart) chart.destroy();
  const hist = (data.history || []).slice(-days);
  const labels = [...hist.map((h) => fmtDate(h.date)), fmtDate(data.predictionDate) + " (prediksi)"];
  const actual = [...hist.map((h) => h.price), null];
  const predicted = hist.map(() => null);
  if (hist.length) predicted[hist.length - 1] = hist[hist.length - 1].price;
  predicted.push(data.predictedPrice);

  chart = new Chart($("#price-chart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Harga aktual", data: actual, borderColor: "#321fdb", backgroundColor: "rgba(50,31,219,.1)",
          fill: true, tension: 0.3, pointRadius: 2, borderWidth: 2,
        },
        {
          label: "Prediksi besok", data: predicted, borderColor: "#f9b115", borderDash: [6, 6],
          pointBackgroundColor: "#f9b115", pointRadius: (c) => (c.dataIndex === labels.length - 1 ? 6 : 0),
          borderWidth: 2, tension: 0, spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom" },
        tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${rupiah.format(c.parsed.y)}` } },
      },
      scales: {
        y: { ticks: { callback: (v) => rupiah.format(v) } },
        x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
      },
    },
  });
}

/* ====================== ROUTER ====================== */
function route() {
  if (!getUser()) return;
  closeMenu();
  const hash = location.hash || "#/beranda";
  const m = hash.match(/^#\/komoditas\/(.+)$/);
  if (m) renderDetail(decodeURIComponent(m[1]));
  else renderHome();
}
window.addEventListener("hashchange", route);

/* ====================== START ====================== */
function onAuthChange(user) {
  $("#login-view").hidden = !!user;
  $("#app-view").hidden = !user;
  if (user) {
    $("#user-email").textContent = user.email;
    if (!location.hash || location.hash === "#/login") location.hash = "#/beranda";
    route();
  } else {
    commoditiesCache = null;
    if (chart) { chart.destroy(); chart = null; }
    location.hash = "#/login";
    $("#password").value = "";
    setMode("login");
  }
}

$("#demo-note").hidden = isFirebaseConfigured;
initAuth(onAuthChange).catch((err) => {
  $("#login-view").hidden = false;
  showMsg("Gagal memuat Firebase: " + err.message);
});

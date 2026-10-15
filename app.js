import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDXXfpIbSRfteesCLrRp8u3tfI6656cENg",
  authDomain: "smart-trash-a7e40.firebaseapp.com",
  databaseURL: "https://smart-trash-a7e40-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-trash-a7e40",
  storageBucket: "smart-trash-a7e40.firebasestorage.app",
  messagingSenderId: "1032456151572",
  appId: "1:1032456151572:web:1ab22c8164d16c7b797d01",
  measurementId: "G-G8P3E16377"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const welcomePage = document.getElementById("welcome-page");
const dashboard = document.getElementById("dashboard");
const grid = document.getElementById("device-grid");
const connectionStatus = document.getElementById("connection-status");
const connectionLabel = document.getElementById("connection-label");
const searchInput = document.getElementById("device-search");
const filterSelect = document.getElementById("device-filter");
const dataNote = document.getElementById("data-note");
const expectedDevices = {
  "bin-01": "Tong Depan",
  "bin-02": "Tong Kantin",
  "bin-03": "Tong Belakang",
  "bin-04": "Tong Kelas"
};

let devices = [];
let hasReceivedData = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatTime(unixTs) {
  const timestamp = Number(unixTs);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "-";
  return new Date(timestamp * 1000).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Jakarta"
  });
}

function getLevel(percentage) {
  if (percentage < 40) return { label: "KOSONG", badge: "badge-kosong", color: "#22c55e" };
  if (percentage < 80) return { label: "SEDANG", badge: "badge-sedang", color: "#eab308" };
  return { label: "PENUH", badge: "badge-penuh", color: "#ef4444" };
}

function renderDevice(id, info = {}, status = {}, isOnline = false) {
  const numericLevel = Number(status.isi_persen);
  const percentage = Number.isFinite(numericLevel) ? Math.max(0, Math.min(100, numericLevel)) : 0;
  const level = getLevel(percentage);
  const badge = isOnline ? level : { label: "OFFLINE", badge: "badge-offline", color: "#6b7280" };
  const name = escapeHtml(info.name || id);
  const location = escapeHtml(info.location || "Lokasi belum diatur");
  const deviceId = escapeHtml(info.device_id || id);
  const handDistance = Number(status.jarak_tangan_cm);
  const lidAngle = Number(status.lid_angle);
  const safeDistance = Number.isFinite(handDistance) ? `${Math.round(handDistance)} cm` : "-";
  const safeAngle = Number.isFinite(lidAngle) ? `${Math.round(lidAngle)}°` : "-";
  const updateTime = isOnline ? formatTime(status.last_update) : "-";
  const opacityClass = isOnline ? "" : " is-offline";
  const warning = isOnline && percentage >= 80 ? '<span class="level-alert">Perlu segera dikosongkan</span>' : "";

  return `
    <article class="card${opacityClass}" data-id="${escapeHtml(id)}" data-name="${name}" data-online="${isOnline}" data-full="${percentage >= 80}">
      <div class="card-top">
        <div>
          <h3>${name}</h3>
          <p class="device-location">📍 ${location} <span class="device-id">• ${deviceId}</span></p>
        </div>
        <span class="status-badge ${badge.badge}">${badge.label}</span>
      </div>
      <div class="metric-line"><strong class="metric">${Math.round(percentage)}%</strong><span class="metric-unit">kapasitas terisi</span></div>
      <div class="level-bar" role="progressbar" aria-label="Kapasitas ${name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(percentage)}">
        <div class="level-fill" style="width: ${percentage}%; background: ${level.color};"></div>
      </div>
      <div class="level-hint"><span>${escapeHtml(level.label)}${warning}</span><span>${Math.max(0, 100 - Math.round(percentage))}% tersedia</span></div>
      <div class="card-divider"></div>
      <div class="info-row"><span>Jarak tangan</span><span>${safeDistance}</span></div>
      <div class="info-row"><span>Sudut tutup</span><span>${safeAngle}</span></div>
      <div class="info-row"><span>Update terakhir (WIB)</span><span>${updateTime}</span></div>
    </article>`;
}

function isDeviceOnline(status) {
  const lastUpdate = Number(status.last_update);
  const ageInSeconds = Math.floor(Date.now() / 1000) - lastUpdate;
  return status.online === true && Number.isFinite(lastUpdate) && ageInSeconds < 60;
}

function updateOverview() {
  const onlineCount = devices.filter((device) => device.isOnline).length;
  const fullCount = devices.filter((device) => device.isOnline && Number(device.status.isi_persen) >= 80).length;
  document.getElementById("total-count").textContent = String(devices.length);
  document.getElementById("online-count").textContent = String(onlineCount);
  document.getElementById("full-count").textContent = String(fullCount);
  document.getElementById("offline-count").textContent = String(devices.length - onlineCount);
  document.getElementById("device-heading-count").textContent = `(${devices.length})`;
}

function renderDevices() {
  updateOverview();
  const query = searchInput.value.trim().toLocaleLowerCase("id-ID");
  const filter = filterSelect.value;
  const filteredDevices = devices.filter((device) => {
    const searchable = `${device.id} ${device.info.name || ""} ${device.info.location || ""}`.toLocaleLowerCase("id-ID");
    const matchesSearch = searchable.includes(query);
    const matchesFilter = filter === "all"
      || (filter === "online" && device.isOnline)
      || (filter === "offline" && !device.isOnline)
      || (filter === "full" && device.isOnline && Number(device.status.isi_persen) >= 80);
    return matchesSearch && matchesFilter;
  });

  grid.setAttribute("aria-busy", "false");
  if (!devices.length) {
    grid.innerHTML = '<div class="empty-state"><p>Belum ada device terhubung.</p><small>Perangkat akan muncul otomatis saat mengirim data ke Firebase.</small></div>';
    return;
  }
  if (!filteredDevices.length) {
    grid.innerHTML = '<div class="empty-state"><p>Tidak ada perangkat yang cocok.</p><small>Coba ubah kata kunci atau filter kondisi.</small></div>';
    return;
  }
  grid.innerHTML = filteredDevices.map(({ id, info, status, isOnline }) => renderDevice(id, info, status, isOnline)).join("");
}

function refreshOnlineStates() {
  if (!hasReceivedData) return;
  let changed = false;
  devices = devices.map((device) => {
    const isOnline = isDeviceOnline(device.status);
    if (device.isOnline === isOnline) return device;
    changed = true;
    return { ...device, isOnline };
  });
  if (changed) renderDevices();
}

function setConnection(state, label) {
  connectionStatus.classList.remove("is-connected", "is-error");
  if (state) connectionStatus.classList.add(state);
  connectionLabel.textContent = label;
}

function handleMission() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const key = "smartbin-mission-date";
  const completed = localStorage.getItem(key) === today;
  if (completed) {
    localStorage.removeItem(key);
    document.getElementById("mission-button-label").textContent = "Saya ikut menjaga";
    document.getElementById("mission-text").textContent = "Sampahmu punya tempat. Yuk, buang dengan bijak!";
    document.getElementById("mission-button").disabled = false;
    return;
  }

  localStorage.setItem(key, today);
  document.getElementById("mission-button-label").textContent = "Misi selesai hari ini";
  document.getElementById("mission-text").textContent = "Terima kasih sudah ikut menjaga lingkungan tetap bersih!";
  document.getElementById("mission-button").disabled = true;
}

function initializeMission() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  if (localStorage.getItem("smartbin-mission-date") === today) {
    document.getElementById("mission-button-label").textContent = "Misi selesai hari ini";
    document.getElementById("mission-text").textContent = "Terima kasih sudah ikut menjaga lingkungan tetap bersih!";
    document.getElementById("mission-button").disabled = true;
  }
}

document.getElementById("footer-year").textContent = String(new Date().getFullYear());
document.getElementById("enter-dashboard").addEventListener("click", () => {
  welcomePage.hidden = true;
  dashboard.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("show-welcome").focus();
});
document.getElementById("show-welcome").addEventListener("click", (event) => {
  event.preventDefault();
  dashboard.hidden = true;
  welcomePage.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("enter-dashboard").focus();
});
searchInput.addEventListener("input", renderDevices);
filterSelect.addEventListener("change", renderDevices);
document.getElementById("mission-button").addEventListener("click", handleMission);
initializeMission();

onValue(ref(db, ".info/connected"), (snapshot) => {
  const connected = snapshot.val() === true;
  setConnection(connected ? "is-connected" : "is-error", connected ? "Terhubung ke Firebase" : "Koneksi terputus");
  dataNote.textContent = connected
    ? "Data diperbarui otomatis dari perangkat."
    : hasReceivedData
      ? "Koneksi terputus. Data terakhir tetap ditampilkan."
      : "Menunggu koneksi ke Firebase...";
});

onValue(ref(db, "trashbins"), (snapshot) => {
  const data = snapshot.val() || {};
  const deviceIds = Object.keys(data).length
    ? [...new Set([...Object.keys(data), ...Object.keys(expectedDevices)])]
    : [];
  devices = deviceIds
    .sort((idA, idB) => idA.localeCompare(idB, "en", { numeric: true }))
    .map((id) => {
      const device = data[id] || {};
      const info = { ...device.info, name: device.info?.name || expectedDevices[id] || id };
      const status = device.status || {};
      return { id, info, status, isOnline: isDeviceOnline(status) };
    });
  hasReceivedData = true;
  document.getElementById("last-sync").textContent = new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta"
  });
  renderDevices();
}, (error) => {
  setConnection("is-error", "Koneksi bermasalah");
  dataNote.textContent = "Tidak dapat mengambil pembaruan. Data terakhir yang diterima tetap ditampilkan.";
  console.error("Gagal membaca data trashbins:", error);
});

setInterval(refreshOnlineStates, 5000);
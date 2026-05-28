// ===== STATE =====
let activityData = [];
let users = [];
let currentUser = null;
let currentUserSession = null; // for user portal
let pendingResetUsername = null;
let selectedUserPurchasePlan = "weekly";

// ===== LUCIDE =====
function initIcons() {
  if (window.lucide) lucide.createIcons();
}

// ===== PORTAL (now redirects to /login) =====
function showPortal() {
  hideAll();
  const ls = document.getElementById("loginScreen");
  if (ls) ls.classList.add("show");
  initIcons();
  setTimeout(() => { const u = document.getElementById("loginUsername"); if(u) u.focus(); }, 200);
}

function showLogin(type) { showPortal(); }

function buildOwnerNav() {
  return `
    <div class="nav-section-label">Menu</div>
    <a class="nav-link" href="/"><i data-lucide="home"></i> Home</a>
    <div class="nav-link active" onclick="showPage('dashboard',this)"><i data-lucide="layout-dashboard"></i> Dashboard</div>
    <div class="nav-link" onclick="showPage('users',this)"><i data-lucide="users"></i> Anggota</div>
    <div class="nav-link" onclick="showPage('activity',this)"><i data-lucide="clipboard-list"></i> Riwayat Aktivitas</div>
    <div class="nav-link" onclick="showPage('broadcast',this)"><i data-lucide="megaphone"></i> Broadcast & Versi</div>
    <div class="nav-section-label">Lainnya</div>
    <a class="nav-link" href="/shop"><i data-lucide="key-round"></i> Beli Key</a>
    <a class="nav-link" href="/download"><i data-lucide="download"></i> Download Apps</a>
    <div class="nav-section-label">Pengaturan</div>
    <div class="nav-link" onclick="showPage('jsonview',this)"><i data-lucide="file-json"></i> Konfigurasi</div>
  `;
}

function buildMemberNav() {
  return `
    <div class="nav-section-label">Menu</div>
    <a class="nav-link" href="/"><i data-lucide="home"></i> Home</a>
    <div class="nav-link active" onclick="showPage('member',this)"><i data-lucide="layout-dashboard"></i> Dashboard</div>
    <div class="nav-link" onclick="showPage('member-profile',this)"><i data-lucide="user-round"></i> Informasi Profil</div>
    <div class="nav-link" onclick="showPage('member-log',this)"><i data-lucide="clipboard-list"></i> Log Aktivitas Saya</div>
    <div class="nav-section-label">Lainnya</div>
    <a class="nav-link" href="/shop"><i data-lucide="key-round"></i> Beli Key</a>
    <a class="nav-link" href="/download"><i data-lucide="download"></i> Install Aplikasi</a>
  `;
}

function showMainLayout(isOwner, username, roleLabel) {
  hideAll();
  document.getElementById("mainLayout").style.display = "flex";
  document.getElementById("sidebarNav").innerHTML = isOwner ? buildOwnerNav() : buildMemberNav();
  document.getElementById("pillAvatar").textContent = username.charAt(0).toUpperCase();
  document.getElementById("pillName").textContent = username;
  document.getElementById("pillRole").textContent = roleLabel;
  document.getElementById("pillLogout").onclick = isOwner ? doLogout : doUserLogout;
  // reset pages - show correct default
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById(isOwner ? "page-dashboard" : "page-member").classList.add("active");
  initIcons();
}

function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function selectUserPurchasePlan(plan) {
  selectedUserPurchasePlan = plan;
  document.querySelectorAll(".plan-card").forEach((card) => {
    card.classList.toggle(
      "plan-selected",
      card.textContent.toLowerCase().includes(plan),
    );
  });
  const label = plan === "hourly" ? "Hourly" : plan === "weekly" ? "Weekly" : "Monthly";
  document.getElementById("paymentPlanLabel").textContent = label;
}

function openUserPaymentModal() {
  const username = document.getElementById("userLoginUsername").value.trim();
  if (!username) {
    showToast("Masukkan username untuk pembayaran.", true);
    return;
  }
  document.getElementById("userPaymentUsername").value = username;
  document.getElementById("userPaymentPlan").value = selectedUserPurchasePlan;
  document.getElementById("paymentPlanLabel").textContent =
    selectedUserPurchasePlan === "hourly" ? "Hourly" :
    selectedUserPurchasePlan === "weekly" ? "Weekly" : "Monthly";
  // set visible amount text
  const amountEl = document.getElementById("userPaymentAmount");
  if (amountEl) {
    amountEl.textContent =
      selectedUserPurchasePlan === "hourly" ? "5.000" :
      selectedUserPurchasePlan === "weekly" ? "26.000" : "46.000";
  }
  document.getElementById("userPaymentModal").classList.add("show");
  initIcons();
}

function closeUserPaymentModal() {
  document.getElementById("userPaymentModal").classList.remove("show");
}

async function handleUserPaymentConfirm() {
  const username = document.getElementById("userPaymentUsername").value;
  const plan = document.getElementById("userPaymentPlan").value;
  if (!username || !plan) {
    showToast("Data pembayaran tidak lengkap.", true);
    return;
  }
  try {
    const res = await fetch("/api/purchase-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, plan }),
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message);
      closeUserPaymentModal();
      fetchUsers();
    } else {
      showToast(result.message || "Pembayaran gagal.", true);
    }
  } catch (e) {
    showToast("Gagal memproses pembayaran.", true);
  }
}

function getSelectedKeyType() {
  const input = document.querySelector('input[name="newKeyType"]:checked');
  return input ? input.value : "permanent";
}

function toggleAutoKey(checkbox) {
  const enabled = checkbox.checked;
  document.getElementById("keyTypeSection").style.opacity = enabled
    ? "1"
    : "0.5";
  document
    .querySelectorAll('#keyTypeSection input[name="newKeyType"]')
    .forEach((input) => {
      input.disabled = !enabled;
    });
}

function hideAll() {
  const loginScreen = document.getElementById("loginScreen");
  if (loginScreen) loginScreen.classList.remove("show");
  const mainLayout = document.getElementById("mainLayout");
  if (mainLayout) mainLayout.style.display = "none";
}

// ===== UNIFIED LOGIN =====
async function doLogin() {
  const user = document.getElementById("loginUsername").value.trim();
  const pass = document.getElementById("loginPassword").value;
  const errEl = document.getElementById("loginError");
  const uInput = document.getElementById("loginUsername");
  const pInput = document.getElementById("loginPassword");
  const btn = document.getElementById("loginBtn");

  errEl.classList.remove("show");
  uInput.classList.remove("error");
  pInput.classList.remove("error");

  if (!user || !pass) {
    errEl.querySelector("span").textContent = "Nama pengguna dan kata sandi wajib diisi.";
    errEl.classList.add("show");
    uInput.classList.add("error");
    pInput.classList.add("error");
    return;
  }

  if (btn) { btn.style.opacity = "0.7"; btn.style.pointerEvents = "none"; }

  try {
    // Try admin login first
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    });
    const result = await response.json();

    if (result.success) {
      currentUser = result.user;
      localStorage.setItem("adminSession", JSON.stringify(currentUser));
      showMainLayout(true, currentUser.username, "Pengelola");
      const wn = document.getElementById("welcomeName");
      if (wn) wn.textContent = currentUser.username;
      updateStatUsers();
      renderJSON();
      fetchLogs();
      showToast(`Selamat datang kembali, ${currentUser.username}!`);
      pushLog("Masuk Berhasil", "Sesi pengelola dimulai", "#5ecb8a");
      return;
    }

    // Try user login if admin failed
    const userResponse = await fetch("/api/user-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass, deviceId: getBrowserDeviceId() }),
    });
    const userResult = await userResponse.json();

    if (userResult.success) {
      currentUserSession = userResult;
      localStorage.setItem("userSession", JSON.stringify(userResult));
      showMainLayout(false, userResult.username,
        userResult.role === "admin" ? "Pengelola" : "Anggota");
      const setEl2 = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl2("memberAvatar", userResult.username.charAt(0).toUpperCase());
      setEl2("memberName", userResult.username);
      setEl2("memberEmail", userResult.email || "—");
      setEl2("memberRole", userResult.role === "admin" ? "Pengelola" : "Anggota");
      setEl2("memberJoined", userResult.created_at
        ? new Date(userResult.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
        : "—");
      setEl2("memberKey", userResult.key || "Key belum tersedia");
      setEl2("memberKeyType", userResult.key_type ? userResult.key_type.toUpperCase() : "—");
      setEl2("memberKeyExpiry", userResult.key_expires_at ? formatDate(userResult.key_expires_at) : "—");
      showToast(`Selamat datang, ${userResult.username}!`);
      pushLog("Anggota Masuk", `User '${userResult.username}' login ke panel web.`, "#22c55e");
      initIcons();
      return;
    }

    // Both failed
    uInput.classList.add("error");
    pInput.classList.add("error");
    errEl.querySelector("span").textContent = "Nama pengguna atau kata sandi tidak tepat.";
    errEl.classList.add("show");
  } catch (error) {
    showToast("Server tidak merespons.", true);
  } finally {
    if (btn) { btn.style.opacity = ""; btn.style.pointerEvents = ""; }
  }
}

function doLogout() {
  pushLog("Keluar", "Sesi pengelola telah diakhiri", "#7eb3e8");
  currentUser = null;
  localStorage.removeItem("adminSession");
  const uEl = document.getElementById("loginUsername"); if (uEl) uEl.value = "";
  const pEl = document.getElementById("loginPassword"); if (pEl) pEl.value = "";
  const errEl = document.getElementById("loginError"); if (errEl) errEl.classList.remove("show");
  showPortal();
}

// ===== APK DOWNLOAD =====
function handleApkDownload() {
  // Replace './app-release.apk' with the real APK URL
  const apkUrl = './app-release.apk';
  const a = document.createElement('a');
  a.href = apkUrl;
  a.download = 'CendekiaMod-v2.4.1.apk';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast("Mengunduh aplikasi Cendekia Mod...");
  pushLog("Unduh Aplikasi", "File APK Cendekia Mod sedang diunduh", "#7eb3e8");
}

// Membuat ID unik untuk browser ini
function getBrowserDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = "WEB-" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("deviceId", id);
  }
  return id;
}

// ===== USER LOGIN =====
function fillMemberDash(data) {
  document.getElementById("memberAvatar").textContent = data.username.charAt(0).toUpperCase();
  document.getElementById("memberName").textContent = data.username;
  document.getElementById("memberEmail").textContent = data.email || "—";
  document.getElementById("memberRole").textContent = data.role === "admin" ? "Pengelola" : "Anggota";
  document.getElementById("memberJoined").textContent = data.created_at
    ? new Date(data.created_at).toLocaleDateString("id-ID", { day:"numeric", month:"long", year:"numeric" })
    : "—";
  document.getElementById("memberKey").textContent = data.key || "Kunci belum tersedia";
  document.getElementById("memberKeyType").textContent = data.key_type ? data.key_type.toUpperCase() : "—";
  document.getElementById("memberKeyExpiry").textContent = data.key_expires_at ? formatDate(data.key_expires_at) : "—";
  initIcons();
}

async function doUserLogin() {
  const user = document.getElementById("userLoginUsername").value.trim();
  const pass = document.getElementById("userLoginPassword").value;
  const errEl = document.getElementById("userLoginError");
  const uInput = document.getElementById("userLoginUsername");
  const pInput = document.getElementById("userLoginPassword");

  errEl.classList.remove("show");
  uInput.classList.remove("error");
  pInput.classList.remove("error");

  if (!user || !pass) {
    errEl.querySelector("span").textContent =
      "Nama pengguna dan kata sandi wajib diisi.";
    errEl.classList.add("show");
    uInput.classList.add("error");
    pInput.classList.add("error");
    return;
  }

  const showUserDashboard = (userData) => {
    currentUserSession = userData;
    showMainLayout(false, userData.username,
      userData.role === "admin" ? "Pengelola" : "Anggota");
    const el = document.getElementById("memberAvatar");
    if (el) el.textContent = userData.username.charAt(0).toUpperCase();
  };

  try {
    const response = await fetch("/api/user-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: user,
        password: pass,
        deviceId: getBrowserDeviceId(),
      }),
    });
    const result = await response.json();

    if (!result.success) {
      uInput.classList.add("error");
      pInput.classList.add("error");
      errEl.querySelector("span").textContent =
        result.message || "Username atau password salah.";
      errEl.classList.add("show");
      return;
    }

    currentUserSession = result;
    localStorage.setItem("userSession", JSON.stringify(result));
    showMainLayout(false, result.username,
      result.role === "admin" ? "Pengelola" : "Anggota");
    const setR = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setR("memberAvatar", result.username.charAt(0).toUpperCase());
    setR("memberName", result.username);
    setR("memberEmail", result.email || "—");
    setR("memberRole", result.role === "admin" ? "Pengelola" : "Anggota");
    setR("memberJoined", result.created_at
      ? new Date(result.created_at).toLocaleDateString("id-ID", {
          day: "numeric", month: "long", year: "numeric",
        })
      : "—");
    setR("memberKey", result.key || "Key belum tersedia");
    setR("memberKeyType", result.key_type ? result.key_type.toUpperCase() : "—");
    setR("memberKeyExpiry", result.key_expires_at ? formatDate(result.key_expires_at) : "—");
    showToast(`Selamat datang, ${result.username}!`);
    pushLog(
      "Login User Berhasil",
      `Anggota '${result.username}' membuka ruang akses.`,
      "#22c55e",
    );
  } catch (e) {
    showToast("Server tidak merespons.", true);
  }
  initIcons();
}

async function doUserLogout() {
  const username = currentUserSession?.username;
  const token = currentUserSession?.token;
  if (token) {
    try {
      await fetch("/api/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } catch (e) {}
  }
  currentUserSession = null;
  localStorage.removeItem("userSession");
  if (username) {
    pushLog("Anggota Keluar", `Anggota '${username}' telah keluar dari sesi.`, "#42a5f5");
  }
  showPortal();
}

function copyToClipboard(text) {
  if (!text || text === "—" || text === "Key belum tersedia") return;
  navigator.clipboard.writeText(text).then(() => {
    showToast("Kunci akses berhasil disalin!");
  });
}

function copyKey() {
  const keyEl = document.getElementById("memberKey"); const key = keyEl ? keyEl.textContent.trim() : "";
  pushLog(
    "Key Disalin",
    `User '${currentUserSession.username}' menyalin key mereka.`,
    "#42a5f5",
  );
  copyToClipboard(key);
}

// ===== SHOW PAGE =====
function showPage(name, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(n => n.classList.remove("active"));
  document.getElementById("page-" + name).classList.add("active");
  if (el) el.classList.add("active");
  if (name === "jsonview") renderJSON();
  else if (name === "users") fetchUsers();
  else if (name === "member-log") renderMemberLog();
  else if (name === "member-profile") fillProfilePage();
  else if (name === "broadcast") loadBroadcastPage();
  initIcons();
}

// ===== TOGGLE PW =====
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btn.innerHTML = isHidden
    ? '<i data-lucide="eye-off"></i>'
    : '<i data-lucide="eye"></i>';
  lucide.createIcons();
}

// ===== JSON VIEW =====
async function renderJSON() {
  const preview = document.getElementById("jsonPreview");

  if (!preview) return;

  preview.innerHTML = `
    <div style="padding:20px;color:#22c55e;font-weight:bold;">
      MongoDB Connected Successfully
    </div>
  `;
}


// ===== SIDEBAR TOGGLE =====
let sidebarCollapsed = false;
function toggleSidebar() {
  const layout = document.getElementById("mainLayout");
  sidebarCollapsed = !sidebarCollapsed;
  if (layout) layout.classList.toggle("sidebar-collapsed", sidebarCollapsed);
}

// ===== FILL PROFILE PAGE =====
function fillProfilePage() {
  if (!currentUserSession) return;
  const d = currentUserSession;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const initial = (d.username || "U").charAt(0).toUpperCase();
  set("profileAvatarLg", initial);
  set("profileNameHero", d.username);
  set("profileRoleHero", d.role === "admin" ? "Pengelola" : "Anggota");
  set("profileUsername", d.username);
  set("profileEmail", d.email || "—");
  set("profileRole", d.role === "admin" ? "Pengelola" : "Anggota");
  set("profileJoined", d.created_at
    ? new Date(d.created_at).toLocaleDateString("id-ID", { day:"numeric", month:"long", year:"numeric" })
    : "—");
  set("profileKey", d.key || "Kunci belum tersedia");
  set("profileKeyType", d.key_type ? d.key_type.toUpperCase() : "—");
  set("profileKeyExpiry", d.key_expires_at ? formatDate(d.key_expires_at) : "Permanen");
  initIcons();
}

// ===== MEMBER: LOG AKTIVITAS (hanya akun sendiri) =====
function renderMemberLog() {
  const container = document.getElementById("memberOwnLog");
  if (!container || !currentUserSession) return;
  const uname = currentUserSession.username.toLowerCase();
  const myLogs = activityData.filter(a =>
    (a.detail && a.detail.toLowerCase().includes(uname)) ||
    (a.text && a.text.toLowerCase().includes(uname))
  );
  if (myLogs.length === 0) {
    container.innerHTML = `<div class="member-log-empty"><i data-lucide="inbox"></i><br>Belum ada aktivitas yang tercatat untuk akun Anda.</div>`;
    initIcons();
    return;
  }
  container.innerHTML = myLogs.map(a => `
    <div class="activity-item">
      <div class="activity-dot" style="background:${a.color||'#63b3ed'}"></div>
      <div class="activity-info"><strong>${a.text}</strong><span>${a.detail}</span></div>
      <div class="activity-time">${a.time}</div>
    </div>
  `).join("");
}

// ===== MEMBER: GANTI PASSWORD =====
async function doMemberChangePassword() {
  const oldPw = document.getElementById("memberOldPw").value;
  const newPw = document.getElementById("memberNewPw").value;
  const confirmPw = document.getElementById("memberConfirmPw").value;
  if (!oldPw || !newPw || !confirmPw) { showToast("Semua kolom wajib diisi!", true); return; }
  if (newPw !== confirmPw) { showToast("Konfirmasi kata sandi tidak cocok!", true); return; }
  if (newPw.length < 6) { showToast("Minimal 6 karakter!", true); return; }
  try {
    const res = await fetch("/api/change-member-password", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUserSession.username, oldPassword: oldPw, newPassword: newPw })
    });
    const result = await res.json();
    if (result.success) {
      showToast("Kata sandi berhasil diperbarui!");
      ["memberOldPw","memberNewPw","memberConfirmPw"].forEach(id => { const el = document.getElementById(id); if(el) el.value=""; });
      pushLog("Password Diubah", `Anggota '${currentUserSession.username}' mengubah kata sandi.`, "#f59e0b");
    } else {
      showToast(result.message || "Gagal mengubah kata sandi.", true);
    }
  } catch (e) { showToast("Server tidak merespons.", true); }
}

// ===== EDIT USER MODAL =====
function openEditUserModal(username, email) {
  document.getElementById("editUserModal").classList.add("show");
  document.getElementById("editUserUsername").value = username;
  document.getElementById("editUserTitle").textContent = username;
  document.getElementById("editUserNewUsername").value = username;
  document.getElementById("editUserNewEmail").value = email || "";
  document.getElementById("editUserNewPassword").value = "";
  switchEditUserTab("info");
  initIcons();
}

function closeEditUserModal() {
  document.getElementById("editUserModal").classList.remove("show");
}

function switchEditUserTab(tab) {
  ["info","email","password"].forEach(t => {
    const btn = document.getElementById("editTab-" + t);
    const panel = document.getElementById("editUserPanel-" + t);
    const isActive = t === tab;
    if (panel) panel.style.display = isActive ? "block" : "none";
    if (btn) btn.style.opacity = isActive ? "1" : "0.5";
  });
}

async function handleEditUserForm() {
  const username = document.getElementById("editUserUsername").value;
  const newUsername = document.getElementById("editUserNewUsername").value.trim();
  const newEmail = document.getElementById("editUserNewEmail").value.trim();
  const newPassword = document.getElementById("editUserNewPassword").value;

  // determine active tab
  let activeTab = "info";
  if (document.getElementById("editUserPanel-email").style.display !== "none") activeTab = "email";
  if (document.getElementById("editUserPanel-password").style.display !== "none") activeTab = "password";

  let payload = { username };
  if (activeTab === "info") {
    if (!newUsername) { showToast("Username tidak boleh kosong!", true); return; }
    payload.newUsername = newUsername;
  } else if (activeTab === "email") {
    if (!newEmail) { showToast("Email tidak boleh kosong!", true); return; }
    payload.newEmail = newEmail;
  } else {
    if (!newPassword) { showToast("Password tidak boleh kosong!", true); return; }
    payload.newPassword = newPassword;
  }

  try {
    const res = await fetch("/api/edit-user", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message || "Berhasil diperbarui!");
      closeEditUserModal();
      fetchUsers();
      pushLog("User Diedit", `Admin mengubah data user '${username}'.`, "#a78bfa");
    } else {
      showToast(result.message || "Gagal memperbarui.", true);
    }
  } catch (e) { showToast("Server tidak merespons.", true); }
}

// ===== KEY EXPIRY WARNING =====
function checkKeyExpiryWarning() {
  const warnEl = document.getElementById("keyExpiryWarning");
  if (!warnEl || !currentUserSession || !currentUserSession.key_expires_at) {
    if (warnEl) warnEl.classList.add("hidden");
    return;
  }
  const expires = new Date(currentUserSession.key_expires_at);
  const now = new Date();
  const diffMs = expires - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffMs <= 0) {
    document.getElementById("keyExpiryWarningTitle").textContent = "Kunci Akses Telah Kadaluarsa!";
    document.getElementById("keyExpiryWarningDetail").textContent = "Kunci akses Anda sudah tidak aktif. Segera hubungi admin untuk perpanjangan.";
    warnEl.style.background = "rgba(252,129,129,0.08)";
    warnEl.style.borderColor = "rgba(252,129,129,0.4)";
    warnEl.style.color = "var(--red)";
    warnEl.classList.remove("hidden");
  } else if (diffDays <= 3) {
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffDays);
    const hours = totalHours % 24;
    const timeStr = days > 0 ? `${days} hari ${hours} jam` : `${totalHours} jam`;
    document.getElementById("keyExpiryWarningTitle").textContent = "⚠️ Kunci Akses Segera Kadaluarsa!";
    document.getElementById("keyExpiryWarningDetail").textContent =
      `Tersisa ${timeStr} lagi. Segera perpanjang kunci akses Anda sebelum habis masa berlakunya.`;
    warnEl.style.background = "";
    warnEl.style.borderColor = "";
    warnEl.style.color = "";
    warnEl.classList.remove("hidden");
  } else {
    warnEl.classList.add("hidden");
  }
}

// ===== CHANGE PASSWORD =====
async function changePassword() {
  const newp = document.getElementById("newPw").value;
  if (!newp) {
    showToast("Password baru tidak boleh kosong!", true);
    return;
  }
  try {
    const response = await fetch("/api/save-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: newp }),
    });
    const result = await response.json();
    if (result.success) {
      renderJSON();
      showToast(result.message);
      clearPwForm();
      pushLog("Password diubah", "Konfigurasi keamanan diperbarui", "#f59e0b");
    } else {
      showToast("Gagal simpan ke server", true);
    }
  } catch (error) {
    showToast("Server tidak merespons.", true);
  }
}

function clearPwForm() {
  document.getElementById("newPw").value = "";
}

// ===== USER MANAGEMENT =====
async function fetchUsers() {
  try {
    const res = await fetch("/api/get-users");
    users = await res.json();
    renderUsersTable();
    updateStatUsers();
  } catch (e) {
    console.error("Gagal memuat daftar user:", e);
  }
}

function updateStatUsers() {
  const el = document.getElementById("statTotalUsers");
  if (el) el.textContent = users.length.toLocaleString("id-ID");
  const subEl = document.getElementById("userCountSub");
  if (subEl) subEl.textContent = `${users.length} anggota terdaftar di platform`;
}

function renderUsersTable() {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  users.forEach((user, i) => {
    const row = document.createElement("tr");
    const roleColor =
      user.role === "super_admin"
        ? "badge-blue"
        : user.role === "admin"
          ? "badge-orange"
          : "badge-green";
    const roleLabel =
      user.role === "super_admin"
        ? "Pengelola Utama"
        : user.role === "admin"
          ? "Admin"
          : "User";
    const statusLabel = user.isBlacklisted
      ? "Banned"
      : user.hasDevice
        ? "Locked"
        : "Aktif";
    const statusColor = user.isBlacklisted
      ? "badge-orange"
      : user.hasDevice
        ? "badge-blue"
        : "badge-green";

    const now = new Date();
    const expiresAt = user.key_expires_at
      ? new Date(user.key_expires_at)
      : null;
    const isExpired = expiresAt && expiresAt <= now;
    const keyDisplay = isExpired ? "Expired" : user.key ? user.key : "—";
    const keyColor = isExpired
      ? "badge-orange"
      : user.key
        ? "badge-green"
        : "badge-blue";
    const keyTypeLabel = user.key_type
      ? `<div class="key-meta">${user.key_type.toUpperCase()}${expiresAt ? ` · ${formatDate(user.key_expires_at)}` : ""}</div>`
      : "";
    const canDelete = user.role !== "super_admin";

    const roleMap = { "super_admin": "Pengelola Utama", "admin": "Pengelola", "user": "Anggota" };
    const roleLabelFinal = roleMap[user.role] || user.role;
    row.innerHTML = `
      <td>#${String(i + 1).padStart(3, "0")}</td>
      <td style="font-weight:600;">${user.username}</td>
      <td style="color:var(--mist);">${user.email || "—"}</td>
      <td><span class="badge ${roleColor}">${roleLabelFinal}</span></td>
      <td><span class="badge ${keyColor}" style="font-family:'JetBrains Mono',monospace;font-size:11px;">${keyDisplay}</span>${keyTypeLabel}</td>
      <td><span class="badge ${statusColor}">${statusLabel}</span></td>
      <td style="color:var(--mist);">${new Date(user.created_at).toLocaleDateString("id-ID")}</td>
      <td>
        <div class="action-cell">
          <button class="tbl-btn tbl-btn-green" onclick='openEditKeyModal(${JSON.stringify(user.username)}, ${JSON.stringify(user.key)}, ${user.maxDevices})' title="Ubah Kunci"><i data-lucide="key"></i></button>
          <button class="tbl-btn tbl-btn-blue" onclick="openResetDeviceModal('${user.username}')" title="Atur Ulang Perangkat"><i data-lucide="refresh-cw"></i></button>
          <button class="tbl-btn tbl-btn-amber" onclick="toggleBlacklist('${user.username}')" title="Blokir Akses"><i data-lucide="shield-off"></i></button>
          <button class="tbl-btn" onclick='openEditUserModal(${JSON.stringify(user.username)}, ${JSON.stringify(user.email||"")})' title="Edit Pengguna" style="background:rgba(167,139,250,0.1);border-color:rgba(167,139,250,0.2);color:#a78bfa;"><i data-lucide="user-pen"></i></button>
          ${canDelete ? `<button class="tbl-btn tbl-btn-red" onclick="deleteUser('${user.username}')" title="Hapus Akun"><i data-lucide="trash-2"></i></button>` : ""}
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
  initIcons();
}

function openEditKeyModal(username, key, maxDevices) {
  const modal = document.getElementById("editKeyModal");

  document.getElementById("editKeyInput").value = key;
  document.getElementById("editMaxDevicesInput").value = maxDevices || 1;
  // store username on modal dataset instead of using a hidden input
  modal.dataset.username = username;
  
  // Reset ke permanent sebagai default saat dibuka
  const permRadio = document.querySelector('input[name="editKeyType"][value="permanent"]');
  if (permRadio) {
    permRadio.checked = true;
    selectEditKeyType(permRadio);
  }

  // Show or hide delete button depending on whether a key exists
  const delBtn = document.getElementById("deleteKeyBtn");
  if (delBtn) {
    delBtn.style.display = key ? "inline-block" : "none";
  }

  modal.classList.add("show");
}

function closeEditKeyModal() {
  const modal = document.getElementById("editKeyModal");
  if (modal && modal.dataset.username) delete modal.dataset.username;
  document.getElementById("editKeyModal").classList.remove("show");
}

function selectEditKeyType(radio) {
  selectRole(radio);
  const customGroup = document.getElementById("editCustomExpiryGroup");
  if (customGroup) {
    customGroup.style.display = radio.value === "custom" ? "block" : "none";
  }
}

async function handleEditKeyForm() {
  const modal = document.getElementById("editKeyModal");
  const username = modal ? modal.dataset.username : null;
  const newKey = document.getElementById("editKeyInput").value.trim();
  const maxDevices = document.getElementById("editMaxDevicesInput").value;
  const keyTypeRadio = document.querySelector('input[name="editKeyType"]:checked');
  const keyType = keyTypeRadio ? keyTypeRadio.value : "permanent";
  const customExpiry = document.getElementById("editCustomExpiryInput").value;

  if (!newKey) {
    showToast("Kunci akses tidak boleh kosong!", true);
    return;
  }

  try {
    const res = await fetch(`/api/update-user-key/${username}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newKey, maxDevices, keyType, customExpiry }),
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message);
      closeEditKeyModal();
      fetchUsers(); // Refresh the table
      pushLog(
        "Kunci user diubah",
        `Kunci untuk '${username}' diperbarui. Sesi user direset.`,
        "#f59e0b",
      );
    } else {
      showToast(result.message, true);
    }
  } catch (e) {
    showToast("Gagal memperbarui kunci user.", true);
  }
}

async function handleDeleteKey() {
  const modal = document.getElementById("editKeyModal");
  const username = modal ? modal.dataset.username : null;
  if (!username) return;
  const ok = await openConfirmModal(
    `Hapus kunci untuk pengguna '${username}'? Tindakan ini tidak dapat dibatalkan.`,
  );
  if (!ok) return;
  try {
    const res = await fetch(`/api/delete-user-key/${username}`, {
      method: "DELETE",
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message);
      closeEditKeyModal();
      fetchUsers();
      pushLog(
        "Kunci user dihapus",
        `Kunci untuk '${username}' telah dihapus. Sesi user direset.`,
        "#ef4444",
      );
    } else {
      showToast(result.message || "Gagal menghapus kunci.", true);
    }
  } catch (e) {
    showToast("Gagal menghapus kunci.", true);
  }
}

async function toggleBlacklist(username) {
  try {

    const res = await fetch(
      `/api/toggle-blacklist/${username}`,
      {
        method: "PUT",
      },
    );

    const result = await res.json();

    if (result.success) {

      showToast(result.message);

      fetchUsers();

    } else {

      showToast(
        result.message || "Gagal mengubah blacklist.",
        true,
      );

    }

  } catch (e) {

    showToast(
      "Gagal mengubah blacklist.",
      true,
    );

  }
}

function renderDeviceListInModal(username) {
  const listContainer = document.getElementById("deviceListContainer");
  if (!listContainer) return;

  const user = users.find((u) => u.username === username);
  const allowedIds = user ? user.allowed_devices || [] : [];

  // Simpan status checkbox saat ini agar tidak ter-reset saat auto-refresh
  const checkedIds = new Set(
    Array.from(listContainer.querySelectorAll('input[name="targetDevice"]:checked'))
      .map(input => input.value)
  );

  if (allowedIds.length === 0) {
    listContainer.innerHTML = '<p style="color: var(--gray-400); font-size: 13px;">Tidak ada perangkat terdaftar.</p>';
  } else {
    listContainer.innerHTML = allowedIds
      .map(
        (id) => `
      <label class="device-item">
        <input type="checkbox" name="targetDevice" value="${id}" ${checkedIds.has(id) ? 'checked' : ''}>
        <div class="device-item-info">
          <i data-lucide="smartphone"></i>
          <span>${id}</span>
        </div>
      </label>
    `,
      )
      .join("");
    initIcons();
  }
}

async function openResetDeviceModal(username) {
  pendingResetUsername = username;
  const modal = document.getElementById("resetDeviceModal");

  // Teks header dengan warna
  document.getElementById("resetDeviceDisplayUsername").innerHTML =
    `<span style="color: #fbbf24; font-weight: bold;">${username}</span>`;

  modal.classList.add("show");
  renderDeviceListInModal(username);
}

function closeResetDeviceModal() {
  pendingResetUsername = null;
  document.getElementById("resetDeviceModal").classList.remove("show");
}

async function handleConfirmResetDevice(resetAll = false) {
  const username = pendingResetUsername;
  let targetDevices = [];

  if (!resetAll) {
    const checked = document.querySelectorAll(
      'input[name="targetDevice"]:checked',
    );
    targetDevices = Array.from(checked).map((c) => c.value);
    if (targetDevices.length === 0) {
      showToast("Pilih minimal satu perangkat atau Reset Semua.", true);
      return;
    }
  }

  try {
    const res = await fetch(`/api/reset-device/${username}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetDevices, resetAll }),
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message);
      fetchUsers();
      // Logging untuk reset device sekarang ditangani di backend (index.js)
      closeResetDeviceModal();
    } else {
      showToast(result.message || "Gagal reset perangkat.", true);
    }
  } catch (e) {
    showToast("Gagal reset perangkat.", true);
  }
}

async function deleteUser(username) {
  const ok = await openConfirmModal(`Apakah Anda yakin ingin menghapus user '${username}'? Tindakan ini tidak bisa dibatalkan.`);
  if (!ok) return;
  try {
    const res = await fetch(`/api/delete-user/${username}`, {
      method: "DELETE",
    });
    const result = await res.json();
    if (result.success) {
      showToast(result.message);
      fetchUsers();
      pushLog(
        "User dihapus",
        `Akun '${username}' dihapus dari sistem`,
        "#ef4444",
      );
    } else {
      showToast(result.message, true);
    }
  } catch (e) {
    showToast("Gagal menghapus user.", true);
  }
}

// ===== MODAL CREATE USER =====
function openCreateUserModal() {
  document.getElementById("createUserModal").classList.add("show");
  document.getElementById("newEmail").value = "";
  document.getElementById("newUsername").value = "";
  document.getElementById("newUserPassword").value = "";
  document.getElementById("newMaxDevices").value = "1";
  document.querySelector('input[name="newRole"][value="user"]').checked = true;
  document.getElementById("roleOptUser").classList.add("selected");
  document.getElementById("roleOptAdmin").classList.remove("selected");
  document.getElementById("newAutoKey").checked = true;
  document.getElementById("keyTypePermanent").classList.add("selected");
  document.getElementById("keyTypeHourly").classList.remove("selected");
  document.getElementById("keyTypeWeekly").classList.remove("selected");
  document.getElementById("keyTypeMonthly").classList.remove("selected");
  document.getElementById("keyTypeSection").style.opacity = "1";
  document.getElementById("modalKeyPreview").style.display = "block";
  initIcons();
}

function closeCreateUserModal() {
  document.getElementById("createUserModal").classList.remove("show");
}

function closeModalOutside(event) {
  if (!event.target.classList.contains("modal-overlay")) return;
  // If clicking outside on confirm modal, treat as cancel
  if (event.target.id === "confirmModal") {
    confirmModalNo();
    return;
  }
  event.target.classList.remove("show");
}

function selectRole(radio) {
  const group = radio.closest(".role-select-group");
  if (!group) return;
  group
    .querySelectorAll(".role-option")
    .forEach((el) => el.classList.remove("selected"));
  radio.closest(".role-option").classList.add("selected");
}

// ===== CONFIRM MODAL (replace native confirm) =====
let confirmResolver = null;

function openConfirmModal(message) {
  const modal = document.getElementById("confirmModal");
  const msg = document.getElementById("confirmModalMsg");
  if (msg) msg.innerHTML = message;
  if (modal) modal.classList.add("show");
  initIcons();
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function confirmModalYes() {
  if (typeof confirmResolver === "function") confirmResolver(true);
  confirmResolver = null;
  closeConfirmModal();
}

function confirmModalNo() {
  if (typeof confirmResolver === "function") confirmResolver(false);
  confirmResolver = null;
  closeConfirmModal();
}

function closeConfirmModal() {
  const modal = document.getElementById("confirmModal");
  if (modal) modal.classList.remove("show");
}

async function handleCreateUserForm() {
  const email = document.getElementById("newEmail").value.trim();
  const username = document.getElementById("newUsername").value.trim();
  const password = document.getElementById("newUserPassword").value;
  const roleInput = document.querySelector('input[name="newRole"]:checked');
  const role = roleInput ? roleInput.value : "user";
  const createKey = document.getElementById("newAutoKey").checked;
  const keyType = getSelectedKeyType();
  const maxDevices = document.getElementById("newMaxDevices").value;

  if (!email || !username || !password) {
    showToast("Email, Username, dan Password wajib diisi!", true);
    return;
  }

  try {
    const response = await fetch("/api/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        username,
        password,
        role,
        createKey,
        keyType,
        maxDevices,
      }),
    });
    const result = await response.json();
    if (result.success) {
      const keyInfo = result.key
        ? ` Key: ${result.key} (${result.key_type || "permanent"})`
        : " User dibuat tanpa key.";
      showToast(`${result.message}${keyInfo}`);
      closeCreateUserModal();
      fetchUsers();
      pushLog(
        "User baru dibuat",
        `User '${username}' (${role}) ditambahkan`,
        "#22c55e",
      );
    } else {
      showToast(result.message, true);
    }
  } catch (error) {
    showToast("Server tidak merespons.", true);
  }
}

async function checkUserKey() {
  try {
    const data = JSON.parse(localStorage.getItem("userSession"));

    if (!data || !data.key) {
      return;
    }

    const res = await fetch("/api/key-check", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        key: data.key,

        deviceId: getBrowserDeviceId(),
      }),
    });

    const result = await res.json();

    if (!result.success) {
      localStorage.removeItem("userSession");

      currentUserSession = null;

      showToast("Akses dicabut", true);

      location.href = "/index.html";
    }
  } catch {}
}

setInterval(checkUserKey, 500);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    checkUserKey();
  }
});

// ===== LOG =====
async function fetchLogs() {
  try {
    const res = await fetch("/api/get-logs");
    activityData = await res.json();
    renderActivityLog("recentActivity", 3);
    renderActivityLog("fullActivityLog", activityData.length);
    const mlPage = document.getElementById("page-member-log");
    if (mlPage && mlPage.classList.contains("active")) renderMemberLog();
  } catch (e) {
    console.error("Gagal memuat log");
  }
}

async function pushLog(text, detail, color) {
  const newEntry = {
    text,
    detail,
    color,
    time: new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
  try {
    const res = await fetch("/api/add-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newEntry),
    });
    const result = await res.json();
    if (result.success) fetchLogs();
  } catch (e) {
    console.error("Gagal sinkronisasi log");
  }
}

function renderActivityLog(containerId, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const items = activityData.slice(0, limit);
  container.innerHTML = items
    .map(
      (a) => `
    <div class="activity-item">
      <div class="activity-dot" style="background:${a.color}"></div>
      <div class="activity-info"><strong>${a.text}</strong><span>${a.detail}</span></div>
      <div class="activity-time">${a.time}</div>
    </div>
  `,
    )
    .join("");
}

// ===== TOAST =====
function showToast(msg, isError = false) {
  const t = document.getElementById("toast");
  const icon = document.getElementById("toastIcon");
  document.getElementById("toastMsg").textContent = msg;
  icon.innerHTML = isError
    ? '<i data-lucide="x-circle"></i>'
    : '<i data-lucide="check-circle-2"></i>';
  lucide.createIcons();
  t.classList.toggle("error-toast", isError);
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3500);
}

// ===== BOOT =====
document.addEventListener("DOMContentLoaded", async () => {
  initIcons();
  showPortal();

  // Auto-login persistence check
  const savedAdmin = localStorage.getItem("adminSession");
  const savedUser = localStorage.getItem("userSession");

  if (savedAdmin) {
    currentUser = JSON.parse(savedAdmin);
    showMainLayout(true, currentUser.username, "Pengelola");
    const wn = document.getElementById("welcomeName");
    if (wn) wn.textContent = currentUser.username;
    renderJSON();
  } else if (savedUser) {
    currentUserSession = JSON.parse(savedUser);
    showMainLayout(false, currentUserSession.username,
      currentUserSession.role === "admin" ? "Pengelola" : "Anggota");
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl("memberAvatar", currentUserSession.username.charAt(0).toUpperCase());
    setEl("memberName", currentUserSession.username);
    setEl("memberEmail", currentUserSession.email || "—");
    setEl("memberRole", currentUserSession.role === "admin" ? "Pengelola" : "Anggota");
    setEl("memberJoined", currentUserSession.created_at
      ? new Date(currentUserSession.created_at).toLocaleDateString("id-ID", {
          day: "numeric", month: "long", year: "numeric",
        })
      : "—");
    setEl("memberKey", currentUserSession.key || "Key belum tersedia");
    setEl("memberKeyType", currentUserSession.key_type
      ? currentUserSession.key_type.toUpperCase() : "—");
    setEl("memberKeyExpiry", currentUserSession.key_expires_at
      ? formatDate(currentUserSession.key_expires_at) : "—");
  } else {
    showPortal(); // shows loginScreen
  }

  await fetchUsers();
  fetchLogs();
  checkKeyExpiryWarning();
  setInterval(async () => {
    checkKeyExpiryWarning();
    if (currentUser) {
      fetchLogs();
      renderJSON();
      await fetchUsers();
      if (pendingResetUsername) {
        renderDeviceListInModal(pendingResetUsername);
      }
    }
    // Pengecekan sesi user secara real-time
    if (currentUserSession) {
  try {
    const res = await fetch(`/api/user-status/${currentUserSession.username}`);
    const status = await res.json();

    const deviceAllowed =
      !status.allowed_devices ||
      status.allowed_devices.length === 0 ||
      status.allowed_devices.includes(getBrowserDeviceId());

    if (!status.success || status.isBlacklisted || status.key !== currentUserSession.key || !deviceAllowed) {
      await doUserLogout();
      showToast("Sesi Anda telah berakhir. Silakan masuk kembali.", true);
    }
  } catch (e) {}
}
  }, 5000);
});

// ========================================
// ===== BROADCAST & VERSION MANAGEMENT =====
// ========================================

let broadcastsList = [];

async function loadBroadcastPage() {
  await loadAppVersion();
  await loadBroadcasts();
}

// ===== APP VERSION =====
async function loadAppVersion() {
  try {
    const res = await fetch("/api/app-version");
    const data = await res.json();
    if (data.success) {
      const elCurrent = document.getElementById("currentVersionDisplay");
      if (elCurrent) elCurrent.textContent = "v" + (data.current_version || "0.0.0");
      const elLatest = document.getElementById("latestVersionDisplay");
      if (elLatest) elLatest.textContent = "v" + (data.latest_version || "0.0.0");
      const vc = document.getElementById("versionCurrentInput");
      if (vc) vc.value = data.current_version || "0.0.0";
      const vl = document.getElementById("versionLatestInput");
      if (vl) vl.value = data.latest_version || "0.0.0";
      const vu = document.getElementById("versionDownloadUrl");
      if (vu) vu.value = data.download_url || "";
      const vn = document.getElementById("versionNotes");
      if (vn) vn.value = data.notes || "";
      const vf = document.getElementById("versionForceUpdate");
      if (vf) vf.checked = data.force_update !== false;
    }
  } catch (e) { console.warn("Gagal load versi:", e); }
}

async function handleSaveVersion() {
  const current_version = document.getElementById("versionCurrentInput").value.trim();
  const latest_version = document.getElementById("versionLatestInput").value.trim();
  const download_url = document.getElementById("versionDownloadUrl").value.trim();
  const notes = document.getElementById("versionNotes").value.trim();
  const force_update = document.getElementById("versionForceUpdate").checked;

  if (!current_version || !latest_version) { showToast("Versi client dan versi terbaru wajib diisi.", true); return; }

  try {
    const res = await fetch("/api/app-version", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_version, latest_version, download_url, notes, force_update }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Versi disimpan — client: v${current_version} | latest: v${latest_version}`);
      const elCurrent = document.getElementById("currentVersionDisplay");
      if (elCurrent) elCurrent.textContent = "v" + current_version;
      const elLatest = document.getElementById("latestVersionDisplay");
      if (elLatest) elLatest.textContent = "v" + latest_version;
    } else {
      showToast(data.message || "Gagal menyimpan versi.", true);
    }
  } catch (e) {
    showToast("Server error.", true);
  }
}

// ===== BROADCASTS =====
async function loadBroadcasts() {
  try {
    const res = await fetch("/api/broadcasts");
    const data = await res.json();
    if (data.success) {
      broadcastsList = data.broadcasts || [];
      renderBroadcastGrid();
    }
  } catch (e) { console.warn("Gagal load broadcasts:", e); }
}

function renderBroadcastGrid() {
  const grid = document.getElementById("broadcastGrid");
  if (!grid) return;
  if (broadcastsList.length === 0) {
    grid.innerHTML = `<div class="broadcast-empty"><i data-lucide="megaphone"></i><br/>Belum ada broadcast</div>`;
    initIcons();
    return;
  }
  const typeEmoji = { info: "ℹ", warning: "⚠", danger: "🚨", success: "✓" };
  const typeLabel = { info: "Info", warning: "Peringatan", danger: "Penting", success: "Kabar Baik" };
  grid.innerHTML = broadcastsList.map(b => {
    const t = b.type || "info";
    const dateStr = b.created_at ? new Date(b.created_at).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" }) : "";
    return `
      <div class="broadcast-card bc-${t}">
        <div class="broadcast-card-icon">${typeEmoji[t] || "ℹ"}</div>
        <div class="broadcast-card-body">
          <div class="broadcast-card-header">
            <span class="broadcast-card-title">${escapeAdminHtml(b.title)}</span>
            <span class="broadcast-type-badge">${typeLabel[t] || t}</span>
            <span class="broadcast-status-badge ${b.active ? 'active' : 'inactive'}">${b.active ? '● Aktif' : '○ Nonaktif'}</span>
          </div>
          <div class="broadcast-card-msg">${escapeAdminHtml(b.message)}</div>
          ${dateStr ? `<div class="broadcast-card-meta">${dateStr}</div>` : ""}
        </div>
        <div class="broadcast-card-actions">
          <button class="bc-action-btn" onclick="openEditBroadcast('${b._id}')" title="Edit"><i data-lucide="pencil"></i></button>
          <button class="bc-action-btn del" onclick="handleDeleteBroadcast('${b._id}','${escapeAdminHtml(b.title)}')" title="Hapus"><i data-lucide="trash-2"></i></button>
        </div>
      </div>`;
  }).join("");
  initIcons();
}

function escapeAdminHtml(str) {
  return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ===== BROADCAST MODAL =====
function openBroadcastModal() {
  document.getElementById("broadcastEditId").value = "";
  document.getElementById("broadcastModalTitle").textContent = "Buat Broadcast";
  document.getElementById("broadcastTitle").value = "";
  document.getElementById("broadcastMessage").value = "";
  document.getElementById("broadcastType").value = "info";
  document.getElementById("broadcastActive").checked = true;
  document.getElementById("broadcastModal").classList.add("show");
  initIcons();
}

function openEditBroadcast(id) {
  const b = broadcastsList.find(x => x._id === id);
  if (!b) return;
  document.getElementById("broadcastEditId").value = id;
  document.getElementById("broadcastModalTitle").textContent = "Edit Broadcast";
  document.getElementById("broadcastTitle").value = b.title;
  document.getElementById("broadcastMessage").value = b.message;
  document.getElementById("broadcastType").value = b.type || "info";
  document.getElementById("broadcastActive").checked = b.active !== false;
  document.getElementById("broadcastModal").classList.add("show");
  initIcons();
}

function closeBroadcastModal() {
  document.getElementById("broadcastModal").classList.remove("show");
}

async function handleBroadcastForm() {
  const id = document.getElementById("broadcastEditId").value;
  const title = document.getElementById("broadcastTitle").value.trim();
  const message = document.getElementById("broadcastMessage").value.trim();
  const type = document.getElementById("broadcastType").value;
  const active = document.getElementById("broadcastActive").checked;

  if (!title || !message) { showToast("Judul dan pesan wajib diisi.", true); return; }

  try {
    const isEdit = !!id;
    const url = isEdit ? `/api/broadcasts/${id}` : "/api/broadcasts";
    const method = isEdit ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, message, type, active }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(isEdit ? "Broadcast diperbarui." : "Broadcast berhasil dibuat.");
      closeBroadcastModal();
      await loadBroadcasts();
    } else {
      showToast(data.message || "Gagal.", true);
    }
  } catch (e) {
    showToast("Server error.", true);
  }
}

async function handleDeleteBroadcast(id, title) {
  if (!confirm(`Hapus broadcast "${title}"?`)) return;
  try {
    const res = await fetch(`/api/broadcasts/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      showToast("Broadcast dihapus.");
      await loadBroadcasts();
    } else {
      showToast("Gagal menghapus.", true);
    }
  } catch (e) {
    showToast("Server error.", true);
  }
}

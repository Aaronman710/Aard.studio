// ============================================
// APP LOGIC
// ============================================

const SCOPES = "playlist-modify-public playlist-modify-private user-read-private";

const els = {
  loginBtn: document.getElementById("loginBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  authSection: document.getElementById("authSection"),
  appSection: document.getElementById("appSection"),
  meName: document.getElementById("meName"),
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  trackList: document.getElementById("trackList"),
  trackCount: document.getElementById("trackCount"),
  errorBox: document.getElementById("errorBox"),
  partyName: document.getElementById("partyName"),
  lastAdded: document.getElementById("lastAdded"),
  vinyl: document.getElementById("vinyl"),
  vinylArt: document.getElementById("vinylArt"),
};

let pollTimer = null;
let knownTrackIds = new Set();
let isFirstLoad = true;

els.partyName.textContent = CONFIG.PARTY_NAME;

// ---------- PKCE helpers ----------

function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) result += chars[values[i] % chars.length];
  return result;
}

async function sha256(plain) {
  const data = new TextEncoder().encode(plain);
  return crypto.subtle.digest("SHA-256", data);
}

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function redirectToSpotifyLogin() {
  const verifier = randomString(64);
  sessionStorage.setItem("pkce_verifier", verifier);

  const challenge = base64UrlEncode(await sha256(verifier));

  const params = new URLSearchParams({
    client_id: CONFIG.CLIENT_ID,
    response_type: "code",
    redirect_uri: CONFIG.REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });

  window.location.href = "https://accounts.spotify.com/authorize?" + params.toString();
}

async function exchangeCodeForToken(code) {
  const verifier = sessionStorage.getItem("pkce_verifier");
  const body = new URLSearchParams({
    client_id: CONFIG.CLIENT_ID,
    grant_type: "authorization_code",
    code,
    redirect_uri: CONFIG.REDIRECT_URI,
    code_verifier: verifier,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) throw new Error("Échange du code impossible");
  return res.json();
}

async function refreshAccessToken() {
  const refreshToken = sessionStorage.getItem("refresh_token");
  if (!refreshToken) return null;

  const body = new URLSearchParams({
    client_id: CONFIG.CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return null;
  const data = await res.json();
  storeToken(data);
  return data.access_token;
}

function storeToken(data) {
  sessionStorage.setItem("access_token", data.access_token);
  sessionStorage.setItem("token_expires_at", String(Date.now() + (data.expires_in - 60) * 1000));
  if (data.refresh_token) sessionStorage.setItem("refresh_token", data.refresh_token);
}

async function getValidAccessToken() {
  const expiresAt = Number(sessionStorage.getItem("token_expires_at") || 0);
  if (Date.now() < expiresAt) return sessionStorage.getItem("access_token");
  return refreshAccessToken();
}

// ---------- Spotify API ----------

async function spotifyFetch(path, options = {}) {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Session expirée, reconnecte-toi.");

  const res = await fetch("https://api.spotify.com/v1" + path, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) throw new Error("Session expirée, reconnecte-toi.");
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("Erreur Spotify (" + res.status + ") " + text.slice(0, 140));
  }
  if (res.status === 204) return null;
  return res.json();
}

async function fetchMe() {
  return spotifyFetch("/me");
}

async function searchTracks(query) {
  const params = new URLSearchParams({ q: query, type: "track", limit: "8" });
  const data = await spotifyFetch("/search?" + params.toString());
  return data.tracks.items;
}

async function addTrackToPlaylist(uri) {
  return spotifyFetch(`/playlists/${CONFIG.PLAYLIST_ID}/tracks`, {
    method: "POST",
    body: JSON.stringify({ uris: [uri] }),
  });
}

async function fetchPlaylistTracks() {
  let items = [];
  let url = `/playlists/${CONFIG.PLAYLIST_ID}/tracks?limit=50&fields=items(added_by.id,track(id,uri,name,artists,album)),next`;
  while (url) {
    const data = await spotifyFetch(url.startsWith("http") ? url.replace("https://api.spotify.com/v1", "") : url);
    items = items.concat(data.items);
    url = data.next;
  }
  return items.reverse(); // most recently added first
}

// ---------- UI rendering ----------

function showError(message) {
  els.errorBox.textContent = message;
  els.errorBox.hidden = false;
}

function clearError() {
  els.errorBox.hidden = true;
}

function trackRowHTML(track, { addedBy, showAddButton, alreadyAdded } = {}) {
  const art = track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || "";
  const artists = track.artists.map((a) => a.name).join(", ");
  return `
    <li class="track-row" data-uri="${track.uri}">
      <img src="${art}" alt="">
      <div class="track-info">
        <div class="track-name">${escapeHtml(track.name)}</div>
        <div class="track-artist">${escapeHtml(artists)}</div>
        ${addedBy ? `<div class="track-added-by">ajouté par ${escapeHtml(addedBy)}</div>` : ""}
      </div>
      ${showAddButton ? `<button class="add-btn" ${alreadyAdded ? "disabled" : ""}>${alreadyAdded ? "✓" : "+"}</button>` : ""}
    </li>
  `;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function renderSearchResults(tracks, currentIds) {
  els.searchResults.innerHTML = tracks
    .map((t) => trackRowHTML(t, { showAddButton: true, alreadyAdded: currentIds.has(t.id) }))
    .join("");
}

function renderPlaylist(items, userCache) {
  els.trackCount.textContent = items.length;
  els.trackList.innerHTML = items
    .map((it) => {
      const name = userCache[it.added_by?.id] || "quelqu'un";
      return trackRowHTML(it.track, { addedBy: name, showAddButton: false });
    })
    .join("");
}

function launchConfetti() {
  const colors = ["#FF5D8F", "#FFC857", "#3FD68C", "#8FA8FF"];
  const layer = document.getElementById("confettiLayer");
  for (let i = 0; i < 26; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), 3200);
  }
}

// cache d'affichage des noms d'utilisateurs Spotify (id -> display name)
const userNameCache = JSON.parse(localStorage.getItem("user_name_cache") || "{}");

async function resolveUserName(id) {
  if (!id) return "quelqu'un";
  if (userNameCache[id]) return userNameCache[id];
  try {
    const data = await spotifyFetch("/users/" + id);
    userNameCache[id] = data.display_name || "un invité";
  } catch {
    userNameCache[id] = "un invité";
  }
  localStorage.setItem("user_name_cache", JSON.stringify(userNameCache));
  return userNameCache[id];
}

async function buildUserCache(items) {
  const ids = [...new Set(items.map((it) => it.added_by?.id).filter(Boolean))];
  await Promise.all(ids.map(resolveUserName));
  return userNameCache;
}

// ---------- Main flows ----------

async function refreshPlaylist({ announceNew } = {}) {
  try {
    const items = await fetchPlaylistTracks();
    const cache = await buildUserCache(items);
    renderPlaylist(items, cache);

    const ids = new Set(items.map((it) => it.track.id));

    if (announceNew && !isFirstLoad) {
      const newOnes = items.filter((it) => !knownTrackIds.has(it.track.id));
      if (newOnes.length > 0) {
        const latest = newOnes[0];
        const who = cache[latest.added_by?.id] || "quelqu'un";
        els.lastAdded.textContent = `${who} vient d'ajouter « ${latest.track.name} »`;
        els.vinylArt.src = latest.track.album?.images?.[2]?.url || "";
        launchConfetti();
      }
    }

    knownTrackIds = ids;
    isFirstLoad = false;

    // refresh search button states if a search is showing
    if (els.searchInput.value.trim().length > 1) {
      const tracks = await searchTracks(els.searchInput.value.trim());
      renderSearchResults(tracks, ids);
    }

    clearError();
  } catch (err) {
    showError(err.message);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => refreshPlaylist({ announceNew: true }), CONFIG.POLL_INTERVAL_MS);
}

let searchDebounce = null;
els.searchInput.addEventListener("input", () => {
  clearTimeout(searchDebounce);
  const query = els.searchInput.value.trim();
  if (query.length < 2) {
    els.searchResults.innerHTML = "";
    return;
  }
  searchDebounce = setTimeout(async () => {
    try {
      const tracks = await searchTracks(query);
      renderSearchResults(tracks, knownTrackIds);
      clearError();
    } catch (err) {
      showError(err.message);
    }
  }, 350);
});

els.searchResults.addEventListener("click", async (e) => {
  const btn = e.target.closest(".add-btn");
  if (!btn || btn.disabled) return;
  const row = btn.closest(".track-row");
  const uri = row.dataset.uri;

  btn.disabled = true;
  btn.textContent = "…";
  try {
    await addTrackToPlaylist(uri);
    btn.textContent = "✓";
    launchConfetti();
    await refreshPlaylist();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "+";
    showError(err.message);
  }
});

els.loginBtn.addEventListener("click", redirectToSpotifyLogin);

els.logoutBtn.addEventListener("click", () => {
  sessionStorage.clear();
  if (pollTimer) clearInterval(pollTimer);
  els.appSection.hidden = true;
  els.authSection.hidden = false;
  window.history.replaceState({}, "", CONFIG.REDIRECT_URI);
});

async function showApp() {
  try {
    const me = await fetchMe();
    els.meName.textContent = "Connecté·e en tant que " + (me.display_name || me.id);
    els.authSection.hidden = true;
    els.appSection.hidden = false;
    await refreshPlaylist();
    startPolling();
  } catch (err) {
    showError(err.message);
    sessionStorage.clear();
  }
}

// ---------- Boot ----------

async function boot() {
  if (CONFIG.CLIENT_ID.includes("COLLE_") || CONFIG.PLAYLIST_ID.includes("COLLE_")) {
    showError("⚠️ Configuration manquante : ouvre config.js et renseigne CLIENT_ID et PLAYLIST_ID.");
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");

  if (error) {
    showError("Connexion Spotify refusée ou échouée.");
    return;
  }

  if (code) {
    try {
      const data = await exchangeCodeForToken(code);
      storeToken(data);
      window.history.replaceState({}, "", CONFIG.REDIRECT_URI);
      await showApp();
    } catch (err) {
      showError(err.message);
    }
    return;
  }

  const existingToken = sessionStorage.getItem("access_token");
  if (existingToken) {
    await showApp();
  }
}

boot();

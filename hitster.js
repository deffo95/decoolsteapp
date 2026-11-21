// Hitster-achtig muziekspel: speelt een nummer via Spotify, met een knop om titel, artiest en jaar te onthullen.
// Werkt via de Spotify Web API: de app stuurt de Spotify-app op je telefoon aan (Spotify Premium nodig).

// Client ID van de Spotify developer app (geen geheim; zie de uitleg in hitster-README.md)
const SPOTIFY_CLIENT_ID = "060c55a989f640d8a0c219a41d4a3724";
const SCOPES = "user-modify-playback-state user-read-playback-state";
// Moet exact overeenkomen met de Redirect URI in het Spotify-dashboard
// (https://app.decoolstejongens.nl/hitster.html)
const REDIRECT_URI = new URL("./hitster.html", location.href).href;

const TOKEN_KEY = "hitster-spotify-token";
const VERIFIER_KEY = "hitster-pkce-verifier";
const STATE_KEY = "hitster-pkce-state";
const GAME_KEY = "hitster-game";

const $ = id => document.getElementById(id);
const els = {
  setup: $("hitster-setup"),
  connect: $("hitster-connect"),
  connectBtn: $("connect-button"),
  game: $("hitster-game"),
  progress: $("hitster-progress"),
  record: $("record"),
  recordLabel: $("record-label"),
  card: $("song-card"),
  cardYear: $("card-year"),
  cardTitle: $("card-title"),
  cardArtist: $("card-artist"),
  mainBtn: $("main-button"),
  pauseBtn: $("pause-button"),
  replayBtn: $("replay-button"),
  status: $("hitster-status"),
  statusText: $("hitster-status-text"),
  openSpotify: $("open-spotify"),
  retryBtn: $("retry-button"),
  reshuffleBtn: $("reshuffle-button"),
  logoutBtn: $("logout-button")
};

let songs = [];          // [{ id, title, artist, year }]
let game = loadGame();   // { played: [ids], current: id|null, revealed: bool }
let paused = false;
let busy = false;
let pendingRetry = null; // actie om opnieuw te proberen als de gebruiker terugkomt uit Spotify

/* ---------- Opslag ---------- */

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function loadGame() {
  const g = readJSON(GAME_KEY, null);
  return g && Array.isArray(g.played) ? g : { played: [], current: null, revealed: false };
}

function saveGame() { writeJSON(GAME_KEY, game); }

/* ---------- Spotify-inloggen (PKCE, zonder geheime sleutel) ---------- */

function base64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, v => chars[v % chars.length]).join("");
}

async function login() {
  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = base64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  try {
    localStorage.setItem(VERIFIER_KEY, verifier);
    localStorage.setItem(STATE_KEY, state);
  } catch {}

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state
  });
  location.assign(`https://accounts.spotify.com/authorize?${params}`);
}

// Terugkomst van Spotify na inloggen: code inwisselen voor tokens
async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  if (!params.has("code") && !params.has("error")) return;
  history.replaceState(null, "", location.pathname);

  if (params.has("error")) {
    showStatus(params.get("error") === "access_denied"
      ? "Inloggen geannuleerd."
      : `Inloggen bij Spotify mislukt (${params.get("error")}).`);
    return;
  }

  const verifier = localStorage.getItem(VERIFIER_KEY);
  const expectedState = localStorage.getItem(STATE_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  localStorage.removeItem(STATE_KEY);
  if (!verifier || params.get("state") !== expectedState) {
    showStatus("Inloggen is niet afgerond. Probeer het nog eens vanuit de app.");
    return;
  }

  await requestToken({
    grant_type: "authorization_code",
    code: params.get("code"),
    redirect_uri: REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: verifier
  });
}

async function requestToken(body) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body)
  });
  if (!res.ok) throw new Error(`Token: HTTP ${res.status}`);
  const data = await res.json();
  const previous = readJSON(TOKEN_KEY, {});
  writeJSON(TOKEN_KEY, {
    access_token: data.access_token,
    refresh_token: data.refresh_token || previous.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000
  });
}

async function accessToken() {
  const token = readJSON(TOKEN_KEY, null);
  if (!token) return null;
  if (Date.now() < token.expires_at - 60_000) return token.access_token;
  try {
    await requestToken({ grant_type: "refresh_token", refresh_token: token.refresh_token, client_id: SPOTIFY_CLIENT_ID });
    return readJSON(TOKEN_KEY, null)?.access_token ?? null;
  } catch {
    logout();
    return null;
  }
}

function logout() {
  try { localStorage.removeItem(TOKEN_KEY); } catch {}
  render();
}

/* ---------- Spotify Web API ---------- */

async function spotify(method, path, body) {
  const token = await accessToken();
  if (!token) throw Object.assign(new Error("Niet ingelogd"), { code: "auth" });
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    logout();
    throw Object.assign(new Error("Sessie verlopen"), { code: "auth" });
  }
  return res;
}

async function pickDevice() {
  const res = await spotify("GET", "/me/player/devices");
  if (!res.ok) return null;
  const { devices = [] } = await res.json();
  const usable = devices.filter(d => !d.is_restricted);
  return usable.find(d => d.is_active) || usable.find(d => d.type === "Smartphone") || usable[0] || null;
}

// Geeft "ok", "no-device", "premium", "bad-track" of "error" terug
async function playTrack(id) {
  const device = await pickDevice();
  if (!device) return "no-device";
  const res = await spotify("PUT", `/me/player/play?device_id=${encodeURIComponent(device.id)}`, {
    uris: [`spotify:track:${id}`],
    position_ms: 0
  });
  if (res.ok) return "ok";
  if (res.status === 404) return "no-device";
  if (res.status === 403) return "premium";
  if (res.status === 400) return "bad-track";
  return "error";
}

/* ---------- Spel ---------- */

function currentSong() {
  return songs.find(s => s.id === game.current) || null;
}

function pickNextSong() {
  const played = new Set(game.played);
  let pool = songs.filter(s => !played.has(s.id));
  if (!pool.length) {
    // alles gehad: opnieuw beginnen
    game.played = [];
    pool = songs;
  }
  const r = crypto.getRandomValues(new Uint32Array(1))[0] % pool.length;
  return pool[r];
}

async function startNext() {
  const song = pickNextSong();
  game.current = song.id;
  game.revealed = false;
  if (!game.played.includes(song.id)) game.played.push(song.id);
  saveGame();
  render();
  await play(song.id);
}

async function play(id, attempt = 0) {
  hideStatus();
  setBusy(true);
  try {
    const result = await playTrack(id);
    if (result === "ok") {
      paused = false;
      render();
      return;
    }
    if (result === "bad-track" && attempt < 3) {
      // nummer niet (meer) beschikbaar op Spotify: stil doorgaan met het volgende
      const next = pickNextSong();
      game.current = next.id;
      if (!game.played.includes(next.id)) game.played.push(next.id);
      saveGame();
      render();
      return play(next.id, attempt + 1);
    }
    paused = true;
    render();
    if (result === "no-device") {
      pendingRetry = () => play(id);
      showStatus("Spotify staat niet aan op je telefoon. Open de Spotify-app, wacht even en kom terug.", { spotify: true, retry: true });
    } else if (result === "premium") {
      showStatus("Spotify weigert het afspelen. Hiervoor is Spotify Premium nodig.");
    } else {
      pendingRetry = () => play(id);
      showStatus("Afspelen mislukt. Probeer het opnieuw.", { retry: true });
    }
  } catch (err) {
    if (err.code !== "auth") {
      pendingRetry = () => play(id);
      showStatus("Geen verbinding met Spotify. Controleer je internet.", { retry: true });
    }
  } finally {
    setBusy(false);
  }
}

async function togglePause() {
  if (!game.current) return;
  setBusy(true);
  try {
    if (paused) {
      const res = await spotify("PUT", "/me/player/play");
      if (res.ok) paused = false;
      else return play(game.current); // geen actief apparaat meer: nummer opnieuw starten
    } else {
      const res = await spotify("PUT", "/me/player/pause");
      if (res.ok || res.status === 404) paused = true;
    }
  } catch {
    showStatus("Geen verbinding met Spotify.", { retry: false });
  } finally {
    setBusy(false);
    render();
  }
}

function reveal() {
  game.revealed = true;
  saveGame();
  render();
  if (navigator.vibrate) navigator.vibrate(20);
}

function onMainButton() {
  if (busy) return;
  if (!game.current) return startNext();
  if (!game.revealed) return reveal();
  return startNext();
}

/* ---------- Weergave ---------- */

// "Insomnia - Radio Edit" → "Insomnia", "Africa (Remastered 2011)" → "Africa"
function cleanTitle(title) {
  return title
    .replace(/\s+-\s+(\d{4}\s+)?(digital(ly)?\s+)?remaster(ed)?(\s+\d{4})?(\s+version)?$/i, "")
    .replace(/\s+-\s+(radio|single)\s+(edit|version|mix)$/i, "")
    .replace(/\s*[(\[](\d{4}\s+)?(digital(ly)?\s+)?remaster(ed)?(\s+\d{4})?(\s+version)?[)\]]/i, "")
    .trim();
}

function render() {
  const hasClientId = !!SPOTIFY_CLIENT_ID;
  const loggedIn = !!readJSON(TOKEN_KEY, null);

  els.setup.hidden = hasClientId;
  els.connect.hidden = !hasClientId || loggedIn;
  els.game.hidden = !hasClientId || !loggedIn;
  if (els.game.hidden) return;

  const song = currentSong();
  const playing = !!song && !paused;

  els.progress.textContent = songs.length
    ? `Nummer ${Math.max(game.played.length, song ? 1 : 0)} van ${songs.length}`
    : "Nummers laden…";

  els.record.classList.toggle("is-spinning", playing);
  els.record.classList.toggle("is-revealed", !!song && game.revealed);
  els.recordLabel.textContent = song && game.revealed ? song.year : "?";

  els.card.hidden = !(song && game.revealed);
  if (song && game.revealed) {
    els.cardYear.textContent = song.year;
    els.cardTitle.textContent = cleanTitle(song.title);
    els.cardArtist.textContent = song.artist;
  }

  els.mainBtn.textContent = !song ? "▶️ Start" : !game.revealed ? "👀 Onthul" : "⏭ Volgend nummer";
  els.mainBtn.disabled = busy || !songs.length;
  els.pauseBtn.hidden = !song;
  els.replayBtn.hidden = !song;
  els.pauseBtn.textContent = paused ? "▶️ Verder" : "⏸ Pauze";
  els.pauseBtn.disabled = busy;
  els.replayBtn.disabled = busy;
}

function setBusy(value) {
  busy = value;
  els.game.classList.toggle("is-busy", value);
  render();
}

function showStatus(text, { spotify = false, retry = false } = {}) {
  els.statusText.textContent = text;
  els.openSpotify.hidden = !spotify;
  els.retryBtn.hidden = !retry;
  els.status.hidden = false;
}

function hideStatus() {
  els.status.hidden = true;
  pendingRetry = null;
}

/* ---------- Start ---------- */

async function loadSongs() {
  const res = await fetch("./hitster-songs.json");
  const data = await res.json();
  songs = data.songs.map(([id, title, artist, year]) => ({ id, title, artist, year }));
  // Nummers die niet meer in de lijst staan vergeten
  const ids = new Set(songs.map(s => s.id));
  game.played = game.played.filter(id => ids.has(id));
  if (game.current && !ids.has(game.current)) game.current = null;
  saveGame();
}

els.connectBtn.addEventListener("click", login);
els.mainBtn.addEventListener("click", onMainButton);
els.pauseBtn.addEventListener("click", togglePause);
els.replayBtn.addEventListener("click", () => game.current && play(game.current));
els.retryBtn.addEventListener("click", () => pendingRetry && pendingRetry());
els.logoutBtn.addEventListener("click", () => {
  if (confirm("Uitloggen bij Spotify?")) logout();
});
els.reshuffleBtn.addEventListener("click", () => {
  if (!confirm("Opnieuw beginnen? Alle nummers kunnen dan weer voorbijkomen.")) return;
  game = { played: [], current: null, revealed: false };
  saveGame();
  hideStatus();
  render();
});

// Terug uit de Spotify-app: automatisch opnieuw proberen
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && pendingRetry && !els.status.hidden) {
    setTimeout(() => pendingRetry && pendingRetry(), 800);
  }
});

(async () => {
  render();
  try {
    await handleRedirect();
  } catch {
    showStatus("Inloggen bij Spotify mislukt. Probeer het nog eens.");
  }
  try {
    await loadSongs();
  } catch {
    showStatus("De nummerlijst kon niet geladen worden.");
  }
  paused = true; // na herladen weten we niet of Spotify nog speelt
  render();
})();

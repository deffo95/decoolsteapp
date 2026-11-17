// Pushmeldingen op de dag van een agendapunt, op een zelfgekozen tijdstip.
// De meldingen worden verstuurd door de push-worker (zie push-worker/README.md).

// Adres van de gedeployde push-worker, bijv. "https://coolsteapp-push.<jouw-naam>.workers.dev".
// Zolang dit leeg is, wordt het meldingen-blok niet getoond.
const PUSH_SERVER_URL = "";

const NOTIFY_TIME_KEY = "notify-time";
const DEFAULT_NOTIFY_TIME = "09:00";

(function setupNotifications() {
  const card = document.getElementById("notify-card");
  if (!card || !PUSH_SERVER_URL) return;
  card.hidden = false;

  const toggle = document.getElementById("notify-toggle");
  const timeRow = document.getElementById("notify-time-row");
  const timeInput = document.getElementById("notify-time");
  const testBtn = document.getElementById("notify-test");
  const status = document.getElementById("notify-status");
  const hint = document.getElementById("notify-hint");

  timeInput.value = storedTime();

  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    toggle.disabled = true;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    showHint(isIOS && !standalone
      ? "Zet de app eerst op je beginscherm (Deel → Zet op beginscherm) en open hem daarvandaan om meldingen te krijgen."
      : "Deze browser ondersteunt geen pushmeldingen.");
    return;
  }

  init();

  async function init() {
    const sub = await currentSubscription();
    const on = !!sub && Notification.permission === "granted";
    render(on);
    if (on) saveOnServer(sub).catch(() => {}); // stil bijwerken, voor het geval de server hem kwijt is
  }

  toggle.addEventListener("change", async () => {
    showHint("");
    if (toggle.checked) {
      // Toestemming direct in de klik vragen (vereist door iOS)
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toggle.checked = false;
        return showHint("Meldingen zijn geblokkeerd. Sta ze toe in de instellingen van je telefoon.");
      }
      busy(true);
      try {
        const sub = await subscribe();
        await saveOnServer(sub);
        render(true);
      } catch (err) {
        toggle.checked = false;
        render(false);
        showHint("Aanzetten mislukt. Probeer het later nog eens.");
        console.error(err);
      } finally {
        busy(false);
      }
    } else {
      busy(true);
      try {
        const sub = await currentSubscription();
        if (sub) {
          await post("/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
          await sub.unsubscribe();
        }
      } finally {
        render(false);
        busy(false);
      }
    }
  });

  timeInput.addEventListener("change", async () => {
    if (!timeInput.value) timeInput.value = storedTime();
    try { localStorage.setItem(NOTIFY_TIME_KEY, timeInput.value); } catch {}
    const sub = await currentSubscription();
    if (!sub) return;
    try {
      await saveOnServer(sub);
      render(true);
      flash(`Opgeslagen: je krijgt meldingen om ${timeInput.value}.`);
    } catch {
      showHint("Tijd opslaan mislukt. Probeer het later nog eens.");
    }
  });

  testBtn.addEventListener("click", async () => {
    const sub = await currentSubscription();
    if (!sub) return;
    testBtn.disabled = true;
    try {
      const res = await post("/test", { endpoint: sub.endpoint });
      flash(res.ok ? "Testmelding verstuurd 📨" : "Testmelding mislukt.");
    } finally {
      testBtn.disabled = false;
    }
  });

  async function currentSubscription() {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function subscribe() {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) return existing;
    const { publicKey } = await (await fetch(`${PUSH_SERVER_URL}/vapid-public-key`)).json();
    return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
  }

  async function saveOnServer(sub) {
    const res = await post("/subscribe", {
      subscription: sub.toJSON(),
      time: timeInput.value || DEFAULT_NOTIFY_TIME,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  function post(path, body) {
    return fetch(PUSH_SERVER_URL + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function render(on) {
    toggle.checked = on;
    timeRow.hidden = !on;
    status.textContent = on
      ? `Aan · melding om ${timeInput.value} op de dag zelf`
      : "Krijg een melding op de dag van een activiteit.";
  }

  function busy(isBusy) {
    toggle.disabled = isBusy;
    card.classList.toggle("is-busy", isBusy);
  }

  function showHint(text) {
    hint.textContent = text;
    hint.hidden = !text;
  }

  let flashTimer;
  function flash(text) {
    showHint(text);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => showHint(""), 3000);
  }

  function storedTime() {
    try { return localStorage.getItem(NOTIFY_TIME_KEY) || DEFAULT_NOTIFY_TIME; }
    catch { return DEFAULT_NOTIFY_TIME; }
  }

  function base64UrlToBytes(str) {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  }
})();

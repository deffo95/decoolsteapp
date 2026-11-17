// Gedeelde agenda-logica voor index.html (volgende activiteit) en agenda.html (lijst).
// Snelheid: de laatst opgehaalde agenda wordt lokaal bewaard en direct getoond,
// daarna wordt op de achtergrond de verse versie opgehaald.

const PROXY_URL = "https://winter-rice-f921.kthnmj5r86.workers.dev";
const AGENDA_CACHE_KEY = "agenda-cache-v1";
const FETCH_TIMEOUT_MS = 10000;

// Houd deze lijst gelijk aan die in push-worker/src/index.js
const birthdays = [
  { name: "Bart", month: 3, day: 13 },
  { name: "Davey", month: 1, day: 8 },
  { name: "Jessy", month: 7, day: 4 },
  { name: "Geus", month: 3, day: 12 },
  { name: "Kevin", month: 6, day: 13 },
  { name: "Koen", month: 1, day: 10 },
  { name: "Martin", month: 10, day: 3 },
  { name: "Robbie", month: 7, day: 8 },
  { name: "Coolste jongens", month: 7, day: 6 }
];

function parseICS(text) {
  // Regels die met een spatie/tab beginnen horen bij de vorige regel (ICS line folding)
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events = [];
  let event = null;

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) {
      event = {};
    } else if (!event) {
      continue;
    } else if (line.startsWith("SUMMARY")) {
      event.summary = unescapeICS(valueOf(line));
    } else if (line.startsWith("DTSTART")) {
      event.start = parseICSDate(line);
    } else if (line.startsWith("LOCATION")) {
      event.location = unescapeICS(valueOf(line));
    } else if (line.startsWith("END:VEVENT")) {
      if (event.start) events.push(event);
      event = null;
    }
  }

  return events;
}

function valueOf(line) {
  return line.substring(line.indexOf(":") + 1).trim();
}

function unescapeICS(value) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1");
}

function parseICSDate(line) {
  const raw = valueOf(line);
  const p = raw.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?/);
  if (!p) return null;

  const [, y, m, d, h = "00", min = "00", s = "00", utc] = p;
  if (utc) return new Date(Date.UTC(+y, m - 1, +d, +h, +min, +s));
  return new Date(+y, m - 1, +d, +h, +min, +s);
}

function birthdayEvents(now) {
  return birthdays.map(b => {
    let date = new Date(now.getFullYear(), b.month - 1, b.day);
    // als verjaardag dit jaar al geweest is → volgend jaar
    if (date < now) date = new Date(now.getFullYear() + 1, b.month - 1, b.day);
    return { summary: `Verjaardag van ${b.name}`, start: date, location: "🎉" };
  });
}

// Combineer agenda-items met verjaardagen, alleen toekomstige, gesorteerd.
function buildAgenda(calendarEvents) {
  const now = new Date();
  return [...calendarEvents.filter(ev => ev.start >= now), ...birthdayEvents(now)]
    .sort((a, b) => a.start - b.start);
}

function readCachedEvents() {
  try {
    const raw = localStorage.getItem(AGENDA_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).events.map(ev => ({ ...ev, start: new Date(ev.start) }));
  } catch {
    return null;
  }
}

function writeCachedEvents(events) {
  try {
    // Alleen toekomstige items bewaren: klein en snel te lezen
    const now = new Date();
    const upcoming = events.filter(ev => ev.start >= now);
    localStorage.setItem(AGENDA_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      events: upcoming.map(ev => ({ ...ev, start: ev.start.toISOString() }))
    }));
  } catch {
    // opslag vol of geblokkeerd: niet erg, dan alleen geen snelle start
  }
}

async function fetchCalendarEvents() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(PROXY_URL, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseICS(await res.text());
  } finally {
    clearTimeout(timer);
  }
}

// Roept onUpdate(agenda) direct aan met de lokale kopie (als die er is),
// en nogmaals zodra de verse agenda binnen is. onError alleen als er niets te tonen is.
async function loadAgenda(onUpdate, onError) {
  const cached = readCachedEvents();
  if (cached) onUpdate(buildAgenda(cached));

  try {
    const fresh = await fetchCalendarEvents();
    writeCachedEvents(fresh);
    onUpdate(buildAgenda(fresh));
  } catch {
    if (!cached) onError("Kon agenda niet laden.");
  }
}

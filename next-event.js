const PROXY_URL = "https://winter-rice-f921.kthnmj5r86.workers.dev";

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

async function loadNextEvent() {
  try {
    const res = await fetch(PROXY_URL);
    const text = await res.text();
    const events = parseICS(text);

    const now = new Date();
    const upcoming = events.filter(ev => ev.start >= now);

    const birthdayEvents = birthdays.map(b => {
      const year = now.getFullYear();
      return {
        summary: `Verjaardag van ${b.name}`,
        start: new Date(year, b.month - 1, b.day, 0, 0),
        location: "🎉"
      };
    });

    const allEvents = [...upcoming, ...birthdayEvents];

    const next = allEvents.sort((a, b) => a.start - b.start)[0];

    renderNextEvent(next);

  } catch {
    setError("Kon agenda niet laden.");
  }
}

function parseICS(text) {
  const lines = text.split("\n");
  const events = [];
  let event = null;

  for (let line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) event = {};

    if (line.startsWith("SUMMARY:"))
      event.summary = line.replace("SUMMARY:", "").trim();

    if (line.startsWith("DTSTART"))
      event.start = parseICSDate(line);

    if (line.startsWith("LOCATION:"))
      event.location = line.replace("LOCATION:", "").trim();

    if (line.startsWith("END:VEVENT"))
      events.push(event);
  }

  return events;
}

function parseICSDate(line) {
  let raw = line.split(":")[1].trim();

  if (raw.endsWith("Z")) return new Date(raw);

  if (line.includes("TZID=")) {
    const p = raw.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
    return new Date(`${p[1]}-${p[2]}-${p[3]}T${p[4] || "00"}:${p[5] || "00"}`);
  }

  if (raw.includes("T")) {
    const y = raw.substring(0, 4);
    const m = raw.substring(4, 6);
    const d = raw.substring(6, 8);
    const h = raw.substring(9, 11);
    const min = raw.substring(11, 13);
    return new Date(`${y}-${m}-${d}T${h}:${min}`);
  }

  if (raw.length === 8) {
    const y = raw.substring(0, 4);
    const m = raw.substring(4, 6);
    const d = raw.substring(6, 8);
    return new Date(`${y}-${m}-${d}T00:00`);
  }

  return new Date();
}

function renderNextEvent(ev) {
  document.getElementById("next-title").textContent = ev.summary;
  document.getElementById("next-date").textContent =
    `${ev.start.toLocaleDateString("nl-NL")}`;
  document.getElementById("next-location").textContent =
    ev.location || "Onbekende locatie";
}

function setError(msg) {
  document.getElementById("next-title").textContent = msg;
  document.getElementById("next-date").textContent = "";
  document.getElementById("next-location").textContent = "";
}

loadNextEvent();

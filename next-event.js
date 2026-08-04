// Jouw Cloudflare Worker URL
const PROXY_URL = "https://winter-rice-f921.kthnmj5r86.workers.dev";

async function loadNextEvent() {
  try {
    const res = await fetch(PROXY_URL);

    if (!res.ok) {
      setError("Kon agenda niet laden (proxy-fout).");
      return;
    }

    const text = await res.text();
    const events = parseICS(text);

    const now = new Date();
    const upcoming = events.filter(ev => ev.start > now);

    if (upcoming.length === 0) {
      setError("Geen aankomende activiteiten.");
      return;
    }

    const next = upcoming.sort((a, b) => a.start - b.start)[0];
    renderNextEvent(next);

  } catch (err) {
    setError("Kon agenda niet laden (netwerkfout).");
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

    if (line.startsWith("DTEND"))
      event.end = parseICSDate(line);

    if (line.startsWith("LOCATION:"))
      event.location = line.replace("LOCATION:", "").trim();

    if (line.startsWith("END:VEVENT"))
      events.push(event);
  }

  return events;
}

function parseICSDate(line) {
  const raw = line.split(":")[1].trim();

  // Formaat 1: 20250215T130000Z (UTC)
  if (raw.includes("T") && raw.endsWith("Z")) {
    return new Date(raw);
  }

  // Formaat 2: 20250215T130000 (lokale tijd)
  if (raw.includes("T")) {
    const year = raw.substring(0, 4);
    const month = raw.substring(4, 6);
    const day = raw.substring(6, 8);
    const hour = raw.substring(9, 11);
    const min = raw.substring(11, 13);
    return new Date(`${year}-${month}-${day}T${hour}:${min}`);
  }

  // Formaat 3: 20250215 (hele dag)
  if (raw.length === 8) {
    const year = raw.substring(0, 4);
    const month = raw.substring(4, 6);
    const day = raw.substring(6, 8);
    return new Date(`${year}-${month}-${day}T00:00`);
  }

  return new Date();
}

function renderNextEvent(ev) {
  document.getElementById("next-title").textContent = ev.summary;
  document.getElementById("next-date").textContent =
    `${ev.start.toLocaleDateString("nl-NL")} ` +
    `${ev.start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;

  document.getElementById("next-location").textContent =
    ev.location || "Onbekende locatie";
}

function setError(msg) {
  document.getElementById("next-title").textContent = msg;
  document.getElementById("next-date").textContent = "";
  document.getElementById("next-location").textContent = "";
}

loadNextEvent();

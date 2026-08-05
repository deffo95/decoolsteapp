const PROXY_URL = "https://winter-rice-f921.kthnmj5r86.workers.dev";

async function loadNextEvent() {
  try {
    const res = await fetch(PROXY_URL);
    if (!res.ok) return setError("Kon agenda niet laden.");

    const text = await res.text();
    const events = parseICS(text);

    console.log("📦 Parsed events (home):", events);

    const now = new Date();
    const upcoming = events.filter(ev => ev.start >= now);

    console.log("⏭ Upcoming (home):", upcoming, "now =", now);

    if (upcoming.length === 0) return setError("Geen aankomende activiteiten.");

    const next = upcoming.sort((a, b) => a.start - b.start)[0];
    renderNextEvent(next);
  } catch (e) {
    console.error(e);
    setError("Netwerkfout.");
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
  let raw = line.split(":")[1].trim();

  if (raw.endsWith("Z")) {
    return new Date(raw);
  }

  if (line.includes("TZID=")) {
    const parts = raw.match(/(\d{4})(\d{2})(\d{2})T?(\d{2})?(\d{2})?/);
    if (!parts) return new Date();

    const year = parts[1];
    const month = parts[2];
    const day = parts[3];
    const hour = parts[4] || "00";
    const min = parts[5] || "00";

    return new Date(`${year}-${month}-${day}T${hour}:${min}`);
  }

  if (raw.includes("T")) {
    const year = raw.substring(0, 4);
    const month = raw.substring(4, 6);
    const day = raw.substring(6, 8);
    const hour = raw.substring(9, 11);
    const min = raw.substring(11, 13);

    return new Date(`${year}-${month}-${day}T${hour}:${min}`);
  }

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
    `${ev.start.toLocaleDateString("nl-NL")} ${ev.start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
  document.getElementById("next-location").textContent =
    ev.location || "Onbekende locatie";
}

function setError(msg) {
  document.getElementById("next-title").textContent = msg;
  document.getElementById("next-date").textContent = "";
  document.getElementById("next-location").textContent = "";
}

loadNextEvent();

// Toont de eerstvolgende activiteit op de homepagina (logica staat in calendar.js).

function renderNextEvent(events) {
  const ev = events[0];
  if (!ev) return setError("Geen komende activiteiten.");
  document.getElementById("next-title").textContent = ev.summary || "(zonder titel)";
  document.getElementById("next-date").textContent = ev.start.toLocaleDateString("nl-NL", {
    weekday: "long", day: "numeric", month: "long"
  });
  document.getElementById("next-location").textContent = ev.location || "Onbekende locatie";
  document.getElementById("next-countdown").textContent = countdownText(ev.start);
}

function countdownText(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const days = Math.round((day - today) / 86400000);
  if (days <= 0) return "🔥 Vandaag!";
  if (days === 1) return "⏳ Morgen";
  return `⏳ Nog ${days} dagen`;
}

function setError(msg) {
  document.getElementById("next-title").textContent = msg;
  document.getElementById("next-date").textContent = "";
  document.getElementById("next-location").textContent = "";
  document.getElementById("next-countdown").textContent = "";
}

loadAgenda(renderNextEvent, setError);

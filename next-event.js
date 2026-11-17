// Toont de eerstvolgende activiteit op de homepagina (logica staat in calendar.js).

function renderNextEvent(events) {
  const ev = events[0];
  if (!ev) return setError("Geen komende activiteiten.");
  document.getElementById("next-title").textContent = ev.summary || "(zonder titel)";
  document.getElementById("next-date").textContent = ev.start.toLocaleDateString("nl-NL");
  document.getElementById("next-location").textContent = ev.location || "Onbekende locatie";
}

function setError(msg) {
  document.getElementById("next-title").textContent = msg;
  document.getElementById("next-date").textContent = "";
  document.getElementById("next-location").textContent = "";
}

loadAgenda(renderNextEvent, setError);

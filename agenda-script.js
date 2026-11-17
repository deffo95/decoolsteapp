function renderAgenda(events) {
  const container = document.getElementById("agenda-list");
  const fragment = document.createDocumentFragment();

  for (const ev of events) {
    const card = document.createElement("div");
    card.className = "agenda-card";

    const title = document.createElement("div");
    title.className = "agenda-card-title";
    title.textContent = ev.summary || "(zonder titel)";

    card.append(
      title,
      agendaLine("📅", ev.start.toLocaleDateString("nl-NL")),
      agendaLine("📍", ev.location || "Onbekende locatie")
    );
    fragment.appendChild(card);
  }

  container.replaceChildren(fragment);
}

function agendaLine(icon, text) {
  const line = document.createElement("div");
  line.className = "agenda-line";
  const iconEl = document.createElement("span");
  iconEl.className = "icon";
  iconEl.textContent = icon;
  line.append(iconEl, " " + text);
  return line;
}

loadAgenda(renderAgenda, msg => {
  document.getElementById("agenda-list").textContent = msg;
});

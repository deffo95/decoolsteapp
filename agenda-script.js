function renderAgenda(events) {
  const container = document.getElementById("agenda-list");
  const fragment = document.createDocumentFragment();
  let currentMonth = null;

  if (!events.length) {
    container.textContent = "Geen komende activiteiten.";
    return;
  }

  for (const ev of events) {
    // Kopje per maand, bijv. "november 2026"
    const month = ev.start.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
    if (month !== currentMonth) {
      currentMonth = month;
      const heading = document.createElement("div");
      heading.className = "agenda-month";
      heading.textContent = month;
      fragment.appendChild(heading);
    }

    const card = document.createElement("div");
    card.className = "agenda-card agenda-item";
    if (ev.location === "🎉") card.classList.add("is-birthday");

    const tile = document.createElement("div");
    tile.className = "date-tile";
    tile.append(
      el("span", "day", ev.start.getDate()),
      el("span", "month", ev.start.toLocaleDateString("nl-NL", { month: "short" }).replace(".", ""))
    );

    const body = document.createElement("div");
    body.className = "agenda-item-body";
    body.append(
      el("div", "agenda-card-title", ev.summary || "(zonder titel)"),
      agendaLine("🕒", formatWhen(ev.start)),
      ev.location === "🎉"
        ? agendaLine("🎂", "Feestje!")
        : agendaLine("📍", ev.location || "Onbekende locatie")
    );

    card.append(tile, body);
    fragment.appendChild(card);
  }

  container.replaceChildren(fragment);
}

function formatWhen(date) {
  const day = date.toLocaleDateString("nl-NL", { weekday: "long" });
  const hasTime = date.getHours() || date.getMinutes();
  return hasTime
    ? `${day} · ${date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`
    : `${day} · hele dag`;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function agendaLine(icon, text) {
  const line = el("div", "agenda-line", "");
  line.append(el("span", "icon", icon), text);
  return line;
}

loadAgenda(renderAgenda, msg => {
  document.getElementById("agenda-list").textContent = msg;
});

// Cloudflare Worker die pushmeldingen stuurt op de dag van een agendapunt,
// op het tijdstip dat iedere gebruiker zelf in de app kiest.
//
// Routes (aangeroepen door de app):
//   GET  /vapid-public-key   publieke sleutel voor het aanmelden
//   POST /subscribe          { subscription, time: "08:00", timezone }
//   POST /unsubscribe        { endpoint }
//   POST /test               { endpoint }  → stuurt direct een testmelding
// Cron (elke 5 minuten): stuurt iedereen wiens tijdstip is aangebroken de activiteiten van vandaag.

import { sendPush } from "./webpush.js";

// Houd deze lijst gelijk aan die in calendar.js
const BIRTHDAYS = [
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

const DEFAULT_TZ = "Europe/Amsterdam";

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const { pathname } = new URL(request.url);
    try {
      if (request.method === "GET" && pathname === "/vapid-public-key") {
        return json({ publicKey: env.VAPID_PUBLIC_KEY });
      }

      if (request.method === "POST" && pathname === "/subscribe") {
        const { subscription, time, timezone } = await request.json();
        if (!isValidSubscription(subscription)) return json({ error: "Ongeldig abonnement" }, 400);
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || "")) return json({ error: "Ongeldige tijd" }, 400);
        const tz = isValidTimeZone(timezone) ? timezone : DEFAULT_TZ;

        const key = await subKey(subscription.endpoint);
        const existing = await env.SUBSCRIPTIONS.get(key, "json");
        const now = localNow(new Date(), tz);
        // Is het tijdstip vandaag al voorbij? Dan pas morgen de eerste melding (geen late melding achteraf).
        const lastSent = now.time >= time ? now.date : existing?.lastSent ?? null;

        await env.SUBSCRIPTIONS.put(key, JSON.stringify({ subscription, time, timezone: tz, lastSent }));
        return json({ ok: true });
      }

      if (request.method === "POST" && pathname === "/unsubscribe") {
        const { endpoint } = await request.json();
        if (typeof endpoint === "string") await env.SUBSCRIPTIONS.delete(await subKey(endpoint));
        return json({ ok: true });
      }

      if (request.method === "POST" && pathname === "/test") {
        const { endpoint } = await request.json();
        const record = typeof endpoint === "string" && await env.SUBSCRIPTIONS.get(await subKey(endpoint), "json");
        if (!record) return json({ error: "Niet aangemeld" }, 404);
        const res = await sendPush(record.subscription, {
          title: "De Coolste App 🎉",
          body: `Meldingen werken! Je krijgt ze op de dag zelf om ${record.time}.`,
          url: "./agenda.html"
        }, vapid(env));
        return json({ ok: res.ok, status: res.status }, res.ok ? 200 : 502);
      }

      return json({ error: "Niet gevonden" }, 404);
    } catch (err) {
      return json({ error: String(err?.message || err) }, 500);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendDueNotifications(env, new Date()));
  }
};

export async function sendDueNotifications(env, nowDate) {
  let calendar = null; // agenda pas ophalen als iemand een melding nodig heeft
  const getCalendar = async () => (calendar ??= await fetchCalendar(env.CALENDAR_URL));

  let cursor;
  do {
    const page = await env.SUBSCRIPTIONS.list({ prefix: "sub:", cursor });
    cursor = page.list_complete ? undefined : page.cursor;

    for (const { name } of page.keys) {
      const record = await env.SUBSCRIPTIONS.get(name, "json");
      if (!record) continue;

      const now = localNow(nowDate, record.timezone);
      if (record.lastSent === now.date || now.time < record.time) continue;

      const events = eventsOnDate(await getCalendar(), now.date, record.timezone);
      if (events.length) {
        const res = await sendPush(record.subscription, buildNotification(events), vapid(env));
        if (res.status === 404 || res.status === 410) {
          // Abonnement bestaat niet meer (app verwijderd of meldingen uitgezet)
          await env.SUBSCRIPTIONS.delete(name);
          continue;
        }
        if (!res.ok) continue; // tijdelijke fout: bij de volgende ronde opnieuw proberen
      }
      await env.SUBSCRIPTIONS.put(name, JSON.stringify({ ...record, lastSent: now.date }));
    }
  } while (cursor);
}

function vapid(env) {
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK),
    subject: env.VAPID_SUBJECT
  };
}

function isValidSubscription(s) {
  return s && typeof s.endpoint === "string" && s.endpoint.startsWith("https://") &&
    typeof s.keys?.p256dh === "string" && typeof s.keys?.auth === "string";
}

function isValidTimeZone(tz) {
  try { return typeof tz === "string" && !!new Intl.DateTimeFormat("en", { timeZone: tz }); }
  catch { return false; }
}

async function subKey(endpoint) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return "sub:" + [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Datum ("2026-11-20") en tijd ("08:05") in de tijdzone van de gebruiker
export function localNow(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

async function fetchCalendar(url) {
  const res = await fetch(url, { cf: { cacheTtl: 0 } });
  if (!res.ok) throw new Error(`Agenda ophalen mislukt: HTTP ${res.status}`);
  return parseICS(await res.text());
}

// Geeft per agendapunt de ruwe DTSTART terug; de dag wordt later per tijdzone bepaald
export function parseICS(text) {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const events = [];
  let ev = null;
  const value = line => line.substring(line.indexOf(":") + 1).trim();
  const unescape = v => v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");

  for (const line of lines) {
    if (line.startsWith("BEGIN:VEVENT")) ev = {};
    else if (!ev) continue;
    else if (line.startsWith("SUMMARY")) ev.summary = unescape(value(line));
    else if (line.startsWith("LOCATION")) ev.location = unescape(value(line));
    else if (line.startsWith("DTSTART")) ev.start = value(line);
    else if (line.startsWith("END:VEVENT")) { if (ev.start) events.push(ev); ev = null; }
  }
  return events;
}

// Agendapunten (en verjaardagen) die op `date` vallen, met tijd in de tijdzone van de gebruiker
export function eventsOnDate(calendar, date, timeZone) {
  const result = [];

  for (const ev of calendar) {
    const m = ev.start.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?(Z)?/);
    if (!m) continue;
    const [, y, mo, d, h, mi, s, utc] = m;
    let day, time;
    if (utc) {
      const local = localNow(new Date(Date.UTC(+y, mo - 1, +d, +h, +mi, +(s || 0))), timeZone);
      day = local.date; time = local.time;
    } else {
      day = `${y}-${mo}-${d}`;
      time = h ? `${h}:${mi}` : null;
    }
    if (day === date) result.push({ summary: ev.summary || "Activiteit", location: ev.location, time });
  }

  const [, month, dayOfMonth] = date.split("-").map(Number);
  for (const b of BIRTHDAYS) {
    if (b.month === month && b.day === dayOfMonth) {
      result.push({ summary: `Verjaardag van ${b.name}`, location: null, time: null, birthday: true });
    }
  }

  return result.sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

export function buildNotification(events) {
  const line = ev => {
    const icon = ev.birthday ? "🎂" : "📅";
    const extra = [ev.time, ev.location].filter(Boolean).join(" · ");
    return `${icon} ${ev.summary}${extra ? ` (${extra})` : ""}`;
  };

  if (events.length === 1) {
    const [ev] = events;
    return {
      title: ev.birthday ? `🎉 Vandaag: ${ev.summary}` : `Vandaag: ${ev.summary}`,
      body: [ev.time, ev.location].filter(Boolean).join(" · ") || (ev.birthday ? "Vergeet niet te feliciteren!" : "Hele dag"),
      url: "./agenda.html"
    };
  }
  return {
    title: `Vandaag ${events.length} activiteiten`,
    body: events.map(line).join("\n"),
    url: "./agenda.html"
  };
}

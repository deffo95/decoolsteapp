# Push-worker: meldingen op de dag van een agendapunt

Deze Cloudflare Worker stuurt iedere gebruiker op de dag van een activiteit (of verjaardag)
een pushmelding, op het tijdstip dat die gebruiker zelf in de app kiest (Agenda → 🔔 Meldingen).

Elke 5 minuten kijkt de Worker wie er aan de beurt is. De melding komt dus binnen
5 minuten na het gekozen tijdstip binnen. Wie zich aanmeldt nadat het tijdstip van die dag
al voorbij is, krijgt de eerste melding pas de volgende keer.

## Eenmalig online zetten

Je hebt Node.js nodig en je Cloudflare-account (hetzelfde als van de agenda-proxy).
Voer alles uit in deze map (`push-worker`).

1. **Inloggen bij Cloudflare**
   ```
   npx wrangler login
   ```

2. **Opslag aanmaken voor de aanmeldingen**
   ```
   npx wrangler kv namespace create SUBSCRIPTIONS
   ```
   Zet de `id` die je terugkrijgt in `wrangler.toml` bij `VUL_HIER_DE_KV_ID_IN`.

3. **Sleutels maken**
   ```
   node generate-vapid-keys.mjs
   ```
   - Zet de **publieke sleutel** in `wrangler.toml` bij `VUL_HIER_DE_PUBLIEKE_SLEUTEL_IN`.
   - Sla de **geheime sleutel** (de regel met `{"kty":...}`) op als secret:
     ```
     npx wrangler secret put VAPID_PRIVATE_JWK
     ```
     en plak hem als daarom gevraagd wordt. Zet de geheime sleutel nooit in de repo.

4. **Deployen**
   ```
   npx wrangler deploy
   ```
   Je krijgt een adres terug, bijvoorbeeld `https://coolsteapp-push.<jouw-naam>.workers.dev`.

5. **Adres in de app zetten**: vul dat adres in bovenaan `notifications.js`:
   ```js
   const PUSH_SERVER_URL = "https://coolsteapp-push.<jouw-naam>.workers.dev";
   ```
   Commit en push. Daarna verschijnt het blok "🔔 Meldingen" op de agendapagina.

## Gebruik

- **iPhone/iPad**: meldingen werken alleen als de app op het beginscherm staat
  (Safari → Deel → Zet op beginscherm) en je hem daarvandaan opent (iOS 16.4 of nieuwer).
- **Android**: werkt in Chrome, ook zonder installeren.
- Met de knop **Test** stuur je jezelf direct een melding om te controleren of het werkt.

## Goed om te weten

- De lijst met verjaardagen staat zowel in `src/index.js` als in `../calendar.js`. Pas ze allebei aan.
- Er wordt alleen naar de begindatum van een activiteit gekeken. Herhalende afspraken
  (RRULE) worden net als in de app niet uitgerekend.
- Het gratis Cloudflare-abonnement is ruim voldoende voor een vriendengroep.

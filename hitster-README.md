# Hitster: koppelen met Spotify

De Hitster-game speelt nummers af via de Spotify-app op de telefoon van degene die de muziek
regelt (Spotify Premium nodig). Daarvoor is eenmalig een gratis "developer app" bij Spotify nodig.

## 1. Spotify developer app aanmaken (± 5 minuten)

1. Ga naar https://developer.spotify.com/dashboard en log in met het Spotify-account
   (met Premium) dat de muziek gaat afspelen.
2. Accepteer zo nodig de voorwaarden en klik **Create app**.
3. Vul in:
   - **App name:** De Coolste App
   - **App description:** Hitster-spel voor vrienden
   - **Redirect URI:** het volledige adres van de Hitster-pagina in je app, bijvoorbeeld
     `https://<jouw-website>/hitster.html`. Klik op **Add**. Het adres moet precies kloppen
     (https, zelfde schrijfwijze, eindigend op `hitster.html`).
   - **Which API/SDKs are you planning to use?** Vink **Web API** aan.
4. Vink de voorwaarden aan en klik **Save**.
5. Open de app, ga naar **Settings** en kopieer de **Client ID**. Dit is geen geheim
   (in tegenstelling tot het Client Secret, dat je níet nodig hebt).

## 2. Client ID in de app zetten

Zet de Client ID bovenaan `hitster.js`:

```js
const SPOTIFY_CLIENT_ID = "jouw-client-id";
```

## 3. Spelen

1. Open de app op de telefoon met Spotify Premium en ga naar **Games → Hitster**.
2. Tik **Inloggen met Spotify** en geef toestemming (één keer).
3. Open de Spotify-app even, zodat die "wakker" is, en ga terug naar De Coolste App.
4. Tik **Start**: het nummer speelt via Spotify. **Onthul** toont artiest, jaar en titel,
   **Volgend nummer** gaat verder. Nummers komen niet dubbel voorbij tot de lijst op is.

Tip: kijk niet naar de Spotify-app tijdens het spelen. Die laat de titel van het nummer zien.

## Problemen

- **"Spotify staat niet aan op je telefoon"**: open de Spotify-app, speel eventueel kort iets
  af en kom terug. Spotify laat alleen apparaten aansturen die recent actief waren.
- **Fout bij inloggen ("INVALID_CLIENT" of "redirect_uri")**: controleer of de Redirect URI in
  het Spotify-dashboard precies gelijk is aan het adres van `hitster.html`.
- **Iemand anders wil ook inloggen**: een developer app in "Development mode" werkt alleen voor
  accounts die je in het dashboard toevoegt onder **User Management** (naam + e-mailadres van
  het Spotify-account).

## Nummerlijst bijwerken

De nummers staan in `hitster-songs.json`. Na het aanpassen van de Excel-lijst:

```
pip install openpyxl
python3 tools/playlist-naar-json.py pad/naar/Coolste_playlist_database.xlsx
```

Het script slaat dubbele en onvolledige regels over en meldt welke dat zijn.

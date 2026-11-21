#!/usr/bin/env python3
"""Zet de Excel-playlist om naar hitster-songs.json voor de Hitster-game.

Gebruik:
    pip install openpyxl
    python3 tools/playlist-naar-json.py pad/naar/Coolste_playlist_database.xlsx

Verwacht op het tabblad "Database" de kolommen:
    Nr | Naam nummer | Artiest | Jaar originele release | Spotify-link
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

TRACK_RE = re.compile(r"open\.spotify\.com/(?:intl-[a-z]+/)?track/([A-Za-z0-9]{22})")
OUTPUT = Path(__file__).resolve().parent.parent / "hitster-songs.json"


def main(xlsx_path):
    sheet = openpyxl.load_workbook(xlsx_path, data_only=True, read_only=True)["Database"]
    songs, seen, problems = [], set(), []

    for row_nr, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
        if not row or all(cell in (None, "") for cell in row[:5]):
            continue
        _, title, artist, year, link = (list(row) + [None] * 5)[:5]
        match = TRACK_RE.search(str(link or ""))

        if not (title and artist and match and isinstance(year, (int, float))):
            problems.append(f"rij {row_nr}: onvolledig ({title!r}, {artist!r}, {year!r}, {link!r})")
            continue
        track_id = match.group(1)
        if track_id in seen:
            problems.append(f"rij {row_nr}: dubbel nummer overgeslagen ({title} – {artist})")
            continue

        seen.add(track_id)
        songs.append([track_id, str(title).strip(), str(artist).strip(), int(year)])

    OUTPUT.write_text(
        json.dumps({"songs": songs}, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"{len(songs)} nummers opgeslagen in {OUTPUT.name}")
    for p in problems:
        print("  let op:", p)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

"""Scraper semanal de HowLongToBeat (#23).

Busca en HowLongToBeat los juegos de las bibliotecas, el tracker y la wishlist que no tienen duración
(o la tienen de hace más de 90 días) y guarda la historia, historia + extras y el 100% en hubgames_hltb.
HowLongToBeat no tiene API oficial: se usa howlongtobeatpy, con pausas entre peticiones y poco volumen.

Uso: python scripts/hltb/hltb_sync.py [--limit N] [--dry-run]
Necesita NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Sale con código 1 si fallan la mayoría
de las búsquedas (HowLongToBeat ha cambiado o nos bloquea), para que avise el workflow (#10).
"""
import argparse
import asyncio
import json
import os
import random
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from howlongtobeatpy import HowLongToBeat

from matching import Candidate, best_match, search_variants, seconds_to_minutes

PAUSE_S = (2.0, 4.0)
MAX_ERROR_RATIO = 0.5
BATCH = 20


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"::error::Falta la variable de entorno {name}")
    return value


class Supabase:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/") + "/rest/v1"
        self.headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    def _request(self, method: str, path: str, body=None, extra_headers=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            self.url + path, data=data, method=method, headers={**self.headers, **(extra_headers or {})}
        )
        with urllib.request.urlopen(req, timeout=60) as res:
            raw = res.read()
            return json.loads(raw) if raw else None

    def pending(self, limit: int) -> list[dict]:
        return self._request("POST", "/rpc/hubgames_hltb_pending", {"p_limit": limit})

    def upsert(self, rows: list[dict]):
        if rows:
            self._request(
                "POST", "/hubgames_hltb?on_conflict=appid", rows, {"Prefer": "resolution=merge-duplicates"}
            )


def steam_english_name(appid: int) -> str | None:
    """El catálogo guarda el nombre en español ("The Last of Us™ Parte I"); HowLongToBeat lo tiene en inglés."""
    query = urllib.parse.urlencode({"appids": appid, "l": "english", "cc": "us", "filters": "basic"})
    try:
        with urllib.request.urlopen(f"https://store.steampowered.com/api/appdetails?{query}", timeout=30) as res:
            data = json.loads(res.read()).get(str(appid)) or {}
    except Exception:
        return None
    return (data.get("data") or {}).get("name") if data.get("success") else None


def to_candidate(entry) -> Candidate:
    j = entry.json_content
    return Candidate(
        hltb_id=int(entry.game_id),
        name=entry.game_name or "",
        alias=entry.game_alias or "",
        year=j.get("release_world") or None,
        main=seconds_to_minutes(j.get("comp_main")),
        main_extra=seconds_to_minutes(j.get("comp_plus")),
        completionist=seconds_to_minutes(j.get("comp_100")),
        count=int(j.get("comp_main_count") or 0),
    )


async def search(client: HowLongToBeat, name: str) -> list | None:
    """Busca con cada variante del nombre hasta que alguna devuelva resultados. None si todas fallan."""
    failed = 0
    variants = search_variants(name)
    for i, variant in enumerate(variants):
        if i:
            await asyncio.sleep(random.uniform(*PAUSE_S))
        results = await client.async_search(variant)
        if results is None:
            failed += 1
        elif results:
            return results
    return None if failed == len(variants) else []


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=300)
    parser.add_argument("--dry-run", action="store_true", help="Buscar y mostrar, sin guardar")
    args = parser.parse_args()

    db = Supabase(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"))
    games = db.pending(args.limit)
    print(f"Juegos pendientes: {len(games)}")
    if not games:
        return

    # minimum_similarity=0: el filtro lo hace best_match, que también mira el año.
    client = HowLongToBeat(0.0)
    rows: list[dict] = []
    found = not_found = errors = 0

    for n, game in enumerate(games, 1):
        if n > 1:
            await asyncio.sleep(random.uniform(*PAUSE_S))
        appid, name, year = game["appid"], game["name"], game.get("release_year")
        try:
            results = await search(client, name)
        except Exception as e:  # la librería puede lanzar si cambia la respuesta
            print(f"::warning::{appid} {name}: {e}")
            results = None

        if results is None:
            errors += 1
            print(f"[{n}/{len(games)}] ⚠️  {name} ({appid}): la búsqueda falló")
            continue  # no se guarda nada: se reintentará la próxima vez

        match = best_match(name, year, [to_candidate(r) for r in results])
        if not match:
            english = steam_english_name(appid)
            if english and english != name:
                await asyncio.sleep(random.uniform(*PAUSE_S))
                english_results = await search(client, english)
                if english_results:
                    match = best_match(english, year, [to_candidate(r) for r in english_results])
                    results = english_results

        now = datetime.now(timezone.utc).isoformat()
        if match:
            c = match.candidate
            found += 1
            rows.append({
                "appid": appid, "hltb_id": c.hltb_id, "hltb_name": c.name, "main": c.main,
                "main_extra": c.main_extra, "completionist": c.completionist,
                "match_confidence": round(match.similarity, 3), "fetched_at": now,
            })
            hours = f"{c.main / 60:.1f} h" if c.main else "sin dato"
            print(f"[{n}/{len(games)}] ✅ {name} ({appid}) → {c.name} [{match.similarity:.2f}] {hours}")
        else:
            not_found += 1
            rows.append({
                "appid": appid, "hltb_id": None, "hltb_name": None, "main": None, "main_extra": None,
                "completionist": None, "match_confidence": None, "fetched_at": now,
            })
            print(f"[{n}/{len(games)}] ❔ {name} ({appid}): sin coincidencia ({len(results)} resultados)")

        if len(rows) >= BATCH and not args.dry_run:
            db.upsert(rows)
            rows = []

    if not args.dry_run:
        db.upsert(rows)

    print(f"\nEncontrados: {found} · Sin coincidencia: {not_found} · Búsquedas fallidas: {errors}")
    if errors / len(games) > MAX_ERROR_RATIO:
        print(f"::error::Fallaron {errors} de {len(games)} búsquedas: HowLongToBeat puede haber cambiado su web")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

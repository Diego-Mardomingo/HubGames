"""Emparejar un juego de Steam con un resultado de HowLongToBeat (#23).

La búsqueda de HowLongToBeat no devuelve el appid de Steam, así que se empareja por similitud del nombre
y se usa el año de lanzamiento para desempatar y para aceptar nombres algo distintos.
"""
import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher

# Similitud mínima para aceptar un resultado; con el año de lanzamiento coincidente basta con menos.
MIN_SIMILARITY = 0.8
MIN_SIMILARITY_SAME_YEAR = 0.6


@dataclass
class Candidate:
    hltb_id: int
    name: str
    alias: str
    year: int | None
    main: int | None  # minutos
    main_extra: int | None
    completionist: int | None
    count: int  # personas que lo han completado: desempate entre ediciones del mismo juego


@dataclass
class Match:
    candidate: Candidate
    similarity: float


def normalize(name: str) -> str:
    """Minúsculas, sin acentos ni símbolos (™, ®, :, -…), con espacios simples."""
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"[^a-z0-9]+", " ", name.lower())
    return " ".join(name.split())


def search_variants(name: str) -> list[str]:
    """Nombres con los que buscar, del más fiel al más recortado (sin paréntesis ni subtítulo de edición)."""
    # Sin ™®©, emojis ni otros símbolos, y con el apóstrofo normal: "Marvel’s" → "Marvel's".
    clean = name.replace("’", "'").replace("‘", "'")
    clean = "".join(c for c in clean if unicodedata.category(c) != "So" and c not in "™®©")
    clean = " ".join(clean.split())
    variants = [clean]
    no_parens = re.sub(r"\s*[\(\[].*?[\)\]]", "", clean).strip()
    no_edition = re.sub(
        r"\s*[-–:]?\s*(game of the year|goty|definitive|complete|enhanced|remastered|anniversary|deluxe|ultimate|"
        r"director'?s cut|gold|special|standard)( edition)?\s*$",
        "",
        no_parens,
        flags=re.IGNORECASE,
    ).strip()
    # Cualquier otra edición tras un separador: "Total War: ROME II - Emperor Edition" → "Total War: ROME II".
    any_edition = re.sub(r"\s*[-–:]\s*[^-–:]*\bedition\s*$", "", no_edition, flags=re.IGNORECASE).strip()
    for v in (no_parens, no_edition, any_edition):
        if v and v not in variants:
            variants.append(v)
    return variants


def similarity(a: str, b: str) -> float:
    a, b = normalize(a), normalize(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return SequenceMatcher(None, a, b).ratio()


def seconds_to_minutes(value) -> int | None:
    try:
        minutes = round(float(value) / 60)
    except (TypeError, ValueError):
        return None
    return minutes if minutes > 0 else None


def best_match(steam_name: str, release_year: int | None, candidates: list[Candidate]) -> Match | None:
    names = search_variants(steam_name)
    best: tuple[tuple, Match] | None = None
    for c in candidates:
        sim = max(similarity(n, other) for n in names for other in (c.name, c.alias) if other)
        same_year = release_year is not None and c.year is not None and abs(release_year - c.year) <= 1
        if sim < MIN_SIMILARITY and not (same_year and sim >= MIN_SIMILARITY_SAME_YEAR):
            continue
        key = (round(sim, 3), same_year, c.main is not None, c.count)
        if best is None or key > best[0]:
            best = (key, Match(c, sim))
    return best[1] if best else None

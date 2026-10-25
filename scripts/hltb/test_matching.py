import unittest

from matching import Candidate, best_match, normalize, search_variants, seconds_to_minutes


def cand(hltb_id, name, year=None, main=600, count=10, alias=""):
    return Candidate(hltb_id, name, alias, year, main, None, None, count)


class MatchingTest(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(normalize("Sid Meier’s Civilization® VI"), "sid meier s civilization vi")
        self.assertEqual(normalize("Pokémon: Édition"), "pokemon edition")

    def test_variants(self):
        self.assertEqual(search_variants("Hades"), ["Hades"])
        self.assertEqual(
            search_variants("The Witcher® 3: Wild Hunt - Game of the Year Edition"),
            ["The Witcher 3: Wild Hunt - Game of the Year Edition", "The Witcher 3: Wild Hunt"],
        )
        self.assertEqual(search_variants("DOOM (2016)"), ["DOOM (2016)", "DOOM"])
        self.assertEqual(search_variants("Marvel’s Spider-Man Remastered"), ["Marvel's Spider-Man Remastered", "Marvel's Spider-Man"])
        self.assertEqual(search_variants("Tavern Keeper 🍻"), ["Tavern Keeper"])
        self.assertEqual(
            search_variants("Total War: ROME II - Emperor Edition"),
            ["Total War: ROME II - Emperor Edition", "Total War: ROME II"],
        )

    def test_exact_name_wins_over_sequel(self):
        m = best_match("Hades", 2020, [cand(2, "Hades II", 2025), cand(1, "Hades", 2020)])
        self.assertEqual(m.candidate.hltb_id, 1)
        self.assertEqual(m.similarity, 1.0)

    def test_year_breaks_ties_between_same_name(self):
        m = best_match("DOOM", 2016, [cand(1, "Doom", 1993, count=900), cand(2, "DOOM", 2016, count=500)])
        self.assertEqual(m.candidate.hltb_id, 2)

    def test_rejects_unrelated(self):
        self.assertIsNone(best_match("Wallpaper Engine", 2018, [cand(1, "Wall World", 2023)]))

    def test_edition_suffix_is_ignored(self):
        m = best_match("PAYDAY 2: Ultimate Edition", 2013, [cand(1, "Payday 2", 2013)])
        self.assertEqual(m.similarity, 1.0)

    def test_same_year_accepts_looser_name(self):
        name = "Tom Clancy's Rainbow Six Siege X"
        self.assertIsNotNone(best_match(name, 2015, [cand(1, "Rainbow Six Siege", 2015)]))
        self.assertIsNone(best_match(name, 2015, [cand(1, "Rainbow Six Siege", 2020)]))

    def test_alias(self):
        m = best_match("Pro Evolution Soccer 2019", 2018, [cand(1, "PES 2019", 2018, alias="Pro Evolution Soccer 2019")])
        self.assertEqual(m.candidate.hltb_id, 1)

    def test_seconds_to_minutes(self):
        self.assertEqual(seconds_to_minutes(84940), 1416)
        self.assertIsNone(seconds_to_minutes(0))
        self.assertIsNone(seconds_to_minutes(None))


if __name__ == "__main__":
    unittest.main()

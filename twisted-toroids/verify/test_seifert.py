"""Regression checks for exported Seifert data, including split links."""
import copy
import unittest

from verify import check_braid, knotmath_claims


class SeifertExportTests(unittest.TestCase):
    def test_split_surfaces_and_tampering(self):
        cases = [[3, []], [4, [1, 1, 1]], [4, [1, 3, 1, 3]]]
        for exp, expected in zip(knotmath_claims(cases), [(0, 3), (1, 3), (0, 2)]):
            with self.subTest(construction=exp['construction']):
                sf = exp['seifert']
                self.assertEqual((sf['genus'], sf['pieces']), expected)
                self.assertEqual(check_braid(exp)[0], [])
                for field, wrong in [('genus', -2), ('pieces', 1)]:
                    bad = copy.deepcopy(exp)
                    bad['seifert'][field] = wrong
                    self.assertTrue(any('Seifert' in p for p in check_braid(bad)[0]))


if __name__ == '__main__':
    unittest.main()

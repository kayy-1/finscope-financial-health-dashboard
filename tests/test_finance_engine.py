from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from finance_engine import (  # noqa: E402
    build_forecast,
    build_risks,
    build_sensitivity,
    calculate_metrics,
    load_periods,
)


class FinanceEngineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.periods = load_periods(ROOT / "data" / "sample_financials.csv")
        cls.analyzed = calculate_metrics(cls.periods)
        cls.latest = cls.analyzed[-1]

    def test_core_ratios(self) -> None:
        metrics = self.latest["metrics"]
        self.assertAlmostEqual(metrics["gross_margin"], 0.2896613191, places=6)
        self.assertAlmostEqual(metrics["net_margin"], 0.1005347594, places=6)
        self.assertAlmostEqual(metrics["debt_ratio"], 0.5, places=6)
        self.assertAlmostEqual(metrics["current_ratio"], 1.5664335664, places=6)
        self.assertAlmostEqual(metrics["cash_conversion"], 0.8067375887, places=6)

    def test_risk_rules_identify_observed_conditions(self) -> None:
        risks = build_risks(self.analyzed)
        titles = {risk["title"] for risk in risks}
        self.assertEqual(len(risks), 4)
        self.assertIn("收入增速放缓", titles)
        self.assertIn("毛利率承压", titles)
        self.assertIn("利润现金含量偏低", titles)
        self.assertIn("杠杆空间收窄", titles)

    def test_forecast_returns_three_years(self) -> None:
        forecast = build_forecast(
            self.analyzed,
            revenue_growth=0.05,
            gross_margin=0.29,
            opex_ratio=0.152,
        )
        self.assertEqual([row["year"] for row in forecast], [2025, 2026, 2027])
        self.assertGreater(forecast[0]["revenue"], self.latest["revenue"])
        self.assertGreater(forecast[-1]["net_income"], 0)

    def test_sensitivity_is_monotonic(self) -> None:
        result = build_sensitivity(
            self.analyzed,
            revenue_growths=[0.02, 0.05, 0.08],
            gross_margins=[0.27, 0.29, 0.31],
            opex_ratio=0.152,
        )
        middle_row = result["values"][1]
        self.assertLess(middle_row[0], middle_row[1])
        self.assertLess(middle_row[1], middle_row[2])
        self.assertLess(result["values"][0][1], result["values"][2][1])


if __name__ == "__main__":
    unittest.main()

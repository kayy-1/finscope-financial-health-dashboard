"""Generate the standalone browser dataset from the sample CSV."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from finance_engine import build_dashboard_payload, load_periods  # noqa: E402


def main() -> None:
    source = ROOT / "data" / "sample_financials.csv"
    destination = ROOT / "data" / "demo-data.js"
    periods = load_periods(source)
    payload = build_dashboard_payload(
        periods,
        company={
            "name": "澄明制造股份有限公司",
            "short_name": "澄明制造",
            "industry": "高端装备制造",
            "period": "2022—2024",
            "currency": "CNY",
            "unit": "百万元",
            "data_label": "教学示例数据",
            "description": "连续四年经营数据与三年分析视图，用于演示财务健康度、风险线索和情景预测。",
        },
        forecast_defaults={
            "revenue_growth": 0.05,
            "gross_margin": 0.29,
            "opex_ratio": 0.152,
            "tax_rate": 0.22,
        },
    )
    javascript = (
        "window.DASHBOARD_DATA = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n"
    )
    destination.write_text(javascript, encoding="utf-8")
    print(f"Generated {destination} from {len(periods)} periods.")


if __name__ == "__main__":
    main()

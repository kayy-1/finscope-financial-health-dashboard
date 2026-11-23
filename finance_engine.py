"""Deterministic finance calculations for the financial health dashboard."""

from __future__ import annotations

import csv
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable, Mapping, Sequence


REQUIRED_FIELDS = (
    "year",
    "revenue",
    "cogs",
    "operating_expenses",
    "net_income",
    "current_assets",
    "current_liabilities",
    "total_liabilities",
    "total_assets",
    "equity",
    "operating_cash_flow",
    "accounts_receivable",
    "inventory",
)


@dataclass(frozen=True)
class FinancialPeriod:
    year: int
    revenue: float
    cogs: float
    operating_expenses: float
    net_income: float
    current_assets: float
    current_liabilities: float
    total_liabilities: float
    total_assets: float
    equity: float
    operating_cash_flow: float
    accounts_receivable: float
    inventory: float

    @classmethod
    def from_mapping(cls, row: Mapping[str, str | float | int]) -> "FinancialPeriod":
        missing = [field for field in REQUIRED_FIELDS if field not in row]
        if missing:
            raise ValueError(f"Missing required fields: {', '.join(missing)}")
        return cls(
            year=int(float(row["year"])),
            revenue=float(row["revenue"]),
            cogs=float(row["cogs"]),
            operating_expenses=float(row["operating_expenses"]),
            net_income=float(row["net_income"]),
            current_assets=float(row["current_assets"]),
            current_liabilities=float(row["current_liabilities"]),
            total_liabilities=float(row["total_liabilities"]),
            total_assets=float(row["total_assets"]),
            equity=float(row["equity"]),
            operating_cash_flow=float(row["operating_cash_flow"]),
            accounts_receivable=float(row["accounts_receivable"]),
            inventory=float(row["inventory"]),
        )

    @property
    def gross_profit(self) -> float:
        return self.revenue - self.cogs

    @property
    def operating_profit(self) -> float:
        return self.gross_profit - self.operating_expenses


def _ratio(numerator: float, denominator: float) -> float | None:
    if denominator == 0:
        return None
    return numerator / denominator


def _delta(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None:
        return None
    return current - previous


def load_periods(csv_path: str | Path) -> list[FinancialPeriod]:
    path = Path(csv_path)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        raise ValueError("The financial data file contains no rows")
    periods = [FinancialPeriod.from_mapping(row) for row in rows]
    periods.sort(key=lambda item: item.year)
    _validate_periods(periods)
    return periods


def _validate_periods(periods: Sequence[FinancialPeriod]) -> None:
    if len(periods) < 2:
        raise ValueError("At least two financial periods are required")
    years = [period.year for period in periods]
    if len(set(years)) != len(years):
        raise ValueError("Financial periods must use unique years")
    for period in periods:
        if period.revenue <= 0 or period.total_assets <= 0:
            raise ValueError(f"Revenue and total assets must be positive in {period.year}")
        if period.equity <= 0:
            raise ValueError(f"Equity must be positive in {period.year}")


def calculate_metrics(periods: Sequence[FinancialPeriod]) -> list[dict]:
    ordered = sorted(periods, key=lambda item: item.year)
    analyzed: list[dict] = []
    previous: FinancialPeriod | None = None

    for period in ordered:
        metrics = {
            "revenue_growth": (
                _ratio(period.revenue - previous.revenue, previous.revenue)
                if previous
                else None
            ),
            "gross_margin": _ratio(period.gross_profit, period.revenue),
            "net_margin": _ratio(period.net_income, period.revenue),
            "operating_margin": _ratio(period.operating_profit, period.revenue),
            "opex_ratio": _ratio(period.operating_expenses, period.revenue),
            "debt_ratio": _ratio(period.total_liabilities, period.total_assets),
            "current_ratio": _ratio(period.current_assets, period.current_liabilities),
            "roe": _ratio(period.net_income, period.equity),
            "cash_conversion": _ratio(period.operating_cash_flow, period.net_income),
            "receivable_turnover": _ratio(period.revenue, period.accounts_receivable),
            "inventory_turnover": _ratio(period.cogs, period.inventory),
            "working_capital": period.current_assets - period.current_liabilities,
        }
        analyzed.append(
            {
                **asdict(period),
                "gross_profit": period.gross_profit,
                "operating_profit": period.operating_profit,
                "metrics": metrics,
            }
        )
        previous = period

    return analyzed


def build_risks(analyzed: Sequence[dict]) -> list[dict]:
    latest = analyzed[-1]
    previous = analyzed[-2]
    metrics = latest["metrics"]
    prior = previous["metrics"]
    risks: list[dict] = []

    growth = metrics["revenue_growth"]
    growth_delta = _delta(growth, prior["revenue_growth"])
    if growth is not None and growth < 0:
        risks.append(
            _risk(
                "high",
                "收入出现收缩",
                f"{latest['year']} 年营收同比下降 {abs(growth):.1%}。",
                "检查订单、价格和主要客户集中度，补充未来两个季度的收入可见性。",
            )
        )
    elif growth is not None and (growth < 0.03 or (growth_delta is not None and growth_delta <= -0.04)):
        detail = f"{latest['year']} 年营收同比增长 {growth:.1%}"
        if growth_delta is not None:
            detail += f"，较上年放缓 {abs(growth_delta):.1%}"
        risks.append(
            _risk(
                "medium",
                "收入增速放缓",
                detail + "。",
                "拆解量价与产品结构变化，确认增长放缓是短期波动还是趋势变化。",
            )
        )

    gross_margin_delta = _delta(metrics["gross_margin"], prior["gross_margin"])
    if gross_margin_delta is not None and gross_margin_delta < -0.005:
        risks.append(
            _risk(
                "medium" if gross_margin_delta >= -0.02 else "high",
                "毛利率承压",
                f"毛利率同比下降 {abs(gross_margin_delta):.1%}，当前为 {metrics['gross_margin']:.1%}。",
                "核对原材料、产品结构和售价变化，评估成本传导能力。",
            )
        )

    cash_conversion = metrics["cash_conversion"]
    if cash_conversion is not None and cash_conversion < 0.85:
        risks.append(
            _risk(
                "high" if cash_conversion < 0.65 else "medium",
                "利润现金含量偏低",
                f"经营现金流 / 净利润为 {cash_conversion:.2f}x，低于 0.85x 观察线。",
                "重点检查应收账款、存货和合同负债变化，确认利润是否已转化为现金。",
            )
        )

    debt_ratio = metrics["debt_ratio"]
    if debt_ratio is not None and debt_ratio >= 0.5:
        risks.append(
            _risk(
                "high" if debt_ratio >= 0.65 else "medium",
                "杠杆空间收窄",
                f"资产负债率为 {debt_ratio:.1%}，已达到 50% 观察线。",
                "结合债务期限和现金余额评估再融资压力，区分经营性负债与有息负债。",
            )
        )

    current_ratio = metrics["current_ratio"]
    if current_ratio is not None and current_ratio < 1.0:
        risks.append(
            _risk(
                "high",
                "短期偿债覆盖不足",
                f"流动比率为 {current_ratio:.2f}x，流动资产低于流动负债。",
                "核对一年内到期债务和可变现资产，优先安排流动性缓冲。",
            )
        )

    return risks[:6]


def _risk(level: str, title: str, evidence: str, action: str) -> dict:
    return {
        "level": level,
        "title": title,
        "evidence": evidence,
        "action": action,
    }


def build_health_signals(analyzed: Sequence[dict]) -> list[dict]:
    metrics = analyzed[-1]["metrics"]
    signals: list[dict] = []
    if (metrics["revenue_growth"] or 0) > 0:
        signals.append({"label": "收入仍保持增长", "state": "positive"})
    if (metrics["current_ratio"] or 0) >= 1.2:
        signals.append({"label": "短期偿债指标稳定", "state": "positive"})
    if (metrics["net_margin"] or 0) >= 0.08:
        signals.append({"label": "净利率维持在 8% 以上", "state": "positive"})
    if (analyzed[-1]["operating_cash_flow"] or 0) > 0:
        signals.append({"label": "经营现金流为正", "state": "neutral"})
    return signals[:4]


def build_summary(analyzed: Sequence[dict]) -> str:
    latest = analyzed[-1]
    previous = analyzed[-2]
    current = latest["metrics"]
    prior = previous["metrics"]
    parts = [
        f"{latest['year']} 年营收同比增长 {current['revenue_growth']:.1%}",
    ]
    growth_delta = _delta(current["revenue_growth"], prior["revenue_growth"])
    if growth_delta is not None:
        parts[0] += f"，较上年{'放缓' if growth_delta < 0 else '提升'} {abs(growth_delta):.1%}"
    parts.append(f"毛利率为 {current['gross_margin']:.1%}")
    margin_delta = _delta(current["gross_margin"], prior["gross_margin"])
    if margin_delta is not None:
        parts.append(f"同比{'下降' if margin_delta < 0 else '提升'} {abs(margin_delta):.1%}")
    parts.append(f"经营现金流 / 净利润为 {current['cash_conversion']:.2f}x")
    parts.append(f"资产负债率为 {current['debt_ratio']:.1%}")
    if (current["current_ratio"] or 0) >= 1.2:
        parts.append("流动比率保持在 1.2x 以上")
    return "，".join(parts) + "。整体盈利仍为正，但增长质量与现金转化值得持续跟踪。"


def build_forecast(
    analyzed: Sequence[dict],
    revenue_growth: float,
    gross_margin: float,
    opex_ratio: float,
    years: int = 3,
    tax_rate: float = 0.22,
) -> list[dict]:
    latest = analyzed[-1]
    revenue = latest["revenue"]
    implied_pretax = latest["net_income"] / (1 - tax_rate)
    other_expense = latest["gross_profit"] - latest["operating_expenses"] - implied_pretax
    other_expense_ratio = other_expense / latest["revenue"]
    rows: list[dict] = []

    for offset in range(1, years + 1):
        revenue = revenue * (1 + revenue_growth)
        gross_profit = revenue * gross_margin
        operating_expenses = revenue * opex_ratio
        other_expenses = revenue * other_expense_ratio
        pretax_income = gross_profit - operating_expenses - other_expenses
        net_income = pretax_income * (1 - tax_rate)
        rows.append(
            {
                "year": latest["year"] + offset,
                "revenue": revenue,
                "gross_profit": gross_profit,
                "operating_expenses": operating_expenses,
                "net_income": net_income,
                "net_margin": _ratio(net_income, revenue),
            }
        )

    return rows


def build_sensitivity(
    analyzed: Sequence[dict],
    revenue_growths: Iterable[float],
    gross_margins: Iterable[float],
    opex_ratio: float,
    tax_rate: float = 0.22,
) -> dict:
    x_values = list(revenue_growths)
    y_values = list(gross_margins)
    values = []
    for margin in y_values:
        row = []
        for growth in x_values:
            forecast = build_forecast(
                analyzed,
                revenue_growth=growth,
                gross_margin=margin,
                opex_ratio=opex_ratio,
                years=3,
                tax_rate=tax_rate,
            )
            row.append(round(forecast[-1]["net_income"], 1))
        values.append(row)
    return {"x_values": x_values, "y_values": y_values, "values": values}


def build_dashboard_payload(
    periods: Sequence[FinancialPeriod],
    company: Mapping[str, str],
    forecast_defaults: Mapping[str, float],
) -> dict:
    analyzed = calculate_metrics(periods)
    latest = analyzed[-1]
    return {
        "company": dict(company),
        "periods": analyzed,
        "latest": latest,
        "risks": build_risks(analyzed),
        "health_signals": build_health_signals(analyzed),
        "summary": build_summary(analyzed),
        "forecast_defaults": dict(forecast_defaults),
        "forecast_preview": build_forecast(
            analyzed,
            revenue_growth=forecast_defaults["revenue_growth"],
            gross_margin=forecast_defaults["gross_margin"],
            opex_ratio=forecast_defaults["opex_ratio"],
            tax_rate=forecast_defaults["tax_rate"],
        ),
    }

(() => {
  "use strict";

  const sampleData = window.DASHBOARD_DATA;
  if (!sampleData) {
    document.body.innerHTML =
      '<main style="padding:40px;font-family:sans-serif"><h1>数据文件未加载</h1><p>请确认 data/demo-data.js 与 index.html 位于正确位置。</p></main>';
    return;
  }

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const state = {
    data: clone(sampleData),
    assumptions: {
      revenueGrowth: sampleData.forecast_defaults.revenue_growth,
      grossMargin: sampleData.forecast_defaults.gross_margin,
      opexRatio: sampleData.forecast_defaults.opex_ratio,
      taxRate: sampleData.forecast_defaults.tax_rate,
    },
    source: "sample",
    lastUpdated: new Date(),
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const formatters = {
    money: new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }),
    moneyOne: new Intl.NumberFormat("zh-CN", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
    integer: new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }),
  };

  function formatMoney(value, digits = 0) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    const formatter = digits ? formatters.moneyOne : formatters.money;
    return `¥${formatter.format(Number(value))}`;
  }

  function formatPct(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    return `${(Number(value) * 100).toFixed(digits)}%`;
  }

  function formatPp(value, digits = 1) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    const points = Number(value) * 100;
    const prefix = points > 0 ? "+" : "";
    return `${prefix}${points.toFixed(digits)}pp`;
  }

  function formatRatio(value, digits = 2) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    return `${Number(value).toFixed(digits)}x`;
  }

  function formatChange(value, digits = 1, suffix = "%") {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
    const number = Number(value) * 100;
    const prefix = number > 0 ? "+" : "";
    return `${prefix}${number.toFixed(digits)}${suffix}`;
  }

  function safeRatio(numerator, denominator) {
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }
    return numerator / denominator;
  }

  function difference(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    return current - previous;
  }

  function trendClass(value, invert = false) {
    if (!Number.isFinite(value) || value === 0) return "neutral";
    const positive = invert ? value < 0 : value > 0;
    return positive ? "positive" : "negative";
  }

  function trendIcon(value) {
    if (!Number.isFinite(value) || value === 0) return "→";
    return value > 0 ? "↑" : "↓";
  }

  function currentAssumptionData() {
    return {
      revenueGrowth: state.assumptions.revenueGrowth,
      grossMargin: state.assumptions.grossMargin,
      opexRatio: state.assumptions.opexRatio,
      taxRate: state.assumptions.taxRate,
    };
  }

  function buildForecastWith(assumptions, data = state.data, years = 3) {
    const latest = data.latest;
    const impliedPretax = latest.net_income / (1 - assumptions.taxRate);
    const otherExpense =
      latest.gross_profit - latest.operating_expenses - impliedPretax;
    const otherExpenseRatio = otherExpense / latest.revenue;
    let revenue = latest.revenue;
    const rows = [];

    for (let offset = 1; offset <= years; offset += 1) {
      revenue *= 1 + assumptions.revenueGrowth;
      const grossProfit = revenue * assumptions.grossMargin;
      const operatingExpenses = revenue * assumptions.opexRatio;
      const otherExpenses = revenue * otherExpenseRatio;
      const pretaxIncome = grossProfit - operatingExpenses - otherExpenses;
      const netIncome = pretaxIncome * (1 - assumptions.taxRate);
      rows.push({
        year: latest.year + offset,
        revenue,
        grossProfit,
        operatingExpenses,
        netIncome,
        netMargin: safeRatio(netIncome, revenue),
      });
    }

    return rows;
  }

  function buildSensitivity(assumptions) {
    const xValues = [0, 0.025, 0.05, 0.075, 0.1];
    const yValues = [0.27, 0.28, 0.29, 0.3, 0.31];
    const values = yValues
      .slice()
      .reverse()
      .map((margin) =>
        xValues.map((growth) => {
          const forecast = buildForecastWith(
            { ...assumptions, revenueGrowth: growth, grossMargin: margin },
            state.data,
            3,
          );
          return forecast.at(-1).netIncome;
        }),
      );
    return { xValues, yValues: yValues.slice().reverse(), values };
  }

  function niceMax(value) {
    if (value <= 0) return 1;
    const exponent = 10 ** Math.floor(Math.log10(value));
    const fraction = value / exponent;
    let niceFraction = 1;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
    return niceFraction * exponent;
  }

  function renderCompany() {
    const { company, latest } = state.data;
    $("#company-period").textContent = `${company.period} · ${company.data_label}`;
    $("#company-description").textContent = company.description;
    $("#company-name").textContent = company.name;
    $("#company-industry").textContent = company.industry;
    $("#company-unit").textContent =
      company.currency === "CNY"
        ? `人民币${company.unit}`
        : `${company.currency} ${company.unit}`;
    $("#data-source-label").textContent =
      state.source === "sample" ? "公开数据教学示例" : "本地导入数据";
    $("#last-updated").textContent = `已更新 ${state.lastUpdated.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    $("#data-status-text").textContent =
      state.source === "sample" ? "示例数据已就绪" : "已载入自定义数据";
    const monogram = $("#company-name").closest(".company-identity")?.querySelector(".company-monogram");
    if (monogram) monogram.textContent = company.short_name.slice(0, 1);
    $("#analysis-summary-text").textContent = state.data.summary;
    $("#risk-count").textContent = String(state.data.risks.length);
    $("#summary-signal").setAttribute(
      "aria-label",
      `${state.data.risks.length} 项风险提示，当前分析到 ${latest.year} 年`,
    );
  }

  function renderKpis() {
    const periods = state.data.periods.slice(-3);
    const latest = periods.at(-1);
    const previous = periods.at(-2);
    const metrics = latest.metrics;
    const prior = previous.metrics;
    const netMarginDelta = difference(metrics.net_margin, prior.net_margin);
    const roeDelta = difference(metrics.roe, prior.roe);
    const currentRatioDelta = difference(metrics.current_ratio, prior.current_ratio);
    const cashDelta = difference(metrics.cash_conversion, prior.cash_conversion);

    const items = [
      {
        label: "营业收入",
        value: formatMoney(latest.revenue),
        icon: "circle-dollar-sign",
        trend: metrics.revenue_growth,
        trendText: `${formatChange(metrics.revenue_growth)} 同比`,
        foot: "百万元",
      },
      {
        label: "净利率",
        value: formatPct(metrics.net_margin),
        icon: "percent",
        trend: netMarginDelta,
        trendText: `${trendIcon(netMarginDelta)} ${Math.abs(netMarginDelta * 100).toFixed(1)}pp`,
        foot: "较上年",
      },
      {
        label: "净资产收益率",
        value: formatPct(metrics.roe),
        icon: "gauge",
        trend: roeDelta,
        trendText: `${trendIcon(roeDelta)} ${Math.abs(roeDelta * 100).toFixed(1)}pp`,
        foot: "期末权益口径",
      },
      {
        label: "流动比率",
        value: formatRatio(metrics.current_ratio),
        icon: "shield-check",
        trend: currentRatioDelta,
        trendText: `${trendIcon(currentRatioDelta)} ${Math.abs(currentRatioDelta).toFixed(2)}x`,
        foot: "较上年",
      },
      {
        label: "现金转化",
        value: formatRatio(metrics.cash_conversion),
        icon: "banknote",
        trend: cashDelta,
        trendText: `${trendIcon(cashDelta)} ${Math.abs(cashDelta).toFixed(2)}x`,
        foot: "经营现金流 / 净利润",
      },
    ];

    $("#kpi-grid").innerHTML = items
      .map(
        (item) => `
          <article class="kpi-card">
            <div class="kpi-top">
              <span class="kpi-label">${escapeHtml(item.label)}</span>
              <i class="kpi-icon" data-lucide="${item.icon}" aria-hidden="true"></i>
            </div>
            <p class="kpi-value">${escapeHtml(item.value)}</p>
            <div class="kpi-foot">
              <span class="trend ${trendClass(item.trend)}">
                ${escapeHtml(item.trendText)}
              </span>
              <span>${escapeHtml(item.foot)}</span>
            </div>
          </article>
        `,
      )
      .join("");

    const latestYear = latest.year;
    $("#trend-caption").textContent = `${latestYear} 年营收为 ${formatMoney(
      latest.revenue,
    )} 百万元，净利率为 ${formatPct(metrics.net_margin)}。`;
  }

  function renderRisks() {
    const risks = state.data.risks;
    const list = $("#risk-list");
    if (!risks.length) {
      list.innerHTML =
        '<div class="risk-item"><div class="risk-icon"><i data-lucide="circle-check" aria-hidden="true"></i></div><div><p class="risk-title">当前规则未发现重点关注项</p><p class="risk-evidence">仍需结合行业、审计意见和财报附注进行判断。</p></div></div>';
    } else {
      list.innerHTML = risks
        .map(
          (risk) => `
            <article class="risk-item ${escapeHtml(risk.level)}">
              <div class="risk-icon">
                <i data-lucide="${risk.level === "high" ? "triangle-alert" : "circle-alert"}" aria-hidden="true"></i>
              </div>
              <div>
                <div class="risk-title-row">
                  <p class="risk-title">${escapeHtml(risk.title)}</p>
                  <span class="risk-level">${risk.level === "high" ? "高优先级" : "需关注"}</span>
                </div>
                <p class="risk-evidence">${escapeHtml(risk.evidence)}</p>
                <p class="risk-action">${escapeHtml(risk.action)}</p>
              </div>
            </article>
          `,
        )
        .join("");
    }

    $("#health-signals").innerHTML = state.data.health_signals
      .map(
        (signal) => `
          <span class="health-chip ${signal.state === "neutral" ? "neutral" : ""}">
            <i data-lucide="check" aria-hidden="true"></i>
            ${escapeHtml(signal.label)}
          </span>
        `,
      )
      .join("");
  }

  function chartText(x, y, text, className, anchor = "middle", extra = "") {
    return `<text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}" ${extra}>${escapeHtml(
      text,
    )}</text>`;
  }

  function renderComboChart(container, rows, options) {
    const width = Math.max(320, Math.floor(container.getBoundingClientRect().width || 720));
    const height = options.height || 282;
    const margin = {
      top: 35,
      right: width < 500 ? 46 : 62,
      bottom: 43,
      left: width < 500 ? 48 : 62,
    };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const revenues = rows.map((row) => Number(row.revenue));
    const marginValues = rows.map((row) => Number(row.margin));
    const leftMax = niceMax(Math.max(...revenues) * 1.1);
    const rightMax = Math.max(0.08, Math.ceil(Math.max(...marginValues) * 100 * 1.15) / 100);
    const band = plotWidth / rows.length;
    const barWidth = Math.min(width < 500 ? 34 : 54, band * 0.42);
    const leftY = (value) => margin.top + plotHeight - (value / leftMax) * plotHeight;
    const rightY = (value) => margin.top + plotHeight - (value / rightMax) * plotHeight;
    const centers = rows.map((_, index) => margin.left + band * index + band / 2);

    const grid = [0, 0.25, 0.5, 0.75, 1]
      .map((fraction) => {
        const y = margin.top + plotHeight - plotHeight * fraction;
        const leftValue = leftMax * fraction;
        const rightValue = rightMax * fraction;
        return `
          <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}"
            stroke="#dce4e0" stroke-width="1" />
          ${chartText(
            margin.left - 8,
            y + 4,
            formatters.integer.format(leftValue),
            "chart-tick",
            "end",
            'fill="#71817b" font-size="11"',
          )}
          ${chartText(
            width - margin.right + 8,
            y + 4,
            `${(rightValue * 100).toFixed(0)}%`,
            "chart-tick",
            "start",
            'fill="#71817b" font-size="11"',
          )}
        `;
      })
      .join("");

    const bars = rows
      .map((row, index) => {
        const y = leftY(Number(row.revenue));
        const barX = centers[index] - barWidth / 2;
        const barHeight = margin.top + plotHeight - y;
        return `
          <rect x="${barX}" y="${y}" width="${barWidth}" height="${barHeight}" rx="3"
            fill="${index === rows.length - 1 ? "#4f897c" : "#83b0a6"}">
            <title>${escapeHtml(row.year)} 年营业收入 ${formatMoney(row.revenue)} 百万元</title>
          </rect>
          ${chartText(
            centers[index],
            y - 8,
            formatMoney(row.revenue),
            "chart-label",
            "middle",
            'fill="#32453e" font-size="11" font-weight="600"',
          )}
        `;
      })
      .join("");

    const linePoints = rows
      .map((row, index) => `${centers[index]},${rightY(Number(row.margin))}`)
      .join(" ");
    const line = `<polyline points="${linePoints}" fill="none" stroke="#c66334" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`;
    const dots = rows
      .map((row, index) => {
        const y = rightY(Number(row.margin));
        const labelY = y - 12;
        return `
          <circle cx="${centers[index]}" cy="${y}" r="4.5" fill="#ffffff" stroke="#c66334" stroke-width="2.5">
            <title>${escapeHtml(row.year)} 年${escapeHtml(options.marginLabel)} ${formatPct(row.margin)}</title>
          </circle>
          ${chartText(
            centers[index],
            labelY,
            formatPct(row.margin),
            "chart-label",
            "middle",
            'fill="#8e4525" font-size="11" font-weight="600"',
          )}
        `;
      })
      .join("");

    const xLabels = rows
      .map((row, index) =>
        chartText(
          centers[index],
          height - 12,
          options.yearSuffix ? `${row.year}${options.yearSuffix}` : String(row.year),
          "chart-tick",
          "middle",
          'fill="#71817b" font-size="11"',
        ),
      )
      .join("");

    const axisTitles =
      width > 480
        ? `
          ${chartText(
            margin.left,
            16,
            "营业收入（百万元）",
            "chart-axis-title",
            "start",
            'fill="#71817b" font-size="10"',
          )}
          ${chartText(
            width - margin.right,
            16,
            options.marginLabel,
            "chart-axis-title",
            "end",
            'fill="#8e4525" font-size="10"',
          )}
        `
        : "";

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.label)}">
        <title>${escapeHtml(options.label)}</title>
        ${axisTitles}
        ${grid}
        ${bars}
        ${line}
        ${dots}
        ${xLabels}
      </svg>
    `;
  }

  function renderTrendChart() {
    const periods = state.data.periods.slice(-3).map((period) => ({
      year: period.year,
      revenue: period.revenue,
      margin: period.metrics.net_margin,
    }));
    renderComboChart($("#trend-chart"), periods, {
      label: `近三年营业收入与净利率，${periods[0].year} 至 ${periods.at(-1).year}`,
      marginLabel: "净利率",
      height: 282,
    });
  }

  function renderForecast() {
    const assumptions = currentAssumptionData();
    const forecast = buildForecastWith(assumptions);
    const final = forecast.at(-1);

    $("#growth-output").textContent = formatPct(assumptions.revenueGrowth);
    $("#margin-output").textContent = formatPct(assumptions.grossMargin);
    $("#opex-output").textContent = formatPct(assumptions.opexRatio);
    $("#tax-rate-label").textContent = formatPct(assumptions.taxRate);
    $("#forecast-revenue").textContent = `${formatMoney(final.revenue)}`;
    $("#forecast-income").textContent = `${formatMoney(final.netIncome)}`;
    $("#forecast-margin").textContent = formatPct(final.netMargin);
    $("#forecast-note").textContent = `${forecast[0].year}E—${final.year}E`;

    renderComboChart(
      $("#forecast-chart"),
      forecast.map((row) => ({
        year: row.year,
        revenue: row.revenue,
        margin: row.netMargin,
      })),
      {
        label: `${forecast[0].year} 至 ${final.year} 预测营业收入与净利率`,
        marginLabel: "预测净利率",
        yearSuffix: "E",
        height: 245,
      },
    );
    renderSensitivity(assumptions);
  }

  function renderSensitivity(assumptions) {
    const sensitivity = buildSensitivity(assumptions);
    const flatValues = sensitivity.values.flat();
    const min = Math.min(...flatValues);
    const max = Math.max(...flatValues);
    const range = max - min || 1;

    const headerCells = sensitivity.xValues
      .map((value, index) => `<th scope="col">${index === 0 ? "<span class=\"sr-only\">收入增速 </span>" : ""}${formatPct(value)}</th>`)
      .join("");

    const bodyRows = sensitivity.yValues
      .map((margin, rowIndex) => {
        const cells = sensitivity.values[rowIndex]
          .map((value, columnIndex) => {
            const intensity = (value - min) / range;
            const isCurrent =
              Math.abs(margin - assumptions.grossMargin) < 0.0001 &&
              Math.abs(sensitivity.xValues[columnIndex] - assumptions.revenueGrowth) < 0.0001;
            return `<td class="${isCurrent ? "is-current" : ""}" style="background-color: rgba(13, 107, 92, ${
              0.045 + intensity * 0.19
            })"${isCurrent ? ' aria-current="true"' : ""}>${formatters.money.format(value)}</td>`;
          })
          .join("");
        return `<tr><th scope="row">${formatPct(margin)}</th>${cells}</tr>`;
      })
      .join("");

    $("#sensitivity-table").innerHTML = `
      <caption>行表示毛利率，列表示年收入增速，单元格为第三年预测净利润。</caption>
      <thead>
        <tr>
          <th scope="col">毛利率 \\ 收入增速</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    `;
  }

  function renderFinancialTable() {
    const periods = state.data.periods.slice(-3);
    const rows = [
      ["营业收入", (period) => formatMoney(period.revenue)],
      ["净利润", (period) => formatMoney(period.net_income)],
      ["毛利率", (period) => formatPct(period.metrics.gross_margin)],
      ["净利率", (period) => formatPct(period.metrics.net_margin)],
      ["ROE", (period) => formatPct(period.metrics.roe)],
      ["资产负债率", (period) => formatPct(period.metrics.debt_ratio)],
      ["流动比率", (period) => formatRatio(period.metrics.current_ratio)],
      ["现金转化", (period) => formatRatio(period.metrics.cash_conversion)],
      ["期间费用率", (period) => formatPct(period.metrics.opex_ratio)],
    ];

    $("#financial-table").innerHTML = `
      <caption>最近三个财年的核心财务指标，金额单位为人民币百万元。</caption>
      <thead>
        <tr>
          <th scope="col">指标</th>
          ${periods.map((period) => `<th scope="col">${period.year}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            ([label, formatter]) => `
              <tr>
                <th scope="row">${label}</th>
                ${periods.map((period) => `<td>${formatter(period)}</td>`).join("")}
              </tr>
            `,
          )
          .join("")}
      </tbody>
    `;
  }

  function renderAll() {
    renderCompany();
    renderKpis();
    renderRisks();
    renderTrendChart();
    syncControls();
    renderForecast();
    renderFinancialTable();
    if (window.lucide) {
      window.lucide.createIcons({ attrs: { width: 17, height: 17 } });
    }
  }

  function syncControls() {
    $("#growth-range").value = String(state.assumptions.revenueGrowth * 100);
    $("#margin-range").value = String(state.assumptions.grossMargin * 100);
    $("#opex-range").value = String(state.assumptions.opexRatio * 100);
  }

  function resetAssumptions() {
    state.assumptions = {
      revenueGrowth: state.data.forecast_defaults.revenue_growth,
      grossMargin: state.data.forecast_defaults.gross_margin,
      opexRatio: state.data.forecast_defaults.opex_ratio,
      taxRate: state.data.forecast_defaults.tax_rate,
    };
    syncControls();
    renderForecast();
    showToast("已恢复当前数据的基准假设。");
  }

  function parseCsv(text) {
    const source = text.replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === ",") {
        row.push(field.trim());
        field = "";
      } else if (character === "\n") {
        row.push(field.trim());
        if (row.some((cell) => cell !== "")) rows.push(row);
        row = [];
        field = "";
      } else if (character !== "\r") {
        field += character;
      }
    }

    if (field || row.length) {
      row.push(field.trim());
      if (row.some((cell) => cell !== "")) rows.push(row);
    }
    if (rows.length < 3) throw new Error("CSV 至少需要表头和两个财年数据。");
    const headers = rows[0].map((header) => header.trim());
    return rows.slice(1).map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])),
    );
  }

  const requiredNumericFields = [
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
  ];

  function analyzeImportedRows(rawRows) {
    const rows = rawRows
      .map((input) => {
        const missing = requiredNumericFields.filter((field) => input[field] === undefined);
        if (missing.length) throw new Error(`缺少字段：${missing.join("、")}`);
        const row = {};
        requiredNumericFields.forEach((field) => {
          const value = Number(input[field]);
          if (!Number.isFinite(value)) throw new Error(`字段 ${field} 包含非数字值。`);
          row[field] = value;
        });
        row.year = Math.trunc(row.year);
        row.company_name = input.company_name || "";
        return row;
      })
      .sort((a, b) => a.year - b.year);

    if (rows.length < 2) throw new Error("至少需要两个财年的数据。");
    if (new Set(rows.map((row) => row.year)).size !== rows.length) {
      throw new Error("财年不能重复。");
    }

    const periods = rows.map((row, index) => {
      const previous = index > 0 ? rows[index - 1] : null;
      const grossProfit = row.revenue - row.cogs;
      const operatingProfit = grossProfit - row.operating_expenses;
      return {
        ...row,
        gross_profit: grossProfit,
        operating_profit: operatingProfit,
        metrics: {
          revenue_growth: previous ? safeRatio(row.revenue - previous.revenue, previous.revenue) : null,
          gross_margin: safeRatio(grossProfit, row.revenue),
          net_margin: safeRatio(row.net_income, row.revenue),
          operating_margin: safeRatio(operatingProfit, row.revenue),
          opex_ratio: safeRatio(row.operating_expenses, row.revenue),
          debt_ratio: safeRatio(row.total_liabilities, row.total_assets),
          current_ratio: safeRatio(row.current_assets, row.current_liabilities),
          roe: safeRatio(row.net_income, row.equity),
          cash_conversion: safeRatio(row.operating_cash_flow, row.net_income),
          receivable_turnover: safeRatio(row.revenue, row.accounts_receivable),
          inventory_turnover: safeRatio(row.cogs, row.inventory),
          working_capital: row.current_assets - row.current_liabilities,
        },
      };
    });

    if (periods.length < 2) throw new Error("无法计算同比指标。");
    const risks = buildImportedRisks(periods);
    const latest = periods.at(-1);
    const previous = periods.at(-2);
    return {
      company: {
        name: latest.company_name || "本地导入财务数据",
        short_name: (latest.company_name || "导入").slice(0, 4),
        industry: "自定义导入",
        period: `${periods[0].year}—${latest.year}`,
        currency: "CNY",
        unit: "百万元",
        data_label: "本地导入数据",
        description: "由 CSV 导入生成的分析视图，请确认金额单位与数据口径一致。",
      },
      periods,
      latest,
      risks,
      health_signals: buildImportedHealth(latest),
      summary: buildImportedSummary(latest, previous),
      forecast_defaults: {
        revenue_growth: Math.max(0, Math.min(0.12, latest.metrics.revenue_growth ?? 0.03)),
        gross_margin: latest.metrics.gross_margin ?? 0.28,
        opex_ratio: latest.metrics.opex_ratio ?? 0.16,
        tax_rate: 0.22,
      },
    };
  }

  function buildImportedRisks(periods) {
    const latest = periods.at(-1);
    const previous = periods.at(-2);
    const metrics = latest.metrics;
    const prior = previous.metrics;
    const risks = [];
    const growth = metrics.revenue_growth;
    const growthDelta = difference(growth, prior.revenue_growth);

    if (growth !== null && growth < 0) {
      risks.push({
        level: "high",
        title: "收入出现收缩",
        evidence: `${latest.year} 年营收同比下降 ${Math.abs(growth * 100).toFixed(1)}%。`,
        action: "检查订单、价格和客户结构，补充未来收入可见性。",
      });
    } else if (growth !== null && (growth < 0.03 || (growthDelta !== null && growthDelta <= -0.04))) {
      risks.push({
        level: "medium",
        title: "收入增速放缓",
        evidence: `${latest.year} 年营收同比增长 ${formatPct(growth)}。`,
        action: "拆解量价和产品结构变化，判断增长放缓是否持续。",
      });
    }

    const marginDelta = difference(metrics.gross_margin, prior.gross_margin);
    if (marginDelta !== null && marginDelta < -0.005) {
      risks.push({
        level: marginDelta < -0.02 ? "high" : "medium",
        title: "毛利率承压",
        evidence: `毛利率同比下降 ${Math.abs(marginDelta * 100).toFixed(1)}pp。`,
        action: "核对售价、成本和产品结构，评估成本传导能力。",
      });
    }

    if (metrics.cash_conversion !== null && metrics.cash_conversion < 0.85) {
      risks.push({
        level: metrics.cash_conversion < 0.65 ? "high" : "medium",
        title: "利润现金含量偏低",
        evidence: `经营现金流 / 净利润为 ${formatRatio(metrics.cash_conversion)}。`,
        action: "检查应收、存货和合同负债，确认利润是否转化为现金。",
      });
    }

    if (metrics.debt_ratio !== null && metrics.debt_ratio >= 0.5) {
      risks.push({
        level: metrics.debt_ratio >= 0.65 ? "high" : "medium",
        title: "杠杆空间收窄",
        evidence: `资产负债率为 ${formatPct(metrics.debt_ratio)}。`,
        action: "结合债务期限与现金余额评估再融资压力。",
      });
    }

    if (metrics.current_ratio !== null && metrics.current_ratio < 1) {
      risks.push({
        level: "high",
        title: "短期偿债覆盖不足",
        evidence: `流动比率为 ${formatRatio(metrics.current_ratio)}。`,
        action: "核对一年内到期债务和可变现资产。",
      });
    }
    return risks.slice(0, 6);
  }

  function buildImportedHealth(latest) {
    const metrics = latest.metrics;
    const signals = [];
    if ((metrics.revenue_growth ?? 0) > 0) signals.push({ label: "收入仍保持增长", state: "positive" });
    if ((metrics.current_ratio ?? 0) >= 1.2) signals.push({ label: "短期偿债指标稳定", state: "positive" });
    if ((metrics.net_margin ?? 0) >= 0.08) signals.push({ label: "净利率维持在 8% 以上", state: "positive" });
    if ((latest.operating_cash_flow ?? 0) > 0) signals.push({ label: "经营现金流为正", state: "neutral" });
    return signals.slice(0, 4);
  }

  function buildImportedSummary(latest, previous) {
    const metrics = latest.metrics;
    const prior = previous.metrics;
    const growthDelta = difference(metrics.revenue_growth, prior.revenue_growth);
    const marginDelta = difference(metrics.gross_margin, prior.gross_margin);
    const parts = [
      `${latest.year} 年营收同比增长 ${formatPct(metrics.revenue_growth)}`,
      `毛利率 ${formatPct(metrics.gross_margin)}`,
      `经营现金流 / 净利润 ${formatRatio(metrics.cash_conversion)}`,
      `资产负债率 ${formatPct(metrics.debt_ratio)}`,
    ];
    if (growthDelta !== null && Math.abs(growthDelta) >= 0.005) {
      parts.push(`收入增速较上年${growthDelta < 0 ? "放缓" : "提升"} ${Math.abs(growthDelta * 100).toFixed(1)}pp`);
    }
    if (marginDelta !== null && Math.abs(marginDelta) >= 0.005) {
      parts.push(`毛利率同比${marginDelta < 0 ? "下降" : "提升"} ${Math.abs(marginDelta * 100).toFixed(1)}pp`);
    }
    return `${parts.join("，")}。请结合行业与财报附注解释指标变化。`;
  }

  async function handleFile(file) {
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      state.data = analyzeImportedRows(rows);
      state.assumptions = {
        revenueGrowth: state.data.forecast_defaults.revenue_growth,
        grossMargin: state.data.forecast_defaults.gross_margin,
        opexRatio: state.data.forecast_defaults.opex_ratio,
        taxRate: state.data.forecast_defaults.tax_rate,
      };
      state.source = "import";
      state.lastUpdated = new Date();
      renderAll();
      showToast(`已载入 ${file.name}，共 ${state.data.periods.length} 个财年。`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "CSV 导入失败。", true);
    } finally {
      $("#file-input").value = "";
    }
  }

  let toastTimer = null;
  function showToast(message, isError = false) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 4200);
  }

  function bindEvents() {
    $("#import-button").addEventListener("click", () => $("#file-input").click());
    $("#file-input").addEventListener("change", (event) => {
      const [file] = event.target.files;
      if (file) handleFile(file);
    });
    $("#export-button").addEventListener("click", () => window.print());
    $("#reset-scenario").addEventListener("click", resetAssumptions);

    $("#growth-range").addEventListener("input", (event) => {
      state.assumptions.revenueGrowth = Number(event.target.value) / 100;
      renderForecast();
    });
    $("#margin-range").addEventListener("input", (event) => {
      state.assumptions.grossMargin = Number(event.target.value) / 100;
      renderForecast();
    });
    $("#opex-range").addEventListener("input", (event) => {
      state.assumptions.opexRatio = Number(event.target.value) / 100;
      renderForecast();
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        renderTrendChart();
        renderForecast();
      }, 120);
    });

    const navLinks = $$(".topnav a");
    const sections = navLinks
      .map((link) => $(link.getAttribute("href")))
      .filter(Boolean);
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          if (!visible) return;
          navLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`);
          });
        },
        { rootMargin: "-20% 0px -65% 0px", threshold: [0.1, 0.3, 0.6] },
      );
      sections.forEach((section) => observer.observe(section));
    }
  }

  bindEvents();
  renderAll();
})();

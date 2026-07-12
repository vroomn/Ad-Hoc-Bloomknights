"use strict";


// Keep mock mode enabled until the Django API contract is finalized.
const USE_MOCKS = true;
const API = "http://localhost:5000";


const mockHoldings = [
  {
    ticker: "AAPL",
    name: "Apple Inc",
    shares: 10,
    currentPrice: 189.5,
    totalValue: 1895,
    gainLoss: 443,
    gainLossPercent: 30.51,
    sector: "Technology"
  },
  {
    ticker: "TSLA",
    name: "Tesla Inc",
    shares: 5,
    currentPrice: 218.75,
    totalValue: 1093.75,
    gainLoss: -206.25,
    gainLossPercent: -15.87,
    sector: "Consumer Cyclical"
  },
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    shares: 8,
    currentPrice: 455.3,
    totalValue: 3642.4,
    gainLoss: 521.6,
    gainLossPercent: 16.72,
    sector: "Funds"
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corp",
    shares: 4,
    currentPrice: 612.4,
    totalValue: 2449.6,
    gainLoss: 529.6,
    gainLossPercent: 27.58,
    sector: "Technology"
  }
];


const mockAnalysis = {
  totalValue: 9080.75,
  ytdGrowthPercent: 29.7,
  overallGrowthPercent: 46.5,
  history: [
    { date: "2024-08-01", month: "Aug", value: 4800 },
    { date: "2024-09-01", month: "Sep", value: 4920 },
    { date: "2024-10-01", month: "Oct", value: 4875 },
    { date: "2024-11-01", month: "Nov", value: 5100 },
    { date: "2024-12-01", month: "Dec", value: 5250 },
    { date: "2025-01-01", month: "Jan", value: 5180 },
    { date: "2025-02-01", month: "Feb", value: 5400 },
    { date: "2025-03-01", month: "Mar", value: 5580 },
    { date: "2025-04-01", month: "Apr", value: 5500 },
    { date: "2025-05-01", month: "May", value: 5750 },
    { date: "2025-06-01", month: "Jun", value: 5900 },
    { date: "2025-07-01", month: "Jul", value: 6050 },
    { date: "2025-08-01", month: "Aug", value: 6200 },
    { date: "2025-09-01", month: "Sep", value: 6450 },
    { date: "2025-10-01", month: "Oct", value: 6100 },
    { date: "2025-11-01", month: "Nov", value: 6800 },
    { date: "2025-12-01", month: "Dec", value: 7150 },
    { date: "2026-01-01", month: "Jan", value: 7000 },
    { date: "2026-02-01", month: "Feb", value: 7600 },
    { date: "2026-03-01", month: "Mar", value: 7900 },
    { date: "2026-04-01", month: "Apr", value: 7700 },
    { date: "2026-05-01", month: "May", value: 8400 },
    { date: "2026-06-01", month: "Jun", value: 8850 },
    { date: "2026-07-01", month: "Jul", value: 9080.75 }
  ],
  sectorBreakdown: {
    Technology: 47.85,
    Funds: 40.1,
    "Consumer Cyclical": 12.05
  },
  diversificationScore: 72,
  riskLevel: "Moderate",
  observations: [
    "AAPL and NVDA contribute most of the portfolio's technology exposure.",
    "VOO provides broad-market diversification and is the largest individual position.",
    "TSLA is the only holding currently showing a loss in this sample portfolio."
  ],
  concentrationWarning: "Technology represents nearly half of the portfolio, which may increase sector concentration risk."
};


let currentHoldings = cloneHoldings(mockHoldings);
let currentAnalysis = cloneAnalysis(mockAnalysis);
let chatHistory = [];
let chatMode = "portfolio";
let supportRequest = null;
let selectedFile = null;
let historyChart = null;
let sectorChart = null;
let toastTimer = null;
let displayName = "Kevin";
let sharePortfolio = true;
let chartRange = "1Y";
let lastPortfolioUpdate = new Date();
let assistantCollapsed = false;
let lastFocusedHoldingRow = null;
let currentPageId = "dashboard-page";
let assistantCollapsedBeforeSupport = false;


const allowedExtensions = ["csv", "xls", "xlsx", "png", "jpg", "jpeg", "webp"];
const pageNames = {
  "dashboard-page": "Dashboard",
  "ingest-page": "Import Portfolio",
  "valuation-page": "Portfolio Analysis",
  "reports-page": "Reports",
  "support-page": "Live Support",
  "settings-page": "Settings"
};


const suggestedQuestions = {
  portfolio: [
    "Review my portfolio risk",
    "Explain my diversification score",
    "What is my largest position?"
  ],
  general: [
    "What is an ETF?",
    "Explain compound growth",
    "How does diversification reduce risk?"
  ]
};


function byId(id) {
  return document.getElementById(id);
}


function cloneHoldings(holdings) {
  return holdings.map((holding) => ({ ...holding }));
}


function cloneAnalysis(analysis) {
  return {
    ...analysis,
    history: Array.isArray(analysis.history)
      ? analysis.history.map((point) => ({ ...point }))
      : [],
    sectorBreakdown: Array.isArray(analysis.sectorBreakdown)
      ? analysis.sectorBreakdown.map((item) => ({ ...item }))
      : { ...(analysis.sectorBreakdown || {}) },
    observations: Array.isArray(analysis.observations)
      ? [...analysis.observations]
      : []
  };
}


function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}


function firstNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === "") {
      continue;
    }


    const number = Number(value);
    if (Number.isFinite(number)) {
      return number;
    }
  }
  return null;
}


function holdingTicker(holding) {
  return String(holding.ticker ?? holding.symbol ?? "Unknown");
}


function holdingName(holding) {
  return String(holding.name ?? holding.companyName ?? holding.company ?? "Not provided");
}


function holdingShares(holding) {
  return firstNumber(holding.shares, holding.quantity, holding.units) ?? 0;
}


function holdingPrice(holding) {
  return firstNumber(holding.currentPrice, holding.price, holding.marketPrice) ?? 0;
}


function holdingValue(holding) {
  const explicitValue = firstNumber(holding.totalValue, holding.value, holding.marketValue);
  return explicitValue ?? holdingShares(holding) * holdingPrice(holding);
}


function holdingGain(holding) {
  return firstNumber(holding.gainLoss, holding.gain, holding.profitLoss) ?? 0;
}


function holdingGainPercent(holding) {
  return firstNumber(holding.gainLossPercent, holding.gainPercent, holding.returnPercent) ?? 0;
}


function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }


  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "--";
  }


  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}


function formatPercent(value) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }


  const number = Number(value);
  if (!Number.isFinite(number)) {
    return "--";
  }


  const prefix = number > 0 ? "+" : "";
  return `${prefix}${number.toFixed(1)}%`;
}


function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "File selected";
  }


  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }


  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}


function setLoading(element, loading, loadingText = "Working...") {
  if (!element) {
    return;
  }


  if (loading) {
    element.dataset.originalLabel = element.textContent;
    element.textContent = loadingText;
    element.disabled = true;
    element.setAttribute("aria-busy", "true");
  } else {
    element.textContent = element.dataset.originalLabel || element.textContent;
    element.disabled = false;
    element.removeAttribute("aria-busy");
    delete element.dataset.originalLabel;
  }
}


function showToast(message, type = "success") {
  const toast = byId("toast");
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("error", type === "error");
  toast.classList.remove("hidden");


  toastTimer = window.setTimeout(() => {
    toast.classList.add("hidden");
  }, 3500);
}


function showError(message) {
  showToast(message || "Something went wrong. Please try again.", "error");
}


function refreshIcons(root = null) {
  if (!window.lucide) {
    return;
  }


  try {
    if (root) {
      window.lucide.createIcons({ root });
    } else {
      window.lucide.createIcons();
    }
  } catch (error) {
    try {
      window.lucide.createIcons();
    } catch (fallbackError) {
      // Text labels and accessible names keep the interface usable without icons.
    }
  }
}


function renderAssistantContext() {
  const context = byId("assistant-context-text");
  if (!context) {
    return;
  }


  if (chatMode === "general") {
    context.textContent = "General mode - no portfolio data shared";
  } else if (!sharePortfolio) {
    context.textContent = "Portfolio sharing is turned off";
  } else if (!currentHoldings.length) {
    context.textContent = "No portfolio imported";
  } else {
    const dataType = USE_MOCKS ? "demo data" : "live portfolio data";
    context.textContent = `Using ${currentHoldings.length} holdings from ${dataType}`;
  }
}


function updateDataStatus() {
  const status = byId("global-data-status");
  const label = byId("global-data-label");
  const updated = byId("last-updated");
  const hasPortfolio = Boolean(currentAnalysis && currentHoldings.length);


  status.classList.remove("demo", "live", "empty");
  if (!hasPortfolio) {
    status.classList.add("empty");
    label.textContent = "No portfolio";
    updated.textContent = "Import a portfolio to begin";
  } else {
    status.classList.add(USE_MOCKS ? "demo" : "live");
    label.textContent = USE_MOCKS ? "Demo data" : "Live data";
    updated.textContent = lastPortfolioUpdate
      ? `Updated ${lastPortfolioUpdate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
      : "Update unavailable";
  }


  const apiStatus = byId("api-status");
  if (apiStatus) {
    apiStatus.textContent = USE_MOCKS ? "Demo data" : "Django connected";
    apiStatus.classList.toggle("service-preview", USE_MOCKS);
  }
  renderAssistantContext();
}


function setAppProgress(loading, label = "Updating portfolio...") {
  const progress = byId("app-progress");
  byId("app-progress-label").textContent = label;
  progress.classList.toggle("hidden", !loading);
  progress.setAttribute("aria-busy", String(loading));
  byId("dashboard").setAttribute("aria-busy", String(loading));
}


function setAssistantCollapsed(collapsed) {
  assistantCollapsed = Boolean(collapsed);
  const panel = byId("assistant-panel");
  const button = byId("assistant-toggle");
  panel.classList.toggle("collapsed", assistantCollapsed);
  button.setAttribute("aria-expanded", String(!assistantCollapsed));
  button.setAttribute(
    "aria-label",
    assistantCollapsed ? "Expand Portfolio IQ Assistant" : "Collapse Portfolio IQ Assistant"
  );
  button.title = assistantCollapsed ? "Expand assistant" : "Collapse assistant";


  const icon = document.createElement("i");
  icon.dataset.lucide = assistantCollapsed ? "panel-right-open" : "panel-right-close";
  icon.setAttribute("aria-hidden", "true");
  button.replaceChildren(icon);
  refreshIcons(button);
}


function appendCell(row, text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) {
    cell.className = className;
  }
  row.appendChild(cell);
  return cell;
}


function appendEmptyRow(tbody, columnCount, message) {
  const row = document.createElement("tr");
  row.className = "empty-row";
  const cell = document.createElement("td");
  cell.colSpan = columnCount;
  cell.textContent = message;
  row.appendChild(cell);
  tbody.appendChild(row);
}


function renderHoldings(holdings) {
  const tbody = document.querySelector("#holdings-table tbody");
  closeHoldingDrawer(false);
  tbody.replaceChildren();
  byId("holdings-count").textContent = holdings.length
    ? `${holdings.length} positions`
    : "No positions";


  if (!holdings.length) {
    appendEmptyRow(tbody, 6, "Import a portfolio to see your holdings.");
    return;
  }


  holdings.forEach((holding) => {
    const row = document.createElement("tr");
    const gain = holdingGain(holding);
    const gainPercent = holdingGainPercent(holding);
    const gainClass = gain >= 0 ? "gain" : "loss";
    const arrow = gain >= 0 ? "\u25B2" : "\u25BC";


    const tickerCell = appendCell(row, holdingTicker(holding));
    const tickerStrong = document.createElement("strong");
    tickerStrong.textContent = tickerCell.textContent;
    tickerCell.replaceChildren(tickerStrong);


    appendCell(row, holdingName(holding));
    appendCell(row, String(holdingShares(holding)));
    appendCell(row, formatCurrency(holdingPrice(holding)));
    appendCell(row, formatCurrency(holdingValue(holding)));
    appendCell(
      row,
      `${arrow} ${formatCurrency(Math.abs(gain))} (${Math.abs(gainPercent).toFixed(2)}%)`,
      gainClass
    );
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `View details for ${holdingTicker(holding)} ${holdingName(holding)}`);
    row.addEventListener("click", () => openHoldingDrawer(holding, row));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openHoldingDrawer(holding, row);
      }
    });
    tbody.appendChild(row);
  });
}


function holdingInsight(holding, allocation) {
  if (allocation >= 35) {
    return `${holdingTicker(holding)} is a large position at ${allocation.toFixed(1)}% of the portfolio. Its price movement may have an outsized effect on total performance.`;
  }


  if (holdingGain(holding) < 0) {
    return `${holdingTicker(holding)} is currently below its estimated cost basis. Review the position alongside your time horizon and overall diversification.`;
  }


  return `${holdingTicker(holding)} represents ${allocation.toFixed(1)}% of the portfolio and is currently contributing positively to the displayed total return.`;
}


function openHoldingDrawer(holding, sourceRow) {
  const drawer = byId("holding-drawer");
  const backdrop = byId("drawer-backdrop");
  const value = holdingValue(holding);
  const gain = holdingGain(holding);
  const gainPercent = holdingGainPercent(holding);
  const total = currentHoldings.reduce((sum, item) => sum + holdingValue(item), 0);
  const allocation = total > 0 ? (value / total) * 100 : 0;
  const costBasis = value - gain;


  lastFocusedHoldingRow = sourceRow || null;
  byId("drawer-name").textContent = holdingName(holding);
  byId("drawer-ticker").textContent = holdingTicker(holding);
  byId("drawer-price").textContent = formatCurrency(holdingPrice(holding));
  byId("drawer-value").textContent = formatCurrency(value);
  byId("drawer-allocation").textContent = `${allocation.toFixed(1)}%`;
  byId("drawer-shares").textContent = String(holdingShares(holding));
  byId("drawer-cost-basis").textContent = formatCurrency(costBasis);
  byId("drawer-sector").textContent = String(holding.sector ?? "Not provided");


  const returnElement = byId("drawer-return");
  returnElement.textContent = `${formatCurrency(gain)} (${formatPercent(gainPercent)})`;
  returnElement.classList.toggle("gain", gain >= 0);
  returnElement.classList.toggle("loss", gain < 0);


  byId("drawer-allocation-label").textContent = `${allocation.toFixed(1)}% of portfolio`;
  byId("drawer-allocation-bar").style.width = `${Math.min(100, Math.max(0, allocation))}%`;
  byId("drawer-insight").textContent = holdingInsight(holding, allocation);


  backdrop.classList.remove("hidden");
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
  document.body.classList.add("drawer-open");
  drawer.focus();
}


function closeHoldingDrawer(restoreFocus = true) {
  const drawer = byId("holding-drawer");
  const backdrop = byId("drawer-backdrop");
  if (!drawer || drawer.classList.contains("hidden")) {
    return;
  }


  drawer.classList.add("hidden");
  backdrop.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
  document.body.classList.remove("drawer-open");


  if (restoreFocus && lastFocusedHoldingRow?.isConnected) {
    lastFocusedHoldingRow.focus();
  }
  lastFocusedHoldingRow = null;
}


function renderIngestHoldings(holdings) {
  const results = byId("ingest-results");
  const tbody = document.querySelector("#ingest-table tbody");
  tbody.replaceChildren();


  if (!holdings.length) {
    results.classList.add("hidden");
    return;
  }


  byId("ingest-count").textContent = `${holdings.length} holdings found`;
  holdings.forEach((holding) => {
    const row = document.createElement("tr");
    appendCell(row, holdingTicker(holding));
    appendCell(row, holdingName(holding));
    appendCell(row, String(holdingShares(holding)));
    appendCell(row, formatCurrency(holdingValue(holding)));
    tbody.appendChild(row);
  });
  results.classList.remove("hidden");
}


function analysisNumber(analysis, ...keys) {
  if (!analysis) {
    return null;
  }


  return firstNumber(...keys.map((key) => analysis[key]));
}


function setGrowthMetric(element, value) {
  const number = firstNumber(value);
  element.textContent = formatPercent(number);
  element.classList.toggle("green", number !== null && number >= 0);
  element.classList.toggle("loss", number !== null && number < 0);
}


function getHistory(analysis) {
  return Array.isArray(analysis?.history) ? analysis.history : [];
}


function normalizeSectorBreakdown(breakdown) {
  if (Array.isArray(breakdown)) {
    return breakdown
      .map((item) => ({
        label: String(item.sector ?? item.name ?? item.label ?? "Other"),
        value: firstNumber(item.value, item.percentage, item.percent) ?? 0
      }))
      .filter((item) => item.value > 0);
  }


  if (breakdown && typeof breakdown === "object") {
    return Object.entries(breakdown)
      .map(([label, value]) => ({ label, value: Number(value) }))
      .filter((item) => Number.isFinite(item.value) && item.value > 0);
  }


  return [];
}


function largestPosition() {
  if (!currentHoldings.length) {
    return "--";
  }


  const total = currentHoldings.reduce((sum, holding) => sum + holdingValue(holding), 0);
  const largest = currentHoldings.reduce((current, holding) =>
    holdingValue(holding) > holdingValue(current) ? holding : current
  );
  const percentage = total > 0 ? (holdingValue(largest) / total) * 100 : 0;
  return `${holdingTicker(largest)} ${percentage.toFixed(1)}%`;
}


function renderAnalysis(analysis) {
  const hasPortfolio = Boolean(analysis && currentHoldings.length);
  const totalValue = hasPortfolio
    ? analysisNumber(analysis, "totalValue", "portfolioValue", "value")
    : null;
  const ytdGrowth = hasPortfolio
    ? analysisNumber(analysis, "ytdGrowthPercent", "yearlyGrowthPercent", "growthPercent")
    : null;
  const overallGrowth = hasPortfolio
    ? analysisNumber(analysis, "overallGrowthPercent", "growth", "totalGrowthPercent")
    : null;


  byId("metric-total").textContent = hasPortfolio ? formatCurrency(totalValue) : "--";
  setGrowthMetric(byId("metric-ytd"), hasPortfolio ? ytdGrowth : null);
  setGrowthMetric(byId("metric-overall"), hasPortfolio ? overallGrowth : null);


  byId("dashboard-empty").classList.toggle("hidden", hasPortfolio);
  byId("dashboard-content").classList.toggle("hidden", !hasPortfolio);
  byId("valuation-empty").classList.toggle("hidden", hasPortfolio);
  byId("valuation-content").classList.toggle("hidden", !hasPortfolio);
  byId("reports-empty").classList.toggle("hidden", hasPortfolio);
  byId("reports-content").classList.toggle("hidden", !hasPortfolio);
  updateDataStatus();


  if (!hasPortfolio) {
    destroyCharts();
    renderReports(null);
    return;
  }


  const diversification = analysisNumber(analysis, "diversificationScore");
  const riskLevel = String(analysis.riskLevel ?? "Not available");
  const observations = Array.isArray(analysis.observations) ? analysis.observations : [];
  const warning = String(analysis.concentrationWarning ?? "No major concentration warning was returned.");


  byId("diversification-score").textContent = Number.isFinite(diversification)
    ? `${Math.round(diversification)}/100`
    : "--";
  byId("risk-level").textContent = riskLevel;
  byId("largest-position").textContent = largestPosition();


  const observationsList = byId("observations-list");
  observationsList.replaceChildren();
  if (observations.length) {
    observations.forEach((observation) => {
      const item = document.createElement("li");
      item.textContent = String(observation);
      observationsList.appendChild(item);
    });
  } else {
    const item = document.createElement("li");
    item.textContent = "No observations were returned for this portfolio.";
    observationsList.appendChild(item);
  }


  const warningPanel = byId("concentration-warning");
  warningPanel.textContent = warning;
  warningPanel.classList.toggle("good", !analysis.concentrationWarning);


  renderReports(analysis);


  if (!byId("dashboard-page").classList.contains("hidden")) {
    renderHistoryChart();
  }


  if (!byId("valuation-page").classList.contains("hidden")) {
    window.requestAnimationFrame(renderSectorChart);
  }
}


function historyForRange(history, range) {
  const pointCounts = { "1M": 2, "3M": 4, "1Y": 12 };
  const count = pointCounts[range];
  return count ? history.slice(-count) : history;
}


function historyPointLabel(point) {
  if (point.date) {
    const dateValue = String(point.date).includes("T") ? point.date : `${point.date}T00:00:00`;
    const date = new Date(dateValue);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("en-US", chartRange === "ALL"
        ? { month: "short", year: "2-digit" }
        : { month: "short" });
    }
  }


  return point.month ?? point.label ?? "";
}


function setChartRange(range) {
  if (!["1M", "3M", "1Y", "ALL"].includes(range)) {
    return;
  }


  chartRange = range;
  const periodLabels = {
    "1M": "Past month",
    "3M": "Past 3 months",
    "1Y": "Past year",
    ALL: "All available history"
  };
  byId("performance-period-label").textContent = periodLabels[range];


  document.querySelectorAll("[data-chart-range]").forEach((button) => {
    const active = button.dataset.chartRange === range;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderHistoryChart();
}


function renderHistoryChart() {
  if (!window.Chart || !currentAnalysis || !currentHoldings.length) {
    return;
  }


  if (historyChart) {
    historyChart.destroy();
    historyChart = null;
  }


  const history = historyForRange(getHistory(currentAnalysis), chartRange);
  if (!history.length) {
    return;
  }


  historyChart = new Chart(byId("history-chart"), {
    type: "line",
    data: {
      labels: history.map(historyPointLabel),
      datasets: [
        {
          label: "Portfolio Value",
          data: history.map((point) => firstNumber(point.value, point.totalValue) ?? 0),
          borderColor: "#2563eb",
          borderWidth: 2.5,
          pointRadius: history.length <= 4 ? 3 : 0,
          pointHoverRadius: 4,
          tension: 0.3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index"
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(148, 163, 184, 0.25)" },
          ticks: { color: "#64748b" }
        },
        y: {
          grid: { color: "rgba(148, 163, 184, 0.25)" },
          ticks: {
            color: "#64748b",
            callback(value) {
              return Number(value).toLocaleString("en-US");
            }
          }
        }
      }
    }
  });
}


function renderSectorChart() {
  if (!window.Chart || !currentAnalysis || !currentHoldings.length) {
    return;
  }


  if (sectorChart) {
    sectorChart.destroy();
    sectorChart = null;
  }


  const sectors = normalizeSectorBreakdown(currentAnalysis.sectorBreakdown);
  if (!sectors.length) {
    return;
  }


  sectorChart = new Chart(byId("sector-chart"), {
    type: "doughnut",
    data: {
      labels: sectors.map((sector) => sector.label),
      datasets: [
        {
          data: sectors.map((sector) => sector.value),
          backgroundColor: ["#2563eb", "#16a34a", "#f59e0b", "#9333ea", "#0891b2", "#dc2626"],
          borderColor: "#ffffff",
          borderWidth: 3,
          hoverOffset: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            color: "#475569",
            padding: 14
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${Number(context.raw).toFixed(1)}%`;
            }
          }
        }
      }
    }
  });
}


function destroyCharts() {
  if (historyChart) {
    historyChart.destroy();
    historyChart = null;
  }


  if (sectorChart) {
    sectorChart.destroy();
    sectorChart = null;
  }
}


function renderReports(analysis) {
  if (!analysis || !currentHoldings.length) {
    byId("report-value").textContent = "--";
    byId("report-holdings").textContent = "--";
    byId("report-risk").textContent = "--";
    byId("report-diversification").textContent = "--";
    byId("report-notes").replaceChildren();
    return;
  }


  const total = analysisNumber(analysis, "totalValue", "portfolioValue", "value");
  const diversification = analysisNumber(analysis, "diversificationScore");
  byId("report-value").textContent = formatCurrency(total);
  byId("report-holdings").textContent = String(currentHoldings.length);
  byId("report-risk").textContent = String(analysis.riskLevel ?? "Not available");
  byId("report-diversification").textContent = Number.isFinite(diversification)
    ? `${Math.round(diversification)}/100`
    : "--";
  const reportDate = lastPortfolioUpdate || new Date();
  byId("report-generated").textContent = `Updated ${reportDate.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  })}`;


  const notes = byId("report-notes");
  notes.replaceChildren();
  const observations = Array.isArray(analysis.observations) ? analysis.observations : [];
  observations.forEach((observation) => {
    const item = document.createElement("li");
    item.textContent = String(observation);
    notes.appendChild(item);
  });
}


function addChatMessage(role, text) {
  const message = document.createElement("div");
  message.className = `msg ${role}`;
  message.textContent = String(text);
  byId("chat-messages").appendChild(message);
  byId("chat-messages").scrollTop = byId("chat-messages").scrollHeight;


  if (role === "user" || role === "ai") {
    chatHistory.push({ role, text: String(text) });
  }


  return message;
}


async function readJsonResponse(response) {
  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }


  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}.`);
  }


  return data;
}


async function extractHoldings(file) {
  if (USE_MOCKS) {
    await wait(700);
    return cloneHoldings(mockHoldings);
  }


  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API}/extract/`, {
    method: "POST",
    body: formData
  });
  const data = await readJsonResponse(response);
  return Array.isArray(data.holdings) ? data.holdings : [];
}


async function analyzePortfolio(holdings) {
  if (USE_MOCKS) {
    await wait(650);
    return cloneAnalysis(mockAnalysis);
  }


  const response = await fetch(`${API}/analyze/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ holdings })
  });
  return readJsonResponse(response);
}


async function askAssistant(message, holdings) {
  if (USE_MOCKS) {
    await wait(750);
    return mockAssistantReply(message, holdings);
  }


  const response = await fetch(`${API}/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, holdings })
  });
  const data = await readJsonResponse(response);
  return data.reply || "The assistant returned an empty response.";
}


function mockAssistantReply(message, holdings) {
  const question = message.toLowerCase();


  if (chatMode === "general") {
    if (question.includes("compound")) {
      return "Compound growth means returns can earn additional returns over time. The result depends on the rate, time period, fees, and whether earnings are reinvested.";
    }


    if (question.includes("etf")) {
      return "An ETF is a fund that trades like a stock and can hold many investments. ETFs may offer diversification, but costs, strategy, and risk still vary by fund.";
    }


    return "I can explain financial concepts, investing terms, budgeting, and risk for educational purposes. I cannot guarantee outcomes or provide personalized financial advice.";
  }


  if (!holdings.length) {
    return "There is no portfolio connected to this chat. Import a portfolio or switch to General mode.";
  }


  if (question.includes("risk")) {
    return "This sample portfolio has moderate risk. Its main concern is that technology makes up nearly half of the value, so a technology-sector decline could affect several positions together.";
  }


  if (question.includes("divers")) {
    return "The sample diversification score is 72 out of 100. VOO adds broad-market exposure, while AAPL and NVDA create a meaningful technology concentration.";
  }


  if (question.includes("loss") || question.includes("losing")) {
    return "TSLA is the only position showing a loss in the current sample, down $206.25 or 15.87%. That observation is based only on the data displayed here.";
  }


  if (question.includes("largest") || question.includes("biggest")) {
    return `The largest position is ${largestPosition()}. Position size is one useful way to review concentration, but it does not determine whether an investment is suitable.`;
  }


  return "Based on the displayed holdings, AAPL and NVDA have driven much of the gain, VOO is the largest position, and TSLA is the only position currently showing a loss.";
}


async function sendChat() {
  const input = byId("chat-input");
  const sendButton = byId("chat-send");
  const message = input.value.trim();

  if (!message || sendButton.disabled) {
    return;
  }

  // Send the query to Gemini
  const baseUrl = API;
  
  // Define your query key-value pairs
  const queryParams = {
    q: message,
  };

  // Automatically format parameters to a query string: ?category=books&sort=recent_updates&limit=10
  const searchParams = new URLSearchParams(queryParams).toString();
  const finalUrl = `${baseUrl}/query?${searchParams}`;

  addChatMessage("user", message);
  input.value = "";
  byId("chat-suggestions").classList.add("hidden");
  const thinking = addChatMessage("thinking", "Thinking...");
  setLoading(sendButton, true, "...");

try {
    const response = await fetch(finalUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    console.log(data);

    try {
    const holdings = chatMode === "portfolio" && sharePortfolio ? currentHoldings : [];
    const reply = await askAssistant(message, holdings);
    thinking.remove();
    addChatMessage("ai", data['response']);
  } catch (error) {
    thinking.remove();
    addChatMessage("ai", error.message || "Could not reach the AI service.");
  } finally {
    setLoading(sendButton, false);
    input.focus();
  }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
  
}


function renderSuggestedPrompts() {
  const container = byId("chat-suggestions");
  container.replaceChildren();


  suggestedQuestions[chatMode].forEach((question) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.textContent = question;
    button.addEventListener("click", () => {
      byId("chat-input").value = question;
      sendChat();
    });
    container.appendChild(button);
  });


  container.classList.remove("hidden");
}


function setChatMode(mode) {
  chatMode = mode === "general" ? "general" : "portfolio";
  renderAssistantContext();
  document.querySelectorAll("[data-chat-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.chatMode === chatMode);
  });


  const input = byId("chat-input");
  renderSuggestedPrompts();
  if (chatMode === "general") {
    input.placeholder = "Ask a general finance question...";
    addChatMessage("ai", "General mode is on. Portfolio holdings will not be included.");
  } else {
    input.placeholder = "Ask about your portfolio...";
    addChatMessage("ai", sharePortfolio
      ? "Portfolio mode is on. I can use the holdings shown in the dashboard."
      : "Portfolio sharing is off in Settings, so holdings will not be included.");
  }
}


function showPage(pageId) {
  const target = byId(pageId);
  if (!target) {
    return;
  }


  const enteringSupport = pageId === "support-page" && currentPageId !== "support-page";
  const leavingSupport = currentPageId === "support-page" && pageId !== "support-page";
  if (enteringSupport) {
    assistantCollapsedBeforeSupport = assistantCollapsed;
    setAssistantCollapsed(true);
  } else if (leavingSupport && !assistantCollapsedBeforeSupport) {
    setAssistantCollapsed(false);
  }
  currentPageId = pageId;


  closeHoldingDrawer(false);
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("hidden", page.id !== pageId);
  });


  document.querySelectorAll(".sidebar .nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.page === pageId);
  });


  byId("page-label").textContent = pageNames[pageId] || "Portfolio IQ";


  if (pageId === "dashboard-page") {
    window.requestAnimationFrame(renderHistoryChart);
  } else if (pageId === "valuation-page") {
    window.requestAnimationFrame(renderSectorChart);
  } else if (pageId === "reports-page") {
    renderReports(currentAnalysis);
  } else if (pageId === "support-page") {
    renderSupportRequest();
    updateSupportCharacterCount();
  }
}


function updateUserDisplay() {
  const safeName = displayName.trim() || "Kevin";
  byId("user-name").textContent = safeName;
  byId("user-avatar").textContent = safeName.charAt(0).toUpperCase();
  byId("display-name").value = safeName;
}


function nameFromEmail(email) {
  const localPart = email.trim().split("@")[0];
  if (!localPart) {
    return "Kevin";
  }


  return localPart
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Kevin";
}


function showDashboard() {
  displayName = nameFromEmail(byId("email").value);
  updateUserDisplay();
  byId("login-screen").classList.add("hidden");
  byId("dashboard").classList.remove("hidden");
  renderHoldings(currentHoldings);
  renderIngestHoldings(currentHoldings);
  renderAnalysis(currentAnalysis);
  showPage("dashboard-page");
  setAssistantCollapsed(false);
  updateDataStatus();


  if (!byId("chat-messages").children.length) {
    addChatMessage("ai", "Hi, I'm Portfolio IQ Assistant. I can explain your portfolio or general finance concepts.");
  }


  renderSuggestedPrompts();
}


function signOut() {
  supportRequest = null;
  renderSupportRequest();
  closeHoldingDrawer(false);
  setAssistantCollapsed(false);
  byId("dashboard").classList.add("hidden");
  byId("login-screen").classList.remove("hidden");
  byId("password").value = "";
  byId("email").focus();
}


function validateFile(file) {
  if (!file) {
    return "Choose a portfolio file first.";
  }


  const extension = file.name.includes(".")
    ? file.name.split(".").pop().toLowerCase()
    : "";


  if (!allowedExtensions.includes(extension)) {
    return "Use a CSV, Excel, PNG, JPG, or WebP file.";
  }


  return "";
}


function selectFile(file) {
  const errorMessage = validateFile(file);
  if (errorMessage) {
    showError(errorMessage);
    return;
  }

  selectedFile = file;
  byId("file-name").textContent = file.name;
  byId("file-size").textContent = formatFileSize(file.size);
  byId("file-summary").classList.remove("hidden");
  byId("analyze-file").disabled = false;
  byId("upload-status").textContent = "Ready to analyze.";
  byId("upload-status").className = "inline-status";
}


function clearSelectedFile() {
  selectedFile = null;
  byId("portfolio-file").value = "";
  byId("file-summary").classList.add("hidden");
  byId("analyze-file").disabled = true;
  byId("upload-status").textContent = "";
  byId("upload-status").className = "inline-status";
}


async function processSelectedFile() {
  const errorMessage = validateFile(selectedFile);
  if (errorMessage) {
    showError(errorMessage);
    return;
  }


  const analyzeButton = byId("analyze-file");
  const status = byId("upload-status");
  setLoading(analyzeButton, true, "Analyzing...");
  setAppProgress(true, "Extracting holdings from your portfolio...");
  status.textContent = "Extracting holdings from your file...";
  status.className = "inline-status";

  // FIXME:
  // Inject POST of the file
  let formData = new FormData();
     
  formData.append("file", selectedFile);
  fetch('/upload', {method: "POST", body: formData})
  //console.log(selectedFile)

  try {
    const holdings = await extractHoldings(selectedFile);
    if (!holdings.length) {
      throw new Error("No holdings were found in that file.");
    }


    status.textContent = "Holdings extracted. Generating portfolio analysis...";
    setAppProgress(true, "Generating performance and risk insights...");
    const analysis = await analyzePortfolio(holdings);
    currentHoldings = holdings;
    currentAnalysis = analysis;
    lastPortfolioUpdate = new Date();
    renderHoldings(currentHoldings);
    renderIngestHoldings(currentHoldings);
    renderAnalysis(currentAnalysis);
    status.textContent = USE_MOCKS
      ? "Demo analysis complete. Sample holdings are ready."
      : "Portfolio analysis complete.";
    status.className = "inline-status success";
    updateDataStatus();
    showToast("Portfolio is ready. Open Dashboard or Portfolio Analysis to review it.");
  } catch (error) {
    status.textContent = error.message || "The portfolio could not be analyzed.";
    status.className = "inline-status error";
    showError(status.textContent);
  } finally {
    setAppProgress(false);
    setLoading(analyzeButton, false);
    analyzeButton.disabled = !selectedFile;
  }
}


function loadSamplePortfolio(message = "Sample portfolio restored.") {
  currentHoldings = cloneHoldings(mockHoldings);
  currentAnalysis = cloneAnalysis(mockAnalysis);
  lastPortfolioUpdate = new Date();
  renderHoldings(currentHoldings);
  renderIngestHoldings(currentHoldings);
  renderAnalysis(currentAnalysis);
  byId("upload-status").textContent = "Sample portfolio is loaded.";
  byId("upload-status").className = "inline-status success";
  updateDataStatus();
  showToast(message);
}


function removePortfolio() {
  if (!currentHoldings.length) {
    showToast("There is no portfolio to remove.");
    return;
  }


  const confirmed = window.confirm("Remove the current portfolio from this development session?");
  if (!confirmed) {
    return;
  }


  currentHoldings = [];
  currentAnalysis = null;
  lastPortfolioUpdate = null;
  supportRequest = null;
  clearSelectedFile();
  renderHoldings(currentHoldings);
  renderIngestHoldings(currentHoldings);
  renderAnalysis(currentAnalysis);
  updateDataStatus();
  showToast("Portfolio removed from this session.");
}


function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}


function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}


function downloadCsvReport() {
  if (!currentHoldings.length) {
    showError("Import a portfolio before downloading a report.");
    return;
  }


  const rows = [
    ["Ticker", "Name", "Shares", "Current Price", "Total Value", "Gain/Loss", "Gain/Loss Percent"],
    ...currentHoldings.map((holding) => [
      holdingTicker(holding),
      holdingName(holding),
      holdingShares(holding),
      holdingPrice(holding),
      holdingValue(holding),
      holdingGain(holding),
      holdingGainPercent(holding)
    ])
  ];
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
  downloadFile("portfolio-iq-holdings.csv", csv, "text/csv;charset=utf-8");
  showToast("CSV report downloaded.");
}


function downloadSummaryReport() {
  if (!currentAnalysis || !currentHoldings.length) {
    showError("Import a portfolio before downloading a summary.");
    return;
  }


  const observations = Array.isArray(currentAnalysis.observations)
    ? currentAnalysis.observations.map((item) => `- ${item}`).join("\r\n")
    : "- No observations available";
  const report = [
    "PORTFOLIO IQ SUMMARY",
    `Generated: ${new Date().toLocaleString("en-US")}`,
    "",
    `Total value: ${formatCurrency(analysisNumber(currentAnalysis, "totalValue", "portfolioValue", "value"))}`,
    `Holdings: ${currentHoldings.length}`,
    `Risk level: ${currentAnalysis.riskLevel ?? "Not available"}`,
    `Diversification: ${analysisNumber(currentAnalysis, "diversificationScore") ?? "Not available"}/100`,
    `Largest position: ${largestPosition()}`,
    "",
    "OBSERVATIONS",
    observations,
    "",
    `Concentration warning: ${currentAnalysis.concentrationWarning ?? "None returned"}`,
    "",
    "Educational information only, not financial advice."
  ].join("\r\n");


  downloadFile("portfolio-iq-summary.txt", report, "text/plain;charset=utf-8");
  showToast("Summary report downloaded.");
}


function updateSupportCharacterCount() {
  const message = byId("support-message").value;
  byId("support-character-count").textContent = `${message.length}/800`;
}


function renderSupportRequest() {
  const summary = byId("support-request-summary");
  if (!supportRequest) {
    summary.classList.add("hidden");
    return;
  }


  byId("support-summary-topic").textContent = supportRequest.topic;
  byId("support-summary-time").textContent = new Date(supportRequest.createdAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });


  const sharedItems = [];
  if (supportRequest.sharePortfolio) {
    sharedItems.push(`${supportRequest.holdingsCount} portfolio positions`);
  }
  if (supportRequest.shareChat) {
    sharedItems.push(`${supportRequest.chatMessageCount} assistant messages`);
  }


  byId("support-share-summary").textContent = sharedItems.length
    ? `Selected context: ${sharedItems.join(" and ")}.`
    : "Only the written support request is included.";
  summary.classList.remove("hidden");
}


async function prepareSupportRequest(event) {
  event.preventDefault();
  const form = byId("support-form");
  const status = byId("support-form-status");
  const button = byId("prepare-support-request");


  if (!form.reportValidity()) {
    status.textContent = "Complete the required fields and consent before continuing.";
    status.className = "inline-status error";
    return;
  }


  setLoading(button, true, "Preparing...");
  status.textContent = "Preparing a secure handoff summary...";
  status.className = "inline-status";


  await wait(450);
  supportRequest = {
    topic: byId("support-topic").value,
    message: byId("support-message").value.trim(),
    sharePortfolio: byId("support-share-portfolio").checked,
    shareChat: byId("support-share-chat").checked,
    holdingsCount: currentHoldings.length,
    chatMessageCount: chatHistory.length,
    createdAt: new Date().toISOString()
  };


  renderSupportRequest();
  status.textContent = "Draft saved locally. The live-agent backend is not connected yet.";
  status.className = "inline-status success";
  setLoading(button, false);
  showToast("Live Support request draft prepared.");
}


function clearSupportDraft() {
  supportRequest = null;
  byId("support-form").reset();
  byId("support-form-status").textContent = "Draft cleared.";
  byId("support-form-status").className = "inline-status";
  updateSupportCharacterCount();
  renderSupportRequest();
}


function prefillSupportFromChat() {
  const message = byId("support-message");
  if (message.value.trim()) {
    return;
  }


  const latestQuestion = [...chatHistory].reverse().find((entry) => entry.role === "user");
  if (latestQuestion) {
    message.value = `I need help with this question: ${latestQuestion.text}`;
    updateSupportCharacterCount();
  }
}


function initializeEvents() {
  byId("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    // Inject a POST event to indicate a user of any type is logging in
    showDashboard();
  });


  document.querySelectorAll("[data-page]").forEach((element) => {
    element.addEventListener("click", () => showPage(element.dataset.page));
  });


  byId("profile-shortcut").addEventListener("click", () => showPage("settings-page"));
  byId("sign-out").addEventListener("click", signOut);
  byId("open-live-support").addEventListener("click", prefillSupportFromChat);
  byId("assistant-toggle").addEventListener("click", () => {
    setAssistantCollapsed(!assistantCollapsed);
  });


  document.querySelectorAll("[data-chart-range]").forEach((button) => {
    button.addEventListener("click", () => setChartRange(button.dataset.chartRange));
  });


  byId("close-holding-drawer").addEventListener("click", () => closeHoldingDrawer());
  byId("drawer-backdrop").addEventListener("click", () => closeHoldingDrawer());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeHoldingDrawer();
      return;
    }


    const drawer = byId("holding-drawer");
    if (event.key === "Tab" && !drawer.classList.contains("hidden")) {
      const focusable = [...drawer.querySelectorAll("button:not([disabled]), [href], input, select, textarea")];
      if (!focusable.length) {
        event.preventDefault();
        drawer.focus();
        return;
      }


      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!drawer.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });


  byId("chat-send").addEventListener("click", sendChat);
  byId("chat-input").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      sendChat();
    }
  });


  document.querySelectorAll("[data-chat-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.chatMode !== chatMode) {
        setChatMode(button.dataset.chatMode);
      }
    });
  });


  const fileInput = byId("portfolio-file");
  const dropZone = byId("drop-zone");
  byId("choose-file").addEventListener("click", (event) => {
    event.stopPropagation();
    fileInput.click();
  });
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) {
      selectFile(fileInput.files[0]);
    }
  });


  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    });
  });
  dropZone.addEventListener("drop", (event) => selectFile(event.dataTransfer.files[0]));


  byId("clear-file").addEventListener("click", clearSelectedFile);
  byId("analyze-file").addEventListener("click", processSelectedFile);
  byId("use-sample").addEventListener("click", () => loadSamplePortfolio("Sample portfolio loaded."));
  byId("remove-portfolio").addEventListener("click", removePortfolio);
  byId("restore-sample").addEventListener("click", () => loadSamplePortfolio());


  byId("download-csv").addEventListener("click", downloadCsvReport);
  byId("download-summary").addEventListener("click", downloadSummaryReport);
  byId("print-report").addEventListener("click", () => window.print());


  byId("support-form").addEventListener("submit", prepareSupportRequest);
  byId("support-message").addEventListener("input", updateSupportCharacterCount);
  byId("clear-support-draft").addEventListener("click", clearSupportDraft);


  byId("settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    displayName = byId("display-name").value.trim() || "Kevin";
    sharePortfolio = byId("share-portfolio").checked;
    updateUserDisplay();
    renderAssistantContext();
    showToast("Settings saved for this session.");
  });
}


function initializeApp() {
  initializeEvents();
  refreshIcons();
  setAssistantCollapsed(false);
  byId("share-portfolio").checked = sharePortfolio;
  renderSuggestedPrompts();
  renderSupportRequest();
  updateSupportCharacterCount();
  updateDataStatus();
  updateUserDisplay();
  byId("email").focus();
}


document.addEventListener("DOMContentLoaded", initializeApp);
// ===== LOGIN BACKGROUND — layered market constellation =====
(function loginBackground() {
  const canvas = document.getElementById("login-bg");
  const loginScreen = document.getElementById("login-screen");
  if (!canvas || !loginScreen) return;
  const c = canvas.getContext("2d");
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  let W, H;
  function resize() {
    W = canvas.offsetWidth; H = canvas.offsetHeight;
    canvas.width = W * DPR; canvas.height = H * DPR;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  window.addEventListener("mousemove", (e) => {
    mouse.tx = e.clientX / window.innerWidth;
    mouse.ty = e.clientY / window.innerHeight;
  });

  const LAYERS = [
    { count: 30, size: [0.8, 1.4], speed: 0.10, alpha: 0.35, parallax: 6 },
    { count: 22, size: [1.4, 2.2], speed: 0.18, alpha: 0.55, parallax: 14 },
    { count: 14, size: [2.2, 3.2], speed: 0.28, alpha: 0.85, parallax: 26 },
  ];

  const particles = [];
  LAYERS.forEach((layer, li) => {
    for (let i = 0; i < layer.count; i++) {
      particles.push({
        layer: li,
        x: Math.random() * 1.2 - 0.1,
        y: Math.random() * 1.2 - 0.1,
        vx: (Math.random() - 0.5) * layer.speed * 0.006,
        vy: -(0.3 + Math.random() * 0.7) * layer.speed * 0.006,
        r: layer.size[0] + Math.random() * (layer.size[1] - layer.size[0]),
        green: Math.random() > 0.22,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  });

  let t = 0;
  function frame() {
    if (loginScreen.classList.contains("hidden") || loginScreen.offsetParent === null) {
      requestAnimationFrame(frame);
      return;
    }
    t += 0.016;

    mouse.x += (mouse.tx - mouse.x) * 0.04;
    mouse.y += (mouse.ty - mouse.y) * 0.04;

    c.clearRect(0, 0, W, H);

    const grid = 90;
    const drift = (t * 4) % grid;
    c.strokeStyle = "rgba(139, 148, 158, 0.045)";
    c.lineWidth = 1;
    for (let x = -drift; x < W; x += grid) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
    }
    for (let y = 0; y < H; y += grid) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }

    const pts = particles.map((p) => {
      const px = (mouse.x - 0.5) * LAYERS[p.layer].parallax;
      const py = (mouse.y - 0.5) * LAYERS[p.layer].parallax;
      return { p, x: p.x * W + px, y: p.y * H + py };
    });

    for (let i = 0; i < pts.length; i++) {
      if (pts[i].p.layer !== 2) continue;
      for (let j = i + 1; j < pts.length; j++) {
        if (pts[j].p.layer !== 2) continue;
        const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
        const d = Math.hypot(dx, dy);
        if (d < 130) {
          c.strokeStyle = `rgba(0, 200, 5, ${0.10 * (1 - d / 130)})`;
          c.beginPath();
          c.moveTo(pts[i].x, pts[i].y);
          c.lineTo(pts[j].x, pts[j].y);
          c.stroke();
        }
      }
    }

    pts.forEach(({ p, x, y }) => {
      p.x += p.vx; p.y += p.vy;
      if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      if (p.x < -0.05) p.x = 1.05;
      if (p.x > 1.05) p.x = -0.05;

      const layer = LAYERS[p.layer];
      const pulse = 0.85 + 0.15 * Math.sin(t * 1.4 + p.pulse);
      const color = p.green ? "0, 200, 5" : "255, 80, 0";

      if (p.layer === 2) {
        c.shadowBlur = 10;
        c.shadowColor = `rgba(${color}, 0.6)`;
      }
      c.fillStyle = `rgba(${color}, ${layer.alpha * pulse})`;
      c.beginPath();
      c.arc(x, y, p.r * pulse, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    });

    requestAnimationFrame(frame);
  }
  frame();
})();
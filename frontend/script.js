"use strict";

// Keep mock mode enabled until the Django API contract is finalized.
const USE_MOCKS = true;
const API = "http://localhost:8000";

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
    { month: "Aug", value: 6200 },
    { month: "Sep", value: 6450 },
    { month: "Oct", value: 6100 },
    { month: "Nov", value: 6800 },
    { month: "Dec", value: 7150 },
    { month: "Jan", value: 7000 },
    { month: "Feb", value: 7600 },
    { month: "Mar", value: 7900 },
    { month: "Apr", value: 7700 },
    { month: "May", value: 8400 },
    { month: "Jun", value: 8850 },
    { month: "Jul", value: 9080.75 }
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

const allowedExtensions = ["csv", "xls", "xlsx", "png", "jpg", "jpeg", "webp"];
const pageNames = {
  "dashboard-page": "Dashboard",
  "ingest-page": "Data Ingest",
  "valuation-page": "Valuation",
  "reports-page": "Reports",
  "settings-page": "Settings"
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
    tbody.appendChild(row);
  });
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

  byId("valuation-empty").classList.toggle("hidden", hasPortfolio);
  byId("valuation-content").classList.toggle("hidden", !hasPortfolio);
  byId("reports-empty").classList.toggle("hidden", hasPortfolio);
  byId("reports-content").classList.toggle("hidden", !hasPortfolio);

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

function renderHistoryChart() {
  if (!window.Chart || !currentAnalysis || !currentHoldings.length) {
    return;
  }

  if (historyChart) {
    historyChart.destroy();
    historyChart = null;
  }

  const history = getHistory(currentAnalysis);
  if (!history.length) {
    return;
  }

  historyChart = new Chart(byId("history-chart"), {

  const ctx = document.getElementById("history-chart").getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, "rgba(0, 200, 5, 0.25)");
  grad.addColorStop(1, "rgba(0, 200, 5, 0)");

  new Chart(ctx, {
    type: "line",
    data: {
      labels: history.map((point) => point.month ?? point.date ?? point.label ?? ""),
      datasets: [
        {
          label: "Portfolio Value",
          data: history.map((point) => firstNumber(point.value, point.totalValue) ?? 0),
          borderColor: "#2563eb",
          borderWidth: 2.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.3,
          fill: false
        }
      ]
      labels: mockHistory.map((p) => p.month),
      datasets: [{
        label: "Portfolio Value",
        data: mockHistory.map((p) => p.value),
        borderColor: "#00C805",
        backgroundColor: grad,
        fill: true,
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.35,
      }],
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
  byId("report-generated").textContent = `Updated ${new Date().toLocaleString("en-US", {
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
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#8b949e" } },
        y: { grid: { color: "rgba(139,148,158,0.12)" }, ticks: { color: "#8b949e", callback: (v) => "$" + v.toLocaleString() } },
      },
    },
  });

  addChatMessage("ai", "Hi! Ask me anything about your portfolio.");
}

// ===== CHAT =====
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");

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
    return "There is no portfolio connected to this chat. Import one from Data Ingest or switch to General mode.";
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

  addChatMessage("user", message);
  input.value = "";
  const thinking = addChatMessage("thinking", "Thinking...");
  setLoading(sendButton, true, "...");

  try {
    const holdings = chatMode === "portfolio" && sharePortfolio ? currentHoldings : [];
    const reply = await askAssistant(message, holdings);
    thinking.remove();
    addChatMessage("ai", reply);
  } catch (error) {
    thinking.remove();
    addChatMessage("ai", error.message || "Could not reach the AI service.");
  } finally {
    setLoading(sendButton, false);
    input.focus();
  }
}

function setChatMode(mode) {
  chatMode = mode === "general" ? "general" : "portfolio";
  document.querySelectorAll("[data-chat-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.chatMode === chatMode);
  });

  const input = byId("chat-input");
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

  if (!byId("chat-messages").children.length) {
    addChatMessage("ai", "Hi! Ask me anything about your portfolio.");
  }
}

function signOut() {
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
  status.textContent = "Extracting holdings from your file...";
  status.className = "inline-status";

  try {
    const holdings = await extractHoldings(selectedFile);
    if (!holdings.length) {
      throw new Error("No holdings were found in that file.");
    }

    status.textContent = "Holdings extracted. Generating portfolio analysis...";
    const analysis = await analyzePortfolio(holdings);
    currentHoldings = holdings;
    currentAnalysis = analysis;
    renderHoldings(currentHoldings);
    renderIngestHoldings(currentHoldings);
    renderAnalysis(currentAnalysis);
    status.textContent = USE_MOCKS
      ? "Mock analysis complete. Sample holdings are ready."
      : "Portfolio analysis complete.";
    status.className = "inline-status success";
    showToast("Portfolio is ready. Open Dashboard or Valuation to review it.");
  } catch (error) {
    status.textContent = error.message || "The portfolio could not be analyzed.";
    status.className = "inline-status error";
    showError(status.textContent);
  } finally {
    setLoading(analyzeButton, false);
    analyzeButton.disabled = !selectedFile;
  }
}

function loadSamplePortfolio(message = "Sample portfolio restored.") {
  currentHoldings = cloneHoldings(mockHoldings);
  currentAnalysis = cloneAnalysis(mockAnalysis);
  renderHoldings(currentHoldings);
  renderIngestHoldings(currentHoldings);
  renderAnalysis(currentAnalysis);
  byId("upload-status").textContent = "Sample portfolio is loaded.";
  byId("upload-status").className = "inline-status success";
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
  supportRequest = null;
  clearSelectedFile();
  renderHoldings(currentHoldings);
  renderIngestHoldings(currentHoldings);
  renderAnalysis(currentAnalysis);
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

function initializeEvents() {
  byId("login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    showDashboard();
  });

  document.querySelectorAll("[data-page]").forEach((element) => {
    element.addEventListener("click", () => showPage(element.dataset.page));
  });

  byId("profile-shortcut").addEventListener("click", () => showPage("settings-page"));
  byId("sign-out").addEventListener("click", signOut);

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

  byId("settings-form").addEventListener("submit", (event) => {
    event.preventDefault();
    displayName = byId("display-name").value.trim() || "Kevin";
    sharePortfolio = byId("share-portfolio").checked;
    updateUserDisplay();
    showToast("Settings saved for this session.");
  });
}

function initializeApp() {
  initializeEvents();
  byId("api-status").textContent = USE_MOCKS ? "Mock mode" : "Django connected";
  byId("share-portfolio").checked = sharePortfolio;
  updateUserDisplay();
  byId("email").focus();
}

document.addEventListener("DOMContentLoaded", initializeApp);

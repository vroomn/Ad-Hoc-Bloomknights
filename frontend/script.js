// ===== CONFIG =====
const USE_MOCKS = true;
const API = "http://localhost:8000";

// ===== MOCK DATA =====
const mockHoldings = [
  {
    ticker: "AAPL",
    name: "Apple Inc",
    shares: 10,
    currentPrice: 189.50,
    totalValue: 1895.00,
    gainLoss: 443.00,
    gainLossPercent: 30.51
  },
  {
    ticker: "TSLA",
    name: "Tesla Inc",
    shares: 5,
    currentPrice: 218.75,
    totalValue: 1093.75,
    gainLoss: -206.25,
    gainLossPercent: -15.87
  },
  {
    ticker: "VOO",
    name: "Vanguard S&P 500 ETF",
    shares: 8,
    currentPrice: 455.30,
    totalValue: 3642.40,
    gainLoss: 521.60,
    gainLossPercent: 16.72
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corp",
    shares: 4,
    currentPrice: 612.40,
    totalValue: 2449.60,
    gainLoss: 529.60,
    gainLossPercent: 27.58
  }
];

const mockHistory = [
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
  { month: "Jul", value: 9080 }
];

const mockMetrics = {
  totalValue: 9080.75,
  ytdGrowthPercent: 29.7,
  overallGrowthPercent: 46.5
};

const mockChatReply =
  "Based on your holdings, your portfolio leans heavily on technology. AAPL and NVDA have driven most of your gains, while TSLA is your only losing position.";

// Prevent the chart from being created twice.
let historyChart = null;

// ===== HELPERS =====
function formatMoney(number) {
  return number.toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

// ===== DASHBOARD =====
function initDashboard() {
  document.getElementById("metric-total").textContent =
    formatMoney(mockMetrics.totalValue);

  document.getElementById("metric-ytd").textContent =
    `+${mockMetrics.ytdGrowthPercent}%`;

  document.getElementById("metric-overall").textContent =
    `+${mockMetrics.overallGrowthPercent}%`;

  const tbody = document.querySelector("#holdings-table tbody");
  tbody.innerHTML = "";

  mockHoldings.forEach((holding) => {
    const row = document.createElement("tr");
    const gainClass = holding.gainLoss >= 0 ? "gain" : "loss";
    const arrow = holding.gainLoss >= 0 ? "▲" : "▼";

    row.innerHTML = `
      <td><strong>${holding.ticker}</strong></td>
      <td>${holding.name}</td>
      <td>${holding.shares}</td>
      <td>${formatMoney(holding.currentPrice)}</td>
      <td>${formatMoney(holding.totalValue)}</td>
      <td class="${gainClass}">
        ${arrow} ${formatMoney(Math.abs(holding.gainLoss))}
        (${holding.gainLossPercent}%)
      </td>
    `;

    tbody.appendChild(row);
  });

  const chartCanvas = document.getElementById("history-chart");

  if (historyChart) {
    historyChart.destroy();
  }

  historyChart = new Chart(chartCanvas, {
    type: "line",
    data: {
      labels: mockHistory.map((point) => point.month),
      datasets: [
        {
          label: "Portfolio Value",
          data: mockHistory.map((point) => point.value),
          borderColor: "#2563eb",
          borderWidth: 2.5,
          pointRadius: 0,
          tension: 0.3
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });

  const chatMessages = document.getElementById("chat-messages");

  if (chatMessages.children.length === 0) {
    addChatMessage("ai", "Hi! Ask me anything about your portfolio.");
  }
}

function showDashboard() {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  initDashboard();
}

// ===== LOGIN =====
document.getElementById("login-btn").addEventListener("click", showDashboard);

// ===== CHAT =====
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatSend = document.getElementById("chat-send");

function addChatMessage(role, text) {
  const message = document.createElement("div");
  message.className = `msg ${role}`;
  message.textContent = text;

  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  return message;
}

async function sendChat() {
  const text = chatInput.value.trim();

  if (!text) {
    return;
  }

  addChatMessage("user", text);
  chatInput.value = "";

  const thinking = addChatMessage("thinking", "Thinking…");

  try {
    let reply;

    if (USE_MOCKS) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      reply = mockChatReply;
    } else {
      const response = await fetch(`${API}/chat/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: text,
          holdings: mockHoldings
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Chat request failed.");
      }

      reply = data.reply;
    }

    thinking.remove();
    addChatMessage("ai", reply);
  } catch (error) {
    thinking.remove();
    addChatMessage("ai", "Couldn't reach the AI service.");
  }
}

chatSend.addEventListener("click", sendChat);

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendChat();
  }
});

// ===== TEMPORARY DEVELOPMENT BYPASS =====
// This skips the login while you are building.
showDashboard();

// ===== CONFIG =====
const USE_MOCKS = true;               // flip to false when backend is live
const API = "http://localhost:8000";

// ===== MOCK DATA =====
const mockHoldings = [
  { ticker: "AAPL", name: "Apple Inc", shares: 10, currentPrice: 189.50, totalValue: 1895.00, gainLoss: 443.00, gainLossPercent: 30.51 },
  { ticker: "TSLA", name: "Tesla Inc", shares: 5, currentPrice: 218.75, totalValue: 1093.75, gainLoss: -206.25, gainLossPercent: -15.87 },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", shares: 8, currentPrice: 455.30, totalValue: 3642.40, gainLoss: 521.60, gainLossPercent: 16.72 },
  { ticker: "NVDA", name: "NVIDIA Corp", shares: 4, currentPrice: 612.40, totalValue: 2449.60, gainLoss: 529.60, gainLossPercent: 27.58 },
];

const mockHistory = [
  { month: "Aug", value: 6200 }, { month: "Sep", value: 6450 }, { month: "Oct", value: 6100 },
  { month: "Nov", value: 6800 }, { month: "Dec", value: 7150 }, { month: "Jan", value: 7000 },
  { month: "Feb", value: 7600 }, { month: "Mar", value: 7900 }, { month: "Apr", value: 7700 },
  { month: "May", value: 8400 }, { month: "Jun", value: 8850 }, { month: "Jul", value: 9080 },
];

const mockMetrics = { totalValue: 9080.75, ytdGrowthPercent: 29.7, overallGrowthPercent: 46.5 };

const mockChatReply = "Based on your holdings, your portfolio leans heavily on technology (~48%). AAPL and NVDA have driven most of your gains, while TSLA is your only losing position. Consider whether your VOO allocation gives enough diversification against a tech downturn.";

// ===== LOGIN =====
document.getElementById("login-btn").addEventListener("click", () => {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");
  initDashboard();
});

// ===== DASHBOARD =====
const fmt = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function initDashboard() {
  document.getElementById("metric-total").textContent = fmt(mockMetrics.totalValue);
  document.getElementById("metric-ytd").textContent = `+${mockMetrics.ytdGrowthPercent}%`;
  document.getElementById("metric-overall").textContent = `+${mockMetrics.overallGrowthPercent}%`;

  const tbody = document.querySelector("#holdings-table tbody");
  tbody.innerHTML = "";
  mockHoldings.forEach((h) => {
    const row = document.createElement("tr");
    const cls = h.gainLoss >= 0 ? "gain" : "loss";
    const arrow = h.gainLoss >= 0 ? "▲" : "▼";
    row.innerHTML = `
      <td><strong>${h.ticker}</strong></td>
      <td>${h.name}</td>
      <td>${h.shares}</td>
      <td>${fmt(h.currentPrice)}</td>
      <td>${fmt(h.totalValue)}</td>
      <td class="${cls}">${arrow} ${fmt(Math.abs(h.gainLoss))} (${h.gainLossPercent}%)</td>`;
    tbody.appendChild(row);
  });

  new Chart(document.getElementById("history-chart"), {
    type: "line",
    data: {
      labels: mockHistory.map((p) => p.month),
      datasets: [{
        label: "Portfolio Value",
        data: mockHistory.map((p) => p.value),
        borderColor: "#2563eb",
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.3,
      }],
    },
    options: { plugins: { legend: { display: false } } },
  });

  addChatMessage("ai", "Hi! Ask me anything about your portfolio.");
}

// ===== CHAT =====
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");

function addChatMessage(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

async function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  addChatMessage("user", text);
  chatInput.value = "";
  const thinking = addChatMessage("thinking", "Thinking…");

  try {
    let reply;
    if (USE_MOCKS) {
      await new Promise((r) => setTimeout(r, 900));
      reply = mockChatReply;
    } else {
      const res = await fetch(`${API}/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, holdings: mockHoldings }),
      });
      reply = (await res.json()).reply;
    }
    thinking.remove();
    addChatMessage("ai", reply);
  } catch {
    thinking.remove();
    addChatMessage("ai", "Couldn't reach the AI service.");
  }
}

document.getElementById("chat-send").addEventListener("click", sendChat);
chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter") sendChat(); });

// DEV SHORTCUT: skip login while building (DELETE these 3 lines before demo)
document.getElementById("login-screen").classList.add("hidden");
document.getElementById("dashboard").classList.remove("hidden");
initDashboard();
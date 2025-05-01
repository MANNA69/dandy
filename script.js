// script.js
const app_id = 72379;
const redirect_uri = encodeURIComponent("https://deriv.com/");
let ws, savedToken, quoteStreamId, masterSocket, balance;

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab_${tab}`).classList.add('active');
  document.querySelectorAll('.tab').forEach(el => {
    if (el.textContent.toLowerCase().includes(tab)) el.classList.add('active');
  });
}

function loginWithDeriv() {
  window.location.href = `https://oauth.deriv.com/oauth2/authorize?app_id=${app_id}&redirect_uri=${redirect_uri}`;
}

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token1");

if (token) {
  localStorage.setItem("deriv_token", token);
  window.history.replaceState(null, "", window.location.pathname);
}

savedToken = localStorage.getItem("deriv_token");

if (savedToken) {
  ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${app_id}`);
  ws.onopen = () => ws.send(JSON.stringify({ authorize: savedToken }));
  ws.onmessage = (msg) => handleMessage(JSON.parse(msg.data));
}

function handleMessage(data) {
  if (data.msg_type === "authorize") {
    balance = data.authorize.balance;
    updateUserInfo(data.authorize);
    subscribeToQuote();
    subscribeToBalance();
  }
  if (data.msg_type === "tick") {
    document.getElementById("quote_display").textContent = data.tick.quote;
  }
  if (data.msg_type === "balance") {
    balance = data.balance.balance;
    updateUserInfo();
  }
}

function updateUserInfo(auth = {}) {
  const info = document.getElementById("user_info");
  info.innerHTML = `<p><strong>ID:</strong> ${auth.loginid || ''}</p><p><strong>Balance:</strong> $${balance}</p>`;
}

function subscribeToQuote() {
  const symbol = document.getElementById("symbol_select").value;
  if (quoteStreamId) ws.send(JSON.stringify({ forget: quoteStreamId }));
  ws.send(JSON.stringify({ ticks: symbol }));
}

document.getElementById("symbol_select").addEventListener("change", subscribeToQuote);

function subscribeToBalance() {
  ws.send(JSON.stringify({ balance: 1, subscribe: 1 }));
}

function placeContract() {
  const symbol = document.getElementById("symbol_select").value;
  const contract_type = document.getElementById("contract_type").value;
  const stake = parseFloat(document.getElementById("stake").value);
  const duration = parseInt(document.getElementById("duration").value);
  const duration_unit = document.getElementById("duration_unit").value;

  const proposal = {
    buy: 1,
    price: stake,
    parameters: {
      amount: stake,
      basis: "stake",
      contract_type,
      currency: "USD",
      duration,
      duration_unit,
      symbol,
    },
  };

  ws.send(JSON.stringify({ authorize: savedToken }));
  ws.send(JSON.stringify(proposal));

  logTrade({ symbol, contract_type, stake, duration, duration_unit });
}

function logTrade({ symbol, contract_type, stake, duration, duration_unit }) {
  const log = document.getElementById("trade_log");
  const li = document.createElement("li");
  li.textContent = `${new Date().toLocaleTimeString()} - ${symbol} - ${contract_type} - $${stake} for ${duration} ${duration_unit}`;
  log.prepend(li);
}

function startCopyTrading() {
  const master_token = document.getElementById("master_token").value;
  if (!master_token) return alert("Enter a master token.");
  masterSocket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${app_id}`);
  masterSocket.onopen = () => masterSocket.send(JSON.stringify({ authorize: master_token }));
  masterSocket.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.msg_type === "buy") {
      const original = data.buy;
      const mirrored = {
        buy: 1,
        price: original.buy_price,
        parameters: {
          amount: original.buy_price,
          basis: "stake",
          contract_type: original.contract_type,
          currency: "USD",
          duration: 1,
          duration_unit: "m",
          symbol: original.symbol
        }
      };
      ws.send(JSON.stringify({ authorize: savedToken }));
      ws.send(JSON.stringify(mirrored));
      alert("Mirrored: " + original.contract_type);
    }
  };
}

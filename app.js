const elements = {
  ipValue: document.querySelector("#ip-value"),
  ipType: document.querySelector("#ip-type"),
  copyButton: document.querySelector("#copy-button"),
  copyLabel: document.querySelector("#copy-label"),
  checkButton: document.querySelector("#check-button"),
  checkLabel: document.querySelector("#check-label"),
  status: document.querySelector("#status-message"),
  statusText: document.querySelector("#status-message span:last-child"),
  badge: document.querySelector("#connection-badge"),
  location: document.querySelector("#location-value"),
  timezone: document.querySelector("#timezone-value"),
  provider: document.querySelector("#provider-value"),
  updatedAt: document.querySelector("#updated-at")
};

let currentIp = "";

function setStatus(state, message) {
  elements.status.dataset.state = state;
  elements.statusText.textContent = message;
  elements.badge.dataset.state = state === "loading" ? "idle" : state;
  elements.badge.textContent = state === "loading" ? "スキャン中" : state === "success" ? "接続済み" : state === "error" ? "取得失敗" : "待機中";
}

function setDetail(element, value, fallback = "—") {
  element.textContent = value || fallback;
}

function detectIpType(ip) {
  if (!ip) return "—";
  const ipv4Pattern = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;
  return ipv4Pattern.test(ip) ? "IPv4" : ip.includes(":") ? "IPv6" : "IP";
}

function normalizeIpapi(data) {
  if (!data || !data.ip) throw new Error("ipapi response did not include an IP");
  return {
    ip: data.ip,
    country: data.country_name,
    region: data.region,
    city: data.city,
    timezone: data.timezone,
    provider: data.org || data.asn
  };
}

function normalizeIpwho(data) {
  if (!data || data.success === false || !data.ip) throw new Error("ipwho response did not include an IP");
  return {
    ip: data.ip,
    country: data.country,
    region: data.region,
    city: data.city,
    timezone: data.timezone && (data.timezone.id || data.timezone.abbr),
    provider: data.connection && (data.connection.isp || data.connection.org)
  };
}

async function requestJson(url, timeout = 6500) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function findIp() {
  try {
    return normalizeIpapi(await requestJson("https://ipapi.co/json/"));
  } catch (firstError) {
    try {
      return normalizeIpwho(await requestJson("https://ipwho.is/"));
    } catch (secondError) {
      const fallback = await requestJson("https://api64.ipify.org?format=json");
      if (!fallback.ip) throw new Error("No public IP was returned");
      return { ip: fallback.ip };
    }
  }
}

function locationLabel(info) {
  return [info.city, info.region, info.country].filter(Boolean).join(", ");
}

function formatObservedAt() {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date());
}

function renderInfo(info) {
  currentIp = info.ip;
  elements.ipValue.classList.remove("is-loading", "is-error");
  elements.ipValue.textContent = info.ip;
  elements.ipType.textContent = `IP TYPE / ${detectIpType(info.ip)}`;
  elements.copyButton.disabled = false;
  elements.copyLabel.textContent = "コピー";
  setDetail(elements.location, locationLabel(info));
  setDetail(elements.timezone, info.timezone);
  setDetail(elements.provider, info.provider);
  elements.updatedAt.textContent = formatObservedAt();
}

function resetDetails() {
  setDetail(elements.location, "—");
  setDetail(elements.timezone, "—");
  setDetail(elements.provider, "—");
  elements.updatedAt.textContent = "—";
  elements.ipType.textContent = "IP TYPE / —";
  elements.copyButton.disabled = true;
  elements.copyLabel.textContent = "コピー";
}

async function runLookup() {
  elements.checkButton.disabled = true;
  elements.checkLabel.textContent = "スキャン中";
  elements.ipValue.classList.remove("is-error");
  elements.ipValue.classList.add("is-loading");
  elements.ipValue.textContent = "••• ••• •••";
  resetDetails();
  setStatus("loading", "公開IPを取得しています…");

  try {
    const info = await findIp();
    renderInfo(info);
    setStatus("success", "公開IPを確認しました。");
  } catch (error) {
    currentIp = "";
    elements.ipValue.classList.remove("is-loading");
    elements.ipValue.classList.add("is-error");
    elements.ipValue.textContent = "信号を取得できませんでした";
    setStatus("error", "接続を確認して、もう一度試してください。");
  } finally {
    elements.checkButton.disabled = false;
    elements.checkLabel.textContent = "もう一度スキャン";
  }
}

async function copyIp() {
  if (!currentIp) return;
  try {
    await navigator.clipboard.writeText(currentIp);
  } catch (error) {
    const temporary = document.createElement("textarea");
    temporary.value = currentIp;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.appendChild(temporary);
    temporary.select();
    document.execCommand("copy");
    temporary.remove();
  }
  elements.copyLabel.textContent = "コピーしました";
  window.setTimeout(() => { elements.copyLabel.textContent = "コピー"; }, 1800);
}

elements.checkButton.addEventListener("click", runLookup);
elements.copyButton.addEventListener("click", copyIp);

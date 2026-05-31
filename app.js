/**
 * 静穏 ambient wall display
 * Configure integrations by editing DISPLAY_CONFIG or using matching localStorage keys.
 */
const DISPLAY_CONFIG = {
  location: { latitude: 35.6355, longitude: 139.7407, timezone: "Asia/Tokyo" },
  googleCalendar: {
    apiKey: localStorage.getItem("ambient.googleApiKey") || "",
    calendarId: localStorage.getItem("ambient.calendarId") || "",
  },
  quakeSocket: "wss://api.p2pquake.net/v2/ws",
};

const $ = (selector) => document.querySelector(selector);
const body = document.body;
const normalUi = $("#normal-ui");
const emergency = $("#emergency");
const minorAlert = $("#minor-alert");
let minorAlertTimer;
let emergencyRecoveryTimer;
let currentTimeMode = "day";

function updateClock() {
  const now = new Date();
  const time = new Intl.DateTimeFormat("ja-JP", {
    timeZone: DISPLAY_CONFIG.location.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const date = new Intl.DateTimeFormat("ja-JP", {
    timeZone: DISPLAY_CONFIG.location.timezone,
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);
  $("#clock").textContent = time;
  $("#clock").dateTime = now.toISOString();
  $("#date").textContent = date;
  updateTimeMode(now);
}

function updateTimeMode(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: DISPLAY_CONFIG.location.timezone,
    hour: "numeric",
    hourCycle: "h23",
  }).format(now));
  const nextMode = hour >= 23 || hour < 5 ? "sleep" : hour < 9 ? "morning" : hour < 18 ? "day" : "evening";
  if (currentTimeMode !== nextMode) {
    currentTimeMode = nextMode;
    body.dataset.timeMode = nextMode;
    createParticles();
  }
}

function createParticles() {
  const field = $("#particle-field");
  const count = currentTimeMode === "sleep" ? 11 : 23;
  field.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("i");
    particle.className = "particle";
    particle.style.left = `${8 + Math.random() * 84}%`;
    particle.style.top = `${12 + Math.random() * 78}%`;
    particle.style.setProperty("--duration", `${30 + Math.random() * 34}s`);
    particle.style.setProperty("--delay", `${-Math.random() * 48}s`);
    particle.style.setProperty("--x-shift", `${-18 + Math.random() * 36}px`);
    particle.style.setProperty("--y-shift", `${-24 - Math.random() * 36}px`);
    field.append(particle);
  }
}

function weatherIcon(code) {
  if ([0, 1].includes(code)) return "○";
  if ([2, 3].includes(code)) return "◒";
  if ([45, 48].includes(code)) return "≋";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "╱╱";
  if ([71, 73, 75, 85, 86].includes(code)) return "＊";
  if ([95, 96, 99].includes(code)) return "ϟ";
  return "○";
}

async function updateWeather() {
  const { latitude, longitude, timezone } = DISPLAY_CONFIG.location;
  const params = new URLSearchParams({
    latitude, longitude, timezone,
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    hourly: "relative_humidity_2m",
    forecast_days: "3",
  });
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) throw new Error(`weather ${response.status}`);
    const data = await response.json();
    const tomorrow = 1;
    const tomorrowDate = data.daily.time[tomorrow];
    const humidityReadings = data.hourly.time.reduce((values, time, index) => {
      if (time.startsWith(tomorrowDate)) values.push(data.hourly.relative_humidity_2m[index]);
      return values;
    }, []);
    const humidity = Math.round(humidityReadings.reduce((sum, value) => sum + value, 0) / humidityReadings.length);
    $("#weather-icon").textContent = weatherIcon(data.daily.weather_code[tomorrow]);
    $("#temperature").textContent = `${Math.round(data.daily.temperature_2m_max[tomorrow])}° / ${Math.round(data.daily.temperature_2m_min[tomorrow])}°`;
    $("#humidity").textContent = `湿度 ${humidity}%`;
  } catch (error) {
    console.info("Weather update unavailable", error);
  }
}

async function updateCalendar() {
  const { apiKey, calendarId } = DISPLAY_CONFIG.googleCalendar;
  if (!apiKey || !calendarId) return;
  const params = new URLSearchParams({
    key: apiKey,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "1",
    timeMin: new Date().toISOString(),
  });
  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
    if (!response.ok) throw new Error(`calendar ${response.status}`);
    const [event] = (await response.json()).items || [];
    if (!event) return;
    const startsAt = event.start.dateTime ? new Date(event.start.dateTime) : null;
    $("#event-time").textContent = startsAt
      ? new Intl.DateTimeFormat("ja-JP", { timeZone: DISPLAY_CONFIG.location.timezone, hour: "2-digit", minute: "2-digit" }).format(startsAt)
      : "終日";
    $("#event-title").textContent = event.summary || "予定";
  } catch (error) {
    console.info("Calendar update unavailable", error);
  }
}

function normalizeScale(scale) {
  if (scale === 45) return "5弱";
  if (scale === 50) return "5強";
  if (scale === 55) return "6弱";
  if (scale === 60) return "6強";
  if (scale === 70) return "7";
  return String(Math.floor(Number(scale) / 10));
}

function highestArea(areas = []) {
  return [...areas].sort((a, b) => Number(b.scale) - Number(a.scale))[0]?.pref || "—";
}

function showMinorAlert(alert) {
  clearTimeout(minorAlertTimer);
  $("#minor-scale").textContent = alert.scale;
  $("#minor-area").textContent = alert.area;
  $("#minor-origin").textContent = `震源地　${alert.origin}`;
  minorAlert.classList.add("is-visible");
  minorAlert.ariaHidden = "false";
  normalUi.style.opacity = ".24";
  minorAlertTimer = setTimeout(() => {
    minorAlert.classList.remove("is-visible");
    minorAlert.ariaHidden = "true";
    normalUi.style.opacity = "";
  }, 18000);
}

function showEmergency(alert) {
  clearTimeout(emergencyRecoveryTimer);
  $("#emergency-kicker").textContent = alert.isWarning ? "緊急地震速報" : "地震情報";
  $("#emergency-scale").textContent = alert.scale;
  $("#emergency-area").textContent = alert.area;
  $("#emergency-origin").textContent = alert.origin;
  $("#emergency-tsunami").textContent = alert.tsunami || "調査中";
  body.classList.add("is-emergency");
  emergency.classList.add("is-visible");
  emergency.ariaHidden = "false";
}

function recoverAmbientDisplay(delay = 90000) {
  clearTimeout(emergencyRecoveryTimer);
  emergencyRecoveryTimer = setTimeout(() => {
    body.classList.remove("is-emergency");
    emergency.classList.remove("is-visible");
    emergency.ariaHidden = "true";
  }, delay);
}

function processQuakeMessage(message) {
  if (![551, 556].includes(message.code)) return;
  const earthquake = message.earthquake || {};
  const issueType = message.issue?.type || "";
  const rawScale = Number(earthquake.maxScale || Math.max(0, ...(message.areas || []).map((area) => Number(area.scale))));
  const alert = {
    scale: normalizeScale(rawScale),
    area: highestArea(message.areas),
    origin: earthquake.hypocenter?.name || "調査中",
    tsunami: earthquake.domesticTsunami || earthquake.foreignTsunami || "調査中",
    isWarning: message.code === 556 || issueType.includes("Warning"),
  };
  if (alert.isWarning || rawScale >= 40) {
    showEmergency(alert);
    recoverAmbientDisplay();
  } else if (rawScale >= 30) {
    showMinorAlert(alert);
  }
}

function connectQuakeSocket() {
  const socket = new WebSocket(DISPLAY_CONFIG.quakeSocket);
  socket.addEventListener("message", ({ data }) => {
    try { processQuakeMessage(JSON.parse(data)); }
    catch (error) { console.info("Unreadable quake event", error); }
  });
  socket.addEventListener("close", () => setTimeout(connectQuakeSocket, 15000));
  socket.addEventListener("error", () => socket.close());
}

function setPresence(isPresent) {
  body.dataset.presence = isPresent ? "present" : "away";
}
window.setAmbientPresence = setPresence;
window.previewQuake = (scale = 40) => processQuakeMessage({
  code: 551,
  earthquake: { maxScale: scale, hypocenter: { name: "東京湾" }, domesticTsunami: "津波の心配なし" },
  areas: [{ pref: "東京都２３区", scale }],
});

$("#fullscreen-button").addEventListener("click", () => document.documentElement.requestFullscreen?.());
document.addEventListener("fullscreenchange", () => $("#fullscreen-button").hidden = Boolean(document.fullscreenElement));

updateClock();
createParticles();
updateWeather();
updateCalendar();
connectQuakeSocket();
setInterval(updateClock, 30000);
setInterval(updateWeather, 60 * 60 * 1000);
setInterval(updateCalendar, 15 * 60 * 1000);
setInterval(() => {
  normalUi.style.transform = `translate3d(${(Math.random() - .5) * 3}px, ${(Math.random() - .5) * 3}px, 0)`;
}, 4 * 60 * 1000);

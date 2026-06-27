const KMB_API = "https://data.etabus.gov.hk/v1/transport/kmb";
const WEATHER_API = "https://data.weather.gov.hk/weatherAPI/opendata/weather.php";

const buses = [
  { route: "27", destination: "旺角", stopKeyword: "白虹樓", boarding: "白虹樓" },
  { route: "29M", destination: "新蒲崗", stopKeyword: "白虹樓", boarding: "白虹樓" },
  { route: "91", destination: "鑽石山", stopKeyword: "彩雲邨", boarding: "彩雲邨" },
  { route: "91M", destination: "鑽石山", stopKeyword: "彩雲邨", boarding: "彩雲邨" },
  { route: "10", destination: "大角咀", stopKeyword: "彩雲總站", boarding: "彩雲巴士總站" },
  { route: "92", destination: "鑽石山", stopKeyword: "彩雲邨", boarding: "彩雲邨" }
];

const stopCache = {};

function hkNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
}

function renderCards() {
  const busList = document.getElementById("busList");

  busList.innerHTML = buses.map(bus => `
    <div class="card" id="card-${bus.route}">
      <div class="route">${bus.route}</div>

      <div class="info">
        <div class="dest">往 ${bus.destination}</div>
        <div class="boarding">上車站：${bus.boarding}</div>
      </div>

      <div class="eta-area">
        <div class="eta loading" id="eta1-${bus.route}">更新中</div>
        <div class="next" id="eta2-${bus.route}">下一班：--</div>
      </div>
    </div>
  `).join("");
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("API error");
  return await res.json();
}

async function findRealStopId(bus) {
  const cacheKey = `${bus.route}-${bus.destination}-${bus.stopKeyword}`;
  if (stopCache[cacheKey]) return stopCache[cacheKey];

  for (const dir of ["inbound", "outbound"]) {
    const routeInfo = await getJSON(`${KMB_API}/route/${bus.route}/${dir}/1`);
    const dest = routeInfo.data.dest_tc || "";
    if (!dest.includes(bus.destination)) continue;

    const routeStops = await getJSON(`${KMB_API}/route-stop/${bus.route}/${dir}/1`);

    for (const item of routeStops.data) {
      const stopInfo = await getJSON(`${KMB_API}/stop/${item.stop}`);
      const stopName = stopInfo.data.name_tc || "";

      if (stopName.includes(bus.stopKeyword)) {
        stopCache[cacheKey] = item.stop;
        return item.stop;
      }
    }
  }

  throw new Error(`找不到 ${bus.route} ${bus.stopKeyword}`);
}

function formatETAForMain(etaString) {
  if (!etaString) return "暫無";

  const diffMin = Math.round((new Date(etaString) - new Date()) / 60000);

  if (diffMin <= 0) return "即將到站";
  return `${diffMin}<span class="unit">分鐘</span>`;
}

function formatETAForNext(etaString) {
  if (!etaString) return "--";

  const diffMin = Math.round((new Date(etaString) - new Date()) / 60000);

  if (diffMin <= 0) return "即將到站";
  return `${diffMin} 分鐘`;
}

async function loadBus(bus) {
  const realStopId = await findRealStopId(bus);

  const etaData = await getJSON(
    `${KMB_API}/eta/${realStopId}/${bus.route}/1`
  );

  const validEtas = etaData.data
    .filter(item => item.dest_tc && item.dest_tc.includes(bus.destination))
    .filter(item => item.eta)
    .slice(0, 2);

  return {
    eta1: formatETAForMain(validEtas[0]?.eta),
    eta2: formatETAForNext(validEtas[1]?.eta)
  };
}

async function updateOneBus(bus) {
  const eta1El = document.getElementById(`eta1-${bus.route}`);
  const eta2El = document.getElementById(`eta2-${bus.route}`);

  try {
    const data = await loadBus(bus);

    eta1El.innerHTML = data.eta1;
    eta1El.classList.remove("loading");

    eta2El.innerHTML = `下一班：<strong>${data.eta2}</strong>`;
  } catch (err) {
    eta1El.textContent = "暫無";
    eta1El.classList.add("loading");
    eta2El.innerHTML = `下一班：<strong>--</strong>`;
    console.error(bus.route, err);
  }
}

async function updateBusDisplay() {
  await Promise.all(buses.map(bus => updateOneBus(bus)));

  document.getElementById("updated").textContent =
    "資料由九巴提供｜每 30 秒自動更新｜" +
    hkNow().toLocaleTimeString("zh-HK", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });
}

function updateClock() {
  const now = hkNow();

  document.getElementById("todayDate").textContent =
    now.toLocaleDateString("zh-HK", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    });

  document.getElementById("todayTime").textContent =
    now.toLocaleTimeString("zh-HK", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
}

function setReminders({ temperature, isRaining, isWindy }) {
  const reminders = [];

  if (isRaining) reminders.push("☂️ 下雨帶傘");

  if (temperature >= 28) {
    reminders.push("🧢 天熱戴帽");
    reminders.push("💧 記得帶水");
  }

  if (isWindy) reminders.push("🧥 有風帶外套");

  if (reminders.length === 0) reminders.push("✅ 安心出門");

  document.getElementById("reminders").innerHTML =
    reminders.map(text => `<div class="reminder">${text}</div>`).join("");
}

async function updateWeather() {
  try {
    const weather = await getJSON(`${WEATHER_API}?dataType=rhrread&lang=tc`);

    const temperatures = weather.temperature?.data || [];
    const wongTaiSinTemp =
      temperatures.find(item => item.place.includes("黃大仙")) ||
      temperatures.find(item => item.place.includes("九龍")) ||
      temperatures[0];

    const temperature = Number(wongTaiSinTemp?.value);

    const rainData = weather.rainfall?.data || [];
    const wongTaiSinRain =
      rainData.find(item => item.place.includes("黃大仙")) ||
      rainData.find(item => item.place.includes("九龍")) ||
      rainData[0];

    const isRaining = Number(wongTaiSinRain?.max) > 0;

    const windText = weather.wind || "";
    const isWindy =
      windText.includes("清勁") ||
      windText.includes("強風") ||
      windText.includes("疾勁") ||
      windText.includes("烈風");

    document.getElementById("temperature").textContent =
      Number.isFinite(temperature) ? `${Math.round(temperature)}°C` : "--°C";

    document.getElementById("weatherIcon").textContent = isRaining ? "🌧️" : "☀️";

    setReminders({
      temperature: Number.isFinite(temperature) ? temperature : 0,
      isRaining,
      isWindy
    });
  } catch (err) {
    document.getElementById("temperature").textContent = "--°C";
    document.getElementById("weatherIcon").textContent = "🌤️";
    document.getElementById("reminders").innerHTML =
      `<div class="reminder">請留意天氣</div>`;
    console.error("weather", err);
  }
}

renderCards();
updateClock();
updateWeather();
updateBusDisplay();

setInterval(updateClock, 1000);
setInterval(updateWeather, 10 * 60 * 1000);
setInterval(updateBusDisplay, 30000);
const API = "https://data.etabus.gov.hk/v1/transport/kmb";

const buses = [
  {
    route: "91",
    destination: "鑽石山",
    stopKeyword: "彩雲邨"
  },
  {
    route: "91M",
    destination: "鑽石山",
    stopKeyword: "彩雲邨"
  },
  {
    route: "92",
    destination: "鑽石山",
    stopKeyword: "彩雲邨"
  },
  {
    route: "10",
    destination: "大角咀",
    stopKeyword: "彩雲總站"
  }
];

const stopCache = {};

function renderCards() {
  const busList = document.getElementById("busList");

  busList.innerHTML = buses.map(bus => `
    <div class="card" id="card-${bus.route}">
      <div class="top">
        <div class="route">${bus.route}</div>
        <div class="dest">往 ${bus.destination}</div>
      </div>

      <div class="boarding">上車站：${bus.stopKeyword}</div>

      <div class="eta loading" id="eta1-${bus.route}">更新中...</div>
      <div class="next" id="eta2-${bus.route}">下一班：--</div>
    </div>
  `).join("");
}

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("API error");
  return await res.json();
}

async function findStopForRoute(bus) {
  const cacheKey = `${bus.route}-${bus.destination}-${bus.stopKeyword}`;

  if (stopCache[cacheKey]) {
    return stopCache[cacheKey];
  }

  const directions = ["inbound", "outbound"];

  for (const dir of directions) {
    const routeInfo = await getJSON(`${API}/route/${bus.route}/${dir}/1`);
    const dest = routeInfo.data.dest_tc || "";

    if (!dest.includes(bus.destination)) continue;

    const routeStops = await getJSON(`${API}/route-stop/${bus.route}/${dir}/1`);

    for (const item of routeStops.data) {
      const stopInfo = await getJSON(`${API}/stop/${item.stop}`);
      const stopName = stopInfo.data.name_tc || "";

      if (stopName.includes(bus.stopKeyword)) {
        const result = {
          stopId: item.stop,
          direction: dir,
          stopName,
          dest
        };

        stopCache[cacheKey] = result;
        return result;
      }
    }
  }

  throw new Error(`找不到 ${bus.route} 的 ${bus.stopKeyword}`);
}

function formatETA(etaString) {
  if (!etaString) return "--";

  const etaTime = new Date(etaString);
  const now = new Date();
  const diffMin = Math.round((etaTime - now) / 60000);

  if (diffMin <= 0) return "即將到站";
  return `${diffMin} 分鐘`;
}

async function loadBus(bus) {
  const stopData = await findStopForRoute(bus);

  const etaData = await getJSON(
    `${API}/eta/${stopData.stopId}/${bus.route}/1`
  );

  const validEtas = etaData.data
    .filter(item => item.dest_tc && item.dest_tc.includes(bus.destination))
    .filter(item => item.eta)
    .slice(0, 2);

  return {
    eta1: formatETA(validEtas[0]?.eta),
    eta2: formatETA(validEtas[1]?.eta)
  };
}

async function updateOneBus(bus) {
  const eta1El = document.getElementById(`eta1-${bus.route}`);
  const eta2El = document.getElementById(`eta2-${bus.route}`);

  try {
    const data = await loadBus(bus);

    eta1El.textContent = data.eta1;
    eta1El.classList.remove("loading");

    eta2El.textContent = `下一班：${data.eta2}`;
  } catch (err) {
    eta1El.textContent = "暫時沒有資料";
    eta1El.classList.add("loading");
    eta2El.textContent = "請稍後再試";
    console.error(bus.route, err);
  }
}

async function updateDisplay() {
  await Promise.all(buses.map(bus => updateOneBus(bus)));

  document.getElementById("updated").textContent =
    "更新時間：" + new Date().toLocaleTimeString("zh-HK");
}

renderCards();
updateDisplay();

setInterval(updateDisplay, 30000);
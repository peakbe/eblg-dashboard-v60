// ======================================================
// CONFIGURATION
// ======================================================

const PROXY = "https://eblg-proxy.onrender.com";

const ENDPOINTS = {
    metar: `${PROXY}/metar`,
    taf: `${PROXY}/taf`,
    fids: `${PROXY}/fids`,
    notam: `${PROXY}/notam`
};

const SONOS = [
  { id:"F017", lat:50.764883, lon:5.630606 },
  { id:"F001", lat:50.737, lon:5.608833 },
  { id:"F014", lat:50.718894, lon:5.573164 },
  { id:"F015", lat:50.688839, lon:5.526217 },
  { id:"F005", lat:50.639331, lon:5.323519 },
  { id:"F003", lat:50.601167, lon:5.3814 },
  { id:"F011", lat:50.601142, lon:5.356006 },
  { id:"F008", lat:50.594878, lon:5.35895 },
  { id:"F002", lat:50.588414, lon:5.370522 },
  { id:"F007", lat:50.590756, lon:5.345225 },
  { id:"F009", lat:50.580831, lon:5.355417 },
  { id:"F004", lat:50.605414, lon:5.321406 },
  { id:"F010", lat:50.599392, lon:5.313492 },
  { id:"F013", lat:50.586914, lon:5.308678 },
  { id:"F016", lat:50.619617, lon:5.295345 },
  { id:"F006", lat:50.609594, lon:5.271403 },
  { id:"F012", lat:50.621917, lon:5.254747 }
];

let sonometers = {};   // {id, lat, lon, marker, status}
let map;               // Leaflet map
let runwayLayer = null;
let corridorLayer = null;
let corridorArrows = null;

// ======================================================
// FETCH HELPER
// ======================================================

async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (err) {
        console.error("Erreur fetch :", err);
        return { fallback: true, error: err.message };
    }
}

// ======================================================
// PANEL D'ÉTAT GLOBAL
// ======================================================

function updateStatusPanel(service, data) {
    const panel = document.getElementById("status-panel");
    if (!panel) return;

    if (data.fallback) {
        panel.className = "status-fallback";
        panel.innerText = `${service} : fallback (source offline)`;
        return;
    }

    if (data.error) {
        panel.className = "status-offline";
        panel.innerText = `${service} : offline`;
        return;
    }

    panel.className = "status-ok";
    panel.innerText = `${service} : OK`;
}

// ======================================================
// RUNWAY / CROSSWIND / CORRIDORS
// ======================================================

const RUNWAYS = {
    "22": {
        heading: 220,
        start: [50.64695, 5.44340],   // seuil 22
        end:   [50.63740, 5.46010]    // seuil 04
    },
    "04": {
        heading: 40,
        start: [50.63740, 5.46010],   // seuil 04
        end:   [50.64695, 5.44340]    // seuil 22
    }
};

const CORRIDORS = {
    "04": [
        [50.700000, 5.300000],
        [50.670000, 5.380000],
        [50.645900, 5.443300]
    ],
    "22": [
        [50.600000, 5.600000],
        [50.620000, 5.520000],
        [50.637300, 5.463500]
    ]
};

function drawRunway(runway) {
    if (!runwayLayer) return;

    runwayLayer.clearLayers();

    if (runway === "UNKNOWN") return;

    const r = RUNWAYS[runway];

    const line = L.polyline([r.start, r.end], {
        color: runway === "22" ? "red" : "blue",
        weight: 4
    });

    line.addTo(runwayLayer);
}


function drawCorridor(runway) {
    if (!corridorLayer) return;

    corridorLayer.clearLayers();

    if (runway === "UNKNOWN") return;

    const r = RUNWAYS[runway];

    const line = L.polyline([r.start, r.end], {
        color: "orange",
        weight: 2,
        dashArray: "6,6"
    }).addTo(corridorLayer);

    L.polylineDecorator(line, {
        patterns: [
            {
                offset: "25%",
                repeat: "50%",
                symbol: L.Symbol.arrowHead({
                    pixelSize: 12,
                    polygon: false,
                    pathOptions: { stroke: true, color: "orange" }
                })
            }
        ]
    }).addTo(corridorLayer);
}


function getRunwayFromWind(windDir) {
    if (!windDir) return "UNKNOWN";

    const diff22 = Math.abs(windDir - 220);
    const diff04 = Math.abs(windDir - 40);

    return diff22 < diff04 ? "22" : "04";
}

function computeCrosswind(windDir, windSpeed, runwayHeading) {
    if (!windDir || !windSpeed || !runwayHeading) {
        return { crosswind: 0, angleDiff: 0 };
    }

    const angleDiff = Math.abs(windDir - runwayHeading);
    const rad = angleDiff * Math.PI / 180;
    const crosswind = Math.round(Math.abs(windSpeed * Math.sin(rad)));

    return { crosswind, angleDiff };
}

function updateRunwayPanel(runway, windDir, windSpeed, phase) {
    const panel = document.getElementById("runway-panel");
    if (!panel) return;

    if (runway === "UNKNOWN" || !windDir || !windSpeed) {
        panel.className = "runway-unknown";
        panel.innerText = "Piste inconnue";
        return;
    }

    const r = RUNWAYS[runway];
    const info = computeCrosswind(windDir, windSpeed, r.heading);

    panel.className = runway === "22" ? "runway-22" : "runway-04";

    panel.innerText =
        `Piste ${runway} (${r.heading}°) – ` +
        `${phase === "landing" ? "Atterrissage" : "Décollage"} – ` +
        `${info.crosswind} kt crosswind (Δ${info.angleDiff}°) – ` +
        `Vent ${windDir}°/${windSpeed} kt`;
}


// ======================================================
// SONOMÈTRES
// ======================================================

function getSonometerColor(runway) {
    if (runway === "22") return "red";
    if (runway === "04") return "blue";
    return "gray";
}

function initSonometers(mapInstance) {
    SONOS.forEach(s => {
        const marker = L.circleMarker([s.lat, s.lon], {
            radius: 6,
            color: "gray",
            fillColor: "gray",
            fillOpacity: 0.9
        }).addTo(mapInstance);

        sonometers[s.id] = {
            ...s,
            marker,
            status: "UNKNOWN"
        };
    });
}

function updateSonometers(runway) {
    const color = getSonometerColor(runway);

    Object.values(sonometers).forEach(s => {
        s.marker.setStyle({
            color,
            fillColor: color
        });
        s.status = runway;
    });
}

function updateSonometersAdvanced(runway, phase) {
    Object.values(sonometers).forEach(s => {
        s.marker.setStyle({ color: "gray", fillColor: "gray" });
    });

    if (runway === "UNKNOWN") return;

    let green = [];
    let red = [];

    if (runway === "22") {
        if (phase === "takeoff") {
            green = ["F002","F003","F004","F005","F006","F007","F008","F009","F010","F011","F012","F013","F016"];
        } else {
            green = ["F001","F014","F015","F017"];
        }
    }

    if (runway === "04") {
        if (phase === "takeoff") {
            green = ["F002","F003","F007","F008","F009","F011","F013"];
            red   = ["F004","F005","F006","F010","F012","F016"];
        } else {
            green = ["F014","F015"];
            red   = ["F001","F017"];
        }
    }

    green.forEach(id => {
        if (sonometers[id]) {
            sonometers[id].marker.setStyle({ color: "green", fillColor: "green" });
        }
    });

    red.forEach(id => {
        if (sonometers[id]) {
            sonometers[id].marker.setStyle({ color: "red", fillColor: "red" });
        }
    });
}


// ======================================================
// METAR
// ======================================================

async function loadMetar() {
    const data = await fetchJSON(ENDPOINTS.metar);
    updateMetarUI(data);
    updateStatusPanel("METAR", data);
}

function updateMetarUI(data) {
    const el = document.getElementById("metar");
    if (!el) return;

    // Si METAR indisponible
    if (!data || !data.raw) {
        el.innerText = "METAR indisponible";
        drawCorridor("UNKNOWN");
        updateRunwayPanel("UNKNOWN", null, null, null);
        return;
    }

    // Affichage du METAR brut
    el.innerText = data.raw;

    // Extraction vent
    const windDir = data.wind_direction?.value;
    const windSpeed = data.wind_speed?.value;

    // Détermination de la piste
    const runway = getRunwayFromWind(windDir);

    // Détermination de la phase (décollage / atterrissage)
    let phase = "takeoff";

    if (runway === "22") {
        if (windDir >= 200 && windDir <= 260) phase = "landing";
    }

    if (runway === "04") {
        if (windDir >= 20 && windDir <= 80) phase = "landing";
    }

    // Mise à jour sonomètres
    updateSonometersAdvanced(runway, phase);

    // Mise à jour piste active (panneau)
    updateRunwayPanel(runway, windDir, windSpeed, phase);

    // Mise à jour visuelle carte
    drawRunway(runway);
    drawCorridor(runway);
}

// ======================================================
// TAF
// ======================================================

async function loadTaf() {
    const data = await fetchJSON(ENDPOINTS.taf);
    updateTafUI(data);
}

function updateTafUI(data) {
    const el = document.getElementById("taf");
    if (!el) return;

    if (data.fallback) {
        el.innerText = "TAF indisponible (fallback activé)";
        return;
    }

    el.innerText = data.raw || "TAF disponible";
}

// ======================================================
// FIDS (UI compacte + colorée)
// ======================================================

async function loadFids() {
    const data = await fetchJSON(ENDPOINTS.fids);
    updateFidsUI(data);
}

function updateFidsUI(data) {
    const container = document.getElementById("fids");
    if (!container) return;

    if (data.fallback) {
        container.innerHTML = `<div class="fids-row fids-unknown">FIDS indisponible</div>`;
        return;
    }

    const flights = Array.isArray(data) ? data : [];
    container.innerHTML = "";

    if (!flights.length) {
        container.innerHTML = `<div class="fids-row fids-unknown">Aucun vol disponible</div>`;
        return;
    }

    flights.forEach(flight => {
        const statusText = (flight.status || "").toLowerCase();

        let cssClass = "fids-unknown";
        if (statusText.includes("on time")) cssClass = "fids-on-time";
        if (statusText.includes("delayed")) cssClass = "fids-delayed";
        if (statusText.includes("cancel")) cssClass = "fids-cancelled";
        if (statusText.includes("board")) cssClass = "fids-boarding";

        const row = document.createElement("div");
        row.className = `fids-row ${cssClass}`;
        row.innerHTML = `
            <span>${flight.flight || "-"}</span>
            <span>${flight.destination || "-"}</span>
            <span>${flight.time || "-"}</span>
            <span>${flight.status || "-"}</span>
        `;
        container.appendChild(row);
    });
}

// ======================================================
// CARTE
// ======================================================

function initMap() {

    // Initialisation de la carte
    map = L.map("map", {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([50.643, 5.443], 11);

    // Bouton reset carte
    const resetBtn = document.getElementById("reset-map");
    if (resetBtn) {
        resetBtn.onclick = () => {
            map.setView([50.643, 5.443], 11);
        };
    }

    // Fond de carte
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    // Couches runway + corridor
    runwayLayer = L.layerGroup().addTo(map);
    corridorLayer = L.layerGroup().addTo(map);

    // Sonomètres
    initSonometers(map);
}

// ======================================================
// INITIALISATION GLOBALE
// ======================================================

window.onload = () => {
    initMap();
    loadMetar();
    loadTaf();
    loadFids();
};

/* ----------------------------------------------------------
   CONFIG
---------------------------------------------------------- */
const AVWX_API_KEY = "ersegQzkf2Dfal-o26B4b5uzMrXBeHK2jOpOaY7nffc";

const PROXY = "https://eblg-proxy.onrender.com/proxy?url=";

const FIDS_ARR = PROXY + encodeURIComponent("https://fids.liegeairport.com/api/flights/Arrivals");
const FIDS_DEP = PROXY + encodeURIComponent("https://fids.liegeairport.com/api/flights/Departures");

const EBLG = { lat:50.6374, lon:5.4432, runways:[
  { name:"04", heading:40 },
  { name:"22", heading:220 }
]};

let runwayAxisLayer = null;
let runwayAxisArrow = null;
let runwayAxisLabel = null;
let runwayPlaneIcon = null;

function drawRunwayAxis(runwayName, phase) {

  // Nettoyage des anciennes couches
  if (runwayAxisLayer) map.removeLayer(runwayAxisLayer);
  if (runwayAxisArrow) map.removeLayer(runwayAxisArrow);
  if (runwayAxisLabel) map.removeLayer(runwayAxisLabel);
  if (runwayPlaneIcon) map.removeLayer(runwayPlaneIcon);

  // Coordonnées des seuils
  const RW22 = [50.64594, 5.44375];
  const RW04 = [50.65480, 5.46530];

  let start, end;

  if (runwayName === "22") {
    start = RW22;
    end = RW04;
  } else {
    start = RW04;
    end = RW22;
  }

  // Couleur selon phase
  const color = (phase === "Décollage") ? "#f97316" : "#60a5fa";

  // Axe principal
  runwayAxisLayer = L.polyline([start, end], {
    color,
    weight: 4,
    opacity: 0.9,
    dashArray: "10, 10"
  }).addTo(map);

  // Flèche animée
  runwayAxisArrow = L.polylineDecorator([start, end], {
    patterns: [
      {
        offset: '0%',
        repeat: 50,
        symbol: L.Symbol.arrowHead({
          pixelSize: 12,
          polygon: false,
          pathOptions: {
            color: color,
            weight: 3
          }
        })
      }
    ]
  }).addTo(map);

  // Label au milieu
  const midLat = (start[0] + end[0]) / 2;
  const midLng = (start[1] + end[1]) / 2;

  runwayAxisLabel = L.marker([midLat, midLng], {
    icon: L.divIcon({
      className: "runway-label",
      html: `<div style="padding:4px 8px;background:white;border-radius:4px;border:1px solid #ccc;font-size:12px;">
        ${phase}
      </div>`
    })
  }).addTo(map);

  // Icône avion
  runwayPlaneIcon = L.marker(start, {
    icon: L.divIcon({
      className: "plane-icon",
      html: `<div style="font-size:20px;">✈️</div>`
    })
  }).addTo(map);

} // <-- FIN CORRECTE DE LA FONCTION

/* ----------------------------------------------------------
   SONOMÈTRES
---------------------------------------------------------- */
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

const RULES = {
  "22": {
    "Décollage": {
      vert: ["F002","F003","F004","F005","F006","F007","F008","F009","F010","F011","F012","F013","F016"],
      rouge: []
    },
    "Atterrissage": {
      vert: ["F001","F014","F015","F017"],
      rouge: []
    }
  },
  "04": {
    "Décollage": {
      vert: ["F002","F003","F007","F008","F009","F011","F013"],
      rouge: ["F004","F005","F006","F010","F012","F016"]
    },
    "Atterrissage": {
      vert: ["F014","F015"],
      rouge: ["F001","F017"]
    }
  }
};

/* ----------------------------------------------------------
   MAP
---------------------------------------------------------- */
const map = L.map("map").setView([EBLG.lat, EBLG.lon], 11);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

L.circleMarker([EBLG.lat, EBLG.lon], {radius:7, color:"#10b981", fillColor:"#10b981", fillOpacity:1})
  .addTo(map)
  .bindPopup("EBLG – Liège Airport");

const SONO_MARKERS = SONOS.map(s => ({
  ...s,
  marker: L.circleMarker([s.lat, s.lon], {
    radius:5, color:"#2563eb", fillColor:"#2563eb", fillOpacity:1
  }).addTo(map).bindPopup(s.id)
}));

let corridorLayer = null;
let arrowLayer = null;

/* ----------------------------------------------------------
   METAR
---------------------------------------------------------- */
async function fetchMetar() {
  const url = PROXY + encodeURIComponent(
    `https://avwx.rest/api/metar/EBLG?token=${AVWX_API_KEY}&format=json`
  );
  const r = await fetch(url);
  return r.json();
}

function updateMetarUI(m) {
  if (!m || !m.wind_direction) {
    document.getElementById("meteo-summary").textContent = "METAR indisponible";
    return;
  }

  document.getElementById("meteo-summary").textContent =
    `Vent ${m.wind_direction.value}° / ${m.wind_speed.value} kt – T° ${m.temperature.value}°C`;

  document.getElementById("meteo-raw").textContent = m.raw;
}

/* ----------------------------------------------------------
   FIDS
---------------------------------------------------------- */
async function fetchFIDS() {
  const [arr, dep] = await Promise.all([
    fetch(FIDS_ARR).then(r => r.json()),
    fetch(FIDS_DEP).then(r => r.json())
  ]);

  return {
    arrivals: Array.isArray(arr) ? arr : [],
    departures: Array.isArray(dep) ? dep : []
  };
}

function updateFlightsUI(f) {
  const el = document.getElementById("flights-list");
  const all = [...f.arrivals, ...f.departures];

  if (!all.length) {
    el.textContent = "Aucun vol FIDS disponible.";
    return;
  }

  el.innerHTML = all.slice(0,50).map(v => `
    <div class="flight-row">
      ${v.direction === "Arrivals" ? "ARR" : "DEP"} 
      ${v.flightPax} (${v.aircraftType}) – RWY ${v.runway || "?"}<br>
      STD/STA: ${format(v.sTx)} – ETD/ETA: ${format(v.eTx)} – ATD/ATA: ${format(v.aTx)}
    </div>
  `).join("");
}

function format(t) {
  if (!t) return "-";
  return new Date(t).toISOString().substring(11,16);
}

/* ----------------------------------------------------------
   RUNWAY + COULOIR + FLÈCHES
---------------------------------------------------------- */
function extractRunway(f) {
  const all = [...f.arrivals, ...f.departures];
  const r = all.find(v => v.runway);
  if (!r) return null;

  const name = r.runway.replace(/[^0-9]/g,"");
  return EBLG.runways.find(x => x.name === name) || null;
}

function computePoint([lat,lon], heading, km) {
  const R = 6371;
  const d = km / R;
  const br = heading * Math.PI/180;
  const la = lat * Math.PI/180;
  const lo = lon * Math.PI/180;

  const la2 = Math.asin(Math.sin(la)*Math.cos(d) + Math.cos(la)*Math.sin(d)*Math.cos(br));
  const lo2 = lo + Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(la), Math.cos(d)-Math.sin(la)*Math.sin(la2));

  return [la2*180/Math.PI, lo2*180/Math.PI];
}

function buildCorridor(heading) {
  const start = [EBLG.lat, EBLG.lon];
  const end = computePoint(start, heading, 20);

  const leftStart = computePoint(start, heading - 90, 1.5);
  const rightStart = computePoint(start, heading + 90, 1.5);
  const leftEnd = computePoint(end, heading - 90, 3.5);
  const rightEnd = computePoint(end, heading + 90, 3.5);

  return {
    polygon: [leftStart, leftEnd, rightEnd, rightStart],
    centerline: [start, end]
  };
}

function computeImpacted(runwayName, phase) {
  const rules = RULES[runwayName][phase];

  const impacted = [];

  SONO_MARKERS.forEach(s => {
    if (rules.vert.includes(s.id)) {
      s.marker.setStyle({ color: "#10b981", fillColor: "#10b981" }); // vert
      impacted.push(s);
    } else if (rules.rouge.includes(s.id)) {
      s.marker.setStyle({ color: "#b91c1c", fillColor: "#b91c1c" }); // rouge
      impacted.push(s);
    } else {
      s.marker.setStyle({ color: "#2563eb", fillColor: "#2563eb" }); // bleu par défaut
    }
  });

   sonometers[id].status = status; // "ok", "impact", "neutral"

  return impacted;
}


/* ----------------------------------------------------------
   MAIN
---------------------------------------------------------- */
async function refresh() {

  /* METAR */
  try {
    const metar = await fetchMetar();
    updateMetarUI(metar);
  } catch (e) {
    document.getElementById("meteo-summary").textContent = "METAR indisponible";
  }

  /* FIDS */
  const fids = await fetchFIDS();
  updateFlightsUI(fids);

   // Limiter à 10 prochains vols
function limitNextFlights(list) {
  return list
    .filter(f => f.scheduled) // vols avec horaire
    .sort((a, b) => new Date(a.scheduled) - new Date(b.scheduled))
    .slice(0, 10);
}

fids.arrivals = limitNextFlights(fids.arrivals);
fids.departures = limitNextFlights(fids.departures);


   function renderNextFlights(arrivals, departures) {
  const container = document.getElementById("next-flights");

  let html = "<strong>Arrivées</strong><br>";
  arrivals.forEach(f => {
    html += `${f.flight} — ${new Date(f.scheduled).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}<br>`;
  });

  html += "<br><strong>Départs</strong><br>";
  departures.forEach(f => {
    html += `${f.flight} — ${new Date(f.scheduled).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}<br>`;
  });

  container.innerHTML = html;
}

renderNextFlights(fids.arrivals, fids.departures);

 /* RUNWAY */
const rw = extractRunway(fids);
if (!rw) {
  document.getElementById("runway-info").textContent = "Piste non déterminée.";
  return;
}

console.log("RUNWAY =", rw.name);

/* PHASE */
let phase;

// 1) Lire la valeur du sélecteur
const manual = document.getElementById("phase-select").value;

// 2) Si manuel → override
if (manual !== "auto") {
  phase = manual;
} else {
  // 3) Sinon → logique automatique
  phase = (rw.name === "22") ? "Décollage" : "Atterrissage";
}

console.log("PHASE =", phase);
drawRunwayAxis(rw.name, phase);

document.getElementById("runway-info").textContent =
  `Piste ${rw.name} – ${phase}`;


  document.getElementById("runway-info").textContent =
    `Piste ${rw.name} (cap ${rw.heading}°)`;

   window.currentRunway = rw.name;

  /* COULOIR + SONOMÈTRES */
  const impacted = computeImpacted(rw.name, phase);

  document.getElementById("sonos-impacted").innerHTML =
    impacted.length
      ? impacted.map(s => `<span class="tag impacted">${s.id}</span>`).join(" ")
      : "Aucun sonomètre impacté.";
}

/* === LISTENERS === */
document.getElementById("phase-select").addEventListener("change", () => {
  refresh();
});

document.getElementById("reset-map").addEventListener("click", () => {
  map.setView([50.6374, 5.4432], 12); // centre + zoom par défaut
});

document.getElementById("zoom-runway").addEventListener("click", () => {
  if (!window.currentRunway) return;

  if (window.currentRunway === "22") {
    map.fitBounds([
      [50.64594, 5.44375],
      [50.65480, 5.46530]
    ]);
  } else {
    map.fitBounds([
      [50.65480, 5.46530],
      [50.64594, 5.44375]
    ]);
  }
});

document.getElementById("zoom-impacted").addEventListener("click", () => {
  const impacted = Object.values(sonometers).filter(s => s.status === "impact");

  if (impacted.length === 0) return;

  const bounds = L.latLngBounds(impacted.map(s => [s.lat, s.lon]));
  map.fitBounds(bounds.pad(0.3));
});

document.getElementById("zoom-global").addEventListener("click", () => {
  map.setView([50.6374, 5.4432], 12);
});

/* 🔧 FIX : attendre que la carte soit prête */
map.whenReady(() => {
  refresh();
});

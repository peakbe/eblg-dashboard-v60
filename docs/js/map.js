// force redeploy v92
import { initSonometers } from "./sonometers.js";

/**
 * Initialise la carte Leaflet.
 */
export function initMap() {
    const map = L.map("map", {
        zoomControl: true,
        scrollWheelZoom: true
    }).setView([50.643, 5.443], 11);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    window.runwayLayer = L.layerGroup().addTo(map);
    window.corridorLayer = L.layerGroup().addTo(map);

    initSonometers(map);

    const resetBtn = document.getElementById("reset-map");
    if (resetBtn) {
        resetBtn.onclick = () => map.setView([50.643, 5.443], 11);
    }

    return map;
}

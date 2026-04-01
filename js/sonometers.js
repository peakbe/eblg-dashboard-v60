// ======================================================
// SONOMÈTRES
// ======================================================

import { SONOS, SONO_ADDRESSES } from "./config.js";
import { haversineDistance } from "./helpers.js";

export let sonometers = {};
export let heatLayer = null;

/**
 * Surligne un sonomètre dans la liste.
 * @param {string} id
 */
export function highlightSonometerInList(id) {
    const list = document.getElementById("sono-list");
    if (!list) return;

    list.querySelectorAll(".sono-item").forEach(el =>
        el.classList.remove("sono-highlight")
    );

    const item = [...list.children].find(el => el.textContent.trim() === id);
    if (item) {
        item.classList.add("sono-highlight");
        item.scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

/**
 * Met à jour la heatmap en fonction des statuts.
 * @param {L.Map} map
 */
export function updateHeatmap(map) {
    if (heatLayer) map.removeLayer(heatLayer);

    const points = Object.values(sonometers).map(s => {
        let weight = 0.2;
        if (s.marker.options.color === "green") weight = 0.6;
        if (s.marker.options.color === "red") weight = 1.0;
        return [s.lat, s.lon, weight];
    });

    heatLayer = L.heatLayer(points, {
        radius: 35,
        blur: 25,
        maxZoom: 12,
        minOpacity: 0.3
    }).addTo(map);
}

/**
 * Affiche le panneau latéral détaillé.
 * @param {string} id
 * @param {[number,number]} runwayStart
 */
export function showDetailPanel(id, runwayStart) {
    const s = sonometers[id];
    if (!s) return;

    const panel = document.getElementById("detail-panel");
    const title = document.getElementById("detail-title");
    const address = document.getElementById("detail-address");
    const town = document.getElementById("detail-town");
    const status = document.getElementById("detail-status");
    const distance = document.getElementById("detail-distance");

    const fullAddress = SONO_ADDRESSES[id] || "Adresse inconnue";
    const townName = fullAddress.split(",")[1] || "—";

    const d = haversineDistance([s.lat, s.lon], runwayStart).toFixed(2);

    title.textContent = id;
    address.textContent = fullAddress;
    town.textContent = townName.trim();
    status.textContent = s.marker.options.color.toUpperCase();
    distance.textContent = `${d} km`;

    panel.classList.remove("hidden");
}

/**
 * Initialise les sonomètres sur la carte.
 * @param {L.Map} map
 */
export function initSonometers(map) {
    SONOS.forEach(s => {
        const marker = L.circleMarker([s.lat, s.lon], {
            radius: 6,
            color: "gray",
            fillColor: "gray",
            fillOpacity: 0.9,
            weight: 1
        }).addTo(map);

        const address = SONO_ADDRESSES[s.id] || "Adresse inconnue";

        marker.bindTooltip(s.id);

        marker.on("click", () => {
            marker.bindPopup(`<b>${s.id}</b><br>${address}`).openPopup();
            highlightSonometerInList(s.id);
            showDetailPanel(s.id, [50.64695, 5.44340]); // centre piste 22
        });

        sonometers[s.id] = { ...s, marker, status: "UNKNOWN" };
    });
}
export let heatHistory = [];
export const MAX_HISTORY = 50; // 50 snapshots

export function snapshotHeatmap() {
    const snapshot = Object.values(sonometers).map(s => ({
        lat: s.lat,
        lon: s.lon,
        color: s.marker.options.color
    }));

    heatHistory.push(snapshot);
    if (heatHistory.length > MAX_HISTORY) heatHistory.shift();
}
export async function playHeatmapHistory(map) {
    for (const snapshot of heatHistory) {
        if (heatLayer) map.removeLayer(heatLayer);

        const points = snapshot.map(s => {
            let weight = 0.2;
            if (s.color === "green") weight = 0.6;
            if (s.color === "red") weight = 1.0;
            return [s.lat, s.lon, weight];
        });

        heatLayer = L.heatLayer(points, {
            radius: 35,
            blur: 25,
            maxZoom: 12,
            minOpacity: 0.3
        }).addTo(map);

        await new Promise(r => setTimeout(r, 300));
    }
}

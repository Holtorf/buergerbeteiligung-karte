import { state } from './state.js';

// Karte initialisieren (Hamburg als Start)
export function initMap() {
  state.map = L.map('map').setView([53.5511, 9.9937], 12);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(state.map);

  // Kartenklick-Handler – wird im main.js gesetzt (weil er UI+Gist benötigt)
}

export function addMarkerToMap(pointData, index) {
  const colorMap = {
    red:'#ff0000', green:'#00ff00', yellow:'#ffff00',
    blue:'#0000ff', purple:'#800080', black:'#000000', white:'#ffffff'
  };

  const marker = L.circleMarker([pointData.lat, pointData.lng], {
    radius: 8,
    fillColor: colorMap[pointData.color],
    color: pointData.color === 'white' ? '#000' : colorMap[pointData.color],
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8
  }).addTo(state.map);

  const popupContent = `
    <div class="popup-title">${pointData.title}</div>
    <div class="popup-description">${pointData.description}</div>
    <div class="popup-coordinates">Lat: ${pointData.lat.toFixed(6)}, Lng: ${pointData.lng.toFixed(6)}</div>
    <button onclick="editPoint(${index})" style="margin-top:8px; padding:4px 8px; background:#007bff; color:#fff; border:none; border-radius:4px; cursor:pointer;">
      Bearbeiten
    </button>
  `;

  marker.bindPopup(popupContent);
  pointData.marker = marker;
}

export function updateMarker(index) {
  const p = state.points[index];
  if (p.marker) state.map.removeLayer(p.marker);
  addMarkerToMap(p, index);
}

// Damit der Popup-Button weiter funktioniert:
export function exposeEditPoint(fn) {
  window.editPoint = fn;
}

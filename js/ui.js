import { state } from './state.js';
import { parseCSVLine, getColorHex } from './utils.js';
import { addMarkerToMap } from './map.js';
import { createOrUpdateGist } from './gist.js';

// Modal
export function openModal(lat, lng, pointData = null) {
  const modal = document.getElementById('pointModal');
  const modalTitle = document.getElementById('modalTitle');
  const titleInput = document.getElementById('pointTitle');
  const descriptionInput = document.getElementById('pointDescription');

  if (pointData) {
    modalTitle.textContent = 'Punkt bearbeiten';
    titleInput.value = pointData.title;
    descriptionInput.value = pointData.description;
    state.selectedColor = pointData.color;
    state.editingPointIndex = pointData.index;
  } else {
    modalTitle.textContent = 'Neuen Punkt hinzufügen';
    titleInput.value = '';
    descriptionInput.value = '';
    state.selectedColor = 'white';
    state.editingPointIndex = -1;
  }
  updateColorSelection();
  modal.style.display = 'block';
  modal.dataset.lat = lat;
  modal.dataset.lng = lng;
}

export function closeModal() {
  document.getElementById('pointModal').style.display = 'none';
}

export function updateColorSelection() {
  document.querySelectorAll('.color-option').forEach(option => {
    option.classList.toggle('selected', option.dataset.color === state.selectedColor);
  });
}

export function showInstruction() {
  document.getElementById('instruction').style.display = 'block';
}
export function hideInstruction() {
  document.getElementById('instruction').style.display = 'none';
}

// Event-Liste (mobile Einsendungen)
export function updateEventList() {
  const eventList = document.getElementById('eventList');
  if (state.pendingEvents.length === 0) {
    eventList.innerHTML = `
      <div class="no-events">
        Noch keine Punkte eingereicht.<br>
        Mobile Nutzer können über den QR-Code Punkte erstellen.
      </div>`;
    return;
  }
  eventList.innerHTML = state.pendingEvents.map((event, index) => `
    <div class="event-item ${index === state.selectedEventIndex ? 'selected' : ''}" data-index="${index}">
      <div class="event-title">${event.title}</div>
      <div class="event-description">${event.description}</div>
      <div class="event-meta">
        <div class="event-color" style="background-color:${getColorHex(event.color)};"></div>
        <div class="event-time">${event.timestamp}</div>
      </div>
      <button class="place-button" data-action="place" data-index="${index}">Platzieren</button>
    </div>
  `).join('');

  // Click-Handling (Selection/Placement)
  eventList.querySelectorAll('.event-item').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedEventIndex = Number(el.dataset.index);
      updateEventList();
    });
  });
  eventList.querySelectorAll('.place-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.selectedEventIndex = Number(btn.dataset.index);
      updateEventList();
      alert('Klicken Sie auf die Karte, um den Punkt zu platzieren!');
    });
  });
}

// Punkte/CSV
export function clearAllPoints() {
  state.points.forEach(p => { if (p.marker) state.map.removeLayer(p.marker); });
  state.points = [];
}

export function exportToCSV() {
  if (state.points.length === 0) { alert('Keine Punkte zum Exportieren vorhanden!'); return; }

  let csv = 'Titel;Beschreibung;Farbe;Latitude;Longitude\n';
  state.points.forEach(p => {
    const row = [
      `"${p.title.replace(/"/g, '""')}"`,
      `"${p.description.replace(/"/g, '""')}"`,
      p.color, p.lat.toFixed(6), p.lng.toFixed(6)
    ].join(';');
    csv += row + '\n';
  });

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const timeStr = `${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}${String(now.getSeconds()).padStart(2,'0')}`;
  const filename = `karten_punkte_${dateStr}_${timeStr}.csv`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob), download: filename, style: 'visibility:hidden'
  });
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

export function importFromCSV(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const csvContent = e.target.result;
      const lines = csvContent.split('\n');
      if (lines.length < 2) { alert('Die CSV-Datei ist leer oder ungültig!'); return; }

      const header = lines[0].toLowerCase();
      const hasSemicolons = header.includes(';');
      const separator = hasSemicolons ? ';' : ',';
      if (!header.includes('titel') || !header.includes('latitude') || !header.includes('longitude')) {
        alert('Die CSV-Datei hat nicht das richtige Format!\n\nGefundener Header: ' + lines[0] +
          '\n\nBenötigte Spalten: Titel, Beschreibung, Farbe, Latitude, Longitude');
        return;
      }

      clearAllPoints();
      let imported = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line, separator);
        if (values.length >= 5) {
          const p = {
            title: values[0].replace(/""/g, '"'),
            description: values[1].replace(/""/g, '"'),
            color: values[2],
            lat: parseFloat(values[3]),
            lng: parseFloat(values[4])
          };
          if (isNaN(p.lat) || isNaN(p.lng)) { console.warn(`Ungültige Koordinaten in Zeile ${i+1}`); continue; }

          const validColors = ['red','green','yellow','blue','purple','black','white'];
          if (!validColors.includes(p.color)) p.color = 'white';

          state.points.push(p);
          addMarkerToMap(p, state.points.length - 1);
          imported++;
        }
      }

      if (imported > 0) {
        alert(`Erfolgreich ${imported} Punkte importiert!`);
        if (state.points.length > 0) {
          const group = new L.featureGroup(state.points.map(p => p.marker));
          state.map.fitBounds(group.getBounds().pad(0.1));
        }
      } else {
        alert('Keine gültigen Punkte gefunden! Details in der Konsole (F12).');
      }
    } catch (err) {
      alert('Fehler beim Lesen der CSV-Datei: ' + err.message);
      console.error('CSV Import Error:', err);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

// Punkt speichern/bearbeiten
export function savePoint() {
  const modal = document.getElementById('pointModal');
  const title = document.getElementById('pointTitle').value.trim();
  const description = document.getElementById('pointDescription').value.trim();
  const lat = parseFloat(modal.dataset.lat);
  const lng = parseFloat(modal.dataset.lng);
  if (!title) { alert('Bitte geben Sie einen Titel ein!'); return; }

  const pointData = { title, description, color: state.selectedColor, lat, lng };

  if (state.editingPointIndex >= 0) {
    state.points[state.editingPointIndex] = pointData;
    // Marker neu zeichnen
    const idx = state.editingPointIndex;
    if (state.points[idx].marker) state.map.removeLayer(state.points[idx].marker);
    // Re-attach marker
    // (index bleibt gleich)
    addMarkerToMap(state.points[idx], idx);
  } else {
    state.points.push(pointData);
    addMarkerToMap(pointData, state.points.length - 1);
  }

  closeModal();
}

export function editPoint(index) {
  const p = state.points[index];
  p.index = index;
  openModal(p.lat, p.lng, p);
}

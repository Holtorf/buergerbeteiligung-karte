import { state } from './state.js';
import { waitForLeaflet, showTokenWarning, showNotification } from './utils.js';
import { initMap, addMarkerToMap, exposeEditPoint } from './map.js';
import {
  getTokenFromURL, createOrUpdateGist, loadEventsFromGist,
  generateQRCode, startEventPolling
} from './gist.js';
import {
  openModal, closeModal, updateColorSelection, showInstruction, hideInstruction,
  updateEventList, clearAllPoints, exportToCSV, importFromCSV, savePoint, editPoint
} from './ui.js';

// Popup-Button "Bearbeiten" weiter funktionsfähig machen
exposeEditPoint(editPoint);

// Kartenklick-Handler: neuen Punkt setzen ODER mobilen Event platzieren
function onMapClick(e) {
  if (state.isAddingPoint) {
    const { lat, lng } = e.latlng;
    openModal(lat, lng);
    hideInstruction();
    state.isAddingPoint = false;
    document.getElementById('addPointBtn').style.backgroundColor = '';
  } else if (state.selectedEventIndex >= 0) {
    const { lat, lng } = e.latlng;
    const eventData = state.pendingEvents[state.selectedEventIndex];
    const p = { title: eventData.title, description: eventData.description, color: eventData.color, lat, lng };
    state.points.push(p);
    addMarkerToMap(p, state.points.length - 1);

    // Event aus Liste entfernen + Gist updaten
    state.pendingEvents.splice(state.selectedEventIndex, 1);
    state.selectedEventIndex = -1;
    updateEventList();
    createOrUpdateGist(state.pendingEvents);
  }
}

// DOM bereit
document.addEventListener('DOMContentLoaded', async () => {
  // Notifications anfragen (optional)
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch(_) {}
  }

  // Leaflet laden & Karte init
  waitForLeaflet(async () => {
    initMap();
    state.map.on('click', onMapClick);
    updateEventList();

    // Token/Gist-Setup
    state.GITHUB_TOKEN = getTokenFromURL();
    if (!state.GITHUB_TOKEN) showTokenWarning();

    const urlParams = new URLSearchParams(window.location.search);
    const gistParam = urlParams.get('gist');

    if (state.GITHUB_TOKEN) {
      if (gistParam) {
        state.actualGistId = gistParam;
      } else {
        const created = await createOrUpdateGist([]); // leere events.json erzeugen
        if (created?.id) {
          state.actualGistId = created.id;
        }
      }
    } else if (gistParam) {
      state.actualGistId = gistParam; // read-only Modus
    }

    // QR (inkl. gist + token wenn vorhanden)
    generateQRCode();

    // Gist-Polling starten + initial laden
    if (state.GITHUB_TOKEN) {
      startEventPolling({
        onNewEvents: (newEvents, before) => {
          updateEventList();
          if (newEvents.length > before) {
            showNotification(`${newEvents.length - before} neue Punkte eingereicht!`);
          }
        }
      });

      const existing = await loadEventsFromGist();
      if (existing && existing.length > 0) {
        state.pendingEvents = existing;
        updateEventList();
        console.log(`📂 ${existing.length} bestehende Events geladen`);
      }
    } else {
      console.warn('⚠️ GitHub Token fehlt - Live-Updates deaktiviert');
    }

    // Kleines Demo-Event (nur, wenn leer)
    setTimeout(() => {
      if (state.pendingEvents.length === 0) {
        // rein fürs UI – kein Gist-Write ohne Token
        state.pendingEvents.push({ title:'Spielplatz renovieren', description:'Der alte Spielplatz braucht neue Geräte', color:'green', timestamp:new Date().toLocaleString(), id:Date.now() });
        updateEventList();
      }
    }, 2000);
  });

  // UI-Events
  document.getElementById('addPointBtn').addEventListener('click', () => {
    state.isAddingPoint = true;
    document.getElementById('addPointBtn').style.backgroundColor = '#28a745';
    showInstruction();
  });

  document.getElementById('csvBtn').addEventListener('click', exportToCSV);

  document.getElementById('uploadBtn').addEventListener('click', () => {
    document.getElementById('csvFileInput').click();
  });

  document.getElementById('csvFileInput').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['text/csv','application/vnd.ms-excel','text/plain'];
      const ok = validTypes.includes(file.type) || file.name.toLowerCase().endsWith('.csv');
      if (!ok) {
        alert(`Bitte wählen Sie eine gültige CSV-Datei aus!\nDateiname: ${file.name}\nDateityp: ${file.type}`);
      } else {
        if (state.points.length > 0) {
          if (confirm('Alle bestehenden Punkte werden gelöscht. Fortfahren?')) {
            importFromCSV(file);
          }
        } else {
          importFromCSV(file);
        }
      }
    } else {
      alert('Keine Datei ausgewählt!');
    }
    e.target.value = ''; // reset für erneutes Laden gleicher Datei
  });

  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('saveBtn').addEventListener('click', savePoint);

  // Farbauswahl
  document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', function() {
      state.selectedColor = this.dataset.color;
      updateColorSelection();
    });
  });

  // Modal schließen bei Klick außerhalb
  document.getElementById('pointModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Enter speichert, ESC bricht ab / beendet Add-Mode
  document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && document.getElementById('pointModal').style.display === 'block') {
      savePoint();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.getElementById('pointModal').style.display === 'block') closeModal();
      if (state.isAddingPoint) {
        state.isAddingPoint = false;
        document.getElementById('addPointBtn').style.backgroundColor = '';
        const instr = document.getElementById('instruction'); if (instr) instr.style.display = 'none';
      }
    }
  });
});

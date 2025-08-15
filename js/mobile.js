/**
 * Mobile-Client-Logik:
 * - Liest ?token und ?gist aus der URL
 * - Handhabt Farbauswahl und Formular-Submit
 * - Packt das Event-Objekt und übergibt es an appendEventToGist(...)
 * - Fallback: LocalStorage, falls Token/Gist fehlen oder API-Error
 */

import {
  getTokenFromURL,
  getGistIdFromURL,
  appendEventToGist,
  loadCurrentEvents
} from './gist.js';

// --- Lokaler UI-Zustand (nur mobile) ---
let selectedColor = 'white';
let token = null;
let gistId = null;

// ======== Init ========
document.addEventListener('DOMContentLoaded', () => {
  // 1) URL-Parameter lesen (token, gist)
  token = getTokenFromURL();         // optional – mobile kann auch ohne Token senden (dann LocalStorage)
  gistId = getGistIdFromURL();       // benötigt, wenn direkt ins Gist gepusht werden soll

  // 2) Farbauswahl aktivieren
  wireColorPicker();

  // 3) Formular-Submit binden
  document.getElementById('pointForm').addEventListener('submit', onSubmit);

  // 4) Komfort-UX: Enter im Titel fokussiert die Beschreibung
  const titleEl = document.getElementById('title');
  titleEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('description').focus();
    }
  });

  // 5) Leichter visueller Hinweis, wenn title sich dem Limit nähert
  titleEl.addEventListener('input', function() {
    const maxLength = this.getAttribute('maxlength');
    const currentLength = this.value.length;
    this.style.borderColor = (currentLength >= maxLength * 0.9) ? '#ffc107' : '#e0e0e0';
  });
});

// ======== UI-Helfer ========

function wireColorPicker() {
  document.querySelectorAll('.color-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedColor = opt.dataset.color;
    });
  });
}

function show(elId) { document.getElementById(elId).style.display = 'block'; }
function hide(elId) { document.getElementById(elId).style.display = 'none'; }
function hideMessages() { hide('successMessage'); hide('errorMessage'); }

function resetForm() {
  document.getElementById('title').value = '';
  document.getElementById('description').value = '';
  document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
  const white = document.querySelector('[data-color="white"]');
  if (white) white.classList.add('selected');
  selectedColor = 'white';
}

// ======== Submit-Flow ========

async function onSubmit(e) {
  e.preventDefault();
  hideMessages();

  const submitBtn = document.getElementById('submitBtn');
  const loading = document.getElementById('loading');

  const title = document.getElementById('title').value.trim();
  const description = document.getElementById('description').value.trim();

  if (!title) {
    showError('Bitte geben Sie einen Titel ein!');
    return;
  }

  // Einheitliches Datenobjekt (Zeitstempel in ISO – Desktop konvertiert ggf. ins lokale Format)
  const eventData = {
    title,
    description,
    color: selectedColor,
    timestamp: new Date().toISOString()
  };

  // UI: Ladezustand
  submitBtn.disabled = true;
  loading.style.display = 'block';

  // 1) Versuche, direkt ins Gist zu schreiben (nur wenn Token + Gist-ID vorhanden)
  let ok = false;
  if (token && gistId) {
    ok = await appendEventToGist(gistId, token, eventData);
  }

  // 2) Fallback: LocalStorage (Desktop-Seite kann diese Events optional abholen)
  if (!ok) {
    const events = JSON.parse(localStorage.getItem('pendingEvents') || '[]');
    events.push(eventData);
    localStorage.setItem('pendingEvents', JSON.stringify(events));
    ok = true;
    console.log('📦 Event im LocalStorage gespeichert (kein Token/Gist oder API-Fehler).');
  }

  // UI: Ergebnis anzeigen + Reset
  if (ok) {
    show('successMessage');
    resetForm();
  } else {
    showError('Fehler beim Übertragen. Bitte versuchen Sie es erneut.');
  }

  // UI: Ladezustand zurücknehmen (kleine Pause, damit die Meldung sichtbar bleibt)
  setTimeout(() => {
    submitBtn.disabled = false;
    loading.style.display = 'none';
    // Auto-hide nach 5s
    setTimeout(() => hideMessages(), 5000);
  }, 400);
}

function showError(msg) {
  const el = document.getElementById('errorMessage');
  el.textContent = `❌ ${msg}`;
  show('errorMessage');
}

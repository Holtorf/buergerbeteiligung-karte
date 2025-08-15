/**
 * Gist-Helferfunktionen (shared):
 * - Token/Gist-ID aus URL lesen
 * - Events aus Gist laden
 * - Events in Gist schreiben/anhängen
 * - (Desktop) Gist erstellen/patchen, QR aktualisieren, Polling starten
 *
 * Hinweis:
 *  - Mobile nutzt v. a. appendEventToGist(gistId, token, eventData)
 *  - Desktop nutzt zusätzlich createOrUpdateGist, loadEventsFromGist, updateQRCode, etc.
 */

// ganz oben in gist.js (falls noch nicht da)
import { state } from './state.js';

/** Token (optional) aus der URL lesen (?token=...) */
export function getTokenFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (!token) return null;
  // Warnung nur als Hinweis – kein Blocker
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    console.warn('⚠️ Token-Format wirkt ungewohnt. Prüfe, ob er gültig ist.');
  }
  return token;
}

/** Gist-ID aus URL lesen (?gist=...) */
export function getGistIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('gist') || null;
}

/** (Shared) Aktuelle Events aus einem Gist lesen. */
export async function loadCurrentEvents(gistId) {
  if (!gistId) return [];
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`);
    if (!res.ok) return [];
    const gist = await res.json();
    const file = gist.files?.['events.json'];
    if (!file) return [];
    const data = JSON.parse(file.content);
    return data.events || [];
  } catch (e) {
    console.error('❌ Fehler beim Laden der Events aus Gist:', e);
    return [];
  }
}

/**
 * (Mobile) Ein Event an ein bestehendes Gist anhängen.
 *  - Lädt aktuelle Liste
 *  - hängt eventData an
 *  - PATCH zurück ins Gist
 * Fällt bei Fehlern auf true/false zurück, damit die UI reagieren kann.
 */
export async function appendEventToGist(gistId, token, eventData) {
  if (!gistId) {
    console.warn('appendEventToGist: keine Gist-ID vorhanden');
    return false;
  }
  if (!token) {
    console.warn('appendEventToGist: kein Token vorhanden');
    return false;
  }

  try {
    const current = await loadCurrentEvents(gistId);
    const payload = {
      description: 'Bürgerbeteiligung Events',
      files: {
        'events.json': {
          content: JSON.stringify({
            events: [...current, eventData],
            lastUpdate: new Date().toISOString(),
            version: Date.now()
          }, null, 2)
        }
      }
    };

    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error('❌ Gist-Update fehlgeschlagen:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('❌ Gist-API Fehler bei appendEventToGist:', e);
    return false;
  }
}

/* ===== Nur für Desktop gebraucht – Mobile kann es ignorieren ===== */

/** (Desktop) Neues Gist mit leerer events.json erstellen oder bestehendes patchen */
export async function createOrUpdateGist(token, existingGistId = null, events = []) {
  if (!token) { console.warn('createOrUpdateGist: kein Token'); return null; }

  const gistData = {
    description: 'Bürgerbeteiligung Events',
    public: true,
    files: {
      'events.json': {
        content: JSON.stringify({
          events,
          lastUpdate: new Date().toISOString(),
          version: Date.now()
        }, null, 2)
      }
    }
  };

  const method = existingGistId ? 'PATCH' : 'POST';
  const url = existingGistId ? `https://api.github.com/gists/${existingGistId}` : 'https://api.github.com/gists';

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(gistData)
    });
    if (!res.ok) {
      console.error('❌ createOrUpdateGist fehlgeschlagen:', res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('❌ Gist-API Fehler bei createOrUpdateGist:', e);
    return null;
  }
}

/** (Desktop) events.json aus Gist laden (nur wenn sich geändert hat) */
export async function loadEventsFromGist(gistId, lastUpdate) {
  if (!gistId) return null;
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`);
    if (!res.ok) return null;
    const gist = await res.json();
    const file = gist.files?.['events.json'];
    if (!file) return null;
    const data = JSON.parse(file.content);
    if (data.lastUpdate !== lastUpdate) return data;
    return null;
  } catch (e) {
    console.error('❌ Fehler beim Laden aus Gist:', e);
    return null;
  }
}

/** (Desktop) QR für mobile Seite bauen – hier nur als Helfer, falls du’s teilen willst */
export function buildMobileJoinURL(baseMobileUrl, gistId, token) {
  const url = new URL(baseMobileUrl);
  if (gistId) url.searchParams.set('gist', gistId);
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

/**
 * Pollt in Intervallen das Gist und ruft onNewEvents auf,
 * wenn sich die Events geändert haben.
 * Kompatibel zu deinem bisherigen main.js-Aufruf.
 */
export function startEventPolling({ onNewEvents, intervalMs = 3000 } = {}) {
  setInterval(async () => {
    // nur pollen, wenn Token gesetzt ist
    if (!state.GITHUB_TOKEN) return;
    // lade nur, wenn eine Gist-ID vorhanden ist
    if (!state.actualGistId) return;

    // lädt events.json nur, wenn lastUpdate sich geändert hat
    const data = await loadEventsFromGist(state.actualGistId, state.lastGistUpdate);
    if (data !== null) {
      const before = state.pendingEvents.length;
      state.pendingEvents = data.events || [];
      state.lastGistUpdate = data.lastUpdate;
      if (typeof onNewEvents === 'function') {
        onNewEvents(state.pendingEvents, before);
      }
    }
  }, intervalMs);
}

// js/gist.js
/**
 * Shared Gist helpers for Desktop & Mobile.
 * - Read token/gist from URL
 * - Load/append events in a gist (events.json)
 * - Desktop-only helpers: createOrUpdateGist, loadEventsFromGist (with lastUpdate),
 *   QR URL helper, startEventPolling.
 *
 * Requires: ./state.js on Desktop (for polling). Mobile does NOT need state.js.
 */

import { state } from './state.js'; // Desktop uses this; on Mobile this import is harmless if unused

/** Token (optional) from ?token=... */
export function getTokenFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (!token) return null;
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    console.warn('⚠️ Token format looks unusual. Double-check validity.');
  }
  return token;
}

/** Gist ID (optional) from ?gist=... */
export function getGistIdFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('gist') || null;
}

/** Load current events array from a gist (returns [] on issues). */
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
    console.error('❌ loadCurrentEvents error:', e);
    return [];
  }
}

/** Append one event to a gist (Mobile path). */
export async function appendEventToGist(gistId, token, eventData) {
  if (!gistId) { console.warn('appendEventToGist: missing gistId'); return false; }
  if (!token)   { console.warn('appendEventToGist: missing token');  return false; }

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
      console.error('❌ appendEventToGist failed:', res.status, await res.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error('❌ appendEventToGist API error:', e);
    return false;
  }
}

/** Desktop: create new gist or update existing with given events array. */
export async function createOrUpdateGist(token, existingGistId = null, events = []) {
  if (!token) { console.warn('createOrUpdateGist: missing token'); return null; }

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
  const url = existingGistId
    ? `https://api.github.com/gists/${existingGistId}`
    : `https://api.github.com/gists`;

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
      console.error('❌ createOrUpdateGist failed:', res.status, await res.text());
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error('❌ createOrUpdateGist error:', e);
    return null;
  }
}

/**
 * Desktop: Load events.json if it changed since lastUpdate.
 * Returns the parsed data object or null if unchanged/failure.
 */
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
    console.error('❌ loadEventsFromGist error:', e);
    return null;
  }
}

/** Build the mobile join URL for QR (helper). */
export function buildMobileJoinURL(baseMobileUrl, gistId, token) {
  const url = new URL(baseMobileUrl);
  if (gistId) url.searchParams.set('gist', gistId);
  if (token)  url.searchParams.set('token', token);
  return url.toString();
}

// (falls genutzt) nur auf Desktop gebraucht
export function updateQRCode() {
  const baseUrl = 'https://holtorf.github.io/buergerbeteiligung-karte/mobile.html';
  const url = new URL(baseUrl);
  if (state?.actualGistId) url.searchParams.set('gist', state.actualGistId);
  if (state?.GITHUB_TOKEN) url.searchParams.set('token', state.GITHUB_TOKEN);

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url.toString())}`;
  const el = document.getElementById('qrCode');
  if (el) {
    el.innerHTML = `<img src="${qrCodeUrl}" alt="QR Code" style="width:100%; height:100%; object-fit:contain;" />`;
  }
  console.log('📱 Mobile URL:', url.toString());
}

// Alias für alte Aufrufe
export function generateQRCode() {
  return updateQRCode();
}
/**
 * Desktop: Poll gist for changes every intervalMs.
 * Calls onNewEvents(events, previousLength) when changed.
 */
export function startEventPolling({ onNewEvents, intervalMs = 3000 } = {}) {
  setInterval(async () => {
    if (!state?.GITHUB_TOKEN) return;
    if (!state?.actualGistId) return;

    const data = await loadEventsFromGist(state.actualGistId, state.lastGistUpdate);
    if (data !== null) {
      const before = state.pendingEvents.length;
      state.pendingEvents   = data.events || [];
      state.lastGistUpdate  = data.lastUpdate;
      if (typeof onNewEvents === 'function') onNewEvents(state.pendingEvents, before);
    }
  }, intervalMs);
}

import { state } from './state.js';

export function getTokenFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (!token) return null;
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    console.warn('⚠️ Token Format scheint ungültig zu sein');
  }
  return token;
}

export async function createOrUpdateGist(events) {
  if (!state.GITHUB_TOKEN) {
    console.warn('GitHub Token nicht verfügbar - Live-Updates deaktiviert');
    return null;
  }

  const gistData = {
    description: 'Bürgerbeteiligung Events',
    public: true,
    files: {
      'events.json': {
        content: JSON.stringify({
          events: events,
          lastUpdate: new Date().toISOString(),
          version: Date.now()
        }, null, 2)
      }
    }
  };

  try {
    let url = 'https://api.github.com/gists';
    let method = 'POST';
    if (state.actualGistId) { url = `https://api.github.com/gists/${state.actualGistId}`; method = 'PATCH'; }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${state.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(gistData)
    });

    if (response.ok) {
      const result = await response.json();
      if (!state.actualGistId) {
        state.actualGistId = result.id;
        updateQRCode();
        updateBrowserURL();
      }
      return result;
    } else {
      console.error('❌ Gist API Error:', response.status, await response.text());
      return null;
    }
  } catch (e) {
    console.error('❌ Gist API Fehler:', e);
    return null;
  }
}

export function updateBrowserURL() {
  if (state.actualGistId && window.history?.replaceState) {
    const url = new URL(window.location);
    url.searchParams.set('gist', state.actualGistId);
    // Optional: Token aus URL entfernen
    // url.searchParams.delete('token');
    window.history.replaceState({}, '', url);
  }
}

export async function loadEventsFromGist() {
  if (!state.actualGistId) {
    const urlParams = new URLSearchParams(window.location.search);
    const gistParam = urlParams.get('gist');
    if (gistParam) state.actualGistId = gistParam;
  }
  if (!state.actualGistId) return [];

  try {
    const res = await fetch(`https://api.github.com/gists/${state.actualGistId}`);
    if (res.ok) {
      const gist = await res.json();
      const eventsFile = gist.files['events.json'];
      if (eventsFile) {
        const data = JSON.parse(eventsFile.content);
        if (data.lastUpdate !== state.lastGistUpdate) {
          state.lastGistUpdate = data.lastUpdate;
          return data.events || [];
        }
      }
    }
  } catch (e) {
    console.error('❌ Fehler beim Laden der Events:', e);
  }
  return null; // Keine Änderung
}

export function updateQRCode() {
  const baseUrl = 'https://holtorf.github.io/buergerbeteiligung-karte/mobile.html';
  const url = new URL(baseUrl);
  if (state.actualGistId) url.searchParams.set('gist', state.actualGistId);
  if (state.GITHUB_TOKEN) url.searchParams.set('token', state.GITHUB_TOKEN);
  const fullUrl = url.toString();
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(fullUrl)}`;
  const el = document.getElementById('qrCode');
  if (el) el.innerHTML = `<img src="${qrCodeUrl}" alt="QR Code" style="width:100%; height:100%; object-fit:contain;" />`;
  console.log('📱 Mobile URL:', fullUrl);
}

export function generateQRCode() {
  updateQRCode();
}

export function startEventPolling({ onNewEvents }) {
  setInterval(async () => {
    if (state.GITHUB_TOKEN) {
      const newEvents = await loadEventsFromGist();
      if (newEvents !== null) {
        const before = state.pendingEvents.length;
        state.pendingEvents = newEvents;
        onNewEvents?.(newEvents, before);
      }
    }
  }, 3000);
}

export function addMobileEvent(eventData) {
  const event = {
    ...eventData,
    timestamp: new Date().toLocaleString(),
    id: Date.now() + Math.random()
  };
  state.pendingEvents.push(event);
  createOrUpdateGist(state.pendingEvents);
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('Neuer Punkt eingereicht', { body: `"${event.title}" von mobiler Teilnahme` });
  }
}

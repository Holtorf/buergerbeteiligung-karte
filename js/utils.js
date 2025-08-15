// Wartet, bis Leaflet (L) verfügbar ist
export function waitForLeaflet(cb) {
  if (typeof L !== 'undefined') cb();
  else setTimeout(() => waitForLeaflet(cb), 50);
}

// CSV-Zeile robust parsen (unterstützt ; oder , und Anführungszeichen)
export function parseCSVLine(line, separator = ';') {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim()); current = '';
    } else { current += char; }
  }
  result.push(current.trim());

  return result.map(field => (field.startsWith('"') && field.endsWith('"')) ? field.slice(1, -1) : field);
}

export function getColorHex(name) {
  const colorMap = {
    red:'#ff0000', green:'#00ff00', yellow:'#ffff00',
    blue:'#0000ff', purple:'#800080', black:'#000000', white:'#ffffff'
  };
  return colorMap[name] || '#ffffff';
}

export function showNotification(message) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification('Bürgerbeteiligung', { body: message });
  }
  console.log('🔔', message);
}

export function showTokenWarning() {
  const warning = document.createElement('div');
  warning.style.cssText = `
    position:fixed; top:10px; right:10px; z-index:3000;
    background:#ffc107; color:#856404; padding:15px; border-radius:8px;
    max-width:300px; font-size:12px; box-shadow:0 4px 12px rgba(0,0,0,0.2);
  `;
  warning.innerHTML = `
    <strong>🔑 Token fehlt!</strong><br>
    Für Live-Updates fügen Sie Ihren GitHub Token zur URL hinzu:<br>
    <code style="font-size:10px;">?token=ghp_ihrtoken...</code><br>
    <button style="margin-top:8px; padding:4px 8px; background:#856404; color:white; border:none; border-radius:4px; cursor:pointer;">
      OK
    </button>
  `;
  warning.querySelector('button').onclick = () => warning.remove();
  document.body.appendChild(warning);
  setTimeout(() => warning.remove(), 10000);
}

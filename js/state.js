// Zentrale, gemeinsam genutzte App-Variablen
export const state = {
  map: null,
  isAddingPoint: false,
  currentMarker: null,
  points: [],
  editingPointIndex: -1,
  selectedColor: 'white',
  pendingEvents: [],
  selectedEventIndex: -1,

  // Gist/GitHub
  GITHUB_TOKEN: null,
  actualGistId: null,
  lastGistUpdate: null
};

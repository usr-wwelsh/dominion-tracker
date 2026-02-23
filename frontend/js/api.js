// API Client for Dominion Tracker

const API_BASE_URL = (window.location.port === '8000')
  ? `http://${window.location.hostname}:3000/api`
  : '/api';

/**
 * Centralized fetch wrapper with error handling
 * @param {string} endpoint
 * @param {object} options - standard fetch options
 * @param {{ user: string, pass: string }|null} credentials - optional Basic Auth credentials
 */
async function apiRequest(endpoint, options = {}, credentials = null) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  if (credentials) {
    defaultHeaders['Authorization'] = 'Basic ' + btoa(`${credentials.user}:${credentials.pass}`);
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  console.log(`API Request: ${config.method || 'GET'} ${url}`, config.body ? JSON.parse(config.body) : '');

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`API Response:`, data);
    return data;
  } catch (error) {
    console.error(`API Error:`, error);
    throw error;
  }
}

// Players API
const playersAPI = {
  getAll: () => apiRequest('/players'),

  getById: (id) => apiRequest(`/players/${id}`),

  getStats: (id) => apiRequest(`/players/${id}/stats`),

  create: (name) => apiRequest('/players', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }),

  updateColor: (id, color) => apiRequest(`/players/${id}/color`, {
    method: 'PATCH',
    body: JSON.stringify({ color }),
  }),

  getH2H: (id) => apiRequest(`/players/${id}/h2h`),

  delete: (id, credentials) => apiRequest(`/players/${id}`, {
    method: 'DELETE',
  }, credentials),
};

// Builds API
const buildsAPI = {
  getAll: () => apiRequest('/builds'),

  getById: (id) => apiRequest(`/builds/${id}`),

  create: (nickname, cards, landmarks = [], events = [], prophecies = [], usePlatinumColony = false) => apiRequest('/builds', {
    method: 'POST',
    body: JSON.stringify({ nickname, cards, landmarks, events, prophecies, use_platinum_colony: usePlatinumColony }),
  }),

  update: (id, nickname, cards, landmarks = [], events = [], prophecies = [], usePlatinumColony = false, credentials) => apiRequest(`/builds/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ nickname, cards, landmarks, events, prophecies, use_platinum_colony: usePlatinumColony }),
  }, credentials),

  delete: (id, credentials) => apiRequest(`/builds/${id}`, {
    method: 'DELETE',
  }, credentials),

  getComments: (buildId) => apiRequest(`/builds/${buildId}/comments`),

  addComment: (buildId, data) => apiRequest(`/builds/${buildId}/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  deleteComment: (buildId, commentId, credentials) => apiRequest(`/builds/${buildId}/comments/${commentId}`, {
    method: 'DELETE',
  }, credentials),
};

// Games API
const gamesAPI = {
  getAll: ({ limit = 20, offset = 0 } = {}) =>
    apiRequest(`/games?limit=${limit}&offset=${offset}`),

  getById: (id) => apiRequest(`/games/${id}`),

  create: (buildId, playerIds) => apiRequest('/games', {
    method: 'POST',
    body: JSON.stringify({
      build_id: buildId,
      player_ids: playerIds,
    }),
  }),

  start: (id) => apiRequest(`/games/${id}/start`, {
    method: 'PUT',
  }),

  end: (id) => apiRequest(`/games/${id}/end`, {
    method: 'PUT',
  }),

  updateScore: (gameId, playerId, score) => apiRequest(`/games/${gameId}/scores`, {
    method: 'POST',
    body: JSON.stringify({
      player_id: playerId,
      score: score,
    }),
  }),

  getScoreHistory: (id) => apiRequest(`/games/${id}/scores`),

  delete: (id, credentials) => apiRequest(`/games/${id}`, {
    method: 'DELETE',
  }, credentials),

  cancel: (id) => apiRequest(`/games/${id}/cancel`, {
    method: 'DELETE',
  }),
};

// Auth API
const authAPI = {
  check: (credentials) => apiRequest('/auth/check', {}, credentials),
};

// Stats API
const statsAPI = {
  getLeaderboard: () => apiRequest('/leaderboard'),
  getExtras: () => apiRequest('/extras'),
};

/**
 * Show a credentials-gated delete confirmation modal.
 * @param {string} actionLabel - e.g. "Delete this build?"
 * @param {function({ user: string, pass: string }): void} onConfirm - called with credentials on confirm
 */
function showDeleteModal(actionLabel, onConfirm, options = {}) {
  const { confirmLabel = 'Confirm', pendingLabel = 'Deleting...' } = options;
  // Remove any existing modal
  const existing = document.getElementById('delete-confirm-modal');
  if (existing) existing.remove();

  const authRequired = true; // always show fields; middleware will pass if no env vars set

  const overlay = document.createElement('div');
  overlay.id = 'delete-confirm-modal';
  overlay.className = 'delete-modal-overlay';

  overlay.innerHTML = `
    <div class="delete-modal-box">
      <div class="delete-modal-title">${actionLabel}</div>
      <div class="delete-modal-fields">
        <div class="form-group">
          <label for="dm-user">Username</label>
          <input type="text" id="dm-user" autocomplete="username">
        </div>
        <div class="form-group">
          <label for="dm-pass">Password</label>
          <input type="password" id="dm-pass" autocomplete="current-password">
        </div>
      </div>
      <div class="delete-modal-error" id="dm-error"></div>
      <div class="delete-modal-actions">
        <button class="btn btn-danger" id="dm-confirm">Confirm</button>
        <button class="btn" id="dm-cancel">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const userInput = overlay.querySelector('#dm-user');
  const passInput = overlay.querySelector('#dm-pass');
  const errorEl = overlay.querySelector('#dm-error');
  const confirmBtn = overlay.querySelector('#dm-confirm');
  const cancelBtn = overlay.querySelector('#dm-cancel');

  userInput.focus();

  function close() {
    overlay.remove();
  }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  confirmBtn.textContent = confirmLabel;

  confirmBtn.addEventListener('click', async () => {
    errorEl.textContent = '';
    confirmBtn.disabled = true;
    confirmBtn.textContent = pendingLabel;
    try {
      await onConfirm({ user: userInput.value, pass: passInput.value });
      close();
    } catch (err) {
      errorEl.textContent = err.message || 'Failed';
      confirmBtn.disabled = false;
      confirmBtn.textContent = confirmLabel;
    }
  });

  passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') confirmBtn.click();
  });
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    playersAPI,
    buildsAPI,
    gamesAPI,
    statsAPI,
  };
}

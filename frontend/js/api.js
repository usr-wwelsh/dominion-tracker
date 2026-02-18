// API Client for Dominion Tracker

const API_BASE_URL = 'http://localhost:3000/api';

/**
 * Centralized fetch wrapper with error handling
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
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
};

// Builds API
const buildsAPI = {
  getAll: () => apiRequest('/builds'),

  getById: (id) => apiRequest(`/builds/${id}`),

  create: (nickname, cards, landmarks = [], events = [], prophecies = [], usePlatinumColony = false) => apiRequest('/builds', {
    method: 'POST',
    body: JSON.stringify({ nickname, cards, landmarks, events, prophecies, use_platinum_colony: usePlatinumColony }),
  }),

  delete: (id) => apiRequest(`/builds/${id}`, {
    method: 'DELETE',
  }),
};

// Games API
const gamesAPI = {
  getAll: () => apiRequest('/games'),

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
};

// Stats API
const statsAPI = {
  getLeaderboard: () => apiRequest('/leaderboard'),
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    playersAPI,
    buildsAPI,
    gamesAPI,
    statsAPI,
  };
}

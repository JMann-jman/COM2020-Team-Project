/**
 * API client for communicating with the Noise Pollution Monitoring Backend
 */

const API = {
  baseURL: 'http://localhost:5001/api',
  
  /**
   * Set default role header for all requests
   */
  role: 'community',

  /**
   * Make a request to the API
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Role': this.role,
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        let body = null;
        try { body = await response.json(); } catch (e) { try { body = await response.text(); } catch (_) { body = null; } }
        const msg = `API error: ${response.status}` + (body ? ` - ${JSON.stringify(body)}` : '');
        throw new Error(msg);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  },

  /**
   * Get noise data with optional filters
   */
  getNoiseData(filters = {}) {
    const params = new URLSearchParams();
    if (filters.zones) params.append('zones', filters.zones.join(','));
    if (filters.categories) params.append('categories', filters.categories.join(','));
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.source) params.append('source', filters.source);
    if (filters.time_window) params.append('time_window', filters.time_window);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/noise_data${query}`);
  },

  /**
   * Get top hotspots
   */
  getHotspots(top = 5) {
    return this.request(`/hotspots?top=${top}`);
  },

  /**
   * Get all zones
   */
  getZones() {
    return this.request('/zones');
  },

  /**
   * Get all interventions
   */
  getInterventions() {
    return this.request('/interventions');
  },

  /**
   * Submit a new incident report
   */
  async submitReport(data) {
    const url = `${this.baseURL}/reports`;
    const headers = { 'Content-Type': 'application/json', 'Role': this.role };
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
      let body = null;
      try { body = await res.json(); } catch (e) { body = await res.text().catch(() => null); }
      if (!res.ok) {
        // Return object with error info instead of throwing so callers can handle 409 duplicates
        return { __error: true, status: res.status, body };
      }
      return body;
    } catch (err) {
      console.error('submitReport failed:', err);
      throw err;
    }
  },

  /**
   * Get all incident reports
   */
  getReports() {
    return this.request('/reports');
  },

  /**
   * Create a new intervention plan
   */
  createPlan(data) {
    const originalRole = this.role;
    this.role = 'planner';
    const promise = this.request('/plans', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    // Restore original role after request
    return promise.finally(() => {
      this.role = originalRole;
    });
  },

  /**
   * Get all plans
   */
  getPlans() {
    return this.request('/plans');
  },

  /**
   * Compare plans
   */
  comparePlans(planIds) {
    const query = planIds.map(id => `plan_ids=${id}`).join('&');
    return this.request(`/plans/compare?${query}`);
  },

  /**
   * Set user role for subsequent requests
   */
  setRole(role) {
    this.role = role;
  },

  // ----- Quiet Quest endpoints -----

  /**
   * Get all missions grouped by tier
   */
  getMissions() {
    return this.request('/missions');
  },

  /**
   * Submit an answer for a mission
   */
  submitMissionAnswer(missionId, answer) {
    return this.request(`/missions/${missionId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer })
    });
  },

  /**
   * Get user quest progress and badges
   */
  getQuestProgress() {
    return this.request('/quest/progress');
  },

  /**
   * Reset quest progress (for testing)
   */
  resetQuestProgress() {
    return this.request('/quest/reset', { method: 'POST' });
  },

  // ----- Moderation endpoints -----

  /**
   * Moderate a report (valid, duplicate, or invalid)
   * @param {string} reportId - The ID of the report to moderate
   * @param {string} decision - The decision: 'valid', 'duplicate', or 'invalid'
   * @param {string} reason - Reason for the decision
   */
  moderateReport(reportId, decision, reason) {
    // Set role to planner for moderation
    const originalRole = this.role;
    this.role = 'planner';
    const promise = this.request(`/reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify({ decision, reason })
    });
    // Restore original role after request
    return promise.finally(() => {
      this.role = originalRole;
    });
  }
};

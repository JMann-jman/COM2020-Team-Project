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
        throw new Error(`API error: ${response.status}`);
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
  submitReport(data) {
    return this.request('/reports', {
      method: 'POST',
      body: JSON.stringify(data)
    });
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
  }
};

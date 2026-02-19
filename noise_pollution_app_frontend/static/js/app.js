/**
 * Main application JavaScript for Noise Pollution Monitoring App
 */

/**
 * Execute an API call with error handling
 * @param {Function} apiFunction - The API function to call
 * @param {string} errorMessage - Custom error message to display
 * @returns {Promise} The API response data or null on error
 */
async function executeApiCall(apiFunction, errorMessage = 'Operation failed') {
  try {
    return await apiFunction();
  } catch (error) {
    console.error(errorMessage, error);
    alert(errorMessage);
    return null;
  }
}

/**
 * Load data from API and display it using provided display function
 * @param {Function} apiFunction - The API call to execute
 * @param {Function} displayFunction - The function to display the data
 * @param {string} errorMessage - Custom error message
 */
async function loadAndDisplay(apiFunction, displayFunction, errorMessage = 'Failed to load data') {
  const data = await executeApiCall(apiFunction, errorMessage);
  if (data) {
    displayFunction(data);
  }
}

// Load zones and populate dropdowns
async function loadZones() {
  const zones = await executeApiCall(
    () => API.getZones(),
    'Failed to load zones'
  );
  if (zones) {
    console.log('Zones loaded:', zones);
    populateZoneSelect(zones);
  } else {
    console.warn('No zones returned from API');
  }
  return zones;
}

// Load interventions and populate dropdowns
async function loadInterventions() {
  const interventions = await executeApiCall(
    () => API.getInterventions(),
    'Failed to load interventions'
  );
  if (interventions) {
    console.log('Interventions loaded:', interventions);
    window.interventionsCatalog = interventions;
    populateInterventionSelect(interventions);
    updatePlanInterventionDetails();
  } else {
    console.warn('No interventions returned from API');
  }
  return interventions;
}

function updatePlanInterventionDetails() {
  const interventionEl = document.getElementById('intervention');
  const costBandEl = document.getElementById('costBand');
  const feasibilityEl = document.getElementById('feasibility');
  const impactEl = document.getElementById('impact');
  if (!interventionEl || !costBandEl || !feasibilityEl || !impactEl) return;

  const selectedId = interventionEl.value;
  const catalog = window.interventionsCatalog || [];
  const selected = catalog.find(item => item.intervention_id === selectedId);

  if (!selected) {
    costBandEl.textContent = '—';
    feasibilityEl.textContent = '—';
    impactEl.textContent = '—';
    return;
  }

  costBandEl.textContent = String(selected.cost_band || '—').toUpperCase();
  feasibilityEl.textContent = selected.feasibility_score !== undefined ? Number(selected.feasibility_score).toFixed(2) : '—';
  const low = selected.impact_range_db_low;
  const high = selected.impact_range_db_high;
  impactEl.textContent = (low !== undefined && high !== undefined) ? `${low}–${high} dB` : '—';
}

// Populate intervention select dropdowns
function populateInterventionSelect(interventions) {
  const interventionSelects = document.querySelectorAll('select[name="intervention"], select[id="intervention"]');
  console.log('Found intervention selects:', interventionSelects.length);
  interventionSelects.forEach(select => {
    console.log('Populating intervention select:', select.id || select.name);
    // Keep the first placeholder option
    const placeholder = select.options[0];
    select.innerHTML = '';
    select.appendChild(placeholder);
    
    interventions.forEach(intervention => {
      const option = document.createElement('option');
      option.value = intervention.intervention_id;
      // Format the display text: replace underscores with spaces and capitalize
      const displayText = intervention.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      option.textContent = `${intervention.intervention_id} - ${displayText}`;
      select.appendChild(option);
    });
    console.log('Intervention select now has', select.options.length, 'options');
  });
}


// Populate zone select dropdowns
function populateZoneSelect(zones) {
  const zoneSelects = document.querySelectorAll('select[name="zone"], select[id="zone"]');
  console.log('Found zone selects:', zoneSelects.length);
  zoneSelects.forEach(select => {
    console.log('Populating select:', select.id || select.name);
    zones.forEach(zone => {
      const option = document.createElement('option');
      option.value = zone.zone_id;
      option.textContent = zone.name;
      select.appendChild(option);
    });
    console.log('Select now has', select.options.length, 'options');
  });
}

// Load and display noise data on explore page
async function loadExploreData() {
  const zoneSelect = document.getElementById('zone');
  const timeWindowSelect = document.getElementById('time_window');
  const sourceSelect = document.getElementById('source');
  const categorySelect = document.getElementById('category');
  const trendGranularitySelect = document.getElementById('trend_granularity');
  
  let zone = zoneSelect?.value;
  const timeWindow = timeWindowSelect?.value;
  const source = sourceSelect?.value;
  const category = categorySelect?.value;
  const trendGranularity = trendGranularitySelect?.value || 'hour';

  console.log('loadExploreData called with:', { zone, timeWindow, source, category, trendGranularity });

  // Auto-select first zone if none is selected (after zones are loaded)
  if (!zone && zoneSelect?.options?.length > 1) {
    zoneSelect.selectedIndex = 1; // Select the first actual option (index 0 is the placeholder)
    zone = zoneSelect.value;
    console.log('Auto-selected zone:', zone);
  }

  if (!zone) {
    console.warn('No zone selected and no zones available');
    renderExploreTrendChart([]);
    renderZoneMap([]);
    // Still try to load reports even without a zone
    await refreshReportsSummary();
    return;
  }

  const sharedFilters = {
    time_window: timeWindow,
    source: source,
    categories: category ? [category] : undefined
  };

  await loadAndDisplay(
    () => API.getNoiseData({ 
      zones: [zone],
      ...sharedFilters
    }),
    (data) => displayNoiseData(data, trendGranularity),
    'Failed to load noise data'
  );

  await loadAndDisplay(
    () => API.getNoiseData(sharedFilters),
    renderZoneMap,
    'Failed to load map data'
  );
}

function renderExploreTrendChart(data, granularity = 'hour') {
  const container = document.getElementById('trendChart');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="muted small">No trend data available for this selection.</div>';
    return;
  }

  const grouped = new Map();
  data.forEach(row => {
    const ts = new Date(row.timestamp);
    if (Number.isNaN(ts.getTime())) return;
    let key;
    if (granularity === 'day') {
      key = ts.toISOString().slice(0, 10);
    } else if (granularity === 'week') {
      const weekStart = new Date(ts);
      const day = weekStart.getUTCDay() || 7;
      weekStart.setUTCDate(weekStart.getUTCDate() - day + 1);
      key = `Wk ${weekStart.toISOString().slice(5, 10)}`;
    } else {
      key = `${String(ts.getHours()).padStart(2, '0')}:00`;
    }
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(Number(row.value_db) || 0);
  });

  const points = Array.from(grouped.entries())
    .map(([label, values]) => ({
      label,
      value: values.reduce((sum, current) => sum + current, 0) / values.length
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  if (points.length === 0) {
    container.innerHTML = '<div class="muted small">No trend data available for this selection.</div>';
    return;
  }

  const width = 700;
  const height = 240;
  const left = 40;
  const right = 20;
  const top = 15;
  const bottom = 35;
  const minValue = Math.min(...points.map(p => p.value));
  const maxValue = Math.max(...points.map(p => p.value));
  const spread = Math.max(1, maxValue - minValue);
  const xStep = points.length > 1 ? (width - left - right) / (points.length - 1) : 0;

  const chartPoints = points.map((point, index) => {
    const x = left + (index * xStep);
    const normalized = (point.value - minValue) / spread;
    const y = top + ((1 - normalized) * (height - top - bottom));
    return { ...point, x, y };
  });

  const polylinePoints = chartPoints.map(point => `${point.x},${point.y}`).join(' ');
  const xLabels = chartPoints
    .filter((_, index) => points.length <= 8 || index % Math.ceil(points.length / 8) === 0 || index === points.length - 1)
    .map(point => `<text x="${point.x}" y="${height - 10}" font-size="10" text-anchor="middle" fill="#6b7280">${point.label}</text>`)
    .join('');

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" role="img" aria-label="Noise trend chart">
      <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="#d1d5db" />
      <line x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" stroke="#d1d5db" />
      <polyline fill="none" stroke="#0d6efd" stroke-width="3" points="${polylinePoints}" />
      ${chartPoints.map(point => `<circle cx="${point.x}" cy="${point.y}" r="3" fill="#0d6efd"></circle>`).join('')}
      ${xLabels}
      <text x="8" y="${top + 8}" font-size="10" fill="#6b7280">${maxValue.toFixed(1)} dB</text>
      <text x="8" y="${height - bottom}" font-size="10" fill="#6b7280">${minValue.toFixed(1)} dB</text>
    </svg>
  `;
}

function updateExploreSummaryMetrics(data, granularity = 'hour') {
  const avgDbEl = document.getElementById('avgDb');
  const peakTimeEl = document.getElementById('peakTime');

  if (!data || data.length === 0) {
    if (avgDbEl) avgDbEl.textContent = '—';
    if (peakTimeEl) peakTimeEl.textContent = '—';
    return;
  }

  const values = data.map(row => Number(row.value_db)).filter(value => !Number.isNaN(value));
  if (avgDbEl) {
    const avg = values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
    avgDbEl.textContent = avg.toFixed(1);
  }

  const grouped = new Map();
  data.forEach(row => {
    const ts = new Date(row.timestamp);
    const value = Number(row.value_db);
    if (Number.isNaN(ts.getTime()) || Number.isNaN(value)) return;
    let key;
    if (granularity === 'day') {
      key = ts.toISOString().slice(0, 10);
    } else if (granularity === 'week') {
      const weekStart = new Date(ts);
      const day = weekStart.getUTCDay() || 7;
      weekStart.setUTCDate(weekStart.getUTCDate() - day + 1);
      key = `Wk ${weekStart.toISOString().slice(5, 10)}`;
    } else {
      key = `${String(ts.getHours()).padStart(2, '0')}:00`;
    }
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(value);
  });

  let peakKey = null;
  let peakValue = -Infinity;
  grouped.forEach((entries, key) => {
    const avg = entries.reduce((sum, value) => sum + value, 0) / entries.length;
    if (avg > peakValue) {
      peakValue = avg;
      peakKey = key;
    }
  });

  if (peakTimeEl) {
    if (peakKey === null) {
      peakTimeEl.textContent = '—';
    } else {
      peakTimeEl.textContent = peakKey;
    }
  }
}

function renderZoneMap(data) {
  const container = document.getElementById('zoneMap');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<div class="muted small">No zone map data available for this selection.</div>';
    return;
  }

  const zoneNameMap = {};
  const zoneOptions = document.querySelectorAll('#zone option');
  zoneOptions.forEach(option => {
    if (option.value) zoneNameMap[option.value] = option.textContent;
  });

  const byZone = new Map();
  data.forEach(row => {
    const value = Number(row.value_db);
    if (!row.zone_id || Number.isNaN(value)) return;
    if (!byZone.has(row.zone_id)) byZone.set(row.zone_id, []);
    byZone.get(row.zone_id).push(value);
  });

  const zoneStats = Array.from(byZone.entries()).map(([zoneId, values]) => ({
    zoneId,
    avg: values.reduce((sum, val) => sum + val, 0) / values.length
  }));

  if (zoneStats.length === 0) {
    container.innerHTML = '<div class="muted small">No zone map data available for this selection.</div>';
    return;
  }

  const min = Math.min(...zoneStats.map(item => item.avg));
  const max = Math.max(...zoneStats.map(item => item.avg));
  const spread = Math.max(1, max - min);

  container.innerHTML = zoneStats
    .sort((a, b) => a.zoneId.localeCompare(b.zoneId))
    .map(item => {
      const intensity = (item.avg - min) / spread;
      const bg = `rgba(220, 53, 69, ${0.15 + (intensity * 0.55)})`;
      const zoneName = zoneNameMap[item.zoneId] || item.zoneId;
      return `
        <div class="zone-tile" style="background:${bg};">
          <div class="fw-semibold small">${zoneName}</div>
          <div class="muted small">${item.zoneId}</div>
          <div class="mt-1"><span class="badge bg-dark">${item.avg.toFixed(1)} dB</span></div>
        </div>
      `;
    })
    .join('');
}

// Display noise data in table
function displayNoiseData(data, trendGranularity = 'hour') {
  const container = document.getElementById('noise-data-container');
  if (!container) return;

  updateExploreSummaryMetrics(data, trendGranularity);
  renderExploreTrendChart(data, trendGranularity);

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="text-muted">No data available</p>';
    return;
  }

  let html = '<table class="table table-sm"><thead><tr><th>Zone</th><th>Timestamp</th><th>Source</th><th>Value (dB)</th><th>Category</th></tr></thead><tbody>';

  const recentRows = [...data]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 6);

  recentRows.forEach(row => {
    html += `<tr>
      <td>${row.zone_id || 'N/A'}</td>
      <td>${new Date(row.timestamp).toLocaleString()}</td>
      <td>${row.source || 'N/A'}</td>
      <td>${row.value_db || 'N/A'}</td>
      <td><span class="badge bg-info">${row.category_tag || 'N/A'}</span></td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// Load and display hotspots
const HOTSPOT_PAGE_SIZE = 5;
const HOTSPOT_TOTAL_PAGES = 3;
let hotspotRankingCache = [];
let hotspotCurrentPage = 1;

async function loadHotspots() {
  await loadAndDisplay(
    () => API.getHotspots(15),
    displayHotspots,
    'Failed to load hotspots'
  );
}

function renderHotspotRankingPage() {
  const hotspotTable = document.getElementById('hotspotTable');
  if (!hotspotTable) return;

  if (!hotspotRankingCache || hotspotRankingCache.length === 0) {
    hotspotTable.innerHTML = '<tr><td colspan="5" class="text-muted small">No hotspots available</td></tr>';
    return;
  }

  const start = (hotspotCurrentPage - 1) * HOTSPOT_PAGE_SIZE;
  const pageItems = hotspotRankingCache.slice(start, start + HOTSPOT_PAGE_SIZE);

  hotspotTable.innerHTML = pageItems.map((hotspot, index) => {
    const severity = Number(hotspot.severity_score || 0);
    const driver = hotspot.rationale || '—';
    const rank = start + index + 1;
    return `
      <tr>
        <td>${rank}</td>
        <td>${hotspot.zone_id || 'N/A'}<div class="small text-muted">${hotspot.time_window || 'N/A'}</div></td>
        <td><span class="badge bg-dark">${severity.toFixed(2)}</span></td>
        <td class="small text-muted">${driver}</td>
        <td><a class="btn btn-sm btn-outline-secondary" href="/plan">Plan</a></td>
      </tr>
    `;
  }).join('');

  const pageButtons = document.querySelectorAll('.hotspot-page-btn');
  pageButtons.forEach(btn => {
    const page = Number(btn.dataset.page);
    if (page === hotspotCurrentPage) {
      btn.classList.remove('btn-outline-secondary');
      btn.classList.add('btn-dark');
    } else {
      btn.classList.add('btn-outline-secondary');
      btn.classList.remove('btn-dark');
    }

    const maxPage = Math.ceil(hotspotRankingCache.length / HOTSPOT_PAGE_SIZE);
    btn.disabled = page > maxPage;
  });
}

// Display hotspots
function displayHotspots(data) {
  const container = document.getElementById('hotspots-container');
  const hotspotTable = document.getElementById('hotspotTable');
  const incidentsChart = document.getElementById('incidentsChart');
  if (!container) return;

  const normalizeZoneLabel = (zoneId) => {
    const raw = String(zoneId || '').trim().toUpperCase();
    const directMatch = raw.match(/^Z(\d{1,2})$/);
    if (directMatch) return `Z${directMatch[1].padStart(2, '0')}`;
    const digitMatch = raw.match(/(\d{1,2})/);
    if (digitMatch) return `Z${digitMatch[1].padStart(2, '0')}`;
    return raw || 'N/A';
  };

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="text-muted">No hotspots available</p>';
    if (hotspotTable) hotspotTable.innerHTML = '<tr><td colspan="5" class="text-muted small">No hotspots available</td></tr>';
    if (incidentsChart) incidentsChart.innerHTML = '<div class="muted small">No incident data available.</div>';
    return;
  }

  hotspotRankingCache = [...data].slice(0, HOTSPOT_PAGE_SIZE * HOTSPOT_TOTAL_PAGES);
  hotspotCurrentPage = 1;

  const pageButtons = document.querySelectorAll('.hotspot-page-btn');
  pageButtons.forEach(btn => {
    btn.onclick = () => {
      hotspotCurrentPage = Number(btn.dataset.page);
      renderHotspotRankingPage();
    };
  });

  renderHotspotRankingPage();

  if (incidentsChart) {
    incidentsChart.style.display = 'block';
    incidentsChart.style.maxHeight = '260px';
    incidentsChart.style.overflowY = 'auto';

    const byZone = new Map();
    data.forEach(item => {
      const zoneLabel = normalizeZoneLabel(item.zone_id);
      const count = Number(item.report_count ?? item.validated_report_count ?? 0);
      byZone.set(zoneLabel, (byZone.get(zoneLabel) || 0) + count);
    });

    const zoneRows = Array.from(byZone.entries())
      .map(([zoneLabel, count]) => ({ zoneLabel, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const maxCount = Math.max(...zoneRows.map(item => item.count), 0);

    if (maxCount === 0) {
      incidentsChart.innerHTML = '<div class="muted small">No incidents available for current hotspot windows yet.</div>';
    } else {
      incidentsChart.innerHTML = `<div class="row g-2">${zoneRows.map(item => {
      const count = item.count;
      const width = (count / maxCount) * 100;
      const zoneLabel = item.zoneLabel;
      return `
        <div class="col-6">
          <div class="mb-2">
          <div class="d-flex justify-content-between small mb-1">
            <span>${zoneLabel}</span>
            <span>${count}</span>
          </div>
          <div class="progress" style="height:8px;">
            <div class="progress-bar" role="progressbar" style="width:${width}%;" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${maxCount}"></div>
          </div>
        </div>
        </div>
      `;
    }).join('')}</div>`;
    }
  }

  const topThree = data.slice(0, 3).map(item => `${item.zone_id} (${Number(item.severity_score || 0).toFixed(2)})`).join(' · ');
  container.innerHTML = `<div class="small text-muted">Top hotspots: ${topThree || 'N/A'}</div>`;
}

// Submit incident report
async function submitIncidentReport(event) {
  event.preventDefault();
  
  // Get form elements using the form from the event
  const form = event.target;
  const zoneSelect = form.querySelector('select[name="zone"]') || form.querySelector('#zone');
  const categorySelect = form.querySelector('select[name="category"]') || form.querySelector('#category');
  const descriptionInput = form.querySelector('textarea[name="description"]');
  const timeWindowSelect = form.querySelector('select[name="time_window"]');
  const severitySelect = form.querySelector('select[name="severity"]');

  const zone = zoneSelect?.value;
  const category = categorySelect?.value;
  const description = descriptionInput?.value || '';
  const time_window = timeWindowSelect?.value || '';
  const severity = severitySelect?.value || '';

  // Get the success message element
  const successEl = document.getElementById('reportSuccess');

  // Debug: log the values
  console.log('Form values:', { zone, category, description, time_window, severity });

  if (!zone || !category) {
    // Show error in the success element
    if (successEl) {
      successEl.className = 'alert alert-danger mt-4';
      successEl.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i>Please fill in the required fields (Zone and Category).';
      successEl.classList.remove('d-none');
      successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    console.error('Missing required fields:', { zone, category });
    return;
  }

  const payload = {
    zone_id: zone,
    category: category,
    description: description
  };
  // include optional fields if present
  if (time_window) payload.time_window = time_window;
  if (severity) payload.severity = severity;

  // Get submit button and show loading state
  const submitBtn = event.target.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>Submitting...';
  }

  let result = null;
  try {
    result = await API.submitReport(payload);
  } catch (err) {
    console.error('Report submission error:', err);
    if (successEl) {
      successEl.className = 'alert alert-danger mt-4';
      successEl.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i>Error: Failed to submit report. Please try again.';
      successEl.classList.remove('d-none');
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
  }

  if (result) {
    if (result.__error) {
      // Handle API error response
      if (successEl) {
        successEl.className = 'alert alert-danger mt-4';
        successEl.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i>Error: ' + (result.body?.error || 'Failed to submit report. Please try again.');
        successEl.classList.remove('d-none');
      }
    } else {
      // Success
      if (successEl) {
        successEl.className = 'alert alert-success mt-4';
        successEl.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Report submitted successfully! A planner will review it for validity/duplication.';
        successEl.classList.remove('d-none');
      }
      event.target.reset();
      // Refresh report summary in UI if present
      try { refreshReportsSummary(); } catch (e) { console.warn('Could not refresh reports summary', e); }
    }
    
    // Scroll to the success/error message
    if (successEl) {
      successEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

// Refresh reports summary (count) and recent observations
async function refreshReportsSummary() {
  const el = document.getElementById('reportCount');
  if (!el) return;
  
  console.log('Refreshing reports summary...');
  
  // Make direct API call without executeApiCall to avoid showing alerts on error
  let reports = null;
  try {
    reports = await API.getReports();
  } catch (error) {
    console.warn('Failed to load reports, keeping existing count:', error);
    // Don't show alert, just log to console and keep existing count
    return;
  }
  
  if (!reports) {
    console.warn('No reports loaded, keeping existing count');
    return;
  }
  
  // Update simple count
  el.textContent = String(reports.length || 0);
  console.log('Reports count updated:', reports.length);

  // Optionally update recent observations table if present
  const obsTable = document.getElementById('observationsTable');
  if (obsTable) {
    // Keep existing mock rows but prepend up to 3 recent reports
    const recentReports = reports.slice(-3).reverse();
    recentReports.forEach(r => {
      const tr = document.createElement('tr');
      const time = new Date(r.timestamp).toLocaleString();
      tr.innerHTML = `<td>${time}</td><td><span class="badge bg-light text-dark">Report</span></td><td>—</td><td>${r.category || 'Report'}</td>`;
      obsTable.insertBefore(tr, obsTable.firstChild);
    });
    // Trim to 12 rows to avoid uncontrolled growth
    while (obsTable.children.length > 12) obsTable.removeChild(obsTable.lastChild);
  }
}

function formatStatusBadge(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'done') return '<span class="badge bg-success-subtle text-success">Done</span>';
  if (normalized === 'in_progress') return '<span class="badge bg-info-subtle text-info">In progress</span>';
  return '<span class="badge bg-secondary-subtle text-secondary">Planned</span>';
}

function displayInterventionsForPlan(plan) {
  const raw = plan.interventions_selected;
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'string') {
    const matches = raw.match(/INT\d+|I\d+/g);
    if (matches && matches.length > 0) return matches.join(', ');
    return raw;
  }
  return '—';
}

const PLAN_PAGE_SIZE = 10;
let plansTrackerCache = [];
let plansTrackerCurrentPage = 0;

function updatePlansPaginationControls() {
  const pageInfo = document.getElementById('planPageInfo');
  const prevBtn = document.getElementById('planPrevPage');
  const nextBtn = document.getElementById('planNextPage');
  const totalPages = Math.ceil(plansTrackerCache.length / PLAN_PAGE_SIZE);

  if (pageInfo) {
    if (totalPages === 0) {
      pageInfo.textContent = 'Page 0 of 0';
    } else {
      pageInfo.textContent = `Page ${plansTrackerCurrentPage + 1} of ${totalPages}`;
    }
  }

  if (prevBtn) prevBtn.disabled = plansTrackerCurrentPage <= 0;
  if (nextBtn) nextBtn.disabled = totalPages === 0 || plansTrackerCurrentPage >= totalPages - 1;
}

function renderPlansTrackerPage() {
  const table = document.getElementById('plansTable');
  if (!table) return;

  if (!plansTrackerCache || plansTrackerCache.length === 0) {
    table.innerHTML = '<tr><td colspan="7" class="text-muted small">No plans available.</td></tr>';
    updatePlansPaginationControls();
    return;
  }

  const start = plansTrackerCurrentPage * PLAN_PAGE_SIZE;
  const end = start + PLAN_PAGE_SIZE;
  const pagePlans = plansTrackerCache.slice(start, end);

  table.innerHTML = pagePlans.map(plan => {
    const safeNotes = String(plan.notes || '').replace(/"/g, '&quot;');
    return `
      <tr data-plan-id="${plan.plan_id}">
        <td>${plan.plan_id}</td>
        <td>${plan.zone_id}</td>
        <td class="small">${displayInterventionsForPlan(plan)}</td>
        <td>
          <div class="mb-1">${formatStatusBadge(plan.status)}</div>
          <select class="form-select form-select-sm tracker-status" aria-label="Update status for ${plan.plan_id}">
            <option value="planned" ${plan.status === 'planned' ? 'selected' : ''}>Planned</option>
            <option value="in_progress" ${plan.status === 'in_progress' ? 'selected' : ''}>In progress</option>
            <option value="done" ${plan.status === 'done' ? 'selected' : ''}>Done</option>
          </select>
        </td>
        <td>${plan.expected_impact ?? '—'} dB</td>
        <td>
          <input class="form-control form-control-sm tracker-notes" value="${safeNotes}" placeholder="Add notes/evidence" aria-label="Notes for ${plan.plan_id}">
        </td>
        <td>
          <button class="btn btn-sm btn-outline-dark tracker-save" type="button">Save</button>
        </td>
      </tr>
    `;
  }).join('');

  table.querySelectorAll('.tracker-save').forEach(btn => {
    btn.addEventListener('click', handlePlanTrackerSave);
  });

  updatePlansPaginationControls();
}

function renderPlansTracker(plans) {
  plansTrackerCache = Array.isArray(plans) ? plans : [];
  const totalPages = Math.ceil(plansTrackerCache.length / PLAN_PAGE_SIZE);
  if (totalPages === 0) {
    plansTrackerCurrentPage = 0;
  } else if (plansTrackerCurrentPage >= totalPages) {
    plansTrackerCurrentPage = totalPages - 1;
  }
  renderPlansTrackerPage();
}

async function loadPlansTracker() {
  const plans = await executeApiCall(() => API.getPlans(), 'Failed to load plans tracker');
  if (plans) {
    renderPlansTracker(plans);
  }
}

async function handlePlanTrackerSave(event) {
  const row = event.currentTarget.closest('tr');
  const planId = row?.dataset?.planId;
  if (!planId) return;

  const status = row.querySelector('.tracker-status')?.value;
  const notes = row.querySelector('.tracker-notes')?.value || '';

  const result = await executeApiCall(
    () => API.updatePlan(planId, { status, notes }),
    `Failed to update plan ${planId}`
  );

  if (result) {
    await loadPlansTracker();
  }
}

function initPlanForm() {
  const form = document.getElementById('planForm');
  if (!form) return;

  const interventionEl = document.getElementById('intervention');
  const zoneEl = document.getElementById('zone');
  const notesEl = document.getElementById('notes');
  const confirmation = document.getElementById('planConfirmation');

  if (interventionEl) {
    interventionEl.addEventListener('change', () => {
      interventionEl.classList.remove('is-invalid');
      updatePlanInterventionDetails();
    });
  }
  if (zoneEl) {
    zoneEl.addEventListener('change', () => zoneEl.classList.remove('is-invalid'));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (confirmation) confirmation.classList.add('d-none');

    const zone = zoneEl?.value;
    const intervention = interventionEl?.value;
    const notes = notesEl?.value || '';

    let ok = true;
    if (!zone && zoneEl) {
      zoneEl.classList.add('is-invalid');
      ok = false;
    }
    if (!intervention && interventionEl) {
      interventionEl.classList.add('is-invalid');
      ok = false;
    }
    if (!ok) return;

    const payload = {
      zone_id: zone,
      interventions: [intervention],
      notes
    };

    const result = await executeApiCall(() => API.createPlan(payload), 'Failed to create plan');
    if (!result) return;

    if (confirmation) {
      confirmation.classList.remove('d-none');
      confirmation.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i>Plan created successfully. Plan ID: <strong>${result.plan_id}</strong>.`;
    }

    form.reset();
    updatePlanInterventionDetails();
    await loadPlansTracker();
  });
}

async function initPlanPage() {
  const prevBtn = document.getElementById('planPrevPage');
  const nextBtn = document.getElementById('planNextPage');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (plansTrackerCurrentPage > 0) {
        plansTrackerCurrentPage -= 1;
        renderPlansTrackerPage();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(plansTrackerCache.length / PLAN_PAGE_SIZE);
      if (plansTrackerCurrentPage < totalPages - 1) {
        plansTrackerCurrentPage += 1;
        renderPlansTrackerPage();
      }
    });
  }

  await loadInterventions();
  initPlanForm();
  await loadPlansTracker();
}

function getCurrentExploreFilters() {
  const zone = document.getElementById('zone')?.value;
  const source = document.getElementById('source')?.value;
  const timeWindow = document.getElementById('time_window')?.value;
  const category = document.getElementById('category')?.value;

  const filters = {};
  if (zone) filters.zones = [zone];
  if (source) filters.source = source;
  if (timeWindow) filters.time_window = timeWindow;
  if (category) filters.categories = [category];
  return filters;
}

function initExploreExports() {
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportPdfBtn = document.getElementById('exportPdfBtn');

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      const url = API.buildExportUrl('csv', 'observations', getCurrentExploreFilters());
      window.open(url, '_blank');
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', () => {
      const url = API.buildExportUrl('pdf', 'observations', getCurrentExploreFilters());
      window.open(url, '_blank');
    });
  }
}

// Initialize page based on current route
document.addEventListener('DOMContentLoaded', async function() {
  // Load zones on all pages
  await loadZones();

  // Page-specific initialization
  const pathname = window.location.pathname;

  if (pathname.includes('/explore')) {
    initExploreExports();
    const exploreForm = document.getElementById('exploreFilters');
    if (exploreForm) {
      exploreForm.addEventListener('submit', (e) => {
        console.log('Form submitted');
        e.preventDefault();
        loadExploreData();
      });
    }
    // Load initial data
    await loadExploreData();
    // Refresh report count/observations
    await refreshReportsSummary();
  } else if (pathname.includes('/hotspots')) {
    loadHotspots();
  } else if (pathname.includes('/report')) {
    const reportForm = document.querySelector('form');
    if (reportForm) {
      reportForm.addEventListener('submit', submitIncidentReport);
    }
  } else if (pathname.includes('/plan')) {
    initPlanPage();

  } else if (pathname.includes('/quest')) {
    initQuest();
  } else if (pathname.includes('/moderate')) {
    initModeration();
  }
});


// ===== Quiet Quest =====

async function initQuest() {
  const [missions, progress] = await Promise.all([
    executeApiCall(() => API.getMissions(), 'Failed to load missions'),
    executeApiCall(() => API.getQuestProgress(), 'Failed to load progress')
  ]);
  if (missions && progress) {
    renderQuestProgress(progress);
    renderMissions(missions, progress);
    renderBadges(progress);
  }
}

function renderQuestProgress(progress) {
  const tp = progress.tier_progress || {};
  for (let tier = 1; tier <= 3; tier++) {
    const count = tp[String(tier)] || 0;
    const pct = Math.round((count / 6) * 100);
    const bar = document.getElementById(`tier${tier}-bar`);
    const label = document.getElementById(`tier${tier}-label`);
    if (bar) {
      bar.style.width = pct + '%';
      bar.setAttribute('aria-valuenow', pct);
    }
    if (label) label.textContent = `${count} / 6`;
  }
  const totalEl = document.getElementById('total-completed');
  if (totalEl) totalEl.textContent = progress.total_completed || 0;
}

function renderMissions(missions, progress) {
  for (let tier = 1; tier <= 3; tier++) {
    const container = document.getElementById(`tier${tier}-missions`);
    if (!container) continue;

    const tierMissions = missions[String(tier)] || [];
    if (tierMissions.length === 0) {
      container.innerHTML = '<p class="text-muted small">No missions available for this tier.</p>';
      continue;
    }

    // Check if previous tier is unlocked (tier 1 always unlocked)
    const prevTierDone = tier === 1 || (progress.tier_progress[String(tier - 1)] || 0) >= 6;

    let html = '';
    tierMissions.forEach((m, idx) => {
      const isCompleted = m.completed && m.correct;
      const isFailed = m.completed && !m.correct;
      const locked = !prevTierDone;

      let statusBadge, icon;
      if (locked) {
        statusBadge = '<span class="badge bg-secondary-subtle text-secondary">Locked</span>';
        icon = '<i class="bi bi-lock me-1"></i>';
      } else if (isCompleted) {
        statusBadge = '<span class="badge bg-success-subtle text-success">Correct</span>';
        icon = '<i class="bi bi-check-circle-fill text-success me-1"></i>';
      } else if (isFailed) {
        statusBadge = '<span class="badge bg-warning-subtle text-warning">Try again</span>';
        icon = '<i class="bi bi-x-circle text-warning me-1"></i>';
      } else {
        statusBadge = '<span class="badge bg-light text-muted">Not started</span>';
        icon = '<i class="bi bi-circle me-1"></i>';
      }

      html += `<div class="list-group-item py-3 mission-item" data-mission-id="${m.mission_id}">
        <div class="d-flex justify-content-between align-items-start gap-3">
          <div>
            <div class="fw-semibold">${icon}${m.title}</div>
            <div class="muted small">${m.question}</div>
          </div>
          ${statusBadge}
        </div>`;

      if (!locked && !isCompleted) {
        html += `<div class="mt-3 mission-answer-area" id="answer-${m.mission_id}">
          <div class="d-flex flex-wrap gap-2 mb-2">`;
        m.options.forEach(opt => {
          html += `<button class="btn btn-outline-primary btn-sm btn-pill mission-option"
                    data-mission="${m.mission_id}" data-answer="${opt}">${opt}</button>`;
        });
        html += `</div>
          <button class="btn btn-link btn-sm text-muted p-0 hint-toggle" data-hint="${m.hint}">
            <i class="bi bi-lightbulb me-1"></i>Show hint
          </button>
          <div class="hint-text small text-muted mt-1 d-none"></div>
        </div>`;
      }

      html += '</div>';
    });

    container.innerHTML = html;
  }

  // Attach event listeners
  document.querySelectorAll('.mission-option').forEach(btn => {
    btn.addEventListener('click', handleMissionAnswer);
  });
  document.querySelectorAll('.hint-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
      const hintDiv = this.nextElementSibling;
      hintDiv.classList.toggle('d-none');
      hintDiv.textContent = this.dataset.hint;
      this.textContent = hintDiv.classList.contains('d-none') ? 'Show hint' : 'Hide hint';
    });
  });
}

async function handleMissionAnswer(e) {
  const btn = e.currentTarget;
  const missionId = btn.dataset.mission;
  const answer = btn.dataset.answer;

  // Disable all options for this mission
  document.querySelectorAll(`[data-mission="${missionId}"]`).forEach(b => {
    b.disabled = true;
  });

  const result = await executeApiCall(
    () => API.submitMissionAnswer(missionId, answer),
    'Failed to submit answer'
  );

  if (!result) {
    document.querySelectorAll(`[data-mission="${missionId}"]`).forEach(b => {
      b.disabled = false;
    });
    return;
  }

  // Highlight correct/incorrect
  document.querySelectorAll(`[data-mission="${missionId}"]`).forEach(b => {
    if (b.dataset.answer === result.correct_answer) {
      b.classList.remove('btn-outline-primary');
      b.classList.add('btn-success');
    } else if (b.dataset.answer === answer && !result.correct) {
      b.classList.remove('btn-outline-primary');
      b.classList.add('btn-danger');
    }
  });

  // Show explanation
  const area = document.getElementById(`answer-${missionId}`);
  if (area) {
    const explanationHtml = `<div class="alert ${result.correct ? 'alert-success' : 'alert-warning'} mt-2 small mb-0">
      <strong>${result.correct ? 'Correct!' : 'Not quite.'}</strong> ${result.explanation}
    </div>`;
    area.insertAdjacentHTML('beforeend', explanationHtml);
  }

  // Show new badges
  if (result.new_badges && result.new_badges.length > 0) {
    result.new_badges.forEach(badge => {
      showBadgeNotification(badge);
    });
  }

  // Refresh progress and re-render
  if (result.correct) {
    const [progress, missions] = await Promise.all([
      executeApiCall(() => API.getQuestProgress(), ''),
      executeApiCall(() => API.getMissions(), '')
    ]);
    if (progress) {
      renderQuestProgress(progress);
      renderBadges(progress);
      if (missions) {
        renderMissions(missions, progress);
      }
    }
  }
}

function renderBadges(progress) {
  const container = document.getElementById('badges-container');
  if (!container) return;

  const allBadges = progress.all_badges || [];
  const earnedIds = new Set((progress.badges || []).map(b => b.id));

  let html = '';
  allBadges.forEach(badge => {
    const earned = earnedIds.has(badge.id);
    html += `<div class="d-flex align-items-center gap-2 mb-2 ${earned ? '' : 'opacity-50'}">
      <div class="badge-icon ${earned ? 'bg-soft-amber' : 'bg-soft-slate'} flex-shrink-0" style="width:36px;height:36px;border-radius:12px;">
        <i class="${badge.icon}"></i>
      </div>
      <div>
        <div class="small fw-semibold">${badge.name}</div>
        <div class="small muted">${badge.description}</div>
      </div>
      ${earned ? '<i class="bi bi-check-circle-fill text-success ms-auto"></i>' : ''}
    </div>`;
  });

  container.innerHTML = html;
}

function showBadgeNotification(badge) {
  const toast = document.createElement('div');
  toast.className = 'position-fixed bottom-0 end-0 p-3';
  toast.style.zIndex = '9999';
  toast.innerHTML = `<div class="toast show align-items-center text-bg-warning border-0" role="alert">
    <div class="d-flex">
      <div class="toast-body">
        <i class="${badge.icon} me-1"></i> <strong>Badge earned!</strong> ${badge.name}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.position-fixed').remove()"></button>
    </div>
  </div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ===== Moderation =====

const MODERATION_PAGE_SIZE = 10;
let moderationReportsCache = [];
let moderationCurrentPage = 0;

async function initModeration() {
  const nextPageBtn = document.getElementById('moderationNextPage');
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      const nextStart = (moderationCurrentPage + 1) * MODERATION_PAGE_SIZE;
      if (nextStart < moderationReportsCache.length) {
        moderationCurrentPage += 1;
        renderModerationPage();
      }
    });
  }

  await loadModerationReports();
}

function formatModerationStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'valid') {
    return { label: 'Validated', className: 'badge bg-success-subtle text-success status-badge' };
  }
  if (normalized === 'duplicate') {
    return { label: 'Duplicate', className: 'badge bg-secondary-subtle text-secondary status-badge' };
  }
  if (normalized === 'invalid') {
    return { label: 'Invalid', className: 'badge bg-danger-subtle text-danger status-badge' };
  }
  if (normalized === 'action_planned' || normalized === 'closed') {
    return { label: 'Reviewed', className: 'badge bg-info-subtle text-info status-badge' };
  }
  return { label: 'Under review', className: 'badge bg-warning-subtle text-warning status-badge' };
}

function buildModerationRow(report) {
  const row = document.createElement('tr');
  row.dataset.reportId = report.report_id;

  const reportId = report.report_id || 'N/A';
  const zone = report.zone_id || 'N/A';
  const timeWindow = report.time_window || 'N/A';
  const category = report.category || 'N/A';
  const severity = report.severity || '—';
  const statusInfo = formatModerationStatus(report.status);
  const isReviewable = ['pending', 'under_review'].includes(String(report.status || '').toLowerCase());

  row.innerHTML = `
    <td>#${reportId}</td>
    <td>${zone}</td>
    <td>${timeWindow}</td>
    <td>${category}</td>
    <td>${severity}</td>
    <td><span class="${statusInfo.className}">${statusInfo.label}</span></td>
    <td class="action-buttons">
      ${isReviewable
        ? `<button class="btn btn-sm btn-success me-1 moderation-btn" type="button" data-action="valid">Valid</button>
           <button class="btn btn-sm btn-outline-secondary me-1 moderation-btn" type="button" data-action="duplicate">Duplicate</button>
           <button class="btn btn-sm btn-outline-danger moderation-btn" type="button" data-action="invalid">Invalid</button>`
        : '<span class="text-muted small">Reviewed</span>'}
    </td>
  `;

  if (isReviewable) {
    row.querySelectorAll('.moderation-btn').forEach(btn => {
      btn.addEventListener('click', handleModeration);
    });
  }

  return row;
}

function renderModerationPage() {
  const tableBody = document.getElementById('reportsTable');
  const pageInfo = document.getElementById('moderationPageInfo');
  const nextPageBtn = document.getElementById('moderationNextPage');
  if (!tableBody) return;

  tableBody.innerHTML = '';

  if (moderationReportsCache.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="7" class="text-muted small">No reports available.</td></tr>';
    if (pageInfo) pageInfo.textContent = 'Page 0';
    if (nextPageBtn) nextPageBtn.disabled = true;
    return;
  }

  const start = moderationCurrentPage * MODERATION_PAGE_SIZE;
  const end = start + MODERATION_PAGE_SIZE;
  const pageReports = moderationReportsCache.slice(start, end);
  pageReports.forEach(report => {
    tableBody.appendChild(buildModerationRow(report));
  });

  const totalPages = Math.ceil(moderationReportsCache.length / MODERATION_PAGE_SIZE);
  if (pageInfo) {
    pageInfo.textContent = `Page ${moderationCurrentPage + 1} of ${totalPages}`;
  }

  if (nextPageBtn) {
    nextPageBtn.disabled = moderationCurrentPage >= totalPages - 1;
  }
}

async function loadModerationReports() {
  const tableBody = document.getElementById('reportsTable');
  if (!tableBody) return;

  API.setRole('planner');
  const reports = await executeApiCall(() => API.getReports(), 'Failed to load reports for moderation');
  if (!reports) {
    tableBody.innerHTML = '<tr><td colspan="7" class="text-danger small">Could not load reports.</td></tr>';
    return;
  }

  const pendingFirst = [...reports].sort((a, b) => {
    const statusA = ['pending', 'under_review'].includes(String(a.status || '').toLowerCase()) ? 0 : 1;
    const statusB = ['pending', 'under_review'].includes(String(b.status || '').toLowerCase()) ? 0 : 1;
    return statusA - statusB;
  });

  moderationReportsCache = pendingFirst;
  const totalPages = Math.ceil(moderationReportsCache.length / MODERATION_PAGE_SIZE);
  if (moderationCurrentPage >= totalPages) {
    moderationCurrentPage = Math.max(0, totalPages - 1);
  }
  renderModerationPage();
}

async function handleModeration(e) {
  const btn = e.currentTarget;
  const action = btn.dataset.action;
  const row = btn.closest('tr');
  const reportId = row.dataset.reportId;
  
  // Get the reason from the dropdown
  const reasonSelect = document.getElementById('decision_reason');
  const reason = reasonSelect?.value || 'Valid and relevant';
  
  // Get optional notes
  const notesInput = document.getElementById('decision_notes');
  const notes = notesInput?.value || '';
  
  // Combine reason and notes
  const fullReason = notes ? `${reason} - ${notes}` : reason;

  // Disable all buttons in this row while processing
  const buttons = row.querySelectorAll('.moderation-btn');
  buttons.forEach(b => b.disabled = true);

  try {
    const result = await API.moderateReport(reportId, action, fullReason);
    
    if (result) {
      // Update the UI to show the report has been moderated
      const statusCell = row.querySelector('.status-badge');
      const actionCell = row.querySelector('.action-buttons');
      
      if (statusCell) {
        statusCell.className = 'badge bg-success-subtle text-success status-badge';
        statusCell.textContent = action === 'valid' ? 'Validated' : 
                                  action === 'duplicate' ? 'Duplicate' : 'Invalid';
      }
      
      if (actionCell) {
        actionCell.innerHTML = '<span class="text-muted small">Reviewed</span>';
      }
      
      // Show success message
      showModerationToast(`Report #${reportId} marked as ${action}`, 'success');

      // Refresh table so newly moderated state is reflected from backend
      await loadModerationReports();
    }
  } catch (error) {
    console.error('Moderation failed:', error);
    showModerationToast(`Failed to moderate report #${reportId}`, 'error');
    // Re-enable buttons on error
    buttons.forEach(b => b.disabled = false);
  }
}

function showModerationToast(message, type) {
  const toast = document.createElement('div');
  toast.className = 'position-fixed top-0 end-0 p-3';
  toast.style.zIndex = '9999';
  const bgClass = type === 'success' ? 'bg-success' : 'bg-danger';
  toast.innerHTML = `<div class="toast show align-items-center text-white border-0 ${bgClass}" role="alert">
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.closest('.position-fixed').remove()"></button>
    </div>
  </div>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

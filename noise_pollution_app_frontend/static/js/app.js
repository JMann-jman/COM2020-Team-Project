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
  const zone = zoneSelect?.value;

  if (!zone) return;

  await loadAndDisplay(
    () => API.getNoiseData({ zones: [zone] }),
    displayNoiseData,
    'Failed to load noise data'
  );
}

// Display noise data in table
function displayNoiseData(data) {
  const container = document.getElementById('noise-data-container');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="text-muted">No data available</p>';
    return;
  }

  let html = '<table class="table table-sm"><thead><tr><th>ID</th><th>Zone</th><th>Timestamp</th><th>Source</th><th>Value (dB)</th><th>Category</th></tr></thead><tbody>';
  
  data.slice(0, 20).forEach(row => {
    html += `<tr>
      <td>${row.obs_id || 'N/A'}</td>
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
async function loadHotspots() {
  await loadAndDisplay(
    () => API.getHotspots(10),
    displayHotspots,
    'Failed to load hotspots'
  );
}

// Display hotspots
function displayHotspots(data) {
  const container = document.getElementById('hotspots-container');
  if (!container) return;

  if (!data || data.length === 0) {
    container.innerHTML = '<p class="text-muted">No hotspots available</p>';
    return;
  }

  let html = '<div class="row g-3">';
  
  data.forEach(hotspot => {
    const severity = hotspot.severity_score || 0;
    const color = severity > 80 ? 'danger' : severity > 60 ? 'warning' : 'success';
    
    html += `<div class="col-md-6 col-lg-4">
      <div class="card h-100">
        <div class="card-body">
          <h5 class="card-title">${hotspot.zone_id || 'N/A'} - ${hotspot.time_window || 'N/A'}</h5>
          <p class="card-text">
            <span class="badge bg-${color}">${severity}</span>
            <small class="d-block mt-2">${hotspot.rationale || 'N/A'}</small>
          </p>
        </div>
      </div>
    </div>`;
  });

  html += '</div>';
  container.innerHTML = html;
}

// Submit incident report
async function submitIncidentReport(event) {
  event.preventDefault();
  
  const zone = document.querySelector('input[name="zone"]')?.value || document.querySelector('select[name="zone"]')?.value;
  const category = document.querySelector('select[name="category"]')?.value;
  const description = document.querySelector('textarea[name="description"]')?.value;

  if (!zone || !category || !description) {
    alert('Please fill in all fields');
    return;
  }

  const result = await executeApiCall(
    () => API.submitReport({
      zone_id: zone,
      category: category,
      description: description
    }),
    'Failed to submit report'
  );
  
  if (result) {
    if (result.is_duplicate) {
      alert('This report appears to be a duplicate of a recent report');
    } else {
      alert('Report submitted successfully!');
      event.target.reset();
    }
  }
}

// Load plans for comparison
async function loadPlansForComparison() {
  await loadAndDisplay(
    () => API.getPlans(),
    displayPlansForSelection,
    'Failed to load plans'
  );
}

// Display plans for selection
function displayPlansForSelection(plans) {
  const container = document.getElementById('plans-selection');
  if (!container || !plans || plans.length === 0) return;

  let html = '';
  plans.forEach(plan => {
    html += `<div class="form-check">
      <input class="form-check-input" type="checkbox" value="${plan.plan_id}" id="plan_${plan.plan_id}">
      <label class="form-check-label" for="plan_${plan.plan_id}">
        ${plan.plan_id} - ${plan.zone_id} (Budget: $${plan.budget})
      </label>
    </div>`;
  });

  container.innerHTML = html;
}

// Compare selected plans
async function comparePlans() {
  const selected = Array.from(document.querySelectorAll('#plans-selection input[type="checkbox"]:checked'))
    .map(cb => cb.value);

  if (selected.length < 2) {
    alert('Please select at least 2 plans to compare');
    return;
  }

  const comparison = await executeApiCall(
    () => API.comparePlans(selected),
    'Failed to compare plans'
  );
  
  if (comparison) {
    displayPlanComparison(comparison);
  }
}

// Display plan comparison
function displayPlanComparison(comparison) {
  const container = document.getElementById('comparison-results');
  if (!container) return;

  if (!comparison || !comparison.plans) {
    container.innerHTML = '<p class="text-muted">No comparison data available</p>';
    return;
  }

  let html = '<table class="table"><thead><tr><th>Plan ID</th><th>Zone</th><th>Budget</th><th>Expected Impact</th></tr></thead><tbody>';
  
  comparison.plans.forEach(plan => {
    html += `<tr>
      <td>${plan.plan_id}</td>
      <td>${plan.zone_id}</td>
      <td>$${plan.budget}</td>
      <td>${plan.expected_impact || 'N/A'} dB</td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// Initialize page based on current route
document.addEventListener('DOMContentLoaded', async function() {
  // Load zones on all pages
  await loadZones();

  // Page-specific initialization
  const pathname = window.location.pathname;

  if (pathname.includes('/explore')) {
    const exploreForm = document.querySelector('form');
    if (exploreForm) {
      exploreForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadExploreData();
      });
    }
    loadExploreData();
  } else if (pathname.includes('/hotspots')) {
    loadHotspots();
  } else if (pathname.includes('/report')) {
    const reportForm = document.querySelector('form');
    if (reportForm) {
      reportForm.addEventListener('submit', submitIncidentReport);
    }
  } else if (pathname.includes('/plan')) {
    loadPlansForComparison();
    const compareBtn = document.querySelector('button[onclick*="comparePlans"]');
    if (compareBtn) {
      compareBtn.onclick = comparePlans;
    }
  }
});

/**
 * Main application JavaScript for Noise Pollution Monitoring App
 */

// Load zones and populate dropdowns
async function loadZones() {
  try {
    // Create a mock zones endpoint response since the backend might not have this route yet
    const zones = [
      { zone_id: 'Z01', name: 'Zone 1' },
      { zone_id: 'Z02', name: 'Zone 2' },
      { zone_id: 'Z03', name: 'Zone 3' },
      { zone_id: 'Z04', name: 'Zone 4' },
      { zone_id: 'Z05', name: 'Zone 5' },
      { zone_id: 'Z06', name: 'Zone 6' },
      { zone_id: 'Z07', name: 'Zone 7' },
      { zone_id: 'Z08', name: 'Zone 8' },
      { zone_id: 'Z09', name: 'Zone 9' },
      { zone_id: 'Z10', name: 'Zone 10' },
      { zone_id: 'Z11', name: 'Zone 11' },
      { zone_id: 'Z12', name: 'Zone 12' }
    ];
    
    populateZoneSelect(zones);
    return zones;
  } catch (error) {
    console.error('Failed to load zones:', error);
  }
}

// Populate zone select dropdowns
function populateZoneSelect(zones) {
  const zoneSelects = document.querySelectorAll('select[name="zone"], select[id="zone"]');
  zoneSelects.forEach(select => {
    zones.forEach(zone => {
      const option = document.createElement('option');
      option.value = zone.zone_id;
      option.textContent = zone.name;
      select.appendChild(option);
    });
  });
}

// Load and display noise data on explore page
async function loadExploreData() {
  const zoneSelect = document.getElementById('zone');
  const zone = zoneSelect?.value;

  if (!zone) return;

  try {
    const data = await API.getNoiseData({ zones: [zone] });
    displayNoiseData(data);
  } catch (error) {
    console.error('Failed to load noise data:', error);
    alert('Failed to load noise data');
  }
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
  try {
    const data = await API.getHotspots(10);
    displayHotspots(data);
  } catch (error) {
    console.error('Failed to load hotspots:', error);
    alert('Failed to load hotspots');
  }
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

  try {
    const result = await API.submitReport({
      zone_id: zone,
      category: category,
      description: description
    });
    
    if (result.is_duplicate) {
      alert('This report appears to be a duplicate of a recent report');
    } else {
      alert('Report submitted successfully!');
      event.target.reset();
    }
  } catch (error) {
    console.error('Failed to submit report:', error);
    alert('Failed to submit report');
  }
}

// Load plans for comparison
async function loadPlansForComparison() {
  try {
    const data = await API.getPlans();
    displayPlansForSelection(data);
  } catch (error) {
    console.error('Failed to load plans:', error);
  }
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

  try {
    const comparison = await API.comparePlans(selected);
    displayPlanComparison(comparison);
  } catch (error) {
    console.error('Failed to compare plans:', error);
    alert('Failed to compare plans');
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

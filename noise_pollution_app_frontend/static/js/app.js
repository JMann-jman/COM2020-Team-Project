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
  } else if (pathname.includes('/quest')) {
    initQuest();
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

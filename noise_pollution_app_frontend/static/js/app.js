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
    populateInterventionSelect(interventions);
  } else {
    console.warn('No interventions returned from API');
  }
  return interventions;
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
  
  let zone = zoneSelect?.value;
  const timeWindow = timeWindowSelect?.value;
  const source = sourceSelect?.value;

  console.log('loadExploreData called with:', { zone, timeWindow, source });

  // Auto-select first zone if none is selected (after zones are loaded)
  if (!zone && zoneSelect?.options?.length > 1) {
    zoneSelect.selectedIndex = 1; // Select the first actual option (index 0 is the placeholder)
    zone = zoneSelect.value;
    console.log('Auto-selected zone:', zone);
  }

  if (!zone) {
    console.warn('No zone selected and no zones available');
    // Still try to load reports even without a zone
    await refreshReportsSummary();
    return;
  }

  await loadAndDisplay(
    () => API.getNoiseData({ 
      zones: [zone],
      time_window: timeWindow,
      source: source
    }),
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
      if (result.status === 409) {
        // Duplicate report
        if (successEl) {
          successEl.className = 'alert alert-warning mt-4';
          successEl.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i>This report appears to be a duplicate of a recent report and was not submitted.';
          successEl.classList.remove('d-none');
        }
      } else {
        // Other error
        if (successEl) {
          successEl.className = 'alert alert-danger mt-4';
          successEl.innerHTML = '<i class="bi bi-x-circle-fill me-1"></i>Error: ' + (result.body?.error || 'Failed to submit report. Please try again.');
          successEl.classList.remove('d-none');
        }
      }
    } else if (result.is_duplicate) {
      // Handle duplicate from successful response
      if (successEl) {
        successEl.className = 'alert alert-warning mt-4';
        successEl.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i>This report appears to be a duplicate of a recent report and was not submitted.';
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
    loadInterventions();
    loadPlansForComparison();
    const compareBtn = document.querySelector('button[onclick*="comparePlans"]');
    if (compareBtn) {
      compareBtn.onclick = comparePlans;
    }

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

async function initModeration() {
  // Attach event listeners to all moderation buttons
  document.querySelectorAll('.moderation-btn').forEach(btn => {
    btn.addEventListener('click', handleModeration);
  });
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

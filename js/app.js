/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - MAIN APPLICATION CONTROLLER
   ========================================================================== */

class AppController {
  constructor() {
    this.currentView = 'dashboard';
  }

  async init() {
    console.log('[AppController] Initializing Certificate Generator Application...');

    // 1. Initialize State & Storage
    await window.appState.init();

    // 2. Setup Subscriptions
    this.setupStateSubscriptions();

    // 3. Init Font Manager
    await window.fontManager.init();

    // 4. Init Editor Engine
    window.canvasEditor.init('cert-canvas', 'canvas-wrapper', 'editor-canvas-stage');

    // 5. Bind Navigation & Active Upload Inputs
    this.bindNavigationEvents();
    this.bindUploadInputs();
    this.bindStateListeners();

    // 6. Render Initial View
    this.switchView('dashboard');
    this.updateDashboardStats();
  }

  bindNavigationEvents() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.switchView(view);
      });
    });

    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
      sidebarToggle.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
      });
    }

    const themeToggle = document.getElementById('theme-toggle-btn');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        document.getElementById('theme-btn-label').textContent = newTheme === 'light' ? 'Light Mode' : 'Dark Mode';
      });
    }
  }

  switchView(viewName) {
    this.currentView = viewName;

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    document.querySelectorAll('.view-content').forEach(view => {
      view.classList.remove('active');
    });

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.add('active');

    const titleEl = document.getElementById('page-title-text');
    if (titleEl) {
      const titles = {
        dashboard: 'Dashboard',
        templates: 'Template Library',
        excel: 'Excel Data Files',
        assignments: 'Template ↔ Excel Assignment Manager',
        mapping: 'Dynamic Excel Field Mapping',
        editor: 'Visual Editor',
        queue: 'Batch Certificate Generation',
        settings: 'Settings'
      };
      titleEl.textContent = titles[viewName] || 'Dashboard';
    }

    // Refresh view data
    if (viewName === 'dashboard') this.updateDashboardStats();
    else if (viewName === 'templates') this.renderTemplatesGrid();
    else if (viewName === 'excel') this.renderExcelGrid();
    else if (viewName === 'assignments') this.renderAssignmentsTable();
    else if (viewName === 'mapping') this.renderMappingTable();
    else if (viewName === 'editor') window.canvasEditor.render();
  }

  bindUploadInputs() {
    const tplInput = document.getElementById('template-file-input');
    if (tplInput) {
      tplInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
          await this.processTemplateUploads(files);
          tplInput.value = ''; // Reset input to allow re-uploading same file if desired
        }
      });
    }

    const xlsInput = document.getElementById('excel-file-input');
    if (xlsInput) {
      xlsInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
          await this.processExcelUpload(file);
        }
        xlsInput.value = '';
        this.renderExcelGrid();
        this.updateDashboardStats();
      });
    }
  }

  async processTemplateUploads(files) {
    const filesToProcess = [];

    for (const file of files) {
      const existing = window.appState.templates.find(t => t.name === file.name);
      if (existing) {
        const choice = confirm(`Template "${file.name}" already exists.\n\nClick [OK] to Replace existing or [Cancel] to Keep Both / Duplicate.`);
        if (choice) {
          await window.appState.deleteTemplate(existing.id);
        }
      }

      const processedTpl = await window.templateManager.processImageFile(file);
      if (processedTpl) {
        filesToProcess.push(processedTpl);
      }
    }

    for (const tpl of filesToProcess) {
      await window.appState.addTemplate(tpl);
    }

    this.renderTemplatesGrid();
    this.updateDashboardStats();

    if (filesToProcess.length > 0) {
      window.appState.notify('toast', {
        type: 'success',
        message: `Successfully added ${filesToProcess.length} template(s).`
      });
    }
  }

  async processExcelUpload(file) {
    try {
      const existing = window.appState.excelFiles.find(e => e.name === file.name);
      if (existing) {
        const choice = confirm(`Excel file "${file.name}" is already loaded.\n\nClick [OK] to Replace or [Cancel] to Skip.`);
        if (!choice) return;
        await window.appState.deleteExcelFile(existing.id);
      }

      const excelObj = await window.excelManager.parseFile(file);
      if (excelObj) {
        await window.appState.addExcelFile(excelObj);
        window.appState.notify('toast', {
          type: 'success',
          message: `Loaded Excel file "${file.name}" (${excelObj.rows ? excelObj.rows.length : 0} records).`
        });
      }
    } catch (err) {
      console.error('[AppController] Excel parsing error:', err);
      alert(`Error parsing Excel file "${file.name}": ${err.message}`);
    }
  }

  updateDashboardStats() {
    const templates = window.appState.templates || [];
    const excels = window.appState.excelFiles || [];
    const assignments = window.appState.assignments || [];

    const tplCount = document.getElementById('dash-stat-templates');
    const xlsCount = document.getElementById('dash-stat-excels');
    const asgCount = document.getElementById('dash-stat-assignments');
    const rdyCount = document.getElementById('dash-stat-ready');

    if (tplCount) tplCount.textContent = templates.length;
    if (xlsCount) xlsCount.textContent = excels.length;
    if (asgCount) asgCount.textContent = assignments.length;

    let readyTotal = 0;
    assignments.forEach(asg => {
      const xls = excels.find(e => e.id === asg.excelId);
      if (xls && xls.rows) readyTotal += xls.rows.length;
    });

    if (rdyCount) rdyCount.textContent = readyTotal;
  }

  renderTemplatesGrid() {
    const container = document.getElementById('templates-grid');
    if (!container) return;

    const templates = window.appState.templates || [];
    container.innerHTML = '';

    if (templates.length === 0) {
      container.innerHTML = `
        <div class="glass-panel" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
          <p style="color: var(--text-muted); margin-bottom: 12px;">No certificate templates uploaded yet.</p>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('template-file-input').click()">
            + Add First Template
          </button>
        </div>
      `;
      return;
    }

    templates.forEach(tpl => {
      const assignment = window.appState.getAssignmentForTemplate(tpl.id);
      const isAssigned = !!(assignment && assignment.excelId);
      const activeExcel = isAssigned ? window.appState.excelFiles.find(e => e.id === assignment.excelId) : null;

      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-preview">
          <img src="${tpl.dataUrl}" alt="${tpl.name}">
        </div>
        <div class="item-card-body">
          <div class="item-card-title" title="${tpl.name}">${tpl.name}</div>
          <div class="item-card-meta">${tpl.width} × ${tpl.height} px (${tpl.aspectRatio || 'Landscape'})</div>
          
          <div style="margin-top: 4px;">
            ${isAssigned ? 
              `<span class="badge badge-primary">✓ Linked: ${activeExcel ? activeExcel.name : 'Excel'}</span>` : 
              `<span class="badge badge-danger">⚠️ Unassigned</span>`}
          </div>

          <div class="item-card-actions">
            <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="window.appController.openInEditor('${tpl.id}')">
              ✏️ Edit Layout
            </button>
            <button class="btn btn-danger btn-sm" title="Delete Template" onclick="window.appController.deleteTemplate('${tpl.id}')">
              🗑️
            </button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  }

  renderExcelGrid() {
    const container = document.getElementById('excel-grid');
    if (!container) return;

    const excels = window.appState.excelFiles || [];
    container.innerHTML = '';

    if (excels.length === 0) {
      container.innerHTML = `
        <div class="glass-panel" style="grid-column: 1 / -1; text-align: center; padding: 40px;">
          <p style="color: var(--text-muted); margin-bottom: 12px;">No Excel data files loaded yet.</p>
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('excel-file-input').click()">
            + Add First Excel File
          </button>
        </div>
      `;
      this.renderExcelPreview(null);
      return;
    }

    excels.forEach((excelObj, idx) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div class="item-card-body">
          <div class="item-card-title" title="${excelObj.name}">📄 ${excelObj.name}</div>
          <div class="item-card-meta">
            • Rows: <strong>${excelObj.rows ? excelObj.rows.length : 0}</strong><br>
            • Columns: <strong>${excelObj.headers ? excelObj.headers.length : 0}</strong><br>
            • Size: ${(excelObj.sizeBytes / 1024).toFixed(1)} KB
          </div>
          
          <div class="item-card-actions">
            <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="window.appController.renderExcelPreview('${excelObj.id}')">
              👁️ Preview Data
            </button>
            <button class="btn btn-danger btn-sm" onclick="window.appController.deleteExcel('${excelObj.id}')">
              🗑️
            </button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });

    if (excels.length > 0) {
      this.renderExcelPreview(excels[0].id);
    }
  }

  renderExcelPreview(excelId) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;

    const excelObj = window.appState.excelFiles.find(e => e.id === excelId);
    if (!excelObj || !excelObj.rows || excelObj.rows.length === 0) {
      container.innerHTML = `<p style="padding: 16px; color: var(--text-muted);">No data records available in selected file.</p>`;
      return;
    }

    const headers = excelObj.headers || Object.keys(excelObj.rows[0]);
    const displayRows = excelObj.rows.slice(0, 15);

    let html = `<table class="data-table"><thead><tr><th>#</th>`;
    headers.forEach(h => html += `<th>${h}</th>`);
    html += `</tr></thead><tbody>`;

    displayRows.forEach((row, rIdx) => {
      html += `<tr><td>${rIdx + 1}</td>`;
      headers.forEach(h => {
        html += `<td>${row[h] !== undefined ? row[h] : ''}</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    if (excelObj.rows.length > 15) {
      html += `<div style="padding: 8px 14px; font-size: 0.78rem; color: var(--text-muted); background: var(--bg-card); border-top: 1px solid var(--border-color);">Showing first 15 of ${excelObj.rows.length} total records</div>`;
    }

    container.innerHTML = html;
  }

  renderAssignmentsTable() {
    const container = document.getElementById('assignments-table-container');
    if (!container) return;

    const templates = window.appState.templates || [];
    const excels = window.appState.excelFiles || [];

    if (templates.length === 0) {
      container.innerHTML = `<p style="padding: 16px; color: var(--text-muted);">Please upload at least one certificate template first.</p>`;
      return;
    }

    let html = `<table class="data-table">
      <thead>
        <tr>
          <th>Certificate Template</th>
          <th>Assigned Excel Workbook</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>`;

    templates.forEach(tpl => {
      const assignment = window.appState.getAssignmentForTemplate(tpl.id);
      const selectedExcelId = assignment ? assignment.excelId : '';

      html += `<tr>
        <td><strong>${tpl.name}</strong> (${tpl.width}×${tpl.height})</td>
        <td>
          <select class="select-input" onchange="window.appController.onAssignmentChange('${tpl.id}', this.value)">
            <option value="">-- Select Excel Workbook --</option>
            ${excels.map(e => `<option value="${e.id}" ${e.id === selectedExcelId ? 'selected' : ''}>${e.name} (${e.rows ? e.rows.length : 0} rows)</option>`).join('')}
          </select>
        </td>
        <td>
          ${selectedExcelId ? '<span class="badge badge-primary">✓ Linked</span>' : '<span class="badge badge-danger">⚠️ Unassigned</span>'}
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="window.appController.openInEditor('${tpl.id}')">
            ✏️ Visual Editor
          </button>
        </td>
      </tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  async onAssignmentChange(templateId, excelId) {
    await window.appState.setAssignment(templateId, excelId);
    this.renderAssignmentsTable();
    this.updateDashboardStats();

    const tpl = window.appState.templates.find(t => t.id === templateId);
    const xls = window.appState.excelFiles.find(e => e.id === excelId);

    if (tpl && xls) {
      // Auto-map columns if matching headers exist
      window.autoMapper.autoMapTemplateToExcel(tpl, xls);
      await window.appStorage.saveItem('templates', tpl);
    }
  }

  renderMappingTable() {
    const container = document.getElementById('mapping-container');
    if (!container) return;

    const assignedPairs = window.appState.getAssignedPairs();
    if (assignedPairs.length === 0) {
      container.innerHTML = `<p style="padding: 16px; color: var(--text-muted);">No assigned pairs available. Please assign Excel workbooks to templates in the Assignment Manager first.</p>`;
      return;
    }

    let html = '';

    assignedPairs.forEach(pair => {
      const tpl = pair.template;
      const xls = pair.excel;
      const headers = xls.headers || [];

      html += `<div class="glass-panel" style="margin-bottom: 20px;">
        <div style="font-size: 0.95rem; font-weight: 700; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <span>Pair: <strong>${tpl.name}</strong> ↔ <strong>${xls.name}</strong></span>
          <button class="btn btn-secondary btn-sm" onclick="window.appController.autoMapPair('${tpl.id}', '${xls.id}')">
            ⚡ Auto-Map Headers
          </button>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Template Field Variable</th>
              <th>Mapped Excel Header</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>`;

      (tpl.fields || []).forEach(field => {
        const currentLink = field.linkedColumn || field.field;
        const isMapped = headers.includes(currentLink);

        html += `<tr>
          <td><strong>${field.field}</strong> (${field.type})</td>
          <td>
            <select class="select-input" onchange="window.appController.updateFieldMapping('${tpl.id}', '${field.id}', this.value)">
              <option value="">-- Select Header --</option>
              ${headers.map(h => `<option value="${h}" ${h === currentLink ? 'selected' : ''}>${h}</option>`).join('')}
            </select>
          </td>
          <td>
            ${isMapped ? `<span class="badge badge-primary">✓ Mapped</span>` : `<span class="badge badge-danger">⚠️ Unmapped</span>`}
          </td>
        </tr>`;
      });

      html += `</tbody></table></div>`;
    });

    container.innerHTML = html;
  }

  async updateFieldMapping(templateId, fieldId, newColumn) {
    const tpl = window.appState.templates.find(t => t.id === templateId);
    if (!tpl) return;

    const field = tpl.fields.find(f => f.id === fieldId);
    if (field) {
      field.linkedColumn = newColumn;
      await window.appStorage.saveItem('templates', tpl);
      this.renderMappingTable();
    }
  }

  async autoMapPair(templateId, excelId) {
    const tpl = window.appState.templates.find(t => t.id === templateId);
    const xls = window.appState.excelFiles.find(e => e.id === excelId);
    if (tpl && xls) {
      window.autoMapper.autoMapTemplateToExcel(tpl, xls);
      await window.appStorage.saveItem('templates', tpl);
      this.renderMappingTable();
      window.appState.notify('toast', { type: 'success', message: `Auto-mapped headers for "${tpl.name}".` });
    }
  }

  openInEditor(templateId) {
    window.appState.activeTemplateId = templateId;
    this.switchView('editor');
  }

  async deleteTemplate(templateId) {
    const tpl = window.appState.templates.find(t => t.id === templateId);
    if (!tpl) return;

    const confirmDelete = confirm(`Are you sure you want to delete template "${tpl.name}"?`);
    if (confirmDelete) {
      await window.appState.deleteTemplate(templateId);
      this.renderTemplatesGrid();
      this.updateDashboardStats();
      window.appState.notify('toast', { type: 'info', message: `Deleted template "${tpl.name}".` });
    }
  }

  async deleteExcel(excelId) {
    const xls = window.appState.excelFiles.find(e => e.id === excelId);
    if (!xls) return;

    const confirmDelete = confirm(`Are you sure you want to delete Excel file "${xls.name}"?`);
    if (confirmDelete) {
      await window.appState.deleteExcelFile(excelId);
      this.renderExcelGrid();
      this.updateDashboardStats();
      window.appState.notify('toast', { type: 'info', message: `Deleted Excel file "${xls.name}".` });
    }
  }

  async confirmClearAllTemplates() {
    if (window.appState.templates.length === 0) return;
    const confirmClear = confirm('⚠️ DANGER: Are you sure you want to delete ALL templates?\n\nThis action cannot be undone!');
    if (confirmClear) {
      await window.appState.clearAllTemplates();
      this.renderTemplatesGrid();
      this.updateDashboardStats();
      window.appState.notify('toast', { type: 'danger', message: 'All templates deleted.' });
    }
  }

  async confirmClearAllExcelFiles() {
    if (window.appState.excelFiles.length === 0) return;
    const confirmClear = confirm('⚠️ DANGER: Are you sure you want to delete ALL Excel data files?\n\nThis action cannot be undone!');
    if (confirmClear) {
      await window.appState.clearAllExcelFiles();
      this.renderExcelGrid();
      this.updateDashboardStats();
      window.appState.notify('toast', { type: 'danger', message: 'All Excel files deleted.' });
    }
  }

  setupStateSubscriptions() {
    window.appState.subscribe('state_changed', () => {
      this.updateDashboardStats();
    });
  }

  bindStateListeners() {
    // Custom UI state binding listeners if needed
  }
}

window.appController = new AppController();

document.addEventListener('DOMContentLoaded', () => {
  window.appController.init();
});

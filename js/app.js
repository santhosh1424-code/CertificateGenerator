/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - MAIN APPLICATION CONTROLLER
   ========================================================================== */

class AppController {
  constructor() {
    this.currentView = 'dashboard';
    this.excelPreviewState = {
      activeExcelId: null,
      currentPage: 1,
      pageSize: 15,
      searchQuery: '',
      sortColumn: null,
      sortDirection: 'asc'
    };
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

    // Keyboard navigation support for Spreadsheet Data Preview
    document.addEventListener('keydown', (e) => {
      if (this.currentView !== 'excel') return;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT' || activeEl.isContentEditable)) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        this.changeExcelPreviewPage(-1);
      } else if (e.key === 'ArrowRight') {
        this.changeExcelPreviewPage(1);
      }
    });
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
    else if (viewName === 'editor') {
      window.canvasEditor.render();
      this.renderEditorVariablesList();
      const rightPanel = document.getElementById('editor-right-panel');
      if (rightPanel) rightPanel.scrollTop = 0;
    }
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
      if (!this.excelPreviewState.activeExcelId || !excels.some(e => e.id === this.excelPreviewState.activeExcelId)) {
        this.renderExcelPreview(excels[0].id);
      } else {
        this.renderExcelPreview();
      }
    }
  }

  renderExcelPreview(excelId) {
    const container = document.getElementById('excel-table-container');
    if (!container) return;

    if (excelId) {
      if (this.excelPreviewState.activeExcelId !== excelId) {
        this.excelPreviewState.activeExcelId = excelId;
        this.excelPreviewState.currentPage = 1;
        this.excelPreviewState.searchQuery = '';
        this.excelPreviewState.sortColumn = null;
        this.excelPreviewState.sortDirection = 'asc';
      }
    }

    const currentExcelId = this.excelPreviewState.activeExcelId;
    const excelObj = window.appState.excelFiles.find(e => e.id === currentExcelId);

    if (!excelObj || !excelObj.rows || excelObj.rows.length === 0) {
      container.innerHTML = `<p style="padding: 16px; color: var(--text-muted);">No data records available in selected file.</p>`;
      return;
    }

    const headers = excelObj.headers || (excelObj.rows.length > 0 ? Object.keys(excelObj.rows[0]) : []);
    const totalRecords = excelObj.rows.length;

    // 1. Search / Filter (Non-mutating)
    let filteredRows = excelObj.rows;
    const query = (this.excelPreviewState.searchQuery || '').trim().toLowerCase();
    if (query !== '') {
      filteredRows = excelObj.rows.filter(row => {
        return headers.some(h => {
          const val = row[h];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(query);
        });
      });
    }

    // 2. Sort (Non-mutating)
    const sortCol = this.excelPreviewState.sortColumn;
    const sortDir = this.excelPreviewState.sortDirection;
    if (sortCol && headers.includes(sortCol)) {
      filteredRows = [...filteredRows].sort((a, b) => {
        const valA = String(a[sortCol] !== undefined && a[sortCol] !== null ? a[sortCol] : '').trim();
        const valB = String(b[sortCol] !== undefined && b[sortCol] !== null ? b[sortCol] : '').trim();
        const numA = Number(valA);
        const numB = Number(valB);
        if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
          return sortDir === 'asc' ? numA - numB : numB - numA;
        }
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    const filteredCount = filteredRows.length;
    const pageSize = this.excelPreviewState.pageSize || 15;
    const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
    let currentPage = this.excelPreviewState.currentPage || 1;

    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    this.excelPreviewState.currentPage = currentPage;

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredCount);
    const pageRows = filteredRows.slice(startIndex, endIndex);

    // Render Search Bar & Page Size Selector Toolbar
    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-card); border-bottom: 1px solid var(--border-color); gap: 12px; flex-wrap: wrap;">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
          <input type="text" class="text-input" placeholder="🔍 Search records..." value="${this.escapeHtml(this.excelPreviewState.searchQuery)}" 
                 oninput="window.appController.onExcelSearchInput(this.value)" style="padding: 4px 10px; font-size: 0.82rem; width: 100%; max-width: 280px;">
          ${query !== '' ? `<button class="btn btn-secondary btn-sm" onclick="window.appController.onExcelSearchInput('')">Clear</button>` : ''}
        </div>

        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--text-muted);">
          <span>Rows per page:</span>
          <select class="select-input" style="padding: 2px 8px; font-size: 0.82rem;" onchange="window.appController.onExcelPageSizeChange(this.value)">
            <option value="15" ${pageSize === 15 ? 'selected' : ''}>15</option>
            <option value="25" ${pageSize === 25 ? 'selected' : ''}>25</option>
            <option value="50" ${pageSize === 50 ? 'selected' : ''}>50</option>
            <option value="100" ${pageSize === 100 ? 'selected' : ''}>100</option>
          </select>
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              ${headers.map(h => {
                const isSorted = sortCol === h;
                const arrow = isSorted ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
                return `<th style="cursor: pointer; user-select: none;" title="Click to sort by ${this.escapeHtml(h)}" onclick="window.appController.toggleExcelSort('${this.escapeHtml(h)}')">
                  ${this.escapeHtml(h)}<span style="color: var(--btn-primary); font-size: 0.75rem;">${arrow}</span>
                </th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    if (pageRows.length === 0) {
      html += `<tr><td colspan="${headers.length + 1}" style="text-align: center; color: var(--text-muted); padding: 24px;">No matching records found.</td></tr>`;
    } else {
      pageRows.forEach((row, rIdx) => {
        const globalRecordNum = startIndex + rIdx + 1;
        html += `<tr><td style="font-weight: 600; color: var(--text-muted);">${globalRecordNum}</td>`;
        headers.forEach(h => {
          html += `<td>${this.escapeHtml(row[h] !== undefined && row[h] !== null ? String(row[h]) : '')}</td>`;
        });
        html += `</tr>`;
      });
    }

    html += `</tbody></table></div>`;

    // Render Footer with Record Counts and Compact Pagination Buttons
    const displayStart = filteredCount > 0 ? startIndex + 1 : 0;
    const countLabel = query !== '' 
      ? `Showing ${displayStart}–${endIndex} of ${filteredCount} records (filtered from ${totalRecords} total)`
      : `Showing ${displayStart}–${endIndex} of ${totalRecords} total records`;

    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--bg-card); border-top: 1px solid var(--border-color); font-size: 0.8rem; flex-wrap: wrap; gap: 10px;">
        <div style="color: var(--text-muted); font-weight: 500;">${countLabel}</div>

        <div style="display: flex; align-items: center; gap: 4px;">
          <button class="btn btn-secondary btn-sm" aria-label="Previous page" ${currentPage === 1 ? 'disabled' : ''} onclick="window.appController.setExcelPage(${currentPage - 1})">
            ← Previous
          </button>

          ${this.renderPaginationButtons(currentPage, totalPages)}

          <button class="btn btn-secondary btn-sm" aria-label="Next page" ${currentPage === totalPages ? 'disabled' : ''} onclick="window.appController.setExcelPage(${currentPage + 1})">
            Next →
          </button>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  renderPaginationButtons(currentPage, totalPages) {
    if (totalPages <= 1) return '';

    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    return pages.map(p => {
      if (p === '...') {
        return `<span style="padding: 0 4px; color: var(--text-muted); user-select: none;">...</span>`;
      }
      const isCurrent = p === currentPage;
      return `<button class="btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-secondary'}" 
                      aria-label="Go to page ${p}" 
                      style="min-width: 28px; padding: 2px 6px; font-weight: ${isCurrent ? '700' : '400'};" 
                      onclick="window.appController.setExcelPage(${p})">${p}</button>`;
    }).join('');
  }

  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  onExcelSearchInput(val) {
    this.excelPreviewState.searchQuery = val;
    this.excelPreviewState.currentPage = 1;
    this.renderExcelPreview();
  }

  onExcelPageSizeChange(val) {
    this.excelPreviewState.pageSize = parseInt(val, 10) || 15;
    this.excelPreviewState.currentPage = 1;
    this.renderExcelPreview();
  }

  toggleExcelSort(header) {
    if (this.excelPreviewState.sortColumn === header) {
      if (this.excelPreviewState.sortDirection === 'asc') {
        this.excelPreviewState.sortDirection = 'desc';
      } else {
        this.excelPreviewState.sortColumn = null;
        this.excelPreviewState.sortDirection = 'asc';
      }
    } else {
      this.excelPreviewState.sortColumn = header;
      this.excelPreviewState.sortDirection = 'asc';
    }
    this.renderExcelPreview();
  }

  setExcelPage(page) {
    this.excelPreviewState.currentPage = page;
    this.renderExcelPreview();
  }

  changeExcelPreviewPage(delta) {
    this.setExcelPage(this.excelPreviewState.currentPage + delta);
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

  renderEditorVariablesList() {
    const container = document.getElementById('editor-variables-list');
    if (!container) return;

    container.innerHTML = '';

    const activeExcel = window.appState.getActiveExcel();
    const template = window.appState.getActiveTemplate();

    let fieldsList = [];

    if (activeExcel && activeExcel.headers && activeExcel.headers.length > 0) {
      fieldsList = activeExcel.headers;
    } else if (template && template.fields) {
      fieldsList = template.fields.map(f => f.field || f.linkedColumn);
    } else {
      fieldsList = ['Participant Name', 'College Name', 'Department', 'Date', 'Certificate ID'];
    }

    fieldsList.forEach(headerName => {
      const chip = document.createElement('div');
      chip.className = 'variable-chip';

      const isLinked = template && template.fields && template.fields.some(f => (f.linkedColumn || f.field) === headerName);

      chip.innerHTML = `
        <span style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <span style="font-size: 0.72rem; color: var(--btn-primary);">📄</span>
          <strong style="overflow: hidden; text-overflow: ellipsis;">${headerName}</strong>
        </span>
        <span class="badge ${isLinked ? 'badge-primary' : 'badge-secondary'}" style="font-size: 0.68rem; padding: 2px 6px; flex-shrink: 0;">
          ${isLinked ? '✓ Linked' : '+ Add'}
        </span>
      `;

      chip.onclick = () => {
        if (!template) return;
        const existingField = template.fields.find(f => (f.linkedColumn || f.field) === headerName);
        if (existingField) {
          window.appState.activeElementId = existingField.id;
          window.canvasEditor.drawCanvas();
          window.appState.notify('toast', { type: 'info', message: `Selected field "${headerName}".` });
        } else {
          window.canvasEditor.addFieldToTemplate('text', headerName);
          this.renderEditorVariablesList();
          window.appState.notify('toast', { type: 'success', message: `Added "${headerName}" to template.` });
        }
      };

      container.appendChild(chip);
    });
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

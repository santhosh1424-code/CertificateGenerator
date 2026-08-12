/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - REPORTS & ANALYTICS MANAGER
   ========================================================================== */

class ReportsManager {
  constructor() {}

  renderReports(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const templates = window.appState.templates;
    const excelFiles = window.appState.excelFiles;

    const totalTemplates = templates.length;
    const totalExcels = excelFiles.length;
    const totalRecords = excelFiles.reduce((acc, e) => acc + (e.totalRows || 0), 0);
    const validRecords = excelFiles.reduce((acc, e) => acc + ((e.totalRows || 0) - (e.invalidRecords || 0)), 0);

    container.innerHTML = `
      <div class="glass-panel" style="margin-bottom: 24px;">
        <div class="panel-header">
          <h3 class="panel-title">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
            System Health & Audit Analytics
          </h3>
          <button class="btn btn-secondary btn-sm" onclick="window.reportsManager.exportAuditReport()">Export Report</button>
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-title">Templates Active</div>
            <div class="stat-value">${totalTemplates}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Data Workbooks</div>
            <div class="stat-value">${totalExcels}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Total Records</div>
            <div class="stat-value">${totalRecords}</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">Valid Records</div>
            <div class="stat-value" style="color: var(--accent-emerald);">${validRecords}</div>
          </div>
        </div>
      </div>
    `;
  }

  exportAuditReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      templatesCount: window.appState.templates.length,
      excelFilesCount: window.appState.excelFiles.length,
      totalRecords: window.appState.excelFiles.reduce((acc, e) => acc + (e.totalRows || 0), 0),
      settings: window.appState.settings
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    saveAs(blob, `Audit_Report_${Date.now()}.json`);
  }
}

window.reportsManager = new ReportsManager();

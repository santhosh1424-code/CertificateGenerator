/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - REACTIVE CENTRALIZED STATE MANAGER
   ========================================================================== */

class AppState {
  constructor() {
    this.templates = [];
    this.excelFiles = [];
    this.assignments = []; // Array of { templateId, excelId }
    this.activeTemplateId = null;
    this.activeExcelId = null;
    this.activeElementId = null;
    this.listeners = {};

    this.historyStack = [];
    this.redoStack = [];
    
    this.settings = {
      outputFormat: 'png',
      filenameTemplate: '{Name} - {College}',
      defaultZipName: 'Certificates.zip',
      autoFitFont: true,
      minFontSize: 12,
      maxFontSize: 200,
      zoomLevel: 1.0,
      showGrid: true,
      snapToGrid: true,
      gridSize: 10
    };

    this.canvasSettings = {
      recordIndex: 0,
      zoom: 1.0
    };

    this.lastGenerationStats = null;
  }

  async init() {
    console.log('[AppState] Initializing state and restoring persistent data...');
    try {
      // 1. Restore Templates
      const savedTemplates = await window.appStorage.getAllItems('templates');
      this.templates = savedTemplates || [];
      if (this.templates.length > 0) {
        this.activeTemplateId = this.templates[0].id;
      }

      // 2. Restore Excel Files
      const savedExcels = await window.appStorage.getAllItems('excels');
      this.excelFiles = savedExcels || [];
      if (this.excelFiles.length > 0 && !this.activeExcelId) {
        this.activeExcelId = this.excelFiles[0].id;
      }

      // 3. Restore Assignments
      const savedAssignments = await window.appStorage.getAllItems('assignments');
      this.assignments = savedAssignments || [];

      // 4. Restore Settings
      const savedSettings = await window.appStorage.getAllItems('settings');
      if (savedSettings && savedSettings.length > 0) {
        savedSettings.forEach(s => {
          this.settings[s.key] = s.value;
        });
      }

      console.log(`[AppState] Restored: ${this.templates.length} Templates, ${this.excelFiles.length} Excels, ${this.assignments.length} Assignments.`);
    } catch (err) {
      console.error('[AppState] Restoration Error:', err);
    }
  }

  pushHistory() {
    const activeTpl = this.getActiveTemplate();
    if (!activeTpl) return;
    if (this.historyStack.length > 30) this.historyStack.shift();
    this.historyStack.push(JSON.stringify(activeTpl));
    this.redoStack = [];
  }

  undo() {
    if (this.historyStack.length === 0) return;
    const activeTpl = this.getActiveTemplate();
    if (activeTpl) this.redoStack.push(JSON.stringify(activeTpl));
    const previousState = JSON.parse(this.historyStack.pop());
    const idx = this.templates.findIndex(t => t.id === previousState.id);
    if (idx >= 0) {
      this.templates[idx] = previousState;
      window.appStorage.saveItem('templates', previousState);
      this.notify('template_added', previousState);
    }
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const activeTpl = this.getActiveTemplate();
    if (activeTpl) this.historyStack.push(JSON.stringify(activeTpl));
    const nextState = JSON.parse(this.redoStack.pop());
    const idx = this.templates.findIndex(t => t.id === nextState.id);
    if (idx >= 0) {
      this.templates[idx] = nextState;
      window.appStorage.saveItem('templates', nextState);
      this.notify('template_added', nextState);
    }
  }

  subscribe(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  notify(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
    if (this.listeners['state_changed'] && event !== 'state_changed') {
      this.listeners['state_changed'].forEach(cb => cb(event, data));
    }
  }

  getActiveTemplate() {
    return this.templates.find(t => t.id === this.activeTemplateId) || null;
  }

  getActiveExcel() {
    return this.excelFiles.find(e => e.id === this.activeExcelId) || null;
  }

  async addTemplate(templateObj) {
    const existingIdx = this.templates.findIndex(t => t.id === templateObj.id);
    if (existingIdx >= 0) {
      this.templates[existingIdx] = templateObj;
    } else {
      this.templates.push(templateObj);
    }
    this.activeTemplateId = templateObj.id;
    await window.appStorage.saveItem('templates', templateObj);
    this.notify('template_added', templateObj);
  }

  async deleteTemplate(templateId) {
    this.templates = this.templates.filter(t => t.id !== templateId);
    if (this.activeTemplateId === templateId) {
      this.activeTemplateId = this.templates.length > 0 ? this.templates[0].id : null;
    }
    await window.appStorage.deleteItem('templates', templateId);

    this.assignments = this.assignments.filter(a => a.templateId !== templateId);
    await window.appStorage.deleteItem('assignments', templateId);

    this.notify('template_deleted', templateId);
    this.notify('assignment_changed');
  }

  async clearAllTemplates() {
    for (const tpl of this.templates) {
      await window.appStorage.deleteItem('templates', tpl.id);
      await window.appStorage.deleteItem('assignments', tpl.id);
    }
    this.templates = [];
    this.assignments = [];
    this.activeTemplateId = null;
    this.notify('template_deleted');
    this.notify('assignment_changed');
  }

  async duplicateTemplate(templateId) {
    const orig = this.templates.find(t => t.id === templateId);
    if (!orig) return;

    const copy = JSON.parse(JSON.stringify(orig));
    copy.id = 'tpl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    copy.name = `${orig.name} (Copy)`;
    await this.addTemplate(copy);
  }

  async renameTemplate(templateId, newName) {
    const tpl = this.templates.find(t => t.id === templateId);
    if (tpl && newName) {
      tpl.name = newName.trim();
      await window.appStorage.saveItem('templates', tpl);
      this.notify('template_added', tpl);
    }
  }

  async addExcelFile(excelObj) {
    const existingIdx = this.excelFiles.findIndex(e => e.id === excelObj.id);
    if (existingIdx >= 0) {
      this.excelFiles[existingIdx] = excelObj;
    } else {
      this.excelFiles.push(excelObj);
    }
    this.activeExcelId = excelObj.id;
    await window.appStorage.saveItem('excels', excelObj);
    this.notify('excel_added', excelObj);
  }

  async deleteExcelFile(excelId) {
    this.excelFiles = this.excelFiles.filter(e => e.id !== excelId);
    if (this.activeExcelId === excelId) {
      this.activeExcelId = this.excelFiles.length > 0 ? this.excelFiles[0].id : null;
    }
    await window.appStorage.deleteItem('excels', excelId);

    const unassignTemplates = this.assignments.filter(a => a.excelId === excelId).map(a => a.templateId);
    this.assignments = this.assignments.filter(a => a.excelId !== excelId);
    for (const tId of unassignTemplates) {
      await window.appStorage.deleteItem('assignments', tId);
    }

    this.notify('excel_deleted', excelId);
    this.notify('assignment_changed');
  }

  async clearAllExcelFiles() {
    for (const xls of this.excelFiles) {
      await window.appStorage.deleteItem('excels', xls.id);
    }
    for (const a of this.assignments) {
      await window.appStorage.deleteItem('assignments', a.templateId);
    }
    this.excelFiles = [];
    this.assignments = [];
    this.activeExcelId = null;
    this.notify('excel_deleted');
    this.notify('assignment_changed');
  }

  getAssignmentForTemplate(templateId) {
    return this.assignments.find(a => a.templateId === templateId) || null;
  }

  async setAssignment(templateId, excelId) {
    return this.assignTemplateToExcel(templateId, excelId);
  }

  async assignTemplateToExcel(templateId, excelId) {
    const existingIdx = this.assignments.findIndex(a => a.templateId === templateId);
    const assignmentObj = { templateId: templateId, excelId: excelId };

    if (existingIdx >= 0) {
      if (excelId) {
        this.assignments[existingIdx] = assignmentObj;
      } else {
        this.assignments.splice(existingIdx, 1);
        await window.appStorage.deleteItem('assignments', templateId);
      }
    } else if (excelId) {
      this.assignments.push(assignmentObj);
    }

    if (excelId) {
      await window.appStorage.saveItem('assignments', assignmentObj);
    }

    this.notify('assignment_changed', { templateId, excelId });
  }

  getAssignedPairs() {
    const pairs = [];
    this.assignments.forEach(asg => {
      const tpl = this.templates.find(t => t.id === asg.templateId);
      const xls = this.excelFiles.find(e => e.id === asg.excelId);
      if (tpl && xls) {
        pairs.push({ template: tpl, excel: xls });
      }
    });
    return pairs;
  }
}

window.appState = new AppState();

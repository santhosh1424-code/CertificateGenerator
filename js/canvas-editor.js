/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - HIGH PERFORMANCE CANVAS EDITOR ENGINE
   ========================================================================== */

class CanvasEditor {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.wrapper = null;
    this.stage = null;
    this.viewport = null;

    this.bgImage = null;
    this.isDragging = false;
    this.isResizing = false;
    this.dragTarget = null;
    this.resizeHandle = null;
    this.dragOffset = { x: 0, y: 0 };
    this.initialBounds = null;

    this.activeRecordOverride = null;
    this.editorLocked = false;

    // Granular Lock Options
    this.lockOptions = {
      lockFontFamily: false,
      lockFontSize: false,
      lockFontWeight: false,
      lockFontStyle: false,
      lockTextColor: false,
      lockTextAlign: false,
      lockPosition: false,
      lockEntireTemplate: false
    };
  }

  init(canvasId, wrapperId, stageId) {
    console.log('[CanvasEditor] Initializing Canva-Grade Visual Editor...');
    this.canvas = document.getElementById(canvasId);
    this.wrapper = document.getElementById(wrapperId);
    this.stage = document.getElementById(stageId);
    this.viewport = document.getElementById('canvas-viewport');

    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.bindEvents();
    this.bindKeyboardShortcuts();
  }

  safePushHistory() {
    if (window.appState && typeof window.appState.pushHistory === 'function') {
      window.appState.pushHistory();
    }
  }

  setTemplateLocked(isLocked) {
    this.editorLocked = isLocked;
    this.lockOptions.lockEntireTemplate = isLocked;

    const lockBadge = document.getElementById('lock-status-badge');
    const lockCheck = document.getElementById('lock-entire-template');

    if (lockBadge) {
      lockBadge.textContent = isLocked ? '🔒 Locked' : 'Unlocked';
      lockBadge.className = isLocked ? 'badge badge-danger' : 'badge badge-secondary';
    }
    if (lockCheck) lockCheck.checked = isLocked;

    this.togglePropertyInputs(!isLocked);
    this.drawCanvas();

    window.appState.notify('toast', {
      type: isLocked ? 'warning' : 'info',
      message: isLocked ? 'Template properties locked for editing.' : 'Template unlocked.'
    });
  }

  toggleFieldLockOption(optionKey, isChecked) {
    this.lockOptions[optionKey] = isChecked;
    if (optionKey === 'lockEntireTemplate') {
      this.setTemplateLocked(isChecked);
    }
  }

  toggleTemplateLockAll(isChecked) {
    this.setTemplateLocked(isChecked);
  }

  togglePropertyInputs(enabled) {
    const propertyInputIds = [
      'prop-font-family', 'prop-font-size', 'prop-bold', 'prop-italic',
      'prop-underline', 'prop-color', 'prop-align', 'prop-valign',
      'prop-autofit', 'prop-wordwrap', 'prop-x-pos', 'prop-y-pos',
      'prop-box-width', 'prop-box-height', 'prop-linked-column'
    ];

    propertyInputIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    });
  }

  render() {
    const template = window.appState.getActiveTemplate();
    if (!template) {
      this.clearCanvas();
      return;
    }

    this.canvas.width = template.width;
    this.canvas.height = template.height;

    this.loadBackgroundImage(template.dataUrl, () => {
      this.drawCanvas();
    });
  }

  loadBackgroundImage(src, callback) {
    if (!src) {
      this.bgImage = null;
      if (callback) callback();
      return;
    }

    const img = new Image();
    img.onload = () => {
      this.bgImage = img;
      if (callback) callback();
    };
    img.onerror = () => {
      console.error('[CanvasEditor] Error loading template background image.');
      this.bgImage = null;
      if (callback) callback();
    };
    img.src = src;
  }

  drawCanvas() {
    if (!this.canvas || !this.ctx) return;

    const template = window.appState.getActiveTemplate();
    if (!template) {
      this.clearCanvas();
      return;
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.bgImage && this.bgImage.complete) {
      this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
    }

    const liveRecord = this.resolveActiveRecord();
    const activeExcel = window.appState.getActiveExcel();
    const countEl = document.getElementById('record-count-indicator');
    if (countEl && activeExcel && activeExcel.rows) {
      const currentIdx = ((window.appState.canvasSettings && window.appState.canvasSettings.recordIndex) || 0) + 1;
      countEl.textContent = `Record ${currentIdx} of ${activeExcel.rows.length}`;
    }

    this.updatePropertyPanelValues(liveRecord, activeExcel);

    const fields = template.fields || [];
    const sortedFields = [...fields].sort((a, b) => (a.layerOrder || 1) - (b.layerOrder || 1));

    sortedFields.forEach(field => {
      if (field.visibility === false) return;
      this.renderSmartObject(this.ctx, field, liveRecord, false);
    });

    this.updateDomOverlays();
  }

  resolveActiveRecord() {
    if (this.activeRecordOverride) return this.activeRecordOverride;
    const activeExcel = window.appState.getActiveExcel();
    if (!activeExcel || !activeExcel.rows || activeExcel.rows.length === 0) return null;
    const recIdx = (window.appState.canvasSettings && window.appState.canvasSettings.recordIndex) || 0;
    return activeExcel.rows[recIdx] || activeExcel.rows[0];
  }

  renderSmartObject(ctx, field, record, isExport = false) {
    ctx.save();

    let textToDraw = '';
    const linkedCol = field.linkedColumn || field.field;

    if (record && record[linkedCol] !== undefined && record[linkedCol] !== '') {
      textToDraw = String(record[linkedCol]);
    } else if (this.activeRecordOverride && (this.activeRecordOverride[linkedCol] !== undefined || this.activeRecordOverride[field.field] !== undefined)) {
      textToDraw = String(this.activeRecordOverride[linkedCol] || this.activeRecordOverride[field.field]);
    } else if (record && record[field.field] !== undefined && record[field.field] !== '') {
      textToDraw = String(record[field.field]);
    } else {
      textToDraw = field.sampleText || field.field || 'Sample Text';
    }

    const fontFamily = window.fontManager.ensureFontLoaded(field.fontFamily || 'Inter');
    const masterFontSize = Math.min(200, Math.max(8, parseInt(field.fontSize) || 12));
    let currentFontSize = masterFontSize;

    const fontStyle = (field.italic || field.fontStyle === 'italic') ? 'italic' : 'normal';
    const fontWeight = (field.bold || field.fontWeight === 'bold') ? 'bold' : 'normal';

    ctx.font = `${fontStyle} ${fontWeight} ${currentFontSize}px "${fontFamily}", Inter, sans-serif`;
    ctx.fillStyle = field.color || '#000000';

    const innerW = Math.max(10, field.width);
    const measuredW = ctx.measureText(textToDraw).width;

    if (field.autoResize !== false && measuredW > innerW) {
      const scaledSize = Math.floor(currentFontSize * (innerW / measuredW));
      currentFontSize = Math.max(8, scaledSize);
      ctx.font = `${fontStyle} ${fontWeight} ${currentFontSize}px "${fontFamily}", Inter, sans-serif`;
    }

    const align = field.textAlign || 'center';
    let textX = field.x;
    if (align === 'center') {
      textX = field.x + (field.width / 2);
    } else if (align === 'right') {
      textX = field.x + field.width;
    } else {
      textX = field.x;
    }

    const valign = field.verticalAlign || 'middle';
    let textY = field.y + (field.height / 2);
    if (valign === 'top') textY = field.y + (currentFontSize / 2);
    else if (valign === 'bottom') textY = field.y + field.height - (currentFontSize / 2);

    ctx.textAlign = align;
    ctx.textBaseline = 'middle';

    ctx.fillText(textToDraw, textX, textY);

    if (field.underline) {
      const underlineY = textY + (currentFontSize / 2) + 2;
      let startX = field.x;
      if (align === 'center') startX = textX - (measuredW / 2);
      else if (align === 'right') startX = textX - measuredW;

      ctx.beginPath();
      ctx.strokeStyle = field.color || '#000000';
      ctx.lineWidth = Math.max(1, currentFontSize / 14);
      ctx.moveTo(startX, underlineY);
      ctx.lineTo(startX + measuredW, underlineY);
      ctx.stroke();
    }

    // EXPORT MODE STRICT GUARD: Render bounding boxes & selection outlines ONLY in editor mode
    if (!isExport) {
      const isSelected = window.appState.activeElementId === field.id;
      ctx.strokeStyle = isSelected ? '#2563EB' : 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.setLineDash(isSelected ? [4, 4] : [2, 2]);
      ctx.strokeRect(field.x, field.y, field.width, field.height);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  updatePropertyPanelValues(record, activeExcel) {
    const template = window.appState.getActiveTemplate();
    if (!template) return;

    const field = template.fields.find(f => f.id === window.appState.activeElementId);
    
    const propLinked = document.getElementById('prop-linked-column');
    const propVal = document.getElementById('prop-current-val');
    const propX = document.getElementById('prop-x-pos');
    const propY = document.getElementById('prop-y-pos');
    const propW = document.getElementById('prop-box-width');
    const propH = document.getElementById('prop-box-height');
    const propFont = document.getElementById('prop-font-family');
    const propSize = document.getElementById('prop-font-size');
    const propBold = document.getElementById('prop-bold');
    const propItalic = document.getElementById('prop-italic');
    const propUnder = document.getElementById('prop-underline');
    const propColor = document.getElementById('prop-color');
    const propAlign = document.getElementById('prop-align');
    const propValign = document.getElementById('prop-valign');
    const propFit = document.getElementById('prop-autofit');
    const propWrap = document.getElementById('prop-wordwrap');
    const propLock = document.getElementById('prop-lock');

    if (propLinked && activeExcel && activeExcel.headers) {
      const currentSelected = field ? (field.linkedColumn || field.field) : '';
      propLinked.innerHTML = `<option value="">-- Unlinked --</option>` + 
        activeExcel.headers.map(h => `<option value="${h}" ${h === currentSelected ? 'selected' : ''}>${h}</option>`).join('');
    }

    if (!field) {
      if (propVal) propVal.textContent = '—';
      return;
    }

    const linkedCol = field.linkedColumn || field.field;
    if (propVal) {
      propVal.textContent = (record && record[linkedCol] !== undefined) ? String(record[linkedCol]) : '—';
    }

    if (propX) propX.value = field.x;
    if (propY) propY.value = field.y;
    if (propW) propW.value = field.width;
    if (propH) propH.value = field.height;
    if (propFont) propFont.value = field.fontFamily || 'Inter';
    if (propSize) propSize.value = field.fontSize || 12;
    if (propBold) propBold.checked = !!(field.bold || field.fontWeight === 'bold');
    if (propItalic) propItalic.checked = !!(field.italic || field.fontStyle === 'italic');
    if (propUnder) propUnder.checked = !!field.underline;
    if (propColor) propColor.value = field.color || '#000000';
    if (propAlign) propAlign.value = field.textAlign || 'center';
    if (propValign) propValign.value = field.verticalAlign || 'middle';
    if (propFit) propFit.checked = field.autoResize !== false;
    if (propWrap) propWrap.checked = !!field.wordWrap;
    if (propLock) propLock.checked = !!field.lockPosition;
  }

  updateDomOverlays() {
    const template = window.appState.getActiveTemplate();
    let overlaysContainer = document.getElementById('canvas-overlays');

    if (!overlaysContainer) {
      overlaysContainer = document.createElement('div');
      overlaysContainer.id = 'canvas-overlays';
      overlaysContainer.style.position = 'absolute';
      overlaysContainer.style.inset = '0';
      overlaysContainer.style.pointerEvents = 'none';
      if (this.wrapper) this.wrapper.appendChild(overlaysContainer);
    }

    overlaysContainer.innerHTML = '';
    if (!template || !template.fields) return;

    template.fields.forEach(field => {
      const isSelected = window.appState.activeElementId === field.id;
      if (!isSelected) return;

      const overlay = document.createElement('div');
      overlay.className = `canvas-element-overlay ${isSelected ? 'selected' : ''}`;
      overlay.style.left = `${field.x}px`;
      overlay.style.top = `${field.y}px`;
      overlay.style.width = `${field.width}px`;
      overlay.style.height = `${field.height}px`;

      if (isSelected && !this.editorLocked && !field.lockPosition) {
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach(h => {
          const handleEl = document.createElement('div');
          handleEl.className = `resize-handle handle-${h}`;
          handleEl.style.pointerEvents = 'auto';
          handleEl.addEventListener('mousedown', (e) => this.onResizeMouseDown(e, field, h));
          overlay.appendChild(handleEl);
        });
      }

      overlay.addEventListener('mousedown', (e) => this.onElementMouseDown(e, field));
      overlaysContainer.appendChild(overlay);
    });
  }

  onElementMouseDown(e, field) {
    e.stopPropagation();
    window.appState.activeElementId = field.id;
    this.drawCanvas();

    const template = window.appState.getActiveTemplate();
    if (field.lockPosition || field.isLocked || (template && template.isLocked)) return;

    this.isDragging = true;
    this.dragTarget = field;

    const scale = (this.canvas.clientWidth / this.canvas.width) * ((window.appState.canvasSettings && window.appState.canvasSettings.zoom) || 1);
    this.dragOffset = {
      x: e.clientX - (field.x * scale),
      y: e.clientY - (field.y * scale)
    };

    this.safePushHistory();
  }

  onResizeMouseDown(e, field, handleType) {
    e.stopPropagation();
    const template = window.appState.getActiveTemplate();
    if (field.lockPosition || field.isLocked || (template && template.isLocked)) return;
    this.isResizing = true;
    this.resizeHandle = handleType;
    this.dragTarget = field;
    this.safePushHistory();
  }

  bindEvents() {
    if (!this.stage) return;

    if (this.viewport) {
      this.viewport.addEventListener('mousedown', (e) => {
        if (e.target === this.viewport || e.target === this.stage) {
          window.appState.activeElementId = null;
          this.drawCanvas();
        }
      });

      this.viewport.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          const curr = (window.appState.canvasSettings && window.appState.canvasSettings.zoom) || 1.0;
          this.setZoom(Math.max(0.25, Math.min(2.0, curr + delta)));
        }
      }, { passive: false });
    }

    document.addEventListener('mousemove', (e) => {
      if (!this.dragTarget) return;

      const template = window.appState.getActiveTemplate();
      if (!template) return;

      const scale = (this.canvas.clientWidth / this.canvas.width) * ((window.appState.canvasSettings && window.appState.canvasSettings.zoom) || 1);

      if (this.isDragging) {
        let newX = Math.round((e.clientX - this.dragOffset.x) / scale);
        let newY = Math.round((e.clientY - this.dragOffset.y) / scale);

        newX = Math.max(0, Math.min(template.width - this.dragTarget.width, newX));
        newY = Math.max(0, Math.min(template.height - this.dragTarget.height, newY));

        this.dragTarget.x = newX;
        this.dragTarget.y = newY;
        this.drawCanvas();
      } else if (this.isResizing) {
        const mouseX = Math.round(e.clientX / scale);
        const mouseY = Math.round(e.clientY / scale);

        if (this.resizeHandle.includes('e')) {
          this.dragTarget.width = Math.max(20, mouseX - this.dragTarget.x);
        }
        if (this.resizeHandle.includes('s')) {
          this.dragTarget.height = Math.max(10, mouseY - this.dragTarget.y);
        }
        this.drawCanvas();
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isDragging || this.isResizing) {
        const template = window.appState.getActiveTemplate();
        if (template) {
          window.appStorage.saveItem('templates', template);
        }
      }
      this.isDragging = false;
      this.isResizing = false;
      this.dragTarget = null;
      this.resizeHandle = null;
    });
  }

  bindKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

      const template = window.appState.getActiveTemplate();
      if (!template || !window.appState.activeElementId) return;

      const field = template.fields.find(f => f.id === window.appState.activeElementId);
      if (!field || field.lockPosition || this.editorLocked) return;

      const step = e.shiftKey ? 10 : 1;

      if (e.key === 'ArrowLeft') { field.x = Math.max(0, field.x - step); this.drawCanvas(); }
      else if (e.key === 'ArrowRight') { field.x = Math.min(template.width - field.width, field.x + step); this.drawCanvas(); }
      else if (e.key === 'ArrowUp') { field.y = Math.max(0, field.y - step); this.drawCanvas(); }
      else if (e.key === 'ArrowDown') { field.y = Math.min(template.height - field.height, field.y + step); this.drawCanvas(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { this.deleteActiveElement(); }
    });
  }

  clearCanvas() {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  duplicateObject(sourceField) {
    const template = window.appState.getActiveTemplate();
    if (!template || !sourceField) return;

    this.safePushHistory();

    const copy = JSON.parse(JSON.stringify(sourceField));
    copy.id = 'fld-' + Date.now();
    copy.x += 20;
    copy.y += 20;

    template.fields.push(copy);
    window.appState.activeElementId = copy.id;
    window.appStorage.saveItem('templates', template);
    this.render();
  }

  alignActiveElement(type) {
    const template = window.appState.getActiveTemplate();
    if (!template || !window.appState.activeElementId) return;

    const field = template.fields.find(f => f.id === window.appState.activeElementId);
    if (!field || field.lockPosition || field.isLocked || template.isLocked) return;

    this.safePushHistory();

    if (type === 'centerH') field.x = Math.round(template.width / 2);
    else if (type === 'centerV') field.y = Math.round(template.height / 2);
    else if (type === 'left') field.x = Math.round(field.width / 2 + (field.padding || 10));
    else if (type === 'right') field.x = Math.round(template.width - (field.width / 2 + (field.padding || 10)));
    else if (type === 'top') field.y = Math.round(field.height / 2 + (field.padding || 10));
    else if (type === 'bottom') field.y = Math.round(template.height - (field.height / 2 + (field.padding || 10)));

    window.appStorage.saveItem('templates', template);
    this.drawCanvas();
  }

  setZoom(zoomVal) {
    if (zoomVal === 'fitWidth' || zoomVal === 'fitScreen') {
      const stageW = this.viewport ? this.viewport.clientWidth - 80 : 800;
      zoomVal = Math.max(0.25, Math.min(2.0, stageW / (this.canvas ? this.canvas.width : 1000)));
    }
    if (!window.appState.canvasSettings) window.appState.canvasSettings = { zoom: 1.0, recordIndex: 0 };
    window.appState.canvasSettings.zoom = parseFloat(zoomVal);
    if (this.wrapper) {
      this.wrapper.style.transform = `scale(${window.appState.canvasSettings.zoom})`;
    }
  }

  navigateRecord(direction) {
    const activeExcel = window.appState.getActiveExcel();
    if (!activeExcel || !activeExcel.rows || activeExcel.rows.length === 0) return;

    const total = activeExcel.rows.length;
    if (!window.appState.canvasSettings) window.appState.canvasSettings = { zoom: 1.0, recordIndex: 0 };
    let curr = window.appState.canvasSettings.recordIndex || 0;

    if (direction === 'next') curr = (curr + 1) % total;
    else if (direction === 'prev') curr = (curr - 1 + total) % total;
    else if (direction === 'random') curr = Math.floor(Math.random() * total);

    window.appState.canvasSettings.recordIndex = curr;
    this.activeRecordOverride = null;
    this.drawCanvas();
  }

  setTestRecordMode(mode) {
    const activeExcel = window.appState.getActiveExcel();
    if (!activeExcel || !activeExcel.stats) return;

    const stats = activeExcel.stats;
    if (mode === 'longestName') {
      this.activeRecordOverride = { Name: stats.longestName, College: stats.longestCollege };
    } else if (mode === 'longestCollege') {
      this.activeRecordOverride = { Name: stats.longestName, College: stats.longestCollege };
    } else {
      this.activeRecordOverride = null;
    }

    this.drawCanvas();
  }

  addFieldToTemplate(type = 'text', fieldName = 'New Variable') {
    const template = window.appState.getActiveTemplate();
    if (!template || template.isLocked) return;

    this.safePushHistory();

    const newField = {
      id: 'fld-' + Date.now(),
      type: type,
      field: fieldName,
      linkedColumn: fieldName,
      sampleText: fieldName,
      x: Math.round(template.width / 2),
      y: Math.round(template.height / 2),
      width: Math.round(template.width * 0.6),
      height: Math.round(template.height * 0.1),
      minFontSize: 8,
      maxFontSize: 200,
      fontSize: Math.round(template.height * 0.04),
      autoResize: true,
      wordWrap: true,
      padding: 6,
      letterSpacing: 0,
      baselineOffset: 0,
      fontFamily: window.appState.settings.defaultFont || 'Inter',
      fontWeight: 'normal',
      fontStyle: 'normal',
      bold: false,
      italic: false,
      underline: false,
      color: '#1e293b',
      textAlign: 'center',
      verticalAlign: 'middle',
      visibility: true,
      lockPosition: false,
      layerOrder: template.fields.length + 1
    };

    template.fields.push(newField);
    window.appState.activeElementId = newField.id;
    window.appStorage.saveItem('templates', template);
    this.render();
  }

  deleteActiveElement() {
    const template = window.appState.getActiveTemplate();
    if (!template || !window.appState.activeElementId || template.isLocked) return;

    this.safePushHistory();
    template.fields = template.fields.filter(f => f.id !== window.appState.activeElementId);
    window.appState.activeElementId = null;
    window.appStorage.saveItem('templates', template);
    this.render();
  }
}

window.canvasEditor = new CanvasEditor();

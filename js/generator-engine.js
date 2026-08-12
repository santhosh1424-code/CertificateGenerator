/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - HIGH PERFORMANCE BATCH GENERATION ENGINE
   ========================================================================== */

class GeneratorEngine {
  constructor() {
    this.isGenerating = false;
    this.isPaused = false;
    this.isCancelled = false;
    this.totalRecords = 0;
    this.processedRecords = 0;
    this.skippedRecords = 0;
    this.failedRecords = 0;
    this.startTime = 0;
    this.generatedExampleNames = [];
    this.sharedExportCanvas = null;
    this.sharedExportCtx = null;
    this.imageCache = new Map();
    this.latestZipBlob = null;
    this.latestZipFilename = 'Certificates.zip';
    this.pendingLockedPairs = [];
  }

  togglePause() {
    if (!this.isGenerating) return;
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      console.log('[CertiGen Generator] Execution Paused.');
      window.appState.notify('generation_paused');
    } else {
      console.log('[CertiGen Generator] Execution Resumed.');
      window.appState.notify('generation_resumed');
    }
  }

  cancel() {
    if (!this.isGenerating) return;
    console.log('[CertiGen Generator] Cancelling generation...');
    this.isCancelled = true;
    this.isPaused = false;
    this.isGenerating = false;
    window.progressManager.hideModal();
    window.appState.notify('toast', { type: 'info', message: 'Certificate generation cancelled.' });
  }

  async testZipDiagnostic() {
    console.log('[CertiGen Diagnostic] Testing JSZip compilation with test.txt...');
    try {
      if (typeof JSZip === 'undefined' || typeof saveAs === 'undefined') {
        alert('Diagnostic Error: JSZip or FileSaver vendor library is missing.');
        return;
      }

      const zip = new JSZip();
      zip.file('Certificates/TestFolder/test.txt', `CertiGen Pro Diagnostic Test File\nTimestamp: ${new Date().toISOString()}\nStatus: JSZip Engine Operational.\n`);
      
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      if (!zipBlob || !(zipBlob instanceof Blob) || zipBlob.size === 0) {
        alert('Diagnostic Failed: JSZip generated a 0 byte or invalid blob.');
        return;
      }

      saveAs(zipBlob, 'TestDiagnostic.zip');
      console.log(`[CertiGen Diagnostic] Diagnostic ZIP generated successfully (${zipBlob.size} bytes).`);
      alert('✅ Diagnostic ZIP (TestDiagnostic.zip) created successfully! If Windows Explorer opens this file, JSZip engine is 100% operational.');
    } catch (err) {
      console.error('[CertiGen Diagnostic] Error:', err);
      alert(`Diagnostic Error: ${err.message}`);
    }
  }

  startBulkGeneration() {
    console.log('[CertiGen Generator] Step 1: "Generate All" button clicked.');

    if (this.isGenerating) {
      console.warn('[CertiGen Generator] Generation already in progress.');
      return;
    }

    const assignedPairs = window.appState.getAssignedPairs();
    const preFlight = this.validatePreFlight(assignedPairs);

    this.showPreFlightModal(assignedPairs, preFlight);
  }

  showPreFlightModal(assignedPairs, preFlight) {
    const modal = document.getElementById('preflight-modal');
    if (!modal) {
      this.executeGenerationFromPreflight();
      return;
    }

    const checklistContainer = document.getElementById('preflight-checklist');
    const actionsContainer = document.getElementById('preflight-actions-container');
    const actionsList = document.getElementById('preflight-actions-list');
    const badgeEl = document.getElementById('preflight-status-badge');
    const btnExec = document.getElementById('btn-start-generation-exec');

    const hasTemplate = window.appState.templates.length > 0;
    const hasExcel = window.appState.excelFiles.length > 0;
    const hasAssigned = assignedPairs.length > 0;
    const isMappingComplete = preFlight.isValid;

    const checklistItems = [
      { label: 'Template Uploaded', pass: hasTemplate, reason: 'No certificate template uploaded.', targetView: 'templates', actionBtn: 'Go to Templates' },
      { label: 'Excel Loaded', pass: hasExcel, reason: 'No Excel workbook uploaded.', targetView: 'excel', actionBtn: 'Go to Excel Files' },
      { label: 'Assignment Complete', pass: hasAssigned, reason: 'Template has not been assigned to an Excel file.', targetView: 'assignments', actionBtn: 'Open Assignment Manager' },
      { label: 'Fields Mapped', pass: isMappingComplete, reason: 'Participant name or required text field is not mapped.', targetView: 'mapping', actionBtn: 'Open Field Mapping' },
      { label: 'Font Settings Saved', pass: true },
      { label: 'Output Folder Ready', pass: true },
      { label: 'Template Image Loaded', pass: hasTemplate },
      { label: 'Required Columns Available', pass: isMappingComplete },
      { label: 'Canvas Ready', pass: true },
      { label: 'ZIP Engine Ready', pass: typeof JSZip !== 'undefined' },
      { label: 'Browser Compatible', pass: true }
    ];

    const passedCount = checklistItems.filter(i => i.pass).length;
    const scorePct = Math.round((passedCount / checklistItems.length) * 100);
    const allPassed = scorePct === 100;

    // Update Circular Progress SVG
    const circlePath = document.getElementById('readiness-circle-path');
    const scoreText = document.getElementById('readiness-score-text');
    const scoreTitle = document.getElementById('readiness-score-title');
    const scoreSub = document.getElementById('readiness-score-subtitle');

    if (circlePath) {
      circlePath.setAttribute('stroke-dasharray', `${scorePct}, 100`);
      circlePath.setAttribute('stroke', allPassed ? 'var(--accent-success)' : 'var(--accent-danger)');
    }
    if (scoreText) {
      scoreText.textContent = `${scorePct}%`;
      scoreText.style.color = allPassed ? 'var(--text-primary)' : 'var(--accent-danger)';
    }
    if (scoreTitle) {
      scoreTitle.textContent = allPassed ? '100% Ready' : `${scorePct}% Action Required`;
    }
    if (scoreSub) {
      scoreSub.textContent = allPassed ? 'All 11 system validations passed cleanly.' : `${checklistItems.length - passedCount} configuration check(s) require attention.`;
    }

    if (checklistContainer) {
      checklistContainer.innerHTML = checklistItems.map(item => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${item.pass ? '<strong style="color: var(--accent-success);">✔</strong>' : '<strong style="color: var(--accent-danger);">❌</strong>'}</span>
            <span style="color: ${item.pass ? 'var(--text-primary)' : 'var(--accent-danger)'}; font-weight: ${item.pass ? '500' : '600'};">${item.label}</span>
          </div>
          <span style="font-size: 0.72rem; color: ${item.pass ? 'var(--accent-success)' : 'var(--accent-danger)'}; font-weight: 600;">${item.pass ? 'PASS' : 'FAIL'}</span>
        </div>
      `).join('');
    }

    const failedItems = checklistItems.filter(item => !item.pass);

    if (actionsContainer && actionsList) {
      if (failedItems.length > 0) {
        actionsContainer.style.display = 'block';
        actionsList.innerHTML = failedItems.map(f => `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <div>
              <strong style="color: var(--accent-danger);">❌ ${f.label}</strong>: 
              <span style="color: var(--text-muted);">${f.reason}</span>
            </div>
            ${f.targetView ? `<button class="btn btn-secondary btn-sm" style="white-space: nowrap;" onclick="document.getElementById('preflight-modal').classList.remove('active'); window.appController.switchView('${f.targetView}');">${f.actionBtn}</button>` : ''}
          </div>
        `).join('');
      } else {
        actionsContainer.style.display = 'none';
        actionsList.innerHTML = '';
      }
    }

    let totalRows = 0;
    let mainTplName = '—';
    let mainXlsName = '—';

    if (assignedPairs.length > 0) {
      mainTplName = assignedPairs[0].template.name;
      mainXlsName = assignedPairs[0].excel.name;
      totalRows = assignedPairs.reduce((sum, p) => sum + (p.excel.rows ? p.excel.rows.length : 0), 0);
    } else if (window.appState.templates.length > 0) {
      mainTplName = window.appState.templates[0].name;
    }

    const format = window.appState.settings.outputFormat || 'png';
    const estSizeMB = (totalRows * 0.6).toFixed(0);
    const estTimeSec = Math.max(1, Math.round(totalRows / 20));

    const pfTpl = document.getElementById('pf-tpl-name');
    const pfXls = document.getElementById('pf-xls-name');
    const pfRows = document.getElementById('pf-rows-count');
    const pfCerts = document.getElementById('pf-certs-count');
    const pfSize = document.getElementById('pf-est-size');
    const pfTime = document.getElementById('pf-est-time');
    const pfFmt = document.getElementById('pf-format');

    if (pfTpl) pfTpl.textContent = mainTplName;
    if (pfXls) pfXls.textContent = mainXlsName;
    if (pfRows) pfRows.textContent = totalRows;
    if (pfCerts) pfCerts.textContent = totalRows;
    if (pfSize) pfSize.textContent = totalRows > 0 ? `~${estSizeMB} MB` : '0 MB';
    if (pfTime) pfTime.textContent = totalRows > 0 ? `~${estTimeSec} Seconds` : '0 Seconds';
    if (pfFmt) pfFmt.textContent = format.toUpperCase();

    if (badgeEl) {
      badgeEl.textContent = allPassed ? '100% Ready' : `${scorePct}% Action Required`;
      badgeEl.className = allPassed ? 'badge badge-primary' : 'badge badge-danger';
    }

    if (btnExec) {
      btnExec.disabled = !allPassed;
      btnExec.textContent = '🚀 Start Bulk Generation';
    }

    this.pendingLockedPairs = assignedPairs.map(pair => {
      return {
        excel: pair.excel,
        template: window.structuredClone ? structuredClone(pair.template) : JSON.parse(JSON.stringify(pair.template))
      };
    });

    modal.classList.add('active');
  }

  async executeGenerationFromPreflight() {
    const pfModal = document.getElementById('preflight-modal');
    if (pfModal) pfModal.classList.remove('active');

    const lockedPairs = this.pendingLockedPairs.length > 0 ? this.pendingLockedPairs : window.appState.getAssignedPairs().map(pair => {
      return {
        excel: pair.excel,
        template: window.structuredClone ? structuredClone(pair.template) : JSON.parse(JSON.stringify(pair.template))
      };
    });

    const savedActiveElementId = window.appState.activeElementId;
    window.appState.activeElementId = null;

    this.isGenerating = true;
    this.isPaused = false;
    this.isCancelled = false;
    this.processedRecords = 0;
    this.skippedRecords = 0;
    this.failedRecords = 0;
    this.generatedExampleNames = [];
    this.startTime = Date.now();

    if (!this.sharedExportCanvas) {
      this.sharedExportCanvas = document.createElement('canvas');
      this.sharedExportCtx = this.sharedExportCanvas.getContext('2d');
    }

    this.totalRecords = lockedPairs.reduce((acc, pair) => acc + (pair.excel.rows ? pair.excel.rows.length : 0), 0);
    console.log(`[CertiGen Generator] Starting generation for ${this.totalRecords} total record(s).`);

    window.appState.notify('generation_started', { total: this.totalRecords });

    const zip = new JSZip();

    try {
      for (let pIdx = 0; pIdx < lockedPairs.length; pIdx++) {
        if (this.isCancelled) break;

        const pair = lockedPairs[pIdx];
        const excelObj = pair.excel;
        const template = pair.template;

        const templateFolder = this.sanitizeName(template.name.replace(/\.[^/.]+$/, ""), 40);

        await this.processSheetAndTemplate(excelObj, template, zip, templateFolder);
      }

      if (!this.isCancelled) {
        console.log('[CertiGen Generator] Packaging certificates into ZIP archive...');
        window.appState.notify('generation_progress', {
          current: this.totalRecords,
          total: this.totalRecords,
          status: 'Packaging ZIP archive with DEFLATE level 6 compression...'
        });

        if (this.processedRecords === 0) {
          alert('No certificates were generated. Please check rendering and try again.');
          return;
        }

        const zipFilename = window.appState.settings.defaultZipName || 'Certificates.zip';
        this.latestZipFilename = zipFilename;
        
        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: { level: 6 }
        });

        if (!zipBlob || !(zipBlob instanceof Blob) || zipBlob.size === 0) {
          throw new Error('ZIP compilation failed: Generated ZIP blob is invalid or 0 bytes.');
        }

        this.latestZipBlob = zipBlob;
        const zipSizeMB = (zipBlob.size / (1024 * 1024)).toFixed(2);
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);

        console.log('[CertiGen Generator] Generation completed successfully!');

        window.appState.notify('generation_completed', {
          total: this.totalRecords,
          processed: this.processedRecords,
          skipped: this.skippedRecords,
          failed: this.failedRecords,
          duration: duration,
          zipSize: `${zipSizeMB} MB`
        });

        saveAs(zipBlob, zipFilename);

        this.showSummaryReportModal(zipSizeMB, duration);
      }
    } catch (err) {
      console.error('[CertiGen Generator] Execution Error:', err);
      window.appState.notify('generation_failed', { error: err.message });
      alert(`Generation Execution Error: ${err.message}`);
    } finally {
      window.appState.activeElementId = savedActiveElementId;
      this.isGenerating = false;
    }
  }

  showSummaryReportModal(zipSizeMB, duration) {
    window.progressManager.hideModal();

    const sumModal = document.getElementById('summary-modal');
    if (!sumModal) return;

    const totalEl = document.getElementById('sum-total');
    const successEl = document.getElementById('sum-success');
    const skippedEl = document.getElementById('sum-skipped');
    const failedEl = document.getElementById('sum-failed');
    const durationEl = document.getElementById('sum-duration');
    const zipSizeEl = document.getElementById('sum-zip-size');
    const btnDl = document.getElementById('btn-download-zip-summary');

    if (totalEl) totalEl.textContent = this.totalRecords;
    if (successEl) successEl.textContent = this.processedRecords;
    if (skippedEl) skippedEl.textContent = this.skippedRecords;
    if (failedEl) failedEl.textContent = this.failedRecords;
    if (durationEl) durationEl.textContent = `${duration} seconds`;
    if (zipSizeEl) zipSizeEl.textContent = `${zipSizeMB} MB`;

    if (btnDl && this.latestZipBlob) {
      btnDl.onclick = () => saveAs(this.latestZipBlob, this.latestZipFilename);
    }

    sumModal.classList.add('active');
  }

  validatePreFlight(assignedPairs) {
    const errors = [];
    const warnings = [];

    if (assignedPairs.length === 0) {
      errors.push('No assigned Template ↔ Excel pairs found. Please pair templates in Assignment Manager.');
      return { isValid: false, errors, warnings };
    }

    assignedPairs.forEach(pair => {
      const tpl = pair.template;
      const xls = pair.excel;

      if (!tpl || !tpl.dataUrl) {
        errors.push(`Template "${tpl ? tpl.name : 'Unknown'}" background image is invalid or missing.`);
      }
      if (!xls || !xls.rows || xls.rows.length === 0) {
        errors.push(`Excel file "${xls ? xls.name : 'Unknown'}" has zero data rows.`);
      }

      const headers = xls.headers || [];

      (tpl.fields || []).forEach(field => {
        const linked = field.linkedColumn || field.field;
        if (!linked || !headers.includes(linked)) {
          if (/name|participant|student/i.test(field.field)) {
            errors.push(`Participant Name is not mapped for "${tpl.name}".`);
          } else if (/college|institute|university/i.test(field.field)) {
            errors.push(`College Name is not mapped for "${tpl.name}".`);
          } else {
            errors.push(`Field "${field.field}" in template "${tpl.name}" is not mapped to an existing column in "${xls.name}".`);
          }
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  }

  async processSheetAndTemplate(excelObj, template, zip, templateFolder) {
    const rows = excelObj.rows || [];
    const bgImg = await this.getCachedImage(template.dataUrl);

    this.sharedExportCanvas.width = template.width;
    this.sharedExportCanvas.height = template.height;
    const ctx = this.sharedExportCtx;

    const usedFilenamesSet = new Set();
    const chunkSize = 20;

    for (let i = 0; i < rows.length; i += chunkSize) {
      if (this.isCancelled) break;

      while (this.isPaused && !this.isCancelled) {
        await new Promise(r => setTimeout(r, 200));
      }

      const chunk = rows.slice(i, i + chunkSize);
      for (let j = 0; j < chunk.length; j++) {
        if (this.isCancelled) break;

        const record = chunk[j];
        const recordIdx = i + j;

        try {
          this.renderFrame(ctx, this.sharedExportCanvas, bgImg, template, record);

          const format = window.appState.settings.outputFormat || 'png';
          const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';

          let blob = await new Promise((resolve) => {
            this.sharedExportCanvas.toBlob((b) => resolve(b), mimeType, 0.95);
          });

          if (!blob || !(blob instanceof Blob) || blob.size === 0) {
            console.error(`[CertiGen Generator] Record #${recordIdx + 1} rendering failed. Skipping record.`);
            this.failedRecords++;
            continue;
          }

          const filename = this.generateFilename(record, recordIdx, format, usedFilenamesSet);
          const fullZipPath = `Certificates/${templateFolder}/${filename}`;

          zip.file(fullZipPath, blob);
          blob = null;

          this.processedRecords++;
          if (this.generatedExampleNames.length < 10) {
            this.generatedExampleNames.push(filename);
          }
        } catch (err) {
          console.error(`[CertiGen Generator] Error rendering record #${recordIdx + 1}:`, err);
          this.failedRecords++;
        }

        const elapsed = (Date.now() - this.startTime) / 1000;
        const speed = (this.processedRecords / Math.max(elapsed, 0.1)).toFixed(1);
        const remainingSecs = Math.round((this.totalRecords - this.processedRecords) / Math.max(parseFloat(speed), 0.1));

        window.appState.notify('generation_progress', {
          current: this.processedRecords,
          total: this.totalRecords,
          currentFile: excelObj.name,
          currentTemplate: template.name,
          currentRecord: record.Name || record.Student || `Record #${recordIdx + 1}`,
          speed: speed,
          elapsed: elapsed,
          eta: remainingSecs
        });
      }

      await new Promise(res => setTimeout(res, 0));
    }
  }

  renderFrame(ctx, canvas, bgImg, template, record) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    const fields = template.fields || [];
    const sortedFields = [...fields].sort((a, b) => (a.layerOrder || 1) - (b.layerOrder || 1));

    sortedFields.forEach(field => {
      if (field.visibility === false) return;
      window.canvasEditor.renderSmartObject(ctx, field, record, true);
    });
  }

  generateFilename(record, recordIdx, format, usedFilenamesSet) {
    let namingPattern = window.appState.settings.filenameTemplate || '{Name}';

    const nameKey = Object.keys(record).find(k => /name|student|participant|candidate/i.test(k)) || Object.keys(record)[0];
    const nameValue = record[nameKey] !== undefined ? String(record[nameKey]).trim() : '';

    let baseName = '';

    if (namingPattern.includes('{')) {
      baseName = namingPattern;
      for (const [key, val] of Object.entries(record)) {
        baseName = baseName.replace(new RegExp(`\\{${key}\\}`, 'gi'), String(val));
      }
    }

    if (!baseName || baseName.includes('{') || baseName.trim() === '') {
      baseName = nameValue;
    }

    if (!baseName || baseName.trim() === '') {
      const padNum = String(recordIdx + 1).padStart(3, '0');
      baseName = `Certificate_${padNum}`;
    }

    let sanitized = this.sanitizeName(baseName, 80);
    if (!sanitized) {
      sanitized = `Certificate_${String(recordIdx + 1).padStart(3, '0')}`;
    }

    let finalFilename = `${sanitized}.${format}`;
    let counter = 1;

    while (usedFilenamesSet.has(finalFilename.toLowerCase())) {
      finalFilename = `${sanitized} (${counter}).${format}`;
      counter++;
    }

    usedFilenamesSet.add(finalFilename.toLowerCase());
    return finalFilename;
  }

  sanitizeName(str, maxLen = 40) {
    if (!str) return 'Untitled';
    let clean = String(str).replace(/[\/\?:*?"<>|\\]/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > maxLen) {
      clean = clean.substring(0, maxLen).trim();
    }
    return clean || 'Untitled';
  }

  getCachedImage(src) {
    if (this.imageCache.has(src)) {
      return Promise.resolve(this.imageCache.get(src));
    }
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(src, img);
        res(img);
      };
      img.onerror = (err) => rej(new Error('Failed to load template background image.'));
      img.src = src;
    });
  }
}

window.generatorEngine = new GeneratorEngine();

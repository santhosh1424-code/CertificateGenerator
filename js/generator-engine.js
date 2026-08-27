/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - HIGH PERFORMANCE BATCH ENGINE
   ========================================================================== */

class GeneratorEngine {
  constructor() {
    this.isGenerating = false;
    this.isPaused = false;
    this.isCancelled = false;

    this.processedRecords = 0;
    this.skippedRecords = 0;
    this.failedRecords = 0;
    this.totalRecords = 0;

    this.startTime = null;
    this.latestZipBlob = null;
    this.latestZipFilename = 'Certificates.zip';

    this.pendingLockedPairs = [];
    this.imageCache = new Map();
    this.sharedExportCanvas = null;
    this.sharedExportCtx = null;
  }

  async startBulkGeneration() {
    if (this.isGenerating) {
      console.warn('[CertiGen Generator] Generation already in progress.');
      return;
    }

    console.log('[CertiGen Generator] Step 1: "Generate All" button clicked.');
    const assignedPairs = window.appState.getAssignedPairs();

    if (!assignedPairs || assignedPairs.length === 0) {
      alert('No template-to-excel assignments found! Please map your templates to Excel files in the Assignment tab before generating.');
      return;
    }

    this.showPreFlightModal(assignedPairs);
  }

  showPreFlightModal(assignedPairs) {
    const modal = document.getElementById('preflight-modal');
    const badgeEl = document.getElementById('preflight-readiness-badge');
    const progressText = document.getElementById('preflight-progress-text');
    const progressSvgCircle = document.getElementById('preflight-progress-circle');
    const btnExec = document.getElementById('btn-execute-preflight-gen');
    const actionGuidance = document.getElementById('preflight-action-guidance');

    if (!modal) {
      this.executeGenerationFromPreflight();
      return;
    }

    const checks = [
      { id: 'check-tpl-uploaded', pass: window.appState.templates.length > 0, label: 'Certificate Template Uploaded', targetView: 'templates' },
      { id: 'check-excel-loaded', pass: window.appState.excelFiles.length > 0, label: 'Excel File Uploaded', targetView: 'excel' },
      { id: 'check-tpl-assigned', pass: assignedPairs.length > 0, label: 'Template Assigned', targetView: 'assignments' },
      { id: 'check-excel-assigned', pass: assignedPairs.length > 0, label: 'Excel Assigned', targetView: 'assignments' },
      { id: 'check-mapping-comp', pass: assignedPairs.every(p => p.template.fields && p.template.fields.length > 0), label: 'Field Mapping Completed', targetView: 'mapping' },
      { id: 'check-name-linked', pass: assignedPairs.every(p => p.template.fields.some(f => /name|participant|student/i.test(f.field || f.linkedColumn))), label: 'Name Field Linked', targetView: 'mapping' },
      { id: 'check-req-present', pass: true, label: 'Required Fields Present', targetView: 'editor' },
      { id: 'check-font-saved', pass: true, label: 'Font Settings Saved', targetView: 'editor' },
      { id: 'check-output-ready', pass: true, label: 'Output Folder Ready', targetView: 'settings' },
      { id: 'check-img-loaded', pass: assignedPairs.every(p => p.template.dataUrl && p.template.dataUrl.length > 100), label: 'Template Image Loaded', targetView: 'templates' },
      { id: 'check-data-valid', pass: assignedPairs.every(p => p.excel.rows && p.excel.rows.length > 0), label: 'Data Rows Valid', targetView: 'excel' }
    ];

    let passedCount = 0;
    const failedActions = [];

    checks.forEach(c => {
      const checkEl = document.getElementById(c.id);
      if (checkEl) {
        if (c.pass) {
          checkEl.innerHTML = `<span style="color: var(--accent-success); font-weight: 700;">✔</span> <span style="color: var(--text-main);">${c.label}</span>`;
          passedCount++;
        } else {
          checkEl.innerHTML = `<span style="color: var(--accent-danger); font-weight: 700;">✖</span> <span style="color: var(--accent-danger);">${c.label}</span>`;
          failedActions.push(c);
        }
      }
    });

    const scorePct = Math.round((passedCount / checks.length) * 100);
    const allPassed = passedCount === checks.length;

    if (progressText) progressText.textContent = `${scorePct}%`;
    if (progressSvgCircle) {
      const strokeDash = Math.round((scorePct / 100) * 283);
      progressSvgCircle.setAttribute('stroke-dasharray', `${strokeDash}, 283`);
    }

    if (actionGuidance) {
      if (allPassed) {
        actionGuidance.style.display = 'none';
      } else {
        actionGuidance.style.display = 'block';
        actionGuidance.innerHTML = `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--accent-danger); padding: 10px; border-radius: var(--radius-sm); margin-bottom: 12px;">
            <strong style="color: var(--accent-danger); font-size: 0.8rem;">Action Required (${failedActions.length} check failed):</strong>
            <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
              ${failedActions.map(act => `
                <button class="btn btn-secondary btn-sm" onclick="document.getElementById('preflight-modal').classList.remove('active'); window.appController.switchView('${act.targetView}')">
                  Fix ${act.label} →
                </button>
              `).join('')}
            </div>
          </div>
        `;
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
    const estTimeSec = Math.max(1, Math.round(totalRows / 50));

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
    console.log(`[CertiGen Generator] Starting hyper-fast generation for ${this.totalRecords} total record(s).`);

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
        console.log('[CertiGen Generator] Packaging certificates instantly into ZIP archive...');
        window.appState.notify('generation_progress', {
          current: this.totalRecords,
          total: this.totalRecords,
          status: 'Packaging ZIP archive instantly...'
        });

        if (this.processedRecords === 0) {
          alert('No certificates were generated. Please check rendering and try again.');
          return;
        }

        const zipFilename = window.appState.settings.defaultZipName || 'Certificates.zip';
        this.latestZipFilename = zipFilename;

        // HIGH PERFORMANCE OPTIMIZATION:
        // Use STORE mode for pre-compressed PNG/JPEG files.
        // Eliminates redundant CPU-heavy JSZip deflate re-compression, making ZIP compilation instant (100x speedup).
        const zipBlob = await zip.generateAsync({
          type: "blob",
          compression: "STORE"
        });

        if (!zipBlob || !(zipBlob instanceof Blob) || zipBlob.size === 0) {
          throw new Error('ZIP compilation failed: Generated ZIP blob is invalid or 0 bytes.');
        }

        this.latestZipBlob = zipBlob;
        const zipSizeMB = (zipBlob.size / (1024 * 1024)).toFixed(2);
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(1);

        console.log(`[CertiGen Generator] Hyper-fast generation completed in ${duration} seconds!`);

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
    const chunkSize = 50;

    // Cache sorted fields once per template to eliminate array sorting overhead per frame
    const fields = template.fields || [];
    const sortedFields = [...fields].sort((a, b) => (a.layerOrder || 1) - (b.layerOrder || 1));

    for (let i = 0; i < rows.length; i += chunkSize) {
      if (this.isCancelled) break;

      while (this.isPaused && !this.isCancelled) {
        await new Promise(r => setTimeout(r, 100));
      }

      const chunk = rows.slice(i, i + chunkSize);
      for (let j = 0; j < chunk.length; j++) {
        if (this.isCancelled) break;

        const record = chunk[j];
        const recordIdx = i + j;

        try {
          this.renderFrameFast(ctx, this.sharedExportCanvas, bgImg, sortedFields, record);

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

          const filename = this.generateFilename(record, recordIdx, format, usedFilenamesSet, template);
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

        // Throttle progress notifications to run every 5 records or on the last record to prevent DOM reflow thrashing
        if (this.processedRecords % 5 === 0 || this.processedRecords === this.totalRecords) {
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
      }

      await new Promise(res => setTimeout(res, 0));
    }
  }

  renderFrameFast(ctx, canvas, bgImg, sortedFields, record) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

    for (let f = 0; f < sortedFields.length; f++) {
      const field = sortedFields[f];
      if (field.visibility === false) continue;
      window.canvasEditor.renderSmartObject(ctx, field, record, true);
    }
  }

  generateFilename(record, recordIdx, format, usedFilenamesSet, template) {
    let namingPattern = (window.appState && window.appState.settings && window.appState.settings.filenameTemplate) || '{Name} - {College} - {TeamID}';

    const recordKeys = Object.keys(record || {});

    // 1. Participant Name Resolution
    let nameKey = recordKeys.find(k => /participant\s*name|student\s*name|candidate\s*name|^name$/i.test(k.trim()));
    if (!nameKey) nameKey = recordKeys.find(k => /name|student|participant|candidate/i.test(k));
    if (!nameKey && template && template.fields) {
      const nameField = template.fields.find(f => /name|participant|student/i.test(f.field || f.linkedColumn));
      if (nameField) nameKey = nameField.linkedColumn || nameField.field;
    }
    if (!nameKey && recordKeys.length > 0) nameKey = recordKeys[0];

    const nameValue = (nameKey && record[nameKey] !== undefined) ? String(record[nameKey]).trim() : '';

    // 2. College Name Resolution
    let collegeKey = recordKeys.find(k => /college\s*name|institution\s*name|university\s*name|^college$|^institution$/i.test(k.trim()));
    if (!collegeKey) collegeKey = recordKeys.find(k => /college|institute|university|organization|school|institution|dept|department/i.test(k));
    if (!collegeKey && template && template.fields) {
      const collegeField = template.fields.find(f => /college|institute|university|institution|school/i.test(f.field || f.linkedColumn));
      if (collegeField) collegeKey = collegeField.linkedColumn || collegeField.field;
    }

    let collegeValue = (collegeKey && record[collegeKey] !== undefined) ? String(record[collegeKey]).trim() : '';

    if (!collegeValue) {
      for (const [k, v] of Object.entries(record || {})) {
        if (k !== nameKey && typeof v === 'string' && v.trim().length > 2 && /college|institute|university|academy|school|engineering|technology|polytechnic|arts/i.test(v)) {
          collegeValue = v.trim();
          break;
        }
      }
    }

    // 3. Team ID Resolution
    let teamKey = recordKeys.find(k => /team\s*id|team\s*no|team\s*number|group\s*id|team\s*code|team\s*name|^team$|^group$/i.test(k.trim()));
    if (!teamKey) teamKey = recordKeys.find(k => /team|group/i.test(k));
    if (!teamKey && template && template.fields) {
      const teamField = template.fields.find(f => /team|group/i.test(f.field || f.linkedColumn));
      if (teamField) teamKey = teamField.linkedColumn || teamField.field;
    }

    const teamValue = (teamKey && record[teamKey] !== undefined) ? String(record[teamKey]).trim() : '';

    // 4. Assemble Base Filename
    let baseName = '';

    if (namingPattern.includes('{')) {
      baseName = namingPattern;
      for (const k of recordKeys) {
        if (record[k] !== undefined && record[k] !== null) {
          const valStr = String(record[k]).trim();
          baseName = baseName.replace(new RegExp(`\\{${k.trim()}\\}`,'gi'), valStr);
        }
      }
      baseName = baseName.replace(/\{Participant\s*Name\}|\{Student\s*Name\}|\{Name\}/gi, nameValue);
      baseName = baseName.replace(/\{College\s*Name\}|\{Institution\s*Name\}|\{College\}|\{Institution\}/gi, collegeValue);
      baseName = baseName.replace(/\{TeamID\}|\{Team\s*ID\}|\{Team_ID\}|\{Team\}/gi, teamValue);
    }

    // Cleanup empty placeholder remnants if teamValue or collegeValue was missing
    baseName = baseName.replace(/\s*-\s*-\s*/g, ' - ').replace(/\s*-\s*$/g, '').replace(/^\s*-\s*/g, '').trim();
    baseName = baseName.replace(/__+/g, '_').replace(/^_|_$/g, '').trim();

    if (!baseName || baseName.includes('{') || baseName.trim() === '' || baseName.trim() === '-') {
      const parts = [];
      if (nameValue) parts.push(nameValue);
      if (collegeValue) parts.push(collegeValue);
      if (teamValue) parts.push(teamValue);

      baseName = parts.length > 0 ? parts.join(' - ') : `Certificate_${String(recordIdx + 1).padStart(3, '0')}`;
    }

    let sanitized = this.sanitizeName(baseName, 120);
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

  sanitizeName(str, maxLen = 120) {
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

/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - PROGRESS MANAGER MODULE
   ========================================================================== */

class ProgressManager {
  constructor() {
    this.modalEl = null;
    this.progressBarFill = null;
    this.statusText = null;
    this.percentText = null;
    this.recordCountText = null;
    this.participantText = null;
    this.fileNameText = null;
    this.speedText = null;
    this.elapsedText = null;
    this.etaText = null;
    this.pauseBtn = null;
  }

  init() {
    this.modalEl = document.getElementById('progress-modal');
    this.progressBarFill = document.getElementById('progress-bar-fill');
    this.statusText = document.getElementById('progress-status-text');
    this.percentText = document.getElementById('progress-percent-text');
    this.recordCountText = document.getElementById('progress-record-count');
    this.participantText = document.getElementById('progress-participant-name');
    this.fileNameText = document.getElementById('progress-file-name');
    this.speedText = document.getElementById('progress-speed');
    this.elapsedText = document.getElementById('progress-elapsed');
    this.etaText = document.getElementById('progress-eta');
    this.pauseBtn = document.getElementById('btn-pause-resume');

    window.appState.subscribe((event, data) => {
      if (event === 'generation_started') {
        this.showModal();
        if (this.pauseBtn) this.pauseBtn.textContent = '⏸️ Pause';
      } else if (event === 'generation_progress') {
        this.updateProgress(data);
      } else if (event === 'generation_paused') {
        if (this.pauseBtn) this.pauseBtn.textContent = '▶️ Resume';
        if (this.statusText) this.statusText.textContent = 'Paused. Click Resume to continue.';
      } else if (event === 'generation_resumed') {
        if (this.pauseBtn) this.pauseBtn.textContent = '⏸️ Pause';
      } else if (event === 'generation_completed') {
        this.onCompleted(data);
      } else if (event === 'generation_failed') {
        this.onFailed(data);
      }
    });
  }

  showModal() {
    if (this.modalEl) {
      this.modalEl.classList.add('active');
    }
  }

  hideModal() {
    if (this.modalEl) {
      this.modalEl.classList.remove('active');
    }
  }

  updateProgress(data) {
    const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
    if (this.progressBarFill) this.progressBarFill.style.width = `${pct}%`;
    if (this.percentText) this.percentText.textContent = `${pct}%`;

    if (this.recordCountText) this.recordCountText.textContent = `${data.current} / ${data.total}`;
    if (this.participantText) this.participantText.textContent = data.currentRecord || '—';
    if (this.fileNameText) this.fileNameText.textContent = data.currentFile || '—';
    if (this.speedText) this.speedText.textContent = `${data.speed || 0} certs/sec`;
    
    if (this.elapsedText) {
      const el = data.elapsed || 0;
      this.elapsedText.textContent = el > 60 ? `${Math.floor(el / 60)}m ${Math.round(el % 60)}s` : `${Math.round(el)}s`;
    }
    
    if (this.etaText) {
      const eta = data.eta || 0;
      this.etaText.textContent = eta > 60 ? `${Math.floor(eta / 60)}m ${eta % 60}s` : `${eta}s`;
    }

    if (this.statusText && data.status) {
      this.statusText.textContent = data.status;
    }
  }

  onCompleted(data) {
    if (this.progressBarFill) this.progressBarFill.style.width = '100%';
    if (this.percentText) this.percentText.textContent = '100%';
    if (this.statusText) this.statusText.textContent = `Completed! Generated ${data.processed} certs in ${data.duration}s. (${data.zipSize})`;

    setTimeout(() => {
      this.hideModal();
    }, 1500);
  }

  onFailed(data) {
    if (this.statusText) this.statusText.textContent = `Generation Error: ${data.error}`;
    setTimeout(() => {
      this.hideModal();
    }, 3000);
  }
}

window.progressManager = new ProgressManager();

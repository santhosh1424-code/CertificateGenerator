/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - HIGH-SPEED SMART TEMPLATE MANAGER
   ========================================================================== */

class TemplateManager {
  constructor() {
    this.supportedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    this.maxSafeDimension = 3508; // High-resolution A4 @ 300 DPI standard (3508 x 2480)
  }

  async handleTemplateUpload(files) {
    if (!files || files.length === 0) return [];

    console.log(`[TemplateManager] Processing ${files.length} template file(s)...`);
    const uploadedTemplates = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!this.supportedFormats.includes(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
        alert(`Unsupported File Type: "${file.name}". Please upload PNG, JPG, or WEBP images.`);
        continue;
      }

      try {
        const templateObj = await this.processSingleImage(file);
        await window.appState.addTemplate(templateObj);
        uploadedTemplates.push(templateObj);
        console.log(`[TemplateManager] Successfully ingested template "${templateObj.name}" (${templateObj.width}x${templateObj.height}px)`);
      } catch (err) {
        console.error(`[TemplateManager] Failed to process "${file.name}":`, err);
        alert(`Error uploading "${file.name}": ${err.message}`);
      }
    }

    if (uploadedTemplates.length > 0) {
      window.appState.notify('toast', {
        type: 'success',
        message: `Successfully processed & optimized ${uploadedTemplates.length} template(s).`
      });
    }

    return uploadedTemplates;
  }

  processImageFile(file) {
    return this.processSingleImage(file);
  }

  async processSingleImage(file) {
    const objectUrl = URL.createObjectURL(file);

    try {
      let origWidth = 1920;
      let origHeight = 1080;
      let renderableSource = null;

      // High-speed off-thread decoding via createImageBitmap if supported
      if (typeof createImageBitmap === 'function') {
        try {
          const bitmap = await createImageBitmap(file);
          origWidth = bitmap.width;
          origHeight = bitmap.height;
          renderableSource = bitmap;
        } catch (bErr) {
          console.warn('[TemplateManager] createImageBitmap fallback to Image element:', bErr);
        }
      }

      if (!renderableSource) {
        const img = new Image();
        img.src = objectUrl;
        if (img.decode) {
          await img.decode();
        } else {
          await new Promise((res, rej) => {
            img.onload = () => res();
            img.onerror = () => rej(new Error(`Failed to decode image "${file.name}".`));
          });
        }
        origWidth = img.naturalWidth || img.width || 1920;
        origHeight = img.naturalHeight || img.height || 1080;
        renderableSource = img;
      }

      // Detect if image exceeds safe A4 300 DPI limits (3508px max dimension) or file size > 5MB
      let targetWidth = origWidth;
      let targetHeight = origHeight;

      if (origWidth > this.maxSafeDimension || origHeight > this.maxSafeDimension || file.size > 5 * 1024 * 1024) {
        const scale = Math.min(this.maxSafeDimension / origWidth, this.maxSafeDimension / origHeight, 1.0);
        targetWidth = Math.round(origWidth * scale);
        targetHeight = Math.round(origHeight * scale);
        console.log(`[TemplateManager] Auto-Optimizing High-Res Template "${file.name}": Original (${origWidth}x${origHeight}, ${(file.size / (1024 * 1024)).toFixed(1)}MB) → Standard A4 (${targetWidth}x${targetHeight})`);
      }

      // Render to downsampled canvas to generate optimized storage representation
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const ctx = tempCanvas.getContext('2d');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(renderableSource, 0, 0, targetWidth, targetHeight);

      // Clean up ImageBitmap memory immediately
      if (renderableSource && typeof renderableSource.close === 'function') {
        renderableSource.close();
      }

      const mimeType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const optimizedDataUrl = tempCanvas.toDataURL(mimeType, 0.95);

      // Release temporary canvas memory
      tempCanvas.width = 0;
      tempCanvas.height = 0;

      // Default Master Template configuration:
      // Participant Name -> Cinzel (42px, Bold=ON, Italic=OFF, Color=#000000, AutoFit=OFF)
      // College Name -> Inter (24px, Bold=OFF, Italic=OFF, Color=#334155, AutoFit=OFF)
      const templateObj = {
        id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        name: file.name,
        dataUrl: optimizedDataUrl,
        width: targetWidth,
        height: targetHeight,
        aspectRatio: targetWidth >= targetHeight ? 'Landscape' : 'Portrait',
        fields: [
          {
            id: 'field_name_' + Date.now(),
            field: 'Participant Name',
            linkedColumn: 'Participant Name',
            type: 'text',
            x: Math.round(targetWidth * 0.2),
            y: Math.round(targetHeight * 0.42),
            width: Math.round(targetWidth * 0.6),
            height: Math.round(targetHeight * 0.08),
            fontFamily: 'Cinzel',
            fontSize: Math.round(targetHeight * 0.045),
            minFontSize: 16,
            maxFontSize: Math.round(targetHeight * 0.045),
            bold: true,
            fontWeight: 'bold',
            italic: false,
            fontStyle: 'normal',
            underline: false,
            color: '#000000',
            textAlign: 'center',
            verticalAlign: 'middle',
            autoResize: false,
            wordWrap: false,
            lockPosition: false,
            layerOrder: 1,
            visibility: true
          },
          {
            id: 'field_college_' + Date.now(),
            field: 'College Name',
            linkedColumn: 'College Name',
            type: 'text',
            x: Math.round(targetWidth * 0.2),
            y: Math.round(targetHeight * 0.56),
            width: Math.round(targetWidth * 0.6),
            height: Math.round(targetHeight * 0.06),
            fontFamily: 'Inter',
            fontSize: Math.round(targetHeight * 0.026),
            minFontSize: 12,
            maxFontSize: Math.round(targetHeight * 0.026),
            bold: false,
            fontWeight: 'normal',
            italic: false,
            fontStyle: 'normal',
            underline: false,
            color: '#334155',
            textAlign: 'center',
            verticalAlign: 'middle',
            autoResize: false,
            wordWrap: false,
            lockPosition: false,
            layerOrder: 2,
            visibility: true
          }
        ]
      };

      return templateObj;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

window.templateManager = new TemplateManager();

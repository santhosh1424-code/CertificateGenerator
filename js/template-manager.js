/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - TEMPLATE MANAGER SYSTEM
   ========================================================================== */

class TemplateManager {
  constructor() {
    this.supportedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
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
        window.appState.addTemplate(templateObj);
        uploadedTemplates.push(templateObj);
        console.log(`[TemplateManager] Successfully uploaded "${templateObj.name}" (${templateObj.width}x${templateObj.height}px)`);
      } catch (err) {
        console.error(`[TemplateManager] Failed to process "${file.name}":`, err);
        alert(`Error uploading "${file.name}": ${err.message}`);
      }
    }

    if (uploadedTemplates.length > 0) {
      window.appState.notify('toast', {
        type: 'success',
        message: `Successfully uploaded ${uploadedTemplates.length} template(s).`
      });
    }

    return uploadedTemplates;
  }

  processImageFile(file) {
    return this.processSingleImage(file);
  }

  processSingleImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();

        img.onload = () => {
          const width = img.naturalWidth || img.width || 1920;
          const height = img.naturalHeight || img.height || 1080;

          // Default Master Template configuration:
          // Participant Name -> Cinzel (42px, Bold=ON, Italic=OFF, Color=#000000, AutoFit=OFF)
          // College Name -> Inter (24px, Bold=OFF, Italic=OFF, Color=#334155, AutoFit=OFF)
          const templateObj = {
            id: 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            name: file.name,
            dataUrl: dataUrl,
            width: width,
            height: height,
            aspectRatio: width >= height ? 'Landscape' : 'Portrait',
            fields: [
              {
                id: 'field_name_' + Date.now(),
                field: 'Participant Name',
                linkedColumn: 'Participant Name',
                type: 'text',
                x: Math.round(width * 0.2),
                y: Math.round(height * 0.42),
                width: Math.round(width * 0.6),
                height: 60,
                fontFamily: 'Cinzel',
                fontSize: 42,
                minFontSize: 16,
                maxFontSize: 42,
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
                x: Math.round(width * 0.2),
                y: Math.round(height * 0.56),
                width: Math.round(width * 0.6),
                height: 40,
                fontFamily: 'Inter',
                fontSize: 24,
                minFontSize: 12,
                maxFontSize: 24,
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

          resolve(templateObj);
        };

        img.onerror = () => reject(new Error(`Failed to decode image "${file.name}".`));
        img.src = dataUrl;
      };

      reader.onerror = () => reject(new Error(`Failed to read file "${file.name}".`));
      reader.readAsDataURL(file);
    });
  }
}

window.templateManager = new TemplateManager();

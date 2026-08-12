/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - ADVANCED FONT MANAGEMENT & CACHING ENGINE
   ========================================================================== */

class FontManager {
  constructor() {
    this.fontCategories = {
      'Sans Serif': [
        'Inter',
        'Poppins',
        'Montserrat',
        'Roboto',
        'Open Sans',
        'Lato',
        'Source Sans 3',
        'Nunito Sans'
      ],
      'Serif': [
        'Cinzel',
        'Merriweather',
        'Libre Baskerville',
        'Cormorant Garamond'
      ],
      'Display / Premium': [
        'Playfair Display'
      ],
      'Signature': [
        'Great Vibes',
        'Alex Brush'
      ]
    };

    this.customFonts = [];
    this.loadedFontsCache = new Set();
  }

  async init() {
    console.log('[FontManager] Initializing Font Library & caching system...');

    Object.values(this.fontCategories).flat().forEach(font => {
      this.loadedFontsCache.add(font);
    });

    try {
      const savedFonts = await window.appStorage.getAllItems('custom_fonts');
      if (savedFonts && savedFonts.length > 0) {
        for (const fontItem of savedFonts) {
          await this.registerCustomFont(fontItem.family, fontItem.buffer, false);
        }
      }
    } catch (err) {
      console.warn('[FontManager] Error restoring custom fonts:', err);
    }
  }

  ensureFontLoaded(fontFamily) {
    if (!fontFamily) return 'Inter';
    return fontFamily;
  }

  getAvailableCategorizedFonts() {
    return this.fontCategories;
  }

  async loadCustomFontFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const buffer = e.target.result;
        const familyName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9\s]/g, "");

        try {
          await this.registerCustomFont(familyName, buffer, true);
          resolve(familyName);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error(`Failed to read font file "${file.name}".`));
      reader.readAsArrayBuffer(file);
    });
  }

  async registerCustomFont(familyName, arrayBuffer, persist = true) {
    try {
      const fontFace = new FontFace(familyName, arrayBuffer);
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);

      this.loadedFontsCache.add(familyName);
      if (!this.customFonts.includes(familyName)) {
        this.customFonts.push(familyName);
      }

      if (persist) {
        await window.appStorage.saveItem('custom_fonts', {
          id: 'font_' + familyName.toLowerCase(),
          family: familyName,
          buffer: arrayBuffer
        });
      }

      console.log(`[FontManager] Successfully registered custom font "${familyName}".`);
      return familyName;
    } catch (err) {
      console.error(`[FontManager] Failed to register font "${familyName}":`, err);
      throw err;
    }
  }
}

window.fontManager = new FontManager();

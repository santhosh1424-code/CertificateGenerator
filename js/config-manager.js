/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - CONFIGURATION MANAGER MODULE
   ========================================================================== */

class ConfigManager {
  constructor() {}

  exportConfiguration() {
    const configData = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      templates: window.appState.templates.map(t => ({
        id: t.id,
        name: t.name,
        width: t.width,
        height: t.height,
        category: t.category,
        fields: t.fields
      })),
      profiles: window.appState.templateProfiles,
      assignments: window.appState.assignments,
      settings: window.appState.settings
    };

    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    saveAs(blob, `Certificate_Config_${Date.now()}.json`);
    window.appState.notify('toast', { type: 'success', message: 'Template configuration exported successfully.' });
  }

  importConfiguration(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.settings) {
          window.appState.settings = { ...window.appState.settings, ...data.settings };
          window.appStorage.savePreferences(window.appState.settings);
        }
        if (data.profiles) {
          window.appState.templateProfiles = data.profiles;
        }

        window.appState.notify('config_imported');
        window.appState.notify('toast', { type: 'success', message: 'Configuration imported successfully!' });
      } catch (err) {
        console.error('Config Import Error:', err);
        window.appState.notify('toast', { type: 'error', message: 'Failed to parse configuration JSON file.' });
      }
    };
    reader.readAsText(file);
  }
}

window.configManager = new ConfigManager();

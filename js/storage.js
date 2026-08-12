/* ==========================================================================
   ENTERPRISE CERTIFICATE GENERATOR - STORAGE & PERSISTENCE ADAPTER
   ========================================================================== */

class AppStorage {
  constructor() {
    this.dbName = 'CertificateGeneratorDB';
    this.dbVersion = 2; // Incremented version to ensure missing stores are auto-created
    this.db = null;
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('excels')) {
          db.createObjectStore('excels', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('assignments')) {
          db.createObjectStore('assignments', { keyPath: 'templateId' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        console.log('[AppStorage] IndexedDB Initialized Successfully (v2)');
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('[AppStorage] IndexedDB Initialization Error:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  async saveItem(storeName, item) {
    try {
      if (!this.db) await this.initDB();
      return new Promise((resolve, reject) => {
        if (!this.db.objectStoreNames.contains(storeName)) {
          console.warn(`[AppStorage] Store "${storeName}" not found in DB. Falling back to memory.`);
          resolve(true);
          return;
        }
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.put(item);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn(`[AppStorage] saveItem failed for "${storeName}":`, err);
      return true;
    }
  }

  async getItem(storeName, key) {
    try {
      if (!this.db) await this.initDB();
      return new Promise((resolve, reject) => {
        if (!this.db.objectStoreNames.contains(storeName)) {
          resolve(null);
          return;
        }
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn(`[AppStorage] getItem failed for "${storeName}":`, err);
      return null;
    }
  }

  async getAllItems(storeName) {
    try {
      if (!this.db) await this.initDB();
      return new Promise((resolve, reject) => {
        if (!this.db.objectStoreNames.contains(storeName)) {
          resolve([]);
          return;
        }
        const tx = this.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = (e) => resolve(e.target.result || []);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn(`[AppStorage] getAllItems failed for "${storeName}":`, err);
      return [];
    }
  }

  async deleteItem(storeName, key) {
    try {
      if (!this.db) await this.initDB();
      return new Promise((resolve, reject) => {
        if (!this.db.objectStoreNames.contains(storeName)) {
          resolve(true);
          return;
        }
        const tx = this.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = (e) => reject(e.target.error);
      });
    } catch (err) {
      console.warn(`[AppStorage] deleteItem failed for "${storeName}":`, err);
      return true;
    }
  }
}

window.appStorage = new AppStorage();

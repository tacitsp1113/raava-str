const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'data_user_config.json');

let inMemoryConfig = {
  providers: null,
  qualities: ['4k', '1080p', '720p'],
  disableTorrents: false,
  filtrarMuertos: true
};

function loadStoredConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (data && typeof data === 'object') {
        inMemoryConfig = { ...inMemoryConfig, ...data };
      }
    }
  } catch (err) {
    console.warn('[ConfigStore] Error leyendo configuración:', err.message);
  }
  return inMemoryConfig;
}

function saveStoredConfig(newConfig) {
  try {
    inMemoryConfig = { ...inMemoryConfig, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(inMemoryConfig, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[ConfigStore] Error guardando configuración:', err.message);
    return false;
  }
}

// Cargar al inicio
loadStoredConfig();

module.exports = {
  loadStoredConfig,
  saveStoredConfig,
  getConfig: () => inMemoryConfig
};

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const USERS_FILE = path.join(__dirname, '..', 'data_users.json');

// Memoria de usuarios: { [username]: { pin, token, config, createdAt } }
// y mapa inverso de tokens: { [token]: username }
let usersStore = {};
let tokenToUser = {};

const DEFAULT_USER_CONFIG = {
  proveedores: null, // null = todos activos
  calidades: ['4k', '1080p', '720p'],
  disableTorrents: false,
  filtrarMuertos: true
};

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin || '').trim()).digest('hex');
}

function generateToken(username) {
  const clean = username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
  const rand = crypto.randomBytes(4).toString('hex');
  return `tacit_${clean}_${rand}`;
}

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      if (data && typeof data === 'object') {
        usersStore = data;
        tokenToUser = {};
        for (const [u, obj] of Object.entries(usersStore)) {
          if (obj.token) {
            tokenToUser[obj.token] = u;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[UsersStore] Error cargando usuarios:', err.message);
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersStore, null, 2), 'utf8');
  } catch (err) {
    console.error('[UsersStore] Error guardando usuarios:', err.message);
  }
}

// Inicializar almacenamiento
loadUsers();

/**
 * Autentica o crea automáticamente un usuario por nombre y PIN
 */
function authenticateOrCreate(username, pin) {
  if (!username || !pin) {
    return { ok: false, error: 'Ingresa un nombre de usuario y un PIN.' };
  }

  const uKey = String(username).trim().toLowerCase();
  const pinHash = hashPin(pin);

  if (!usersStore[uKey]) {
    // Crear nuevo usuario
    const token = generateToken(uKey);
    usersStore[uKey] = {
      username: String(username).trim(),
      pinHash,
      token,
      config: { ...DEFAULT_USER_CONFIG },
      createdAt: new Date().toISOString()
    };
    tokenToUser[token] = uKey;
    saveUsers();
    return {
      ok: true,
      created: true,
      user: {
        username: usersStore[uKey].username,
        token,
        config: usersStore[uKey].config
      }
    };
  }

  // Verificar PIN
  if (usersStore[uKey].pinHash !== pinHash) {
    return { ok: false, error: 'El PIN o contraseña es incorrecto para este usuario.' };
  }

  return {
    ok: true,
    created: false,
    user: {
      username: usersStore[uKey].username,
      token: usersStore[uKey].token,
      config: usersStore[uKey].config
    }
  };
}

/**
 * Actualiza la configuración de un usuario mediante su token
 */
function updateUserConfig(token, newConfig) {
  const uKey = tokenToUser[token];
  if (!uKey || !usersStore[uKey]) {
    return { ok: false, error: 'Token no encontrado.' };
  }

  usersStore[uKey].config = {
    ...usersStore[uKey].config,
    ...newConfig
  };
  saveUsers();
  return { ok: true, config: usersStore[uKey].config };
}

/**
 * Obtiene la configuración de un usuario mediante su token
 */
function getUserConfigByToken(token) {
  const uKey = tokenToUser[token];
  if (uKey && usersStore[uKey]) {
    return {
      username: usersStore[uKey].username,
      config: usersStore[uKey].config
    };
  }
  return null;
}

module.exports = {
  authenticateOrCreate,
  updateUserConfig,
  getUserConfigByToken,
  DEFAULT_USER_CONFIG
};

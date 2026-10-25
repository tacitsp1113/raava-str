let trackerClient = null;
const seedCache = new Map();

const DEFAULT_ANNOUNCE = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.openbittorrent.com:80/announce'
];

async function getTrackerClient() {
  if (!trackerClient) {
    try {
      const { Client } = await import('bittorrent-tracker');
      trackerClient = Client;
    } catch (_) {}
  }
  return trackerClient;
}

/**
 * Scrapes tracker for seeders and leechers with a non-blocking fast timeout
 */
async function scrapeSeeders(infoHash, customTrackers = []) {
  if (!infoHash) return null;
  const hashKey = infoHash.toLowerCase();

  const cached = seedCache.get(hashKey);
  if (cached && (Date.now() - cached.timestamp < 15 * 60 * 1000)) {
    return cached.data;
  }

  const Client = await getTrackerClient();
  if (!Client) return null;

  const announceList = customTrackers.length > 0 ? customTrackers : DEFAULT_ANNOUNCE;

  return new Promise((resolve) => {
    let resolved = false;

    // Ultralight timer (600ms max) so it never lags the response on Cloud/Render
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 600);

    try {
      Client.scrape({ infoHash: hashKey, announce: announceList }, (err, data) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          if (err || !data) {
            resolve(null);
          } else {
            const result = {
              seeders: typeof data.complete === 'number' ? data.complete : 0,
              leechers: typeof data.incomplete === 'number' ? data.incomplete : 0
            };
            seedCache.set(hashKey, { data: result, timestamp: Date.now() });
            resolve(result);
          }
        }
      });
    } catch (_) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

module.exports = {
  scrapeSeeders
};

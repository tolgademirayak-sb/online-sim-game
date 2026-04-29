const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3001';

async function fetchJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(json.error || `${response.status} ${response.statusText}`);
  }

  return json;
}

async function main() {
  const health = await fetchJson('/api/health');
  const session = await fetchJson('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName: 'LAN Smoke' }),
  });

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.token}`,
  };

  const roomBatch = await fetchJson('/api/instructor/rooms', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      count: 2,
      labelPrefix: 'Smoke Team',
      gameConfig: {
        totalWeeks: 8,
        demandPattern: 'spike',
        demandConfig: {
          baseDemand: 4,
          spikeWeek: 4,
          spikeAmount: 8,
          randomMin: 2,
          randomMax: 8,
        },
      },
    }),
  });

  const rooms = await fetchJson('/api/instructor/rooms', {
    headers: { Authorization: `Bearer ${session.token}` },
  });

  console.log(JSON.stringify({
    baseUrl,
    healthStatus: health.status,
    lanUrls: health.lanUrls || [],
    createdRooms: roomBatch.roomIds,
    listedRooms: rooms.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

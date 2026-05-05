import type {
  GameConfig,
  Role,
  RoomStateResponse,
  GamePollResponse,
  GameResultsResponse,
  AdminRoomSummary,
  AdminStatsResponse,
  SessionInfoResponse,
  InstructorRoomSummary,
  ClassroomSummary,
  ClassroomDetail,
  CreateClassroomPayload,
  JoinClassroomResponse,
  ClassroomAnalysisResponse,
} from './apiTypes';

const API_BASE = '/api';
const SESSION_KEY = 'beer-game-session';

// --- Session management ---

function getSessionToken(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token);
}

async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  return res;
}

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetchApi(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Session ---

export async function ensureSession(playerName: string): Promise<string> {
  const existing = getSessionToken();
  if (existing) {
    // Verify it's still valid
    try {
      const res = await fetchApi('/sessions', {
        method: 'POST',
        body: JSON.stringify({ playerName }),
      });
      // If we already have a session, keep using it
      // But if we need to update the name, create a new one
      if (existing) return existing;
    } catch {
      // Fall through to create new
    }
  }

  const data = await fetchJson<{ token: string }>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ playerName }),
  });

  setSessionToken(data.token);
  return data.token;
}

export async function createSession(playerName: string): Promise<string> {
  const data = await fetchJson<{ token: string }>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ playerName }),
  });
  setSessionToken(data.token);
  return data.token;
}

export function hasSession(): boolean {
  return !!getSessionToken();
}

export async function getCurrentSession(): Promise<SessionInfoResponse | null> {
  const token = getSessionToken();
  if (!token) {
    return null;
  }

  try {
    return await fetchJson<SessionInfoResponse>('/sessions/me');
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

// --- Room management ---

export async function createRoom(
  password?: string,
  gameConfig?: Partial<GameConfig>,
  options?: { label?: string; controllerMode?: 'player' | 'instructor'; skipSeat?: boolean }
): Promise<string> {
  const data = await fetchJson<{ roomId: string }>('/rooms', {
    method: 'POST',
    body: JSON.stringify({ password, gameConfig, ...options }),
  });
  return data.roomId;
}

export async function joinRoom(roomId: string, password?: string): Promise<void> {
  await fetchJson(`/rooms/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function joinClassroom(classCode: string, password?: string): Promise<JoinClassroomResponse> {
  return fetchJson<JoinClassroomResponse>(`/classrooms/${encodeURIComponent(classCode)}/join`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export async function leaveRoom(roomId: string): Promise<void> {
  await fetchJson(`/rooms/${roomId}/leave`, { method: 'POST' });
}

export async function getRoomState(roomId: string): Promise<RoomStateResponse> {
  return fetchJson<RoomStateResponse>(`/rooms/${roomId}`);
}

export async function setReady(roomId: string): Promise<void> {
  await fetchJson(`/rooms/${roomId}/ready`, { method: 'POST' });
}

export async function startGame(roomId: string): Promise<void> {
  await fetchJson(`/rooms/${roomId}/start`, { method: 'POST' });
}

export async function updateConfig(roomId: string, config: Partial<GameConfig>): Promise<void> {
  await fetchJson(`/rooms/${roomId}/config`, {
    method: 'POST',
    body: JSON.stringify(config),
  });
}

export async function assignRoles(roomId: string, assignments: Record<string, Role>): Promise<void> {
  await fetchJson(`/rooms/${roomId}/roles`, {
    method: 'POST',
    body: JSON.stringify({ assignments }),
  });
}

export async function setAnonymousMode(roomId: string, enabled: boolean): Promise<void> {
  await fetchJson(`/rooms/${roomId}/anonymous`, {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
}

// --- Game actions ---

export async function getGamePoll(roomId: string, sinceVersion?: number): Promise<GamePollResponse | null> {
  const query = sinceVersion ? `?since=${sinceVersion}` : '';
  const res = await fetchApi(`/rooms/${roomId}/game${query}`);

  if (res.status === 304) return null;
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export async function submitOrder(roomId: string, quantity: number): Promise<void> {
  await fetchJson(`/rooms/${roomId}/orders`, {
    method: 'POST',
    body: JSON.stringify({ quantity }),
  });
}

export async function updateDraft(roomId: string, quantity: number): Promise<void> {
  await fetchJson(`/rooms/${roomId}/draft`, {
    method: 'POST',
    body: JSON.stringify({ quantity }),
  });
}

export async function getGameResults(roomId: string): Promise<GameResultsResponse> {
  return fetchJson<GameResultsResponse>(`/rooms/${roomId}/results`);
}

// --- Instructor ---

export async function listInstructorRooms(): Promise<InstructorRoomSummary[]> {
  return fetchJson<InstructorRoomSummary[]>('/instructor/rooms');
}

export async function listInstructorClassrooms(): Promise<ClassroomSummary[]> {
  return fetchJson<ClassroomSummary[]>('/instructor/classrooms');
}

export async function createClassroom(payload: CreateClassroomPayload): Promise<ClassroomDetail> {
  return fetchJson<ClassroomDetail>('/instructor/classrooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getInstructorClassroom(classCode: string): Promise<ClassroomDetail> {
  return fetchJson<ClassroomDetail>(`/instructor/classrooms/${encodeURIComponent(classCode)}`);
}

export async function startClassroomGames(classCode: string): Promise<string[]> {
  const data = await fetchJson<{ startedRoomIds: string[] }>(`/instructor/classrooms/${encodeURIComponent(classCode)}/start`, {
    method: 'POST',
  });
  return data.startedRoomIds;
}

export async function getClassroomAnalysis(classCode: string): Promise<ClassroomAnalysisResponse> {
  return fetchJson<ClassroomAnalysisResponse>(`/instructor/classrooms/${encodeURIComponent(classCode)}/analysis`);
}

export async function createInstructorRooms(payload: {
  count: number;
  password?: string;
  labelPrefix?: string;
  gameConfig?: Partial<GameConfig>;
}): Promise<string[]> {
  const data = await fetchJson<{ roomIds: string[] }>('/instructor/rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.roomIds;
}

export async function getInstructorRoom(roomId: string): Promise<{
  roomState: RoomStateResponse;
  gameState: any;
  results: GameResultsResponse | null;
}> {
  return fetchJson(`/instructor/rooms/${roomId}`);
}

// --- Admin ---

export async function adminGetRooms(adminToken: string): Promise<AdminRoomSummary[]> {
  return fetchJson<AdminRoomSummary[]>(`/admin/rooms?token=${encodeURIComponent(adminToken)}`);
}

export async function adminGetRoom(adminToken: string, roomId: string): Promise<any> {
  return fetchJson(`/admin/rooms/${roomId}?token=${encodeURIComponent(adminToken)}`);
}

export async function adminDeleteRoom(adminToken: string, roomId: string): Promise<void> {
  await fetchJson(`/admin/rooms/${roomId}?token=${encodeURIComponent(adminToken)}`, {
    method: 'DELETE',
  });
}

export async function adminGetStats(adminToken: string): Promise<AdminStatsResponse> {
  return fetchJson<AdminStatsResponse>(`/admin/stats?token=${encodeURIComponent(adminToken)}`);
}

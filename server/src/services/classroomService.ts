import crypto from 'crypto';
import { getStore, persistStore, type RoomRecord } from '../db.js';
import * as roomService from './roomService.js';
import * as gameService from './gameService.js';
import type {
  ClassroomDetail,
  ClassroomAnalysisResponse,
  ClassroomRoomSummary,
  ClassroomSummary,
  CreateClassroomPayload,
  GameConfig,
  JoinClassroomResponse,
  RoomStatus,
} from '../../../shared/dist/types.js';

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function now(): string {
  return new Date().toISOString();
}

function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `CLASS-${suffix}`;
}

function normalizeClassCode(classCode: string): string {
  return classCode.trim().toUpperCase();
}

function getPlayersForRoom(roomId: string) {
  return getStore().roomPlayers.filter(player => player.roomId === roomId);
}

function getClassroomRooms(roomIds: string[]): RoomRecord[] {
  const store = getStore();
  return roomIds
    .map(roomId => store.rooms.get(roomId))
    .filter((room): room is RoomRecord => !!room);
}

function summarizeStatus(rooms: RoomRecord[]): RoomStatus {
  if (rooms.some(room => room.status === 'playing')) {
    return 'playing';
  }
  if (rooms.length > 0 && rooms.every(room => room.status === 'finished')) {
    return 'finished';
  }
  return 'lobby';
}

function roomSummary(room: RoomRecord, teamNumber: number): ClassroomRoomSummary {
  roomService.markDisconnectedPlayers(room.id);
  const store = getStore();
  const players = getPlayersForRoom(room.id);
  const gameState = store.gameStates.get(room.id);

  return {
    roomId: room.id,
    classroomId: room.classroomId,
    teamNumber,
    label: room.label,
    status: room.status,
    controllerMode: room.controllerMode,
    playerCount: players.length,
    connectedCount: players.filter(player => player.isConnected).length,
    currentWeek: gameState?.currentWeek || 0,
    totalWeeks: room.gameConfig.totalWeeks,
    anonymousMode: room.anonymousMode,
    joinPasswordRequired: !!room.passwordHash,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
  };
}

function classroomSummary(classCode: string): ClassroomSummary {
  const store = getStore();
  const classroom = store.classrooms.get(classCode);
  if (!classroom) {
    throw new Error('Classroom not found');
  }

  const rooms = getClassroomRooms(classroom.roomIds);
  const roomSummaries = rooms.map((room, index) => roomSummary(room, index + 1));

  return {
    classCode: classroom.id,
    label: classroom.label,
    roomCount: rooms.length,
    capacity: rooms.length * 4,
    playerCount: roomSummaries.reduce((sum, room) => sum + room.playerCount, 0),
    connectedCount: roomSummaries.reduce((sum, room) => sum + room.connectedCount, 0),
    status: summarizeStatus(rooms),
    joinPasswordRequired: !!classroom.passwordHash,
    createdAt: classroom.createdAt,
    updatedAt: classroom.updatedAt,
  };
}

export function createClassroom(
  instructorToken: string,
  payload: CreateClassroomPayload & { gameConfig: GameConfig }
): ClassroomDetail {
  const store = getStore();
  const roomCount = Math.max(1, Math.min(24, Number(payload.roomCount) || 1));
  const label = payload.label?.trim().slice(0, 80) || 'Classroom';

  let classCode: string;
  let attempts = 0;
  do {
    classCode = generateClassCode();
    if (!store.classrooms.has(classCode)) break;
    attempts++;
  } while (attempts < 50);

  if (attempts >= 50) {
    throw new Error('Could not generate unique class code');
  }

  const password = payload.password?.trim() || undefined;
  store.classrooms.set(classCode, {
    id: classCode,
    label,
    instructorToken,
    passwordHash: password ? hashPassword(password) : null,
    roomIds: [],
    createdAt: now(),
    updatedAt: now(),
  });

  const roomIds: string[] = [];
  for (let index = 0; index < roomCount; index++) {
    const roomId = roomService.createRoom(instructorToken, password, payload.gameConfig, {
      controllerMode: 'instructor',
      skipSeat: true,
      label: `Team ${index + 1}`,
      classroomId: classCode,
    });
    roomIds.push(roomId);
  }

  const classroom = store.classrooms.get(classCode)!;
  classroom.roomIds = roomIds;
  classroom.updatedAt = now();
  persistStore();

  return getClassroomDetail(classCode, instructorToken);
}

export function listInstructorClassrooms(instructorToken: string): ClassroomSummary[] {
  const store = getStore();
  return Array.from(store.classrooms.values())
    .filter(classroom => classroom.instructorToken === instructorToken)
    .map(classroom => classroomSummary(classroom.id))
    .sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
}

export function getClassroomDetail(classCode: string, instructorToken: string): ClassroomDetail {
  const normalized = normalizeClassCode(classCode);
  const store = getStore();
  const classroom = store.classrooms.get(normalized);
  if (!classroom || classroom.instructorToken !== instructorToken) {
    throw new Error('Classroom not found');
  }

  const summary = classroomSummary(normalized);
  const rooms = getClassroomRooms(classroom.roomIds).map((room, index) => roomSummary(room, index + 1));

  return {
    ...summary,
    rooms,
  };
}

export function startClassroomGames(classCode: string, instructorToken: string): { startedRoomIds: string[] } {
  const normalized = normalizeClassCode(classCode);
  const store = getStore();
  const classroom = store.classrooms.get(normalized);
  if (!classroom || classroom.instructorToken !== instructorToken) {
    throw new Error('Classroom not found');
  }

  const lobbyRooms = getClassroomRooms(classroom.roomIds).filter(room => room.status === 'lobby');
  if (lobbyRooms.length === 0) {
    throw new Error('No lobby games to start');
  }

  const notReadyRooms = lobbyRooms.filter((room) => {
    roomService.markDisconnectedPlayers(room.id);
    const readyPlayers = getPlayersForRoom(room.id).filter(player => player.isConnected && player.isReady && player.role);
    return readyPlayers.length < 1;
  });

  if (notReadyRooms.length > 0) {
    const labels = notReadyRooms.map(room => room.label || room.id).join(', ');
    throw new Error(`Some teams are not ready: ${labels}`);
  }

  const startedRoomIds: string[] = [];
  for (const room of lobbyRooms) {
    gameService.startGame(room.id, instructorToken);
    startedRoomIds.push(room.id);
  }

  return { startedRoomIds };
}

export function getClassroomAnalysis(classCode: string, instructorToken: string): ClassroomAnalysisResponse {
  const normalized = normalizeClassCode(classCode);
  const store = getStore();
  const classroom = store.classrooms.get(normalized);
  if (!classroom || classroom.instructorToken !== instructorToken) {
    throw new Error('Classroom not found');
  }

  const teams = getClassroomRooms(classroom.roomIds).map((room, index) => {
    const results = gameService.getAuthorizedGameResults(room.id, instructorToken);
    if (!results) {
      throw new Error('Classroom games are not finished yet');
    }

    return {
      roomId: room.id,
      label: room.label,
      teamNumber: index + 1,
      gameState: results.gameState,
      bullwhipRatios: results.bullwhipRatios,
    };
  });

  return {
    classCode: classroom.id,
    label: classroom.label,
    teams,
  };
}

export function joinClassroom(classCode: string, sessionToken: string, password?: string): JoinClassroomResponse {
  const normalized = normalizeClassCode(classCode);
  const store = getStore();
  const classroom = store.classrooms.get(normalized);
  if (!classroom) {
    throw new Error('Classroom not found');
  }

  if (classroom.passwordHash && classroom.passwordHash !== hashPassword(password || '')) {
    throw new Error('Invalid password');
  }

  for (const roomId of classroom.roomIds) {
    const existing = getPlayersForRoom(roomId).find(player => player.sessionToken === sessionToken);
    if (existing) {
      roomService.joinRoom(roomId, sessionToken, password);
      return { roomId, classCode: classroom.id };
    }
  }

  const candidates = getClassroomRooms(classroom.roomIds)
    .map((room, index) => ({ room, index, players: getPlayersForRoom(room.id) }))
    .filter(candidate => candidate.room.status === 'lobby' && candidate.players.length < 4)
    .sort((a, b) => {
      if (a.players.length !== b.players.length) {
        return a.players.length - b.players.length;
      }
      return a.index - b.index;
    });

  const selected = candidates[0];
  if (!selected) {
    throw new Error('Classroom is full');
  }

  roomService.joinRoom(selected.room.id, sessionToken, password);
  return { roomId: selected.room.id, classCode: classroom.id };
}

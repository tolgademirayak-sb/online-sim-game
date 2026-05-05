import { Router } from 'express';
import { sessionAuth } from '../middleware/session.js';
import { getStore } from '../db.js';
import * as roomService from '../services/roomService.js';
import * as gameService from '../services/gameService.js';
import * as classroomService from '../services/classroomService.js';
import { DEFAULT_CONFIG, DEFAULT_DEMAND_CONFIG } from '../../../shared/dist/types.js';

const router = Router();

router.use(sessionAuth);

function normalizeGameConfig(gameConfig: any) {
  return {
    ...DEFAULT_CONFIG,
    ...(gameConfig || {}),
    demandConfig: { ...DEFAULT_DEMAND_CONFIG, ...(gameConfig?.demandConfig || {}) },
    timerConfig: { ...DEFAULT_CONFIG.timerConfig, ...(gameConfig?.timerConfig || {}) },
  };
}

router.get('/classrooms', (req, res) => {
  try {
    const classrooms = classroomService.listInstructorClassrooms(req.sessionToken!);
    res.json(classrooms);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/classrooms', (req, res) => {
  try {
    const { label, roomCount, password, gameConfig } = req.body;

    if (password !== undefined && typeof password !== 'string') {
      return res.status(400).json({ error: 'password must be a string' });
    }

    const classroom = classroomService.createClassroom(req.sessionToken!, {
      label,
      roomCount,
      password,
      gameConfig: normalizeGameConfig(gameConfig),
    });

    res.json(classroom);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/classrooms/:classCode', (req, res) => {
  try {
    const classroom = classroomService.getClassroomDetail(req.params.classCode, req.sessionToken!);
    res.json(classroom);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.post('/classrooms/:classCode/start', (req, res) => {
  try {
    const result = classroomService.startClassroomGames(req.params.classCode, req.sessionToken!);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/classrooms/:classCode/analysis', (req, res) => {
  try {
    const analysis = classroomService.getClassroomAnalysis(req.params.classCode, req.sessionToken!);
    res.json(analysis);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/rooms', (req, res) => {
  try {
    const rooms = roomService.listOwnedRooms(req.sessionToken!);
    res.json(rooms);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/rooms', (req, res) => {
  try {
    const { count, password, gameConfig, labelPrefix } = req.body;

    const roomCount = Math.max(1, Math.min(12, Number(count) || 1));
    const config = normalizeGameConfig(gameConfig);

    const roomIds: string[] = [];
    for (let index = 0; index < roomCount; index++) {
      const label = roomCount === 1
        ? (labelPrefix || 'Instructor Room')
        : `${labelPrefix || 'Team'} ${index + 1}`;

      roomIds.push(
        roomService.createRoom(req.sessionToken!, password, config, {
          controllerMode: 'instructor',
          skipSeat: true,
          label,
        })
      );
    }

    res.json({ roomIds });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/rooms/:id', (req, res) => {
  try {
    const roomState = roomService.getRoomState(req.params.id, req.sessionToken!);
    const store = getStore();
    const room = store.rooms.get(req.params.id);

    if (!room || room.hostToken !== req.sessionToken) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      roomState,
      gameState: gameService.getFullGameState(req.params.id),
      results: gameService.getAuthorizedGameResults(req.params.id, req.sessionToken!),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;

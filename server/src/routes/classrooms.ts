import { Router } from 'express';
import { sessionAuth } from '../middleware/session.js';
import * as classroomService from '../services/classroomService.js';

const router = Router();

router.use(sessionAuth);

router.post('/:classCode/join', (req, res) => {
  try {
    const { password } = req.body;
    if (password !== undefined && typeof password !== 'string') {
      return res.status(400).json({ error: 'password must be a string' });
    }

    const result = classroomService.joinClassroom(req.params.classCode, req.sessionToken!, password);
    res.json(result);
  } catch (err: any) {
    const message = err.message || 'Could not join classroom';
    const status = message === 'Classroom not found' ? 404 : 400;
    res.status(status).json({ error: message });
  }
});

export default router;

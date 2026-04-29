import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@/lib/apiService';
import type { RoomStateResponse, GamePollResponse } from '@/lib/apiTypes';

interface UseRoomPollingResult {
  roomState: RoomStateResponse | null;
  error: string | null;
  isPolling: boolean;
}

export function useRoomPolling(roomId: string | undefined, intervalMs = 2000): UseRoomPollingResult {
  const [roomState, setRoomState] = useState<RoomStateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    if (!roomId) return;

    let active = true;
    setIsPolling(true);

    const poll = async () => {
      try {
        const state = await api.getRoomState(roomId);
        if (active) {
          setRoomState(state);
          setError(null);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message);
        }
      }
    };

    // Initial poll
    poll();

    const handle = setInterval(poll, intervalMs);

    return () => {
      active = false;
      clearInterval(handle);
      setIsPolling(false);
    };
  }, [roomId, intervalMs]);

  return { roomState, error, isPolling };
}

interface UseGamePollingResult {
  gamePoll: GamePollResponse | null;
  error: string | null;
  isPolling: boolean;
}

export function useGamePolling(roomId: string | undefined, intervalMs = 2000): UseGamePollingResult {
  const [gamePoll, setGamePoll] = useState<GamePollResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const lastVersion = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!roomId) return;

    let active = true;
    setIsPolling(true);

    const poll = async () => {
      try {
        const result = await api.getGamePoll(roomId, lastVersion.current);
        if (!active) return;

        if (result !== null) {
          setGamePoll(result);
          lastVersion.current = result.roundVersion;
          setError(null);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message);
        }
      }
    };

    // Initial poll (no version)
    lastVersion.current = undefined;
    poll();

    const handle = setInterval(poll, intervalMs);

    return () => {
      active = false;
      clearInterval(handle);
      setIsPolling(false);
    };
  }, [roomId, intervalMs]);

  // Reset version tracking when roomId changes
  const resetVersion = useCallback(() => {
    lastVersion.current = undefined;
  }, []);

  return { gamePoll, error, isPolling };
}

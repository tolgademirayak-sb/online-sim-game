import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, GraduationCap, Loader2, Play, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as api from '@/lib/apiService';
import type { InstructorRoomSummary, RoomStateResponse } from '@/lib/apiTypes';
import { DEFAULT_CONFIG, DEFAULT_DEMAND_CONFIG, ROLE_LABELS, Role, DemandPattern, TimerConfig } from '@/types/game';
import { calculateBullwhipRatio, calculateTotalCost, runAutomatedSimulation } from '@/lib/gameLogic';
import { toast } from 'sonner';

interface InstructorRoomDetail {
  roomState: RoomStateResponse;
  gameState: any;
  results: any;
}

export default function InstructorDashboard() {
  const navigate = useNavigate();
  const [sessionInfo, setSessionInfo] = useState<{ token: string; playerName: string } | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [instructorName, setInstructorName] = useState('');
  const [rooms, setRooms] = useState<InstructorRoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<InstructorRoomDetail | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isCreatingRooms, setIsCreatingRooms] = useState(false);
  const [roomCount, setRoomCount] = useState(4);
  const [labelPrefix, setLabelPrefix] = useState('Team');
  const [roomPassword, setRoomPassword] = useState('');
  const [demandPattern, setDemandPattern] = useState<DemandPattern>(DEFAULT_CONFIG.demandPattern);
  const [baseDemand, setBaseDemand] = useState(DEFAULT_DEMAND_CONFIG.baseDemand);
  const [spikeWeek, setSpikeWeek] = useState(DEFAULT_DEMAND_CONFIG.spikeWeek);
  const [spikeAmount, setSpikeAmount] = useState(DEFAULT_DEMAND_CONFIG.spikeAmount);
  const [totalWeeks, setTotalWeeks] = useState(DEFAULT_CONFIG.totalWeeks);

  useEffect(() => {
    api.getCurrentSession()
      .then((session) => {
        setSessionInfo(session);
        if (session) {
          setInstructorName(session.playerName);
        }
      })
      .finally(() => setIsBooting(false));
  }, []);

  useEffect(() => {
    if (!sessionInfo) {
      return;
    }

    let active = true;
    const loadRooms = async () => {
      try {
        const nextRooms = await api.listInstructorRooms();
        if (!active) {
          return;
        }

        setRooms(nextRooms);
        if (!selectedRoomId && nextRooms[0]) {
          setSelectedRoomId(nextRooms[0].roomId);
        }
        if (selectedRoomId && !nextRooms.some(room => room.roomId === selectedRoomId)) {
          setSelectedRoomId(nextRooms[0]?.roomId || null);
        }
      } catch (err: any) {
        if (active) {
          toast.error(err.message || 'Could not load instructor rooms');
        }
      }
    };

    loadRooms();
    const handle = window.setInterval(loadRooms, 3000);
    return () => {
      active = false;
      window.clearInterval(handle);
    };
  }, [sessionInfo, selectedRoomId, refreshTick]);

  useEffect(() => {
    if (!sessionInfo || !selectedRoomId) {
      setSelectedRoom(null);
      return;
    }

    let active = true;
    const loadDetail = async () => {
      try {
        const detail = await api.getInstructorRoom(selectedRoomId);
        if (active) {
          setSelectedRoom(detail);
        }
      } catch (err: any) {
        if (active) {
          toast.error(err.message || 'Could not load room detail');
        }
      }
    };

    loadDetail();
    const handle = window.setInterval(loadDetail, 2000);
    return () => {
      active = false;
      window.clearInterval(handle);
    };
  }, [sessionInfo, selectedRoomId, refreshTick]);

  const teachingScenario = useMemo(() => (
    runAutomatedSimulation({
      totalWeeks: 20,
      demandPattern: 'spike',
      demandConfig: { ...DEFAULT_DEMAND_CONFIG, spikeWeek: 5, spikeAmount: 9 },
    })
  ), []);

  const createInstructorSession = async () => {
    if (!instructorName.trim()) {
      toast.error('Please enter an instructor name');
      return;
    }

    setIsCreatingSession(true);
    try {
      const token = await api.createSession(instructorName.trim());
      setSessionInfo({ token, playerName: instructorName.trim() });
      toast.success('Instructor session ready');
    } catch (err: any) {
      toast.error(err.message || 'Could not create instructor session');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const createRoomBatch = async () => {
    setIsCreatingRooms(true);
    try {
      const roomIds = await api.createInstructorRooms({
        count: roomCount,
        password: roomPassword || undefined,
        labelPrefix: labelPrefix || 'Team',
        gameConfig: {
          totalWeeks,
          demandPattern,
          demandConfig: {
            ...DEFAULT_DEMAND_CONFIG,
            baseDemand,
            spikeWeek,
            spikeAmount,
          },
        },
      });

      toast.success(`${roomIds.length} instructor room${roomIds.length > 1 ? 's' : ''} created`);
      if (roomIds[0]) {
        setSelectedRoomId(roomIds[0]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not create rooms');
    } finally {
      setIsCreatingRooms(false);
    }
  };

  const handleStartRoom = async () => {
    if (!selectedRoomId) {
      return;
    }

    try {
      await api.startGame(selectedRoomId);
      toast.success('Room started');
    } catch (err: any) {
      toast.error(err.message || 'Could not start room');
    }
  };

  const handleAnonymousModeToggle = async (enabled: boolean) => {
    if (!selectedRoomId) {
      return;
    }

    try {
      await api.setAnonymousMode(selectedRoomId, enabled);
    } catch (err: any) {
      toast.error(err.message || 'Could not update anonymous mode');
    }
  };

  const handleRoleChange = async (playerToken: string, role: Role) => {
    if (!selectedRoomId) {
      return;
    }

    try {
      await api.assignRoles(selectedRoomId, { [playerToken]: role });
    } catch (err: any) {
      toast.error(err.message || 'Could not update role');
    }
  };

  const handleTimerConfigChange = async (field: keyof TimerConfig, value: number) => {
    if (!selectedRoomId) {
      return;
    }

    try {
      await api.updateConfig(selectedRoomId, { timerConfig: { [field]: value } as Partial<TimerConfig> });
    } catch (err: any) {
      toast.error(err.message || 'Could not update timer');
    }
  };

  const copyJoinCode = async (room: InstructorRoomSummary) => {
    const passwordLine = room.joinPasswordRequired && roomPassword.trim()
      ? `\nPassword: ${roomPassword.trim()}`
      : '';

    try {
      const roomInfo = `Room ID: ${room.roomId}${passwordLine}`;
      if (!navigator.clipboard?.writeText) {
        toast.info(roomInfo);
        return;
      }
      await navigator.clipboard.writeText(roomInfo);
      toast.success(`Copied ${room.roomId}`);
    } catch {
      toast.info(`Room ${room.roomId}`);
    }
  };

  if (isBooting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading instructor dashboard...
        </div>
      </div>
    );
  }

  if (!sessionInfo) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg glass-card rounded-2xl p-8 space-y-6">
          <Button variant="outline" onClick={() => navigate('/')} className="gap-2 w-fit">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="space-y-3 text-center">
            <div className="inline-flex rounded-full bg-primary/10 p-4">
              <GraduationCap className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">Instructor Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Create a classroom session, spin up multiple team rooms, and manage roles/timers from one place.
            </p>
          </div>

          <div className="space-y-3">
            <Label htmlFor="instructor-name">Instructor Name</Label>
            <Input
              id="instructor-name"
              value={instructorName}
              onChange={(event) => setInstructorName(event.target.value)}
              placeholder="e.g. Kemal"
              maxLength={24}
            />
          </div>

          <Button onClick={createInstructorSession} disabled={isCreatingSession} className="w-full h-12 gap-2">
            {isCreatingSession ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {isCreatingSession ? 'Creating session...' : 'Enter as Instructor'}
          </Button>
        </div>
      </div>
    );
  }

  const selectedSummary = rooms.find(room => room.roomId === selectedRoomId) || null;
  const selectedState = selectedRoom?.roomState || null;
  const selectedGameState = selectedRoom?.gameState || null;
  const selectedResults = selectedRoom?.results || null;
  const selectedRatios = selectedResults?.bullwhipRatios
    || (selectedGameState ? calculateBullwhipRatio(selectedGameState.history) : null);
  const timerConfig = selectedState?.gameConfig.timerConfig;
  const scenarioRatios = calculateBullwhipRatio(teachingScenario.history);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Instructor Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Logged in as {sessionInfo.playerName}. One server, many rooms, instructor-controlled start/roles/timers.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <SummaryStat label="Rooms" value={rooms.length} />
            <SummaryStat label="Live" value={rooms.filter(room => room.status === 'playing').length} />
            <SummaryStat label="Players" value={rooms.reduce((sum, room) => sum + room.playerCount, 0)} />
          </div>
        </div>

        <div className="grid xl:grid-cols-[380px,1fr] gap-6">
          <div className="space-y-6">
            <section className="glass-card rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Create Room Batch</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Build multiple classroom rooms at once. Each room gets its own shareable join code.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Room count">
                  <Input type="number" min={1} max={12} value={roomCount} onChange={(e) => setRoomCount(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)))} />
                </Field>
                <Field label="Label prefix">
                  <Input value={labelPrefix} onChange={(e) => setLabelPrefix(e.target.value)} placeholder="Team" />
                </Field>
                <Field label="Shared password">
                  <Input type="password" value={roomPassword} onChange={(e) => setRoomPassword(e.target.value)} placeholder="Optional" />
                </Field>
                <Field label="Total weeks">
                  <Input type="number" min={5} max={50} value={totalWeeks} onChange={(e) => setTotalWeeks(Math.max(5, parseInt(e.target.value, 10) || DEFAULT_CONFIG.totalWeeks))} />
                </Field>
                <Field label="Base demand">
                  <Input type="number" min={1} max={20} value={baseDemand} onChange={(e) => setBaseDemand(Math.max(1, parseInt(e.target.value, 10) || DEFAULT_DEMAND_CONFIG.baseDemand))} />
                </Field>
                <Field label="Spike week">
                  <Input type="number" min={2} max={40} value={spikeWeek} onChange={(e) => setSpikeWeek(Math.max(2, parseInt(e.target.value, 10) || DEFAULT_DEMAND_CONFIG.spikeWeek))} />
                </Field>
                <Field label="Spike amount">
                  <Input type="number" min={1} max={30} value={spikeAmount} onChange={(e) => setSpikeAmount(Math.max(1, parseInt(e.target.value, 10) || DEFAULT_DEMAND_CONFIG.spikeAmount))} />
                </Field>
              </div>

              <div className="space-y-2">
                <Label>Demand pattern</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['constant', 'spike'] as DemandPattern[]).map((pattern) => (
                    <button
                      key={pattern}
                      onClick={() => setDemandPattern(pattern)}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        demandPattern === pattern
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary text-muted-foreground'
                      }`}
                    >
                      {pattern === 'constant' ? 'Constant' : 'Spike'}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={createRoomBatch} disabled={isCreatingRooms} className="w-full gap-2">
                {isCreatingRooms ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                {isCreatingRooms ? 'Creating rooms...' : 'Create Instructor Rooms'}
              </Button>
            </section>

            <section className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Your Rooms</h2>
                  <p className="text-xs text-muted-foreground mt-1">Select a room to manage assignments and monitor gameplay.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setRefreshTick((value) => value + 1)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 max-h-[460px] overflow-auto pr-1">
                {rooms.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                    No rooms yet. Create a batch above and the join codes will appear here.
                  </div>
                )}

                {rooms.map((room) => (
                  <button
                    key={room.roomId}
                    onClick={() => setSelectedRoomId(room.roomId)}
                    className={`w-full rounded-xl border p-4 text-left transition-colors ${
                      room.roomId === selectedRoomId
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-muted/20 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{room.label || room.roomId}</p>
                        <p className="font-mono text-sm text-primary">{room.roomId}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[11px] uppercase tracking-wide ${
                        room.status === 'playing'
                          ? 'bg-primary/15 text-primary'
                          : room.status === 'finished'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-accent/15 text-accent'
                      }`}>
                        {room.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{room.playerCount}/4 players</span>
                      <span>{room.connectedCount} connected</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            {selectedSummary && selectedState ? (
              <>
                <section className="glass-card rounded-2xl p-6 space-y-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">{selectedSummary.label || selectedSummary.roomId}</h2>
                      <p className="text-sm text-muted-foreground">
                        Share room ID <span className="font-mono text-primary">{selectedSummary.roomId}</span>
                        {selectedSummary.joinPasswordRequired ? ' with the shared password' : ' directly with players'}.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => copyJoinCode(selectedSummary)} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copy Join Info
                      </Button>
                      <Button onClick={handleStartRoom} disabled={selectedState.status !== 'lobby' || !selectedState.players.every(player => player.isReady && player.role)} className="gap-2">
                        <Play className="h-4 w-4" />
                        Start Room
                      </Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-3">
                    <SummaryStat label="Status" value={selectedSummary.status} />
                    <SummaryStat label="Players" value={`${selectedSummary.playerCount}/4`} />
                    <SummaryStat label="Week" value={selectedSummary.currentWeek ? `${selectedSummary.currentWeek}/${selectedSummary.totalWeeks}` : 'Not started'} />
                    <SummaryStat label="Anonymous" value={selectedSummary.anonymousMode ? 'On' : 'Off'} />
                  </div>
                </section>

                <div className="grid lg:grid-cols-[1.05fr,0.95fr] gap-6">
                  <section className="glass-card rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-foreground">Team Roster</h3>
                        <p className="text-xs text-muted-foreground mt-1">Override roles when needed, then ask students to ready up.</p>
                      </div>
                      <label className="flex items-center gap-3 text-sm text-foreground">
                        <span>Anonymous mode</span>
                        <input
                          type="checkbox"
                          checked={selectedState.anonymousMode}
                          onChange={(event) => handleAnonymousModeToggle(event.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                      </label>
                    </div>

                    <div className="space-y-3">
                      {selectedState.players.map((player) => (
                        <div key={player.sessionToken} className="rounded-xl bg-muted/30 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-foreground">{player.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {player.isConnected ? 'Connected' : 'Disconnected'} · {player.isReady ? 'Ready' : 'Not ready'}
                            </p>
                          </div>

                          <select
                            value={player.role || 'retailer'}
                            onChange={(event) => handleRoleChange(player.sessionToken, event.target.value as Role)}
                            className="h-10 rounded-lg border border-border bg-secondary px-3 text-sm text-foreground"
                          >
                            {(['retailer', 'wholesaler', 'distributor', 'factory'] as Role[]).map((role) => (
                              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                            ))}
                          </select>
                        </div>
                      ))}

                      {selectedState.players.length === 0 && (
                        <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                          Waiting for players to join this room.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="glass-card rounded-2xl p-6 space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Room Controls</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Timer policy matches the progress report: longer early rounds, shorter late rounds, centrally controlled.
                      </p>
                    </div>

                    {timerConfig && (
                      <div className="grid md:grid-cols-2 gap-3">
                        <TimerField label="Early rounds" value={timerConfig.earlyRounds} min={0} onChange={(value) => handleTimerConfigChange('earlyRounds', value)} />
                        <TimerField label="Final rounds" value={timerConfig.finalRounds} min={0} onChange={(value) => handleTimerConfigChange('finalRounds', value)} />
                        <TimerField label="Early duration (s)" value={timerConfig.earlyRoundDurationSec} min={5} onChange={(value) => handleTimerConfigChange('earlyRoundDurationSec', value)} />
                        <TimerField label="Middle duration (s)" value={timerConfig.middleRoundDurationSec} min={5} onChange={(value) => handleTimerConfigChange('middleRoundDurationSec', value)} />
                        <TimerField label="Final duration (s)" value={timerConfig.finalRoundDurationSec} min={5} onChange={(value) => handleTimerConfigChange('finalRoundDurationSec', value)} />
                      </div>
                    )}

                    {selectedGameState && (
                      <div className="rounded-xl bg-muted/20 p-4 space-y-3">
                        <p className="font-medium text-foreground">Live metrics</p>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {(['retailer', 'wholesaler', 'distributor', 'factory'] as Role[]).map((role) => (
                            <div key={role} className="rounded-lg bg-background/70 p-3">
                              <p className="text-muted-foreground">{ROLE_LABELS[role]}</p>
                              <p className="mt-1 font-semibold text-foreground">
                                Cost {calculateTotalCost(selectedGameState.stages[role]).toFixed(1)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Bullwhip {selectedRatios ? selectedRatios[role].toFixed(2) : '1.00'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <section className="glass-card rounded-2xl p-10 text-center text-muted-foreground">
                Select an instructor-created room to manage it.
              </section>
            )}

            <section className="glass-card rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Teaching Snapshot</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Precomputed benchmark scenario kept from the report so you can compare classroom results with an expected bullwhip pattern.
                </p>
              </div>

              <div className="grid md:grid-cols-4 gap-3">
                {(['retailer', 'wholesaler', 'distributor', 'factory'] as Role[]).map((role) => (
                  <div key={role} className="rounded-xl bg-muted/20 p-4">
                    <p className="text-sm text-muted-foreground">{ROLE_LABELS[role]}</p>
                    <p className="mt-2 text-xl font-bold text-foreground">{scenarioRatios[role].toFixed(2)}x</p>
                    <p className="text-xs text-muted-foreground">variance amplification</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/25 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function TimerField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2 rounded-xl bg-muted/20 p-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(event) => onChange(Math.max(min, parseInt(event.target.value, 10) || min))}
      />
    </label>
  );
}

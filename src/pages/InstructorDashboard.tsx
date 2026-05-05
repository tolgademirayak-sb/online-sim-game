import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, GraduationCap, Loader2, Play, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as api from '@/lib/apiService';
import type { ClassroomDetail, ClassroomRoomSummary, ClassroomSummary, RoomStateResponse } from '@/lib/apiTypes';
import { DEFAULT_CONFIG, DEFAULT_DEMAND_CONFIG, ROLE_LABELS, Role, DemandPattern, TimerConfig } from '@/types/game';
import { calculateBullwhipRatio, calculateTotalCost } from '@/lib/gameLogic';
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
  const [classrooms, setClassrooms] = useState<ClassroomSummary[]>([]);
  const [selectedClassCode, setSelectedClassCode] = useState<string | null>(null);
  const [selectedClassroom, setSelectedClassroom] = useState<ClassroomDetail | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<InstructorRoomDetail | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [isCreatingClassroom, setIsCreatingClassroom] = useState(false);
  const [isStartingClassroom, setIsStartingClassroom] = useState(false);
  const [roomCount, setRoomCount] = useState(4);
  const [classroomLabel, setClassroomLabel] = useState('ECON 301 Tutorial 1');
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
    const loadClassrooms = async () => {
      try {
        const nextClassrooms = await api.listInstructorClassrooms();
        if (!active) {
          return;
        }

        setClassrooms(nextClassrooms);
        if (!selectedClassCode && nextClassrooms[0]) {
          setSelectedClassCode(nextClassrooms[0].classCode);
        }
        if (selectedClassCode && !nextClassrooms.some(classroom => classroom.classCode === selectedClassCode)) {
          setSelectedClassCode(nextClassrooms[0]?.classCode || null);
        }
      } catch (err: any) {
        if (active) {
          toast.error(err.message || 'Could not load classrooms');
        }
      }
    };

    loadClassrooms();
    const handle = window.setInterval(loadClassrooms, 3000);
    return () => {
      active = false;
      window.clearInterval(handle);
    };
  }, [sessionInfo, selectedClassCode, refreshTick]);

  useEffect(() => {
    if (!sessionInfo || !selectedClassCode) {
      setSelectedClassroom(null);
      setSelectedRoomId(null);
      return;
    }

    let active = true;
    const loadClassroomDetail = async () => {
      try {
        const detail = await api.getInstructorClassroom(selectedClassCode);
        if (!active) {
          return;
        }

        setSelectedClassroom(detail);
        if (!selectedRoomId && detail.rooms[0]) {
          setSelectedRoomId(detail.rooms[0].roomId);
        }
        if (selectedRoomId && !detail.rooms.some(room => room.roomId === selectedRoomId)) {
          setSelectedRoomId(detail.rooms[0]?.roomId || null);
        }
      } catch (err: any) {
        if (active) {
          toast.error(err.message || 'Could not load classroom detail');
        }
      }
    };

    loadClassroomDetail();
    const handle = window.setInterval(loadClassroomDetail, 3000);
    return () => {
      active = false;
      window.clearInterval(handle);
    };
  }, [sessionInfo, selectedClassCode, selectedRoomId, refreshTick]);

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

  const createClassroom = async () => {
    if (!classroomLabel.trim()) {
      toast.error('Please enter a classroom name');
      return;
    }

    setIsCreatingClassroom(true);
    try {
      const classroom = await api.createClassroom({
        label: classroomLabel.trim(),
        roomCount,
        password: roomPassword || undefined,
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

      toast.success(`${classroom.label} created with ${classroom.roomCount} team${classroom.roomCount > 1 ? 's' : ''}`);
      setSelectedClassCode(classroom.classCode);
      setSelectedClassroom(classroom);
      if (classroom.rooms[0]) {
        setSelectedRoomId(classroom.rooms[0].roomId);
      }
    } catch (err: any) {
      toast.error(err.message || 'Could not create classroom');
    } finally {
      setIsCreatingClassroom(false);
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

  const copyClassCode = async (classroom: ClassroomSummary | ClassroomDetail) => {
    const passwordLine = classroom.joinPasswordRequired && roomPassword.trim()
      ? `\nPassword: ${roomPassword.trim()}`
      : '';
    const classInfo = `Class Code: ${classroom.classCode}${passwordLine}`;

    try {
      if (!navigator.clipboard?.writeText) {
        toast.info(classInfo);
        return;
      }
      await navigator.clipboard.writeText(classInfo);
      toast.success(`Copied ${classroom.classCode}`);
    } catch {
      toast.info(classInfo);
    }
  };

  const handleStartClassroom = async () => {
    if (!selectedClassroom) {
      return;
    }

    setIsStartingClassroom(true);
    try {
      const startedRoomIds = await api.startClassroomGames(selectedClassroom.classCode);
      toast.success(`${startedRoomIds.length} team game${startedRoomIds.length > 1 ? 's' : ''} started`);
      setRefreshTick((value) => value + 1);
    } catch (err: any) {
      toast.error(err.message || 'Could not start classroom games');
    } finally {
      setIsStartingClassroom(false);
    }
  };

  const copyJoinCode = async (room: ClassroomRoomSummary) => {
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

  const selectedSummary = selectedClassroom?.rooms.find(room => room.roomId === selectedRoomId) || null;
  const selectedState = selectedRoom?.roomState || null;
  const selectedGameState = selectedRoom?.gameState || null;
  const selectedResults = selectedRoom?.results || null;
  const selectedRatios = selectedResults?.bullwhipRatios
    || (selectedGameState ? calculateBullwhipRatio(selectedGameState.history) : null);
  const timerConfig = selectedState?.gameConfig.timerConfig;
  const totalRooms = classrooms.reduce((sum, classroom) => sum + classroom.roomCount, 0);
  const totalPlayers = classrooms.reduce((sum, classroom) => sum + classroom.playerCount, 0);
  const liveClassrooms = classrooms.filter(classroom => classroom.status === 'playing').length;
  const selectedClassroomFinished = !!selectedClassroom?.rooms.length
    && selectedClassroom.rooms.every(room => room.status === 'finished');

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
                Logged in as {sessionInfo.playerName}. Create classrooms, fill team rooms automatically, and manage each game.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <SummaryStat label="Classes" value={classrooms.length} />
            <SummaryStat label="Live" value={liveClassrooms} />
            <SummaryStat label="Players" value={`${totalPlayers}/${totalRooms * 4}`} />
          </div>
        </div>

        {selectedClassroom && (
          <section className="glass-card rounded-2xl p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">{selectedClassroom.label}</h2>
              <p className="text-sm text-muted-foreground">
                Class code <span className="font-mono text-primary">{selectedClassroom.classCode}</span> - {selectedClassroom.playerCount}/{selectedClassroom.capacity} students joined
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => copyClassCode(selectedClassroom)} className="gap-2">
                <Copy className="h-4 w-4" />
                Copy Class Code
              </Button>
              <Button
                onClick={handleStartClassroom}
                disabled={isStartingClassroom || !selectedClassroom.rooms.some(room => room.status === 'lobby')}
                className="gap-2"
              >
                {isStartingClassroom ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {isStartingClassroom ? 'Starting Class...' : 'Start Class'}
              </Button>
              {selectedClassroomFinished && (
                <Button
                  onClick={() => navigate(`/instructor/classrooms/${selectedClassroom.classCode}/analysis`)}
                  className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <GraduationCap className="h-4 w-4" />
                  Open Analysis
                </Button>
              )}
            </div>
          </section>
        )}

        <div className="grid xl:grid-cols-[380px,1fr] gap-6">
          <div className="space-y-6">
            <section className="glass-card rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Create Classroom</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Create one class code and the system will assign students into 4-player team rooms.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Class name">
                  <Input value={classroomLabel} onChange={(e) => setClassroomLabel(e.target.value)} placeholder="ECON 301 Tutorial 1" />
                </Field>
                <Field label="Games / teams">
                  <Input type="number" min={1} max={12} value={roomCount} onChange={(e) => setRoomCount(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)))} />
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

              <Button onClick={createClassroom} disabled={isCreatingClassroom} className="w-full gap-2">
                {isCreatingClassroom ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                {isCreatingClassroom ? 'Creating classroom...' : 'Create Classroom'}
              </Button>
            </section>

            <section className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Classrooms</h2>
                  <p className="text-xs text-muted-foreground mt-1">Select a classroom, then choose a team room to manage.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setRefreshTick((value) => value + 1)}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                {classrooms.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/60 p-6 text-sm text-muted-foreground">
                    No classrooms yet. Create one above and the class code will appear here.
                  </div>
                )}

                {classrooms.map((classroom) => (
                  <div key={classroom.classCode} className="rounded-xl border border-border bg-muted/15 p-3 space-y-3">
                    <button
                      onClick={() => setSelectedClassCode(classroom.classCode)}
                      className={`w-full rounded-lg p-3 text-left transition-colors ${
                        classroom.classCode === selectedClassCode
                          ? 'bg-primary/10'
                          : 'bg-muted/20 hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">{classroom.label}</p>
                          <p className="font-mono text-sm text-primary">{classroom.classCode}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] uppercase tracking-wide ${
                          classroom.status === 'playing'
                            ? 'bg-primary/15 text-primary'
                            : classroom.status === 'finished'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-accent/15 text-accent'
                        }`}>
                          {classroom.status}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{classroom.roomCount} teams</span>
                        <span>{classroom.playerCount}/{classroom.capacity} players</span>
                      </div>
                    </button>

                    {classroom.classCode === selectedClassCode && selectedClassroom && (
                      <div className="space-y-2">
                        <Button variant="outline" size="sm" onClick={() => copyClassCode(selectedClassroom)} className="w-full gap-2">
                          <Copy className="h-4 w-4" />
                          Copy Class Code
                        </Button>
                        {selectedClassroom.rooms.map((room) => (
                          <button
                            key={room.roomId}
                            onClick={() => setSelectedRoomId(room.roomId)}
                            className={`w-full rounded-lg border p-3 text-left transition-colors ${
                              room.roomId === selectedRoomId
                                ? 'border-primary bg-primary/10'
                                : 'border-border bg-background/60 hover:bg-muted/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-foreground">{room.label || `Team ${room.teamNumber}`}</p>
                                <p className="font-mono text-xs text-muted-foreground">{room.roomId}</p>
                              </div>
                              <span className="text-xs text-muted-foreground">{room.playerCount}/4</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
                        Class <span className="font-mono text-primary">{selectedClassroom?.classCode}</span> assigns students automatically.
                        Room code <span className="font-mono text-primary">{selectedSummary.roomId}</span> still works for direct assignment.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {selectedClassroom && (
                        <Button variant="outline" onClick={() => copyClassCode(selectedClassroom)} className="gap-2">
                          <Copy className="h-4 w-4" />
                          Copy Class
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => copyJoinCode(selectedSummary)} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copy Room
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

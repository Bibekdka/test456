import React, { useState, useMemo } from 'react';
import { Project, ProjectPhase, DelayWeatherLog, getProjectScopeIds } from '../types';
import { generateId } from '../utils/id';
import { 
  Calendar, 
  Layers, 
  Plus, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  User, 
  Trash2, 
  Pencil, 
  ChevronRight, 
  CloudSun, 
  Zap, 
  CloudRain, 
  Info, 
  Sparkles,
  Link as LinkIcon,
  X,
  MapPin,
  ArrowRight
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface GanttPhaseTimelineProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  projectPhases: ProjectPhase[];
  delayWeatherLogs: DelayWeatherLog[];
  onAddPhase: (phase: Omit<ProjectPhase, 'id'>) => Promise<void>;
  onUpdatePhase: (phase: ProjectPhase) => Promise<void>;
  onDeletePhase: (id: string) => Promise<void>;
}

export default function GanttPhaseTimeline({
  projects,
  activeProjectId,
  onSelectProject,
  projectPhases,
  delayWeatherLogs,
  onAddPhase,
  onUpdatePhase,
  onDeletePhase
}: GanttPhaseTimelineProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingPhase, setEditingPhase] = useState<ProjectPhase | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Link Delay Modal State
  const [linkingPhase, setLinkingPhase] = useState<ProjectPhase | null>(null);

  // Form fields
  const [phaseName, setPhaseName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed' | 'delayed'>('in_progress');
  const [progress, setProgress] = useState(0);
  const [assignedLeader, setAssignedLeader] = useState('');
  const [notes, setNotes] = useState('');

  // Active Project Context
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  // Scope project IDs (includes child sites if parent)
  const scopedProjectIds = useMemo(() => {
    if (!activeProject) return [];
    return getProjectScopeIds(activeProject.id, projects);
  }, [activeProject, projects]);

  // Scoped phases
  const currentPhases = useMemo(() => {
    return projectPhases
      .filter(p => scopedProjectIds.includes(p.projectId))
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }, [projectPhases, scopedProjectIds]);

  // Scoped delay weather logs
  const currentDelayLogs = useMemo(() => {
    return delayWeatherLogs.filter(d => scopedProjectIds.includes(d.projectId));
  }, [delayWeatherLogs, scopedProjectIds]);

  // Handle open add/edit modal
  const handleOpenAdd = () => {
    setEditingPhase(null);
    setPhaseName('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setStatus('pending');
    setProgress(0);
    setAssignedLeader('');
    setNotes('');
    setShowModal(true);
  };

  const handleOpenEdit = (phase: ProjectPhase) => {
    setEditingPhase(phase);
    setPhaseName(phase.name);
    setStartDate(phase.startDate);
    setEndDate(phase.endDate);
    setStatus(phase.status);
    setProgress(phase.progress);
    setAssignedLeader(phase.assignedLeader || '');
    setNotes(phase.notes || '');
    setShowModal(true);
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;

    if (!phaseName.trim()) {
      alert('Please enter a phase name.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      alert('End date cannot be prior to Start date.');
      return;
    }

    if (editingPhase) {
      await onUpdatePhase({
        ...editingPhase,
        name: phaseName.trim(),
        startDate,
        endDate,
        status,
        progress: Number(progress),
        assignedLeader: assignedLeader.trim(),
        notes: notes.trim(),
        updatedAt: Date.now()
      });
    } else {
      await onAddPhase({
        projectId: activeProject.id,
        name: phaseName.trim(),
        startDate,
        endDate,
        status,
        progress: Number(progress),
        assignedLeader: assignedLeader.trim(),
        orderIndex: currentPhases.length + 1,
        notes: notes.trim(),
        linkedDelayLogIds: [],
        updatedAt: Date.now()
      });
    }

    setShowModal(false);
  };

  // Pre-populate Standard Construction Phases if empty
  const handleAutoGeneratePhases = async () => {
    if (!activeProject) return;

    const baseDate = activeProject.startDate ? new Date(activeProject.startDate) : new Date();
    
    const addDays = (date: Date, days: number) => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result.toISOString().split('T')[0];
    };

    const standardPhases = [
      { name: '1. Excavation & Site Clearing', duration: 7, leader: 'Site Foreman' },
      { name: '2. Footing & RCC Foundation', duration: 14, leader: 'Structural Contractor' },
      { name: '3. Column & Beam Framework', duration: 21, leader: 'RCC Specialist' },
      { name: '4. Roof Slab Casting & Curing', duration: 14, leader: 'RCC Engineer' },
      { name: '5. AAC Brickwork & Partition Walls', duration: 18, leader: 'Mason Leader' },
      { name: '6. Wall Plastering & Electrical Rough-in', duration: 14, leader: 'Electrical Supervisor' },
      { name: '7. Plumbing, Sanitary & Tile Flooring', duration: 15, leader: 'Finishing Manager' },
      { name: '8. Wall Putty, Painting & Handover', duration: 12, leader: 'Site Engineer' }
    ];

    let currentStart = baseDate;

    for (let i = 0; i < standardPhases.length; i++) {
      const sp = standardPhases[i];
      const startStr = currentStart.toISOString().split('T')[0];
      const endStr = addDays(currentStart, sp.duration);
      
      await onAddPhase({
        projectId: activeProject.id,
        name: sp.name,
        startDate: startStr,
        endDate: endStr,
        status: i === 0 ? 'in_progress' : 'pending',
        progress: i === 0 ? 30 : 0,
        assignedLeader: sp.leader,
        orderIndex: i + 1,
        notes: `Standard construction phase #${i + 1}`,
        linkedDelayLogIds: [],
        updatedAt: Date.now()
      });

      // Next phase starts the day after
      currentStart = new Date(endStr);
      currentStart.setDate(currentStart.getDate() + 1);
    }
  };

  // Link/Unlink Delay Log
  const handleToggleLinkDelay = async (phase: ProjectPhase, delayLogId: string) => {
    const currentLinked = phase.linkedDelayLogIds || [];
    const exists = currentLinked.includes(delayLogId);
    
    const updatedLinked = exists 
      ? currentLinked.filter(id => id !== delayLogId)
      : [...currentLinked, delayLogId];

    // Determine if phase status should turn to 'delayed'
    const newStatus = (!exists && updatedLinked.length > 0) ? 'delayed' : phase.status;

    await onUpdatePhase({
      ...phase,
      linkedDelayLogIds: updatedLinked,
      status: newStatus,
      updatedAt: Date.now()
    });

    if (linkingPhase && linkingPhase.id === phase.id) {
      setLinkingPhase({
        ...phase,
        linkedDelayLogIds: updatedLinked,
        status: newStatus
      });
    }
  };

  // Calculate Gantt Timeline Boundaries
  const timelineStats = useMemo(() => {
    if (currentPhases.length === 0) {
      const today = new Date();
      const future = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000);
      return { minDate: today, maxDate: future, totalDays: 60 };
    }

    let minTs = Infinity;
    let maxTs = -Infinity;

    currentPhases.forEach(p => {
      const s = new Date(p.startDate).getTime();
      const e = new Date(p.endDate).getTime();
      if (s < minTs) minTs = s;
      if (e > maxTs) maxTs = e;
    });

    // Add 2 days padding
    minTs -= 2 * 24 * 60 * 60 * 1000;
    maxTs += 5 * 24 * 60 * 60 * 1000;

    const minDate = new Date(minTs);
    const maxDate = new Date(maxTs);
    const totalDays = Math.max(1, Math.ceil((maxTs - minTs) / (1000 * 60 * 60 * 24)));

    return { minDate, maxDate, totalDays };
  }, [currentPhases]);

  // Overall Completion Stat
  const overallProgress = useMemo(() => {
    if (currentPhases.length === 0) return 0;
    const total = currentPhases.reduce((sum, p) => sum + p.progress, 0);
    return Math.round(total / currentPhases.length);
  }, [currentPhases]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-indigo-500/30 text-indigo-200 text-xs font-mono font-bold px-2.5 py-0.5 rounded-md border border-indigo-400/30">
                Interactive Schedule
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                {activeProject?.name || 'All Sites'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
              Gantt Chart & Construction Phase Timeline
            </h2>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed max-w-2xl">
              Track multi-stage construction workflows (Excavation ➔ RCC Footing ➔ Slab Casting ➔ Brickwork ➔ Finishing). Link site weather/delay logs directly to observe timeline impacts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {currentPhases.length === 0 && (
              <button
                onClick={handleAutoGeneratePhases}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                Auto-Generate 8 Phases
              </button>
            )}

            <button
              onClick={handleOpenAdd}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded-xl text-xs flex items-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Construction Phase
            </button>
          </div>
        </div>

        {/* Project Selector & Progress Bar Header */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-slate-300 font-mono">Switch Site Context:</label>
            <select
              value={activeProjectId || ''}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-slate-800 text-white border border-slate-700 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.parentProjectId ? '(Sub-site)' : '(Main Site)'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 min-w-[240px]">
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                <span>Overall Site Progress</span>
                <span className="font-bold text-emerald-400">{overallProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden border border-slate-700">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Site Phases</span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{currentPhases.length}</p>
          <span className="text-[11px] text-slate-500 font-mono">Ordered sequence</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active In-Progress</span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {currentPhases.filter(p => p.status === 'in_progress').length}
          </p>
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold font-mono">Under construction</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Completed Stages</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {currentPhases.filter(p => p.status === 'completed').length}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
            {currentPhases.length > 0 ? `${Math.round((currentPhases.filter(p => p.status === 'completed').length / currentPhases.length) * 100)}% finished` : '0%'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Delayed / Weather Impact</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {currentPhases.filter(p => p.status === 'delayed' || (p.linkedDelayLogIds && p.linkedDelayLogIds.length > 0)).length}
          </p>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold font-mono">
            {currentDelayLogs.length} site delay logs recorded
          </span>
        </div>
      </div>

      {/* Main Gantt Visual Chart & Phase Table Container */}
      {currentPhases.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Construction Phases Configured</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Create custom work stages for <strong className="text-slate-700 dark:text-slate-200">{activeProject?.name}</strong> or click below to automatically generate standard civil engineering stages (Excavation to Finishing).
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-3">
            <button
              onClick={handleAutoGeneratePhases}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs transition"
            >
              <Sparkles className="w-4 h-4" />
              Auto-Generate Standard Phase Sequence
            </button>
            <button
              onClick={handleOpenAdd}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              Add Custom Phase
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Interactive Construction Gantt View</h3>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Completed
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span> In Progress
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Pending
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-600 dark:text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> Delayed
              </span>
            </div>
          </div>

          {/* Gantt Bar Chart Grid */}
          <div className="overflow-x-auto p-4">
            <div className="min-w-[800px] space-y-3">
              {/* Timeline Ruler Header */}
              <div className="flex items-center text-[10px] font-mono text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="w-64 shrink-0 font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Phase & Leader
                </div>
                <div className="flex-1 flex justify-between px-2">
                  <span>Start: {timelineStats.minDate.toISOString().split('T')[0]}</span>
                  <span>Midpoint</span>
                  <span>End: {timelineStats.maxDate.toISOString().split('T')[0]}</span>
                </div>
                <div className="w-32 shrink-0 text-right font-bold uppercase tracking-wider">
                  Progress / Actions
                </div>
              </div>

              {/* Phase Rows */}
              {currentPhases.map((phase) => {
                const startTs = new Date(phase.startDate).getTime();
                const endTs = new Date(phase.endDate).getTime();
                const minTs = timelineStats.minDate.getTime();
                const maxTs = timelineStats.maxDate.getTime();
                const totalRange = maxTs - minTs;

                const leftPercent = Math.max(0, Math.min(100, ((startTs - minTs) / totalRange) * 100));
                const widthPercent = Math.max(3, Math.min(100 - leftPercent, ((endTs - startTs) / totalRange) * 100));

                const linkedDelays = currentDelayLogs.filter(d => 
                  (phase.linkedDelayLogIds || []).includes(d.id)
                );

                const durationDays = Math.max(1, Math.ceil((endTs - startTs) / (1000 * 60 * 60 * 24)));

                let barColor = 'bg-blue-500 hover:bg-blue-600';
                if (phase.status === 'completed') barColor = 'bg-emerald-500 hover:bg-emerald-600';
                if (phase.status === 'pending') barColor = 'bg-amber-400 hover:bg-amber-500';
                if (phase.status === 'delayed' || linkedDelays.length > 0) barColor = 'bg-rose-500 hover:bg-rose-600';

                return (
                  <div key={phase.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group border border-slate-100 dark:border-slate-800/60">
                    {/* Left Column: Title & Leader */}
                    <div className="w-64 shrink-0 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {phase.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {phase.assignedLeader && (
                          <span className="flex items-center gap-1 truncate text-indigo-600 dark:text-indigo-400 font-semibold">
                            <User className="w-3 h-3 shrink-0" />
                            {phase.assignedLeader}
                          </span>
                        )}
                        <span>({durationDays} days)</span>
                      </div>
                    </div>

                    {/* Middle Column: Visual Timeline Bar */}
                    <div className="flex-1 relative h-9 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden border border-slate-200/80 dark:border-slate-700/60 flex items-center px-1">
                      {/* Grid background lines */}
                      <div className="absolute inset-0 grid grid-cols-4 pointer-events-none opacity-20 divide-x divide-slate-400">
                        <div></div><div></div><div></div><div></div>
                      </div>

                      {/* Timeline Bar */}
                      <div
                        className={`absolute h-7 rounded-md ${barColor} text-white text-[10px] font-bold font-mono px-2 flex items-center justify-between shadow-xs transition-all cursor-pointer`}
                        style={{
                          left: `${leftPercent}%`,
                          width: `${widthPercent}%`
                        }}
                        onClick={() => handleOpenEdit(phase)}
                        title={`${phase.name}: ${phase.startDate} to ${phase.endDate} (${phase.progress}% progress)`}
                      >
                        <span className="truncate">{phase.startDate}</span>
                        <span className="font-black text-xs">{phase.progress}%</span>
                      </div>
                    </div>

                    {/* Right Column: Linked Delays & Actions */}
                    <div className="w-36 shrink-0 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setLinkingPhase(phase)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold font-mono flex items-center gap-1 cursor-pointer transition ${
                          linkedDelays.length > 0 
                            ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                        title="Link site weather/delay logs to this phase"
                      >
                        <CloudRain className="w-3 h-3 text-rose-500" />
                        <span>{linkedDelays.length} Delays</span>
                      </button>

                      <button
                        onClick={() => handleOpenEdit(phase)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition cursor-pointer"
                        title="Edit Phase"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setConfirmDeleteId(phase.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                        title="Delete Phase"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Phase Detailed List & Progress Sliders */}
      {currentPhases.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              Construction Phase Progress Management
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Slide or update status in real-time
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentPhases.map((phase) => {
              const linkedDelays = currentDelayLogs.filter(d => 
                (phase.linkedDelayLogIds || []).includes(d.id)
              );

              return (
                <div 
                  key={phase.id} 
                  className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">{phase.name}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {phase.startDate} ➔ {phase.endDate}
                      </p>
                    </div>

                    {/* Status Badge Select */}
                    <select
                      value={phase.status}
                      onChange={async (e) => {
                        const newStatus = e.target.value as any;
                        await onUpdatePhase({
                          ...phase,
                          status: newStatus,
                          progress: newStatus === 'completed' ? 100 : phase.progress,
                          updatedAt: Date.now()
                        });
                      }}
                      className={`text-xs font-bold rounded-lg px-2.5 py-1 border focus:outline-none cursor-pointer ${
                        phase.status === 'completed' 
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                          : phase.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300'
                          : phase.status === 'delayed'
                          ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="delayed">Delayed</option>
                    </select>
                  </div>

                  {/* Quick Progress Slider */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono">
                      <span>Completion Percentage</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{phase.progress}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={phase.progress}
                      onChange={async (e) => {
                        const val = Number(e.target.value);
                        const newStatus = val === 100 ? 'completed' : (val > 0 ? 'in_progress' : phase.status);
                        await onUpdatePhase({
                          ...phase,
                          progress: val,
                          status: newStatus,
                          updatedAt: Date.now()
                        });
                      }}
                      className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
                    />
                  </div>

                  {/* Leader & Linked Delays footer */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs font-mono text-slate-500 dark:text-slate-400">
                    <span>
                      {phase.assignedLeader ? `Leader: ${phase.assignedLeader}` : 'No leader assigned'}
                    </span>
                    
                    <button
                      type="button"
                      onClick={() => setLinkingPhase(phase)}
                      className="text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <CloudSun className="w-3.5 h-3.5" />
                      {linkedDelays.length} Linked Delays
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add / Edit Phase Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingPhase ? 'Edit Construction Phase' : 'Add New Construction Phase'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Phase Title / Activity Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Column & Beam RCC Framing"
                  value={phaseName}
                  onChange={(e) => setPhaseName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="delayed">Delayed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Leader / Engineer
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Er. Rajesh Sharma"
                    value={assignedLeader}
                    onChange={(e) => setAssignedLeader(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Progress Percentage ({progress}%)
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Operational Notes / Specifications
                </label>
                <textarea
                  rows={2}
                  placeholder="Additional specifications or contractor instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  {editingPhase ? 'Save Changes' : 'Create Phase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Weather/Site Delay Log Modal */}
      {linkingPhase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Link Weather & Delay Logs
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Phase: {linkingPhase.name}
                </p>
              </div>
              <button
                onClick={() => setLinkingPhase(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Select any site delay/weather logs recorded for this site to link them directly to this construction stage.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {currentDelayLogs.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500 font-mono">
                  No site delay/weather logs recorded yet for this project.
                </div>
              ) : (
                currentDelayLogs.map(log => {
                  const isLinked = (linkingPhase.linkedDelayLogIds || []).includes(log.id);
                  return (
                    <div
                      key={log.id}
                      onClick={() => handleToggleLinkDelay(linkingPhase, log.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition ${
                        isLinked
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <span className="font-mono">{log.date}</span>
                          <span className="capitalize text-rose-600 dark:text-rose-400 font-semibold">
                            [{log.weather}] {log.delayReason?.replace('_', ' ')}
                          </span>
                        </div>
                        {log.delayNotes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                            {log.delayNotes}
                          </p>
                        )}
                      </div>

                      <div className={`p-1.5 rounded-lg border text-xs font-bold shrink-0 ${
                        isLinked
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-600'
                      }`}>
                        {isLinked ? 'Linked ✓' : '+ Link'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setLinkingPhase(null)}
                className="bg-indigo-600 text-white font-bold px-5 py-2 rounded-xl text-xs shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <ConfirmModal
          isOpen={Boolean(confirmDeleteId)}
          title="Delete Construction Phase?"
          message="Are you sure you want to delete this construction stage from the timeline?"
          onConfirm={async () => {
            await onDeletePhase(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
          onClose={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}

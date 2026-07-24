import React, { useState, useMemo } from 'react';
import { Project, Labour, Attendance, AttendanceStatus } from '../types';
import { generateId } from '../utils/id';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  User, 
  Clock, 
  CalendarDays,
  Grid,
  Edit2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  IndianRupee,
  Coffee,
  AlertCircle
} from 'lucide-react';

interface AttendanceCalendarProps {
  activeProject: Project;
  labours: Labour[];
  attendanceRecords: Attendance[];
  onSaveAttendance: (records: Attendance[]) => void;
  onUpdateLabour: (labour: Labour) => void;
  onSelectDate?: (dateStr: string) => void;
}

export default function AttendanceCalendar({
  activeProject,
  labours,
  attendanceRecords,
  onSaveAttendance,
  onUpdateLabour,
  onSelectDate,
}: AttendanceCalendarProps) {
  // Selected labour/worker ID
  const [selectedLabourId, setSelectedLabourId] = useState<string>(
    labours.length > 0 ? labours[0].id : ''
  );

  // Current Month / Year navigation
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed

  // View Mode: 'single' (focused calendar for 1 person) or 'all' (matrix grid for all personnel)
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');

  // Search, Role & Status filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'left' | 'all'>('active');

  // Modal / Popover state for custom day editing
  const [activeDayModal, setActiveDayModal] = useState<{
    dateStr: string;
    labourId: string;
    existingRecord?: Attendance;
  } | null>(null);

  // Joined Date inline edit state
  const [isEditingJoinedDate, setIsEditingJoinedDate] = useState(false);
  const [editJoinedDateValue, setEditJoinedDateValue] = useState('');

  // Filter labours based on search, role & active/left status
  const filteredLabours = useMemo(() => {
    return labours.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (l.contact && l.contact.includes(searchTerm));
      const matchesRole = roleFilter === 'all' || l.role === roleFilter || 
                          (roleFilter === 'worker' && (!l.role || l.role === 'worker'));
      const isLeft = l.status === 'left';
      const matchesStatus = statusFilter === 'all' || 
                            (statusFilter === 'active' && !isLeft) || 
                            (statusFilter === 'left' && isLeft);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [labours, searchTerm, roleFilter, statusFilter]);

  // Selected Labour object
  const selectedLabour = useMemo(() => {
    return filteredLabours.find(l => l.id === selectedLabourId) || filteredLabours[0] || null;
  }, [filteredLabours, selectedLabourId]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handleCurrentMonth = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  // Days in month calculation
  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate();
  }, [currentYear, currentMonth]);

  // First day offset (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = useMemo(() => {
    return new Date(currentYear, currentMonth, 1).getDay();
  }, [currentYear, currentMonth]);

  // Date formatter YYYY-MM-DD
  const formatDateStr = (dayNum: number): string => {
    const monthPadded = String(currentMonth + 1).padStart(2, '0');
    const dayPadded = String(dayNum).padStart(2, '0');
    return `${currentYear}-${monthPadded}-${dayPadded}`;
  };

  // Get attendance record for person and date
  const getAttendanceRecord = (labourId: string, dateStr: string): Attendance | undefined => {
    const person = labours.find(l => l.id === labourId);
    if (person && person.joinedDate && dateStr < person.joinedDate) {
      return undefined;
    }
    return attendanceRecords.find(
      r => r.labourId === labourId && r.projectId === activeProject.id && r.date === dateStr
    );
  };

  // Get status of attendance record
  // Status: 'present' (Green) | 'half_day' (Yellow) | 'absent' (Red) | 'rest' (Blue) | 'unmarked' (Grey)
  const getAttendanceStatus = (record?: Attendance): AttendanceStatus | 'unmarked' => {
    if (!record || record.status === 'pending') return 'unmarked';
    return record.status;
  };

  // Quick 1-Click Toggle for a Day:
  // Unmarked (Grey) ➔ Present (Green) ➔ Half Day (Yellow) ➔ Absent (Red) ➔ Unmarked (Grey)
  const handleQuickToggleDay = (labourId: string, dateStr: string) => {
    const person = labours.find(l => l.id === labourId);
    if (person && person.joinedDate && dateStr < person.joinedDate) {
      alert(`Cannot mark attendance for ${person.name} on ${dateStr} as they joined on ${person.joinedDate}.`);
      return;
    }

    if (onSelectDate) {
      onSelectDate(dateStr);
    }
    const existingRecord = getAttendanceRecord(labourId, dateStr);
    const currentStatus = getAttendanceStatus(existingRecord);

    let nextStatus: AttendanceStatus | 'unmarked' = 'present';
    if (currentStatus === 'unmarked') {
      nextStatus = 'present';
    } else if (currentStatus === 'present') {
      nextStatus = 'half_day';
    } else if (currentStatus === 'half_day') {
      nextStatus = 'absent';
    } else if (currentStatus === 'absent') {
      nextStatus = 'unmarked';
    } else {
      nextStatus = 'present';
    }

    if (nextStatus === 'unmarked') {
      // Remove record or set to pending
      const updatedRecords = attendanceRecords.filter(
        r => !(r.labourId === labourId && r.projectId === activeProject.id && r.date === dateStr)
      );
      // We send updated record list to parent
      const recordToSave: Attendance = {
        id: existingRecord ? existingRecord.id : generateId('att'),
        labourId,
        projectId: activeProject.id,
        date: dateStr,
        status: 'pending'
      };
      onSaveAttendance([recordToSave]);
    } else {
      const recordToSave: Attendance = {
        id: existingRecord ? existingRecord.id : generateId('att'),
        labourId,
        projectId: activeProject.id,
        date: dateStr,
        status: nextStatus
      };
      onSaveAttendance([recordToSave]);
    }
  };

  // Set specific status
  const handleSetStatus = (labourId: string, dateStr: string, status: AttendanceStatus | 'unmarked') => {
    const person = labours.find(l => l.id === labourId);
    if (person && person.joinedDate && dateStr < person.joinedDate) {
      alert(`Cannot set status for ${person.name} on ${dateStr} as they joined on ${person.joinedDate}.`);
      return;
    }

    if (onSelectDate) {
      onSelectDate(dateStr);
    }
    const existingRecord = getAttendanceRecord(labourId, dateStr);

    const recordToSave: Attendance = {
      id: existingRecord ? existingRecord.id : generateId('att'),
      labourId,
      projectId: activeProject.id,
      date: dateStr,
      status: status === 'unmarked' ? 'pending' : status
    };
    onSaveAttendance([recordToSave]);
    setActiveDayModal(null);
  };

  // Save updated Joined Date
  const handleSaveJoinedDate = () => {
    if (!selectedLabour) return;
    const updated: Labour = {
      ...selectedLabour,
      joinedDate: editJoinedDateValue || undefined
    };
    onUpdateLabour(updated);
    setIsEditingJoinedDate(false);
  };

  // Month Name string
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });

  // Calculate monthly stats for selected labour
  const singlePersonMonthStats = useMemo(() => {
    if (!selectedLabour) return { presentDays: 0, halfDays: 0, absentDays: 0, restDays: 0, unmarkedDays: 0, totalDaysWorked: 0, estWages: 0 };

    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let restDays = 0;
    let validDaysInMonth = 0;

    const joinDate = selectedLabour.joinedDate || activeProject.startDate || '1970-01-01';

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDateStr(day);
      if (dateStr < joinDate) continue; // Ignore days before worker joined

      validDaysInMonth++;
      const rec = getAttendanceRecord(selectedLabour.id, dateStr);
      const st = getAttendanceStatus(rec);

      if (st === 'present') presentDays++;
      else if (st === 'half_day') halfDays++;
      else if (st === 'absent') absentDays++;
      else if (st === 'rest' || st === 'home') restDays++;
    }

    const unmarkedDays = Math.max(0, validDaysInMonth - (presentDays + halfDays + absentDays + restDays));
    const totalDaysWorked = presentDays + (halfDays * 0.5);
    const estWages = totalDaysWorked * (selectedLabour.perDayWage || 0);

    return { presentDays, halfDays, absentDays, restDays, unmarkedDays, totalDaysWorked, estWages };
  }, [selectedLabour, currentYear, currentMonth, daysInMonth, attendanceRecords, activeProject]);

  if (labours.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <User className="w-10 h-10 text-slate-400 mx-auto" />
        <h3 className="text-sm font-bold text-slate-700">No Workers or Personnel Registered</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Please add workers or staff under the Worker Directory to record and manage their monthly calendar attendance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-4.5 h-4.5 text-emerald-600" />
              Monthly Attendance Calendar
            </h3>
            <p className="text-xs text-slate-500">
              Record daily worker presence: <span className="text-emerald-700 font-bold">Green = Full Day</span>, <span className="text-amber-700 font-bold">Yellow = Half Day</span>, <span className="text-rose-700 font-bold">Red = Absent</span>, <span className="text-slate-500 font-bold">Grey = Unmarked</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Switcher */}
            <div className="flex bg-slate-100 rounded-lg p-1 text-xs font-semibold">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'single' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Worker Month View
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'all' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                All Personnel Grid
              </button>
            </div>
          </div>
        </div>

        {/* Month Selector & Legend Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold font-mono text-slate-800 min-w-[140px] text-center bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
              {monthName} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleCurrentMonth}
              className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1.5 rounded-lg border border-emerald-200 transition cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200 font-semibold">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600 inline-block" />
              <span>Green: Full Day (1.0)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 font-semibold">
              <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-500 inline-block" />
              <span>Yellow: Half Day (0.5)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 px-2.5 py-1 rounded-full border border-rose-200 font-semibold">
              <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-600 inline-block" />
              <span>Red: Absent (0.0)</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 font-semibold">
              <span className="w-3 h-3 rounded-full bg-slate-300 border border-slate-400 inline-block" />
              <span>Grey: Unmarked</span>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: SINGLE WORKER CALENDAR VIEW */}
      {viewMode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Worker Directory Sidebar */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-xs">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Select Worker</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                {filteredLabours.length}
              </span>
            </h4>

            {/* Search, Role, and Status filters */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search name or contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs p-2 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />

              {/* Active vs Left status toggle */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`flex-1 py-1 rounded-md transition ${statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  🟢 Active ({labours.filter(l => l.status !== 'left').length})
                </button>
                <button
                  onClick={() => setStatusFilter('left')}
                  className={`flex-1 py-1 rounded-md transition ${statusFilter === 'left' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  🔴 Left Work ({labours.filter(l => l.status === 'left').length})
                </button>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`flex-1 py-1 rounded-md transition ${statusFilter === 'all' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  All ({labours.length})
                </button>
              </div>

              <div className="flex gap-1 text-[10px] font-semibold">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`flex-1 py-1 rounded border ${roleFilter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  All Roles
                </button>
                <button
                  onClick={() => setRoleFilter('worker')}
                  className={`flex-1 py-1 rounded border ${roleFilter === 'worker' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  Worker
                </button>
                <button
                  onClick={() => setRoleFilter('contractor')}
                  className={`flex-1 py-1 rounded border ${roleFilter === 'contractor' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  Contractor
                </button>
                <button
                  onClick={() => setRoleFilter('staff')}
                  className={`flex-1 py-1 rounded border ${roleFilter === 'staff' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  Staff
                </button>
              </div>
            </div>

            {/* List of Personnel */}
            <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1 border-t border-slate-100 pt-2">
              {filteredLabours.map((person) => {
                const isSelected = person.id === selectedLabourId;
                const defaultJoin = activeProject.startDate || new Date().toISOString().split('T')[0];
                const joinDateStr = person.joinedDate || defaultJoin;
                const isLeft = person.status === 'left';

                return (
                  <button
                    key={person.id}
                    onClick={() => {
                      setSelectedLabourId(person.id);
                      setIsEditingJoinedDate(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition flex flex-col gap-1 cursor-pointer ${
                      isSelected
                        ? isLeft ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-300 text-rose-950' : 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300 text-emerald-950'
                        : 'bg-slate-50/50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-bold text-xs truncate flex items-center gap-1">
                        {person.name}
                        {isLeft && (
                          <span className="bg-rose-100 text-rose-800 text-[8px] font-extrabold px-1 py-0.2 rounded border border-rose-200">
                            LEFT
                          </span>
                        )}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        person.role === 'contractor' ? 'bg-purple-100 text-purple-800' :
                        person.role === 'staff' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {person.role || 'worker'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 inline" />
                        Joined: {joinDateStr}
                      </span>
                      <span className="font-semibold text-slate-700">₹{person.perDayWage}/d</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Calendar Section */}
          <div className="lg:col-span-3 space-y-4">
            {selectedLabour ? (
              <>
                {/* Person Header Info Card with Prominent DATE JOINED */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900">{selectedLabour.name}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        selectedLabour.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {selectedLabour.status === 'active' ? 'Active Worker' : `Left Work (${selectedLabour.leftDate || 'N/A'})`}
                      </span>
                      <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded font-mono font-bold">
                        Wage: ₹{selectedLabour.perDayWage}/day
                      </span>
                    </div>

                    {/* Date Joined Badge with Edit Support */}
                    <div className="flex items-center gap-2 pt-1">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-bold">
                        <CalendarIcon className="w-3.5 h-3.5 text-amber-600" />
                        <span>Date Joined:</span>
                        {!isEditingJoinedDate ? (
                          <span className="font-mono text-amber-950 underline decoration-amber-300">
                            {selectedLabour.joinedDate || activeProject.startDate || 'Not Specified'}
                          </span>
                        ) : (
                          <input
                            type="date"
                            value={editJoinedDateValue}
                            onChange={(e) => setEditJoinedDateValue(e.target.value)}
                            className="bg-white border border-amber-300 rounded px-1.5 py-0.5 text-xs text-slate-800 font-mono"
                          />
                        )}

                        {!isEditingJoinedDate ? (
                          <button
                            onClick={() => {
                              setEditJoinedDateValue(selectedLabour.joinedDate || activeProject.startDate || new Date().toISOString().split('T')[0]);
                              setIsEditingJoinedDate(true);
                            }}
                            className="text-amber-700 hover:text-amber-900 ml-1 cursor-pointer"
                            title="Edit Joined Date"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              onClick={handleSaveJoinedDate}
                              className="bg-emerald-600 text-white p-1 rounded hover:bg-emerald-700 cursor-pointer"
                              title="Save Date"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setIsEditingJoinedDate(false)}
                              className="bg-slate-300 text-slate-700 p-1 rounded hover:bg-slate-400 cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      {selectedLabour.contact && selectedLabour.contact !== 'N/A' && (
                        <span className="text-xs text-slate-500 font-mono bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                          📞 {selectedLabour.contact}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Monthly Attendance Stats */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-center min-w-[70px]">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">Full Days</span>
                      <span className="text-sm font-extrabold text-emerald-900 font-mono">
                        {singlePersonMonthStats.presentDays}
                      </span>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-center min-w-[70px]">
                      <span className="text-[10px] font-bold text-amber-700 uppercase block">Half Days</span>
                      <span className="text-sm font-extrabold text-amber-900 font-mono">
                        {singlePersonMonthStats.halfDays}
                      </span>
                    </div>

                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-center min-w-[70px]">
                      <span className="text-[10px] font-bold text-rose-700 uppercase block">Absent</span>
                      <span className="text-sm font-extrabold text-rose-900 font-mono">
                        {singlePersonMonthStats.absentDays}
                      </span>
                    </div>

                    <div className="bg-emerald-100 border border-emerald-300 p-2.5 rounded-lg text-center min-w-[85px]">
                      <span className="text-[10px] font-bold text-emerald-900 uppercase block">Total Worked</span>
                      <span className="text-sm font-black text-emerald-950 font-mono">
                        {singlePersonMonthStats.totalDaysWorked} Days
                      </span>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-lg text-center min-w-[95px]">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase block">Est. Wages</span>
                      <span className="text-sm font-extrabold text-indigo-900 font-mono flex items-center justify-center">
                        <IndianRupee className="w-3 h-3 inline" /> {singlePersonMonthStats.estWages.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Calendar Month Grid */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                    <span>Click day tile to toggle: <strong className="text-emerald-700">Grey ➔ Full Day (Green) ➔ Half Day (Yellow) ➔ Absent (Red) ➔ Grey</strong></span>
                    <span className="hidden sm:inline">Month: <strong>{monthName} {currentYear}</strong></span>
                  </div>

                  {/* Day of Week Headers */}
                  <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-slate-500 uppercase">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                      <div key={d} className="py-1.5 bg-slate-50 rounded border border-slate-100">
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Days Matrix */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {/* Empty Padding Cells */}
                    {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="bg-slate-50/40 rounded-lg h-20 border border-dashed border-slate-200 opacity-30" />
                    ))}

                    {/* Calendar Days */}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const dayNum = idx + 1;
                      const dateStr = formatDateStr(dayNum);
                      const rec = getAttendanceRecord(selectedLabour.id, dateStr);
                      const status = getAttendanceStatus(rec);

                      const defaultJoin = activeProject.startDate || '1970-01-01';
                      const joinDate = selectedLabour.joinedDate || defaultJoin;
                      const isBeforeJoined = dateStr < joinDate;
                      const isToday = today.toISOString().split('T')[0] === dateStr;

                      return (
                        <div
                          key={dateStr}
                          onClick={() => handleQuickToggleDay(selectedLabour.id, dateStr)}
                          className={`group relative rounded-xl h-20 p-2 border flex flex-col justify-between transition cursor-pointer select-none shadow-2xs ${
                            status === 'present'
                              ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                              : status === 'half_day'
                              ? 'bg-amber-400 text-slate-900 border-amber-500 hover:bg-amber-500'
                              : status === 'absent'
                              ? 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600'
                              : status === 'rest'
                              ? 'bg-blue-500 text-white border-blue-600'
                              : isBeforeJoined
                              ? 'bg-slate-100 text-slate-400 border-slate-200/80 hover:bg-slate-200/80'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-200/70 hover:border-slate-300'
                          } ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                        >
                          {/* Top Row: Day Number & Today Badge */}
                          <div className="flex justify-between items-start">
                            <span className={`font-mono text-xs font-black ${
                              status === 'present' || status === 'absent' || status === 'rest' ? 'text-white' : 'text-slate-800'
                            }`}>
                              {dayNum}
                            </span>

                            {isToday && (
                              <span className={`text-[8px] font-bold uppercase px-1 rounded ${
                                status === 'present' || status === 'absent' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                Today
                              </span>
                            )}
                          </div>

                          {/* Center Status Badge */}
                          <div className="flex-1 flex flex-col items-center justify-center text-center py-0.5">
                            {status === 'present' ? (
                              <div className="flex flex-col items-center">
                                <CheckCircle2 className="w-4 h-4 text-white mb-0.5" />
                                <span className="text-[10px] font-extrabold leading-tight text-white uppercase">
                                  Full Day
                                </span>
                              </div>
                            ) : status === 'half_day' ? (
                              <div className="flex flex-col items-center">
                                <Coffee className="w-4 h-4 text-slate-900 mb-0.5" />
                                <span className="text-[10px] font-extrabold leading-tight text-slate-900 uppercase">
                                  Half Day
                                </span>
                              </div>
                            ) : status === 'absent' ? (
                              <div className="flex flex-col items-center">
                                <XCircle className="w-4 h-4 text-white mb-0.5" />
                                <span className="text-[10px] font-extrabold leading-tight text-white uppercase">
                                  Absent
                                </span>
                              </div>
                            ) : status === 'rest' ? (
                              <span className="text-[10px] font-bold text-white uppercase">
                                Rest/Off
                              </span>
                            ) : isBeforeJoined ? (
                              <span className="text-[9px] text-slate-400 font-medium italic">
                                Pre-Join
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 group-hover:text-slate-600 font-medium">
                                Unmarked
                              </span>
                            )}
                          </div>

                          {/* Bottom Row: Day Worked Credit */}
                          <div className="flex justify-between items-end text-[9px] font-mono">
                            {status === 'present' ? (
                              <span className="text-emerald-100 font-bold">1.0 Day</span>
                            ) : status === 'half_day' ? (
                              <span className="text-slate-800 font-bold">0.5 Day</span>
                            ) : status === 'absent' ? (
                              <span className="text-rose-100 font-bold">0.0 Day</span>
                            ) : (
                              <span className="text-slate-400 group-hover:text-slate-600 font-sans text-[8px]">
                                Click to mark
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDayModal({
                                  dateStr,
                                  labourId: selectedLabour.id,
                                  existingRecord: rec
                                });
                              }}
                              className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition ${
                                status === 'present' || status === 'absent' ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-300 hover:bg-slate-400 text-slate-800'
                              }`}
                              title="Custom Options"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 space-y-2">
                <HelpCircle className="w-8 h-8 mx-auto" />
                <p className="text-xs font-semibold">Select a worker from the sidebar list to open their attendance calendar.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: ALL PERSONNEL MATRIX GRID */}
      {viewMode === 'all' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-0">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Monthly Personnel Attendance Grid ({monthName} {currentYear})
              </h4>
              <p className="text-[10px] text-slate-500">
                Summary attendance grid for all registered workers & staff. Click any cell to toggle attendance status.
              </p>
            </div>
            <div className="text-xs font-mono font-bold bg-slate-200 px-2.5 py-1 rounded-lg text-slate-800">
              {labours.length} Total Workers
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase text-[9px] tracking-wider">
                  <th className="px-3 py-2 min-w-[140px] sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                    Worker Name
                  </th>
                  <th className="px-3 py-2 min-w-[110px] text-slate-500 border-r border-slate-200">
                    Date Joined
                  </th>
                  <th className="px-3 py-2 text-center min-w-[100px] border-r border-slate-200">
                    Days Worked
                  </th>
                  {Array.from({ length: daysInMonth }).map((_, idx) => (
                    <th key={idx + 1} className="px-1 py-2 text-center min-w-[24px]">
                      {idx + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLabours.map((person) => {
                  const defaultJoin = activeProject.startDate || new Date().toISOString().split('T')[0];
                  const joinDate = person.joinedDate || defaultJoin;

                  let monthDaysWorked = 0;

                  for (let d = 1; d <= daysInMonth; d++) {
                    const dStr = formatDateStr(d);
                    if (dStr < joinDate) continue; // Skip pre-join days from monthly stats
                    const rec = getAttendanceRecord(person.id, dStr);
                    const st = getAttendanceStatus(rec);
                    if (st === 'present') monthDaysWorked += 1;
                    if (st === 'half_day') monthDaysWorked += 0.5;
                  }

                  return (
                    <tr key={person.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      {/* Name & Role */}
                      <td className="px-3 py-2 font-semibold text-slate-800 sticky left-0 bg-white border-r border-slate-200 z-10 shadow-xs">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[130px] font-bold">{person.name}</span>
                          <span className="text-[9px] text-slate-400 capitalize">{person.role || 'worker'} • ₹{person.perDayWage}/d</span>
                        </div>
                      </td>

                      {/* Prominent DATE JOINED */}
                      <td className="px-3 py-2 font-mono text-[11px] text-amber-900 bg-amber-50/30 border-r border-slate-200">
                        <span className="font-bold">{joinDate}</span>
                      </td>

                      {/* Days Worked Summary */}
                      <td className="px-3 py-2 text-center font-mono border-r border-slate-200 text-xs font-bold text-emerald-800 bg-emerald-50/20">
                        {monthDaysWorked} Days
                      </td>

                      {/* Daily Cells (1..31) */}
                      {Array.from({ length: daysInMonth }).map((_, idx) => {
                        const dayNum = idx + 1;
                        const dateStr = formatDateStr(dayNum);
                        const isBeforeJoined = dateStr < joinDate;
                        const rec = getAttendanceRecord(person.id, dateStr);
                        const status = getAttendanceStatus(rec);

                        return (
                          <td key={dayNum} className="p-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (isBeforeJoined) {
                                  alert(`Cannot mark attendance for ${person.name} on ${dateStr} as they joined on ${person.joinedDate}.`);
                                  return;
                                }
                                handleQuickToggleDay(person.id, dateStr);
                              }}
                              className={`w-6 h-7 rounded border font-mono text-[10px] font-bold flex items-center justify-center transition cursor-pointer ${
                                isBeforeJoined
                                  ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
                                  : status === 'present'
                                  ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                                  : status === 'half_day'
                                  ? 'bg-amber-400 text-slate-900 border-amber-500 hover:bg-amber-500'
                                  : status === 'absent'
                                  ? 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600'
                                  : status === 'rest'
                                  ? 'bg-blue-500 text-white border-blue-600'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              }`}
                              title={
                                isBeforeJoined
                                  ? `${person.name} - Pre-join date (Joined: ${joinDate})`
                                  : `${person.name} - ${dateStr}: ${
                                      status === 'present' ? 'Full Day (1.0)' :
                                      status === 'half_day' ? 'Half Day (0.5)' :
                                      status === 'absent' ? 'Absent (0.0)' :
                                      'Unmarked'
                                    }`
                              }
                            >
                              {isBeforeJoined ? '-' : status === 'present' ? 'P' : status === 'half_day' ? 'H' : status === 'absent' ? 'A' : dayNum}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CUSTOM ATTENDANCE OPTION MODAL */}
      {activeDayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Attendance Options</h4>
                <p className="text-xs text-slate-500 font-mono">Date: {activeDayModal.dateStr}</p>
              </div>
              <button
                onClick={() => setActiveDayModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Set attendance status for <strong>{labours.find(l => l.id === activeDayModal.labourId)?.name}</strong>:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleSetStatus(activeDayModal.labourId, activeDayModal.dateStr, 'present')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-between transition cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> 🟢 Full Day (Present)
                </span>
                <span className="font-mono">1.0 Day</span>
              </button>

              <button
                onClick={() => handleSetStatus(activeDayModal.labourId, activeDayModal.dateStr, 'half_day')}
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-between transition cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Coffee className="w-4 h-4" /> 🟡 Half Day
                </span>
                <span className="font-mono">0.5 Day</span>
              </button>

              <button
                onClick={() => handleSetStatus(activeDayModal.labourId, activeDayModal.dateStr, 'absent')}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-between transition cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> 🔴 Absent
                </span>
                <span className="font-mono">0.0 Day</span>
              </button>

              <button
                onClick={() => handleSetStatus(activeDayModal.labourId, activeDayModal.dateStr, 'rest')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-between transition cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" /> 🔵 Rest / Weekly Off
                </span>
                <span className="font-mono">Off</span>
              </button>

              <button
                onClick={() => handleSetStatus(activeDayModal.labourId, activeDayModal.dateStr, 'unmarked')}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer border border-slate-200"
              >
                ⚪ Clear / Reset to Unmarked
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

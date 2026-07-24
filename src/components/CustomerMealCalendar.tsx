import React, { useState, useMemo } from 'react';
import { Project, Labour, FoodLog } from '../types';
import { generateId } from '../utils/id';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  Utensils, 
  User, 
  Clock, 
  CalendarDays,
  Grid,
  List,
  Edit2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  IndianRupee,
  Plus
} from 'lucide-react';

interface CustomerMealCalendarProps {
  activeProject: Project;
  labours: Labour[];
  foodLogs: FoodLog[];
  onAddFoodLog: (log: FoodLog) => Promise<void>;
  onUpdateFoodLog?: (log: FoodLog) => Promise<void>;
  onDeleteFoodLog: (id: string) => Promise<void>;
  onUpdateLabour?: (labour: Labour) => Promise<void>;
}

export default function CustomerMealCalendar({
  activeProject,
  labours,
  foodLogs,
  onAddFoodLog,
  onUpdateFoodLog,
  onDeleteFoodLog,
  onUpdateLabour,
}: CustomerMealCalendarProps) {
  // Currently selected person / customer
  const [selectedLabourId, setSelectedLabourId] = useState<string>(
    labours.length > 0 ? labours[0].id : ''
  );

  // Month navigation state
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed

  // View mode: 'single' (focused calendar for 1 person) or 'all' (matrix view for all people)
  const [viewMode, setViewMode] = useState<'single' | 'all'>('single');

  // Search / filter for labour select
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Selected Day Popover state for quick meal editing
  const [activeDayModal, setActiveDayModal] = useState<{
    dateStr: string;
    personId: string;
    existingLog?: FoodLog;
  } | null>(null);

  // Editing Joined Date inline
  const [isEditingJoinedDate, setIsEditingJoinedDate] = useState(false);
  const [editJoinedDateValue, setEditJoinedDateValue] = useState('');

  // Filter & sort labours based on search, role, status & join date
  const filteredLabours = useMemo(() => {
    return labours
      .filter(l => {
        const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (l.contact && l.contact.includes(searchTerm));
        const matchesRole = roleFilter === 'all' || l.role === roleFilter || 
                            (roleFilter === 'worker' && (!l.role || l.role === 'worker'));
        return matchesSearch && matchesRole;
      })
      .sort((a, b) => {
        const aActive = a.status === 'active';
        const bActive = b.status === 'active';
        // Active / new members at top, Left members at bottom
        if (aActive && !bActive) return -1;
        if (!aActive && bActive) return 1;

        // Newest joined first
        const aJoined = a.joinedDate || '';
        const bJoined = b.joinedDate || '';
        if (aJoined !== bJoined) {
          return bJoined.localeCompare(aJoined);
        }
        return a.name.localeCompare(b.name);
      });
  }, [labours, searchTerm, roleFilter]);

  // Selected Labour Object
  const selectedLabour = useMemo(() => {
    return filteredLabours.find(l => l.id === selectedLabourId) || filteredLabours[0] || labours.find(l => l.id === selectedLabourId) || labours[0] || null;
  }, [labours, filteredLabours, selectedLabourId]);

  // Handle Month Navigation
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

  // Helper to format date string YYYY-MM-DD
  const formatDateStr = (dayNum: number): string => {
    const monthPadded = String(currentMonth + 1).padStart(2, '0');
    const dayPadded = String(dayNum).padStart(2, '0');
    return `${currentYear}-${monthPadded}-${dayPadded}`;
  };

  // Get food log for a specific labour and date string
  const getLogForPersonAndDate = (personId: string, dateStr: string): FoodLog | undefined => {
    return foodLogs.find(f => f.labourId === personId && f.date === dateStr);
  };

  // Determine meal status for a specific log/date:
  // 'eaten' (Green) -> FoodLog exists with mealsCount > 0 and notes not "Absent"
  // 'absent' (Red) -> FoodLog exists with mealsCount === 0 or notes containing "Absent"
  // 'unmarked' (Grey) -> No FoodLog exists
  const getMealStatus = (log?: FoodLog): 'eaten' | 'absent' | 'unmarked' => {
    if (!log) return 'unmarked';
    const isExplicitAbsent = log.mealsCount === 0 || 
                             (log.notes && log.notes.toLowerCase().includes('absent'));
    if (isExplicitAbsent) return 'absent';
    return 'eaten';
  };

  // Quick 1-Click Toggle for a Day:
  // Unmarked (Grey) -> Eaten (Green, 1 Meal) -> Absent (Red, 0 Meals) -> Unmarked (Grey)
  const handleQuickToggleDay = async (personId: string, dateStr: string) => {
    const existingLog = getLogForPersonAndDate(personId, dateStr);
    const status = getMealStatus(existingLog);

    if (status === 'unmarked') {
      // Create Green (Eaten)
      const newLog: FoodLog = {
        id: generateId('food'),
        projectId: activeProject.id,
        labourId: personId,
        date: dateStr,
        mealsCount: 1,
        cost: 100,
        notes: 'Daily Mess'
      };
      await onAddFoodLog(newLog);
    } else if (status === 'eaten') {
      // Toggle to Red (Absent)
      if (existingLog) {
        if (onUpdateFoodLog) {
          await onUpdateFoodLog({
            ...existingLog,
            mealsCount: 0,
            cost: 0,
            notes: 'Absent / Missed Meal'
          });
        } else {
          await onDeleteFoodLog(existingLog.id);
          const absentLog: FoodLog = {
            id: generateId('food'),
            projectId: activeProject.id,
            labourId: personId,
            date: dateStr,
            mealsCount: 0,
            cost: 0,
            notes: 'Absent / Missed Meal'
          };
          await onAddFoodLog(absentLog);
        }
      }
    } else if (status === 'absent') {
      // Reset to Unmarked (Delete log)
      if (existingLog) {
        await onDeleteFoodLog(existingLog.id);
      }
    }
  };

  // Handle Mark Eaten Specifically
  const handleSetEaten = async (personId: string, dateStr: string, mealsCount: number = 1) => {
    const existingLog = getLogForPersonAndDate(personId, dateStr);
    if (existingLog) {
      if (onUpdateFoodLog) {
        await onUpdateFoodLog({
          ...existingLog,
          mealsCount,
          cost: 100,
          notes: mealsCount === 1 ? 'Daily Mess' : `${mealsCount} Meals`
        });
      }
    } else {
      const newLog: FoodLog = {
        id: generateId('food'),
        projectId: activeProject.id,
        labourId: personId,
        date: dateStr,
        mealsCount,
        cost: 100,
        notes: mealsCount === 1 ? 'Daily Mess' : `${mealsCount} Meals`
      };
      await onAddFoodLog(newLog);
    }
    setActiveDayModal(null);
  };

  // Handle Mark Absent Specifically
  const handleSetAbsent = async (personId: string, dateStr: string) => {
    const existingLog = getLogForPersonAndDate(personId, dateStr);
    if (existingLog) {
      if (onUpdateFoodLog) {
        await onUpdateFoodLog({
          ...existingLog,
          mealsCount: 0,
          cost: 0,
          notes: 'Absent / Missed Meal'
        });
      }
    } else {
      const newLog: FoodLog = {
        id: generateId('food'),
        projectId: activeProject.id,
        labourId: personId,
        date: dateStr,
        mealsCount: 0,
        cost: 0,
        notes: 'Absent / Missed Meal'
      };
      await onAddFoodLog(newLog);
    }
    setActiveDayModal(null);
  };

  // Handle Clear / Delete Log
  const handleSetUnmarked = async (personId: string, dateStr: string) => {
    const existingLog = getLogForPersonAndDate(personId, dateStr);
    if (existingLog) {
      await onDeleteFoodLog(existingLog.id);
    }
    setActiveDayModal(null);
  };

  // Save updated Joined Date for Labour
  const handleSaveJoinedDate = async () => {
    if (!selectedLabour || !onUpdateLabour) return;
    const updated: Labour = {
      ...selectedLabour,
      joinedDate: editJoinedDateValue || undefined
    };
    await onUpdateLabour(updated);
    setIsEditingJoinedDate(false);
  };

  // Month Name string
  const monthName = new Date(currentYear, currentMonth, 1).toLocaleString('default', { month: 'long' });

  // Calculate stats for current month for selected person
  const singlePersonMonthStats = useMemo(() => {
    if (!selectedLabour) return { eatenDays: 0, totalMeals: 0, absentDays: 0, unmarkedDays: 0, totalCost: 0 };

    let eatenDays = 0;
    let totalMeals = 0;
    let absentDays = 0;
    let totalCost = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDateStr(day);
      const log = getLogForPersonAndDate(selectedLabour.id, dateStr);
      const st = getMealStatus(log);
      if (st === 'eaten') {
        eatenDays++;
        const meals = log?.mealsCount || 1;
        totalMeals += meals;
        totalCost += meals * (log?.cost || 100);
      } else if (st === 'absent') {
        absentDays++;
      }
    }

    const unmarkedDays = daysInMonth - (eatenDays + absentDays);

    return { eatenDays, totalMeals, absentDays, unmarkedDays, totalCost };
  }, [selectedLabour, currentYear, currentMonth, daysInMonth, foodLogs]);

  if (labours.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <User className="w-10 h-10 text-slate-400 mx-auto" />
        <h3 className="text-sm font-bold text-slate-700">No Customers or Personnel Found</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Please add workers, staff, or contractors under the Worker Directory to track their daily meal calendar.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & View Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-4.5 h-4.5 text-indigo-600" />
              Customer & Labour Meal Calendar
            </h3>
            <p className="text-xs text-slate-500">
              Visual meal tracking calendar: <span className="text-emerald-700 font-bold">Green = Eaten</span>, <span className="text-rose-700 font-bold">Red = Absent</span>, <span className="text-slate-500 font-bold">Grey = Unmarked</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 rounded-lg p-1 text-xs font-semibold">
              <button
                onClick={() => setViewMode('single')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'single' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Customer Month View
              </button>
              <button
                onClick={() => setViewMode('all')}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'all' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                All Personnel Summary Grid
              </button>
            </div>
          </div>
        </div>

        {/* Legend Bar & Month Selector */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          {/* Month Selector Controls */}
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
              className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1.5 rounded-lg border border-indigo-200 transition cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Color Legend Bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200 font-semibold">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-600 inline-block" />
              <span>Green: Eaten</span>
            </div>
            <div className="flex items-center gap-1.5 bg-rose-50 text-rose-800 px-2.5 py-1 rounded-full border border-rose-200 font-semibold">
              <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-600 inline-block" />
              <span>Red: Absent / No Meal</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 font-semibold">
              <span className="w-3 h-3 rounded-full bg-slate-300 border border-slate-400 inline-block" />
              <span>Grey: Not Marked</span>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: SINGLE CUSTOMER DETAILED CALENDAR */}
      {viewMode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Customer / Personnel Selector Sidebar */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-xl p-4 space-y-4 shadow-xs">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Select Customer / Worker</span>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                {filteredLabours.length}
              </span>
            </h4>

            {/* Filter controls */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg text-xs p-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              <div className="flex gap-1 text-[10px] font-semibold">
                <button
                  onClick={() => setRoleFilter('all')}
                  className={`flex-1 py-1 rounded border ${roleFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  All
                </button>
                <button
                  onClick={() => setRoleFilter('worker')}
                  className={`flex-1 py-1 rounded border ${roleFilter === 'worker' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  Worker
                </button>
                <button
                  onClick={() => setRoleFilter('contractor')}
                  className={`flex-1 py-1 rounded border ${roleFilter === 'contractor' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  Contractor
                </button>
                <button
                  onClick={() => setRoleFilter('staff')}
                  className={`flex-1 py-1 rounded border ${roleFilter === 'staff' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  Staff
                </button>
              </div>
            </div>

            {/* Person List */}
            <div className="max-h-[380px] overflow-y-auto space-y-1 pr-1 border-t border-slate-100 pt-2">
              {filteredLabours.map((person) => {
                const isSelected = person.id === selectedLabourId;
                const defaultJoin = activeProject.startDate || new Date().toISOString().split('T')[0];
                const joinDateStr = person.joinedDate || defaultJoin;

                return (
                  <button
                    key={person.id}
                    onClick={() => {
                      setSelectedLabourId(person.id);
                      setIsEditingJoinedDate(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg border transition flex flex-col gap-1 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300 text-indigo-900'
                        : 'bg-slate-50/50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-1">
                      <span className="font-bold text-xs truncate">{person.name}</span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        person.role === 'contractor' ? 'bg-purple-100 text-purple-800' :
                        person.role === 'staff' ? 'bg-blue-100 text-blue-800' :
                        person.role === 'other' ? 'bg-amber-100 text-amber-800' :
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
                      {person.status === 'left' && (
                        <span className="text-rose-600 font-semibold">(Left)</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Calendar View for Selected Person */}
          <div className="lg:col-span-3 space-y-4">
            {selectedLabour ? (
              <>
                {/* Person Information Card with Prominent DATE JOINED */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-slate-900">{selectedLabour.name}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                        selectedLabour.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}>
                        {selectedLabour.status === 'active' ? 'Active Status' : `Left Work (${selectedLabour.leftDate || 'N/A'})`}
                      </span>
                      <span className="text-xs text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded font-semibold">
                        Role: {selectedLabour.role || 'worker'}
                      </span>
                    </div>

                    {/* Date Joined Section - Prominently Displayed & Editable */}
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

                        {onUpdateLabour && (
                          !isEditingJoinedDate ? (
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
                          )
                        )}
                      </div>

                      {selectedLabour.contact && selectedLabour.contact !== 'N/A' && (
                        <span className="text-xs text-slate-500 font-mono bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                          📞 {selectedLabour.contact}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Monthly Stats Summary Cards */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-center min-w-[75px]">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">Eaten</span>
                      <span className="text-sm font-extrabold text-emerald-900 font-mono">
                        {singlePersonMonthStats.eatenDays} Days
                      </span>
                      <span className="text-[9px] text-emerald-600 block">({singlePersonMonthStats.totalMeals} Meals)</span>
                    </div>

                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg text-center min-w-[75px]">
                      <span className="text-[10px] font-bold text-rose-700 uppercase block">Absent</span>
                      <span className="text-sm font-extrabold text-rose-900 font-mono">
                        {singlePersonMonthStats.absentDays} Days
                      </span>
                      <span className="text-[9px] text-rose-600 block">(No Meal)</span>
                    </div>

                    <div className="bg-slate-100 border border-slate-200 p-2.5 rounded-lg text-center min-w-[75px]">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Unmarked</span>
                      <span className="text-sm font-extrabold text-slate-700 font-mono">
                        {singlePersonMonthStats.unmarkedDays} Days
                      </span>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-lg text-center min-w-[85px]">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase block">Food Cost</span>
                      <span className="text-sm font-extrabold text-indigo-900 font-mono flex items-center justify-center">
                        <IndianRupee className="w-3 h-3 inline" /> {singlePersonMonthStats.totalCost.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Interactive Month Calendar Grid */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                    <span>Click any day tile to toggle status: <strong className="text-emerald-700">Grey ➔ Green (Eaten) ➔ Red (Absent) ➔ Grey</strong></span>
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
                    {/* Empty Padding Cells for Offset */}
                    {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="bg-slate-50/40 rounded-lg h-20 border border-dashed border-slate-200 opacity-30" />
                    ))}

                    {/* Actual Calendar Days */}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const dayNum = idx + 1;
                      const dateStr = formatDateStr(dayNum);
                      const log = getLogForPersonAndDate(selectedLabour.id, dateStr);
                      const status = getMealStatus(log);

                      // Check if day is prior to Date Joined
                      const defaultJoin = activeProject.startDate || '1970-01-01';
                      const joinDate = selectedLabour.joinedDate || defaultJoin;
                      const isBeforeJoined = dateStr < joinDate;

                      // Check if day is today
                      const isToday = today.toISOString().split('T')[0] === dateStr;

                      return (
                        <div
                          key={dateStr}
                          onClick={() => handleQuickToggleDay(selectedLabour.id, dateStr)}
                          className={`group relative rounded-xl h-20 p-2 border flex flex-col justify-between transition cursor-pointer select-none shadow-2xs ${
                            status === 'eaten'
                              ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                              : status === 'absent'
                              ? 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600'
                              : isBeforeJoined
                              ? 'bg-slate-100 text-slate-400 border-slate-200/80 hover:bg-slate-200/80'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-200/70 hover:border-slate-300'
                          } ${isToday ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                        >
                          {/* Top Row: Day Number & Today indicator */}
                          <div className="flex justify-between items-start">
                            <span className={`font-mono text-xs font-black ${
                              status === 'eaten' || status === 'absent' ? 'text-white' : 'text-slate-800'
                            }`}>
                              {dayNum}
                            </span>

                            {isToday && (
                              <span className={`text-[8px] font-bold uppercase px-1 rounded ${
                                status === 'eaten' || status === 'absent' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                              }`}>
                                Today
                              </span>
                            )}
                          </div>

                          {/* Center Status Badge / Icon */}
                          <div className="flex-1 flex flex-col items-center justify-center text-center py-0.5">
                            {status === 'eaten' ? (
                              <div className="flex flex-col items-center">
                                <CheckCircle2 className="w-4 h-4 text-white mb-0.5" />
                                <span className="text-[10px] font-extrabold leading-tight text-white uppercase">
                                  {log?.mealsCount === 1 ? 'Eaten' : `${log?.mealsCount} Meals`}
                                </span>
                              </div>
                            ) : status === 'absent' ? (
                              <div className="flex flex-col items-center">
                                <XCircle className="w-4 h-4 text-white mb-0.5" />
                                <span className="text-[10px] font-extrabold leading-tight text-white uppercase">
                                  Absent
                                </span>
                              </div>
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

                          {/* Bottom Row: Cost / Quick Action hint */}
                          <div className="flex justify-between items-end text-[9px] font-mono">
                            {status === 'eaten' ? (
                              <span className="text-emerald-100 font-bold">₹{log ? log.mealsCount * log.cost : 100}</span>
                            ) : status === 'absent' ? (
                              <span className="text-rose-100 font-bold">₹0</span>
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
                                  personId: selectedLabour.id,
                                  existingLog: log
                                });
                              }}
                              className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition ${
                                status === 'eaten' || status === 'absent' ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-300 hover:bg-slate-400 text-slate-800'
                              }`}
                              title="Custom Meal Options"
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
                <p className="text-xs font-semibold">Select a customer or worker from the left list to view their meal calendar.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: ALL PERSONNEL SUMMARY MATRIX */}
      {viewMode === 'all' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-0">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Monthly Meal Matrix ({monthName} {currentYear})
              </h4>
              <p className="text-[10px] text-slate-500">
                Summary meal calendar for all registered personnel. Hover or click tiles to set meal status.
              </p>
            </div>
            <div className="text-xs font-mono font-bold bg-slate-200 px-2.5 py-1 rounded-lg text-slate-800">
              {labours.length} Total Customers & Workers
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-bold uppercase text-[9px] tracking-wider">
                  <th className="px-3 py-2 min-w-[140px] sticky left-0 bg-slate-100 z-10 border-r border-slate-200">
                    Customer / Person
                  </th>
                  <th className="px-3 py-2 min-w-[110px] text-slate-500 border-r border-slate-200">
                    Date Joined
                  </th>
                  <th className="px-3 py-2 text-center min-w-[90px] border-r border-slate-200">
                    Eaten / Absent
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

                  let monthEatenCount = 0;
                  let monthAbsentCount = 0;

                  for (let d = 1; d <= daysInMonth; d++) {
                    const dStr = formatDateStr(d);
                    const log = getLogForPersonAndDate(person.id, dStr);
                    const st = getMealStatus(log);
                    if (st === 'eaten') monthEatenCount++;
                    if (st === 'absent') monthAbsentCount++;
                  }

                  return (
                    <tr key={person.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      {/* Name & Role */}
                      <td className="px-3 py-2 font-semibold text-slate-800 sticky left-0 bg-white border-r border-slate-200 z-10 shadow-xs">
                        <div className="flex flex-col">
                          <span className="truncate max-w-[130px] font-bold">{person.name}</span>
                          <span className="text-[9px] text-slate-400 capitalize">{person.role || 'worker'}</span>
                        </div>
                      </td>

                      {/* Prominent DATE JOINED */}
                      <td className="px-3 py-2 font-mono text-[11px] text-amber-900 bg-amber-50/30 border-r border-slate-200">
                        <span className="font-bold">{joinDate}</span>
                      </td>

                      {/* Count Badge */}
                      <td className="px-3 py-2 text-center font-mono border-r border-slate-200 text-[10px]">
                        <span className="text-emerald-700 font-bold">{monthEatenCount}d Eaten</span>
                        {monthAbsentCount > 0 && (
                          <span className="text-rose-600 font-semibold block">{monthAbsentCount}d Absent</span>
                        )}
                      </td>

                      {/* Daily Tiles (1 to 28/30/31) */}
                      {Array.from({ length: daysInMonth }).map((_, idx) => {
                        const dayNum = idx + 1;
                        const dateStr = formatDateStr(dayNum);
                        const log = getLogForPersonAndDate(person.id, dateStr);
                        const status = getMealStatus(log);

                        return (
                          <td key={dayNum} className="p-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleQuickToggleDay(person.id, dateStr)}
                              className={`w-6 h-7 rounded border font-mono text-[10px] font-bold flex items-center justify-center transition cursor-pointer ${
                                status === 'eaten'
                                  ? 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                                  : status === 'absent'
                                  ? 'bg-rose-500 text-white border-rose-600 hover:bg-rose-600'
                                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                              }`}
                              title={`${person.name} - ${dateStr}: ${
                                status === 'eaten' ? 'Eaten (Click to mark Absent)' :
                                status === 'absent' ? 'Absent (Click to reset Unmarked)' :
                                'Unmarked (Click to mark Eaten)'
                              }`}
                            >
                              {status === 'eaten' ? '✓' : status === 'absent' ? '✕' : dayNum}
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

      {/* CUSTOM MEAL DAY MODAL / POPOVER */}
      {activeDayModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Custom Meal Options</h4>
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
              Select meal status for <strong>{labours.find(l => l.id === activeDayModal.personId)?.name}</strong>:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleSetEaten(activeDayModal.personId, activeDayModal.dateStr, 1)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-between transition cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> 🟢 Mark Eaten (1 Meal)
                </span>
                <span className="font-mono">₹100</span>
              </button>

              <button
                onClick={() => handleSetEaten(activeDayModal.personId, activeDayModal.dateStr, 2)}
                className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-between transition cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> 🟢 Mark Eaten (2 Meals)
                </span>
                <span className="font-mono">₹200</span>
              </button>

              <button
                onClick={() => handleSetAbsent(activeDayModal.personId, activeDayModal.dateStr)}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-between transition cursor-pointer shadow-xs"
              >
                <span className="flex items-center gap-2">
                  <XCircle className="w-4 h-4" /> 🔴 Mark Absent / No Meal
                </span>
                <span className="font-mono">₹0</span>
              </button>

              <button
                onClick={() => handleSetUnmarked(activeDayModal.personId, activeDayModal.dateStr)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer border border-slate-200"
              >
                ⚪ Reset to Unmarked (Clear)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

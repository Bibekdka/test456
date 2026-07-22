import React, { useState } from 'react';
import { Project, Labour, HotelAdvance, FoodLog, Attendance, getAutoFoodDaysAndCost, getAttendanceFoodDaysAndCost } from '../types';
import { generateId } from '../utils/id';
import { Plus, Trash2, Utensils, IndianRupee, AlertCircle, Calendar, MessageSquare, History, PiggyBank, Receipt, Users, CheckCircle2, Edit2, Check, X, CalendarDays } from 'lucide-react';
import CustomerMealCalendar from './CustomerMealCalendar';

interface FoodTrackerProps {
  activeProject: Project | null;
  labours: Labour[];
  attendanceRecords: Attendance[];
  hotelAdvances: HotelAdvance[];
  foodLogs: FoodLog[];
  onAddHotelAdvance: (advance: HotelAdvance) => Promise<void>;
  onDeleteHotelAdvance: (id: string) => Promise<void>;
  onAddFoodLog: (log: FoodLog) => Promise<void>;
  onUpdateFoodLog?: (log: FoodLog) => Promise<void>;
  onDeleteFoodLog: (id: string) => Promise<void>;
  onUpdateLabour?: (labour: Labour) => Promise<void>;
  foodCalculationStartDate: string;
  onFoodCalculationStartDateChange: (date: string) => void;
}

export default function FoodTracker({
  activeProject,
  labours,
  attendanceRecords,
  hotelAdvances,
  foodLogs,
  onAddHotelAdvance,
  onDeleteHotelAdvance,
  onAddFoodLog,
  onUpdateFoodLog,
  onDeleteFoodLog,
  onUpdateLabour,
  foodCalculationStartDate,
  onFoodCalculationStartDateChange,
}: FoodTrackerProps) {
  // Filters and Forms State - Manual Mess Flow default
  const [activeSubTab, setActiveSubTab] = useState<'meals' | 'calendar' | 'advances' | 'auto-food'>('meals');
  const [useAutoFoodCalc, setUseAutoFoodCalc] = useState(false);
  
  // Quick Daily Mess Logger State
  const [quickMessDate, setQuickMessDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickMealNotes, setQuickMealNotes] = useState('Daily Mess');
  const [quickMealCost, setQuickMealCost] = useState(100);
  const [selectedQuickPersons, setSelectedQuickPersons] = useState<string[]>([]);
  
  // Hotel Advance Form
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [hotelName, setHotelName] = useState('Highway Highway Inn');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [advanceNotes, setAdvanceNotes] = useState('');
  
  // Food Log Form
  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [mealsCount, setMealsCount] = useState(1);
  const [foodDate, setFoodDate] = useState(new Date().toISOString().split('T')[0]);
  const [mealNotes, setMealNotes] = useState('Lunch');
  const [isVisitor, setIsVisitor] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [isLongTerm, setIsLongTerm] = useState(false);
  const [longTermEndDate, setLongTermEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [mealsPerDay, setMealsPerDay] = useState(1);

  // Custom inline deletion and edit states
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [deletingAdvanceId, setDeletingAdvanceId] = useState<string | null>(null);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editLabourId, setEditLabourId] = useState('');
  const [editMealsCount, setEditMealsCount] = useState(1);
  const [editCost, setEditCost] = useState(100);
  const [editNotes, setEditNotes] = useState('');

  const handleStartEdit = (log: FoodLog) => {
    setEditingLogId(log.id);
    setEditDate(log.date);
    setEditLabourId(log.labourId);
    setEditMealsCount(log.mealsCount);
    setEditCost(log.cost || 100);
    setEditNotes(log.notes || '');
  };

  const handleSaveEdit = async (log: FoodLog) => {
    if (onUpdateFoodLog) {
      await onUpdateFoodLog({
        ...log,
        date: editDate,
        labourId: editLabourId,
        mealsCount: Math.max(1, editMealsCount),
        cost: editCost,
        notes: editNotes
      });
    }
    setEditingLogId(null);
  };

  if (!activeProject) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Please select or create a project to manage hotel food tabs.</p>
      </div>
    );
  }

  // Filter lists for active project
  const projectAdvances = hotelAdvances.filter(a => a.projectId === activeProject.id);
  const projectFoodLogs = foodLogs.filter(f => f.projectId === activeProject.id);
  const projectLabourIds = new Set(
    attendanceRecords
      .filter(a => a.projectId === activeProject.id)
      .map(a => a.labourId)
  );
  const projectLabours = labours.filter(l => {
    if (projectLabourIds.has(l.id)) return true;
    if (l.status === 'active') return true;
    if (l.status === 'left' && l.joinedDate) {
      const leftDate = l.leftDate || new Date().toISOString().split('T')[0];
      if (leftDate >= activeProject.startDate) return true;
    }
    return false;
  });

  // Financial calculations
  const totalAdvances = projectAdvances.reduce((sum, a) => sum + a.amount, 0);
  const totalManualFoodCost = projectFoodLogs.reduce((sum, f) => sum + (f.mealsCount * f.cost), 0);

  // Auto food cost calculation (₹100 per day present)
  const totalAutoFoodCost = projectLabours.reduce((sum, l) => {
    const { cost } = getAttendanceFoodDaysAndCost(
      l,
      attendanceRecords,
      activeProject.id,
      foodCalculationStartDate,
      activeProject.startDate
    );
    return sum + cost;
  }, 0);

  const visitorFoodLogs = projectFoodLogs.filter(f => f.labourId === 'visitor' || f.labourId.startsWith('visitor'));
  const totalVisitorFoodCost = visitorFoodLogs.reduce((sum, f) => sum + (f.mealsCount * f.cost), 0);

  const totalFoodCost = useAutoFoodCalc ? (totalAutoFoodCost + totalVisitorFoodCost) : totalManualFoodCost;
  const remainingBalance = totalAdvances - totalFoodCost;
  const activeLabours = labours.filter(l => l.status === 'active');

  // Dynamic stay calculation for guests
  let visitorDaysCount = 0;
  if (isVisitor && isLongTerm) {
    const start = new Date(foodDate);
    const end = new Date(longTermEndDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffTime = end.getTime() - start.getTime();
      visitorDaysCount = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
    }
  }
  const displayMealsCount = (isVisitor && isLongTerm) ? (visitorDaysCount * mealsPerDay) : mealsCount;
  const displayTotalCost = displayMealsCount * 100;

  const handleAddAdvanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceAmount || parseFloat(advanceAmount) <= 0 || !hotelName.trim()) {
      alert('Please provide a valid advance amount and hotel name.');
      return;
    }

    const newAdvance: HotelAdvance = {
      id: `ha-${Date.now()}`,
      projectId: activeProject.id,
      date: advanceDate,
      amount: parseFloat(advanceAmount),
      hotelName: hotelName.trim(),
      notes: advanceNotes.trim() || undefined
    };

    await onAddHotelAdvance(newAdvance);
    setAdvanceAmount('');
    setAdvanceNotes('');
    alert('Hotel advance recorded successfully.');
  };

  const handleAddFoodLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let finalLabourId = selectedLabourId;
    let finalNotes = mealNotes.trim() || undefined;
    let finalMealsCount = mealsCount;

    if (isVisitor) {
      if (!visitorName.trim()) {
        alert('Please enter the visitor\'s name.');
        return;
      }
      finalLabourId = 'visitor';

      if (isLongTerm) {
        const start = new Date(foodDate);
        const end = new Date(longTermEndDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          alert('Please enter valid start and end dates.');
          return;
        }
        if (longTermEndDate < foodDate) {
          alert('End date cannot be before the start date.');
          return;
        }
        const diffTime = end.getTime() - start.getTime();
        const daysCount = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
        
        if (mealsPerDay <= 0) {
          alert('Meals per day must be at least 1.');
          return;
        }

        finalMealsCount = daysCount * mealsPerDay;
        const detail = mealNotes.trim() ? ` - ${mealNotes.trim()}` : '';
        finalNotes = `Visitor: ${visitorName.trim()} (Long-term: ${foodDate} to ${longTermEndDate}, ${daysCount} days, ${mealsPerDay} meals/day${detail})`;
      } else {
        if (mealsCount <= 0) {
          alert('Meals count must be at least 1.');
          return;
        }
        const detail = mealNotes.trim() ? ` (${mealNotes.trim()})` : '';
        finalNotes = `Visitor: ${visitorName.trim()}${detail}`;
      }
    } else {
      if (mealsCount <= 0) {
        alert('Meals count must be at least 1.');
        return;
      }
      if (!selectedLabourId) {
        alert('Please select a labour.');
        return;
      }

      const selectedLabour = projectLabours.find(l => l.id === selectedLabourId);
      if (selectedLabour) {
        const joinDate = selectedLabour.joinedDate || activeProject.startDate;
        const endDate = selectedLabour.status === 'left' && selectedLabour.leftDate
          ? selectedLabour.leftDate
          : new Date().toISOString().split('T')[0];

        if (foodDate < joinDate || foodDate > endDate) {
          alert(`Error: The selected meal date (${foodDate}) falls outside this worker's served period (${joinDate} to ${endDate}). Please choose a valid date during their service.`);
          return;
        }
      }
    }

    // 100 Rs per meal per person
    const costPerMeal = 100;

    const newLog: FoodLog = {
      id: `fl-${Date.now()}`,
      projectId: activeProject.id,
      labourId: finalLabourId,
      date: foodDate,
      cost: costPerMeal,
      mealsCount: finalMealsCount,
      notes: finalNotes
    };

    await onAddFoodLog(newLog);
    setSelectedLabourId('');
    setVisitorName('');
    setMealsCount(1);
    setMealNotes('Lunch');
    setIsLongTerm(false);
    setMealsPerDay(1);
    alert(isVisitor ? 'Visitor meal logged. 100 Rs per meal deducted from hotel advance balance.' : 'Labour meal logged. 100 Rs per meal deducted from hotel advance balance.');
  };

  const handleQuickLogMeal = async (personId: string, count: number = 1, notes: string = 'Daily Mess') => {
    const newLog: FoodLog = {
      id: generateId('food'),
      projectId: activeProject.id,
      labourId: personId,
      date: quickMessDate,
      mealsCount: count,
      cost: quickMealCost,
      notes: notes
    };
    await onAddFoodLog(newLog);
  };

  const handleBatchLogMeals = async (count: number = 1) => {
    if (selectedQuickPersons.length === 0) {
      alert('Please select at least one person to log meals for.');
      return;
    }
    for (const personId of selectedQuickPersons) {
      const newLog: FoodLog = {
        id: generateId('food'),
        projectId: activeProject.id,
        labourId: personId,
        date: quickMessDate,
        mealsCount: count,
        cost: quickMealCost,
        notes: quickMealNotes
      };
      await onAddFoodLog(newLog);
    }
    alert(`Successfully logged ${count} meal(s) each for ${selectedQuickPersons.length} people on ${quickMessDate}.`);
    setSelectedQuickPersons([]);
  };

  const getLabourName = (id: string, notes?: string) => {
    if (id === 'visitor' || id.startsWith('visitor')) {
      if (notes && notes.startsWith('Visitor: ')) {
        const parts = notes.split(' (');
        return parts[0];
      }
      return 'Visitor / Guest';
    }
    const l = labours.find(item => item.id === id);
    if (!l) return 'Unknown';
    const roleBadge = l.role === 'contractor' ? ' [Contractor]' : l.role === 'staff' ? ' [Staff]' : l.role === 'other' ? ' [Personnel]' : '';
    return `${l.name}${roleBadge}`;
  };

  // Monthly Food Expenses Breakdown calculation
  const [showMonthlyFoodDetails, setShowMonthlyFoodDetails] = useState(false);

  const monthlyFoodData = React.useMemo(() => {
    const monthsMap = new Map<string, { monthKey: string; monthLabel: string; mealsCount: number; manualCost: number; advances: number; attendanceDays: number; autoCost: number }>();

    const getMonthObj = (dateStr: string) => {
      if (!dateStr || dateStr.length < 7) return null;
      const monthKey = dateStr.substring(0, 7); // YYYY-MM
      if (!monthsMap.has(monthKey)) {
        const [y, m] = monthKey.split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        const monthLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthsMap.set(monthKey, {
          monthKey,
          monthLabel,
          mealsCount: 0,
          manualCost: 0,
          advances: 0,
          attendanceDays: 0,
          autoCost: 0
        });
      }
      return monthsMap.get(monthKey)!;
    };

    projectFoodLogs.forEach(f => {
      const obj = getMonthObj(f.date);
      if (obj) {
        obj.mealsCount += f.mealsCount || 1;
        obj.manualCost += (f.mealsCount || 1) * (f.cost || 0);
      }
    });

    projectAdvances.forEach(h => {
      const obj = getMonthObj(h.date);
      if (obj) {
        obj.advances += h.amount || 0;
      }
    });

    const projectAttendance = attendanceRecords.filter(a => a.projectId === activeProject?.id);
    projectAttendance.forEach(att => {
      if (att.status === 'present' || att.status === 'half_day') {
        const obj = getMonthObj(att.date);
        if (obj) {
          const dayVal = att.status === 'present' ? 1 : 0.5;
          obj.attendanceDays += dayVal;
          obj.autoCost += dayVal * 100;
        }
      }
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [projectFoodLogs, projectAdvances, attendanceRecords, activeProject]);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-indigo-600" />
            Hotel Food & Mess Tab Manager
          </h2>
          <p className="text-xs text-slate-500">Manual daily mess recording for workers, contractors, and staff with hotel advance tracking.</p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1 text-xs font-semibold flex-wrap gap-1">
          <button
            onClick={() => setActiveSubTab('meals')}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'meals' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Daily Meals & Mess Log
          </button>
          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`px-3 py-1.5 rounded-md transition flex items-center gap-1.5 ${activeSubTab === 'calendar' ? 'bg-white shadow-xs text-indigo-700 font-extrabold' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
            Meal Calendar (Green/Red/Grey)
          </button>
          <button
            onClick={() => setActiveSubTab('advances')}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'advances' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Hotel Advances ({projectAdvances.length})
          </button>
          <button
            onClick={() => setActiveSubTab('auto-food')}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'auto-food' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Auto Calc (₹100/Day)
          </button>
        </div>
      </div>

      {/* Financial Status Banner Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Advances */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 text-indigo-700 rounded-lg">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Hotel Advances</span>
            <span className="text-lg font-extrabold text-slate-800 flex items-center">
              <IndianRupee className="w-4 h-4 inline" /> {totalAdvances.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Total Food Cost */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
              <Utensils className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Total Food Cost {useAutoFoodCalc ? '(Auto ₹100/Day)' : '(Manual Logs)'}
              </span>
              <span className="text-lg font-extrabold text-slate-800 flex items-center">
                <IndianRupee className="w-4 h-4 inline" /> {totalFoodCost.toLocaleString()}
                {useAutoFoodCalc ? (
                  <span className="text-xs text-slate-500 font-normal ml-1">({projectLabours.length} workers)</span>
                ) : (
                  <span className="text-xs text-slate-500 font-normal ml-1">({projectFoodLogs.reduce((sum, f) => sum + f.mealsCount, 0)} meals)</span>
                )}
              </span>
            </div>
          </div>
          <button
            onClick={() => setUseAutoFoodCalc(!useAutoFoodCalc)}
            className="text-[10px] bg-white border border-slate-200 text-slate-600 hover:text-slate-900 font-bold px-2.5 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
            title="Switch calculation method"
          >
            Switch to {useAutoFoodCalc ? 'Manual' : 'Auto'}
          </button>
        </div>

        {/* Remaining Advance Balance */}
        <div className={`border rounded-xl p-4 flex items-center gap-4 ${remainingBalance < 1000 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <div className={`p-3 rounded-lg ${remainingBalance < 1000 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remaining Balance</span>
            <span className={`text-lg font-extrabold flex items-center ${remainingBalance < 1000 ? 'text-red-700' : 'text-emerald-700'}`}>
              <IndianRupee className="w-4 h-4 inline" /> {remainingBalance.toLocaleString()}
            </span>
            {remainingBalance < 1000 && (
              <span className="text-[9px] text-red-500 font-medium block">Balance Low! Pay advance to hotel.</span>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Food Expenses Breakdown Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowMonthlyFoodDetails(!showMonthlyFoodDetails)}>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                Monthly Food & Hotel Outlay Breakdown
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {monthlyFoodData.length} Months Logged
                </span>
              </h3>
              <p className="text-[10px] text-slate-500">Month-by-month food mess expenses, hotel advance payments, and auto-accruals.</p>
            </div>
          </div>
          <button className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer">
            {showMonthlyFoodDetails ? 'Hide Monthly Table ▲' : 'View Monthly Breakdown ▼'}
          </button>
        </div>

        {showMonthlyFoodDetails && (
          <div className="overflow-x-auto border-t border-slate-100 pt-3">
            {monthlyFoodData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No monthly food or advance records logged yet.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                    <th className="p-2.5">Month</th>
                    <th className="p-2.5 text-right">Hotel Advances Paid (₹)</th>
                    <th className="p-2.5 text-right">Manual Food Logs (₹)</th>
                    <th className="p-2.5 text-right">Auto Attendance Food (₹)</th>
                    <th className="p-2.5 text-right font-black">Net Food Outlay (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {monthlyFoodData.map((m) => {
                    const effectiveOutlay = useAutoFoodCalc ? m.autoCost : m.manualCost;
                    return (
                      <tr key={m.monthKey} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-bold font-sans text-slate-800 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                          {m.monthLabel}
                        </td>
                        <td className="p-2.5 text-right text-indigo-700 font-semibold">
                          ₹{m.advances.toLocaleString('en-IN')}
                        </td>
                        <td className="p-2.5 text-right text-amber-700">
                          ₹{m.manualCost.toLocaleString('en-IN')} <span className="text-[9px] text-slate-400 font-sans">({m.mealsCount} meals)</span>
                        </td>
                        <td className="p-2.5 text-right text-emerald-700">
                          ₹{m.autoCost.toLocaleString('en-IN')} <span className="text-[9px] text-slate-400 font-sans">({m.attendanceDays} days)</span>
                        </td>
                        <td className="p-2.5 text-right font-black text-slate-900 bg-slate-50/50">
                          ₹{effectiveOutlay.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {activeSubTab === 'auto-food' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="bg-slate-50 px-4 py-3.5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Auto-Accrued Labour Food Registry
              </h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Calculates ₹100 per day present for each worker based on attendance records from the chosen date onwards.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  Calculate From:
                </label>
                <input
                  type="date"
                  value={foodCalculationStartDate}
                  onChange={(e) => onFoodCalculationStartDateChange(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg text-xs px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                />
                {foodCalculationStartDate && (
                  <button
                    onClick={() => onFoodCalculationStartDateChange('')}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                    title="Clear filter and calculate for all days"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono font-bold px-2.5 py-1.5 rounded-lg border border-indigo-100">
                  ₹ {totalAutoFoodCost.toLocaleString()} Auto Food Total
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-800 font-mono font-bold px-2.5 py-1.5 rounded-lg">
                  {projectLabours.length} Workers Registered
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {projectLabours.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-2">
                <Users className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-xs font-medium">No workers registered for this construction project yet.</p>
                <p className="text-[11px] text-slate-400">Add worker profiles with valid joining dates under the Worker Directory tab.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                    <th className="px-4 py-3">Worker Name</th>
                    <th className="px-4 py-3">Wage Rate</th>
                    <th className="px-4 py-3">Serving Period / Dates</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Days Present</th>
                    <th className="px-4 py-3 text-right">Total Cost (₹100/Day)</th>
                  </tr>
                </thead>
                <tbody>
                  {projectLabours.map((l) => {
                    const { daysPresent, cost } = getAttendanceFoodDaysAndCost(
                      l,
                      attendanceRecords,
                      activeProject.id,
                      foodCalculationStartDate,
                      activeProject.startDate
                    );
                    const defaultJoin = activeProject.startDate || new Date().toISOString().split('T')[0];
                    const joinDate = l.joinedDate || defaultJoin;
                    const endDateStr = l.status === 'left' && l.leftDate ? l.leftDate : new Date().toISOString().split('T')[0];
                    
                    // Compute calendar days served
                    const startD = new Date(joinDate);
                    const endD = new Date(endDateStr);
                    startD.setHours(0, 0, 0, 0);
                    endD.setHours(0, 0, 0, 0);
                    const diff = endD.getTime() - startD.getTime();
                    const servedDays = diff < 0 ? 0 : Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;

                    return (
                      <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50/30 text-slate-700">
                        <td className="px-4 py-3 font-semibold text-slate-800">{l.name}</td>
                        <td className="px-4 py-3 text-slate-500">₹{l.perDayWage}/day</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-mono text-slate-700 text-xs">
                              {joinDate} {l.status === 'left' ? `→ ${l.leftDate}` : '→ Present'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              {servedDays} Calendar {servedDays === 1 ? 'Day' : 'Days'} Served
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {l.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              <span className="w-1 h-1 rounded-full bg-emerald-500" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                              <span className="w-1 h-1 rounded-full bg-rose-500" /> Left Work
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold font-mono text-slate-800">{daysPresent} days</td>
                        <td className="px-4 py-3 text-right font-bold font-mono text-slate-900">₹{cost.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'calendar' && activeProject && (
        <CustomerMealCalendar
          activeProject={activeProject}
          labours={labours}
          foodLogs={foodLogs}
          onAddFoodLog={onAddFoodLog}
          onUpdateFoodLog={onUpdateFoodLog}
          onDeleteFoodLog={onDeleteFoodLog}
          onUpdateLabour={onUpdateLabour}
        />
      )}

      {activeSubTab === 'meals' && (
        <div className="space-y-6">
          {/* Quick Daily Mess Sheet for Easy Manual Recording */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Utensils className="w-4.5 h-4.5 text-amber-500" />
                  Quick Daily Mess Sheet
                </h3>
                <p className="text-xs text-slate-500">Easily log daily mess/meals for workers, contractors, staff, and personnel day-by-day in 1 click.</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Mess Date:</label>
                <input
                  type="date"
                  value={quickMessDate}
                  onChange={(e) => setQuickMessDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded px-2.5 py-1 text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Quick Mess Grid of All Site Personnel */}
            {projectLabours.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No active workers or contractors registered for this site.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {projectLabours.map((person) => {
                  const existingLogs = projectFoodLogs.filter(f => f.labourId === person.id && f.date === quickMessDate);
                  const mealsLoggedToday = existingLogs.reduce((sum, log) => sum + log.mealsCount, 0);

                  const roleTag = person.role === 'contractor'
                    ? '🏗️ Contractor'
                    : person.role === 'staff'
                    ? '👔 Staff'
                    : person.role === 'other'
                    ? '👤 Personnel'
                    : '👷 Worker';

                  return (
                    <div key={person.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col justify-between gap-2 hover:border-slate-300 transition">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-bold text-xs text-slate-800 truncate" title={person.name}>{person.name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                            person.role === 'contractor'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : person.role === 'staff'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : person.role === 'other'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {roleTag}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 flex justify-between items-center">
                          <span>Logged on {quickMessDate}:</span>
                          <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${mealsLoggedToday > 0 ? 'bg-amber-100 text-amber-800' : 'text-slate-400'}`}>
                            {mealsLoggedToday} {mealsLoggedToday === 1 ? 'Meal' : 'Meals'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => handleQuickLogMeal(person.id, 1)}
                          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-1.5 px-2 rounded text-[11px] font-bold cursor-pointer transition text-center shadow-xs"
                          title="Log 1 Meal (@ ₹100)"
                        >
                          +1 Meal
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickLogMeal(person.id, 2)}
                          className="bg-slate-800 hover:bg-slate-900 text-white py-1.5 px-2 rounded text-[11px] font-bold cursor-pointer transition text-center shadow-xs"
                          title="Log 2 Meals (@ ₹200)"
                        >
                          +2 Meals
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Food Log Form */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                Custom Single Meal Entry
              </h3>
              <form onSubmit={handleAddFoodLogSubmit} className="space-y-4">
                {/* Type Toggle: Labour vs Visitor */}
                <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setIsVisitor(false)}
                    className={`flex-1 py-1 px-2.5 rounded-md text-center cursor-pointer transition ${!isVisitor ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Registered Personnel
                  </button>
                  <button
                    type="button"
                    id="add-visitor-meal-btn"
                    onClick={() => setIsVisitor(true)}
                    className={`flex-1 py-1 px-2.5 rounded-md text-center cursor-pointer transition ${isVisitor ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    Visitor / Guest
                  </button>
                </div>

                {!isVisitor ? (
                  /* Select Labour / Contractor / Staff */
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="food-labour" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Select Person</label>
                      <select
                        id="food-labour"
                        value={selectedLabourId}
                        onChange={(e) => setSelectedLabourId(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                        required
                      >
                        <option value="">-- Choose Worker / Contractor / Staff --</option>
                        {projectLabours.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name} [{l.role === 'contractor' ? 'Contractor' : l.role === 'staff' ? 'Staff' : l.role === 'other' ? 'Personnel' : 'Worker'}] {l.status === 'left' ? `(Left on ${l.leftDate || 'N/A'})` : '(Active)'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {(() => {
                      const selectedLabour = projectLabours.find(l => l.id === selectedLabourId);
                    if (!selectedLabour) return null;
                    const defaultJoin = activeProject.startDate || new Date().toISOString().split('T')[0];
                    const joinDate = selectedLabour.joinedDate || defaultJoin;
                    const endDate = selectedLabour.status === 'left' && selectedLabour.leftDate
                      ? selectedLabour.leftDate
                      : 'Present';
                    return (
                      <div className="mt-2 p-2 bg-slate-100 rounded-lg border border-slate-200 text-[10px] text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-700">Worker Serving Period Info:</p>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className={`font-bold ${selectedLabour.status === 'active' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {selectedLabour.status === 'active' ? 'Active' : 'Left Work'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Joined:</span>
                          <span className="font-mono font-bold">{joinDate}</span>
                        </div>
                        {selectedLabour.status === 'left' && (
                          <div className="flex justify-between">
                            <span>Left Project:</span>
                            <span className="font-mono font-bold text-rose-600">{endDate}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* Visitor Form Fields */
                <div className="space-y-3">
                  <div>
                    <label htmlFor="visitor-name" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Visitor / Guest Name</label>
                    <input
                      type="text"
                      id="visitor-name"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="e.g. Inspector, Client, Subcontractor"
                      className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      required
                    />
                  </div>

                  {/* Checkbox: Long-term stay */}
                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="is-long-term"
                      checked={isLongTerm}
                      onChange={(e) => setIsLongTerm(e.target.checked)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="is-long-term" className="text-xs text-slate-700 font-medium cursor-pointer select-none">
                      Guest is staying for multiple days
                    </label>
                  </div>
                </div>
              )}

              {/* Meals & Dates Fields based on Long Term stay option */}
              {isVisitor && isLongTerm ? (
                /* Long Term Fields */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="meals-per-day" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Meals Per Day</label>
                      <input
                        type="number"
                        id="meals-per-day"
                        min="1"
                        max="10"
                        value={mealsPerDay}
                        onChange={(e) => setMealsPerDay(parseInt(e.target.value) || 1)}
                        className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Rate</label>
                      <div className="w-full bg-slate-100 border border-slate-200 text-slate-600 text-xs rounded-lg p-2.5 font-semibold flex items-center">
                        <IndianRupee className="w-3.5 h-3.5 inline text-slate-400 mr-0.5" /> 100 / meal
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="food-start-date" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Check-In Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="date"
                          id="food-start-date"
                          value={foodDate}
                          onChange={(e) => setFoodDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg pl-9 pr-2.5 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="food-end-date" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Check-Out Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="date"
                          id="food-end-date"
                          value={longTermEndDate}
                          onChange={(e) => setLongTermEndDate(e.target.value)}
                          className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg pl-9 pr-2.5 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {visitorDaysCount > 0 && (
                    <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] text-indigo-800 font-medium space-y-1">
                      <div className="flex justify-between">
                        <span>Stay Duration:</span>
                        <span className="font-bold">{visitorDaysCount} Days</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Meals:</span>
                        <span className="font-bold">{displayMealsCount} Meals ({mealsPerDay}/day)</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Regular/Short Term Fields */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="meals-count" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Meals Count</label>
                      <input
                        type="number"
                        id="meals-count"
                        min="1"
                        max="10"
                        value={mealsCount}
                        onChange={(e) => setMealsCount(parseInt(e.target.value) || 1)}
                        className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Rate</label>
                      <div className="w-full bg-slate-100 border border-slate-200 text-slate-600 text-xs rounded-lg p-2.5 font-semibold flex items-center">
                        <IndianRupee className="w-3.5 h-3.5 inline text-slate-400 mr-0.5" /> 100 / meal
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="food-date" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="date"
                        id="food-date"
                        value={foodDate}
                        onChange={(e) => setFoodDate(e.target.value)}
                        className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg pl-9 pr-2.5 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes / Meal Type */}
              <div>
                <label htmlFor="meal-notes" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Meal Notes / Type</label>
                <input
                  type="text"
                  id="meal-notes"
                  value={mealNotes}
                  onChange={(e) => setMealNotes(e.target.value)}
                  placeholder={isLongTerm ? "e.g. All Meals, Boarding & Food" : "e.g. Lunch, Dinner, Breakfast"}
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              {/* Cost Summary Box */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900 flex justify-between items-center">
                <span>Total deduction:</span>
                <span className="font-bold text-sm flex items-center">
                  <IndianRupee className="w-3.5 h-3.5 inline" /> {displayTotalCost.toLocaleString()}
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 px-4 rounded-lg transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Utensils className="w-4 h-4" />
                Deduct & Save Log
              </button>
            </form>
          </div>

          {/* Meals log history table */}
          <div className="lg:col-span-2 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                Meals Deduction History
              </h3>
              <span className="text-[10px] bg-slate-200 text-slate-800 font-mono font-bold px-2 py-0.5 rounded-full">
                {projectFoodLogs.length} Records
              </span>
            </div>

            <div className="flex-1 overflow-x-auto">
              {projectFoodLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-2">
                  <Utensils className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-xs font-medium">No meals logged for this project yet.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Labour Name</th>
                      <th className="px-4 py-3">Meals Count</th>
                      <th className="px-4 py-3 text-right">Deduction</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectFoodLogs
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((log) => {
                        const totalDeducted = log.mealsCount * log.cost;

                        if (editingLogId === log.id) {
                          return (
                            <tr key={log.id} className="border-b border-indigo-200 bg-indigo-50/50 text-slate-800">
                              <td className="px-3 py-2 font-mono">
                                <input
                                  type="date"
                                  value={editDate}
                                  onChange={(e) => setEditDate(e.target.value)}
                                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                                  required
                                />
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={editLabourId}
                                  onChange={(e) => setEditLabourId(e.target.value)}
                                  className="bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 max-w-[140px]"
                                >
                                  <option value="visitor">👤 Visitor / Guest</option>
                                  {labours.map(l => (
                                    <option key={l.id} value={l.id}>
                                      {l.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    value={editMealsCount}
                                    onChange={(e) => setEditMealsCount(parseInt(e.target.value) || 1)}
                                    className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                                    required
                                  />
                                  <span className="text-[10px] text-slate-500">meals</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <span className="text-[10px] text-slate-400">@ ₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editCost}
                                    onChange={(e) => setEditCost(parseFloat(e.target.value) || 0)}
                                    className="w-16 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono text-right focus:ring-1 focus:ring-indigo-500"
                                    required
                                  />
                                  <span className="font-bold text-xs text-indigo-900 ml-1">
                                    = ₹{editMealsCount * editCost}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={editNotes}
                                  onChange={(e) => setEditNotes(e.target.value)}
                                  placeholder="Notes..."
                                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleSaveEdit(log)}
                                    className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition shadow-sm cursor-pointer"
                                    title="Save changes"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setEditingLogId(null)}
                                    className="p-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/30 text-slate-700">
                            <td className="px-4 py-3 font-mono text-slate-600">{log.date}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{getLabourName(log.labourId, log.notes)}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-md font-mono text-xs">
                                {log.mealsCount} {log.mealsCount === 1 ? 'Meal' : 'Meals'}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-900 text-right">
                              ₹{totalDeducted}
                            </td>
                            <td className="px-4 py-3 text-slate-500 italic max-w-[120px] truncate" title={log.notes}>
                              {log.notes || '—'}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {deletingLogId === log.id ? (
                                <div className="flex items-center justify-center gap-1.5 animate-fade-in">
                                  <button
                                    onClick={async () => {
                                      await onDeleteFoodLog(log.id);
                                      setDeletingLogId(null);
                                    }}
                                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeletingLogId(null)}
                                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-medium cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleStartEdit(log)}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition cursor-pointer"
                                    title="Edit meal log"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingLogId(log.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 rounded-md transition cursor-pointer"
                                    title="Delete meal log"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {activeSubTab === 'advances' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Hotel Advance Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Add Hotel Advance
            </h3>
            <form onSubmit={handleAddAdvanceSubmit} className="space-y-4">
              {/* Hotel Name */}
              <div>
                <label htmlFor="hotel-name" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Hotel / Restaurant Name</label>
                <input
                  type="text"
                  id="hotel-name"
                  value={hotelName}
                  onChange={(e) => setHotelName(e.target.value)}
                  placeholder="e.g. Kamakhya Highway Inn"
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  required
                />
              </div>

              {/* Advance Amount */}
              <div>
                <label htmlFor="hotel-adv-amount" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Advance Amount (Rs.)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                    ₹
                  </div>
                  <input
                    type="number"
                    id="hotel-adv-amount"
                    placeholder="e.g. 5000"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg pl-8 pr-2.5 py-2.5 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Advance Date */}
              <div>
                <label htmlFor="hotel-adv-date" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Date Paid</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    id="hotel-adv-date"
                    value={advanceDate}
                    onChange={(e) => setAdvanceDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg pl-9 pr-2.5 py-2 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="hotel-adv-notes" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Notes / Description</label>
                <input
                  type="text"
                  id="hotel-adv-notes"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  placeholder="e.g. Cash paid, bank transfer ref"
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold py-2.5 px-4 rounded-lg transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Add Advance
              </button>
            </form>
          </div>

          {/* Advances list history */}
          <div className="lg:col-span-2 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                Hotel Advances Registry
              </h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-mono font-bold px-2 py-0.5 rounded-full">
                ₹ {totalAdvances.toLocaleString()} Total Paid
              </span>
            </div>

            <div className="flex-1 overflow-x-auto">
              {projectAdvances.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-2">
                  <PiggyBank className="w-10 h-10 mx-auto opacity-40" />
                  <p className="text-xs font-medium">No hotel advances added yet.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Hotel Name</th>
                      <th className="px-4 py-3 text-right">Amount Paid</th>
                      <th className="px-4 py-3">Notes</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectAdvances
                      .sort((a, b) => b.date.localeCompare(a.date))
                      .map((adv) => (
                        <tr key={adv.id} className="border-b border-slate-100 hover:bg-slate-50/30 text-slate-700">
                          <td className="px-4 py-3 font-mono text-slate-600">{adv.date}</td>
                          <td className="px-4 py-3 font-semibold text-slate-800">{adv.hotelName}</td>
                          <td className="px-4 py-3 font-bold text-slate-900 text-right">
                            ₹{adv.amount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-slate-500 italic max-w-[150px] truncate" title={adv.notes}>
                            {adv.notes || '—'}
                          </td>
                           <td className="px-4 py-3 text-center">
                             {deletingAdvanceId === adv.id ? (
                               <div className="flex items-center justify-center gap-1.5 animate-fade-in">
                                 <button
                                   onClick={async () => {
                                     await onDeleteHotelAdvance(adv.id);
                                     setDeletingAdvanceId(null);
                                   }}
                                   className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                 >
                                   Confirm
                                 </button>
                                 <button
                                   onClick={() => setDeletingAdvanceId(null)}
                                   className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-medium cursor-pointer"
                                 >
                                   Cancel
                                 </button>
                               </div>
                             ) : (
                               <button
                                 onClick={() => setDeletingAdvanceId(adv.id)}
                                 className="p-1 text-slate-400 hover:text-red-600 rounded-md transition cursor-pointer"
                                 title="Delete hotel advance"
                                >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                             )}
                           </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

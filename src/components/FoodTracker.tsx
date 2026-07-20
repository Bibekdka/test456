import React, { useState } from 'react';
import { Project, Labour, HotelAdvance, FoodLog, Attendance, getAutoFoodDaysAndCost, getAttendanceFoodDaysAndCost } from '../types';
import { Plus, Trash2, Utensils, IndianRupee, AlertCircle, Calendar, MessageSquare, History, PiggyBank, Receipt, Users, CheckCircle2 } from 'lucide-react';

interface FoodTrackerProps {
  activeProject: Project | null;
  labours: Labour[];
  attendanceRecords: Attendance[];
  hotelAdvances: HotelAdvance[];
  foodLogs: FoodLog[];
  onAddHotelAdvance: (advance: HotelAdvance) => Promise<void>;
  onDeleteHotelAdvance: (id: string) => Promise<void>;
  onAddFoodLog: (log: FoodLog) => Promise<void>;
  onDeleteFoodLog: (id: string) => Promise<void>;
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
  onDeleteFoodLog,
  foodCalculationStartDate,
  onFoodCalculationStartDateChange,
}: FoodTrackerProps) {
  // Filters and Forms State
  const [activeSubTab, setActiveSubTab] = useState<'meals' | 'advances' | 'auto-food'>('auto-food');
  const [useAutoFoodCalc, setUseAutoFoodCalc] = useState(true);
  
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

  const totalFoodCost = useAutoFoodCalc ? totalAutoFoodCost : totalManualFoodCost;
  const remainingBalance = totalAdvances - totalFoodCost;
  const activeLabours = labours.filter(l => l.status === 'active');

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
    if (!selectedLabourId) {
      alert('Please select a labour.');
      return;
    }
    if (mealsCount <= 0) {
      alert('Meals count must be at least 1.');
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

    // 100 Rs per meal per person
    const costPerMeal = 100;

    const newLog: FoodLog = {
      id: `fl-${Date.now()}`,
      projectId: activeProject.id,
      labourId: selectedLabourId,
      date: foodDate,
      cost: costPerMeal,
      mealsCount: mealsCount,
      notes: mealNotes.trim() || undefined
    };

    await onAddFoodLog(newLog);
    setSelectedLabourId('');
    setMealsCount(1);
    setMealNotes('Lunch');
    alert('Labour meal logged. 100 Rs per meal deducted from hotel advance balance.');
  };

  const getLabourName = (id: string) => {
    const l = labours.find(item => item.id === id);
    return l ? l.name : 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-indigo-600" />
            Hotel Food Tab Manager
          </h2>
          <p className="text-xs text-slate-500">Track paid advances, log daily meals at Rs. 100 per person, and check balance.</p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('auto-food')}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'auto-food' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Auto Food (₹100/Day)
          </button>
          <button
            onClick={() => setActiveSubTab('meals')}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'meals' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Meals Ledger
          </button>
          <button
            onClick={() => setActiveSubTab('advances')}
            className={`px-3 py-1.5 rounded-md transition ${activeSubTab === 'advances' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Hotel Advances ({projectAdvances.length})
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

      {activeSubTab === 'meals' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Food Log Form */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Log Labour Meal
            </h3>
            <form onSubmit={handleAddFoodLogSubmit} className="space-y-4">
              {/* Select Labour */}
              <div>
                <label htmlFor="food-labour" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Select Labour</label>
                <select
                  id="food-labour"
                  value={selectedLabourId}
                  onChange={(e) => setSelectedLabourId(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                  required
                >
                  <option value="">-- Choose Labour --</option>
                  {projectLabours.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.status === 'left' ? `(Left on ${l.leftDate || 'N/A'})` : '(Active)'} - Wage: ₹{l.perDayWage}
                    </option>
                  ))}
                </select>

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

              {/* Meals Count & Price Note */}
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

              {/* Meal Date */}
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

              {/* Notes / Meal Type */}
              <div>
                <label htmlFor="meal-notes" className="block text-[11px] font-semibold text-slate-500 uppercase mb-1">Meal Notes / Type</label>
                <input
                  type="text"
                  id="meal-notes"
                  value={mealNotes}
                  onChange={(e) => setMealNotes(e.target.value)}
                  placeholder="e.g. Lunch, Dinner, Breakfast"
                  className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              {/* Cost Summary Box */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-900 flex justify-between items-center">
                <span>Total deduction:</span>
                <span className="font-bold text-sm flex items-center">
                  <IndianRupee className="w-3.5 h-3.5 inline" /> {mealsCount * 100}
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
                        return (
                          <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50/30 text-slate-700">
                            <td className="px-4 py-3 font-mono text-slate-600">{log.date}</td>
                            <td className="px-4 py-3 font-semibold text-slate-800">{getLabourName(log.labourId)}</td>
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
                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete this food log? The amount will be refunded back to the hotel advance.')) {
                                    await onDeleteFoodLog(log.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 rounded-md transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
                            <button
                              onClick={async () => {
                                if (confirm('Are you sure you want to delete this hotel advance? This will reduce the hotel balance.')) {
                                  await onDeleteHotelAdvance(adv.id);
                                }
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-md transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

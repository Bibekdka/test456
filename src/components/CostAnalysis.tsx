import React from 'react';
import { Project, Labour, Attendance, Advance, Payment, Material, HotelAdvance, FoodLog, DailyExpense, getAutoFoodDaysAndCost, getAttendanceFoodDaysAndCost } from '../types';
import { 
  TrendingUp, IndianRupee, AlertCircle, Calendar, Briefcase, 
  Users, Truck, Utensils, Percent, CircleDollarSign, ShieldAlert 
} from 'lucide-react';

interface CostAnalysisProps {
  activeProject: Project | null;
  labours: Labour[];
  attendanceRecords: Attendance[];
  advanceRecords: Advance[];
  paymentRecords: Payment[];
  materials: Material[];
  hotelAdvances: HotelAdvance[];
  foodLogs: FoodLog[];
  dailyExpenses: DailyExpense[];
  foodCalculationStartDate: string;
  onFoodCalculationStartDateChange: (date: string) => void;
}

export default function CostAnalysis({
  activeProject,
  labours,
  attendanceRecords,
  advanceRecords,
  paymentRecords,
  materials,
  hotelAdvances,
  foodLogs,
  dailyExpenses,
  foodCalculationStartDate,
  onFoodCalculationStartDateChange
}: CostAnalysisProps) {
  const [useAutoFoodCalc, setUseAutoFoodCalc] = React.useState(true);

  if (!activeProject) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Please select or create a project to view cost analysis.</p>
      </div>
    );
  }

  // 1. Data Filtering for this project
  const projectAttendance = attendanceRecords.filter(a => a.projectId === activeProject.id);
  const projectAdvances = advanceRecords.filter(a => a.projectId === activeProject.id);
  const projectPayments = paymentRecords.filter(p => p.projectId === activeProject.id);
  const projectMaterials = materials.filter(m => m.projectId === activeProject.id);
  const projectHotelAdvances = hotelAdvances.filter(a => a.projectId === activeProject.id);
  const projectFoodLogs = foodLogs.filter(f => f.projectId === activeProject.id);

  // 2. Calculations
  // A. Labour costs (Accumulated daily wages earned by attendance + outstanding payments)
  // Calculate total wages earned based on attendance records
  let totalLabourWagesEarned = 0;
  projectAttendance.forEach((att) => {
    const labour = labours.find(l => l.id === att.labourId);
    if (labour) {
      if (att.status === 'present') {
        totalLabourWagesEarned += labour.perDayWage;
      } else if (att.status === 'half_day') {
        totalLabourWagesEarned += labour.perDayWage / 2;
      }
    }
  });

  // Material costs
  const totalMaterialCost = projectMaterials.reduce((sum, m) => sum + m.cost, 0);

  // Food costs (The actual food logs amount vs. Auto ₹100/day Present since joining till today or leftDate)
  const totalManualFoodCost = projectFoodLogs.reduce((sum, f) => sum + (f.mealsCount * f.cost), 0);
  const projectLabourIds = new Set(projectAttendance.map(a => a.labourId));
  const projectLabours = labours.filter(l => {
    if (projectLabourIds.has(l.id)) return true;
    if (l.status === 'active') return true;
    if (l.status === 'left' && l.joinedDate) {
      const leftDate = l.leftDate || new Date().toISOString().split('T')[0];
      if (leftDate >= activeProject.startDate) return true;
    }
    return false;
  });
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

  // Daily Expenses and Misc
  const projectExpenses = (dailyExpenses || []).filter(e => e.projectId === activeProject.id);
  const totalDailyExpensesCost = projectExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Total project cost
  const totalProjectCost = totalLabourWagesEarned + totalMaterialCost + totalFoodCost + totalDailyExpensesCost;
  
  // Budget left
  const budgetRemaining = activeProject.budget - totalProjectCost;
  const burnRatePercent = activeProject.budget > 0 ? (totalProjectCost / activeProject.budget) * 100 : 0;

  // Timeline calculations
  const start = new Date(activeProject.startDate);
  const target = new Date(activeProject.targetDate);
  const today = new Date();
  
  const totalTimelineDays = Math.ceil((target.getTime() - start.getTime()) / (1000 * 3600 * 24)) || 1;
  const elapsedDays = Math.ceil((today.getTime() - start.getTime()) / (1000 * 3600 * 24));
  const daysRemaining = Math.ceil((target.getTime() - today.getTime()) / (1000 * 3600 * 24));
  
  const timelineProgressPercent = Math.min(100, Math.max(0, (elapsedDays / totalTimelineDays) * 100));

  // Category percentages
  const labourPercent = totalProjectCost > 0 ? (totalLabourWagesEarned / totalProjectCost) * 100 : 0;
  const materialPercent = totalProjectCost > 0 ? (totalMaterialCost / totalProjectCost) * 100 : 0;
  const foodPercent = totalProjectCost > 0 ? (totalFoodCost / totalProjectCost) * 100 : 0;
  const dailyExpensesPercent = totalProjectCost > 0 ? (totalDailyExpensesCost / totalProjectCost) * 100 : 0;

  // Rule-based actionable insights
  const insights: { type: 'alert' | 'warning' | 'good', message: string, title: string }[] = [];

  if (burnRatePercent > 90) {
    insights.push({
      type: 'alert',
      title: 'Budget Almost Exhausted',
      message: `You have burned ${burnRatePercent.toFixed(1)}% of your project budget with ${daysRemaining} days remaining. Consider pausing additional material purchases or restructuring labor distribution.`
    });
  } else if (burnRatePercent > timelineProgressPercent + 15) {
    insights.push({
      type: 'warning',
      title: 'Cost Accumulation is Fast',
      message: `Your budget usage (${burnRatePercent.toFixed(0)}%) is significantly outstripping timeline progress (${timelineProgressPercent.toFixed(0)}%). Analyze materials inventory to avoid storage wastage.`
    });
  }

  if (materialPercent > 70) {
    insights.push({
      type: 'warning',
      title: 'High Material Expense Concentration',
      message: `Materials make up ${materialPercent.toFixed(0)}% of your total costs. Check if bulk raw stocks are lying idle without utilization.`
    });
  }

  if (remainingBalanceForHotel() < 1000 && projectHotelAdvances.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Hotel Advance Running Out',
      message: `The active hotel food advance has a remaining balance of ₹${remainingBalanceForHotel()}. Top up the hotel advance to ensure uninterrupted meals for workers.`
    });
  }

  if (insights.length === 0) {
    insights.push({
      type: 'good',
      title: 'Financial Health is Good',
      message: 'Project expenditures are perfectly balanced. Spends and timelines are progressing at a synchronized rate.'
    });
  }

  function remainingBalanceForHotel() {
    const totalAdv = projectHotelAdvances.reduce((sum, a) => sum + a.amount, 0);
    const visitorFoodLogs = projectFoodLogs.filter(f => f.labourId === 'visitor' || f.labourId.startsWith('visitor'));
    const totalVisitorFoodCost = visitorFoodLogs.reduce((sum, f) => sum + (f.mealsCount * f.cost), 0);
    const totalFood = useAutoFoodCalc ? (totalAutoFoodCost + totalVisitorFoodCost) : totalManualFoodCost;
    return totalAdv - totalFood;
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          Project Cost Analysis Dashboard
        </h2>
        <p className="text-xs text-slate-500">
          Consolidated business financial insights, budget allocation distribution, and timeline burn-rate alerts.
        </p>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budget */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Allocated Budget</span>
          <div className="text-lg font-extrabold text-slate-800 mt-1 flex items-center gap-1">
            <IndianRupee className="w-4 h-4 text-slate-400" />
            {activeProject.budget.toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-1">Timeline Target: {activeProject.targetDate}</p>
        </div>

        {/* Total Cost Incurred */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Cost Incurred</span>
          <div className="text-lg font-extrabold text-indigo-900 mt-1 flex items-center gap-1">
            <IndianRupee className="w-4 h-4 text-indigo-400" />
            {totalProjectCost.toLocaleString()}
          </div>
          <span className="inline-block mt-1 text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded-full font-mono">
            {burnRatePercent.toFixed(1)}% Burn Rate
          </span>
        </div>

        {/* Budget Leftover */}
        <div className={`border rounded-xl p-4 ${budgetRemaining >= 0 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'}`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Remaining Balance</span>
          <div className={`text-lg font-extrabold mt-1 flex items-center gap-1 ${budgetRemaining >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
            <IndianRupee className="w-4 h-4" />
            {budgetRemaining.toLocaleString()}
          </div>
          <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono ${budgetRemaining >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
            {budgetRemaining >= 0 ? 'Under Budget' : 'Over Budget!'}
          </span>
        </div>

        {/* Days Left */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Timeline Countdown</span>
          <div className="text-lg font-extrabold text-slate-800 mt-1 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            {daysRemaining >= 0 ? `${daysRemaining} Days` : 'Overdue'}
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-1">Elapsed: {elapsedDays} / {totalTimelineDays} days ({timelineProgressPercent.toFixed(0)}%)</p>
        </div>
      </div>

      {/* Detailed Analysis Section (Charts and insights) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Cost Breakdown & Visuals */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-6">
          <div className="flex flex-col gap-2 border-b border-slate-100 pb-2">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Cost Category Distribution</h3>
              <button
                onClick={() => setUseAutoFoodCalc(!useAutoFoodCalc)}
                className="text-[10px] bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                title="Toggle between manual food meal logs and auto-accrued ₹100/day calculation"
              >
                Mode: {useAutoFoodCalc ? 'Auto ₹100/Day' : 'Manual Logs'}
              </button>
            </div>
            {useAutoFoodCalc && (
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Food Calculate From:
                </span>
                <input
                  type="date"
                  value={foodCalculationStartDate}
                  onChange={(e) => onFoodCalculationStartDateChange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg text-[10px] px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold text-slate-600"
                />
                {foodCalculationStartDate && (
                  <button
                    onClick={() => onFoodCalculationStartDateChange('')}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SVG Pie Chart / Visual Segments */}
          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
            
            {/* Custom Responsive SVG Donut Chart */}
            <div className="relative w-40 h-40 shrink-0">
              {totalProjectCost === 0 ? (
                <div className="w-full h-full rounded-full border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-center text-xs font-mono p-4">
                  No spends recorded yet
                </div>
              ) : (
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                  
                  {/* Segment 1: Labour Wages */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke="#4f46e5" 
                    strokeWidth="12" 
                    strokeDasharray={`${labourPercent * 2.512} 251.2`}
                    strokeDashoffset="0"
                  />
                  
                  {/* Segment 2: Materials */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke="#0ea5e9" 
                    strokeWidth="12" 
                    strokeDasharray={`${materialPercent * 2.512} 251.2`}
                    strokeDashoffset={`-${labourPercent * 2.512}`}
                  />
                  
                  {/* Segment 3: Hotel Food */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke="#f59e0b" 
                    strokeWidth="12" 
                    strokeDasharray={`${foodPercent * 2.512} 251.2`}
                    strokeDashoffset={`-${(labourPercent + materialPercent) * 2.512}`}
                  />
                  
                  {/* Segment 4: Daily Expenses & Misc */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    stroke="#10b981" 
                    strokeWidth="12" 
                    strokeDasharray={`${dailyExpensesPercent * 2.512} 251.2`}
                    strokeDashoffset={`-${(labourPercent + materialPercent + foodPercent) * 2.512}`}
                  />
                </svg>
              )}
              {totalProjectCost > 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/20">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Cost</span>
                  <span className="text-xs font-extrabold text-slate-700">₹{totalProjectCost > 100000 ? `${(totalProjectCost / 1000).toFixed(0)}k` : totalProjectCost.toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* Custom Interactive Legend with Percentage and Totals */}
            <div className="space-y-3 flex-1 w-full">
              {/* Labour wages */}
              <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition cursor-default">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-600" />
                  <span className="text-xs font-semibold text-slate-700">Labour Wages</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 block font-mono">₹{totalLabourWagesEarned.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{labourPercent.toFixed(0)}%</span>
                </div>
              </div>

              {/* Material Purchase */}
              <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition cursor-default">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-sky-500" />
                  <span className="text-xs font-semibold text-slate-700">Material Stocks</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 block font-mono">₹{totalMaterialCost.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{materialPercent.toFixed(0)}%</span>
                </div>
              </div>

              {/* Hotel Food Tab */}
              <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition cursor-default">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-xs font-semibold text-slate-700">Hotel Meals Cost</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 block font-mono">₹{totalFoodCost.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{foodPercent.toFixed(0)}%</span>
                </div>
              </div>

              {/* Daily Expenses & Misc */}
              <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition cursor-default">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-700">Daily Expenses & Misc</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-900 block font-mono font-semibold">₹{totalDailyExpensesCost.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{dailyExpensesPercent.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Symmetrical bar showing spent progress vs total budget */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-slate-600">Budget Spent Progress</span>
              <span className="font-bold text-slate-800">{burnRatePercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${burnRatePercent > 90 ? 'bg-red-600' : burnRatePercent > 70 ? 'bg-amber-500' : 'bg-indigo-600'}`} 
                style={{ width: `${Math.min(100, burnRatePercent)}%` }} 
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
              <span>Spent: ₹{totalProjectCost.toLocaleString()}</span>
              <span>Budget: ₹{activeProject.budget.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Business Insights & Recommendations Panel */}
        <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              Smart Business Insights
            </h3>
            
            <div className="space-y-3">
              {insights.map((ins, index) => (
                <div 
                  key={index} 
                  className={`p-3.5 rounded-lg border text-xs space-y-1 ${
                    ins.type === 'alert' 
                      ? 'bg-red-50 border-red-200 text-red-900' 
                      : ins.type === 'warning' 
                      ? 'bg-amber-50 border-amber-200 text-amber-900' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  }`}
                >
                  <h4 className="font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wide">
                    {ins.type === 'alert' && <AlertCircle className="w-3.5 h-3.5 text-red-600" />}
                    {ins.type === 'warning' && <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
                    {ins.type === 'good' && <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />}
                    {ins.title}
                  </h4>
                  <p className="leading-relaxed opacity-90">{ins.message}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Metrics Timeline Box */}
          <div className="mt-6 border-t border-slate-200/60 pt-4 space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timelines & Burn Rate</h4>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white border border-slate-200 p-2 rounded-lg">
                <span className="text-[9px] text-slate-400 block font-mono">Burn/Elapsed Day</span>
                <span className="text-xs font-bold text-slate-800">
                  ₹{elapsedDays > 0 ? (totalProjectCost / elapsedDays).toFixed(0) : totalProjectCost.toLocaleString()}
                </span>
              </div>
              <div className="bg-white border border-slate-200 p-2 rounded-lg">
                <span className="text-[9px] text-slate-400 block font-mono">Avg Daily Budget</span>
                <span className="text-xs font-bold text-slate-800">
                  ₹{(activeProject.budget / totalTimelineDays).toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

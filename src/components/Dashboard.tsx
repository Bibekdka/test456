import React, { useState } from 'react';
import { Project, Labour, Attendance, Material, FoodLog, GstRecord, DailyExpense, getAutoFoodDaysAndCost, getAttendanceFoodDaysAndCost } from '../types';
import { 
  Briefcase, Plus, Calendar, IndianRupee, Clock, Trash2, Edit, 
  TrendingUp, Users, Truck, Utensils, Percent, CircleDollarSign, 
  BarChart3, CheckCircle2, AlertTriangle, PlayCircle, Search, X, RotateCcw, MapPin
} from 'lucide-react';

interface DashboardProps {
  projects: Project[];
  labours: Labour[];
  attendanceRecords: Attendance[];
  materials: Material[];
  foodLogs: FoodLog[];
  gstRecords: GstRecord[];
  dailyExpenses: DailyExpense[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onAddProject: (project: Project) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  setActiveTab: (tab: string) => void;
  onResetDatabase: () => void;
  foodCalculationStartDate: string;
  onFoodCalculationStartDateChange: (date: string) => void;
}

export default function Dashboard({
  projects,
  labours,
  attendanceRecords,
  materials,
  foodLogs,
  gstRecords,
  dailyExpenses,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  setActiveTab,
  onResetDatabase,
  foodCalculationStartDate,
  onFoodCalculationStartDateChange
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>('all');
  const [useAutoFoodCalc, setUseAutoFoodCalc] = useState(true);
  
  // Add/Edit Modals or Forms
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'on_hold'>('active');

  // Open Form
  const handleOpenAddForm = () => {
    setName('');
    setDescription('');
    setLocation('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setTargetDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setBudget('');
    setStatus('active');
    setEditingProject(null);
    setShowAddForm(true);
  };

  const handleOpenEditForm = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(p);
    setName(p.name);
    setDescription(p.description);
    setLocation(p.location || '');
    setStartDate(p.startDate);
    setTargetDate(p.targetDate);
    setBudget(p.budget.toString());
    setStatus(p.status);
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !targetDate) return;

    const projectData: Project = {
      id: editingProject ? editingProject.id : 'p_' + Math.random().toString(36).substr(2, 9),
      name,
      description,
      location: location.trim() || undefined,
      startDate,
      targetDate,
      budget: Number(budget) || 0,
      status,
    };

    if (editingProject) {
      onUpdateProject(projectData);
    } else {
      onAddProject(projectData);
    }

    setShowAddForm(false);
    setEditingProject(null);
  };

  // Pre-calculate costs for all projects to render summary metrics
  const getProjectMetrics = (project: Project) => {
    const pId = project.id;
    const pAttendance = attendanceRecords.filter(a => a.projectId === pId);
    const pMaterials = materials.filter(m => m.projectId === pId);
    const pFoodLogs = foodLogs.filter(f => f.projectId === pId);
    const pGst = gstRecords.filter(g => g.projectId === pId);

    // Labour wages
    let labourWages = 0;
    pAttendance.forEach((att) => {
      const labour = labours.find(l => l.id === att.labourId);
      if (labour) {
        if (att.status === 'present') {
          labourWages += labour.perDayWage;
        } else if (att.status === 'half_day') {
          labourWages += labour.perDayWage / 2;
        }
      }
    });

    // Material cost
    const materialCost = pMaterials.reduce((sum, m) => sum + m.cost, 0);

    // Food Cost (Manual Logs vs. Auto ₹100/day Present since joining till today/leftDate)
    const manualFoodCost = pFoodLogs.reduce((sum, f) => sum + (f.mealsCount * f.cost), 0);
    const pLabourIds = new Set(pAttendance.map(a => a.labourId));
    const projectLabours = labours.filter(l => {
      if (pLabourIds.has(l.id)) return true;
      if (l.status === 'active') return true;
      if (l.status === 'left' && l.joinedDate) {
        const leftDate = l.leftDate || new Date().toISOString().split('T')[0];
        if (leftDate >= project.startDate) return true;
      }
      return false;
    });
    const autoFoodCost = projectLabours.reduce((sum, l) => {
      const { cost } = getAttendanceFoodDaysAndCost(
        l,
        attendanceRecords,
        project.id,
        foodCalculationStartDate,
        project.startDate
      );
      return sum + cost;
    }, 0);
    const foodCost = useAutoFoodCalc ? autoFoodCost : manualFoodCost;

    // GST Paid and Claimed
    const gstPaid = pGst.filter(g => g.type === 'paid').reduce((sum, g) => sum + g.gstAmount, 0);
    const gstClaimed = pGst.filter(g => g.type === 'claimed').reduce((sum, g) => sum + g.gstAmount, 0);

    // Daily Expenses and Misc
    const dailyExpensesCost = (dailyExpenses || [])
      .filter(e => e.projectId === pId)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalSpent = labourWages + materialCost + foodCost + dailyExpensesCost;
    const remainingBudget = project.budget - totalSpent;

    return {
      labourWages,
      materialCost,
      foodCost,
      gstPaid,
      gstClaimed,
      dailyExpensesCost,
      totalSpent,
      remainingBudget
    };
  };

  // Calculated overall metrics across all projects
  let overallBudget = 0;
  let overallLabourWages = 0;
  let overallMaterialCost = 0;
  let overallFoodCost = 0;
  let overallGstPaid = 0;
  let overallGstClaimed = 0;
  let overallDailyExpenses = 0;
  let overallSpent = 0;

  projects.forEach(p => {
    const metrics = getProjectMetrics(p);
    overallBudget += p.budget;
    overallLabourWages += metrics.labourWages;
    overallMaterialCost += metrics.materialCost;
    overallFoodCost += metrics.foodCost;
    overallGstPaid += metrics.gstPaid;
    overallGstClaimed += metrics.gstClaimed;
    overallDailyExpenses += metrics.dailyExpensesCost;
    overallSpent += metrics.totalSpent;
  });

  const overallRemainingBudget = overallBudget - overallSpent;
  const overallNetGst = overallGstClaimed - overallGstPaid;

  const lowStockMaterials = materials.filter(m => {
    if (m.alertThreshold === undefined || m.alertThreshold === null) return false;
    const totalUsed = m.usages.reduce((sum, u) => sum + u.quantityUsed, 0);
    const remaining = m.quantityBought - totalUsed;
    return remaining <= m.alertThreshold;
  });

  // Filter projects for display
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDaysLeftText = (targetDateStr: string, startDateStr: string, statusStr: string) => {
    if (statusStr === 'completed') return { text: 'Completed', color: 'text-green-600 bg-green-50 border-green-100' };

    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDateStr);
    target.setHours(0,0,0,0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)} days`, color: 'text-rose-600 bg-rose-50 border-rose-100' };
    } else if (diffDays === 0) {
      return { text: 'Deadline Today', color: 'text-amber-600 bg-amber-50 border-amber-100 font-bold' };
    } else {
      return { text: `${diffDays} days left`, color: 'text-blue-600 bg-blue-50 border-blue-100' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Overall Projects Control Panel
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Consolidated overview and ledger status of all sites, material deliveries, worker payrolls, and GST accounts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (confirm("CRITICAL WARNING: This will permanently wipe all local construction sites, workers, daily attendance sheets, advance and payment logs, material deliveries, food bills, and tax data from your browser's local cache.\n\nAre you sure you want to completely start fresh?")) {
                onResetDatabase();
              }
            }}
            className="inline-flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shadow-xs"
            title="Wipe and start completely fresh"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Database
          </button>
          <button
            onClick={handleOpenAddForm}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Construction Site
          </button>
        </div>
      </div>

      {/* Aggregate KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Budget Card */}
        <div className="bg-slate-900 text-white rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Budget (All Sites)</span>
            <div className="p-1.5 rounded-md bg-slate-800">
              <IndianRupee className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-bold tracking-tight font-mono">
              ₹{overallBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-[9px] text-slate-400 mt-1">
              Spread across {projects.length} sites
            </p>
          </div>
        </div>

        {/* Total Spent Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Spent to Date</span>
            <div className="p-1.5 rounded-md bg-rose-50 text-rose-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h4 className="text-2xl font-bold tracking-tight font-mono text-rose-700">
              ₹{overallSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 mt-1">
              <span>{overallBudget > 0 ? ((overallSpent / overallBudget) * 100).toFixed(1) : 0}% budget utilized</span>
            </div>
          </div>
        </div>

        {/* Combined Net Remaining Balance Card */}
        <div className={`border rounded-xl p-4 shadow-xs flex flex-col justify-between ${
          overallRemainingBudget < 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50/50 border-emerald-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Remaining Balance</span>
            <div className={`p-1.5 rounded-md ${overallRemainingBudget < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h4 className={`text-2xl font-bold tracking-tight font-mono ${overallRemainingBudget < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              ₹{overallRemainingBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-[9px] text-slate-500 mt-1">
              {overallRemainingBudget < 0 ? 'Sites are operating in deficit' : 'Healthy operating headroom'}
            </p>
          </div>
        </div>

        {/* Combined GST Position */}
        <div className={`border rounded-xl p-4 shadow-xs flex flex-col justify-between ${
          overallNetGst > 0 ? 'bg-amber-50/40 border-amber-200' : 'bg-indigo-50/40 border-indigo-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Net GST Position</span>
            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
              <Percent className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <div className="mt-4">
            <h4 className={`text-2xl font-bold tracking-tight font-mono ${overallNetGst > 0 ? 'text-amber-700' : 'text-indigo-700'}`}>
              ₹{Math.abs(overallNetGst).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-[9px] text-slate-500 mt-1">
              {overallNetGst > 0 ? 'Liability (Output > Input)' : 'Input Credit Available (Carry forward)'}
            </p>
          </div>
        </div>
      </div>

      {/* Central Material Stock Alerts */}
      {lowStockMaterials.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-1.5 bg-amber-100 rounded-md text-amber-700 shrink-0 mt-0.5 font-sans text-sm">
            ⚠️
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Central Material Stock Alerts ({lowStockMaterials.length} running low)</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              The following materials are currently at or below their critical thresholds. Open the corresponding project site to log deliveries or track usage:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {lowStockMaterials.map(m => {
                const project = projects.find(p => p.id === m.projectId);
                const totalUsed = m.usages.reduce((sum, u) => sum + u.quantityUsed, 0);
                const remaining = m.quantityBought - totalUsed;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (project) {
                        onSelectProject(project.id);
                        setActiveTab('materials');
                      }
                    }}
                    className="inline-flex items-center gap-1 bg-amber-100 hover:bg-amber-200 text-amber-950 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-200 font-mono transition text-left cursor-pointer"
                    title={`Click to view ${project?.name || ''}`}
                  >
                    <span>{project?.name ? `[${project.name}]` : ''} {m.name}:</span>
                    <strong className="text-rose-700">{remaining} {m.unit}</strong> left (Limit: {m.alertThreshold})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Breakdowns Sub-KPI Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Materials Cost */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Materials Spent</span>
            <h5 className="font-mono text-sm font-bold text-slate-700">
              ₹{overallMaterialCost.toLocaleString()}
            </h5>
          </div>
        </div>

        {/* Wages Cost */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-violet-50 text-violet-600">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400">Total Labour Payroll</span>
            <h5 className="font-mono text-sm font-bold text-slate-700">
              ₹{overallLabourWages.toLocaleString()}
            </h5>
          </div>
        </div>

        {/* Food Cost */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600">
              <Utensils className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5">
                Total Food Cost {useAutoFoodCalc ? '(Auto ₹100/Day)' : '(Manual Logs)'}
              </span>
              <h5 className="font-mono text-sm font-bold text-slate-700">
                ₹{overallFoodCost.toLocaleString()}
              </h5>
            </div>
          </div>
          <button
            onClick={() => setUseAutoFoodCalc(!useAutoFoodCalc)}
            className="text-[9px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 font-bold px-2 py-1 rounded transition cursor-pointer"
            title="Toggle between manual meal logs and auto-accrued ₹100/day calculation"
          >
            Use {useAutoFoodCalc ? 'Manual' : 'Auto'}
          </button>
        </div>
      </div>

      {/* Dynamic Wages & Food Analytics Hub */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <Utensils className="w-4 h-4 text-indigo-600" />
              Wages & Food Outlays Comparison Hub
            </h3>
            <p className="text-[11px] text-slate-500">
              Comparative overview highlighting payroll outlays with food cost deductions vs separate expenses.
            </p>
          </div>
          <span className="inline-block text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-full border border-indigo-100 font-mono self-start sm:self-auto">
            {useAutoFoodCalc ? "Auto Mode: ₹100/day Present" : "Manual Mode: Meal Logs"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-1.5 shadow-2xs">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block">Gross Wages Earned (No Food)</span>
            <div className="text-base font-bold text-slate-800 font-mono">
              ₹{overallLabourWages.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">Total raw worker earnings before any meal deductions are processed.</span>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-1.5 shadow-2xs">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block">Total Food Cost</span>
            <div className="text-base font-bold text-rose-600 font-mono">
              ₹{overallFoodCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-500 block leading-tight">Total catering/hotel food expenses accrued across all registered workers.</span>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 rounded-lg p-3.5 space-y-1.5 shadow-2xs">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-800 block">Net Wages (Food Deducted)</span>
            <div className="text-base font-bold text-emerald-700 font-mono">
              ₹{Math.max(0, overallLabourWages - overallFoodCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-600 block leading-tight">Net payout obligation if workers bear their own food/boarding charges.</span>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3.5 space-y-1.5 shadow-2xs">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-indigo-800 block">Combined Expense (Wages + Food)</span>
            <div className="text-base font-bold text-indigo-700 font-mono">
              ₹{(overallLabourWages + overallFoodCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-indigo-600 block leading-tight">Total actual cash outlay if you provide complimentary boarding on top of standard wages.</span>
          </div>
        </div>
      </div>

      {/* Projects Directory & Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        {/* Search, Filter & Actions Headers */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            All Sites Registry ({filteredProjects.length})
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative text-xs">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search site name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs w-[160px] focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Status Filter Dropdown */}
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-700"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Work</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
            </select>
          </div>
        </div>

        {/* Table/List of Projects */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-mono text-xs">
            <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No construction sites match the search filter.
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Site / Status</th>
                  <th className="py-2.5 px-3 text-right">Budget</th>
                  <th className="py-2.5 px-3 text-right">Wages</th>
                  <th className="py-2.5 px-3 text-right">Materials</th>
                  <th className="py-2.5 px-3 text-right">Meals</th>
                  <th className="py-2.5 px-3 text-right">Total Spent</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                  <th className="py-2.5 px-3 text-center">Timeline</th>
                  <th className="py-2.5 px-3 text-center">Control Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((p) => {
                  const m = getProjectMetrics(p);
                  const timeline = getDaysLeftText(p.targetDate, p.startDate, p.status);
                  const isCurrentActive = p.id === activeProjectId;
                  const utilPercent = p.budget > 0 ? (m.totalSpent / p.budget) * 100 : 0;

                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/40 transition ${isCurrentActive ? 'bg-slate-50/20' : ''}`}>
                      {/* Name & Status */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            p.status === 'active' ? 'bg-emerald-500' : p.status === 'completed' ? 'bg-blue-500' : 'bg-amber-500'
                          }`} />
                          <span className="font-semibold text-slate-800">{p.name}</span>
                        </div>
                        {p.description && (
                          <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1 max-w-[200px]">
                            {p.description}
                          </div>
                        )}
                        {p.location && (
                          <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium mt-1">
                            <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{p.location}</span>
                          </div>
                        )}
                      </td>

                      {/* Budget */}
                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-600">
                        ₹{p.budget.toLocaleString()}
                      </td>

                      {/* Wages */}
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        ₹{m.labourWages.toLocaleString()}
                      </td>

                      {/* Materials */}
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        ₹{m.materialCost.toLocaleString()}
                      </td>

                      {/* Meals */}
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        ₹{m.foodCost.toLocaleString()}
                      </td>

                      {/* Total Spent & Progress Bar */}
                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-slate-700">
                          ₹{m.totalSpent.toLocaleString()}
                        </div>
                        <div className="w-[100px] bg-slate-100 rounded-full h-1 mt-1 ml-auto overflow-hidden">
                          <div 
                            className={`h-full ${utilPercent > 100 ? 'bg-rose-500' : utilPercent > 80 ? 'bg-amber-500' : 'bg-indigo-600'}`} 
                            style={{ width: `${Math.min(100, utilPercent)}%` }} 
                          />
                        </div>
                      </td>

                      {/* Remaining Balance */}
                      <td className={`py-3 px-3 text-right font-mono font-bold ${
                        m.remainingBudget < 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        ₹{m.remainingBudget.toLocaleString()}
                      </td>

                      {/* Timeline */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border font-mono ${timeline.color}`}>
                          {timeline.text}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {/* SELECT SITE BUTTON */}
                          <button
                            onClick={() => {
                              onSelectProject(p.id);
                              setActiveTab('attendance'); // Redirect to attendance as active tracker
                            }}
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 cursor-pointer transition ${
                              isCurrentActive 
                                ? 'bg-slate-900 text-white' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            title="Open & Track This Site"
                          >
                            <PlayCircle className="w-3 h-3" />
                            <span>{isCurrentActive ? 'Selected' : 'Open'}</span>
                          </button>

                          {/* EDIT PROJECT BUTTON */}
                          <button
                            onClick={(e) => handleOpenEditForm(p, e)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition cursor-pointer"
                            title="Edit project budget & dates"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* DELETE PROJECT BUTTON */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`CRITICAL WARNING: Are you sure you want to delete "${p.name}"?\n\nThis will permanently delete ALL daily attendance sheets, wage logs, material deliveries, meal files, and tax records for this site! This operation cannot be undone.`)) {
                                onDeleteProject(p.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                            title="Permanently delete site ledger"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pop-up Dialog Modal for Adding/Editing Projects */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xl max-w-md w-full relative animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                {editingProject ? 'Modify Construction Site' : 'Add New Work Site'}
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Site Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dream Valley Slabs"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Site Location (City / Town)</label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. Guwahati, Assam"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Description / Scope</label>
                <textarea
                  placeholder="e.g. Masonry, plumbing, plastering etc."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Budget (Rs.)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2.5 text-slate-400 font-mono">₹</span>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="0.00"
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2.5 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Status</label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="active">Active Work</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Target Date</label>
                  <input
                    type="date"
                    required
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                >
                  {editingProject ? 'Save Changes' : 'Create Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

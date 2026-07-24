import React, { useState, useMemo } from 'react';
import { 
  Project, Labour, Attendance, Material, FoodLog, GstRecord, DailyExpense, 
  Advance, Payment, HotelAdvance, Payer,
  getAttendanceFoodDaysAndCost 
} from '../types';
import { generateId } from '../utils/id';
import { 
  Briefcase, Plus, Calendar, IndianRupee, Clock, Trash2, Edit, 
  TrendingUp, Users, Truck, Utensils, Percent, CircleDollarSign, 
  BarChart3, CheckCircle2, AlertTriangle, PlayCircle, Search, X, RotateCcw, MapPin,
  SlidersHorizontal, Info, UserCheck, Wallet, CreditCard, Coins, Building2,
  PieChart as PieChartIcon, LayoutGrid, ListFilter, ArrowUpRight, ChevronDown, ChevronUp,
  Receipt, Landmark
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardProps {
  projects: Project[];
  labours: Labour[];
  attendanceRecords: Attendance[];
  materials: Material[];
  foodLogs: FoodLog[];
  gstRecords: GstRecord[];
  dailyExpenses: DailyExpense[];
  advanceRecords?: Advance[];
  paymentRecords?: Payment[];
  hotelAdvances?: HotelAdvance[];
  payers?: Payer[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onAddProject: (project: Project) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  setActiveTab: (tab: string) => void;
  onResetDatabase: () => void;
  foodCalculationStartDate: string;
  onFoodCalculationStartDateChange: (date: string) => void;
  // Handler callbacks for edits/deletes from dashboard inspection logs
  onUpdateDailyExpense?: (exp: DailyExpense) => Promise<void>;
  onDeleteDailyExpense?: (id: string) => Promise<void>;
  onUpdateMaterial?: (mat: Material) => Promise<void>;
  onDeleteMaterial?: (id: string) => Promise<void>;
  onUpdateFoodLog?: (fl: FoodLog) => Promise<void>;
  onDeleteFoodLog?: (id: string) => Promise<void>;
  onDeleteAdvance?: (id: string) => Promise<void>;
  onDeletePayment?: (id: string) => Promise<void>;
  onDeleteHotelAdvance?: (id: string) => Promise<void>;
  onUpdatePayer?: (p: Payer) => Promise<void>;
  onDeletePayer?: (id: string) => Promise<void>;
  onUpdateGstRecord?: (gst: GstRecord) => Promise<void>;
  onDeleteGstRecord?: (id: string) => Promise<void>;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-md font-sans text-xs space-y-1.5">
        <p className="font-bold text-slate-800">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 justify-between">
            <span className="flex items-center gap-1.5 font-medium text-slate-500">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}:
            </span>
            <span className="font-bold text-slate-800 font-mono">
              ₹{Number(entry.value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        ))}
        {payload.length === 2 && (
          <div className="border-t border-slate-100 pt-1.5 mt-1.5 flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-500">Difference:</span>
            {payload[1].value > payload[0].value ? (
              <span className="text-rose-600 font-bold font-mono">
                +₹{(payload[1].value - payload[0].value).toLocaleString(undefined, { maximumFractionDigits: 0 })} (Overrun)
              </span>
            ) : (
              <span className="text-emerald-600 font-bold font-mono">
                -₹{(payload[0].value - payload[1].value).toLocaleString(undefined, { maximumFractionDigits: 0 })} (Savings)
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function Dashboard({
  projects,
  labours,
  attendanceRecords,
  materials,
  foodLogs,
  gstRecords,
  dailyExpenses,
  advanceRecords = [],
  paymentRecords = [],
  hotelAdvances = [],
  payers = [],
  activeProjectId,
  onSelectProject,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  setActiveTab,
  onResetDatabase,
  foodCalculationStartDate,
  onFoodCalculationStartDateChange,
  onUpdateDailyExpense,
  onDeleteDailyExpense,
  onUpdateMaterial,
  onDeleteMaterial,
  onUpdateFoodLog,
  onDeleteFoodLog,
  onDeleteAdvance,
  onDeletePayment,
  onDeleteHotelAdvance,
  onUpdatePayer,
  onDeletePayer,
  onUpdateGstRecord,
  onDeleteGstRecord
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'on_hold'>('all');
  const [projectDisplayMode, setProjectDisplayMode] = useState<'cards' | 'table'>('cards');
  
  // Interactive KPI Cards Modal Inspection State
  const [activeModal, setActiveModal] = useState<'budget' | 'expenses' | 'balance' | 'payers' | null>(null);
  const [expenseModalFilter, setExpenseModalFilter] = useState<'all' | 'daily' | 'materials' | 'food' | 'labour' | 'advances' | 'hotel'>('all');
  const [recordsSearchTerm, setRecordsSearchTerm] = useState('');
  const [recordsProjectFilter, setRecordsProjectFilter] = useState<string>('all');

  // Form State for Editing Individual Item Logs from Modals
  const [editingDailyExpense, setEditingDailyExpense] = useState<DailyExpense | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editingFoodLog, setEditingFoodLog] = useState<FoodLog | null>(null);
  const [editingPayerProfile, setEditingPayerProfile] = useState<Payer | null>(null);
  
  // Chart and Analytics Filter State
  const [chartView, setChartView] = useState<'overall' | 'category' | 'variance'>('overall');
  const [selectedChartProject, setSelectedChartProject] = useState<string>('all');
  const [chartMinBudget, setChartMinBudget] = useState<string>('');
  const [payerSearch, setPayerSearch] = useState<string>('');

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
  const [labourBudget, setLabourBudget] = useState('');
  const [materialBudget, setMaterialBudget] = useState('');
  const [foodBudget, setFoodBudget] = useState('');
  const [expenseBudget, setExpenseBudget] = useState('');

  // Open Form
  const handleOpenAddForm = () => {
    setName('');
    setDescription('');
    setLocation('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setTargetDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setBudget('');
    setStatus('active');
    setLabourBudget('');
    setMaterialBudget('');
    setFoodBudget('');
    setExpenseBudget('');
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
    setLabourBudget(p.labourBudget ? p.labourBudget.toString() : '');
    setMaterialBudget(p.materialBudget ? p.materialBudget.toString() : '');
    setFoodBudget(p.foodBudget ? p.foodBudget.toString() : '');
    setExpenseBudget(p.expenseBudget ? p.expenseBudget.toString() : '');
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !targetDate) return;

    const projectData: Project = {
      id: editingProject ? editingProject.id : generateId('p'),
      name,
      description,
      location: location.trim() || undefined,
      startDate,
      targetDate,
      budget: Number(budget) || 0,
      status,
      labourBudget: labourBudget ? Number(labourBudget) : undefined,
      materialBudget: materialBudget ? Number(materialBudget) : undefined,
      foodBudget: foodBudget ? Number(foodBudget) : undefined,
      expenseBudget: expenseBudget ? Number(expenseBudget) : undefined,
    };

    if (editingProject) {
      onUpdateProject(projectData);
    } else {
      onAddProject(projectData);
    }

    setShowAddForm(false);
    setEditingProject(null);
  };

  // Helper to calculate pre-computed metrics for any project
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

    // Food Cost (Logged Meals)
    const foodCost = pFoodLogs.reduce((sum, f) => sum + (f.mealsCount * f.cost), 0);
    const pLabourIds = new Set(pAttendance.map(a => a.labourId));

    // GST Paid and Claimed
    const gstPaid = pGst.filter(g => g.type === 'paid').reduce((sum, g) => sum + g.gstAmount, 0);
    const gstClaimed = pGst.filter(g => g.type === 'claimed').reduce((sum, g) => sum + g.gstAmount, 0);

    // Daily Expenses and Misc
    const dailyExpensesCost = (dailyExpenses || [])
      .filter(e => e.projectId === pId)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalSpent = labourWages + materialCost + foodCost + dailyExpensesCost;
    const remainingBudget = project.budget - totalSpent;

    // Workers count for this project
    const activeWorkersCount = pLabourIds.size;

    return {
      labourWages,
      materialCost,
      foodCost,
      gstPaid,
      gstClaimed,
      dailyExpensesCost,
      totalSpent,
      remainingBudget,
      activeWorkersCount
    };
  };

  // Overall metrics across all projects
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

  // Calculate Investor & Payer Contributions Ledger (Who invested / paid how much till date)
  const payerContributions = useMemo(() => {
    const map = new Map<string, {
      key: string;
      name: string;
      role?: string;
      totalInvested: number;
      advancesTotal: number;
      paymentsTotal: number;
      expensesTotal: number;
      hotelTotal: number;
      materialsTotal: number;
      projectAmounts: Map<string, number>;
      transactionCount: number;
    }>();

    const getOrCreatePayer = (payerKey: string, defaultName?: string) => {
      const rawKey = payerKey.trim();
      if (!rawKey) return null;

      // Find registered payer by ID or case-insensitive name
      const registered = (payers || []).find(p => 
        p.id === rawKey || 
        p.id.toLowerCase() === rawKey.toLowerCase() ||
        p.name.trim().toLowerCase() === rawKey.toLowerCase()
      );

      const canonicalKey = registered ? registered.id : rawKey.toLowerCase();
      const displayName = registered ? registered.name : (defaultName || rawKey);
      const targetLowerName = displayName.trim().toLowerCase();

      // Check if map already has this canonical key OR if any existing entry shares the same name
      let resolvedKey = canonicalKey;
      if (!map.has(canonicalKey)) {
        for (const [k, v] of map.entries()) {
          if (v.name.trim().toLowerCase() === targetLowerName) {
            resolvedKey = k;
            break;
          }
        }
      }

      if (!map.has(resolvedKey)) {
        const role = registered ? registered.role : undefined;
        map.set(resolvedKey, {
          key: resolvedKey,
          name: displayName,
          role,
          totalInvested: 0,
          advancesTotal: 0,
          paymentsTotal: 0,
          expensesTotal: 0,
          hotelTotal: 0,
          materialsTotal: 0,
          projectAmounts: new Map<string, number>(),
          transactionCount: 0
        });
      }
      return map.get(resolvedKey)!;
    };

    // Registered Payers
    (payers || []).forEach(p => {
      getOrCreatePayer(p.id, p.name);
    });

    // Advances
    (advanceRecords || []).forEach(adv => {
      if (adv.paidBy) {
        const p = getOrCreatePayer(adv.paidBy);
        if (p) {
          p.totalInvested += adv.amount;
          p.advancesTotal += adv.amount;
          p.transactionCount += 1;
          const curr = p.projectAmounts.get(adv.projectId) || 0;
          p.projectAmounts.set(adv.projectId, curr + adv.amount);
        }
      }
    });

    // Payments
    (paymentRecords || []).forEach(pay => {
      const paidBy = (pay as any).paidBy;
      if (paidBy) {
        const p = getOrCreatePayer(paidBy);
        if (p) {
          p.totalInvested += pay.amountPaid;
          p.paymentsTotal += pay.amountPaid;
          p.transactionCount += 1;
          const curr = p.projectAmounts.get(pay.projectId) || 0;
          p.projectAmounts.set(pay.projectId, curr + pay.amountPaid);
        }
      }
    });

    // Daily Expenses
    (dailyExpenses || []).forEach(exp => {
      if (exp.payerId) {
        const p = getOrCreatePayer(exp.payerId);
        if (p) {
          p.totalInvested += exp.amount;
          p.expensesTotal += exp.amount;
          p.transactionCount += 1;
          const curr = p.projectAmounts.get(exp.projectId) || 0;
          p.projectAmounts.set(exp.projectId, curr + exp.amount);
        }
      }
    });

    // Hotel Advances
    (hotelAdvances || []).forEach(ha => {
      const paidBy = (ha as any).paidBy;
      if (paidBy) {
        const p = getOrCreatePayer(paidBy);
        if (p) {
          p.totalInvested += ha.amount;
          p.hotelTotal += ha.amount;
          p.transactionCount += 1;
          const curr = p.projectAmounts.get(ha.projectId) || 0;
          p.projectAmounts.set(ha.projectId, curr + ha.amount);
        }
      }
    });

    // Materials
    (materials || []).forEach(m => {
      const paidBy = (m as any).paidBy;
      if (paidBy) {
        const p = getOrCreatePayer(paidBy);
        if (p) {
          p.totalInvested += m.cost;
          p.materialsTotal += m.cost;
          p.transactionCount += 1;
          const curr = p.projectAmounts.get(m.projectId) || 0;
          p.projectAmounts.set(m.projectId, curr + m.cost);
        }
      }
    });

    return Array.from(map.values())
      .filter(p => p.totalInvested > 0 || (payers || []).some(rp => rp.id === p.key))
      .sort((a, b) => b.totalInvested - a.totalInvested);
  }, [payers, advanceRecords, paymentRecords, dailyExpenses, hotelAdvances, materials]);

  const totalInvestedByPayers = useMemo(() => {
    return payerContributions.reduce((sum, p) => sum + p.totalInvested, 0);
  }, [payerContributions]);

  const filteredPayerContributions = useMemo(() => {
    if (!payerSearch.trim()) return payerContributions;
    const term = payerSearch.toLowerCase();
    return payerContributions.filter(p => 
      p.name.toLowerCase().includes(term) || 
      (p.role && p.role.toLowerCase().includes(term))
    );
  }, [payerContributions, payerSearch]);

  const lowStockMaterials = materials.filter(m => {
    if (m.alertThreshold === undefined || m.alertThreshold === null) return false;
    const totalUsed = m.usages.reduce((sum, u) => sum + u.quantityUsed, 0);
    const remaining = m.quantityBought - totalUsed;
    return remaining <= m.alertThreshold;
  });

  // Filter projects for display
  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (p.location && p.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getDaysLeftText = (targetDateStr: string, startDateStr: string, statusStr: string) => {
    if (statusStr === 'completed') return { text: 'Completed', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };

    const today = new Date();
    today.setHours(0,0,0,0);
    const target = new Date(targetDateStr);
    target.setHours(0,0,0,0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: `Overdue by ${Math.abs(diffDays)}d`, color: 'text-rose-700 bg-rose-50 border-rose-200' };
    } else if (diffDays === 0) {
      return { text: 'Deadline Today', color: 'text-amber-700 bg-amber-50 border-amber-200 font-bold' };
    } else {
      return { text: `${diffDays} days left`, color: 'text-indigo-700 bg-indigo-50 border-indigo-200' };
    }
  };

  // Process data for Recharts based on selected filter state
  const chartData = projects
    .filter((p) => {
      if (selectedChartProject !== 'all' && p.id !== selectedChartProject) return false;
      if (chartMinBudget && p.budget < (Number(chartMinBudget) || 0)) return false;
      return true;
    })
    .map((p) => {
      const m = getProjectMetrics(p);
      const totalActual = m.totalSpent;
      const budgetTotal = p.budget;
      const variance = totalActual - budgetTotal;
      const variancePercent = budgetTotal > 0 ? (variance / budgetTotal) * 100 : 0;

      const categories = [
        {
          name: 'Labour',
          Budget: p.labourBudget || 0,
          Actual: m.labourWages,
        },
        {
          name: 'Materials',
          Budget: p.materialBudget || 0,
          Actual: m.materialCost,
        },
        {
          name: 'Food',
          Budget: p.foodBudget || 0,
          Actual: m.foodCost,
        },
        {
          name: 'Expenses',
          Budget: p.expenseBudget || 0,
          Actual: m.dailyExpensesCost,
        }
      ];

      return {
        id: p.id,
        name: p.name,
        Budget: budgetTotal,
        Actual: totalActual,
        Variance: variance,
        variancePercent,
        categories,
        metrics: m,
      };
    });

  const aggregatedCategories = [
    { name: 'Labour', Budget: 0, Actual: 0 },
    { name: 'Materials', Budget: 0, Actual: 0 },
    { name: 'Food', Budget: 0, Actual: 0 },
    { name: 'Expenses', Budget: 0, Actual: 0 },
  ];

  chartData.forEach(item => {
    aggregatedCategories[0].Budget += item.categories[0].Budget;
    aggregatedCategories[0].Actual += item.categories[0].Actual;

    aggregatedCategories[1].Budget += item.categories[1].Budget;
    aggregatedCategories[1].Actual += item.categories[1].Actual;

    aggregatedCategories[2].Budget += item.categories[2].Budget;
    aggregatedCategories[2].Actual += item.categories[2].Actual;

    aggregatedCategories[3].Budget += item.categories[3].Budget;
    aggregatedCategories[3].Actual += item.categories[3].Actual;
  });

  const categoryPieData = [
    { name: 'Labour Payroll', value: overallLabourWages, color: '#6366f1' },
    { name: 'Materials', value: overallMaterialCost, color: '#0284c7' },
    { name: 'Food & Catering', value: overallFoodCost, color: '#e11d48' },
    { name: 'Daily Expenses', value: overallDailyExpenses, color: '#d97706' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Overall Projects & Financial Control Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Consolidated overview of site budgets, expenditure stats, partner investments, worker payrolls, and stock levels.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              if (confirm("CRITICAL WARNING: This will permanently wipe all local construction sites, workers, daily attendance sheets, advance and payment logs, material deliveries, food bills, and tax data from your browser's local cache.\n\nAre you sure you want to completely start fresh?")) {
                onResetDatabase();
              }
            }}
            className="inline-flex items-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs"
            title="Wipe and start completely fresh"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset DB
          </button>
          <button
            onClick={handleOpenAddForm}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Construction Site
          </button>
        </div>
      </div>

      {/* Aggregate KPI Summary Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Total Combined Budget */}
        <button
          type="button"
          onClick={() => setActiveModal('budget')}
          className="bg-slate-900 text-white rounded-xl p-4 shadow-xs flex flex-col justify-between hover:ring-2 hover:ring-emerald-400/50 hover:scale-[1.01] transition-all cursor-pointer group text-left relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Budget (All Sites)</span>
            <div className="p-1.5 rounded-md bg-slate-800 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-bold tracking-tight font-mono">
              ₹{overallBudget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h4>
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-slate-400" />
                <span>Spread across <strong>{projects.length}</strong> site{projects.length === 1 ? '' : 's'}</span>
              </p>
              <span className="text-[9px] font-bold text-emerald-400 group-hover:underline flex items-center gap-0.5">
                Inspect / Edit <ArrowUpRight className="w-3 h-3 inline" />
              </span>
            </div>
          </div>
        </button>

        {/* Total Amount Spent */}
        <button
          type="button"
          onClick={() => {
            setExpenseModalFilter('all');
            setActiveModal('expenses');
          }}
          className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-rose-300 hover:ring-2 hover:ring-rose-400/40 hover:scale-[1.01] transition-all cursor-pointer group text-left relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Spent to Date</span>
            <div className="p-1.5 rounded-md bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-bold tracking-tight font-mono text-rose-700">
              ₹{overallSpent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h4>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
              <span>Utilized: <strong>{overallBudget > 0 ? ((overallSpent / overallBudget) * 100).toFixed(1) : 0}%</strong></span>
              <span className="text-[9px] font-bold text-rose-600 group-hover:underline flex items-center gap-0.5">
                View Logs <ArrowUpRight className="w-3 h-3 inline" />
              </span>
            </div>
          </div>
        </button>

        {/* Combined Net Remaining Balance */}
        <button
          type="button"
          onClick={() => setActiveModal('balance')}
          className={`border rounded-xl p-4 shadow-xs flex flex-col justify-between hover:ring-2 hover:ring-emerald-400/50 hover:scale-[1.01] transition-all cursor-pointer group text-left relative overflow-hidden ${
            overallRemainingBudget < 0 ? 'bg-rose-50/80 border-rose-200' : 'bg-emerald-50/60 border-emerald-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Net Remaining Balance</span>
            <div className={`p-1.5 rounded-md ${overallRemainingBudget < 0 ? 'bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white' : 'bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white'} transition-colors`}>
              <CircleDollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h4 className={`text-2xl font-bold tracking-tight font-mono ${overallRemainingBudget < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
              ₹{overallRemainingBudget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h4>
            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
              <span>{overallRemainingBudget < 0 ? 'Over budget across combined sites' : 'Headroom available across sites'}</span>
              <span className="text-[9px] font-bold text-emerald-700 group-hover:underline flex items-center gap-0.5">
                Balance Details <ArrowUpRight className="w-3 h-3 inline" />
              </span>
            </div>
          </div>
        </button>

        {/* Total Payer / Investor Disbursed */}
        <button
          type="button"
          onClick={() => setActiveModal('payers')}
          className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-indigo-300 hover:ring-2 hover:ring-indigo-400/40 hover:scale-[1.01] transition-all cursor-pointer group text-left relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-bold text-indigo-900">Partner / Payer Outlays</span>
            <div className="p-1.5 rounded-md bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h4 className="text-2xl font-bold tracking-tight font-mono text-indigo-900">
              ₹{totalInvestedByPayers.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </h4>
            <div className="flex items-center justify-between text-[10px] text-indigo-700 mt-1">
              <span className="truncate">By <strong>{payerContributions.length}</strong> investor{payerContributions.length === 1 ? '' : 's'}/payer{payerContributions.length === 1 ? '' : 's'}</span>
              <span className="text-[9px] font-bold text-indigo-800 group-hover:underline flex items-center gap-0.5 shrink-0 ml-1">
                Partner Ledger <ArrowUpRight className="w-3 h-3 inline" />
              </span>
            </div>
          </div>
        </button>
      </div>

      {/* Central Low Stock Warning */}
      {lowStockMaterials.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900">
          <div className="p-1.5 bg-amber-100 rounded-md text-amber-800 shrink-0 mt-0.5 text-sm">
            ⚠️
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">Critical Material Stock Alerts ({lowStockMaterials.length} Items)</h4>
            <p className="text-xs text-amber-800 leading-relaxed">
              Stock level for these items has dropped below threshold. Click any item to jump directly to its site material page:
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
                    className="inline-flex items-center gap-1 bg-amber-100/80 hover:bg-amber-200 text-amber-950 px-2.5 py-1 rounded-md text-xs font-semibold border border-amber-300 font-mono transition text-left cursor-pointer"
                  >
                    <span>{project?.name ? `[${project.name}]` : ''} {m.name}:</span>
                    <strong className="text-rose-700">{remaining} {m.unit}</strong> left (Alert: {m.alertThreshold})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Categories Sub-KPI Ribbon */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Labour Wages */}
        <button
          type="button"
          onClick={() => {
            setExpenseModalFilter('labour');
            setActiveModal('expenses');
          }}
          className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs hover:border-indigo-300 hover:ring-2 hover:ring-indigo-300/40 hover:scale-[1.01] transition-all cursor-pointer group text-left"
        >
          <div className="p-2.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 truncate block">Labour Wages</span>
            <h5 className="font-mono text-sm font-bold text-slate-800 truncate">
              ₹{overallLabourWages.toLocaleString()}
            </h5>
          </div>
        </button>

        {/* Materials */}
        <button
          type="button"
          onClick={() => {
            setExpenseModalFilter('materials');
            setActiveModal('expenses');
          }}
          className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs hover:border-sky-300 hover:ring-2 hover:ring-sky-300/40 hover:scale-[1.01] transition-all cursor-pointer group text-left"
        >
          <div className="p-2.5 rounded-lg bg-sky-50 text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition-colors shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 truncate block">Material Purchases</span>
            <h5 className="font-mono text-sm font-bold text-slate-800 truncate">
              ₹{overallMaterialCost.toLocaleString()}
            </h5>
          </div>
        </button>

        {/* Food */}
        <button
          type="button"
          onClick={() => {
            setExpenseModalFilter('food');
            setActiveModal('expenses');
          }}
          className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs hover:border-rose-300 hover:ring-2 hover:ring-rose-300/40 hover:scale-[1.01] transition-all cursor-pointer group text-left"
        >
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0">
            <Utensils className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 truncate">Food Expenses</span>
            </div>
            <h5 className="font-mono text-sm font-bold text-slate-800 truncate">
              ₹{overallFoodCost.toLocaleString()}
            </h5>
          </div>
        </button>

        {/* Daily Expenses & Misc */}
        <button
          type="button"
          onClick={() => {
            setExpenseModalFilter('daily');
            setActiveModal('expenses');
          }}
          className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3 shadow-2xs hover:border-amber-300 hover:ring-2 hover:ring-amber-300/40 hover:scale-[1.01] transition-all cursor-pointer group text-left"
        >
          <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors shrink-0">
            <Receipt className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 truncate block">Daily Expenses & Misc</span>
            <h5 className="font-mono text-sm font-bold text-slate-800 truncate">
              ₹{overallDailyExpenses.toLocaleString()}
            </h5>
          </div>
        </button>
      </div>

      {/* SECTION 1: INVESTOR & PAYER CONTRIBUTIONS LEDGER */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Partner & Investor Contribution Ledger (Till Date)
            </h3>
            <p className="text-[11px] text-slate-500">
              Total funds invested or paid out by each partner/investor/supervisor across all construction sites.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative text-xs">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search investor..."
                value={payerSearch}
                onChange={(e) => setPayerSearch(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs w-[160px] focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>
            <button
              onClick={() => setActiveTab('labours')}
              className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
            >
              Manage Payers
            </button>
          </div>
        </div>

        {filteredPayerContributions.length === 0 ? (
          <div className="text-center py-8 text-slate-400 font-mono text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No investor/payer transactions logged yet. When recording advances, wages, or expenses with a payer name, contributions will automatically show up here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredPayerContributions.map((payer) => {
              const percentageShare = totalInvestedByPayers > 0 
                ? Math.round((payer.totalInvested / totalInvestedByPayers) * 100) 
                : 0;

              return (
                <div key={payer.key} className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-300 transition">
                  {/* Top Payer Info */}
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-slate-800 text-sm">{payer.name}</h4>
                          {payer.role && (
                            <span className="text-[9px] bg-slate-200/70 text-slate-600 font-semibold px-1.5 py-0.5 rounded">
                              {payer.role}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {payer.transactionCount} transaction{payer.transactionCount === 1 ? '' : 's'} recorded
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">Total Invested</span>
                        <span className="font-mono text-base font-bold text-indigo-700 block">
                          ₹{payer.totalInvested.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Progress Share Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                        <span>Overall Share</span>
                        <span className="font-bold text-indigo-600">{percentageShare}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, percentageShare)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Project Breakdown Chips */}
                  <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block">Site Outlays</span>
                    <div className="flex flex-wrap gap-1.5 max-h-[70px] overflow-y-auto">
                      {Array.from(payer.projectAmounts.entries()).map(([pId, amount]) => {
                        const proj = projects.find(p => p.id === pId);
                        return (
                          <div 
                            key={pId}
                            className="inline-flex items-center gap-1 bg-white border border-slate-200/80 px-2 py-0.5 rounded text-[10px] font-mono text-slate-700"
                          >
                            <span className="font-semibold text-slate-500 truncate max-w-[90px]">{proj?.name || 'Site'}:</span>
                            <span className="font-bold text-slate-900">₹{amount.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Category Breakdown Footer */}
                  <div className="pt-2 border-t border-slate-200/60 grid grid-cols-3 gap-1 text-[9px] font-mono text-slate-500">
                    {payer.advancesTotal > 0 && (
                      <div className="truncate">Advances: <strong className="text-slate-800">₹{payer.advancesTotal.toLocaleString()}</strong></div>
                    )}
                    {payer.expensesTotal > 0 && (
                      <div className="truncate">Expenses: <strong className="text-slate-800">₹{payer.expensesTotal.toLocaleString()}</strong></div>
                    )}
                    {payer.hotelTotal > 0 && (
                      <div className="truncate">Hotel: <strong className="text-slate-800">₹{payer.hotelTotal.toLocaleString()}</strong></div>
                    )}
                    {payer.materialsTotal > 0 && (
                      <div className="truncate">Materials: <strong className="text-slate-800">₹{payer.materialsTotal.toLocaleString()}</strong></div>
                    )}
                    {payer.paymentsTotal > 0 && (
                      <div className="truncate">Payments: <strong className="text-slate-800">₹{payer.paymentsTotal.toLocaleString()}</strong></div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: INDIVIDUAL PROJECT STATISTICS & OUTLAYS */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-indigo-600" />
              Construction Sites Detailed Statistics ({filteredProjects.length})
            </h3>
            <p className="text-[11px] text-slate-500">
              Detailed financial metrics, timeline status, and expense breakdowns for each project site.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setProjectDisplayMode('cards')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer flex items-center gap-1 ${
                  projectDisplayMode === 'cards'
                    ? 'bg-white text-slate-800 shadow-3xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="View as detailed project cards"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards View</span>
              </button>
              <button
                onClick={() => setProjectDisplayMode('table')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer flex items-center gap-1 ${
                  projectDisplayMode === 'table'
                    ? 'bg-white text-slate-800 shadow-3xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="View as consolidated registry table"
              >
                <ListFilter className="w-3.5 h-3.5" />
                <span>Table View</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative text-xs">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search site..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-xs w-[140px] focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {/* Status Filter */}
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

        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-mono text-xs bg-slate-50 rounded-lg border border-dashed border-slate-200">
            <Briefcase className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            No construction sites match the search filter.
          </div>
        ) : projectDisplayMode === 'cards' ? (
          /* PROJECT CARDS GRID VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((p) => {
              const m = getProjectMetrics(p);
              const timeline = getDaysLeftText(p.targetDate, p.startDate, p.status);
              const isCurrentActive = p.id === activeProjectId;
              const percentUtilized = p.budget > 0 ? Math.min(100, Math.max(0, (m.totalSpent / p.budget) * 100)) : 0;
              const isOver = p.budget > 0 && m.totalSpent > p.budget;

              // Find investors for this project
              const siteInvestors = payerContributions.filter(pc => pc.projectAmounts.has(p.id));

              return (
                <div 
                  key={p.id}
                  className={`bg-white border rounded-xl p-4 flex flex-col justify-between space-y-3.5 transition-all shadow-2xs hover:shadow-md ${
                    isCurrentActive ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            p.status === 'active' ? 'bg-emerald-500' : p.status === 'completed' ? 'bg-blue-500' : 'bg-amber-500'
                          }`} />
                          <h4 className="font-bold text-slate-800 text-sm truncate">{p.name}</h4>
                        </div>
                        {p.location && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{p.location}</span>
                          </div>
                        )}
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border font-mono shrink-0 ${timeline.color}`}>
                        {timeline.text}
                      </span>
                    </div>

                    {p.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {p.description}
                      </p>
                    )}
                  </div>

                  {/* Financial Metrics & Progress Bar */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block">Target Budget</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">₹{p.budget.toLocaleString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block">Total Spent</span>
                        <span className={`font-mono font-bold text-sm ${isOver ? 'text-rose-600' : 'text-slate-800'}`}>
                          ₹{m.totalSpent.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {p.budget > 0 && (
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between items-center text-[10px] font-mono">
                          <span className="text-slate-500">
                            {isOver ? `Over budget by ₹${(m.totalSpent - p.budget).toLocaleString()}` : `Balance: ₹${m.remainingBudget.toLocaleString()}`}
                          </span>
                          <span className={`font-bold ${isOver ? 'text-rose-600' : 'text-slate-700'}`}>
                            {Math.round((m.totalSpent / p.budget) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isOver ? 'bg-rose-500' : percentUtilized > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${percentUtilized}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Category Breakdown 2x2 Grid */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                    <div className="bg-slate-50/70 border border-slate-100 rounded-md p-2 flex items-center justify-between">
                      <span className="text-slate-500 font-sans">👷 Labour:</span>
                      <span className="font-bold text-slate-800">₹{m.labourWages.toLocaleString()}</span>
                    </div>

                    <div className="bg-slate-50/70 border border-slate-100 rounded-md p-2 flex items-center justify-between">
                      <span className="text-slate-500 font-sans">🚚 Materials:</span>
                      <span className="font-bold text-slate-800">₹{m.materialCost.toLocaleString()}</span>
                    </div>

                    <div className="bg-slate-50/70 border border-slate-100 rounded-md p-2 flex items-center justify-between">
                      <span className="text-slate-500 font-sans">🍲 Food:</span>
                      <span className="font-bold text-slate-800">₹{m.foodCost.toLocaleString()}</span>
                    </div>

                    <div className="bg-slate-50/70 border border-slate-100 rounded-md p-2 flex items-center justify-between">
                      <span className="text-slate-500 font-sans">💸 Expenses:</span>
                      <span className="font-bold text-slate-800">₹{m.dailyExpensesCost.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Top Investors for this Site */}
                  {siteInvestors.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <span className="text-[9px] uppercase tracking-wider font-semibold text-slate-400 block">Site Investors/Payers</span>
                      <div className="flex flex-wrap gap-1">
                        {siteInvestors.map(inv => {
                          const amt = inv.projectAmounts.get(p.id) || 0;
                          return (
                            <span key={inv.key} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-900 border border-indigo-100 px-1.5 py-0.5 rounded text-[9px] font-mono">
                              <strong>{inv.name}:</strong> ₹{amt.toLocaleString()}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action Controls */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        onSelectProject(p.id);
                        setActiveTab('attendance');
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        isCurrentActive 
                          ? 'bg-slate-900 text-white shadow-xs' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>{isCurrentActive ? 'Selected Active Site' : 'Open Site'}</span>
                    </button>

                    <button
                      onClick={(e) => handleOpenEditForm(p, e)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                      title="Edit project budget & dates"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`CRITICAL WARNING: Are you sure you want to delete "${p.name}"?\n\nThis will permanently delete ALL daily attendance sheets, wage logs, material deliveries, meal files, and tax records for this site!`)) {
                          onDeleteProject(p.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="Delete project"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* REGISTRY TABLE VIEW */
          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Site / Status</th>
                  <th className="py-2.5 px-3 text-right">Budget</th>
                  <th className="py-2.5 px-3 text-right">Wages</th>
                  <th className="py-2.5 px-3 text-right">Materials</th>
                  <th className="py-2.5 px-3 text-right">Meals</th>
                  <th className="py-2.5 px-3 text-right">Expenses</th>
                  <th className="py-2.5 px-3 text-right">Total Spent</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                  <th className="py-2.5 px-3 text-center">Timeline</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((p) => {
                  const m = getProjectMetrics(p);
                  const timeline = getDaysLeftText(p.targetDate, p.startDate, p.status);
                  const isCurrentActive = p.id === activeProjectId;
                  const utilPercent = p.budget > 0 ? (m.totalSpent / p.budget) * 100 : 0;

                  return (
                    <tr key={p.id} className={`hover:bg-slate-50/40 transition ${isCurrentActive ? 'bg-indigo-50/20' : ''}`}>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${
                            p.status === 'active' ? 'bg-emerald-500' : p.status === 'completed' ? 'bg-blue-500' : 'bg-amber-500'
                          }`} />
                          <span className="font-semibold text-slate-800">{p.name}</span>
                        </div>
                        {p.location && (
                          <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium mt-0.5">
                            <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{p.location}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-semibold text-slate-700">
                        ₹{p.budget.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        ₹{m.labourWages.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        ₹{m.materialCost.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        ₹{m.foodCost.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        ₹{m.dailyExpensesCost.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="font-mono font-bold text-slate-800">
                          ₹{m.totalSpent.toLocaleString()}
                        </div>
                        <div className="w-[80px] bg-slate-100 rounded-full h-1 mt-1 ml-auto overflow-hidden">
                          <div 
                            className={`h-full ${utilPercent > 100 ? 'bg-rose-500' : utilPercent > 80 ? 'bg-amber-500' : 'bg-emerald-600'}`} 
                            style={{ width: `${Math.min(100, utilPercent)}%` }} 
                          />
                        </div>
                      </td>

                      <td className={`py-3 px-3 text-right font-mono font-bold ${
                        m.remainingBudget < 0 ? 'text-rose-600' : 'text-emerald-700'
                      }`}>
                        ₹{m.remainingBudget.toLocaleString()}
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold border font-mono ${timeline.color}`}>
                          {timeline.text}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              onSelectProject(p.id);
                              setActiveTab('attendance');
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

                          <button
                            onClick={(e) => handleOpenEditForm(p, e)}
                            className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition cursor-pointer"
                            title="Edit project budget & dates"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`CRITICAL WARNING: Are you sure you want to delete "${p.name}"?`)) {
                                onDeleteProject(p.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                            title="Delete project"
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

      {/* SECTION 3: VISUAL CHARTS & EXPENDITURE HUB */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Expenditure Bar Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                Budget vs. Actual Expenditure Analytics
              </h3>
              <p className="text-[10px] text-slate-500">
                Interactive comparison of target site budgets vs actual cumulative outlays.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setChartView('overall')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                  chartView === 'overall' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Overall
              </button>
              <button
                onClick={() => setChartView('category')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                  chartView === 'category' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Category
              </button>
              <button
                onClick={() => setChartView('variance')}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                  chartView === 'variance' ? 'bg-white text-slate-800 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Variance
              </button>
            </div>
          </div>

          <div className="h-[260px] w-full pt-2">
            {projects.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs font-mono">
                <BarChart3 className="w-10 h-10 text-slate-300 mb-2 animate-pulse" />
                Please register a project to view expenditure graphs.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {chartView === 'overall' ? (
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis tickFormatter={(v) => `₹${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v}`} tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} axisLine={{ stroke: '#cbd5e1' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} verticalAlign="bottom" height={36} />
                    <Bar name="Target Budget" dataKey="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar name="Actual Spent" dataKey="Actual" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                ) : chartView === 'category' ? (
                  <BarChart data={aggregatedCategories} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis tickFormatter={(v) => `₹${v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v}`} tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} axisLine={{ stroke: '#cbd5e1' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} verticalAlign="bottom" height={36} />
                    <Bar name="Target Allocation" dataKey="Budget" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={22} />
                    <Bar name="Cumulative Actual" dataKey="Actual" fill="#0284c7" radius={[4, 4, 0, 0]} barSize={22} />
                  </BarChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#cbd5e1' }} />
                    <YAxis tickFormatter={(v) => `₹${v >= 100000 || v <= -100000 ? (v / 100000).toFixed(1) + 'L' : v}`} tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} axisLine={{ stroke: '#cbd5e1' }} />
                    <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString()}`, Number(value) > 0 ? 'Deficit (Over)' : 'Savings (Under)']} labelStyle={{ fontWeight: 'bold' }} contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} verticalAlign="bottom" height={36} />
                    <Bar name="Deficit (+) / Savings (-)" dataKey="Variance" radius={[4, 4, 0, 0]} barSize={22}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.Variance > 0 ? '#f43f5e' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Expenditure Distribution Pie Chart (1 col) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <PieChartIcon className="w-4 h-4 text-indigo-600" />
              Expenditure Category Distribution
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">
              Proportion of total funds spent on Labour, Materials, Meals, and Daily Expenses.
            </p>
          </div>

          <div className="h-[180px] w-full flex items-center justify-center">
            {overallSpent === 0 ? (
              <div className="text-center text-slate-400 text-xs font-mono">
                No expense records logged yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val: any) => [`₹${Number(val).toLocaleString()}`, 'Spent']}
                    contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[10px]">
            {categoryPieData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-slate-500 truncate">{item.name}:</span>
                <span className="font-mono font-bold text-slate-800 ml-auto">
                  {overallSpent > 0 ? Math.round((item.value / overallSpent) * 100) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add / Edit Project Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editingProject ? 'Edit Construction Site' : 'Add New Construction Site'}
              </h3>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingProject(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Site Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tezu Toilet Block Repair"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Tezu, Arunachal Pradesh"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Status</label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-slate-900 font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Target Completion Date *</label>
                  <input
                    type="date"
                    required
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Total Site Budget (₹) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-mono">₹</span>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 500000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Advanced Category Budget Allocations */}
              <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 space-y-2">
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
                  Category Targets Allocation (Optional)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium">Labour Budget (₹)</label>
                    <input
                      type="number"
                      placeholder="Optional"
                      value={labourBudget}
                      onChange={(e) => setLabourBudget(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md p-1.5 font-mono text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium">Material Budget (₹)</label>
                    <input
                      type="number"
                      placeholder="Optional"
                      value={materialBudget}
                      onChange={(e) => setMaterialBudget(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md p-1.5 font-mono text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium">Food Budget (₹)</label>
                    <input
                      type="number"
                      placeholder="Optional"
                      value={foodBudget}
                      onChange={(e) => setFoodBudget(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md p-1.5 font-mono text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium">Expense Budget (₹)</label>
                    <input
                      type="number"
                      placeholder="Optional"
                      value={expenseBudget}
                      onChange={(e) => setExpenseBudget(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-md p-1.5 font-mono text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Description / Scope Notes</label>
                <textarea
                  placeholder="Brief summary of contract work, client details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingProject(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                >
                  {editingProject ? 'Save Changes' : 'Create Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* INTERACTIVE KPI INSPECTION MODALS & DETAILED TRANSACTION LOGS            */}
      {/* ========================================================================= */}

      {/* 1. TOTAL BUDGET & SITES ALLOCATION MODAL */}
      {activeModal === 'budget' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-800 text-emerald-400">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    Total Site Budgets & Financial Allocations
                  </h3>
                  <p className="text-xs text-slate-400">
                    Inspecting budget vs spent across {projects.length} registered construction site{projects.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overall Stats Banner */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Combined Budget</span>
                <span className="font-mono font-bold text-sm text-slate-900">₹{overallBudget.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Spent</span>
                <span className="font-mono font-bold text-sm text-rose-600">₹{overallSpent.toLocaleString()}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Remaining Headroom</span>
                <span className={`font-mono font-bold text-sm ${overallRemainingBudget < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  ₹{overallRemainingBudget.toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Budget Utilization</span>
                <span className="font-mono font-bold text-sm text-indigo-600">
                  {overallBudget > 0 ? ((overallSpent / overallBudget) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>

            {/* Sites List & Actions */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Site-by-Site Budget List</h4>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    handleOpenAddForm();
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add New Site
                </button>
              </div>

              <div className="space-y-3">
                {projects.map((p) => {
                  const pSpent = getProjectMetrics(p).totalSpent;
                  const pRem = p.budget - pSpent;
                  const pct = p.budget > 0 ? Math.min(100, Math.round((pSpent / p.budget) * 100)) : 0;

                  return (
                    <div
                      key={p.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-bold text-slate-900 text-sm">{p.name}</h5>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                            p.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            p.status === 'completed' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </div>
                        {p.location && (
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" /> {p.location}
                          </p>
                        )}
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                          <div
                            className={`h-full transition-all duration-300 ${
                              pct >= 100 ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 font-mono text-xs">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-sans block">Budget</span>
                          <strong className="text-slate-900 font-bold">₹{p.budget.toLocaleString()}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-sans block">Spent</span>
                          <strong className="text-rose-600 font-bold">₹{pSpent.toLocaleString()}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-sans block">Balance</span>
                          <strong className={`font-bold ${pRem < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            ₹{pRem.toLocaleString()}
                          </strong>
                        </div>

                        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                          <button
                            type="button"
                            title="Edit site & budget"
                            onClick={(e) => {
                              setActiveModal(null);
                              handleOpenEditForm(p, e);
                            }}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete site"
                            onClick={() => {
                              if (confirm(`Delete site "${p.name}" and all associated records?`)) {
                                onDeleteProject(p.id);
                              }
                            }}
                            className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectProject(p.id);
                              setActiveModal(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-sans text-[11px] font-bold transition cursor-pointer"
                          >
                            Open Site
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ITEMIZED EXPENDITURE & RECORDS LOG INSPECTOR MODAL */}
      {activeModal === 'expenses' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    Itemized Expenditure & Transaction Records Log
                  </h3>
                  <p className="text-xs text-slate-400">
                    Inspect, search, edit, or delete any recorded site expense or wage outlay
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter Tabs & Search Controls */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
              {/* Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setExpenseModalFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                    expenseModalFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  All Outlays
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseModalFilter('daily')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                    expenseModalFilter === 'daily' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Daily Expenses ({dailyExpenses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseModalFilter('materials')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                    expenseModalFilter === 'materials' ? 'bg-sky-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Material Deliveries ({materials.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseModalFilter('food')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                    expenseModalFilter === 'food' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Meal Deductions ({foodLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseModalFilter('advances')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                    expenseModalFilter === 'advances' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Worker Advances ({advanceRecords.length})
                </button>
                <button
                  type="button"
                  onClick={() => setExpenseModalFilter('hotel')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer whitespace-nowrap ${
                    expenseModalFilter === 'hotel' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Hotel Advances ({hotelAdvances.length})
                </button>
              </div>

              {/* Search Bar & Site Selector */}
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by description, supplier, worker, or payer..."
                    value={recordsSearchTerm}
                    onChange={(e) => setRecordsSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                  {recordsSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setRecordsSearchTerm('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <select
                  value={recordsProjectFilter}
                  onChange={(e) => setRecordsProjectFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none w-full sm:w-48 cursor-pointer"
                >
                  <option value="all">All Sites ({projects.length})</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Records List */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-2 flex-1">
              {(() => {
                // Build merged transactions list for inspection
                let items: Array<{
                  id: string;
                  type: 'daily' | 'material' | 'food' | 'advance' | 'hotel' | 'payment';
                  date: string;
                  title: string;
                  category?: string;
                  projectName: string;
                  projectId: string;
                  paidBy?: string;
                  amount: number;
                  originalObj: any;
                }> = [];

                if (expenseModalFilter === 'all' || expenseModalFilter === 'daily') {
                  dailyExpenses.forEach(e => {
                    const pr = projects.find(p => p.id === e.projectId);
                    items.push({
                      id: e.id,
                      type: 'daily',
                      date: e.date,
                      title: e.description || e.category,
                      category: e.category,
                      projectName: pr?.name || 'Unknown Site',
                      projectId: e.projectId,
                      paidBy: e.payerId || undefined,
                      amount: e.amount,
                      originalObj: e
                    });
                  });
                }

                if (expenseModalFilter === 'all' || expenseModalFilter === 'materials') {
                  materials.forEach(m => {
                    const pr = projects.find(p => p.id === m.projectId);
                    items.push({
                      id: m.id,
                      type: 'material',
                      date: m.dateBought,
                      title: `${m.name} (${m.quantityBought} ${m.unit}) - Supplier: ${m.supplier || 'N/A'}`,
                      category: 'Material Delivery',
                      projectName: pr?.name || 'Unknown Site',
                      projectId: m.projectId,
                      paidBy: undefined,
                      amount: m.cost,
                      originalObj: m
                    });
                  });
                }

                if (expenseModalFilter === 'all' || expenseModalFilter === 'food') {
                  foodLogs.forEach(f => {
                    const pr = projects.find(p => p.id === f.projectId);
                    const lab = labours.find(l => l.id === f.labourId);
                    items.push({
                      id: f.id,
                      type: 'food',
                      date: f.date,
                      title: `Meal Deduction: ${f.mealsCount} meals x ₹${f.cost} (${lab?.name || f.labourId}) ${f.notes ? `- ${f.notes}` : ''}`,
                      category: 'Food',
                      projectName: pr?.name || 'Unknown Site',
                      projectId: f.projectId,
                      paidBy: 'Site Food Expense',
                      amount: f.mealsCount * f.cost,
                      originalObj: f
                    });
                  });
                }

                if (expenseModalFilter === 'all' || expenseModalFilter === 'advances') {
                  advanceRecords.forEach(a => {
                    const pr = projects.find(p => p.id === a.projectId);
                    const lab = labours.find(l => l.id === a.labourId);
                    items.push({
                      id: a.id,
                      type: 'advance',
                      date: a.date,
                      title: `Worker Advance to ${lab?.name || 'Worker'} (${a.description || 'Advance'})`,
                      category: 'Labour Advance',
                      projectName: pr?.name || 'Unknown Site',
                      projectId: a.projectId,
                      paidBy: a.paidBy,
                      amount: a.amount,
                      originalObj: a
                    });
                  });
                }

                if (expenseModalFilter === 'all' || expenseModalFilter === 'hotel') {
                  hotelAdvances.forEach(h => {
                    const pr = projects.find(p => p.id === h.projectId);
                    items.push({
                      id: h.id,
                      type: 'hotel',
                      date: h.date,
                      title: `Hotel Food Advance - ${h.hotelName} (${h.notes || 'Hotel Fund'})`,
                      category: 'Hotel Advance',
                      projectName: pr?.name || 'Unknown Site',
                      projectId: h.projectId,
                      paidBy: h.hotelName,
                      amount: h.amount,
                      originalObj: h
                    });
                  });
                }

                // Filter by search & project
                if (recordsProjectFilter !== 'all') {
                  items = items.filter(i => i.projectId === recordsProjectFilter);
                }

                if (recordsSearchTerm.trim()) {
                  const q = recordsSearchTerm.toLowerCase();
                  items = items.filter(i =>
                    i.title.toLowerCase().includes(q) ||
                    i.projectName.toLowerCase().includes(q) ||
                    (i.paidBy && i.paidBy.toLowerCase().includes(q)) ||
                    (i.category && i.category.toLowerCase().includes(q))
                  );
                }

                // Sort by date descending
                items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                const totalFilteredSum = items.reduce((sum, i) => sum + i.amount, 0);

                if (items.length === 0) {
                  return (
                    <div className="text-center py-12 text-slate-400 space-y-2">
                      <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-sm font-semibold text-slate-600">No matching transaction records found</p>
                      <p className="text-xs text-slate-400">Try adjusting your search query or filter settings</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-2 pb-1">
                      <span>Showing {items.length} records</span>
                      <span>Total Outlay: <strong className="font-mono text-slate-900 font-bold">₹{totalFilteredSum.toLocaleString()}</strong></span>
                    </div>

                    {items.map(item => (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                              item.type === 'daily' ? 'bg-amber-100 text-amber-900' :
                              item.type === 'material' ? 'bg-sky-100 text-sky-900' :
                              item.type === 'food' ? 'bg-rose-100 text-rose-900' :
                              item.type === 'advance' ? 'bg-purple-100 text-purple-900' : 'bg-indigo-100 text-indigo-900'
                            }`}>
                              {item.category || item.type}
                            </span>
                            <span className="font-mono text-slate-400 text-[11px]">{item.date}</span>
                            <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                              {item.projectName}
                            </span>
                            {item.paidBy && (
                              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                                Paid by: {item.paidBy}
                              </span>
                            )}
                          </div>
                          <p className="font-bold text-slate-800 text-xs truncate">{item.title}</p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <strong className="font-mono text-sm font-bold text-slate-900">
                            ₹{item.amount.toLocaleString()}
                          </strong>

                          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                            {/* Edit Action */}
                            {(item.type === 'daily' || item.type === 'material' || item.type === 'food') && (
                              <button
                                type="button"
                                title="Edit this record"
                                onClick={() => {
                                  if (item.type === 'daily') setEditingDailyExpense(item.originalObj);
                                  if (item.type === 'material') setEditingMaterial(item.originalObj);
                                  if (item.type === 'food') setEditingFoodLog(item.originalObj);
                                }}
                                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Delete Action */}
                            <button
                              type="button"
                              title="Delete record"
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete this record (${item.title} - ₹${item.amount.toLocaleString()})?`)) {
                                  if (item.type === 'daily' && onDeleteDailyExpense) await onDeleteDailyExpense(item.id);
                                  if (item.type === 'material' && onDeleteMaterial) await onDeleteMaterial(item.id);
                                  if (item.type === 'food' && onDeleteFoodLog) await onDeleteFoodLog(item.id);
                                  if (item.type === 'advance' && onDeleteAdvance) await onDeleteAdvance(item.id);
                                  if (item.type === 'hotel' && onDeleteHotelAdvance) await onDeleteHotelAdvance(item.id);
                                }
                              }}
                              className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold cursor-pointer transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 3. NET REMAINING BALANCE ANALYSIS MODAL */}
      {activeModal === 'balance' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CircleDollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Net Balance & Financial Health Analysis</h3>
                  <p className="text-xs text-slate-400">Inspecting available cash headroom and cost limits across all sites</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Overall Net Available Headroom</span>
                  <h3 className={`text-2xl font-mono font-bold ${overallRemainingBudget < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                    ₹{overallRemainingBudget.toLocaleString()}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {overallRemainingBudget < 0 ? 'Warning: Total expenditures exceed combined site allocations' : 'Financial state is healthy with headroom across sites'}
                  </p>
                </div>
                <div className="text-right border-t sm:border-t-0 sm:border-l border-slate-200 pt-3 sm:pt-0 sm:pl-6">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Spent / Allocated</span>
                  <span className="text-sm font-mono font-bold text-slate-800">
                    ₹{overallSpent.toLocaleString()} / ₹{overallBudget.toLocaleString()}
                  </span>
                </div>
              </div>

              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Site Balance Status Breakdown</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projects.map(p => {
                  const pSpent = getProjectMetrics(p).totalSpent;
                  const pRem = p.budget - pSpent;
                  const isOver = pRem < 0;

                  return (
                    <div
                      key={p.id}
                      className={`border rounded-xl p-4 shadow-2xs space-y-2 ${
                        isOver ? 'bg-rose-50/60 border-rose-200' : 'bg-emerald-50/40 border-emerald-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-slate-900 text-sm">{p.name}</h5>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isOver ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isOver ? 'DEFICIT OVERRUN' : 'IN SURPLUS'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
                        <div>
                          <span className="text-[9px] text-slate-400 font-sans block">Budget</span>
                          <span className="font-bold text-slate-800">₹{p.budget.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-sans block">Spent</span>
                          <span className="font-bold text-rose-600">₹{pSpent.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 font-sans block">Balance</span>
                          <span className={`font-bold ${isOver ? 'text-rose-600' : 'text-emerald-700'}`}>
                            ₹{pRem.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            setActiveModal(null);
                            handleOpenEditForm(p, e);
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="w-3 h-3" /> Adjust Budget
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. PARTNER & PAYER OUTLAYS LEDGER MODAL */}
      {activeModal === 'payers' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 bg-indigo-950 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-800 text-indigo-200">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Partner & Investor Outlay Contributions Ledger</h3>
                  <p className="text-xs text-indigo-300">Detailed financial records of funds disbursed by partners, investors, or company accounts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg bg-indigo-900 hover:bg-indigo-800 text-indigo-200 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Total Disbursed</span>
                  <span className="text-xl font-mono font-bold text-indigo-950">₹{totalInvestedByPayers.toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Active Payers</span>
                  <span className="text-xl font-mono font-bold text-slate-800">{payerContributions.length} Investors/Payers</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Payer Actions</span>
                    <span className="text-xs text-slate-600 font-semibold">Manage Payer Profiles</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const pName = prompt("Enter new partner / investor name:");
                      if (pName && pName.trim()) {
                        const newP: Payer = {
                          id: generateId('pyr'),
                          name: pName.trim(),
                          role: 'Partner / Investor'
                        };
                        if (onUpdatePayer) onUpdatePayer(newP);
                      }
                    }}
                    className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    + Add Partner
                  </button>
                </div>
              </div>

              {/* Partner Breakdown Cards */}
              <div className="space-y-4">
                {payerContributions.map(pc => (
                  <div key={pc.name} className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-sm">
                          {pc.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm">{pc.name}</h5>
                          <span className="text-[10px] text-slate-400">{pc.items.length} credited transaction outlays</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Outlay</span>
                        <span className="text-base font-mono font-bold text-indigo-900">₹{pc.totalAmount.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Itemized Transactions for this Payer */}
                    <div className="space-y-1.5 text-xs">
                      {pc.items.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 rounded-lg p-2.5 flex items-center justify-between gap-3 border border-slate-100">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-slate-400">{item.date}</span>
                              <span className="bg-white border border-slate-200 text-slate-700 font-bold text-[9px] px-1.5 py-0.5 rounded uppercase">
                                {item.type}
                              </span>
                              <span className="text-[10px] font-semibold text-slate-600 truncate">{item.projectName}</span>
                            </div>
                            <p className="font-semibold text-slate-800 truncate">{item.description}</p>
                          </div>
                          <strong className="font-mono font-bold text-slate-900 shrink-0">₹{item.amount.toLocaleString()}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ITEM EDIT OVERLAY MODALS FOR DIRECT RECORD FIXES                          */}
      {/* ========================================================================= */}

      {/* EDIT DAILY EXPENSE MODAL */}
      {editingDailyExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Edit className="w-4 h-4 text-indigo-600" /> Edit Daily Expense Entry
              </h3>
              <button
                type="button"
                onClick={() => setEditingDailyExpense(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingDailyExpense && onUpdateDailyExpense) {
                  await onUpdateDailyExpense(editingDailyExpense);
                  setEditingDailyExpense(null);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={editingDailyExpense.date}
                  onChange={(e) => setEditingDailyExpense({ ...editingDailyExpense, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Category *</label>
                <input
                  type="text"
                  required
                  value={editingDailyExpense.category}
                  onChange={(e) => setEditingDailyExpense({ ...editingDailyExpense, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Description / Notes *</label>
                <input
                  type="text"
                  required
                  value={editingDailyExpense.description}
                  onChange={(e) => setEditingDailyExpense({ ...editingDailyExpense, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  value={editingDailyExpense.amount}
                  onChange={(e) => setEditingDailyExpense({ ...editingDailyExpense, amount: Number(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Paid By / Payer</label>
                <input
                  type="text"
                  placeholder="e.g. Self, Investor A, Company"
                  value={editingDailyExpense.paidBy || ''}
                  onChange={(e) => setEditingDailyExpense({ ...editingDailyExpense, paidBy: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDailyExpense(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MATERIAL MODAL */}
      {editingMaterial && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Edit className="w-4 h-4 text-sky-600" /> Edit Material Invoice
              </h3>
              <button
                type="button"
                onClick={() => setEditingMaterial(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingMaterial && onUpdateMaterial) {
                  await onUpdateMaterial(editingMaterial);
                  setEditingMaterial(null);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  value={editingMaterial.name}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Supplier / Vendor</label>
                <input
                  type="text"
                  value={editingMaterial.supplier || ''}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, supplier: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Total Cost (₹) *</label>
                  <input
                    type="number"
                    required
                    value={editingMaterial.cost}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, cost: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={editingMaterial.date}
                    onChange={(e) => setEditingMaterial({ ...editingMaterial, date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Paid By / Payer</label>
                <input
                  type="text"
                  placeholder="e.g. Self, Investor A, Company"
                  value={editingMaterial.paidBy || ''}
                  onChange={(e) => setEditingMaterial({ ...editingMaterial, paidBy: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMaterial(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT FOOD LOG MODAL */}
      {editingFoodLog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Edit className="w-4 h-4 text-rose-600" /> Edit Meal Deduction Record
              </h3>
              <button
                type="button"
                onClick={() => setEditingFoodLog(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (editingFoodLog && onUpdateFoodLog) {
                  await onUpdateFoodLog(editingFoodLog);
                  setEditingFoodLog(null);
                }
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={editingFoodLog.date}
                  onChange={(e) => setEditingFoodLog({ ...editingFoodLog, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Meals Count *</label>
                  <input
                    type="number"
                    required
                    value={editingFoodLog.mealsCount}
                    onChange={(e) => setEditingFoodLog({ ...editingFoodLog, mealsCount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Cost Per Meal (₹) *</label>
                  <input
                    type="number"
                    required
                    value={editingFoodLog.cost}
                    onChange={(e) => setEditingFoodLog({ ...editingFoodLog, cost: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Notes / Reason</label>
                <input
                  type="text"
                  value={editingFoodLog.note || ''}
                  onChange={(e) => setEditingFoodLog({ ...editingFoodLog, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingFoodLog(null)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg font-bold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

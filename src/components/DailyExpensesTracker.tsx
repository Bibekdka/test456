import React, { useState, useRef, useMemo } from 'react';
import { Project, Labour, Payer, DailyExpense } from '../types';
import { generateId } from '../utils/id';
import { 
  extractUniqueMonths, 
  filterRecordsByMonth, 
  sortRecords, 
  LedgerSortOrder 
} from '../utils/monthUtils';
import { 
  IndianRupee, 
  Plus, 
  Trash2, 
  Pencil, 
  Search, 
  Filter, 
  Upload, 
  FileText, 
  X, 
  Calendar, 
  User, 
  Tag, 
  AlertCircle,
  TrendingUp,
  Coins,
  FileSpreadsheet,
  Eye,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Coffee,
  Fuel,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface DailyExpensesTrackerProps {
  activeProject: Project | null;
  labours: Labour[];
  payers: Payer[];
  dailyExpenses: DailyExpense[];
  onAddDailyExpense: (exp: DailyExpense) => void;
  onUpdateDailyExpense: (exp: DailyExpense) => void;
  onDeleteDailyExpense: (id: string) => void;
  onUpdatePayer?: (payer: Payer) => void;
}

const SUB_CATEGORIES = {
  labour_expense: [
    { value: 'tea_snacks', label: 'Tea & Snacks', icon: '☕' },
    { value: 'medical', label: 'Medical / First-Aid', icon: '💊' },
    { value: 'travel', label: 'Travel / Conveyance', icon: '🚌' },
    { value: 'tools_safety', label: 'Tools & Safety Gear', icon: '🦺' },
    { value: 'emergency_cash', label: 'Emergency Pocket Cash', icon: '💵' },
    { value: 'other', label: 'Other Labour Expense', icon: '📦' }
  ],
  misc_transaction: [
    { value: 'fuel_power', label: 'Fuel, Oil & Power', icon: '⛽' },
    { value: 'stationery', label: 'Stationery & Office', icon: '📝' },
    { value: 'site_cleaning', label: 'Site Cleaning & Waste Disposal', icon: '🧹' },
    { value: 'rental', label: 'Machine/Tool Rental', icon: '⚙️' },
    { value: 'freight_transport', label: 'Freight & Local Carriage', icon: '🚚' },
    { value: 'printing', label: 'Printing & Xerox', icon: '🖨️' },
    { value: 'refreshments', label: 'General Refreshments', icon: '🥤' },
    { value: 'other', label: 'Other General Misc', icon: '🏷️' }
  ]
};

export default function DailyExpensesTracker({
  activeProject,
  labours,
  payers,
  dailyExpenses,
  onAddDailyExpense,
  onUpdateDailyExpense,
  onDeleteDailyExpense,
  onUpdatePayer
}: DailyExpensesTrackerProps) {
  // View Mode: 'list' | 'calendar'
  const [activeViewMode, setActiveViewMode] = useState<'list' | 'calendar'>(() => {
    const saved = localStorage.getItem('daily_expense_view_mode');
    return saved === 'calendar' ? 'calendar' : 'list';
  });

  const handleViewModeChange = (mode: 'list' | 'calendar') => {
    setActiveViewMode(mode);
    localStorage.setItem('daily_expense_view_mode', mode);
  };

  // Calendar Month & Year navigation state
  const todayObj = new Date();
  const [calendarYear, setCalendarYear] = useState<number>(todayObj.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(todayObj.getMonth()); // 0-11
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DailyExpense | null>(null);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<'labour_expense' | 'misc_transaction'>('labour_expense');
  const [subCategory, setSubCategory] = useState('tea_snacks');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [selectedPayerId, setSelectedPayerId] = useState('');
  const [isPartnerHelp, setIsPartnerHelp] = useState(false);
  const [partnerMember, setPartnerMember] = useState('');
  const [partnerAmount, setPartnerAmount] = useState('');
  const [partnerPhone, setPartnerPhone] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);
  const [receiptImageName, setReceiptImageName] = useState<string | undefined>(undefined);

  // Filter/Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSubCategory, setFilterSubCategory] = useState<string>('all');
  const [filterLabourId, setFilterLabourId] = useState<string>('all');
  const [filterPayerId, setFilterPayerId] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<LedgerSortOrder>('newest');

  // Receipt Modal/Lightbox states
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; name: string } | null>(null);

  // Deleting state
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!activeProject) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center max-w-lg mx-auto shadow-sm space-y-4">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">No Active Project Selected</h3>
        <p className="text-slate-500 text-sm">
          Please choose or create a project from the top menu to manage and log daily expenses or miscellaneous transactions.
        </p>
      </div>
    );
  }

  // Filter project-specific expenses
  const projectExpenses = dailyExpenses.filter(e => e.projectId === activeProject.id);

  // Total calculations
  const totalLogged = projectExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalLabourExp = projectExpenses
    .filter(e => e.category === 'labour_expense')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalMiscExp = projectExpenses
    .filter(e => e.category === 'misc_transaction')
    .reduce((sum, e) => sum + e.amount, 0);

  // Handle category switch to update default subcategory
  const handleCategoryChange = (cat: 'labour_expense' | 'misc_transaction') => {
    setCategory(cat);
    setSubCategory(SUB_CATEGORIES[cat][0].value);
    if (cat === 'misc_transaction') {
      setSelectedLabourId('');
    }
  };

  // Receipt image attachment handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large! Please choose an image smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result as string);
      setReceiptImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Only image receipt uploads are supported (PNG, JPG, etc.)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File is too large! Please choose an image smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result as string);
      setReceiptImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const clearReceipt = () => {
    setReceiptImage(undefined);
    setReceiptImageName(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Edit action
  const handleEditClick = (exp: DailyExpense) => {
    setEditingExpense(exp);
    setDate(exp.date);
    setCategory(exp.category);
    setSubCategory(exp.subCategory);
    setAmount(exp.amount.toString());
    setDescription(exp.description);
    setSelectedLabourId(exp.labourId || '');
    setSelectedPayerId(exp.payerId || '');
    setIsPartnerHelp(!!exp.isPartnerHelp);
    setPartnerAmount(exp.partnerAmount !== undefined ? exp.partnerAmount.toString() : '');
    setPartnerPhone(exp.partnerPhone || '');

    const partnerMatch = exp.description.match(/\(🤝 Partner Support:\s*([^)]+)\)/i);
    if (partnerMatch && partnerMatch[1]) {
      setPartnerMember(partnerMatch[1].trim());
    } else {
      setPartnerMember(exp.partnerPhone || '');
    }

    setReceiptImage(exp.receiptImage);
    setReceiptImageName(exp.receiptImageName);
    setShowForm(true);
    document.getElementById('expense-form-container')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Cancel edit/form
  const handleCancel = () => {
    setEditingExpense(null);
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('labour_expense');
    setSubCategory('tea_snacks');
    setAmount('');
    setDescription('');
    setSelectedLabourId('');
    setSelectedPayerId('');
    setIsPartnerHelp(false);
    setPartnerMember('');
    setPartnerAmount('');
    setPartnerPhone('');
    clearReceipt();
    setShowForm(false);
  };

  // Submit log
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (!description.trim()) {
      alert('Please enter a brief description for this transaction.');
      return;
    }

    let finalDescription = description.trim();
    let finalPartnerPhone = partnerPhone.trim();

    if (isPartnerHelp && partnerMember.trim()) {
      const pName = partnerMember.trim();
      if (!finalDescription.toLowerCase().includes(pName.toLowerCase())) {
        finalDescription = `${finalDescription} (🤝 Partner Support: ${pName})`;
      }
      if (!finalPartnerPhone) {
        finalPartnerPhone = pName;
      }
    }

    // Sync phone number to partner if selected and matches a payer profile
    if (isPartnerHelp && partnerMember.trim() && partnerPhone.trim()) {
      const partnerPayerObj = payers.find(p => p.id === partnerMember || p.name === partnerMember);
      if (partnerPayerObj && (!partnerPayerObj.phone || partnerPayerObj.phone !== partnerPhone.trim())) {
        onUpdatePayer?.({
          ...partnerPayerObj,
          phone: partnerPhone.trim()
        });
      }
    }

    const parsedPartnerAmount = isPartnerHelp 
      ? (partnerAmount.trim() ? parseFloat(partnerAmount) || parsedAmount : parsedAmount)
      : undefined;

    const expData: DailyExpense = {
      id: editingExpense?.id || generateId('exp'),
      projectId: activeProject.id,
      date,
      category,
      subCategory,
      amount: parsedAmount,
      description: finalDescription,
      labourId: category === 'labour_expense' && selectedLabourId ? selectedLabourId : undefined,
      payerId: selectedPayerId || undefined,
      isPartnerHelp,
      partnerAmount: parsedPartnerAmount,
      partnerPhone: finalPartnerPhone || undefined,
      receiptImage,
      receiptImageName
    };

    if (editingExpense) {
      onUpdateDailyExpense(expData);
      alert('Transaction updated successfully!');
    } else {
      onAddDailyExpense(expData);
      alert('Daily expense logged successfully!');
    }

    handleCancel();
  };

  // Extract available months for filter dropdown
  const availableMonths = useMemo(() => {
    return extractUniqueMonths(projectExpenses, (e) => e.date);
  }, [projectExpenses]);

  // Filtering and sorting logic
  const filteredExpenses = useMemo(() => {
    const matched = projectExpenses.filter(e => {
      // Search Description
      const matchesSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (labours.find(l => l.id === e.labourId)?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (payers.find(p => p.id === e.payerId)?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

      // Category
      const matchesCategory = filterCategory === 'all' || e.category === filterCategory;

      // Sub-category
      const matchesSubCategory = filterSubCategory === 'all' || e.subCategory === filterSubCategory;

      // Worker/Labour
      const matchesLabour = filterLabourId === 'all' || e.labourId === filterLabourId;

      // Payer
      const matchesPayer = filterPayerId === 'all' || e.payerId === filterPayerId;

      return matchesSearch && matchesCategory && matchesSubCategory && matchesLabour && matchesPayer;
    });

    const monthFiltered = filterRecordsByMonth(matched, (e) => e.date, filterMonth);
    return sortRecords(monthFiltered, (e) => e.date, (e) => e.amount, sortOrder);
  }, [projectExpenses, searchTerm, filterCategory, filterSubCategory, filterLabourId, filterPayerId, filterMonth, sortOrder, labours, payers]);

  // Get localized sub-category label
  const getSubCatLabel = (cat: 'labour_expense' | 'misc_transaction', val: string) => {
    const found = SUB_CATEGORIES[cat]?.find(s => s.value === val);
    return found ? found.label : val;
  };

  // Map of daily expenses grouped by date (YYYY-MM-DD)
  const expensesByDateMap = useMemo(() => {
    const map = new Map<string, DailyExpense[]>();
    projectExpenses.forEach(exp => {
      if (!exp.date) return;
      if (!map.has(exp.date)) {
        map.set(exp.date, []);
      }
      map.get(exp.date)!.push(exp);
    });
    return map;
  }, [projectExpenses]);

  // Calendar month days calculation
  const calendarDaysInMonth = useMemo(() => {
    return new Date(calendarYear, calendarMonth + 1, 0).getDate();
  }, [calendarYear, calendarMonth]);

  const calendarFirstDayOfWeek = useMemo(() => {
    return new Date(calendarYear, calendarMonth, 1).getDay(); // 0 = Sun
  }, [calendarYear, calendarMonth]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevCalMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
  };

  const handleNextCalMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
  };

  const handleTodayCalMonth = () => {
    setCalendarMonth(todayObj.getFullYear() ? todayObj.getMonth() : calendarMonth);
    setCalendarYear(todayObj.getFullYear());
  };

  const formatCalDateStr = (dayNum: number): string => {
    const mPadded = String(calendarMonth + 1).padStart(2, '0');
    const dPadded = String(dayNum).padStart(2, '0');
    return `${calendarYear}-${mPadded}-${dPadded}`;
  };

  // Monthly stats for the current calendar view
  const currentCalMonthKey = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
  const currentCalMonthExpenses = useMemo(() => {
    return projectExpenses.filter(e => e.date && e.date.startsWith(currentCalMonthKey));
  }, [projectExpenses, currentCalMonthKey]);

  const calMonthTotalAmount = currentCalMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
  const calMonthLabourAmount = currentCalMonthExpenses
    .filter(e => e.category === 'labour_expense')
    .reduce((sum, e) => sum + e.amount, 0);
  const calMonthMiscAmount = currentCalMonthExpenses
    .filter(e => e.category === 'misc_transaction')
    .reduce((sum, e) => sum + e.amount, 0);
  const calMonthActiveDays = new Set(currentCalMonthExpenses.map(e => e.date)).size;

  // Open calendar date modal and set date
  const handleOpenDateModal = (dateStr: string) => {
    setSelectedCalendarDate(dateStr);
    setDate(dateStr); // pre-fill entry form date
  };

  // Preset button action helper
  const handleApplyPreset = (cat: 'labour_expense' | 'misc_transaction', subVal: string, defaultDesc: string) => {
    setCategory(cat);
    setSubCategory(subVal);
    if (!description.trim()) {
      setDescription(defaultDesc);
    }
  };

  // Monthly Daily Expenses Breakdown calculation
  const [showMonthlyExpenseDetails, setShowMonthlyExpenseDetails] = useState(false);

  const monthlyDailyExpenseData = React.useMemo(() => {
    const monthsMap = new Map<string, { monthKey: string; monthLabel: string; totalAmount: number; labourAmount: number; miscAmount: number; count: number }>();

    projectExpenses.forEach(e => {
      if (!e.date || e.date.length < 7) return;
      const monthKey = e.date.substring(0, 7); // YYYY-MM
      if (!monthsMap.has(monthKey)) {
        const [y, m] = monthKey.split('-');
        const d = new Date(Number(y), Number(m) - 1, 1);
        const monthLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        monthsMap.set(monthKey, {
          monthKey,
          monthLabel,
          totalAmount: 0,
          labourAmount: 0,
          miscAmount: 0,
          count: 0
        });
      }
      const obj = monthsMap.get(monthKey)!;
      const amt = e.amount || 0;
      obj.totalAmount += amt;
      if (e.category === 'labour_expense') obj.labourAmount += amt;
      else obj.miscAmount += amt;
      obj.count += 1;
    });

    return Array.from(monthsMap.values()).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [projectExpenses]);

  return (
    <div className="space-y-6 flex-1">
      {/* Upper Title Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Coins className="w-6 h-6 text-emerald-600" />
            Labour Daily Expenses & Miscellaneous Transactions
          </h2>
          <p className="text-slate-500 text-xs">
            Log and manage minor site outlays, tea/snacks, worker transport, medical kit refills, and general miscellaneous expenses for <span className="font-semibold text-slate-800">{activeProject.name}</span>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle Segmented Control */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeViewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              <span>📋 Ledger List</span>
            </button>
            <button
              onClick={() => handleViewModeChange('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeViewMode === 'calendar'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5 text-emerald-600" />
              <span>📅 Calendar View</span>
            </button>
          </div>

          <button
            onClick={() => {
              if (showForm) handleCancel();
              else setShowForm(true);
            }}
            className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-xs font-semibold shadow-xs cursor-pointer transition"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'Close Expense Logger' : 'Log New Expense / Misc Outlay'}
          </button>
        </div>
      </div>

      {/* CALENDAR VIEW SECTION */}
      {activeViewMode === 'calendar' && (
        <div className="space-y-5 animate-fade-in">
          {/* Calendar Month Navigation & Stats Header */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
              {/* Month Navigation Title */}
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                    <span>{monthNames[calendarMonth]} {calendarYear}</span>
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                      ₹{calMonthTotalAmount.toLocaleString('en-IN')} Total
                    </span>
                  </h3>
                  <p className="text-slate-400 text-[11px] font-medium">
                    Tap any date below to view recorded expenses or rapidly add new entries for that day.
                  </p>
                </div>
              </div>

              {/* Month Switcher Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevCalMonth}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                <button
                  onClick={handleTodayCalMonth}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  Today
                </button>

                <button
                  onClick={handleNextCalMonth}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                  title="Next Month"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Month Dropdown */}
                <select
                  value={calendarMonth}
                  onChange={(e) => setCalendarMonth(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  {monthNames.map((mName, idx) => (
                    <option key={mName} value={idx}>{mName}</option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select
                  value={calendarYear}
                  onChange={(e) => setCalendarYear(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900 cursor-pointer"
                >
                  {[calendarYear - 2, calendarYear - 1, calendarYear, calendarYear + 1, calendarYear + 2].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Month Summary Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/80 p-3 rounded-lg border border-slate-200/60 font-mono text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Month Total Spent</span>
                <span className="font-extrabold text-slate-900 text-sm">₹{calMonthTotalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block font-sans">Labour Daily Outlays</span>
                <span className="font-extrabold text-indigo-700 text-sm">₹{calMonthLabourAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block font-sans">Misc Transactions</span>
                <span className="font-extrabold text-amber-700 text-sm">₹{calMonthMiscAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-sans">Active Days Logged</span>
                <span className="font-extrabold text-emerald-700 text-sm font-sans">{calMonthActiveDays} days with expenses</span>
              </div>
            </div>
          </div>

          {/* 7-Column Day Calendar Grid */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            {/* Days of Week Header */}
            <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200 text-center font-extrabold text-[10px] uppercase tracking-wider text-slate-600 py-2.5">
              <div className="text-rose-600">Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div className="text-indigo-600">Sat</div>
            </div>

            {/* Calendar Cells Grid */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-slate-50/30">
              {/* Empty leading cells for first day offset */}
              {Array.from({ length: calendarFirstDayOfWeek }).map((_, i) => (
                <div key={`offset-${i}`} className="min-h-[110px] sm:min-h-[125px] bg-slate-50/50 p-2 text-slate-300 pointer-events-none" />
              ))}

              {/* Day Cells */}
              {Array.from({ length: calendarDaysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = formatCalDateStr(dayNum);
                const dayExpenses = expensesByDateMap.get(dateStr) || [];
                const dayTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0);

                const todayStr = todayObj.toISOString().split('T')[0];
                const isToday = dateStr === todayStr;

                return (
                  <div
                    key={dateStr}
                    onClick={() => handleOpenDateModal(dateStr)}
                    className={`min-h-[110px] sm:min-h-[130px] p-2 transition cursor-pointer relative group flex flex-col justify-between hover:bg-emerald-50/40 hover:border-emerald-300 ${
                      isToday 
                        ? 'bg-emerald-50/50 ring-2 ring-emerald-500 ring-inset font-bold' 
                        : 'bg-white hover:shadow-xs'
                    }`}
                  >
                    <div>
                      {/* Cell Header: Day Number & Day Total Badge */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-md ${
                          isToday 
                            ? 'bg-emerald-600 text-white' 
                            : 'text-slate-800 group-hover:text-emerald-700'
                        }`}>
                          {dayNum}
                        </span>

                        {dayTotal > 0 && (
                          <span className="text-[10px] font-extrabold font-mono text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                            ₹{dayTotal.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      {/* Expense Item Pills inside Day Cell */}
                      {dayExpenses.length > 0 ? (
                        <div className="space-y-1 max-h-[85px] overflow-hidden">
                          {dayExpenses.slice(0, 3).map((exp) => {
                            const isLabour = exp.category === 'labour_expense';
                            const subInfo = SUB_CATEGORIES[exp.category]?.find(s => s.value === exp.subCategory);
                            const iconStr = subInfo?.icon || (isLabour ? '☕' : '📦');

                            return (
                              <div
                                key={exp.id}
                                className={`text-[9px] p-1 rounded border leading-tight truncate flex items-center justify-between font-medium ${
                                  isLabour
                                    ? 'bg-indigo-50/90 text-indigo-900 border-indigo-200'
                                    : 'bg-amber-50/90 text-amber-900 border-amber-200'
                                }`}
                                title={`${exp.description} (₹${exp.amount})`}
                              >
                                <span className="truncate pr-1">
                                  {iconStr} {exp.description || subInfo?.label || exp.subCategory}
                                </span>
                                <span className="font-extrabold font-mono text-[9px] whitespace-nowrap">
                                  ₹{exp.amount}
                                </span>
                              </div>
                            );
                          })}

                          {dayExpenses.length > 3 && (
                            <div className="text-[8px] font-bold text-slate-400 text-center uppercase tracking-wider pt-0.5">
                              +{dayExpenses.length - 3} more...
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[9px] text-slate-300 italic pt-2 group-hover:text-emerald-600/60 transition">
                          Tap to add expense
                        </div>
                      )}
                    </div>

                    {/* Plus Icon Hover Trigger */}
                    <div className="mt-1 flex justify-end opacity-0 group-hover:opacity-100 transition">
                      <span className="text-[9px] bg-slate-900 text-white font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 shadow-2xs">
                        <Plus className="w-2.5 h-2.5" /> Log
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Total Outlay */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-lg">
            <IndianRupee className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total logged outlays</p>
            <h3 className="text-xl font-extrabold text-slate-900">₹{totalLogged.toLocaleString('en-IN')}</h3>
            <p className="text-[10px] text-slate-400 font-medium">For current project</p>
          </div>
        </div>

        {/* Worker Daily Expenses */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="bg-indigo-50 text-indigo-600 p-3 rounded-lg">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Labour Daily Expenses</p>
            <h3 className="text-xl font-extrabold text-slate-900">₹{totalLabourExp.toLocaleString('en-IN')}</h3>
            <p className="text-[10px] text-indigo-500 font-semibold">{projectExpenses.filter(e => e.category === 'labour_expense').length} logs recorded</p>
          </div>
        </div>

        {/* General Misc Outlays */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="bg-amber-50 text-amber-600 p-3 rounded-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Miscellaneous Outlays</p>
            <h3 className="text-xl font-extrabold text-slate-900">₹{totalMiscExp.toLocaleString('en-IN')}</h3>
            <p className="text-[10px] text-amber-600 font-semibold">{projectExpenses.filter(e => e.category === 'misc_transaction').length} transactions recorded</p>
          </div>
        </div>
      </div>

      {/* Monthly Site Expenses Breakdown Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowMonthlyExpenseDetails(!showMonthlyExpenseDetails)}>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                Monthly Site Outlay & Misc Expenses
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {monthlyDailyExpenseData.length} Months Logged
                </span>
              </h3>
              <p className="text-[10px] text-slate-500">Historical month-by-month site operational expenses, worker tea/snacks, and misc transactions.</p>
            </div>
          </div>
          <button className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer">
            {showMonthlyExpenseDetails ? 'Hide Monthly Table ▲' : 'View Monthly Breakdown ▼'}
          </button>
        </div>

        {showMonthlyExpenseDetails && (
          <div className="overflow-x-auto border-t border-slate-100 pt-3">
            {monthlyDailyExpenseData.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No site expenses recorded yet.</p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                    <th className="p-2.5">Month</th>
                    <th className="p-2.5 text-right">Labour Expenses (Tea/Tools) (₹)</th>
                    <th className="p-2.5 text-right">Misc Site Transactions (₹)</th>
                    <th className="p-2.5 text-right font-black">Total Month Outlay (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {monthlyDailyExpenseData.map((m) => (
                    <tr key={m.monthKey} className="hover:bg-slate-50/80">
                      <td className="p-2.5 font-bold font-sans text-slate-800 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                        {m.monthLabel}
                      </td>
                      <td className="p-2.5 text-right text-indigo-700 font-semibold">
                        ₹{m.labourAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="p-2.5 text-right text-amber-700 font-semibold">
                        ₹{m.miscAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="p-2.5 text-right font-black text-slate-900 bg-slate-50/50">
                        ₹{m.totalAmount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Expense Form Container */}
      {showForm && (
        <div id="expense-form-container" className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-sm">
              {editingExpense ? '✏️ Edit Logged Expense / Transaction' : '📝 Log Daily Expense / Misc Transaction'}
            </h3>
            <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Transaction Date *</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Category selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Expense Category *</label>
                <select
                  value={category}
                  onChange={(e) => handleCategoryChange(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="labour_expense">Daily Expense of Labourers</option>
                  <option value="misc_transaction">Miscellaneous Transaction / General</option>
                </select>
              </div>

              {/* Sub Category selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Specific Type *</label>
                <select
                  value={subCategory}
                  onChange={(e) => setSubCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {SUB_CATEGORIES[category].map((sub) => (
                    <option key={sub.value} value={sub.value}>
                      {sub.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Amount input */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Outlay Amount (₹) *</label>
                <div className="relative">
                  <span className="text-slate-400 font-bold text-xs absolute left-3.5 top-3">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Enter amount paid"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold"
                  />
                </div>
              </div>

              {/* Labour Picker (only if labour_expense) */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Target Worker {category === 'labour_expense' ? '(Optional but Recommended)' : '(N/A for general Misc)'}
                </label>
                <select
                  disabled={category === 'misc_transaction'}
                  value={selectedLabourId}
                  onChange={(e) => setSelectedLabourId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">Generic (Applied to all workers / Site broad)</option>
                  {labours.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.status === 'left' ? `(Left on ${l.leftDate})` : '(Active)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payer/Paying Officer & Partner Help */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Disbursed/Paid By (Payer / Cashier) *</label>
                
                <select
                  required
                  value={selectedPayerId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedPayerId(val);
                    const foundPayer = payers.find(p => p.id === val || p.name === val);
                    const foundLabour = labours.find(l => l.id === val || l.name === val);
                    if (foundPayer?.phone) {
                      setPartnerPhone(foundPayer.phone);
                    } else if (foundLabour?.contact || foundLabour?.phone) {
                      setPartnerPhone(foundLabour.contact || foundLabour.phone || '');
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold"
                >
                  <option value="">-- Choose Disbursing Payer / Cashier --</option>
                  
                  {payers && payers.length > 0 && (
                    <optgroup label="🏢 Registered Payers & Financial Partners">
                      {payers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.role ? `(${p.role})` : ''} {p.phone ? `• 📞 ${p.phone}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {labours && labours.length > 0 && (
                    <optgroup label="👷 Project Members & Labour Registry">
                      {labours.map((l) => (
                        <option key={`disb_lab_${l.id}`} value={l.name}>
                          {l.name} {l.role || l.category ? `(${String(l.role || l.category).toUpperCase()})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* 🤝 Dedicated Partner Help / Financial Support Section */}
                <div className="mt-2.5 p-3 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-xl space-y-2.5">
                  <label className="inline-flex items-center gap-2 text-xs text-amber-900 dark:text-amber-300 font-extrabold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPartnerHelp}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsPartnerHelp(checked);
                      }}
                      className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span>🤝 Partner Help / Financial Support Provided</span>
                  </label>

                  {isPartnerHelp && (
                    <div className="space-y-2.5 pt-2 border-t border-amber-200/60 dark:border-amber-900/40">
                      <div>
                        <label className="block text-[10px] font-extrabold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">
                          Select Supporting Partner / Member Present in Project (Basanta, BDK, Singra, Deben, etc.) *
                        </label>
                        <select
                          value={partnerMember}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPartnerMember(val);
                            const foundPayer = payers.find(p => p.id === val || p.name === val);
                            const foundLabour = labours.find(l => l.id === val || l.name === val);
                            if (foundPayer?.phone) {
                              setPartnerPhone(foundPayer.phone);
                            } else if (foundLabour?.contact || foundLabour?.phone) {
                              setPartnerPhone(foundLabour.contact || foundLabour.phone || '');
                            }
                          }}
                          className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="">-- Choose Member / Partner Who Gave Financial Help --</option>
                          {labours && labours.length > 0 && (
                            <optgroup label="👷 Project Members & Labour Registry (Basanta, BDK, Singra, Deben, etc.)">
                              {labours.map((l) => (
                                <option key={`phelp_lab_${l.id}`} value={l.name}>
                                  {l.name} {l.role || l.category ? `• ${String(l.role || l.category).toUpperCase()}` : ''} {(l.contact || l.phone) ? `(📞 ${l.contact || l.phone})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {payers && payers.length > 0 && (
                            <optgroup label="🏢 Registered Financial Payers & Partners">
                              {payers.map((p) => (
                                <option key={`phelp_payer_${p.id}`} value={p.name}>
                                  {p.name} {p.role ? `• ${p.role}` : ''} {p.phone ? `(📞 ${p.phone})` : ''}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Quick Select Member Chips inside Partner Help */}
                      {labours && labours.length > 0 && (
                        <div>
                          <span className="text-[9px] font-extrabold text-amber-800 dark:text-amber-400 uppercase block mb-1">
                            Quick Select Member Present in Project:
                          </span>
                          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                            {labours.map((l) => (
                              <button
                                key={`phelp_chip_${l.id}`}
                                type="button"
                                onClick={() => {
                                  setIsPartnerHelp(true);
                                  setPartnerMember(l.name);
                                  if (l.contact || l.phone) setPartnerPhone(l.contact || l.phone || '');
                                }}
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border transition cursor-pointer flex items-center gap-1 ${
                                  partnerMember === l.name || partnerMember === l.id
                                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40'
                                }`}
                              >
                                <span>👤 {l.name}</span>
                                {(l.role || l.category) && (
                                  <span className="text-[8px] opacity-75 font-normal">({l.role || l.category})</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom Box to Add Money/Amount Provided by Partner */}
                      <div className="bg-amber-100/90 dark:bg-amber-900/40 p-2.5 rounded-lg border border-amber-300 dark:border-amber-700 space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="block text-[10px] font-black text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                            💵 Partner Support Contribution Amount (₹) *
                          </label>
                          <span className="text-[9px] font-bold text-amber-800 dark:text-amber-400">
                            Outlay: ₹{parseFloat(amount) || 0}
                          </span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder={`Defaults to full outlay amount (₹${parseFloat(amount) || 0})`}
                          value={partnerAmount}
                          onChange={(e) => setPartnerAmount(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-amber-400 dark:border-amber-600 rounded-lg px-3 py-1.5 text-xs font-bold font-mono text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs"
                        />
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[9px] font-bold text-amber-800 dark:text-amber-400">Presets:</span>
                          <button
                            type="button"
                            onClick={() => setPartnerAmount(amount)}
                            className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 hover:bg-amber-300 transition cursor-pointer"
                          >
                            Full (100%): ₹{parseFloat(amount) || 0}
                          </button>
                          {parseFloat(amount) > 0 && (
                            <button
                              type="button"
                              onClick={() => setPartnerAmount((parseFloat(amount) / 2).toString())}
                              className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 hover:bg-amber-300 transition cursor-pointer"
                            >
                              Half (50%): ₹{(parseFloat(amount) / 2)}
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-1">
                          Partner Phone / Contact Number
                        </label>
                        <input
                          type="tel"
                          placeholder="Partner Phone Number"
                          value={partnerPhone}
                          onChange={(e) => setPartnerPhone(e.target.value)}
                          className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono text-slate-800 dark:text-slate-200"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Description and Receipt Image */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Description Input */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Brief Details / Purpose *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain exactly what this cash expense was spent on (e.g. 5x packets biscuit and chai for afternoon slab casting shift)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Receipt File Drag and Drop */}
              <div className="space-y-1.5 flex flex-col justify-between">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Receipt Voucher / Bill Image</label>
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center text-center hover:border-slate-400 hover:bg-slate-50 transition cursor-pointer flex-1 min-h-[90px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  {receiptImage ? (
                    <div className="space-y-1">
                      <FileText className="w-6 h-6 text-emerald-600 mx-auto" />
                      <p className="text-[10px] font-bold text-slate-700 truncate max-w-[180px]">{receiptImageName}</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearReceipt();
                        }}
                        className="text-[9px] text-rose-500 font-bold hover:underline"
                      >
                        Remove Image
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1 text-slate-400">
                      <Upload className="w-6 h-6 mx-auto" />
                      <p className="text-[10px] font-semibold text-slate-500">Drag & drop or Click to upload</p>
                      <p className="text-[8px] text-slate-400">PNG, JPG up to 2MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={handleCancel}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5"
              >
                {editingExpense ? <Pencil className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                {editingExpense ? 'Update Expense Record' : 'Save Expense Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-500" />
            Filters & Transaction Search
          </h3>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search description, worker, payer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-950"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          {/* Category Filter */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
            <select
              value={filterCategory}
              onChange={(e) => {
                setFilterCategory(e.target.value);
                setFilterSubCategory('all');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="labour_expense">Daily Expense of Labourers</option>
              <option value="misc_transaction">Miscellaneous Transactions</option>
            </select>
          </div>

          {/* Sub-Category Filter */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Specific Type</span>
            <select
              value={filterSubCategory}
              onChange={(e) => setFilterSubCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 focus:outline-none"
            >
              <option value="all">All Types</option>
              {filterCategory === 'all' ? (
                <>
                  <optgroup label="Labour Daily Expenses">
                    {SUB_CATEGORIES.labour_expense.map(s => <option key={`f-${s.value}`} value={s.value}>{s.label}</option>)}
                  </optgroup>
                  <optgroup label="Misc Transactions">
                    {SUB_CATEGORIES.misc_transaction.map(s => <option key={`f-${s.value}`} value={s.value}>{s.label}</option>)}
                  </optgroup>
                </>
              ) : (
                SUB_CATEGORIES[filterCategory as 'labour_expense' | 'misc_transaction']?.map(s => (
                  <option key={`f-${s.value}`} value={s.value}>{s.label}</option>
                ))
              )}
            </select>
          </div>

          {/* Worker Filter */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Linked Worker</span>
            <select
              value={filterLabourId}
              onChange={(e) => setFilterLabourId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 focus:outline-none"
            >
              <option value="all">All Workers / Generic</option>
              {labours.map(l => (
                <option key={`f-lab-${l.id}`} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Payer Filter */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Paying Officer</span>
            <select
              value={filterPayerId}
              onChange={(e) => setFilterPayerId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 focus:outline-none"
            >
              <option value="all">All Payers</option>
              {payers.map(p => (
                <option key={`f-pay-${p.id}`} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Filter Month</span>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 focus:outline-none"
            >
              <option value="all">All Months</option>
              {availableMonths.map(m => (
                <option key={`m-${m.key}`} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div className="space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Sort Order</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as LedgerSortOrder)}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-600 focus:outline-none font-sans"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="monthly_desc">Monthly Order (Latest Month First)</option>
              <option value="monthly_asc">Monthly Order (Earliest Month First)</option>
              <option value="amount_high">Highest Amount First</option>
              <option value="amount_low">Lowest Amount First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            Transaction Ledger Log ({filteredExpenses.length} entries shown)
          </h3>
          <span className="bg-slate-200 text-slate-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full">
            Active Project Total: ₹{filteredExpenses.reduce((sum, e) => sum + e.amount, 0).toLocaleString('en-IN')}
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <AlertCircle className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-slate-500 text-sm font-semibold">No transactions found matching your search filters.</p>
            <p className="text-slate-400 text-xs">Try clearing filters or log a new cash outlay above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Category / Type</th>
                  <th className="px-5 py-3">Linked Person/Details</th>
                  <th className="px-5 py-3">Description / Purpose</th>
                  <th className="px-5 py-3">Paid By</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-center">Receipt</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredExpenses.map((exp) => {
                  const targetLabour = labours.find(l => l.id === exp.labourId);
                  const payer = payers.find(p => p.id === exp.payerId);

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/30 text-xs transition">
                      {/* Date */}
                      <td className="px-5 py-3.5 whitespace-nowrap font-mono text-slate-600 font-semibold">{exp.date}</td>

                      {/* Category & Sub */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                            exp.category === 'labour_expense' 
                              ? 'bg-indigo-50 border-indigo-100 text-indigo-700' 
                              : 'bg-amber-50 border-amber-100 text-amber-700'
                          }`}>
                            {exp.category === 'labour_expense' ? 'Labour' : 'Misc'}
                          </span>
                          <p className="font-semibold text-slate-800 text-xs">
                            {getSubCatLabel(exp.category, exp.subCategory)}
                          </p>
                        </div>
                      </td>

                      {/* Linked Worker details */}
                      <td className="px-5 py-3.5">
                        {exp.category === 'labour_expense' ? (
                          targetLabour ? (
                            <div className="space-y-0.5">
                              <p className="font-semibold text-slate-800">{targetLabour.name}</p>
                              <p className="text-[9px] font-mono text-slate-400">Wage: ₹{targetLabour.perDayWage}/day</p>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">Generic / All Workers</span>
                          )
                        ) : (
                          <span className="text-slate-400 italic text-[10px]">N/A (Misc Transaction)</span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="px-5 py-3.5 max-w-xs md:max-w-sm">
                        <p className="text-slate-600 line-clamp-2 text-xs" title={exp.description}>
                          {exp.description}
                        </p>
                      </td>

                      {/* Payer details */}
                      <td className="px-5 py-3.5 font-semibold text-slate-700">
                        {payer ? payer.name : <span className="text-slate-400 font-normal italic">-</span>}
                      </td>

                      {/* Amount */}
                      <td className="px-5 py-3.5 text-right font-extrabold text-slate-900 whitespace-nowrap">
                        ₹{exp.amount.toLocaleString('en-IN')}
                      </td>

                      {/* Receipt */}
                      <td className="px-5 py-3.5 text-center whitespace-nowrap">
                        {exp.receiptImage ? (
                          <button
                            onClick={() => setViewingReceipt({ url: exp.receiptImage!, name: exp.receiptImageName || 'Receipt' })}
                            className="inline-flex items-center gap-1 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md px-2 py-1 font-bold cursor-pointer transition border border-slate-200"
                            title="Click to view file"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>View</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[10px] italic">No File</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {deletingExpenseId === exp.id ? (
                          <div className="flex items-center justify-end gap-1.5 animate-fade-in">
                            <button
                              onClick={() => {
                                onDeleteDailyExpense(exp.id);
                                setDeletingExpenseId(null);
                              }}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold cursor-pointer transition shadow-xs"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeletingExpenseId(null)}
                              className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-medium cursor-pointer transition"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEditClick(exp)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                              title="Edit transaction details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeletingExpenseId(exp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Delete transaction log"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selected Date Inspector & Rapid Entry Modal */}
      {selectedCalendarDate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in no-print-overlay">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col border border-slate-200 shadow-2xl overflow-hidden printable-dialog">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-2">
                    <span>Expense & Misc Log: {selectedCalendarDate}</span>
                  </h3>
                  <p className="text-slate-300 text-[11px] font-medium">
                    View or add daily expenses, tea/snacks, fuel, and site outlays for this day.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {(() => {
                  const dayRecs = expensesByDateMap.get(selectedCalendarDate) || [];
                  const sumVal = dayRecs.reduce((tot, x) => tot + x.amount, 0);
                  return (
                    <span className="text-xs font-mono font-extrabold bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-full shadow-2xs">
                      ₹{sumVal.toLocaleString('en-IN')} Day Total
                    </span>
                  );
                })()}

                <button
                  onClick={() => {
                    setSelectedCalendarDate(null);
                    setEditingExpense(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-6 flex-1">
              {/* SECTION A: Existing Records for Selected Date */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  Recorded Expenses on {selectedCalendarDate}
                </h4>

                {(() => {
                  const dayRecs = expensesByDateMap.get(selectedCalendarDate) || [];
                  if (dayRecs.length === 0) {
                    return (
                      <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-4 text-center space-y-1">
                        <p className="text-xs font-semibold text-slate-600">No expenses recorded for this date yet</p>
                        <p className="text-[11px] text-slate-400">
                          Use the quick entry form below to log tea, snacks, transport, fuel, or misc expenses for this day.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {dayRecs.map((exp) => {
                        const targetLabour = labours.find(l => l.id === exp.labourId);
                        const payer = payers.find(p => p.id === exp.payerId);
                        const isLabour = exp.category === 'labour_expense';

                        return (
                          <div 
                            key={exp.id} 
                            className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 transition space-y-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${
                                  isLabour
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                    : 'bg-amber-50 border-amber-200 text-amber-700'
                                }`}>
                                  {isLabour ? '👷 Labour Outlay' : '📦 Misc Transaction'}
                                </span>
                                <span className="font-bold text-xs text-slate-800">
                                  {getSubCatLabel(exp.category, exp.subCategory)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="font-mono font-extrabold text-sm text-slate-900 bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                                  ₹{exp.amount.toLocaleString('en-IN')}
                                </span>

                                <button
                                  onClick={() => {
                                    setEditingExpense(exp);
                                    setDate(exp.date);
                                    setCategory(exp.category);
                                    setSubCategory(exp.subCategory);
                                    setAmount(exp.amount.toString());
                                    setDescription(exp.description);
                                    setSelectedLabourId(exp.labourId || '');
                                    setSelectedPayerId(exp.payerId || '');
                                    setIsPartnerHelp(!!exp.isPartnerHelp);
                                    setPartnerAmount(exp.partnerAmount ? exp.partnerAmount.toString() : '');
                                    setPartnerPhone(exp.partnerPhone || '');
                                    setReceiptImage(exp.receiptImage);
                                    setReceiptImageName(exp.receiptImageName);
                                  }}
                                  className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                  title="Edit Record"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    if (window.confirm('Are you sure you want to delete this expense entry?')) {
                                      onDeleteDailyExpense(exp.id);
                                    }
                                  }}
                                  className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                                  title="Delete Record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 font-normal">
                              {exp.description}
                            </p>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                              <div className="flex items-center gap-3">
                                {payer && (
                                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                                    <User className="w-3 h-3 text-slate-400" /> Disbursed by: {payer.name}
                                  </span>
                                )}
                                {targetLabour && (
                                  <span className="flex items-center gap-1 font-semibold text-indigo-700">
                                    <User className="w-3 h-3 text-indigo-400" /> For Worker: {targetLabour.name}
                                  </span>
                                )}
                              </div>

                              {exp.isPartnerHelp && (
                                <span className="text-[10px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded border border-purple-200">
                                  🤝 Partner Help: ₹{exp.partnerAmount || 0}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* SECTION B: Quick Form for Entry on Selected Date */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    {editingExpense ? 'Edit Daily Expense Record' : `Log Expense for ${selectedCalendarDate}`}
                  </h4>
                  {editingExpense && (
                    <button
                      onClick={handleCancel}
                      className="text-[11px] text-slate-500 hover:text-slate-800 underline font-semibold"
                    >
                      Cancel Edit Mode
                    </button>
                  )}
                </div>

                {/* Quick Presets Buttons */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    ⚡ Quick Presets (Tap to auto-fill):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('labour_expense', 'tea_snacks', 'Tea & snacks for site workers')}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                    >
                      ☕ Tea & Snacks
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('misc_transaction', 'fuel_power', 'Fuel / Diesel for machinery generator')}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                    >
                      ⛽ Fuel & Power
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('misc_transaction', 'freight_transport', 'Local freight / auto carriage charges')}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                    >
                      🚚 Freight & Carriage
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('labour_expense', 'medical', 'First-aid medical supplies & medicine')}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                    >
                      💊 Medical Kit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset('misc_transaction', 'site_cleaning', 'Site cleaning & debris disposal')}
                      className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                    >
                      🧹 Site Cleaning
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Category Switcher */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCategory('labour_expense');
                        setSubCategory('tea_snacks');
                      }}
                      className={`p-2.5 rounded-lg border text-xs font-bold transition text-center cursor-pointer ${
                        category === 'labour_expense'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      👷 Labour Daily Expense
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCategory('misc_transaction');
                        setSubCategory('fuel_power');
                      }}
                      className={`p-2.5 rounded-lg border text-xs font-bold transition text-center cursor-pointer ${
                        category === 'misc_transaction'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      📦 Misc Site Outlay
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Subcategory */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Expense Sub-category
                      </label>
                      <select
                        value={subCategory}
                        onChange={(e) => setSubCategory(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        required
                      >
                        {SUB_CATEGORIES[category].map((sc) => (
                          <option key={sc.value} value={sc.value}>
                            {sc.icon} {sc.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Outlay Amount (₹) <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="number"
                          min="1"
                          step="any"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="e.g. 250"
                          className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Purpose / Details */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Purpose / Description <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Tea & samosa for 8 labourers working late shift"
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Disbursing Payer */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Paid By / Cashier
                      </label>
                      <select
                        value={selectedPayerId}
                        onChange={(e) => setSelectedPayerId(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      >
                        <option value="">-- Cash / Petty Cash --</option>
                        {payers.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.role || 'Payer'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Linked Labour (if Labour Expense) */}
                    {category === 'labour_expense' && (
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Target Worker (Optional)
                        </label>
                        <select
                          value={selectedLabourId}
                          onChange={(e) => setSelectedLabourId(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        >
                          <option value="">-- Generic / Whole Group --</option>
                          {labours.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name} ({l.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-5 py-2 text-xs font-extrabold cursor-pointer transition shadow-xs flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      {editingExpense ? 'Update Record' : `Save Record for ${selectedCalendarDate}`}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => {
                  setSelectedCalendarDate(null);
                  setEditingExpense(null);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Receipt image Viewer Modal */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden border border-slate-200 shadow-xl space-y-4">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-xs truncate max-w-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Receipt: {viewingReceipt.name}
              </h4>
              <button 
                onClick={() => setViewingReceipt(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-100 max-h-[70vh] overflow-y-auto flex justify-center items-center">
              <img 
                src={viewingReceipt.url} 
                alt={viewingReceipt.name} 
                referrerPolicy="no-referrer"
                className="max-w-full max-h-[60vh] object-contain rounded-lg border border-slate-200 shadow-sm"
              />
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingReceipt(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer transition"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

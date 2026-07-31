import React, { useState, useMemo } from 'react';
import { Project, PettyCashEntry, Payer, getProjectScopeIds } from '../types';
import { generateId } from '../utils/id';
import { 
  Wallet, 
  Plus, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Receipt, 
  UserCheck, 
  Image, 
  Trash2, 
  Pencil, 
  Calendar, 
  MapPin, 
  DollarSign, 
  Coffee, 
  Fuel, 
  Wrench, 
  Car, 
  Users, 
  AlertCircle,
  Eye,
  Download,
  X,
  PlusCircle,
  CheckCircle2
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface PettyCashRegisterProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  pettyCashEntries: PettyCashEntry[];
  payers: Payer[];
  onAddEntry: (entry: Omit<PettyCashEntry, 'id'>) => Promise<void>;
  onUpdateEntry: (entry: PettyCashEntry) => Promise<void>;
  onDeleteEntry: (id: string) => Promise<void>;
}

export default function PettyCashRegister({
  projects,
  activeProjectId,
  onSelectProject,
  pettyCashEntries,
  payers,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry
}: PettyCashRegisterProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PettyCashEntry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'top_up' | 'expense'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form Fields
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'top_up' | 'expense'>('expense');
  const [supervisorName, setSupervisorName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<PettyCashEntry['category']>('tea_snacks');
  const [description, setDescription] = useState('');
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);
  const [receiptImageName, setReceiptImageName] = useState<string | undefined>(undefined);
  const [payerId, setPayerId] = useState<string>('');

  // Selected Project Context
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  const scopedProjectIds = useMemo(() => {
    if (!activeProject) return [];
    return getProjectScopeIds(activeProject.id, projects);
  }, [activeProject, projects]);

  // Scoped Petty Cash Entries
  const currentEntries = useMemo(() => {
    return pettyCashEntries
      .filter(e => scopedProjectIds.includes(e.projectId))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [pettyCashEntries, scopedProjectIds]);

  // Distinct Supervisor List
  const supervisorList = useMemo(() => {
    const set = new Set<string>();
    currentEntries.forEach(e => {
      if (e.supervisorName) set.add(e.supervisorName.trim());
    });
    return Array.from(set);
  }, [currentEntries]);

  // Filtered Entries
  const filteredEntries = useMemo(() => {
    return currentEntries.filter(e => {
      const matchSearch = 
        !searchQuery || 
        e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.supervisorName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchSupervisor = supervisorFilter === 'all' || e.supervisorName === supervisorFilter;
      const matchType = typeFilter === 'all' || e.type === typeFilter;
      const matchCategory = categoryFilter === 'all' || e.category === categoryFilter;

      return matchSearch && matchSupervisor && matchType && matchCategory;
    });
  }, [currentEntries, searchQuery, supervisorFilter, typeFilter, categoryFilter]);

  // Financial Stats & Supervisor Balances
  const stats = useMemo(() => {
    let totalTopUp = 0;
    let totalExpense = 0;

    const supervisorBalanceMap = new Map<string, { topUp: number; expense: number; balance: number }>();

    currentEntries.forEach(e => {
      const name = e.supervisorName || 'General Site';
      if (!supervisorBalanceMap.has(name)) {
        supervisorBalanceMap.set(name, { topUp: 0, expense: 0, balance: 0 });
      }

      const sup = supervisorBalanceMap.get(name)!;

      if (e.type === 'top_up') {
        totalTopUp += e.amount;
        sup.topUp += e.amount;
      } else {
        totalExpense += e.amount;
        sup.expense += e.amount;
      }

      sup.balance = sup.topUp - sup.expense;
    });

    const netCashInHand = totalTopUp - totalExpense;

    return {
      totalTopUp,
      totalExpense,
      netCashInHand,
      supervisorBalances: Array.from(supervisorBalanceMap.entries()).map(([name, data]) => ({
        name,
        ...data
      }))
    };
  }, [currentEntries]);

  // Handle Photo Attachment
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('Photo size exceeds 8MB. Please choose a smaller image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptImage(event.target?.result as string);
      setReceiptImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  // Open Add Modal
  const handleOpenAdd = (defaultType: 'top_up' | 'expense' = 'expense') => {
    setEditingEntry(null);
    setDate(new Date().toISOString().split('T')[0]);
    setType(defaultType);
    setSupervisorName(supervisorList[0] || '');
    setAmount('');
    setCategory(defaultType === 'top_up' ? 'top_up' : 'tea_snacks');
    setDescription('');
    setReceiptImage(undefined);
    setReceiptImageName(undefined);
    setPayerId('');
    setShowModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (entry: PettyCashEntry) => {
    setEditingEntry(entry);
    setDate(entry.date);
    setType(entry.type);
    setSupervisorName(entry.supervisorName);
    setAmount(entry.amount.toString());
    setCategory(entry.category || 'tea_snacks');
    setDescription(entry.description);
    setReceiptImage(entry.receiptImage);
    setReceiptImageName(entry.receiptImageName);
    setPayerId(entry.payerId || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid positive cash amount.');
      return;
    }

    if (!supervisorName.trim()) {
      alert('Please specify the supervisor or manager name.');
      return;
    }

    if (editingEntry) {
      await onUpdateEntry({
        ...editingEntry,
        date,
        type,
        supervisorName: supervisorName.trim(),
        amount: numAmount,
        category,
        description: description.trim() || (type === 'top_up' ? 'Petty Cash Disbursed' : 'Site Expense'),
        receiptImage,
        receiptImageName,
        payerId: type === 'top_up' ? payerId : undefined,
        updatedAt: Date.now()
      });
    } else {
      await onAddEntry({
        projectId: activeProject.id,
        date,
        type,
        supervisorName: supervisorName.trim(),
        amount: numAmount,
        category,
        description: description.trim() || (type === 'top_up' ? 'Petty Cash Disbursed' : 'Site Expense'),
        receiptImage,
        receiptImageName,
        payerId: type === 'top_up' ? payerId : undefined,
        updatedAt: Date.now()
      });
    }

    setShowModal(false);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      alert('No petty cash entries to export.');
      return;
    }

    const headers = ['Date', 'Type', 'Supervisor / Manager', 'Category', 'Description', 'Amount (INR)', 'Payer / Source'];
    const rows = filteredEntries.map(e => [
      e.date,
      e.type === 'top_up' ? 'CASH TOP-UP' : 'EXPENSE',
      `"${e.supervisorName.replace(/"/g, '""')}"`,
      e.category || 'misc',
      `"${e.description.replace(/"/g, '""')}"`,
      e.amount,
      e.payerId ? `"${payers.find(p => p.id === e.payerId)?.name || ''}"` : ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Petty_Cash_Register_${activeProject?.name || 'Site'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white p-6 rounded-2xl shadow-md border border-amber-900/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500/20 text-amber-300 text-xs font-mono font-bold px-2.5 py-0.5 rounded-md border border-amber-400/30">
                Supervisor Cash Ledger
              </span>
              <span className="text-xs text-amber-200/70 flex items-center gap-1 font-mono">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                {activeProject?.name || 'All Sites'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
              Site Supervisor Petty Cash & Expense Register
            </h2>
            <p className="text-xs text-amber-200/80 mt-1 leading-relaxed max-w-2xl">
              Track daily cash-in-hand given to site engineers and supervisors for emergency site purchases (tea, fuel, small hardware items, transport) with instant receipt photo attachments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => handleOpenAdd('top_up')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs transition"
            >
              <ArrowDownLeft className="w-4 h-4" />
              + Disburse Cash (Top-up)
            </button>
            <button
              onClick={() => handleOpenAdd('expense')}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              + Record Site Expense
            </button>
          </div>
        </div>

        {/* Site Switcher & CSV Export */}
        <div className="mt-6 pt-4 border-t border-amber-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-amber-200/80 font-mono">Select Site:</label>
            <select
              value={activeProjectId || ''}
              onChange={(e) => onSelectProject(e.target.value)}
              className="bg-slate-900 text-amber-100 border border-amber-800 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportCSV}
            className="text-xs font-bold font-mono text-amber-300 hover:text-white bg-amber-900/40 hover:bg-amber-900/80 border border-amber-800/80 px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer self-start sm:self-center"
          >
            <Download className="w-3.5 h-3.5" />
            Export Petty Cash Register (CSV)
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Cash Disbursed</span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
            ₹{stats.totalTopUp.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">Given to supervisors</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Spent on Site</span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-700 dark:text-rose-400 mt-1">
            ₹{stats.totalExpense.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">Tea, fuel, hardware & misc</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Cash-in-Hand Balance</span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-bold mt-1 ${stats.netCashInHand < 0 ? 'text-rose-600' : 'text-amber-600 dark:text-amber-400'}`}>
            ₹{stats.netCashInHand.toLocaleString('en-IN')}
          </p>
          <span className="text-[11px] text-slate-500 font-mono">
            {stats.netCashInHand < 0 ? '⚠️ Excess spent over top-ups' : 'Available with supervisors'}
          </span>
        </div>
      </div>

      {/* Supervisor Cash-in-Hand Breakdown Widgets */}
      {stats.supervisorBalances.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-indigo-500" />
              Supervisor Cash Balance Ledger
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">Individual cash-in-hand</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.supervisorBalances.map(sup => (
              <div 
                key={sup.name}
                onClick={() => setSupervisorFilter(supervisorFilter === sup.name ? 'all' : sup.name)}
                className={`p-3.5 rounded-xl border transition cursor-pointer ${
                  supervisorFilter === sup.name
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 ring-2 ring-amber-500/30'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700/60 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{sup.name}</span>
                  <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                    sup.balance < 0 
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    Balance: ₹{sup.balance.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-mono flex justify-between">
                  <span>Top-up Received: ₹{sup.topUp.toLocaleString('en-IN')}</span>
                  <span>Spent: ₹{sup.expense.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Register List & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {/* Filter Toolbar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search description or supervisor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Supervisor Filter */}
            <select
              value={supervisorFilter}
              onChange={(e) => setSupervisorFilter(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Supervisors</option>
              {supervisorList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Types</option>
              <option value="top_up">Top-ups Received</option>
              <option value="expense">Site Expenses</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Categories</option>
              <option value="tea_snacks">Tea & Snacks</option>
              <option value="fuel">Fuel / Diesel</option>
              <option value="small_hardware">Small Hardware</option>
              <option value="site_transport">Site Transport</option>
              <option value="emergency_labour">Emergency Labour</option>
              <option value="top_up">Cash Top-Up</option>
              <option value="other">Other / Misc</option>
            </select>
          </div>

          <div className="text-xs font-mono text-slate-500 font-semibold">
            Showing {filteredEntries.length} entries
          </div>
        </div>

        {/* Entries Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-mono border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                <th className="p-3 pl-4">Date</th>
                <th className="p-3">Type</th>
                <th className="p-3">Supervisor</th>
                <th className="p-3">Category</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Amount</th>
                <th className="p-3 text-center">Receipt</th>
                <th className="p-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-mono text-xs">
                    No petty cash records found matching filters.
                  </td>
                </tr>
              ) : (
                filteredEntries.map(entry => {
                  const isTopUp = entry.type === 'top_up';
                  const payerObj = entry.payerId ? payers.find(p => p.id === entry.payerId) : null;

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="p-3 pl-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {entry.date}
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 font-bold font-mono text-[10px] px-2 py-0.5 rounded-full ${
                          isTopUp 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {isTopUp ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {isTopUp ? 'CASH TOP-UP' : 'EXPENSE'}
                        </span>
                      </td>

                      <td className="p-3 font-semibold text-slate-900 dark:text-white">
                        {entry.supervisorName}
                      </td>

                      <td className="p-3 capitalize font-mono text-slate-600 dark:text-slate-400">
                        {entry.category?.replace('_', ' ') || 'misc'}
                      </td>

                      <td className="p-3 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {entry.description}
                        {payerObj && (
                          <span className="block text-[10px] text-slate-400 font-mono">
                            Provided by: {payerObj.name}
                          </span>
                        )}
                      </td>

                      <td className={`p-3 text-right font-bold font-mono text-sm ${
                        isTopUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {isTopUp ? '+' : '-'}₹{entry.amount.toLocaleString('en-IN')}
                      </td>

                      <td className="p-3 text-center">
                        {entry.receiptImage ? (
                          <button
                            type="button"
                            onClick={() => setLightboxImage({ src: entry.receiptImage!, title: entry.description })}
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1 rounded-md border border-indigo-200 dark:border-indigo-800 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" /> Photo
                          </button>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 text-[10px] font-mono">—</span>
                        )}
                      </td>

                      <td className="p-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(entry)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition cursor-pointer"
                            title="Edit Record"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(entry.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Entry Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingEntry ? 'Edit Petty Cash Record' : (type === 'top_up' ? 'Disburse Cash Top-up' : 'Record Site Petty Expense')}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Type Switcher */}
              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setType('expense');
                    setCategory('tea_snacks');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    type === 'expense'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  - Site Expense (Spent)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('top_up');
                    setCategory('top_up');
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${
                    type === 'top_up'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  + Cash Top-up (Given)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Supervisor / Manager Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Er. Ramesh Kumar"
                    value={supervisorName}
                    onChange={(e) => setSupervisorName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {type === 'top_up' ? (
                      <option value="top_up">Cash Top-Up Disbursed</option>
                    ) : (
                      <>
                        <option value="tea_snacks">Tea & Refreshments</option>
                        <option value="fuel">Fuel / Diesel</option>
                        <option value="small_hardware">Small Hardware Items</option>
                        <option value="site_transport">Site Auto / Transport</option>
                        <option value="emergency_labour">Emergency Labour Cash</option>
                        <option value="other">Other / Misc</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {type === 'top_up' && payers.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Disbursed By (Payer / Partner)
                  </label>
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">General Site Cash</option>
                    {payers.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Purpose
                </label>
                <input
                  type="text"
                  placeholder={type === 'top_up' ? 'e.g. Cash in hand given for week expenses' : 'e.g. Tea & samosa for 12 concrete workers'}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Receipt Photo Attachment */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Attach Receipt Photo (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-900 hover:file:bg-amber-200 cursor-pointer"
                />
                {receiptImage && (
                  <div className="mt-2 relative inline-block">
                    <img src={receiptImage} alt="Receipt preview" className="h-20 w-auto rounded-lg border shadow-xs" />
                    <button
                      type="button"
                      onClick={() => {
                        setReceiptImage(undefined);
                        setReceiptImageName(undefined);
                      }}
                      className="absolute -top-2 -right-2 bg-rose-600 text-white rounded-full p-0.5 shadow-sm hover:bg-rose-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
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
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2 rounded-xl text-xs shadow-xs cursor-pointer"
                >
                  {editingEntry ? 'Save Entry' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Photo Preview Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"
          onClick={() => setLightboxImage(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl p-4 max-w-2xl w-full shadow-2xl relative space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h4 className="font-bold text-xs text-slate-900 dark:text-white">{lightboxImage.title}</h4>
              <button
                onClick={() => setLightboxImage(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img src={lightboxImage.src} alt="Receipt full" className="max-h-[70vh] w-auto mx-auto rounded-xl shadow-md" />
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <ConfirmModal
          isOpen={Boolean(confirmDeleteId)}
          title="Delete Petty Cash Entry?"
          message="Are you sure you want to delete this petty cash transaction?"
          onConfirm={async () => {
            await onDeleteEntry(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
          onClose={() => setConfirmDeleteId(null)}
        />
      )}
    </div>
  );
}

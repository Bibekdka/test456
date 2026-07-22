import React, { useState, useRef } from 'react';
import { Project, Labour, Payer, DailyExpense } from '../types';
import { generateId } from '../utils/id';
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
  Eye
} from 'lucide-react';

interface DailyExpensesTrackerProps {
  activeProject: Project | null;
  labours: Labour[];
  payers: Payer[];
  dailyExpenses: DailyExpense[];
  onAddDailyExpense: (exp: DailyExpense) => void;
  onUpdateDailyExpense: (exp: DailyExpense) => void;
  onDeleteDailyExpense: (id: string) => void;
}

const SUB_CATEGORIES = {
  labour_expense: [
    { value: 'tea_snacks', label: 'Tea & Snacks' },
    { value: 'medical', label: 'Medical / First-Aid' },
    { value: 'travel', label: 'Travel / Conveyance' },
    { value: 'tools_safety', label: 'Tools & Safety Gear' },
    { value: 'emergency_cash', label: 'Emergency Pocket Cash' },
    { value: 'other', label: 'Other Labour Expense' }
  ],
  misc_transaction: [
    { value: 'fuel_power', label: 'Fuel, Oil & Power' },
    { value: 'stationery', label: 'Stationery & Office' },
    { value: 'site_cleaning', label: 'Site Cleaning & Waste Disposal' },
    { value: 'rental', label: 'Machine/Tool Rental' },
    { value: 'freight_transport', label: 'Freight & Local Carriage' },
    { value: 'printing', label: 'Printing & Xerox' },
    { value: 'refreshments', label: 'General Refreshments' },
    { value: 'other', label: 'Other General Misc' }
  ]
};

export default function DailyExpensesTracker({
  activeProject,
  labours,
  payers,
  dailyExpenses,
  onAddDailyExpense,
  onUpdateDailyExpense,
  onDeleteDailyExpense
}: DailyExpensesTrackerProps) {
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
  const [receiptImage, setReceiptImage] = useState<string | undefined>(undefined);
  const [receiptImageName, setReceiptImageName] = useState<string | undefined>(undefined);

  // Filter/Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSubCategory, setFilterSubCategory] = useState<string>('all');
  const [filterLabourId, setFilterLabourId] = useState<string>('all');
  const [filterPayerId, setFilterPayerId] = useState<string>('all');

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

    const expData: DailyExpense = {
      id: editingExpense?.id || generateId('exp'),
      projectId: activeProject.id,
      date,
      category,
      subCategory,
      amount: parsedAmount,
      description: description.trim(),
      labourId: category === 'labour_expense' && selectedLabourId ? selectedLabourId : undefined,
      payerId: selectedPayerId || undefined,
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

  // Filtering logic
  const filteredExpenses = projectExpenses.filter(e => {
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

  // Get localized sub-category label
  const getSubCatLabel = (cat: 'labour_expense' | 'misc_transaction', val: string) => {
    const found = SUB_CATEGORIES[cat]?.find(s => s.value === val);
    return found ? found.label : val;
  };

  return (
    <div className="space-y-6 flex-1">
      {/* Upper Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Coins className="w-6 h-6 text-emerald-600" />
            Labour Daily Expenses & Miscellaneous Transactions
          </h2>
          <p className="text-slate-500 text-xs">
            Log and manage minor site outlays, tea/snacks, worker transport, medical kit refills, and general miscellaneous expenses for <span className="font-semibold text-slate-800">{activeProject.name}</span>.
          </p>
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

              {/* Payer/Paying Officer */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Disbursed/Paid By (Payer) *</label>
                <select
                  required
                  value={selectedPayerId}
                  onChange={(e) => setSelectedPayerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold"
                >
                  <option value="">-- Choose Payer --</option>
                  {payers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.role ? `(${p.role})` : ''}
                    </option>
                  ))}
                </select>
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

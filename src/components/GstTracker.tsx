import React, { useState } from 'react';
import { Project, GstRecord } from '../types';
import { 
  Plus, 
  Trash2, 
  Percent, 
  IndianRupee, 
  AlertCircle, 
  Calendar, 
  Receipt, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Download, 
  FileText,
  Edit,
  X
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface GstTrackerProps {
  activeProject: Project | null;
  gstRecords: GstRecord[];
  onAddGstRecord: (record: GstRecord) => Promise<void>;
  onUpdateGstRecord: (record: GstRecord) => Promise<void>;
  onDeleteGstRecord: (id: string) => Promise<void>;
}

export default function GstTracker({
  activeProject,
  gstRecords,
  onAddGstRecord,
  onUpdateGstRecord,
  onDeleteGstRecord,
}: GstTrackerProps) {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'paid' | 'claimed'>('all');
  const [filterRate, setFilterRate] = useState<string>('all');

  // Editing State
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

  // Deletion confirm state
  const [recordToDelete, setRecordToDelete] = useState<GstRecord | null>(null);

  // Form validation inline error state
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [invoiceNo, setInvoiceNo] = useState('');
  const [partyName, setPartyName] = useState('');
  const [gstin, setGstin] = useState('');
  const [amount, setAmount] = useState('');
  const [gstRate, setGstRate] = useState(18); // Default 18% standard GST rate in India
  const [gstType, setGstType] = useState<'paid' | 'claimed'>('paid');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  if (!activeProject) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-500">Please select or create a project to manage GST ledger.</p>
      </div>
    );
  }

  // Filter for active project
  const projectGstRecords = gstRecords.filter(r => r.projectId === activeProject.id);

  // Apply filters
  const filteredRecords = projectGstRecords.filter(rec => {
    const matchesSearch = 
      rec.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rec.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rec.gstin && rec.gstin.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (rec.notes && rec.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesType = filterType === 'all' || rec.type === filterType;
    const matchesRate = filterRate === 'all' || rec.gstRate === Number(filterRate);

    return matchesSearch && matchesType && matchesRate;
  });

  // Calculations
  const totalPaidTaxable = projectGstRecords
    .filter(r => r.type === 'paid')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalPaidGst = projectGstRecords
    .filter(r => r.type === 'paid')
    .reduce((sum, r) => sum + r.gstAmount, 0);

  const totalClaimedTaxable = projectGstRecords
    .filter(r => r.type === 'claimed')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalClaimedGst = projectGstRecords
    .filter(r => r.type === 'claimed')
    .reduce((sum, r) => sum + r.gstAmount, 0);

  // Net GST Payable to Govt = Output tax (claimed/collected on sales) - Input tax (paid on inputs/purchases)
  const netGstPayable = totalClaimedGst - totalPaidGst;

  const startEdit = (rec: GstRecord) => {
    setEditingRecordId(rec.id);
    setInvoiceNo(rec.invoiceNo);
    setPartyName(rec.partyName);
    setGstin(rec.gstin || '');
    setAmount(rec.amount.toString());
    setGstRate(rec.gstRate);
    setGstType(rec.type);
    setDate(rec.date);
    setNotes(rec.notes || '');
    setFormError(null);

    // Scroll smoothly to the invoice form container
    setTimeout(() => {
      const element = document.getElementById('gst-invoice-form');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  };

  const cancelEdit = () => {
    setEditingRecordId(null);
    setInvoiceNo('');
    setPartyName('');
    setGstin('');
    setAmount('');
    setGstRate(18);
    setGstType('paid');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNo.trim() || !partyName.trim() || !amount) {
      setFormError('Invoice Number, Party Name, and Taxable Value are required.');
      return;
    }

    const taxableVal = parseFloat(amount);
    if (isNaN(taxableVal) || taxableVal <= 0) {
      setFormError('Please enter a valid taxable amount (greater than ₹0).');
      return;
    }

    setFormError(null);

    // Standard Indian GST amount calculation
    const calculatedGst = parseFloat((taxableVal * (gstRate / 100)).toFixed(2));

    if (editingRecordId) {
      const updatedRecord: GstRecord = {
        id: editingRecordId,
        projectId: activeProject.id,
        date,
        invoiceNo,
        partyName,
        gstin: gstin.toUpperCase().trim() || undefined,
        amount: taxableVal,
        gstRate,
        gstAmount: calculatedGst,
        type: gstType,
        notes: notes.trim() || undefined,
      };
      await onUpdateGstRecord(updatedRecord);
      cancelEdit();
    } else {
      const newRecord: GstRecord = {
        id: `gst-${Date.now()}`,
        projectId: activeProject.id,
        date,
        invoiceNo,
        partyName,
        gstin: gstin.toUpperCase().trim() || undefined,
        amount: taxableVal,
        gstRate,
        gstAmount: calculatedGst,
        type: gstType,
        notes: notes.trim() || undefined,
      };

      await onAddGstRecord(newRecord);
      
      // Reset Form
      setInvoiceNo('');
      setPartyName('');
      setGstin('');
      setAmount('');
      setNotes('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Percent className="w-5 h-5 text-indigo-600" />
            GST Invoices & Credit Ledger
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Log raw material purchase invoices (Input Credit/Paid) and client progress billings (Output/Claimed)
          </p>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* GST Paid (Input Tax Credit) Card */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-rose-50 text-rose-600">
            <ArrowDownLeft className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">GST Paid (Input Tax Credit)</p>
            <h4 className="text-xl font-bold tracking-tight font-mono text-slate-800 mt-0.5">
              ₹{totalPaidGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-[9px] text-slate-400 mt-1">
              On Taxable Value of ₹{totalPaidTaxable.toLocaleString()}
            </p>
          </div>
        </div>

        {/* GST Collected (Output Tax) Card */}
        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <ArrowUpRight className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">GST Collected (Output Tax)</p>
            <h4 className="text-xl font-bold tracking-tight font-mono text-slate-800 mt-0.5">
              ₹{totalClaimedGst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-[9px] text-slate-400 mt-1">
              On Taxable Value of ₹{totalClaimedTaxable.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Net GST Position Card */}
        <div className={`border rounded-xl p-4 flex items-center gap-4 ${
          netGstPayable > 0 
            ? 'bg-amber-50/50 border-amber-200' 
            : netGstPayable < 0 
            ? 'bg-indigo-50/50 border-indigo-200' 
            : 'bg-slate-50 border-slate-200'
        }`}>
          <div className={`p-3 rounded-lg ${
            netGstPayable > 0 
              ? 'bg-amber-100 text-amber-700' 
              : netGstPayable < 0 
              ? 'bg-indigo-100 text-indigo-700' 
              : 'bg-slate-100 text-slate-700'
          }`}>
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Net GST Position</p>
            <h4 className={`text-xl font-bold tracking-tight font-mono mt-0.5 ${
              netGstPayable > 0 ? 'text-amber-800' : netGstPayable < 0 ? 'text-indigo-800' : 'text-slate-800'
            }`}>
              {netGstPayable > 0 ? 'Payable: ' : netGstPayable < 0 ? 'Credit/Refund: ' : 'Balanced'}
              ₹{Math.abs(netGstPayable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-[9px] text-slate-400 mt-1">
              {netGstPayable > 0 
                ? 'Output liability exceeds input credit' 
                : netGstPayable < 0 
                ? 'Available Input Tax Credit (ITC) carry-forward' 
                : 'All transactions balanced'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Form to Log New GST Invoice */}
        <div 
          id="gst-invoice-form"
          className={`border rounded-xl p-5 shadow-xs space-y-4 transition-all duration-300 ${
            editingRecordId 
              ? 'bg-indigo-50/20 border-indigo-400 ring-4 ring-indigo-500/10' 
              : 'bg-white border-slate-200'
          }`}
        >
          {editingRecordId && (
            <div className="bg-indigo-600 text-white rounded-lg px-3 py-2 text-[10px] font-bold tracking-wide uppercase flex items-center justify-between animate-pulse">
              <span>ACTIVE EDITING MODE</span>
              <button 
                type="button" 
                onClick={cancelEdit}
                className="text-indigo-200 hover:text-white font-semibold cursor-pointer"
              >
                Clear/Reset
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Receipt className="w-4 h-4 text-slate-500" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              {editingRecordId ? 'Edit GST Invoice' : 'Log GST Invoice'}
            </h4>
          </div>

          {formError && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 rounded-lg p-2.5 flex items-start gap-1.5 text-[11px] animate-in fade-in slide-in-from-top-1 duration-150">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Invoice Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGstType('paid')}
                    className={`py-1.5 px-2 rounded-lg font-semibold border text-center transition ${
                      gstType === 'paid'
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Paid / ITC
                  </button>
                  <button
                    type="button"
                    onClick={() => setGstType('claimed')}
                    className={`py-1.5 px-2 rounded-lg font-semibold border text-center transition ${
                      gstType === 'claimed'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    Collected
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Invoice Date</label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Invoice Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INV-2026/89"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Party Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tata Steel / Owner"
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Party GSTIN (Optional)</label>
                <span className="text-[9px] text-slate-400 font-mono">15 chars e.g. 18AABCC1234D1Z5</span>
              </div>
              <input
                type="text"
                maxLength={15}
                placeholder="e.g. 18AAAAA0000A1Z0"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 uppercase font-mono tracking-wider focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Taxable Amount (Rs.)</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 text-slate-400 font-mono">₹</span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-6 pr-2.5 py-2 font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">GST Slab Rate</label>
                <select
                  value={gstRate}
                  onChange={(e) => setGstRate(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value={5}>5% (Basic)</option>
                  <option value={12}>12% (Contract/Services)</option>
                  <option value={18}>18% (Standard Goods)</option>
                  <option value={28}>28% (Luxury/Cement/Steel)</option>
                  <option value={0}>0% (Exempt)</option>
                </select>
              </div>
            </div>

            {amount && !isNaN(parseFloat(amount)) && (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-2.5 space-y-1 font-mono text-[10px] text-slate-600">
                <div className="flex justify-between">
                  <span>Taxable Base Value:</span>
                  <span>₹{parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Calculated GST ({gstRate}%):</span>
                  <span>₹{(parseFloat(amount) * (gstRate / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between border-t border-indigo-100 pt-1 font-bold text-indigo-900 text-xs mt-1">
                  <span>Gross Total Invoice:</span>
                  <span>₹{(parseFloat(amount) * (1 + gstRate / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Item Description / Notes</label>
              <textarea
                placeholder="e.g. Bought sand bags, or progress bill block A"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="flex gap-2">
              {editingRecordId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="w-1/3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Cancel</span>
                </button>
              )}
              <button
                type="submit"
                className={`py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  editingRecordId 
                    ? 'w-2/3 bg-indigo-600 hover:bg-indigo-700 text-white' 
                    : 'w-full bg-slate-900 hover:bg-slate-800 text-white'
                }`}
              >
                {editingRecordId ? <Edit className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{editingRecordId ? 'Update Entry' : 'Record GST Entry'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* GST Records Ledger list */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          {/* Header with Search and Filter bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600" />
              Tax Transaction History ({filteredRecords.length})
            </h4>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search input */}
              <div className="relative text-xs">
                <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice, party..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2.5 py-1.5 text-xs w-[160px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e: any) => setFilterType(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-700"
              >
                <option value="all">All Types</option>
                <option value="paid">Paid / ITC</option>
                <option value="claimed">Collected</option>
              </select>

              {/* Rate Filter */}
              <select
                value={filterRate}
                onChange={(e) => setFilterRate(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900 text-slate-700"
              >
                <option value="all">All Rates</option>
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="text-center py-16 text-slate-400 font-mono text-xs">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No matching GST transactions found in this project.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-500 uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Invoice / Party</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Taxable (Base)</th>
                    <th className="py-2.5 px-3 text-center">Rate</th>
                    <th className="py-2.5 px-3 text-right">GST Amount</th>
                    <th className="py-2.5 px-3 text-right">Gross Total</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map((rec) => {
                    const grossTotal = rec.amount + rec.gstAmount;
                    return (
                      <tr key={rec.id} className="hover:bg-slate-50/40 transition">
                        {/* Date */}
                        <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap">
                          {rec.date}
                        </td>

                        {/* Invoice & Party */}
                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-800">{rec.partyName}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>No: {rec.invoiceNo}</span>
                            {rec.gstin && (
                              <span className="bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-semibold text-[8px] tracking-wider">
                                GSTIN: {rec.gstin}
                              </span>
                            )}
                          </div>
                          {rec.notes && (
                            <div className="text-[9px] text-slate-400 italic mt-1 font-sans">
                              {rec.notes}
                            </div>
                          )}
                        </td>

                        {/* Type Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono tracking-wider ${
                            rec.type === 'paid' 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                          }`}>
                            {rec.type === 'paid' ? 'PAID/ITC' : 'COLLECTED'}
                          </span>
                        </td>

                        {/* Taxable Amount */}
                        <td className="py-3 px-3 text-right font-mono text-slate-600 font-medium">
                          ₹{rec.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* GST rate */}
                        <td className="py-3 px-3 text-center font-mono text-slate-500 font-semibold">
                          {rec.gstRate}%
                        </td>

                        {/* GST Amount */}
                        <td className={`py-3 px-3 text-right font-mono font-semibold ${
                          rec.type === 'paid' ? 'text-rose-600' : 'text-emerald-600'
                        }`}>
                          ₹{rec.gstAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Gross total */}
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">
                          ₹{grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEdit(rec)}
                              className="text-slate-400 hover:text-indigo-600 p-1 rounded-md hover:bg-indigo-50 transition cursor-pointer"
                              title="Edit invoice entry"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setRecordToDelete(rec)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition cursor-pointer"
                              title="Delete invoice entry"
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
      </div>

      {/* Elegant, fully iframe-compatible custom ConfirmModal */}
      <ConfirmModal
        isOpen={recordToDelete !== null}
        onClose={() => setRecordToDelete(null)}
        onConfirm={() => {
          if (recordToDelete) {
            onDeleteGstRecord(recordToDelete.id);
            setRecordToDelete(null);
          }
        }}
        title="Confirm Invoice Deletion"
        message={`Are you sure you want to delete invoice "${recordToDelete?.invoiceNo || ''}"?\nThis action will permanently delete the record and automatically adjust your cumulative input credits and tax liability positions.`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

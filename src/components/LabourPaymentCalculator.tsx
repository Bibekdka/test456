/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project, Labour, Attendance, Advance, Payment } from '../types';
import { 
  IndianRupee, 
  Calendar, 
  Landmark, 
  Receipt, 
  ClipboardList, 
  Plus, 
  History, 
  Trash2, 
  Search, 
  SlidersHorizontal, 
  ArrowUpDown, 
  FileText 
} from 'lucide-react';

interface LabourPaymentCalculatorProps {
  activeProject: Project | null;
  labours: Labour[];
  attendanceRecords: Attendance[];
  advanceRecords: Advance[];
  paymentRecords: Payment[];
  onRecordPayment: (payment: Payment) => void;
  onDeletePayment: (id: string) => void;
  onDeleteAdvance?: (id: string) => void;
}

export default function LabourPaymentCalculator({
  activeProject,
  labours,
  attendanceRecords,
  advanceRecords,
  paymentRecords,
  onRecordPayment,
  onDeletePayment,
  onDeleteAdvance,
}: LabourPaymentCalculatorProps) {
  const [activeSubTab, setActiveSubTab] = useState<'calculator' | 'ledger'>('calculator');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ledgerType, setLedgerType] = useState<'all' | 'payouts' | 'advances'>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNotes, setPayNotes] = useState('');

  const [expandedLabourId, setExpandedLabourId] = useState<string | null>(null);

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-slate-500">
          <Landmark className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-700">No Construction Site Selected</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Please select or create an active project site in the <strong>Projects</strong> tab to run wage and payment calculations.
        </p>
      </div>
    );
  }

  // Calculate stats for a given labourer
  const getLabourStats = (l: Labour) => {
    // 1. Calculate days worked
    const projectAtt = attendanceRecords.filter(
      r => r.labourId === l.id && r.projectId === activeProject.id
    );

    let daysWorked = 0;
    projectAtt.forEach(att => {
      if (att.status === 'present') daysWorked += 1;
      else if (att.status === 'half_day') daysWorked += 0.5;
    });

    // 2. Base wages earned
    const baseWages = daysWorked * l.perDayWage;

    // 3. Advances taken
    const projectAdvs = advanceRecords.filter(
      a => a.labourId === l.id && a.projectId === activeProject.id
    );
    const totalAdvances = projectAdvs.reduce((sum, adv) => sum + adv.amount, 0);

    // 4. Payments already made
    const projectPays = paymentRecords.filter(
      p => p.labourId === l.id && p.projectId === activeProject.id
    );
    const totalPaid = projectPays.reduce((sum, pay) => sum + pay.amountPaid, 0);

    // 5. Net remaining
    const netWagesRemaining = baseWages - totalAdvances - totalPaid;

    return {
      daysWorked,
      baseWages,
      totalAdvances,
      totalPaid,
      netWagesRemaining,
      attendance: projectAtt,
      advances: projectAdvs,
      payments: projectPays,
    };
  };

  const handleSubmitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLabourId || !payAmount) return;

    const amount = Number(payAmount);
    if (isNaN(amount) || amount <= 0) return;

    const labour = labours.find(l => l.id === selectedLabourId);
    if (!labour) return;

    const stats = getLabourStats(labour);

    const paymentData: Payment = {
      id: 'pay_' + Math.random().toString(36).substr(2, 9),
      labourId: selectedLabourId,
      projectId: activeProject.id,
      date: payDate,
      amountPaid: amount,
      advanceDeducted: stats.totalAdvances, // Tracking for record
      baseWages: stats.baseWages,
      daysWorked: stats.daysWorked,
      notes: payNotes || 'Regular wage payout',
    };

    onRecordPayment(paymentData);
    setPayAmount('');
    setPayNotes('');
    alert(`Payment of ₹${amount} successfully recorded for ${labour.name}`);
  };

  // We want to calculate payments for ALL labours who have any recorded attendance, advance or payment in this project, plus active labours
  const relevantLabours = labours.filter(l => {
    const stats = getLabourStats(l);
    const hasHistory = stats.daysWorked > 0 || stats.totalAdvances > 0 || stats.totalPaid > 0;
    return l.status === 'active' || hasHistory;
  });

  // Combine all payment transactions (both wage payouts and cash advances) into a unified ledger
  const projectPayments = paymentRecords.filter(p => p.projectId === activeProject.id);
  const projectAdvances = advanceRecords.filter(a => a.projectId === activeProject.id);

  interface LedgerItem {
    id: string;
    type: 'payout' | 'advance';
    date: string;
    labourId: string;
    labourName: string;
    amount: number;
    notes: string;
    payer?: string;
    daysWorked?: number;
    baseWages?: number;
    advanceDeducted?: number;
  }

  const ledgerItems: LedgerItem[] = [
    ...projectPayments.map(p => {
      const labour = labours.find(l => l.id === p.labourId);
      return {
        id: p.id,
        type: 'payout' as const,
        date: p.date,
        labourId: p.labourId,
        labourName: labour ? labour.name : 'Unknown Worker',
        amount: p.amountPaid,
        notes: p.notes || 'Regular wage payout',
        daysWorked: p.daysWorked,
        baseWages: p.baseWages,
        advanceDeducted: p.advanceDeducted,
      };
    }),
    ...projectAdvances.map(a => {
      const labour = labours.find(l => l.id === a.labourId);
      return {
        id: a.id,
        type: 'advance' as const,
        date: a.date,
        labourId: a.labourId,
        labourName: labour ? labour.name : 'Unknown Worker',
        amount: a.amount,
        notes: a.description || 'Cash Advance',
        payer: a.paidBy,
      };
    })
  ];

  // Apply filters
  const filteredLedgerItems = ledgerItems.filter(item => {
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      const matchesName = item.labourName.toLowerCase().includes(term);
      const matchesNotes = item.notes.toLowerCase().includes(term);
      if (!matchesName && !matchesNotes) return false;
    }
    if (startDate && item.date < startDate) return false;
    if (endDate && item.date > endDate) return false;
    if (ledgerType === 'payouts' && item.type !== 'payout') return false;
    if (ledgerType === 'advances' && item.type !== 'advance') return false;
    return true;
  });

  // Sort items
  const sortedLedgerItems = [...filteredLedgerItems].sort((a, b) => {
    if (sortBy === 'date-desc') return b.date.localeCompare(a.date);
    if (sortBy === 'date-asc') return a.date.localeCompare(b.date);
    if (sortBy === 'amount-desc') return b.amount - a.amount;
    if (sortBy === 'amount-asc') return a.amount - b.amount;
    return 0;
  });

  // Calculate stats
  const totalWagesPayouts = projectPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const totalCashAdvances = projectAdvances.reduce((sum, a) => sum + a.amount, 0);
  const totalOutflow = totalWagesPayouts + totalCashAdvances;

  const filteredTotal = filteredLedgerItems.reduce((sum, item) => sum + item.amount, 0);

  const handleDeleteItem = (item: LedgerItem) => {
    if (item.type === 'payout') {
      if (confirm(`Are you sure you want to delete this wage payout of ₹${item.amount} recorded on ${item.date}?`)) {
        onDeletePayment(item.id);
      }
    } else {
      if (onDeleteAdvance) {
        if (confirm(`Are you sure you want to delete this cash advance of ₹${item.amount} taken on ${item.date}?`)) {
          onDeleteAdvance(item.id);
        }
      } else {
        alert('Cannot delete advances from here. Please go to the Attendance & Advances tab to manage and delete advances.');
      }
    }
  };

  return (
    <div id="payment-calculator-section" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">
            Wages Ledger & Payouts
          </h2>
          <p className="text-slate-500 text-sm">
            Site: <strong className="text-slate-700">{activeProject.name}</strong> • Automatic per-day wage consolidation, advance deductions, and payment date stamps.
          </p>
        </div>

        {/* Sub-tabs Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSubTab('calculator')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeSubTab === 'calculator'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Wages Calculator
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('ledger')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              activeSubTab === 'ledger'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Unified Payments Ledger
          </button>
        </div>
      </div>

      {activeSubTab === 'calculator' ? (
        <>
          {/* Wage summary list */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Labor Wages Sheet Summary</h3>
              <span className="text-slate-500 text-xs font-mono">Deductions are calculated automatically</span>
            </div>

            {relevantLabours.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No labour calculations available. Start by recording attendance or advances.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-3 px-4">Labour Name</th>
                      <th className="py-3 px-4">Days Worked</th>
                      <th className="py-3 px-4">Gross Wages</th>
                      <th className="py-3 px-4 text-rose-600">Advances Deducted</th>
                      <th className="py-3 px-4 text-emerald-600">Paid Already</th>
                      <th className="py-3 px-4 font-bold text-slate-800">Remaining Balance</th>
                      <th className="py-3 px-4 text-center">Detailed History</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {relevantLabours.map((l) => {
                      const stats = getLabourStats(l);
                      const isExpanded = expandedLabourId === l.id;

                      return (
                        <React.Fragment key={l.id}>
                          <tr className={`hover:bg-slate-50/50 transition ${l.status === 'left' ? 'opacity-80 bg-slate-50/20' : ''}`}>
                            <td className="py-3 px-4">
                              <span className="font-medium text-slate-800">{l.name}</span>
                              {l.status === 'left' && (
                                <span className="ml-2 text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                                  Archived
                                </span>
                              )}
                              <p className="text-[10px] text-slate-400 font-mono">₹{l.perDayWage} / day</p>
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-slate-600">{stats.daysWorked} days</td>
                            <td className="py-3 px-4 font-mono text-slate-700">₹{stats.baseWages.toFixed(2)}</td>
                            <td className="py-3 px-4 font-mono text-rose-600">-₹{stats.totalAdvances.toFixed(2)}</td>
                            <td className="py-3 px-4 font-mono text-emerald-600">₹{stats.totalPaid.toFixed(2)}</td>
                            <td className="py-3 px-4">
                              <span className={`font-mono font-bold text-sm ${
                                stats.netWagesRemaining > 0 ? 'text-slate-800' : stats.netWagesRemaining === 0 ? 'text-slate-400' : 'text-emerald-600'
                              }`}>
                                ₹{stats.netWagesRemaining.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setExpandedLabourId(isExpanded ? null : l.id)}
                                className="text-slate-500 hover:text-slate-900 text-xs font-semibold underline cursor-pointer"
                              >
                                {isExpanded ? 'Hide Details' : 'View Audit Trail'}
                              </button>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="bg-slate-50/70 p-4 border-t border-b border-slate-100">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                                  {/* Attendance history */}
                                  <div className="space-y-2">
                                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                                      <ClipboardList className="w-3.5 h-3.5 text-slate-400" /> Attendance Ledger
                                    </h4>
                                    {stats.attendance.length === 0 ? (
                                      <p className="text-slate-400 italic text-[11px]">No attendance logged.</p>
                                    ) : (
                                      <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                                        {stats.attendance.map(a => (
                                          <div key={a.id} className="flex justify-between py-1 border-b border-slate-100 last:border-0 font-mono text-[11px]">
                                            <span className="text-slate-500">{a.date}</span>
                                            <span className={`font-semibold ${
                                              a.status === 'present' ? 'text-emerald-600' : a.status === 'half_day' ? 'text-amber-500' : 'text-rose-500'
                                            }`}>
                                              {a.status === 'present' ? 'Full Day' : a.status === 'half_day' ? 'Half Day' : 'Absent'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Advances history */}
                                  <div className="space-y-2">
                                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                                      <Receipt className="w-3.5 h-3.5 text-slate-400" /> Advances Ledger
                                    </h4>
                                    {stats.advances.length === 0 ? (
                                      <p className="text-slate-400 italic text-[11px]">No advances logged.</p>
                                    ) : (
                                      <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                                        {stats.advances.map(adv => (
                                          <div key={adv.id} className="flex justify-between py-1 border-b border-slate-100 last:border-0 font-mono text-[11px]">
                                            <div className="flex flex-col text-left">
                                              <span className="text-slate-500">{adv.date}</span>
                                              <span className="text-[10px] font-sans text-slate-400">{adv.description}</span>
                                            </div>
                                            <span className="font-semibold text-rose-500">-₹{adv.amount}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Payouts history */}
                                  <div className="space-y-2">
                                    <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                                      <History className="w-3.5 h-3.5 text-slate-400" /> Payouts Ledger (Paid Date Stamp)
                                    </h4>
                                    {stats.payments.length === 0 ? (
                                      <p className="text-slate-400 italic text-[11px]">No payouts logged yet.</p>
                                    ) : (
                                      <div className="max-h-40 overflow-y-auto space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                                        {stats.payments.map(pay => (
                                          <div key={pay.id} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0 font-mono text-[11px]">
                                            <div className="flex flex-col text-left">
                                              <span className="text-slate-500">{pay.date}</span>
                                              <span className="text-[10px] font-sans text-slate-400 truncate max-w-[120px]">{pay.notes}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-bold text-emerald-600">₹{pay.amountPaid}</span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (confirm('Delete this payout record?')) onDeletePayment(pay.id);
                                                }}
                                                className="text-slate-300 hover:text-rose-600 transition"
                                                title="Delete payout"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Record payout form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-slate-200 rounded-xl bg-white p-5 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-base">Record New Wage Payment Payout</h3>
              <p className="text-slate-400 text-xs">Instantly log payouts to workers. Enter the cash paid out, select a date stamp, and we'll calculate outstanding dues dynamically.</p>

              <form onSubmit={handleSubmitPayment} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Select Worker</label>
                  <select
                    value={selectedLabourId}
                    onChange={(e) => setSelectedLabourId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                    required
                  >
                    <option value="">Choose Worker...</option>
                    {relevantLabours.map(l => {
                      const stats = getLabourStats(l);
                      return (
                        <option key={l.id} value={l.id}>
                          {l.name} (Balance: ₹{stats.netWagesRemaining.toFixed(0)})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount Paid (Rs.)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">₹</span>
                    <input
                      type="number"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment Date (Date Stamp)</label>
                  <input
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Notes / Memo</label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="e.g. Paid cash on site, receipt #42"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-700"
                  />
                </div>

                <div className="sm:col-span-2 pt-2 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Record & Date-Stamp Payout
                  </button>
                </div>
              </form>
            </div>

            {/* Quick helper info */}
            <div className="border border-slate-200 rounded-xl bg-slate-50/70 p-5 space-y-4">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider">Wage Bookkeeping Formula</h4>
              <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
                <div className="flex justify-between border-b border-slate-100 pb-1.5 font-mono">
                  <span>Gross Wages Earned:</span>
                  <span className="font-semibold text-slate-700">Days Worked × Per-Day Wage</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5 font-mono text-rose-600">
                  <span>Less: Advances:</span>
                  <span>- Sum of Cash Advances</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-1.5 font-mono text-emerald-600">
                  <span>Less: Past Paid:</span>
                  <span>- Sum of Previous Payouts</span>
                </div>
                <div className="flex justify-between font-mono font-bold text-slate-800">
                  <span>Net Due Balance:</span>
                  <span>Wages - Advances - Paid</span>
                </div>
                <p className="text-slate-400 text-[11px] pt-1">
                  Advances and daily attendance are recorded directly in the <strong>Attendance & Advances</strong> tab and updated here in real time.
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Unified Payments Ledger Section */
        <div className="space-y-6">
          {/* Key Metrics row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-sm space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Unified Paid Out
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tracking-tight font-mono">₹{totalOutflow.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[11px] text-slate-400">Total wage payouts + cash advances</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                🟢 Wage Payouts
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tracking-tight font-mono text-slate-800">₹{totalWagesPayouts.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[11px] text-slate-500">{projectPayments.length} logged payout transactions</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                🔴 Cash Advances Taken
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold tracking-tight font-mono text-slate-800">₹{totalCashAdvances.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[11px] text-slate-500">{projectAdvances.length} micro-advances recorded</p>
            </div>
          </div>

          {/* Search and Filters bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
            {/* Filter types */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex bg-slate-100 p-1 rounded-xl self-start border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setLedgerType('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    ledgerType === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Payments ({ledgerItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerType('payouts')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 ${
                    ledgerType === 'payouts'
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🟢 Wages ({projectPayments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLedgerType('advances')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 ${
                    ledgerType === 'advances'
                      ? 'bg-rose-600 text-white shadow-sm font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🔴 Advances ({projectAdvances.length})
                </button>
              </div>

              {/* Print action */}
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                Print Cash Book
              </button>
            </div>

            {/* Inputs: Search, Dates, Sorting */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search worker name, notes..."
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-700"
                />
              </div>

              <div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="Start Date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-600"
                  title="Start Date"
                />
              </div>

              <div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="End Date"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-600"
                  title="End Date"
                />
              </div>

              <div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-slate-700"
                >
                  <option value="date-desc">Sort: Date (Newest first)</option>
                  <option value="date-asc">Sort: Date (Oldest first)</option>
                  <option value="amount-desc">Sort: Amount (Highest first)</option>
                  <option value="amount-asc">Sort: Amount (Lowest first)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Unified Payment Cash Book</h3>
              <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                <span>Showing {sortedLedgerItems.length} records</span>
                {searchTerm || startDate || endDate || ledgerType !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setStartDate('');
                      setEndDate('');
                      setLedgerType('all');
                    }}
                    className="text-slate-800 underline font-semibold cursor-pointer hover:text-slate-900"
                  >
                    Clear Filters
                  </button>
                ) : null}
              </div>
            </div>

            {sortedLedgerItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-sm space-y-2">
                <div>🔍</div>
                <p className="font-medium text-slate-500">No payment records found matching filters.</p>
                <p className="text-xs text-slate-400">Try modifying your dates or typing worker names again.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Worker Name</th>
                      <th className="py-3 px-4 text-center">Payment Type</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Payer / Paid By</th>
                      <th className="py-3 px-4">Description / Audit Notes</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {sortedLedgerItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-3.5 px-4 font-mono text-xs text-slate-500">
                          {item.date}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {item.labourName}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {item.type === 'payout' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              🟢 Wage Payout
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              🔴 Cash Advance
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`font-mono font-bold text-sm ${
                            item.type === 'payout' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            ₹{item.amount.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {item.type === 'payout' ? (
                            <span className="text-xs text-slate-400">Site Supervisor (Main)</span>
                          ) : (
                            <span className="text-xs font-semibold">{item.payer || 'Not logged'}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-[240px] truncate text-xs text-slate-500" title={item.notes}>
                          {item.notes}
                          {item.type === 'payout' && item.daysWorked !== undefined && (
                            <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                              Settled {item.daysWorked} days • base wages: ₹{item.baseWages?.toFixed(0)} • deducted: ₹{item.advanceDeducted?.toFixed(0)}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="text-slate-300 hover:text-rose-600 transition p-1 cursor-pointer"
                            title="Delete this entry from books"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Total summary footer */}
                  <tfoot>
                    <tr className="bg-slate-50 font-bold border-t border-slate-200">
                      <td colSpan={3} className="py-3 px-4 text-slate-500 uppercase text-[10px] tracking-wider text-right">
                        Filtered Total Outflow:
                      </td>
                      <td className="py-3 px-4 font-mono text-sm text-slate-800">
                        ₹{filteredTotal.toFixed(2)}
                      </td>
                      <td colSpan={3} className="py-3 px-4 text-xs font-normal text-slate-400 italic">
                        Calculated from currently filtered list
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project, Labour, Attendance, Advance, Payment, FoodLog, Payer, getAttendanceFoodDaysAndCost, getLabourDaysWorked } from '../types';
import { generateId } from '../utils/id';
import { 
  Users, UserPlus, Phone, IndianRupee, Calendar, Trash2, Edit, 
  UserX, UserCheck, Archive, History, Plus, Search, Utensils, 
  FileSpreadsheet, ArrowUpDown, TrendingUp, Coins, CheckCircle2, 
  Receipt, ClipboardList, Info, Trash
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface LabourManagerProps {
  labours: Labour[];
  onAddLabour: (labour: Labour) => void;
  onUpdateLabour: (labour: Labour) => void;
  onDeleteLabour: (id: string) => void;
  activeProject?: Project | null;
  attendanceRecords?: Attendance[];
  advanceRecords?: Advance[];
  paymentRecords?: Payment[];
  foodLogs?: FoodLog[];
  payers?: Payer[];
  onAddAdvance?: (adv: Advance) => void;
  onRecordPayment?: (pay: Payment) => void;
  onDeleteAdvance?: (id: string) => void;
  onDeletePayment?: (id: string) => void;
  foodCalculationStartDate?: string;
}

export default function LabourManager({
  labours,
  onAddLabour,
  onUpdateLabour,
  onDeleteLabour,
  activeProject = null,
  attendanceRecords = [],
  advanceRecords = [],
  paymentRecords = [],
  foodLogs = [],
  payers = [],
  onAddAdvance,
  onRecordPayment,
  onDeleteAdvance,
  onDeletePayment,
  foodCalculationStartDate = '',
}: LabourManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLabour, setEditingLabour] = useState<Labour | null>(null);
  const [labourToDelete, setLabourToDelete] = useState<Labour | null>(null);
  const [deletingLedgerId, setDeletingLedgerId] = useState<string | null>(null);

  // Form State for Adding/Editing Labourer / Contractor / Staff
  const [name, setName] = useState('');
  const [perDayWage, setPerDayWage] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<'active' | 'left'>('active');
  const [leftDate, setLeftDate] = useState('');
  const [joinedDate, setJoinedDate] = useState('');
  const [role, setRole] = useState<'worker' | 'contractor' | 'staff' | 'other'>('worker');
  const [isSalaryApplicable, setIsSalaryApplicable] = useState(true);

  // Form State for Recording Advances/Payments
  const [selectedLabourId, setSelectedLabourId] = useState('');
  const [trxType, setTrxType] = useState<'advance' | 'payout'>('advance');
  const [trxAmount, setTrxAmount] = useState('');
  const [trxDate, setTrxDate] = useState(new Date().toISOString().split('T')[0]);
  const [trxNotes, setTrxNotes] = useState('');
  const [trxPayerId, setTrxPayerId] = useState('');

  // Filters and sorting
  const [activeTab, setActiveTab] = useState<'active' | 'left' | 'payments_advances' | 'food_stats'>('active');
  const [ledgerSearchTerm, setLedgerSearchTerm] = useState('');
  const [statsSearchTerm, setStatsSearchTerm] = useState('');

  const openAddForm = () => {
    setName('');
    setPerDayWage('500');
    setContact('');
    setStatus('active');
    setRole('worker');
    setIsSalaryApplicable(true);
    setLeftDate('');
    setJoinedDate(new Date().toISOString().split('T')[0]);
    setEditingLabour(null);
    setShowAddForm(true);
    document.getElementById('labour-manager-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const openEditForm = (l: Labour) => {
    setEditingLabour(l);
    setName(l.name);
    setPerDayWage(l.perDayWage ? l.perDayWage.toString() : '0');
    setContact(l.contact);
    setStatus(l.status);
    setRole(l.role || 'worker');
    setIsSalaryApplicable(l.isSalaryApplicable !== undefined ? l.isSalaryApplicable : (l.perDayWage > 0));
    setLeftDate(l.leftDate || '');
    setJoinedDate(l.joinedDate || new Date().toISOString().split('T')[0]);
    setShowAddForm(true);
    document.getElementById('labour-manager-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const wage = (!isSalaryApplicable || perDayWage === '') ? 0 : Number(perDayWage);
    if (isNaN(wage) || wage < 0) return;

    const labourData: Labour = {
      id: editingLabour ? editingLabour.id : generateId('l'),
      name: name.trim(),
      perDayWage: wage,
      contact: contact.trim() || 'N/A',
      status,
      role,
      isSalaryApplicable: isSalaryApplicable && wage > 0,
      leftDate: status === 'left' ? (leftDate || new Date().toISOString().split('T')[0]) : undefined,
      joinedDate: joinedDate || undefined,
    };

    if (editingLabour) {
      onUpdateLabour(labourData);
      alert(`Profile updated for ${labourData.name}`);
    } else {
      onAddLabour(labourData);
      alert(`Person ${labourData.name} registered successfully`);
    }

    setShowAddForm(false);
    setEditingLabour(null);
  };

  const toggleLabourStatus = (l: Labour) => {
    const updated: Labour = {
      ...l,
      status: l.status === 'active' ? 'left' : 'active',
      leftDate: l.status === 'active' ? new Date().toISOString().split('T')[0] : undefined,
    };
    onUpdateLabour(updated);
    alert(`Status updated for ${l.name}`);
  };

  // ----------------------------------------------------
  // Statistics Engine for Labour
  // ----------------------------------------------------
  const getLabourStats = (l: Labour) => {
    if (!activeProject) return null;

    // 1. Calculate days worked in this project
    const projectAtt = attendanceRecords.filter(
      r => r.labourId === l.id && r.projectId === activeProject.id
    );

    const daysWorked = getLabourDaysWorked(l, attendanceRecords, activeProject.id, activeProject.startDate);

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

    // 5. Food cost calculation
    // Manual meals cost
    const pFoodLogs = foodLogs.filter(
      f => f.labourId === l.id && f.projectId === activeProject.id
    );
    const manualFoodCost = pFoodLogs.reduce((sum, f) => sum + (f.mealsCount * f.cost), 0);

    // Auto food cost (using standard ₹100/day present since joining)
    const { cost: autoFoodCost, daysPresent: foodDays } = getAttendanceFoodDaysAndCost(
      l,
      attendanceRecords,
      activeProject.id,
      foodCalculationStartDate,
      activeProject.startDate
    );

    // Net remaining balance with or without food cost deducted
    const netBalanceWithFoodAuto = baseWages - totalAdvances - totalPaid - autoFoodCost;
    const netBalanceWithFoodManual = baseWages - totalAdvances - totalPaid - manualFoodCost;
    const netBalanceWithoutFood = baseWages - totalAdvances - totalPaid;

    return {
      daysWorked,
      baseWages,
      totalAdvances,
      totalPaid,
      autoFoodCost,
      manualFoodCost,
      foodDays,
      netBalanceWithFoodAuto,
      netBalanceWithFoodManual,
      netBalanceWithoutFood,
      advances: projectAdvs,
      payments: projectPays,
    };
  };

  // Submit Advance or Payout directly
  const handleTrxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) {
      alert("Please select an active project first.");
      return;
    }
    if (!selectedLabourId || !trxAmount) return;

    const amount = Number(trxAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    const worker = labours.find(l => l.id === selectedLabourId);
    if (!worker) return;

    if (trxType === 'advance') {
      if (onAddAdvance) {
        onAddAdvance({
          id: generateId('adv'),
          labourId: selectedLabourId,
          projectId: activeProject.id,
          amount,
          date: trxDate,
          description: trxNotes.trim() || 'Cash Advance',
          paidBy: trxPayerId ? payers.find(p => p.id === trxPayerId)?.name || '' : '',
        });
        alert(`Cash advance of ₹${amount} successfully logged for ${worker.name}`);
      }
    } else {
      if (onRecordPayment) {
        const stats = getLabourStats(worker);
        onRecordPayment({
          id: generateId('pay'),
          labourId: selectedLabourId,
          projectId: activeProject.id,
          date: trxDate,
          amountPaid: amount,
          advanceDeducted: stats ? stats.totalAdvances : 0,
          baseWages: stats ? stats.baseWages : 0,
          daysWorked: stats ? stats.daysWorked : 0,
          notes: trxNotes.trim() || 'Wage Payout',
        });
        alert(`Wage Payout of ₹${amount} successfully logged for ${worker.name}`);
      }
    }

    setTrxAmount('');
    setTrxNotes('');
    setTrxPayerId('');
  };

  const filteredLabours = labours.filter(l => l.status === activeTab);

  // Unified Transaction Ledger calculation for active tab 'payments_advances'
  const activeProjectPayments = activeProject ? paymentRecords.filter(p => p.projectId === activeProject.id) : [];
  const activeProjectAdvances = activeProject ? advanceRecords.filter(a => a.projectId === activeProject.id) : [];

  interface LedgerItem {
    id: string;
    type: 'payout' | 'advance';
    date: string;
    labourId: string;
    labourName: string;
    amount: number;
    notes: string;
    payer?: string;
  }

  const ledgerItems: LedgerItem[] = [
    ...activeProjectPayments.map(p => {
      const labour = labours.find(l => l.id === p.labourId);
      return {
        id: p.id,
        type: 'payout' as const,
        date: p.date,
        labourId: p.labourId,
        labourName: labour ? labour.name : 'Unknown Worker',
        amount: p.amountPaid,
        notes: p.notes || 'Regular wage payout',
      };
    }),
    ...activeProjectAdvances.map(a => {
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
  ].sort((a, b) => b.date.localeCompare(a.date));

  const filteredLedgerItems = ledgerItems.filter(item => 
    item.labourName.toLowerCase().includes(ledgerSearchTerm.toLowerCase()) ||
    item.notes.toLowerCase().includes(ledgerSearchTerm.toLowerCase())
  );

  // Selected worker details context for the payout form
  const selectedWorker = labours.find(l => l.id === selectedLabourId);
  const selectedWorkerStats = selectedWorker ? getLabourStats(selectedWorker) : null;

  return (
    <div id="labour-manager-section" className="space-y-6">
      {/* Tab Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Labour registry & Wages Panel
          </h2>
          <p className="text-slate-500 text-sm">
            Configure worker wage cards, log daily advances or payout settlements, and monitor food-related cost summaries.
          </p>
        </div>
        <button
          id="btn-add-labour"
          onClick={openAddForm}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
          Register New Worker
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-semibold text-slate-800 text-sm">
              {editingLabour ? 'Edit Worker Profile' : 'Register New Worker'}
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Category / Role</label>
              <select
                value={role}
                onChange={(e) => {
                  const newRole = e.target.value as any;
                  setRole(newRole);
                  if (newRole === 'contractor' || newRole === 'staff' || newRole === 'other') {
                    setIsSalaryApplicable(false);
                    setPerDayWage('0');
                  } else {
                    setIsSalaryApplicable(true);
                    if (perDayWage === '0' || !perDayWage) setPerDayWage('500');
                  }
                }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 font-semibold text-slate-800"
              >
                <option value="worker">👷 Regular Worker / Daily Wage</option>
                <option value="contractor">🏗️ Subcontractor / Main Contractor</option>
                <option value="staff">👔 Site Supervisor / Staff</option>
                <option value="other">👤 Other Guest / Personnel</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar / Sharma Constructions"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Daily Wage (Rs.)</label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isSalaryApplicable}
                    onChange={(e) => {
                      setIsSalaryApplicable(e.target.checked);
                      if (!e.target.checked) setPerDayWage('0');
                    }}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-800 h-3.5 w-3.5"
                  />
                  <span>Receives Daily Salary</span>
                </label>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">₹</span>
                <input
                  type="number"
                  value={perDayWage}
                  onChange={(e) => setPerDayWage(e.target.value)}
                  disabled={!isSalaryApplicable}
                  placeholder={isSalaryApplicable ? "e.g. 500" : "0 (No Salary)"}
                  className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono ${
                    !isSalaryApplicable ? 'bg-slate-100 text-slate-400 border-slate-200' : 'border-slate-200 text-slate-800'
                  }`}
                />
              </div>
              {!isSalaryApplicable && (
                <p className="text-[10px] text-slate-400 italic">No daily wages accrued. Person will be listed for hotel meals & advances.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Contact / Phone Number</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Date of Joining</label>
              <input
                type="date"
                value={joinedDate}
                onChange={(e) => setJoinedDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Work Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="active">Active (Currently working)</option>
                <option value="left">Left Work / Archived</option>
              </select>
            </div>

            {status === 'left' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Date of Leaving Work</label>
                <input
                  type="date"
                  value={leftDate}
                  onChange={(e) => setLeftDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required={status === 'left'}
                />
              </div>
            )}

            <div className="md:col-span-2 pt-2 flex justify-end">
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-lg text-xs font-semibold tracking-wide cursor-pointer"
              >
                {editingLabour ? 'Save Changes' : 'Register Worker'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 gap-1">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition ${
            activeTab === 'active'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Active Team ({labours.filter(l => l.status === 'active').length})
        </button>
        <button
          onClick={() => setActiveTab('left')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition ${
            activeTab === 'left'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Left / Archived ({labours.filter(l => l.status === 'left').length})
        </button>
        <button
          onClick={() => setActiveTab('payments_advances')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
            activeTab === 'payments_advances'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Coins className="w-3.5 h-3.5 text-emerald-500" />
          Payments & Advances Tab
        </button>
        <button
          onClick={() => setActiveTab('food_stats')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 cursor-pointer transition flex items-center gap-1.5 ${
            activeTab === 'food_stats'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Utensils className="w-3.5 h-3.5 text-amber-500" />
          Wages & Food Analytics
        </button>
      </div>

      {/* RENDER ACTIVE AND LEFT WORKER LIST */}
      {(activeTab === 'active' || activeTab === 'left') && (
        filteredLabours.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-xl p-10 text-center space-y-4">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <h3 className="font-semibold text-slate-700">
                {activeTab === 'active' ? 'No Active Workers' : 'No Left Workers'}
              </h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">
                {activeTab === 'active'
                  ? 'Register some labourers with daily wage settings to start bookkeeping.'
                  : 'Any worker flagged as "Left Work" will appear here for record safety.'}
              </p>
            </div>
            {activeTab === 'active' && (
              <button
                onClick={openAddForm}
                className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
              >
                <UserPlus className="w-4 h-4" /> Add Worker
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLabours.map((l) => {
              const stats = getLabourStats(l);
              return (
                <div
                  key={l.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:shadow-sm transition"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-semibold text-slate-800 text-base">{l.name}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            l.role === 'contractor'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : l.role === 'staff'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : l.role === 'other'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {l.role === 'contractor' ? '🏗️ Contractor' : l.role === 'staff' ? '👔 Staff' : l.role === 'other' ? '👤 Personnel' : '👷 Worker'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs flex items-center gap-1 mt-0.5 font-mono">
                          <Phone className="w-3 h-3" /> {l.contact}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditForm(l)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-50 transition cursor-pointer"
                          title="Edit worker"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleLabourStatus(l)}
                          className={`p-1 rounded hover:bg-slate-50 transition cursor-pointer ${
                            l.status === 'active' ? 'text-slate-400 hover:text-amber-600' : 'text-slate-400 hover:text-emerald-600'
                          }`}
                          title={l.status === 'active' ? 'Mark as Left' : 'Mark as Active'}
                        >
                          {l.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setLabourToDelete(l)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition cursor-pointer"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Salary Status</p>
                        <p className="font-semibold text-slate-700 font-mono text-xs mt-0.5">
                          {l.perDayWage > 0 ? `₹${l.perDayWage}/day` : 'No Daily Salary'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Labour Status</p>
                        <span className={`inline-block font-medium rounded-full px-2 py-0.5 mt-1 ${
                          l.status === 'active'
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                            : 'text-rose-700 bg-rose-50 border border-rose-100'
                        }`}>
                          {l.status === 'active' ? 'Active Team' : 'Left Work'}
                        </span>
                      </div>
                    </div>

                    {/* Quick site balance overview */}
                    {activeProject && stats && (
                      <div className="border-t border-slate-100 pt-2 grid grid-cols-3 gap-1 text-[10px] font-mono">
                        <div>
                          <span className="text-slate-400 block">Worked</span>
                          <span className="font-bold text-slate-700">{stats.daysWorked}d</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Advs</span>
                          <span className="font-bold text-rose-600">₹{stats.totalAdvances}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Balance</span>
                          <span className={`font-bold ${stats.netBalanceWithoutFood < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            ₹{stats.netBalanceWithoutFood}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {(l.joinedDate || (l.status === 'left' && l.leftDate)) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 flex flex-col gap-1.5 font-mono">
                      {l.joinedDate && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Joined on: {l.joinedDate}</span>
                        </div>
                      )}
                      {l.status === 'left' && l.leftDate && (
                        <div className="flex items-center gap-1.5 text-rose-600">
                          <Archive className="w-3.5 h-3.5" />
                          <span>Left project on: {l.leftDate}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* RENDER TAB 3: PAYMENTS & ADVANCES LEDGER */}
      {activeTab === 'payments_advances' && (
        <div className="space-y-6">
          {!activeProject ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center space-y-2">
              <Info className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="font-semibold text-slate-700">No Construction Site Selected</h4>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">
                Please select an active site on the Dashboard tab to enable advance logging and payouts for workers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Column */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 self-start">
                <div className="border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-emerald-500" />
                    Quick Log Advance / Payout
                  </h3>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    Log immediate cash advances or wage payouts for {activeProject.name}.
                  </p>
                </div>

                <form onSubmit={handleTrxSubmit} className="space-y-4 text-xs">
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-500 uppercase tracking-wider block">Select Worker</label>
                    <select
                      value={selectedLabourId}
                      onChange={(e) => {
                        setSelectedLabourId(e.target.value);
                        // Auto-select first payer if available
                        if (payers.length > 0 && !trxPayerId) {
                          setTrxPayerId(payers[0].id);
                        }
                      }}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      required
                    >
                      <option value="">-- Choose registered worker --</option>
                      {labours.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name} [{l.role === 'contractor' ? 'Contractor' : l.role === 'staff' ? 'Staff' : l.role === 'other' ? 'Personnel' : 'Worker'}] ({l.status === 'active' ? 'Active' : 'Left'}) {l.perDayWage > 0 ? `- ₹${l.perDayWage}/day` : '- No Daily Salary'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* TRANSACTION CONTEXT PREVIEW */}
                  {selectedWorkerStats && (
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1.5 text-[11px] leading-normal">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Days Worked:</span>
                        <span className="font-semibold font-mono text-slate-800">{selectedWorkerStats.daysWorked} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Gross Wages Earned:</span>
                        <span className="font-semibold font-mono text-slate-800">₹{selectedWorkerStats.baseWages}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Advances Taken:</span>
                        <span className="font-semibold font-mono text-rose-600">₹{selectedWorkerStats.totalAdvances}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Previously Paid:</span>
                        <span className="font-semibold font-mono text-indigo-600">₹{selectedWorkerStats.totalPaid}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-200/60 pt-1.5 font-bold">
                        <span className="text-slate-700">Net Due (No Food Deducted):</span>
                        <span className={`font-mono ${selectedWorkerStats.netBalanceWithoutFood < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          ₹{selectedWorkerStats.netBalanceWithoutFood.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-slate-700">Net Due (Food Deducted):</span>
                        <span className={`font-mono ${selectedWorkerStats.netBalanceWithFoodAuto < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          ₹{selectedWorkerStats.netBalanceWithFoodAuto.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-500 uppercase tracking-wider block">Transaction Type</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTrxType('advance')}
                        className={`flex-1 py-2 rounded-lg border font-semibold text-center transition ${
                          trxType === 'advance'
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        Cash Advance (Deducted later)
                      </button>
                      <button
                        type="button"
                        onClick={() => setTrxType('payout')}
                        className={`flex-1 py-2 rounded-lg border font-semibold text-center transition ${
                          trxType === 'payout'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        Wage Payout / Settlement
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-500 uppercase tracking-wider block">Amount (Rs.)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 pointer-events-none text-slate-400 font-mono">₹</span>
                      <input
                        type="number"
                        value={trxAmount}
                        onChange={(e) => setTrxAmount(e.target.value)}
                        placeholder="e.g. 1000"
                        className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-500 uppercase tracking-wider block">Date</label>
                    <input
                      type="date"
                      value={trxDate}
                      onChange={(e) => setTrxDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-500 uppercase tracking-wider block">Disbursed By (Payer / Supervisor)</label>
                    <select
                      value={trxPayerId}
                      onChange={(e) => setTrxPayerId(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    >
                      <option value="">-- No linked payer / Supervisor --</option>
                      {payers.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.role ? `(${p.role})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-slate-500 uppercase tracking-wider block">Notes / Description</label>
                    <textarea
                      value={trxNotes}
                      onChange={(e) => setTrxNotes(e.target.value)}
                      placeholder={trxType === 'advance' ? 'e.g. Advance for medicine/family' : 'e.g. Regular weekly wage payment'}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900 min-h-[60px]"
                    />
                  </div>

                  <button
                    type="submit"
                    className={`w-full text-white font-semibold py-2.5 rounded-lg transition cursor-pointer shadow-xs ${
                      trxType === 'advance' ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                    }`}
                  >
                    Log {trxType === 'advance' ? 'Cash Advance' : 'Payout Settlement'}
                  </button>
                </form>
              </div>

              {/* Ledger List Column */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">Unified Payments & Advances Ledger</h3>
                    <p className="text-slate-400 text-[10px] mt-0.5">Chronological transaction register of payments & cash advances on this site.</p>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3 h-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search worker/notes..."
                      value={ledgerSearchTerm}
                      onChange={(e) => setLedgerSearchTerm(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs w-[180px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>

                {filteredLedgerItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-mono text-xs">
                    <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No logged advances or payouts found matching filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-100 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-500 uppercase tracking-wider text-[9px]">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Worker Name</th>
                          <th className="py-2 px-3">Type</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                          <th className="py-2 px-3">Disbursed By / Notes</th>
                          <th className="py-2 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {filteredLedgerItems.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/40 transition">
                            <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{item.date}</td>
                            <td className="py-2 px-3 font-sans font-semibold text-slate-800">{item.labourName}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                item.type === 'advance' 
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {item.type === 'advance' ? 'Advance' : 'Payout'}
                              </span>
                            </td>
                            <td className={`py-2 px-3 text-right font-bold ${
                              item.type === 'advance' ? 'text-amber-700' : 'text-emerald-700'
                            }`}>
                              ₹{item.amount.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-500 max-w-[180px] truncate" title={item.notes}>
                              {item.payer ? (
                                <span className="block text-[10px] text-slate-400 italic">Disbursed by: {item.payer}</span>
                              ) : null}
                              <span className="text-slate-600 text-[10px]">{item.notes}</span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              {deletingLedgerId === item.id ? (
                                <div className="flex items-center justify-center gap-1 animate-fade-in">
                                  <button
                                    onClick={() => {
                                      if (item.type === 'advance' && onDeleteAdvance) {
                                        onDeleteAdvance(item.id);
                                      } else if (item.type === 'payout' && onDeletePayment) {
                                        onDeletePayment(item.id);
                                      }
                                      setDeletingLedgerId(null);
                                    }}
                                    className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => setDeletingLedgerId(null)}
                                    className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-medium cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingLedgerId(item.id)}
                                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded transition cursor-pointer"
                                  title="Delete transaction"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RENDER TAB 4: WAGES & FOOD COST COMPARATIVE ANALYTICS */}
      {activeTab === 'food_stats' && (
        <div className="space-y-4">
          {!activeProject ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center space-y-2">
              <Utensils className="w-8 h-8 text-slate-400 mx-auto" />
              <h4 className="font-semibold text-slate-700">No Construction Site Selected</h4>
              <p className="text-slate-400 text-xs max-w-sm mx-auto">
                Please select an active site on the Dashboard tab to view Wages & Food outlays analytics.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                    <Utensils className="w-4 h-4 text-amber-500" />
                    Worker Wages vs. Food Cost Comparison
                  </h3>
                  <p className="text-slate-400 text-[10px] mt-0.5">
                    Detailed per-worker highlights comparing gross earnings, food deductions (Auto vs Manual), advances, and net payable wages.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 w-3 h-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter by name..."
                      value={statsSearchTerm}
                      onChange={(e) => setStatsSearchTerm(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1 text-xs w-[160px] focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              </div>

              {/* Statistical explanation box */}
              <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex gap-2.5 items-start text-[11px] leading-relaxed text-slate-600">
                <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong>How to read this summary card:</strong>
                  <p>
                    Workers are paid daily rates. Food can either be deducted from their payroll, or provided complimentary on top:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li><strong className="text-emerald-700">Net Due (Food Deducted)</strong>: Gross Earnings minus Advances and Food Cost outlays. Use this if workers pay for their own boarding.</li>
                    <li><strong className="text-indigo-700">Net Due (No Food Deducted)</strong>: Gross Earnings minus Advances only. Use this if you provide free food / boarding on top of standard wages.</li>
                  </ul>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 font-semibold text-slate-500 uppercase tracking-wider text-[9px]">
                      <th className="py-2.5 px-3">Worker Name</th>
                      <th className="py-2.5 px-3 text-right">Daily Wage</th>
                      <th className="py-2.5 px-3 text-right">Days Worked</th>
                      <th className="py-2.5 px-3 text-right">Gross Wages</th>
                      <th className="py-2.5 px-3 text-right bg-amber-50/50">Auto Food (₹100/d)</th>
                      <th className="py-2.5 px-3 text-right bg-amber-50">Manual Meals</th>
                      <th className="py-2.5 px-3 text-right text-rose-700">Advances</th>
                      <th className="py-2.5 px-3 text-right text-indigo-700 font-semibold">Total Paid</th>
                      <th className="py-2.5 px-3 text-right bg-emerald-50 text-emerald-800 font-bold">Net Due (With Food)</th>
                      <th className="py-2.5 px-3 text-right bg-indigo-50 text-indigo-800 font-bold">Net Due (No Food)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {labours
                      .filter(l => l.name.toLowerCase().includes(statsSearchTerm.toLowerCase()))
                      .map(l => {
                        const stats = getLabourStats(l);
                        if (!stats) return null;
                        return (
                          <tr key={l.id} className="hover:bg-slate-50/40 transition">
                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-800 whitespace-nowrap">{l.name}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">₹{l.perDayWage}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600">{stats.daysWorked}d</td>
                            <td className="py-2.5 px-3 text-right text-slate-800 font-semibold">₹{stats.baseWages.toFixed(0)}</td>
                            <td className="py-2.5 px-3 text-right bg-amber-50/30 text-amber-700" title={`${stats.foodDays} attendance days`}>
                              ₹{stats.autoFoodCost.toFixed(0)} <span className="text-[9px] text-slate-400">({stats.foodDays}d)</span>
                            </td>
                            <td className="py-2.5 px-3 text-right bg-amber-50/50 text-amber-700">₹{stats.manualFoodCost.toFixed(0)}</td>
                            <td className="py-2.5 px-3 text-right text-rose-600">₹{stats.totalAdvances.toFixed(0)}</td>
                            <td className="py-2.5 px-3 text-right text-indigo-600">₹{stats.totalPaid.toFixed(0)}</td>
                            <td className={`py-2.5 px-3 text-right font-bold bg-emerald-50/30 ${
                              stats.netBalanceWithFoodAuto < 0 ? 'text-rose-600' : 'text-emerald-700'
                            }`}>
                              ₹{stats.netBalanceWithFoodAuto.toFixed(0)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-bold bg-indigo-50/30 ${
                              stats.netBalanceWithoutFood < 0 ? 'text-rose-600' : 'text-indigo-700'
                            }`}>
                              ₹{stats.netBalanceWithoutFood.toFixed(0)}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={labourToDelete !== null}
        onClose={() => setLabourToDelete(null)}
        onConfirm={() => {
          if (labourToDelete) {
            onDeleteLabour(labourToDelete.id);
            setLabourToDelete(null);
          }
        }}
        title="Delete Worker Profile?"
        message={`Are you sure you want to delete "${labourToDelete?.name}" permanently?\n\nThis action is IRREVERSIBLE and will cascade-delete all of their historical attendance sheets, food records, cash advances, and wage payouts!`}
        confirmText="Yes, Delete Permanently"
        cancelText="Keep Worker"
        type="danger"
      />
    </div>
  );
}

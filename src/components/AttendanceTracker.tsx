/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Project, Labour, Attendance, Advance, AttendanceStatus, Payer } from '../types';
import { generateId } from '../utils/id';
import { Calendar, Save, CheckCircle, HelpCircle, XCircle, IndianRupee, Plus, Trash2, ArrowRightLeft, Users, UserPlus, Coins, Pencil, ChevronLeft, ChevronRight, Coffee } from 'lucide-react';

interface AttendanceTrackerProps {
  activeProject: Project | null;
  labours: Labour[];
  attendanceRecords: Attendance[];
  advanceRecords: Advance[];
  payers: Payer[];
  onSaveAttendance: (records: Attendance[]) => void;
  onAddAdvance: (advance: Advance) => void;
  onDeleteAdvance: (id: string) => void;
  onAddPayer: (payer: Payer) => void;
  onUpdatePayer: (payer: Payer) => void;
  onDeletePayer: (id: string) => void;
  onUpdateLabour: (labour: Labour) => void;
}

export default function AttendanceTracker({
  activeProject,
  labours,
  attendanceRecords,
  advanceRecords,
  payers,
  onSaveAttendance,
  onAddAdvance,
  onDeleteAdvance,
  onAddPayer,
  onUpdatePayer,
  onDeletePayer,
  onUpdateLabour,
}: AttendanceTrackerProps) {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [trackerState, setTrackerState] = useState<Record<string, { status: AttendanceStatus; advance: number; note: string; paidBy: string }>>({});
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'tracker' | 'standalone' | 'payers'>('tracker');

  // Dialog and feedback states
  const [showSavedDialog, setShowSavedDialog] = useState(false);
  const [savedSummaryData, setSavedSummaryData] = useState<{ date: string; records: { name: string; status: AttendanceStatus; advance: number }[] } | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDialogMsg, setErrorDialogMsg] = useState('');

  // New Advance form state (for stand-alone manual logging of advances)
  const [advLabourId, setAdvLabourId] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advDate, setAdvDate] = useState(new Date().toISOString().split('T')[0]);
  const [advDesc, setAdvDesc] = useState('');
  const [advPaidBy, setAdvPaidBy] = useState('');

  // Payer form state
  const [payerName, setPayerName] = useState('');
  const [payerRole, setPayerRole] = useState('');
  const [payerPhone, setPayerPhone] = useState('');

  // Inline deletion states
  const [deletingAdvanceId, setDeletingAdvanceId] = useState<string | null>(null);
  const [deletingPayerId, setDeletingPayerId] = useState<string | null>(null);
  const [editingPayer, setEditingPayer] = useState<Payer | null>(null);

  // Active labours who joined on or before selectedDate, and haven't left, or left AFTER the selected date
  const activeLabours = labours.filter(l => {
    if (l.joinedDate && l.joinedDate > selectedDate) {
      return false; // Joined after the selected date
    }
    if (l.status === 'active') return true;
    if (l.status === 'left' && l.leftDate) {
      return l.leftDate >= selectedDate; // Was still working on or after selected date
    }
    return false;
  });

  // Labours who are registered but hidden because their joining date is after selectedDate
  const hiddenLabours = labours.filter(l => {
    return l.status === 'active' && l.joinedDate && l.joinedDate > selectedDate;
  });

  // Track previous project and date to detect if we switched tabs/dates/projects
  const prevSelectedDateRef = useRef(selectedDate);
  const prevProjectIdRef = useRef(activeProject?.id);

  // When date or labours change, pre-load existing attendance and advances for this date/project
  useEffect(() => {
    if (!activeProject) return;

    const dateOrProjectChanged = 
      prevSelectedDateRef.current !== selectedDate || 
      prevProjectIdRef.current !== activeProject.id;

    // Update refs
    prevSelectedDateRef.current = selectedDate;
    prevProjectIdRef.current = activeProject.id;

    setTrackerState(prev => {
      const updatedTracker = dateOrProjectChanged ? {} : { ...prev };

      activeLabours.forEach(l => {
        // If date/project didn't change and we already have a state for this labour,
        // preserve the user's unsaved state!
        if (!dateOrProjectChanged && updatedTracker[l.id]) {
          return;
        }

        // Find existing attendance
        const existingAtt = attendanceRecords.find(
          r => r.labourId === l.id && r.projectId === activeProject.id && r.date === selectedDate
        );

        // Find existing advance for this specific date & project
        const existingAdv = advanceRecords.find(
          a => a.labourId === l.id && a.projectId === activeProject.id && a.date === selectedDate
        );

        updatedTracker[l.id] = {
          status: existingAtt ? existingAtt.status : 'pending', // Default to pending so untracked days are not counted as present
          advance: existingAdv ? existingAdv.amount : 0,
          note: existingAdv ? existingAdv.description || '' : '',
          paidBy: existingAdv ? existingAdv.paidBy || '' : '',
        };
      });

      return updatedTracker;
    });
  }, [selectedDate, activeProject, labours, attendanceRecords, advanceRecords]);

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-slate-500">
          <Calendar className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-700">No Construction Site Selected</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Please select or create an active project site in the <strong>Projects</strong> tab before logging daily attendance.
        </p>
      </div>
    );
  }

  const handleNavigateDate = (offset: number) => {
    const current = new Date(selectedDate);
    if (!isNaN(current.getTime())) {
      current.setDate(current.getDate() + offset);
      setSelectedDate(current.toISOString().split('T')[0]);
    }
  };

  const handleStatusChange = (labourId: string, status: AttendanceStatus) => {
    setTrackerState(prev => ({
      ...prev,
      [labourId]: { ...prev[labourId], status }
    }));
  };

  const handleAdvanceChange = (labourId: string, value: string) => {
    const amount = Number(value) || 0;
    setTrackerState(prev => ({
      ...prev,
      [labourId]: { ...prev[labourId], advance: amount }
    }));
  };

  const handleNoteChange = (labourId: string, value: string) => {
    setTrackerState(prev => ({
      ...prev,
      [labourId]: { ...prev[labourId], note: value }
    }));
  };

  const handlePaidByChange = (labourId: string, value: string) => {
    setTrackerState(prev => ({
      ...prev,
      [labourId]: { ...prev[labourId], paidBy: value }
    }));
  };

  const handleSaveAll = async () => {
    try {
      const finalAttendance: Attendance[] = [];
      const savedSummary: { name: string; status: AttendanceStatus; advance: number }[] = [];

      for (const l of activeLabours) {
        const state = trackerState[l.id] || { status: 'pending', advance: 0, note: '', paidBy: '' };
        savedSummary.push({
          name: l.name,
          status: state.status,
          advance: state.advance,
        });

        // Build attendance record
        const existingAtt = attendanceRecords.find(
          r => r.labourId === l.id && r.projectId === activeProject.id && r.date === selectedDate
        );
        finalAttendance.push({
          id: existingAtt ? existingAtt.id : 'att_' + l.id + '_' + activeProject.id + '_' + selectedDate,
          labourId: l.id,
          projectId: activeProject.id,
          date: selectedDate,
          status: state.status,
        });

        // Save/Update Advance if > 0
        if (state.advance > 0) {
          const existingAdv = advanceRecords.find(
            a => a.labourId === l.id && a.projectId === activeProject.id && a.date === selectedDate
          );
          await onAddAdvance({
            id: existingAdv ? existingAdv.id : 'adv_' + l.id + '_' + activeProject.id + '_' + selectedDate,
            labourId: l.id,
            projectId: activeProject.id,
            amount: state.advance,
            date: selectedDate,
            description: state.note || 'Advance taken on site',
            paidBy: state.paidBy || '',
          });
        } else {
          // If advance was set to 0 but was previously logged, remove it
          const existingAdv = advanceRecords.find(
            a => a.labourId === l.id && a.projectId === activeProject.id && a.date === selectedDate
          );
          if (existingAdv) {
            await onDeleteAdvance(existingAdv.id);
          }
        }
      }

      await onSaveAttendance(finalAttendance);

      setSavedSummaryData({
        date: selectedDate,
        records: savedSummary
      });
      setShowSavedDialog(true);
    } catch (err: any) {
      setErrorDialogMsg(err?.message || 'An error occurred while saving the attendance records. Please try again.');
      setShowErrorDialog(true);
    }
  };

  const handleManualAdvanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!advLabourId || !advAmount) return;

    onAddAdvance({
      id: generateId('adv'),
      labourId: advLabourId,
      projectId: activeProject.id,
      amount: Number(advAmount),
      date: advDate,
      description: advDesc || 'Advance payment',
      paidBy: advPaidBy || '',
    });

    setAdvLabourId('');
    setAdvAmount('');
    setAdvDesc('');
    setAdvPaidBy('');
    setShowAdvanceForm(false);
    alert('Standalone advance logged successfully!');
  };

  const handleEditPayerClick = (p: Payer) => {
    setEditingPayer(p);
    setPayerName(p.name);
    setPayerRole(p.role || '');
    setPayerPhone(p.phone || '');
    document.getElementById('attendance-tracker-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelPayerEdit = () => {
    setEditingPayer(null);
    setPayerName('');
    setPayerRole('');
    setPayerPhone('');
  };

  const handleAddPayerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payerName.trim()) return;

    if (editingPayer) {
      onUpdatePayer({
        ...editingPayer,
        name: payerName.trim(),
        role: payerRole.trim() || undefined,
        phone: payerPhone.trim() || undefined,
      });
      setEditingPayer(null);
      alert('Payer updated successfully!');
    } else {
      onAddPayer({
        id: generateId('p'),
        name: payerName.trim(),
        role: payerRole.trim() || undefined,
        phone: payerPhone.trim() || undefined,
      });
      alert('Payer added to directory!');
    }

    setPayerName('');
    setPayerRole('');
    setPayerPhone('');
  };

  // Filter advances to show only for active project
  const projectAdvances = advanceRecords.filter(a => a.projectId === activeProject.id);

  return (
    <div id="attendance-tracker-section" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">
            Attendance & Daily Advances
          </h2>
          <p className="text-slate-500 text-sm">
            Site: <strong className="text-slate-700">{activeProject.name}</strong> • Record daily presence, micro-advances, and authorize payers.
          </p>
        </div>

        {activeSubTab === 'tracker' && (
          <div className="flex items-center gap-2 bg-white border border-slate-200/80 p-1 rounded-xl shadow-xs">
            <button
              type="button"
              onClick={() => handleNavigateDate(-1)}
              className="p-1.5 hover:bg-slate-100 hover:text-slate-800 rounded-lg text-slate-500 cursor-pointer transition flex items-center justify-center border border-transparent hover:border-slate-200"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-slate-200 bg-white rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700 h-9"
              />
            </div>
            <button
              type="button"
              onClick={() => handleNavigateDate(1)}
              className="p-1.5 hover:bg-slate-100 hover:text-slate-800 rounded-lg text-slate-500 cursor-pointer transition flex items-center justify-center border border-transparent hover:border-slate-200"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Sub Tabs Navigation */}
      <div className="flex border border-slate-100 bg-slate-50/50 p-1.5 rounded-xl max-w-xl shadow-sm">
        <button
          onClick={() => setActiveSubTab('tracker')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'tracker'
              ? 'bg-slate-900 text-white shadow'
              : 'text-slate-500 hover:bg-white hover:text-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          Attendance & Daily Advances
        </button>
        <button
          onClick={() => setActiveSubTab('standalone')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'standalone'
              ? 'bg-slate-900 text-white shadow'
              : 'text-slate-500 hover:bg-white hover:text-slate-800'
          }`}
        >
          <Coins className="w-3.5 h-3.5" />
          Standalone Ledger
        </button>
        <button
          onClick={() => setActiveSubTab('payers')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSubTab === 'payers'
              ? 'bg-slate-900 text-white shadow'
              : 'text-slate-500 hover:bg-white hover:text-slate-800'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Payers Directory ({payers.length})
        </button>
      </div>

      {/* RENDER TAB 1: DAILY ATTENDANCE & ADVANCES TRACKER */}
      {activeSubTab === 'tracker' && (
        <>
          {activeLabours.length === 0 ? (
            <div className="space-y-4">
              <div className="bg-white border border-dashed border-slate-200 rounded-xl p-10 text-center space-y-3">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="font-semibold text-slate-700">No Active Workers on {selectedDate}</h3>
                <p className="text-slate-400 text-sm max-w-sm mx-auto">
                  There are no workers registered as active on or before this date (<strong>{selectedDate}</strong>).
                </p>
              </div>

              {hiddenLabours.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-xs text-amber-900 space-y-3 shadow-xs">
                  <p className="font-bold text-amber-800 text-sm flex items-center gap-1.5">
                    <span>⚠️</span> {hiddenLabours.length} Worker{hiddenLabours.length > 1 ? 's' : ''} Hidden Due to Date of Joining:
                  </p>
                  <p className="text-amber-700 leading-relaxed">
                    Some workers do not appear on <strong>{selectedDate}</strong> because their registered "Date of Joining" is set to a later date. 
                    If they actually joined earlier and you are entering older attendance records, click below to update their joining date to <strong>{selectedDate}</strong>:
                  </p>
                  <div className="flex flex-wrap gap-2.5 pt-1">
                    {hiddenLabours.map(hl => (
                      <div key={hl.id} className="bg-white px-3 py-2 rounded-lg border border-amber-200 shadow-xs flex items-center justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-800 text-xs">{hl.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5">Registered Join: {hl.joinedDate}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateLabour({
                              ...hl,
                              joinedDate: selectedDate
                            });
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2.5 py-1 rounded-md text-[11px] cursor-pointer transition shadow-xs"
                        >
                          Change Joining Date to {selectedDate}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Educational banner clarifying the flow */}
              <div className="bg-slate-50 border-l-4 border-slate-900 rounded-r-xl p-4 text-xs text-slate-600 space-y-2">
                <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  <span>💡</span> How Attendance Affects Wages &amp; Food Costs:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-sm">
                    <p className="font-semibold text-emerald-700 flex items-center gap-1">🟢 Present</p>
                    <p className="mt-1 text-slate-500">Works full day (<strong>Earns Full Daily Wage</strong>). Eats meals (<strong>Food cost calculated</strong>).</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-sm">
                    <p className="font-semibold text-amber-700 flex items-center gap-1">🟡 Half-Day</p>
                    <p className="mt-1 text-slate-500">Works half day (<strong>Earns Half Daily Wage</strong>). Eats meals (<strong>Food cost calculated</strong>).</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-sm">
                    <p className="font-semibold text-rose-700 flex items-center gap-1">🔴 Absent (At Site)</p>
                    <p className="mt-1 text-slate-500">No work (<strong>Earns ₹0 Wage</strong>). Stays at camp and eats meals (<strong>Food cost calculated</strong>).</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-sm">
                    <p className="font-semibold text-blue-700 flex items-center gap-1">🏠 Went Home</p>
                    <p className="mt-1 text-slate-500">Away from site (<strong>Earns ₹0 Wage</strong> and <strong>EXEMPT from Food costs</strong> for these days).</p>
                  </div>
                </div>
              </div>

              {/* Alert about workers hidden due to joining date even if activeLabours > 0 */}
              {hiddenLabours.length > 0 && (
                <div className="bg-amber-50/85 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2.5 shadow-xs">
                  <p className="font-bold text-amber-800 text-sm flex items-center gap-1.5">
                    <span>⚠️</span> Note: {hiddenLabours.length} other worker{hiddenLabours.length > 1 ? 's are' : ' is'} registered but hidden on this date:
                  </p>
                  <p className="text-amber-700">
                    They are not shown for <strong>{selectedDate}</strong> because their registered "Date of Joining" is set to a later date. 
                    If they actually joined earlier, click below to update their joining date to <strong>{selectedDate}</strong>:
                  </p>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {hiddenLabours.map(hl => (
                      <div key={hl.id} className="bg-white px-2.5 py-1.5 rounded-lg border border-amber-200/80 shadow-xs flex items-center gap-3">
                        <span className="font-semibold text-slate-800">{hl.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateLabour({
                              ...hl,
                              joinedDate: selectedDate
                            });
                          }}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold px-2 py-0.5 rounded text-[10px] cursor-pointer transition"
                        >
                          Change Join to {selectedDate}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Attendance Summary & Quick Batch Entry */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm">
                <div className="space-y-2">
                  <h4 className="font-bold text-sm text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span>📊</span> Daily Status Summary ({selectedDate})
                  </h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 text-slate-800">
                      Total: {activeLabours.length}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      🟢 Present: {activeLabours.filter(l => (trackerState[l.id]?.status || 'pending') === 'present').length}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      🟡 Half-Day: {activeLabours.filter(l => (trackerState[l.id]?.status) === 'half_day').length}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                      🔴 Absent: {activeLabours.filter(l => (trackerState[l.id]?.status) === 'absent').length}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                      ☕ Rest: {activeLabours.filter(l => (trackerState[l.id]?.status) === 'rest').length}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                      🏠 Went Home: {activeLabours.filter(l => (trackerState[l.id]?.status) === 'home').length}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      ⚪ Unmarked/Pending: {activeLabours.filter(l => (trackerState[l.id]?.status || 'pending') === 'pending').length}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block sm:inline self-center">
                    ⚡ Instant Batch Fill:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...trackerState };
                        activeLabours.forEach(l => {
                          updated[l.id] = {
                            ...(updated[l.id] || { status: 'present', advance: 0, note: '', paidBy: '' }),
                            status: 'present'
                          };
                        });
                        setTrackerState(updated);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Set All Present
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...trackerState };
                        activeLabours.forEach(l => {
                          updated[l.id] = {
                            ...(updated[l.id] || { status: 'absent', advance: 0, note: '', paidBy: '' }),
                            status: 'absent'
                          };
                        });
                        setTrackerState(updated);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Set All Absent
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...trackerState };
                        activeLabours.forEach(l => {
                          updated[l.id] = {
                            ...(updated[l.id] || { status: 'half_day', advance: 0, note: '', paidBy: '' }),
                            status: 'half_day'
                          };
                        });
                        setTrackerState(updated);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      Set All Half-Day
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...trackerState };
                        activeLabours.forEach(l => {
                          updated[l.id] = {
                            ...(updated[l.id] || { status: 'rest', advance: 0, note: '', paidBy: '' }),
                            status: 'rest'
                          };
                        });
                        setTrackerState(updated);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
                    >
                      <Coffee className="w-3.5 h-3.5" />
                      Set All Rest
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...trackerState };
                        activeLabours.forEach(l => {
                          updated[l.id] = {
                            ...(updated[l.id] || { status: 'home', advance: 0, note: '', paidBy: '' }),
                            status: 'home'
                          };
                        });
                        setTrackerState(updated);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Set All Home
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...trackerState };
                        activeLabours.forEach(l => {
                          updated[l.id] = {
                            ...(updated[l.id] || { status: 'pending', advance: 0, note: '', paidBy: '' }),
                            status: 'pending'
                          };
                        });
                        setTrackerState(updated);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 bg-slate-500 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition shadow-sm"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      Reset All Pending
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                        <th className="py-3 px-4">Labour Name</th>
                        <th className="py-3 px-4">Daily Wage</th>
                        <th className="py-3 px-4 text-center">Attendance Status</th>
                        <th className="py-3 px-4">Advance Taken Today (Rs.)</th>
                        <th className="py-3 px-4">Advance Note</th>
                        <th className="py-3 px-4">Paid By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                      {activeLabours.map((l) => {
                        const state = trackerState[l.id] || { status: 'pending', advance: 0, note: '', paidBy: '' };

                        return (
                          <tr key={l.id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3.5 px-4 font-medium text-slate-800">
                              <div>{l.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">{l.contact || 'No contact'}</div>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-slate-500">₹{l.perDayWage}</td>
                            <td className="py-3.5 px-4 text-center">
                              <select
                                value={state.status || 'pending'}
                                onChange={(e) => handleStatusChange(l.id, e.target.value as AttendanceStatus)}
                                className={`w-full max-w-[210px] mx-auto font-semibold text-xs py-2 px-3 rounded-lg border transition cursor-pointer focus:outline-none focus:ring-2 ${
                                  state.status === 'present'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-500'
                                    : state.status === 'half_day'
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-500'
                                    : state.status === 'absent'
                                    ? 'bg-rose-50 text-rose-800 border-rose-300 focus:ring-rose-500'
                                    : state.status === 'rest'
                                    ? 'bg-purple-50 text-purple-800 border-purple-300 focus:ring-purple-500'
                                    : state.status === 'home'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300 focus:ring-blue-500'
                                    : 'bg-slate-100 text-slate-700 border-slate-300 focus:ring-slate-500'
                                }`}
                              >
                                <option value="pending">⚪ Unmarked / Pending</option>
                                <option value="present">🟢 Present (Full Wage, Mess Cut)</option>
                                <option value="half_day">🟡 Half-Day (0.5 Wage, Mess Cut)</option>
                                <option value="absent">🔴 Absent (0 Wage, Mess Cut)</option>
                                <option value="rest">☕ Rest Day (0 Wage, Mess Cut)</option>
                                <option value="home">🏠 Went Home (0 Wage, No Mess)</option>
                              </select>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="relative max-w-[120px]">
                                <span className="absolute left-2.5 top-2 text-slate-400 font-mono text-xs">₹</span>
                                <input
                                  type="number"
                                  value={state.advance || ''}
                                  onChange={(e) => handleAdvanceChange(l.id, e.target.value)}
                                  placeholder="0"
                                  className="w-full border border-slate-200 rounded-lg pl-6 pr-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                                />
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <input
                                type="text"
                                value={state.note}
                                onChange={(e) => handleNoteChange(l.id, e.target.value)}
                                placeholder="e.g. For food / travel"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-600"
                                disabled={!state.advance}
                              />
                            </td>
                            <td className="py-3.5 px-4">
                              <select
                                value={state.paidBy || ''}
                                onChange={(e) => handlePaidByChange(l.id, e.target.value)}
                                className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 text-slate-700 disabled:opacity-50"
                                disabled={!state.advance}
                              >
                                <option value="">Select Payer</option>
                                {payers.map(p => (
                                  <option key={p.id} value={p.name}>{p.name} {p.role ? `(${p.role})` : ''}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end">
                  <button
                    onClick={handleSaveAll}
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition cursor-pointer shadow-sm hover:shadow"
                  >
                    <Save className="w-4 h-4" />
                    Save Attendance & Daily Advances
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* RENDER TAB 2: STANDALONE NON-DAILY ADVANCES */}
      {activeSubTab === 'standalone' && (
        <div className="border border-slate-200 rounded-xl bg-white p-5 shadow-sm space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Advances Master Audit Trail</h3>
              <p className="text-slate-400 text-xs">Record non-daily advances or view historical cash advance records for this site.</p>
            </div>
            <button
              onClick={() => setShowAdvanceForm(!showAdvanceForm)}
              className="inline-flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" />
              {showAdvanceForm ? 'Close Log' : 'Log Standalone Advance'}
            </button>
          </div>

          {showAdvanceForm && (
            <form onSubmit={handleManualAdvanceSubmit} className="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Worker</label>
                <select
                  value={advLabourId}
                  onChange={(e) => setAdvLabourId(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  required
                >
                  <option value="">Select Worker</option>
                  {activeLabours.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Amount (Rs.)</label>
                <input
                  type="number"
                  value={advAmount}
                  onChange={(e) => setAdvAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                <input
                  type="date"
                  value={advDate}
                  onChange={(e) => setAdvDate(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs focus:outline-none font-mono"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Paid By</label>
                <select
                  value={advPaidBy}
                  onChange={(e) => setAdvPaidBy(e.target.value)}
                  className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                >
                  <option value="">Select Payer</option>
                  {payers.map(p => (
                    <option key={p.id} value={p.name}>{p.name} {p.role ? `(${p.role})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 flex items-end">
                <div className="w-full">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                  <input
                    type="text"
                    value={advDesc}
                    onChange={(e) => setAdvDesc(e.target.value)}
                    placeholder="Purpose of Advance"
                    className="w-full border border-slate-200 bg-white rounded-lg px-2 py-1.5 text-xs focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="ml-2 bg-slate-900 text-white rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer hover:bg-slate-800 flex-shrink-0"
                >
                  Log
                </button>
              </div>
            </form>
          )}

          {projectAdvances.length === 0 ? (
            <p className="text-slate-400 text-xs text-center py-4 italic border border-dashed border-slate-100 rounded-lg bg-slate-50/50">
              No advances registered yet for this site.
            </p>
          ) : (
            <div className="overflow-x-auto border border-slate-100 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase text-[9px] font-bold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Labour</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Purpose</th>
                    <th className="py-2.5 px-3">Paid By</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                  {projectAdvances.map((adv) => {
                    const worker = labours.find(l => l.id === adv.labourId);
                    return (
                      <tr key={adv.id} className="hover:bg-slate-50/50 transition font-mono">
                        <td className="py-2 px-3 text-slate-500">{adv.date}</td>
                        <td className="py-2 px-3 font-sans font-medium text-slate-700">{worker ? worker.name : 'Unknown Worker'}</td>
                        <td className="py-2 px-3 font-semibold text-rose-600 font-mono">₹{adv.amount}</td>
                        <td className="py-2 px-3 font-sans">{adv.description || 'N/A'}</td>
                        <td className="py-2 px-3 font-sans font-medium text-slate-600">
                          {adv.paidBy ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-700">
                              👤 {adv.paidBy}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[10px]">Unspecified</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {deletingAdvanceId === adv.id ? (
                            <div className="flex items-center justify-center gap-1 animate-fade-in">
                              <button
                                onClick={() => {
                                  onDeleteAdvance(adv.id);
                                  setDeletingAdvanceId(null);
                                }}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeletingAdvanceId(null)}
                                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-medium cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingAdvanceId(adv.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-50 transition cursor-pointer"
                              title="Delete advance entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      )}

      {/* RENDER TAB 3: PAYERS DIRECTORY */}
      {activeSubTab === 'payers' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-1.5">
                <Users className="w-5 h-5 text-slate-700" />
                {editingPayer ? 'Edit Payer / Accepting Officer' : 'Manage Payers / Accepting Officers Directory'}
              </h3>
              <p className="text-slate-400 text-xs">
                {editingPayer 
                  ? `Editing details for "${editingPayer.name}". Changes will update across all linked cash advance records.`
                  : 'Configure names of managers, sub-contractors, or supervisors who distribute cash advances. Once added, you can tag each advance to know exactly who paid it.'}
              </p>
            </div>

            <form onSubmit={handleAddPayerSubmit} className="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1 col-span-1 md:col-span-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Payer Name *</label>
                <input
                  type="text"
                  required
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  placeholder="e.g. Sudip Kumar Banerjee"
                  className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Designation / Role</label>
                <input
                  type="text"
                  value={payerRole}
                  onChange={(e) => setPayerRole(e.target.value)}
                  placeholder="e.g. Site Supervisor / AE"
                  className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Phone / Contact</label>
                <input
                  type="text"
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value)}
                  placeholder="e.g. 03804-222333"
                  className="w-full border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="col-span-1 md:col-span-4 flex justify-end gap-2 pt-1">
                {editingPayer && (
                  <button
                    type="button"
                    onClick={handleCancelPayerEdit}
                    className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer hover:bg-slate-200 transition"
                  >
                    Cancel Edit
                  </button>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 bg-slate-950 text-white rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer hover:bg-slate-800 transition"
                >
                  {editingPayer ? (
                    <>
                      <Pencil className="w-3.5 h-3.5" />
                      Update Person
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      Add Person to Directory
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-50 border-b border-slate-100 py-3 px-4">
              <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider">
                Current Registered Payers ({payers.length})
              </h4>
            </div>

            {payers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic text-xs">
                No custom payers added yet. (Add people using the form above to track who distributes cash advances).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 uppercase text-[9px] font-bold">
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Role / Title</th>
                      <th className="py-2.5 px-4">Contact</th>
                      <th className="py-2.5 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    {payers.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{p.name}</td>
                        <td className="py-2.5 px-4">
                          {p.role ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                              {p.role}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono">{p.phone || '-'}</td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditPayerClick(p)}
                              className="text-slate-400 hover:text-indigo-600 p-1 rounded hover:bg-slate-50 transition cursor-pointer"
                              title="Edit payer details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {['p-sudip', 'p-vijay', 'p-supervisor', 'p-cashier'].includes(p.id) ? (
                              <span className="text-[10px] text-slate-400 italic">System Default</span>
                            ) : deletingPayerId === p.id ? (
                              <div className="flex items-center gap-1 animate-fade-in">
                                <button
                                  onClick={() => {
                                    onDeletePayer(p.id);
                                    setDeletingPayerId(null);
                                  }}
                                  className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeletingPayerId(null)}
                                  className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-medium cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeletingPayerId(p.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-slate-50 transition cursor-pointer"
                                title="Delete payer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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

      {/* SUCCESS CONFIRMATION DIALOGUE */}
      {showSavedDialog && savedSummaryData && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setShowSavedDialog(false)} 
          />

          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 sm:mx-0">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg font-bold leading-6 text-slate-950">
                      Attendance Saved Successfully!
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Daily records for <strong className="text-slate-700">{savedSummaryData.date}</strong> have been recorded in the database.
                    </p>

                    <div className="mt-4 border border-slate-100 rounded-lg overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-100">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50 text-[10px] uppercase font-semibold text-slate-500">
                          <tr>
                            <th className="py-2 px-3">Labour Name</th>
                            <th className="py-2 px-3 text-center">Status</th>
                            <th className="py-2 px-3 text-right">Advance Given</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {savedSummaryData.records.map((rec, index) => (
                            <tr key={index} className="hover:bg-slate-50/40">
                              <td className="py-2 px-3 font-medium text-slate-800">{rec.name}</td>
                              <td className="py-2 px-3 text-center">
                                {rec.status === 'present' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">🟢 Present</span>}
                                {rec.status === 'half_day' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">🟡 Half-Day</span>}
                                {rec.status === 'absent' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">🔴 Absent</span>}
                                {rec.status === 'rest' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">☕ Rest Day</span>}
                                {rec.status === 'home' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">🏠 Went Home</span>}
                                {rec.status === 'pending' && <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">⚪ Pending</span>}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-semibold text-slate-700">
                                {rec.advance > 0 ? `₹${rec.advance}` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSavedDialog(false)}
                  className="inline-flex w-full justify-center rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-sm font-semibold shadow-xs sm:ml-3 sm:w-auto transition cursor-pointer"
                >
                  Close &amp; Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ERROR FEEDBACK DIALOGUE */}
      {showErrorDialog && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setShowErrorDialog(false)} 
          />

          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 sm:mx-0">
                    <XCircle className="h-6 w-6" />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg font-bold leading-6 text-slate-950">
                      Error Saving Entries!
                    </h3>
                    <div className="mt-2 text-sm text-slate-500 whitespace-pre-line leading-relaxed">
                      {errorDialogMsg}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowErrorDialog(false)}
                  className="inline-flex w-full justify-center rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-semibold shadow-xs sm:ml-3 sm:w-auto transition cursor-pointer"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

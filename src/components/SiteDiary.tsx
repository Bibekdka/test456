/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project, SiteDiaryEntry, Attendance } from '../types';
import { generateId } from '../utils/id';
import { BookOpen, Plus, Search, Calendar, User, HardHat, FileText, Trash2, ShieldCheck, HelpCircle, ClipboardCheck, Printer, X, Pencil } from 'lucide-react';

interface SiteDiaryProps {
  activeProject: Project | null;
  siteDiaries: SiteDiaryEntry[];
  attendanceRecords: Attendance[];
  onAddSiteDiary: (diary: SiteDiaryEntry) => void;
  onUpdateSiteDiary: (diary: SiteDiaryEntry) => void;
  onDeleteSiteDiary: (id: string) => void;
}

export default function SiteDiary({
  activeProject,
  siteDiaries,
  attendanceRecords,
  onAddSiteDiary,
  onUpdateSiteDiary,
  onDeleteSiteDiary,
}: SiteDiaryProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [printDiary, setPrintDiary] = useState<SiteDiaryEntry | null>(null);
  const [editingDiary, setEditingDiary] = useState<SiteDiaryEntry | null>(null);
  const [deletingDiaryId, setDeletingDiaryId] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [supervisorName, setSupervisorName] = useState('Site Supervisor');
  const [workDone, setWorkDone] = useState('');
  const [manpowerCount, setManpowerCount] = useState('');
  const [safetyLog, setSafetyLog] = useState('');
  const [remarks, setRemarks] = useState('');

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-slate-500">
          <BookOpen className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-700">No Construction Site Selected</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Please select or create an active project site in the <strong>Projects</strong> tab to access daily site diaries.
        </p>
      </div>
    );
  }

  // Filter logs for the selected project
  const projectDiaries = siteDiaries
    .filter(d => d.projectId === activeProject.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Smart Attendance Lookup for Selected Form Date
  const attendanceForSelectedDate = attendanceRecords.filter(
    r => r.projectId === activeProject.id && r.date === date
  );
  
  const presentWorkersCount = attendanceForSelectedDate.filter(r => r.status === 'present').length;
  const halfDayWorkersCount = attendanceForSelectedDate.filter(r => r.status === 'half_day').length;
  const computedManpower = presentWorkersCount + (halfDayWorkersCount * 0.5);

  const handleApplyComputedManpower = () => {
    setManpowerCount(Math.ceil(computedManpower).toString());
  };

  const handleEditClick = (diary: SiteDiaryEntry) => {
    setEditingDiary(diary);
    setDate(diary.date);
    setSupervisorName(diary.supervisorName);
    setWorkDone(diary.workDone);
    setManpowerCount(diary.manpowerCount !== undefined ? diary.manpowerCount.toString() : '');
    setSafetyLog(diary.safetyLog || '');
    setRemarks(diary.remarks || '');
    setShowAddForm(true);
    document.getElementById('site-diary-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workDone) return;

    if (editingDiary) {
      const updatedDiary: SiteDiaryEntry = {
        ...editingDiary,
        date,
        supervisorName: supervisorName || 'Site Supervisor',
        workDone,
        manpowerCount: manpowerCount ? Number(manpowerCount) : undefined,
        safetyLog: safetyLog || undefined,
        remarks: remarks || undefined,
      };
      onUpdateSiteDiary(updatedDiary);
    } else {
      const newDiary: SiteDiaryEntry = {
        id: generateId('diary'),
        projectId: activeProject.id,
        date,
        supervisorName: supervisorName || 'Site Supervisor',
        workDone,
        manpowerCount: manpowerCount ? Number(manpowerCount) : undefined,
        safetyLog: safetyLog || undefined,
        remarks: remarks || undefined,
      };
      onAddSiteDiary(newDiary);
    }

    setShowAddForm(false);
    resetForm();
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setSupervisorName('Site Supervisor');
    setWorkDone('');
    setManpowerCount('');
    setSafetyLog('');
    setRemarks('');
    setEditingDiary(null);
  };

  // Search filter
  const filteredDiaries = projectDiaries.filter(d => {
    const query = searchQuery.toLowerCase();
    return (
      d.date.includes(query) ||
      d.supervisorName.toLowerCase().includes(query) ||
      d.workDone.toLowerCase().includes(query) ||
      (d.safetyLog && d.safetyLog.toLowerCase().includes(query)) ||
      (d.remarks && d.remarks.toLowerCase().includes(query))
    );
  });

  // Calculate high-level stats
  const totalLogs = projectDiaries.length;
  const avgManpower = totalLogs > 0
    ? Math.round(projectDiaries.reduce((sum, d) => sum + (d.manpowerCount || 0), 0) / projectDiaries.filter(d => d.manpowerCount !== undefined).length || 0)
    : 0;
  const safetyCount = projectDiaries.filter(d => d.safetyLog && d.safetyLog.length > 5).length;

  return (
    <div id="site-diary-section" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Site Diaries & Supervisor Logs</h2>
          <p className="text-slate-500 text-sm">
            Site: <strong className="text-slate-700">{activeProject.name}</strong> • Legal progress record, supervisor audits, manpower reports, and safety compliance.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Close Entry Form' : 'Add Daily Site Entry'}
        </button>
      </div>

      {/* Analytics Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-lg">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Total Daily Logs</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{totalLogs} Days</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-lg">
            <User className="w-5 h-5" />
          </div>
          <div>
            <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Average Daily Labour</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{avgManpower || 'No records'} workers</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider">Safety Sign-offs Logged</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{safetyCount} Sessions</p>
          </div>
        </div>
      </div>

      {/* Log Entry Form */}
      {showAddForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">
            {editingDiary ? 'Edit Site Diary Entry' : 'Record Site Diary Progress'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700 bg-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Supervisor / Site Engineer</label>
              <input
                type="text"
                value={supervisorName}
                onChange={(e) => setSupervisorName(e.target.value)}
                placeholder="Name of inspector"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            <div className="space-y-1.5 relative">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Manpower Count</label>
                {attendanceForSelectedDate.length > 0 && (
                  <button
                    type="button"
                    onClick={handleApplyComputedManpower}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                    title={`Fill today's computed registry attendance of ${Math.ceil(computedManpower)} workers`}
                  >
                    Use attendance ({Math.ceil(computedManpower)})
                  </button>
                )}
              </div>
              <input
                type="number"
                value={manpowerCount}
                onChange={(e) => setManpowerCount(e.target.value)}
                placeholder="Total workers present"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
              />
              {attendanceForSelectedDate.length > 0 && !manpowerCount && (
                <p className="text-[10px] text-indigo-600 mt-1 font-mono">
                  💡 Today's registry attendance counts {Math.ceil(computedManpower)} active headcounts.
                </p>
              )}
            </div>

            <div className="space-y-1.5 md:col-span-3">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Work Progress & Concrete Castings Done</label>
              <textarea
                rows={3}
                value={workDone}
                onChange={(e) => setWorkDone(e.target.value)}
                placeholder="Describe exact jobs accomplished, e.g., '1st floor column casting completed using PPC Cement bags, plastering of exterior brick wall under progress...'"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Safety Sign-offs & Compliance Logs</label>
              <input
                type="text"
                value={safetyLog}
                onChange={(e) => setSafetyLog(e.target.value)}
                placeholder="e.g. Safety briefing completed; helmets, harnesses, and boot wear verified."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Delay / Obstacle Remarks</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Minor waterlogging in basement area resolved using pump."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="col-span-1 md:col-span-3 pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); resetForm(); }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium cursor-pointer"
              >
                {editingDiary ? 'Update Site Log' : 'Save Site Log'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Diary Search & Filtering */}
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search diaries by supervisor, work description, safety logs, dates..."
          className="w-full bg-transparent text-sm focus:outline-none text-slate-700 placeholder-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Diary Cards Listing */}
      {filteredDiaries.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center space-y-4">
          <FileText className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <h3 className="font-semibold text-slate-700">No Logs Matching Search</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">
              {projectDiaries.length === 0 
                ? 'Create a supervisor progress book to keep a rigorous audit history of work, safety protocols, and daily man-hours.'
                : 'Try clearing your query or search something else.'}
            </p>
          </div>
          {projectDiaries.length === 0 && (
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Start Site Log
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDiaries.map((diary) => (
            <div
              key={diary.id}
              className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-5 hover:shadow-xs transition space-y-4"
            >
              {/* Card Title Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="bg-slate-900 text-white p-2 rounded-lg shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-md font-mono">{diary.date}</h4>
                    <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                      <User className="w-3 h-3" /> Logged by: <strong className="text-slate-600 font-medium">{diary.supervisorName}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => setPrintDiary(diary)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition"
                    title="Print and view official proforma voucher"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Report</span>
                  </button>

                  <button
                    onClick={() => handleEditClick(diary)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                    title="Edit log entry"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  {deletingDiaryId === diary.id ? (
                    <div className="flex items-center gap-1.5 animate-fade-in">
                      <button
                        onClick={() => {
                          onDeleteSiteDiary(diary.id);
                          setDeletingDiaryId(null);
                        }}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-bold cursor-pointer transition shadow-xs"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeletingDiaryId(null)}
                        className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-medium cursor-pointer transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingDiaryId(diary.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      title="Delete log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                {/* Work description */}
                <div className="md:col-span-3 space-y-2">
                  <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Accomplished Work & Progress</p>
                  <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line bg-slate-50 p-3 rounded-lg border border-slate-100 font-sans">
                    {diary.workDone}
                  </p>
                </div>

                {/* Left/Right sidebar metrics inside card */}
                <div className="space-y-3 bg-slate-50/50 rounded-lg p-3 border border-slate-100/50">
                  {diary.manpowerCount !== undefined && (
                    <div className="space-y-1">
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <HardHat className="w-3 h-3 text-slate-400" /> Manpower Count
                      </p>
                      <p className="font-semibold text-slate-800 text-xs">
                        {diary.manpowerCount} workers active
                      </p>
                    </div>
                  )}

                  {diary.safetyLog && (
                    <div className="space-y-1">
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1 text-emerald-600">
                        <ShieldCheck className="w-3 h-3 text-emerald-500" /> Safety Protocols
                      </p>
                      <p className="text-slate-600 leading-relaxed text-[11px] truncate" title={diary.safetyLog}>
                        {diary.safetyLog}
                      </p>
                    </div>
                  )}

                  {diary.remarks && (
                    <div className="space-y-1">
                      <p className="text-slate-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <HelpCircle className="w-3 h-3 text-indigo-400" /> Remarks
                      </p>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        {diary.remarks}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Official Notebook Print Preview Modal */}
      {printDiary && (
        <div className="fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-slate-600" /> Log Proforma Print Preview
              </h3>
              <button
                onClick={() => setPrintDiary(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 bg-amber-50/10 font-sans" id="printable-proforma-area">
              {/* Paper Voucher */}
              <div className="border-4 double border-slate-900 p-6 bg-white space-y-6 relative shadow-sm">
                <div className="text-center space-y-1 border-b-2 border-slate-900 pb-4">
                  <h2 className="text-xl font-bold uppercase tracking-wider text-slate-900">MILITARY ENGINEER SERVICES</h2>
                  <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">SITE DIARY & FIELD SUPERVISOR LOG</p>
                  <p className="text-[10px] text-slate-400 font-mono">Job ID Reference: {activeProject.id}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs border-b border-slate-200 pb-4">
                  <div className="space-y-1.5">
                    <p><strong className="text-slate-500">CONSTRUCTION SITE:</strong> <span className="text-slate-900 font-semibold">{activeProject.name}</span></p>
                    <p><strong className="text-slate-500">SUPERVISOR IN-CHARGE:</strong> <span className="text-slate-900 font-semibold uppercase">{printDiary.supervisorName}</span></p>
                  </div>
                  <div className="space-y-1.5 text-right font-mono">
                    <p><strong className="text-slate-500">DIARY LOG DATE:</strong> <span className="text-slate-900 font-bold text-sm bg-slate-100 px-2 py-0.5 rounded">{printDiary.date}</span></p>
                    <p><strong className="text-slate-500">TOTAL HEADCOUNT:</strong> <span className="text-slate-900 font-semibold">{printDiary.manpowerCount || 'N/A'} workers present</span></p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-2 border-slate-900 pl-2">I. Detailed Progress of Accomplished Work</h4>
                  <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line pl-2 bg-slate-50 p-3 rounded border border-slate-200">
                    {printDiary.workDone}
                  </p>
                </div>

                {printDiary.safetyLog && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-2 border-slate-900 pl-2 text-emerald-700">II. Safety Compliance Audits</h4>
                    <p className="text-slate-700 text-xs leading-relaxed pl-2 whitespace-pre-line bg-emerald-50/30 p-2.5 rounded border border-emerald-100">
                      {printDiary.safetyLog}
                    </p>
                  </div>
                )}

                {printDiary.remarks && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-l-2 border-slate-900 pl-2">III. Remarks, Constraints, or Delays</h4>
                    <p className="text-slate-700 text-xs leading-relaxed pl-2 bg-slate-50 p-2.5 rounded border border-slate-100">
                      {printDiary.remarks}
                    </p>
                  </div>
                )}

                {/* Sign-offs layout */}
                <div className="grid grid-cols-2 gap-12 pt-16 text-center text-xs">
                  <div className="border-t border-dashed border-slate-400 pt-2 space-y-1">
                    <p className="font-semibold uppercase text-slate-800">{printDiary.supervisorName}</p>
                    <p className="text-slate-400 text-[10px] uppercase">Supervisor Signature</p>
                  </div>
                  <div className="border-t border-dashed border-slate-400 pt-2 space-y-1">
                    <p className="font-semibold uppercase text-slate-300">________________________</p>
                    <p className="text-slate-400 text-[10px] uppercase">Accepting Officer / Engineer In-charge</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0 gap-3">
              <button
                onClick={() => setPrintDiary(null)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium cursor-pointer flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print Document
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

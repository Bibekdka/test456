/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Labour } from '../types';
import { Users, UserPlus, Phone, IndianRupee, Calendar, Trash2, Edit, UserX, UserCheck, Archive } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface LabourManagerProps {
  labours: Labour[];
  onAddLabour: (labour: Labour) => void;
  onUpdateLabour: (labour: Labour) => void;
  onDeleteLabour: (id: string) => void;
}

export default function LabourManager({
  labours,
  onAddLabour,
  onUpdateLabour,
  onDeleteLabour,
}: LabourManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLabour, setEditingLabour] = useState<Labour | null>(null);
  const [labourToDelete, setLabourToDelete] = useState<Labour | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [perDayWage, setPerDayWage] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<'active' | 'left'>('active');
  const [leftDate, setLeftDate] = useState('');
  const [joinedDate, setJoinedDate] = useState('');

  // Tab State: active vs left
  const [activeTab, setActiveTab] = useState<'active' | 'left'>('active');

  const openAddForm = () => {
    setName('');
    setPerDayWage('');
    setContact('');
    setStatus('active');
    setLeftDate('');
    setJoinedDate(new Date().toISOString().split('T')[0]);
    setEditingLabour(null);
    setShowAddForm(true);
  };

  const openEditForm = (l: Labour) => {
    setEditingLabour(l);
    setName(l.name);
    setPerDayWage(l.perDayWage.toString());
    setContact(l.contact);
    setStatus(l.status);
    setLeftDate(l.leftDate || '');
    setJoinedDate(l.joinedDate || new Date().toISOString().split('T')[0]);
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !perDayWage) return;

    const wage = Number(perDayWage);
    if (isNaN(wage) || wage <= 0) return;

    const labourData: Labour = {
      id: editingLabour ? editingLabour.id : 'l_' + Math.random().toString(36).substr(2, 9),
      name,
      perDayWage: wage,
      contact: contact || 'N/A',
      status,
      leftDate: status === 'left' ? (leftDate || new Date().toISOString().split('T')[0]) : undefined,
      joinedDate: joinedDate || undefined,
    };

    if (editingLabour) {
      onUpdateLabour(labourData);
    } else {
      onAddLabour(labourData);
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
  };

  const filteredLabours = labours.filter(l => l.status === activeTab);

  return (
    <div id="labour-manager-section" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Labour Directory</h2>
          <p className="text-slate-500 text-sm">Register workers, manage standard daily wages, and archive labourers who leave the project.</p>
        </div>
        <button
          id="btn-add-labour"
          onClick={openAddForm}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer shadow-sm hover:shadow"
        >
          <UserPlus className="w-4 h-4" />
          Register New Worker
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-semibold text-slate-800">
              {editingLabour ? 'Edit Worker Profile' : 'Register New Worker'}
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Worker Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Per Day Wage (Rs.)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">₹</span>
                <input
                  type="number"
                  value={perDayWage}
                  onChange={(e) => setPerDayWage(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Contact / Phone Number</label>
              <input
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Date of Joining</label>
              <input
                type="date"
                value={joinedDate}
                onChange={(e) => setJoinedDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Work Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="active">Active (Currently working)</option>
                <option value="left">Left Work / Archived</option>
              </select>
            </div>

            {status === 'left' && (
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Date of Leaving Work</label>
                <input
                  type="date"
                  value={leftDate}
                  onChange={(e) => setLeftDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required={status === 'left'}
                />
              </div>
            )}

            <div className="md:col-span-2 pt-2 flex justify-end">
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium cursor-pointer"
              >
                {editingLabour ? 'Save Changes' : 'Register Worker'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 cursor-pointer transition ${
            activeTab === 'active'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Active Team ({labours.filter(l => l.status === 'active').length})
        </button>
        <button
          onClick={() => setActiveTab('left')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 cursor-pointer transition ${
            activeTab === 'left'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Left Work / Archived ({labours.filter(l => l.status === 'left').length})
        </button>
      </div>

      {filteredLabours.length === 0 ? (
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
          {filteredLabours.map((l) => (
            <div
              key={l.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between hover:shadow-sm transition"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-slate-800 text-base">{l.name}</h3>
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
                    <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Standard Wage</p>
                    <p className="font-semibold text-slate-700 font-mono text-sm mt-0.5">₹{l.perDayWage}/day</p>
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
          ))}
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

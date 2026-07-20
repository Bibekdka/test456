/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project } from '../types';
import { Briefcase, Plus, Calendar, IndianRupee, Clock, Trash2, Edit, CheckCircle2, AlertTriangle, PlayCircle, ToggleLeft, MapPin } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface ProjectManagerProps {
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onAddProject: (project: Project) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
}

export default function ProjectManager({
  projects,
  activeProjectId,
  onSelectProject,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
}: ProjectManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'on_hold'>('active');

  const openAddForm = () => {
    setName('');
    setDescription('');
    setLocation('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setTargetDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); // Default 90 days
    setBudget('');
    setStatus('active');
    setEditingProject(null);
    setShowAddForm(true);
  };

  const openEditForm = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(p);
    setName(p.name);
    setDescription(p.description);
    setLocation(p.location || '');
    setStartDate(p.startDate);
    setTargetDate(p.targetDate);
    setBudget(p.budget.toString());
    setStatus(p.status);
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !targetDate) return;

    const projectData: Project = {
      id: editingProject ? editingProject.id : 'p_' + Math.random().toString(36).substr(2, 9),
      name,
      description,
      location: location.trim() || undefined,
      startDate,
      targetDate,
      budget: Number(budget) || 0,
      status,
    };

    if (editingProject) {
      onUpdateProject(projectData);
    } else {
      onAddProject(projectData);
    }

    setShowAddForm(false);
    setEditingProject(null);
  };

  const getDaysLeft = (targetDateStr: string, startDateStr: string, statusStr: string) => {
    if (statusStr === 'completed') return { days: 0, text: 'Completed', color: 'text-green-600 bg-green-50 border-green-200' };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDateStr);
    target.setHours(0, 0, 0, 0);
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { days: diffDays, text: `Overdue by ${Math.abs(diffDays)} days`, color: 'text-rose-600 bg-rose-50 border-rose-200 animate-pulse' };
    } else if (diffDays === 0) {
      return { days: 0, text: 'Deadline Today', color: 'text-amber-600 bg-amber-50 border-amber-200 font-bold' };
    } else {
      return { days: diffDays, text: `${diffDays} days left`, color: 'text-blue-600 bg-blue-50 border-blue-200' };
    }
  };

  return (
    <div id="project-manager-section" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Projects & Work Sites</h2>
          <p className="text-slate-500 text-sm">Select and manage your active construction sites and track completion timelines.</p>
        </div>
        <button
          id="btn-add-project"
          onClick={openAddForm}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer shadow-sm hover:shadow"
        >
          <Plus className="w-4 h-4" />
          Add New Site
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h3 className="font-semibold text-slate-800">
              {editingProject ? 'Edit Construction Site' : 'Add Construction Site'}
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Site / Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Skyline Heights Villa"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Site Location (City / Town)</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Guwahati, Assam (Used for auto-fetching weather)"
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Ground floor slabs, masonry, plumbing, electrical installations..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 h-16"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Budget (Rs.)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">₹</span>
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="active">Active Work</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Target Completion Date</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            <div className="md:col-span-2 pt-2 flex justify-end">
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium cursor-pointer"
              >
                {editingProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-10 text-center space-y-4">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <h3 className="font-semibold text-slate-700">No Construction Sites</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">Setup your first project or construction site to start calculating attendance, wages, advances, and materials.</p>
          </div>
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Construction Site
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((p) => {
            const isActive = p.id === activeProjectId;
            const timeline = getDaysLeft(p.targetDate, p.startDate, p.status);

            return (
              <div
                key={p.id}
                id={`project-card-${p.id}`}
                onClick={() => onSelectProject(p.id)}
                className={`relative bg-white border rounded-xl p-5 cursor-pointer transition flex flex-col justify-between hover:shadow-md ${
                  isActive
                    ? 'border-slate-900 ring-2 ring-slate-900/5'
                    : 'border-slate-200'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          p.status === 'active' ? 'bg-emerald-500' : p.status === 'completed' ? 'bg-blue-500' : 'bg-amber-500'
                        }`} />
                        <h3 className="font-semibold text-slate-800 text-base group-hover:text-slate-900">{p.name}</h3>
                      </div>
                      <p className="text-slate-500 text-xs mt-1 line-clamp-2 leading-relaxed">{p.description || 'No description provided.'}</p>
                      {p.location && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium mt-1.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{p.location}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => openEditForm(p, e)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-50 transition cursor-pointer"
                        title="Edit Project"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProjectToDelete(p);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                        title="Delete Project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center gap-2">
                      <IndianRupee className="w-4 h-4 text-slate-500" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Budget</p>
                        <p className="font-mono text-sm font-semibold text-slate-700">₹{p.budget.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className={`border rounded-lg p-2 flex items-center gap-2 ${timeline.color}`}>
                      <Clock className="w-4 h-4" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-semibold opacity-70">Timeline</p>
                        <p className="text-sm font-semibold truncate">{timeline.text}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {p.startDate} to {p.targetDate}
                  </span>

                  {isActive ? (
                    <span className="bg-slate-900 text-white px-2 py-1 rounded font-medium text-[10px] uppercase tracking-wider">
                      Selected Site
                    </span>
                  ) : (
                    <span className="text-slate-400 font-medium hover:text-slate-700 flex items-center gap-1">
                      <PlayCircle className="w-3.5 h-3.5" /> Select Site
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={projectToDelete !== null}
        onClose={() => setProjectToDelete(null)}
        onConfirm={() => {
          if (projectToDelete) {
            onDeleteProject(projectToDelete.id);
            setProjectToDelete(null);
          }
        }}
        title="Delete Construction Site?"
        message={`Are you sure you want to delete "${projectToDelete?.name}" permanently?\n\nThis will permanently delete all associated material inventory sheets, daily attendance logs, wage payouts, food logs, site diaries, and downtime records recorded on this site! This operation cannot be undone.`}
        confirmText="Yes, Delete Permanently"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

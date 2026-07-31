/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project, Labour, Attendance, Material, FoodLog, DailyExpense, ProjectDocument, getAttendanceFoodDaysAndCost, getProjectScopeIds } from '../types';
import { generateId } from '../utils/id';
import { putDocumentBlob, getDocumentBlob, deleteDocumentBlob } from '../db';
import { 
  Briefcase, Plus, Calendar, IndianRupee, Clock, Trash2, Edit, 
  CheckCircle2, AlertTriangle, PlayCircle, MapPin, 
  TrendingUp, Layers, FileText, Upload, Download, Sparkles, Eye, 
  FileCheck, Search, Paperclip, ShieldAlert, Lightbulb, Bot, 
  Send, X, FileSpreadsheet, FileImage, FolderKanban, Loader2, RefreshCw
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface ProjectManagerProps {
  projects: Project[];
  labours?: Labour[];
  attendanceRecords?: Attendance[];
  materials?: Material[];
  foodLogs?: FoodLog[];
  dailyExpenses?: DailyExpense[];
  foodCalculationStartDate?: string;
  activeProjectId: string | null;
  projectDocuments?: ProjectDocument[];
  onSelectProject: (id: string) => void;
  onAddProject: (project: Project) => void;
  onUpdateProject: (project: Project) => void;
  onDeleteProject: (id: string) => void;
  onAddDocument?: (doc: ProjectDocument) => void;
  onUpdateDocument?: (doc: ProjectDocument) => void;
  onDeleteDocument?: (id: string) => void;
}

export default function ProjectManager({
  projects,
  labours = [],
  attendanceRecords = [],
  materials = [],
  foodLogs = [],
  dailyExpenses = [],
  foodCalculationStartDate = '',
  activeProjectId,
  projectDocuments = [],
  onSelectProject,
  onAddProject,
  onUpdateProject,
  onDeleteProject,
  onAddDocument,
  onUpdateDocument,
  onDeleteDocument,
}: ProjectManagerProps) {
  // Main Sub-Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'documents'>('overview');

  // Project Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState<'active' | 'completed' | 'on_hold'>('active');
  const [parentProjectId, setParentProjectId] = useState<string>('');

  // Document Storage State
  const [docCategoryFilter, setDocCategoryFilter] = useState<'all' | 'contract' | 'site_plan' | 'approval' | 'estimate' | 'invoice' | 'other'>('all');
  const [docProjectFilter, setDocProjectFilter] = useState<string>('active');
  const [docSearchQuery, setDocSearchQuery] = useState<string>('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<ProjectDocument | null>(null);
  const [previewDocument, setPreviewDocument] = useState<ProjectDocument | null>(null);

  // Document Form State
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState<ProjectDocument['category']>('contract');
  const [docProjectId, setDocProjectId] = useState<string>(activeProjectId || (projects[0]?.id || ''));
  const [docNotes, setDocNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState('');
  const [fileTypeExt, setFileTypeExt] = useState('pdf');
  const [fileSizeByte, setFileSizeByte] = useState(0);
  const [fileNameOrig, setFileNameOrig] = useState('');

  // AI Document Analysis Modal State
  const [aiModalDoc, setAiModalDoc] = useState<ProjectDocument | null>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [customQuestion, setCustomQuestion] = useState<string>('');

  // Helper function to calculate total amount spent for a project
  const getProjectSpent = (project: Project): number => {
    const scopeIds = new Set(getProjectScopeIds(project.id, projects));
    
    const pAttendance = attendanceRecords.filter(a => scopeIds.has(a.projectId));
    const pMaterials = materials.filter(m => scopeIds.has(m.projectId));
    const pFoodLogs = foodLogs.filter(f => scopeIds.has(f.projectId));
    const pExpenses = dailyExpenses.filter(e => scopeIds.has(e.projectId));

    // Labour wages
    let labourWages = 0;
    pAttendance.forEach((att) => {
      const labour = labours.find(l => l.id === att.labourId);
      if (labour) {
        if (att.status === 'present') {
          labourWages += labour.perDayWage;
        } else if (att.status === 'half_day') {
          labourWages += labour.perDayWage / 2;
        }
      }
    });

    const materialCost = pMaterials.reduce((sum, m) => sum + m.cost, 0);

    const visitorFoodLogs = pFoodLogs.filter(f => f.labourId === 'visitor' || f.labourId.startsWith('visitor'));
    const visitorFoodCost = visitorFoodLogs.reduce((sum, f) => sum + (f.mealsCount * f.cost), 0);

    const pLabourIds = new Set(pAttendance.map(a => a.labourId));
    const projectLabours = labours.filter(l => pLabourIds.has(l.id) || l.status === 'active');

    let autoFoodCost = 0;
    Array.from(scopeIds).forEach(scId => {
      const scProj = projects.find(p => p.id === scId) || project;
      autoFoodCost += projectLabours.reduce((sum, l) => {
        const { cost } = getAttendanceFoodDaysAndCost(
          l,
          attendanceRecords,
          scId,
          foodCalculationStartDate,
          scProj.startDate
        );
        return sum + cost;
      }, 0);
    });

    const foodCost = autoFoodCost + visitorFoodCost;
    const dailyExpensesCost = pExpenses.reduce((sum, e) => sum + e.amount, 0);

    return labourWages + materialCost + foodCost + dailyExpensesCost;
  };

  const openAddForm = () => {
    setName('');
    setDescription('');
    setLocation('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setTargetDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setBudget('');
    setStatus('active');
    setParentProjectId('');
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
    setParentProjectId(p.parentProjectId || '');
    setShowAddForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !startDate || !targetDate) return;

    const projectData: Project = {
      id: editingProject ? editingProject.id : generateId('p'),
      name,
      description,
      location: location.trim() || undefined,
      startDate,
      targetDate,
      budget: Number(budget) || 0,
      status,
      parentProjectId: parentProjectId || undefined,
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

  // --- Document Storage Handlers ---
  const openUploadModal = () => {
    setDocName('');
    setDocCategory('contract');
    setDocProjectId(activeProjectId || (projects[0]?.id || ''));
    setDocNotes('');
    setSelectedFile(null);
    setFileDataUrl('');
    setFileTypeExt('pdf');
    setFileSizeByte(0);
    setFileNameOrig('');
    setShowUploadModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setFileNameOrig(file.name);
    setFileSizeByte(file.size);

    const ext = file.name.split('.').pop()?.toLowerCase() || 'file';
    setFileTypeExt(ext);

    if (!docName) {
      const baseTitle = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      setDocName(baseTitle);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDocumentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName || !docProjectId || !onAddDocument) return;

    const docId = generateId('doc');
    if (fileDataUrl) {
      await putDocumentBlob(docId, fileDataUrl);
    }

    const newDoc: ProjectDocument = {
      id: docId,
      projectId: docProjectId,
      name: docName.trim(),
      category: docCategory,
      fileType: fileTypeExt,
      fileName: fileNameOrig || `${docName.toLowerCase().replace(/\s+/g, '_')}.${fileTypeExt}`,
      fileSize: fileSizeByte || 1024 * 50,
      dataUrl: undefined, // Lazy Document Storage: Heavy base64 is stored in document_blobs object store
      notes: docNotes.trim() || undefined,
      uploadedAt: new Date().toISOString(),
    };

    onAddDocument(newDoc);
    setShowUploadModal(false);
  };

  // AI Analysis Request with Lazy Blob Resolution
  const runAiAnalysis = async (doc: ProjectDocument, questionText?: string) => {
    setAiModalDoc(doc);
    setIsAnalyzing(true);
    setAiError(null);

    if (!questionText && doc.aiSummary) {
      setAiInsights(doc.aiSummary);
    } else if (!questionText) {
      setAiInsights(null);
    }

    try {
      let fullDataUrl = doc.dataUrl;
      if (!fullDataUrl) {
        fullDataUrl = await getDocumentBlob(doc.id);
      }

      const project = projects.find(p => p.id === doc.projectId);
      const res = await fetch('/api/gemini/document-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentName: doc.name,
          category: doc.category,
          notes: doc.notes,
          fileType: doc.fileType,
          dataUrl: fullDataUrl,
          projectContext: project ? {
            name: project.name,
            budget: project.budget,
            targetDate: project.targetDate,
            location: project.location
          } : null,
          question: questionText || undefined
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate AI insights');
      }

      setAiInsights(data.insights);

      // Save insights to cached summary if first run
      if (!questionText && onUpdateDocument) {
        onUpdateDocument({
          ...doc,
          aiSummary: data.insights,
          updatedAt: Date.now()
        });
      }
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setAiError(err?.message || 'Failed to analyze document with AI engine.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadDoc = async (doc: ProjectDocument) => {
    let url = doc.dataUrl;
    if (!url) {
      url = await getDocumentBlob(doc.id);
    }
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName || doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      alert('Document file content unavailable.');
    }
  };

  const handleOpenPreviewModal = async (doc: ProjectDocument) => {
    let url = doc.dataUrl;
    if (!url) {
      url = await getDocumentBlob(doc.id);
    }
    setPreviewDocument({ ...doc, dataUrl: url });
  };

  // Document Filter Calculations
  const filteredDocuments = projectDocuments.filter(doc => {
    // 1. Site Filter
    if (docProjectFilter === 'active' && activeProjectId) {
      if (doc.projectId !== activeProjectId) return false;
    } else if (docProjectFilter !== 'all' && docProjectFilter !== 'active') {
      if (doc.projectId !== docProjectFilter) return false;
    }

    // 2. Category Filter
    if (docCategoryFilter !== 'all' && doc.category !== docCategoryFilter) {
      return false;
    }

    // 3. Search Query
    if (docSearchQuery.trim()) {
      const q = docSearchQuery.toLowerCase().trim();
      const matchName = doc.name.toLowerCase().includes(q);
      const matchFile = doc.fileName.toLowerCase().includes(q);
      const matchNotes = doc.notes?.toLowerCase().includes(q);
      return matchName || matchFile || matchNotes;
    }

    return true;
  });

  const getCategoryBadge = (cat: ProjectDocument['category']) => {
    switch (cat) {
      case 'contract':
        return <span className="bg-purple-100 text-purple-800 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">Contract</span>;
      case 'site_plan':
        return <span className="bg-blue-100 text-blue-800 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">Site Plan / Drawing</span>;
      case 'approval':
        return <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">NOC & Approval</span>;
      case 'estimate':
        return <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">BOQ / Estimate</span>;
      case 'invoice':
        return <span className="bg-cyan-100 text-cyan-800 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">Invoice / Bill</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">General Doc</span>;
    }
  };

  const getFileIcon = (fileType: string) => {
    const ext = fileType.toLowerCase();
    if (ext.includes('png') || ext.includes('jpg') || ext.includes('jpeg') || ext.includes('webp')) {
      return <FileImage className="w-5 h-5 text-indigo-500" />;
    } else if (ext.includes('xls') || ext.includes('csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    } else if (ext.includes('pdf')) {
      return <FileText className="w-5 h-5 text-rose-500" />;
    } else {
      return <FileCheck className="w-5 h-5 text-slate-600" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const topLevelProjects = projects.filter(p => !p.parentProjectId);
  const totalBudget = topLevelProjects.reduce((sum, p) => sum + p.budget, 0);
  const totalSpentAll = topLevelProjects.reduce((sum, p) => sum + getProjectSpent(p), 0);

  return (
    <div id="project-manager-section" className="space-y-6">
      {/* Header & Sub-Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-slate-700" />
            Projects & Document Vault
          </h2>
          <p className="text-slate-500 text-sm">Manage construction site details, expenditure budgets, and project file storage with AI Insights.</p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Work Sites Overview
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'documents'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Paperclip className="w-4 h-4" />
            Document Storage
            {projectDocuments.length > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {projectDocuments.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* OVERVIEW TAB CONTENT */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-slate-800">Active Construction Sites ({projects.length})</h3>
            <button
              id="btn-add-project"
              onClick={openAddForm}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add New Site
            </button>
          </div>

          {/* Top Summary Bar */}
          {projects.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">Total Work Sites</p>
                  <p className="text-lg font-bold text-slate-800">{projects.length} {projects.length === 1 ? 'Site' : 'Sites'}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 text-slate-700 rounded-lg shrink-0">
                  <IndianRupee className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">Total Combined Budget</p>
                  <p className="text-lg font-bold text-slate-800 font-mono truncate">₹{totalBudget.toLocaleString()}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg shrink-0 ${totalSpentAll > totalBudget && totalBudget > 0 ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">Total Amount Spent</p>
                  <p className="text-lg font-bold text-slate-800 font-mono truncate">
                    ₹{totalSpentAll.toLocaleString()}
                    {totalBudget > 0 && (
                      <span className={`text-xs font-normal ml-1.5 ${totalSpentAll > totalBudget ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                        ({Math.round((totalSpentAll / totalBudget) * 100)}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Project List Cards */}
          {projects.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Construction Sites Registered</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">Create your first construction work site to start managing attendance, worker payouts, materials, and attached document contracts.</p>
              <button
                onClick={openAddForm}
                className="inline-flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Create Site Now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => {
                const isActive = activeProjectId === p.id;
                const timeline = getDaysLeft(p.targetDate, p.startDate, p.status);
                const spent = getProjectSpent(p);
                const isParentSite = !p.parentProjectId;
                const parentProj = projects.find(parent => parent.id === p.parentProjectId);
                const childSubSites = projects.filter(child => child.parentProjectId === p.id);

                const siteDocsCount = projectDocuments.filter(d => d.projectId === p.id).length;

                return (
                  <div
                    key={p.id}
                    onClick={() => onSelectProject(p.id)}
                    className={`bg-white border rounded-2xl p-4 transition duration-200 flex flex-col justify-between cursor-pointer relative group ${
                      isActive
                        ? 'border-slate-900 ring-2 ring-slate-900/10 shadow-md'
                        : 'border-slate-200 hover:border-slate-300 hover:shadow'
                    }`}
                  >
                    <div>
                      {/* Card Top Row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-slate-900 text-base leading-tight">{p.name}</h3>
                            {isParentSite && childSubSites.length > 0 && (
                              <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-indigo-200 flex items-center gap-1">
                                <Layers className="w-3 h-3" />
                                {childSubSites.length} Sub-site{childSubSites.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {!isParentSite && (
                              <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                                <Layers className="w-3 h-3" />
                                Sub-site of {parentProj?.name || 'Main Site'}
                              </span>
                            )}
                          </div>
                          {p.location && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {p.location}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => openEditForm(p, e)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                            title="Edit Site Details"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectToDelete(p);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Site"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {p.description && (
                        <p className="text-xs text-slate-600 mb-3 line-clamp-2">{p.description}</p>
                      )}

                      {/* Financial & Timeline Metrics */}
                      <div className="grid grid-cols-2 gap-2 my-3">
                        <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Budget</p>
                          <p className="text-sm font-bold text-slate-800 font-mono">₹{p.budget.toLocaleString()}</p>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg">
                          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Spent</p>
                          <p className="text-sm font-bold text-slate-800 font-mono">₹{spent.toLocaleString()}</p>
                        </div>
                      </div>

                      {/* Documents counter pill */}
                      <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50/70 p-2 rounded-lg border border-slate-100">
                        <span className="flex items-center gap-1.5 text-slate-600">
                          <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                          Site Vault Documents:
                        </span>
                        <span className="font-bold text-slate-800">{siteDocsCount} files</span>
                      </div>
                    </div>

                    {/* Footer selection indicator */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {p.startDate} to {p.targetDate}
                      </span>

                      {isActive ? (
                        <span className="bg-slate-900 text-white px-2 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider">
                          Active Site
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
        </div>
      )}

      {/* DOCUMENT STORAGE TAB CONTENT */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          {/* Section Header & Upload CTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-indigo-600" />
                Project File & Document Storage
              </h3>
              <p className="text-xs text-slate-500">Attach blueprints, site plans, legal contracts, NOC approvals, and material invoices. Get AI recommendations on site documents.</p>
            </div>
            <button
              onClick={openUploadModal}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm shrink-0"
            >
              <Upload className="w-4 h-4" />
              Upload Project Document
            </button>
          </div>

          {/* Document Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Documents</p>
                <p className="text-base font-bold text-slate-800">{projectDocuments.length} files</p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Contracts & Plans</p>
                <p className="text-base font-bold text-slate-800">
                  {projectDocuments.filter(d => d.category === 'contract' || d.category === 'site_plan').length}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">AI Insights Cached</p>
                <p className="text-base font-bold text-slate-800">
                  {projectDocuments.filter(d => d.aiSummary).length}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3">
              <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Storage</p>
                <p className="text-base font-bold text-slate-800 font-mono">
                  {formatFileSize(projectDocuments.reduce((sum, d) => sum + (d.fileSize || 0), 0))}
                </p>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search documents by title, file name, or notes..."
                  value={docSearchQuery}
                  onChange={(e) => setDocSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Site Dropdown Filter */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600 shrink-0">Site Scope:</label>
                <select
                  value={docProjectFilter}
                  onChange={(e) => setDocProjectFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="all">All Sites Combined ({projectDocuments.length})</option>
                  {activeProjectId && (
                    <option value="active">Active Selected Site Only</option>
                  )}
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({projectDocuments.filter(d => d.projectId === p.id).length})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 text-xs">
              <span className="text-slate-400 font-medium text-[11px] mr-1 shrink-0">Category:</span>
              {[
                { key: 'all', label: 'All Files' },
                { key: 'contract', label: 'Contracts & Agreements' },
                { key: 'site_plan', label: 'Blueprints & Site Plans' },
                { key: 'approval', label: 'NOCs & Approvals' },
                { key: 'estimate', label: 'BOQ & Estimates' },
                { key: 'invoice', label: 'Invoices & Bills' },
                { key: 'other', label: 'Other Docs' },
              ].map(cat => (
                <button
                  key={cat.key}
                  onClick={() => setDocCategoryFilter(cat.key as any)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition shrink-0 cursor-pointer ${
                    docCategoryFilter === cat.key
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Document List View */}
          {filteredDocuments.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-3">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mx-auto">
                <Paperclip className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">No Documents Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">Upload important site agreements, blueprints, or bills to keep your project documents organized and ready for AI insights.</p>
              <button
                onClick={openUploadModal}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700"
              >
                <Upload className="w-4 h-4" />
                Upload First Document
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDocuments.map(doc => {
                const site = projects.find(p => p.id === doc.projectId);

                return (
                  <div
                    key={doc.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 transition duration-200 hover:border-slate-300 hover:shadow-md flex flex-col justify-between space-y-3"
                  >
                    <div>
                      {/* Top bar with category & site */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="space-y-1">
                          {getCategoryBadge(doc.category)}
                          <h4 className="font-bold text-slate-900 text-sm line-clamp-1 mt-1">{doc.name}</h4>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                            {getFileIcon(doc.fileType)}
                            <span className="truncate max-w-[180px]">{doc.fileName}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setDocumentToDelete(doc)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Site Tag */}
                      <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                        <span className="truncate font-medium text-slate-700">Site: {site?.name || 'Unassigned'}</span>
                        <span className="font-mono text-slate-400 shrink-0">{formatFileSize(doc.fileSize)}</span>
                      </div>

                      {/* Notes Preview */}
                      {doc.notes && (
                        <p className="text-xs text-slate-600 mt-2 bg-indigo-50/40 border border-indigo-100/60 p-2 rounded-lg line-clamp-2">
                          <span className="font-semibold text-indigo-900">Note: </span>
                          {doc.notes}
                        </p>
                      )}

                      {/* AI Insights Cached Badge */}
                      {doc.aiSummary && (
                        <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs text-emerald-800 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="truncate font-medium">AI Insights available for this document</span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => runAiAnalysis(doc)}
                        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Insights
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDownloadDoc(doc)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                          title="Download Attached File"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenPreviewModal(doc)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition inline-flex items-center gap-1 text-xs font-semibold cursor-pointer"
                          title="Preview Document Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* UPLOAD DOCUMENT MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                Upload Site Document
              </h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDocumentSubmit} className="space-y-4">
              {/* File Drag / Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select File (PDF, Image, Drawing, Document)</label>
                <input
                  type="file"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer border border-slate-200 rounded-xl p-2 bg-slate-50"
                  required
                />
              </div>

              {selectedFile && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
                  <p className="font-semibold text-slate-800">{selectedFile.name}</p>
                  <p className="text-slate-500 font-mono">Size: {formatFileSize(selectedFile.size)} | Type: {selectedFile.type || fileTypeExt}</p>
                </div>
              )}

              {/* Document Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Document Display Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Structural Blueprint v2 - Foundation Phase"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {/* Target Project Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Associated Construction Site *</label>
                <select
                  value={docProjectId}
                  onChange={(e) => setDocProjectId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Category Radio / Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="contract">Legal Contract / Agreement</option>
                  <option value="site_plan">Blueprint / Site Architectural Plan</option>
                  <option value="approval">NOC / Municipal Approval</option>
                  <option value="estimate">BOQ / Cost Estimate Sheet</option>
                  <option value="invoice">Supplier Invoice / Vendor Bill</option>
                  <option value="other">Other Document</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Attached Notes / Description</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Signed contract with steel supplier including price escalation clauses."
                  value={docNotes}
                  onChange={(e) => setDocNotes(e.target.value)}
                  className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
                >
                  Upload & Save Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI DOCUMENT INSIGHTS MODAL */}
      {aiModalDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">AI Site Planning Insights</h3>
                  <p className="text-xs text-slate-500">Document: <span className="font-semibold">{aiModalDoc.name}</span></p>
                </div>
              </div>
              <button
                onClick={() => setAiModalDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Loading Indicator */}
            {isAnalyzing && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-8 text-center space-y-3">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
                <h4 className="text-sm font-bold text-purple-900">AI Civil Engineering Assistant Analyzing Document...</h4>
                <p className="text-xs text-purple-700 max-w-md mx-auto">Evaluating contract terms, drawing dimensions, risk factors, and recommended site management actions...</p>
              </div>
            )}

            {/* Error Message */}
            {aiError && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Analysis Error</p>
                  <p>{aiError}</p>
                </div>
              </div>
            )}

            {/* Insights Display */}
            {!isAnalyzing && aiInsights && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-800 leading-relaxed space-y-3 font-sans whitespace-pre-wrap">
                  {aiInsights}
                </div>

                {/* Ask Custom AI Question */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">Ask AI a custom question about this document:</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g., What are the key penalty clauses for site delays in this agreement?"
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customQuestion.trim()) {
                          runAiAnalysis(aiModalDoc, customQuestion.trim());
                        }
                      }}
                      className="flex-1 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={() => customQuestion.trim() && runAiAnalysis(aiModalDoc, customQuestion.trim())}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" /> Ask AI
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button
                onClick={() => runAiAnalysis(aiModalDoc)}
                className="text-xs text-purple-700 hover:text-purple-900 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Re-Analyze Document
              </button>

              <button
                onClick={() => setAiModalDoc(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW DOCUMENT MODAL */}
      {previewDocument && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                {getFileIcon(previewDocument.fileType)}
                <h3 className="text-base font-bold text-slate-800">{previewDocument.name}</h3>
              </div>
              <button
                onClick={() => setPreviewDocument(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Category:</span>
                {getCategoryBadge(previewDocument.category)}
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Original File:</span>
                <span className="font-mono font-semibold text-slate-800">{previewDocument.fileName}</span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">File Size:</span>
                <span className="font-mono text-slate-800">{formatFileSize(previewDocument.fileSize)}</span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-medium">Uploaded On:</span>
                <span className="font-mono text-slate-800">{new Date(previewDocument.uploadedAt).toLocaleDateString()}</span>
              </div>

              {previewDocument.notes && (
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                  <p className="font-bold text-indigo-900 mb-1">Attached Notes:</p>
                  <p className="text-slate-700 leading-relaxed">{previewDocument.notes}</p>
                </div>
              )}

              {/* Image Preview if available */}
              {previewDocument.dataUrl && previewDocument.dataUrl.startsWith('data:image/') && (
                <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden bg-slate-900/5 max-h-48 flex items-center justify-center p-2">
                  <img
                    src={previewDocument.dataUrl}
                    alt={previewDocument.name}
                    className="max-h-44 object-contain rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              {previewDocument.dataUrl && (
                <a
                  href={previewDocument.dataUrl}
                  download={previewDocument.fileName}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Download className="w-4 h-4" /> Download File
                </a>
              )}
              <button
                onClick={() => setPreviewDocument(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Modal */}
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
        message={`Are you sure you want to delete "${projectToDelete?.name}" permanently?\n\nThis will permanently delete all associated material inventory sheets, daily attendance logs, wage payouts, food logs, site diaries, documents, and downtime records recorded on this site!`}
        confirmText="Yes, Delete Permanently"
        cancelText="Cancel"
        type="danger"
      />

      {/* Delete Document Modal */}
      <ConfirmModal
        isOpen={documentToDelete !== null}
        onClose={() => setDocumentToDelete(null)}
        onConfirm={() => {
          if (documentToDelete && onDeleteDocument) {
            onDeleteDocument(documentToDelete.id);
            setDocumentToDelete(null);
          }
        }}
        title="Delete Project Document?"
        message={`Are you sure you want to delete "${documentToDelete?.name}" (${documentToDelete?.fileName})?\n\nThis action cannot be undone.`}
        confirmText="Yes, Delete File"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}

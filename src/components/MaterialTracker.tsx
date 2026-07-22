/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Project, Material, MaterialUsage } from '../types';
import { generateId } from '../utils/id';
import { Truck, Plus, Calendar, DollarSign, Image, PackageOpen, ClipboardList, Trash2, CheckCircle2, Eye, Upload, X, Pencil } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface MaterialTrackerProps {
  activeProject: Project | null;
  materials: Material[];
  onAddMaterial: (material: Material) => void;
  onUpdateMaterial: (material: Material) => void;
  onDeleteMaterial: (id: string) => void;
}

export default function MaterialTracker({
  activeProject,
  materials,
  onAddMaterial,
  onUpdateMaterial,
  onDeleteMaterial,
}: MaterialTrackerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeUsageFormId, setActiveUsageFormId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string } | null>(null);

  // ConfirmModal states
  const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState<Material | null>(null);
  const [confirmDeleteUsage, setConfirmDeleteUsage] = useState<{ material: Material; usageId: string } | null>(null);
  const [confirmExcessUsage, setConfirmExcessUsage] = useState<{ material: Material; date: string; qty: number; desc: string } | null>(null);

  // Add Material Form State
  const [name, setName] = useState('');
  const [quantityBought, setQuantityBought] = useState('');
  const [unit, setUnit] = useState('Bags');
  const [cost, setCost] = useState('');
  const [dateBought, setDateBought] = useState(new Date().toISOString().split('T')[0]);
  const [supplier, setSupplier] = useState('');
  const [billImage, setBillImage] = useState<string>('');
  const [billImageName, setBillImageName] = useState<string>('');
  const [alertThreshold, setAlertThreshold] = useState('');

  // Edit Material Form State
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuantityBought, setEditQuantityBought] = useState('');
  const [editUnit, setEditUnit] = useState('Bags');
  const [editCost, setEditCost] = useState('');
  const [editDateBought, setEditDateBought] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editBillImage, setEditBillImage] = useState<string>('');
  const [editBillImageName, setEditBillImageName] = useState<string>('');
  const [editAlertThreshold, setEditAlertThreshold] = useState('');

  const startEditingMaterial = (m: Material) => {
    setEditingMaterial(m);
    setEditName(m.name);
    setEditQuantityBought(String(m.quantityBought));
    setEditUnit(m.unit);
    setEditCost(String(m.cost));
    setEditDateBought(m.dateBought);
    setEditSupplier(m.supplier || '');
    setEditBillImage(m.billImage || '');
    setEditBillImageName(m.billImageName || '');
    setEditAlertThreshold(m.alertThreshold !== undefined ? String(m.alertThreshold) : '');
  };

  const handleEditMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial) return;
    if (!editName || !editQuantityBought || !editCost) return;

    const updatedMaterial: Material = {
      ...editingMaterial,
      name: editName,
      quantityBought: Number(editQuantityBought),
      unit: editUnit,
      cost: Number(editCost),
      dateBought: editDateBought,
      supplier: editSupplier || 'Local Vendor',
      billImage: editBillImage || undefined,
      billImageName: editBillImageName || undefined,
      alertThreshold: editAlertThreshold ? Number(editAlertThreshold) : undefined,
    };

    onUpdateMaterial(updatedMaterial);
    setEditingMaterial(null);
  };

  // File Upload Helper for Editing
  const handleEditImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('The selected bill image is larger than 2MB. Please upload a smaller compressed image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditBillImage(reader.result as string);
      setEditBillImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleEditDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('The selected bill image is larger than 2MB. Please upload a smaller compressed image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditBillImage(reader.result as string);
      setEditBillImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  // Add Usage Form State
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]);
  const [usageQty, setUsageQty] = useState('');
  const [usageDesc, setUsageDesc] = useState('');

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-slate-500">
          <Truck className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-700">No Construction Site Selected</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Please select or create an active project site in the <strong>Projects</strong> tab to manage materials and uploaded bills.
        </p>
      </div>
    );
  }

  // File Upload Helper
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('The selected bill image is larger than 2MB. Please upload a smaller compressed image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setBillImage(reader.result as string);
      setBillImageName(file.name);
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

    if (file.size > 2 * 1024 * 1024) {
      alert('The selected bill image is larger than 2MB. Please upload a smaller compressed image.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setBillImage(reader.result as string);
      setBillImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleAddMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !quantityBought || !cost) return;

    const newMaterial: Material = {
      id: generateId('mat'),
      projectId: activeProject.id,
      name,
      quantityBought: Number(quantityBought),
      unit,
      cost: Number(cost),
      dateBought,
      supplier: supplier || 'Local Vendor',
      billImage: billImage || undefined,
      billImageName: billImageName || undefined,
      usages: [],
      alertThreshold: alertThreshold ? Number(alertThreshold) : undefined,
    };

    onAddMaterial(newMaterial);
    setShowAddForm(false);
    resetMaterialForm();
  };

  const resetMaterialForm = () => {
    setName('');
    setQuantityBought('');
    setUnit('Bags');
    setCost('');
    setDateBought(new Date().toISOString().split('T')[0]);
    setSupplier('');
    setBillImage('');
    setBillImageName('');
    setAlertThreshold('');
  };

  // Log Material Usage
  const handleAddUsageSubmit = (e: React.FormEvent, m: Material) => {
    e.preventDefault();
    if (!usageQty) return;

    const qty = Number(usageQty);
    const totalUsed = m.usages.reduce((sum, u) => sum + u.quantityUsed, 0);
    const remaining = m.quantityBought - totalUsed;

    if (qty > remaining) {
      setConfirmExcessUsage({
        material: m,
        date: usageDate,
        qty,
        desc: usageDesc,
      });
      return;
    }

    executeAddUsage(m, usageDate, qty, usageDesc);
  };

  const executeAddUsage = (m: Material, date: string, qty: number, desc: string) => {
    const newUsage: MaterialUsage = {
      id: generateId('usage'),
      date,
      quantityUsed: qty,
      description: desc || 'General site installation',
    };

    const updatedMaterial: Material = {
      ...m,
      usages: [...m.usages, newUsage],
    };

    onUpdateMaterial(updatedMaterial);
    setActiveUsageFormId(null);
    setUsageQty('');
    setUsageDesc('');
  };

  const handleConfirmExcessUsage = () => {
    if (!confirmExcessUsage) return;
    const { material, date, qty, desc } = confirmExcessUsage;
    executeAddUsage(material, date, qty, desc);
    setConfirmExcessUsage(null);
  };

  const handleDeleteUsageClick = (m: Material, usageId: string) => {
    setConfirmDeleteUsage({ material: m, usageId });
  };

  const handleConfirmDeleteUsage = () => {
    if (!confirmDeleteUsage) return;
    const { material, usageId } = confirmDeleteUsage;
    const updatedMaterial: Material = {
      ...material,
      usages: material.usages.filter(u => u.id !== usageId),
    };
    onUpdateMaterial(updatedMaterial);
    setConfirmDeleteUsage(null);
  };

  const handleDeleteMaterialClick = (m: Material) => {
    setConfirmDeleteMaterial(m);
  };

  const handleConfirmDeleteMaterial = () => {
    if (!confirmDeleteMaterial) return;
    onDeleteMaterial(confirmDeleteMaterial.id);
    setConfirmDeleteMaterial(null);
  };

  // Filter materials for the selected project
  const projectMaterials = materials.filter(m => m.projectId === activeProject.id);

  const lowStockMaterials = projectMaterials.filter(m => {
    if (m.alertThreshold === undefined || m.alertThreshold === null) return false;
    const totalUsed = m.usages.reduce((sum, u) => sum + u.quantityUsed, 0);
    const remaining = m.quantityBought - totalUsed;
    return remaining <= m.alertThreshold;
  });

  return (
    <div id="material-tracker-section" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Material Inventory & Invoices</h2>
          <p className="text-slate-500 text-sm">
            Site: <strong className="text-slate-700">{activeProject.name}</strong> • Track supply acquisitions, monitor daily usage, and secure digital bills.
          </p>
        </div>
        <button
          id="btn-add-material"
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          {showAddForm ? 'Close Intake Form' : 'Log Material Intake'}
        </button>
      </div>

      {lowStockMaterials.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900">
          <div className="p-1.5 bg-amber-100 rounded-md text-amber-700 shrink-0 mt-0.5 font-sans text-sm">
            ⚠️
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-sm">Material Stock Alerts ({lowStockMaterials.length} running low)</h4>
            <p className="text-xs text-amber-700 leading-relaxed">
              The following materials are currently at or below their critical thresholds. Arrange acquisitions immediately to prevent on-site delays:
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {lowStockMaterials.map(m => {
                const totalUsed = m.usages.reduce((sum, u) => sum + u.quantityUsed, 0);
                const remaining = m.quantityBought - totalUsed;
                return (
                  <span key={m.id} className="inline-flex items-center gap-1 bg-amber-100 text-amber-950 px-2.5 py-1 rounded-full text-xs font-semibold border border-amber-200 font-mono">
                    {m.name}: <strong className="text-rose-700">{remaining} {m.unit}</strong> left (Min Limit: {m.alertThreshold} {m.unit})
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">Add Material Intake Log</h3>

          <form onSubmit={handleAddMaterialSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Material Name / Grade</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. UltraTech Cement OPC-53, TMT Steel Rebar 12mm"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Cost / Invoice Total (Rs.)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">₹</span>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantity Bought</label>
              <input
                type="number"
                value={quantityBought}
                onChange={(e) => setQuantityBought(e.target.value)}
                placeholder="e.g. 100"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Measurement Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              >
                <option value="Bags">Bags (e.g. Cement)</option>
                <option value="Tons">Tons (e.g. Steel, Aggregates)</option>
                <option value="CFT">CFT (e.g. Sand, Gravel)</option>
                <option value="Liters">Liters (e.g. Paint, Chemicals)</option>
                <option value="kg">kg (e.g. Binding wire)</option>
                <option value="Pieces">Pieces (e.g. Bricks, Blocks)</option>
                <option value="Meters">Meters (e.g. Pipes, Cables)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Purchase Date</label>
              <input
                type="date"
                value={dateBought}
                onChange={(e) => setDateBought(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                required
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Supplier / Vendor Shop Name</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Sharma Building Materials Depot"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Low Stock Warning Alert Threshold</label>
              <input
                type="number"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                placeholder="e.g. 15 (Warn when <= 15)"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
              />
            </div>

            {/* Drag and Drop Invoice Bill Upload */}
            <div className="space-y-1.5 md:col-span-3">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Invoice Bill Receipt Image</label>
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="border-2 border-dashed border-slate-200 rounded-lg p-5 text-center bg-slate-50 hover:bg-slate-100/50 transition relative"
              >
                <input
                  type="file"
                  id="bill-upload"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <label
                  htmlFor="bill-upload"
                  className="cursor-pointer flex flex-col items-center justify-center space-y-2 text-slate-500 hover:text-slate-700"
                >
                  {billImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <img src={billImage} className="max-h-24 rounded border border-slate-200 shadow-sm" alt="bill preview" />
                      <span className="text-xs text-emerald-600 font-medium">✓ {billImageName || 'Bill Loaded successfully'}</span>
                      <span className="text-[10px] text-slate-400 underline">Click or drag again to replace</span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-slate-400" />
                      <div>
                        <p className="text-sm font-semibold">Click to select or drag & drop invoice image</p>
                        <p className="text-[10px] text-slate-400 mt-1">JPEG, PNG, WebP up to 2MB. Fully encrypted and saved locally.</p>
                      </div>
                    </>
                  )}
                </label>
              </div>
            </div>

            <div className="md:col-span-3 pt-2 flex justify-end">
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium cursor-pointer"
              >
                Log Acquisition
              </button>
            </div>
          </form>
        </div>
      )}

      {projectMaterials.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl p-12 text-center space-y-4">
          <PackageOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <div>
            <h3 className="font-semibold text-slate-700">No Material Inventory</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto mt-1">
              Add your materials acquired (cement bags, steel rebars, bricks) to track real-time depletion on-site.
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Log Materials
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projectMaterials.map((m) => {
            const totalUsed = m.usages.reduce((sum, u) => sum + u.quantityUsed, 0);
            const remaining = m.quantityBought - totalUsed;
            const usePercent = Math.min((totalUsed / m.quantityBought) * 100, 100);

            return (
              <div
                key={m.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-slate-800 text-base">{m.name}</h3>
                        {m.alertThreshold !== undefined && remaining <= m.alertThreshold && (
                          <span className="inline-flex items-center bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded border border-rose-200">
                            ⚠️ Low Stock
                          </span>
                        )}
                      </div>
                      <p className="text-slate-400 text-xs mt-0.5 font-mono">
                        Bought: {m.dateBought} • {m.supplier}
                        {m.alertThreshold !== undefined && ` • Limit: ${m.alertThreshold} ${m.unit}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEditingMaterial(m)}
                        className="p-1.5 text-slate-400 hover:text-slate-800 rounded-md hover:bg-slate-100 transition cursor-pointer"
                        title="Edit entry"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteMaterialClick(m)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-xs">
                    <div>
                      <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Stock Cost</p>
                      <p className="font-semibold text-slate-700 font-mono text-sm mt-0.5">₹{m.cost.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">Acquired</p>
                      <p className="font-semibold text-slate-700 font-mono text-sm mt-0.5">{m.quantityBought} {m.unit}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 font-semibold uppercase tracking-wider text-[9px]">In Hand</p>
                      <p className={`font-semibold font-mono text-sm mt-0.5 ${remaining > 0 ? 'text-emerald-600' : remaining === 0 ? 'text-slate-400' : 'text-rose-600 font-bold'}`}>
                        {remaining} {m.unit}
                      </p>
                    </div>
                  </div>

                  {/* Stock Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium">
                      <span className="text-slate-500">Stock Utilized ({totalUsed} {m.unit})</span>
                      <span className={`${usePercent > 90 ? 'text-rose-500 font-bold' : 'text-slate-700'}`}>{usePercent.toFixed(0)}% Used</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          usePercent > 90 ? 'bg-rose-500' : usePercent > 50 ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${usePercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bill Image & Usage Logs Container */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                  {/* Bill Receipt Thumbnail and Lightbox trigger */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Image className="w-3.5 h-3.5 text-slate-400" /> Digital Bill Receipt
                    </p>
                    {m.billImage ? (
                      <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50 h-28 flex items-center justify-center">
                        <img src={m.billImage} className="max-h-full object-contain" alt="bill scan" />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                          <button
                            onClick={() => setLightboxImage({ src: m.billImage!, title: m.name + ' Invoice Bill' })}
                            className="bg-white/90 hover:bg-white text-slate-950 p-1.5 rounded-full shadow cursor-pointer transition flex items-center justify-center"
                            title="View receipt"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 h-28 flex flex-col items-center justify-center text-center">
                        <PackageOpen className="w-5 h-5 text-slate-300" />
                        <span className="text-[10px] text-slate-400 mt-1">No scanned invoice receipt</span>
                        <label className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer mt-1">
                          Upload Bill
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                onUpdateMaterial({
                                  ...m,
                                  billImage: reader.result as string,
                                  billImageName: file.name
                                });
                              };
                              reader.readAsDataURL(file);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Usage Log Sublist */}
                  <div className="space-y-2 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <ClipboardList className="w-3.5 h-3.5 text-slate-400" /> Depletion Logs
                        </p>
                        <button
                          onClick={() => setActiveUsageFormId(activeUsageFormId === m.id ? null : m.id)}
                          className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer hover:underline"
                        >
                          + Log Usage
                        </button>
                      </div>

                      {m.usages.length === 0 ? (
                        <p className="text-slate-400 italic text-[10px] py-2 bg-slate-50/50 border border-dashed border-slate-100 rounded text-center">
                          Unutilized stock.
                        </p>
                      ) : (
                        <div className="max-h-20 overflow-y-auto space-y-1 bg-slate-50/30 p-1 rounded border border-slate-100">
                          {m.usages.map((u) => (
                            <div key={u.id} className="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-0 font-mono text-[10px]">
                              <span className="text-slate-400">{u.date}</span>
                              <span className="font-semibold text-slate-700 font-sans max-w-[70px] truncate" title={u.description}>{u.description}</span>
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-rose-500">-{u.quantityUsed} {m.unit}</span>
                                <button
                                  onClick={() => handleDeleteUsageClick(m, u.id)}
                                  className="text-slate-300 hover:text-rose-600 transition cursor-pointer font-bold text-xs p-1"
                                  title="Delete depletion log"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Usage log dynamic form */}
                {activeUsageFormId === m.id && (
                  <form
                    onSubmit={(e) => handleAddUsageSubmit(e, m)}
                    className="bg-slate-50 p-3 rounded-lg border border-slate-100 grid grid-cols-3 gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-semibold text-slate-500">Date Used</label>
                      <input
                        type="date"
                        value={usageDate}
                        onChange={(e) => setUsageDate(e.target.value)}
                        className="w-full border border-slate-200 bg-white rounded px-2 py-1 text-xs font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-semibold text-slate-500">Quantity ({m.unit})</label>
                      <input
                        type="number"
                        value={usageQty}
                        onChange={(e) => setUsageQty(e.target.value)}
                        className="w-full border border-slate-200 bg-white rounded px-2 py-1 text-xs font-mono"
                        required
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-semibold text-slate-500">Purpose</label>
                      <input
                        type="text"
                        value={usageDesc}
                        onChange={(e) => setUsageDesc(e.target.value)}
                        placeholder="e.g. Slabs"
                        className="w-full border border-slate-200 bg-white rounded px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="col-span-3 flex justify-end gap-1.5 mt-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveUsageFormId(null)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 rounded px-2.5 py-1 text-[10px] font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="bg-slate-950 hover:bg-slate-800 text-white rounded px-3 py-1 text-[10px] font-medium cursor-pointer"
                      >
                        Deduct Stock
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bill Receipt Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4">
          <div className="relative bg-white rounded-xl overflow-hidden max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">{lightboxImage.title}</h3>
              <button
                onClick={() => setLightboxImage(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1 flex justify-center items-center bg-slate-100">
              <img src={lightboxImage.src} className="max-w-full max-h-[60vh] object-contain rounded shadow-lg" alt="Full Invoice Receipt" />
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-400 font-mono">
              Saved securely locally. To export, you can download the complete master backup.
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MATERIAL MODAL */}
      <ConfirmModal
        isOpen={confirmDeleteMaterial !== null}
        onClose={() => setConfirmDeleteMaterial(null)}
        onConfirm={handleConfirmDeleteMaterial}
        title="Delete Material Inventory?"
        message={`Are you sure you want to delete "${confirmDeleteMaterial?.name}"?\n\nThis will permanently delete this material delivery record, all associated usage logs, and any uploaded invoice/bill receipt images. This action cannot be undone.`}
        confirmText="Yes, Delete Material"
        cancelText="Cancel"
        type="danger"
      />

      {/* CONFIRM DELETE USAGE LOG MODAL */}
      <ConfirmModal
        isOpen={confirmDeleteUsage !== null}
        onClose={() => setConfirmDeleteUsage(null)}
        onConfirm={handleConfirmDeleteUsage}
        title="Delete Depletion Log?"
        message={`Are you sure you want to delete this usage log of ${confirmDeleteUsage ? confirmDeleteUsage.material.usages.find(u => u.id === confirmDeleteUsage.usageId)?.quantityUsed : 0} ${confirmDeleteUsage?.material.unit} on ${confirmDeleteUsage ? confirmDeleteUsage.material.usages.find(u => u.id === confirmDeleteUsage.usageId)?.date : ''}?\n\nThis will return the material quantity back to the active stock inventory.`}
        confirmText="Yes, Delete Log"
        cancelText="Cancel"
        type="warning"
      />

      {/* CONFIRM EXCESS USAGE WARN MODAL */}
      <ConfirmModal
        isOpen={confirmExcessUsage !== null}
        onClose={() => setConfirmExcessUsage(null)}
        onConfirm={handleConfirmExcessUsage}
        title="Warning: Insufficient Stock"
        message={`You only have ${confirmExcessUsage ? (confirmExcessUsage.material.quantityBought - confirmExcessUsage.material.usages.reduce((sum, u) => sum + u.quantityUsed, 0)) : 0} ${confirmExcessUsage?.material.unit} of "${confirmExcessUsage?.material.name}" remaining in stock, but you are attempting to record a depletion of ${confirmExcessUsage?.qty} ${confirmExcessUsage?.material.unit}.\n\nDo you still want to proceed with recording this usage?`}
        confirmText="Yes, Log Anyway"
        cancelText="Cancel"
        type="warning"
      />

      {/* EDIT MATERIAL MODAL */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" 
            onClick={() => setEditingMaterial(null)} 
          />

          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
              
              <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-lg font-bold text-slate-950 flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-slate-500" /> Edit Material Entry
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingMaterial(null)}
                    className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleEditMaterialSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Material Name / Grade</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="e.g. UltraTech Cement OPC-53"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Cost / Invoice Total (Rs.)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-mono">₹</span>
                      <input
                        type="number"
                        value={editCost}
                        onChange={(e) => setEditCost(e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-slate-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantity Bought</label>
                    <input
                      type="number"
                      value={editQuantityBought}
                      onChange={(e) => setEditQuantityBought(e.target.value)}
                      placeholder="e.g. 100"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Measurement Unit</label>
                    <select
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                    >
                      <option value="Bags">Bags (e.g. Cement)</option>
                      <option value="Tons">Tons (e.g. Steel, Aggregates)</option>
                      <option value="CFT">CFT (e.g. Sand, Gravel)</option>
                      <option value="Liters">Liters (e.g. Paint, Chemicals)</option>
                      <option value="kg">kg (e.g. Binding wire)</option>
                      <option value="Pieces">Pieces (e.g. Bricks, Blocks)</option>
                      <option value="Meters">Meters (e.g. Pipes, Cables)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Purchase Date</label>
                    <input
                      type="date"
                      value={editDateBought}
                      onChange={(e) => setEditDateBought(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                      required
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Supplier / Vendor Shop Name</label>
                    <input
                      type="text"
                      value={editSupplier}
                      onChange={(e) => setEditSupplier(e.target.value)}
                      placeholder="e.g. Sharma Building Materials Depot"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Low Stock Warning Alert Threshold</label>
                    <input
                      type="number"
                      value={editAlertThreshold}
                      onChange={(e) => setEditAlertThreshold(e.target.value)}
                      placeholder="e.g. 15 (Warn when <= 15)"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-slate-700"
                    />
                  </div>

                  {/* Drag and Drop Invoice Bill Upload */}
                  <div className="space-y-1.5 md:col-span-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Invoice Bill Receipt Image</label>
                      {editBillImage && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditBillImage('');
                            setEditBillImageName('');
                          }}
                          className="text-xs text-rose-600 hover:text-rose-700 font-medium cursor-pointer"
                        >
                          Remove Image
                        </button>
                      )}
                    </div>
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleEditDrop}
                      className="border-2 border-dashed border-slate-200 rounded-lg p-5 text-center bg-slate-50 hover:bg-slate-100/50 transition relative"
                    >
                      <input
                        type="file"
                        id="edit-bill-upload"
                        accept="image/*"
                        onChange={handleEditImageUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="edit-bill-upload"
                        className="cursor-pointer flex flex-col items-center justify-center space-y-2 text-slate-500 hover:text-slate-700"
                      >
                        {editBillImage ? (
                          <div className="flex flex-col items-center gap-2">
                            <img src={editBillImage} className="max-h-24 rounded border border-slate-200 shadow-sm" alt="bill preview" />
                            <span className="text-xs text-emerald-600 font-medium">✓ {editBillImageName || 'Bill Loaded successfully'}</span>
                            <span className="text-[10px] text-slate-400 underline">Click or drag again to replace</span>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-slate-400" />
                            <div>
                              <p className="text-sm font-semibold">Click to select or drag & drop invoice image</p>
                              <p className="text-[10px] text-slate-400 mt-1">JPEG, PNG, WebP up to 2MB. Fully encrypted and saved locally.</p>
                            </div>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="md:col-span-3 pt-3 flex justify-end gap-3 border-t border-slate-100 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditingMaterial(null)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2 rounded-lg text-sm font-medium cursor-pointer transition shadow-sm"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

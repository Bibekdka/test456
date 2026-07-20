/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { Project, Labour, Attendance, Advance, Payment, Material, GstRecord, SiteDiaryEntry, DelayWeatherLog, HotelAdvance, FoodLog, Payer } from '../types';
import { FileDown, Download, Upload, ShieldCheck, Database, Calendar, Landmark, AlertCircle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ReportGeneratorProps {
  activeProject: Project | null;
  projects: Project[];
  labours: Labour[];
  attendanceRecords: Attendance[];
  advanceRecords: Advance[];
  paymentRecords: Payment[];
  materials: Material[];
  gstRecords: GstRecord[];
  siteDiaries: SiteDiaryEntry[];
  delayWeatherLogs: DelayWeatherLog[];
  hotelAdvances: HotelAdvance[];
  foodLogs: FoodLog[];
  payers: Payer[];
  onImportBackup: (backupData: any) => void;
}

export default function ReportGenerator({
  activeProject,
  projects,
  labours,
  attendanceRecords,
  advanceRecords,
  paymentRecords,
  materials,
  gstRecords,
  siteDiaries,
  delayWeatherLogs,
  hotelAdvances,
  foodLogs,
  payers,
  onImportBackup,
}: ReportGeneratorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!activeProject) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
        <div className="bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-slate-500">
          <FileDown className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-slate-700">No Construction Site Selected</h3>
        <p className="text-slate-400 text-sm max-w-sm mx-auto">
          Please select or create an active project site in the <strong>Projects</strong> tab to inspect cost metrics and generate reports.
        </p>
      </div>
    );
  }

  // Compile calculations for this project
  const projectMaterials = materials.filter(m => m.projectId === activeProject.id);
  const totalMaterialCost = projectMaterials.reduce((sum, m) => sum + m.cost, 0);

  // Compile Labour metrics
  let totalWagesEarned = 0;
  let totalAdvancesDeducted = 0;
  let totalPayoutsLogged = 0;
  let activeWorkersOnSite = 0;

  const workerDetails = labours.map(l => {
    // Attendance
    const att = attendanceRecords.filter(r => r.labourId === l.id && r.projectId === activeProject.id);
    let daysWorked = 0;
    att.forEach(r => {
      if (r.status === 'present') daysWorked += 1;
      else if (r.status === 'half_day') daysWorked += 0.5;
    });

    if (daysWorked > 0 && l.status === 'active') {
      activeWorkersOnSite++;
    }

    const earned = daysWorked * l.perDayWage;

    // Advances
    const advs = advanceRecords.filter(a => a.labourId === l.id && a.projectId === activeProject.id);
    const advanceTaken = advs.reduce((sum, a) => sum + a.amount, 0);

    // Payments
    const pays = paymentRecords.filter(p => p.labourId === l.id && p.projectId === activeProject.id);
    const amountPaid = pays.reduce((sum, p) => sum + p.amountPaid, 0);

    const remainingBalance = earned - advanceTaken - amountPaid;

    totalWagesEarned += earned;
    totalAdvancesDeducted += advanceTaken;
    totalPayoutsLogged += amountPaid;

    return {
      name: l.name,
      status: l.status,
      rate: l.perDayWage,
      daysWorked,
      earned,
      advanceTaken,
      amountPaid,
      remainingBalance,
    };
  });

  const totalSpent = totalWagesEarned + totalMaterialCost;
  const remainingBudget = activeProject.budget - totalSpent;
  const overBudget = remainingBudget < 0;

  // Timeline days remaining
  const getDaysLeft = (targetStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetStr);
    target.setHours(0, 0, 0, 0);
    const diff = target.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };
  const daysRemaining = getDaysLeft(activeProject.targetDate);

  // Export to PDF
  const downloadPDFReport = () => {
    const doc = new jsPDF();
    const siteName = activeProject.name;

    // Report Header
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.text("CONSTRUCTION PROGRESS & COST LEDGER", 14, 20);

    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated Date: ${new Date().toLocaleDateString()} • Site: ${siteName}`, 14, 26);

    // 1. Site Metadata Cards Box
    doc.setDrawColor(220, 220, 220);
    doc.setFillColor(250, 250, 250);
    doc.rect(14, 32, 182, 35, "FD");

    doc.setFont("Helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text("PROJECT OVERVIEW SUMMARY", 18, 38);

    doc.setFont("Helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(`Timeline: ${activeProject.startDate} to ${activeProject.targetDate} (${daysRemaining >= 0 ? `${daysRemaining} days left` : `Overdue by ${Math.abs(daysRemaining)} days`})`, 18, 44);
    doc.text(`Project Budget: Rs. ${activeProject.budget.toLocaleString()}`, 18, 49);
    doc.text(`Total Accumulated Expenses: Rs. ${totalSpent.toLocaleString()} (Materials: Rs. ${totalMaterialCost.toLocaleString()} | Labours: Rs. ${totalWagesEarned.toLocaleString()})`, 18, 54);
    doc.text(`Net Outstanding Balance: Rs. ${remainingBudget.toLocaleString()}`, 18, 59);

    // 2. Labour Wages Sheet Section
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("LABOUR WAGES SUBLEDGER", 14, 76);

    const labourRows = workerDetails
      .filter(w => w.daysWorked > 0 || w.advanceTaken > 0 || w.amountPaid > 0)
      .map(w => [
        w.name,
        `Rs. ${w.rate}/day`,
        `${w.daysWorked} days`,
        `Rs. ${w.earned.toFixed(2)}`,
        `Rs. ${w.advanceTaken.toFixed(2)}`,
        `Rs. ${w.amountPaid.toFixed(2)}`,
        `Rs. ${w.remainingBalance.toFixed(2)}`
      ]);

    (doc as any).autoTable({
      head: [['Labour Name', 'Daily Rate', 'Days Worked', 'Gross Earned', 'Advances Taken', 'Paid Logged', 'Balance Due']],
      body: labourRows,
      startY: 80,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    });

    // 3. Materials Log Section
    const nextY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(12);
    doc.text("MATERIAL ACQUISITIONS & STOCKS", 14, nextY);

    const materialRows = projectMaterials.map(m => {
      const totalUsed = m.usages.reduce((sum, u) => sum + u.quantityUsed, 0);
      const left = m.quantityBought - totalUsed;
      return [
        m.name,
        m.supplier || 'N/A',
        m.dateBought,
        `${m.quantityBought} ${m.unit}`,
        `Rs. ${m.cost.toLocaleString()}`,
        `${left} ${m.unit}`
      ];
    });

    (doc as any).autoTable({
      head: [['Material Name', 'Supplier/Shop', 'Intake Date', 'Total Acquired', 'Total Invoice Cost', 'Current Stock Left']],
      body: materialRows,
      startY: nextY + 4,
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105] },
      styles: { fontSize: 8 },
    });

    // 4. Site Diaries Section
    const projectDiaries = siteDiaries.filter(d => d.projectId === activeProject.id);
    let diaryNextY = (doc as any).lastAutoTable.finalY + 12;
    if (projectDiaries.length > 0) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("DAILY SITE DIARY ENTRIES", 14, diaryNextY);

      const diaryRows = projectDiaries.map(d => [
        d.date,
        d.supervisorName,
        d.workDone,
        `${d.manpowerCount} workers`,
        d.remarks || 'None',
        d.safetyLog || 'Compliant'
      ]);

      (doc as any).autoTable({
        head: [['Date', 'Supervisor', 'Work Done Description', 'Manpower', 'Remarks/Notes', 'Safety Log']],
        body: diaryRows,
        startY: diaryNextY + 4,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 },
      });
      diaryNextY = (doc as any).lastAutoTable.finalY + 12;
    }

    // 5. Site Delays Section
    const projectDelays = delayWeatherLogs.filter(d => d.projectId === activeProject.id);
    if (projectDelays.length > 0) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("SITE DOWNTIME & WEATHER TIMELINE", 14, diaryNextY);

      const delayRows = projectDelays.map(d => [
        d.date,
        d.weather,
        d.temperature ? `${d.temperature}°C` : 'N/A',
        d.isDelay ? `Yes (${d.delayHours} hrs)` : 'No disruption',
        d.delayReason || 'N/A',
        d.delayNotes || 'N/A'
      ]);

      (doc as any).autoTable({
        head: [['Date', 'Weather', 'Temp', 'Delay occurred', 'Primary Reason', 'Resolution Notes']],
        body: delayRows,
        startY: diaryNextY + 4,
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 8 },
      });
    }

    doc.save(`Construction_Report_${siteName.replace(/\s+/g, '_')}.pdf`);
  };

  // Export to Excel
  const downloadExcelReport = () => {
    const wb = XLSX.utils.book_new();
    const siteName = activeProject.name;

    // Tab 1: Project Metadata
    const projectSummaryData = [
      { Metric: "Project Site Name", Value: activeProject.name },
      { Metric: "Description", Value: activeProject.description },
      { Metric: "Work Status", Value: activeProject.status.toUpperCase() },
      { Metric: "Project Start Date", Value: activeProject.startDate },
      { Metric: "Project Completion Deadline", Value: activeProject.targetDate },
      { Metric: "Days Left to Deadline", Value: daysRemaining },
      { Metric: "Allocated Budget (Rs.)", Value: activeProject.budget },
      { Metric: "Cumulative Material Cost (Rs.)", Value: totalMaterialCost },
      { Metric: "Cumulative Labour Wage Cost (Rs.)", Value: totalWagesEarned },
      { Metric: "Total Spent Expenses (Rs.)", Value: totalSpent },
      { Metric: "Remaining Net Balance (Rs.)", Value: remainingBudget }
    ];
    const wsSummary = XLSX.utils.json_to_sheet(projectSummaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Project General Summary");

    // Tab 2: Labour subledger
    const labourExcelRows = workerDetails
      .filter(w => w.daysWorked > 0 || w.advanceTaken > 0 || w.amountPaid > 0)
      .map(w => ({
        "Worker Name": w.name,
        "Daily Standard Rate (Rs.)": w.rate,
        "Days Worked (Attendance)": w.daysWorked,
        "Gross Wages Earned (Rs.)": w.earned,
        "Total Advances Deducted (Rs.)": w.advanceTaken,
        "Total Previous Cash Payouts (Rs.)": w.amountPaid,
        "Net Outstanding Wages Owed (Rs.)": w.remainingBalance,
        "Status": w.status.toUpperCase()
      }));
    const wsLabour = XLSX.utils.json_to_sheet(labourExcelRows);
    XLSX.utils.book_append_sheet(wb, wsLabour, "Labour Wages Ledger");

    // Tab 3: Materials
    const materialExcelRows = projectMaterials.map(m => {
      const totalUsed = m.usages.reduce((sum, u) => sum + u.quantityUsed, 0);
      const remaining = m.quantityBought - totalUsed;
      return {
        "Material Name": m.name,
        "Supplier / Shop": m.supplier || 'N/A',
        "Purchase Date": m.dateBought,
        "Quantity Acquired": m.quantityBought,
        "Measurement Unit": m.unit,
        "Invoice Cost Total (Rs.)": m.cost,
        "Total Quantity Utilized": totalUsed,
        "Stock Remaining on Site": remaining
      };
    });
    const wsMaterials = XLSX.utils.json_to_sheet(materialExcelRows);
    XLSX.utils.book_append_sheet(wb, wsMaterials, "Materials & Supply Stocks");

    // Tab 4: Site Diaries
    const projectDiaries = siteDiaries.filter(d => d.projectId === activeProject.id);
    const diaryExcelRows = projectDiaries.map(d => ({
      "Date": d.date,
      "Supervisor Name": d.supervisorName,
      "Work Description": d.workDone,
      "Manpower Count": d.manpowerCount,
      "Safety Compliance": d.safetyLog || "Compliant",
      "Remarks / Notes": d.remarks || "None"
    }));
    const wsDiaries = XLSX.utils.json_to_sheet(diaryExcelRows);
    XLSX.utils.book_append_sheet(wb, wsDiaries, "Daily Site Diaries");

    // Tab 5: Site Delays & Weather
    const projectDelays = delayWeatherLogs.filter(d => d.projectId === activeProject.id);
    const delayExcelRows = projectDelays.map(d => ({
      "Date": d.date,
      "Weather Condition": d.weather,
      "Temperature (°C)": d.temperature || "N/A",
      "Disruption / Strike Occurred?": d.isDelay ? "Yes" : "No",
      "Downtime Duration (Hours)": d.delayHours || 0,
      "Primary Delay Reason": d.delayReason || "N/A",
      "Mitigation & Resolution Notes": d.delayNotes || "N/A"
    }));
    const wsDelays = XLSX.utils.json_to_sheet(delayExcelRows);
    XLSX.utils.book_append_sheet(wb, wsDelays, "Site Downtime & Weather");

    XLSX.writeFile(wb, `Construction_Report_${siteName.replace(/\s+/g, '_')}.xlsx`);
  };

  // Full Database Backup Export
  const exportFullBackup = () => {
    const data = {
      version: 1,
      timestamp: new Date().toISOString(),
      projects,
      labours,
      attendanceRecords,
      advanceRecords,
      paymentRecords,
      materials,
      gstRecords,
      siteDiaries,
      delayWeatherLogs,
      hotelAdvances,
      foodLogs,
      payers,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Construction_Manager_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Full Database Backup Import Trigger
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.projects || !parsed.labours) {
          throw new Error('Invalid backup schema.');
        }

        if (confirm('Importing this backup will overwrite your current database. This is irreversible! Do you want to continue?')) {
          onImportBackup(parsed);
          alert('Database restored successfully from backup!');
        }
      } catch (err) {
        alert('Failed to parse backup JSON file. Ensure you uploaded a valid Construction Manager backup file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div id="report-generator-section" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-800">Financial Reports & Data Security</h2>
          <p className="text-slate-500 text-sm">
            Site: <strong className="text-slate-700">{activeProject.name}</strong> • Analyze cumulative cost statements, extract print-ready files, and secure offsite backups.
          </p>
        </div>
      </div>

      {/* Grid of Key Cost Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Project Budget</span>
            <Landmark className="w-5 h-5 text-slate-400" />
          </div>
          <div className="mt-2.5">
            <h4 className="text-2xl font-bold tracking-tight font-mono text-slate-800">₹{activeProject.budget.toLocaleString()}</h4>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">Initial financial allocation</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Total Spent</span>
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
          </div>
          <div className="mt-2.5">
            <h4 className="text-2xl font-bold tracking-tight font-mono text-indigo-600">₹{totalSpent.toLocaleString()}</h4>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Materials: ₹{totalMaterialCost.toLocaleString()} + Labour: ₹{totalWagesEarned.toLocaleString()}
            </p>
          </div>
        </div>

        <div className={`border rounded-xl p-4 shadow-sm flex flex-col justify-between ${overBudget ? 'bg-rose-50 border-rose-100' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-start">
            <span className={`text-xs font-semibold uppercase tracking-wide ${overBudget ? 'text-rose-500' : 'text-slate-400'}`}>
              Remaining Cash
            </span>
            {overBudget ? <AlertCircle className="w-5 h-5 text-rose-500 animate-bounce" /> : <ShieldCheck className="w-5 h-5 text-emerald-500" />}
          </div>
          <div className="mt-2.5">
            <h4 className={`text-2xl font-bold tracking-tight font-mono ${overBudget ? 'text-rose-600' : 'text-slate-800'}`}>
              ₹{remainingBudget.toLocaleString()}
            </h4>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              {overBudget ? 'EXCEEDED ALLOCATED BUDGET LIMIT' : 'Available project reserves'}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Days to Deadline</span>
            <Calendar className="w-5 h-5 text-slate-400" />
          </div>
          <div className="mt-2.5">
            <h4 className={`text-2xl font-bold tracking-tight font-mono ${daysRemaining < 0 ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
              {daysRemaining >= 0 ? `${daysRemaining} Days` : `${Math.abs(daysRemaining)} Days Over`}
            </h4>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">Ends: {activeProject.targetDate}</p>
          </div>
        </div>
      </div>

      {/* Reports Generation Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-base">Export Site Statements</h3>
          <p className="text-slate-500 text-sm leading-relaxed">
            Generate formal, compiled ledgers of this construction site. These reports pack all materials purchased, stock depletion cycles, attendance summaries, advances, and payouts clearly formatted.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={downloadPDFReport}
              className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm hover:shadow"
            >
              <Download className="w-4 h-4" />
              Download PDF Report
            </button>
            <button
              onClick={downloadExcelReport}
              className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer shadow-sm"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              Download Excel Workbook
            </button>
          </div>
        </div>

        {/* Local Security & Backups */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" /> Backup & Restore Database
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed mt-2">
              Your business data is stored locally in this browser. To prevent data loss when switching browsers, clearing device histories, or switching phones, download a complete backup file.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 mt-4">
            <button
              onClick={exportFullBackup}
              className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              Export Full Backup
            </button>
            <button
              onClick={handleImportClick}
              className="inline-flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              Import Backup File
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

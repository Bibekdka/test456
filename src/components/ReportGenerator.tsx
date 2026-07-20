/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { Project, Labour, Attendance, Advance, Payment, Material, GstRecord, SiteDiaryEntry, DelayWeatherLog, HotelAdvance, FoodLog, Payer, DailyExpense, getAttendanceFoodDaysAndCost } from '../types';
import { FileDown, Download, Upload, ShieldCheck, Database, Calendar, Landmark, AlertCircle, Printer, Image, Search, Eye, Filter, CheckCircle2, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  dailyExpenses: DailyExpense[];
  onImportBackup: (backupData: any) => void;
  foodCalculationStartDate?: string;
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
  dailyExpenses,
  onImportBackup,
  foodCalculationStartDate = '',
}: ReportGeneratorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; title: string; date: string; category: string; desc: string; amount: string; name: string } | null>(null);
  const [snapsSearch, setSnapsSearch] = useState('');
  const [snapsCategory, setSnapsCategory] = useState<'all' | 'materials' | 'expenses'>('all');

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

  const [useAutoFoodCalc, setUseAutoFoodCalc] = useState(true);

  // Food cost calculations
  const pFoodLogs = foodLogs.filter(f => f.projectId === activeProject.id);
  const totalManualFoodCost = pFoodLogs.reduce((sum, f) => sum + (f.mealsCount * f.cost), 0);

  const pLabourIds = new Set(attendanceRecords.filter(a => a.projectId === activeProject.id).map(a => a.labourId));
  const projectLabours = labours.filter(l => {
    if (pLabourIds.has(l.id)) return true;
    if (l.status === 'active') return true;
    if (l.status === 'left' && l.joinedDate) {
      const leftDate = l.leftDate || new Date().toISOString().split('T')[0];
      if (leftDate >= activeProject.startDate) return true;
    }
    return false;
  });

  const totalAutoFoodCost = projectLabours.reduce((sum, l) => {
    const { cost } = getAttendanceFoodDaysAndCost(
      l,
      attendanceRecords,
      activeProject.id,
      foodCalculationStartDate,
      activeProject.startDate
    );
    return sum + cost;
  }, 0);

  const activeFoodCost = useAutoFoodCalc ? totalAutoFoodCost : totalManualFoodCost;

  const projectExpenses = dailyExpenses.filter(e => e.projectId === activeProject.id);
  const totalDailyExpensesCost = projectExpenses.reduce((sum, e) => sum + e.amount, 0);

  const totalSpent = totalWagesEarned + totalMaterialCost + totalDailyExpensesCost + activeFoodCost;
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
    doc.text(`Total Accumulated Expenses: Rs. ${totalSpent.toLocaleString()} (Materials: Rs. ${totalMaterialCost.toLocaleString()} | Labours: Rs. ${totalWagesEarned.toLocaleString()} | Daily Exp/Misc: Rs. ${totalDailyExpensesCost.toLocaleString()} | Food Outlays: Rs. ${activeFoodCost.toLocaleString()})`, 18, 54);
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

    autoTable(doc, {
      head: [['Labour Name', 'Daily Rate', 'Days Worked', 'Gross Earned', 'Advances Taken', 'Paid Logged', 'Balance Due']],
      body: labourRows,
      startY: 80,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 8 },
    });

    // 3. Materials Log Section
    const nextY = ((doc as any).lastAutoTable?.finalY || 80) + 12;
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

    autoTable(doc, {
      head: [['Material Name', 'Supplier/Shop', 'Intake Date', 'Total Acquired', 'Total Invoice Cost', 'Current Stock Left']],
      body: materialRows,
      startY: nextY + 4,
      theme: 'striped',
      headStyles: { fillColor: [71, 85, 105] },
      styles: { fontSize: 8 },
    });

    // 4. Site Diaries Section
    const projectDiaries = siteDiaries.filter(d => d.projectId === activeProject.id);
    let diaryNextY = ((doc as any).lastAutoTable?.finalY || (nextY + 20)) + 12;
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

      autoTable(doc, {
        head: [['Date', 'Supervisor', 'Work Done Description', 'Manpower', 'Remarks/Notes', 'Safety Log']],
        body: diaryRows,
        startY: diaryNextY + 4,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 8 },
      });
      diaryNextY = ((doc as any).lastAutoTable?.finalY || diaryNextY) + 12;
    }

    // 5. Site Delays Section
    const projectDelays = delayWeatherLogs.filter(d => d.projectId === activeProject.id);
    let delaysNextY = diaryNextY;
    if (projectDelays.length > 0) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("SITE DOWNTIME & WEATHER TIMELINE", 14, delaysNextY);

      const delayRows = projectDelays.map(d => [
        d.date,
        d.weather,
        d.temperature ? `${d.temperature}°C` : 'N/A',
        d.isDelay ? `Yes (${d.delayHours} hrs)` : 'No disruption',
        d.delayReason || 'N/A',
        d.delayNotes || 'N/A'
      ]);

      autoTable(doc, {
        head: [['Date', 'Weather', 'Temp', 'Delay occurred', 'Primary Reason', 'Resolution Notes']],
        body: delayRows,
        startY: delaysNextY + 4,
        theme: 'striped',
        headStyles: { fillColor: [245, 158, 11] },
        styles: { fontSize: 8 },
      });
      delaysNextY = ((doc as any).lastAutoTable?.finalY || delaysNextY) + 12;
    }

    // 6. Daily Expenses Section
    let finalExpensesY = delaysNextY;
    if (projectExpenses.length > 0) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("DAILY EXPENSES & MISC TRANSACTIONS", 14, delaysNextY);

      const expRows = projectExpenses.map(e => {
        const targetLabour = labours.find(l => l.id === e.labourId);
        const payer = payers.find(p => p.id === e.payerId);
        const categoryLabel = e.category === 'labour_expense' ? 'Labour' : 'Misc';
        return [
          e.date,
          categoryLabel,
          targetLabour ? targetLabour.name : 'All Workers/Generic',
          e.description,
          payer ? payer.name : 'N/A',
          `Rs. ${e.amount.toLocaleString()}`
        ];
      });

      autoTable(doc, {
        head: [['Date', 'Category', 'Worker Linked', 'Description', 'Disbursed By', 'Amount']],
        body: expRows,
        startY: delaysNextY + 4,
        theme: 'striped',
        headStyles: { fillColor: [5, 150, 105] },
        styles: { fontSize: 8 },
      });
      finalExpensesY = ((doc as any).lastAutoTable?.finalY || finalExpensesY) + 12;
    }

    // 6b. Food & Boarding Outlays Section
    let foodNextY = finalExpensesY;
    if (useAutoFoodCalc) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("FOOD COST SUMMARY (AUTO MODE: Rs. 100/DAY PRESENT)", 14, foodNextY);

      const foodRows = labours.map(l => {
        const { cost, daysPresent } = getAttendanceFoodDaysAndCost(
          l,
          attendanceRecords,
          activeProject.id,
          foodCalculationStartDate,
          activeProject.startDate
        );
        return [
          l.name,
          l.joinedDate || activeProject.startDate,
          `${daysPresent} days`,
          `Rs. 100`,
          `Rs. ${cost.toLocaleString()}`
        ];
      }).filter(row => parseFloat(row[4].replace(/[^0-9.]/g, '')) > 0);

      autoTable(doc, {
        head: [['Worker Name', 'Coverage Start', 'Days Accounted', 'Rate Per Day', 'Total Food Cost']],
        body: foodRows,
        startY: foodNextY + 4,
        theme: 'striped',
        headStyles: { fillColor: [217, 119, 6] },
        styles: { fontSize: 8 },
      });
      foodNextY = ((doc as any).lastAutoTable?.finalY || foodNextY) + 12;
    } else if (pFoodLogs.length > 0) {
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(12);
      doc.text("CATERING & MEAL OUTLAYS (MANUAL LOGS)", 14, foodNextY);

      const foodRows = pFoodLogs.map(f => {
        const worker = labours.find(l => l.id === f.labourId);
        return [
          f.date,
          worker ? worker.name : 'Unknown Worker',
          `${f.mealsCount} meals`,
          `Rs. ${f.cost}`,
          `Rs. ${(f.mealsCount * f.cost).toLocaleString()}`,
          f.notes || 'N/A'
        ];
      });

      autoTable(doc, {
        head: [['Date', 'Worker Name', 'Meals Count', 'Cost Per Meal', 'Total Cost', 'Remarks/Notes']],
        body: foodRows,
        startY: foodNextY + 4,
        theme: 'striped',
        headStyles: { fillColor: [217, 119, 6] },
        styles: { fontSize: 8 },
      });
      foodNextY = ((doc as any).lastAutoTable?.finalY || foodNextY) + 12;
    }

    // 7. Appendix of Digital Receipts / Bill Snaps
    const pdfSnaps: { date: string; category: string; desc: string; amount: string; img: string; name: string }[] = [];

    projectMaterials.forEach(m => {
      if (m.billImage) {
        pdfSnaps.push({
          date: m.dateBought,
          category: 'Material Stock Purchase',
          desc: `${m.name} from ${m.supplier || 'Local Vendor'} (Qty: ${m.quantityBought} ${m.unit})`,
          amount: `Rs. ${m.cost.toLocaleString()}`,
          img: m.billImage,
          name: m.billImageName || 'material_bill_invoice.png'
        });
      }
    });

    projectExpenses.forEach(e => {
      if (e.receiptImage) {
        const targetLabour = labours.find(l => l.id === e.labourId);
        const payerName = payers.find(p => p.id === e.payerId)?.name || 'N/A';
        pdfSnaps.push({
          date: e.date,
          category: e.category === 'labour_expense' ? 'Labour Expense' : 'Misc Transaction',
          desc: `${e.description} (Paid by: ${payerName}${targetLabour ? `, Linked: ${targetLabour.name}` : ''})`,
          amount: `Rs. ${e.amount.toLocaleString()}`,
          img: e.receiptImage,
          name: e.receiptImageName || 'receipt_voucher.png'
        });
      }
    });

    if (pdfSnaps.length > 0) {
      doc.addPage();
      let currentY = 20;
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text("APPENDIX: BILL & RECEIPT SNAPSHOTS", 14, currentY);
      currentY += 6;
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Scanned digital vouchers linked to project transactions (${pdfSnaps.length} receipts attached).`, 14, currentY);
      currentY += 12;

      pdfSnaps.forEach((snap, idx) => {
        if (idx > 0 && idx % 2 === 0) {
          doc.addPage();
          currentY = 20;
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(15, 23, 42);
          doc.text("APPENDIX: BILL & RECEIPT SNAPSHOTS (CONT.)", 14, currentY);
          currentY += 15;
        }

        // Draw container
        doc.setFillColor(252, 252, 253);
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, currentY, 182, 112, "FD");

        // Write details
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`${idx + 1}. [${snap.category}]  ${snap.amount}`, 18, currentY + 7);

        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Date: ${snap.date}  |  Filename: ${snap.name}`, 18, currentY + 12);

        doc.setTextColor(71, 85, 105);
        const descText = snap.desc.length > 95 ? snap.desc.substring(0, 92) + "..." : snap.desc;
        doc.text(`Details: ${descText}`, 18, currentY + 17);

        // Add base64 image with safety guard
        try {
          doc.addImage(snap.img, "JPEG", 18, currentY + 22, 174, 84, undefined, 'FAST');
        } catch (imgErr) {
          try {
            doc.addImage(snap.img, "PNG", 18, currentY + 22, 174, 84, undefined, 'FAST');
          } catch (pngErr) {
            // Fallback when format not natively supported by jsPDF
            doc.setFillColor(241, 245, 249);
            doc.rect(18, currentY + 22, 174, 84, "F");
            doc.setFont("Helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(100, 116, 139);
            doc.text("[Scanned image attached but format requires screen-view/manual export]", 35, currentY + 60);
            doc.setFont("Helvetica", "normal");
            doc.text(`Filename: ${snap.name}`, 35, currentY + 66);
          }
        }

        currentY += 120;
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
      { Metric: "Cumulative Daily Expenses Cost (Rs.)", Value: totalDailyExpensesCost },
      { Metric: "Cumulative Food Outlays (Rs.)", Value: activeFoodCost },
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

    // Tab 6: Daily Expenses & Miscellaneous Transactions
    if (projectExpenses.length > 0) {
      const expenseExcelRows = projectExpenses.map(e => {
        const targetLabour = labours.find(l => l.id === e.labourId);
        const payer = payers.find(p => p.id === e.payerId);
        return {
          "Date": e.date,
          "Category": e.category === 'labour_expense' ? 'Labour Daily Expense' : 'General Misc Transaction',
          "Type": e.subCategory.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
          "Target Worker": targetLabour ? targetLabour.name : 'Broad Site / Generic',
          "Details / Purpose": e.description,
          "Paying Officer": payer ? payer.name : 'N/A',
          "Outlay Amount (Rs.)": e.amount
        };
      });
      const wsExpenses = XLSX.utils.json_to_sheet(expenseExcelRows);
      XLSX.utils.book_append_sheet(wb, wsExpenses, "Daily Expenses & Misc");
    }

    // Tab 7: Food & Boarding Ledger
    if (useAutoFoodCalc) {
      const foodExcelRows = labours.map(l => {
        const { cost, daysPresent } = getAttendanceFoodDaysAndCost(
          l,
          attendanceRecords,
          activeProject.id,
          foodCalculationStartDate,
          activeProject.startDate
        );
        return {
          "Worker Name": l.name,
          "Joined Date": l.joinedDate || activeProject.startDate,
          "Days Accounted": daysPresent,
          "Rate Per Day (Rs.)": 100,
          "Total Food Cost (Rs.)": cost
        };
      }).filter(row => row["Total Food Cost (Rs.)"] > 0);
      const wsFood = XLSX.utils.json_to_sheet(foodExcelRows);
      XLSX.utils.book_append_sheet(wb, wsFood, "Food Costs Ledger");
    } else if (pFoodLogs.length > 0) {
      const foodExcelRows = pFoodLogs.map(f => {
        const worker = labours.find(l => l.id === f.labourId);
        return {
          "Date": f.date,
          "Worker Name": worker ? worker.name : 'Unknown Worker',
          "Meals Count": f.mealsCount,
          "Cost Per Meal (Rs.)": f.cost,
          "Total Cost (Rs.)": f.mealsCount * f.cost,
          "Remarks / Notes": f.notes || "N/A"
        };
      });
      const wsFood = XLSX.utils.json_to_sheet(foodExcelRows);
      XLSX.utils.book_append_sheet(wb, wsFood, "Food Costs Ledger");
    }

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
      dailyExpenses
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
              Mat: ₹{totalMaterialCost.toLocaleString()} + Lab: ₹{totalWagesEarned.toLocaleString()} + Food: ₹{activeFoodCost.toLocaleString()} + Exp: ₹{totalDailyExpensesCost.toLocaleString()}
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

      {/* Food Outlays Calculation Mode Switcher */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            Food & Catering Cost Options
          </h4>
          <p className="text-xs text-slate-500">
            Choose how to compute worker boarding and food costs in your statements. Current calculation: <strong className="text-slate-700">₹{activeFoodCost.toLocaleString()}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1 shadow-xs shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setUseAutoFoodCalc(true)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              useAutoFoodCalc
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Auto Mode (₹100/day Present)
          </button>
          <button
            onClick={() => setUseAutoFoodCalc(false)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              !useAutoFoodCalc
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Manual Mode (Meal Logs)
          </button>
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

      {/* NEW: Unified Bill & Receipt Snaps Ledger with Print & Export Center */}
      {(() => {
        // Compile all active project snaps
        const uiSnaps: { id: string; date: string; category: string; desc: string; amount: string; numericAmount: number; img: string; name: string }[] = [];

        projectMaterials.forEach(m => {
          if (m.billImage) {
            uiSnaps.push({
              id: m.id,
              date: m.dateBought,
              category: 'Material Stock Purchase',
              desc: `${m.name} from ${m.supplier || 'Local Vendor'} (Qty: ${m.quantityBought} ${m.unit})`,
              amount: `₹${m.cost.toLocaleString('en-IN')}`,
              numericAmount: m.cost,
              img: m.billImage,
              name: m.billImageName || 'material_bill_invoice.png'
            });
          }
        });

        projectExpenses.forEach(e => {
          if (e.receiptImage) {
            const targetLabour = labours.find(l => l.id === e.labourId);
            const payerName = payers.find(p => p.id === e.payerId)?.name || 'N/A';
            uiSnaps.push({
              id: e.id,
              date: e.date,
              category: e.category === 'labour_expense' ? 'Labour Expense' : 'Misc Transaction',
              desc: `${e.description} (Paid by: ${payerName}${targetLabour ? `, Linked: ${targetLabour.name}` : ''})`,
              amount: `₹${e.amount.toLocaleString('en-IN')}`,
              numericAmount: e.amount,
              img: e.receiptImage,
              name: e.receiptImageName || 'receipt_voucher.png'
            });
          }
        });

        // Filter snaps
        const filteredUiSnaps = uiSnaps.filter(snap => {
          const matchesSearch = snap.desc.toLowerCase().includes(snapsSearch.toLowerCase()) || 
                                snap.category.toLowerCase().includes(snapsSearch.toLowerCase()) ||
                                snap.name.toLowerCase().includes(snapsSearch.toLowerCase());
          
          const matchesCat = snapsCategory === 'all' || 
                             (snapsCategory === 'materials' && snap.category === 'Material Stock Purchase') ||
                             (snapsCategory === 'expenses' && snap.category !== 'Material Stock Purchase');
          return matchesSearch && matchesCat;
        });

        const totalValueFilteredSnaps = filteredUiSnaps.reduce((sum, s) => sum + s.numericAmount, 0);

        // Individual print function
        const printSingleSnap = (snap: typeof uiSnaps[0]) => {
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            alert("Popup blocker prevented opening the print window. Please allow popups for this site.");
            return;
          }
          
          printWindow.document.write(`
            <html>
              <head>
                <title>Print Receipt - ${snap.name}</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    color: #1e293b;
                    padding: 40px;
                    max-width: 800px;
                    margin: 0 auto;
                  }
                  .header {
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 15px;
                    margin-bottom: 25px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  }
                  .title {
                    font-size: 24px;
                    font-weight: bold;
                    color: #0f172a;
                  }
                  .metadata-grid {
                    display: grid;
                    grid-template-cols: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 30px;
                    background-color: #f8fafc;
                    padding: 20px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                  }
                  .meta-item {
                    font-size: 14px;
                  }
                  .meta-label {
                    font-weight: bold;
                    color: #64748b;
                    text-transform: uppercase;
                    font-size: 11px;
                    letter-spacing: 0.5px;
                    margin-bottom: 4px;
                  }
                  .meta-value {
                    font-size: 15px;
                    font-weight: 600;
                    color: #334155;
                  }
                  .image-container {
                    text-align: center;
                    margin-top: 30px;
                    border: 2px solid #f1f5f9;
                    padding: 10px;
                    border-radius: 8px;
                    background-color: #fff;
                  }
                  .receipt-img {
                    max-width: 100%;
                    max-height: 520px;
                    object-fit: contain;
                    border-radius: 4px;
                  }
                  @media print {
                    body { padding: 20px; }
                    .no-print { display: none; }
                  }
                </style>
              </head>
              <body>
                <div class="header">
                  <div>
                    <div class="title">Receipt Voucher / Bill Snap</div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Construction Site Management System</div>
                  </div>
                  <button class="no-print" onclick="window.print()" style="background: #0f172a; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 600; cursor: pointer;">
                    Print This Page
                  </button>
                </div>
                
                <div class="metadata-grid">
                  <div class="meta-item">
                    <div class="meta-label">Category / Resource</div>
                    <div class="meta-value">${snap.category}</div>
                  </div>
                  <div class="meta-item">
                    <div class="meta-label">Outlay Date</div>
                    <div class="meta-value">${snap.date}</div>
                  </div>
                  <div class="meta-item" style="grid-column: span 2;">
                    <div class="meta-label">Purpose / Details</div>
                    <div class="meta-value">${snap.desc}</div>
                  </div>
                  <div class="meta-item">
                    <div class="meta-label">Amount Incurred</div>
                    <div class="meta-value" style="color: #0f172a; font-size: 18px; font-weight: 800;">${snap.amount}</div>
                  </div>
                  <div class="meta-item">
                    <div class="meta-label">Attachment Name</div>
                    <div class="meta-value" style="font-family: monospace; font-size: 12px; color: #64748b;">${snap.name}</div>
                  </div>
                </div>
                
                <div class="image-container">
                  <img class="receipt-img" src="${snap.img}" alt="Receipt Snapshot" />
                </div>
                
                <script>
                  window.onload = function() {
                    setTimeout(function() {
                      window.print();
                    }, 500);
                  };
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        };

        // Batch print function
        const printAllSnaps = (snapsList: typeof uiSnaps) => {
          const printWindow = window.open('', '_blank');
          if (!printWindow) {
            alert("Popup blocker prevented opening the print window. Please allow popups for this site.");
            return;
          }
          
          let htmlContent = `
            <html>
              <head>
                <title>Consolidated Receipts Print - ${activeProject.name}</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    color: #1e293b;
                    padding: 40px;
                    max-width: 800px;
                    margin: 0 auto;
                  }
                  .no-print {
                    background: #0f172a;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-weight: 600;
                    cursor: pointer;
                    margin-bottom: 30px;
                  }
                  .receipt-section {
                    page-break-after: always;
                    border-bottom: 2px dashed #cbd5e1;
                    padding-bottom: 40px;
                    margin-bottom: 40px;
                  }
                  .receipt-section:last-child {
                    page-break-after: avoid;
                    border-bottom: none;
                  }
                  .header {
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  }
                  .title {
                    font-size: 20px;
                    font-weight: bold;
                    color: #0f172a;
                  }
                  .metadata-grid {
                    display: grid;
                    grid-template-cols: 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 20px;
                    background-color: #f8fafc;
                    padding: 15px;
                    border-radius: 6px;
                    border: 1px solid #e2e8f0;
                  }
                  .meta-label {
                    font-weight: bold;
                    color: #64748b;
                    text-transform: uppercase;
                    font-size: 10px;
                    letter-spacing: 0.5px;
                    margin-bottom: 2px;
                  }
                  .meta-value {
                    font-size: 13px;
                    font-weight: 600;
                    color: #334155;
                  }
                  .image-container {
                    text-align: center;
                    border: 1px solid #f1f5f9;
                    padding: 8px;
                    border-radius: 6px;
                    background-color: #fff;
                  }
                  .receipt-img {
                    max-width: 100%;
                    max-height: 420px;
                    object-fit: contain;
                  }
                  @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                    .receipt-section {
                      border-bottom: none;
                      margin-bottom: 0;
                      padding-bottom: 0;
                    }
                  }
                </style>
              </head>
              <body>
                <div style="text-align: right;">
                  <button class="no-print" onclick="window.print()">Print Batch Ledger</button>
                </div>
                <div class="no-print" style="margin-bottom: 20px; font-size: 14px; color: #64748b;">
                  This batch ledger compiles all <strong>${snapsList.length}</strong> receipt snapshots uploaded for site <strong>${activeProject.name}</strong>. Trigger a print to export as physical documentation or digital PDF.
                </div>
          `;

          snapsList.forEach((snap, idx) => {
            htmlContent += `
              <div class="receipt-section">
                <div class="header">
                  <div class="title">Receipt ${idx + 1} of ${snapsList.length}: ${snap.category}</div>
                  <div style="font-size: 12px; color: #64748b;">Site: ${activeProject.name}</div>
                </div>
                
                <div class="metadata-grid">
                  <div>
                    <div class="meta-label">Transaction Type</div>
                    <div class="meta-value">${snap.category}</div>
                  </div>
                  <div>
                    <div class="meta-label">Transaction Date</div>
                    <div class="meta-value">${snap.date}</div>
                  </div>
                  <div style="grid-column: span 2;">
                    <div class="meta-label">Details / Purpose</div>
                    <div class="meta-value">${snap.desc}</div>
                  </div>
                  <div>
                    <div class="meta-label">Outlay Value</div>
                    <div class="meta-value" style="font-size: 15px; font-weight: 800; color: #0f172a;">${snap.amount}</div>
                  </div>
                  <div>
                    <div class="meta-label">Filename / Reference</div>
                    <div class="meta-value" style="font-family: monospace; font-size: 11px;">${snap.name}</div>
                  </div>
                </div>
                
                <div class="image-container">
                  <img class="receipt-img" src="${snap.img}" alt="Receipt Snapshot" />
                </div>
              </div>
            `;
          });

          htmlContent += `
                <script>
                  window.onload = function() {
                    setTimeout(function() {
                      window.print();
                    }, 600);
                  };
                </script>
              </body>
            </html>
          `;

          printWindow.document.write(htmlContent);
          printWindow.document.close();
        };

        return (
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                  <Image className="w-5 h-5 text-indigo-600" />
                  Digital Bills & Receipt Snaps Ledger
                </h3>
                <p className="text-slate-400 text-xs">
                  A unified audit-ready ledger consolidating all invoice scans, bills, and petty payment vouchers uploaded for active acquisitions and daily outlays.
                </p>
              </div>

              {filteredUiSnaps.length > 0 && (
                <button
                  onClick={() => printAllSnaps(filteredUiSnaps)}
                  className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-4 py-2 text-xs font-semibold shadow-xs cursor-pointer transition whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Filtered Batch ({filteredUiSnaps.length})
                </button>
              )}
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 border border-slate-100 p-3 rounded-lg">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search invoice details, names, files..."
                  value={snapsSearch}
                  onChange={(e) => setSnapsSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={snapsCategory}
                  onChange={(e) => setSnapsCategory(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  <option value="all">All Digital Snaps</option>
                  <option value="materials">Materials Purchased Bills Only</option>
                  <option value="expenses">Daily / Petty Expenses Vouchers Only</option>
                </select>
              </div>

              {/* Summary Stats */}
              <div className="flex items-center justify-end text-right font-mono text-[11px] text-slate-500 font-semibold pr-2">
                Showing {filteredUiSnaps.length} of {uiSnaps.length} snaps • Total: ₹{totalValueFilteredSnaps.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Grid display */}
            {filteredUiSnaps.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-100 rounded-lg bg-slate-50/20 space-y-2">
                <Image className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-slate-500 text-xs font-semibold">No digital bills or receipt snaps match your filters.</p>
                <p className="text-[10px] text-slate-400">
                  Upload invoice sheets under the <strong>Materials</strong> tab or voucher snapshots under <strong>Daily Expenses & Misc</strong> to populate this ledger.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUiSnaps.map((snap) => (
                  <div
                    key={snap.id}
                    className="border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition bg-slate-50/20 flex flex-col justify-between"
                  >
                    {/* Header bar */}
                    <div className="p-3 bg-white border-b border-slate-100 flex justify-between items-start gap-1">
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border font-sans mb-1 ${
                          snap.category === 'Material Stock Purchase'
                            ? 'bg-blue-50 border-blue-100 text-blue-700'
                            : 'bg-emerald-50 border-emerald-100 text-emerald-700'
                        }`}>
                          {snap.category === 'Material Stock Purchase' ? 'Material' : 'Expense'}
                        </span>
                        <div className="text-[10px] font-mono text-slate-400">{snap.date}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-slate-900 font-mono text-sm">{snap.amount}</div>
                      </div>
                    </div>

                    {/* Image View Area */}
                    <div className="relative group bg-slate-100 h-44 flex items-center justify-center p-2 overflow-hidden border-b border-slate-100">
                      <img src={snap.img} className="max-h-full object-contain transition group-hover:scale-[1.02] duration-200" alt={snap.name} />
                      <div className="absolute inset-0 bg-slate-950/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                        <button
                          onClick={() => setLightboxImage(snap)}
                          className="bg-white hover:bg-slate-100 text-slate-950 px-2.5 py-1.5 rounded-md text-[10px] font-bold shadow transition cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Expand
                        </button>
                        <button
                          onClick={() => printSingleSnap(snap)}
                          className="bg-slate-900 hover:bg-slate-850 text-white px-2.5 py-1.5 rounded-md text-[10px] font-bold shadow transition cursor-pointer flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          Print
                        </button>
                      </div>
                    </div>

                    {/* Description Area */}
                    <div className="p-3 bg-white space-y-2">
                      <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed" title={snap.desc}>
                        {snap.desc}
                      </p>
                      <div className="flex items-center justify-between text-[9px] text-slate-400 font-mono pt-1 border-t border-slate-50">
                        <span className="truncate max-w-[150px]" title={snap.name}>{snap.name}</span>
                        <button
                          onClick={() => printSingleSnap(snap)}
                          className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                        >
                          <Printer className="w-2.5 h-2.5" /> Print Voucher
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Lightbox Modal */}
            {lightboxImage && (
              <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
                <div className="relative bg-white rounded-xl overflow-hidden max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">
                        Scanned Snap: {lightboxImage.name}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {lightboxImage.category} • {lightboxImage.date}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => printSingleSnap(lightboxImage)}
                        className="inline-flex items-center gap-1 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-md px-3 py-1.5 font-bold cursor-pointer transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Receipt
                      </button>
                      <button
                        onClick={() => setLightboxImage(null)}
                        className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="p-5 overflow-auto flex-1 flex justify-center items-center bg-slate-100">
                    <img src={lightboxImage.src} className="max-w-full max-h-[58vh] object-contain rounded shadow-lg" alt="High Resolution Receipt" />
                  </div>
                  <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-1.5">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Associated Transaction Details</div>
                    <div className="text-xs text-slate-700 leading-relaxed bg-white border border-slate-200/60 p-2.5 rounded-lg flex justify-between items-center">
                      <div>{lightboxImage.desc}</div>
                      <div className="font-extrabold text-slate-950 text-sm font-mono shrink-0 pl-4">{lightboxImage.amount}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

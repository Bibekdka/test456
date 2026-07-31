/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Project, Labour, Attendance, Advance, Payment, Material, 
  GstRecord, SiteDiaryEntry, DelayWeatherLog, DailyExpense, 
  ProjectPhase, PettyCashEntry, ProjectDocument, HotelAdvance, FoodLog, Payer,
  getAttendanceFoodDaysAndCost, getLabourDaysWorked 
} from '../types';
import { getDocumentBlob } from '../db';

interface ZipExportOptions {
  projects: Project[];
  labours: Labour[];
  attendanceRecords: Attendance[];
  advanceRecords: Advance[];
  paymentRecords: Payment[];
  materials: Material[];
  gstRecords: GstRecord[];
  siteDiaries: SiteDiaryEntry[];
  delayWeatherLogs: DelayWeatherLog[];
  dailyExpenses: DailyExpense[];
  projectPhases: ProjectPhase[];
  pettyCashEntries: PettyCashEntry[];
  projectDocuments: ProjectDocument[];
  hotelAdvances?: HotelAdvance[];
  foodLogs?: FoodLog[];
  payers?: Payer[];
  onProgress?: (message: string) => void;
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'Worksite';
}

function convertToCSV(headers: string[], rows: (string | number)[][]): string {
  const escapeCell = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map(row => row.map(escapeCell).join(','));
  return [headerLine, ...rowLines].join('\n');
}

export async function exportCompleteSiteZip(options: ZipExportOptions): Promise<void> {
  const {
    projects,
    labours,
    attendanceRecords,
    advanceRecords,
    paymentRecords,
    materials,
    gstRecords,
    siteDiaries,
    delayWeatherLogs,
    dailyExpenses,
    projectPhases,
    pettyCashEntries,
    projectDocuments,
    hotelAdvances = [],
    foodLogs = [],
    payers = [],
    onProgress
  } = options;

  onProgress?.('Initializing ZIP Archive generation...');
  const zip = new JSZip();

  const nowIso = new Date().toISOString().split('T')[0];
  const rootFolderName = `Construction_Site_Master_Archive_${nowIso}`;
  const rootDir = zip.folder(rootFolderName) || zip;

  // 1. Add Complete JSON Backup at root
  onProgress?.('Generating Global JSON System Backup...');
  const globalBackupData = {
    exportDate: new Date().toISOString(),
    version: '2.0-proforma',
    projects,
    labours,
    attendanceRecords,
    advanceRecords,
    paymentRecords,
    materials,
    gstRecords,
    siteDiaries,
    delayWeatherLogs,
    dailyExpenses,
    projectPhases,
    pettyCashEntries,
    projectDocuments,
    hotelAdvances,
    foodLogs,
    payers
  };
  rootDir.file('System_Master_Database_Backup.json', JSON.stringify(globalBackupData, null, 2));

  // 2. Loop through each project and build structured folder
  for (let i = 0; i < projects.length; i++) {
    const proj = projects[i];
    const folderName = `${i + 1}_${sanitizeFolderName(proj.name)}`;
    onProgress?.(`Bundling data for project: ${proj.name} (${i + 1}/${projects.length})...`);
    
    const projFolder = rootDir.folder(folderName);
    if (!projFolder) continue;

    // Filter project-specific data
    const projMaterials = materials.filter(m => m.projectId === proj.id);
    const projDiaries = siteDiaries.filter(s => s.projectId === proj.id);
    const projDelays = delayWeatherLogs.filter(d => d.projectId === proj.id);
    const projPetty = pettyCashEntries.filter(p => p.projectId === proj.id);
    const projExpenses = dailyExpenses.filter(e => e.projectId === proj.id);
    const projGst = gstRecords.filter(g => g.projectId === proj.id);
    const projPhases = projectPhases.filter(p => p.projectId === proj.id);
    const projDocs = projectDocuments.filter(d => d.projectId === proj.id);

    // --- A. Project Summary Overview Text File ---
    const totalMatCost = projMaterials.reduce((sum, m) => sum + m.cost, 0);
    const totalExpCost = projExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalPettyCost = projPetty.filter(p => p.type === 'expense').reduce((sum, p) => sum + p.amount, 0);
    const totalGstPaid = projGst.filter(g => g.type === 'paid').reduce((sum, g) => sum + g.gstAmount, 0);

    const overviewTxt = `=====================================================
CONSTRUCTION WORK SITE SUMMARY REPORT
=====================================================
Site Name        : ${proj.name}
Description      : ${proj.description || 'N/A'}
Location         : ${proj.location || 'N/A'}
Start Date       : ${proj.startDate}
Target Completion: ${proj.targetDate}
Current Status   : ${proj.status.toUpperCase()}
Allocated Budget : Rs. ${proj.budget.toLocaleString()}

-----------------------------------------------------
FINANCIAL BREAKDOWN OVERVIEW
-----------------------------------------------------
- Material Costs Total  : Rs. ${totalMatCost.toLocaleString()}
- Site Daily Expenses   : Rs. ${totalExpCost.toLocaleString()}
- Supervisor Petty Cash : Rs. ${totalPettyCost.toLocaleString()}
- GST Paid on Purchases : Rs. ${totalGstPaid.toLocaleString()}
- Attached Blueprints   : ${projDocs.length} Document(s)
=====================================================
`;
    projFolder.file('00_Project_Overview_Summary.txt', overviewTxt);

    // --- B. CSV Data Exports Subfolder ---
    const csvFolder = projFolder.folder('Data_CSVs');
    if (csvFolder) {
      // 1. Materials Inventory CSV
      const matHeaders = ['Material Name', 'Quantity Bought', 'Unit', 'Cost (Rs)', 'Date Bought', 'Supplier', 'Alert Threshold', 'Usages Count'];
      const matRows = projMaterials.map(m => [
        m.name, m.quantityBought, m.unit, m.cost, m.dateBought, m.supplier || '', m.alertThreshold || 0, m.usages.length
      ]);
      csvFolder.file('Materials_Inventory.csv', convertToCSV(matHeaders, matRows));

      // 2. Labour Registry & Wages CSV
      const labHeaders = ['Worker Name', 'Daily Wage (Rs)', 'Contact', 'Status', 'Days Worked', 'Total Earned (Rs)', 'Advances Taken (Rs)', 'Amount Paid (Rs)', 'Balance Due (Rs)'];
      const labRows = labours.map(l => {
        const daysWorked = getLabourDaysWorked(l, attendanceRecords, proj.id, proj.startDate);
        const earned = daysWorked * l.perDayWage;
        const adv = advanceRecords.filter(a => a.labourId === l.id && a.projectId === proj.id).reduce((sum, a) => sum + a.amount, 0);
        const paid = paymentRecords.filter(p => p.labourId === l.id && p.projectId === proj.id).reduce((sum, p) => sum + p.amountPaid, 0);
        const balance = earned - adv - paid;
        return [l.name, l.perDayWage, l.contact, l.status, daysWorked, earned, adv, paid, balance];
      });
      csvFolder.file('Labour_Wages_and_Attendance.csv', convertToCSV(labHeaders, labRows));

      // 3. Site Diaries CSV
      const diaryHeaders = ['Date', 'Supervisor Name', 'Work Done Summary', 'Manpower Count', 'Safety Log', 'Remarks'];
      const diaryRows = projDiaries.map(d => [d.date, d.supervisorName, d.workDone, d.manpowerCount, d.safetyLog || '', d.remarks || '']);
      csvFolder.file('Site_Diaries.csv', convertToCSV(diaryHeaders, diaryRows));

      // 4. Delays & Weather CSV
      const delayHeaders = ['Date', 'Weather Condition', 'Temperature', 'Is Delay?', 'Delay Hours', 'Reason', 'Notes'];
      const delayRows = projDelays.map(d => [d.date, d.weather, d.temperature || '', d.isDelay ? 'Yes' : 'No', d.delayHours || 0, d.delayReason || '', d.delayNotes || '']);
      csvFolder.file('Delays_and_Weather.csv', convertToCSV(delayHeaders, delayRows));

      // 5. Petty Cash CSV
      const pettyHeaders = ['Date', 'Transaction Type', 'Supervisor Name', 'Amount (Rs)', 'Category', 'Description'];
      const pettyRows = projPetty.map(p => [p.date, p.type.toUpperCase(), p.supervisorName, p.amount, p.category || 'other', p.description]);
      csvFolder.file('Supervisor_Petty_Cash.csv', convertToCSV(pettyHeaders, pettyRows));

      // 6. GST Invoices CSV
      const gstHeaders = ['Date', 'Invoice No', 'Party Name', 'GSTIN', 'Taxable Amount (Rs)', 'GST Rate (%)', 'GST Amount (Rs)', 'Type'];
      const gstRows = projGst.map(g => [g.date, g.invoiceNo, g.partyName, g.gstin || '', g.amount, g.gstRate, g.gstAmount, g.type.toUpperCase()]);
      csvFolder.file('GST_Invoices.csv', convertToCSV(gstHeaders, gstRows));

      // 7. Gantt Construction Phases CSV
      const phaseHeaders = ['Phase Name', 'Start Date', 'End Date', 'Status', 'Progress (%)', 'Assigned Leader', 'Notes'];
      const phaseRows = projPhases.map(p => [p.name, p.startDate, p.endDate, p.status.toUpperCase(), p.progress, p.assignedLeader || '', p.notes || '']);
      csvFolder.file('Construction_Phases_Gantt.csv', convertToCSV(phaseHeaders, phaseRows));
    }

    // --- C. PDF Report Subfolder ---
    const pdfFolder = projFolder.folder('PDF_Reports');
    if (pdfFolder) {
      try {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text(`Construction Master Report - ${proj.name}`, 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleDateString()} | Site Budget: Rs. ${proj.budget.toLocaleString()}`, 14, 22);

        // Materials Table
        doc.setFontSize(12);
        doc.text('1. Material Procurement Ledger', 14, 32);
        autoTable(doc, {
          startY: 36,
          head: [['Material', 'Quantity', 'Cost (Rs)', 'Date', 'Supplier']],
          body: projMaterials.map(m => [m.name, `${m.quantityBought} ${m.unit}`, `Rs. ${m.cost.toLocaleString()}`, m.dateBought, m.supplier || 'N/A'])
        });

        // Site Diaries Table
        const diaryStartY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 100;
        if (diaryStartY < 250) {
          doc.setFontSize(12);
          doc.text('2. Recent Site Work Logs', 14, diaryStartY);
          autoTable(doc, {
            startY: diaryStartY + 4,
            head: [['Date', 'Supervisor', 'Work Executed', 'Workers']],
            body: projDiaries.map(d => [d.date, d.supervisorName, d.workDone.slice(0, 60) + '...', d.manpowerCount])
          });
        }

        const pdfArrayBuffer = doc.output('arraybuffer');
        pdfFolder.file('Site_Executive_Summary_Report.pdf', pdfArrayBuffer);
      } catch (err) {
        console.warn('PDF export fallback:', err);
      }
    }

    // --- D. Original Attached Documents & Blueprints Subfolder ---
    if (projDocs.length > 0) {
      const docFolder = projFolder.folder('Contract_Files_and_Blueprints');
      if (docFolder) {
        for (const docItem of projDocs) {
          onProgress?.(`Fetching document blob: ${docItem.name}...`);
          let dataUrl = docItem.dataUrl;
          if (!dataUrl) {
            dataUrl = await getDocumentBlob(docItem.id);
          }

          if (dataUrl && dataUrl.includes('base64,')) {
            const base64Content = dataUrl.split('base64,')[1];
            const cleanFileName = docItem.fileName || `${docItem.name.replace(/[^a-zA-Z0-9_.-]/g, '_')}.${docItem.fileType || 'pdf'}`;
            docFolder.file(cleanFileName, base64Content, { base64: true });
          } else if (docItem.notes || docItem.aiSummary) {
            // Text fallback metadata file if base64 dataUrl is missing
            const metaTxt = `Document Title: ${docItem.name}\nCategory: ${docItem.category}\nUploaded: ${docItem.uploadedAt}\nNotes: ${docItem.notes || ''}\nAI Insights: ${docItem.aiSummary || ''}`;
            docFolder.file(`${sanitizeFolderName(docItem.name)}_Metadata.txt`, metaTxt);
          }
        }
      }
    }
  }

  onProgress?.('Compressing ZIP package into downloadable file...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });

  // Trigger download in browser
  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipBlob);
  link.download = `Construction_Site_Master_Archive_${nowIso}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  onProgress?.('Complete Site Data Archive (.ZIP) exported successfully!');
}

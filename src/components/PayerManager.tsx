import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  Tooltip as RechartsTooltip, 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Payer, Project, Advance, Payment, DailyExpense, HotelAdvance, Material, GstRecord, PettyCashEntry, PartnerDeal, Labour } from '../types';
import { generateId } from '../utils/id';
import { calculateConsolidatedPayerFinancials } from '../utils/payerFinancials';
import { matchPayerOrLabour, parsePartnerSupportName } from '../utils/payerResolver';
import { cleanEntityName, extractDigits } from '../utils/formatters';
import { 
  Users, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  UserCheck, 
  DollarSign, 
  Briefcase, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Phone, 
  Tag, 
  X, 
  Check, 
  PieChart, 
  Building2, 
  Receipt, 
  Truck, 
  Utensils, 
  Wallet, 
  Calendar, 
  Download,
  AlertCircle,
  Trophy,
  Award,
  TrendingUp,
  BarChart3,
  ArrowUpDown,
  SlidersHorizontal,
  Zap,
  Hash,
  LineChart as LineChartIcon,
  Activity,
  FileSpreadsheet,
  Printer
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface PayerManagerProps {
  payers: Payer[];
  projects: Project[];
  advanceRecords: Advance[];
  paymentRecords: Payment[];
  dailyExpenses: DailyExpense[];
  hotelAdvances: HotelAdvance[];
  materials: Material[];
  gstRecords: GstRecord[];
  pettyCashEntries?: PettyCashEntry[];
  partnerDeals?: PartnerDeal[];
  labours?: Labour[];
  activeProjectId: string | null;
  onAddPayer: (payer: Payer) => Promise<void>;
  onUpdatePayer: (payer: Payer) => Promise<void>;
  onDeletePayer: (id: string) => Promise<void>;
}

export default function PayerManager({
  payers,
  projects,
  advanceRecords,
  paymentRecords,
  dailyExpenses,
  hotelAdvances,
  materials,
  gstRecords,
  pettyCashEntries = [],
  partnerDeals = [],
  labours = [],
  activeProjectId,
  onAddPayer,
  onUpdatePayer,
  onDeletePayer
}: PayerManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [expandedPayerId, setExpandedPayerId] = useState<string | null>(null);
  const [hoveredBreakdownPayerId, setHoveredBreakdownPayerId] = useState<string | null>(null);

  // Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPayer, setEditingPayer] = useState<Payer | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('Partner / Investor');
  const [customRole, setCustomRole] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation state
  const [deletingPayerId, setDeletingPayerId] = useState<string | null>(null);

  // Calculate detailed financials per Payer using consolidated utility
  const payerFinancials = useMemo(() => {
    return calculateConsolidatedPayerFinancials({
      payers,
      projects,
      advanceRecords,
      paymentRecords,
      dailyExpenses,
      hotelAdvances,
      materials,
      gstRecords,
      pettyCashEntries,
      partnerDeals,
      labours
    });
  }, [payers, projects, advanceRecords, paymentRecords, dailyExpenses, hotelAdvances, materials, gstRecords, pettyCashEntries, partnerDeals, labours]);

  // Overall Statistics
  const totalOutlayAcrossAll = useMemo(() => {
    return payerFinancials.reduce((sum, p) => sum + p.totalDisbursed, 0);
  }, [payerFinancials]);

  const topDisburser = useMemo(() => {
    if (payerFinancials.length === 0) return null;
    return payerFinancials[0];
  }, [payerFinancials]);

  // Filtered Payers List for Display
  const filteredPayers = useMemo(() => {
    return payerFinancials.filter(p => {
      const matchesSearch = !searchTerm.trim() || 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.role && p.role.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.phone && p.phone.includes(searchTerm));

      const matchesProject = projectFilter === 'all' || p.projectAmounts.has(projectFilter);

      return matchesSearch && matchesProject;
    });
  }, [payerFinancials, searchTerm, projectFilter]);

  // Color Palette for Pie Chart Slices
  const PAYER_PIE_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#3b82f6', // Blue
    '#ec4899', // Pink
    '#8b5cf6', // Purple
    '#f97316', // Orange
    '#06b6d4', // Cyan
    '#14b8a6', // Teal
    '#64748b'  // Slate
  ];

  // Calculate Pie Chart Data for spending distribution by payer
  const pieChartData = useMemo(() => {
    const activeFinancials = filteredPayers.map(p => {
      let amount = p.totalDisbursed;
      let txs = p.transactions;
      if (projectFilter !== 'all') {
        amount = p.projectAmounts.get(projectFilter) || 0;
        txs = txs.filter(t => t.projectId === projectFilter);
      }
      return {
        ...p,
        disbursedAmount: amount,
        filteredTransactions: txs
      };
    }).filter(p => p.disbursedAmount > 0);

    const total = activeFinancials.reduce((sum, p) => sum + p.disbursedAmount, 0);

    if (total === 0) return { data: [], total: 0 };

    const data = activeFinancials.map((p, idx) => {
      const percentage = (p.disbursedAmount / total) * 100;

      // Group by site
      const siteBreakdown: Array<{ name: string; amount: number; percentage: number }> = [];
      p.projectAmounts.forEach((amt, pId) => {
        if (projectFilter !== 'all' && pId !== projectFilter) return;
        if (amt > 0) {
          const prj = projects.find(pr => pr.id === pId);
          siteBreakdown.push({
            name: prj?.name || 'Main Site',
            amount: amt,
            percentage: Number(((amt / p.disbursedAmount) * 100).toFixed(1))
          });
        }
      });
      siteBreakdown.sort((a, b) => b.amount - a.amount);

      // Group by category dynamically from filtered transactions
      const catMap = new Map<string, number>();
      p.filteredTransactions.forEach(t => {
        const catName = t.category || 'Other Payments';
        catMap.set(catName, (catMap.get(catName) || 0) + t.amount);
      });
      const categoryBreakdown = Array.from(catMap.entries()).map(([catName, amt]) => ({
        name: catName,
        amount: amt,
        percentage: p.disbursedAmount > 0 ? Number(((amt / p.disbursedAmount) * 100).toFixed(1)) : 0
      })).sort((a, b) => b.amount - a.amount);

      return {
        id: p.id,
        name: p.name,
        role: p.role || 'Authorized Payer',
        value: p.disbursedAmount,
        percentage: Number(percentage.toFixed(1)),
        color: PAYER_PIE_COLORS[idx % PAYER_PIE_COLORS.length],
        siteBreakdown,
        categoryBreakdown,
        recentTransactions: p.filteredTransactions.slice(0, 6)
      };
    });

    return { data, total };
  }, [filteredPayers, projectFilter, projects]);

  // Analytics View Mode & Sorting State
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'all' | 'pie' | 'trend' | 'comparison'>('all');
  const [rankSortBy, setRankSortBy] = useState<'amount' | 'count' | 'avg'>('amount');

  // Helper to safely format YYYY-MM-DD date strings without timezone shifts
  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (y && m && d) {
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
      }
    }
    return dateStr;
  };

  // Helper to parse date to Year-Month key and label safely without UTC shifts
  const getYearMonthInfo = (dateStr: string) => {
    if (!dateStr) return null;
    const cleanDateStr = dateStr.split('T')[0];
    const parts = cleanDateStr.split('-');
    if (parts.length < 2) return null;
    const yyyy = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10) - 1;
    if (isNaN(yyyy) || isNaN(mm) || mm < 0 || mm > 11) return null;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const label = `${monthNames[mm]} '${String(yyyy).slice(-2)}`;
    return {
      key: `${yyyy}-${String(mm + 1).padStart(2, '0')}`,
      label,
      sortVal: yyyy * 100 + (mm + 1)
    };
  };

  // Compute Monthly Expenditure Trend Data per Payer
  const monthlyTrendData = useMemo(() => {
    const monthMap: Record<string, { key: string; label: string; sortVal: number; total: number; [payerName: string]: any }> = {};
    
    // Active payers with non-zero disbursed amount for current site filter
    const activePayers = filteredPayers
      .filter(p => {
        if (projectFilter === 'all') return p.totalDisbursed > 0;
        return (p.projectAmounts.get(projectFilter) || 0) > 0;
      })
      .map((p, idx) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        color: PAYER_PIE_COLORS[idx % PAYER_PIE_COLORS.length]
      }));

    filteredPayers.forEach(p => {
      let txs = p.transactions;
      if (projectFilter !== 'all') {
        txs = txs.filter(t => t.projectId === projectFilter);
      }
      txs.forEach(t => {
        if (!t.date) return;
        const info = getYearMonthInfo(t.date);
        if (!info) return;

        if (!monthMap[info.key]) {
          monthMap[info.key] = {
            key: info.key,
            label: info.label,
            sortVal: info.sortVal,
            total: 0
          };
          activePayers.forEach(ap => {
            monthMap[info.key][ap.name] = 0;
          });
        }

        monthMap[info.key][p.name] = (monthMap[info.key][p.name] || 0) + t.amount;
        monthMap[info.key].total += t.amount;
      });
    });

    const sortedMonths = Object.values(monthMap).sort((a, b) => a.sortVal - b.sortVal);

    // Peak Month & Top Disburser Stats
    let peakMonth = { label: 'None', total: 0, topPayer: 'None', topPayerAmt: 0 };
    sortedMonths.forEach(m => {
      if (m.total > peakMonth.total) {
        let topP = 'None';
        let topAmt = 0;
        activePayers.forEach(p => {
          const amt = m[p.name] || 0;
          if (amt > topAmt) {
            topAmt = amt;
            topP = p.name;
          }
        });
        peakMonth = { label: m.label, total: m.total, topPayer: topP, topPayerAmt: topAmt };
      }
    });

    return {
      months: sortedMonths,
      activePayers,
      peakMonth
    };
  }, [filteredPayers, projectFilter]);

  // Compute Ranking and Comparison Matrix Data
  const rankedPayersList = useMemo(() => {
    const list = filteredPayers.map(p => {
      let amount = p.totalDisbursed;
      let transactions = p.transactions;
      if (projectFilter !== 'all') {
        transactions = p.transactions.filter(t => t.projectId === projectFilter);
        amount = p.projectAmounts.get(projectFilter) || 0;
      }
      const count = transactions.length;
      const avgTicket = count > 0 ? Math.round(amount / count) : 0;
      const totalSiteOutlay = pieChartData.total;
      const percentage = totalSiteOutlay > 0 ? (amount / totalSiteOutlay) * 100 : 0;

      // Calculate dominant expense category
      const catMap: Record<string, number> = {};
      transactions.forEach(t => {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
      });
      let topCategory = 'None';
      let maxCatAmt = 0;
      Object.entries(catMap).forEach(([cat, amt]) => {
        if (amt > maxCatAmt) {
          maxCatAmt = amt;
          topCategory = cat;
        }
      });

      return {
        id: p.id,
        name: p.name,
        role: p.role || 'Authorized Disburser',
        phone: p.phone,
        totalAmount: amount,
        transactionCount: count,
        avgTicket,
        percentage: Number(percentage.toFixed(1)),
        dominantCategory: topCategory,
        dominantCategoryAmount: maxCatAmt
      };
    }).filter(p => p.totalAmount > 0 || p.transactionCount > 0);

    // Sort based on selected metric
    return [...list].sort((a, b) => {
      if (rankSortBy === 'amount') {
        return b.totalAmount - a.totalAmount || b.transactionCount - a.transactionCount;
      } else if (rankSortBy === 'count') {
        return b.transactionCount - a.transactionCount || b.totalAmount - a.totalAmount;
      } else {
        return b.avgTicket - a.avgTicket || b.totalAmount - a.totalAmount;
      }
    });
  }, [filteredPayers, projectFilter, pieChartData.total, rankSortBy]);

  // Highlights: Top Contributor, Most Active, Highest Avg
  const topHighlights = useMemo(() => {
    if (rankedPayersList.length === 0) return null;
    const byAmount = [...rankedPayersList].sort((a, b) => b.totalAmount - a.totalAmount)[0];
    const byCount = [...rankedPayersList].sort((a, b) => b.transactionCount - a.transactionCount)[0];
    const byAvg = [...rankedPayersList].sort((a, b) => b.avgTicket - a.avgTicket)[0];
    return { byAmount, byCount, byAvg };
  }, [rankedPayersList]);

  // Combined itemized transactions across all filtered disbursers for export & print
  const allFilteredTransactions = useMemo(() => {
    const list: Array<{
      id: string;
      payerName: string;
      payerRole: string;
      date: string;
      category: string;
      projectId: string;
      projectName: string;
      description: string;
      amount: number;
    }> = [];

    filteredPayers.forEach(p => {
      let txs = p.transactions;
      if (projectFilter !== 'all') {
        txs = txs.filter(t => t.projectId === projectFilter);
      }
      txs.forEach(t => {
        list.push({
          id: t.id,
          payerName: p.name,
          payerRole: p.role || 'Authorized Disburser',
          date: t.date,
          category: t.category,
          projectId: t.projectId,
          projectName: t.projectName,
          description: t.description,
          amount: t.amount
        });
      });
    });

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredPayers, projectFilter]);

  // EXPORT ALL METRICS TO PDF REPORT
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const currentProjectName = projectFilter === 'all' 
        ? 'All Construction Sites' 
        : projects.find(p => p.id === projectFilter)?.name || 'Selected Site';

      const exportDateStr = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      // 1. Header Title Banner
      doc.setFillColor(30, 41, 59); // Slate-800
      doc.rect(0, 0, 210, 26, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('AUTHORIZED PAYER & DISBURSER FINANCIAL REPORT', 14, 11);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Site Context: ${currentProjectName}  |  Generated: ${exportDateStr}`, 14, 19);

      let startY = 32;

      // 2. Executive Key Metrics Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      doc.text('1. Executive Financial Summary', 14, startY);
      startY += 4;

      const summaryData = [
        ['Total Disbursed Outlays', `₹${pieChartData.total.toLocaleString('en-IN')}`],
        ['Active Disbursers Count', `${rankedPayersList.length} Authorized Payers`],
        ['Top Capital Disburser', `${topHighlights?.byAmount ? `${topHighlights.byAmount.name} (₹${topHighlights.byAmount.totalAmount.toLocaleString('en-IN')} - ${topHighlights.byAmount.percentage}%)` : 'N/A'}`],
        ['Peak Spending Month', `${monthlyTrendData.peakMonth.label || 'N/A'} (₹${monthlyTrendData.peakMonth.total.toLocaleString('en-IN')} by ${monthlyTrendData.peakMonth.topPayer || 'N/A'})`],
        ['Total Disbursed Transactions', `${allFilteredTransactions.length} itemized outlays`]
      ];

      autoTable(doc, {
        startY: startY,
        head: [['Key Metric Indicator', 'Financial Value / Detail']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
        bodyStyles: { fontSize: 8, textColor: 30 },
        columnStyles: { 0: { cellWidth: 65, fontStyle: 'bold' }, 1: { cellWidth: 'auto' } },
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 7;

      // 3. Disburser Leaderboard & Contribution Matrix
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(30, 41, 59);
      doc.text('2. Disburser Volume & Contribution Leaderboard', 14, startY);
      startY += 4;

      const leaderboardRows = rankedPayersList.map((p, idx) => [
        `#${idx + 1}`,
        p.name,
        p.role,
        `₹${p.totalAmount.toLocaleString('en-IN')}`,
        `${p.percentage}%`,
        `${p.transactionCount} entries`,
        `₹${p.avgTicket.toLocaleString('en-IN')}`,
        p.dominantCategory
      ]);

      autoTable(doc, {
        startY: startY,
        head: [['Rank', 'Payer Name', 'Designation / Role', 'Total Outlay (₹)', 'Share %', 'Trx Count', 'Avg/Trx (₹)', 'Top Category']],
        body: leaderboardRows,
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: 30 },
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 7;

      // Check page space for Monthly Trends
      if (startY > 230) {
        doc.addPage();
        startY = 16;
      }

      // 4. Monthly Expenditure Trends Matrix
      if (monthlyTrendData.months.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        doc.text('3. Monthly Expenditure Trends Matrix', 14, startY);
        startY += 4;

        const activePayerNames = monthlyTrendData.activePayers.map(ap => ap.name);
        const trendHeaders = ['Month', 'Total Outlay (₹)', ...activePayerNames];

        const trendRows = monthlyTrendData.months.map(m => {
          const row = [m.label, `₹${m.total.toLocaleString('en-IN')}`];
          activePayerNames.forEach(pName => {
            const val = m[pName] || 0;
            row.push(val > 0 ? `₹${val.toLocaleString('en-IN')}` : '—');
          });
          return row;
        });

        autoTable(doc, {
          startY: startY,
          head: [trendHeaders],
          body: trendRows,
          theme: 'grid',
          headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 7, textColor: 30 },
          margin: { left: 14, right: 14 }
        });

        startY = (doc as any).lastAutoTable.finalY + 7;
      }

      // Check page space for Itemized Log
      if (startY > 220) {
        doc.addPage();
        startY = 16;
      }

      // 5. Itemized Transactions Ledger
      if (allFilteredTransactions.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        doc.text('4. Itemized Disburser Outlays Log', 14, startY);
        startY += 4;

        const trxRows = allFilteredTransactions.map(t => [
          formatDateSafe(t.date),
          t.payerName,
          t.category,
          t.projectName,
          t.description,
          `₹${t.amount.toLocaleString('en-IN')}`
        ]);

        autoTable(doc, {
          startY: startY,
          head: [['Date', 'Disburser Name', 'Category', 'Construction Site', 'Description / Detail', 'Amount (₹)']],
          body: trxRows,
          theme: 'striped',
          headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 7, textColor: 30 },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 30 },
            2: { cellWidth: 26 },
            3: { cellWidth: 30 },
            4: { cellWidth: 'auto' },
            5: { cellWidth: 24, fontStyle: 'bold', halign: 'right' }
          },
          margin: { left: 14, right: 14 }
        });
      }

      // Page Numbers Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Authorized Payer Financial Analytics • Page ${i} of ${pageCount}`,
          105,
          290,
          { align: 'center' }
        );
      }

      const cleanProjectName = currentProjectName.replace(/[^a-zA-Z0-9]/g, '_');
      doc.save(`Payer_Financial_Report_${cleanProjectName}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF report: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // EXPORT ALL METRICS TO EXCEL (.XLSX) WORKBOOK
  const handleExportExcel = () => {
    try {
      const currentProjectName = projectFilter === 'all' 
        ? 'All Construction Sites' 
        : projects.find(p => p.id === projectFilter)?.name || 'Selected Site';

      const wb = XLSX.utils.book_new();

      // Sheet 1: Executive Overview & Leaderboard
      const overviewData = [
        ['AUTHORIZED PAYER & DISBURSER FINANCIAL ANALYTICS REPORT'],
        [`Site Context: ${currentProjectName}`],
        [`Generated On: ${new Date().toLocaleString('en-IN')}`],
        [],
        ['EXECUTIVE KEY METRICS'],
        ['Total Disbursed Outlays (INR)', pieChartData.total],
        ['Total Active Disbursers', rankedPayersList.length],
        ['Top Disburser Name', topHighlights?.byAmount?.name || 'N/A'],
        ['Top Disburser Amount (INR)', topHighlights?.byAmount?.totalAmount || 0],
        ['Peak Spending Month', monthlyTrendData.peakMonth.label || 'N/A'],
        ['Peak Month Total Outlay (INR)', monthlyTrendData.peakMonth.total],
        ['Total Itemized Outlays Logged', allFilteredTransactions.length],
        [],
        ['DISBURSER CONTRIBUTION & RANKING LEADERBOARD'],
        ['Rank', 'Disburser Name', 'Designation / Role', 'Phone', 'Total Outlay (INR)', 'Contribution Share (%)', 'Transactions Count', 'Avg Ticket Size (INR)', 'Dominant Expense Category', 'Top Category Outlay (INR)']
      ];

      rankedPayersList.forEach((p, idx) => {
        overviewData.push([
          idx + 1,
          p.name,
          p.role,
          p.phone || 'N/A',
          p.totalAmount,
          p.percentage,
          p.transactionCount,
          p.avgTicket,
          p.dominantCategory,
          p.dominantCategoryAmount
        ]);
      });

      const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
      wsOverview['!cols'] = [
        { wch: 8 },  // Rank
        { wch: 22 }, // Name
        { wch: 22 }, // Role
        { wch: 15 }, // Phone
        { wch: 20 }, // Total Outlay
        { wch: 14 }, // Share %
        { wch: 16 }, // Trx Count
        { wch: 18 }, // Avg Ticket
        { wch: 24 }, // Category
        { wch: 22 }  // Top Cat Amt
      ];
      XLSX.utils.book_append_sheet(wb, wsOverview, 'Executive Overview');

      // Sheet 2: Monthly Trends Matrix
      if (monthlyTrendData.months.length > 0) {
        const activePayerNames = monthlyTrendData.activePayers.map(ap => ap.name);
        const trendHeader = ['Month', 'Total Site Outlay (INR)', ...activePayerNames];
        const trendRows: any[][] = [
          ['MONTHLY EXPENDITURE TRENDS PER DISBURSER'],
          [`Site Context: ${currentProjectName}`],
          [],
          trendHeader
        ];

        monthlyTrendData.months.forEach(m => {
          const row = [m.label, m.total];
          activePayerNames.forEach(pName => {
            row.push(m[pName] || 0);
          });
          trendRows.push(row);
        });

        const wsTrends = XLSX.utils.aoa_to_sheet(trendRows);
        wsTrends['!cols'] = [{ wch: 14 }, { wch: 22 }, ...activePayerNames.map(() => ({ wch: 18 }))];
        XLSX.utils.book_append_sheet(wb, wsTrends, 'Monthly Trends');
      }

      // Sheet 3: Itemized Outlays Log
      const trxHeader = ['Date', 'Disburser Name', 'Category', 'Construction Site', 'Description / Details', 'Amount (INR)'];
      const trxRows: any[][] = [
        ['ITEMIZED DISBURSER TRANSACTIONS LEDGER'],
        [`Site Context: ${currentProjectName}`],
        [],
        trxHeader
      ];

      allFilteredTransactions.forEach(t => {
        trxRows.push([
          formatDateSafe(t.date),
          t.payerName,
          t.category,
          t.projectName,
          t.description,
          t.amount
        ]);
      });

      const wsTrx = XLSX.utils.aoa_to_sheet(trxRows);
      wsTrx['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 22 }, { wch: 38 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, wsTrx, 'Itemized Ledger');

      const cleanProjectName = currentProjectName.replace(/[^a-zA-Z0-9]/g, '_');
      XLSX.writeFile(wb, `Payer_Financial_Analytics_${cleanProjectName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Excel export failed:', err);
      alert('Failed to generate Excel sheet: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // PRINT FULL REPORT
  const handlePrintReport = () => {
    window.print();
  };

  // Open Add Payer Modal
  const handleOpenAddForm = () => {
    setEditingPayer(null);
    setName('');
    setRole('Partner / Investor');
    setCustomRole('');
    setPhone('');
    setNotes('');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Edit Payer Modal
  const handleOpenEditForm = (p: Payer) => {
    setEditingPayer(p);
    setName(p.name);
    
    const standardRoles = ['Partner / Investor', 'Site Engineer / Supervisor', 'Company Director', 'Cashier / Account', 'Subcontractor Head'];
    if (p.role && standardRoles.includes(p.role)) {
      setRole(p.role);
      setCustomRole('');
    } else {
      setRole('custom_role');
      setCustomRole(p.role || '');
    }

    setPhone(p.phone || '');
    setNotes((p as any).notes || '');
    setFormError(null);
    setIsFormOpen(true);
  };

  // Submit Add / Edit Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Payer name is required.');
      return;
    }

    const finalRole = role === 'custom_role' ? customRole.trim() : role;

    if (editingPayer) {
      const updated: Payer = {
        ...editingPayer,
        name: name.trim(),
        role: finalRole || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined
      };
      await onUpdatePayer(updated);
    } else {
      const newPayer: Payer = {
        id: generateId('pyr'),
        name: name.trim(),
        role: finalRole || 'Partner / Investor',
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined
      };
      await onAddPayer(newPayer);
    }

    setIsFormOpen(false);
  };

  // Handle Delete Payer
  const handleConfirmDelete = async () => {
    if (deletingPayerId) {
      await onDeletePayer(deletingPayerId);
      setDeletingPayerId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* INTERACTIVE SCREEN UI (Hidden when printing) */}
      <div className="print:hidden space-y-6">
        {/* HEADER BAR */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-600/80 text-white shadow-xs">
                <UserCheck className="w-6 h-6" />
              </span>
              <h2 className="text-xl font-extrabold tracking-tight text-white">Authorized Payer & Investor Outlay Management</h2>
            </div>
            <p className="text-xs text-indigo-200/90 leading-relaxed max-w-2xl">
              Authorize partners, site supervisors, or company accounts; track every micro-advance, wage settlement, material order, and operational outlay attributed to each individual disburser.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* EXPORT & PRINT BUTTONS TOOLBAR */}
            <div className="flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/80 text-xs">
              <button
                type="button"
                onClick={handleExportPDF}
                title="Export Complete Financial Analytics Report as PDF"
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span> PDF
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                title="Export All Analytics, Trends & Ledgers to Excel Sheet (.xlsx)"
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export</span> Excel
              </button>
              <button
                type="button"
                onClick={handlePrintReport}
                title="Print Complete Payer & Financial Analytics Report"
                className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleOpenAddForm}
              className="inline-flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-400 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg transition cursor-pointer shrink-0 border border-indigo-400/30"
            >
              <Plus className="w-4 h-4" />
              <span>+ Register Authorized Payer</span>
            </button>
          </div>
        </div>

        {/* OVERVIEW STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">Total Disbursed Outlays</span>
            <span className="text-xl font-mono font-bold text-emerald-400">₹{totalOutlayAcrossAll.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400 block font-mono">Across all construction sites</span>
          </div>

          <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">Authorized Payers</span>
            <span className="text-xl font-mono font-bold text-white">{payers.length} Profiles</span>
            <span className="text-[10px] text-slate-400 block font-mono">{payerFinancials.length} Active Disbursers</span>
          </div>

          <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">Top Disburser</span>
            <span className="text-sm font-bold text-white truncate block">{topDisburser ? topDisburser.name : 'N/A'}</span>
            <span className="text-xs font-mono font-semibold text-emerald-400 block">
              {topDisburser ? `₹${topDisburser.totalDisbursed.toLocaleString()}` : '₹0'}
            </span>
          </div>

          <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">Active Sites Covered</span>
            <span className="text-xl font-mono font-bold text-white">{projects.length} Sites</span>
            <span className="text-[10px] text-slate-400 block font-mono">Multi-project financial ledger</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search payer name, role, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter by Project & View Mode Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 w-full sm:w-auto">
          {/* Analytics View Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setAnalyticsViewMode('all')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                analyticsViewMode === 'all'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Full Analytics</span>
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsViewMode('pie')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                analyticsViewMode === 'pie'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" />
              <span>Pie Shares</span>
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsViewMode('trend')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                analyticsViewMode === 'trend'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              <span>Monthly Trends</span>
            </button>
            <button
              type="button"
              onClick={() => setAnalyticsViewMode('comparison')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                analyticsViewMode === 'comparison'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Rankings</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Construction Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* VISUAL SPENDING BREAKDOWN PIE CHART */}
      {(analyticsViewMode === 'all' || analyticsViewMode === 'pie') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Spending Contribution Breakdown by Payer</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {projectFilter === 'all' 
                  ? 'Percentage of total site expenses contributed by each disburser across all active projects.' 
                  : `Percentage contribution breakdown for ${projects.find(p => p.id === projectFilter)?.name || 'selected site'}.`}
              </p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 px-3 py-1.5 rounded-xl text-xs font-mono font-bold shrink-0 self-start sm:self-auto flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans">Total Outlays:</span>
              <span>₹{pieChartData.total.toLocaleString()}</span>
            </div>
          </div>

          {pieChartData.total === 0 ? (
            <div className="py-10 text-center space-y-2">
              <PieChart className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                No expense outlays attributed to an authorized payer in this filter view.
              </p>
              <p className="text-[11px] text-slate-400">
                Assign a disburser / payer when logging wage payouts, material orders, daily expenses, or advances to see visual contribution charts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center pt-2">
              {/* PIE CHART CONTAINER */}
              <div className="md:col-span-5 h-[230px] relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={pieChartData.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieChartData.data.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} stroke="none" />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 text-xs space-y-2 max-w-[300px]">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-2 gap-2">
                                <div className="font-bold text-indigo-300 flex items-center gap-1.5 min-w-0">
                                  <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: data.color }} />
                                  <span className="truncate">{data.name}</span>
                                </div>
                                <span className="text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded shrink-0">
                                  {data.percentage}% Share
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-400 text-[10px]">Total Outlay Invested:</span>
                                <span className="font-mono text-emerald-400 font-extrabold text-sm">₹{data.value.toLocaleString()}</span>
                              </div>

                              {/* SPENDING BY CHANNEL */}
                              {data.categoryBreakdown && data.categoryBreakdown.length > 0 && (
                                <div className="space-y-1 pt-1.5 border-t border-slate-800">
                                  <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Spending Channels:</div>
                                  <div className="space-y-1">
                                    {data.categoryBreakdown.map((cat: any, i: number) => (
                                      <div key={i} className="flex items-center justify-between text-[11px] font-mono">
                                        <span className="text-slate-300 truncate max-w-[160px]">{cat.name}</span>
                                        <span className="text-white font-bold">₹{cat.amount.toLocaleString()}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* RECENT OUTLAYS LIST */}
                              {data.recentTransactions && data.recentTransactions.length > 0 && (
                                <div className="space-y-1 pt-1.5 border-t border-slate-800">
                                  <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Recent Expenditures:</div>
                                  <div className="space-y-1 max-h-[110px] overflow-y-auto pr-1">
                                    {data.recentTransactions.slice(0, 4).map((tx: any, i: number) => (
                                      <div key={i} className="text-[10px] bg-slate-800/80 p-1.5 rounded-lg border border-slate-700/60 space-y-0.5">
                                        <div className="flex items-center justify-between text-slate-300 font-mono">
                                          <span className="text-[9px] text-slate-400">{tx.date}</span>
                                          <span className="text-emerald-400 font-bold">₹{tx.amount.toLocaleString()}</span>
                                        </div>
                                        <div className="text-white font-medium truncate" title={tx.description}>{tx.description}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>

                {/* CENTER DONUT LABEL */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Disbursers</span>
                  <span className="text-lg font-mono font-extrabold text-slate-900 dark:text-white">
                    {pieChartData.data.length}
                  </span>
                </div>
              </div>

              {/* PERCENTAGE LIST / BREAKDOWN PROGRESS BARS */}
              <div className="md:col-span-7 space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {pieChartData.data.map((entry) => {
                  const isHovered = hoveredBreakdownPayerId === entry.id;

                  return (
                    <div 
                      key={entry.id}
                      onMouseEnter={() => setHoveredBreakdownPayerId(entry.id)}
                      onMouseLeave={() => setHoveredBreakdownPayerId(null)}
                      className={`p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border transition-all duration-200 cursor-pointer ${
                        isHovered 
                          ? 'border-indigo-400 dark:border-indigo-600 shadow-md ring-2 ring-indigo-500/20 bg-indigo-50/30 dark:bg-indigo-950/20' 
                          : 'border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-3 h-3 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: entry.color }} />
                          <span className="font-bold text-slate-900 dark:text-white truncate">{entry.name}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium hidden sm:inline truncate">
                            ({entry.role})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className="font-bold text-slate-800 dark:text-slate-200">₹{entry.value.toLocaleString()}</span>
                          <span 
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white shadow-2xs" 
                            style={{ backgroundColor: entry.color }}
                          >
                            {entry.percentage}%
                          </span>
                        </div>
                      </div>

                      {/* PROGRESS BAR */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden mt-1.5">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${Math.max(entry.percentage, 2)}%`, 
                            backgroundColor: entry.color 
                          }}
                        />
                      </div>

                      {/* HOVER DETAILS POP-OUT CARD */}
                      {isHovered && (
                        <div className="mt-3 pt-2.5 border-t border-indigo-200/60 dark:border-indigo-800/60 space-y-2 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                            <span>Where {entry.name} Spent Money & How Much:</span>
                            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{entry.recentTransactions.length} transaction(s)</span>
                          </div>

                          {/* CATEGORY BREAKDOWN TAGS */}
                          {entry.categoryBreakdown.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {entry.categoryBreakdown.map((cat, idx) => (
                                <span key={idx} className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs">
                                  <span className="text-slate-400">{cat.name}:</span>
                                  <span className="text-emerald-700 dark:text-emerald-400">₹{cat.amount.toLocaleString()}</span>
                                  <span className="text-[9px] text-slate-400">({cat.percentage}%)</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* ITEMIZED TRANSACTIONS SUMMARY */}
                          {entry.recentTransactions.length > 0 && (
                            <div className="space-y-1 bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800 max-h-[140px] overflow-y-auto">
                              <div className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">Detailed Outlays Log:</div>
                              {entry.recentTransactions.map((tx, idx) => (
                                <div key={idx} className="flex items-center justify-between text-[10px] py-1 border-b border-slate-100 dark:border-slate-800/80 last:border-0 font-medium">
                                  <div className="min-w-0 pr-2">
                                    <div className="text-slate-800 dark:text-slate-200 font-bold truncate">{tx.description}</div>
                                    <div className="text-[9px] text-slate-400 font-mono flex items-center gap-2">
                                      <span>{tx.date}</span>
                                      <span>•</span>
                                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{tx.category}</span>
                                      <span>•</span>
                                      <span>{tx.projectName}</span>
                                    </div>
                                  </div>
                                  <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs shrink-0">
                                    ₹{tx.amount.toLocaleString()}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TIME-SERIES MONTHLY EXPENDITURE TRENDS LINE CHART */}
      {(analyticsViewMode === 'all' || analyticsViewMode === 'trend') && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Monthly Expenditure Trends by Disburser</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Time-series tracking of monthly outlays per disburser to identify peak spending periods and activity cycles.
              </p>
            </div>

            {/* PEAK MONTH BADGE */}
            {monthlyTrendData.peakMonth.total > 0 && (
              <div className="bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-200/80 dark:border-emerald-800 px-3 py-1.5 rounded-xl text-xs shrink-0 self-start sm:self-auto flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Peak Spending Month</div>
                  <div className="font-mono font-bold text-xs">
                    {monthlyTrendData.peakMonth.label}: <span className="text-emerald-950 dark:text-emerald-100 font-extrabold">₹{monthlyTrendData.peakMonth.total.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {monthlyTrendData.months.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <TrendingUp className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                No monthly transaction trends recorded yet.
              </p>
              <p className="text-[11px] text-slate-400">
                Log transactions with dates assigned to authorized disbursers to view monthly spending activity over time.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {/* LINE CHART */}
              <div className="h-[280px] w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart
                    data={monthlyTrendData.months}
                    margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                    <XAxis 
                      dataKey="label" 
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(val) => {
                        if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
                        if (val >= 1000) return `₹${(val / 1000).toFixed(0)}k`;
                        return `₹${val}`;
                      }}
                    />
                    <RechartsTooltip 
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const monthObj = monthlyTrendData.months.find(m => m.label === label);
                          return (
                            <div className="bg-slate-900 text-white p-3.5 rounded-xl shadow-xl border border-slate-700 text-xs space-y-2 min-w-[200px]">
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                <span className="font-bold text-indigo-300">{label} Outlays</span>
                                <span className="font-mono font-extrabold text-emerald-400">₹{monthObj?.total.toLocaleString()}</span>
                              </div>
                              <div className="space-y-1">
                                {payload
                                  .filter(p => Number(p.value) > 0)
                                  .map((p, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-3 text-[11px]">
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                        <span className="text-slate-200 font-medium truncate">{p.name}</span>
                                      </div>
                                      <span className="font-mono font-bold text-white shrink-0">₹{Number(p.value).toLocaleString()}</span>
                                    </div>
                                  ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ paddingTop: '10px', fontSize: '11px' }}
                      iconType="circle"
                      iconSize={8}
                    />
                    {monthlyTrendData.activePayers.map((ap) => (
                      <Line
                        key={ap.id}
                        type="monotone"
                        dataKey={ap.name}
                        name={ap.name}
                        stroke={ap.color}
                        strokeWidth={2.5}
                        dot={{ r: 4, strokeWidth: 1.5, fill: '#fff' }}
                        activeDot={{ r: 7, strokeWidth: 2 }}
                        connectNulls
                      />
                    ))}
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>

              {/* TREND METRICS FOOTER */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Recorded Timeline</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{monthlyTrendData.months.length} Active Months</span>
                  </div>
                  <Calendar className="w-5 h-5 text-indigo-500 opacity-80" />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Peak Month Top Disburser</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate block max-w-[150px]">
                      {monthlyTrendData.peakMonth.topPayer}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    ₹{monthlyTrendData.peakMonth.topPayerAmt.toLocaleString()}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Monthly Avg Disbursed</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                      ₹{monthlyTrendData.months.length > 0 
                        ? Math.round(monthlyTrendData.months.reduce((s, m) => s + m.total, 0) / monthlyTrendData.months.length).toLocaleString()
                        : 0}
                    </span>
                  </div>
                  <BarChart3 className="w-5 h-5 text-emerald-500 opacity-80" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PAYER COMPARISON & RANKING LEADERBOARD MATRIX */}
      {(analyticsViewMode === 'all' || analyticsViewMode === 'comparison') && pieChartData.total > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>Disburser Volume & Contribution Leaderboard</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ranking comparison matching total capital outlays alongside distinct transaction frequencies.
              </p>
            </div>

            {/* SORT BY TOGGLES */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0 text-xs self-start sm:self-auto">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase items-center gap-1 hidden md:flex">
                <ArrowUpDown className="w-3 h-3" />
                <span>Sort Rank:</span>
              </span>
              <button
                type="button"
                onClick={() => setRankSortBy('amount')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                  rankSortBy === 'amount'
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                ₹ Total Outlay
              </button>
              <button
                type="button"
                onClick={() => setRankSortBy('count')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                  rankSortBy === 'count'
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                # Transactions
              </button>
              <button
                type="button"
                onClick={() => setRankSortBy('avg')}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition cursor-pointer text-xs ${
                  rankSortBy === 'avg'
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Avg / Trx
              </button>
            </div>
          </div>

          {/* TOP HIGHLIGHT PODS */}
          {topHighlights && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/80 dark:border-amber-800/50 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-amber-800 dark:text-amber-300">
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                    #1 Capital Leader
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-900/60 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-200">
                    {topHighlights.byAmount.percentage}% share
                  </span>
                </div>
                <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {topHighlights.byAmount.name}
                </div>
                <div className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                  ₹{topHighlights.byAmount.totalAmount.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">outlayed</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-800/50 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-blue-800 dark:text-blue-300">
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-blue-500" />
                    #1 Transaction Velocity
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded text-blue-900 dark:text-blue-200">
                    {topHighlights.byCount.transactionCount} entries
                  </span>
                </div>
                <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {topHighlights.byCount.name}
                </div>
                <div className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400">
                  {topHighlights.byCount.transactionCount} <span className="text-[10px] font-normal text-slate-500">distinct payouts</span>
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 border border-emerald-200/80 dark:border-emerald-800/50 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
                  <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                    #1 Highest Ticket Size
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded text-emerald-900 dark:text-emerald-200">
                    avg / trx
                  </span>
                </div>
                <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                  {topHighlights.byAvg.name}
                </div>
                <div className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  ₹{topHighlights.byAvg.avgTicket.toLocaleString()} <span className="text-[10px] font-normal text-slate-500">/ transaction</span>
                </div>
              </div>
            </div>
          )}

          {/* RANKED COMPARISON TABLE */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-3 w-12 text-center">Rank</th>
                  <th className="p-3 min-w-[160px]">Authorized Payer</th>
                  <th className="p-3 min-w-[180px]">Total Capital Contribution</th>
                  <th className="p-3 text-center min-w-[130px]">Distinct Transactions</th>
                  <th className="p-3 text-right min-w-[130px]">Avg Ticket Size</th>
                  <th className="p-3 min-w-[150px]">Primary Outlay Channel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {rankedPayersList.map((item, idx) => {
                  const isGold = idx === 0;
                  const isSilver = idx === 1;
                  const isBronze = idx === 2;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                        isGold ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      {/* RANK BADGE */}
                      <td className="p-3 text-center">
                        <span 
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs shadow-2xs ${
                            isGold 
                              ? 'bg-amber-500 text-white ring-2 ring-amber-300 dark:ring-amber-600 font-extrabold' 
                              : isSilver 
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold' 
                              : isBronze 
                              ? 'bg-amber-700 text-white font-bold' 
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : `#${idx + 1}`}
                        </span>
                      </td>

                      {/* PAYER NAME & ROLE */}
                      <td className="p-3 min-w-[160px]">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{item.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                          {item.role}
                        </div>
                      </td>

                      {/* TOTAL CONTRIBUTION + PROGRESS BAR */}
                      <td className="p-3 min-w-[180px]">
                        <div className="flex items-center justify-between font-mono text-xs mb-1">
                          <span className="font-bold text-indigo-950 dark:text-indigo-300">₹{item.totalAmount.toLocaleString()}</span>
                          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{item.percentage}% share</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isGold ? 'bg-amber-500' : 'bg-indigo-600 dark:bg-indigo-500'
                            }`}
                            style={{ width: `${Math.max(item.percentage, 2)}%` }}
                          />
                        </div>
                      </td>

                      {/* TRANSACTION COUNT */}
                      <td className="p-3 text-center min-w-[130px]">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-slate-200">
                          <Hash className="w-3 h-3 text-slate-400" />
                          <span>{item.transactionCount} entries</span>
                        </span>
                      </td>

                      {/* AVG TICKET */}
                      <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-200 min-w-[130px]">
                        ₹{item.avgTicket.toLocaleString()}
                      </td>

                      {/* DOMINANT CHANNEL */}
                      <td className="p-3 min-w-[150px]">
                        {item.dominantCategory !== 'None' ? (
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900 truncate max-w-[150px]">
                            {item.dominantCategory}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAYER CARDS DIRECTORY */}
      <div className="space-y-4">
        {filteredPayers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Payer Profiles Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {searchTerm || projectFilter !== 'all' 
                ? 'No authorized payers match your current search criteria.' 
                : 'Click "+ Register Authorized Payer" above to start attributing funds to partners, investors, or supervisors.'}
            </p>
            <button
              onClick={handleOpenAddForm}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Register First Payer
            </button>
          </div>
        ) : (
          filteredPayers.map(pf => {
            const isExpanded = expandedPayerId === pf.id;
            const isRegistered = Boolean(pf.payerObj);

            return (
              <div 
                key={pf.id} 
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-700"
              >
                {/* CARD HEADER */}
                <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm shrink-0">
                      {pf.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">{pf.name}</h3>
                        {pf.role && (
                          <span className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {pf.role}
                          </span>
                        )}
                        {!isRegistered && (
                          <span className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                            Custom Entry
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
                        {pf.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 text-slate-400" /> {pf.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3 text-slate-400" /> {pf.transactionCount} total outlays logged
                        </span>
                        {pf.notes && (
                          <span className="italic text-slate-400 truncate max-w-[200px]" title={pf.notes}>
                            "{pf.notes}"
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT SIDE OUTLAY FIGURE & ACTIONS */}
                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-800">
                    <div className="text-left md:text-right">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Disbursed</span>
                      <span className="text-xl font-mono font-extrabold text-indigo-700 dark:text-indigo-400">
                        ₹{pf.totalDisbursed.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isRegistered && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleOpenEditForm(pf.payerObj!)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                            title="Rename / Edit Payer Profile"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingPayerId(pf.id)}
                            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 transition cursor-pointer"
                            title="Remove / Delete Payer Profile"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedPayerId(isExpanded ? null : pf.id)}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-xs transition cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide Ledger' : 'View Ledger'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* CATEGORY OUTLAY BREAKDOWN GRID */}
                <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Labour Advances</span>
                    <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 block">₹{pf.advancesTotal.toLocaleString()}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Wage Payouts</span>
                    <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 block">₹{pf.paymentsTotal.toLocaleString()}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Daily Expenses</span>
                    <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 block">₹{pf.expensesTotal.toLocaleString()}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Hotel & Food</span>
                    <span className="text-xs font-mono font-bold text-orange-700 dark:text-orange-400 block">₹{pf.hotelTotal.toLocaleString()}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Material Stocks</span>
                    <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-400 block">₹{pf.materialsTotal.toLocaleString()}</span>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 space-y-0.5">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">GST Taxes</span>
                    <span className="text-xs font-mono font-bold text-violet-700 dark:text-violet-400 block">₹{pf.gstTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* PROJECT-WISE OUTLAY BREAKDOWN PILLS */}
                {pf.projectAmounts.size > 0 && (
                  <div className="px-4 sm:px-5 pb-4 flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Site Disbursals:</span>
                    {Array.from(pf.projectAmounts.entries()).map(([pId, amt]) => {
                      const prj = projects.find(p => p.id === pId);
                      return (
                        <span 
                          key={pId} 
                          className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1.5"
                        >
                          <span>{prj ? prj.name : 'Main / Unassigned'}</span>
                          <strong className="font-mono text-indigo-700 dark:text-indigo-400">₹{amt.toLocaleString()}</strong>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* EXPANDED DETAILED TRANSACTION LEDGER */}
                {isExpanded && (
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 sm:p-5 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Itemized Outlay Transactions ({pf.transactions.length})
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">Sorted chronologically (Newest first)</span>
                    </div>

                    {pf.transactions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-2">No individual transactions recorded for this payer yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                        {pf.transactions.map((trx) => (
                          <div 
                            key={trx.id + trx.category} 
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 font-bold">{trx.date}</span>
                                <span className={`font-bold text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                                  trx.category === 'Labour Advance' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
                                  trx.category === 'Wage Settlement' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                                  trx.category === 'Daily Expense' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800' :
                                  trx.category === 'Hotel Food' ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800' :
                                  trx.category === 'Material Stock' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' :
                                  trx.category === 'GST Tax' ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' :
                                  'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}>
                                  {trx.category}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                  {trx.projectName}
                                </span>
                              </div>
                              <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{trx.description}</p>
                            </div>

                            <strong className="font-mono text-sm font-bold text-slate-900 dark:text-white shrink-0">
                              ₹{trx.amount.toLocaleString()}
                            </strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* FORM MODAL FOR ADD / EDIT PAYER */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <UserCheck className="w-5 h-5" />
                </span>
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  {editingPayer ? 'Edit Authorized Payer Profile' : 'Register New Authorized Payer'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Full Name / Entity *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar or Apex Builders Acct"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                />
              </div>

              {/* Role / Designation */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Designation / Role / Category
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold mb-2"
                >
                  <option value="Main Contractor">🏗️ Main Contractor</option>
                  <option value="Site Engineer / Supervisor">👷 Site Engineer / Supervisor</option>
                  <option value="Partner / Investor">🤝 Partner / Investor</option>
                  <option value="Building Owner / Client">🏛️ Building Owner / Client</option>
                  <option value="Subcontractor Head">👷‍♂️ Subcontractor Head</option>
                  <option value="Site Manager">💼 Site Manager / Executive</option>
                  <option value="Company Director">🏢 Company Director</option>
                  <option value="Cashier / Accountant">💳 Cashier / Accountant</option>
                  <option value="Material Supplier / Vendor">🚚 Material Supplier / Vendor</option>
                  <option value="custom_role">+ Custom Role / Designation...</option>
                </select>

                {/* Quick Role Selection Pills */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Main Contractor',
                    'Site Engineer / Supervisor',
                    'Partner / Investor',
                    'Building Owner / Client',
                    'Subcontractor Head',
                    'Site Manager'
                  ].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer ${
                        role === r
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700'
                          : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>

                {role === 'custom_role' && (
                  <input
                    type="text"
                    placeholder="Enter custom role (e.g. Electrical Contractor, Lead Investor)"
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                )}
              </div>

              {/* Phone / Mobile */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Phone / Mobile Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Notes / Bank Reference Account
                </label>
                <textarea
                  placeholder="e.g. Disburses weekly wages and site fuel expenses from SBI Account..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingPayer ? 'Update Payer Profile' : 'Save Authorized Payer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deletingPayerId && (
        <ConfirmModal
          isOpen={Boolean(deletingPayerId)}
          title="Remove Authorized Payer"
          message="Are you sure you want to remove this authorized payer profile from your registered list? Existing outlay entries attributed to this name will remain in your ledgers."
          confirmText="Yes, Delete Payer"
          cancelText="Cancel"
          onConfirm={handleConfirmDelete}
          onClose={() => setDeletingPayerId(null)}
        />
      )}
      </div>

      {/* PRINT-ONLY COMPREHENSIVE FINANCIAL ANALYTICS REPORT CONTAINER */}
      <div className="hidden print:block p-6 text-black bg-white space-y-6">
        {/* PRINT HEADER */}
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
              Authorized Payer & Investor Outlay Analytics Report
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Construction Site Context: <strong className="text-slate-900">{projectFilter === 'all' ? 'All Active Construction Sites' : projects.find(p => p.id === projectFilter)?.name || 'Selected Site'}</strong>
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            <div>Report Date: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
            <div>Time: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>

        {/* 1. EXECUTIVE KEY METRICS GRID */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
            1. Executive Financial Summary
          </h2>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Total Disbursed Outlays</div>
              <div className="text-base font-mono font-bold text-slate-900">₹{pieChartData.total.toLocaleString('en-IN')}</div>
            </div>
            <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Active Disbursers</div>
              <div className="text-base font-mono font-bold text-slate-900">{rankedPayersList.length} Authorized Payers</div>
            </div>
            <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Top Disburser</div>
              <div className="text-sm font-bold text-slate-900 truncate">{topHighlights?.byAmount?.name || 'N/A'}</div>
              <div className="text-xs font-mono font-bold text-slate-700">₹{topHighlights?.byAmount?.totalAmount.toLocaleString('en-IN') || 0} ({topHighlights?.byAmount?.percentage}%)</div>
            </div>
            <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Peak Spending Month</div>
              <div className="text-sm font-bold text-slate-900">{monthlyTrendData.peakMonth.label || 'N/A'}</div>
              <div className="text-xs font-mono font-bold text-slate-700">₹{monthlyTrendData.peakMonth.total.toLocaleString('en-IN')}</div>
            </div>
          </div>
        </div>

        {/* 2. DISBURSER CONTRIBUTION & RANKING LEADERBOARD */}
        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
            2. Disburser Volume & Contribution Leaderboard
          </h2>
          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-2 border border-slate-300 text-center w-10">Rank</th>
                <th className="p-2 border border-slate-300">Authorized Payer</th>
                <th className="p-2 border border-slate-300">Designation / Role</th>
                <th className="p-2 border border-slate-300 text-right">Total Outlay (₹)</th>
                <th className="p-2 border border-slate-300 text-center">Share %</th>
                <th className="p-2 border border-slate-300 text-center">Transactions</th>
                <th className="p-2 border border-slate-300 text-right">Avg / Trx (₹)</th>
                <th className="p-2 border border-slate-300">Dominant Category</th>
              </tr>
            </thead>
            <tbody>
              {rankedPayersList.map((p, idx) => (
                <tr key={p.id} className="border-b border-slate-200">
                  <td className="p-2 border border-slate-300 text-center font-bold">#{idx + 1}</td>
                  <td className="p-2 border border-slate-300 font-bold">{p.name}</td>
                  <td className="p-2 border border-slate-300 text-slate-600">{p.role}</td>
                  <td className="p-2 border border-slate-300 text-right font-mono font-bold">₹{p.totalAmount.toLocaleString('en-IN')}</td>
                  <td className="p-2 border border-slate-300 text-center font-bold">{p.percentage}%</td>
                  <td className="p-2 border border-slate-300 text-center font-mono">{p.transactionCount}</td>
                  <td className="p-2 border border-slate-300 text-right font-mono">₹{p.avgTicket.toLocaleString('en-IN')}</td>
                  <td className="p-2 border border-slate-300">{p.dominantCategory}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 3. MONTHLY EXPENDITURE TRENDS MATRIX */}
        {monthlyTrendData.months.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
              3. Monthly Expenditure Trends Matrix
            </h2>
            <table className="w-full text-left text-xs border border-slate-300 border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2 border border-slate-300">Month</th>
                  <th className="p-2 border border-slate-300 text-right">Total Site Outlay (₹)</th>
                  {monthlyTrendData.activePayers.map(ap => (
                    <th key={ap.id} className="p-2 border border-slate-300 text-right">{ap.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyTrendData.months.map(m => (
                  <tr key={m.key} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-300 font-bold">{m.label}</td>
                    <td className="p-2 border border-slate-300 text-right font-mono font-bold">₹{m.total.toLocaleString('en-IN')}</td>
                    {monthlyTrendData.activePayers.map(ap => {
                      const val = m[ap.name] || 0;
                      return (
                        <td key={ap.id} className="p-2 border border-slate-300 text-right font-mono">
                          {val > 0 ? `₹${val.toLocaleString('en-IN')}` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. ITEMIZED TRANSACTIONS LEDGER */}
        {allFilteredTransactions.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
              4. Itemized Outlays Log ({allFilteredTransactions.length} Transactions)
            </h2>
            <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[9px]">
                <tr>
                  <th className="p-1.5 border border-slate-300">Date</th>
                  <th className="p-1.5 border border-slate-300">Disburser Name</th>
                  <th className="p-1.5 border border-slate-300">Category</th>
                  <th className="p-1.5 border border-slate-300">Construction Site</th>
                  <th className="p-1.5 border border-slate-300">Description / Details</th>
                  <th className="p-1.5 border border-slate-300 text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {allFilteredTransactions.map((t, idx) => (
                  <tr key={t.id + idx} className="border-b border-slate-200">
                    <td className="p-1.5 border border-slate-300 font-mono">{formatDateSafe(t.date)}</td>
                    <td className="p-1.5 border border-slate-300 font-bold">{t.payerName}</td>
                    <td className="p-1.5 border border-slate-300">{t.category}</td>
                    <td className="p-1.5 border border-slate-300">{t.projectName}</td>
                    <td className="p-1.5 border border-slate-300">{t.description}</td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono font-bold">₹{t.amount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

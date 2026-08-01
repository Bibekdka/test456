import React, { useState, useMemo } from 'react';
import {
  Handshake,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  Plus,
  Edit2,
  Trash2,
  DollarSign,
  TrendingUp,
  UserCheck,
  FileText,
  FileSpreadsheet,
  Printer,
  Search,
  Filter,
  Image as ImageIcon,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Building2,
  ShieldAlert,
  PieChart,
  BarChart3,
  Sparkles,
  Receipt,
  Wallet
} from 'lucide-react';
import { Payer, Project, PartnerDeal, PartnerSettlement } from '../types';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PartnerFinanceManagerProps {
  payers: Payer[];
  projects: Project[];
  partnerDeals: PartnerDeal[];
  partnerSettlements: PartnerSettlement[];
  activeProjectId: string | null;
  onAddDeal: (deal: Omit<PartnerDeal, 'id'>) => Promise<void>;
  onUpdateDeal: (deal: PartnerDeal) => Promise<void>;
  onDeleteDeal: (id: string) => Promise<void>;
  onAddSettlement: (settlement: Omit<PartnerSettlement, 'id'>) => Promise<void>;
  onDeleteSettlement: (id: string) => Promise<void>;
  onAddPayer?: (payer: Payer) => Promise<void>;
}

export default function PartnerFinanceManager({
  payers,
  projects,
  partnerDeals,
  partnerSettlements,
  activeProjectId,
  onAddDeal,
  onUpdateDeal,
  onDeleteDeal,
  onAddSettlement,
  onDeleteSettlement,
  onAddPayer
}: PartnerFinanceManagerProps) {
  // Filter & Search states
  const [siteFilter, setSiteFilter] = useState<string>(activeProjectId || 'all');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded deal rows for settlement history
  const [expandedDealIds, setExpandedDealIds] = useState<Record<string, boolean>>({});

  // Modals state
  const [isAddDealOpen, setIsAddDealOpen] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [selectedDealForSettlement, setSelectedDealForSettlement] = useState<PartnerDeal | null>(null);
  const [editingDeal, setEditingDeal] = useState<PartnerDeal | null>(null);
  const [deletingDealId, setDeletingDealId] = useState<string | null>(null);

  // Quick Add Partner Modal state
  const [isAddPayerModalOpen, setIsAddPayerModalOpen] = useState(false);
  const [newPayerName, setNewPayerName] = useState('');
  const [newPayerRole, setNewPayerRole] = useState('Partner / Investor');
  const [newPayerPhone, setNewPayerPhone] = useState('');

  // New Deal Form state
  const [dealLenderId, setDealLenderId] = useState('');
  const [dealBorrowerId, setDealBorrowerId] = useState('');
  const [dealProjectId, setDealProjectId] = useState<string>(activeProjectId || 'all');
  const [dealAmount, setDealAmount] = useState<number | ''>('');
  const [dealDate, setDealDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dealPurpose, setDealPurpose] = useState('');
  const [dealNotes, setDealNotes] = useState('');
  const [dealReceiptImage, setDealReceiptImage] = useState<string | undefined>(undefined);
  const [dealReceiptName, setDealReceiptName] = useState<string | undefined>(undefined);

  // Settlement Form state
  const [settleAmount, setSettleAmount] = useState<number | ''>('');
  const [settleDate, setSettleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [settleMode, setSettleMode] = useState<'cash' | 'upi' | 'bank_transfer' | 'other'>('upi');
  const [settleNotes, setSettleNotes] = useState('');
  const [settleReceiptImage, setSettleReceiptImage] = useState<string | undefined>(undefined);
  const [settleReceiptName, setSettleReceiptName] = useState<string | undefined>(undefined);

  // Image zoom preview modal
  const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);

  // Helper to resolve partner name
  const getPayerName = (idOrName: string) => {
    if (!idOrName) return 'Unknown Partner';
    const found = payers.find(p => p.id === idOrName || p.name === idOrName);
    return found ? found.name : idOrName;
  };

  // Helper to format safe date YYYY-MM-DD
  const formatDateSafe = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Compute calculated metrics for each deal (Total settled, Balance remaining)
  const dealsWithMetrics = useMemo(() => {
    return partnerDeals.map(deal => {
      const dealSettlements = partnerSettlements.filter(s => s.dealId === deal.id);
      const totalSettled = dealSettlements.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
      const remainingBalance = Math.max(0, deal.amount - totalSettled);
      const autoStatus: 'pending' | 'partially_settled' | 'settled' =
        remainingBalance === 0 ? 'settled' : totalSettled > 0 ? 'partially_settled' : 'pending';

      return {
        ...deal,
        totalSettled,
        remainingBalance,
        calculatedStatus: autoStatus,
        settlementCount: dealSettlements.length,
        settlements: dealSettlements.sort((a, b) => b.date.localeCompare(a.date))
      };
    });
  }, [partnerDeals, partnerSettlements]);

  // Filtered Deals
  const filteredDeals = useMemo(() => {
    return dealsWithMetrics.filter(d => {
      // Site filter
      if (siteFilter !== 'all') {
        if (d.projectId && d.projectId !== 'all' && d.projectId !== siteFilter) {
          return false;
        }
      }

      // Partner filter
      if (partnerFilter !== 'all') {
        const lenderName = getPayerName(d.lenderPayerId);
        const borrowerName = getPayerName(d.borrowerPayerId);
        const isLender = d.lenderPayerId === partnerFilter || lenderName === partnerFilter;
        const isBorrower = d.borrowerPayerId === partnerFilter || borrowerName === partnerFilter;
        if (!isLender && !isBorrower) return false;
      }

      // Status filter
      if (statusFilter === 'pending') {
        if (d.calculatedStatus === 'settled') return false;
      } else if (statusFilter === 'settled') {
        if (d.calculatedStatus !== 'settled') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const lenderName = getPayerName(d.lenderPayerId).toLowerCase();
        const borrowerName = getPayerName(d.borrowerPayerId).toLowerCase();
        const purpose = (d.purpose || '').toLowerCase();
        const notes = (d.notes || '').toLowerCase();
        if (!lenderName.includes(q) && !borrowerName.includes(q) && !purpose.includes(q) && !notes.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [dealsWithMetrics, siteFilter, partnerFilter, statusFilter, searchQuery, payers]);

  // Executive Totals
  const executiveStats = useMemo(() => {
    let totalLent = 0;
    let totalSettled = 0;
    let totalOutstanding = 0;
    let openDealsCount = 0;

    filteredDeals.forEach(d => {
      totalLent += d.amount;
      totalSettled += d.totalSettled;
      totalOutstanding += d.remainingBalance;
      if (d.calculatedStatus !== 'settled') {
        openDealsCount++;
      }
    });

    return {
      totalLent,
      totalSettled,
      totalOutstanding,
      openDealsCount,
      totalDealsCount: filteredDeals.length
    };
  }, [filteredDeals]);

  // Pairwise Debt Matrix ("Who Owes Whom")
  const pairwiseNetBalances = useMemo(() => {
    const pairMap: Record<string, { borrowerId: string; borrowerName: string; borrowerPhone?: string; lenderId: string; lenderName: string; lenderPhone?: string; totalLent: number; totalSettled: number; netOwed: number; activeDealsCount: number }> = {};

    dealsWithMetrics.forEach(d => {
      const lenderName = getPayerName(d.lenderPayerId);
      const borrowerName = getPayerName(d.borrowerPayerId);
      const lenderPayer = payers.find(p => p.id === d.lenderPayerId || p.name === d.lenderPayerId);
      const borrowerPayer = payers.find(p => p.id === d.borrowerPayerId || p.name === d.borrowerPayerId);
      const key = `${d.borrowerPayerId}_owes_${d.lenderPayerId}`;

      if (!pairMap[key]) {
        pairMap[key] = {
          borrowerId: d.borrowerPayerId,
          borrowerName,
          borrowerPhone: borrowerPayer?.phone || d.borrowerPhone,
          lenderId: d.lenderPayerId,
          lenderName,
          lenderPhone: lenderPayer?.phone || d.lenderPhone,
          totalLent: 0,
          totalSettled: 0,
          netOwed: 0,
          activeDealsCount: 0
        };
      }

      pairMap[key].totalLent += d.amount;
      pairMap[key].totalSettled += d.totalSettled;
      pairMap[key].netOwed += d.remainingBalance;
      if (d.calculatedStatus !== 'settled') {
        pairMap[key].activeDealsCount += 1;
      }
    });

    return Object.values(pairMap).filter(p => p.netOwed > 0);
  }, [dealsWithMetrics, payers]);

  // Partner Flow Stats for Charts
  const partnerFlowStats = useMemo(() => {
    const map: Record<string, { name: string; totalLent: number; totalBorrowed: number; netBalance: number }> = {};

    payers.forEach(p => {
      map[p.id] = { name: p.name, totalLent: 0, totalBorrowed: 0, netBalance: 0 };
    });

    dealsWithMetrics.forEach(d => {
      const lenderId = d.lenderPayerId;
      const borrowerId = d.borrowerPayerId;

      if (!map[lenderId]) map[lenderId] = { name: getPayerName(lenderId), totalLent: 0, totalBorrowed: 0, netBalance: 0 };
      if (!map[borrowerId]) map[borrowerId] = { name: getPayerName(borrowerId), totalLent: 0, totalBorrowed: 0, netBalance: 0 };

      map[lenderId].totalLent += d.remainingBalance; // active net support given
      map[borrowerId].totalBorrowed += d.remainingBalance; // active net support taken
    });

    Object.keys(map).forEach(id => {
      map[id].netBalance = map[id].totalLent - map[id].totalBorrowed;
    });

    return Object.values(map).filter(p => p.totalLent > 0 || p.totalBorrowed > 0);
  }, [dealsWithMetrics, payers]);

  // Handlers
  const handleOpenAddDeal = () => {
    if (payers.length < 2) {
      if (confirm('At least 2 authorized partners/payers are required to register an inter-partner deal. Would you like to add a partner now?')) {
        setIsAddPayerModalOpen(true);
      }
      return;
    }
    setDealLenderId(payers[0]?.id || '');
    setDealBorrowerId(payers[1]?.id || '');
    setDealProjectId(activeProjectId || 'all');
    setDealAmount('');
    setDealDate(new Date().toISOString().split('T')[0]);
    setDealPurpose('');
    setDealNotes('');
    setDealReceiptImage(undefined);
    setDealReceiptName(undefined);
    setIsAddDealOpen(true);
  };

  const handleCreatePayerQuick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayerName.trim()) {
      alert('Please enter a partner name.');
      return;
    }
    if (onAddPayer) {
      const newPayer: Payer = {
        id: 'payer_' + Date.now(),
        name: newPayerName.trim(),
        role: newPayerRole.trim() || 'Partner',
        phone: newPayerPhone.trim() || undefined
      };
      await onAddPayer(newPayer);
      setNewPayerName('');
      setNewPayerPhone('');
      setIsAddPayerModalOpen(false);
    }
  };

  const handleSaveNewDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealLenderId || !dealBorrowerId) {
      alert('Please select both Lender (who gave money) and Borrower (who received help).');
      return;
    }
    if (dealLenderId === dealBorrowerId) {
      alert('Lender and Borrower cannot be the same partner!');
      return;
    }
    const amt = typeof dealAmount === 'number' ? dealAmount : parseFloat(dealAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid deal amount (₹).');
      return;
    }
    if (!dealPurpose.trim()) {
      alert('Please enter the purpose or reason for this financial deal.');
      return;
    }

    const lenderObj = payers.find(p => p.id === dealLenderId || p.name === dealLenderId);
    const borrowerObj = payers.find(p => p.id === dealBorrowerId || p.name === dealBorrowerId);

    const newDeal: PartnerDeal = {
      id: 'deal_' + Date.now(),
      projectId: dealProjectId === 'all' ? undefined : dealProjectId,
      lenderPayerId: dealLenderId,
      borrowerPayerId: dealBorrowerId,
      lenderPhone: lenderObj?.phone,
      borrowerPhone: borrowerObj?.phone,
      amount: amt,
      date: dealDate,
      purpose: dealPurpose.trim(),
      status: 'pending',
      notes: dealNotes.trim() || undefined,
      receiptImage: dealReceiptImage,
      receiptImageName: dealReceiptName
    };

    await onAddDeal(newDeal);
    setIsAddDealOpen(false);
  };

  const handleOpenSettleModal = (deal: PartnerDeal) => {
    setSelectedDealForSettlement(deal);
    const m = dealsWithMetrics.find(d => d.id === deal.id);
    const remaining = m ? m.remainingBalance : deal.amount;
    setSettleAmount(remaining > 0 ? remaining : '');
    setSettleDate(new Date().toISOString().split('T')[0]);
    setSettleMode('upi');
    setSettleNotes('');
    setSettleReceiptImage(undefined);
    setSettleReceiptName(undefined);
    setIsSettleModalOpen(true);
  };

  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDealForSettlement) return;
    const amt = typeof settleAmount === 'number' ? settleAmount : parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid settlement amount (₹).');
      return;
    }

    const newSettlement: PartnerSettlement = {
      id: 'settle_' + Date.now(),
      dealId: selectedDealForSettlement.id,
      date: settleDate,
      amountPaid: amt,
      paymentMode: settleMode,
      notes: settleNotes.trim() || undefined,
      receiptImage: settleReceiptImage,
      receiptImageName: settleReceiptName
    };

    await onAddSettlement(newSettlement);

    // Update Deal Status
    const existingSettlements = partnerSettlements.filter(s => s.dealId === selectedDealForSettlement.id);
    const newTotalSettled = existingSettlements.reduce((s, item) => s + item.amountPaid, 0) + amt;
    const newStatus: 'pending' | 'partially_settled' | 'settled' =
      newTotalSettled >= selectedDealForSettlement.amount ? 'settled' : 'partially_settled';

    if (newStatus !== selectedDealForSettlement.status) {
      await onUpdateDeal({
        ...selectedDealForSettlement,
        status: newStatus
      });
    }

    setIsSettleModalOpen(false);
    setSelectedDealForSettlement(null);
  };

  const handleDeleteDealConfirm = async (id: string) => {
    await onDeleteDeal(id);
    setDeletingDealId(null);
  };

  const toggleExpandDeal = (id: string) => {
    setExpandedDealIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Image Upload Handler
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setImageState: (val: string | undefined) => void,
    setNameState: (val: string | undefined) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit. Please select a smaller receipt image.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageState(reader.result as string);
        setNameState(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Executive Summary
    const summaryData = [
      ['INTER-PARTNER FINANCE & DEAL SETTLEMENT AUDIT REPORT'],
      [`Generated On: ${new Date().toLocaleString()}`],
      [],
      ['Metric', 'Value'],
      ['Total Support Extended (₹)', executiveStats.totalLent],
      ['Total Repaid / Settled (₹)', executiveStats.totalSettled],
      ['Net Outstanding Debt Owed (₹)', executiveStats.totalOutstanding],
      ['Total Deals Count', executiveStats.totalDealsCount],
      ['Active Open Deals Count', executiveStats.openDealsCount],
      [],
      ['NET PARTNER-TO-PARTNER BALANCE MATRIX'],
      ['Borrower (Needs Help)', 'Lender (Provided Help)', 'Total Lent (₹)', 'Repaid (₹)', 'Net Outstanding Owed (₹)']
    ];

    pairwiseNetBalances.forEach(p => {
      summaryData.push([p.borrowerName, p.lenderName, p.totalLent, p.totalSettled, p.netOwed]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

    // Sheet 2: Deals Ledger
    const dealsRows = [
      ['Deal ID', 'Date', 'Lender (Gave Money)', 'Borrower (Helped)', 'Site Context', 'Purpose', 'Principal Amount (₹)', 'Settled Amount (₹)', 'Remaining Owed (₹)', 'Status', 'Notes']
    ];

    filteredDeals.forEach(d => {
      const projName = d.projectId && d.projectId !== 'all' ? projects.find(p => p.id === d.projectId)?.name || 'Specific Site' : 'All Sites';
      dealsRows.push([
        d.id,
        formatDateSafe(d.date),
        getPayerName(d.lenderPayerId),
        getPayerName(d.borrowerPayerId),
        projName,
        d.purpose,
        d.amount,
        d.totalSettled,
        d.remainingBalance,
        d.calculatedStatus.toUpperCase(),
        d.notes || ''
      ]);
    });

    const wsDeals = XLSX.utils.aoa_to_sheet(dealsRows);
    wsDeals['!cols'] = [{ wch: 15 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsDeals, 'Inter-Partner Deals');

    // Sheet 3: Itemized Settlement Logs
    const settlementRows: (string | number)[][] = [
      ['Settlement ID', 'Deal ID', 'Date', 'Lender', 'Borrower', 'Repayment Amount (₹)', 'Payment Mode', 'Notes']
    ];

    partnerSettlements.forEach(s => {
      const deal = partnerDeals.find(d => d.id === s.dealId);
      settlementRows.push([
        s.id,
        s.dealId,
        formatDateSafe(s.date),
        deal ? getPayerName(deal.lenderPayerId) : 'N/A',
        deal ? getPayerName(deal.borrowerPayerId) : 'N/A',
        s.amountPaid,
        s.paymentMode.toUpperCase(),
        s.notes || ''
      ]);
    });

    const wsSettlements = XLSX.utils.aoa_to_sheet(settlementRows);
    wsSettlements['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsSettlements, 'Repayment Log');

    XLSX.writeFile(wb, `Inter_Partner_Finance_Deals_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Export PDF
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('INTER-PARTNER FINANCE & DEAL SETTLEMENT AUDIT REPORT', 14, 18);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Report Date: ${new Date().toLocaleDateString('en-IN')} | Worksite Books Proforma`, 14, 25);

    // Summary Box
    doc.setFillColor(243, 244, 246);
    doc.rect(14, 29, 182, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`Total Extended Support: Rs. ${executiveStats.totalLent.toLocaleString('en-IN')}`, 18, 36);
    doc.text(`Total Repaid / Settled: Rs. ${executiveStats.totalSettled.toLocaleString('en-IN')}`, 18, 44);
    doc.text(`Net Outstanding Owed: Rs. ${executiveStats.totalOutstanding.toLocaleString('en-IN')}`, 105, 36);
    doc.text(`Active Open Deals: ${executiveStats.openDealsCount} Deals`, 105, 44);

    // Pairwise Net Summary Table
    autoTable(doc, {
      startY: 56,
      head: [['Borrower (Needs Help)', 'Lender (Provided Help)', 'Total Lent (Rs.)', 'Repaid (Rs.)', 'Net Outstanding Owed (Rs.)']],
      body: pairwiseNetBalances.map(p => [
        p.borrowerName,
        p.lenderName,
        `Rs. ${p.totalLent.toLocaleString('en-IN')}`,
        `Rs. ${p.totalSettled.toLocaleString('en-IN')}`,
        `Rs. ${p.netOwed.toLocaleString('en-IN')}`
      ]),
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
      styles: { fontSize: 8 }
    });

    // Deals Table
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 100;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Itemized Inter-Partner Support Deals Ledger', 14, finalY);

    autoTable(doc, {
      startY: finalY + 4,
      head: [['Date', 'Lender -> Borrower', 'Purpose', 'Principal (Rs.)', 'Repaid (Rs.)', 'Owed (Rs.)', 'Status']],
      body: filteredDeals.map(d => [
        formatDateSafe(d.date),
        `${getPayerName(d.lenderPayerId)} -> ${getPayerName(d.borrowerPayerId)}`,
        d.purpose,
        `Rs. ${d.amount.toLocaleString('en-IN')}`,
        `Rs. ${d.totalSettled.toLocaleString('en-IN')}`,
        `Rs. ${d.remainingBalance.toLocaleString('en-IN')}`,
        d.calculatedStatus.toUpperCase().replace('_', ' ')
      ]),
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
      styles: { fontSize: 8 }
    });

    doc.save(`Inter_Partner_Finance_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* INTERACTIVE SCREEN WORKSPACE (Hidden when printing) */}
      <div className="print:hidden space-y-6">
        {/* HEADER TOOLBAR BAR */}
        <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-amber-900/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
                  <Handshake className="w-6 h-6" />
                </span>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    Partner Finance & Inter-Partner Deals
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 border border-amber-400/30">
                      Settlement Hub
                    </span>
                  </h2>
                  <p className="text-xs text-amber-200/80 mt-0.5">
                    Record financial assistance provided between partners (e.g. Deben lending to BDK) with distinct color coding & automated settlement tracking.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* EXPORT & PRINT BUTTONS TOOLBAR */}
              <div className="flex items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-xl border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={handleExportPDF}
                  title="Export Financial Audit Report as PDF"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span> PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  title="Export Deals & Settlements to Excel Sheet (.xlsx)"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span> Excel
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  title="Print Inter-Partner Deals Audit"
                  className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleOpenAddDeal}
                className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl font-extrabold text-xs shadow-lg transition cursor-pointer shrink-0 border border-amber-300"
              >
                <Plus className="w-4 h-4" />
                <span>+ Record Inter-Partner Support Deal</span>
              </button>
            </div>
          </div>
        </div>

        {/* 1. EXECUTIVE METRICS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-xs relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
            <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Support Provided</span>
              <Handshake className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              ₹{executiveStats.totalLent.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <span>Across {executiveStats.totalDealsCount} inter-partner deals</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-xs relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Settled / Repaid</span>
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              ₹{executiveStats.totalSettled.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
              {executiveStats.totalLent > 0
                ? `${Math.round((executiveStats.totalSettled / executiveStats.totalLent) * 100)}% Repayment Complete`
                : 'No active debt'}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-xs relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
            <div className="flex items-center justify-between text-rose-600 dark:text-rose-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Net Outstanding Owed</span>
              <Clock className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              ₹{executiveStats.totalOutstanding.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {executiveStats.openDealsCount} active open deals pending
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/50 shadow-xs relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-bl-full pointer-events-none transition-transform group-hover:scale-110" />
            <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Active Partners Involved</span>
              <UserCheck className="w-5 h-5" />
            </div>
            <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
              {payers.length} Partners
            </div>
            <div className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 font-semibold">
              {pairwiseNetBalances.length} active debt relationships
            </div>
          </div>
        </div>

        {/* 2. PAIRWISE "WHO OWES WHOM" SETTLEMENT CARDS */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-amber-200 dark:border-amber-900/40 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-amber-500" />
                Inter-Partner Debt Balance Matrix ("Who Owes Whom")
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Calculates net balance owed between partner pairs with instant deal settlement triggers.
              </p>
            </div>
            {pairwiseNetBalances.length === 0 && (
              <span className="text-xs font-bold px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800">
                All Inter-Partner Deals Are Fully Settled!
              </span>
            )}
          </div>

          {pairwiseNetBalances.length === 0 ? (
            <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              No outstanding debt between partners. Click <strong>"+ Record Inter-Partner Support Deal"</strong> to log a new assistance transaction.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pairwiseNetBalances.map((pair, idx) => {
                const openDealForPair = filteredDeals.find(
                  d => d.borrowerPayerId === pair.borrowerId && d.lenderPayerId === pair.lenderId && d.calculatedStatus !== 'settled'
                );

                return (
                  <div
                    key={idx}
                    className="bg-gradient-to-br from-amber-50/80 via-white to-orange-50/50 dark:from-slate-800 dark:via-slate-900 dark:to-amber-950/30 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/60 shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                          Active Partner Support
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-500">
                          {pair.activeDealsCount} {pair.activeDealsCount === 1 ? 'Deal' : 'Deals'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="space-y-0.5">
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Borrower (Needs Help)</div>
                          <div className="text-base font-black text-rose-600 dark:text-rose-400">{pair.borrowerName}</div>
                        </div>
                        <div className="text-amber-500 font-bold text-lg">➔</div>
                        <div className="space-y-0.5 text-right">
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Lender (Provided Help)</div>
                          <div className="text-base font-black text-emerald-600 dark:text-emerald-400">{pair.lenderName}</div>
                        </div>
                      </div>

                      <div className="bg-white/80 dark:bg-slate-950/60 rounded-xl p-3 border border-amber-100 dark:border-amber-900/40 flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-slate-400 uppercase font-bold">Net Balance Owed</div>
                          <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400">
                            ₹{pair.netOwed.toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div className="text-right text-[10px] font-mono text-slate-500">
                          <div>Total Lent: ₹{pair.totalLent.toLocaleString('en-IN')}</div>
                          <div>Settled: ₹{pair.totalSettled.toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    </div>

                    {openDealForPair && (
                      <button
                        type="button"
                        onClick={() => handleOpenSettleModal(openDealForPair)}
                        className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-extrabold text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Settle Deal Now</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. VISUAL FLOW CHARTS */}
        {partnerFlowStats.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  Inter-Partner Cash Flow & Debt Distribution Chart
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Visual breakdown of financial support given vs received per partner.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {partnerFlowStats.map((p, idx) => {
                const maxVal = Math.max(...partnerFlowStats.map(item => Math.max(item.totalLent, item.totalBorrowed)), 1);
                const lentPct = Math.min(100, (p.totalLent / maxVal) * 100);
                const borrowedPct = Math.min(100, (p.totalBorrowed / maxVal) * 100);

                return (
                  <div key={idx} className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                      <span className={`font-mono font-bold ${p.netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {p.netBalance >= 0 ? `Net Creditor: +₹${p.netBalance.toLocaleString('en-IN')}` : `Net Debtor: -₹${Math.abs(p.netBalance).toLocaleString('en-IN')}`}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] font-mono">
                      {/* Support Provided Bar */}
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-emerald-600 dark:text-emerald-400 font-semibold truncate">Lent / Gave:</span>
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${lentPct}%` }} />
                        </div>
                        <span className="w-20 text-right font-bold text-slate-700 dark:text-slate-300">₹{p.totalLent.toLocaleString('en-IN')}</span>
                      </div>

                      {/* Support Received Bar */}
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-rose-600 dark:text-rose-400 font-semibold truncate">Received Help:</span>
                        <div className="flex-1 bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                          <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${borrowedPct}%` }} />
                        </div>
                        <span className="w-20 text-right font-bold text-slate-700 dark:text-slate-300">₹{p.totalBorrowed.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. FILTER TOOLBAR & SEARCH BAR */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search deals by partner name, purpose, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200"
              />
            </div>

            {/* Site Context Filter */}
            <select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Sites Context</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Partner Filter */}
            <select
              value={partnerFilter}
              onChange={(e) => setPartnerFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            >
              <option value="all">All Partners</option>
              {payers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'all' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
              >
                All ({dealsWithMetrics.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'pending' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Pending ({dealsWithMetrics.filter(d => d.calculatedStatus !== 'settled').length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('settled')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${statusFilter === 'settled' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Settled ({dealsWithMetrics.filter(d => d.calculatedStatus === 'settled').length})
              </button>
            </div>
          </div>
        </div>

        {/* 5. ITEMIZED DEALS TABLE LEDGER */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          {filteredDeals.length === 0 ? (
            <div className="text-center py-12 px-4 space-y-3">
              <Handshake className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
              <div className="text-sm font-bold text-slate-700 dark:text-slate-300">No Inter-Partner Support Deals Found</div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                No deal records match your current search or status filter. Click below to record a financial support transaction.
              </p>
              <button
                type="button"
                onClick={handleOpenAddDeal}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Record First Inter-Partner Deal</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-800 dark:text-slate-200">
                <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 w-10">#</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Financial Deal Relationship</th>
                    <th className="px-4 py-3">Purpose / Context</th>
                    <th className="px-4 py-3 text-right">Principal Amount</th>
                    <th className="px-4 py-3 text-right">Repaid / Settled</th>
                    <th className="px-4 py-3 text-right">Remaining Balance</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDeals.map((deal, idx) => {
                    const isExpanded = Boolean(expandedDealIds[deal.id]);
                    const projName = deal.projectId && deal.projectId !== 'all'
                      ? projects.find(p => p.id === deal.projectId)?.name || 'Construction Site'
                      : 'All Sites / General';

                    return (
                      <React.Fragment key={deal.id}>
                        {/* MAIN DEAL ROW WITH DISTINCT COLOR HIGHLIGHT FOR INTER-PARTNER SUPPORT */}
                        <tr className={`hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition ${isExpanded ? 'bg-amber-50/60 dark:bg-amber-950/30' : ''}`}>
                          <td className="px-4 py-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-3 font-mono font-medium text-slate-600 dark:text-slate-400">
                            {formatDateSafe(deal.date)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {/* DISTINCT COLOR BADGE */}
                              <span className="p-1 bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-md border border-amber-400/40 shrink-0">
                                <Handshake className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span className="text-emerald-700 dark:text-emerald-400">{getPayerName(deal.lenderPayerId)}</span>
                                  <span className="text-amber-500 text-xs">➔</span>
                                  <span className="text-rose-700 dark:text-rose-400">{getPayerName(deal.borrowerPayerId)}</span>
                                </div>
                                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-3 h-3 text-slate-400" />
                                  <span>{projName}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-[220px]">
                            <div className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={deal.purpose}>
                              {deal.purpose}
                            </div>
                            {deal.notes && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate italic mt-0.5" title={deal.notes}>
                                {deal.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-extrabold text-slate-900 dark:text-white">
                            ₹{deal.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{deal.totalSettled.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-extrabold text-rose-600 dark:text-rose-400">
                            ₹{deal.remainingBalance.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {deal.calculatedStatus === 'settled' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Settled
                              </span>
                            ) : deal.calculatedStatus === 'partially_settled' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                                <Clock className="w-3 h-3 text-blue-600" />
                                Partial
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {deal.calculatedStatus !== 'settled' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenSettleModal(deal)}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-[11px] rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                                  title="Record a settlement / repayment"
                                >
                                  <Wallet className="w-3 h-3" />
                                  <span>Settle</span>
                                </button>
                              )}

                              {deal.receiptImage && (
                                <button
                                  type="button"
                                  onClick={() => setViewingImage({ url: deal.receiptImage!, title: `Receipt: ${deal.purpose}` })}
                                  className="p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md transition cursor-pointer"
                                  title="View Transfer Proof Image"
                                >
                                  <ImageIcon className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => toggleExpandDeal(deal.id)}
                                className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition cursor-pointer"
                                title="View repayment settlement logs"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>

                              {deletingDealId === deal.id ? (
                                <div className="flex items-center gap-1 animate-fade-in">
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDealConfirm(deal.id)}
                                    className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeletingDealId(null)}
                                    className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] rounded cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setDeletingDealId(deal.id)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded-md transition cursor-pointer"
                                  title="Delete deal record"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* EXPANDABLE REPAYMENT SETTLEMENT LOGS SUB-ROW */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                            <td colSpan={9} className="p-4 border-t border-b border-amber-200/60 dark:border-amber-900/40">
                              <div className="space-y-3 max-w-4xl mx-auto">
                                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                    <Receipt className="w-4 h-4 text-amber-500" />
                                    Repayment Settlement History ({deal.settlements.length} Transactions)
                                  </h4>
                                  {deal.calculatedStatus !== 'settled' && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSettleModal(deal)}
                                      className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                      + Record New Settlement
                                    </button>
                                  )}
                                </div>

                                {deal.settlements.length === 0 ? (
                                  <div className="text-xs text-slate-500 italic py-2 text-center">
                                    No repayments recorded yet for this deal. Remaining balance owed is ₹{deal.amount.toLocaleString('en-IN')}.
                                  </div>
                                ) : (
                                  <table className="w-full text-left text-xs bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold uppercase">
                                      <tr>
                                        <th className="p-2.5">Settlement Date</th>
                                        <th className="p-2.5 text-right">Amount Repaid</th>
                                        <th className="p-2.5">Payment Mode</th>
                                        <th className="p-2.5">Notes / Reference</th>
                                        <th className="p-2.5 text-center">Proof / Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {deal.settlements.map((s) => (
                                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                          <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">{formatDateSafe(s.date)}</td>
                                          <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                            ₹{s.amountPaid.toLocaleString('en-IN')}
                                          </td>
                                          <td className="p-2.5 font-semibold text-slate-700 dark:text-slate-300 uppercase text-[11px]">
                                            {s.paymentMode.replace('_', ' ')}
                                          </td>
                                          <td className="p-2.5 text-slate-500 dark:text-slate-400 italic">
                                            {s.notes || '—'}
                                          </td>
                                          <td className="p-2.5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                              {s.receiptImage && (
                                                <button
                                                  type="button"
                                                  onClick={() => setViewingImage({ url: s.receiptImage!, title: `Repayment Proof: Rs. ${s.amountPaid}` })}
                                                  className="p-1 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded transition cursor-pointer"
                                                  title="View Repayment Proof"
                                                >
                                                  <ImageIcon className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => onDeleteSettlement(s.id)}
                                                className="p-1 text-slate-400 hover:text-red-600 rounded transition cursor-pointer"
                                                title="Delete this settlement entry"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* PRINT-ONLY AUDIT REPORT CONTAINER */}
      <div className="hidden print:block p-6 text-black bg-white space-y-6">
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
          <div>
            <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
              Inter-Partner Finance & Deal Settlement Audit Report
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Construction Manager | Inter-Partner Deal Ledger & Balance Matrix
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            <div>Report Date: {new Date().toLocaleDateString('en-IN')}</div>
            <div>Time: {new Date().toLocaleTimeString('en-IN')}</div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
            1. Executive Key Metrics
          </h2>
          <div className="grid grid-cols-4 gap-3 text-xs">
            <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Total Support Provided</div>
              <div className="text-base font-mono font-bold text-slate-900">₹{executiveStats.totalLent.toLocaleString('en-IN')}</div>
            </div>
            <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Total Settled Repaid</div>
              <div className="text-base font-mono font-bold text-slate-900">₹{executiveStats.totalSettled.toLocaleString('en-IN')}</div>
            </div>
            <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Net Outstanding Owed</div>
              <div className="text-base font-mono font-bold text-slate-900">₹{executiveStats.totalOutstanding.toLocaleString('en-IN')}</div>
            </div>
            <div className="p-3 border border-slate-300 rounded-lg bg-slate-50">
              <div className="text-[10px] text-slate-500 uppercase font-bold">Active Open Deals</div>
              <div className="text-base font-mono font-bold text-slate-900">{executiveStats.openDealsCount} Deals</div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
            2. Pairwise Inter-Partner Balance Matrix ("Who Owes Whom")
          </h2>
          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-2 border border-slate-300">Borrower (Needs Help)</th>
                <th className="p-2 border border-slate-300">Lender (Provided Money)</th>
                <th className="p-2 border border-slate-300 text-right">Total Lent (₹)</th>
                <th className="p-2 border border-slate-300 text-right">Repaid (₹)</th>
                <th className="p-2 border border-slate-300 text-right">Net Outstanding Owed (₹)</th>
              </tr>
            </thead>
            <tbody>
              {pairwiseNetBalances.map((p, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <td className="p-2 border border-slate-300 font-bold text-rose-700">{p.borrowerName}</td>
                  <td className="p-2 border border-slate-300 font-bold text-emerald-700">{p.lenderName}</td>
                  <td className="p-2 border border-slate-300 text-right font-mono">₹{p.totalLent.toLocaleString('en-IN')}</td>
                  <td className="p-2 border border-slate-300 text-right font-mono">₹{p.totalSettled.toLocaleString('en-IN')}</td>
                  <td className="p-2 border border-slate-300 text-right font-mono font-bold">₹{p.netOwed.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-1">
            3. Itemized Inter-Partner Support Deals Ledger
          </h2>
          <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[9px]">
              <tr>
                <th className="p-1.5 border border-slate-300">Date</th>
                <th className="p-1.5 border border-slate-300">Lender &rarr; Borrower</th>
                <th className="p-1.5 border border-slate-300">Purpose / Details</th>
                <th className="p-1.5 border border-slate-300 text-right">Principal (₹)</th>
                <th className="p-1.5 border border-slate-300 text-right">Repaid (₹)</th>
                <th className="p-1.5 border border-slate-300 text-right">Owed (₹)</th>
                <th className="p-1.5 border border-slate-300 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeals.map((d) => (
                <tr key={d.id} className="border-b border-slate-200">
                  <td className="p-1.5 border border-slate-300 font-mono">{formatDateSafe(d.date)}</td>
                  <td className="p-1.5 border border-slate-300 font-bold">{getPayerName(d.lenderPayerId)} &rarr; {getPayerName(d.borrowerPayerId)}</td>
                  <td className="p-1.5 border border-slate-300">{d.purpose}</td>
                  <td className="p-1.5 border border-slate-300 text-right font-mono">₹{d.amount.toLocaleString('en-IN')}</td>
                  <td className="p-1.5 border border-slate-300 text-right font-mono">₹{d.totalSettled.toLocaleString('en-IN')}</td>
                  <td className="p-1.5 border border-slate-300 text-right font-mono font-bold">₹{d.remainingBalance.toLocaleString('en-IN')}</td>
                  <td className="p-1.5 border border-slate-300 text-center font-bold">{d.calculatedStatus.toUpperCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: CREATE NEW INTER-PARTNER DEAL */}
      {isAddDealOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-amber-200 dark:border-amber-900/50 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500/20 text-amber-600 rounded-xl">
                  <Handshake className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Record Inter-Partner Financial Support</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Log financial assistance provided between partners (e.g. Deben lending to BDK)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDealOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewDeal} className="space-y-4">
              {/* Partner Lender -> Borrower Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Lender Partner (Gave Money) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={dealLenderId}
                    onChange={(e) => setDealLenderId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {payers.map(p => (
                      <option key={p.id} value={p.id}>{p.name} {p.role ? `(${p.role})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Borrower Partner (Needs Help) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={dealBorrowerId}
                    onChange={(e) => setDealBorrowerId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {payers.map(p => (
                      <option key={p.id} value={p.id}>{p.name} {p.role ? `(${p.role})` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Deal Principal Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 150000"
                    value={dealAmount}
                    onChange={(e) => setDealAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-black font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Deal Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={dealDate}
                    onChange={(e) => setDealDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Site Context */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Construction Site Context
                </label>
                <select
                  value={dealProjectId}
                  onChange={(e) => setDealProjectId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="all">General / All Sites (Personal Inter-Partner Loan)</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Purpose / Reason for Financial Support <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Financial support for BDK cement & steel shortfall, Working capital loan"
                  value={dealPurpose}
                  onChange={(e) => setDealPurpose(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Additional Remarks / Terms (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Agreed to repay within 30 days via UPI or cash"
                  value={dealNotes}
                  onChange={(e) => setDealNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Transfer Receipt Photo Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Attach Transfer Proof / UPI Screenshot (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setDealReceiptImage, setDealReceiptName)}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-100 file:text-amber-800 hover:file:bg-amber-200 cursor-pointer"
                />
                {dealReceiptImage && (
                  <div className="mt-2 text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Proof image attached ({dealReceiptName})
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddDealOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <Handshake className="w-4 h-4" />
                  <span>Save Inter-Partner Deal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD SETTLEMENT / REPAYMENT */}
      {isSettleModalOpen && selectedDealForSettlement && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-emerald-200 dark:border-emerald-900/50 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-500/20 text-emerald-600 rounded-xl">
                  <Wallet className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Record Inter-Partner Deal Settlement</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Log a partial or full repayment for this support deal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSettleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Deal Overview Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-emerald-700 dark:text-emerald-400">{getPayerName(selectedDealForSettlement.lenderPayerId)} (Lender)</span>
                <span className="text-amber-500">➔</span>
                <span className="text-rose-700 dark:text-rose-400">{getPayerName(selectedDealForSettlement.borrowerPayerId)} (Borrower)</span>
              </div>
              <div className="text-slate-600 dark:text-slate-300 font-medium">
                Purpose: <strong>{selectedDealForSettlement.purpose}</strong>
              </div>
              <div className="flex items-center justify-between text-xs font-mono font-bold pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>Principal Amount: ₹{selectedDealForSettlement.amount.toLocaleString('en-IN')}</span>
                <span className="text-rose-600 dark:text-rose-400">
                  Owed: ₹{dealsWithMetrics.find(d => d.id === selectedDealForSettlement.id)?.remainingBalance.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveSettlement} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Settlement Repayment Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Repayment Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Payment Mode
                </label>
                <select
                  value={settleMode}
                  onChange={(e) => setSettleMode(e.target.value as any)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="upi">UPI / GPay / PhonePe</option>
                  <option value="cash">Cash Handover</option>
                  <option value="bank_transfer">Bank Transfer / NEFT / IMPS</option>
                  <option value="other">Other Mode</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Settlement Notes / Reference ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. Returned ₹50,000 via PhonePe UPI ID 9812739182"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Repayment Receipt Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Attach Repayment Proof / Receipt (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, setSettleReceiptImage, setSettleReceiptName)}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-100 file:text-emerald-800 hover:file:bg-emerald-200 cursor-pointer"
                />
                {settleReceiptImage && (
                  <div className="mt-2 text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Repayment proof attached
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Settlement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: QUICK ADD PARTNER */}
      {isAddPayerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-500" />
                Register Authorized Partner / Payer
              </h3>
              <button
                type="button"
                onClick={() => setIsAddPayerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePayerQuick} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Partner / Disburser Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deben, BDK, Er. Rajesh"
                  value={newPayerName}
                  onChange={(e) => setNewPayerName(e.target.value)}
                  required
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Role / Designation</label>
                <input
                  type="text"
                  placeholder="e.g. Managing Partner, Investor, Cashier"
                  value={newPayerRole}
                  onChange={(e) => setNewPayerRole(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contact Phone (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. +91 9876543210"
                  value={newPayerPhone}
                  onChange={(e) => setNewPayerPhone(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddPayerModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl cursor-pointer"
                >
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: IMAGE PREVIEW PROOF ZOOM */}
      {viewingImage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full p-4 shadow-2xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{viewingImage.title}</h4>
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black/40 rounded-xl p-2">
              <img src={viewingImage.url} alt={viewingImage.title} className="max-h-[65vh] w-auto rounded-lg object-contain" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

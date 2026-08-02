import { Payer, Project, Advance, Payment, DailyExpense, HotelAdvance, Material, GstRecord, PettyCashEntry, PartnerDeal, Labour } from '../types';
import { matchPayerOrLabour, parsePartnerSupportName } from './payerResolver';
import { cleanEntityName, extractDigits } from './formatters';

export interface PayerTransaction {
  id: string;
  date: string;
  category: 'Labour Advance' | 'Wage Settlement' | 'Daily Expense' | 'Hotel Food' | 'Material Stock' | 'GST Tax' | 'Petty Cash Top-Up' | 'Partner Support / Deal' | 'Petty Cash Expense';
  projectId: string;
  projectName: string;
  description: string;
  amount: number;
}

export interface ConsolidatedPayerFinancial {
  payerObj?: Payer;
  id: string;
  name: string;
  role?: string;
  phone?: string;
  notes?: string;
  totalDisbursed: number;
  advancesTotal: number;
  paymentsTotal: number;
  expensesTotal: number;
  hotelTotal: number;
  materialsTotal: number;
  gstTotal: number;
  pettyCashTotal: number;
  partnerDealsLent: number;
  partnerDealsBorrowed: number;
  transactionCount: number;
  projectAmounts: Map<string, number>;
  transactions: PayerTransaction[];
}

export interface CalculatePayerFinancialsOptions {
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
}

/**
 * Consolidated data processing function that explicitly aggregates disbursements
 * across advances, wage settlements, daily expenses, hotel food, materials, GST invoices,
 * petty cash top-ups, and partner deals, mapping all linked vector IDs accurately.
 */
export function calculateConsolidatedPayerFinancials(
  options: CalculatePayerFinancialsOptions
): ConsolidatedPayerFinancial[] {
  const {
    payers = [],
    projects = [],
    advanceRecords = [],
    paymentRecords = [],
    dailyExpenses = [],
    hotelAdvances = [],
    materials = [],
    gstRecords = [],
    pettyCashEntries = [],
    partnerDeals = [],
    labours = []
  } = options;

  const map = new Map<string, ConsolidatedPayerFinancial>();

  const getOrCreateEntry = (payerRef: string, defaultName?: string): ConsolidatedPayerFinancial | null => {
    const rawRef = (payerRef || '').trim();
    if (!rawRef) return null;

    const cleanedRef = cleanEntityName(rawRef);
    const targetLower = cleanedRef.toLowerCase();
    const rawDigits = extractDigits(rawRef);

    // Find registered payer profile or labour member using shared utility
    const { registeredPayer: registered, labourMember } = matchPayerOrLabour(rawRef, payers, labours);

    const canonicalId = registered ? registered.id : (labourMember ? labourMember.id : targetLower);
    const displayName = registered ? registered.name : (labourMember ? labourMember.name : (defaultName || cleanedRef || rawRef));
    const targetLowerName = cleanEntityName(displayName).toLowerCase();

    let resolvedKey = canonicalId;
    const targetPhone = (registered?.phone || labourMember?.contact || labourMember?.phone || '').trim().replace(/\D/g, '');

    if (!map.has(canonicalId)) {
      for (const [k, v] of map.entries()) {
        const vNameClean = cleanEntityName(v.name).toLowerCase();
        const vPhoneClean = extractDigits(v.phone);
        const vFirstName = vNameClean.split(' ')[0];
        const tFirstName = targetLowerName.split(' ')[0];

        const nameMatch = vNameClean === targetLowerName || 
          (targetLowerName.length >= 3 && vNameClean.includes(targetLowerName)) || 
          (vNameClean.length >= 3 && targetLowerName.includes(vNameClean)) ||
          (tFirstName.length >= 3 && vFirstName === tFirstName);

        const phoneMatch = Boolean(
          (targetPhone && vPhoneClean && targetPhone.length >= 6 && vPhoneClean.length >= 6 &&
           (targetPhone === vPhoneClean || targetPhone.endsWith(vPhoneClean) || vPhoneClean.endsWith(targetPhone))) ||
          (rawDigits && vPhoneClean && rawDigits.length >= 6 && vPhoneClean.length >= 6 &&
           (rawDigits === vPhoneClean || rawDigits.endsWith(vPhoneClean) || vPhoneClean.endsWith(rawDigits)))
        );

        if (nameMatch || phoneMatch) {
          resolvedKey = k;
          break;
        }
      }
    }

    if (!map.has(resolvedKey)) {
      map.set(resolvedKey, {
        payerObj: registered,
        id: registered ? registered.id : resolvedKey,
        name: displayName,
        role: registered?.role || (labourMember ? `Labour: ${labourMember.role || labourMember.category || 'Member'}` : undefined),
        phone: registered?.phone || labourMember?.contact || labourMember?.phone || (rawDigits.length >= 6 ? rawRef : undefined),
        notes: (registered as any)?.notes,
        totalDisbursed: 0,
        advancesTotal: 0,
        paymentsTotal: 0,
        expensesTotal: 0,
        hotelTotal: 0,
        materialsTotal: 0,
        gstTotal: 0,
        pettyCashTotal: 0,
        partnerDealsLent: 0,
        partnerDealsBorrowed: 0,
        transactionCount: 0,
        projectAmounts: new Map<string, number>(),
        transactions: []
      });
    }
    return map.get(resolvedKey)!;
  };

  // Initialize all registered payers first so they have records even with 0 outlays
  payers.forEach(p => {
    getOrCreateEntry(p.id, p.name);
  });

  const getProjectName = (pId: string) => {
    const prj = projects.find(p => p.id === pId);
    return prj ? prj.name : 'Unassigned / Main Site';
  };

  // Helper to resolve entry key if explicit payer field is missing or typed in notes/altText
  const resolveEntryKey = (explicitPaidBy?: string, notes?: string, altText?: string) => {
    const rawRef = (explicitPaidBy || '').trim();
    if (rawRef) {
      const entry = getOrCreateEntry(rawRef);
      if (entry) return entry;
    }

    // Fallback: search for registered payer or labour name inside notes or altText
    const fullText = `${notes || ''} ${altText || ''}`.toLowerCase();
    if (fullText) {
      for (const pObj of payers) {
        const pClean = cleanEntityName(pObj.name).toLowerCase();
        const pFirstName = pClean.split(' ')[0];
        if (pClean && pClean.length >= 3 && fullText.includes(pClean)) {
          return getOrCreateEntry(pObj.id, pObj.name);
        }
        if (pFirstName && pFirstName.length >= 3 && fullText.includes(pFirstName)) {
          return getOrCreateEntry(pObj.id, pObj.name);
        }
      }
      for (const lObj of labours) {
        const lClean = cleanEntityName(lObj.name).toLowerCase();
        const lFirstName = lClean.split(' ')[0];
        if (lClean && lClean.length >= 3 && fullText.includes(lClean)) {
          return getOrCreateEntry(lObj.id, lObj.name);
        }
        if (lFirstName && lFirstName.length >= 3 && fullText.includes(lFirstName)) {
          return getOrCreateEntry(lObj.id, lObj.name);
        }
      }
    }
    return null;
  };

  // Helper to resolve partner support provider
  const resolvePartnerHelper = (partnerRef?: string, description?: string, notes?: string) => {
    const partnerName = parsePartnerSupportName(`${description || ''} ${notes || ''}`);
    if (partnerName) {
      const p = resolveEntryKey(partnerName);
      if (p) return p;
    }
    const rawRef = (partnerRef || '').trim();
    if (rawRef) {
      const p = resolveEntryKey(rawRef);
      if (p) return p;
    }
    return null;
  };

  // 1. Labour Micro Advances
  advanceRecords.forEach(adv => {
    const totalAmount = Number(adv.amount) || 0;
    if (adv.isPartnerHelp) {
      const partnerVal = Number(adv.partnerAmount);
      const partnerHelpAmount = (!isNaN(partnerVal) && partnerVal > 0) ? partnerVal : totalAmount;
      const primaryAmount = Math.max(0, totalAmount - partnerHelpAmount);

      const partnerEntry = resolvePartnerHelper(adv.partnerPhone, adv.description);
      const disburserEntry = adv.paidBy ? resolveEntryKey(adv.paidBy, adv.description) : null;

      if (partnerEntry) {
        partnerEntry.totalDisbursed += partnerHelpAmount;
        partnerEntry.advancesTotal += partnerHelpAmount;
        partnerEntry.transactionCount += 1;
        const curr = partnerEntry.projectAmounts.get(adv.projectId) || 0;
        partnerEntry.projectAmounts.set(adv.projectId, curr + partnerHelpAmount);

        partnerEntry.transactions.push({
          id: `${adv.id}_partner`,
          date: adv.date,
          category: 'Labour Advance',
          projectId: adv.projectId,
          projectName: getProjectName(adv.projectId),
          description: `${adv.description || 'Labour Micro Advance'} (🤝 Partner Support Provided)`,
          amount: partnerHelpAmount
        });
      }

      if (disburserEntry && disburserEntry !== partnerEntry) {
        if (primaryAmount > 0) {
          disburserEntry.totalDisbursed += primaryAmount;
          disburserEntry.advancesTotal += primaryAmount;
          disburserEntry.transactionCount += 1;
          const curr = disburserEntry.projectAmounts.get(adv.projectId) || 0;
          disburserEntry.projectAmounts.set(adv.projectId, curr + primaryAmount);

          disburserEntry.transactions.push({
            id: `${adv.id}_primary`,
            date: adv.date,
            category: 'Labour Advance',
            projectId: adv.projectId,
            projectName: getProjectName(adv.projectId),
            description: `${adv.description || 'Labour Micro Advance'} (Disbursed; Partner Support: ₹${partnerHelpAmount.toLocaleString('en-IN')})`,
            amount: primaryAmount
          });
        } else {
          disburserEntry.transactions.push({
            id: `${adv.id}_primary_info`,
            date: adv.date,
            category: 'Labour Advance',
            projectId: adv.projectId,
            projectName: getProjectName(adv.projectId),
            description: `${adv.description || 'Labour Micro Advance'} (100% Funded by Partner Support)`,
            amount: totalAmount
          });
        }
      } else if (!partnerEntry && disburserEntry) {
        disburserEntry.totalDisbursed += totalAmount;
        disburserEntry.advancesTotal += totalAmount;
        disburserEntry.transactionCount += 1;
        const curr = disburserEntry.projectAmounts.get(adv.projectId) || 0;
        disburserEntry.projectAmounts.set(adv.projectId, curr + totalAmount);

        disburserEntry.transactions.push({
          id: adv.id,
          date: adv.date,
          category: 'Labour Advance',
          projectId: adv.projectId,
          projectName: getProjectName(adv.projectId),
          description: `${adv.description || 'Labour Micro Advance'} (🤝 Partner Support)`,
          amount: totalAmount
        });
      }
    } else {
      const entry = resolveEntryKey(adv.paidBy, adv.description);
      if (entry) {
        entry.totalDisbursed += totalAmount;
        entry.advancesTotal += totalAmount;
        entry.transactionCount += 1;
        const curr = entry.projectAmounts.get(adv.projectId) || 0;
        entry.projectAmounts.set(adv.projectId, curr + totalAmount);

        entry.transactions.push({
          id: adv.id,
          date: adv.date,
          category: 'Labour Advance',
          projectId: adv.projectId,
          projectName: getProjectName(adv.projectId),
          description: adv.description || 'Labour Micro Advance',
          amount: totalAmount
        });
      }
    }
  });

  // 2. Wage Settlements
  paymentRecords.forEach(pay => {
    const paidBy = (pay as any).paidBy;
    const entry = resolveEntryKey(paidBy, pay.notes);
    if (entry) {
      const payAmt = Number(pay.amountPaid) || 0;
      entry.totalDisbursed += payAmt;
      entry.paymentsTotal += payAmt;
      entry.transactionCount += 1;
      const curr = entry.projectAmounts.get(pay.projectId) || 0;
      entry.projectAmounts.set(pay.projectId, curr + payAmt);

      entry.transactions.push({
        id: pay.id,
        date: pay.date,
        category: 'Wage Settlement',
        projectId: pay.projectId,
        projectName: getProjectName(pay.projectId),
        description: pay.notes || `Wage Payout (${pay.daysWorked} days worked)`,
        amount: payAmt
      });
    }
  });

  // 3. Daily Operational Expenses
  dailyExpenses.forEach(exp => {
    const totalAmount = Number(exp.amount) || 0;
    if (exp.isPartnerHelp) {
      const partnerVal = Number(exp.partnerAmount);
      const partnerHelpAmount = (!isNaN(partnerVal) && partnerVal > 0) ? partnerVal : totalAmount;
      const primaryAmount = Math.max(0, totalAmount - partnerHelpAmount);

      const partnerEntry = resolvePartnerHelper(exp.partnerPhone, exp.description);
      const disburserEntry = exp.payerId ? resolveEntryKey(exp.payerId, exp.description, exp.subCategory) : null;

      if (partnerEntry) {
        partnerEntry.totalDisbursed += partnerHelpAmount;
        partnerEntry.expensesTotal += partnerHelpAmount;
        partnerEntry.transactionCount += 1;
        const curr = partnerEntry.projectAmounts.get(exp.projectId) || 0;
        partnerEntry.projectAmounts.set(exp.projectId, curr + partnerHelpAmount);

        partnerEntry.transactions.push({
          id: `${exp.id}_partner`,
          date: exp.date,
          category: 'Daily Expense',
          projectId: exp.projectId,
          projectName: getProjectName(exp.projectId),
          description: `${exp.description || `Misc Expense (${exp.subCategory})`} (🤝 Partner Support Provided)`,
          amount: partnerHelpAmount
        });
      }

      if (disburserEntry && disburserEntry !== partnerEntry) {
        if (primaryAmount > 0) {
          disburserEntry.totalDisbursed += primaryAmount;
          disburserEntry.expensesTotal += primaryAmount;
          disburserEntry.transactionCount += 1;
          const curr = disburserEntry.projectAmounts.get(exp.projectId) || 0;
          disburserEntry.projectAmounts.set(exp.projectId, curr + primaryAmount);

          disburserEntry.transactions.push({
            id: `${exp.id}_primary`,
            date: exp.date,
            category: 'Daily Expense',
            projectId: exp.projectId,
            projectName: getProjectName(exp.projectId),
            description: `${exp.description || `Misc Expense (${exp.subCategory})`} (Disbursed; Partner Support: ₹${partnerHelpAmount.toLocaleString('en-IN')})`,
            amount: primaryAmount
          });
        } else {
          disburserEntry.transactions.push({
            id: `${exp.id}_primary_info`,
            date: exp.date,
            category: 'Daily Expense',
            projectId: exp.projectId,
            projectName: getProjectName(exp.projectId),
            description: `${exp.description || `Misc Expense (${exp.subCategory})`} (100% Funded by Partner Support)`,
            amount: totalAmount
          });
        }
      } else if (!partnerEntry && disburserEntry) {
        disburserEntry.totalDisbursed += totalAmount;
        disburserEntry.expensesTotal += totalAmount;
        disburserEntry.transactionCount += 1;
        const curr = disburserEntry.projectAmounts.get(exp.projectId) || 0;
        disburserEntry.projectAmounts.set(exp.projectId, curr + totalAmount);

        disburserEntry.transactions.push({
          id: exp.id,
          date: exp.date,
          category: 'Daily Expense',
          projectId: exp.projectId,
          projectName: getProjectName(exp.projectId),
          description: `${exp.description || `Misc Expense (${exp.subCategory})`} (🤝 Partner Support)`,
          amount: totalAmount
        });
      }
    } else {
      const entry = resolveEntryKey(exp.payerId, exp.description, exp.subCategory);
      if (entry) {
        entry.totalDisbursed += totalAmount;
        entry.expensesTotal += totalAmount;
        entry.transactionCount += 1;
        const curr = entry.projectAmounts.get(exp.projectId) || 0;
        entry.projectAmounts.set(exp.projectId, curr + totalAmount);

        entry.transactions.push({
          id: exp.id,
          date: exp.date,
          category: 'Daily Expense',
          projectId: exp.projectId,
          projectName: getProjectName(exp.projectId),
          description: exp.description || `Misc Expense (${exp.subCategory})`,
          amount: totalAmount
        });
      }
    }
  });

  // 4. Hotel & Mess Food Advances
  hotelAdvances.forEach(ha => {
    const totalAmount = Number(ha.amount) || 0;
    const paidBy = (ha as any).paidBy;
    if (ha.isPartnerHelp) {
      const partnerVal = Number(ha.partnerAmount);
      const partnerHelpAmount = (!isNaN(partnerVal) && partnerVal > 0) ? partnerVal : totalAmount;
      const primaryAmount = Math.max(0, totalAmount - partnerHelpAmount);

      const partnerEntry = resolvePartnerHelper(ha.partnerPhone, ha.notes, ha.hotelName);
      const disburserEntry = paidBy ? resolveEntryKey(paidBy, ha.notes, ha.hotelName) : null;

      if (partnerEntry) {
        partnerEntry.totalDisbursed += partnerHelpAmount;
        partnerEntry.hotelTotal += partnerHelpAmount;
        partnerEntry.transactionCount += 1;
        const curr = partnerEntry.projectAmounts.get(ha.projectId) || 0;
        partnerEntry.projectAmounts.set(ha.projectId, curr + partnerHelpAmount);

        partnerEntry.transactions.push({
          id: `${ha.id}_partner`,
          date: ha.date,
          category: 'Hotel Food',
          projectId: ha.projectId,
          projectName: getProjectName(ha.projectId),
          description: `${ha.hotelName} ${ha.notes ? `(${ha.notes})` : ''} (🤝 Partner Support Provided)`,
          amount: partnerHelpAmount
        });
      }

      if (disburserEntry && disburserEntry !== partnerEntry) {
        if (primaryAmount > 0) {
          disburserEntry.totalDisbursed += primaryAmount;
          disburserEntry.hotelTotal += primaryAmount;
          disburserEntry.transactionCount += 1;
          const curr = disburserEntry.projectAmounts.get(ha.projectId) || 0;
          disburserEntry.projectAmounts.set(ha.projectId, curr + primaryAmount);

          disburserEntry.transactions.push({
            id: `${ha.id}_primary`,
            date: ha.date,
            category: 'Hotel Food',
            projectId: ha.projectId,
            projectName: getProjectName(ha.projectId),
            description: `${ha.hotelName} ${ha.notes ? `(${ha.notes})` : ''} (Disbursed; Partner Support: ₹${partnerHelpAmount.toLocaleString('en-IN')})`,
            amount: primaryAmount
          });
        } else {
          disburserEntry.transactions.push({
            id: `${ha.id}_primary_info`,
            date: ha.date,
            category: 'Hotel Food',
            projectId: ha.projectId,
            projectName: getProjectName(ha.projectId),
            description: `${ha.hotelName} ${ha.notes ? `(${ha.notes})` : ''} (100% Funded by Partner Support)`,
            amount: totalAmount
          });
        }
      } else if (!partnerEntry && disburserEntry) {
        disburserEntry.totalDisbursed += totalAmount;
        disburserEntry.hotelTotal += totalAmount;
        disburserEntry.transactionCount += 1;
        const curr = disburserEntry.projectAmounts.get(ha.projectId) || 0;
        disburserEntry.projectAmounts.set(ha.projectId, curr + totalAmount);

        disburserEntry.transactions.push({
          id: ha.id,
          date: ha.date,
          category: 'Hotel Food',
          projectId: ha.projectId,
          projectName: getProjectName(ha.projectId),
          description: `${ha.hotelName} ${ha.notes ? `(${ha.notes})` : ''} (🤝 Partner Support)`,
          amount: totalAmount
        });
      }
    } else {
      const entry = resolveEntryKey(paidBy, ha.notes, ha.hotelName);
      if (entry) {
        entry.totalDisbursed += totalAmount;
        entry.hotelTotal += totalAmount;
        entry.transactionCount += 1;
        const curr = entry.projectAmounts.get(ha.projectId) || 0;
        entry.projectAmounts.set(ha.projectId, curr + totalAmount);

        entry.transactions.push({
          id: ha.id,
          date: ha.date,
          category: 'Hotel Food',
          projectId: ha.projectId,
          projectName: getProjectName(ha.projectId),
          description: `${ha.hotelName} ${ha.notes ? `(${ha.notes})` : ''}`,
          amount: totalAmount
        });
      }
    }
  });

  // 5. Material Stock Procurement
  materials.forEach(m => {
    const totalAmount = Number(m.cost) || 0;
    const paidBy = (m as any).paidBy;
    if (m.isPartnerHelp) {
      const partnerVal = Number(m.partnerAmount);
      const partnerHelpAmount = (!isNaN(partnerVal) && partnerVal > 0) ? partnerVal : totalAmount;
      const primaryAmount = Math.max(0, totalAmount - partnerHelpAmount);

      const partnerEntry = resolvePartnerHelper(m.partnerPhone, m.name, m.supplier);
      const disburserEntry = paidBy ? resolveEntryKey(paidBy, m.name, m.supplier) : null;

      if (partnerEntry) {
        partnerEntry.totalDisbursed += partnerHelpAmount;
        partnerEntry.materialsTotal += partnerHelpAmount;
        partnerEntry.transactionCount += 1;
        const curr = partnerEntry.projectAmounts.get(m.projectId) || 0;
        partnerEntry.projectAmounts.set(m.projectId, curr + partnerHelpAmount);

        partnerEntry.transactions.push({
          id: `${m.id}_partner`,
          date: m.dateBought,
          category: 'Material Stock',
          projectId: m.projectId,
          projectName: getProjectName(m.projectId),
          description: `${m.name} (${m.quantityBought} ${m.unit}) - ${m.supplier || 'Vendor'} (🤝 Partner Support Provided)`,
          amount: partnerHelpAmount
        });
      }

      if (disburserEntry && disburserEntry !== partnerEntry) {
        if (primaryAmount > 0) {
          disburserEntry.totalDisbursed += primaryAmount;
          disburserEntry.materialsTotal += primaryAmount;
          disburserEntry.transactionCount += 1;
          const curr = disburserEntry.projectAmounts.get(m.projectId) || 0;
          disburserEntry.projectAmounts.set(m.projectId, curr + primaryAmount);

          disburserEntry.transactions.push({
            id: `${m.id}_primary`,
            date: m.dateBought,
            category: 'Material Stock',
            projectId: m.projectId,
            projectName: getProjectName(m.projectId),
            description: `${m.name} (${m.quantityBought} ${m.unit}) - ${m.supplier || 'Vendor'} (Disbursed; Partner Support: ₹${partnerHelpAmount.toLocaleString('en-IN')})`,
            amount: primaryAmount
          });
        } else {
          disburserEntry.transactions.push({
            id: `${m.id}_primary_info`,
            date: m.dateBought,
            category: 'Material Stock',
            projectId: m.projectId,
            projectName: getProjectName(m.projectId),
            description: `${m.name} (${m.quantityBought} ${m.unit}) - ${m.supplier || 'Vendor'} (100% Funded by Partner Support)`,
            amount: totalAmount
          });
        }
      } else if (!partnerEntry && disburserEntry) {
        disburserEntry.totalDisbursed += totalAmount;
        disburserEntry.materialsTotal += totalAmount;
        disburserEntry.transactionCount += 1;
        const curr = disburserEntry.projectAmounts.get(m.projectId) || 0;
        disburserEntry.projectAmounts.set(m.projectId, curr + totalAmount);

        disburserEntry.transactions.push({
          id: m.id,
          date: m.dateBought,
          category: 'Material Stock',
          projectId: m.projectId,
          projectName: getProjectName(m.projectId),
          description: `${m.name} (${m.quantityBought} ${m.unit}) - ${m.supplier || 'Vendor'} (🤝 Partner Support)`,
          amount: totalAmount
        });
      }
    } else {
      const entry = resolveEntryKey(paidBy, m.name, m.supplier);
      if (entry) {
        entry.totalDisbursed += totalAmount;
        entry.materialsTotal += totalAmount;
        entry.transactionCount += 1;
        const curr = entry.projectAmounts.get(m.projectId) || 0;
        entry.projectAmounts.set(m.projectId, curr + totalAmount);

        entry.transactions.push({
          id: m.id,
          date: m.dateBought,
          category: 'Material Stock',
          projectId: m.projectId,
          projectName: getProjectName(m.projectId),
          description: `${m.name} (${m.quantityBought} ${m.unit}) - ${m.supplier || 'Vendor'}`,
          amount: totalAmount
        });
      }
    }
  });

  // 6. GST Invoices Tax Paid
  gstRecords.forEach(g => {
    const paidBy = (g as any).paidBy;
    if (g.type === 'paid') {
      const totalPaid = (Number(g.amount) || 0) + (Number(g.gstAmount) || 0);

      if (g.isPartnerHelp) {
        const partnerVal = Number(g.partnerAmount);
        const partnerHelpAmount = (!isNaN(partnerVal) && partnerVal > 0) ? partnerVal : totalPaid;
        const primaryAmount = Math.max(0, totalPaid - partnerHelpAmount);

        const partnerEntry = resolvePartnerHelper(g.partnerPhone, g.partyName, g.notes);
        const disburserEntry = paidBy ? resolveEntryKey(paidBy, g.partyName, g.invoiceNo) : null;

        if (partnerEntry) {
          partnerEntry.totalDisbursed += partnerHelpAmount;
          partnerEntry.gstTotal += partnerHelpAmount;
          partnerEntry.transactionCount += 1;
          const curr = partnerEntry.projectAmounts.get(g.projectId) || 0;
          partnerEntry.projectAmounts.set(g.projectId, curr + partnerHelpAmount);

          partnerEntry.transactions.push({
            id: `${g.id}_partner`,
            date: g.date,
            category: 'GST Tax',
            projectId: g.projectId,
            projectName: getProjectName(g.projectId),
            description: `GST Invoice #${g.invoiceNo} (${g.partyName}) (🤝 Partner Support Provided)`,
            amount: partnerHelpAmount
          });
        }

        if (disburserEntry && disburserEntry !== partnerEntry) {
          if (primaryAmount > 0) {
            disburserEntry.totalDisbursed += primaryAmount;
            disburserEntry.gstTotal += primaryAmount;
            disburserEntry.transactionCount += 1;
            const curr = disburserEntry.projectAmounts.get(g.projectId) || 0;
            disburserEntry.projectAmounts.set(g.projectId, curr + primaryAmount);

            disburserEntry.transactions.push({
              id: `${g.id}_primary`,
              date: g.date,
              category: 'GST Tax',
              projectId: g.projectId,
              projectName: getProjectName(g.projectId),
              description: `GST Invoice #${g.invoiceNo} (${g.partyName}) (Disbursed; Partner Support: ₹${partnerHelpAmount.toLocaleString('en-IN')})`,
              amount: primaryAmount
            });
          }
        } else if (!partnerEntry && disburserEntry) {
          disburserEntry.totalDisbursed += totalPaid;
          disburserEntry.gstTotal += totalPaid;
          disburserEntry.transactionCount += 1;
          const curr = disburserEntry.projectAmounts.get(g.projectId) || 0;
          disburserEntry.projectAmounts.set(g.projectId, curr + totalPaid);

          disburserEntry.transactions.push({
            id: g.id,
            date: g.date,
            category: 'GST Tax',
            projectId: g.projectId,
            projectName: getProjectName(g.projectId),
            description: `GST Invoice #${g.invoiceNo} (${g.partyName}) (🤝 Partner Support)`,
            amount: totalPaid
          });
        }
      } else {
        const entry = resolveEntryKey(paidBy, g.partyName, g.invoiceNo);
        if (entry) {
          entry.totalDisbursed += totalPaid;
          entry.gstTotal += totalPaid;
          entry.transactionCount += 1;
          const curr = entry.projectAmounts.get(g.projectId) || 0;
          entry.projectAmounts.set(g.projectId, curr + totalPaid);

          entry.transactions.push({
            id: g.id,
            date: g.date,
            category: 'GST Tax',
            projectId: g.projectId,
            projectName: getProjectName(g.projectId),
            description: `GST Invoice #${g.invoiceNo} (${g.partyName})`,
            amount: totalPaid
          });
        }
      }
    }
  });

  // 7. Petty Cash Top-Ups & Direct Disburser Petty Cash Expenses
  pettyCashEntries.forEach(pc => {
    const pcAmt = Number(pc.amount) || 0;
    if (pc.type === 'top_up') {
      const entry = resolveEntryKey(pc.payerId || pc.supervisorName, pc.description, pc.category);
      if (entry) {
        entry.totalDisbursed += pcAmt;
        entry.pettyCashTotal += pcAmt;
        entry.transactionCount += 1;
        const curr = entry.projectAmounts.get(pc.projectId) || 0;
        entry.projectAmounts.set(pc.projectId, curr + pcAmt);

        entry.transactions.push({
          id: pc.id,
          date: pc.date,
          category: 'Petty Cash Top-Up',
          projectId: pc.projectId,
          projectName: getProjectName(pc.projectId),
          description: `Top-up for Supervisor ${pc.supervisorName} (${pc.description})`,
          amount: pcAmt
        });
      }
    } else if (pc.type === 'expense' && pc.payerId) {
      // Out-of-pocket petty cash expense explicitly paid by a disburser
      const entry = resolveEntryKey(pc.payerId, pc.description, pc.category);
      if (entry) {
        entry.totalDisbursed += pcAmt;
        entry.pettyCashTotal += pcAmt;
        entry.transactionCount += 1;
        const curr = entry.projectAmounts.get(pc.projectId) || 0;
        entry.projectAmounts.set(pc.projectId, curr + pcAmt);

        entry.transactions.push({
          id: pc.id,
          date: pc.date,
          category: 'Petty Cash Expense',
          projectId: pc.projectId,
          projectName: getProjectName(pc.projectId),
          description: `Direct Petty Cash Expense: ${pc.description} (${pc.category || 'Site Petty'})`,
          amount: pcAmt
        });
      }
    }
  });

  // 8. Inter-Partner Financial Deals (Lent / Invested)
  (partnerDeals || []).forEach(deal => {
    if (deal.lenderPayerId) {
      const entry = getOrCreateEntry(deal.lenderPayerId, undefined) || resolveEntryKey(deal.lenderPayerId, deal.purpose);
      if (entry) {
        const actualAmount = Number(deal.amount) || 0;
        entry.totalDisbursed += actualAmount;
        entry.partnerDealsLent += actualAmount;
        entry.transactionCount += 1;
        const pId = deal.projectId || 'all';
        const curr = entry.projectAmounts.get(pId) || 0;
        entry.projectAmounts.set(pId, curr + actualAmount);

        entry.transactions.push({
          id: deal.id,
          date: deal.date,
          category: 'Partner Support / Deal',
          projectId: pId,
          projectName: deal.projectId && deal.projectId !== 'all' ? getProjectName(deal.projectId) : 'Inter-Partner Support',
          description: `Partner Support: ${deal.purpose || 'Financial assistance'} (To: ${deal.borrowerPayerId})`,
          amount: actualAmount
        });
      }
    }
    if (deal.borrowerPayerId) {
      const borrowerEntry = getOrCreateEntry(deal.borrowerPayerId, undefined) || resolveEntryKey(deal.borrowerPayerId);
      if (borrowerEntry) {
        borrowerEntry.partnerDealsBorrowed += Number(deal.amount) || 0;
      }
    }
  });

  // Sort transactions by date descending
  map.forEach(item => {
    item.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  });

  return Array.from(map.values()).sort((a, b) => b.totalDisbursed - a.totalDisbursed);
}

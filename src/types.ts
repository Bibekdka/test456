/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BaseEntity {
  updatedAt?: number;
  deletedAt?: number;
}

export interface ProjectDocument extends BaseEntity {
  id: string;
  projectId: string; // construction site ID
  name: string; // document title e.g. "Site Plan Blueprint v2", "Structural Agreement"
  category: 'contract' | 'site_plan' | 'approval' | 'estimate' | 'invoice' | 'other';
  fileType: string; // 'pdf', 'image', 'dwg', 'docx', 'txt', etc.
  fileName: string; // Original file name
  fileSize: number; // in bytes
  dataUrl?: string; // base64 / blob URL for preview and storing file content
  notes?: string;
  uploadedAt: string; // ISO date string
  aiSummary?: string; // Cached AI document insight/analysis
}

export interface Project extends BaseEntity {
  id: string;
  name: string;
  description: string;
  location?: string;
  startDate: string;
  targetDate: string; // completion timeline
  budget: number;
  status: 'active' | 'completed' | 'on_hold';
  parentProjectId?: string; // Optional ID of parent main project for multi-site hierarchy
  labourBudget?: number;
  materialBudget?: number;
  foodBudget?: number;
  expenseBudget?: number;
}

/**
 * Helper to get all project IDs included in a project's rollup scope.
 * If project has sub-sites, returns [project.id, ...subSiteIds].
 * Otherwise, returns [project.id].
 */
export function getProjectScopeIds(projectId: string, projects: Project[]): string[] {
  const scopeSet = new Set<string>([projectId]);
  
  const collectChildren = (pId: string) => {
    projects.forEach(p => {
      if (p.parentProjectId === pId && !scopeSet.has(p.id)) {
        scopeSet.add(p.id);
        collectChildren(p.id);
      }
    });
  };

  collectChildren(projectId);
  return Array.from(scopeSet);
}

export type PersonRole = 'worker' | 'contractor' | 'staff' | 'other';

export interface Labour extends BaseEntity {
  id: string;
  name: string;
  perDayWage: number;
  contact: string;
  phone?: string;
  category?: string;
  status: 'active' | 'left'; // can be set to 'left' if they leave in the middle
  leftDate?: string; // date they left work
  joinedDate?: string; // date they joined work
  role?: PersonRole; // 'worker' | 'contractor' | 'staff' | 'other'
  isSalaryApplicable?: boolean;
  projectId?: string; // Optional project/site ID where assigned or registered
}

/**
 * Helper to check if a worker belongs to or has history in a specific project (or sub-sites scope).
 * Returns true for all workers so labours from different or old sites can freely come to work at any site.
 */
export function isLabourInProjectScope(
  labour: Labour,
  targetProjectId: string,
  projects: Project[] = [],
  attendanceRecords: Attendance[] = [],
  foodLogs: FoodLog[] = [],
  advanceRecords: Advance[] = [],
  paymentRecords: Payment[] = []
): boolean {
  return true;
}

function scopeIdsHas(set: Set<string>, pId?: string): boolean {
  return pId ? set.has(pId) : false;
}

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'home' | 'pending' | 'rest';

export interface Attendance extends BaseEntity {
  id: string;
  labourId: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  dailyWage?: number;
}

export interface Advance extends BaseEntity {
  id: string;
  labourId: string;
  projectId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
  paidBy?: string; // ID or Name of Payer who made the payment
  isPartnerHelp?: boolean;
  partnerPhone?: string;
  partnerAmount?: number;
}

export interface Payer extends BaseEntity {
  id: string;
  name: string;
  role?: string; // e.g., Supervisor, Cashier, Manager
  phone?: string;
  notes?: string;
}

export interface PartnerDeal extends BaseEntity {
  id: string;
  projectId?: string; // Construction site ID or 'all' for general inter-partner deal
  lenderPayerId: string; // ID or Name of partner giving/lending money (e.g. Deben)
  borrowerPayerId: string; // ID or Name of partner receiving/helped by money (e.g. BDK)
  amount: number; // Principal deal amount lent
  date: string; // YYYY-MM-DD
  purpose: string; // Purpose / reason for financial support (e.g. "Site material shortfall support")
  status: 'pending' | 'partially_settled' | 'settled';
  notes?: string;
  lenderPhone?: string;
  borrowerPhone?: string;
  receiptImage?: string; // Base64 data URI of transfer receipt / UPI proof
  receiptImageName?: string;
}

export interface PartnerSettlement extends BaseEntity {
  id: string;
  dealId: string; // Reference to PartnerDeal ID
  date: string; // YYYY-MM-DD
  amountPaid: number; // Repayment / Settlement amount
  paymentMode: 'cash' | 'upi' | 'bank_transfer' | 'other';
  notes?: string;
  receiptImage?: string;
  receiptImageName?: string;
}

export interface Payment extends BaseEntity {
  id: string;
  labourId: string;
  projectId: string;
  date: string; // YYYY-MM-DD - paid date stamp
  amountPaid: number;
  advanceDeducted: number;
  baseWages: number;
  daysWorked: number;
  notes?: string;
  paidBy?: string; // ID or Name of Payer who made the payment / wage payout
}

export interface MaterialUsage {
  id: string;
  date: string; // YYYY-MM-DD
  quantityUsed: number;
  description?: string;
}

export interface Material extends BaseEntity {
  id: string;
  projectId: string;
  name: string;
  quantityBought: number;
  unit: string; // e.g., Bags, Tons, CFT, Liters, kg, pieces
  cost: number;
  dateBought: string; // YYYY-MM-DD
  supplier?: string;
  paidBy?: string; // ID or Name of Payer who made the material payment
  isPartnerHelp?: boolean;
  partnerPhone?: string;
  partnerAmount?: number;
  billImage?: string; // Base64 data URI of the uploaded image
  billImageName?: string;
  usages: MaterialUsage[];
  alertThreshold?: number; // stock warning alert threshold
}

export interface SiteDiaryEntry extends BaseEntity {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  supervisorName: string;
  workDone: string; // description of work done
  manpowerCount: number; // calculated from attendance or entered
  safetyLog?: string; // safety compliance notes
  remarks?: string; // other operational notes
}

export interface DelayWeatherLog extends BaseEntity {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  weather: 'sunny' | 'rainy' | 'cloudy' | 'extreme_heat' | 'stormy' | 'cold';
  temperature?: string; // e.g. "32°C" or "25"
  isDelay: boolean;
  delayHours?: number;
  delayReason?: 'none' | 'rain' | 'labour_shortage' | 'material_delay' | 'power_cut' | 'machinery_breakdown' | 'other';
  delayNotes?: string;
}

export interface HotelAdvance extends BaseEntity {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  hotelName: string;
  paidBy?: string; // ID or Name of Payer who made the hotel/mess payment
  isPartnerHelp?: boolean;
  partnerPhone?: string;
  partnerAmount?: number;
  notes?: string;
}

export interface FoodLog extends BaseEntity {
  id: string;
  projectId: string;
  labourId: string;
  date: string; // YYYY-MM-DD
  cost: number; // Defaults to 100
  mealsCount: number; // Defaults to 1
  notes?: string;
}

export interface GstRecord extends BaseEntity {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  invoiceNo: string;
  partyName: string;
  gstin?: string;
  amount: number; // Taxable value/Base amount
  gstRate: number; // GST rate in percentage (e.g., 5, 12, 18, 28)
  gstAmount: number; // GST amount
  type: 'paid' | 'claimed'; // 'paid' (Paid on Purchase/Input Tax) or 'claimed' (Collected/Claimed on Sales/Output Tax)
  paidBy?: string; // ID or Name of Payer who made the payment
  isPartnerHelp?: boolean;
  partnerPhone?: string;
  partnerAmount?: number;
  notes?: string;
}

export interface DailyExpense extends BaseEntity {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  category: 'labour_expense' | 'misc_transaction';
  subCategory: string; // e.g., 'transport', 'medical', 'tea_snacks', 'tools', 'fuel', 'stationery', 'rent', 'other'
  amount: number;
  description: string;
  labourId?: string; // Reference to a specific labourer if category is 'labour_expense'
  payerId?: string; // Reference to Payer ID or Name who distributed/paid this
  paidBy?: string; // Name or ID of Payer
  isPartnerHelp?: boolean;
  partnerPhone?: string;
  partnerAmount?: number;
  receiptImage?: string; // Base64 data URI of receipt
  receiptImageName?: string;
}

export interface ProjectPhase extends BaseEntity {
  id: string;
  projectId: string;
  name: string; // e.g., "Excavation & Clearing", "Footing & Foundation", "Column & Beam", "Slab Casting", "Brickwork", "Plastering & Electrical", "Plumbing & Flooring", "Finishing & Painting"
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  progress: number; // 0 to 100
  assignedLeader?: string; // e.g., "Er. Rajesh (Site Engineer)"
  orderIndex: number; // Sequence order
  notes?: string;
  linkedDelayLogIds?: string[]; // IDs of DelayWeatherLog causing schedule impact
}

export interface PettyCashEntry extends BaseEntity {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  type: 'top_up' | 'expense'; // 'top_up' (cash given to supervisor) or 'expense' (spent on site)
  supervisorName: string; // e.g. "Ramesh Kumar (Site Engineer)"
  amount: number;
  category?: 'tea_snacks' | 'fuel' | 'small_hardware' | 'site_transport' | 'emergency_labour' | 'top_up' | 'other';
  description: string;
  receiptImage?: string; // Base64 photo URI
  receiptImageName?: string;
  payerId?: string; // Payer/Partner who disbursed top-up funds
  payerName?: string;
  paidBy?: string;
}

export function parseDateUTC(dateStr: string): Date {
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(Date.UTC(year, month, day));
}

export function getAutoFoodDaysAndCost(labour: Labour, projectStartDate?: string): { days: number; cost: number; joinDate: string; endDate: string } {
  const defaultJoin = projectStartDate || new Date().toISOString().split('T')[0];
  const joinDateStr = labour.joinedDate || defaultJoin;
  const endDateStr = labour.status === 'left' && labour.leftDate 
    ? labour.leftDate 
    : new Date().toISOString().split('T')[0];

  const start = parseDateUTC(joinDateStr);
  const end = parseDateUTC(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { days: 0, cost: 0, joinDate: joinDateStr, endDate: endDateStr };
  }

  const diffTime = end.getTime() - start.getTime();
  const days = diffTime < 0 ? 0 : Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return {
    days,
    cost: days * 100,
    joinDate: joinDateStr,
    endDate: endDateStr
  };
}

export function getAttendanceFoodDaysAndCost(
  labour: Labour,
  attendanceRecords: Attendance[],
  projectId: string,
  calculateFromDate?: string,
  projectStartDate?: string
): { daysPresent: number; cost: number; attendanceDaysCount: number } {
  const defaultJoin = projectStartDate || new Date().toISOString().split('T')[0];
  const joinDateStr = labour.joinedDate || defaultJoin;

  // Find the maximum date of logged attendance for this project
  const projectDates = attendanceRecords
    .filter(r => r.projectId === projectId)
    .map(r => r.date);
  let maxProjectDate = new Date().toISOString().split('T')[0];
  if (projectDates.length > 0) {
    maxProjectDate = projectDates.reduce((max, d) => d > max ? d : max, projectDates[0]);
  }

  const endDateStr = labour.status === 'left' && labour.leftDate 
    ? labour.leftDate 
    : maxProjectDate;

  let finalStartDateStr = joinDateStr;
  if (calculateFromDate && /^\d{4}-\d{2}-\d{2}$/.test(calculateFromDate)) {
    if (calculateFromDate > joinDateStr) {
      finalStartDateStr = calculateFromDate;
    }
  }

  const start = parseDateUTC(finalStartDateStr);
  const end = parseDateUTC(endDateStr);

  let days = 0;
  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
    const diffTime = end.getTime() - start.getTime();
    days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  // Count the number of days the labour was marked as present, half_day, or rest in their attendance record
  const onSiteRecordsCount = attendanceRecords.filter(
    a => a.labourId === labour.id && 
         a.projectId === projectId && 
         (a.status === 'present' || a.status === 'half_day' || a.status === 'rest') && 
         a.date >= finalStartDateStr && 
         a.date <= endDateStr
  ).length;

  const finalFoodDays = onSiteRecordsCount;

  return {
    daysPresent: finalFoodDays,
    cost: finalFoodDays * 100,
    attendanceDaysCount: finalFoodDays
  };
}

export function getLabourDaysWorked(
  labour: Labour,
  attendanceRecords: Attendance[],
  projectId: string,
  projectStartDate?: string
): number {
  const defaultJoin = projectStartDate || new Date().toISOString().split('T')[0];
  const joinDateStr = labour.joinedDate || defaultJoin;

  let finalStartDateStr = joinDateStr;
  if (projectStartDate && projectStartDate > finalStartDateStr) {
    finalStartDateStr = projectStartDate;
  }

  const projectDates = attendanceRecords
    .filter(r => r.projectId === projectId)
    .map(r => r.date);
  let maxProjectDate = new Date().toISOString().split('T')[0];
  if (projectDates.length > 0) {
    maxProjectDate = projectDates.reduce((max, d) => d > max ? d : max, projectDates[0]);
  }

  const endDateStr = labour.status === 'left' && labour.leftDate 
    ? labour.leftDate 
    : maxProjectDate;

  const start = parseDateUTC(finalStartDateStr);
  const end = parseDateUTC(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return 0;
  }

  const attMap = new Map<string, string>();
  attendanceRecords.forEach(r => {
    if (r.labourId === labour.id && r.projectId === projectId) {
      attMap.set(r.date, r.status);
    }
  });

  let totalDaysWorked = 0;
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const status = attMap.get(dateStr);
    
    if (status !== undefined) {
      if (status === 'present') {
        totalDaysWorked += 1;
      } else if (status === 'half_day') {
        totalDaysWorked += 0.5;
      }
    } else {
      // Default to 0 (pending/unmarked) for days without attendance logs
      totalDaysWorked += 0;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return totalDaysWorked;
}




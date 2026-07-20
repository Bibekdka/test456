/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Project {
  id: string;
  name: string;
  description: string;
  location?: string;
  startDate: string;
  targetDate: string; // completion timeline
  budget: number;
  status: 'active' | 'completed' | 'on_hold';
}

export interface Labour {
  id: string;
  name: string;
  perDayWage: number;
  contact: string;
  status: 'active' | 'left'; // can be set to 'left' if they leave in the middle
  leftDate?: string; // date they left work
  joinedDate?: string; // date they joined work
}

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'home';

export interface Attendance {
  id: string;
  labourId: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
}

export interface Advance {
  id: string;
  labourId: string;
  projectId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  description?: string;
  paidBy?: string; // ID or Name of Payer who made the payment
}

export interface Payer {
  id: string;
  name: string;
  role?: string; // e.g., Supervisor, Cashier, Manager
  phone?: string;
}

export interface Payment {
  id: string;
  labourId: string;
  projectId: string;
  date: string; // YYYY-MM-DD - paid date stamp
  amountPaid: number;
  advanceDeducted: number;
  baseWages: number;
  daysWorked: number;
  notes?: string;
}

export interface MaterialUsage {
  id: string;
  date: string; // YYYY-MM-DD
  quantityUsed: number;
  description?: string;
}

export interface Material {
  id: string;
  projectId: string;
  name: string;
  quantityBought: number;
  unit: string; // e.g., Bags, Tons, CFT, Liters, kg, pieces
  cost: number;
  dateBought: string; // YYYY-MM-DD
  supplier?: string;
  billImage?: string; // Base64 data URI of the uploaded image
  billImageName?: string;
  usages: MaterialUsage[];
  alertThreshold?: number; // stock warning alert threshold
}

export interface SiteDiaryEntry {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  supervisorName: string;
  workDone: string; // description of work done
  manpowerCount: number; // calculated from attendance or entered
  safetyLog?: string; // safety compliance notes
  remarks?: string; // other operational notes
}

export interface DelayWeatherLog {
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

export interface HotelAdvance {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  hotelName: string;
  notes?: string;
}

export interface FoodLog {
  id: string;
  projectId: string;
  labourId: string;
  date: string; // YYYY-MM-DD
  cost: number; // Defaults to 100
  mealsCount: number; // Defaults to 1
  notes?: string;
}

export interface GstRecord {
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
  notes?: string;
}

export interface DailyExpense {
  id: string;
  projectId: string;
  date: string; // YYYY-MM-DD
  category: 'labour_expense' | 'misc_transaction';
  subCategory: string; // e.g., 'transport', 'medical', 'tea_snacks', 'tools', 'fuel', 'stationery', 'rent', 'other'
  amount: number;
  description: string;
  labourId?: string; // Reference to a specific labourer if category is 'labour_expense'
  payerId?: string; // Reference to Payer ID or Name who distributed/paid this
  receiptImage?: string; // Base64 data URI of receipt
  receiptImageName?: string;
}

export function getAutoFoodDaysAndCost(labour: Labour, projectStartDate?: string): { days: number; cost: number; joinDate: string; endDate: string } {
  const defaultJoin = projectStartDate || new Date().toISOString().split('T')[0];
  const joinDateStr = labour.joinedDate || defaultJoin;
  const endDateStr = labour.status === 'left' && labour.leftDate 
    ? labour.leftDate 
    : new Date().toISOString().split('T')[0];

  const start = new Date(joinDateStr);
  const end = new Date(endDateStr);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

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
  const endDateStr = labour.status === 'left' && labour.leftDate 
    ? labour.leftDate 
    : new Date().toISOString().split('T')[0];

  let finalStartDateStr = joinDateStr;
  if (calculateFromDate && /^\d{4}-\d{2}-\d{2}$/.test(calculateFromDate)) {
    if (calculateFromDate > joinDateStr) {
      finalStartDateStr = calculateFromDate;
    }
  }

  const start = new Date(finalStartDateStr);
  const end = new Date(endDateStr);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let days = 0;
  if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
    const diffTime = end.getTime() - start.getTime();
    days = diffTime < 0 ? 0 : Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }

  // Count the number of days the labour was marked as 'home' in their attendance record
  const homeRecords = attendanceRecords.filter(
    a => a.labourId === labour.id && 
         a.projectId === projectId && 
         a.status === 'home' && 
         a.date >= finalStartDateStr && 
         a.date <= endDateStr
  );
  const homeDaysCount = homeRecords.length;

  // Subtract home days from total calendar days
  const finalFoodDays = Math.max(0, days - homeDaysCount);

  return {
    daysPresent: finalFoodDays,
    cost: finalFoodDays * 100,
    attendanceDaysCount: finalFoodDays
  };
}




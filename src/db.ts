/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Project, Labour, Attendance, Advance, Payment, Material, HotelAdvance, FoodLog, GstRecord, Payer, SiteDiaryEntry, DelayWeatherLog, DailyExpense } from './types';

const DB_NAME = 'ConstructionManagerDB';
const DB_VERSION = 6;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB failed to open:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;

      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('labours')) {
        db.createObjectStore('labours', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('attendance')) {
        db.createObjectStore('attendance', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('advances')) {
        db.createObjectStore('advances', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('payments')) {
        db.createObjectStore('payments', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('materials')) {
        db.createObjectStore('materials', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('hotel_advances')) {
        db.createObjectStore('hotel_advances', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('food_logs')) {
        db.createObjectStore('food_logs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('gst_records')) {
        db.createObjectStore('gst_records', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('payers')) {
        db.createObjectStore('payers', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('site_diaries')) {
        db.createObjectStore('site_diaries', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('delay_weather_logs')) {
        db.createObjectStore('delay_weather_logs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('daily_expenses')) {
        db.createObjectStore('daily_expenses', { keyPath: 'id' });
      }
    };
  });
}

function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<{ store: IDBObjectStore, transaction: IDBTransaction }> {
  return initDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    return { store, transaction };
  });
}

export function getAllItems<T>(storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    getStore(storeName, 'readonly')
      .then(({ store }) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      })
      .catch(reject);
  });
}

export function putItem<T>(storeName: string, item: T): Promise<void> {
  return new Promise((resolve, reject) => {
    getStore(storeName, 'readwrite')
      .then(({ store, transaction }) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
      .catch(reject);
  });
}

export function deleteItem(storeName: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getStore(storeName, 'readwrite')
      .then(({ store }) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
      .catch(reject);
  });
}

export function deleteItems(storeName: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return Promise.resolve();
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      
      ids.forEach((id) => {
        store.delete(id);
      });
    });
  });
}

export function putItems<T>(storeName: string, items: T[]): Promise<void> {
  if (items.length === 0) return Promise.resolve();
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      
      items.forEach((item) => {
        store.put(item);
      });
    });
  });
}

export function clearStore(storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getStore(storeName, 'readwrite')
      .then(({ store }) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
      .catch(reject);
  });
}

// Helper to seed sample data if the DB is empty
export async function seedSampleDataIfEmpty() {
  const currentProjects = await getAllItems<Project>('projects');
  if (currentProjects.some(p => p.id === 'tezu-toilet-block-repair')) {
    return; // Already seeded
  }

  // 1. Seed Project
  const tezuProject: Project = {
    id: 'tezu-toilet-block-repair',
    name: 'Toilet Block & Repair, Tezu',
    description: 'PROVN OF CERTAIN TOILET BLOCK, URINAL POINT AND UTENSIL WASHING POINT AND SPECIAL REPAIR TO BLDG NO T-23 (OJL) AT TEZU MIL STN UNDER GE (P) LOHITPUR.\n\n' +
      'Jobs Included under Schedule A:\n' +
      '- Provn of Toilet at Office Complex in HQ 181 MBC (Job MW/TEZU/10/2025-26)\n' +
      '- Provn of 01 x Toilet Cum Bathroom for Offrs at 619 SATA Bty (H/M) (Job MW/TEZU/15/2025-26)\n' +
      '- Provn of Utensils Washing Point at 205 Fd Wksp Copy EME (Job MW/TEZU/17/2025-26)\n' +
      '- Provn of Toilet for (01 x Urinal & 01 x Indian WC) at 281 Transit Camp Type B (Job MW/TEZU/18/2025-26)\n' +
      '- Provn of 01 x Toilet Cum Bathroom near Office Complex area at 619 SATA Bty (H/M) (Job MW/TEZU/14/2025-26)\n' +
      '- Provn of Gender-Neutral Toilet Facility at URC Complex in HQ 181 MBC (Job MW/TEZU/09/2025-26)\n' +
      '- Spl repair to bldg. No. T-23 (OJL) at Tezu under Adhoc Stn HQ, Tezu (Job SPL REPAIR BLDG/TEZU/07/2025-26)',
    startDate: '2026-02-06',
    targetDate: '2026-11-03', // 270 days period
    budget: 3200000, // 32.00 Lakhs
    status: 'active'
  };
  await putItem('projects', tezuProject);

  // 2. Seed Labours
  const initialLabours: Labour[] = [
    { id: 'l-amit-sharma', name: 'Amit Sharma (Mason)', perDayWage: 650, contact: '9876543210', status: 'active' },
    { id: 'l-rajesh-kumar', name: 'Rajesh Kumar (Carpenter)', perDayWage: 600, contact: '9876543211', status: 'active' },
    { id: 'l-vikram-singh', name: 'Vikram Singh (Electrician)', perDayWage: 700, contact: '9876543212', status: 'active' },
    { id: 'l-sanjay-das', name: 'Sanjay Das (Plumber)', perDayWage: 650, contact: '9876543213', status: 'active' },
    { id: 'l-babul-dey', name: 'Babul Dey (Helper)', perDayWage: 450, contact: '9876543214', status: 'active' }
  ];
  const currentLabours = await getAllItems<Labour>('labours');
  for (const lab of initialLabours) {
    if (!currentLabours.some(l => l.id === lab.id)) {
      await putItem('labours', lab);
    }
  }

  // 3. Seed Materials
  const initialMaterials: Material[] = [
    {
      id: 'mat-cement-tezu',
      projectId: 'tezu-toilet-block-repair',
      name: 'PPC Cement (UltraTech - IS 1489)',
      quantityBought: 450,
      unit: 'Bags',
      cost: 198000,
      dateBought: '2026-02-12',
      supplier: 'Lohitpur Building Materials',
      usages: [
        { id: 'u1', date: '2026-02-14', quantityUsed: 50, description: 'Foundations for toilet block at Office Complex (Job MW/TEZU/10/2025-26)' },
        { id: 'u2', date: '2026-02-18', quantityUsed: 40, description: 'Damp proof course (DPC) & brickwork joints (Job MW/TEZU/15/2025-26)' }
      ],
      alertThreshold: 100
    },
    {
      id: 'mat-steel-tezu',
      projectId: 'tezu-toilet-block-repair',
      name: 'TMT Reinforcement Steel Fe-500D (TATA)',
      quantityBought: 4,
      unit: 'Tons',
      cost: 260000,
      dateBought: '2026-02-15',
      supplier: 'Tezu Steel Syndicate',
      usages: [
        { id: 'u3', date: '2026-02-16', quantityUsed: 1.5, description: 'RCC lintels & chajjas for toilet block (Job MW/TEZU/18/2025-26)' }
      ],
      alertThreshold: 1
    },
    {
      id: 'mat-sand-tezu',
      projectId: 'tezu-toilet-block-repair',
      name: 'Coarse Sand (River Bed Local)',
      quantityBought: 100,
      unit: 'brass',
      cost: 45000,
      dateBought: '2026-02-08',
      supplier: 'Lohit River Sand Supply',
      usages: [
        { id: 'u4', date: '2026-02-10', quantityUsed: 45, description: 'Plastering and concrete mixture foundation' },
        { id: 'u5', date: '2026-02-15', quantityUsed: 47, description: 'Wall construction and toilet block layout' }
      ],
      alertThreshold: 15
    },
    {
      id: 'mat-shutters-tezu',
      projectId: 'tezu-toilet-block-repair',
      name: 'Factory Made Wooden Shutters (Standard Doors)',
      quantityBought: 15,
      unit: 'pieces',
      cost: 52500,
      dateBought: '2026-02-20',
      supplier: 'Anand Wood Crafts',
      usages: [],
      alertThreshold: 2
    },
    {
      id: 'mat-tiles-tezu',
      projectId: 'tezu-toilet-block-repair',
      name: 'Floor/Wall Tiles (Oasis Vitrified IS:15622)',
      quantityBought: 600,
      unit: 'sq ft',
      cost: 72000,
      dateBought: '2026-02-25',
      supplier: 'Somany Tiles Gallery',
      usages: [],
      alertThreshold: 50
    },
    {
      id: 'mat-pipes-tezu',
      projectId: 'tezu-toilet-block-repair',
      name: 'PVC Soil/Waste/Vent Pipes & Traps (Prince)',
      quantityBought: 40,
      unit: 'pieces',
      cost: 26000,
      dateBought: '2026-03-01',
      supplier: 'Prince Pipes Distributor',
      usages: [],
      alertThreshold: 10
    }
  ];
  for (const mat of initialMaterials) {
    await putItem('materials', mat);
  }

  // 4. Seed GST records
  const initialGstRecords: GstRecord[] = [
    {
      id: 'gst-1',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-12',
      invoiceNo: 'LBM/2026/045',
      partyName: 'Lohitpur Building Materials',
      gstin: '18AABCL1234F1Z5',
      amount: 167797,
      gstRate: 18,
      gstAmount: 30203,
      type: 'paid',
      notes: 'PPC Cement Purchase (UltraTech IS 1489)'
    },
    {
      id: 'gst-2',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-15',
      invoiceNo: 'TSS/2026/089',
      partyName: 'Tezu Steel Syndicate',
      gstin: '18AABCT5678K2Z9',
      amount: 220339,
      gstRate: 18,
      gstAmount: 39661,
      type: 'paid',
      notes: 'TMT Reinforcement Steel Fe-500D Purchase'
    },
    {
      id: 'gst-3',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-20',
      invoiceNo: 'AWC/2026/102',
      partyName: 'Anand Wood Crafts',
      gstin: '18AABCA3456D1Z2',
      amount: 44492,
      gstRate: 18,
      gstAmount: 8008,
      type: 'paid',
      notes: 'Factory Made Wooden Shutters Purchase'
    },
    {
      id: 'gst-4',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-25',
      invoiceNo: 'STG/2026/221',
      partyName: 'Somany Tiles Gallery',
      gstin: '18AABCS9876J2Z1',
      amount: 61017,
      gstRate: 18,
      gstAmount: 10983,
      type: 'paid',
      notes: 'Oasis Vitrified Tiles Purchase'
    }
  ];
  for (const gst of initialGstRecords) {
    await putItem('gst_records', gst);
  }

  // 5. Seed Attendance records
  const dates = ['2026-02-10', '2026-02-11', '2026-02-12', '2026-02-13', '2026-02-14'];
  const labourIds = ['l-amit-sharma', 'l-rajesh-kumar', 'l-babul-dey'];
  for (let dateIdx = 0; dateIdx < dates.length; dateIdx++) {
    const date = dates[dateIdx];
    for (let labIdx = 0; labIdx < labourIds.length; labIdx++) {
      const labourId = labourIds[labIdx];
      const status = (dateIdx === 2 && labIdx === 1) ? 'half_day' : 'present';
      await putItem('attendance', {
        id: `att-tezu-${labourId}-${date}`,
        labourId,
        projectId: 'tezu-toilet-block-repair',
        date,
        status
      });
    }
  }

  // 6. Seed Advance records
  const initialAdvances: Advance[] = [
    {
      id: 'adv-tezu-babul-1',
      labourId: 'l-babul-dey',
      projectId: 'tezu-toilet-block-repair',
      amount: 1000,
      date: '2026-02-12',
      description: 'Advance for personal/family expenses'
    }
  ];
  for (const adv of initialAdvances) {
    await putItem('advances', adv);
  }

  // 7. Seed Hotel Advances
  const initialHotelAdvances: HotelAdvance[] = [
    {
      id: 'ha-tezu-1',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-08',
      amount: 5000,
      hotelName: 'Tezu Military Station Mess Canteen',
      notes: 'Initial advance for worker lunch plates'
    }
  ];
  for (const ha of initialHotelAdvances) {
    await putItem('hotel_advances', ha);
  }

  // 8. Seed Food Logs
  for (const date of dates) {
    for (const labourId of labourIds) {
      await putItem('food_logs', {
        id: `fl-tezu-${labourId}-${date}`,
        projectId: 'tezu-toilet-block-repair',
        labourId,
        date,
        cost: 100,
        mealsCount: 1,
        notes: 'Lunch plate'
      });
    }
  }

  // 9. Seed Payers (Authorized Persons who pay/approve advances)
  const initialPayers: Payer[] = [
    { id: 'p-sudip', name: 'Sudip Kumar Banerjee', role: 'Accepting Officer', phone: '03804-7796297' },
    { id: 'p-vijay', name: 'Vijay Kumar Meena', role: 'Executive Engineer', phone: '03804-7796297' },
    { id: 'p-supervisor', name: 'Site Supervisor', role: 'Supervisor' },
    { id: 'p-cashier', name: 'Head Cashier', role: 'Accounts Manager' }
  ];
  for (const payer of initialPayers) {
    await putItem('payers', payer);
  }

  // 10. Seed Site Diaries
  const initialSiteDiaries: SiteDiaryEntry[] = [
    {
      id: 'sd-1',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-12',
      supervisorName: 'Site Supervisor',
      workDone: 'Excavation work completed for HQ 181 MBC office toilet block. Cement PPC bags received from Lohitpur Building Materials. Brickwork started.',
      manpowerCount: 3,
      safetyLog: 'Helmets and safety gloves worn by all workers during concrete mixing. Site barricaded.',
      remarks: 'Cement inventory is healthy. Water supply is regular.'
    },
    {
      id: 'sd-2',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-14',
      supervisorName: 'Site Supervisor',
      workDone: 'Damp proof course (DPC) completed for 619 SATA Bty Offrs toilet. Plastering in progress. Carpenter work on door frame completed.',
      manpowerCount: 3,
      safetyLog: 'Scaffolding checked and secured. Safety instructions briefed in the morning.',
      remarks: 'Slight delay in starting work in the morning due to high humidity, but target accomplished.'
    }
  ];
  for (const sd of initialSiteDiaries) {
    await putItem('site_diaries', sd);
  }

  // 11. Seed Delay & Weather Logs
  const initialDelayWeatherLogs: DelayWeatherLog[] = [
    {
      id: 'dw-1',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-10',
      weather: 'sunny',
      temperature: '26',
      isDelay: false
    },
    {
      id: 'dw-2',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-11',
      weather: 'cloudy',
      temperature: '24',
      isDelay: false
    },
    {
      id: 'dw-3',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-12',
      weather: 'rainy',
      temperature: '21',
      isDelay: true,
      delayHours: 3,
      delayReason: 'rain',
      delayNotes: 'Heavy afternoon rain forced workers to take shelter for 3 hours. Slowed down concrete pouring.'
    }
  ];
  for (const dw of initialDelayWeatherLogs) {
    await putItem('delay_weather_logs', dw);
  }

  // 12. Seed Daily Expenses & Misc Transactions
  const initialDailyExpenses: DailyExpense[] = [
    {
      id: 'exp-1',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-10',
      category: 'labour_expense',
      subCategory: 'tea_snacks',
      amount: 350,
      description: 'Morning tea and biscuits for workers on foundation shift',
      payerId: 'p-supervisor'
    },
    {
      id: 'exp-2',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-12',
      category: 'labour_expense',
      subCategory: 'medical',
      amount: 450,
      description: 'First-aid band-aids and antiseptic purchase for site medical kit',
      labourId: 'l-babul-dey',
      payerId: 'p-supervisor'
    },
    {
      id: 'exp-3',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-14',
      category: 'misc_transaction',
      subCategory: 'transport',
      amount: 1200,
      description: 'Auto-rickshaw fare to transport heavy plumbing tools from local store',
      payerId: 'p-cashier'
    },
    {
      id: 'exp-4',
      projectId: 'tezu-toilet-block-repair',
      date: '2026-02-15',
      category: 'misc_transaction',
      subCategory: 'stationery',
      amount: 250,
      description: 'Site logbooks, attendance registers, and marker pens purchase',
      payerId: 'p-cashier'
    }
  ];
  for (const exp of initialDailyExpenses) {
    await putItem('daily_expenses', exp);
  }
}

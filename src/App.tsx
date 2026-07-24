/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, Labour, Attendance, Advance, Payment, Material, HotelAdvance, FoodLog, GstRecord, Payer, SiteDiaryEntry, DelayWeatherLog, DailyExpense } from './types';
import {
  initDB,
  getAllItems,
  putItem,
  deleteItem,
  seedSampleDataIfEmpty,
  clearStore,
  deleteItems,
  putItems
} from './db';

import { generateId } from './utils/id';
import { performIncrementalSync, performFullSync } from './utils/syncManager';
import { ToastProvider } from './components/ToastContainer';

function mergeStoreItems<T extends { id: string; updatedAt?: number }>(
  localItems: T[],
  serverItems: T[]
): { merged: T[]; hasLocalChanges: boolean } {
  const map = new Map<string, T>();
  let hasLocalChanges = false;

  // First populate map with server items
  serverItems.forEach(item => map.set(item.id, item));

  // Merge local items
  localItems.forEach(localItem => {
    const serverItem = map.get(localItem.id);
    if (!serverItem) {
      // Local item doesn't exist on server -> keep local version
      map.set(localItem.id, localItem);
      hasLocalChanges = true;
    } else {
      const localTs = localItem.updatedAt || 0;
      const serverTs = serverItem.updatedAt || 0;
      if (localTs > serverTs) {
        // Local version is newer -> keep local version
        map.set(localItem.id, localItem);
        hasLocalChanges = true;
      }
    }
  });

  return { merged: Array.from(map.values()), hasLocalChanges };
}

import ProjectManager from './components/ProjectManager';
import LabourManager from './components/LabourManager';
import AttendanceTracker from './components/AttendanceTracker';
import LabourPaymentCalculator from './components/LabourPaymentCalculator';
import MaterialTracker from './components/MaterialTracker';
import ReportGenerator from './components/ReportGenerator';
import FoodTracker from './components/FoodTracker';
import CostAnalysis from './components/CostAnalysis';
import GstTracker from './components/GstTracker';
import Dashboard from './components/Dashboard';
import SiteDiary from './components/SiteDiary';
import DelayWeatherTracker from './components/DelayWeatherTracker';
import DailyExpensesTracker from './components/DailyExpensesTracker';
import BackupPromptBanner from './components/BackupPromptBanner';

import {
  Briefcase,
  Users,
  CalendarDays,
  CircleDollarSign,
  Truck,
  FileBarChart2,
  Construction,
  MapPin,
  ChevronRight,
  TrendingUp,
  History,
  Utensils,
  Wifi,
  WifiOff,
  RefreshCw,
  Info,
  Percent,
  BarChart3,
  BookOpen,
  CloudSun,
  Receipt,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft
} from 'lucide-react';

type TabType = 'dashboard' | 'projects' | 'attendance' | 'payments' | 'materials' | 'reports' | 'labours' | 'food' | 'analysis' | 'gst' | 'diary' | 'delays' | 'expenses';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(true);

  // Core Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [labours, setLabours] = useState<Labour[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [advanceRecords, setAdvanceRecords] = useState<Advance[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<Payment[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [hotelAdvances, setHotelAdvances] = useState<HotelAdvance[]>([]);
  const [foodLogs, setFoodLogs] = useState<FoodLog[]>([]);
  const [gstRecords, setGstRecords] = useState<GstRecord[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [siteDiaries, setSiteDiaries] = useState<SiteDiaryEntry[]>([]);
  const [delayWeatherLogs, setDelayWeatherLogs] = useState<DelayWeatherLog[]>([]);
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpense[]>([]);
  const [isWeatherFetching, setIsWeatherFetching] = useState<boolean>(false);

  // Selected Active Project
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Dark mode & Collapsible Sidebar state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [isNavCollapsed, setIsNavCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('nav_collapsed') === 'true';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('nav_collapsed', isNavCollapsed ? 'true' : 'false');
  }, [isNavCollapsed]);

  // Food Expense Calculation custom start date
  const [foodCalculationStartDate, setFoodCalculationStartDate] = useState<string>('');

  // Backup tracking state
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(() => {
    return localStorage.getItem('last_backup_date');
  });

  const handleExportBackup = () => {
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
      dailyExpenses,
      foodCalculationStartDate
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nowIso = new Date().toISOString();
    const dateStr = nowIso.split('T')[0];
    link.download = `Construction_Manager_Full_Backup_${dateStr}.json`;
    link.click();
    URL.revokeObjectURL(url);

    localStorage.setItem('last_backup_date', nowIso);
    setLastBackupDate(nowIso);
  };

  // Syncing and network state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string>('Just now');
  const [syncHistory, setSyncHistory] = useState<string[]>([
    'Local database initialized in offline-first mode.'
  ]);

  const triggerSync = async (reason: string = 'Manual sync', isFullSync: boolean = false) => {
    if (!navigator.onLine) {
      return;
    }
    setSyncing(true);
    try {
      const res = isFullSync ? await performFullSync() : await performIncrementalSync();
      const timestamp = new Date().toLocaleTimeString();
      setLastSynced(timestamp);
      setSyncHistory(prev => [
        `[${timestamp}] ${reason} - ${res.message}`,
        ...prev.slice(0, 4)
      ]);
    } catch (err: any) {
      console.error('Incremental sync failed, falling back:', err);
      try {
        const res = await performFullSync();
        const timestamp = new Date().toLocaleTimeString();
        setLastSynced(timestamp);
        setSyncHistory(prev => [
          `[${timestamp}] ${reason} - Full sync fallback succeeded.`,
          ...prev.slice(0, 4)
        ]);
      } catch (fallbackErr) {
        const timestamp = new Date().toLocaleTimeString();
        setSyncHistory(prev => [
          `[${timestamp}] Sync Failed: ${err?.message || 'Server error'}`,
          ...prev.slice(0, 4)
        ]);
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync('Auto-sync triggered: connection restored');
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initialize DB and load all tables
  const loadDatabase = async () => {
    try {
      setLoading(true);
      await initDB();
      await seedSampleDataIfEmpty();

      // Retrieve all lists from local DB initially
      let pList = await getAllItems<Project>('projects');
      let lList = await getAllItems<Labour>('labours');
      let attList = await getAllItems<Attendance>('attendance');
      let advList = await getAllItems<Advance>('advances');
      let payList = await getAllItems<Payment>('payments');
      let matList = await getAllItems<Material>('materials');
      let haList = await getAllItems<HotelAdvance>('hotel_advances');
      let flList = await getAllItems<FoodLog>('food_logs');
      let gstList = await getAllItems<GstRecord>('gst_records');
      let payersList = await getAllItems<Payer>('payers');
      let sdList = await getAllItems<SiteDiaryEntry>('site_diaries');
      let dwList = await getAllItems<DelayWeatherLog>('delay_weather_logs');
      let expList: DailyExpense[] = [];
      try {
        expList = await getAllItems<DailyExpense>('daily_expenses');
      } catch (err) {
        console.warn('daily_expenses store might not exist yet', err);
      }

      // Try fetching from the server
      try {
        const response = await fetch('/api/db');
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && contentType.includes('application/json')) {
          const serverDb = await response.json();
          const serverHasData = serverDb.projects && serverDb.projects.length > 0;

          if (serverHasData) {
            // Smart 2-way merge of local IndexedDB and server data
            const pRes = mergeStoreItems(pList, serverDb.projects || []);
            const lRes = mergeStoreItems(lList, serverDb.labours || []);
            const attRes = mergeStoreItems(attList, serverDb.attendance || []);
            const advRes = mergeStoreItems(advList, serverDb.advances || []);
            const payRes = mergeStoreItems(payList, serverDb.payments || []);
            const matRes = mergeStoreItems(matList, serverDb.materials || []);
            const haRes = mergeStoreItems(haList, serverDb.hotel_advances || []);
            const flRes = mergeStoreItems(flList, serverDb.food_logs || []);
            const gstRes = mergeStoreItems(gstList, serverDb.gst_records || []);
            const payersRes = mergeStoreItems(payersList, serverDb.payers || []);
            const sdRes = mergeStoreItems(sdList, serverDb.site_diaries || []);
            const dwRes = mergeStoreItems(dwList, serverDb.delay_weather_logs || []);
            const expRes = mergeStoreItems(expList, serverDb.daily_expenses || []);

            // Clean up any attendance records before worker joined date
            const labourMap = new Map((lRes.merged as Labour[]).map(l => [l.id, l]));
            const cleanedAttendance = (attRes.merged as Attendance[]).filter(att => {
              const l = labourMap.get(att.labourId);
              if (l && l.joinedDate && att.date < l.joinedDate) {
                return false;
              }
              return true;
            });

            pList = pRes.merged;
            lList = lRes.merged;
            attList = cleanedAttendance;
            advList = advRes.merged;
            payList = payRes.merged;
            matList = matRes.merged;
            haList = haRes.merged;
            flList = flRes.merged;
            gstList = gstRes.merged;
            payersList = payersRes.merged;
            sdList = sdRes.merged;
            dwList = dwRes.merged;
            expList = expRes.merged;

            // Persist merged stores into local IndexedDB while preserving timestamps
            await putItems('projects', pList, true);
            await putItems('labours', lList, true);
            await putItems('attendance', attList, true);
            await putItems('advances', advList, true);
            await putItems('payments', payList, true);
            await putItems('materials', matList, true);
            await putItems('hotel_advances', haList, true);
            await putItems('food_logs', flList, true);
            await putItems('gst_records', gstList, true);
            await putItems('payers', payersList, true);
            await putItems('site_diaries', sdList, true);
            await putItems('delay_weather_logs', dwList, true);
            await putItems('daily_expenses', expList, true);

            const hasLocalNewerData = pRes.hasLocalChanges || lRes.hasLocalChanges || attRes.hasLocalChanges ||
              advRes.hasLocalChanges || payRes.hasLocalChanges || matRes.hasLocalChanges || haRes.hasLocalChanges ||
              flRes.hasLocalChanges || gstRes.hasLocalChanges || payersRes.hasLocalChanges || sdRes.hasLocalChanges ||
              dwRes.hasLocalChanges || expRes.hasLocalChanges;

            if (hasLocalNewerData) {
              const payload = {
                projects: pList,
                labours: lList,
                attendance: attList,
                advances: advList,
                payments: payList,
                materials: matList,
                hotel_advances: haList,
                food_logs: flList,
                gst_records: gstList,
                payers: payersList,
                site_diaries: sdList,
                delay_weather_logs: dwList,
                daily_expenses: expList,
              };
              await fetch('/api/db/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
            }
          } else if (pList.length > 0) {
            // Server is empty, but local has data, so push local database to server
            const payload = {
              projects: pList,
              labours: lList,
              attendance: attList,
              advances: advList,
              payments: payList,
              materials: matList,
              hotel_advances: haList,
              food_logs: flList,
              gst_records: gstList,
              payers: payersList,
              site_diaries: sdList,
              delay_weather_logs: dwList,
              daily_expenses: expList,
            };
            await fetch('/api/db/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          }
        }
      } catch (err) {
        console.error('Failed to sync database on load, using local IndexedDB offline:', err);
      }

      // Automatically keep the Tezu project data and remove known legacy projects (Skyline Heights & Commercial Plaza)
      // while allowing any new user-created projects to be retained safely.
      const projectsToDelete = pList.filter(p => {
        const nameLower = p.name.toLowerCase().trim();
        return nameLower.includes('skyline heights') || 
               nameLower.includes('skyline hights') || 
               nameLower.includes('commercial plaza');
      });

      if (projectsToDelete.length > 0) {
        for (const p of projectsToDelete) {
          await deleteItem('projects', p.id);
          
          const deletedAtt = attList.filter(a => a.projectId === p.id);
          await deleteItems('attendance', deletedAtt.map(x => x.id));
          
          const deletedAdv = advList.filter(a => a.projectId === p.id);
          await deleteItems('advances', deletedAdv.map(x => x.id));
          
          const deletedPay = payList.filter(py => py.projectId === p.id);
          await deleteItems('payments', deletedPay.map(x => x.id));
          
          const deletedMat = matList.filter(m => m.projectId === p.id);
          await deleteItems('materials', deletedMat.map(x => x.id));
          
          const deletedHotelAdv = haList.filter(ha => ha.projectId === p.id);
          await deleteItems('hotel_advances', deletedHotelAdv.map(x => x.id));
          
          const deletedFoodLogs = flList.filter(fl => fl.projectId === p.id);
          await deleteItems('food_logs', deletedFoodLogs.map(x => x.id));
          
          const deletedGst = gstList.filter(g => g.projectId === p.id);
          await deleteItems('gst_records', deletedGst.map(x => x.id));

          const deletedDiaries = sdList.filter(d => d.projectId === p.id);
          await deleteItems('site_diaries', deletedDiaries.map(x => x.id));

          const deletedDelays = dwList.filter(d => d.projectId === p.id);
          await deleteItems('delay_weather_logs', deletedDelays.map(x => x.id));

          const deletedExpenses = expList.filter(e => e.projectId === p.id);
          await deleteItems('daily_expenses', deletedExpenses.map(x => x.id));
        }

        const remainingProjects = pList.filter(p => !projectsToDelete.some(pd => pd.id === p.id));
        const remainingAtt = attList.filter(a => !projectsToDelete.some(pd => pd.id === a.projectId));
        const remainingAdv = advList.filter(a => !projectsToDelete.some(pd => pd.id === a.projectId));
        const remainingPay = payList.filter(py => !projectsToDelete.some(pd => pd.id === py.projectId));
        const remainingMat = matList.filter(m => !projectsToDelete.some(pd => pd.id === m.projectId));
        const remainingHotel = haList.filter(ha => !projectsToDelete.some(pd => pd.id === ha.projectId));
        const remainingFood = flList.filter(fl => !projectsToDelete.some(pd => pd.id === fl.projectId));
        const remainingGst = gstList.filter(g => !projectsToDelete.some(pd => pd.id === g.projectId));
        const remainingDiaries = sdList.filter(d => !projectsToDelete.some(pd => pd.id === d.projectId));
        const remainingDelays = dwList.filter(d => !projectsToDelete.some(pd => pd.id === d.projectId));
        const remainingExpenses = expList.filter(e => !projectsToDelete.some(pd => pd.id === e.projectId));

        setProjects(remainingProjects);
        setLabours(lList);
        setAttendanceRecords(remainingAtt);
        setAdvanceRecords(remainingAdv);
        setPaymentRecords(remainingPay);
        setMaterials(remainingMat);
        setHotelAdvances(remainingHotel);
        setFoodLogs(remainingFood);
        setGstRecords(remainingGst);
        setPayers(payersList);
        setSiteDiaries(remainingDiaries);
        setDelayWeatherLogs(remainingDelays);
        setDailyExpenses(remainingExpenses);

        if (remainingProjects.length > 0) {
          setActiveProjectId(remainingProjects[0].id);
        } else {
          setActiveProjectId(null);
        }
      } else {
        setProjects(pList);
        setLabours(lList);
        setAttendanceRecords(attList);
        setAdvanceRecords(advList);
        setPaymentRecords(payList);
        setMaterials(matList);
        setHotelAdvances(haList);
        setFoodLogs(flList);
        setGstRecords(gstList);
        setPayers(payersList);
        setSiteDiaries(sdList);
        setDelayWeatherLogs(dwList);
        setDailyExpenses(expList);

        if (pList.length > 0) {
          setActiveProjectId(pList[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading Construction database:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatabase();
  }, []);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  // ----------------------------------------------------
  // Project operations
  // ----------------------------------------------------
  const fetchWeatherForProject = async (p: Project) => {
    if (!p.location) return;
    setIsWeatherFetching(true);
    try {
      // Step 1: Geocode the location
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(p.location)}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) throw new Error('Geocoding API failed');
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) {
        alert(`We couldn't locate "${p.location}". Please check the spelling or enter a nearby city.`);
        setIsWeatherFetching(false);
        return;
      }
      const { latitude, longitude, name: geoName } = geoData.results[0];
      
      // Step 2: Fetch historical weather
      const start = p.startDate; // YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      
      const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${start}&end_date=${today}&daily=weather_code,temperature_2m_max&timezone=auto`;
      const archiveRes = await fetch(archiveUrl);
      if (!archiveRes.ok) throw new Error('Historical Weather Archive API failed');
      const archiveData = await archiveRes.json();
      
      if (!archiveData.daily || !archiveData.daily.time) {
        alert('No weather data was returned from the online climate database.');
        setIsWeatherFetching(false);
        return;
      }
      
      const times: string[] = archiveData.daily.time;
      const codes: number[] = archiveData.daily.weather_code || [];
      const temps: number[] = archiveData.daily.temperature_2m_max || [];
      
      // Get current delay logs for this project to merge
      const currentLogsList = await getAllItems<DelayWeatherLog>('delay_weather_logs');
      const existingLogsMap = new Map<string, DelayWeatherLog>();
      currentLogsList.forEach(log => {
        if (log.projectId === p.id) {
          existingLogsMap.set(log.date, log);
        }
      });
      
      const logsToSave: DelayWeatherLog[] = [];
      
      for (let i = 0; i < times.length; i++) {
        const dateStr = times[i];
        const code = codes[i];
        const temp = temps[i];
        
        // Map weather code
        let weatherType: 'sunny' | 'rainy' | 'cloudy' | 'extreme_heat' | 'stormy' | 'cold' = 'sunny';
        if (temp > 40) {
          weatherType = 'extreme_heat';
        } else if (code === 0 || code === 1) {
          weatherType = 'sunny';
        } else if (code === 2 || code === 3 || code === 45 || code === 48) {
          weatherType = 'cloudy';
        } else if (code === 51 || code === 53 || code === 55 || code === 61 || code === 63 || code === 65 || code === 80 || code === 81 || code === 82) {
          weatherType = 'rainy';
        } else if (code === 95 || code === 96 || code === 99) {
          weatherType = 'stormy';
        } else {
          weatherType = 'cold'; // freezing rain/snow codes
        }
        
        const formattedTemp = temp !== null && temp !== undefined ? String(Math.round(temp)) : undefined;
        
        const existing = existingLogsMap.get(dateStr);
        if (existing) {
          // Update existing weather info while keeping delay info untouched
          const updated: DelayWeatherLog = {
            ...existing,
            weather: weatherType,
            temperature: formattedTemp || existing.temperature,
          };
          logsToSave.push(updated);
        } else {
          // Create a new log
          const newLog: DelayWeatherLog = {
            id: generateId('dw'),
            projectId: p.id,
            date: dateStr,
            weather: weatherType,
            temperature: formattedTemp,
            isDelay: false,
          };
          logsToSave.push(newLog);
        }
      }
      
      // Save each log to IndexedDB and update state
      for (const log of logsToSave) {
        await putItem('delay_weather_logs', log);
      }
      
      // Refresh list in state
      const refreshedLogsList = await getAllItems<DelayWeatherLog>('delay_weather_logs');
      setDelayWeatherLogs(refreshedLogsList);
      
      if (navigator.onLine) {
        triggerSync('Auto-sync: Fetched project weather logs');
      }
      
      alert(`Auto-fetched ${logsToSave.length} online weather records for "${geoName}" from ${start} (start date) to today!`);
    } catch (error) {
      console.error('Error fetching weather data:', error);
      alert('Could not complete the automatic online weather sync. Please check your internet connection.');
    } finally {
      setIsWeatherFetching(false);
    }
  };

  const handleAddProject = async (p: Project) => {
    await putItem('projects', p);
    setProjects(prev => [...prev, p]);
    if (!activeProjectId) setActiveProjectId(p.id);
    if (p.location) {
      fetchWeatherForProject(p);
    }
    if (navigator.onLine) {
      triggerSync('Auto-sync: Created new project');
    }
  };

  const handleUpdateProject = async (p: Project) => {
    await putItem('projects', p);
    setProjects(prev => prev.map(item => item.id === p.id ? p : item));
    if (p.location) {
      fetchWeatherForProject(p);
    }
    if (navigator.onLine) {
      triggerSync('Auto-sync: Updated project settings');
    }
  };

  const handleDeleteProject = async (id: string) => {
    await deleteItem('projects', id);
    setProjects(prev => prev.filter(p => p.id !== id));

    // Cascade delete associated items using fast transaction-level bulk operations
    const cascadeAttendance = attendanceRecords.filter(a => a.projectId !== id);
    const deletedAtt = attendanceRecords.filter(a => a.projectId === id);
    await deleteItems('attendance', deletedAtt.map(x => x.id));
    setAttendanceRecords(cascadeAttendance);

    const cascadeAdvances = advanceRecords.filter(a => a.projectId !== id);
    const deletedAdv = advanceRecords.filter(a => a.projectId === id);
    await deleteItems('advances', deletedAdv.map(x => x.id));
    setAdvanceRecords(cascadeAdvances);

    const cascadePayments = paymentRecords.filter(p => p.projectId !== id);
    const deletedPay = paymentRecords.filter(p => p.projectId === id);
    await deleteItems('payments', deletedPay.map(x => x.id));
    setPaymentRecords(cascadePayments);

    const cascadeMaterials = materials.filter(m => m.projectId !== id);
    const deletedMat = materials.filter(m => m.projectId === id);
    await deleteItems('materials', deletedMat.map(x => x.id));
    setMaterials(cascadeMaterials);

    const cascadeHotelAdv = hotelAdvances.filter(ha => ha.projectId !== id);
    const deletedHotelAdv = hotelAdvances.filter(ha => ha.projectId === id);
    await deleteItems('hotel_advances', deletedHotelAdv.map(x => x.id));
    setHotelAdvances(cascadeHotelAdv);

    const cascadeFoodLogs = foodLogs.filter(fl => fl.projectId !== id);
    const deletedFoodLogs = foodLogs.filter(fl => fl.projectId === id);
    await deleteItems('food_logs', deletedFoodLogs.map(x => x.id));
    setFoodLogs(cascadeFoodLogs);

    const cascadeGst = gstRecords.filter(g => g.projectId !== id);
    const deletedGst = gstRecords.filter(g => g.projectId === id);
    await deleteItems('gst_records', deletedGst.map(x => x.id));
    setGstRecords(cascadeGst);

    const cascadeDiaries = siteDiaries.filter(d => d.projectId !== id);
    const deletedDiaries = siteDiaries.filter(d => d.projectId === id);
    await deleteItems('site_diaries', deletedDiaries.map(x => x.id));
    setSiteDiaries(cascadeDiaries);

    const cascadeDelays = delayWeatherLogs.filter(dw => dw.projectId !== id);
    const deletedDelays = delayWeatherLogs.filter(dw => dw.projectId === id);
    await deleteItems('delay_weather_logs', deletedDelays.map(x => x.id));
    setDelayWeatherLogs(cascadeDelays);

    if (activeProjectId === id) {
      const remaining = projects.filter(p => p.id !== id);
      setActiveProjectId(remaining.length > 0 ? remaining[0].id : null);
    }
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted project', true);
    }
  };

  // ----------------------------------------------------
  // Labour operations
  // ----------------------------------------------------
  const handleAddLabour = async (l: Labour) => {
    await putItem('labours', l);
    setLabours(prev => [...prev, l]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Registered new worker');
    }
  };

  const handleUpdateLabour = async (l: Labour) => {
    await putItem('labours', l);
    setLabours(prev => prev.map(item => item.id === l.id ? l : item));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Updated worker profile');
    }
  };

  const handleDeleteLabour = async (id: string) => {
    await deleteItem('labours', id);
    setLabours(prev => prev.filter(item => item.id !== id));

    // Cascade delete associated items using fast transaction-level bulk operations
    const cascadeAttendance = attendanceRecords.filter(a => a.labourId !== id);
    const deletedAtt = attendanceRecords.filter(a => a.labourId === id);
    await deleteItems('attendance', deletedAtt.map(x => x.id));
    setAttendanceRecords(cascadeAttendance);

    const cascadeAdvances = advanceRecords.filter(a => a.labourId !== id);
    const deletedAdv = advanceRecords.filter(a => a.labourId === id);
    await deleteItems('advances', deletedAdv.map(x => x.id));
    setAdvanceRecords(cascadeAdvances);

    const cascadePayments = paymentRecords.filter(p => p.labourId !== id);
    const deletedPay = paymentRecords.filter(p => p.labourId === id);
    await deleteItems('payments', deletedPay.map(x => x.id));
    setPaymentRecords(cascadePayments);

    const cascadeFoodLogs = foodLogs.filter(f => f.labourId !== id);
    const deletedFoodLogs = foodLogs.filter(f => f.labourId === id);
    await deleteItems('food_logs', deletedFoodLogs.map(x => x.id));
    setFoodLogs(cascadeFoodLogs);

    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted worker profile', true);
    }
  };

  // ----------------------------------------------------
  // Attendance & Advances operations
  // ----------------------------------------------------
  const handleSaveAttendance = async (records: Attendance[]) => {
    for (const r of records) {
      await putItem('attendance', r);
    }
    // Update local state by merging or replacing
    setAttendanceRecords(prev => {
      const filtered = prev.filter(item =>
        !records.some(r => r.labourId === item.labourId && r.projectId === item.projectId && r.date === item.date)
      );
      return [...filtered, ...records];
    });
    if (navigator.onLine) {
      triggerSync('Auto-sync: Updated worker attendance');
    }
  };

  const handleAddAdvance = async (adv: Advance) => {
    await putItem('advances', adv);
    setAdvanceRecords(prev => {
      const exists = prev.some(item => item.id === adv.id);
      if (exists) {
        return prev.map(item => item.id === adv.id ? adv : item);
      }
      return [...prev, adv];
    });
    if (navigator.onLine) {
      triggerSync('Auto-sync: Added advance payment');
    }
  };

  // ----------------------------------------------------
  // Payer operations
  // ----------------------------------------------------
  const handleAddPayer = async (p: Payer) => {
    await putItem('payers', p);
    setPayers(prev => [...prev, p]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Registered financial payer');
    }
  };

  const handleUpdatePayer = async (p: Payer) => {
    await putItem('payers', p);
    setPayers(prev => prev.map(item => item.id === p.id ? p : item));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Updated financial payer');
    }
  };

  const handleDeletePayer = async (id: string) => {
    await deleteItem('payers', id);
    setPayers(prev => prev.filter(p => p.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted financial payer', true);
    }
  };

  const handleDeleteAdvance = async (id: string) => {
    await deleteItem('advances', id);
    setAdvanceRecords(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted advance payment', true);
    }
  };

  // ----------------------------------------------------
  // Payment operations
  // ----------------------------------------------------
  const handleRecordPayment = async (pay: Payment) => {
    await putItem('payments', pay);
    setPaymentRecords(prev => [...prev, pay]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Recorded worker payment');
    }
  };

  const handleDeletePayment = async (id: string) => {
    await deleteItem('payments', id);
    setPaymentRecords(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted worker payment', true);
    }
  };

  // ----------------------------------------------------
  // Material operations
  // ----------------------------------------------------
  const handleAddMaterial = async (m: Material) => {
    await putItem('materials', m);
    setMaterials(prev => [...prev, m]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Logged material invoice');
    }
  };

  const handleUpdateMaterial = async (m: Material) => {
    await putItem('materials', m);
    setMaterials(prev => prev.map(item => item.id === m.id ? m : item));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Updated material invoice');
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    await deleteItem('materials', id);
    setMaterials(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted material invoice', true);
    }
  };

  // ----------------------------------------------------
  // Hotel Food & Advances operations
  // ----------------------------------------------------
  const handleAddHotelAdvance = async (ha: HotelAdvance) => {
    await putItem('hotel_advances', ha);
    setHotelAdvances(prev => [...prev, ha]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Added hotel advance');
    }
  };

  const handleDeleteHotelAdvance = async (id: string) => {
    await deleteItem('hotel_advances', id);
    setHotelAdvances(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted hotel advance', true);
    }
  };

  const handleAddFoodLog = async (fl: FoodLog) => {
    await putItem('food_logs', fl);
    setFoodLogs(prev => [...prev, fl]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Added meal deduction');
    }
  };

  const handleUpdateFoodLog = async (fl: FoodLog) => {
    await putItem('food_logs', fl);
    setFoodLogs(prev => prev.map(item => item.id === fl.id ? fl : item));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Updated meal deduction');
    }
  };

  const handleDeleteFoodLog = async (id: string) => {
    await deleteItem('food_logs', id);
    setFoodLogs(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted meal deduction', true);
    }
  };

  const handleAddGstRecord = async (rec: GstRecord) => {
    await putItem('gst_records', rec);
    setGstRecords(prev => [...prev, rec]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Added GST record');
    }
  };

  const handleUpdateGstRecord = async (rec: GstRecord) => {
    await putItem('gst_records', rec);
    setGstRecords(prev => prev.map(item => item.id === rec.id ? rec : item));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Updated GST record');
    }
  };

  const handleDeleteGstRecord = async (id: string) => {
    await deleteItem('gst_records', id);
    setGstRecords(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted GST record', true);
    }
  };

  // ----------------------------------------------------
  // Daily Expense & Misc Transaction operations
  // ----------------------------------------------------
  const handleAddDailyExpense = async (exp: DailyExpense) => {
    await putItem('daily_expenses', exp);
    setDailyExpenses(prev => [...prev, exp]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Added daily expense outlay');
    }
  };

  const handleUpdateDailyExpense = async (exp: DailyExpense) => {
    await putItem('daily_expenses', exp);
    setDailyExpenses(prev => prev.map(item => item.id === exp.id ? exp : item));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Updated daily expense outlay');
    }
  };

  const handleDeleteDailyExpense = async (id: string) => {
    await deleteItem('daily_expenses', id);
    setDailyExpenses(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted daily expense outlay', true);
    }
  };

  // ----------------------------------------------------
  // Site Diary operations
  // ----------------------------------------------------
  const handleAddSiteDiary = async (sd: SiteDiaryEntry) => {
    await putItem('site_diaries', sd);
    setSiteDiaries(prev => [...prev, sd]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Added site diary entry');
    }
  };

  const handleUpdateSiteDiary = async (sd: SiteDiaryEntry) => {
    await putItem('site_diaries', sd);
    setSiteDiaries(prev => prev.map(item => item.id === sd.id ? sd : item));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Updated site diary entry');
    }
  };

  const handleDeleteSiteDiary = async (id: string) => {
    await deleteItem('site_diaries', id);
    setSiteDiaries(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted site diary entry', true);
    }
  };

  // ----------------------------------------------------
  // Delay & Weather operations
  // ----------------------------------------------------
  const handleAddDelayWeatherLog = async (dw: DelayWeatherLog) => {
    await putItem('delay_weather_logs', dw);
    setDelayWeatherLogs(prev => [...prev, dw]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Added weather/delay log');
    }
  };

  const handleUpdateDelayWeatherLog = async (dw: DelayWeatherLog) => {
    await putItem('delay_weather_logs', dw);
    setDelayWeatherLogs(prev => prev.map(item => item.id === dw.id ? dw : item));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Updated weather/delay log');
    }
  };

  const handleDeleteDelayWeatherLog = async (id: string) => {
    await deleteItem('delay_weather_logs', id);
    setDelayWeatherLogs(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted weather/delay log', true);
    }
  };

  // ----------------------------------------------------
  // Database backup import
  // ----------------------------------------------------
  const handleImportBackup = async (backupData: any) => {
    setLoading(true);
    try {
      // Clear all stores first
      await clearStore('projects');
      await clearStore('labours');
      await clearStore('attendance');
      await clearStore('advances');
      await clearStore('payments');
      await clearStore('materials');
      await clearStore('hotel_advances');
      await clearStore('food_logs');
      await clearStore('gst_records');
      await clearStore('site_diaries');
      await clearStore('delay_weather_logs');
      await clearStore('daily_expenses');
      await clearStore('payers');

      // Key fallbacks for backwards compatibility and server schema compatibility
      const pList = backupData.projects || [];
      const lList = backupData.labours || [];
      const attList = backupData.attendanceRecords || backupData.attendance || [];
      const advList = backupData.advanceRecords || backupData.advances || [];
      const payList = backupData.paymentRecords || backupData.payments || [];
      const matList = backupData.materials || [];
      const haList = backupData.hotelAdvances || backupData.hotel_advances || [];
      const flList = backupData.foodLogs || backupData.food_logs || [];
      const gstList = backupData.gstRecords || backupData.gst_records || [];
      const sdList = backupData.siteDiaries || backupData.site_diaries || [];
      const dwList = backupData.delayWeatherLogs || backupData.delay_weather_logs || [];
      const expList = backupData.dailyExpenses || backupData.daily_expenses || [];
      const payersList = backupData.payers || [];

      // Populate database using ultra-fast bulk operations
      await putItems('projects', pList);
      await putItems('labours', lList);
      await putItems('attendance', attList);
      await putItems('advances', advList);
      await putItems('payments', payList);
      await putItems('materials', matList);
      await putItems('hotel_advances', haList);
      await putItems('food_logs', flList);
      await putItems('gst_records', gstList);
      await putItems('site_diaries', sdList);
      await putItems('delay_weather_logs', dwList);
      await putItems('daily_expenses', expList);
      await putItems('payers', payersList);

      // Reload state
      setProjects(pList);
      setLabours(lList);
      setAttendanceRecords(attList);
      setAdvanceRecords(advList);
      setPaymentRecords(payList);
      setMaterials(matList);
      setHotelAdvances(haList);
      setFoodLogs(flList);
      setGstRecords(gstList);
      setSiteDiaries(sdList);
      setDelayWeatherLogs(dwList);
      setDailyExpenses(expList);
      setPayers(payersList);

      if (backupData.foodCalculationStartDate) {
        setFoodCalculationStartDate(backupData.foodCalculationStartDate);
      }

      const nowIso = new Date().toISOString();
      localStorage.setItem('last_backup_date', nowIso);
      setLastBackupDate(nowIso);

      if (pList.length > 0) {
        setActiveProjectId(pList[0].id);
      } else {
        setActiveProjectId(null);
      }
    } catch (error) {
      console.error('Import database failed:', error);
      alert('Failed to restore backup database.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    setLoading(true);
    try {
      await clearStore('projects');
      await clearStore('labours');
      await clearStore('attendance');
      await clearStore('advances');
      await clearStore('payments');
      await clearStore('materials');
      await clearStore('hotel_advances');
      await clearStore('food_logs');
      await clearStore('gst_records');
      await clearStore('site_diaries');
      await clearStore('delay_weather_logs');
      await clearStore('daily_expenses');
      await clearStore('payers');

      // Re-seed and load standard clean sample database
      await loadDatabase();
    } catch (error) {
      console.error('Reset database failed:', error);
      alert('Failed to reset database.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center gap-3">
        <Construction className="w-10 h-10 text-slate-800 dark:text-slate-200 animate-spin" />
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 font-mono">Loading Construction Database...</h2>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Overall Dashboard', icon: BarChart3, iconColor: 'text-indigo-500', badge: 'All', category: 'Navigation' },
    { id: 'projects', label: 'Projects & Timeline', icon: Briefcase, iconColor: 'text-blue-500', badge: projects.length.toString(), category: 'Navigation' },
    { id: 'labours', label: 'Labour Registry', icon: Users, iconColor: 'text-teal-500', badge: labours.filter(l => l.status === 'active').length.toString(), category: 'Navigation' },
    { id: 'attendance', label: 'Daily Attendance', icon: CalendarDays, iconColor: 'text-emerald-500', category: 'Navigation' },
    { id: 'payments', label: 'Wages & Payouts', icon: CircleDollarSign, iconColor: 'text-amber-500', category: 'Navigation' },
    { id: 'materials', label: 'Material Stocks', icon: Truck, iconColor: 'text-purple-500', category: 'Navigation' },
    { id: 'diary', label: 'Site Diary & Logs', icon: BookOpen, iconColor: 'text-emerald-500', category: 'Navigation' },
    { id: 'delays', label: 'Delays & Weather', icon: CloudSun, iconColor: 'text-sky-500', category: 'Navigation' },
    { id: 'reports', label: 'Ledgers & Backups', icon: FileBarChart2, iconColor: 'text-slate-500', category: 'Navigation' },
    
    { id: 'analysis', label: 'Cost Analysis', icon: TrendingUp, iconColor: 'text-indigo-600 dark:text-indigo-400', badge: 'Live', category: 'Costing & Food' },
    { id: 'food', label: 'Hotel Food (Rs. 100)', icon: Utensils, iconColor: 'text-amber-500', category: 'Costing & Food' },
    { id: 'expenses', label: 'Daily Expenses & Misc', icon: Receipt, iconColor: 'text-emerald-500', category: 'Costing & Food' },
    { id: 'gst', label: 'GST Invoices', icon: Percent, iconColor: 'text-violet-500', category: 'Costing & Food' },
  ];

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-200">
        {/* Top Banner Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Logo Brand & Mobile Collapse Toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsNavCollapsed(!isNavCollapsed)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer flex items-center justify-center"
                title={isNavCollapsed ? "Expand Navigation Sidebar" : "Collapse Navigation Sidebar"}
              >
                {isNavCollapsed ? <PanelLeftOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> : <PanelLeftClose className="w-5 h-5" />}
              </button>

              <div className="flex items-center gap-2.5">
                <div className="bg-slate-900 dark:bg-indigo-600 text-white p-2 rounded-lg">
                  <Construction className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-md font-bold tracking-tight text-slate-900 dark:text-white">Construction Manager</h1>
                  <p className="text-[10px] text-slate-400 dark:text-slate-400 font-mono tracking-wide uppercase">Worksite Books Proforma</p>
                </div>
              </div>
            </div>

            {/* Sync status widget, Project Selector & Dark Mode Toggle */}
            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-center">
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="text-[11px] font-semibold">Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-600" />
                    <span className="text-[11px] font-semibold">Dark</span>
                  </>
                )}
              </button>

              {/* Online/Offline Status Indicator */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold border ${isOnline ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300'}`}>
                {isOnline ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                    <span className="hidden xs:inline">ONLINE</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>OFFLINE</span>
                  </>
                )}
              </div>

              {/* Sync Now button */}
              <button
                onClick={() => triggerSync('Manual sync')}
                disabled={syncing || !isOnline}
                className={`p-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                  !isOnline 
                    ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    : syncing 
                    ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
                }`}
                title={isOnline ? `Last synced: ${lastSynced}` : 'Offline. All entries are saved locally.'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
                <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync'}</span>
              </button>

              {projects.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <select
                    id="active-project-selector"
                    value={activeProjectId || ''}
                    onChange={(e) => setActiveProjectId(e.target.value)}
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[220px] truncate"
                  >
                    {projects.map((p) => {
                      const isSub = Boolean(p.parentProjectId);
                      const parent = isSub ? projects.find(pr => pr.id === p.parentProjectId) : null;
                      return (
                        <option key={p.id} value={p.id}>
                          {isSub ? `↳ ${p.name} (Site under ${parent?.name || 'Main'})` : `${p.name} (Main Site)`}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Container Workspace */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col md:flex-row gap-6 w-full">
          {/* Collapsible Left Navigation Rail / Sidebar */}
          <aside className={`transition-all duration-300 shrink-0 flex flex-col gap-1.5 ${isNavCollapsed ? 'w-full md:w-16' : 'w-full md:w-64'}`}>
            <div className={`flex items-center ${isNavCollapsed ? 'justify-center py-1' : 'justify-between px-3 py-1'} mb-1`}>
              {!isNavCollapsed && (
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Navigation
                </span>
              )}
              <button
                onClick={() => setIsNavCollapsed(!isNavCollapsed)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                title={isNavCollapsed ? "Expand Sidebar (Show Titles)" : "Collapse Sidebar (Icons Only)"}
              >
                {isNavCollapsed ? <PanelLeftOpen className="w-4 h-4 text-indigo-500" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            </div>

            {/* Navigation Items List */}
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const showCategoryHeader = !isNavCollapsed && (idx === 0 || navItems[idx - 1].category !== item.category);

              return (
                <React.Fragment key={item.id}>
                  {showCategoryHeader && idx > 0 && (
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mt-3 mb-1">
                      {item.category}
                    </p>
                  )}

                  <button
                    onClick={() => setActiveTab(item.id as TabType)}
                    className={`group relative flex items-center rounded-xl font-semibold cursor-pointer transition ${
                      isNavCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5 text-sm'
                    } ${
                      isActive
                        ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                    title={isNavCollapsed ? item.label : undefined}
                  >
                    <span className={`flex items-center gap-2.5 ${isNavCollapsed ? 'justify-center' : ''}`}>
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.iconColor || 'text-slate-500 dark:text-slate-400'}`} />
                      {!isNavCollapsed && <span>{item.label}</span>}
                    </span>

                    {!isNavCollapsed && item.badge && (
                      <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-full ${
                        isActive 
                          ? 'bg-white/20 text-white' 
                          : item.id === 'analysis' 
                          ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300' 
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {item.badge}
                      </span>
                    )}

                    {!isNavCollapsed && !item.badge && (
                      <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isActive ? 'opacity-100 translate-x-0.5' : 'opacity-40'}`} />
                    )}

                    {/* Tooltip on Hover in Collapsed Mode */}
                    {isNavCollapsed && (
                      <div className="hidden md:block absolute left-full ml-2 px-2.5 py-1 bg-slate-900 dark:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.label} {item.badge ? `(${item.badge})` : ''}
                      </div>
                    )}
                  </button>
                </React.Fragment>
              );
            })}

            {/* Active Site Card (Expanded mode) */}
            {!isNavCollapsed && activeProject && (
              <div className="mt-4 bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800 rounded-xl p-3.5 space-y-1.5">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Site Card</h4>
                <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate">{activeProject.name}</p>
                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>Budget:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">₹{activeProject.budget.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                  <span>Status:</span>
                  <span className="capitalize font-semibold text-indigo-600 dark:text-indigo-400">{activeProject.status.replace('_', ' ')}</span>
                </div>
              </div>
            )}

            {/* Offline Sync Log Box (Expanded mode) */}
            {!isNavCollapsed && (
              <div className="mt-2 bg-slate-100/60 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-800 rounded-xl p-3 space-y-1.5">
                <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  Offline Sync Logs
                </h4>
                <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 space-y-1 max-h-[80px] overflow-y-auto leading-relaxed">
                  {syncHistory.map((log, idx) => (
                    <div key={idx} className="border-b border-slate-200/40 dark:border-slate-800/40 pb-0.5 last:border-0 truncate">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Content Panel Area */}
          <main className="flex-1 min-w-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xs transition-colors">
          <BackupPromptBanner
            onExportBackup={handleExportBackup}
            lastBackupDate={lastBackupDate}
          />
          {activeTab === 'dashboard' && (
            <Dashboard
              projects={projects}
              labours={labours}
              attendanceRecords={attendanceRecords}
              materials={materials}
              foodLogs={foodLogs}
              gstRecords={gstRecords}
              dailyExpenses={dailyExpenses}
              advanceRecords={advanceRecords}
              paymentRecords={paymentRecords}
              hotelAdvances={hotelAdvances}
              payers={payers}
              activeProjectId={activeProjectId}
              onSelectProject={setActiveProjectId}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              setActiveTab={setActiveTab}
              onResetDatabase={handleResetDatabase}
              foodCalculationStartDate={foodCalculationStartDate}
              onFoodCalculationStartDateChange={setFoodCalculationStartDate}
              onUpdateDailyExpense={handleUpdateDailyExpense}
              onDeleteDailyExpense={handleDeleteDailyExpense}
              onUpdateMaterial={handleUpdateMaterial}
              onDeleteMaterial={handleDeleteMaterial}
              onUpdateFoodLog={handleUpdateFoodLog}
              onDeleteFoodLog={handleDeleteFoodLog}
              onDeleteAdvance={handleDeleteAdvance}
              onDeletePayment={handleDeletePayment}
              onDeleteHotelAdvance={handleDeleteHotelAdvance}
              onUpdatePayer={handleUpdatePayer}
              onDeletePayer={handleDeletePayer}
              onUpdateGstRecord={handleUpdateGstRecord}
              onDeleteGstRecord={handleDeleteGstRecord}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectManager
              projects={projects}
              labours={labours}
              attendanceRecords={attendanceRecords}
              materials={materials}
              foodLogs={foodLogs}
              dailyExpenses={dailyExpenses}
              foodCalculationStartDate={foodCalculationStartDate}
              activeProjectId={activeProjectId}
              onSelectProject={setActiveProjectId}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
            />
          )}

          {activeTab === 'labours' && (
            <LabourManager
              labours={labours}
              onAddLabour={handleAddLabour}
              onUpdateLabour={handleUpdateLabour}
              onDeleteLabour={handleDeleteLabour}
              activeProject={activeProject}
              attendanceRecords={attendanceRecords}
              advanceRecords={advanceRecords}
              paymentRecords={paymentRecords}
              foodLogs={foodLogs}
              payers={payers}
              onAddAdvance={handleAddAdvance}
              onRecordPayment={handleRecordPayment}
              onDeleteAdvance={handleDeleteAdvance}
              onDeletePayment={handleDeletePayment}
              foodCalculationStartDate={foodCalculationStartDate}
            />
          )}

          {activeTab === 'attendance' && (
            <AttendanceTracker
              activeProject={activeProject}
              labours={labours}
              attendanceRecords={attendanceRecords}
              advanceRecords={advanceRecords}
              payers={payers}
              onSaveAttendance={handleSaveAttendance}
              onAddAdvance={handleAddAdvance}
              onDeleteAdvance={handleDeleteAdvance}
              onAddPayer={handleAddPayer}
              onUpdatePayer={handleUpdatePayer}
              onDeletePayer={handleDeletePayer}
              onUpdateLabour={handleUpdateLabour}
            />
          )}

          {activeTab === 'payments' && (
            <LabourPaymentCalculator
              activeProject={activeProject}
              labours={labours}
              attendanceRecords={attendanceRecords}
              advanceRecords={advanceRecords}
              paymentRecords={paymentRecords}
              onRecordPayment={handleRecordPayment}
              onDeletePayment={handleDeletePayment}
              onDeleteAdvance={handleDeleteAdvance}
            />
          )}

          {activeTab === 'materials' && (
            <MaterialTracker
              activeProject={activeProject}
              materials={materials}
              onAddMaterial={handleAddMaterial}
              onUpdateMaterial={handleUpdateMaterial}
              onDeleteMaterial={handleDeleteMaterial}
            />
          )}

          {activeTab === 'reports' && (
            <ReportGenerator
              activeProject={activeProject}
              projects={projects}
              labours={labours}
              attendanceRecords={attendanceRecords}
              advanceRecords={advanceRecords}
              paymentRecords={paymentRecords}
              materials={materials}
              gstRecords={gstRecords}
              siteDiaries={siteDiaries}
              delayWeatherLogs={delayWeatherLogs}
              hotelAdvances={hotelAdvances}
              foodLogs={foodLogs}
              payers={payers}
              dailyExpenses={dailyExpenses}
              onImportBackup={handleImportBackup}
              onExportBackup={handleExportBackup}
              foodCalculationStartDate={foodCalculationStartDate}
            />
          )}

          {activeTab === 'food' && (
            <FoodTracker
              activeProject={activeProject}
              labours={labours}
              attendanceRecords={attendanceRecords}
              hotelAdvances={hotelAdvances}
              foodLogs={foodLogs}
              onAddHotelAdvance={handleAddHotelAdvance}
              onDeleteHotelAdvance={handleDeleteHotelAdvance}
              onAddFoodLog={handleAddFoodLog}
              onUpdateFoodLog={handleUpdateFoodLog}
              onDeleteFoodLog={handleDeleteFoodLog}
              onUpdateLabour={handleUpdateLabour}
              foodCalculationStartDate={foodCalculationStartDate}
              onFoodCalculationStartDateChange={setFoodCalculationStartDate}
            />
          )}

          {activeTab === 'expenses' && (
            <DailyExpensesTracker
              activeProject={activeProject}
              labours={labours}
              payers={payers}
              dailyExpenses={dailyExpenses}
              onAddDailyExpense={handleAddDailyExpense}
              onUpdateDailyExpense={handleUpdateDailyExpense}
              onDeleteDailyExpense={handleDeleteDailyExpense}
            />
          )}

          {activeTab === 'gst' && (
            <GstTracker
              activeProject={activeProject}
              gstRecords={gstRecords}
              onAddGstRecord={handleAddGstRecord}
              onUpdateGstRecord={handleUpdateGstRecord}
              onDeleteGstRecord={handleDeleteGstRecord}
            />
          )}

          {activeTab === 'diary' && (
            <SiteDiary
              activeProject={activeProject}
              siteDiaries={siteDiaries}
              attendanceRecords={attendanceRecords}
              onAddSiteDiary={handleAddSiteDiary}
              onUpdateSiteDiary={handleUpdateSiteDiary}
              onDeleteSiteDiary={handleDeleteSiteDiary}
            />
          )}

          {activeTab === 'delays' && (
            <DelayWeatherTracker
              activeProject={activeProject}
              delayWeatherLogs={delayWeatherLogs}
              onAddDelayWeatherLog={handleAddDelayWeatherLog}
              onUpdateDelayWeatherLog={handleUpdateDelayWeatherLog}
              onDeleteDelayWeatherLog={handleDeleteDelayWeatherLog}
              onFetchWeather={fetchWeatherForProject}
              isWeatherFetching={isWeatherFetching}
            />
          )}

          {activeTab === 'analysis' && (
            <CostAnalysis
              activeProject={activeProject}
              labours={labours}
              attendanceRecords={attendanceRecords}
              advanceRecords={advanceRecords}
              paymentRecords={paymentRecords}
              materials={materials}
              hotelAdvances={hotelAdvances}
              foodLogs={foodLogs}
              dailyExpenses={dailyExpenses}
              foodCalculationStartDate={foodCalculationStartDate}
              onFoodCalculationStartDateChange={setFoodCalculationStartDate}
            />
          )}
        </main>
      </div>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-4 text-center text-xs text-slate-400 dark:text-slate-500 font-mono transition-colors">
        Construction Business Ledger & Calculations Dashboard • Local Offline Persistence Secured
      </footer>
      </div>
    </ToastProvider>
  );
}

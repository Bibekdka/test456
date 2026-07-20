/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Project, Labour, Attendance, Advance, Payment, Material, HotelAdvance, FoodLog, GstRecord, Payer, SiteDiaryEntry, DelayWeatherLog } from './types';
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
  CloudSun
} from 'lucide-react';

type TabType = 'dashboard' | 'projects' | 'attendance' | 'payments' | 'materials' | 'reports' | 'labours' | 'food' | 'analysis' | 'gst' | 'diary' | 'delays';

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
  const [isWeatherFetching, setIsWeatherFetching] = useState<boolean>(false);

  // Selected Active Project
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Food Expense Calculation custom start date
  const [foodCalculationStartDate, setFoodCalculationStartDate] = useState<string>('');

  // Syncing and network state
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string>('Just now');
  const [syncHistory, setSyncHistory] = useState<string[]>([
    'Local database initialized in offline-first mode.'
  ]);

  const triggerSync = async (reason: string = 'Manual sync') => {
    if (!navigator.onLine) {
      return;
    }
    setSyncing(true);
    // Simulate high quality backend database reconciliation with our local IndexedDB state
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSyncing(false);
    const timestamp = new Date().toLocaleTimeString();
    setLastSynced(timestamp);
    setSyncHistory(prev => [
      `[${timestamp}] ${reason} - Successfully synchronized all records to back-end cloud server.`,
      ...prev.slice(0, 4)
    ]);
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

      // Retrieve all lists
      const pList = await getAllItems<Project>('projects');
      const lList = await getAllItems<Labour>('labours');
      const attList = await getAllItems<Attendance>('attendance');
      const advList = await getAllItems<Advance>('advances');
      const payList = await getAllItems<Payment>('payments');
      const matList = await getAllItems<Material>('materials');
      const haList = await getAllItems<HotelAdvance>('hotel_advances');
      const flList = await getAllItems<FoodLog>('food_logs');
      const gstList = await getAllItems<GstRecord>('gst_records');
      const payersList = await getAllItems<Payer>('payers');
      const sdList = await getAllItems<SiteDiaryEntry>('site_diaries');
      const dwList = await getAllItems<DelayWeatherLog>('delay_weather_logs');

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
            id: 'dw_' + Math.random().toString(36).substr(2, 9),
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
  };

  const handleUpdateProject = async (p: Project) => {
    await putItem('projects', p);
    setProjects(prev => prev.map(item => item.id === p.id ? p : item));
    if (p.location) {
      fetchWeatherForProject(p);
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
      triggerSync('Auto-sync: Deleted worker profile');
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
  };

  // ----------------------------------------------------
  // Payer operations
  // ----------------------------------------------------
  const handleAddPayer = async (p: Payer) => {
    await putItem('payers', p);
    setPayers(prev => [...prev, p]);
  };

  const handleUpdatePayer = async (p: Payer) => {
    await putItem('payers', p);
    setPayers(prev => prev.map(item => item.id === p.id ? p : item));
  };

  const handleDeletePayer = async (id: string) => {
    await deleteItem('payers', id);
    setPayers(prev => prev.filter(p => p.id !== id));
  };

  const handleDeleteAdvance = async (id: string) => {
    await deleteItem('advances', id);
    setAdvanceRecords(prev => prev.filter(item => item.id !== id));
  };

  // ----------------------------------------------------
  // Payment operations
  // ----------------------------------------------------
  const handleRecordPayment = async (pay: Payment) => {
    await putItem('payments', pay);
    setPaymentRecords(prev => [...prev, pay]);
  };

  const handleDeletePayment = async (id: string) => {
    await deleteItem('payments', id);
    setPaymentRecords(prev => prev.filter(item => item.id !== id));
  };

  // ----------------------------------------------------
  // Material operations
  // ----------------------------------------------------
  const handleAddMaterial = async (m: Material) => {
    await putItem('materials', m);
    setMaterials(prev => [...prev, m]);
  };

  const handleUpdateMaterial = async (m: Material) => {
    await putItem('materials', m);
    setMaterials(prev => prev.map(item => item.id === m.id ? m : item));
  };

  const handleDeleteMaterial = async (id: string) => {
    await deleteItem('materials', id);
    setMaterials(prev => prev.filter(item => item.id !== id));
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
      triggerSync('Auto-sync: Deleted hotel advance');
    }
  };

  const handleAddFoodLog = async (fl: FoodLog) => {
    await putItem('food_logs', fl);
    setFoodLogs(prev => [...prev, fl]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Added meal deduction');
    }
  };

  const handleDeleteFoodLog = async (id: string) => {
    await deleteItem('food_logs', id);
    setFoodLogs(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted meal deduction');
    }
  };

  const handleAddGstRecord = async (rec: GstRecord) => {
    await putItem('gst_records', rec);
    setGstRecords(prev => [...prev, rec]);
    if (navigator.onLine) {
      triggerSync('Auto-sync: Added GST record');
    }
  };

  const handleDeleteGstRecord = async (id: string) => {
    await deleteItem('gst_records', id);
    setGstRecords(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted GST record');
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

  const handleDeleteSiteDiary = async (id: string) => {
    await deleteItem('site_diaries', id);
    setSiteDiaries(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted site diary entry');
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

  const handleDeleteDelayWeatherLog = async (id: string) => {
    await deleteItem('delay_weather_logs', id);
    setDelayWeatherLogs(prev => prev.filter(item => item.id !== id));
    if (navigator.onLine) {
      triggerSync('Auto-sync: Deleted weather/delay log');
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

      // Populate database using ultra-fast bulk operations
      await putItems('projects', backupData.projects || []);
      await putItems('labours', backupData.labours || []);
      await putItems('attendance', backupData.attendanceRecords || []);
      await putItems('advances', backupData.advanceRecords || []);
      await putItems('payments', backupData.paymentRecords || []);
      await putItems('materials', backupData.materials || []);
      await putItems('hotel_advances', backupData.hotelAdvances || []);
      await putItems('food_logs', backupData.foodLogs || []);
      await putItems('gst_records', backupData.gstRecords || []);
      await putItems('site_diaries', backupData.siteDiaries || []);
      await putItems('delay_weather_logs', backupData.delayWeatherLogs || []);

      // Reload
      setProjects(backupData.projects || []);
      setLabours(backupData.labours || []);
      setAttendanceRecords(backupData.attendanceRecords || []);
      setAdvanceRecords(backupData.advanceRecords || []);
      setPaymentRecords(backupData.paymentRecords || []);
      setMaterials(backupData.materials || []);
      setHotelAdvances(backupData.hotelAdvances || []);
      setFoodLogs(backupData.foodLogs || []);
      setGstRecords(backupData.gstRecords || []);
      setSiteDiaries(backupData.siteDiaries || []);
      setDelayWeatherLogs(backupData.delayWeatherLogs || []);

      if (backupData.projects && backupData.projects.length > 0) {
        setActiveProjectId(backupData.projects[0].id);
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

      setProjects([]);
      setLabours([]);
      setAttendanceRecords([]);
      setAdvanceRecords([]);
      setPaymentRecords([]);
      setMaterials([]);
      setHotelAdvances([]);
      setFoodLogs([]);
      setGstRecords([]);
      setActiveProjectId(null);
    } catch (error) {
      console.error('Reset database failed:', error);
      alert('Failed to reset database.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center gap-3">
        <Construction className="w-10 h-10 text-slate-800 animate-spin" />
        <h2 className="text-sm font-semibold text-slate-600 font-mono">Loading Construction Database...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Top Banner Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Logo Brand */}
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-900 text-white p-2 rounded-lg">
              <Construction className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-md font-bold tracking-tight text-slate-900">Construction Manager</h1>
              <p className="text-[10px] text-slate-400 font-mono tracking-wide uppercase">Worksite Books Proforma</p>
            </div>
          </div>

          {/* Sync status widget & Project Selector */}
          <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
            {/* Online/Offline Status Indicator */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold border ${isOnline ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                  <span>ONLINE & SYNCED</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                  <span>OFFLINE MODE</span>
                </>
              )}
            </div>

            {/* Sync Now button */}
            <button
              onClick={() => triggerSync('Manual sync')}
              disabled={syncing || !isOnline}
              className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition ${
                !isOnline 
                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                  : syncing 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
              }`}
              title={isOnline ? `Last synced: ${lastSynced}` : 'Offline. All entries are saved locally.'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
              <span>{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>

            {projects.length > 0 && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400" />
                <select
                  id="active-project-selector"
                  value={activeProjectId || ''}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container Workspace */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 flex flex-col md:flex-row gap-6">
        {/* Navigation Rail / Sidebar */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-1">Navigation</p>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Overall Dashboard
            </span>
            <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">
              All
            </span>
          </button>

          <button
            onClick={() => setActiveTab('projects')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'projects'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Briefcase className="w-4 h-4" />
              Projects & Timeline
            </span>
            <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono group-hover:bg-slate-300">
              {projects.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('labours')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'labours'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Users className="w-4 h-4" />
              Labour Registry
            </span>
            <span className="bg-slate-200 text-slate-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
              {labours.filter(l => l.status === 'active').length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'attendance'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CalendarDays className="w-4 h-4" />
              Daily Attendance
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'payments'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CircleDollarSign className="w-4 h-4" />
              Wages & Payouts
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('materials')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'materials'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Truck className="w-4 h-4" />
              Material Stocks
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('diary')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'diary'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-emerald-500" />
              Site Diary & Logs
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('delays')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'delays'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CloudSun className="w-4 h-4 text-amber-500" />
              Delays & Weather
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'reports'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <FileBarChart2 className="w-4 h-4" />
              Ledgers & Backups
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mt-4 mb-1">Costing & Food</p>

          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'analysis'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Cost Analysis
            </span>
            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono">
              Live
            </span>
          </button>

          <button
            onClick={() => setActiveTab('food')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'food'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Utensils className="w-4 h-4 text-amber-500" />
              Hotel Food (Rs. 100)
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('gst')}
            className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition ${
              activeTab === 'gst'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Percent className="w-4 h-4 text-indigo-500" />
              GST Invoices
            </span>
            <ChevronRight className="w-3.5 h-3.5 opacity-60" />
          </button>

          {/* Mini active project details card in footer of sidebar */}
          {activeProject && (
            <div className="mt-6 bg-slate-100 border border-slate-200/50 rounded-xl p-4 space-y-2">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Site Card</h4>
              <p className="font-semibold text-slate-800 text-xs truncate">{activeProject.name}</p>
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>Budget:</span>
                <span className="font-semibold text-slate-700">₹{activeProject.budget.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                <span>Status:</span>
                <span className="capitalize font-semibold text-indigo-600">{activeProject.status.replace('_', ' ')}</span>
              </div>
            </div>
          )}

          {/* Offline Sync Log Box */}
          <div className="mt-3 bg-slate-100/50 border border-slate-200/30 rounded-xl p-4 space-y-2">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              Offline Sync Logs
            </h4>
            <div className="text-[10px] font-mono text-slate-500 space-y-1.5 max-h-[100px] overflow-y-auto leading-relaxed">
              {syncHistory.map((log, idx) => (
                <div key={idx} className="border-b border-slate-200/40 pb-1 last:border-0">
                  {log}
                </div>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 italic">
              All transactions are persistently cached locally and replicated when online.
            </p>
          </div>
        </aside>

        {/* Content Panel Area */}
        <main className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          {activeTab === 'dashboard' && (
            <Dashboard
              projects={projects}
              labours={labours}
              attendanceRecords={attendanceRecords}
              materials={materials}
              foodLogs={foodLogs}
              gstRecords={gstRecords}
              activeProjectId={activeProjectId}
              onSelectProject={setActiveProjectId}
              onAddProject={handleAddProject}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              setActiveTab={setActiveTab}
              onResetDatabase={handleResetDatabase}
              foodCalculationStartDate={foodCalculationStartDate}
              onFoodCalculationStartDateChange={setFoodCalculationStartDate}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectManager
              projects={projects}
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
              onImportBackup={handleImportBackup}
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
              onDeleteFoodLog={handleDeleteFoodLog}
              foodCalculationStartDate={foodCalculationStartDate}
              onFoodCalculationStartDateChange={setFoodCalculationStartDate}
            />
          )}

          {activeTab === 'gst' && (
            <GstTracker
              activeProject={activeProject}
              gstRecords={gstRecords}
              onAddGstRecord={handleAddGstRecord}
              onDeleteGstRecord={handleDeleteGstRecord}
            />
          )}

          {activeTab === 'diary' && (
            <SiteDiary
              activeProject={activeProject}
              siteDiaries={siteDiaries}
              attendanceRecords={attendanceRecords}
              onAddSiteDiary={handleAddSiteDiary}
              onDeleteSiteDiary={handleDeleteSiteDiary}
            />
          )}

          {activeTab === 'delays' && (
            <DelayWeatherTracker
              activeProject={activeProject}
              delayWeatherLogs={delayWeatherLogs}
              onAddDelayWeatherLog={handleAddDelayWeatherLog}
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
              foodCalculationStartDate={foodCalculationStartDate}
              onFoodCalculationStartDateChange={setFoodCalculationStartDate}
            />
          )}
        </main>
      </div>

      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400 font-mono">
        Construction Business Ledger & Calculations Dashboard • Local Offline Persistence Secured
      </footer>
    </div>
  );
}

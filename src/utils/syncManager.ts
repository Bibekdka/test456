import { getAllItems, putItems } from '../db';

const LAST_SYNC_KEY = 'construction_app_last_sync_ts';

export interface SyncResult {
  success: boolean;
  message: string;
  updatedCount?: number;
  timestamp?: number;
  mode?: 'incremental' | 'full';
}

/**
 * Performs incremental delta sync with the backend Express server.
 * Only transfers and merges changed records since last sync timestamp.
 */
export async function performIncrementalSync(): Promise<SyncResult> {
  const lastSyncTs = Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
  const now = Date.now();

  const storeKeys = [
    'projects', 'labours', 'attendance', 'advances', 'payments',
    'materials', 'hotel_advances', 'food_logs', 'gst_records',
    'payers', 'site_diaries', 'delay_weather_logs', 'daily_expenses'
  ];

  const clientChanges: Record<string, any[]> = {};
  let totalChangedLocal = 0;

  // Gather items modified since lastSyncTs
  for (const storeName of storeKeys) {
    const all = await getAllItems<any>(storeName);
    const changed = lastSyncTs === 0 
      ? all 
      : all.filter(item => (item.updatedAt || 0) > lastSyncTs);
    
    if (changed.length > 0) {
      clientChanges[storeName] = changed;
      totalChangedLocal += changed.length;
    }
  }

  const response = await fetch('/api/db/sync/delta', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sinceTimestamp: lastSyncTs,
      changes: clientChanges
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with ${response.status}`);
  }

  const data = await response.json();
  const serverUpdates = data.serverUpdates || {};

  let totalAppliedFromRemote = 0;

  // Apply server updates locally in IndexedDB
  for (const storeName of storeKeys) {
    const items = serverUpdates[storeName];
    if (Array.isArray(items) && items.length > 0) {
      await putItems(storeName, items);
      totalAppliedFromRemote += items.length;
    }
  }

  const syncTimestamp = data.timestamp || now;
  localStorage.setItem(LAST_SYNC_KEY, syncTimestamp.toString());

  return {
    success: true,
    message: totalChangedLocal === 0 && totalAppliedFromRemote === 0
      ? 'Database up to date'
      : `Incremental sync complete: ${totalChangedLocal} uploaded, ${totalAppliedFromRemote} updated from server.`,
    updatedCount: totalChangedLocal + totalAppliedFromRemote,
    timestamp: syncTimestamp,
    mode: 'incremental'
  };
}

/**
 * Performs full database sync backup.
 */
export async function performFullSync(): Promise<SyncResult> {
  const storeKeys = [
    'projects', 'labours', 'attendance', 'advances', 'payments',
    'materials', 'hotel_advances', 'food_logs', 'gst_records',
    'payers', 'site_diaries', 'delay_weather_logs', 'daily_expenses'
  ];

  const fullData: Record<string, any[]> = {};
  for (const storeName of storeKeys) {
    fullData[storeName] = await getAllItems(storeName);
  }

  const response = await fetch('/api/db/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullData)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server responded with ${response.status}`);
  }

  const syncTimestamp = Date.now();
  localStorage.setItem(LAST_SYNC_KEY, syncTimestamp.toString());

  return {
    success: true,
    message: 'Full database synced successfully with server.',
    timestamp: syncTimestamp,
    mode: 'full'
  };
}

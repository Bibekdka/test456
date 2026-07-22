import React, { useCallback } from 'react';
import { putItem, putItems, deleteItem, deleteItems } from '../db';
import { useToast } from '../components/ToastContainer';

export function useCrud<T extends { id: string }>(
  storeName: string,
  state: T[],
  setState: React.Dispatch<React.SetStateAction<T[]>>
) {
  const { showSuccess, showError } = useToast();

  const handleSave = useCallback(async (item: T, successMsg?: string) => {
    try {
      await putItem(storeName, item);
      setState(prev => {
        const index = prev.findIndex(i => i.id === item.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = item;
          return next;
        }
        return [...prev, item];
      });
      if (successMsg) showSuccess(successMsg);
    } catch (err: any) {
      console.error(`Failed to save item in ${storeName}:`, err);
      showError(`Failed to save record: ${err?.message || 'Database write error'}`);
      throw err;
    }
  }, [storeName, setState, showSuccess, showError]);

  const handleSaveMany = useCallback(async (items: T[], successMsg?: string) => {
    if (items.length === 0) return;
    try {
      await putItems(storeName, items);
      setState(prev => {
        const itemMap = new Map(prev.map(i => [i.id, i]));
        items.forEach(i => itemMap.set(i.id, i));
        return Array.from(itemMap.values());
      });
      if (successMsg) showSuccess(successMsg);
    } catch (err: any) {
      console.error(`Failed to save items in ${storeName}:`, err);
      showError(`Failed to save records: ${err?.message || 'Database write error'}`);
      throw err;
    }
  }, [storeName, setState, showSuccess, showError]);

  const handleDelete = useCallback(async (id: string, successMsg?: string) => {
    try {
      await deleteItem(storeName, id);
      setState(prev => prev.filter(i => i.id !== id));
      if (successMsg) showSuccess(successMsg);
    } catch (err: any) {
      console.error(`Failed to delete item from ${storeName}:`, err);
      showError(`Failed to delete record: ${err?.message || 'Database delete error'}`);
      throw err;
    }
  }, [storeName, setState, showSuccess, showError]);

  const handleDeleteMany = useCallback(async (ids: string[], successMsg?: string) => {
    if (ids.length === 0) return;
    try {
      await deleteItems(storeName, ids);
      const idSet = new Set(ids);
      setState(prev => prev.filter(i => !idSet.has(i.id)));
      if (successMsg) showSuccess(successMsg);
    } catch (err: any) {
      console.error(`Failed to delete items from ${storeName}:`, err);
      showError(`Failed to delete records: ${err?.message || 'Database delete error'}`);
      throw err;
    }
  }, [storeName, setState, showSuccess, showError]);

  return {
    handleSave,
    handleSaveMany,
    handleDelete,
    handleDeleteMany
  };
}

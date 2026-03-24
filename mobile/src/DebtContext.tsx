import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { initDB, getDebts, createDebt, updateDebt as dbUpdateDebt, deleteDebt } from './database';
import type { Debt, DebtInput } from './types';

interface DebtContextValue {
  debts: Debt[];
  loading: boolean;
  addDebt: (debt: DebtInput) => Promise<void>;
  updateDebt: (id: number, debt: Partial<DebtInput>) => Promise<void>;
  removeDebt: (id: number) => Promise<void>;
  refreshDebts: () => Promise<void>;
}

const DebtContext = createContext<DebtContextValue | null>(null);

export function DebtProvider({ children }: { children: React.ReactNode }) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDebts = useCallback(async () => {
    try {
      const data = await getDebts();
      setDebts(data);
    } catch (err) {
      console.error('Failed to load debts:', err);
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        await initDB();
        await refreshDebts();
      } catch (err) {
        console.error('DB init error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [refreshDebts]);

  const addDebt = useCallback(
    async (debt: DebtInput) => {
      await createDebt(debt);
      await refreshDebts();
    },
    [refreshDebts]
  );

  const updateDebt = useCallback(
    async (id: number, debt: Partial<DebtInput>) => {
      await dbUpdateDebt(id, debt);
      await refreshDebts();
    },
    [refreshDebts]
  );

  const removeDebt = useCallback(
    async (id: number) => {
      await deleteDebt(id);
      await refreshDebts();
    },
    [refreshDebts]
  );

  return (
    <DebtContext.Provider value={{ debts, loading, addDebt, updateDebt, removeDebt, refreshDebts }}>
      {children}
    </DebtContext.Provider>
  );
}

export function useDebts(): DebtContextValue {
  const ctx = useContext(DebtContext);
  if (!ctx) throw new Error('useDebts must be used within DebtProvider');
  return ctx;
}

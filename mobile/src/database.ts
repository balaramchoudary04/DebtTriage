import * as SQLite from 'expo-sqlite';
import type { Debt, DebtInput } from './types';

let dbInstance: SQLite.SQLiteDatabase | null = null;

async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('debttriage.db');
  }
  return dbInstance;
}

export async function initDB(): Promise<void> {
  const db = await getDB();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL,
      credit_limit REAL,
      apr REAL NOT NULL,
      minimum_payment REAL NOT NULL,
      due_day INTEGER NOT NULL,
      lender TEXT,
      account_last4 TEXT
    );
  `);
}

function rowToDebt(row: any): Debt {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    balance: row.balance,
    creditLimit: row.credit_limit,
    apr: row.apr,
    minimumPayment: row.minimum_payment,
    dueDay: row.due_day,
    lender: row.lender,
    accountLast4: row.account_last4,
  };
}

export async function getDebts(): Promise<Debt[]> {
  const db = await getDB();
  const rows = await db.getAllAsync('SELECT * FROM debts ORDER BY balance DESC');
  return (rows as any[]).map(rowToDebt);
}

export async function getDebt(id: number): Promise<Debt | null> {
  const db = await getDB();
  const row = await db.getFirstAsync('SELECT * FROM debts WHERE id = ?', [id]);
  if (!row) return null;
  return rowToDebt(row);
}

export async function createDebt(debt: DebtInput): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync(
    `INSERT INTO debts (name, type, balance, credit_limit, apr, minimum_payment, due_day, lender, account_last4)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      debt.name,
      debt.type,
      debt.balance,
      debt.creditLimit ?? null,
      debt.apr,
      debt.minimumPayment,
      debt.dueDay,
      debt.lender ?? null,
      debt.accountLast4 ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateDebt(id: number, debt: Partial<DebtInput>): Promise<void> {
  const db = await getDB();
  const fields: string[] = [];
  const values: any[] = [];

  if (debt.name !== undefined) { fields.push('name = ?'); values.push(debt.name); }
  if (debt.type !== undefined) { fields.push('type = ?'); values.push(debt.type); }
  if (debt.balance !== undefined) { fields.push('balance = ?'); values.push(debt.balance); }
  if (debt.creditLimit !== undefined) { fields.push('credit_limit = ?'); values.push(debt.creditLimit); }
  if (debt.apr !== undefined) { fields.push('apr = ?'); values.push(debt.apr); }
  if (debt.minimumPayment !== undefined) { fields.push('minimum_payment = ?'); values.push(debt.minimumPayment); }
  if (debt.dueDay !== undefined) { fields.push('due_day = ?'); values.push(debt.dueDay); }
  if (debt.lender !== undefined) { fields.push('lender = ?'); values.push(debt.lender); }
  if (debt.accountLast4 !== undefined) { fields.push('account_last4 = ?'); values.push(debt.accountLast4); }

  if (fields.length === 0) return;
  values.push(id);

  await db.runAsync(`UPDATE debts SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteDebt(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM debts WHERE id = ?', [id]);
}

export async function deleteAllDebts(): Promise<void> {
  const db = await getDB();
  await db.runAsync('DELETE FROM debts');
}

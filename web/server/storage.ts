import { type Debt, type InsertDebt, debts } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

export interface IStorage {
  getDebts(): Promise<Debt[]>;
  getDebt(id: number): Promise<Debt | undefined>;
  createDebt(debt: InsertDebt): Promise<Debt>;
  updateDebt(id: number, debt: Partial<InsertDebt>): Promise<Debt | undefined>;
  deleteDebt(id: number): Promise<void>;
  deleteAllDebts(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getDebts(): Promise<Debt[]> {
    return db.select().from(debts).all();
  }

  async getDebt(id: number): Promise<Debt | undefined> {
    return db.select().from(debts).where(eq(debts.id, id)).get();
  }

  async createDebt(debt: InsertDebt): Promise<Debt> {
    return db.insert(debts).values(debt).returning().get();
  }

  async updateDebt(id: number, debt: Partial<InsertDebt>): Promise<Debt | undefined> {
    return db.update(debts).set(debt).where(eq(debts.id, id)).returning().get();
  }

  async deleteDebt(id: number): Promise<void> {
    db.delete(debts).where(eq(debts.id, id)).run();
  }

  async deleteAllDebts(): Promise<void> {
    db.delete(debts).run();
  }
}

export const storage = new DatabaseStorage();

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertDebtSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Get all debts
  app.get("/api/debts", async (_req, res) => {
    const allDebts = await storage.getDebts();
    res.json(allDebts);
  });

  // Get single debt
  app.get("/api/debts/:id", async (req, res) => {
    const debt = await storage.getDebt(Number(req.params.id));
    if (!debt) return res.status(404).json({ error: "Debt not found" });
    res.json(debt);
  });

  // Create debt
  app.post("/api/debts", async (req, res) => {
    const parsed = insertDebtSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    const debt = await storage.createDebt(parsed.data);
    res.status(201).json(debt);
  });

  // Update debt
  app.patch("/api/debts/:id", async (req, res) => {
    const debt = await storage.updateDebt(Number(req.params.id), req.body);
    if (!debt) return res.status(404).json({ error: "Debt not found" });
    res.json(debt);
  });

  // Delete debt
  app.delete("/api/debts/:id", async (req, res) => {
    await storage.deleteDebt(Number(req.params.id));
    res.status(204).send();
  });

  // Delete all debts
  app.delete("/api/debts", async (_req, res) => {
    await storage.deleteAllDebts();
    res.status(204).send();
  });

  return httpServer;
}

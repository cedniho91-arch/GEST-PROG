import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any;

async function startServer() {
  try {
    db = new Database("accounting.db");
    console.log("Database initialized successfully");
  } catch (err) {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  }

  // Initialize Database
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'COMPTABLE',
      is_active INTEGER DEFAULT 1,
      password_updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT,
      description TEXT,
      start_date TEXT,
      end_date TEXT
    );

    CREATE TABLE IF NOT EXISTS journals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT,
      type TEXT DEFAULT 'GENERAL', -- 'GENERAL', 'TREASURY'
      treasury_account_id INTEGER,
      FOREIGN KEY(treasury_account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS donors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      contact TEXT
    );

    CREATE TABLE IF NOT EXISTS budget_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      code TEXT,
      name TEXT,
      allocated_amount REAL,
      year INTEGER DEFAULT 2026,
      FOREIGN KEY(project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS closed_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      type TEXT, -- 'MONTH', 'YEAR'
      period TEXT, -- 'YYYY-MM' or 'YYYY'
      closed_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id),
      UNIQUE(project_id, type, period)
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT,
      class INTEGER
    );

    CREATE TABLE IF NOT EXISTS tiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT,
      type TEXT DEFAULT 'OTHER', -- 'SUPPLIER', 'CUSTOMER', 'EMPLOYEE', 'OTHER'
      account_id INTEGER,
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      reference TEXT UNIQUE,
      description TEXT,
      project_id INTEGER,
      journal_id INTEGER,
      FOREIGN KEY(project_id) REFERENCES projects(id),
      FOREIGN KEY(journal_id) REFERENCES journals(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER,
      account_id INTEGER,
      budget_line_id INTEGER,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      letter TEXT, -- For lettering (matching)
      FOREIGN KEY(entry_id) REFERENCES journal_entries(id),
      FOREIGN KEY(account_id) REFERENCES accounts(id),
      FOREIGN KEY(budget_line_id) REFERENCES budget_lines(id)
    );
  `);

  // Migrations for existing databases
  const migrate = () => {
    const tables = ['users', 'projects', 'journals', 'transactions', 'budget_lines'];
    
    tables.forEach(table => {
      try {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
        const columnNames = columns.map(c => c.name);
        
        if (table === 'users') {
          if (!columnNames.includes('is_active')) {
            console.log("Adding is_active column to users table");
            db.exec("ALTER TABLE users ADD COLUMN is_active INTEGER DEFAULT 1");
          }
          if (!columnNames.includes('password_updated_at')) {
            console.log("Adding password_updated_at column to users table");
            db.exec("ALTER TABLE users ADD COLUMN password_updated_at TEXT DEFAULT '2026-01-01 00:00:00'");
            db.exec("UPDATE users SET password_updated_at = CURRENT_TIMESTAMP WHERE password_updated_at = '2026-01-01 00:00:00'");
          }
        }
        
        if (table === 'projects') {
          if (!columnNames.includes('code')) {
            db.exec("ALTER TABLE projects ADD COLUMN code TEXT UNIQUE");
          }
          if (!columnNames.includes('start_date')) {
            db.exec("ALTER TABLE projects ADD COLUMN start_date TEXT");
          }
          if (!columnNames.includes('end_date')) {
            db.exec("ALTER TABLE projects ADD COLUMN end_date TEXT");
          }
        }

        if (table === 'journals') {
          if (!columnNames.includes('type')) {
            db.exec("ALTER TABLE journals ADD COLUMN type TEXT DEFAULT 'GENERAL'");
          }
          if (!columnNames.includes('treasury_account_id')) {
            db.exec("ALTER TABLE journals ADD COLUMN treasury_account_id INTEGER REFERENCES accounts(id)");
          }
        }

        if (table === 'transactions') {
          if (!columnNames.includes('budget_line_id')) {
            db.exec("ALTER TABLE transactions ADD COLUMN budget_line_id INTEGER REFERENCES budget_lines(id)");
          }
          if (!columnNames.includes('letter')) {
            db.exec("ALTER TABLE transactions ADD COLUMN letter TEXT");
          }
          if (!columnNames.includes('tier_id')) {
            db.exec("ALTER TABLE transactions ADD COLUMN tier_id INTEGER REFERENCES tiers(id)");
          }
        }

        if (table === 'budget_lines') {
          if (!columnNames.includes('year')) {
            db.exec("ALTER TABLE budget_lines ADD COLUMN year INTEGER DEFAULT 2026");
          }
        }
      } catch (e) {
        console.error(`Migration failed for table ${table}:`, e);
      }
    });
  };

  migrate();

  // Verify users table schema
  const verifySchema = () => {
    const columns = db.prepare("PRAGMA table_info(users)").all() as any[];
    const columnNames = columns.map(c => c.name);
    console.log("Users table columns:", columnNames);
    if (!columnNames.includes('password_updated_at')) {
      console.error("CRITICAL: password_updated_at column missing after migration!");
      try {
        db.exec("ALTER TABLE users ADD COLUMN password_updated_at TEXT DEFAULT '2026-01-01 00:00:00'");
        db.exec("UPDATE users SET password_updated_at = CURRENT_TIMESTAMP WHERE password_updated_at = '2026-01-01 00:00:00'");
        console.log("Successfully added password_updated_at in emergency fallback");
      } catch (e) {
        console.error("Emergency fallback failed:", e);
      }
    }
  };
  verifySchema();

  // Seed initial data if empty
  const userCount = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    db.prepare("INSERT INTO users (username, password, role, is_active, password_updated_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)").run("admin", "admin", "ADMIN");
    db.prepare("INSERT INTO users (username, password, role, is_active, password_updated_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)").run("cedniho91@gmail.com", "admin123", "ADMIN");
    
    const journals = [
      { code: "GEN", name: "Journal Général" },
      { code: "CAI", name: "Journal de Caisse" },
      { code: "BNQ", name: "Journal de Banque" },
      { code: "ACH", name: "Journal d'Achats" },
    ];
    const insertJournal = db.prepare("INSERT INTO journals (code, name) VALUES (?, ?)");
    journals.forEach(j => insertJournal.run(j.code, j.name));

    const accounts = [
      { code: "101", name: "Capital", class: 1 },
      { code: "211", name: "Terrains", class: 2 },
      { code: "401", name: "Fournisseurs", class: 4 },
      { code: "411", name: "Clients", class: 4 },
      { code: "521", name: "Banques", class: 5 },
      { code: "571", name: "Caisse", class: 5 },
      { code: "601", name: "Achats de marchandises", class: 6 },
      { code: "701", name: "Ventes de marchandises", class: 7 },
      { code: "901", name: "Comptabilité Analytique", class: 9 },
    ];
    const insertAccount = db.prepare("INSERT INTO accounts (code, name, class) VALUES (?, ?, ?)");
    accounts.forEach(acc => insertAccount.run(acc.code, acc.name, acc.class));

    db.prepare("INSERT INTO projects (code, name, description) VALUES (?, ?, ?)").run("P001", "Projet Alpha", "Premier projet de test");
    db.prepare("INSERT INTO budget_lines (project_id, code, name, allocated_amount) VALUES (?, ?, ?, ?)").run(1, "B01", "Frais de personnel", 5000000);
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", database: "sqlite" });
  });

  // API Routes
  // Authentication
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password) as any;
    
    if (!user) {
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: "Compte désactivé. Contactez l'administrateur." });
    }

    // Check password validity (6 months)
    const passwordDate = new Date(user.password_updated_at);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const passwordExpired = passwordDate < sixMonthsAgo;

    res.json({ 
      id: user.id, 
      username: user.username, 
      role: user.role,
      passwordExpired 
    });
  });

  app.post("/api/users/change-password", (req, res) => {
    const { userId, newPassword } = req.body;
    try {
      db.prepare("UPDATE users SET password = ?, password_updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(newPassword, userId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/projects", (req, res) => {
    const projects = db.prepare("SELECT * FROM projects").all();
    res.json(projects);
  });

  app.post("/api/projects", (req, res) => {
    const { code, name, description } = req.body;
    try {
      const result = db.prepare("INSERT INTO projects (code, name, description) VALUES (?, ?, ?)").run(code, name, description);
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    const { code, name, description, start_date, end_date } = req.body;
    try {
      db.prepare("UPDATE projects SET code = ?, name = ?, description = ?, start_date = ?, end_date = ? WHERE id = ?")
        .run(code, name, description, start_date, end_date, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/projects/:id", (req, res) => {
    const { id } = req.params;
    try {
      // Check for journal entries
      const entries = db.prepare("SELECT count(*) as count FROM journal_entries WHERE project_id = ?").get(id) as { count: number };
      if (entries.count > 0) {
        return res.status(400).json({ error: "Impossible de supprimer ce projet car il contient des écritures." });
      }
      db.prepare("DELETE FROM projects WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/journals", (req, res) => {
    const journals = db.prepare("SELECT * FROM journals").all();
    res.json(journals);
  });

  app.post("/api/journals", (req, res) => {
    const { code, name, type, treasury_account_id } = req.body;
    try {
      const result = db.prepare("INSERT INTO journals (code, name, type, treasury_account_id) VALUES (?, ?, ?, ?)").run(code, name, type || 'GENERAL', treasury_account_id || null);
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/journals/:id", (req, res) => {
    const { id } = req.params;
    const { code, name, type, treasury_account_id } = req.body;
    try {
      db.prepare("UPDATE journals SET code = ?, name = ?, type = ?, treasury_account_id = ? WHERE id = ?")
        .run(code, name, type || 'GENERAL', treasury_account_id || null, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/journals/:id", (req, res) => {
    const { id } = req.params;
    try {
      const entries = db.prepare("SELECT count(*) as count FROM journal_entries WHERE journal_id = ?").get(id) as { count: number };
      if (entries.count > 0) {
        return res.status(400).json({ error: "Impossible de supprimer ce journal car il contient des écritures." });
      }
      db.prepare("DELETE FROM journals WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/budget-lines/:projectId", (req, res) => {
    const { projectId } = req.params;
    const { year } = req.query;
    let query = "SELECT * FROM budget_lines WHERE project_id = ?";
    const params: any[] = [projectId];
    if (year) {
      query += " AND year = ?";
      params.push(year);
    }
    const lines = db.prepare(query).all(...params);
    res.json(lines);
  });

  app.post("/api/budget-lines", (req, res) => {
    const { project_id, code, name, allocated_amount, year } = req.body;
    try {
      const result = db.prepare("INSERT INTO budget_lines (project_id, code, name, allocated_amount, year) VALUES (?, ?, ?, ?, ?)")
        .run(project_id, code, name, allocated_amount, year || new Date().getFullYear());
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/budget-lines/:id", (req, res) => {
    const { id } = req.params;
    const { allocated_amount } = req.body;
    try {
      db.prepare("UPDATE budget_lines SET allocated_amount = ? WHERE id = ?").run(allocated_amount, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/budget-lines/:id", (req, res) => {
    const { id } = req.params;
    try {
      const transactions = db.prepare("SELECT count(*) as count FROM transactions WHERE budget_line_id = ?").get(id) as { count: number };
      if (transactions.count > 0) {
        return res.status(400).json({ error: "Impossible de supprimer cette ligne budgétaire car elle est utilisée dans des écritures." });
      }
      db.prepare("DELETE FROM budget_lines WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/accounts", (req, res) => {
    const accounts = db.prepare("SELECT * FROM accounts ORDER BY code").all();
    res.json(accounts);
  });

  app.post("/api/accounts", (req, res) => {
    const { code, name, class: accClass } = req.body;
    try {
      const result = db.prepare("INSERT INTO accounts (code, name, class) VALUES (?, ?, ?)").run(code, name, accClass);
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/accounts/:id", (req, res) => {
    const { id } = req.params;
    const { code, name, class: accClass } = req.body;
    try {
      db.prepare("UPDATE accounts SET code = ?, name = ?, class = ? WHERE id = ?").run(code, name, accClass, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/accounts/:id", (req, res) => {
    const { id } = req.params;
    try {
      // Check if account is "mouvementé" (has transactions)
      const transactionCount = db.prepare("SELECT count(*) as count FROM transactions WHERE account_id = ?").get(id) as { count: number };
      
      if (transactionCount.count > 0) {
        return res.status(400).json({ error: "Impossible de supprimer ce compte car il contient des écritures (mouvementé)." });
      }

      db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/tiers", (req, res) => {
    const tiers = db.prepare("SELECT t.*, a.code as account_code FROM tiers t LEFT JOIN accounts a ON t.account_id = a.id ORDER BY t.code").all();
    res.json(tiers);
  });

  app.post("/api/tiers", (req, res) => {
    const { code, name, type, account_id } = req.body;
    try {
      const result = db.prepare("INSERT INTO tiers (code, name, type, account_id) VALUES (?, ?, ?, ?)").run(code, name, type || 'OTHER', account_id || null);
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/tiers/:id", (req, res) => {
    const { id } = req.params;
    const { code, name, type, account_id } = req.body;
    try {
      db.prepare("UPDATE tiers SET code = ?, name = ?, type = ?, account_id = ? WHERE id = ?").run(code, name, type || 'OTHER', account_id || null, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/tiers/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM tiers WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/accounts/balance/:accountId", (req, res) => {
    const { accountId } = req.params;
    const { projectId } = req.query;
    try {
      let query = `
        SELECT (SUM(t.debit) - SUM(t.credit)) as balance
        FROM transactions t
        JOIN journal_entries je ON t.entry_id = je.id
        WHERE t.account_id = ?
      `;
      const params: any[] = [accountId];
      if (projectId) {
        query += " AND je.project_id = ?";
        params.push(projectId);
      }
      const result = db.prepare(query).get(...params) as { balance: number };
      res.json({ balance: result?.balance || 0 });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/budget-status/:projectId", (req, res) => {
    const { projectId } = req.params;
    const { year } = req.query;
    let query = `
      SELECT bl.*, 
             (SELECT SUM(t.debit) 
              FROM transactions t 
              JOIN journal_entries je ON t.entry_id = je.id 
              WHERE (je.project_id = ? OR ? = 'all') AND t.budget_line_id = bl.id
             ) as spent
      FROM budget_lines bl 
      WHERE (bl.project_id = ? OR ? = 'all')
    `;
    const params: any[] = [projectId, projectId, projectId, projectId];
    if (year) {
      query += " AND bl.year = ?";
      params.push(year);
    }
    const budgetLines = db.prepare(query).all(...params);
    res.json(budgetLines);
  });

  app.post("/api/journal-entries", (req, res) => {
    const { date, description, project_id, journal_id, transactions } = req.body;
    
    // Check if period is closed
    const month = date.slice(0, 7);
    const year = date.slice(0, 4);
    
    const closedMonth = db.prepare("SELECT id FROM closed_periods WHERE project_id = ? AND type = 'MONTH' AND period = ?").get(project_id, month);
    const closedYear = db.prepare("SELECT id FROM closed_periods WHERE project_id = ? AND type = 'YEAR' AND period = ?").get(project_id, year);
    
    if (closedMonth || closedYear) {
      return res.status(400).json({ error: "Impossible de saisir une écriture dans une période clôturée." });
    }

    // Validate balance
    const totalDebit = transactions.reduce((sum: number, t: any) => sum + (Number(t.debit) || 0), 0);
    const totalCredit = transactions.reduce((sum: number, t: any) => sum + (Number(t.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: "L'écriture n'est pas équilibrée (Débit != Crédit)" });
    }

    // Generate reference: JRN-YEAR-XXXX
    const journal = db.prepare("SELECT code FROM journals WHERE id = ?").get(journal_id) as { code: string };
    const jCode = journal?.code || "GEN";
    const entryYear = new Date(date).getFullYear();
    const lastEntry = db.prepare("SELECT reference FROM journal_entries WHERE reference LIKE ? ORDER BY id DESC LIMIT 1")
      .get(`${jCode}-${entryYear}-%`) as { reference: string } | undefined;
    
    let nextNum = 1;
    if (lastEntry) {
      const parts = lastEntry.reference.split("-");
      nextNum = parseInt(parts[2]) + 1;
    }
    const reference = `${jCode}-${entryYear}-${nextNum.toString().padStart(4, '0')}`;

    const insertEntry = db.prepare("INSERT INTO journal_entries (date, reference, description, project_id, journal_id) VALUES (?, ?, ?, ?, ?)");
    const insertTransaction = db.prepare("INSERT INTO transactions (entry_id, account_id, budget_line_id, tier_id, debit, credit) VALUES (?, ?, ?, ?, ?, ?)");

    const transaction = db.transaction(() => {
      const entryResult = insertEntry.run(date, reference, description, project_id, journal_id);
      const entryId = entryResult.lastInsertRowid;
      for (const t of transactions) {
        insertTransaction.run(entryId, t.account_id, t.budget_line_id || null, t.tier_id || null, t.debit, t.credit);
      }
      return entryId;
    });

    try {
      const entryId = transaction();
      res.json({ id: entryId, reference });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Lettering API
  app.get("/api/lettering/:projectId", (req, res) => {
    const { projectId } = req.params;
    const { accountId } = req.query;
    try {
      const query = `
        SELECT 
          t.id as transaction_id,
          je.date,
          je.reference,
          je.description,
          t.debit,
          t.credit,
          t.letter,
          a.code as account_code,
          a.name as account_name
        FROM transactions t
        JOIN journal_entries je ON t.entry_id = je.id
        JOIN accounts a ON t.account_id = a.id
        WHERE (je.project_id = ? OR ? = 'all') AND a.id = ?
        ORDER BY je.date, je.id
      `;
      const data = db.prepare(query).all(projectId, projectId, accountId);
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/lettering/match", (req, res) => {
    const { transactionIds, letter } = req.body;
    try {
      const update = db.prepare("UPDATE transactions SET letter = ? WHERE id = ?");
      const transaction = db.transaction(() => {
        for (const id of transactionIds) {
          update.run(letter, id);
        }
      });
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/lettering/unmatch", (req, res) => {
    const { transactionIds } = req.body;
    try {
      const update = db.prepare("UPDATE transactions SET letter = NULL WHERE id = ?");
      const transaction = db.transaction(() => {
        for (const id of transactionIds) {
          update.run(id);
        }
      });
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.get("/api/reports/balance/:projectId", (req, res) => {
    const { projectId } = req.params;
    const balance = db.prepare(`
      SELECT a.code, a.name, SUM(t.debit) as total_debit, SUM(t.credit) as total_credit
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.account_id
      LEFT JOIN journal_entries je ON t.entry_id = je.id
      WHERE (je.project_id = ? OR ? = 'all') OR je.project_id IS NULL
      GROUP BY a.id
      HAVING total_debit > 0 OR total_credit > 0
    `).all(projectId, projectId);
    res.json(balance);
  });

  app.get("/api/reports/ledger/:projectId", (req, res) => {
    const { projectId } = req.params;
    const { accountId } = req.query;
    
    let query = `
      SELECT 
        a.code as account_code, 
        a.name as account_name,
        je.date, 
        je.reference, 
        je.description, 
        t.debit, 
        t.credit
      FROM transactions t
      JOIN journal_entries je ON t.entry_id = je.id
      JOIN accounts a ON t.account_id = a.id
      WHERE (je.project_id = ? OR ? = 'all')
    `;
    
    const params: any[] = [projectId, projectId];
    
    if (accountId) {
      query += " AND a.id = ?";
      params.push(accountId);
    }
    
    query += " ORDER BY a.code, je.date, je.id";
    
    try {
      const ledger = db.prepare(query).all(...params);
      res.json(ledger);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/projects/closed-periods/:projectId", (req, res) => {
    const { projectId } = req.params;
    const periods = db.prepare("SELECT * FROM closed_periods WHERE project_id = ? ORDER BY period DESC").all(projectId);
    res.json(periods);
  });

  app.post("/api/projects/close", (req, res) => {
    const { project_id, type, period } = req.body;
    const closed_at = new Date().toISOString();
    try {
      db.prepare("INSERT INTO closed_periods (project_id, type, period, closed_at) VALUES (?, ?, ?, ?)").run(project_id, type, period, closed_at);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: "Cette période est déjà clôturée ou une erreur est survenue." });
    }
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, username, role, is_active, password_updated_at FROM users").all();
    res.json(users);
  });

  app.post("/api/users", (req, res) => {
    const { username, password, role } = req.body;
    try {
      const result = db.prepare("INSERT INTO users (username, password, role, is_active, password_updated_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)").run(username, password, role);
      res.json({ id: result.lastInsertRowid });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/users/:id/toggle-active", (req, res) => {
    const { id } = req.params;
    try {
      const user = db.prepare("SELECT is_active FROM users WHERE id = ?").get(id) as { is_active: number };
      db.prepare("UPDATE users SET is_active = ? WHERE id = ?").run(user.is_active ? 0 : 1, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/users/:id/reset-password", (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;
    try {
      db.prepare("UPDATE users SET password = ?, password_updated_at = '1970-01-01' WHERE id = ?").run(newPassword, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Backup & Reset
  app.get("/api/backup", (req, res) => {
    try {
      const tables = ['users', 'projects', 'journals', 'donors', 'budget_lines', 'closed_periods', 'accounts', 'tiers', 'journal_entries', 'transactions'];
      const data: any = {};
      tables.forEach(table => {
        data[table] = db.prepare(`SELECT * FROM ${table}`).all();
      });
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/journal-entries", (req, res) => {
    const { journalId, projectId } = req.query;
    let query = `
      SELECT je.*, 
             (SELECT SUM(debit) FROM transactions WHERE entry_id = je.id) as total_amount
      FROM journal_entries je 
      WHERE 1=1
    `;
    const params: any[] = [];
    if (journalId) {
      query += " AND je.journal_id = ?";
      params.push(journalId);
    }
    if (projectId && projectId !== 'all') {
      query += " AND je.project_id = ?";
      params.push(projectId);
    }
    query += " ORDER BY je.date DESC, je.id DESC";
    try {
      const entries = db.prepare(query).all(...params);
      res.json(entries);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/journal-entries/:id/transactions", (req, res) => {
    const { id } = req.params;
    const transactions = db.prepare(`
      SELECT t.*, a.code as account_code, a.name as account_name, bl.code as budget_code, tr.code as tier_code, tr.name as tier_name
      FROM transactions t
      JOIN accounts a ON t.account_id = a.id
      LEFT JOIN budget_lines bl ON t.budget_line_id = bl.id
      LEFT JOIN tiers tr ON t.tier_id = tr.id
      WHERE t.entry_id = ?
    `).all(id);
    res.json(transactions);
  });

  app.delete("/api/journal-entries/:id", (req, res) => {
    const { id } = req.params;
    try {
      const entry = db.prepare("SELECT date, project_id FROM journal_entries WHERE id = ?").get(id) as any;
      if (!entry) return res.status(404).json({ error: "Ecriture non trouvée" });

      // Check if period is closed
      const month = entry.date.slice(0, 7);
      const year = entry.date.slice(0, 4);
      const closedMonth = db.prepare("SELECT id FROM closed_periods WHERE project_id = ? AND type = 'MONTH' AND period = ?").get(entry.project_id, month);
      const closedYear = db.prepare("SELECT id FROM closed_periods WHERE project_id = ? AND type = 'YEAR' AND period = ?").get(entry.project_id, year);
      
      if (closedMonth || closedYear) {
        return res.status(400).json({ error: "Impossible de supprimer une écriture dans une période clôturée." });
      }

      const transaction = db.transaction(() => {
        db.prepare("DELETE FROM transactions WHERE entry_id = ?").run(id);
        db.prepare("DELETE FROM journal_entries WHERE id = ?").run(id);
      });
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/journal-entries/:id", (req, res) => {
    const { id } = req.params;
    const { date, description, transactions } = req.body;

    try {
      const entry = db.prepare("SELECT date, project_id FROM journal_entries WHERE id = ?").get(id) as any;
      if (!entry) return res.status(404).json({ error: "Ecriture non trouvée" });

      // Check if period is closed
      const month = date.slice(0, 7);
      const year = date.slice(0, 4);
      const closedMonth = db.prepare("SELECT id FROM closed_periods WHERE project_id = ? AND type = 'MONTH' AND period = ?").get(entry.project_id, month);
      const closedYear = db.prepare("SELECT id FROM closed_periods WHERE project_id = ? AND type = 'YEAR' AND period = ?").get(entry.project_id, year);
      
      if (closedMonth || closedYear) {
        return res.status(400).json({ error: "Impossible de modifier une écriture dans une période clôturée." });
      }

      // Validate balance
      const totalDebit = transactions.reduce((sum: number, t: any) => sum + (Number(t.debit) || 0), 0);
      const totalCredit = transactions.reduce((sum: number, t: any) => sum + (Number(t.credit) || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({ error: "L'écriture n'est pas équilibrée (Débit != Crédit)" });
      }

      const transaction = db.transaction(() => {
        db.prepare("UPDATE journal_entries SET date = ?, description = ? WHERE id = ?").run(date, description, id);
        db.prepare("DELETE FROM transactions WHERE entry_id = ?").run(id);
        const insertTransaction = db.prepare("INSERT INTO transactions (entry_id, account_id, budget_line_id, tier_id, debit, credit) VALUES (?, ?, ?, ?, ?, ?)");
        for (const t of transactions) {
          insertTransaction.run(id, t.account_id, t.budget_line_id || null, t.tier_id || null, t.debit, t.credit);
        }
      });
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/restore", (req, res) => {
    const data = req.body;
    try {
      const tables = ['transactions', 'journal_entries', 'tiers', 'budget_lines', 'closed_periods', 'donors', 'journals', 'projects', 'accounts', 'users'];
      const transaction = db.transaction(() => {
        tables.forEach(table => {
          db.prepare(`DELETE FROM ${table}`).run();
        });
        
        Object.keys(data).forEach(table => {
          if (data[table] && data[table].length > 0) {
            const columns = Object.keys(data[table][0]);
            const placeholders = columns.map(() => '?').join(',');
            const insert = db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`);
            data[table].forEach((row: any) => {
              const values = columns.map(col => row[col]);
              insert.run(...values);
            });
          }
        });
      });
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
  app.post("/api/reset", (req, res) => {
    try {
      const tables = ['transactions', 'journal_entries', 'tiers', 'budget_lines', 'closed_periods', 'donors', 'journals', 'projects', 'accounts', 'users'];
      const transaction = db.transaction(() => {
        tables.forEach(table => {
          db.prepare(`DELETE FROM ${table}`).run();
        });
        // Re-seed admin
        db.prepare("INSERT INTO users (username, password, role, is_active, password_updated_at) VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)").run("admin", "admin", "ADMIN");
      });
      transaction();
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Subsidiary Reports (Tiers)
  app.get("/api/reports/subsidiary-balance/:projectId", (req, res) => {
    const { projectId } = req.params;
    const { tierType } = req.query; // Optional: 'SUPPLIER', 'CUSTOMER', etc.
    
    let query = `
      SELECT 
        tr.tier_id,
        t.code as tier_code, 
        t.name as tier_name, 
        t.type as tier_type,
        SUM(tr.debit) as total_debit, 
        SUM(tr.credit) as total_credit
      FROM transactions tr
      JOIN tiers t ON tr.tier_id = t.id
      JOIN journal_entries je ON tr.entry_id = je.id
      WHERE (je.project_id = ? OR ? = 'all')
    `;
    
    const params: any[] = [projectId, projectId];
    
    if (tierType) {
      query += " AND t.type = ?";
      params.push(tierType);
    }
    
    query += " GROUP BY t.id HAVING total_debit > 0 OR total_credit > 0";
    
    try {
      const balance = db.prepare(query).all(...params);
      res.json(balance);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/reports/subsidiary-ledger/:projectId", (req, res) => {
    const { projectId } = req.params;
    const { tierId } = req.query;
    
    let query = `
      SELECT 
        t.code as tier_code, 
        t.name as tier_name,
        je.date, 
        je.reference, 
        je.description, 
        tr.debit, 
        tr.credit
      FROM transactions tr
      JOIN journal_entries je ON tr.entry_id = je.id
      JOIN tiers t ON tr.tier_id = t.id
      WHERE (je.project_id = ? OR ? = 'all')
    `;
    
    const params: any[] = [projectId, projectId];
    
    if (tierId) {
      query += " AND t.id = ?";
      params.push(tierId);
    }
    
    query += " ORDER BY t.code, je.date, je.id";
    
    try {
      const ledger = db.prepare(query).all(...params);
      res.json(ledger);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  // Error handling
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

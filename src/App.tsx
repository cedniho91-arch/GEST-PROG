/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  LayoutDashboard, 
  BookOpen, 
  PieChart, 
  Settings, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Search,
  ChevronRight,
  Wallet,
  Building2,
  Users,
  UserPlus,
  User as UserIcon,
  ArrowRightLeft,
  Lock,
  Calendar,
  BookMarked,
  Share2,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabaseService } from './services/supabaseService';

type Project = {
  id: number;
  code: string;
  name: string;
  description: string;
  start_date?: string;
  end_date?: string;
};

type Account = {
  id: number;
  code: string;
  name: string;
  class: number;
};

type BudgetLine = {
  id: number;
  code: string;
  name: string;
  allocated_amount: number;
  spent: number;
};

type Journal = {
  id: number;
  code: string;
  name: string;
  type: 'GENERAL' | 'TREASURY' | 'ACHAT';
  treasury_account_id?: number;
};

type ClosedPeriod = {
  id: number;
  type: 'MONTH' | 'YEAR';
  period: string;
  closed_at: string;
};

type Tier = {
  id: number;
  code: string;
  name: string;
  type: 'SUPPLIER' | 'CUSTOMER' | 'EMPLOYEE' | 'OTHER';
  account_id?: number;
  account_code?: string;
};

type Transaction = {
  account_id: number;
  budget_line_id?: number;
  tier_id?: number;
  debit: number;
  credit: number;
};

type User = {
  id: number;
  username: string;
  role: 'ADMIN' | 'COMPTABLE' | 'FINANCIAL_OFFICER';
  is_active: boolean;
  password_updated_at: string;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'accounts' | 'reports' | 'config' | 'budget' | 'cloture' | 'users' | 'referentiels' | 'lettering'>('dashboard');
  const [journalView, setJournalView] = useState<'entry' | 'consultation'>('entry');
  const [consultationEntries, setConsultationEntries] = useState<any[]>([]);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editingTier, setEditingTier] = useState<Tier | null>(null);
  const [editingJournal, setEditingJournal] = useState<Journal | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingBudgetLine, setEditingBudgetLine] = useState<BudgetLine | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [reportView, setReportView] = useState<'menu' | 'balance' | 'ledger' | 'budget' | 'subsidiary_balance' | 'subsidiary_ledger'>('menu');
  const [referentielView, setReferentielView] = useState<'tiers' | 'journals' | 'accounts' | 'budget' | 'projects'>('tiers');
  
  // Lettering State
  const [letteringData, setLetteringData] = useState<any[]>([]);
  const [letteringAccountId, setLetteringAccountId] = useState<number>(0);
  const [selectedLetteringTransactions, setSelectedLetteringTransactions] = useState<number[]>([]);
  const [letteringSearch, setLetteringSearch] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<ClosedPeriod[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [budgetStatus, setBudgetStatus] = useState<BudgetLine[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [treasuryBalance, setTreasuryBalance] = useState<number | null>(null);
  
  // Report Data State
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [ledgerAccountId, setLedgerAccountId] = useState<number>(0);
  const [subsidiaryBalanceData, setSubsidiaryBalanceData] = useState<any[]>([]);
  const [subsidiaryLedgerData, setSubsidiaryLedgerData] = useState<any[]>([]);
  const [subsidiaryTierId, setSubsidiaryTierId] = useState<number>(0);
  const [reportProjectId, setReportProjectId] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [tierSearch, setTierSearch] = useState('');
  
  // Journal Entry State
  const [journalStep, setJournalStep] = useState<'setup' | 'entry'>('setup');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryMonth, setEntryMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [entryDesc, setEntryDesc] = useState('');
  const [entryJournalId, setEntryJournalId] = useState<number>(0);
  const [entryProjectId, setEntryProjectId] = useState<number>(0);
  const [entryTransactions, setEntryTransactions] = useState<Transaction[]>([
    { account_id: 0, debit: 0, credit: 0, tier_id: 0 },
    { account_id: 0, debit: 0, credit: 0, tier_id: 0 }
  ]);

  // Clôture State
  const [closeMonth, setCloseMonth] = useState(new Date().toISOString().slice(0, 7));
  const [closeYear, setCloseYear] = useState(new Date().getFullYear().toString());

  // Config Forms State
  const [newProject, setNewProject] = useState({ code: '', name: '', description: '', start_date: '', end_date: '' });
  const [newAccount, setNewAccount] = useState({ code: '', name: '', class: 1 });
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [newJournal, setNewJournal] = useState({ code: '', name: '', type: 'GENERAL', treasury_account_id: 0 });
  const [newTier, setNewTier] = useState({ code: '', name: '', type: 'OTHER', account_id: 0 });
  const [newBudgetLine, setNewBudgetLine] = useState({ project_id: 0, code: '', name: '', allocated_amount: 0, year: new Date().getFullYear() });
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'COMPTABLE' });

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
      const data = await supabaseService.login(username, password);
      if (data.error) {
        setLoginError(data.error);
      } else {
        if (data.passwordExpired) {
          setPasswordExpired(true);
          setCurrentUser(data);
        } else {
          setCurrentUser(data);
          setLoginError(null);
        }
      }
    } catch (e) {
      setLoginError("Erreur de connexion à Supabase");
    }
  };

  const handleChangePassword = async () => {
    if (!currentUser || !newPassword) return;
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, newPassword })
      });
      if (res.ok) {
        setPasswordExpired(false);
        setMessage({ type: 'success', text: 'Mot de passe mis à jour' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur lors du changement de mot de passe' });
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('Restaurer ces données écrasera TOUTES les données actuelles. Continuer ?')) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        const res = await fetch('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (res.ok) {
          alert('Données restaurées avec succès. Le logiciel va redémarrer.');
          window.location.reload();
        } else {
          const err = await res.json();
          alert('Erreur: ' + err.error);
        }
      } catch (e) {
        alert('Fichier invalide');
      }
    };
    reader.readAsText(file);
  };

  const fetchConsultationEntries = async () => {
    if (!entryJournalId) return;
    try {
      const data = await supabaseService.getJournalEntries(entryJournalId, entryProjectId || 'all');
      setConsultationEntries(data);
    } catch (e) {
      console.error("Failed to fetch entries", e);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('Supprimer cette écriture ?')) return;
    try {
      const res = await fetch(`/api/journal-entries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Écriture supprimée' });
        fetchConsultationEntries();
      } else {
        const d = await res.json();
        setMessage({ type: 'error', text: d.error });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur réseau' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEditEntry = async (entry: any) => {
    try {
      const res = await fetch(`/api/journal-entries/${entry.id}/transactions`);
      const transactions = await res.json();
      setEditingEntry(entry);
      setEntryDate(entry.date);
      setEntryDesc(entry.description);
      setEntryTransactions(transactions);
      setJournalView('entry');
    } catch (e) {
      console.error("Failed to fetch transactions", e);
    }
  };

  const handleToggleUserActive = async (id: number) => {
    try {
      const res = await fetch(`/api/users/${id}/toggle-active`, { method: 'PATCH' });
      if (res.ok) fetchUsers();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetUserPassword = async (id: number) => {
    const pwd = prompt('Nouveau mot de passe temporaire:');
    if (!pwd) return;
    try {
      const res = await fetch(`/api/users/${id}/reset-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pwd })
      });
      if (res.ok) alert('Mot de passe réinitialisé. L\'utilisateur devra le changer à la prochaine connexion.');
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchAccounts();
    fetchJournals();
    fetchTiers();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      fetchBudgetStatus(selectedProject.id, selectedYear);
      fetchBudgetLines(selectedProject.id, selectedYear);
      fetchClosedPeriods(selectedProject.id);
    }
  }, [selectedProject, selectedYear]);

  const fetchClosedPeriods = async (projectId: number) => {
    try {
      const res = await fetch(`/api/projects/closed-periods/${projectId}`);
      const data = await res.json();
      setClosedPeriods(data);
    } catch (e) {
      console.error("Failed to fetch closed periods", e);
    }
  };

  const handleClosePeriod = async (type: 'MONTH' | 'YEAR', period: string) => {
    if (!selectedProject) return;
    if (!confirm(`Voulez-vous vraiment clôturer cette période (${period}) ? Cette action est irréversible.`)) return;
    
    const res = await fetch('/api/projects/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: selectedProject.id, type, period })
    });
    
    if (res.ok) {
      setMessage({ type: 'success', text: 'Période clôturée avec succès' });
      fetchClosedPeriods(selectedProject.id);
    } else {
      const d = await res.json();
      setMessage({ type: 'error', text: d.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const fetchBudgetLines = async (projectId: number, year?: number) => {
    try {
      const res = await fetch(`/api/budget-lines/${projectId}${year ? `?year=${year}` : ''}`);
      const data = await res.json();
      setBudgetLines(data);
    } catch (e) {
      console.error("Failed to fetch budget lines", e);
    }
  };

  const fetchProjects = async () => {
    try {
      const data = await supabaseService.getProjects();
      setProjects(data);
      if (data.length > 0 && !selectedProject) setSelectedProject(data[0]);
    } catch (e) {
      console.error("Failed to fetch projects", e);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        console.error("Received non-array users data:", data);
        setUsers([]);
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
      setUsers([]);
    }
  };

  const fetchAccounts = async () => {
    try {
      const data = await supabaseService.getAccounts();
      setAccounts(data);
    } catch (e) {
      console.error("Failed to fetch accounts", e);
    }
  };

  const fetchJournals = async () => {
    try {
      const data = await supabaseService.getJournals();
      setJournals(data);
      if (data.length > 0) setEntryJournalId(data[0].id);
    } catch (e) {
      console.error("Failed to fetch journals", e);
    }
  };

  const fetchTiers = async () => {
    try {
      const data = await supabaseService.getTiers();
      setTiers(data);
    } catch (e) {
      console.error("Failed to fetch tiers", e);
    }
  };

  const fetchLetteringData = async (accountId: number) => {
    const pid = selectedProject?.id;
    if (!pid || !accountId) return;
    try {
      const res = await fetch(`/api/lettering/${pid}?accountId=${accountId}`);
      const data = await res.json();
      setLetteringData(data);
    } catch (e) {
      console.error("Failed to fetch lettering data", e);
    }
  };

  const handleMatch = async () => {
    if (selectedLetteringTransactions.length < 2) return;
    const letter = prompt("Entrez une lettre de lettrage (ex: A, B, AA):");
    if (!letter) return;

    try {
      const res = await fetch('/api/lettering/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: selectedLetteringTransactions, letter: letter.toUpperCase() })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Lettrage effectué' });
        setSelectedLetteringTransactions([]);
        fetchLetteringData(letteringAccountId);
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur lors du lettrage' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUnmatch = async (transactionId: number) => {
    try {
      const res = await fetch('/api/lettering/unmatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionIds: [transactionId] })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Lettrage annulé' });
        fetchLetteringData(letteringAccountId);
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur lors de l\'annulation' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateTier = async () => {
    if (!newTier.code || !newTier.name) {
      setMessage({ type: 'error', text: 'Le code et le nom sont requis.' });
      return;
    }
    try {
      const res = await fetch('/api/tiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTier)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Tiers créé avec succès.' });
        setNewTier({ code: '', name: '', type: 'OTHER', account_id: 0 });
        fetchTiers();
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Erreur lors de la création.' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur réseau.' });
    }
  };

  const handleDeleteTier = async (id: number) => {
    if (!confirm('Supprimer ce tiers ?')) return;
    try {
      const res = await fetch(`/api/tiers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Tiers supprimé.' });
        fetchTiers();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur réseau.' });
    }
  };

  const fetchBudgetStatus = async (projectId: number | 'all', year?: number) => {
    try {
      const data = await supabaseService.getBudgetStatus(projectId, year);
      setBudgetStatus(data);
    } catch (e) {
      console.error("Failed to fetch budget status", e);
    }
  };

  const fetchTreasuryBalance = async (accountId: number, projectId?: number) => {
    try {
      const res = await fetch(`/api/accounts/balance/${accountId}${projectId ? `?projectId=${projectId}` : ''}`);
      const data = await res.json();
      setTreasuryBalance(data.balance);
    } catch (e) {
      console.error("Failed to fetch treasury balance", e);
    }
  };

  const fetchBalance = async () => {
    const pid = reportProjectId === 'all' ? 'all' : selectedProject?.id;
    if (!pid) return;
    try {
      const res = await fetch(`/api/reports/balance/${pid}`);
      const data = await res.json();
      setBalanceData(data);
      setReportView('balance');
    } catch (e) {
      console.error("Failed to fetch balance", e);
    }
  };

  const fetchLedger = async (accountId?: number) => {
    const pid = reportProjectId === 'all' ? 'all' : selectedProject?.id;
    if (!pid) return;
    try {
      const url = `/api/reports/ledger/${pid}${accountId ? `?accountId=${accountId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      setLedgerData(data);
      setReportView('ledger');
    } catch (e) {
      console.error("Failed to fetch ledger", e);
    }
  };

  const fetchSubsidiaryBalance = async () => {
    const pid = reportProjectId === 'all' ? 'all' : selectedProject?.id;
    if (!pid) return;
    try {
      const response = await fetch(`/api/reports/subsidiary-balance/${pid}`);
      const data = await response.json();
      setSubsidiaryBalanceData(data);
    } catch (error) {
      console.error('Error fetching subsidiary balance:', error);
    }
  };

  const fetchSubsidiaryLedger = async (tierId?: number) => {
    const pid = reportProjectId === 'all' ? 'all' : selectedProject?.id;
    if (!pid) return;
    try {
      const url = `/api/reports/subsidiary-ledger/${pid}${tierId ? `?tierId=${tierId}` : ''}`;
      const response = await fetch(url);
      const data = await response.json();
      setSubsidiaryLedgerData(data);
    } catch (error) {
      console.error('Error fetching subsidiary ledger:', error);
    }
  };

  const handleBackup = async () => {
    try {
      const response = await fetch('/api/backup');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `accounting_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Backup failed:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleReset = async () => {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser TOUTES les données ? Cette action est irréversible.')) return;
    try {
      const response = await fetch('/api/reset', { method: 'POST' });
      if (response.ok) {
        alert('Logiciel réinitialisé avec succès. Vous allez être déconnecté.');
        window.location.reload();
      }
    } catch (error) {
      console.error('Reset failed:', error);
      alert('Erreur lors de la réinitialisation');
    }
  };

  const exportToExcel = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };

  const exportToPDF = (data: any[], title: string, columns: string[], keys: string[]) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129); // Emerald-600
    doc.text("SYSCOHADA Pro", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(26, 26, 26);
    doc.text(title, 14, 30);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Projet: ${selectedProject?.name || 'Tous'}`, 14, 38);
    doc.text(`Date d'export: ${new Date().toLocaleString()}`, 14, 44);
    
    const tableData = data.map(row => keys.map(key => {
      const val = row[key];
      if (typeof val === 'number') return val.toLocaleString();
      return val || '-';
    }));

    autoTable(doc, {
      head: [columns],
      body: tableData,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 242, 237] },
      margin: { top: 50 },
      didDrawPage: (data: any) => {
        const str = "Page " + (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
      }
    });
    
    doc.save(`${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  useEffect(() => {
    const journal = journals.find(j => j.id === entryJournalId);
    if (journal && journal.type === 'TREASURY' && journal.treasury_account_id) {
      fetchTreasuryBalance(journal.treasury_account_id, entryProjectId || undefined);
    } else {
      setTreasuryBalance(null);
    }
  }, [entryJournalId, entryProjectId, journals]);

  const handleUpdateTier = async () => {
    if (!editingTier) return;
    try {
      const res = await fetch(`/api/tiers/${editingTier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTier)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Tiers mis à jour' });
        setEditingTier(null);
        fetchTiers();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdateJournal = async () => {
    if (!editingJournal) return;
    try {
      const res = await fetch(`/api/journals/${editingJournal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingJournal)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Journal mis à jour' });
        setEditingJournal(null);
        fetchJournals();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdateAccount = async () => {
    if (!editingAccount) return;
    if (editingAccount.code.length !== 6) {
      setMessage({ type: 'error', text: 'Le code compte doit comporter exactement 6 chiffres.' });
      return;
    }
    try {
      const res = await fetch(`/api/accounts/${editingAccount.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingAccount)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Compte mis à jour' });
        setEditingAccount(null);
        fetchAccounts();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdateProject = async () => {
    if (!editingProject) return;
    try {
      const res = await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProject)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Projet mis à jour' });
        setEditingProject(null);
        fetchProjects();
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdateBudgetLine = async () => {
    if (!editingBudgetLine) return;
    try {
      const res = await fetch(`/api/budget-lines/${editingBudgetLine.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocated_amount: editingBudgetLine.allocated_amount })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Ligne budgétaire mise à jour' });
        setEditingBudgetLine(null);
        if (selectedProject) {
          fetchBudgetLines(selectedProject.id, selectedYear);
          fetchBudgetStatus(selectedProject.id, selectedYear);
        }
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Erreur lors de la mise à jour' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateProject = async () => {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProject)
    });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Projet créé avec succès' });
      setNewProject({ code: '', name: '', description: '' });
      fetchProjects();
    } else {
      const d = await res.json();
      setMessage({ type: 'error', text: d.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Projet supprimé' });
      fetchProjects();
    } else {
      const d = await res.json();
      setMessage({ type: 'error', text: d.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateAccount = async () => {
    if (newAccount.code.length !== 6) {
      setMessage({ type: 'error', text: 'Le code compte doit comporter exactement 6 chiffres.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAccount)
    });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Compte créé avec succès' });
      setNewAccount({ code: '', name: '', class: 1 });
      fetchAccounts();
    } else {
      const d = await res.json();
      setMessage({ type: 'error', text: d.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateJournal = async () => {
    const res = await fetch('/api/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newJournal,
        treasury_account_id: newJournal.type === 'TREASURY' ? newJournal.treasury_account_id : null
      })
    });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Journal créé avec succès' });
      setNewJournal({ code: '', name: '', type: 'GENERAL', treasury_account_id: 0 });
      fetchJournals();
    } else {
      const d = await res.json();
      setMessage({ type: 'error', text: d.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateBudgetLine = async () => {
    if (!newBudgetLine.project_id) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner un projet' });
      return;
    }
    const res = await fetch('/api/budget-lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBudgetLine)
    });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Ligne budgétaire créée' });
      setNewBudgetLine({ project_id: 0, code: '', name: '', allocated_amount: 0, year: selectedYear });
      if (selectedProject && newBudgetLine.project_id === selectedProject.id) {
        fetchBudgetLines(selectedProject.id, selectedYear);
        fetchBudgetStatus(selectedProject.id, selectedYear);
      }
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUpdateBudgetAmount = async (id: number, amount: number) => {
    const res = await fetch(`/api/budget-lines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allocated_amount: amount })
    });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Montant mis à jour' });
      if (selectedProject) {
        fetchBudgetLines(selectedProject.id, selectedYear);
        fetchBudgetStatus(selectedProject.id, selectedYear);
      }
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateUser = async () => {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Utilisateur créé' });
      setNewUser({ username: '', password: '', role: 'COMPTABLE' });
      fetchUsers();
    } else {
      const d = await res.json();
      setMessage({ type: 'error', text: d.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce compte ?")) return;
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Compte supprimé' });
      fetchAccounts();
    } else {
      const d = await res.json();
      setMessage({ type: 'error', text: d.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteJournal = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce journal ?")) return;
    const res = await fetch(`/api/journals/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Journal supprimé' });
      fetchJournals();
    } else {
      const d = await res.json();
      setMessage({ type: 'error', text: d.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteBudgetLine = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette ligne budgétaire ?")) return;
    const res = await fetch(`/api/budget-lines/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Ligne budgétaire supprimée' });
      if (selectedProject) {
        fetchBudgetLines(selectedProject.id, selectedYear);
        fetchBudgetStatus(selectedProject.id, selectedYear);
      }
    } else {
      const d = await res.json();
      setMessage({ type: 'error', text: d.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMessage({ type: 'success', text: 'Utilisateur supprimé' });
      fetchUsers();
    } else {
      const d = await res.json();
      setMessage({ type: 'error', text: d.error });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddTransaction = () => {
    setEntryTransactions([...entryTransactions, { account_id: 0, debit: 0, credit: 0, tier_id: 0 }]);
  };

  const handleRemoveTransaction = (index: number) => {
    setEntryTransactions(entryTransactions.filter((_, i) => i !== index));
  };

  const handleTransactionChange = (index: number, field: keyof Transaction, value: any) => {
    const newTransactions = [...entryTransactions];
    newTransactions[index] = { ...newTransactions[index], [field]: value };
    setEntryTransactions(newTransactions);
  };

  const submitJournalEntry = async () => {
    if (!selectedProject || !entryJournalId) return;
    
    // Validate budget codes for class 6 and 7 and tiers for class 40/41
    for (const t of entryTransactions) {
      const account = accounts.find(a => a.id === t.account_id);
      if (account) {
        if ((account.class === 6 || account.class === 7) && !t.budget_line_id) {
          setMessage({ type: 'error', text: `Le code budget est obligatoire pour le compte ${account.code}` });
          setTimeout(() => setMessage(null), 5000);
          return;
        }
        if ((account.code.startsWith('40') || account.code.startsWith('41')) && !t.tier_id) {
          setMessage({ type: 'error', text: `Le compte tiers est obligatoire pour le compte ${account.code}` });
          setTimeout(() => setMessage(null), 5000);
          return;
        }
      }
    }

    const url = editingEntry ? `/api/journal-entries/${editingEntry.id}` : '/api/journal-entries';
    const method = editingEntry ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: entryDate,
        description: entryDesc,
        project_id: selectedProject.id,
        journal_id: entryJournalId,
        transactions: entryTransactions
      })
    });
    
    const data = await res.json();
    if (res.ok) {
      setMessage({ type: 'success', text: editingEntry ? 'Écriture mise à jour' : `Écriture enregistrée avec succès: ${data.reference}` });
      setEntryDesc('');
      setEntryTransactions([{ account_id: 0, debit: 0, credit: 0, tier_id: 0 }, { account_id: 0, debit: 0, credit: 0, tier_id: 0 }]);
      setJournalStep('setup');
      setEditingEntry(null);
      fetchBudgetStatus(selectedProject.id);
    } else {
      setMessage({ type: 'error', text: data.error });
    }
    setTimeout(() => setMessage(null), 5000);
  };

  const totalDebit = entryTransactions.reduce((sum, t) => sum + (Number(t.debit) || 0), 0);
  const totalCredit = entryTransactions.reduce((sum, t) => sum + (Number(t.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[32px] shadow-2xl border border-black/5 w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto mb-4">
              <Building2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">SYSCOHADA Pro</h1>
            <p className="text-gray-500 text-sm">Gestion Budgétaire et Comptable</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Utilisateur</label>
              <input 
                name="username"
                type="text" 
                required
                className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="Nom d'utilisateur"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mot de passe</label>
              <input 
                name="password"
                type="password" 
                required
                className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                placeholder="••••••••"
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {loginError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 shadow-xl shadow-emerald-600/20 transition-all"
            >
              Se Connecter
            </button>
          </form>

          <p className="text-center text-[10px] text-gray-400 uppercase tracking-widest">
            &copy; 2026 SYSCOHADA Management System
          </p>
        </motion.div>
      </div>
    );
  }

  if (passwordExpired) {
    return (
      <div className="min-h-screen bg-[#F5F2ED] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-10 rounded-[32px] shadow-2xl border border-black/5 w-full max-w-md space-y-8"
        >
          <div className="text-center space-y-2">
            <Lock className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold tracking-tight">Mot de passe expiré</h1>
            <p className="text-gray-500 text-sm">Pour votre sécurité, vous devez changer votre mot de passe tous les 6 mois.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nouveau mot de passe</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button 
              onClick={handleChangePassword}
              className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition-all"
            >
              Mettre à jour
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F5F2ED] text-[#1A1A1A] font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-[#1A1A1A]/10 flex flex-col">
        <div className="p-6 border-b border-[#1A1A1A]/10">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-600" />
            SYSCOHADA
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-semibold">Project Manager</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            Tableau de Bord
          </button>
          <button 
            onClick={() => setActiveTab('journal')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'journal' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <BookOpen className="w-5 h-5" />
            Journal de Saisie
          </button>
          <button 
            onClick={() => setActiveTab('cloture')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'cloture' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <Lock className="w-5 h-5" />
            Clôture
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'reports' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <ArrowRightLeft className="w-5 h-5" />
            États Financiers
          </button>
          <button 
            onClick={() => setActiveTab('referentiels')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'referentiels' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <BookMarked className="w-5 h-5" />
            Référentiels
          </button>
          <button 
            onClick={() => setActiveTab('lettering')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'lettering' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <ArrowRightLeft className="w-5 h-5" />
            Lettrage Tiers
          </button>
          <button 
            onClick={() => setActiveTab('config')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'config' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <Settings className="w-5 h-5" />
            Configuration
          </button>
          {currentUser.role === 'ADMIN' && (
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'users' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'hover:bg-gray-50 text-gray-600'}`}
            >
              <UserIcon className="w-5 h-5" />
              Utilisateurs
            </button>
          )}
          <div className="pt-2 mt-2 border-t border-gray-100">
            <button 
              onClick={() => {
                const url = window.location.origin;
                navigator.clipboard.writeText(url);
                setMessage({ type: 'success', text: 'Lien de partage copié !' });
                setTimeout(() => setMessage(null), 3000);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-blue-50 text-blue-600 font-medium"
            >
              <Share2 className="w-5 h-5" />
              Partager l'App
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-[#1A1A1A]/10">
          <div className="bg-gray-50 p-3 rounded-xl">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Session</p>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
                {currentUser.username.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold truncate">{currentUser.username}</p>
                <p className="text-[10px] text-gray-500 truncate">{currentUser.role}</p>
              </div>
              <button 
                onClick={() => setCurrentUser(null)}
                className="p-1 text-gray-400 hover:text-red-500"
                title="Déconnexion"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Tableau de Bord</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-gray-500">Suivi de l'exécution budgétaire de</p>
                    <select 
                      className="bg-transparent font-bold text-emerald-600 border-b border-emerald-600/30 focus:outline-none"
                      value={selectedProject?.id || ''}
                      onChange={(e) => setSelectedProject(projects.find(p => p.id === parseInt(e.target.value)) || null)}
                    >
                      <option value="">Sélectionner un projet</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-black/5 flex items-center gap-4">
                    <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Budget Total</p>
                      <p className="text-lg font-bold">
                        {(budgetStatus.reduce((sum, b) => sum + b.allocated_amount, 0) || 0).toLocaleString()} <span className="text-xs text-gray-400">FCFA</span>
                      </p>
                    </div>
                  </div>
                </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <ChevronRight className="w-5 h-5 text-emerald-600" />
                    Lignes Budgétaires
                  </h3>
                  <div className="space-y-6">
                    {budgetStatus.map(line => {
                      const rate = line.allocated_amount > 0 ? (line.spent / line.allocated_amount) * 100 : 0;
                      return (
                        <div key={line.id} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="font-medium">{line.code} - {line.name}</span>
                            <span className="text-gray-500">{rate.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(rate, 100)}%` }}
                              className={`h-full ${rate > 90 ? 'bg-red-500' : rate > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>Dépensé: {line.spent?.toLocaleString() || 0} FCFA</span>
                            <span>Total: {(line.allocated_amount || 0).toLocaleString()} FCFA</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5">
                  <h3 className="text-lg font-bold mb-6">Résumé Financier</h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Taux d'Exécution Global</p>
                      <p className="text-3xl font-bold text-emerald-600">
                        {(() => {
                          const total = budgetStatus.reduce((sum, b) => sum + b.allocated_amount, 0);
                          const spent = budgetStatus.reduce((sum, b) => sum + b.spent, 0);
                          return total > 0 ? ((spent / total) * 100).toFixed(1) : '0.0';
                        })()}%
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Reliquat Disponible</p>
                      <p className="text-xl font-bold">
                        {(() => {
                          const total = budgetStatus.reduce((sum, b) => sum + b.allocated_amount, 0);
                          const spent = budgetStatus.reduce((sum, b) => sum + b.spent, 0);
                          return (total - spent || 0).toLocaleString();
                        })()} <span className="text-xs text-gray-400">FCFA</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'journal' && (
            <motion.div 
              key="journal"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-5xl mx-auto space-y-8"
            >
              <header className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Journal de Saisie</h2>
                  <p className="text-gray-500 mt-1">
                    {journalView === 'entry' ? 'Enregistrement des opérations comptables' : 'Consultation et modification des écritures'}
                  </p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl border border-black/5 shadow-sm">
                  <button 
                    onClick={() => setJournalView('entry')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${journalView === 'entry' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Saisie
                  </button>
                  <button 
                    onClick={() => {
                      setJournalView('consultation');
                      fetchConsultationEntries();
                    }}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${journalView === 'consultation' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Consultation
                  </button>
                </div>
                {journalStep === 'entry' && journalView === 'entry' && (
                  <button 
                    onClick={() => {
                      setJournalStep('setup');
                      setEditingEntry(null);
                    }}
                    className="text-sm font-bold text-gray-400 hover:text-gray-600"
                  >
                    Retour à la sélection
                  </button>
                )}
              </header>

              {journalView === 'entry' ? (
                journalStep === 'setup' ? (
                <div className="bg-white rounded-3xl p-12 shadow-sm border border-black/5 max-w-2xl mx-auto space-y-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Projet Concerné</label>
                      <select 
                        className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5 text-lg font-medium focus:outline-none"
                        value={entryProjectId}
                        onChange={(e) => {
                          const pid = parseInt(e.target.value);
                          setEntryProjectId(pid);
                          const p = projects.find(proj => proj.id === pid);
                          if (p) setSelectedProject(p);
                        }}
                      >
                        <option value={0}>Choisir un projet...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Journal de Saisie</label>
                      <select 
                        className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5 text-lg font-medium focus:outline-none"
                        value={entryJournalId}
                        onChange={(e) => setEntryJournalId(parseInt(e.target.value))}
                      >
                        <option value={0}>Choisir un journal...</option>
                        {journals.map(j => (
                          <option key={j.id} value={j.id}>
                            {j.code} - {j.name} {j.type === 'TREASURY' ? '(Trésorerie)' : ''}
                          </option>
                        ))}
                      </select>
                      {journals.find(j => j.id === entryJournalId)?.type === 'TREASURY' && treasuryBalance !== null && (
                        <div className="mt-2 text-sm font-bold text-emerald-600 flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          Solde actuel : {(treasuryBalance || 0).toLocaleString()} FCFA
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mois Concerné</label>
                      <input 
                        type="month" 
                        value={entryMonth}
                        onChange={(e) => setEntryMonth(e.target.value)}
                        className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5 text-lg font-medium focus:outline-none"
                      />
                    </div>
                  </div>
                  <button 
                    disabled={!entryJournalId || !entryMonth || !entryProjectId}
                    onClick={() => {
                      // Set default date to first of month
                      setEntryDate(`${entryMonth}-01`);
                      setJournalStep('entry');
                    }}
                    className={`w-full py-4 rounded-2xl font-bold text-white text-lg transition-all ${entryJournalId && entryMonth && entryProjectId ? 'bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-600/20' : 'bg-gray-200 cursor-not-allowed'}`}
                  >
                    Accéder à la Saisie
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-black/5 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date précise</label>
                      <input 
                        type="date" 
                        value={entryDate}
                        min={`${entryMonth}-01`}
                        max={`${entryMonth}-31`}
                        onChange={(e) => setEntryDate(e.target.value)}
                        className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Libellé de l'opération</label>
                      <input 
                        type="text" 
                        placeholder="Ex: Règlement facture EDF"
                        value={entryDesc}
                        onChange={(e) => setEntryDesc(e.target.value)}
                        className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-sm">Lignes d'écriture</h4>
                      <button 
                        onClick={handleAddTransaction}
                        className="flex items-center gap-2 text-xs font-bold text-emerald-600 hover:text-emerald-700"
                      >
                        <Plus className="w-4 h-4" /> Ajouter une ligne
                      </button>
                    </div>

                    <div className="space-y-3">
                      {entryTransactions.map((t, i) => {
                        const account = accounts.find(a => a.id === t.account_id);
                        const needsBudget = account && (account.class === 6 || account.class === 7);
                        const needsTier = account && (account.code.startsWith('40') || account.code.startsWith('41'));
                        const filteredTiers = tiers.filter(tier => tier.account_id === t.account_id);
                        
                        return (
                          <div key={i} className="grid grid-cols-12 gap-3 items-start">
                            <div className={(needsBudget || needsTier) ? "col-span-3" : "col-span-6"}>
                              <select 
                                className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                                value={t.account_id}
                                onChange={(e) => handleTransactionChange(i, 'account_id', parseInt(e.target.value))}
                              >
                                <option value={0}>Compte...</option>
                                {accounts.map(acc => (
                                  <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                ))}
                              </select>
                            </div>
                            {needsBudget && (
                              <div className="col-span-3">
                                <select 
                                  className="w-full p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-sm focus:outline-none"
                                  value={t.budget_line_id || 0}
                                  onChange={(e) => handleTransactionChange(i, 'budget_line_id', parseInt(e.target.value))}
                                >
                                  <option value={0}>Code Budget obligatoire...</option>
                                  {budgetLines.map(bl => (
                                    <option key={bl.id} value={bl.id}>{bl.code} - {bl.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            {needsTier && (
                              <div className="col-span-3">
                                <select 
                                  className="w-full p-3 bg-amber-50 rounded-xl border border-amber-200 text-sm focus:outline-none"
                                  value={t.tier_id || 0}
                                  onChange={(e) => handleTransactionChange(i, 'tier_id', parseInt(e.target.value))}
                                >
                                  <option value={0}>Compte Tiers obligatoire...</option>
                                  {filteredTiers.length > 0 ? filteredTiers.map(tier => (
                                    <option key={tier.id} value={tier.id}>{tier.code} - {tier.name}</option>
                                  )) : tiers.map(tier => (
                                    <option key={tier.id} value={tier.id}>{tier.code} - {tier.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div className="col-span-2">
                              <input 
                                type="number" 
                                placeholder="Débit"
                                className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none text-right"
                                value={t.debit || ''}
                                onChange={(e) => handleTransactionChange(i, 'debit', parseFloat(e.target.value))}
                              />
                            </div>
                            <div className="col-span-2">
                              <input 
                                type="number" 
                                placeholder="Crédit"
                                className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none text-right"
                                value={t.credit || ''}
                                onChange={(e) => handleTransactionChange(i, 'credit', parseFloat(e.target.value))}
                              />
                            </div>
                            <div className="col-span-2 flex justify-center pt-2">
                              <button 
                                onClick={() => handleRemoveTransaction(i)}
                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-6 border-t border-gray-100 flex justify-between items-center">
                      <div className="flex gap-8">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Total Débit</p>
                          <p className="text-lg font-bold">{(totalDebit || 0).toLocaleString()} <span className="text-xs text-gray-400">FCFA</span></p>
                        </div>
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Total Crédit</p>
                          <p className="text-lg font-bold">{(totalCredit || 0).toLocaleString()} <span className="text-xs text-gray-400">FCFA</span></p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {isBalanced ? (
                          <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                            <CheckCircle2 className="w-5 h-5" /> Équilibré
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
                            <AlertCircle className="w-5 h-5" /> Déséquilibre: {(Math.abs(totalDebit - totalCredit) || 0).toLocaleString()}
                          </div>
                        )}
                        <button 
                          disabled={!isBalanced || !entryDesc}
                          onClick={submitJournalEntry}
                          className={`px-8 py-3 rounded-xl font-bold text-white transition-all ${isBalanced && entryDesc ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20' : 'bg-gray-300 cursor-not-allowed'}`}
                        >
                          Valider l'écriture
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                  <div className="p-6 border-b border-black/5 flex justify-between items-center bg-gray-50/50">
                    <div className="flex gap-4">
                      <select 
                        className="p-2 bg-white rounded-xl border border-black/5 text-sm focus:outline-none"
                        value={entryJournalId}
                        onChange={(e) => {
                          setEntryJournalId(parseInt(e.target.value));
                          setTimeout(fetchConsultationEntries, 0);
                        }}
                      >
                        <option value={0}>Tous les journaux</option>
                        {journals.map(j => <option key={j.id} value={j.id}>{j.code} - {j.name}</option>)}
                      </select>
                      <select 
                        className="p-2 bg-white rounded-xl border border-black/5 text-sm focus:outline-none"
                        value={entryProjectId}
                        onChange={(e) => {
                          setEntryProjectId(parseInt(e.target.value));
                          setTimeout(fetchConsultationEntries, 0);
                        }}
                      >
                        <option value={0}>Tous les projets</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <button 
                      onClick={fetchConsultationEntries}
                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                    >
                      <Search className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-black/5">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Référence</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Libellé</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Montant</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {consultationEntries.map(entry => (
                          <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm">{entry.date}</td>
                            <td className="px-6 py-4 font-mono text-xs text-gray-400">{entry.reference}</td>
                            <td className="px-6 py-4 text-sm font-medium">{entry.description}</td>
                            <td className="px-6 py-4 text-sm text-right font-bold">
                              {(entry.total_amount || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <button 
                                onClick={() => handleEditEntry(entry)}
                                className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                                title="Modifier"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {consultationEntries.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Aucune écriture trouvée.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}
                >
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="text-sm font-medium">{message.text}</span>
                </motion.div>
              )}
            </motion.div>
          )}

          {activeTab === 'cloture' && (
            <motion.div 
              key="cloture"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 max-w-5xl mx-auto"
            >
              <header>
                <h2 className="text-3xl font-bold tracking-tight">Clôture des Périodes</h2>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-gray-500">Verrouillage des écritures comptables pour</p>
                  <select 
                    className="bg-transparent font-bold text-emerald-600 border-b border-emerald-600/30 focus:outline-none"
                    value={selectedProject?.id || ''}
                    onChange={(e) => setSelectedProject(projects.find(p => p.id === parseInt(e.target.value)) || null)}
                  >
                    <option value="">Sélectionner un projet...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                    Clôture Mensuelle
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Mois à clôturer</label>
                      <input 
                        type="month" 
                        value={closeMonth}
                        onChange={(e) => setCloseMonth(e.target.value)}
                        className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                      />
                    </div>
                    <button 
                      onClick={() => handleClosePeriod('MONTH', closeMonth)}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                    >
                      Clôturer le Mois
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Lock className="w-5 h-5 text-red-600" />
                    Clôture Annuelle
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Année à clôturer</label>
                      <input 
                        type="number" 
                        value={closeYear}
                        onChange={(e) => setCloseYear(e.target.value)}
                        className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                      />
                    </div>
                    <button 
                      onClick={() => handleClosePeriod('YEAR', closeYear)}
                      className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
                    >
                      Clôturer l'Année
                    </button>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6 md:col-span-2">
                  <h3 className="text-lg font-bold">Historique des Clôtures</h3>
                  <div className="overflow-hidden rounded-2xl border border-black/5">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase">Période</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase">Type</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase">Date de Clôture</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase text-right">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {closedPeriods.map(p => (
                          <tr key={p.id}>
                            <td className="px-6 py-4 text-sm font-bold">{p.period}</td>
                            <td className="px-6 py-4 text-sm">{p.type === 'MONTH' ? 'Mensuelle' : 'Annuelle'}</td>
                            <td className="px-6 py-4 text-xs text-gray-500">{new Date(p.closed_at).toLocaleString()}</td>
                            <td className="px-6 py-4 text-right">
                              <span className="px-2 py-1 bg-red-50 text-red-600 text-[10px] font-bold rounded uppercase">Verrouillé</span>
                            </td>
                          </tr>
                        ))}
                        {closedPeriods.length === 0 && (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">Aucune période clôturée.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <header className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">États Financiers</h2>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-gray-500">
                      {reportView === 'menu' ? 'Balance générale et rapports d\'exécution' : 
                       reportView === 'balance' ? 'Balance Générale des Comptes' : 
                       reportView === 'ledger' ? 'Grand Livre des Comptes' : 
                       reportView === 'subsidiary_balance' ? 'Balance Tiers' :
                       reportView === 'subsidiary_ledger' ? 'Grand Livre Tiers' : 'Rapport Budgétaire'}
                    </p>
                    <select 
                      className="bg-transparent font-bold text-emerald-600 border-b border-emerald-600/30 focus:outline-none"
                      value={reportProjectId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setReportProjectId(val);
                        if (val !== 'all') {
                          const p = projects.find(proj => proj.id === parseInt(val));
                          if (p) setSelectedProject(p);
                        }
                      }}
                    >
                      <option value="all">Tous les projets</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {reportView !== 'menu' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          if (reportView === 'balance') exportToExcel(balanceData, 'balance_generale');
                          if (reportView === 'ledger') exportToExcel(ledgerData, 'grand_livre');
                          if (reportView === 'subsidiary_balance') exportToExcel(subsidiaryBalanceData, 'balance_tiers');
                          if (reportView === 'subsidiary_ledger') exportToExcel(subsidiaryLedgerData, 'grand_livre_tiers');
                          if (reportView === 'budget') exportToExcel(budgetStatus, 'rapport_budgetaire');
                        }}
                        className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all flex items-center gap-2 text-xs font-bold"
                      >
                        <ArrowRightLeft className="w-4 h-4" /> Excel
                      </button>
                      <button 
                        onClick={() => {
                          if (reportView === 'balance') exportToPDF(balanceData, 'Balance Générale', ['Compte', 'Libellé', 'Débit', 'Crédit'], ['code', 'name', 'total_debit', 'total_credit']);
                          if (reportView === 'ledger') exportToPDF(ledgerData, 'Grand Livre', ['Date', 'Réf', 'Compte', 'Libellé', 'Débit', 'Crédit'], ['date', 'reference', 'account_code', 'description', 'debit', 'credit']);
                          if (reportView === 'subsidiary_balance') exportToPDF(subsidiaryBalanceData, 'Balance Tiers', ['Code', 'Nom', 'Type', 'Débit', 'Crédit'], ['tier_code', 'tier_name', 'tier_type', 'total_debit', 'total_credit']);
                          if (reportView === 'subsidiary_ledger') exportToPDF(subsidiaryLedgerData, 'Grand Livre Tiers', ['Date', 'Réf', 'Tiers', 'Libellé', 'Débit', 'Crédit'], ['date', 'reference', 'tier_name', 'description', 'debit', 'credit']);
                          if (reportView === 'budget') exportToPDF(budgetStatus, 'Rapport Budgétaire', ['Code', 'Libellé', 'Budget', 'Réel'], ['code', 'name', 'allocated_amount', 'spent']);
                        }}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all flex items-center gap-2 text-xs font-bold"
                      >
                        <BookOpen className="w-4 h-4" /> PDF
                      </button>
                    </div>
                  )}
                  {reportView !== 'menu' && (
                    <button 
                      onClick={() => setReportView('menu')}
                      className="text-sm font-bold text-gray-400 hover:text-gray-600"
                    >
                      Retour au menu
                    </button>
                  )}
                </div>
              </header>

               {reportView === 'menu' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                      <ArrowRightLeft className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold">Balance Générale</h3>
                    <p className="text-sm text-gray-500">Générer la balance des comptes pour le projet actif.</p>
                    <button 
                      onClick={fetchBalance}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                    >
                      Visualiser
                    </button>
                  </div>
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                      <BookOpen className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold">Grand Livre</h3>
                    <p className="text-sm text-gray-500">Détail chronologique des opérations par compte.</p>
                    <button 
                      onClick={() => fetchLedger()}
                      className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all"
                    >
                      Visualiser
                    </button>
                  </div>
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                      <PieChart className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold">Rapport Budgétaire</h3>
                    <p className="text-sm text-gray-500">Analyse des écarts entre prévisions et réalisations.</p>
                    <button 
                      onClick={() => setReportView('budget')}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all"
                    >
                      Visualiser
                    </button>
                  </div>
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                      <Users className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold">Balance Tiers</h3>
                    <p className="text-sm text-gray-500">Balance des comptes fournisseurs et clients.</p>
                    <button 
                      onClick={fetchSubsidiaryBalance}
                      className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all"
                    >
                      Visualiser
                    </button>
                  </div>
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-pink-100 rounded-2xl flex items-center justify-center text-pink-600">
                      <Users className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold">Grand Livre Tiers</h3>
                    <p className="text-sm text-gray-500">Détail des opérations par tiers (fournisseurs/clients).</p>
                    <button 
                      onClick={() => fetchSubsidiaryLedger()}
                      className="w-full py-3 bg-pink-600 text-white rounded-xl font-bold hover:bg-pink-700 transition-all"
                    >
                      Visualiser
                    </button>
                  </div>
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                      <BookOpen className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold">Grand Livre Tiers</h3>
                    <p className="text-sm text-gray-500">Détail des opérations par tiers (fournisseurs/clients).</p>
                    <button 
                      onClick={() => {
                        fetchSubsidiaryLedger();
                        setReportView('subsidiary_ledger');
                      }}
                      className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                    >
                      Visualiser
                    </button>
                  </div>
                </div>
              ) : reportView === 'balance' ? (
                <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-black/5">
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Compte</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Libellé</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Débit</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Crédit</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Solde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {balanceData.map((row, idx) => {
                        const solde = row.total_debit - row.total_credit;
                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-8 py-4 font-mono text-sm font-bold text-emerald-600">{row.code}</td>
                            <td className="px-8 py-4 text-sm font-medium">{row.name}</td>
                            <td className="px-8 py-4 text-sm text-right">{(row.total_debit || 0).toLocaleString()}</td>
                            <td className="px-8 py-4 text-sm text-right">{(row.total_credit || 0).toLocaleString()}</td>
                            <td className={`px-8 py-4 text-sm font-bold text-right ${solde >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {(Math.abs(solde) || 0).toLocaleString()} {solde >= 0 ? 'D' : 'C'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : reportView === 'ledger' ? (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 flex items-center gap-4">
                    <label className="text-sm font-bold text-gray-400 uppercase">Filtrer par compte:</label>
                    <select 
                      className="p-2 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                      value={ledgerAccountId}
                      onChange={(e) => {
                        const id = parseInt(e.target.value);
                        setLedgerAccountId(id);
                        fetchLedger(id || undefined);
                      }}
                    >
                      <option value={0}>Tous les comptes</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-black/5">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Réf</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Compte</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Libellé</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Débit</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Crédit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {ledgerData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm">{row.date}</td>
                            <td className="px-6 py-4 font-mono text-xs text-gray-400">{row.reference}</td>
                            <td className="px-6 py-4 text-xs font-bold text-emerald-600">{row.account_code}</td>
                            <td className="px-6 py-4 text-sm">{row.description}</td>
                            <td className="px-6 py-4 text-sm text-right">{(row.debit || 0) > 0 ? (row.debit || 0).toLocaleString() : '-'}</td>
                            <td className="px-6 py-4 text-sm text-right">{(row.credit || 0) > 0 ? (row.credit || 0).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                        {ledgerData.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-8 py-12 text-center text-gray-400 italic">Aucune opération trouvée.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : reportView === 'budget' ? (
                <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-black/5">
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Code</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Libellé</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Budget Alloué</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Dépenses Réelles</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Reliquat</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">% Exécution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {budgetStatus.map((line, idx) => {
                        const reliquat = line.allocated_amount - (line.spent || 0);
                        const rate = line.allocated_amount > 0 ? ((line.spent || 0) / line.allocated_amount) * 100 : 0;
                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-8 py-4 font-mono text-sm font-bold text-amber-600">{line.code}</td>
                            <td className="px-8 py-4 text-sm font-medium">{line.name}</td>
                            <td className="px-8 py-4 text-sm text-right font-bold">{(line.allocated_amount || 0).toLocaleString()}</td>
                            <td className="px-8 py-4 text-sm text-right text-red-600">{(line.spent || 0).toLocaleString()}</td>
                            <td className={`px-8 py-4 text-sm text-right font-bold ${reliquat >= 0 ? 'text-emerald-600' : 'text-red-700'}`}>
                              {(reliquat || 0).toLocaleString()}
                            </td>
                            <td className="px-8 py-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${rate > 90 ? 'bg-red-500' : rate > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(rate, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs font-bold text-gray-500">{rate.toFixed(1)}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {budgetStatus.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-8 py-12 text-center text-gray-400 italic">Aucune donnée budgétaire disponible.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : reportView === 'subsidiary_balance' ? (
                <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-black/5">
                      <tr>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Code Tiers</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Débit</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Crédit</th>
                        <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Solde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {subsidiaryBalanceData.map((row, idx) => {
                        const solde = row.total_debit - row.total_credit;
                        return (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-8 py-4 font-mono text-sm font-bold text-orange-600">{row.tier_code}</td>
                            <td className="px-8 py-4 text-sm font-medium">{row.tier_name}</td>
                            <td className="px-8 py-4 text-xs text-gray-500">{row.tier_type}</td>
                            <td className="px-8 py-4 text-sm text-right">{(row.total_debit || 0).toLocaleString()}</td>
                            <td className="px-8 py-4 text-sm text-right">{(row.total_credit || 0).toLocaleString()}</td>
                            <td className={`px-8 py-4 text-sm font-bold text-right ${solde >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {(Math.abs(solde) || 0).toLocaleString()} {solde >= 0 ? 'D' : 'C'}
                            </td>
                          </tr>
                        );
                      })}
                      {subsidiaryBalanceData.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-8 py-12 text-center text-gray-400 italic">Aucune donnée tiers trouvée.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : reportView === 'subsidiary_ledger' ? (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-black/5 flex items-center gap-4">
                    <label className="text-sm font-bold text-gray-400 uppercase">Filtrer par tiers:</label>
                    <select 
                      className="p-2 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                      value={subsidiaryTierId}
                      onChange={(e) => {
                        const id = parseInt(e.target.value);
                        setSubsidiaryTierId(id);
                        fetchSubsidiaryLedger(id || undefined);
                      }}
                    >
                      <option value={0}>Tous les tiers</option>
                      {tiers.map(t => (
                        <option key={t.id} value={t.id}>{t.code} - {t.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50 border-b border-black/5">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Réf</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tiers</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Libellé</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Débit</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Crédit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {subsidiaryLedgerData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm">{row.date}</td>
                            <td className="px-6 py-4 font-mono text-xs text-gray-400">{row.reference}</td>
                            <td className="px-6 py-4 text-xs font-bold text-orange-600">{row.tier_name}</td>
                            <td className="px-6 py-4 text-sm">{row.description}</td>
                            <td className="px-6 py-4 text-sm text-right">{(row.debit || 0) > 0 ? (row.debit || 0).toLocaleString() : '-'}</td>
                            <td className="px-6 py-4 text-sm text-right">{(row.credit || 0) > 0 ? (row.credit || 0).toLocaleString() : '-'}</td>
                          </tr>
                        ))}
                        {subsidiaryLedgerData.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-8 py-12 text-center text-gray-400 italic">Aucune opération tiers trouvée.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 rounded-3xl shadow-sm border border-black/5 text-center">
                  <p className="text-gray-400 italic">Rapport détaillé en cours de développement.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'referentiels' && (
            <motion.div 
              key="referentiels"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 max-w-6xl mx-auto"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Référentiels</h2>
                  <p className="text-gray-500 mt-1">Gestion des tiers, journaux, comptes et budgets.</p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl border border-black/5 shadow-sm">
                  <button 
                    onClick={() => setReferentielView('tiers')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${referentielView === 'tiers' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Tiers
                  </button>
                  <button 
                    onClick={() => setReferentielView('journals')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${referentielView === 'journals' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Journaux
                  </button>
                  <button 
                    onClick={() => setReferentielView('accounts')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${referentielView === 'accounts' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Comptes
                  </button>
                  <button 
                    onClick={() => setReferentielView('budget')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${referentielView === 'budget' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Budgets
                  </button>
                  <button 
                    onClick={() => setReferentielView('projects')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${referentielView === 'projects' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    Projets
                  </button>
                </div>
              </header>

              {referentielView === 'tiers' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Tier Creation Form */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-600" />
                      Nouveau Tiers
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Code Tiers</label>
                        <input 
                          type="text" 
                          value={newTier.code}
                          onChange={(e) => setNewTier({...newTier, code: e.target.value})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          placeholder="F001"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Nom / Raison Sociale</label>
                        <input 
                          type="text" 
                          value={newTier.name}
                          onChange={(e) => setNewTier({...newTier, name: e.target.value})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          placeholder="Nom du tiers"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Type</label>
                        <select 
                          value={newTier.type}
                          onChange={(e) => setNewTier({...newTier, type: e.target.value as any})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                        >
                          <option value="SUPPLIER">Fournisseur</option>
                          <option value="CUSTOMER">Client</option>
                          <option value="EMPLOYEE">Employé</option>
                          <option value="OTHER">Autre</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Compte de Rattachement</label>
                        <select 
                          value={newTier.account_id}
                          onChange={(e) => setNewTier({...newTier, account_id: parseInt(e.target.value)})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                        >
                          <option value={0}>Choisir un compte (Classe 4)...</option>
                          {accounts.filter(a => a.class === 4).map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                          ))}
                        </select>
                      </div>
                      <button 
                        onClick={handleCreateTier}
                        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                      >
                        Créer le Tiers
                      </button>
                    </div>
                  </div>

                  {/* Tiers List */}
                  <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="p-6 border-b border-black/5 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold">Plan Tiers</h3>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input 
                            type="text" 
                            placeholder="Rechercher..."
                            value={tierSearch}
                            onChange={(e) => setTierSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white rounded-xl border border-black/5 text-xs focus:outline-none w-48 shadow-sm"
                          />
                        </div>
                        <span className="text-xs text-gray-400 font-medium">{tiers.length} tiers enregistrés</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-black/5">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Code</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Compte</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {tiers.filter(t => 
                            t.name.toLowerCase().includes(tierSearch.toLowerCase()) || 
                            t.code.toLowerCase().includes(tierSearch.toLowerCase())
                          ).map(t => (
                            <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-sm font-mono font-bold text-emerald-600">{t.code}</td>
                              <td className="px-6 py-4 text-sm font-medium">{t.name}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                  t.type === 'SUPPLIER' ? 'bg-orange-100 text-orange-600' : 
                                  t.type === 'CUSTOMER' ? 'bg-blue-100 text-blue-600' : 
                                  t.type === 'EMPLOYEE' ? 'bg-green-100 text-green-600' : 
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {t.type === 'SUPPLIER' ? 'Fournisseur' : 
                                   t.type === 'CUSTOMER' ? 'Client' : 
                                   t.type === 'EMPLOYEE' ? 'Employé' : 'Autre'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500">{t.account_code || '-'}</td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <button 
                                onClick={() => setEditingTier(t)}
                                className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteTier(t.id)}
                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                title="Supprimer le tiers"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                            </tr>
                          ))}
                          {tiers.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Aucun tiers enregistré.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {referentielView === 'journals' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Journal Creation */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                      Nouveau Journal
                    </h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Code</label>
                          <input 
                            type="text" 
                            value={newJournal.code}
                            onChange={(e) => setNewJournal({...newJournal, code: e.target.value})}
                            className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                            placeholder="CAI"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Nom du Journal</label>
                          <input 
                            type="text" 
                            value={newJournal.name}
                            onChange={(e) => setNewJournal({...newJournal, name: e.target.value})}
                            className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                            placeholder="Journal de Caisse"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Type</label>
                          <select 
                            value={newJournal.type}
                            onChange={(e) => setNewJournal({...newJournal, type: e.target.value as any})}
                            className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          >
                            <option value="GENERAL">Général</option>
                            <option value="TREASURY">Trésorerie</option>
                            <option value="ACHAT">Achat</option>
                          </select>
                        </div>
                        {newJournal.type === 'TREASURY' && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Compte de Trésorerie</label>
                            <select 
                              value={newJournal.treasury_account_id}
                              onChange={(e) => setNewJournal({...newJournal, treasury_account_id: parseInt(e.target.value)})}
                              className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                            >
                              <option value={0}>Choisir un compte (Classe 5)...</option>
                              {accounts.filter(a => a.class === 5).map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <button 
                        disabled={newJournal.type === 'TREASURY' && !newJournal.treasury_account_id}
                        onClick={handleCreateJournal}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all ${newJournal.type === 'TREASURY' && !newJournal.treasury_account_id ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                      >
                        Créer le Journal
                      </button>
                    </div>
                  </div>

                  {/* Journals List */}
                  <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="p-6 border-b border-black/5 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold">Codes Journaux</h3>
                      <span className="text-xs text-gray-400 font-medium">{journals.length} journaux enregistrés</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-black/5">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Code</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {journals.map(j => (
                            <tr key={j.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-sm font-mono font-bold text-blue-600">{j.code}</td>
                              <td className="px-6 py-4 text-sm font-medium">{j.name}</td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase">{j.type}</span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button 
                                  onClick={() => setEditingJournal(j)}
                                  className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteJournal(j.id)}
                                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {referentielView === 'accounts' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Account Creation */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Plus className="w-5 h-5 text-purple-600" />
                      Nouveau Compte
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Code Compte (6 chiffres)</label>
                        <input 
                          type="text" 
                          value={newAccount.code}
                          onChange={(e) => setNewAccount({...newAccount, code: e.target.value})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          placeholder="401100"
                          maxLength={6}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Libellé</label>
                        <input 
                          type="text" 
                          value={newAccount.name}
                          onChange={(e) => setNewAccount({...newAccount, name: e.target.value})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          placeholder="Fournisseurs locaux"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Classe</label>
                        <select 
                          value={newAccount.class}
                          onChange={(e) => setNewAccount({...newAccount, class: parseInt(e.target.value)})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                        >
                          {[1,2,3,4,5,6,7,8,9].map(c => <option key={c} value={c}>Classe {c}</option>)}
                        </select>
                      </div>
                      <button 
                        onClick={handleCreateAccount}
                        className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all"
                      >
                        Créer le Compte
                      </button>
                    </div>
                  </div>

                  {/* Accounts List */}
                  <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="p-6 border-b border-black/5 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold">Plan Comptable</h3>
                      <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="Rechercher..."
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          className="pl-9 pr-4 py-2 bg-white rounded-xl border border-black/5 text-xs focus:outline-none w-48 shadow-sm"
                        />
                      </div>
                    </div>
                    <div className="overflow-x-auto max-h-[600px]">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-black/5">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Code</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Libellé</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Classe</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {accounts.filter(a => 
                            a.name.toLowerCase().includes(accountSearch.toLowerCase()) || 
                            a.code.toLowerCase().includes(accountSearch.toLowerCase())
                          ).map(acc => (
                            <tr key={acc.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-mono text-sm font-bold text-purple-600">{acc.code}</td>
                              <td className="px-6 py-4 text-sm font-medium">{acc.name}</td>
                              <td className="px-6 py-4">
                                <span className="px-2 py-1 bg-gray-100 rounded text-[10px] font-bold text-gray-500 uppercase">Classe {acc.class}</span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button 
                                  onClick={() => setEditingAccount(acc)}
                                  className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteAccount(acc.id)}
                                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {referentielView === 'budget' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Budget Form */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Plus className="w-5 h-5 text-amber-600" />
                      Nouvelle Ligne Budgétaire
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Projet</label>
                        <select 
                          value={newBudgetLine.project_id}
                          onChange={(e) => {
                            const pid = parseInt(e.target.value);
                            setNewBudgetLine({...newBudgetLine, project_id: pid});
                            const p = projects.find(proj => proj.id === pid);
                            if (p) setSelectedProject(p);
                          }}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                        >
                          <option value={0}>Sélectionner un projet...</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Code Budget</label>
                        <input 
                          type="text" 
                          value={newBudgetLine.code}
                          onChange={(e) => setNewBudgetLine({...newBudgetLine, code: e.target.value})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          placeholder="B01"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Libellé</label>
                        <input 
                          type="text" 
                          value={newBudgetLine.name}
                          onChange={(e) => setNewBudgetLine({...newBudgetLine, name: e.target.value})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          placeholder="Frais de mission"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Montant Alloué</label>
                        <input 
                          type="number" 
                          value={newBudgetLine.allocated_amount || ''}
                          onChange={(e) => setNewBudgetLine({...newBudgetLine, allocated_amount: parseFloat(e.target.value)})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Année</label>
                        <select 
                          value={newBudgetLine.year}
                          onChange={(e) => setNewBudgetLine({...newBudgetLine, year: parseInt(e.target.value)})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                        >
                          {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <button 
                        disabled={!newBudgetLine.project_id}
                        onClick={handleCreateBudgetLine}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all ${!newBudgetLine.project_id ? 'bg-gray-300 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'}`}
                      >
                        Ajouter au Plan
                      </button>
                    </div>
                  </div>

                  {/* Budget List */}
                  <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="p-6 border-b border-black/5 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold">Plan Budgétaire</h3>
                      <div className="flex items-center gap-4">
                        <p className="text-xs text-gray-400">Année:</p>
                        <select 
                          className="bg-transparent text-xs font-bold text-amber-600 focus:outline-none"
                          value={selectedYear}
                          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        >
                          {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-black/5">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Code</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Libellé</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Montant Alloué</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {budgetLines.map(line => (
                            <tr key={line.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-mono text-sm font-bold text-amber-600">{line.code}</td>
                              <td className="px-6 py-4 text-sm font-medium">{line.name}</td>
                              <td className="px-6 py-4 text-sm font-bold text-right">
                                {line.allocated_amount.toLocaleString()}
                                <span className="ml-2 text-[10px] text-gray-400">FCFA</span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button 
                                  onClick={() => setEditingBudgetLine(line)}
                                  className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteBudgetLine(line.id)}
                                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {budgetLines.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">Aucune ligne budgétaire définie pour ce projet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {referentielView === 'projects' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Project Creation */}
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <Plus className="w-5 h-5 text-emerald-600" />
                      Nouveau Projet
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Code Projet</label>
                        <input 
                          type="text" 
                          value={newProject.code}
                          onChange={(e) => setNewProject({...newProject, code: e.target.value})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          placeholder="P002"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Nom du Projet</label>
                        <input 
                          type="text" 
                          value={newProject.name}
                          onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          placeholder="Nom du projet"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Description</label>
                        <textarea 
                          value={newProject.description}
                          onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                          className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none h-24 resize-none"
                          placeholder="Description du projet..."
                        />
                      </div>
                      <button 
                        onClick={handleCreateProject}
                        className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                      >
                        Créer le Projet
                      </button>
                    </div>
                  </div>

                  {/* Projects List */}
                  <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                    <div className="p-6 border-b border-black/5 flex justify-between items-center bg-gray-50/50">
                      <h3 className="font-bold">Liste des Projets</h3>
                      <span className="text-xs text-gray-400 font-medium">{projects.length} projets enregistrés</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50/50 border-b border-black/5">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Code</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {projects.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 text-sm font-mono font-bold text-emerald-600">{p.code}</td>
                              <td className="px-6 py-4 text-sm font-medium">{p.name}</td>
                              <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate">{p.description}</td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button 
                                  onClick={() => setEditingProject(p)}
                                  className="p-2 text-blue-400 hover:text-blue-600 transition-colors"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteProject(p.id)}
                                  className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'lettering' && (
            <motion.div 
              key="lettering"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 max-w-6xl mx-auto"
            >
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Lettrage des Comptes</h2>
                  <p className="text-gray-500 mt-1">Pointage et lettrage des comptes de tiers (Fournisseurs/Clients).</p>
                </div>
                <div className="flex gap-4">
                  <select 
                    className="p-3 bg-white rounded-2xl border border-black/5 text-sm font-bold focus:outline-none shadow-sm"
                    value={letteringAccountId}
                    onChange={(e) => {
                      const id = parseInt(e.target.value);
                      setLetteringAccountId(id);
                      fetchLetteringData(id);
                    }}
                  >
                    <option value={0}>Sélectionner un compte de tiers...</option>
                    {accounts.filter(a => a.class === 4).map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                    ))}
                  </select>
                  <button 
                    disabled={selectedLetteringTransactions.length < 2}
                    onClick={handleMatch}
                    className={`px-6 py-3 rounded-2xl font-bold text-white transition-all ${selectedLetteringTransactions.length >= 2 ? 'bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20' : 'bg-gray-300 cursor-not-allowed'}`}
                  >
                    Lettrer la sélection ({selectedLetteringTransactions.length})
                  </button>
                </div>
              </header>

              <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                <div className="p-6 border-b border-black/5 flex justify-between items-center bg-gray-50/50">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Rechercher une opération..."
                      value={letteringSearch}
                      onChange={(e) => setLetteringSearch(e.target.value)}
                      className="pl-9 pr-4 py-2 bg-white rounded-xl border border-black/5 text-xs focus:outline-none w-64 shadow-sm"
                    />
                  </div>
                  <div className="flex gap-4 text-xs font-bold">
                    <span className="text-emerald-600">Total Débit: {letteringData.filter(t => selectedLetteringTransactions.includes(t.transaction_id)).reduce((s, t) => s + t.debit, 0).toLocaleString()}</span>
                    <span className="text-red-600">Total Crédit: {letteringData.filter(t => selectedLetteringTransactions.includes(t.transaction_id)).reduce((s, t) => s + t.credit, 0).toLocaleString()}</span>
                    <span className={Math.abs(letteringData.filter(t => selectedLetteringTransactions.includes(t.transaction_id)).reduce((s, t) => s + t.debit - t.credit, 0)) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}>
                      Écart: {Math.abs(letteringData.filter(t => selectedLetteringTransactions.includes(t.transaction_id)).reduce((s, t) => s + t.debit - t.credit, 0)).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50/50 border-b border-black/5">
                      <tr>
                        <th className="px-6 py-4 w-12">
                          <input 
                            type="checkbox" 
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLetteringTransactions(letteringData.filter(t => !t.letter).map(t => t.transaction_id));
                              } else {
                                setSelectedLetteringTransactions([]);
                              }
                            }}
                          />
                        </th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Date</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Référence</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Libellé</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Débit</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Crédit</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Lettrage</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {letteringData.filter(t => 
                        t.description.toLowerCase().includes(letteringSearch.toLowerCase()) ||
                        t.reference.toLowerCase().includes(letteringSearch.toLowerCase())
                      ).map(t => (
                        <tr key={t.transaction_id} className={`hover:bg-gray-50 transition-colors ${t.letter ? 'bg-gray-50/50 opacity-60' : ''}`}>
                          <td className="px-6 py-4">
                            {!t.letter && (
                              <input 
                                type="checkbox" 
                                checked={selectedLetteringTransactions.includes(t.transaction_id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLetteringTransactions([...selectedLetteringTransactions, t.transaction_id]);
                                  } else {
                                    setSelectedLetteringTransactions(selectedLetteringTransactions.filter(id => id !== t.transaction_id));
                                  }
                                }}
                              />
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">{t.date}</td>
                          <td className="px-6 py-4 font-mono text-xs text-gray-400">{t.reference}</td>
                          <td className="px-6 py-4 text-sm font-medium">{t.description}</td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-emerald-600">{t.debit > 0 ? t.debit.toLocaleString() : '-'}</td>
                          <td className="px-6 py-4 text-sm text-right font-bold text-red-600">{t.credit > 0 ? t.credit.toLocaleString() : '-'}</td>
                          <td className="px-6 py-4 text-center">
                            {t.letter ? (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold uppercase">{t.letter}</span>
                            ) : '-'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {t.letter && (
                              <button 
                                onClick={() => handleUnmatch(t.transaction_id)}
                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                title="Délettrer"
                              >
                                <Plus className="w-4 h-4 rotate-45" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {letteringData.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">Veuillez sélectionner un compte pour afficher les opérations.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'config' && (
            <motion.div 
              key="config"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 max-w-5xl mx-auto"
            >
              <header>
                <h2 className="text-3xl font-bold tracking-tight">Configuration & Maintenance</h2>
                <p className="text-gray-500 mt-1">Gérez les paramètres du système et la sauvegarde des données.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Security Section */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Lock className="w-5 h-5 text-emerald-600" />
                    Sécurité du Compte
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Nouveau mot de passe</label>
                      <input 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                        placeholder="••••••••"
                      />
                    </div>
                    <button 
                      onClick={handleChangePassword}
                      className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-black transition-all"
                    >
                      Mettre à jour le mot de passe
                    </button>
                  </div>
                </div>

                {/* Maintenance Section */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Settings className="w-5 h-5 text-gray-600" />
                    Maintenance des Données
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-black/5 space-y-3">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Sauvegarde</h4>
                      <p className="text-xs text-gray-500">Téléchargez l'ensemble des données au format JSON.</p>
                      <button 
                        onClick={handleBackup}
                        className="w-full py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" /> Sauvegarder
                      </button>
                    </div>

                    {currentUser.role === 'ADMIN' && (
                      <div className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-3">
                        <h4 className="font-bold text-xs uppercase tracking-wider text-red-400">Actions Critiques</h4>
                        <div className="space-y-2">
                          <label className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 cursor-pointer">
                            <ArrowRightLeft className="w-4 h-4" /> Restaurer
                            <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
                          </label>
                          <button 
                            onClick={handleReset}
                            className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" /> Réinitialiser
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Publication Section */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6 md:col-span-2">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-blue-600" />
                    Publication & Partage
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 space-y-4">
                      <h4 className="font-bold text-sm text-blue-800">Votre application est en ligne !</h4>
                      <p className="text-xs text-blue-600 leading-relaxed">
                        Cette application est déjà hébergée sur Google Cloud. Vous pouvez la partager avec vos collègues en utilisant l'URL de partage fournie dans votre interface AI Studio.
                      </p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const url = window.location.origin;
                            navigator.clipboard.writeText(url);
                            setMessage({ type: 'success', text: 'Lien copié dans le presse-papier !' });
                            setTimeout(() => setMessage(null), 3000);
                          }}
                          className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                        >
                          <ExternalLink className="w-3 h-3" /> Copier le lien
                        </button>
                      </div>
                    </div>

                    <div className="p-6 bg-gray-50 rounded-2xl border border-black/5 space-y-4">
                      <h4 className="font-bold text-sm text-gray-800">Exporter pour un domaine propre</h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        Pour publier sur votre propre domaine (ex: www.votre-entreprise.com), vous pouvez exporter le code source et l'héberger sur Firebase Hosting ou Google Cloud Platform.
                      </p>
                      <button 
                        onClick={() => {
                          alert("Pour exporter le code :\n1. Téléchargez les fichiers via l'interface AI Studio.\n2. Installez Node.js sur votre ordinateur.\n3. Exécutez 'npm install' puis 'npm run build'.\n4. Déployez le dossier 'dist' sur votre hébergeur.");
                        }}
                        className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                      >
                        <BookOpen className="w-3 h-3" /> Guide d'exportation
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'users' && (
              <motion.div 
                key="users"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8 max-w-5xl mx-auto"
              >
                  <header>
                    <h2 className="text-3xl font-bold tracking-tight">Gestion des Utilisateurs</h2>
                    <p className="text-gray-500 mt-1">Créez et gérez les accès des comptables et administrateurs.</p>
                  </header>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* User Creation Form */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 space-y-6">
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        <UserPlus className="w-5 h-5 text-emerald-600" />
                        Nouvel Utilisateur
                      </h3>
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Nom d'utilisateur</label>
                          <input 
                            type="text" 
                            value={newUser.username}
                            onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                            className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                            placeholder="j.doe"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Mot de passe</label>
                          <input 
                            type="password" 
                            value={newUser.password}
                            onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                            className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                            placeholder="••••••••"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Rôle</label>
                          <select 
                            value={newUser.role}
                            onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                            className="w-full p-3 bg-gray-50 rounded-xl border border-black/5 text-sm focus:outline-none"
                          >
                            <option value="COMPTABLE">Comptable</option>
                            <option value="ADMIN">Administrateur</option>
                            <option value="FINANCIAL_OFFICER">Responsable Financier</option>
                          </select>
                        </div>
                        <button 
                          onClick={handleCreateUser}
                          className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                        >
                          Créer l'utilisateur
                        </button>
                      </div>
                    </div>

                    {/* User List */}
                    <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-black/5">
                          <tr>
                            <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">ID</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Utilisateur</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rôle</th>
                            <th className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {users.map(u => (
                            <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-8 py-4 text-sm font-mono text-gray-400">#{u.id}</td>
                              <td className="px-8 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-xs">
                                    {u.username.substring(0, 2).toUpperCase()}
                                  </div>
                                  <span className="font-medium">{u.username}</span>
                                </div>
                              </td>
                              <td className="px-8 py-4">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                  {u.role}
                                </span>
                              </td>
                            <td className="px-8 py-4 text-right space-x-2">
                                <button 
                                  onClick={() => handleToggleUserActive(u.id)}
                                  className={`p-2 transition-colors ${u.is_active ? 'text-emerald-600 hover:text-emerald-700' : 'text-gray-300 hover:text-gray-400'}`}
                                  title={u.is_active ? 'Désactiver' : 'Activer'}
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleResetUserPassword(u.id)}
                                  className="p-2 text-amber-500 hover:text-amber-600 transition-colors"
                                  title="Réinitialiser mot de passe"
                                >
                                  <Lock className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}

            {message && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}
              >
                {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span className="text-sm font-medium">{message.text}</span>
              </motion.div>
            )}
        </AnimatePresence>

        {/* Edit Modals */}
        {editingTier && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[32px] p-8 w-full max-w-md space-y-6 shadow-2xl">
              <h3 className="text-xl font-bold">Modifier Tiers</h3>
              <div className="space-y-4">
                <input type="text" value={editingTier.name} onChange={e => setEditingTier({...editingTier, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5" placeholder="Nom" />
                <select value={editingTier.type} onChange={e => setEditingTier({...editingTier, type: e.target.value as any})} className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5">
                  <option value="SUPPLIER">Fournisseur</option>
                  <option value="CUSTOMER">Client</option>
                  <option value="EMPLOYEE">Employé</option>
                  <option value="OTHER">Autre</option>
                </select>
                <div className="flex gap-4">
                  <button onClick={() => setEditingTier(null)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">Annuler</button>
                  <button onClick={handleUpdateTier} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold">Enregistrer</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {editingJournal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[32px] p-8 w-full max-w-md space-y-6 shadow-2xl">
              <h3 className="text-xl font-bold">Modifier Journal</h3>
              <div className="space-y-4">
                <input type="text" value={editingJournal.name} onChange={e => setEditingJournal({...editingJournal, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5" placeholder="Nom" />
                <div className="flex gap-4">
                  <button onClick={() => setEditingJournal(null)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">Annuler</button>
                  <button onClick={handleUpdateJournal} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold">Enregistrer</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {editingAccount && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[32px] p-8 w-full max-w-md space-y-6 shadow-2xl">
              <h3 className="text-xl font-bold">Modifier Compte</h3>
              <div className="space-y-4">
                <input type="text" value={editingAccount.code} onChange={e => setEditingAccount({...editingAccount, code: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5" placeholder="Code (6 chiffres)" maxLength={6} />
                <input type="text" value={editingAccount.name} onChange={e => setEditingAccount({...editingAccount, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5" placeholder="Libellé" />
                <div className="flex gap-4">
                  <button onClick={() => setEditingAccount(null)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">Annuler</button>
                  <button onClick={handleUpdateAccount} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold">Enregistrer</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {editingProject && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[32px] p-8 w-full max-w-md space-y-6 shadow-2xl">
              <h3 className="text-xl font-bold">Modifier Projet</h3>
              <div className="space-y-4">
                <input type="text" value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5" placeholder="Nom" />
                <textarea value={editingProject.description} onChange={e => setEditingProject({...editingProject, description: e.target.value})} className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5 h-24" placeholder="Description" />
                <div className="flex gap-4">
                  <button onClick={() => setEditingProject(null)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">Annuler</button>
                  <button onClick={handleUpdateProject} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold">Enregistrer</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {editingBudgetLine && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[32px] p-8 w-full max-w-md space-y-6 shadow-2xl">
              <h3 className="text-xl font-bold">Modifier Budget</h3>
              <p className="text-sm text-gray-500">{editingBudgetLine.code} - {editingBudgetLine.name}</p>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase">Montant Alloué</label>
                  <input type="number" value={editingBudgetLine.allocated_amount} onChange={e => setEditingBudgetLine({...editingBudgetLine, allocated_amount: parseFloat(e.target.value)})} className="w-full p-4 bg-gray-50 rounded-2xl border border-black/5" />
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setEditingBudgetLine(null)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">Annuler</button>
                  <button onClick={handleUpdateBudgetLine} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-bold">Enregistrer</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </main>
    </div>
  );
}



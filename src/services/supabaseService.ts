import { supabase } from '../lib/supabase';

export const supabaseService = {
  // Authentication
  async login(username, password) {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await res.json();
      return { error: err.error || "Identifiants invalides" };
    }
    return await res.json();
  },

  // Projects
  async getProjects() {
    const res = await fetch('/api/projects');
    return await res.json();
  },

  async createProject(project) {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async updateProject(id, project) {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async deleteProject(id) {
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  // Accounts
  async getAccounts() {
    const res = await fetch('/api/accounts');
    return await res.json();
  },

  async createAccount(account) {
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async updateAccount(id, account) {
    const res = await fetch(`/api/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async deleteAccount(id) {
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  // Journals
  async getJournals() {
    const res = await fetch('/api/journals');
    return await res.json();
  },

  async createJournal(journal) {
    const res = await fetch('/api/journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(journal)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async updateJournal(id, journal) {
    const res = await fetch(`/api/journals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(journal)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async deleteJournal(id) {
    const res = await fetch(`/api/journals/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  // Tiers
  async getTiers() {
    const res = await fetch('/api/tiers');
    return await res.json();
  },

  async createTier(tier) {
    const res = await fetch('/api/tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tier)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async updateTier(id, tier) {
    const res = await fetch(`/api/tiers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tier)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async deleteTier(id) {
    const res = await fetch(`/api/tiers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  // Budget
  async getBudgetStatus(projectId, year) {
    const res = await fetch(`/api/budget-status/${projectId}${year ? `?year=${year}` : ''}`);
    return await res.json();
  },

  async createBudgetLine(line) {
    const res = await fetch('/api/budget-lines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(line)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async updateBudgetLine(id, line) {
    const res = await fetch(`/api/budget-lines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(line)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async deleteBudgetLine(id) {
    const res = await fetch(`/api/budget-lines/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  // Journal Entries
  async getJournalEntries(journalId, projectId) {
    const res = await fetch(`/api/journal-entries?journalId=${journalId}&projectId=${projectId}`);
    return await res.json();
  },

  async createJournalEntry(entry) {
    const res = await fetch('/api/journal-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async deleteJournalEntry(id) {
    const res = await fetch(`/api/journal-entries/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async getEntryTransactions(entryId) {
    const res = await fetch(`/api/journal-entries/${entryId}/transactions`);
    return await res.json();
  },

  // Users
  async getUsers() {
    const res = await fetch('/api/users');
    return await res.json();
  },

  async createUser(user) {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async toggleUserActive(id, currentStatus) {
    const res = await fetch(`/api/users/${id}/toggle-active`, { method: 'PATCH' });
    return await res.json();
  },

  async resetUserPassword(id, newPassword) {
    const res = await fetch(`/api/users/${id}/reset-password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });
    return await res.json();
  },

  // Periods
  async getClosedPeriods(projectId) {
    const res = await fetch(`/api/projects/closed-periods/${projectId}`);
    return await res.json();
  },

  async closePeriod(projectId, type, period) {
    const res = await fetch('/api/projects/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, type, period })
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  // Lettering
  async getLetteringData(projectId, accountId) {
    const res = await fetch(`/api/lettering/${projectId}?accountId=${accountId}`);
    return await res.json();
  },

  async matchTransactions(transactionIds, letter) {
    const res = await fetch('/api/lettering/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds, letter })
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  async unmatchTransactions(transactionIds) {
    const res = await fetch('/api/lettering/unmatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionIds })
    });
    const data = await res.json();
    return { data, error: res.ok ? null : { message: data.error } };
  },

  // Reports
  async getBalance(projectId) {
    const res = await fetch(`/api/reports/balance/${projectId}`);
    return await res.json();
  },

  async getLedger(projectId, accountId) {
    const res = await fetch(`/api/reports/ledger/${projectId}${accountId ? `?accountId=${accountId}` : ''}`);
    return await res.json();
  }
};

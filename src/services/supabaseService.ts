import { supabase } from '../lib/supabase';

export const supabaseService = {
  // Authentication
  async login(username, password) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();
    
    if (error || !data) return { error: "Identifiants invalides" };
    if (!data.is_active) return { error: "Compte désactivé" };

    const passwordDate = new Date(data.password_updated_at);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const passwordExpired = passwordDate < sixMonthsAgo;

    return { ...data, passwordExpired };
  },

  // Projects
  async getProjects() {
    const { data } = await supabase.from('projects').select('*').order('code');
    return data || [];
  },

  async createProject(project) {
    return await supabase.from('projects').insert(project).select().single();
  },

  // Accounts
  async getAccounts() {
    const { data } = await supabase.from('accounts').select('*').order('code');
    return data || [];
  },

  // Journals
  async getJournals() {
    const { data } = await supabase.from('journals').select('*').order('code');
    return data || [];
  },

  // Tiers
  async getTiers() {
    const { data } = await supabase
      .from('tiers')
      .select('*, accounts(code)')
      .order('code');
    return data?.map(t => ({ ...t, account_code: t.accounts?.code })) || [];
  },

  // Budget
  async getBudgetStatus(projectId, year) {
    let query = supabase.from('budget_lines').select('*');
    if (projectId !== 'all') query = query.eq('project_id', projectId);
    if (year) query = query.eq('year', year);
    
    const { data: lines } = await query;
    if (!lines) return [];

    // For each line, get spent amount
    const status = await Promise.all(lines.map(async (line) => {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('debit')
        .eq('budget_line_id', line.id);
      
      const spent = transactions?.reduce((sum, t) => sum + (t.debit || 0), 0) || 0;
      return { ...line, spent };
    }));

    return status;
  },

  async createAccount(account) {
    return await supabase.from('accounts').insert(account).select().single();
  },

  async createJournal(journal) {
    return await supabase.from('journals').insert(journal).select().single();
  },

  async createTier(tier) {
    return await supabase.from('tiers').insert(tier).select().single();
  },

  async createBudgetLine(line) {
    return await supabase.from('budget_lines').insert(line).select().single();
  },

  async getJournalEntries(journalId, projectId) {
    let query = supabase.from('journal_entries').select('*');
    if (journalId) query = query.eq('journal_id', journalId);
    if (projectId && projectId !== 'all') query = query.eq('project_id', projectId);
    const { data } = await query.order('date', { ascending: false });
    return data || [];
  },

  async deleteJournalEntry(id) {
    await supabase.from('transactions').delete().eq('entry_id', id);
    return await supabase.from('journal_entries').delete().eq('id', id);
  },

  async getEntryTransactions(entryId) {
    const { data } = await supabase.from('transactions').select('*').eq('entry_id', entryId);
    return data || [];
  },

  // Users
  async getUsers() {
    const { data } = await supabase.from('users').select('id, username, role, is_active, password_updated_at');
    return data || [];
  },

  async createUser(user) {
    return await supabase.from('users').insert(user).select().single();
  },

  async toggleUserActive(id, currentStatus) {
    return await supabase.from('users').update({ is_active: !currentStatus }).eq('id', id);
  },

  async resetUserPassword(id, newPassword) {
    return await supabase.from('users').update({ password: newPassword, password_updated_at: '1970-01-01' }).eq('id', id);
  },

  // Periods
  async getClosedPeriods(projectId) {
    const { data } = await supabase.from('closed_periods').select('*').eq('project_id', projectId).order('period', { ascending: false });
    return data || [];
  },

  async closePeriod(projectId, type, period) {
    return await supabase.from('closed_periods').insert({ project_id: projectId, type, period, closed_at: new Date().toISOString() });
  },

  // Lettering
  async getLetteringData(projectId, accountId) {
    const { data } = await supabase
      .from('transactions')
      .select(`
        id,
        letter,
        debit,
        credit,
        journal_entries (
          date,
          reference,
          description
        ),
        accounts (
          code,
          name
        )
      `)
      .eq('account_id', accountId)
      .eq('journal_entries.project_id', projectId);
    
    return data?.map(t => ({
      transaction_id: t.id,
      date: t.journal_entries?.date,
      reference: t.journal_entries?.reference,
      description: t.journal_entries?.description,
      debit: t.debit,
      credit: t.credit,
      letter: t.letter,
      account_code: t.accounts?.code,
      account_name: t.accounts?.name
    })) || [];
  },

  async matchTransactions(transactionIds, letter) {
    return await supabase.from('transactions').update({ letter }).in('id', transactionIds);
  },

  async unmatchTransactions(transactionIds) {
    return await supabase.from('transactions').update({ letter: null }).in('id', transactionIds);
  },

  // Reports
  async getBalance(projectId) {
    const { data } = await supabase.rpc('get_balance', { p_id: projectId === 'all' ? null : projectId });
    return data || [];
  },

  async getLedger(projectId, accountId) {
    let query = supabase
      .from('transactions')
      .select(`
        debit,
        credit,
        journal_entries (
          date,
          reference,
          description,
          project_id
        ),
        accounts (
          code,
          name
        )
      `);
    
    if (projectId !== 'all') query = query.eq('journal_entries.project_id', projectId);
    if (accountId) query = query.eq('account_id', accountId);

    const { data } = await query.order('journal_entries(date)', { ascending: true });
    
    return data?.map(t => ({
      account_code: t.accounts?.code,
      account_name: t.accounts?.name,
      date: t.journal_entries?.date,
      reference: t.journal_entries?.reference,
      description: t.journal_entries?.description,
      debit: t.debit,
      credit: t.credit
    })) || [];
  },

  // Updates & Deletes
  async updateTier(id, tier) {
    return await supabase.from('tiers').update(tier).eq('id', id);
  },

  async deleteTier(id) {
    return await supabase.from('tiers').delete().eq('id', id);
  },

  async updateJournal(id, journal) {
    return await supabase.from('journals').update(journal).eq('id', id);
  },

  async deleteJournal(id) {
    return await supabase.from('journals').delete().eq('id', id);
  },

  async updateAccount(id, account) {
    return await supabase.from('accounts').update(account).eq('id', id);
  },

  async deleteAccount(id) {
    return await supabase.from('accounts').delete().eq('id', id);
  },

  async updateProject(id, project) {
    return await supabase.from('projects').update(project).eq('id', id);
  },

  async deleteProject(id) {
    return await supabase.from('projects').delete().eq('id', id);
  },

  async updateBudgetLine(id, line) {
    return await supabase.from('budget_lines').update(line).eq('id', id);
  },

  async deleteBudgetLine(id) {
    return await supabase.from('budget_lines').delete().eq('id', id);
  }
};

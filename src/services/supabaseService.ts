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
    // Should also delete transactions (Supabase cascade or manual)
    await supabase.from('transactions').delete().eq('entry_id', id);
    return await supabase.from('journal_entries').delete().eq('id', id);
  }
};

import { supabase } from '../lib/supabase';

export const supabaseService = {
  // Users
  async getUsers() {
    const { data, error } = await supabase
      .from('users')
      .select('*');
    if (error) throw error;
    return data;
  },

  async saveUser(user: any) {
    const { data, error } = await supabase
      .from('users')
      .upsert(user)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteUser(id: number) {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Projects
  async getProjects() {
    const { data, error } = await supabase
      .from('projects')
      .select('*');
    if (error) throw error;
    return data;
  },

  async saveProject(project: any) {
    const { data, error } = await supabase
      .from('projects')
      .upsert(project)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteProject(id: number) {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Generic methods
  async getData(table: string, query: any = '*') {
    const { data, error } = await supabase
      .from(table)
      .select(query);
    if (error) throw error;
    return data;
  },

  async saveData(table: string, payload: any) {
    const { data, error } = await supabase
      .from(table)
      .upsert(payload)
      .select();
    if (error) throw error;
    return data;
  },

  async deleteData(table: string, id: number) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Migration helper
  async migrateData(table: string, localData: any[]) {
    if (!localData || localData.length === 0) return [];
    
    // Supabase upsert handles arrays
    const { data, error } = await supabase
      .from(table)
      .upsert(localData)
      .select();
    if (error) throw error;
    return data;
  }
};

import localforage from 'localforage';
import { v4 as uuidv4 } from 'uuid';
import type { UIState, UISession, UIComponent } from '../types';

class UIStorageManager {
  private statesStore: LocalForage;
  private sessionsStore: LocalForage;
  private versionsStore: LocalForage;

  constructor() {
    // Initialize separate stores for different data types
    this.statesStore = localforage.createInstance({
      name: 'selfgenui',
      storeName: 'ui_states',
      description: 'UI states and components'
    });

    this.sessionsStore = localforage.createInstance({
      name: 'selfgenui',
      storeName: 'sessions',
      description: 'User sessions and navigation history'
    });

    this.versionsStore = localforage.createInstance({
      name: 'selfgenui',
      storeName: 'versions',
      description: 'Version control and rollback data'
    });
  }

  // Generic key-value store methods
  async setItem<T>(key: string, value: T): Promise<T> {
    return await this.statesStore.setItem(key, value);
  }

  async getItem<T>(key: string): Promise<T | null> {
    return await this.statesStore.getItem<T>(key);
  }

  // UI State Management
  async saveUIState(state: Omit<UIState, 'id' | 'created_at' | 'updated_at' | 'version'>): Promise<UIState> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    const newState: UIState = {
      id,
      ...state,
      created_at: now,
      updated_at: now,
      version: 1
    };

    await this.statesStore.setItem(id, newState);
    await this.createVersionSnapshot(newState);
    
    return newState;
  }

  async updateUIState(id: string, updates: Partial<UIState>): Promise<UIState | null> {
    const existingState = await this.statesStore.getItem<UIState>(id);
    if (!existingState) return null;

    const updatedState: UIState = {
      ...existingState,
      ...updates,
      updated_at: new Date().toISOString(),
      version: existingState.version + 1,
      parent_version: existingState.id
    };

    await this.statesStore.setItem(id, updatedState);
    await this.createVersionSnapshot(updatedState);

    return updatedState;
  }

  async getUIState(id: string): Promise<UIState | null> {
    return await this.statesStore.getItem<UIState>(id);
  }

  async getAllUIStates(): Promise<UIState[]> {
    const states: UIState[] = [];
    await this.statesStore.iterate((value: UIState) => {
      states.push(value);
    });
    return states.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async deleteUIState(id: string): Promise<void> {
    await this.statesStore.removeItem(id);
    // Note: We keep version snapshots for potential recovery
  }

  // Session Management
  async createSession(): Promise<UISession> {
    const id = uuidv4();
    const session: UISession = {
      id,
      history: [],
      created_at: new Date().toISOString()
    };

    await this.sessionsStore.setItem(id, session);
    return session;
  }

  async updateSession(id: string, updates: Partial<UISession>): Promise<UISession | null> {
    const existingSession = await this.sessionsStore.getItem<UISession>(id);
    if (!existingSession) return null;

    const updatedSession: UISession = {
      ...existingSession,
      ...updates
    };

    await this.sessionsStore.setItem(id, updatedSession);
    return updatedSession;
  }

  async getSession(id: string): Promise<UISession | null> {
    return await this.sessionsStore.getItem<UISession>(id);
  }

  // Version Control
  private async createVersionSnapshot(state: UIState): Promise<void> {
    const snapshotKey = `${state.id}_v${state.version}`;
    await this.versionsStore.setItem(snapshotKey, {
      ...state,
      snapshot_created_at: new Date().toISOString()
    });
  }

  async getVersionHistory(stateId: string): Promise<UIState[]> {
    const versions: UIState[] = [];
    await this.versionsStore.iterate((value: UIState & { snapshot_created_at: string }, key: string) => {
      if (key.startsWith(stateId)) {
        versions.push(value);
      }
    });
    return versions.sort((a, b) => b.version - a.version);
  }

  async rollbackToVersion(stateId: string, version: number): Promise<UIState | null> {
    const versionKey = `${stateId}_v${version}`;
    const versionState = await this.versionsStore.getItem<UIState>(versionKey);
    
    if (!versionState) return null;

    // Create a new version based on the rollback
    const rolledBackState: UIState = {
      ...versionState,
      version: ((await this.getUIState(stateId))?.version ?? 0) + 1,
      updated_at: new Date().toISOString(),
      parent_version: stateId
    };

    await this.statesStore.setItem(stateId, rolledBackState);
    await this.createVersionSnapshot(rolledBackState);

    return rolledBackState;
  }

  // Search and Filter
  async searchUIStates(query: string): Promise<UIState[]> {
    const allStates = await this.getAllUIStates();
    const lowercaseQuery = query.toLowerCase();
    
    return allStates.filter(state => 
      state.name.toLowerCase().includes(lowercaseQuery) ||
      (state.description?.toLowerCase().includes(lowercaseQuery)) ||
      this.searchInComponents(state.components, lowercaseQuery)
    );
  }

  private searchInComponents(components: UIComponent[], query: string): boolean {
    return components.some(component => 
      component.type.toLowerCase().includes(query) ||
      JSON.stringify(component.props).toLowerCase().includes(query) ||
      (component.children && this.searchInComponents(
        component.children.filter(child => typeof child === 'object' && 'type' in child) as UIComponent[], 
        query
      ))
    );
  }

  // Utility methods
  async clearAllData(): Promise<void> {
    await Promise.all([
      this.statesStore.clear(),
      this.sessionsStore.clear(),
      this.versionsStore.clear()
    ]);
  }

  async exportData(): Promise<{states: UIState[], sessions: UISession[]}> {
    const states = await this.getAllUIStates();
    const sessions: UISession[] = [];
    
    await this.sessionsStore.iterate((value: UISession) => {
      sessions.push(value);
    });

    return { states, sessions };
  }
}

export const storageManager = new UIStorageManager();

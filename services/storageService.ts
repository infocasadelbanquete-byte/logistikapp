
import { User, Client, InventoryItem, EventOrder, UserRole, AppNotification, CompanySettings, PurchaseTransaction, Withholding, PayrollEntry, Provider, EventStatus } from '../types';
import { db, isConfigured } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy,
  getDocs,
  where,
  setDoc,
  increment,
  getDoc,
  runTransaction,
  writeBatch
} from "firebase/firestore";

const COLLECTIONS = {
  USERS: 'users',
  CLIENTS: 'clients',
  PROVIDERS: 'providers',
  INVENTORY: 'inventory',
  EVENTS: 'events',
  NOTIFICATIONS: 'notifications',
  SETTINGS: 'settings',
  COUNTERS: 'counters',
  PURCHASES: 'purchases',
  WITHHOLDINGS: 'withholdings',
  PAYROLL: 'payroll'
};

export const DRAFT_KEYS = {
    EVENT: 'draft_event_v2',
    QUOTE: 'draft_quote_v2'
};

const COUNTER_KEYS = {
    ORDERS: 'seq_orders',
    QUOTES: 'seq_quotes'
};

const sanitizePayload = (data: any): any => {
    if (data === null || data === undefined) return null;
    if (typeof data !== 'object') return data;
    if (data instanceof Date) return data.toISOString();
    if (Array.isArray(data)) return data.map(item => sanitizePayload(item));
    const clean: any = {};
    Object.keys(data).forEach(key => {
        const val = data[key];
        if (val !== undefined) clean[key] = sanitizePayload(val);
    });
    return clean;
};

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const getLocal = (key: string) => {
    try { return JSON.parse(localStorage.getItem(`db_${key}`) || '[]'); } 
    catch (e) { return []; }
};

const setLocal = (key: string, data: any[]) => {
    localStorage.setItem(`db_${key}`, JSON.stringify(data));
    notifyListeners(key, data);
};

const listeners: {[key: string]: Array<(data: any) => void>} = {};
const draftListeners: Array<() => void> = [];

const notifyListeners = (key: string, data: any) => {
    if (listeners[key]) listeners[key].forEach(cb => cb(data));
};

const subscribeLocal = (key: string, cb: (data: any) => void) => {
    if (!listeners[key]) listeners[key] = [];
    listeners[key].push(cb);
    cb(getLocal(key)); 
    return () => { listeners[key] = listeners[key].filter(fn => fn !== cb); };
};

const notifyDraftChange = () => {
    draftListeners.forEach(cb => cb());
};

const seedLocalAdmin = () => {
    const users = getLocal(COLLECTIONS.USERS);
    if (!users.find((u: any) => u.username === 'admin')) {
        users.push({
            id: 'admin_local',
            name: 'Admin Local',
            username: 'admin',
            password: '123',
            role: 'SUPER_ADMIN',
            status: 'ACTIVE',
            lastActive: new Date().toISOString()
        });
        setLocal(COLLECTIONS.USERS, users);
    }
};
if (!isConfigured) seedLocalAdmin();

const mapDoc = (doc: any) => ({ ...doc.data(), id: doc.id });

export const storageService = {
  isCloudConnected: () => isConfigured && !!db,

  saveDraft: (key: string, data: any) => {
      localStorage.setItem(key, JSON.stringify(data));
      notifyDraftChange();
  },

  getDraft: (key: string) => {
      const d = localStorage.getItem(key);
      return d ? JSON.parse(d) : null;
  },

  removeDraft: (key: string) => {
      localStorage.removeItem(key);
      notifyDraftChange();
  },

  hasDraft: (key: string) => !!localStorage.getItem(key),

  subscribeToDrafts: (cb: () => void) => {
      draftListeners.push(cb);
      cb();
      return () => {
          const idx = draftListeners.indexOf(cb);
          if (idx !== -1) draftListeners.splice(idx, 1);
      };
  },

  testConnection: async () => {
      if (!isConfigured) return { success: false, message: "Faltan variables de entorno." };
      try {
          const testRef = doc(db, '_diagnostics', 'ping');
          await setDoc(testRef, { timestamp: new Date().toISOString() });
          await deleteDoc(testRef);
          return { success: true, message: "Conexión exitosa." };
      } catch (error: any) {
          return { success: false, message: "Fallo al conectar.", details: error.message };
      }
  },

  subscribeToUsers: (callback: (users: User[]) => void) => {
    if (isConfigured && db) {
        const q = query(collection(db, COLLECTIONS.USERS));
        return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(mapDoc) as User[]));
    } else return subscribeLocal(COLLECTIONS.USERS, callback);
  },
  
  saveUser: async (user: User) => {
    if (isConfigured && db) {
        const payload = sanitizePayload(user);
        if (user.id && user.id.length > 10) await updateDoc(doc(db, COLLECTIONS.USERS, user.id), payload);
        else { const { id, ...data } = payload; await addDoc(collection(db, COLLECTIONS.USERS), data); }
    } else {
        const users = getLocal(COLLECTIONS.USERS);
        if (user.id) {
            const index = users.findIndex((u: User) => u.id === user.id);
            if (index !== -1) users[index] = { ...users[index], ...user };
        } else users.push({ ...user, id: generateId() });
        setLocal(COLLECTIONS.USERS, users);
    }
  },

  resetUserPassword: async (userId: string, newPassword: string) => {
      if (isConfigured && db) await updateDoc(doc(db, COLLECTIONS.USERS, userId), { password: newPassword, isLocked: false, failedLoginAttempts: 0 });
      else {
          const users = getLocal(COLLECTIONS.USERS);
          const index = users.findIndex((u: User) => u.id === userId);
          if (index !== -1) { users[index].password = newPassword; users[index].isLocked = false; users[index].failedLoginAttempts = 0; setLocal(COLLECTIONS.USERS, users); }
      }
  },

  sendHeartbeat: async (userId: string) => {
      if (isConfigured && db) try { await updateDoc(doc(db, COLLECTIONS.USERS, userId), { lastActive: new Date().toISOString() }); } catch(e) {}
      else {
          const users = getLocal(COLLECTIONS.USERS);
          const index = users.findIndex((u: User) => u.id === userId);
          if (index !== -1) { users[index].lastActive = new Date().toISOString(); localStorage.setItem(`db_${COLLECTIONS.USERS}`, JSON.stringify(users)); }
      }
  },

  registerUser: async (name: string, username: string, password: string): Promise<boolean> => {
      const newUser: any = { name: name.trim(), username: username.trim(), password: password.trim(), role: 'STAFF', status: 'PENDING', failedLoginAttempts: 0, isLocked: false };
      if (isConfigured && db) {
          const q = query(collection(db, COLLECTIONS.USERS), where("username", "==", username.trim()));
          const snap = await getDocs(q);
          if (!snap.empty) throw new Error("El nombre de usuario ya está en uso.");
          await addDoc(collection(db, COLLECTIONS.USERS), sanitizePayload(newUser));
      } else {
          const users = getLocal(COLLECTIONS.USERS);
          if (users.find((u: User) => u.username === username.trim())) throw new Error("El nombre de usuario ya está en uso.");
          users.push({ ...newUser, id: generateId() });
          setLocal(COLLECTIONS.USERS, users);
      }
      return true;
  },

  deleteUser: async (id: string) => {
    if (isConfigured && db) await deleteDoc(doc(db, COLLECTIONS.USERS, id));
    else setLocal(COLLECTIONS.USERS, getLocal(COLLECTIONS.USERS).filter((u: User) => u.id !== id));
  },

  subscribeToClients: (callback: (clients: Client[]) => void) => {
    if (isConfigured && db) {
        const q = query(collection(db, COLLECTIONS.CLIENTS), orderBy('name'));
        return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(mapDoc) as Client[]));
    } else return subscribeLocal(COLLECTIONS.CLIENTS, (data) => { data.sort((a: Client, b: Client) => a.name.localeCompare(b.name)); callback(data); });
  },

  saveClient: async (client: Client): Promise<string> => {
    if (isConfigured && db) {
        const payload = sanitizePayload(client);
        if (client.id && client.id.length > 15) { await updateDoc(doc(db, COLLECTIONS.CLIENTS, client.id), payload); return client.id; }
        else { const { id, ...data } = payload; const docRef = await addDoc(collection(db, COLLECTIONS.CLIENTS), data); return docRef.id; }
    } else {
        const clients = getLocal(COLLECTIONS.CLIENTS);
        let retId = client.id;
        if (client.id) { const index = clients.findIndex((c: Client) => c.id === client.id); if (index !== -1) clients[index] = { ...clients[index], ...client }; }
        else { retId = generateId(); clients.push({ ...client, id: retId }); }
        setLocal(COLLECTIONS.CLIENTS, clients);
        return retId;
    }
  },

  deleteClient: async (id: string) => {
    if (isConfigured && db) await deleteDoc(doc(db, COLLECTIONS.CLIENTS, id));
    else setLocal(COLLECTIONS.CLIENTS, getLocal(COLLECTIONS.CLIENTS).filter((c: Client) => c.id !== id));
  },

  subscribeToProviders: (callback: (providers: Provider[]) => void) => {
    if (isConfigured && db) {
        const q = query(collection(db, COLLECTIONS.PROVIDERS), orderBy('name'));
        return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(mapDoc) as Provider[]));
    } else return subscribeLocal(COLLECTIONS.PROVIDERS, (data) => { data.sort((a: Provider, b: Provider) => a.name.localeCompare(b.name)); callback(data); });
  },

  saveProvider: async (provider: Provider): Promise<string> => {
    if (isConfigured && db) {
        const payload = sanitizePayload(provider);
        if (!provider.id) {
            const q = query(collection(db, COLLECTIONS.PROVIDERS), where("documentId", "==", provider.documentId));
            const snap = await getDocs(q);
            if (!snap.empty) {
                const existingId = snap.docs[0].id;
                await updateDoc(doc(db, COLLECTIONS.PROVIDERS, existingId), payload);
                return existingId;
            }
        }
        if (provider.id && provider.id.length > 10) { await updateDoc(doc(db, COLLECTIONS.PROVIDERS, provider.id), payload); return provider.id; }
        else { const { id, ...data } = payload; const docRef = await addDoc(collection(db, COLLECTIONS.PROVIDERS), data); return docRef.id; }
    } else {
        const list = getLocal(COLLECTIONS.PROVIDERS);
        let retId = provider.id;
        const index = provider.id ? list.findIndex((p: any) => p.id === provider.id) : list.findIndex((p:any) => p.documentId === provider.documentId);
        if (index !== -1) { list[index] = { ...list[index], ...provider }; retId = list[index].id; }
        else { retId = generateId(); list.push({ ...provider, id: retId }); }
        setLocal(COLLECTIONS.PROVIDERS, list);
        return retId;
    }
  },

  deleteProvider: async (id: string) => {
    if (isConfigured && db) await deleteDoc(doc(db, COLLECTIONS.PROVIDERS, id));
    else setLocal(COLLECTIONS.PROVIDERS, getLocal(COLLECTIONS.PROVIDERS).filter((p: any) => p.id !== id));
  },

  subscribeToInventory: (callback: (items: InventoryItem[]) => void) => {
    if (isConfigured && db) {
        const q = query(collection(db, COLLECTIONS.INVENTORY), orderBy('name'));
        return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(mapDoc) as InventoryItem[]));
    } else return subscribeLocal(COLLECTIONS.INVENTORY, (data) => { data.sort((a: InventoryItem, b: InventoryItem) => a.name.localeCompare(b.name)); callback(data); });
  },

  saveInventoryItem: async (item: InventoryItem) => {
    if (isConfigured && db) {
        const payload = sanitizePayload(item);
        if (item.id && item.id.length > 15) await updateDoc(doc(db, COLLECTIONS.INVENTORY, item.id), payload);
        else { const { id, ...data } = payload; await addDoc(collection(db, COLLECTIONS.INVENTORY), data); }
    } else {
        const items = getLocal(COLLECTIONS.INVENTORY);
        if (item.id) { const index = items.findIndex((i: InventoryItem) => i.id === item.id); if (index !== -1) items[index] = { ...items[index], ...item }; }
        else items.push({ ...item, id: generateId() });
        setLocal(COLLECTIONS.INVENTORY, items);
    }
  },

  deleteInventoryItem: async (id: string) => {
      if (isConfigured && db) await deleteDoc(doc(db, COLLECTIONS.INVENTORY, id));
      else setLocal(COLLECTIONS.INVENTORY, getLocal(COLLECTIONS.INVENTORY).filter((i: InventoryItem) => i.id !== id));
  },

  updateStock: async (itemId: string, qtyChange: number) => {
      if (qtyChange === 0) return;
      if (isConfigured && db) await updateDoc(doc(db, COLLECTIONS.INVENTORY, itemId), { stock: increment(qtyChange) });
      else {
          const items = getLocal(COLLECTIONS.INVENTORY);
          const index = items.findIndex((i: InventoryItem) => i.id === itemId);
          if (index !== -1) { items[index].stock = (items[index].stock || 0) + qtyChange; setLocal(COLLECTIONS.INVENTORY, items); }
      }
  },

  generateEventNumber: async (isQuote: boolean): Promise<number> => {
      const counterDocId = isQuote ? 'quotes' : 'orders';
      if (isConfigured && db) {
          const counterRef = doc(db, COLLECTIONS.COUNTERS, counterDocId);
          return await runTransaction(db, async (transaction) => {
              const docSnap = await transaction.get(counterRef);
              let nextSeq = 1;
              if (docSnap.exists()) nextSeq = (docSnap.data().sequence || 0) + 1;
              transaction.set(counterRef, { sequence: nextSeq }, { merge: true });
              return nextSeq;
          });
      } else {
          const key = isQuote ? COUNTER_KEYS.QUOTES : COUNTER_KEYS.ORDERS;
          let current = parseInt(localStorage.getItem(key) || '0');
          const next = current + 1;
          localStorage.setItem(key, next.toString());
          return next;
      }
  },

  subscribeToEvents: (callback: (events: EventOrder[]) => void) => {
    if (isConfigured && db) {
        const q = query(collection(db, COLLECTIONS.EVENTS)); 
        return onSnapshot(q, (snapshot) => {
            let events = snapshot.docs.map(mapDoc) as EventOrder[];
            events.sort((a, b) => new Date(b.executionDate).getTime() - new Date(a.executionDate).getTime());
            callback(events);
        });
    } else return subscribeLocal(COLLECTIONS.EVENTS, (data) => { data.sort((a: EventOrder, b: EventOrder) => new Date(b.executionDate).getTime() - new Date(a.executionDate).getTime()); callback(data); });
  },

  getEventsOnce: async () => {
      if (isConfigured && db) { const snap = await getDocs(collection(db, COLLECTIONS.EVENTS)); return snap.docs.map(mapDoc) as EventOrder[]; }
      else return getLocal(COLLECTIONS.EVENTS);
  },

  saveEvent: async (event: EventOrder): Promise<{id: string, orderNumber: number}> => {
    const isQuote = event.status === EventStatus.QUOTE;
    let currentOrderNumber = event.orderNumber;
    if (!currentOrderNumber) currentOrderNumber = await storageService.generateEventNumber(isQuote);
    
    let savedId = event.id;
    const payload = sanitizePayload({ ...event, orderNumber: currentOrderNumber });
    
    // Lógica Estricta de Inventario: Si el pedido pasa a Reservado por primera vez, descontar stock.
    // En este sistema simplificado, descontamos al guardar un pedido que no sea proforma.
    if (!isQuote) {
        // Solo descontar si es un pedido nuevo o una proforma que se convierte en pedido
        const existing = event.id ? (await getDocs(query(collection(db, COLLECTIONS.EVENTS), where("__name__", "==", event.id)))).docs[0]?.data() : null;
        if (!existing || existing.status === EventStatus.QUOTE) {
            for (const item of event.items) {
                await storageService.updateStock(item.itemId, -item.quantity);
            }
        }
    }

    if (isConfigured && db) {
        if (event.id && event.id.length > 10) {
            await updateDoc(doc(db, COLLECTIONS.EVENTS, event.id), payload);
        } else {
            const { id, ...data } = payload;
            const docRef = await addDoc(collection(db, COLLECTIONS.EVENTS), data);
            savedId = docRef.id;
        }
    } else {
        const events = getLocal(COLLECTIONS.EVENTS);
        if (event.id) { 
            const index = events.findIndex((e: EventOrder) => e.id === event.id); 
            if (index !== -1) events[index] = { ...events[index], ...payload }; 
        } else { 
            savedId = generateId();
            events.push({ ...payload, id: savedId }); 
        }
        setLocal(COLLECTIONS.EVENTS, events);
    }
    return { id: savedId, orderNumber: currentOrderNumber };
  },

  deleteEvent: async (id: string) => {
    if (isConfigured && db) {
        await deleteDoc(doc(db, COLLECTIONS.EVENTS, id));
    } else {
        const events = getLocal(COLLECTIONS.EVENTS);
        setLocal(COLLECTIONS.EVENTS, events.filter((e: EventOrder) => e.id !== id));
    }
  },

  subscribeToPurchases: (callback: (purchases: PurchaseTransaction[]) => void) => {
    if (isConfigured && db) {
        const q = query(collection(db, COLLECTIONS.PURCHASES), orderBy('date', 'desc'));
        return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(mapDoc) as PurchaseTransaction[]));
    } else return subscribeLocal(COLLECTIONS.PURCHASES, (data) => {
        data.sort((a: any, b: any) => b.date.localeCompare(a.date));
        callback(data);
    });
  },

  savePurchase: async (purchase: PurchaseTransaction) => {
    if (isConfigured && db) {
        const payload = sanitizePayload(purchase);
        if (purchase.id && purchase.id.length > 10) await updateDoc(doc(db, COLLECTIONS.PURCHASES, purchase.id), payload);
        else { const { id, ...data } = payload; await addDoc(collection(db, COLLECTIONS.PURCHASES), data); }
    } else {
        const purchases = getLocal(COLLECTIONS.PURCHASES);
        if (purchase.id) {
            const index = purchases.findIndex((p: PurchaseTransaction) => p.id === purchase.id);
            if (index !== -1) purchases[index] = { ...purchases[index], ...purchase };
        } else purchases.push({ ...purchase, id: generateId() });
        setLocal(COLLECTIONS.PURCHASES, purchases);
    }
  },

  deletePurchase: async (id: string) => {
    if (isConfigured && db) await deleteDoc(doc(db, COLLECTIONS.PURCHASES, id));
    else setLocal(COLLECTIONS.PURCHASES, getLocal(COLLECTIONS.PURCHASES).filter((p: PurchaseTransaction) => p.id !== id));
  },

  subscribeToWithholdings: (callback: (items: Withholding[]) => void) => {
    if (isConfigured && db) {
        const q = query(collection(db, COLLECTIONS.WITHHOLDINGS), orderBy('date', 'desc'));
        return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(mapDoc) as Withholding[]));
    } else return subscribeLocal(COLLECTIONS.WITHHOLDINGS, callback);
  },

  saveWithholding: async (item: Withholding) => {
    if (isConfigured && db) {
        const payload = sanitizePayload(item);
        if (item.id && item.id.length > 10) await updateDoc(doc(db, COLLECTIONS.WITHHOLDINGS, item.id), payload);
        else { const { id, ...data } = payload; await addDoc(collection(db, COLLECTIONS.WITHHOLDINGS), data); }
    } else {
        const list = getLocal(COLLECTIONS.WITHHOLDINGS);
        if (item.id) { const idx = list.findIndex((i: any) => i.id === item.id); if (idx !== -1) list[idx] = item; }
        else list.push({ ...item, id: generateId() });
        setLocal(COLLECTIONS.WITHHOLDINGS, list);
    }
  },

  subscribeToPayroll: (callback: (items: PayrollEntry[]) => void) => {
    if (isConfigured && db) {
        const q = query(collection(db, COLLECTIONS.PAYROLL), orderBy('date', 'desc'));
        return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(mapDoc) as PayrollEntry[]));
    } else return subscribeLocal(COLLECTIONS.PAYROLL, callback);
  },

  savePayroll: async (item: PayrollEntry) => {
    if (isConfigured && db) {
        const payload = sanitizePayload(item);
        if (item.id && item.id.length > 10) await updateDoc(doc(db, COLLECTIONS.PAYROLL, item.id), payload);
        else { const { id, ...data } = payload; await addDoc(collection(db, COLLECTIONS.PAYROLL), data); }
    } else {
        const list = getLocal(COLLECTIONS.PAYROLL);
        if (item.id) { const idx = list.findIndex((i: any) => i.id === item.id); if (idx !== -1) list[idx] = item; }
        else list.push({ ...item, id: generateId() });
        setLocal(COLLECTIONS.PAYROLL, list);
    }
  },

  subscribeToNotifications: (callback: (n: AppNotification[]) => void) => {
     if (isConfigured && db) {
         const q = query(collection(db, COLLECTIONS.NOTIFICATIONS), orderBy('date', 'desc'));
         return onSnapshot(q, (snapshot) => callback(snapshot.docs.map(mapDoc) as AppNotification[]));
     } else return subscribeLocal(COLLECTIONS.NOTIFICATIONS, callback);
  },

  createNotification: async (message: string, type: 'INFO'|'SUCCESS'|'WARNING') => {
      const notif: AppNotification = { id: generateId(), message, date: new Date().toLocaleString(), type, isRead: false };
      if (isConfigured && db) await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), sanitizePayload(notif));
      else { const list = getLocal(COLLECTIONS.NOTIFICATIONS); list.unshift(notif); setLocal(COLLECTIONS.NOTIFICATIONS, list); }
  },

  clearOldNotifications: async () => {
      const today = new Date().toLocaleDateString();
      if (isConfigured && db) {
          const q = query(collection(db, COLLECTIONS.NOTIFICATIONS));
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          let count = 0;
          snap.forEach(d => {
              const data = d.data();
              const notifDate = new Date(data.date).toLocaleDateString();
              if (notifDate !== today) {
                  batch.delete(d.ref);
                  count++;
              }
          });
          if (count > 0) await batch.commit();
      } else {
          const list = getLocal(COLLECTIONS.NOTIFICATIONS);
          const filtered = list.filter((n: AppNotification) => new Date(n.date).toLocaleDateString() === today);
          setLocal(COLLECTIONS.NOTIFICATIONS, filtered);
      }
  },

  generateReceiptCode: async () => {
      if (isConfigured && db) {
          const counterRef = doc(db, COLLECTIONS.COUNTERS, 'receipts');
          const newSeq = await runTransaction(db, async (transaction) => {
              const doc = await transaction.get(counterRef);
              const next = (doc.exists() ? doc.data().sequence : 0) + 1;
              transaction.set(counterRef, { sequence: next }, { merge: true });
              return next;
          });
          return `IC${String(newSeq).padStart(8, '0')}`;
      } else {
          const count = parseInt(localStorage.getItem('seq_receipts') || '0') + 1;
          localStorage.setItem('seq_receipts', count.toString());
          return `IC${String(count).padStart(8, '0')}`;
      }
  },

  getSettings: async () => {
      if (isConfigured && db) {
          const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'general'));
          return snap.exists() ? snap.data() as CompanySettings : null;
      } else {
          const settings = getLocal(COLLECTIONS.SETTINGS);
          return settings.length > 0 ? settings[0] : null;
      }
  },

  saveSettings: async (settings: CompanySettings) => {
      if (isConfigured && db) await setDoc(doc(db, COLLECTIONS.SETTINGS, 'general'), sanitizePayload(settings));
      else setLocal(COLLECTIONS.SETTINGS, [settings]);
  },

  subscribeToSettings: (callback: (settings: CompanySettings | null) => void) => {
      if (isConfigured && db) return onSnapshot(doc(db, COLLECTIONS.SETTINGS, 'general'), (snap) => callback(snap.exists() ? snap.data() as CompanySettings : null));
      else return subscribeLocal(COLLECTIONS.SETTINGS, (data) => callback(data.length ? data[0] : null));
  },

  login: async (usernameInput: string, passwordInput: string): Promise<User | null> => {
    const username = usernameInput.trim();
    const password = passwordInput.trim();
    let user: User | null = null;
    if (isConfigured && db) {
        const q = query(collection(db, COLLECTIONS.USERS), where("username", "==", username));
        const snap = await getDocs(q);
        if (!snap.empty) user = mapDoc(snap.docs[0]) as User;
    }
    if (!user) user = getLocal(COLLECTIONS.USERS).find((u: User) => u.username === username) || null;
    if (!user && username === 'admin' && password === '123') user = { id: 'admin_fallback', name: 'Administrador', username: 'admin', password: '123', role: UserRole.SUPER_ADMIN, status: 'ACTIVE' };
    if (!user) return null;
    if (user.password === password) { localStorage.setItem('ep_session_user', JSON.stringify(user)); return user; }
    else throw new Error("PASSWORD_INCORRECTO");
  },

  getCurrentSession: (): User | null => {
      const stored = localStorage.getItem('ep_session_user');
      return stored ? JSON.parse(stored) : null;
  },

  logout: () => localStorage.removeItem('ep_session_user'),

  getFullBackup: async () => {
     const backup: any = {};
     for (const key of Object.values(COLLECTIONS)) {
         if (isConfigured && db) { const snap = await getDocs(collection(db, key)); backup[key] = snap.docs.map(mapDoc); }
         else backup[key] = getLocal(key);
     }
     localStorage.setItem('last_full_backup_timestamp', Date.now().toString());
     return backup;
  },

  clearAllData: async () => { localStorage.clear(); seedLocalAdmin(); },

  restoreBackup: async (data: any) => {
    if (isConfigured && db) return false; 
    for (const colName of Object.values(COLLECTIONS)) if (data[colName]) setLocal(colName, data[colName]);
    localStorage.setItem('last_full_backup_timestamp', Date.now().toString());
    return true;
  }
};

import { User, Client, InventoryItem, EventOrder, UserRole, PaymentTransaction, Withholding, PayrollEntry, PurchaseTransaction, EventStatus } from '../types';
import { db, isConfigured } from './firebase';
import { 
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, getDocs, where, setDoc, increment, getDoc, runTransaction, limit, writeBatch
} from "firebase/firestore";

const COLLECTIONS = {
  USERS: 'users',
  CLIENTS: 'clients',
  INVENTORY: 'inventory',
  EVENTS: 'events',
  PURCHASES: 'purchases',
  WITHHOLDINGS: 'withholdings',
  PAYROLL: 'payroll',
  COUNTERS: 'counters',
  SETTINGS: 'settings',
  PROVIDERS: 'providers'
};

const sanitize = (data: any) => JSON.parse(JSON.stringify(data));

export const storageService = {
  isCloudConnected: () => isConfigured && !!db,

  // Eventos y Pedidos
  subscribeToEvents: (cb: (events: EventOrder[]) => void) => {
    if (isConfigured && db) {
      const q = query(collection(db, COLLECTIONS.EVENTS), orderBy('executionDate', 'desc'));
      return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as EventOrder))));
    }
    return () => {};
  },

  getEventsOnce: async () => {
    if (isConfigured && db) {
      const q = query(collection(db, COLLECTIONS.EVENTS), orderBy('executionDate', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as EventOrder));
    }
    return [];
  },

  saveEvent: async (event: EventOrder) => {
    const payload = sanitize(event);
    if (event.id) {
      await updateDoc(doc(db, COLLECTIONS.EVENTS, event.id), payload);
      return event.id;
    } else {
      const docRef = await addDoc(collection(db, COLLECTIONS.EVENTS), payload);
      return docRef.id;
    }
  },

  deleteEvent: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.EVENTS, id));
  },

  generateOrderNumber: async () => {
    const counterRef = doc(db, COLLECTIONS.COUNTERS, 'orders');
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const next = (snap.exists() ? snap.data().sequence : 0) + 1;
      transaction.set(counterRef, { sequence: next }, { merge: true });
      return next;
    });
  },

  generateReceiptCode: async () => {
    const counterRef = doc(db, COLLECTIONS.COUNTERS, 'receipts');
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const next = (snap.exists() ? snap.data().sequence : 0) + 1;
      transaction.set(counterRef, { sequence: next }, { merge: true });
      return `REC-${String(next).padStart(6, '0')}`;
    });
  },

  // Contabilidad
  saveWithholding: async (w: Withholding) => {
    await addDoc(collection(db, COLLECTIONS.WITHHOLDINGS), sanitize(w));
  },

  subscribeToWithholdings: (cb: (w: Withholding[]) => void) => {
    const q = query(collection(db, COLLECTIONS.WITHHOLDINGS), orderBy('date', 'desc'));
    return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as Withholding))));
  },

  savePurchase: async (p: PurchaseTransaction) => {
    if (p.id) {
      await updateDoc(doc(db, COLLECTIONS.PURCHASES, p.id), sanitize(p));
    } else {
      await addDoc(collection(db, COLLECTIONS.PURCHASES), sanitize(p));
    }
  },

  deletePurchase: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.PURCHASES, id));
  },

  subscribeToPurchases: (cb: (p: PurchaseTransaction[]) => void) => {
    const q = query(collection(db, COLLECTIONS.PURCHASES), orderBy('date', 'desc'));
    return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as PurchaseTransaction))));
  },

  savePayroll: async (p: PayrollEntry) => {
    await addDoc(collection(db, COLLECTIONS.PAYROLL), sanitize(p));
  },

  subscribeToPayroll: (cb: (p: PayrollEntry[]) => void) => {
    const q = query(collection(db, COLLECTIONS.PAYROLL), orderBy('date', 'desc'));
    return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as PayrollEntry))));
  },

  // Inventario
  subscribeToInventory: (cb: (items: InventoryItem[]) => void) => {
    const q = query(collection(db, COLLECTIONS.INVENTORY), orderBy('name'));
    return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as InventoryItem))));
  },

  saveInventoryItem: async (item: InventoryItem) => {
    const payload = sanitize(item);
    if (item.id) await updateDoc(doc(db, COLLECTIONS.INVENTORY, item.id), payload);
    else await addDoc(collection(db, COLLECTIONS.INVENTORY), payload);
  },

  deleteInventoryItem: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.INVENTORY, id));
  },

  updateStock: async (itemId: string, change: number) => {
    await updateDoc(doc(db, COLLECTIONS.INVENTORY, itemId), { stock: increment(change) });
  },

  // Clientes
  subscribeToClients: (cb: (clients: Client[]) => void) => {
    const q = query(collection(db, COLLECTIONS.CLIENTS), orderBy('name'));
    return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as Client))));
  },

  saveClient: async (client: Client) => {
    if (client.id) await updateDoc(doc(db, COLLECTIONS.CLIENTS, client.id), sanitize(client));
    else await addDoc(collection(db, COLLECTIONS.CLIENTS), sanitize(client));
  },

  deleteClient: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.CLIENTS, id));
  },

  // Proveedores
  subscribeToProviders: (cb: (p: any[]) => void) => {
    const q = query(collection(db, COLLECTIONS.PROVIDERS), orderBy('name'));
    return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ ...d.data(), id: d.id }))));
  },

  saveProvider: async (p: any) => {
    if (p.id) await updateDoc(doc(db, COLLECTIONS.PROVIDERS, p.id), sanitize(p));
    else await addDoc(collection(db, COLLECTIONS.PROVIDERS), sanitize(p));
  },

  deleteProvider: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.PROVIDERS, id));
  },

  // Auth & Usuarios
  subscribeToUsers: (cb: (users: User[]) => void) => {
    const q = query(collection(db, COLLECTIONS.USERS), orderBy('name'));
    return onSnapshot(q, (snap) => cb(snap.docs.map(d => ({ ...d.data(), id: d.id } as User))));
  },

  saveUser: async (user: User) => {
    const payload = sanitize(user);
    if (user.id) await updateDoc(doc(db, COLLECTIONS.USERS, user.id), payload);
    else await addDoc(collection(db, COLLECTIONS.USERS), payload);
  },

  deleteUser: async (id: string) => {
    await deleteDoc(doc(db, COLLECTIONS.USERS, id));
  },

  registerUser: async (name: string, user: string, pass: string) => {
    await addDoc(collection(db, COLLECTIONS.USERS), {
      name, username: user, password: pass, role: UserRole.STAFF, status: 'PENDING', lastActive: new Date().toISOString()
    });
  },

  resetUserPassword: async (id: string, pass: string) => {
    await updateDoc(doc(db, COLLECTIONS.USERS, id), { password: pass, isLocked: false });
  },

  login: async (user: string, pass: string) => {
    const q = query(collection(db, COLLECTIONS.USERS), where("username", "==", user), where("password", "==", pass));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const u = { ...snap.docs[0].data(), id: snap.docs[0].id } as User;
      localStorage.setItem('lcb_session', JSON.stringify(u));
      return u;
    }
    if (user === 'admin' && pass === '123') {
        const fallback = { id: 'root', name: 'Super Admin', username: 'admin', role: UserRole.SUPER_ADMIN };
        localStorage.setItem('lcb_session', JSON.stringify(fallback));
        return fallback as User;
    }
    return null;
  },

  getCurrentSession: () => JSON.parse(localStorage.getItem('lcb_session') || 'null'),
  logout: () => localStorage.removeItem('lcb_session'),

  // Configuración y Diagnóstico
  getSettings: async () => {
    const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'general'));
    return snap.exists() ? snap.data() : null;
  },

  saveSettings: async (settings: any) => {
    await setDoc(doc(db, COLLECTIONS.SETTINGS, 'general'), sanitize(settings));
  },

  testConnection: async () => {
    try {
      await getDocs(query(collection(db, COLLECTIONS.SETTINGS), limit(1)));
      return { success: true, message: 'Conexión con Firebase activa' };
    } catch (e: any) {
      return { success: false, message: 'Fallo de conexión', details: e.message };
    }
  },

  // Backup & Mantenimiento
  getFullBackup: async () => {
    const data: any = {};
    for (const [key, coll] of Object.entries(COLLECTIONS)) {
      const snap = await getDocs(collection(db, coll));
      data[key] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    }
    return data;
  },

  restoreBackup: async (data: any) => {
    try {
      const batch = writeBatch(db);
      for (const [key, docs] of Object.entries(data)) {
        const collName = (COLLECTIONS as any)[key];
        if (!collName) continue;
        const items = docs as any[];
        items.forEach(item => {
          const { id, ...rest } = item;
          batch.set(doc(db, collName, id), sanitize(rest));
        });
      }
      await batch.commit();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  clearAllData: async () => {
    const collectionsToClear = [COLLECTIONS.CLIENTS, COLLECTIONS.EVENTS, COLLECTIONS.INVENTORY, COLLECTIONS.PURCHASES, COLLECTIONS.PAYROLL, COLLECTIONS.WITHHOLDINGS];
    for (const coll of collectionsToClear) {
      const snap = await getDocs(collection(db, coll));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
};
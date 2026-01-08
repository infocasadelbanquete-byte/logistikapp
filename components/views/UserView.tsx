import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const UserView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({ name: '', username: '', password: '', role: UserRole.STAFF, status: 'ACTIVE' });
  const [approvalUser, setApprovalUser] = useState<User | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{show: boolean, user: User | null}>({ show: false, user: null });
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsub = storageService.subscribeToUsers(setUsers);
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => { unsub(); clearInterval(interval); }
  }, []);

  const handleCreateNew = () => { setEditingId(null); setFormData({ name: '', username: '', password: '', role: UserRole.STAFF, status: 'ACTIVE' }); setIsModalOpen(true); };
  const handleEdit = (user: User) => { setEditingId(user.id); setFormData({ name: user.name, username: user.username, password: user.password, role: user.role, status: user.status || 'ACTIVE' }); setIsModalOpen(true); };
  
  const confirmDeleteUser = (user: User) => { setDeleteConfirmation({ show: true, user: user }); };
  const handleProcessDelete = async () => { if (deleteConfirmation.user) { await storageService.deleteUser(deleteConfirmation.user.id); setDeleteConfirmation({ show: false, user: null }); } };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.username && formData.password) {
      const userToSave: User = { id: editingId || '', name: formData.name, username: formData.username, password: formData.password, role: formData.role as UserRole, status: formData.status as any || 'ACTIVE', lastActive: editingId ? undefined : new Date().toISOString() };
      await storageService.saveUser(userToSave);
      setIsModalOpen(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
    } else {
        await uiService.alert("Error", "Todos los campos son obligatorios");
    }
  };

  const handleOpenApproval = (user: User) => setApprovalUser(user);
  const confirmApproval = async (role: UserRole) => {
      if (!approvalUser) return;
      await storageService.saveUser({ ...approvalUser, role, status: 'ACTIVE' });
      setApprovalUser(null);
      await uiService.alert("Aprobado", `Usuario ${approvalUser.name} aprobado.`);
  };

  const isUserOnline = (lastActive?: string) => { if (!lastActive) return false; return (Date.now() - new Date(lastActive).getTime()) < 5 * 60 * 1000; };
  const getRelativeTime = (dateStr?: string) => { if (!dateStr) return 'Nunca'; const diffSeconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000); if (diffSeconds < 60) return 'Hace un momento'; if (diffSeconds < 3600) return `Hace ${Math.floor(diffSeconds / 60)} min`; return new Date(dateStr).toLocaleDateString(); };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const pendingUsers = filteredUsers.filter(u => u.status === 'PENDING');
  const lockedUsers = filteredUsers.filter(u => u.isLocked);
  const activeUsers = filteredUsers.filter(u => u.status !== 'PENDING' && !u.isLocked); 

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
           {isModalOpen && <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 bg-white shadow-soft rounded-full flex items-center justify-center text-zinc-400">←</button>}
           <h2 className="text-2xl font-black text-brand-900 uppercase">Gestión de Accesos</h2>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
           <div className="relative flex-1 md:w-64">
              <input className="w-full h-10 bg-white border border-zinc-100 rounded-xl px-10 text-[10px] font-black outline-none shadow-soft" placeholder="Buscar usuario..." value={search} onChange={e => setSearch(e.target.value)} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
           </div>
           <button onClick={handleCreateNew} className="h-10 px-6 bg-brand-900 text-white rounded-xl text-[9px] font-black uppercase shadow-lg">+ Usuario</button>
        </div>
      </div>

      {pendingUsers.length > 0 && (<div className="bg-yellow-50 border-2 border-yellow-300 rounded-[2rem] p-6 shadow-premium"><h3 className="text-sm font-black text-yellow-800 mb-4 flex items-center gap-2"><span>🔔</span> Solicitudes Pendientes ({pendingUsers.length})</h3><div className="bg-white rounded-2xl shadow overflow-hidden"><table className="min-w-full"><thead className="bg-zinc-50 border-b"><tr><th className="px-6 py-4 text-left text-[8px] font-black text-zinc-400 uppercase">Nombre</th><th className="px-6 py-4 text-right text-[8px] font-black text-zinc-400 uppercase">Acción</th></tr></thead><tbody className="divide-y divide-zinc-50">{pendingUsers.map(u => (<tr key={u.id} className="hover:bg-zinc-50/50"><td className="px-6 py-4 text-[10px] font-bold">{u.name}</td><td className="px-6 py-4 text-right"><button onClick={() => handleOpenApproval(u)} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-[8px] font-black uppercase shadow-sm">Revisar</button></td></tr>))}</tbody></table></div></div>)}

      <div className="bg-white rounded-[2.5rem] shadow-premium border border-zinc-100 overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-zinc-50 border-b"><tr><th className="px-6 py-4 text-left text-[8px] font-black text-zinc-400 uppercase">Estado</th><th className="px-6 py-4 text-left text-[8px] font-black text-zinc-400 uppercase">Nombre / Usuario</th><th className="px-6 py-4 text-left text-[8px] font-black text-zinc-400 uppercase">Rol Asignado</th><th className="px-6 py-4 text-right text-[8px] font-black text-zinc-400 uppercase">Acciones</th></tr></thead>
          <tbody className="divide-y divide-zinc-50">{activeUsers.map((user) => (<tr key={user.id} className="hover:bg-zinc-50/50 transition-colors"><td className="px-6 py-4">{isUserOnline(user.lastActive) ? (<div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500"></span><span className="text-[9px] font-black text-emerald-700 uppercase">Online</span></div>) : (<div className="text-[8px] text-zinc-300 font-bold uppercase">{getRelativeTime(user.lastActive)}</div>)}</td><td className="px-6 py-4"><div className="text-[10px] font-black text-zinc-950 uppercase">{user.name}</div><div className="text-[8px] font-mono text-zinc-400">@{user.username}</div></td><td className="px-6 py-4"><span className={`px-2 py-0.5 rounded-full text-[7px] font-black uppercase ${user.role === UserRole.SUPER_ADMIN ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>{user.role}</span></td><td className="px-6 py-4 text-right whitespace-nowrap">{user.username !== 'admin' && (<div className="flex justify-end gap-2"><button onClick={() => handleEdit(user)} className="text-blue-500 text-[10px] font-black">EDITAR</button><button onClick={() => confirmDeleteUser(user)} className="text-rose-300 text-[10px] font-black">BORRAR</button></div>)}</td></tr>))}</tbody>
        </table>
      </div>

      {isModalOpen && (<div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div className="bg-white rounded-[2rem] shadow-premium w-full max-w-sm p-8 animate-slide-up"><h3 className="text-lg font-black text-brand-950 uppercase mb-6 tracking-tighter">{editingId ? 'Modificar Perfil' : 'Alta de Usuario'}</h3><form onSubmit={handleSubmit} className="space-y-4"><div><label className="text-[8px] font-black text-zinc-400 uppercase px-2 mb-1 block">Nombre Completo</label><input className="w-full bg-zinc-50 rounded-xl h-12 px-4 text-xs font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div><div><label className="text-[8px] font-black text-zinc-400 uppercase px-2 mb-1 block">Nombre de Usuario</label><input className="w-full bg-zinc-50 rounded-xl h-12 px-4 text-xs font-bold" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required disabled={!!editingId} /></div><div><label className="text-[8px] font-black text-zinc-400 uppercase px-2 mb-1 block">Contraseña de Acceso</label><input className="w-full bg-zinc-50 rounded-xl h-12 px-4 text-xs font-bold" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required /></div><div><label className="text-[8px] font-black text-zinc-400 uppercase px-2 mb-1 block">Nivel de Permisos</label><select className="w-full bg-zinc-50 rounded-xl h-12 px-4 text-[10px] font-black outline-none" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}><option value={UserRole.STAFF}>Personal Operativo</option><option value={UserRole.ADMIN}>Administración</option><option value={UserRole.SUPER_ADMIN}>Gerencia Total</option></select></div><div className="flex gap-3 pt-4"><button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 text-zinc-300 font-black uppercase text-[9px]">Atrás</button><button type="submit" className="flex-2 h-14 bg-brand-900 text-white rounded-xl font-black uppercase text-[9px] shadow-lg">Guardar Cambios</button></div></form></div></div>)}
      {approvalUser && (<div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-md flex items-center justify-center p-4 z-50"><div className="bg-white rounded-[2rem] shadow-premium w-full max-w-sm p-10 animate-slide-up"><h3 className="text-xl font-black text-zinc-950 uppercase mb-2">Aprobar Perfil</h3><p className="text-[10px] font-bold text-zinc-400 mb-6 uppercase">Solicitante: {approvalUser.name}</p><div className="space-y-3"><button onClick={() => confirmApproval(UserRole.STAFF)} className="w-full text-left p-4 bg-zinc-50 rounded-2xl hover:bg-zinc-100 transition-all font-black text-[10px] uppercase">Persona Operativo</button><button onClick={() => confirmApproval(UserRole.ADMIN)} className="w-full text-left p-4 bg-zinc-50 rounded-2xl hover:bg-zinc-100 transition-all font-black text-[10px] uppercase">Administración</button><button onClick={() => confirmApproval(UserRole.SUPER_ADMIN)} className="w-full text-left p-4 bg-brand-900 text-white rounded-2xl font-black text-[10px] uppercase">Gerencia Pro</button></div><div className="mt-8 pt-4 border-t flex justify-between"><button onClick={() => setApprovalUser(null)} className="text-zinc-300 font-black uppercase text-[9px]">Cancelar</button></div></div></div>)}
    </div>
  );
};

export default UserView;
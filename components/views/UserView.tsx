import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../../types';
import { storageService } from '../../services/storageService';
import { uiService } from '../../services/uiService';

const UserView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      setFormData({ name: '', username: '', password: '', role: UserRole.STAFF, status: 'ACTIVE' });
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
      await uiService.alert("Aprobado", `Usuario ${approvalUser.name} aprobado con rol ${role}.`);
  };

  const rejectRequest = async () => {
      if (!approvalUser) return;
      if (await uiService.confirm("Rechazar", "¿Rechazar y eliminar la solicitud de registro?")) {
          await storageService.deleteUser(approvalUser.id);
          setApprovalUser(null);
      }
  };

  const handleResetPassword = async (user: User) => {
      const newPassword = Math.random().toString(36).slice(-8);
      if(await uiService.confirm("Restablecer", `Se generará la nueva contraseña: "${newPassword}"\n\n¿Confirmar restablecimiento y desbloqueo para ${user.name}?`)) {
          await storageService.resetUserPassword(user.id, newPassword);
          await uiService.alert("Éxito", `Contraseña restablecida correctamente.\n\nNueva Contraseña: ${newPassword}\n\nPor favor comuníquela al usuario.`);
      }
  };

  const isUserOnline = (lastActive?: string) => { if (!lastActive) return false; return (Date.now() - new Date(lastActive).getTime()) < 5 * 60 * 1000; };
  const getRelativeTime = (dateStr?: string) => { if (!dateStr) return 'Nunca'; const diffSeconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000); if (diffSeconds < 60) return 'Hace un momento'; if (diffSeconds < 3600) return `Hace ${Math.floor(diffSeconds / 60)} min`; if (diffSeconds < 86400) return `Hace ${Math.floor(diffSeconds / 3600)} horas`; return new Date(dateStr).toLocaleDateString(); };

  const pendingUsers = users.filter(u => u.status === 'PENDING');
  const lockedUsers = users.filter(u => u.isLocked);
  const activeUsers = users.filter(u => u.status !== 'PENDING' && !u.isLocked); 

  return (
    <div className="space-y-8">
      {/* ... (Existing JSX Logic for tables, but replace modal calls) */}
      {/* PENDING REQUESTS SECTION */}
      {pendingUsers.length > 0 && (<div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 shadow animate-fade-in"><h3 className="text-lg font-bold text-yellow-800 mb-4 flex items-center gap-2"><span>🔔</span> Solicitudes de Registro Pendientes ({pendingUsers.length})</h3><div className="bg-white rounded shadow overflow-hidden"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-100"><tr><th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Nombre</th><th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Usuario</th><th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">Acción</th></tr></thead><tbody className="divide-y divide-gray-100">{pendingUsers.map(u => (<tr key={u.id}><td className="px-4 py-3 text-sm">{u.name}</td><td className="px-4 py-3 text-sm text-gray-500">{u.username}</td><td className="px-4 py-3 text-right"><button onClick={() => handleOpenApproval(u)} className="bg-green-600 text-white px-3 py-1 rounded text-xs font-bold shadow hover:bg-green-700 mr-2">Revisar</button></td></tr>))}</tbody></table></div></div>)}
      {/* LOCKED ACCOUNTS */}
      {lockedUsers.length > 0 && (<div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 shadow animate-fade-in"><h3 className="text-lg font-bold text-red-800 mb-4 flex items-center gap-2"><span>🔒</span> Alertas de Seguridad: Cuentas Bloqueadas ({lockedUsers.length})</h3><p className="text-sm text-red-600 mb-3">Estos usuarios han excedido el límite de intentos de contraseña. Se requiere acción del administrador.</p><div className="bg-white rounded shadow overflow-hidden"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-100"><tr><th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Nombre</th><th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">Usuario</th><th className="px-4 py-2 text-right text-xs font-bold text-gray-600 uppercase">Acción</th></tr></thead><tbody className="divide-y divide-gray-100">{lockedUsers.map(u => (<tr key={u.id}><td className="px-4 py-3 text-sm">{u.name}</td><td className="px-4 py-3 text-sm text-gray-500">{u.username}</td><td className="px-4 py-3 text-right"><button onClick={() => handleResetPassword(u)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold shadow hover:bg-blue-700 flex items-center gap-1 ml-auto">🔓 Restablecer Contraseña</button></td></tr>))}</tbody></table></div></div>)}
      {/* ACTIVE USERS SECTION */}
      <div><div className="flex justify-between items-center mb-4"><div><h2 className="text-2xl font-bold text-gray-800">Usuarios Activos</h2><p className="text-gray-500 text-sm">Personal con acceso al sistema.</p></div><button onClick={handleCreateNew} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded shadow flex items-center gap-2"><span>+</span> Crear Manualmente</button></div><div className="bg-white shadow rounded-lg overflow-hidden"><table className="min-w-full divide-y divide-gray-200"><thead className="bg-gray-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuario</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{activeUsers.map((user) => (<tr key={user.id}><td className="px-6 py-4 whitespace-nowrap">{isUserOnline(user.lastActive) ? (<div className="flex items-center gap-1.5"><div className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span></div><span className="text-xs font-bold text-green-700">En Línea</span></div>) : (<div className="text-xs text-gray-400"><span className="block">Desconectado</span><span className="text-[10px]">{getRelativeTime(user.lastActive)}</span></div>)}</td><td className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{user.name}</div></td><td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">{user.username}</div></td><td className="px-6 py-4 whitespace-nowrap"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === UserRole.SUPER_ADMIN ? 'bg-purple-100 text-purple-800 border border-purple-300' : user.role === UserRole.ADMIN ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>{user.role === UserRole.SUPER_ADMIN ? 'ADMIN TOTAL' : user.role === UserRole.ADMIN ? 'ADMIN SECUNDARIO' : 'PERSONAL'}</span></td><td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">{user.username !== 'admin' && (<div className="flex justify-end gap-2"><button onClick={() => handleEdit(user)} className="text-blue-600 hover:text-blue-900">Editar</button><button onClick={() => confirmDeleteUser(user)} className="text-red-600 hover:text-red-900">Eliminar</button></div>)}{user.username === 'admin' && <span className="text-xs text-gray-400 italic">Sistema</span>}</td></tr>))}</tbody></table></div></div>
      {/* ... Modals (Create/Edit, Approval, Success, Delete) ... */}
      {isModalOpen && (<div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6"><h3 className="text-lg font-bold mb-4">{editingId ? 'Editar Usuario' : 'Crear Usuario'}</h3><form onSubmit={handleSubmit} className="space-y-4"><div><label className="block text-sm font-medium text-gray-700">Nombre Completo</label><input placeholder="Ej. María López" className="w-full border p-2 rounded mt-1" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div><div><label className="block text-sm font-medium text-gray-700">Nombre de Usuario (Login)</label><input placeholder="usuario123" className="w-full border p-2 rounded mt-1" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required disabled={!!editingId} /></div><div><label className="block text-sm font-medium text-gray-700">Contraseña</label><input type="text" placeholder="Contraseña" className="w-full border p-2 rounded mt-1" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required /></div><div><label className="block text-sm font-medium text-gray-700 mb-1">Rol de Acceso</label><select className="w-full border p-2 rounded" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}><option value={UserRole.STAFF}>Personal (Básico)</option><option value={UserRole.ADMIN}>Admin Secundario (Gestión)</option><option value={UserRole.SUPER_ADMIN}>Admin Total (Dueño)</option></select></div><div className="flex justify-end gap-2 mt-4 pt-4 border-t"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Cancelar</button><button type="submit" className="px-4 py-2 bg-brand-600 text-white rounded hover:bg-brand-700 font-bold">{editingId ? 'Guardar Cambios' : 'Crear Usuario'}</button></div></form></div></div>)}
      {approvalUser && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50"><div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6"><h3 className="text-xl font-bold text-gray-800 mb-2">Aprobar Solicitud</h3><div className="bg-gray-50 p-3 rounded mb-4 text-sm"><p><strong>Solicitante:</strong> {approvalUser.name}</p><p><strong>Usuario:</strong> {approvalUser.username}</p></div><p className="text-sm text-gray-600 mb-3">Seleccione el rol para conceder acceso:</p><div className="space-y-2"><button onClick={() => confirmApproval(UserRole.STAFF)} className="w-full text-left px-4 py-3 border rounded hover:bg-green-50 hover:border-green-500 font-bold text-gray-700 flex justify-between"><span>👤 Personal (Básico)</span><span className="text-green-600">Conceder</span></button><button onClick={() => confirmApproval(UserRole.ADMIN)} className="w-full text-left px-4 py-3 border rounded hover:bg-blue-50 hover:border-blue-500 font-bold text-gray-700 flex justify-between"><span>🛡️ Admin Secundario</span><span className="text-blue-600">Conceder</span></button><button onClick={() => confirmApproval(UserRole.SUPER_ADMIN)} className="w-full text-left px-4 py-3 border rounded hover:bg-purple-50 hover:border-purple-500 font-bold text-gray-700 flex justify-between"><span>👑 Admin Total</span><span className="text-purple-600">Conceder</span></button></div><div className="mt-6 pt-4 border-t flex justify-between"><button onClick={rejectRequest} className="text-red-600 hover:text-red-800 text-sm font-bold">Rechazar Solicitud</button><button onClick={() => setApprovalUser(null)} className="text-gray-500 text-sm">Cancelar</button></div></div></div>)}
      {showSuccess && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]"><div className="bg-white rounded-lg shadow-2xl p-8 flex flex-col items-center animate-fade-in text-center max-w-sm"><div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4"><span className="text-4xl">✅</span></div><h3 className="text-xl font-bold text-gray-800 mb-2">Usuario creado exitosamente</h3><p className="text-gray-500">El usuario ya puede acceder al sistema.</p></div></div>)}
      {deleteConfirmation.show && deleteConfirmation.user && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]"><div className="bg-white rounded-lg shadow-2xl p-6 text-center max-w-sm animate-fade-in"><div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">⚠️</span></div><h3 className="text-xl font-bold text-gray-800 mb-2">¿Eliminar Usuario?</h3><p className="text-gray-600 text-sm mb-6">¿Estás seguro de que deseas eliminar a <strong>{deleteConfirmation.user.name}</strong>? Esta acción no se puede deshacer.</p><div className="flex gap-3"><button onClick={() => setDeleteConfirmation({show: false, user: null})} className="flex-1 px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 font-medium">Cancelar</button><button onClick={handleProcessDelete} className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-bold shadow-sm">Eliminar</button></div></div></div>)}
    </div>
  );
};

export default UserView;
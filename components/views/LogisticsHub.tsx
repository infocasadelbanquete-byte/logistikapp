
import React from 'react';
import { UserRole } from '../../types';

interface LogisticsHubProps {
  onNavigate: (view: string) => void;
  role: UserRole;
}

const LogisticsHub: React.FC<LogisticsHubProps> = ({ onNavigate, role }) => {
  // Módulos operativos centrales
  const modules = [
    { id: 'events', title: 'Pedidos', icon: '📅', desc: 'Control de reservas y eventos confirmados.', color: 'from-brand-500 to-brand-700', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'quotes', title: 'Proformas', icon: '📝', desc: 'Elaboración de presupuestos y cotizaciones.', color: 'from-blue-500 to-blue-700', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'inventory', title: 'Inventario', icon: '🪑', desc: 'Existencias de mobiliario, menaje y equipos.', color: 'from-purple-600 to-purple-800', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'dispatch', title: 'Despacho', icon: '🚚', desc: 'Salida de bodega y guías de remisión.', color: 'from-emerald-500 to-emerald-700', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'returns', title: 'Devoluciones', icon: '📥', desc: 'Recepción de material y actas de faltantes.', color: 'from-orange-500 to-orange-700', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.STAFF] },
    { id: 'bajas', title: 'Bajas Stock', icon: '🗑️', desc: 'Retiro de artículos dañados o perdidos.', color: 'from-red-500 to-red-700', roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN] },
  ];

  // Filtrado robusto: si el rol no coincide por algún motivo de carga, mostramos los módulos de STAFF por defecto
  const userRole = role || UserRole.STAFF;
  const filteredModules = modules.filter(m => m.roles.includes(userRole));

  return (
    <div className="w-full pb-10">
      <div className="mb-10 text-left">
        <h2 className="text-4xl font-black text-brand-900 tracking-tighter uppercase">Centro Logístico</h2>
        <div className="h-2 w-20 bg-brand-600 mt-2 mb-4 rounded-full"></div>
        <p className="text-gray-500 font-medium text-lg">Panel de operaciones: mobiliario, menaje y logística de eventos.</p>
      </div>

      {filteredModules.length === 0 ? (
        <div className="bg-white p-12 rounded-[2.5rem] shadow-sm text-center border border-gray-100 animate-pulse">
           <span className="text-6xl mb-4 block">📦</span>
           <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Organizando módulos para tu perfil...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredModules.map((m) => (
            <button
              key={m.id}
              onClick={() => onNavigate(m.id)}
              className="bg-white rounded-[2.5rem] shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all group flex flex-col overflow-hidden border border-gray-100 text-left min-h-[320px]"
            >
              {/* Header Card Color Gradient */}
              <div className={`h-4 w-full bg-gradient-to-r ${m.color}`}></div>
              
              <div className="p-10 flex flex-col flex-1">
                <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center text-5xl mb-6 shadow-inner group-hover:rotate-12 transition-transform duration-500">
                    {m.icon}
                </div>
                
                <h3 className="text-2xl font-black text-brand-900 mb-2 uppercase tracking-tighter">{m.title}</h3>
                <p className="text-gray-400 font-medium text-sm leading-relaxed flex-grow">
                    {m.desc}
                </p>
                
                <div className="mt-8 flex items-center gap-2 text-brand-600 font-black text-xs uppercase tracking-[0.2em] group-hover:gap-4 transition-all">
                  <span>Abrir Módulo</span>
                  <span className="text-xl">❯</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LogisticsHub;

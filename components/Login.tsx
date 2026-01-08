import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { uiService } from '../services/uiService'; // Import uiService
import { User } from '../types';
import { COMPANY_LOGO } from '../constants';

interface LoginProps {
  onLogin: (user: User) => void;
  initialMessage?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, initialMessage }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [configError, setConfigError] = useState(false);
  const [successMsg, setSuccessMsg] = useState(initialMessage || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialMessage) {
      const timer = setTimeout(() => setSuccessMsg(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [initialMessage]);

  useEffect(() => {
      let timer: any;
      if (loading) {
          timer = setTimeout(() => {
              setLoading(false);
              setError("La conexión tardó demasiado. Intente nuevamente.");
          }, 8000);
      }
      return () => clearTimeout(timer);
  }, [loading]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setConfigError(false);
    setSuccessMsg(''); 
    
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    try {
        const user = await storageService.login(cleanUser, cleanPass);
        if (user) {
            onLogin(user);
        } else {
            if (cleanUser === 'admin') {
                setError('Usuario no encontrado. Clave por defecto: 123');
            } else {
                setError('Usuario no encontrado o contraseña incorrecta.');
            }
        }
    } catch (err: any) {
        if (err.message === "FIREBASE_MISSING_KEYS") {
            setConfigError(true);
        } else if (err.message.includes('aprobación')) {
            await uiService.alert("Cuenta Pendiente", "Su cuenta aún espera aprobación del Administrador.");
        } else if (err.message === 'CUENTA_BLOQUEADA') {
            await uiService.alert("Cuenta Bloqueada", "Ha excedido el número de intentos. Contacte al administrador.");
        } else if (err.message.startsWith('PASSWORD_INCORRECTO')) {
            setError(`⚠️ Contraseña incorrecta.`);
        } else {
            console.error(err);
            setError('Error de conexión o credenciales inválidas.');
        }
    } finally {
        setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!regName || !regUsername || !regPassword) {
          setError("Todos los campos son obligatorios.");
          return;
      }
      setLoading(true);
      setError('');
      try {
          await storageService.registerUser(regName.trim(), regUsername.trim(), regPassword.trim());
          await uiService.alert("Solicitud Enviada", "Su cuenta debe ser aprobada por el Administrador antes de ingresar.");
          setIsRegistering(false);
          setUsername(regUsername);
          setPassword('');
      } catch (err: any) {
          setError(err.message || "Error al registrar usuario.");
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      {/* (Mismo JSX del Login, sin cambios estructurales, solo lógica) */}
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-900 via-brand-600 to-yellow-500"></div>
        <div className="text-center mb-8 mt-2">
          <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg border border-brand-50 p-4 relative z-10">
             <img src={COMPANY_LOGO} alt="Logistik Icon" className="w-full h-full object-contain drop-shadow-md" />
          </div>
          <h1 className="text-4xl font-bold text-brand-900 tracking-tight font-serif">Logistik</h1>
          <p className="text-gray-500 text-xs mt-1 uppercase tracking-[0.2em] font-medium">Gestión Integral de Eventos</p>
        </div>
        
        {configError ? (
            <div className="bg-orange-50 p-5 rounded-lg border border-orange-200 text-sm text-orange-900 mb-6 text-left">
                <h3 className="font-bold text-lg mb-2">⚠️ Configuración Requerida</h3>
                <p className="mb-3">Faltan las claves de Firebase.</p>
                <button onClick={() => window.location.reload()} className="w-full bg-orange-600 text-white px-3 py-2 rounded font-bold">Recargar App ↻</button>
            </div>
        ) : (
            <>
                {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4 text-sm text-center font-medium animate-pulse">{error}</div>}
                {successMsg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 text-sm text-center font-medium shadow-sm">{successMsg}</div>}
                
                {isRegistering ? (
                    <form onSubmit={handleRegisterSubmit} className="space-y-4">
                        <div><label className="block text-xs font-bold text-gray-700 uppercase mb-1">Nombre Completo</label><input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" required /></div>
                        <div><label className="block text-xs font-bold text-gray-700 uppercase mb-1">Usuario Deseado</label><input type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value.replace(/\s/g, ''))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" required /></div>
                        <div><label className="block text-xs font-bold text-gray-700 uppercase mb-1">Contraseña</label><input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md" required /></div>
                        <button type="submit" disabled={loading} className="w-full py-3 px-4 rounded-lg shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 mt-4">{loading ? 'Enviando...' : 'Enviar Solicitud'}</button>
                        <button type="button" onClick={() => { setIsRegistering(false); setError(''); }} className="w-full text-sm text-gray-500 mt-2">Volver al Login</button>
                    </form>
                ) : (
                    <form onSubmit={handleLoginSubmit} className="space-y-6">
                    <div><label className="block text-xs font-bold text-gray-700 uppercase mb-1">Usuario</label><input type="text" value={username} onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))} className="mt-1 block w-full px-3 py-3 bg-gray-50 border border-gray-300 rounded-lg shadow-sm" placeholder="Ingrese su usuario" /></div>
                    <div><label className="block text-xs font-bold text-gray-700 uppercase mb-1">Contraseña</label><div className="relative mt-1"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="block w-full px-3 py-3 pr-10 bg-gray-50 border border-gray-300 rounded-lg shadow-sm" placeholder="••••••••" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400"> {showPassword ? "Ocultar" : "Mostrar"} </button></div></div>
                    <button type="submit" disabled={loading} className="w-full py-3 px-4 rounded-lg shadow-lg text-sm font-bold text-white bg-brand-600 hover:bg-brand-800 disabled:opacity-50 uppercase tracking-wider">{loading ? 'Conectando...' : 'Acceder al Sistema'}</button>
                    <div className="text-center pt-2"><button type="button" onClick={() => { setIsRegistering(true); setError(''); }} className="text-brand-600 hover:text-brand-800 text-xs font-semibold underline">¿No tienes cuenta? Solicita acceso aquí</button></div>
                    </form>
                )}
            </>
        )}
        <div className="mt-8 pt-6 border-t border-gray-100 text-center space-y-1"><p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Desarrollado por</p><p className="text-sm font-bold text-brand-900 font-serif italic">La Casa del Banquete</p></div>
      </div>
    </div>
  );
};

export default Login;
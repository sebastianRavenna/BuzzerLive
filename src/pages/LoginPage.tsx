import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, resetPassword, getRedirectPath } from '../services/auth.service';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { user, error: loginError } = await login(email, password);

    if (loginError) {
      setError(loginError);
      setLoading(false);
      return;
    }

    if (user) {
      navigate(getRedirectPath(user));
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await resetPassword(email);

    if (resetError) {
      setError(resetError);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🏀 BuzzerLive</h1>
          <p className="text-gray-400">Sistema de Gestión de Partidos</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-8 shadow-xl">
          {showReset ? (
            <>
              <h2 className="text-xl font-bold text-white mb-6 text-center">Recuperar Contraseña</h2>
              {resetSent ? (
                <div className="text-center">
                  <div className="text-green-400 mb-4">✓ Se envió un email a <strong>{email}</strong></div>
                  <p className="text-gray-400 text-sm mb-6">Revisá tu bandeja de entrada.</p>
                  <button onClick={() => { setShowReset(false); setResetSent(false); }} className="text-blue-400 hover:text-blue-300">Volver al login</button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword}>
                  <div className="mb-4">
                    <label className="block text-gray-300 text-sm mb-2">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500" placeholder="tu@email.com" />
                  </div>
                  {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">{error}</div>}
                  <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold rounded-lg mb-4">{loading ? 'Enviando...' : 'Enviar email de recuperación'}</button>
                  <button type="button" onClick={() => setShowReset(false)} className="w-full text-gray-400 hover:text-white text-sm">Volver al login</button>
                </form>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-6 text-center">Iniciar Sesión</h2>
              <form onSubmit={handleLogin}>
                <div className="mb-4">
                  <label className="block text-gray-300 text-sm mb-2">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500" placeholder="tu@email.com" />
                </div>
                <div className="mb-6">
                  <label className="block text-gray-300 text-sm mb-2">Contraseña</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-blue-500" placeholder="••••••••" />
                </div>
                {error && <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">{error}</div>}
                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold rounded-lg mb-4">{loading ? 'Ingresando...' : 'Ingresar'}</button>
                <button type="button" onClick={() => setShowReset(true)} className="w-full text-gray-400 hover:text-white text-sm">¿Olvidaste tu contraseña?</button>
              </form>
            </>
          )}
        </div>
        <div className="text-center mt-6 text-gray-500 text-sm">¿Problemas para acceder? Contactá al administrador.</div>
      </div>
    </div>
  );
}

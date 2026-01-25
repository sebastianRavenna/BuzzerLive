import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCurrentUser, logout, onAuthChange, type Usuario as AuthUsuario } from '../services/auth.service';
import { supabase } from '../services/supabase';

type Tab = 'info' | 'jugadores' | 'entrenadores' | 'partidos';

interface Club {
  id: string;
  nombre: string;
  nombre_corto: string;
  logo_url: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  colores: string | null;
}

interface Jugador {
  id: string;
  nombre: string;
  apellido: string;
  numero_camiseta: number;
  foto_url: string | null;
  dni: string | null;
  fecha_nacimiento: string | null;
  telefono: string | null;
  email: string | null;
  posicion: string | null;
  altura: number | null;
  peso: number | null;
  certificado_medico_url: string | null;
  certificado_medico_vencimiento: string | null;
  activo: boolean;
}

interface Entrenador {
  id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  foto_url: string | null;
  rol: string;
  licencia_entrenador: string | null;
  certificado_medico_vencimiento: string | null;
  activo: boolean;
}

interface Partido {
  id: string;
  fecha: string;
  hora: string;
  estado: string;
  equipo_local: { nombre_corto: string };
  equipo_visitante: { nombre_corto: string };
  puntos_local: number;
  puntos_visitante: number;
}

export default function ClubPage() {
  const navigate = useNavigate();
  const { orgSlug } = useParams();
  const [user, setUser] = useState<AuthUsuario | null>(getCurrentUser());
  const [tab, setTab] = useState<Tab>('info');
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const [club, setClub] = useState<Club | null>(null);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [entrenadores, setEntrenadores] = useState<Entrenador[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  
  // Modals
  const [showJugadorModal, setShowJugadorModal] = useState(false);
  const [editingJugador, setEditingJugador] = useState<Jugador | null>(null);
  const [jugadorForm, setJugadorForm] = useState({
    nombre: '', apellido: '', numero_camiseta: '', dni: '', fecha_nacimiento: '',
    telefono: '', email: '', posicion: '', altura: '', peso: '',
    certificado_medico_vencimiento: ''
  });
  
  const [showEntrenadorModal, setShowEntrenadorModal] = useState(false);
  const [editingEntrenador, setEditingEntrenador] = useState<Entrenador | null>(null);
  const [entrenadorForm, setEntrenadorForm] = useState({
    nombre: '', apellido: '', dni: '', telefono: '', email: '',
    rol: 'principal', licencia_entrenador: '', certificado_medico_vencimiento: ''
  });
  
  const [showClubModal, setShowClubModal] = useState(false);
  const [clubForm, setClubForm] = useState({ nombre: '', nombre_corto: '', direccion: '', telefono: '', email: '', colores: '' });
  
  const [error, setError] = useState<string | null>(null);

  // Suscribirse a cambios de auth
  useEffect(() => {
    const unsubscribe = onAuthChange((newUser) => {
      setUser(newUser);
    });
    return unsubscribe;
  }, []);

  // Cargar datos cuando usuario esté listo
  useEffect(() => {
    if (!user) {
      setLoading(true);
      return;
    }
    if (user.rol !== 'club') {
      navigate('/login');
      return;
    }
    if (!user.club_id) {
      navigate('/login');
      return;
    }
    if (!dataLoaded) {
      loadData();
      setDataLoaded(true);
    }
  }, [user, navigate, dataLoaded]);

  const loadData = async () => {
    if (!user?.club_id || !user?.organizacion_id) return;
    setLoading(true);
    
    const [clubRes, jugadoresRes, entrenadoresRes, partidosRes] = await Promise.all([
      supabase.from('equipos').select('*').eq('id', user.club_id).single(),
      supabase.from('jugadores').select('*').eq('equipo_id', user.club_id).order('numero_camiseta'),
      supabase.from('entrenadores').select('*').eq('equipo_id', user.club_id).order('rol'),
      supabase.from('partidos').select('*, equipo_local:equipos!equipo_local_id(nombre_corto), equipo_visitante:equipos!equipo_visitante_id(nombre_corto)')
        .or(`equipo_local_id.eq.${user.club_id},equipo_visitante_id.eq.${user.club_id}`)
        .order('fecha', { ascending: false }).limit(20),
    ]);
    
    setClub(clubRes.data);
    setJugadores(jugadoresRes.data || []);
    setEntrenadores(entrenadoresRes.data || []);
    setPartidos(partidosRes.data || []);
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Jugador CRUD
  const openCreateJugador = () => {
    setEditingJugador(null);
    setJugadorForm({ nombre: '', apellido: '', numero_camiseta: '', dni: '', fecha_nacimiento: '', telefono: '', email: '', posicion: '', altura: '', peso: '', certificado_medico_vencimiento: '' });
    setShowJugadorModal(true);
  };

  const openEditJugador = (j: Jugador) => {
    setEditingJugador(j);
    setJugadorForm({
      nombre: j.nombre,
      apellido: j.apellido,
      numero_camiseta: j.numero_camiseta.toString(),
      dni: j.dni || '',
      fecha_nacimiento: j.fecha_nacimiento || '',
      telefono: j.telefono || '',
      email: j.email || '',
      posicion: j.posicion || '',
      altura: j.altura?.toString() || '',
      peso: j.peso?.toString() || '',
      certificado_medico_vencimiento: j.certificado_medico_vencimiento || '',
    });
    setShowJugadorModal(true);
  };

  const handleSaveJugador = async () => {
    if (!user?.club_id || !user?.organizacion_id) return;
    setError(null);
    
    const data = {
      nombre: jugadorForm.nombre,
      apellido: jugadorForm.apellido,
      numero_camiseta: parseInt(jugadorForm.numero_camiseta),
      dni: jugadorForm.dni || null,
      fecha_nacimiento: jugadorForm.fecha_nacimiento || null,
      telefono: jugadorForm.telefono || null,
      email: jugadorForm.email || null,
      posicion: jugadorForm.posicion || null,
      altura: jugadorForm.altura ? parseFloat(jugadorForm.altura) : null,
      peso: jugadorForm.peso ? parseFloat(jugadorForm.peso) : null,
      certificado_medico_vencimiento: jugadorForm.certificado_medico_vencimiento || null,
    };
    
    if (editingJugador) {
      const { error } = await supabase.from('jugadores').update(data).eq('id', editingJugador.id);
      if (error) { setError(error.message); return; }
    } else {
      const { error } = await supabase.from('jugadores').insert({ ...data, equipo_id: user.club_id, organizacion_id: user.organizacion_id, activo: true });
      if (error) { setError(error.message); return; }
    }
    
    setShowJugadorModal(false);
    loadData();
  };

  const handleToggleJugador = async (j: Jugador) => {
    await supabase.from('jugadores').update({ activo: !j.activo }).eq('id', j.id);
    loadData();
  };

  // Entrenador CRUD
  const openCreateEntrenador = () => {
    setEditingEntrenador(null);
    setEntrenadorForm({ nombre: '', apellido: '', dni: '', telefono: '', email: '', rol: 'principal', licencia_entrenador: '', certificado_medico_vencimiento: '' });
    setShowEntrenadorModal(true);
  };

  const openEditEntrenador = (e: Entrenador) => {
    setEditingEntrenador(e);
    setEntrenadorForm({
      nombre: e.nombre,
      apellido: e.apellido,
      dni: e.dni || '',
      telefono: e.telefono || '',
      email: e.email || '',
      rol: e.rol,
      licencia_entrenador: e.licencia_entrenador || '',
      certificado_medico_vencimiento: e.certificado_medico_vencimiento || '',
    });
    setShowEntrenadorModal(true);
  };

  const handleSaveEntrenador = async () => {
    if (!user?.club_id || !user?.organizacion_id) return;
    setError(null);
    
    const data = {
      nombre: entrenadorForm.nombre,
      apellido: entrenadorForm.apellido,
      dni: entrenadorForm.dni || null,
      telefono: entrenadorForm.telefono || null,
      email: entrenadorForm.email || null,
      rol: entrenadorForm.rol,
      licencia_entrenador: entrenadorForm.licencia_entrenador || null,
      certificado_medico_vencimiento: entrenadorForm.certificado_medico_vencimiento || null,
    };
    
    if (editingEntrenador) {
      const { error } = await supabase.from('entrenadores').update(data).eq('id', editingEntrenador.id);
      if (error) { setError(error.message); return; }
    } else {
      const { error } = await supabase.from('entrenadores').insert({ ...data, equipo_id: user.club_id, organizacion_id: user.organizacion_id, activo: true });
      if (error) { setError(error.message); return; }
    }
    
    setShowEntrenadorModal(false);
    loadData();
  };

  // Club edit
  const openEditClub = () => {
    if (!club) return;
    setClubForm({
      nombre: club.nombre,
      nombre_corto: club.nombre_corto || '',
      direccion: club.direccion || '',
      telefono: club.telefono || '',
      email: club.email || '',
      colores: club.colores || '',
    });
    setShowClubModal(true);
  };

  const handleSaveClub = async () => {
    if (!club) return;
    setError(null);
    const { error } = await supabase.from('equipos').update(clubForm).eq('id', club.id);
    if (error) { setError(error.message); return; }
    setShowClubModal(false);
    loadData();
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-white text-xl">Cargando...</div></div>;
  }

  const posiciones = ['Base', 'Escolta', 'Alero', 'Ala-Pivot', 'Pivot'];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {club?.logo_url && <img src={club.logo_url} alt="" className="w-12 h-12 rounded-full object-cover" />}
            <div>
              <h1 className="text-2xl font-bold text-white">{club?.nombre}</h1>
              <p className="text-sm text-gray-400">Panel del Club</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-300">{user?.nombre}</span>
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm cursor-pointer">🏠 Inicio</button>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm cursor-pointer">Salir</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-400">{jugadores.filter(j => j.activo).length}</div>
            <div className="text-gray-400 text-sm">Jugadores Activos</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-400">{entrenadores.length}</div>
            <div className="text-gray-400 text-sm">Cuerpo Técnico</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-400">{partidos.filter(p => p.estado === 'PROGRAMADO').length}</div>
            <div className="text-gray-400 text-sm">Partidos Pendientes</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-400">
              {jugadores.filter(j => j.certificado_medico_vencimiento && new Date(j.certificado_medico_vencimiento) < new Date()).length}
            </div>
            <div className="text-gray-400 text-sm">Cert. Vencidos</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {(['info', 'jugadores', 'entrenadores', 'partidos'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg font-medium capitalize ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t === 'info' ? 'Datos del Club' : t}</button>
          ))}
        </div>

        {/* Content */}
        {tab === 'info' && club && (
          <div className="bg-gray-800 rounded-xl p-6">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-xl font-bold text-white">Información del Club</h2>
              <button onClick={openEditClub} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Editar</button>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div><span className="text-gray-400">Nombre:</span><p className="text-white text-lg">{club.nombre}</p></div>
              <div><span className="text-gray-400">Nombre Corto:</span><p className="text-white text-lg">{club.nombre_corto}</p></div>
              <div><span className="text-gray-400">Colores:</span><p className="text-white">{club.colores || '-'}</p></div>
              <div><span className="text-gray-400">Teléfono:</span><p className="text-white">{club.telefono || '-'}</p></div>
              <div><span className="text-gray-400">Email:</span><p className="text-white">{club.email || '-'}</p></div>
              <div><span className="text-gray-400">Dirección:</span><p className="text-white">{club.direccion || '-'}</p></div>
            </div>
          </div>
        )}

        {tab === 'jugadores' && (
          <>
            <div className="mb-4">
              <button onClick={openCreateJugador} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">+ Nuevo Jugador</button>
            </div>
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm">#</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm">Nombre</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm">Posición</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm">DNI</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm">Cert. Médico</th>
                    <th className="px-4 py-3 text-left text-gray-300 text-sm">Estado</th>
                    <th className="px-4 py-3 text-right text-gray-300 text-sm">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {jugadores.map(j => (
                    <tr key={j.id} className={`border-t border-gray-700 hover:bg-gray-700/50 ${!j.activo && 'opacity-50'}`}>
                      <td className="px-4 py-3 text-white font-bold">{j.numero_camiseta}</td>
                      <td className="px-4 py-3 text-white">{j.apellido}, {j.nombre}</td>
                      <td className="px-4 py-3 text-gray-400">{j.posicion || '-'}</td>
                      <td className="px-4 py-3 text-gray-400">{j.dni || '-'}</td>
                      <td className="px-4 py-3">
                        {j.certificado_medico_vencimiento ? (
                          <span className={`text-sm ${new Date(j.certificado_medico_vencimiento) < new Date() ? 'text-red-400' : 'text-green-400'}`}>
                            {new Date(j.certificado_medico_vencimiento).toLocaleDateString()}
                          </span>
                        ) : <span className="text-gray-500">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${j.activo ? 'bg-green-600' : 'bg-red-600'} text-white`}>{j.activo ? 'Activo' : 'Inactivo'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEditJugador(j)} className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs mr-2">Editar</button>
                        <button onClick={() => handleToggleJugador(j)} className={`px-2 py-1 rounded text-xs text-white ${j.activo ? 'bg-yellow-600' : 'bg-green-600'}`}>{j.activo ? 'Baja' : 'Alta'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'entrenadores' && (
          <>
            <div className="mb-4">
              <button onClick={openCreateEntrenador} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">+ Nuevo Entrenador</button>
            </div>
            <div className="grid gap-3">
              {entrenadores.map(e => (
                <div key={e.id} className={`bg-gray-800 rounded-xl p-4 flex justify-between items-center ${!e.activo && 'opacity-50'}`}>
                  <div>
                    <h3 className="text-lg font-medium text-white">{e.apellido}, {e.nombre}</h3>
                    <p className="text-gray-400 text-sm capitalize">{e.rol.replace('_', ' ')}</p>
                    {e.licencia_entrenador && <p className="text-gray-500 text-xs">Licencia: {e.licencia_entrenador}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEditEntrenador(e)} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm">Editar</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'partidos' && (
          <div className="space-y-2">
            {partidos.map(p => (
              <div key={p.id} className="bg-gray-800 rounded-xl p-4 flex justify-between items-center">
                <div>
                  <span className="text-white font-medium">{p.equipo_local?.nombre_corto} vs {p.equipo_visitante?.nombre_corto}</span>
                  {p.estado === 'FINALIZADO' && <span className="ml-2 text-green-400">{p.puntos_local} - {p.puntos_visitante}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${p.estado === 'FINALIZADO' ? 'bg-green-600' : p.estado === 'EN_CURSO' ? 'bg-red-600 animate-pulse' : 'bg-gray-600'} text-white`}>{p.estado}</span>
                  <span className="text-gray-400 text-sm">{new Date(p.fecha).toLocaleDateString()} {p.hora}</span>
                  {p.estado !== 'FINALIZADO' && (
                    <button onClick={() => navigate(`/${orgSlug}/partido/${p.id}/live`)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">
                      {p.estado === 'EN_CURSO' ? 'Continuar' : 'Planillar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Jugador */}
      {showJugadorModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-lg w-full my-8">
            <h2 className="text-xl font-bold text-white mb-4">{editingJugador ? 'Editar Jugador' : 'Nuevo Jugador'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Nombre *</label>
                  <input type="text" value={jugadorForm.nombre} onChange={(e) => setJugadorForm({...jugadorForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Apellido *</label>
                  <input type="text" value={jugadorForm.apellido} onChange={(e) => setJugadorForm({...jugadorForm, apellido: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Número *</label>
                  <input type="number" value={jugadorForm.numero_camiseta} onChange={(e) => setJugadorForm({...jugadorForm, numero_camiseta: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" min="0" max="99" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">DNI</label>
                  <input type="text" value={jugadorForm.dni} onChange={(e) => setJugadorForm({...jugadorForm, dni: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Fecha Nac.</label>
                  <input type="date" value={jugadorForm.fecha_nacimiento} onChange={(e) => setJugadorForm({...jugadorForm, fecha_nacimiento: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Posición</label>
                  <select value={jugadorForm.posicion} onChange={(e) => setJugadorForm({...jugadorForm, posicion: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                    <option value="">-</option>
                    {posiciones.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Altura (m)</label>
                  <input type="number" step="0.01" value={jugadorForm.altura} onChange={(e) => setJugadorForm({...jugadorForm, altura: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="1.85" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Peso (kg)</label>
                  <input type="number" step="0.1" value={jugadorForm.peso} onChange={(e) => setJugadorForm({...jugadorForm, peso: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="85" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Teléfono</label>
                  <input type="text" value={jugadorForm.telefono} onChange={(e) => setJugadorForm({...jugadorForm, telefono: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Email</label>
                  <input type="email" value={jugadorForm.email} onChange={(e) => setJugadorForm({...jugadorForm, email: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Venc. Certificado Médico</label>
                <input type="date" value={jugadorForm.certificado_medico_vencimiento} onChange={(e) => setJugadorForm({...jugadorForm, certificado_medico_vencimiento: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              </div>
            </div>
            {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowJugadorModal(false)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancelar</button>
              <button onClick={handleSaveJugador} disabled={!jugadorForm.nombre || !jugadorForm.apellido || !jugadorForm.numero_camiseta} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Entrenador */}
      {showEntrenadorModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">{editingEntrenador ? 'Editar Entrenador' : 'Nuevo Entrenador'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Nombre *</label>
                  <input type="text" value={entrenadorForm.nombre} onChange={(e) => setEntrenadorForm({...entrenadorForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Apellido *</label>
                  <input type="text" value={entrenadorForm.apellido} onChange={(e) => setEntrenadorForm({...entrenadorForm, apellido: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Rol</label>
                <select value={entrenadorForm.rol} onChange={(e) => setEntrenadorForm({...entrenadorForm, rol: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                  <option value="principal">Director Técnico</option>
                  <option value="asistente">Asistente</option>
                  <option value="preparador_fisico">Preparador Físico</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">DNI</label>
                  <input type="text" value={entrenadorForm.dni} onChange={(e) => setEntrenadorForm({...entrenadorForm, dni: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Licencia</label>
                  <input type="text" value={entrenadorForm.licencia_entrenador} onChange={(e) => setEntrenadorForm({...entrenadorForm, licencia_entrenador: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Teléfono</label>
                  <input type="text" value={entrenadorForm.telefono} onChange={(e) => setEntrenadorForm({...entrenadorForm, telefono: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Email</label>
                  <input type="email" value={entrenadorForm.email} onChange={(e) => setEntrenadorForm({...entrenadorForm, email: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
            </div>
            {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEntrenadorModal(false)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancelar</button>
              <button onClick={handleSaveEntrenador} disabled={!entrenadorForm.nombre || !entrenadorForm.apellido} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg font-medium">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Club */}
      {showClubModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Editar Datos del Club</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Nombre</label>
                <input type="text" value={clubForm.nombre} onChange={(e) => setClubForm({...clubForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Nombre Corto</label>
                <input type="text" value={clubForm.nombre_corto} onChange={(e) => setClubForm({...clubForm, nombre_corto: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" maxLength={10} />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Colores</label>
                <input type="text" value={clubForm.colores} onChange={(e) => setClubForm({...clubForm, colores: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="Azul y Blanco" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Teléfono</label>
                  <input type="text" value={clubForm.telefono} onChange={(e) => setClubForm({...clubForm, telefono: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Email</label>
                  <input type="email" value={clubForm.email} onChange={(e) => setClubForm({...clubForm, email: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Dirección</label>
                <input type="text" value={clubForm.direccion} onChange={(e) => setClubForm({...clubForm, direccion: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              </div>
            </div>
            {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowClubModal(false)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancelar</button>
              <button onClick={handleSaveClub} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
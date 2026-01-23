import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCurrentUser, logout, createAuthUser } from '../services/auth.service';
import { supabase } from '../services/supabase';

type Tab = 'dashboard' | 'torneos' | 'clubes' | 'jugadores' | 'partidos' | 'usuarios';

interface Torneo { id: string; nombre: string; tipo: string; estado: string; fecha_inicio: string; fecha_fin: string; }
interface Club { id: string; nombre: string; nombre_corto: string; logo_url: string | null; activo: boolean; _count?: { jugadores: number }; }
interface Jugador { id: string; nombre: string; apellido: string; numero_camiseta: number; equipo_id: string; foto_url: string | null; dni: string; certificado_medico_vencimiento: string | null; activo: boolean; equipo?: { nombre_corto: string }; }
interface Partido { id: string; fecha: string; hora: string; estado: string; equipo_local: { nombre_corto: string }; equipo_visitante: { nombre_corto: string }; puntos_local: number; puntos_visitante: number; torneo?: { nombre: string }; }
interface Usuario { id: string; email: string; nombre: string; apellido: string | null; rol: string; activo: boolean; club?: { nombre_corto: string }; }

export default function AdminPage() {
  const navigate = useNavigate();
  const { orgSlug } = useParams();
  const user = getCurrentUser();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [clubes, setClubes] = useState<Club[]>([]);
  const [jugadores, setJugadores] = useState<Jugador[]>([]);
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  
  // Modals
  const [showClubModal, setShowClubModal] = useState(false);
  const [editingClub, setEditingClub] = useState<Club | null>(null);
  const [clubForm, setClubForm] = useState({ nombre: '', nombre_corto: '', colores: '', email: '', telefono: '' });
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', password: '', nombre: '', apellido: '', telefono: '', club_id: '' });
  
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || (user.rol !== 'admin' && user.rol !== 'superadmin')) {
      navigate('/login');
      return;
    }
    // Verificar que el slug coincide con la org del usuario
    if (user.rol === 'admin' && user.organizacion?.slug !== orgSlug) {
      navigate(`/${user.organizacion?.slug}`);
      return;
    }
    loadData();
  }, [user, orgSlug, navigate]);

  const loadData = async () => {
    if (!user?.organizacion_id) return;
    setLoading(true);
    const orgId = user.organizacion_id;
    
    const [torneosRes, clubesRes, jugadoresRes, partidosRes, usuariosRes] = await Promise.all([
      supabase.from('torneos').select('*').eq('organizacion_id', orgId).order('fecha_inicio', { ascending: false }),
      supabase.from('equipos').select('*').eq('organizacion_id', orgId).order('nombre'),
      supabase.from('jugadores').select('*, equipo:equipos(nombre_corto)').eq('organizacion_id', orgId).order('apellido'),
      supabase.from('partidos').select('*, equipo_local:equipos!equipo_local_id(nombre_corto), equipo_visitante:equipos!equipo_visitante_id(nombre_corto), torneo:torneos(nombre)').eq('organizacion_id', orgId).order('fecha', { ascending: false }).limit(50),
      supabase.from('usuarios').select('*, club:equipos(nombre_corto)').eq('organizacion_id', orgId).order('nombre'),
    ]);
    
    setTorneos(torneosRes.data || []);
    setClubes(clubesRes.data || []);
    setJugadores(jugadoresRes.data || []);
    setPartidos(partidosRes.data || []);
    setUsuarios(usuariosRes.data || []);
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Club CRUD
  const openCreateClub = () => {
    setEditingClub(null);
    setClubForm({ nombre: '', nombre_corto: '', colores: '', email: '', telefono: '' });
    setShowClubModal(true);
  };

  const openEditClub = (club: Club) => {
    setEditingClub(club);
    setClubForm({ nombre: club.nombre, nombre_corto: club.nombre_corto || '', colores: '', email: '', telefono: '' });
    setShowClubModal(true);
  };

  const handleSaveClub = async () => {
    if (!user?.organizacion_id) return;
    setError(null);
    
    if (editingClub) {
      const { error } = await supabase.from('equipos').update({ nombre: clubForm.nombre, nombre_corto: clubForm.nombre_corto, colores: clubForm.colores, email: clubForm.email, telefono: clubForm.telefono }).eq('id', editingClub.id);
      if (error) { setError(error.message); return; }
    } else {
      const { error } = await supabase.from('equipos').insert({ nombre: clubForm.nombre, nombre_corto: clubForm.nombre_corto, colores: clubForm.colores, email: clubForm.email, telefono: clubForm.telefono, organizacion_id: user.organizacion_id, activo: true });
      if (error) { setError(error.message); return; }
    }
    
    setShowClubModal(false);
    loadData();
  };

  const handleToggleClub = async (club: Club) => {
    await supabase.from('equipos').update({ activo: !club.activo }).eq('id', club.id);
    loadData();
  };

  // Usuario Club
  const openCreateUser = () => {
    setUserForm({ email: '', password: '', nombre: '', apellido: '', telefono: '', club_id: '' });
    setShowUserModal(true);
  };

  const handleCreateUser = async () => {
    if (!user?.organizacion_id) return;
    setError(null);
    
    const { authId, error: authError } = await createAuthUser(userForm.email, userForm.password);
    if (authError || !authId) { setError(authError || 'Error'); return; }
    
    const { error: insertError } = await supabase.from('usuarios').insert({
      auth_id: authId,
      email: userForm.email,
      nombre: userForm.nombre,
      apellido: userForm.apellido || null,
      telefono: userForm.telefono || null,
      rol: 'club',
      organizacion_id: user.organizacion_id,
      club_id: userForm.club_id || null,
      activo: true,
    });
    
    if (insertError) { setError(insertError.message); return; }
    setShowUserModal(false);
    loadData();
    alert('Usuario creado. Se envió email de confirmación.');
  };

  const handleToggleUser = async (u: Usuario) => {
    await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id);
    loadData();
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><div className="text-white text-xl">Cargando...</div></div>;
  }

  const org = user?.organizacion;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">{org?.nombre || 'Admin'}</h1>
            <p className="text-sm text-gray-400">Panel de Administración</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-300">{user?.email}</span>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">Salir</button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-gray-800 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-700" onClick={() => setTab('torneos')}>
            <div className="text-3xl font-bold text-white">{torneos.length}</div>
            <div className="text-gray-400 text-sm">Torneos</div>
            {org && <div className="text-xs text-gray-500">/ {org.limite_torneos}</div>}
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-700" onClick={() => setTab('clubes')}>
            <div className="text-3xl font-bold text-blue-400">{clubes.length}</div>
            <div className="text-gray-400 text-sm">Clubes</div>
            {org && <div className="text-xs text-gray-500">/ {org.limite_clubes}</div>}
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-700" onClick={() => setTab('jugadores')}>
            <div className="text-3xl font-bold text-green-400">{jugadores.length}</div>
            <div className="text-gray-400 text-sm">Jugadores</div>
            {org && <div className="text-xs text-gray-500">/ {org.limite_jugadores}</div>}
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-700" onClick={() => setTab('partidos')}>
            <div className="text-3xl font-bold text-yellow-400">{partidos.length}</div>
            <div className="text-gray-400 text-sm">Partidos</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-700" onClick={() => setTab('usuarios')}>
            <div className="text-3xl font-bold text-purple-400">{usuarios.length}</div>
            <div className="text-gray-400 text-sm">Usuarios</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['dashboard', 'torneos', 'clubes', 'jugadores', 'partidos', 'usuarios'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg font-medium capitalize ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t}</button>
          ))}
        </div>

        {/* Content */}
        {tab === 'dashboard' && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Últimos Partidos</h2>
            <div className="space-y-2">
              {partidos.slice(0, 10).map(p => (
                <div key={p.id} className="flex justify-between items-center bg-gray-700 rounded-lg p-3">
                  <div>
                    <span className="text-white">{p.equipo_local?.nombre_corto} vs {p.equipo_visitante?.nombre_corto}</span>
                    {p.estado === 'FINALIZADO' && <span className="ml-2 text-gray-400">{p.puntos_local} - {p.puntos_visitante}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${p.estado === 'FINALIZADO' ? 'bg-green-600' : p.estado === 'EN_CURSO' ? 'bg-red-600' : 'bg-gray-600'} text-white`}>{p.estado}</span>
                    <span className="text-gray-400 text-sm">{new Date(p.fecha).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'clubes' && (
          <>
            <div className="mb-4">
              <button onClick={openCreateClub} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">+ Nuevo Club</button>
            </div>
            <div className="grid gap-3">
              {clubes.map(club => (
                <div key={club.id} className={`bg-gray-800 rounded-xl p-4 flex justify-between items-center ${!club.activo && 'opacity-50'}`}>
                  <div>
                    <h3 className="text-lg font-bold text-white">{club.nombre}</h3>
                    <p className="text-gray-400 text-sm">{club.nombre_corto}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/${orgSlug}/club/${club.id}`)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">Ver</button>
                    <button onClick={() => openEditClub(club)} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm">Editar</button>
                    <button onClick={() => handleToggleClub(club)} className={`px-3 py-1.5 rounded text-sm text-white ${club.activo ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}>{club.activo ? 'Desactivar' : 'Activar'}</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'jugadores' && (
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-300 text-sm">#</th>
                  <th className="px-4 py-3 text-left text-gray-300 text-sm">Nombre</th>
                  <th className="px-4 py-3 text-left text-gray-300 text-sm">Club</th>
                  <th className="px-4 py-3 text-left text-gray-300 text-sm">DNI</th>
                  <th className="px-4 py-3 text-left text-gray-300 text-sm">Cert. Médico</th>
                  <th className="px-4 py-3 text-left text-gray-300 text-sm">Estado</th>
                </tr>
              </thead>
              <tbody>
                {jugadores.map(j => (
                  <tr key={j.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-white font-bold">{j.numero_camiseta}</td>
                    <td className="px-4 py-3 text-white">{j.apellido}, {j.nombre}</td>
                    <td className="px-4 py-3 text-gray-400">{j.equipo?.nombre_corto}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'usuarios' && (
          <>
            <div className="mb-4">
              <button onClick={openCreateUser} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">+ Nuevo Usuario Club</button>
            </div>
            <div className="grid gap-3">
              {usuarios.map(u => (
                <div key={u.id} className={`bg-gray-800 rounded-xl p-4 flex justify-between items-center ${!u.activo && 'opacity-50'}`}>
                  <div>
                    <h3 className="text-lg font-medium text-white">{u.nombre} {u.apellido}</h3>
                    <p className="text-gray-400 text-sm">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${u.rol === 'admin' ? 'bg-blue-600' : 'bg-green-600'} text-white`}>{u.rol}</span>
                    {u.club && <span className="text-gray-400 text-sm">{u.club.nombre_corto}</span>}
                    <button onClick={() => handleToggleUser(u)} className={`px-3 py-1.5 rounded text-sm text-white ${u.activo ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'}`}>{u.activo ? 'Desactivar' : 'Activar'}</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'partidos' && (
          <div className="bg-gray-800 rounded-xl p-4">
            <div className="mb-4">
              <button onClick={() => navigate(`/${orgSlug}/partidos`)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">+ Nuevo Partido</button>
            </div>
            <div className="space-y-2">
              {partidos.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-gray-700 rounded-lg p-3">
                  <div>
                    <span className="text-white font-medium">{p.equipo_local?.nombre_corto} vs {p.equipo_visitante?.nombre_corto}</span>
                    {p.torneo && <span className="ml-2 text-gray-400 text-sm">{p.torneo.nombre}</span>}
                    {p.estado === 'FINALIZADO' && <span className="ml-2 text-green-400">{p.puntos_local} - {p.puntos_visitante}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${p.estado === 'FINALIZADO' ? 'bg-green-600' : p.estado === 'EN_CURSO' ? 'bg-red-600 animate-pulse' : 'bg-gray-600'} text-white`}>{p.estado}</span>
                    <span className="text-gray-400 text-sm">{new Date(p.fecha).toLocaleDateString()} {p.hora}</span>
                    <button onClick={() => navigate(`/${orgSlug}/partido/${p.id}/live`)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">Abrir</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'torneos' && (
          <div className="bg-gray-800 rounded-xl p-4">
            <p className="text-gray-400">Gestión de torneos (próximamente)</p>
          </div>
        )}
      </div>

      {/* Modal Club */}
      {showClubModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">{editingClub ? 'Editar Club' : 'Nuevo Club'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Nombre *</label>
                <input type="text" value={clubForm.nombre} onChange={(e) => setClubForm({...clubForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Nombre Corto *</label>
                <input type="text" value={clubForm.nombre_corto} onChange={(e) => setClubForm({...clubForm, nombre_corto: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" maxLength={10} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Email</label>
                  <input type="email" value={clubForm.email} onChange={(e) => setClubForm({...clubForm, email: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Teléfono</label>
                  <input type="text" value={clubForm.telefono} onChange={(e) => setClubForm({...clubForm, telefono: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
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

      {/* Modal Usuario */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Nuevo Usuario Club</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Email *</label>
                <input type="email" value={userForm.email} onChange={(e) => setUserForm({...userForm, email: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Contraseña *</label>
                <input type="password" value={userForm.password} onChange={(e) => setUserForm({...userForm, password: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Nombre *</label>
                  <input type="text" value={userForm.nombre} onChange={(e) => setUserForm({...userForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Apellido</label>
                  <input type="text" value={userForm.apellido} onChange={(e) => setUserForm({...userForm, apellido: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Club asignado</label>
                <select value={userForm.club_id} onChange={(e) => setUserForm({...userForm, club_id: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                  <option value="">Sin club específico</option>
                  {clubes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>
            {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowUserModal(false)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancelar</button>
              <button onClick={handleCreateUser} disabled={!userForm.email || !userForm.password || !userForm.nombre} className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium">Crear</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

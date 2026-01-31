import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, logout, createAuthUser, onAuthChange, type Usuario as AuthUsuario } from '../services/auth.service';
import { 
  getOrganizaciones, 
  createOrganizacion, 
  updateOrganizacion, 
  deleteOrganizacion,
  getOrganizacionStats,
  getUsuariosOrganizacion,
  PLANES,
  type Organizacion 
} from '../services/organizacion.service';
import { restDirect } from '../services/supabase';

type Tab = 'organizaciones' | 'stats';

interface OrgStats {
  torneos: number;
  clubes: number;
  jugadores: number;
  partidosEsteMes: number;
  partidosTotal: number;
  usuarios: number;
}

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUsuario | null>(getCurrentUser());
  const [tab, setTab] = useState<Tab>('organizaciones');
  const [organizaciones, setOrganizaciones] = useState<Organizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal crear/editar organización
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organizacion | null>(null);
  const [orgForm, setOrgForm] = useState({
    nombre: '',
    slug: '',
    email: '',
    telefono: '',
    plan: 'basico',
    limite_torneos: 5,
    limite_clubes: 20,
    limite_jugadores: 500,
  });
  
  // Modal crear admin
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminOrgId, setAdminOrgId] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    telefono: '',
  });
  
  // Stats de org seleccionada
  const [selectedOrgStats, setSelectedOrgStats] = useState<OrgStats | null>(null);
  const [selectedOrgUsers, setSelectedOrgUsers] = useState<any[]>([]);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsOrg, setStatsOrg] = useState<Organizacion | null>(null);

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
    if (user.rol !== 'superadmin') {
      navigate('/login');
      return;
    }
    if (!dataLoaded) {
      loadOrganizaciones();
      setDataLoaded(true);
    }
  }, [user, navigate, dataLoaded]);

  const loadOrganizaciones = async () => {
    setLoading(true);
    const orgs = await getOrganizaciones();
    setOrganizaciones(orgs);
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const openCreateOrg = () => {
    setEditingOrg(null);
    setOrgForm({
      nombre: '',
      slug: '',
      email: '',
      telefono: '',
      plan: 'basico',
      limite_torneos: PLANES.basico.limite_torneos,
      limite_clubes: PLANES.basico.limite_clubes,
      limite_jugadores: PLANES.basico.limite_jugadores,
    });
    setShowOrgModal(true);
  };

  const openEditOrg = (org: Organizacion) => {
    setEditingOrg(org);
    setOrgForm({
      nombre: org.nombre,
      slug: org.slug,
      email: org.email || '',
      telefono: org.telefono || '',
      plan: org.plan,
      limite_torneos: org.limite_torneos,
      limite_clubes: org.limite_clubes,
      limite_jugadores: org.limite_jugadores,
    });
    setShowOrgModal(true);
  };

  const handleSaveOrg = async () => {
    setError(null);
    
    if (editingOrg) {
      const { error } = await updateOrganizacion(editingOrg.id, orgForm);
      if (error) {
        setError(error);
        return;
      }
    } else {
      const { error } = await createOrganizacion(orgForm);
      if (error) {
        setError(error);
        return;
      }
    }
    
    setShowOrgModal(false);
    loadOrganizaciones();
  };

  const handleDeleteOrg = async (org: Organizacion) => {
    if (!confirm(`¿Eliminar "${org.nombre}"? Esta acción no se puede deshacer.`)) return;
    
    const { error } = await deleteOrganizacion(org.id);
    if (error) {
      alert(error);
      return;
    }
    loadOrganizaciones();
  };

  const handleToggleActive = async (org: Organizacion) => {
    await updateOrganizacion(org.id, { activa: !org.activa });
    loadOrganizaciones();
  };

  const openCreateAdmin = (orgId: string) => {
    setAdminOrgId(orgId);
    setAdminForm({ email: '', password: '', nombre: '', apellido: '', telefono: '' });
    setShowAdminModal(true);
  };

  const handleCreateAdmin = async () => {
    if (!adminOrgId) return;
    setError(null);
    
    // Crear usuario en auth
    const { authId, error: authError } = await createAuthUser(adminForm.email, adminForm.password);
    if (authError || !authId) {
      setError(authError || 'Error al crear usuario');
      return;
    }
    
    // Crear registro en usuarios usando restDirect para evitar congelamiento
    const { error: insertError } = await restDirect('usuarios', {
      method: 'POST',
      body: {
        auth_id: authId,
        email: adminForm.email,
        nombre: adminForm.nombre,
        apellido: adminForm.apellido || null,
        telefono: adminForm.telefono || null,
        rol: 'admin',
        organizacion_id: adminOrgId,
        activo: true,
      },
    });

    if (insertError) {
      setError(insertError.message);
      return;
    }
    
    setShowAdminModal(false);
    alert('Admin creado exitosamente. Se envió email de confirmación.');
  };

  const openStats = async (org: Organizacion) => {
    setStatsOrg(org);
    const stats = await getOrganizacionStats(org.id);
    setSelectedOrgStats(stats);
    const users = await getUsuariosOrganizacion(org.id);
    setSelectedOrgUsers(users);
    setShowStatsModal(true);
  };

  const handlePlanChange = (plan: string) => {
    const planData = PLANES[plan as keyof typeof PLANES];
    setOrgForm({
      ...orgForm,
      plan,
      limite_torneos: planData.limite_torneos,
      limite_clubes: planData.limite_clubes,
      limite_jugadores: planData.limite_jugadores,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">🏀 BuzzerLive</h1>
            <p className="text-sm text-gray-400">SuperAdmin Panel</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-300">{user?.email}</span>
            <button onClick={() => navigate('/')} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm cursor-pointer">
              🏠 Inicio
            </button>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm cursor-pointer">
              Cerrar Sesión
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('organizaciones')} className={`px-4 py-2 rounded-lg font-medium ${tab === 'organizaciones' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            Organizaciones ({organizaciones.length})
          </button>
          <button onClick={() => setTab('stats')} className={`px-4 py-2 rounded-lg font-medium ${tab === 'stats' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            Estadísticas Globales
          </button>
        </div>

        {tab === 'organizaciones' && (
          <>
            {/* Botón crear */}
            <div className="mb-4">
              <button onClick={openCreateOrg} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">
                + Nueva Organización
              </button>
            </div>

            {/* Lista de organizaciones */}
            <div className="grid gap-4">
              {organizaciones.map((org) => (
                <div key={org.id} className={`bg-gray-800 rounded-xl p-4 border ${org.activa ? 'border-gray-700' : 'border-red-800 opacity-60'}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-white">{org.nombre}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          org.plan === 'premium' ? 'bg-yellow-600 text-white' :
                          org.plan === 'profesional' ? 'bg-blue-600 text-white' :
                          org.plan === 'ilimitado' ? 'bg-purple-600 text-white' :
                          'bg-gray-600 text-gray-300'
                        }`}>
                          {PLANES[org.plan as keyof typeof PLANES]?.nombre || org.plan}
                        </span>
                        {!org.activa && <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs">INACTIVA</span>}
                      </div>
                      <p className="text-gray-400 text-sm mb-2">/{org.slug}</p>
                      <div className="flex gap-6 text-sm">
                        <span className="text-gray-400">Torneos: <span className="text-white">{org.torneos_count}/{org.limite_torneos}</span></span>
                        <span className="text-gray-400">Clubes: <span className="text-white">{org.clubes_count}/{org.limite_clubes}</span></span>
                        <span className="text-gray-400">Jugadores: <span className="text-white">{org.jugadores_count}/{org.limite_jugadores}</span></span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openStats(org)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">📊 Stats</button>
                      <button onClick={() => openCreateAdmin(org.id)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">+ Admin</button>
                      <button onClick={() => openEditOrg(org)} className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm">✏️ Editar</button>
                      <button onClick={() => handleToggleActive(org)} className={`px-3 py-1.5 rounded text-sm ${org.activa ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-green-600 hover:bg-green-700'} text-white`}>
                        {org.activa ? '⏸ Desactivar' : '▶ Activar'}
                      </button>
                      <button onClick={() => handleDeleteOrg(org)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm">🗑️</button>
                    </div>
                  </div>
                </div>
              ))}
              
              {organizaciones.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No hay organizaciones. Creá la primera.
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'stats' && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-xl p-6 text-center">
              <div className="text-4xl font-bold text-white mb-2">{organizaciones.length}</div>
              <div className="text-gray-400">Organizaciones</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 text-center">
              <div className="text-4xl font-bold text-green-400 mb-2">{organizaciones.filter(o => o.activa).length}</div>
              <div className="text-gray-400">Activas</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 text-center">
              <div className="text-4xl font-bold text-blue-400 mb-2">{organizaciones.reduce((sum, o) => sum + o.clubes_count, 0)}</div>
              <div className="text-gray-400">Clubes Total</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 text-center">
              <div className="text-4xl font-bold text-yellow-400 mb-2">{organizaciones.reduce((sum, o) => sum + o.jugadores_count, 0)}</div>
              <div className="text-gray-400">Jugadores Total</div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Crear/Editar Organización */}
      {showOrgModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">{editingOrg ? 'Editar Organización' : 'Nueva Organización'}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Nombre *</label>
                <input type="text" value={orgForm.nombre} onChange={(e) => setOrgForm({...orgForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="Asociación de Básquet..." />
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-1">Slug (URL) *</label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">buzzerlive.app/</span>
                  <input type="text" value={orgForm.slug} onChange={(e) => setOrgForm({...orgForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-')})} className="flex-1 p-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="mi-asociacion" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Email</label>
                  <input type="email" value={orgForm.email} onChange={(e) => setOrgForm({...orgForm, email: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Teléfono</label>
                  <input type="text" value={orgForm.telefono} onChange={(e) => setOrgForm({...orgForm, telefono: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-1">Plan</label>
                <select value={orgForm.plan} onChange={(e) => handlePlanChange(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                  {Object.entries(PLANES).map(([key, plan]) => (
                    <option key={key} value={key}>{plan.nombre}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Lím. Torneos</label>
                  <input type="number" value={orgForm.limite_torneos} onChange={(e) => setOrgForm({...orgForm, limite_torneos: parseInt(e.target.value)})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Lím. Clubes</label>
                  <input type="number" value={orgForm.limite_clubes} onChange={(e) => setOrgForm({...orgForm, limite_clubes: parseInt(e.target.value)})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Lím. Jugadores</label>
                  <input type="number" value={orgForm.limite_jugadores} onChange={(e) => setOrgForm({...orgForm, limite_jugadores: parseInt(e.target.value)})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
            </div>
            
            {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowOrgModal(false)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancelar</button>
              <button onClick={handleSaveOrg} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">{editingOrg ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear Admin */}
      {showAdminModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Crear Admin</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Email *</label>
                <input type="email" value={adminForm.email} onChange={(e) => setAdminForm({...adminForm, email: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Contraseña *</label>
                <input type="password" value={adminForm.password} onChange={(e) => setAdminForm({...adminForm, password: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Nombre *</label>
                  <input type="text" value={adminForm.nombre} onChange={(e) => setAdminForm({...adminForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Apellido</label>
                  <input type="text" value={adminForm.apellido} onChange={(e) => setAdminForm({...adminForm, apellido: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Teléfono</label>
                <input type="text" value={adminForm.telefono} onChange={(e) => setAdminForm({...adminForm, telefono: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
              </div>
            </div>
            
            {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAdminModal(false)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cancelar</button>
              <button onClick={handleCreateAdmin} disabled={!adminForm.email || !adminForm.password || !adminForm.nombre} className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg font-medium">Crear Admin</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Stats */}
      {showStatsModal && statsOrg && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">{statsOrg.nombre} - Estadísticas</h2>
            
            {selectedOrgStats && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{selectedOrgStats.torneos}</div>
                  <div className="text-gray-400 text-sm">Torneos</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{selectedOrgStats.clubes}</div>
                  <div className="text-gray-400 text-sm">Clubes</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{selectedOrgStats.jugadores}</div>
                  <div className="text-gray-400 text-sm">Jugadores</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{selectedOrgStats.partidosEsteMes}</div>
                  <div className="text-gray-400 text-sm">Partidos este mes</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{selectedOrgStats.partidosTotal}</div>
                  <div className="text-gray-400 text-sm">Partidos total</div>
                </div>
                <div className="bg-gray-700 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-white">{selectedOrgStats.usuarios}</div>
                  <div className="text-gray-400 text-sm">Usuarios</div>
                </div>
              </div>
            )}
            
            <h3 className="text-lg font-bold text-white mb-3">Usuarios</h3>
            <div className="space-y-2">
              {selectedOrgUsers.map((u) => (
                <div key={u.id} className="flex justify-between items-center bg-gray-700 rounded-lg p-3">
                  <div>
                    <span className="text-white font-medium">{u.nombre} {u.apellido}</span>
                    <span className="text-gray-400 ml-2 text-sm">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${u.rol === 'admin' ? 'bg-blue-600' : 'bg-green-600'} text-white`}>
                      {u.rol}
                    </span>
                    {u.club && <span className="text-gray-400 text-xs">{u.club.nombre_corto}</span>}
                    {!u.activo && <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs">Inactivo</span>}
                  </div>
                </div>
              ))}
              {selectedOrgUsers.length === 0 && <div className="text-gray-500 text-center py-4">Sin usuarios</div>}
            </div>
            
            <button onClick={() => setShowStatsModal(false)} className="w-full mt-6 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
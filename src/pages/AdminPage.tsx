import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCurrentUser, logout, createAuthUser, onAuthChange, type Usuario as AuthUsuario } from '../services/auth.service';
import { supabase } from '../services/supabase';
import { getTorneos, createTorneo, updateTorneo, deleteTorneo, getTorneoEquipos, addEquipoToTorneo, removeEquipoFromTorneo, generarFixture, getTablaPosiciones, CATEGORIAS, TIPOS_TORNEO, type Torneo, type TorneoEquipo } from '../services/torneo.service';
import { getPartidosSinPlanillero, getUsuariosDisponibles, asignarPlanillero, quitarAsignacion, getAsignacionesPartido, type PartidoSinAsignar, type Asignacion } from '../services/asignacion.service';
import { uploadClubLogo, uploadJugadorFoto, uploadJugadorCertificado } from '../services/storage.service';
import { descargarPlantillaJugadores, parsearExcelJugadores, importarJugadores, exportarJugadoresEquipo, type JugadorImport, type ImportResult } from '../services/excel.service';
import { imprimirPlanilla } from '../services/pdf.service';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import ImageUpload from '../components/common/ImageUpload';
import type { EstadoTorneo } from '../types';

type Tab = 'dashboard' | 'torneos' | 'clubes' | 'jugadores' | 'partidos' | 'asignaciones' | 'usuarios';
type TorneoTipo = 'liga' | 'copa' | 'liga_copa';

interface ClubLocal { id: string; nombre: string; nombre_corto: string; logo_url: string | null; activo: boolean; direccion: string | null; telefono: string | null; email: string | null; }
interface JugadorLocal { id: string; nombre: string; apellido: string; numero_camiseta: number; equipo_id: string; dni: string; fecha_nacimiento: string | null; certificado_medico_vencimiento: string | null; certificado_medico_url: string | null; foto_url: string | null; activo: boolean; es_refuerzo: boolean; cuartos_limite: number | null; equipo?: { nombre_corto: string }; }
interface PartidoLocal { id: string; fecha: string; hora: string; estado: string; equipo_local: { nombre_corto: string }; equipo_visitante: { nombre_corto: string }; equipo_local_id: string; equipo_visitante_id: string; puntos_local: number; puntos_visitante: number; torneo_id: string | null; torneo?: { nombre: string }; }
interface UsuarioLocal { id: string; email: string; nombre: string; apellido: string | null; rol: string; activo: boolean; club_id: string | null; club?: { nombre_corto: string }; }
interface TablaPosicionLocal { equipo_id: string; nombre: string; nombre_corto: string; logo_url: string | null; pj: number; pg: number; pe: number; pp: number; pf: number; pc: number; dif: number; pts: number; }

export default function AdminPage() {
  const navigate = useNavigate();
  const { orgSlug } = useParams();
  const [user, setUser] = useState<AuthUsuario | null>(getCurrentUser());
  const [tab, setTab] = useState<Tab>('dashboard');
  const [loading, setLoading] = useState(true);

  const [torneos, setTorneos] = useState<Torneo[]>([]);
  const [clubes, setClubes] = useState<ClubLocal[]>([]);
  const [jugadores, setJugadores] = useState<JugadorLocal[]>([]);
  const [partidos, setPartidos] = useState<PartidoLocal[]>([]);
  const [usuarios, setUsuarios] = useState<UsuarioLocal[]>([]);
  const [partidosSinAsignar, setPartidosSinAsignar] = useState<PartidoSinAsignar[]>([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState<UsuarioLocal[]>([]);

  const [filtroClub, setFiltroClub] = useState('');
  const [filtroTorneo, setFiltroTorneo] = useState('');

  // Modals
  const [showTorneoModal, setShowTorneoModal] = useState(false);
  const [editingTorneo, setEditingTorneo] = useState<Torneo | null>(null);
  const [torneoForm, setTorneoForm] = useState({ nombre: '', tipo: 'liga' as TorneoTipo, categoria: '', fecha_inicio: '', fecha_fin: '', estado: 'PROGRAMADO' as EstadoTorneo });

  const [showEquiposModal, setShowEquiposModal] = useState(false);
  const [selectedTorneo, setSelectedTorneo] = useState<Torneo | null>(null);
  const [torneoEquipos, setTorneoEquipos] = useState<TorneoEquipo[]>([]);
  const [tablaPosiciones, setTablaPosiciones] = useState<TablaPosicionLocal[]>([]);

  const [showClubModal, setShowClubModal] = useState(false);
  const [editingClub, setEditingClub] = useState<ClubLocal | null>(null);
  const [clubForm, setClubForm] = useState({ nombre: '', nombre_corto: '', logo_url: '', direccion: '', telefono: '', email: '' });

  const [showJugadorModal, setShowJugadorModal] = useState(false);
  const [editingJugador, setEditingJugador] = useState<JugadorLocal | null>(null);
  const [jugadorForm, setJugadorForm] = useState({ nombre: '', apellido: '', numero_camiseta: '', dni: '', fecha_nacimiento: '', equipo_id: '', certificado_medico_vencimiento: '', certificado_medico_url: '', foto_url: '', es_refuerzo: false, cuartos_limite: '' });

  const [showPartidoModal, setShowPartidoModal] = useState(false);
  const [partidoForm, setPartidoForm] = useState({ torneo_id: '', equipo_local_id: '', equipo_visitante_id: '', fecha: '', hora: '20:00', lugar: '' });

  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [partidoAsignar, setPartidoAsignar] = useState<PartidoSinAsignar | null>(null);
  const [asignacionesPartido, setAsignacionesPartido] = useState<Asignacion[]>([]);

  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ email: '', password: '', nombre: '', apellido: '', club_id: '' });

  const [error, setError] = useState<string | null>(null);
  
  // Import Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [importEquipoId, setImportEquipoId] = useState('');
  const [importPreview, setImportPreview] = useState<JugadorImport[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Suscribirse a cambios de autenticación
  useEffect(() => {
    const unsubscribe = onAuthChange((newUser) => {
      setUser(newUser);
    });
    return unsubscribe;
  }, []);

  const loadData = useCallback(async () => {
    if (!user?.organizacion_id) return;
    setLoading(true);
    const orgId = user.organizacion_id;
    const [torneosData, clubesRes, jugadoresRes, partidosRes, usuariosRes, sinAsignar, disponibles] = await Promise.all([
      getTorneos(orgId),
      supabase.from('equipos').select('*').eq('organizacion_id', orgId).order('nombre'),
      supabase.from('jugadores').select('*, equipo:equipos(nombre_corto)').eq('organizacion_id', orgId).order('apellido'),
      supabase.from('partidos').select('*, equipo_local:equipos!equipo_local_id(nombre_corto), equipo_visitante:equipos!equipo_visitante_id(nombre_corto), torneo:torneos(nombre)').eq('organizacion_id', orgId).order('fecha', { ascending: false }).limit(100),
      supabase.from('usuarios').select('id, email, nombre, apellido, rol, activo, club_id, club:equipos(nombre_corto)').eq('organizacion_id', orgId).order('nombre'),
      getPartidosSinPlanillero(orgId),
      getUsuariosDisponibles(orgId),
    ]);
    setTorneos(torneosData);
    setClubes(clubesRes.data || []);
    setJugadores(jugadoresRes.data || []);
    setPartidos(partidosRes.data || []);
    setUsuarios(usuariosRes.data || []);
    setPartidosSinAsignar(sinAsignar);
    setUsuariosDisponibles(disponibles);
    setLoading(false);
  }, [user?.organizacion_id]);

  // Cargar datos cuando el usuario esté listo
  useEffect(() => {
    if (!user) {
      setLoading(true);
      return;
    }
    if (user.rol !== 'admin' && user.rol !== 'superadmin') {
      navigate('/login');
      return;
    }
    if (user.rol === 'admin' && user.organizacion?.slug !== orgSlug) {
      navigate(`/${user.organizacion?.slug}`);
      return;
    }
    // Siempre recargar datos cuando user cambie
    loadData();
  }, [user, orgSlug, navigate, loadData]);

  // Auto-refresh cuando vuelve de minimizar o recupera conexión
  useAutoRefresh(() => {
    if (user?.organizacion_id) {
      loadData();
    }
  });

  const handleLogout = async () => { await logout(); navigate('/login'); };

  // TORNEOS
  const openCreateTorneo = () => { setEditingTorneo(null); setTorneoForm({ nombre: '', tipo: 'liga', categoria: '', fecha_inicio: '', fecha_fin: '', estado: 'PROGRAMADO' }); setShowTorneoModal(true); };
  const openEditTorneo = (t: Torneo) => { setEditingTorneo(t); setTorneoForm({ nombre: t.nombre, tipo: t.tipo, categoria: t.categoria || '', fecha_inicio: t.fecha_inicio || '', fecha_fin: t.fecha_fin || '', estado: t.estado }); setShowTorneoModal(true); };
  const handleSaveTorneo = async () => {
    if (!user?.organizacion_id) return; setError(null);
    const result = editingTorneo ? await updateTorneo(editingTorneo.id, torneoForm) : await createTorneo(user.organizacion_id, torneoForm);
    if (result.error) { setError(result.error); return; }
    setShowTorneoModal(false); loadData();
  };
  const handleDeleteTorneo = async (t: Torneo) => {
    if (!confirm(`¿Eliminar "${t.nombre}"?`)) return;
    const result = await deleteTorneo(t.id);
    if (!result.success) {
      const cambiarACancelado = confirm(`${result.error}\n\n¿Desea marcar el torneo como CANCELADO en su lugar?`);
      if (cambiarACancelado) {
        await updateTorneo(t.id, { estado: 'CANCELADO' });
        loadData();
      }
    } else {
      loadData();
    }
  };
  const openTorneoEquipos = async (t: Torneo) => { setSelectedTorneo(t); setTorneoEquipos(await getTorneoEquipos(t.id)); setTablaPosiciones(await getTablaPosiciones(t.id)); setShowEquiposModal(true); };
  const handleAddEquipo = async (equipoId: string) => { if (!selectedTorneo) return; await addEquipoToTorneo(selectedTorneo.id, equipoId); setTorneoEquipos(await getTorneoEquipos(selectedTorneo.id)); };
  const handleRemoveEquipo = async (equipoId: string) => { if (!selectedTorneo) return; await removeEquipoFromTorneo(selectedTorneo.id, equipoId); setTorneoEquipos(await getTorneoEquipos(selectedTorneo.id)); };
  const handleGenerarFixture = async () => { if (!selectedTorneo || !user?.organizacion_id || !confirm('¿Generar fixture?')) return; const { partidos: n, error } = await generarFixture(selectedTorneo.id, user.organizacion_id, true); if (error) alert(error); else { alert(`${n} partidos creados`); loadData(); setShowEquiposModal(false); } };

  // CLUBES
  const openCreateClub = () => { setEditingClub(null); setClubForm({ nombre: '', nombre_corto: '', logo_url: '', direccion: '', telefono: '', email: '' }); setShowClubModal(true); };
  const openEditClub = (c: ClubLocal) => { setEditingClub(c); setClubForm({ nombre: c.nombre, nombre_corto: c.nombre_corto || '', logo_url: c.logo_url || '', direccion: c.direccion || '', telefono: c.telefono || '', email: c.email || '' }); setShowClubModal(true); };
  const handleSaveClub = async () => {
    if (!user?.organizacion_id) return; setError(null);
    const data = { nombre: clubForm.nombre, nombre_corto: clubForm.nombre_corto, logo_url: clubForm.logo_url || null, direccion: clubForm.direccion || null, telefono: clubForm.telefono || null, email: clubForm.email || null };
    let result;
    if (editingClub) {
      result = await supabase.from('equipos').update(data).eq('id', editingClub.id);
    } else {
      result = await supabase.from('equipos').insert({ ...data, organizacion_id: user.organizacion_id, activo: true });
    }
    if (result.error) {
      console.error('Error completo:', result.error);
      setError(result.error.message + ' - ' + (result.error.details || '') + ' - ' + (result.error.hint || ''));
      return;
    }
    setShowClubModal(false); loadData();
  };
  const handleToggleClub = async (c: ClubLocal) => { await supabase.from('equipos').update({ activo: !c.activo }).eq('id', c.id); loadData(); };
  const handleUploadLogo = async (file: File) => {
    if (!editingClub) return { url: null, error: 'Guarda el club primero' };
    const result = await uploadClubLogo(file, editingClub.id);
    if (result.url) setClubForm({ ...clubForm, logo_url: result.url });
    return result;
  };

  // JUGADORES
  const openCreateJugador = () => { setEditingJugador(null); setJugadorForm({ nombre: '', apellido: '', numero_camiseta: '', dni: '', fecha_nacimiento: '', equipo_id: '', certificado_medico_vencimiento: '', certificado_medico_url: '', foto_url: '', es_refuerzo: false, cuartos_limite: '' }); setShowJugadorModal(true); };
  const openEditJugador = (j: JugadorLocal) => { setEditingJugador(j); setJugadorForm({ nombre: j.nombre, apellido: j.apellido, numero_camiseta: String(j.numero_camiseta), dni: j.dni || '', fecha_nacimiento: j.fecha_nacimiento || '', equipo_id: j.equipo_id, certificado_medico_vencimiento: j.certificado_medico_vencimiento || '', certificado_medico_url: j.certificado_medico_url || '', foto_url: j.foto_url || '', es_refuerzo: j.es_refuerzo || false, cuartos_limite: j.cuartos_limite ? String(j.cuartos_limite) : '' }); setShowJugadorModal(true); };
  const handleSaveJugador = async () => {
    if (!user?.organizacion_id) return; setError(null);
    const data = { nombre: jugadorForm.nombre, apellido: jugadorForm.apellido, numero_camiseta: parseInt(jugadorForm.numero_camiseta), dni: jugadorForm.dni || null, fecha_nacimiento: jugadorForm.fecha_nacimiento || null, equipo_id: jugadorForm.equipo_id, certificado_medico_vencimiento: jugadorForm.certificado_medico_vencimiento || null, foto_url: jugadorForm.foto_url || null, es_refuerzo: jugadorForm.es_refuerzo, cuartos_limite: jugadorForm.cuartos_limite ? parseInt(jugadorForm.cuartos_limite) : null };
    let result;
    if (editingJugador) result = await supabase.from('jugadores').update(data).eq('id', editingJugador.id);
    else result = await supabase.from('jugadores').insert({ ...data, organizacion_id: user.organizacion_id, activo: true });
    if (result.error) { console.error('Error:', result.error); setError(result.error.message); return; }
    setShowJugadorModal(false); loadData();
  };
  const handleToggleJugador = async (j: JugadorLocal) => { await supabase.from('jugadores').update({ activo: !j.activo }).eq('id', j.id); loadData(); };
  const handleUploadFoto = async (file: File) => {
    if (!editingJugador) return { url: null, error: 'Guarda el jugador primero' };
    const result = await uploadJugadorFoto(file, editingJugador.id);
    if (result.url) setJugadorForm({ ...jugadorForm, foto_url: result.url });
    return result;
  };
  const handleUploadCertificado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingJugador) { alert('Guarda el jugador primero'); return; }
    const result = await uploadJugadorCertificado(file, editingJugador.id);
    if (result.error) { alert(result.error); return; }
    if (result.url) { setJugadorForm({ ...jugadorForm, certificado_medico_url: result.url }); alert('Certificado subido correctamente'); }
  };

  // IMPORT EXCEL
  const openImportModal = () => { setImportEquipoId(''); setImportPreview([]); setImportResult(null); setShowImportModal(true); };
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const jugadores = await parsearExcelJugadores(file);
      setImportPreview(jugadores);
    } catch (_err) {
      alert('Error al leer el archivo');
      setImportPreview([]);
    }
  };
  const handleImport = async () => {
    if (!user?.organizacion_id || !importEquipoId || importPreview.length === 0) return;
    setImporting(true);
    const result = await importarJugadores(user.organizacion_id, importEquipoId, importPreview);
    setImportResult(result);
    setImporting(false);
    if (result.success > 0) loadData();
  };
  const handleExportEquipo = (equipoId: string, nombre: string) => { exportarJugadoresEquipo(equipoId, nombre); };

  // PARTIDOS
  const openCreatePartido = () => { setPartidoForm({ torneo_id: '', equipo_local_id: '', equipo_visitante_id: '', fecha: '', hora: '20:00', lugar: '' }); setShowPartidoModal(true); };
  const handleSavePartido = async () => {
    if (!user?.organizacion_id) return; setError(null);
    const result = await supabase.from('partidos').insert({ torneo_id: partidoForm.torneo_id || null, equipo_local_id: partidoForm.equipo_local_id, equipo_visitante_id: partidoForm.equipo_visitante_id, fecha: partidoForm.fecha, hora: partidoForm.hora, lugar: partidoForm.lugar || null, organizacion_id: user.organizacion_id, estado: 'PROGRAMADO', cuarto_actual: 0, puntos_local: 0, puntos_visitante: 0 });
    if (result.error) { console.error('Error:', result.error); setError(result.error.message); return; }
    setShowPartidoModal(false); loadData();
  };
  const handleDeletePartido = async (p: PartidoLocal) => { if (p.estado !== 'PROGRAMADO' || !confirm('¿Eliminar?')) return; await supabase.from('partidos').delete().eq('id', p.id); loadData(); };

  // ASIGNACIONES
  const openAsignar = async (p: PartidoSinAsignar) => { setPartidoAsignar(p); setAsignacionesPartido(await getAsignacionesPartido(p.id)); setShowAsignarModal(true); };
  const handleAsignar = async (usuarioId: string) => { if (!partidoAsignar) return; const { error } = await asignarPlanillero(partidoAsignar.id, usuarioId); if (error) alert(error); else { setAsignacionesPartido(await getAsignacionesPartido(partidoAsignar.id)); loadData(); } };
  const handleQuitarAsig = async (usuarioId: string) => { if (!partidoAsignar) return; await quitarAsignacion(partidoAsignar.id, usuarioId); setAsignacionesPartido(await getAsignacionesPartido(partidoAsignar.id)); loadData(); };

  // USUARIOS
  const openCreateUser = () => { setUserForm({ email: '', password: '', nombre: '', apellido: '', club_id: '' }); setShowUserModal(true); };
  const handleCreateUser = async () => {
    if (!user?.organizacion_id) return; setError(null);
    const { authId, error: authErr } = await createAuthUser(userForm.email, userForm.password);
    if (authErr || !authId) { setError(authErr || 'Error al crear auth'); return; }
    const result = await supabase.from('usuarios').insert({ auth_id: authId, email: userForm.email, nombre: userForm.nombre, apellido: userForm.apellido || null, rol: 'club', organizacion_id: user.organizacion_id, club_id: userForm.club_id || null, activo: true });
    if (result.error) { console.error('Error:', result.error); setError(result.error.message); return; }
    setShowUserModal(false); loadData(); alert('Usuario creado');
  };
  const handleToggleUser = async (u: UsuarioLocal) => { await supabase.from('usuarios').update({ activo: !u.activo }).eq('id', u.id); loadData(); };

  if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Cargando...</div>;

  const org = user?.organizacion;
  const jugadoresFiltrados = jugadores.filter(j => !filtroClub || j.equipo_id === filtroClub);
  const partidosFiltrados = partidos.filter(p => !filtroTorneo || p.torneo_id === filtroTorneo);

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div><h1 className="text-2xl font-bold text-white">{org?.nombre || 'Admin'}</h1><p className="text-sm text-gray-400">Panel de Administración</p></div>
          <div className="flex items-center gap-4"><span className="text-gray-300">{user?.email}</span><button onClick={() => navigate('/')} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm cursor-pointer">🏠 Inicio</button><button onClick={handleLogout} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm cursor-pointer">Salir</button></div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Stats */}
        <div className="grid grid-cols-6 gap-3 mb-6">
          {[
            { tab: 'torneos' as Tab, val: torneos.length, label: 'Torneos', color: 'text-white' },
            { tab: 'clubes' as Tab, val: clubes.length, label: 'Clubes', color: 'text-blue-400' },
            { tab: 'jugadores' as Tab, val: jugadores.length, label: 'Jugadores', color: 'text-green-400' },
            { tab: 'partidos' as Tab, val: partidos.length, label: 'Partidos', color: 'text-yellow-400' },
            { tab: 'asignaciones' as Tab, val: partidosSinAsignar.length, label: 'Sin Asignar', color: 'text-orange-400' },
            { tab: 'usuarios' as Tab, val: usuarios.length, label: 'Usuarios', color: 'text-purple-400' },
          ].map(s => (
            <div key={s.tab} onClick={() => setTab(s.tab)} className="bg-gray-800 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-700">
              <div className={`text-3xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-gray-400 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {(['dashboard', 'torneos', 'clubes', 'jugadores', 'partidos', 'asignaciones', 'usuarios'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg font-medium capitalize ${tab === t ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>{t}</button>
          ))}
        </div>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl p-6"><h2 className="text-xl font-bold text-white mb-4">Últimos Partidos</h2>
              <div className="space-y-2">{partidos.slice(0, 8).map(p => (
                <div key={p.id} className="flex justify-between items-center bg-gray-700 rounded-lg p-3">
                  <span className="text-white">{p.equipo_local?.nombre_corto} vs {p.equipo_visitante?.nombre_corto} {p.estado === 'FINALIZADO' && <span className="text-gray-400 ml-2">{p.puntos_local}-{p.puntos_visitante}</span>}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${p.estado === 'FINALIZADO' ? 'bg-green-600' : p.estado === 'EN_CURSO' ? 'bg-red-600 animate-pulse' : 'bg-gray-600'} text-white`}>{p.estado}</span>
                </div>
              ))}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-6"><h2 className="text-xl font-bold text-white mb-4">⚠️ Sin Planillero</h2>
              {partidosSinAsignar.length === 0 ? <p className="text-green-400">✓ Todos asignados</p> : (
                <div className="space-y-2">{partidosSinAsignar.slice(0, 8).map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-gray-700 rounded-lg p-3">
                    <span className="text-white">{p.equipo_local?.nombre_corto} vs {p.equipo_visitante?.nombre_corto} <span className="text-gray-400 text-sm ml-2">{new Date(p.fecha).toLocaleDateString()}</span></span>
                    <button onClick={() => openAsignar(p)} className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs">Asignar</button>
                  </div>
                ))}</div>
              )}
            </div>
          </div>
        )}

        {/* TORNEOS */}
        {tab === 'torneos' && (<>
          <button onClick={openCreateTorneo} className="mb-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">+ Torneo</button>
          <div className="grid gap-4">{torneos.map(t => (
            <div key={t.id} className="bg-gray-800 rounded-xl p-4 flex justify-between items-center">
              <div><h3 className="text-xl font-bold text-white">{t.nombre} <span className={`ml-2 px-2 py-0.5 rounded text-xs text-white ${
                t.estado === 'EN_CURSO' ? 'bg-green-600' :
                t.estado === 'FINALIZADO' ? 'bg-gray-600' :
                t.estado === 'PROGRAMADO' ? 'bg-blue-600' :
                t.estado === 'PLANIFICACION' ? 'bg-yellow-600' :
                t.estado === 'SUSPENDIDO' ? 'bg-orange-600' :
                t.estado === 'CANCELADO' ? 'bg-red-600' : 'bg-blue-600'
              }`}>{t.estado}</span></h3><p className="text-gray-400 text-sm">{t.categoria} {t.fecha_inicio && `· ${new Date(t.fecha_inicio).toLocaleDateString()}`}</p></div>
              <div className="flex gap-2">
                <button onClick={() => openTorneoEquipos(t)} className="px-3 py-1.5 bg-blue-600 cursor-pointer text-white rounded text-sm">⚙️ Equipos</button>
                <button onClick={() => openEditTorneo(t)} className="px-3 py-1.5 bg-gray-600 cursor-pointer text-white rounded text-sm">✏️</button>
                <button onClick={() => handleDeleteTorneo(t)} className="px-3 py-1.5 bg-red-600 cursor-pointer text-white rounded text-sm">🗑️</button>
              </div>
            </div>
          ))}</div>
        </>)}

        {/* CLUBES */}
        {tab === 'clubes' && (<>
          <button onClick={openCreateClub} className="mb-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">+ Club</button>
          <div className="grid grid-cols-2 gap-4">{clubes.map(c => (
            <div key={c.id} className={`bg-gray-800 rounded-xl p-4 flex items-center gap-4 ${!c.activo && 'opacity-50'}`}>
              {c.logo_url ? <img src={c.logo_url} className="w-16 h-16 rounded-full object-cover" /> : <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">🏀</div>}
              <div className="flex-1"><h3 className="text-lg font-bold text-white">{c.nombre}</h3><p className="text-gray-400 text-sm">{c.nombre_corto}</p></div>
              <div className="flex gap-2">
                <button onClick={() => openEditClub(c)} className="px-3 py-1.5 bg-gray-600 cursor-pointer text-white rounded text-sm">Editar</button>
                <button onClick={() => handleToggleClub(c)} className={`px-3 py-1.5 rounded text-sm text-white ${c.activo ? 'bg-yellow-600' : 'bg-green-600'}`}>{c.activo ? 'Desact.' : 'Activar'}</button>
              </div>
            </div>
          ))}</div>
        </>)}

        {/* JUGADORES */}
        {tab === 'jugadores' && (<>
          <div className="mb-4 flex flex-wrap gap-4 items-center">
            <button onClick={openCreateJugador} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium cursor-pointer">+ Jugador</button>
            <button onClick={openImportModal} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium cursor-pointer">📥 Importar Excel</button>
            <button onClick={() => descargarPlantillaJugadores()} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg font-medium cursor-pointer">📄 Plantilla</button>
            <select value={filtroClub} onChange={e => setFiltroClub(e.target.value)} className="p-2 bg-gray-700 border border-gray-600 rounded text-white"><option value="">Todos</option>{clubes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
            {filtroClub && <button onClick={() => { const club = clubes.find(c => c.id === filtroClub); if (club) handleExportEquipo(club.id, club.nombre); }} className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm cursor-pointer">📤 Exportar {clubes.find(c => c.id === filtroClub)?.nombre_corto}</button>}
          </div>
          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full"><thead className="bg-gray-700"><tr><th className="px-4 py-3 text-left text-gray-300 text-sm">Foto</th><th className="px-4 py-3 text-left text-gray-300 text-sm">#</th><th className="px-4 py-3 text-left text-gray-300 text-sm">Nombre</th><th className="px-4 py-3 text-left text-gray-300 text-sm">Club</th><th className="px-4 py-3 text-left text-gray-300 text-sm">DNI</th><th className="px-4 py-3 text-left text-gray-300 text-sm">Cert.</th><th className="px-4 py-3 text-right text-gray-300 text-sm">Acc.</th></tr></thead>
              <tbody>{jugadoresFiltrados.map(j => (
                <tr key={j.id} className={`border-t border-gray-700 hover:bg-gray-700/50 ${!j.activo && 'opacity-50'}`}>
                  <td className="px-4 py-2">{j.foto_url ? <img src={j.foto_url} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center">👤</div>}</td>
                  <td className="px-4 py-2 text-white font-bold">{j.numero_camiseta}</td>
                  <td className="px-4 py-2 text-white">{j.apellido}, {j.nombre} {j.es_refuerzo && <span className="text-orange-400 text-xs">(R)</span>}</td>
                  <td className="px-4 py-2 text-gray-400">{j.equipo?.nombre_corto}</td>
                  <td className="px-4 py-2 text-gray-400">{j.dni || '-'}</td>
                  <td className="px-4 py-2">{j.certificado_medico_url ? <a href={j.certificado_medico_url} target="_blank" rel="noopener noreferrer" className={`hover:underline ${j.certificado_medico_vencimiento && new Date(j.certificado_medico_vencimiento) < new Date() ? 'text-red-400' : 'text-green-400'}`}>📎 {j.certificado_medico_vencimiento ? new Date(j.certificado_medico_vencimiento).toLocaleDateString() : 'Ver'}</a> : (j.certificado_medico_vencimiento ? <span className={new Date(j.certificado_medico_vencimiento) < new Date() ? 'text-red-400' : 'text-yellow-400'}>{new Date(j.certificado_medico_vencimiento).toLocaleDateString()}</span> : <span className="text-gray-500">-</span>)}</td>
                  <td className="px-4 py-2 text-right"><button onClick={() => openEditJugador(j)} className="px-2 py-1 bg-gray-600 text-white rounded text-xs mr-1 cursor-pointer">Editar</button><button onClick={() => handleToggleJugador(j)} className={`px-2 py-1 rounded text-xs text-white cursor-pointer ${j.activo ? 'bg-yellow-600' : 'bg-green-600'}`}>{j.activo ? 'Baja' : 'Alta'}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>)}

        {/* PARTIDOS */}
        {tab === 'partidos' && (<>
          <div className="mb-4 flex gap-4">
            <button onClick={openCreatePartido} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium cursor-pointer">+ Partido</button>
            <select value={filtroTorneo} onChange={e => setFiltroTorneo(e.target.value)} className="p-2 bg-gray-700 border border-gray-600 rounded text-white"><option value="">Todos</option>{torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>
          </div>
          <div className="space-y-2">{partidosFiltrados.map(p => (
            <div key={p.id} className="bg-gray-800 rounded-xl p-4 flex justify-between items-center">
              <span className="text-white font-medium">{p.equipo_local?.nombre_corto} vs {p.equipo_visitante?.nombre_corto} {p.torneo && <span className="text-gray-400 text-sm ml-2">{p.torneo.nombre}</span>} {p.estado === 'FINALIZADO' && <span className="text-green-400 ml-2">{p.puntos_local}-{p.puntos_visitante}</span>}</span>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-xs ${p.estado === 'FINALIZADO' ? 'bg-green-600' : p.estado === 'EN_CURSO' ? 'bg-red-600 animate-pulse' : 'bg-gray-600'} text-white`}>{p.estado}</span>
                <span className="text-gray-400 text-sm">{new Date(p.fecha).toLocaleDateString()} {p.hora}</span>
                <button onClick={() => navigate(`/${orgSlug}/partido/${p.id}/live`)} className="px-3 py-1.5 bg-blue-600 cursor-pointer text-white rounded text-sm">{p.estado === 'EN_CURSO' ? 'Continuar' : p.estado === 'PROGRAMADO' ? 'Planillar' : 'Ver'}</button>
                {p.estado === 'FINALIZADO' && <button onClick={() => imprimirPlanilla(p.id)} className="px-2 py-1.5 bg-purple-600 cursor-pointer hover:bg-purple-700 text-white rounded text-sm" title="Imprimir Planilla">🖨️</button>}
                {p.estado === 'PROGRAMADO' && <button onClick={() => handleDeletePartido(p)} className="px-2 py-1.5 bg-red-600 cursor-pointer text-white rounded text-sm">🗑️</button>}
              </div>
            </div>
          ))}</div>
        </>)}

        {/* ASIGNACIONES */}
        {tab === 'asignaciones' && (
          <div><h2 className="text-xl font-bold text-white mb-4">Partidos Sin Planillero</h2>
            {partidosSinAsignar.length === 0 ? <p className="text-green-400">✓ Todos los partidos tienen planillero</p> : (
              <div className="grid gap-3">{partidosSinAsignar.map(p => (
                <div key={p.id} className="bg-gray-800 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-white">{p.equipo_local?.nombre_corto} vs {p.equipo_visitante?.nombre_corto} <span className="text-gray-400 text-sm ml-3">{new Date(p.fecha).toLocaleDateString()} {p.hora}</span> {p.torneo && <span className="text-gray-500 text-sm">· {p.torneo.nombre}</span>}</span>
                  <button onClick={() => openAsignar(p)} className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium">Asignar</button>
                </div>
              ))}</div>
            )}
          </div>
        )}

        {/* USUARIOS */}
        {tab === 'usuarios' && (<>
          <button onClick={openCreateUser} className="mb-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium">+ Usuario Club</button>
          <div className="grid gap-3">{usuarios.map(u => (
            <div key={u.id} className={`bg-gray-800 rounded-xl p-4 flex justify-between items-center ${!u.activo && 'opacity-50'}`}>
              <div><h3 className="text-lg font-medium text-white">{u.nombre} {u.apellido}</h3><p className="text-gray-400 text-sm">{u.email}</p></div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs ${u.rol === 'admin' ? 'bg-blue-600' : 'bg-green-600'} text-white`}>{u.rol}</span>
                {u.club && <span className="text-gray-400 text-sm">{u.club.nombre_corto}</span>}
                <button onClick={() => handleToggleUser(u)} className={`px-3 py-1.5 rounded text-sm text-white ${u.activo ? 'bg-yellow-600' : 'bg-green-600'}`}>{u.activo ? 'Desact.' : 'Activar'}</button>
              </div>
            </div>
          ))}</div>
        </>)}
      </div>

      {/* MODALS */}
      {showTorneoModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-white mb-4">{editingTorneo ? 'Editar' : 'Nuevo'} Torneo</h2>
          <div className="space-y-4">
            <div><label className="block text-gray-300 text-sm mb-1">Nombre *</label><input type="text" value={torneoForm.nombre} onChange={e => setTorneoForm({...torneoForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div>
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-gray-300 text-sm mb-1">Tipo</label><select value={torneoForm.tipo} onChange={e => setTorneoForm({...torneoForm, tipo: e.target.value as TorneoTipo})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">{TIPOS_TORNEO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div><div><label className="block text-gray-300 text-sm mb-1">Categoría</label><select value={torneoForm.categoria} onChange={e => setTorneoForm({...torneoForm, categoria: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"><option value="">-</option>{CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
            <div><label className="block text-gray-300 text-sm mb-1">Estado</label><select value={torneoForm.estado} onChange={e => setTorneoForm({...torneoForm, estado: e.target.value as EstadoTorneo})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"><option value="PROGRAMADO">Programado</option><option value="PLANIFICACION">Planificación</option><option value="EN_CURSO">En Curso</option><option value="FINALIZADO">Finalizado</option><option value="SUSPENDIDO">Suspendido</option><option value="CANCELADO">Cancelado</option></select></div>
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-gray-300 text-sm mb-1">Inicio</label><input type="date" value={torneoForm.fecha_inicio} onChange={e => setTorneoForm({...torneoForm, fecha_inicio: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div><div><label className="block text-gray-300 text-sm mb-1">Fin</label><input type="date" value={torneoForm.fecha_fin} onChange={e => setTorneoForm({...torneoForm, fecha_fin: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div></div>
          </div>
          {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
          <div className="flex gap-3 mt-6"><button onClick={() => setShowTorneoModal(false)} className="flex-1 py-2 bg-gray-600 cursor-pointer text-white rounded-lg">Cancelar</button><button onClick={handleSaveTorneo} disabled={!torneoForm.nombre} className="flex-1 py-2 bg-blue-600 cursor-pointer disabled:bg-gray-600 text-white rounded-lg font-medium">Guardar</button></div>
        </div></div>
      )}

      {showEquiposModal && selectedTorneo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto"><div className="bg-gray-800 rounded-2xl p-6 max-w-4xl w-full my-8">
          <h2 className="text-xl font-bold text-white mb-4">{selectedTorneo.nombre} - Equipos</h2>
          <div className="grid grid-cols-2 gap-6">
            <div><h3 className="text-lg font-medium text-white mb-3">En Torneo ({torneoEquipos.length})</h3><div className="space-y-2 max-h-60 overflow-y-auto">{torneoEquipos.map(te => (<div key={te.id} className="flex justify-between items-center bg-gray-700 rounded-lg p-2"><span className="text-white">{te.equipo?.nombre}</span><button onClick={() => handleRemoveEquipo(te.equipo_id)} className="px-2 py-1 bg-red-600 cursor-pointer text-white rounded text-xs">Quitar</button></div>))}</div>{torneoEquipos.length >= 2 && <button onClick={handleGenerarFixture} className="mt-4 w-full py-2 bg-green-600 cursor-pointer text-white rounded-lg font-medium">🗓️ Generar Fixture</button>}</div>
            <div><h3 className="text-lg font-medium text-white mb-3">Disponibles</h3><div className="space-y-2 max-h-60 overflow-y-auto">{clubes.filter(c => c.activo && !torneoEquipos.find(te => te.equipo_id === c.id)).map(c => (<div key={c.id} className="flex justify-between items-center bg-gray-700 rounded-lg p-2"><span className="text-white">{c.nombre}</span><button onClick={() => handleAddEquipo(c.id)} className="px-2 py-1 bg-blue-600 cursor-pointer text-white rounded text-xs">Agregar</button></div>))}</div></div>
          </div>
          {tablaPosiciones.length > 0 && (<div className="mt-6"><h3 className="text-lg font-medium text-white mb-3">Tabla</h3><div className="bg-gray-700 rounded-lg overflow-hidden"><table className="w-full text-sm"><thead className="bg-gray-600"><tr><th className="px-3 py-2 text-left text-gray-300">#</th><th className="px-3 py-2 text-left text-gray-300">Equipo</th><th className="px-3 py-2 text-center text-gray-300">PJ</th><th className="px-3 py-2 text-center text-gray-300">G</th><th className="px-3 py-2 text-center text-gray-300">P</th><th className="px-3 py-2 text-center text-gray-300">DIF</th><th className="px-3 py-2 text-center text-gray-300 font-bold">PTS</th></tr></thead><tbody>{tablaPosiciones.map((t, i) => (<tr key={t.equipo_id} className="border-t border-gray-600"><td className="px-3 py-2 text-white font-bold">{i+1}</td><td className="px-3 py-2 text-white">{t.nombre_corto}</td><td className="px-3 py-2 text-center text-gray-300">{t.pj}</td><td className="px-3 py-2 text-center text-green-400">{t.pg}</td><td className="px-3 py-2 text-center text-red-400">{t.pp}</td><td className="px-3 py-2 text-center text-gray-300">{t.dif > 0 ? '+' : ''}{t.dif}</td><td className="px-3 py-2 text-center text-yellow-400 font-bold">{t.pts}</td></tr>))}</tbody></table></div></div>)}
          <button onClick={() => setShowEquiposModal(false)} className="mt-6 w-full py-2 bg-gray-600 cursor-pointer text-white rounded-lg">Cerrar</button>
        </div></div>
      )}

      {showClubModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-white mb-4">{editingClub ? 'Editar' : 'Nuevo'} Club</h2>
          <div className="space-y-4">
            {editingClub && <div className="flex justify-center"><ImageUpload currentUrl={clubForm.logo_url} onUpload={handleUploadLogo} placeholder="🏀" label="Logo" size="lg" /></div>}
            <div><label className="block text-gray-300 text-sm mb-1">Nombre *</label><input type="text" value={clubForm.nombre} onChange={e => setClubForm({...clubForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div>
            <div><label className="block text-gray-300 text-sm mb-1">Nombre Corto *</label><input type="text" value={clubForm.nombre_corto} onChange={e => setClubForm({...clubForm, nombre_corto: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" maxLength={10} /></div>
            <div><label className="block text-gray-300 text-sm mb-1">Dirección</label><input type="text" value={clubForm.direccion} onChange={e => setClubForm({...clubForm, direccion: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" placeholder="Av. Ejemplo 123" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-gray-300 text-sm mb-1">Teléfono</label><input type="text" value={clubForm.telefono} onChange={e => setClubForm({...clubForm, telefono: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div>
              <div><label className="block text-gray-300 text-sm mb-1">Email</label><input type="email" value={clubForm.email} onChange={e => setClubForm({...clubForm, email: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div>
            </div>
          </div>
          {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
          <div className="flex gap-3 mt-6"><button onClick={() => setShowClubModal(false)} className="flex-1 py-2 bg-gray-600 cursor-pointer text-white rounded-lg">Cancelar</button><button onClick={handleSaveClub} disabled={!clubForm.nombre || !clubForm.nombre_corto} className="flex-1 py-2 bg-blue-600 cursor-pointer disabled:bg-gray-600 text-white rounded-lg font-medium">Guardar</button></div>
        </div></div>
      )}

      {showJugadorModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-white mb-4">{editingJugador ? 'Editar' : 'Nuevo'} Jugador</h2>
          <div className="space-y-4">
            {editingJugador && <div className="flex justify-center"><ImageUpload currentUrl={jugadorForm.foto_url} onUpload={handleUploadFoto} placeholder="👤" label="Foto" size="lg" /></div>}
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-gray-300 text-sm mb-1">Nombre *</label><input type="text" value={jugadorForm.nombre} onChange={e => setJugadorForm({...jugadorForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div><div><label className="block text-gray-300 text-sm mb-1">Apellido *</label><input type="text" value={jugadorForm.apellido} onChange={e => setJugadorForm({...jugadorForm, apellido: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div></div>
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-gray-300 text-sm mb-1">Número *</label><input type="number" value={jugadorForm.numero_camiseta} onChange={e => setJugadorForm({...jugadorForm, numero_camiseta: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" min="0" max="99" /></div><div><label className="block text-gray-300 text-sm mb-1">Club *</label><select value={jugadorForm.equipo_id} onChange={e => setJugadorForm({...jugadorForm, equipo_id: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"><option value="">-</option>{clubes.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div></div>
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-gray-300 text-sm mb-1">DNI</label><input type="text" value={jugadorForm.dni} onChange={e => setJugadorForm({...jugadorForm, dni: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div><div><label className="block text-gray-300 text-sm mb-1">Fecha Nac.</label><input type="date" value={jugadorForm.fecha_nacimiento} onChange={e => setJugadorForm({...jugadorForm, fecha_nacimiento: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div></div>
            <div className="p-3 bg-gray-700/50 rounded-lg border border-gray-600">
              <label className="block text-gray-300 text-sm mb-2">📋 Certificado Médico</label>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-gray-400 text-xs mb-1">Vencimiento</label><input type="date" value={jugadorForm.certificado_medico_vencimiento} onChange={e => setJugadorForm({...jugadorForm, certificado_medico_vencimiento: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white text-sm" /></div>
                <div><label className="block text-gray-400 text-xs mb-1">Archivo (PDF/Imagen)</label>{editingJugador ? <input type="file" accept="image/*,.pdf" onChange={handleUploadCertificado} className="w-full p-1.5 bg-gray-700 border border-gray-600 rounded text-white text-xs" /> : <span className="text-gray-500 text-xs">Guarda primero</span>}</div>
              </div>
              {jugadorForm.certificado_medico_url && <a href={jugadorForm.certificado_medico_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-blue-400 hover:text-blue-300 text-sm">📎 Ver certificado actual</a>}
            </div>
            <div className="flex items-center gap-4 p-3 bg-orange-900/20 border border-orange-700 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={jugadorForm.es_refuerzo} onChange={e => setJugadorForm({...jugadorForm, es_refuerzo: e.target.checked})} className="w-4 h-4" /><span className="text-orange-400 font-medium">⚠️ Es Refuerzo</span></label>
              {jugadorForm.es_refuerzo && <div className="flex items-center gap-2"><label className="text-gray-300 text-sm">Máx cuartos:</label><select value={jugadorForm.cuartos_limite} onChange={e => setJugadorForm({...jugadorForm, cuartos_limite: e.target.value})} className="p-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"><option value="">Sin límite</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></div>}
            </div>
          </div>
          {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
          <div className="flex gap-3 mt-6"><button onClick={() => setShowJugadorModal(false)} className="flex-1 py-2 bg-gray-600 cursor-pointer text-white rounded-lg">Cancelar</button><button onClick={handleSaveJugador} disabled={!jugadorForm.nombre || !jugadorForm.apellido || !jugadorForm.equipo_id || !jugadorForm.numero_camiseta} className="flex-1 py-2 bg-blue-600 cursor-pointer disabled:bg-gray-600 text-white rounded-lg font-medium">Guardar</button></div>
        </div></div>
      )}

      {showPartidoModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-white mb-4">Nuevo Partido</h2>
          <div className="space-y-4">
            <div><label className="block text-gray-300 text-sm mb-1">Torneo</label><select value={partidoForm.torneo_id} onChange={e => setPartidoForm({...partidoForm, torneo_id: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"><option value="">Sin torneo</option>{torneos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-gray-300 text-sm mb-1">Local *</label><select value={partidoForm.equipo_local_id} onChange={e => setPartidoForm({...partidoForm, equipo_local_id: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"><option value="">-</option>{clubes.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div><div><label className="block text-gray-300 text-sm mb-1">Visitante *</label><select value={partidoForm.equipo_visitante_id} onChange={e => setPartidoForm({...partidoForm, equipo_visitante_id: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"><option value="">-</option>{clubes.filter(c => c.activo && c.id !== partidoForm.equipo_local_id).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div></div>
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-gray-300 text-sm mb-1">Fecha *</label><input type="date" value={partidoForm.fecha} onChange={e => setPartidoForm({...partidoForm, fecha: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div><div><label className="block text-gray-300 text-sm mb-1">Hora *</label><input type="time" value={partidoForm.hora} onChange={e => setPartidoForm({...partidoForm, hora: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div></div>
            <div><label className="block text-gray-300 text-sm mb-1">Lugar</label><input type="text" value={partidoForm.lugar} onChange={e => setPartidoForm({...partidoForm, lugar: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div>
          </div>
          {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
          <div className="flex gap-3 mt-6"><button onClick={() => setShowPartidoModal(false)} className="flex-1 py-2 bg-gray-600 cursor-pointer text-white rounded-lg">Cancelar</button><button onClick={handleSavePartido} disabled={!partidoForm.equipo_local_id || !partidoForm.equipo_visitante_id || !partidoForm.fecha} className="flex-1 py-2 bg-blue-600 cursor-pointer disabled:bg-gray-600 text-white rounded-lg font-medium">Crear</button></div>
        </div></div>
      )}

      {showAsignarModal && partidoAsignar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-2xl p-6 max-w-lg w-full">
          <h2 className="text-xl font-bold text-white mb-2">Asignar Planillero</h2>
          <p className="text-gray-400 mb-4">{partidoAsignar.equipo_local?.nombre_corto} vs {partidoAsignar.equipo_visitante?.nombre_corto} - {new Date(partidoAsignar.fecha).toLocaleDateString()}</p>
          {asignacionesPartido.length > 0 && (<div className="mb-4"><h3 className="text-sm font-medium text-gray-300 mb-2">Asignados:</h3><div className="space-y-2">{asignacionesPartido.map(a => (<div key={a.id} className="flex justify-between items-center bg-green-900/30 border border-green-700 rounded-lg p-2"><span className="text-white">{a.usuario?.nombre} {a.usuario?.apellido} {a.usuario?.club && <span className="text-gray-400 text-sm">({a.usuario.club.nombre_corto})</span>}</span><button onClick={() => handleQuitarAsig(a.usuario_id)} className="px-2 py-1 bg-red-600 cursor-pointer text-white rounded text-xs">Quitar</button></div>))}</div></div>)}
          <h3 className="text-sm font-medium text-gray-300 mb-2">Disponibles:</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">{usuariosDisponibles.filter(u => !asignacionesPartido.find(a => a.usuario_id === u.id)).map(u => (<div key={u.id} className="flex justify-between items-center bg-gray-700 rounded-lg p-2"><span className="text-white">{u.nombre} {u.apellido} {u.club && <span className="text-gray-400 text-sm">({u.club.nombre_corto})</span>}</span><button onClick={() => handleAsignar(u.id)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs">Asignar</button></div>))}</div>
          <button onClick={() => setShowAsignarModal(false)} className="mt-6 w-full py-2 bg-gray-600 cursor-pointer text-white rounded-lg">Cerrar</button>
        </div></div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full">
          <h2 className="text-xl font-bold text-white mb-4">Nuevo Usuario Club</h2>
          <div className="space-y-4">
            <div><label className="block text-gray-300 text-sm mb-1">Email *</label><input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div>
            <div><label className="block text-gray-300 text-sm mb-1">Contraseña *</label><input type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div>
            <div className="grid grid-cols-2 gap-4"><div><label className="block text-gray-300 text-sm mb-1">Nombre *</label><input type="text" value={userForm.nombre} onChange={e => setUserForm({...userForm, nombre: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div><div><label className="block text-gray-300 text-sm mb-1">Apellido</label><input type="text" value={userForm.apellido} onChange={e => setUserForm({...userForm, apellido: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" /></div></div>
            <div><label className="block text-gray-300 text-sm mb-1">Club</label><select value={userForm.club_id} onChange={e => setUserForm({...userForm, club_id: e.target.value})} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white"><option value="">Sin club</option>{clubes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          </div>
          {error && <div className="mt-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">{error}</div>}
          <div className="flex gap-3 mt-6"><button onClick={() => setShowUserModal(false)} className="flex-1 py-2 bg-gray-600 cursor-pointer text-white rounded-lg">Cancelar</button><button onClick={handleCreateUser} disabled={!userForm.email || !userForm.password || !userForm.nombre} className="flex-1 py-2 bg-green-600 cursor-pointer disabled:bg-gray-600 text-white rounded-lg font-medium">Crear</button></div>
        </div></div>
      )}

      {/* Modal Import Excel */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold text-white mb-4">📥 Importar Jugadores desde Excel</h2>
            
            {!importResult ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Club destino *</label>
                  <select value={importEquipoId} onChange={e => setImportEquipoId(e.target.value)} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white">
                    <option value="">Seleccionar club...</option>
                    {clubes.filter(c => c.activo).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Archivo Excel (.xlsx)</label>
                  <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white" />
                </div>
                
                {importPreview.length > 0 && (
                  <div>
                    <p className="text-gray-300 text-sm mb-2">Vista previa ({importPreview.length} jugadores):</p>
                    <div className="bg-gray-900 rounded-lg overflow-auto max-h-60">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-700">
                          <tr>
                            <th className="px-2 py-1 text-left text-gray-300">#</th>
                            <th className="px-2 py-1 text-left text-gray-300">Nombre</th>
                            <th className="px-2 py-1 text-left text-gray-300">Apellido</th>
                            <th className="px-2 py-1 text-left text-gray-300">DNI</th>
                            <th className="px-2 py-1 text-left text-gray-300">Ref.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importPreview.map((j, i) => (
                            <tr key={i} className="border-t border-gray-700">
                              <td className="px-2 py-1 text-white">{j.numero_camiseta}</td>
                              <td className="px-2 py-1 text-white">{j.nombre}</td>
                              <td className="px-2 py-1 text-white">{j.apellido}</td>
                              <td className="px-2 py-1 text-gray-400">{j.dni || '-'}</td>
                              <td className="px-2 py-1">{j.es_refuerzo ? <span className="text-orange-400">SI</span> : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowImportModal(false)} className="flex-1 py-2 bg-gray-600 cursor-pointer text-white rounded-lg">Cancelar</button>
                  <button onClick={handleImport} disabled={!importEquipoId || importPreview.length === 0 || importing} className="flex-1 py-2 bg-green-600 cursor-pointer disabled:bg-gray-600 text-white rounded-lg font-medium">
                    {importing ? 'Importando...' : `Importar ${importPreview.length} jugadores`}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg">
                  <p className="text-green-400 font-medium">✅ {importResult.success} jugadores importados correctamente</p>
                </div>
                
                {importResult.errors.length > 0 && (
                  <div className="p-4 bg-red-900/30 border border-red-700 rounded-lg">
                    <p className="text-red-400 font-medium mb-2">❌ {importResult.errors.length} errores:</p>
                    <ul className="text-red-300 text-sm space-y-1">
                      {importResult.errors.map((e, i) => <li key={i}>Fila {e.row}: {e.error}</li>)}
                    </ul>
                  </div>
                )}
                
                <button onClick={() => setShowImportModal(false)} className="w-full py-2 bg-blue-600 cursor-pointer text-white rounded-lg font-medium">Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
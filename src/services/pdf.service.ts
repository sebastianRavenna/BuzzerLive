import { supabase } from './supabase';

interface JugadorPlanilla {
  numero: number;
  nombre: string;
  apellido: string;
  dni: string | null;
  puntos: number;
  faltas: number;
  esRefuerzo: boolean;
}

interface DatosPlanilla {
  partido: {
    id: string;
    fecha: string;
    hora: string;
    lugar: string | null;
    arbitroPrincipal: string | null;
    arbitroAuxiliar: string | null;
    anotador: string | null;
    cronometrista: string | null;
    observaciones: string | null;
  };
  torneo: { nombre: string; categoria: string | null } | null;
  organizacion: { nombre: string; logo: string | null } | null;
  local: {
    nombre: string;
    corto: string;
    logo: string | null;
    puntos: number;
    puntosCuarto: number[];
    jugadores: JugadorPlanilla[];
  };
  visitante: {
    nombre: string;
    corto: string;
    logo: string | null;
    puntos: number;
    puntosCuarto: number[];
    jugadores: JugadorPlanilla[];
  };
}

// Obtener datos completos para la planilla
export async function getDatosPlanilla(partidoId: string): Promise<DatosPlanilla | null> {
  // Obtener partido
  const { data: partido, error } = await supabase
    .from('partidos')
    .select(`
      *,
      equipo_local:equipos!equipo_local_id(id, nombre, nombre_corto, logo_url),
      equipo_visitante:equipos!equipo_visitante_id(id, nombre, nombre_corto, logo_url),
      torneo:torneos(nombre, categoria),
      organizacion:organizaciones(nombre, logo_url)
    `)
    .eq('id', partidoId)
    .single();

  if (error || !partido) return null;

  // Obtener jugadores de ambos equipos
  const [{ data: jugLocal }, { data: jugVisit }] = await Promise.all([
    supabase.from('jugadores').select('id, numero_camiseta, nombre, apellido, dni, es_refuerzo')
      .eq('equipo_id', partido.equipo_local_id).eq('activo', true).order('numero_camiseta'),
    supabase.from('jugadores').select('id, numero_camiseta, nombre, apellido, dni, es_refuerzo')
      .eq('equipo_id', partido.equipo_visitante_id).eq('activo', true).order('numero_camiseta'),
  ]);

  // Obtener estadísticas
  const { data: stats } = await supabase
    .from('estadisticas_jugador')
    .select('jugador_id, puntos, faltas_personales')
    .eq('partido_id', partidoId);

  const statsMap = new Map(stats?.map(s => [s.jugador_id, s]) || []);

  // Función para mapear jugadores con stats
  const mapJugadores = (jugadores: any[]): JugadorPlanilla[] => {
    return (jugadores || []).map(j => {
      const s = statsMap.get(j.id);
      return {
        numero: j.numero_camiseta,
        nombre: j.nombre,
        apellido: j.apellido,
        dni: j.dni,
        puntos: s?.puntos || 0,
        faltas: s?.faltas_personales || 0,
        esRefuerzo: j.es_refuerzo || false,
      };
    });
  };

  // Puntos por cuarto (simulado si no existe la tabla)
  const puntosLocalCuarto = [0, 0, 0, 0];
  const puntosVisitCuarto = [0, 0, 0, 0];

  return {
    partido: {
      id: partido.id,
      fecha: partido.fecha,
      hora: partido.hora,
      lugar: partido.lugar,
      arbitroPrincipal: partido.arbitro_principal,
      arbitroAuxiliar: partido.arbitro_auxiliar,
      anotador: partido.anotador,
      cronometrista: partido.cronometrista,
      observaciones: partido.observaciones,
    },
    torneo: partido.torneo ? { nombre: partido.torneo.nombre, categoria: partido.torneo.categoria } : null,
    organizacion: partido.organizacion ? { nombre: partido.organizacion.nombre, logo: partido.organizacion.logo_url } : null,
    local: {
      nombre: partido.equipo_local.nombre,
      corto: partido.equipo_local.nombre_corto,
      logo: partido.equipo_local.logo_url,
      puntos: partido.puntos_local,
      puntosCuarto: puntosLocalCuarto,
      jugadores: mapJugadores(jugLocal || []),
    },
    visitante: {
      nombre: partido.equipo_visitante.nombre,
      corto: partido.equipo_visitante.nombre_corto,
      logo: partido.equipo_visitante.logo_url,
      puntos: partido.puntos_visitante,
      puntosCuarto: puntosVisitCuarto,
      jugadores: mapJugadores(jugVisit || []),
    },
  };
}

// Generar HTML de la planilla
function generarHTML(datos: DatosPlanilla): string {
  const fecha = new Date(datos.partido.fecha).toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  const renderJugadores = (jugadores: JugadorPlanilla[]) => jugadores.map(j => `
    <tr>
      <td class="num">${j.numero}</td>
      <td class="nombre">${j.apellido}, ${j.nombre}${j.esRefuerzo ? ' <span class="ref">(R)</span>' : ''}</td>
      <td class="dni">${j.dni || '-'}</td>
      <td class="pts">${j.puntos}</td>
      <td class="faltas">${'●'.repeat(Math.min(j.faltas, 5))}${'○'.repeat(Math.max(0, 5 - j.faltas))}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Planilla - ${datos.local.corto} vs ${datos.visitante.corto}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 10mm; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
    .header h1 { font-size: 16px; margin-bottom: 4px; }
    .header h2 { font-size: 12px; font-weight: normal; color: #666; }
    .info { display: flex; justify-content: space-between; margin-bottom: 15px; padding: 8px; background: #f5f5f5; }
    .info div { flex: 1; }
    .info label { font-size: 9px; color: #666; display: block; }
    .marcador { display: flex; align-items: center; justify-content: center; margin: 15px 0; }
    .equipo { flex: 1; text-align: center; }
    .equipo .nombre { font-size: 14px; font-weight: bold; }
    .equipo .puntos { font-size: 36px; font-weight: bold; }
    .vs { font-size: 16px; color: #999; margin: 0 20px; }
    .equipos { display: flex; gap: 15px; }
    .equipo-tabla { flex: 1; }
    .equipo-tabla h3 { background: #333; color: #fff; padding: 6px 10px; font-size: 11px; margin-bottom: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
    th { background: #eee; font-size: 9px; }
    .num { width: 30px; text-align: center; font-weight: bold; }
    .nombre { }
    .dni { width: 70px; font-size: 9px; }
    .pts { width: 35px; text-align: center; font-weight: bold; }
    .faltas { width: 60px; text-align: center; font-size: 10px; letter-spacing: 2px; }
    .ref { color: orange; font-size: 9px; }
    .oficiales { margin-top: 15px; display: flex; gap: 15px; }
    .oficial { flex: 1; }
    .oficial label { font-size: 9px; color: #666; }
    .oficial .linea { border-bottom: 1px solid #333; height: 20px; margin-top: 2px; }
    .firmas { display: flex; justify-content: space-around; margin-top: 30px; }
    .firma { text-align: center; width: 120px; }
    .firma .linea { border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; font-size: 9px; }
    .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #999; }
    @media print { body { padding: 5mm; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>PLANILLA OFICIAL DE PARTIDO</h1>
    ${datos.torneo ? `<h2>${datos.torneo.nombre}${datos.torneo.categoria ? ` - ${datos.torneo.categoria}` : ''}</h2>` : ''}
    ${datos.organizacion ? `<h2>${datos.organizacion.nombre}</h2>` : ''}
  </div>

  <div class="info">
    <div><label>FECHA</label>${fecha}</div>
    <div><label>HORA</label>${datos.partido.hora}</div>
    <div><label>LUGAR</label>${datos.partido.lugar || '-'}</div>
  </div>

  <div class="marcador">
    <div class="equipo">
      <div class="nombre">${datos.local.nombre}</div>
      <div class="puntos">${datos.local.puntos}</div>
    </div>
    <div class="vs">VS</div>
    <div class="equipo">
      <div class="nombre">${datos.visitante.nombre}</div>
      <div class="puntos">${datos.visitante.puntos}</div>
    </div>
  </div>

  <div class="equipos">
    <div class="equipo-tabla">
      <h3>${datos.local.corto} (LOCAL)</h3>
      <table>
        <thead><tr><th>#</th><th>JUGADOR</th><th>DNI</th><th>PTS</th><th>FALTAS</th></tr></thead>
        <tbody>${renderJugadores(datos.local.jugadores)}</tbody>
      </table>
    </div>
    <div class="equipo-tabla">
      <h3>${datos.visitante.corto} (VISITANTE)</h3>
      <table>
        <thead><tr><th>#</th><th>JUGADOR</th><th>DNI</th><th>PTS</th><th>FALTAS</th></tr></thead>
        <tbody>${renderJugadores(datos.visitante.jugadores)}</tbody>
      </table>
    </div>
  </div>

  <div class="oficiales">
    <div class="oficial"><label>ÁRBITRO PRINCIPAL</label><div class="linea">${datos.partido.arbitroPrincipal || ''}</div></div>
    <div class="oficial"><label>ÁRBITRO AUXILIAR</label><div class="linea">${datos.partido.arbitroAuxiliar || ''}</div></div>
    <div class="oficial"><label>ANOTADOR</label><div class="linea">${datos.partido.anotador || ''}</div></div>
    <div class="oficial"><label>CRONOMETRISTA</label><div class="linea">${datos.partido.cronometrista || ''}</div></div>
  </div>

  ${datos.partido.observaciones ? `<div style="margin-top:15px;padding:10px;background:#fff9e6;border:1px solid #e6d9a6"><label style="font-size:9px;color:#666">OBSERVACIONES</label><div>${datos.partido.observaciones}</div></div>` : ''}

  <div class="firmas">
    <div class="firma"><div class="linea">Capitán Local</div></div>
    <div class="firma"><div class="linea">Capitán Visitante</div></div>
    <div class="firma"><div class="linea">Árbitro Principal</div></div>
    <div class="firma"><div class="linea">Anotador</div></div>
  </div>

  <div class="footer">Generado por BuzzerLive - ${new Date().toLocaleString('es-AR')}</div>
</body>
</html>`;
}

// Abrir planilla para imprimir
export async function imprimirPlanilla(partidoId: string): Promise<boolean> {
  const datos = await getDatosPlanilla(partidoId);
  if (!datos) {
    alert('Error al cargar datos del partido');
    return false;
  }

  const html = generarHTML(datos);
  const ventana = window.open('', '_blank');
  
  if (!ventana) {
    alert('Habilita las ventanas emergentes para ver la planilla');
    return false;
  }

  ventana.document.write(html);
  ventana.document.close();
  ventana.onload = () => ventana.print();
  
  return true;
}

// Descargar como HTML
export async function descargarPlanilla(partidoId: string): Promise<boolean> {
  const datos = await getDatosPlanilla(partidoId);
  if (!datos) {
    alert('Error al cargar datos del partido');
    return false;
  }

  const html = generarHTML(datos);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `planilla_${datos.local.corto}_vs_${datos.visitante.corto}.html`;
  a.click();
  URL.revokeObjectURL(url);
  
  return true;
}

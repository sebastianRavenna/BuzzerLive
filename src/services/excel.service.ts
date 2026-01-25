import { supabase } from './supabase';
import * as XLSX from 'xlsx';

export interface JugadorImport {
  nombre: string;
  apellido: string;
  numero_camiseta: number;
  dni?: string;
  fecha_nacimiento?: string;
  telefono?: string;
  email?: string;
  posicion?: string;
  es_refuerzo?: boolean;
}

export interface ImportResult {
  success: number;
  errors: { row: number; error: string }[];
}

// Plantilla de ejemplo para descargar
const PLANTILLA_JUGADORES = [
  {
    nombre: 'Juan',
    apellido: 'Pérez',
    numero_camiseta: 10,
    dni: '12345678',
    fecha_nacimiento: '1995-05-15',
    telefono: '1155551234',
    email: 'juan@email.com',
    posicion: 'Base',
    es_refuerzo: 'NO'
  },
  {
    nombre: 'Carlos',
    apellido: 'López',
    numero_camiseta: 23,
    dni: '23456789',
    fecha_nacimiento: '1998-10-20',
    telefono: '1155555678',
    email: 'carlos@email.com',
    posicion: 'Escolta',
    es_refuerzo: 'SI'
  }
];

// Descargar plantilla de ejemplo
export function descargarPlantillaJugadores(): void {
  const ws = XLSX.utils.json_to_sheet(PLANTILLA_JUGADORES);
  
  // Ajustar ancho de columnas
  ws['!cols'] = [
    { wch: 15 }, // nombre
    { wch: 15 }, // apellido
    { wch: 8 },  // numero
    { wch: 12 }, // dni
    { wch: 12 }, // fecha_nacimiento
    { wch: 12 }, // telefono
    { wch: 25 }, // email
    { wch: 12 }, // posicion
    { wch: 10 }, // es_refuerzo
  ];
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Jugadores');
  
  XLSX.writeFile(wb, 'plantilla_jugadores.xlsx');
}

// Parsear archivo Excel
export async function parsearExcelJugadores(file: File): Promise<JugadorImport[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        const jugadores: JugadorImport[] = jsonData.map((row: any) => ({
          nombre: String(row.nombre || '').trim(),
          apellido: String(row.apellido || '').trim(),
          numero_camiseta: parseInt(row.numero_camiseta) || 0,
          dni: row.dni ? String(row.dni).trim() : undefined,
          fecha_nacimiento: row.fecha_nacimiento ? formatDate(row.fecha_nacimiento) : undefined,
          telefono: row.telefono ? String(row.telefono).trim() : undefined,
          email: row.email ? String(row.email).trim() : undefined,
          posicion: row.posicion ? String(row.posicion).trim() : undefined,
          es_refuerzo: String(row.es_refuerzo || '').toUpperCase() === 'SI',
        }));
        
        resolve(jugadores);
      } catch (err) {
        reject(new Error('Error al leer el archivo Excel'));
      }
    };
    
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

// Formatear fecha (Excel puede enviar número o string)
function formatDate(value: any): string | undefined {
  if (!value) return undefined;
  
  // Si es un número (serial de Excel)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  // Si ya es string en formato YYYY-MM-DD
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  
  // Intentar parsear otros formatos
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }
  
  return undefined;
}

// Importar jugadores a un equipo
export async function importarJugadores(
  organizacionId: string,
  equipoId: string,
  jugadores: JugadorImport[]
): Promise<ImportResult> {
  const result: ImportResult = { success: 0, errors: [] };
  
  for (let i = 0; i < jugadores.length; i++) {
    const j = jugadores[i];
    const rowNum = i + 2; // +2 porque Excel empieza en 1 y tiene header
    
    // Validar campos obligatorios
    if (!j.nombre) {
      result.errors.push({ row: rowNum, error: 'Nombre requerido' });
      continue;
    }
    if (!j.apellido) {
      result.errors.push({ row: rowNum, error: 'Apellido requerido' });
      continue;
    }
    if (!j.numero_camiseta || j.numero_camiseta < 0 || j.numero_camiseta > 99) {
      result.errors.push({ row: rowNum, error: 'Número de camiseta inválido (0-99)' });
      continue;
    }
    
    // Verificar que el número no esté duplicado en el equipo
    const { data: existente } = await supabase
      .from('jugadores')
      .select('id')
      .eq('equipo_id', equipoId)
      .eq('numero_camiseta', j.numero_camiseta)
      .single();
    
    if (existente) {
      result.errors.push({ row: rowNum, error: `Número ${j.numero_camiseta} ya existe en el equipo` });
      continue;
    }
    
    // Insertar jugador
    const { error } = await supabase.from('jugadores').insert({
      organizacion_id: organizacionId,
      equipo_id: equipoId,
      nombre: j.nombre,
      apellido: j.apellido,
      numero_camiseta: j.numero_camiseta,
      dni: j.dni || null,
      fecha_nacimiento: j.fecha_nacimiento || null,
      telefono: j.telefono || null,
      email: j.email || null,
      posicion: j.posicion || null,
      es_refuerzo: j.es_refuerzo || false,
      activo: true,
    });
    
    if (error) {
      result.errors.push({ row: rowNum, error: error.message });
    } else {
      result.success++;
    }
  }
  
  return result;
}

// Exportar jugadores de un equipo a Excel
export async function exportarJugadoresEquipo(equipoId: string, nombreEquipo: string): Promise<void> {
  const { data: jugadores } = await supabase
    .from('jugadores')
    .select('nombre, apellido, numero_camiseta, dni, fecha_nacimiento, telefono, email, posicion, es_refuerzo, activo')
    .eq('equipo_id', equipoId)
    .order('numero_camiseta');
  
  if (!jugadores || jugadores.length === 0) {
    alert('No hay jugadores para exportar');
    return;
  }
  
  const dataExport = jugadores.map(j => ({
    nombre: j.nombre,
    apellido: j.apellido,
    numero_camiseta: j.numero_camiseta,
    dni: j.dni || '',
    fecha_nacimiento: j.fecha_nacimiento || '',
    telefono: j.telefono || '',
    email: j.email || '',
    posicion: j.posicion || '',
    es_refuerzo: j.es_refuerzo ? 'SI' : 'NO',
    activo: j.activo ? 'SI' : 'NO',
  }));
  
  const ws = XLSX.utils.json_to_sheet(dataExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Jugadores');
  
  XLSX.writeFile(wb, `jugadores_${nombreEquipo.replace(/\s+/g, '_')}.xlsx`);
}

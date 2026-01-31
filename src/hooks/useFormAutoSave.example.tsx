/**
 * EJEMPLO DE USO: useFormAutoSave Hook
 *
 * Este archivo muestra cómo usar el hook useFormAutoSave para preservar
 * formularios automáticamente cuando la app se recarga (por ej. después de minimizar).
 */

import { useState } from 'react';
import { useFormAutoSave } from './useFormAutoSave';

// ============================================================================
// EJEMPLO 1: Formulario de Crear Jugador
// ============================================================================

interface JugadorFormData {
  nombre: string;
  apellido: string;
  dni: string;
  numero_camiseta: number;
  fecha_nacimiento: string;
}

export function CrearJugadorForm() {
  // ✅ Usar useFormAutoSave en lugar de useState
  const [formData, setFormData, clearForm] = useFormAutoSave<JugadorFormData>(
    'crear-jugador', // ID único del formulario
    {
      nombre: '',
      apellido: '',
      dni: '',
      numero_camiseta: 0,
      fecha_nacimiento: '',
    }
  );

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Guardar jugador en la BD
      // await crearJugador(formData);

      // ✅ IMPORTANTE: Limpiar formulario guardado después de éxito
      clearForm();

      alert('Jugador creado exitosamente');
    } catch (error) {
      console.error('Error creando jugador:', error);
      // ❌ NO limpiar si hay error - el formulario se preserva para reintentar
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Nombre"
        value={formData.nombre}
        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
      />

      <input
        type="text"
        placeholder="Apellido"
        value={formData.apellido}
        onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
      />

      <input
        type="text"
        placeholder="DNI"
        value={formData.dni}
        onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
      />

      <input
        type="number"
        placeholder="Número de camiseta"
        value={formData.numero_camiseta}
        onChange={(e) =>
          setFormData({ ...formData, numero_camiseta: parseInt(e.target.value) })
        }
      />

      <input
        type="date"
        value={formData.fecha_nacimiento}
        onChange={(e) =>
          setFormData({ ...formData, fecha_nacimiento: e.target.value })
        }
      />

      <button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : 'Crear Jugador'}
      </button>
    </form>
  );
}

// ============================================================================
// EJEMPLO 2: Formulario de Editar Club
// ============================================================================

interface ClubFormData {
  nombre: string;
  ciudad: string;
  logo_url: string;
}

export function EditarClubForm({ clubId }: { clubId: string }) {
  // ✅ Usa el ID del club en el formId para formularios de edición
  const [formData, setFormData, clearForm] = useFormAutoSave<ClubFormData>(
    `editar-club-${clubId}`, // ID único por club
    {
      nombre: '',
      ciudad: '',
      logo_url: '',
    }
  );

  // Resto del código similar...
  return <div>Formulario de editar club</div>;
}

// ============================================================================
// EJEMPLO 3: Formulario Complejo con Múltiples Secciones
// ============================================================================

interface UsuarioCompleto {
  // Sección 1: Datos personales
  nombre: string;
  apellido: string;
  email: string;

  // Sección 2: Datos de la cuenta
  username: string;
  rol: 'admin' | 'club' | 'superadmin';

  // Sección 3: Configuración
  notificaciones: boolean;
  idioma: string;
}

export function CrearUsuarioCompleto() {
  const [formData, setFormData, clearForm] = useFormAutoSave<UsuarioCompleto>(
    'crear-usuario-completo',
    {
      nombre: '',
      apellido: '',
      email: '',
      username: '',
      rol: 'club',
      notificaciones: true,
      idioma: 'es',
    }
  );

  // ✅ Helper para actualizar campos individuales
  const updateField = <K extends keyof UsuarioCompleto>(
    field: K,
    value: UsuarioCompleto[K]
  ) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <form>
      {/* Sección 1 */}
      <section>
        <h2>Datos Personales</h2>
        <input
          value={formData.nombre}
          onChange={(e) => updateField('nombre', e.target.value)}
        />
        <input
          value={formData.apellido}
          onChange={(e) => updateField('apellido', e.target.value)}
        />
        <input
          type="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
        />
      </section>

      {/* Sección 2 */}
      <section>
        <h2>Cuenta</h2>
        <input
          value={formData.username}
          onChange={(e) => updateField('username', e.target.value)}
        />
        <select
          value={formData.rol}
          onChange={(e) => updateField('rol', e.target.value as any)}
        >
          <option value="club">Club</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Super Admin</option>
        </select>
      </section>

      {/* Sección 3 */}
      <section>
        <h2>Configuración</h2>
        <label>
          <input
            type="checkbox"
            checked={formData.notificaciones}
            onChange={(e) => updateField('notificaciones', e.target.checked)}
          />
          Recibir notificaciones
        </label>
      </section>

      <button type="submit">Crear Usuario</button>
    </form>
  );
}

// ============================================================================
// NOTAS IMPORTANTES
// ============================================================================

/*
1. ✅ SIEMPRE limpia el formulario después de éxito:
   - clearForm() después de guardar exitosamente
   - Esto evita que datos viejos se restauren la próxima vez

2. ❌ NO limpies si hay error:
   - Si la operación falla, deja los datos guardados
   - El usuario puede corregir y reintentar

3. 🔑 IDs únicos:
   - Crear: 'crear-jugador', 'crear-club', etc.
   - Editar: 'editar-jugador-{id}', 'editar-club-{id}', etc.

4. 🔄 Auto-reload preserva:
   - ✅ Formularios (gracias a useFormAutoSave)
   - ✅ Sesión de usuario (Supabase persistSession: true)
   - ✅ Estado de auth

5. 💾 Los datos se guardan:
   - Cada vez que setFormData() se llama
   - Cuando el componente se desmonta
   - En localStorage del browser
*/
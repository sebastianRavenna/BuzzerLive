# Migración Urgente - Fix UI Congelada

## Problema Solucionado
Esta migración soluciona el bug del UI congelada después de minimizar la app. El problema era que después del RPC exitoso, el código intentaba hacer queries adicionales usando el cliente de Supabase congelado.

## Pasos para Ejecutar

### 1. Ir al Dashboard de Supabase
- Abre https://supabase.com/dashboard
- Selecciona tu proyecto BuzzerLive

### 2. Ir al SQL Editor
- En el menú lateral, click en "SQL Editor"
- Click en "New query"

### 3. Copiar y Ejecutar el SQL
Copia todo el contenido del archivo `migration_fix_registrar_accion.sql` y pégalo en el editor.

Luego presiona "Run" o Ctrl/Cmd + Enter.

### 4. Verificar
Deberías ver un mensaje de éxito: "Success. No rows returned"

## Qué Hace Esta Migración
- Agrega 4 parámetros opcionales a la función `registrar_accion`:
  - `p_tiros_libres`: número de tiros libres
  - `p_numero_falta`: número de falta del equipo
  - `p_puntos_local`: marcador parcial local
  - `p_puntos_visitante`: marcador parcial visitante

- Estos campos ahora se guardan directamente en el INSERT inicial, eliminando la necesidad de hacer queries posteriores que causaban el freeze.

## Cambios en el Código
El código TypeScript ya está actualizado para:
- Pasar estos campos al RPC call
- Eliminar las queries problemáticas (líneas 214-237 anteriores)

## Testing
Después de ejecutar la migración:
1. Abre la app en un dispositivo móvil o navegador
2. Ve a un partido en vivo
3. Minimiza la app por 10+ segundos
4. Vuelve a la app
5. Intenta registrar una acción (punto o falta)
6. ✅ La UI NO debería congelarse, los botones deberían responder inmediatamente

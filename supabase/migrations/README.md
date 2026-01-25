# Migraciones de Base de Datos

Este directorio contiene las migraciones SQL para actualizar la base de datos de Supabase.

## Cómo aplicar migraciones

### Opción 1: Desde el Dashboard de Supabase (Recomendado)

1. Ir a tu proyecto en Supabase Dashboard
2. Navegar a **SQL Editor**
3. Abrir el archivo de migración que necesitas ejecutar
4. Copiar y pegar el contenido completo
5. Ejecutar el script SQL
6. Verificar que no haya errores

### Opción 2: Usando Supabase CLI

```bash
# Instalar Supabase CLI (si no lo tienes)
npm install -g supabase

# Login a Supabase
supabase login

# Link al proyecto
supabase link --project-ref [tu-project-ref]

# Aplicar migraciones pendientes
supabase db push
```

## Migraciones Disponibles

### 20260125_add_trainer_faults_and_substitutions.sql

**Descripción:** Agrega soporte para faltas de entrenador y sustituciones

**Cambios:**
- Agrega `FALTA_TECNICA_ENTRENADOR` al enum `tipo_accion`
- Agrega `FALTA_TECNICA_BANCO` al enum `tipo_accion`
- Agrega `FALTA_DESCALIFICANTE_ENTRENADOR` al enum `tipo_accion`
- Agrega `SUSTITUCION` al enum `tipo_accion`
- Agrega columnas `jugador_entra_id` y `jugador_sale_id` a la tabla `acciones`
- Crea índices para mejorar el rendimiento

**Aplicar:** Esta migración es necesaria para solucionar los errores de enum con dobles comillas.

## Notas Importantes

- Las migraciones deben aplicarse en orden cronológico (por fecha en el nombre del archivo)
- Siempre hacer backup de la base de datos antes de aplicar migraciones en producción
- Verificar que la migración se ejecute sin errores antes de continuar

# BuzzerLive - Sistema de Gestión de Partidos de Básquet

## Documento de Requerimientos Funcionales (DRF)
**Versión:** 1.0  
**Fecha:** Enero 2026  
**Cliente:** Liga de Básquet (piloto) → Federaciones (comercial)

---

## 1. Visión del Producto

### 1.1 Problema
Las planillas de papel para registrar partidos de básquet presentan:
- Errores humanos difíciles de corregir
- No hay seguimiento en tiempo real para público/interesados
- Carga manual posterior a bases de datos
- Pérdida o deterioro de planillas físicas
- Imposibilidad de generar estadísticas automáticas

### 1.2 Solución
Aplicación web/móvil que:
- Digitaliza la planilla oficial CABB
- Permite carga en tiempo real durante el partido
- Sincroniza automáticamente con base de datos central
- Actualiza tablas de posiciones y estadísticas al finalizar
- Funciona offline y sincroniza cuando hay conexión

### 1.3 Usuarios Objetivo
| Usuario | Necesidad |
|---------|-----------|
| **Planillero** | Cargar datos del partido en tiempo real |
| **Público/Hinchas** | Ver el marcador en vivo desde cualquier lugar |
| **Dirigentes** | Ver tablas de posiciones actualizadas |
| **Entrenadores** | Consultar estadísticas de jugadores |
| **Federación** | Administrar torneos y validar resultados |

---

## 2. Alcance por Versiones

### v0.1 - MVP Lite ✅
**Objetivo:** Validar la idea con funcionalidad mínima

**Incluye:**
- [ ] Crear partido (equipos, fecha, lugar)
- [ ] Registrar roster de jugadores por equipo
- [ ] Cargar puntos (1pt, 2pt, 3pt) asignados a jugador
- [ ] Cargar faltas personales por jugador
- [ ] Cargar faltas de equipo por cuarto
- [ ] Marcador en tiempo real (vista pública)
- [ ] Finalizar partido y registrar resultado
- [ ] Tabla de posiciones básica (PJ, PG, PP, PF, PC, Dif, Pts)

**No incluye:**
- Tiempos muertos
- Sustituciones/minutos jugados
- Estadísticas avanzadas (rebotes, asistencias, etc.)
- Múltiples torneos
- Historial de jugadores

### v0.2 - Core
**Objetivo:** Planilla completa digital

**Agrega:**
- [ ] Tiempos muertos por equipo
- [ ] Control de período/cuarto actual
- [ ] Tiempo suplementario (overtime)
- [ ] Registro de árbitros y staff
- [ ] Exportar planilla a PDF (formato CABB)
- [ ] Historial de partidos por equipo
- [ ] Autenticación de planilleros

### v1.0 - Full
**Objetivo:** Producto comercializable

**Agrega:**
- [ ] Múltiples torneos/ligas
- [ ] Estadísticas avanzadas por jugador
- [ ] Rankings de goleadores, asistidores, etc.
- [ ] Panel de administración para federaciones
- [ ] Reportes y analytics
- [ ] API pública para integración con otros sistemas

---

## 3. Requerimientos Funcionales Detallados (MVP v0.1)

### RF-001: Gestión de Torneos
| Campo | Detalle |
|-------|---------|
| **ID** | RF-001 |
| **Título** | Crear y administrar torneo |
| **Descripción** | El sistema debe permitir crear un torneo con nombre, categoría, y temporada |
| **Datos** | nombre, categoría, temporada, fecha_inicio, fecha_fin, estado |
| **Reglas** | Solo administradores pueden crear torneos |

### RF-002: Gestión de Equipos
| Campo | Detalle |
|-------|---------|
| **ID** | RF-002 |
| **Título** | Registrar equipos en torneo |
| **Descripción** | Agregar equipos participantes con su roster de jugadores |
| **Datos equipo** | nombre, escudo_url, club, categoria |
| **Datos jugador** | credencial, numero_camiseta, nombre, apellido, dni, es_capitan |
| **Reglas** | Mínimo 5 jugadores, máximo 12 por equipo |

### RF-003: Programar Partido
| Campo | Detalle |
|-------|---------|
| **ID** | RF-003 |
| **Título** | Crear fixture de partido |
| **Descripción** | Programar un partido entre dos equipos |
| **Datos** | torneo_id, equipo_local_id, equipo_visitante_id, fecha, hora, lugar, jornada, fase |
| **Estados** | PROGRAMADO → EN_CURSO → FINALIZADO / SUSPENDIDO |

### RF-004: Carga de Partido en Vivo
| Campo | Detalle |
|-------|---------|
| **ID** | RF-004 |
| **Título** | Registrar acciones durante el partido |
| **Descripción** | El planillero carga cada acción que ocurre |
| **Acciones MVP** | PUNTO_1, PUNTO_2, PUNTO_3, FALTA_PERSONAL, FALTA_EQUIPO |
| **Datos acción** | partido_id, equipo_id, jugador_id, tipo_accion, cuarto, timestamp |
| **Reglas** | Solo planilleros asignados pueden cargar |

### RF-005: Marcador en Tiempo Real
| Campo | Detalle |
|-------|---------|
| **ID** | RF-005 |
| **Título** | Visualización pública del partido |
| **Descripción** | Cualquier persona puede ver el marcador actualizado |
| **Datos mostrados** | Equipos, marcador, cuarto actual, faltas de equipo, últimas acciones |
| **Actualización** | Real-time (WebSocket/Supabase Realtime) |

### RF-006: Finalizar Partido
| Campo | Detalle |
|-------|---------|
| **ID** | RF-006 |
| **Título** | Cerrar partido y calcular resultado |
| **Descripción** | Al finalizar, el sistema calcula el ganador y actualiza estadísticas |
| **Cálculos** | Puntos por cuarto, puntaje final, equipo vencedor |
| **Disparadores** | Actualizar tabla de posiciones del torneo |

### RF-007: Tabla de Posiciones
| Campo | Detalle |
|-------|---------|
| **ID** | RF-007 |
| **Título** | Tabla de posiciones automática |
| **Descripción** | Se actualiza automáticamente al finalizar cada partido |
| **Columnas** | Pos, Equipo, PJ, PG, PP, PF, PC, DIF, PTS |
| **Reglas puntos** | Victoria = 2 pts, Derrota = 1 pt (FIBA) |
| **Desempate** | Diferencia de puntos → Puntos a favor |

---

## 4. Requerimientos No Funcionales

### RNF-001: Offline First
- La app debe funcionar sin conexión a internet
- Los datos se guardan localmente (IndexedDB)
- Al recuperar conexión, sincroniza automáticamente
- Manejo de conflictos: última escritura gana (con timestamp)

### RNF-002: Rendimiento
- Tiempo de carga inicial < 3 segundos
- Latencia de actualización real-time < 2 segundos
- Debe funcionar en dispositivos de gama media (2GB RAM)

### RNF-003: Disponibilidad
- El sistema debe estar disponible 99.5% del tiempo
- Durante horarios de partidos (viernes-domingo): 99.9%

### RNF-004: Seguridad
- Autenticación requerida para cargar partidos
- Solo lectura para usuarios no autenticados
- HTTPS obligatorio
- Tokens JWT con expiración

### RNF-005: Escalabilidad
- Soportar al menos 10 partidos simultáneos
- Hasta 1000 usuarios concurrentes viendo marcadores
- Base de datos escalable (PostgreSQL)

### RNF-006: Usabilidad
- Interfaz optimizada para tablets (principal dispositivo de carga)
- Botones grandes para carga rápida durante partido
- Confirmación antes de acciones destructivas
- Posibilidad de deshacer última acción

---

## 5. Modelo de Datos (Entidades Principales)

```
┌─────────────────┐       ┌─────────────────┐
│     TORNEO      │       │     EQUIPO      │
├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │
│ nombre          │◄──────│ torneo_id       │
│ categoria       │       │ nombre          │
│ temporada       │       │ escudo_url      │
│ fecha_inicio    │       │ club            │
│ fecha_fin       │       └────────┬────────┘
│ estado          │                │
└─────────────────┘                │ 1:N
                                   ▼
┌─────────────────┐       ┌─────────────────┐
│    PARTIDO      │       │    JUGADOR      │
├─────────────────┤       ├─────────────────┤
│ id              │       │ id              │
│ torneo_id       │       │ equipo_id       │
│ equipo_local_id │       │ credencial      │
│ equipo_visit_id │       │ numero          │
│ fecha           │       │ nombre          │
│ hora            │       │ apellido        │
│ lugar           │       │ es_capitan      │
│ jornada         │       └────────┬────────┘
│ fase            │                │
│ cuarto_actual   │                │
│ estado          │                │
└────────┬────────┘                │
         │                         │
         │ 1:N                     │
         ▼                         │
┌─────────────────┐                │
│     ACCION      │◄───────────────┘
├─────────────────┤        N:1
│ id              │
│ partido_id      │
│ equipo_id       │
│ jugador_id      │
│ tipo            │
│ cuarto          │
│ timestamp       │
│ valor           │
└─────────────────┘

┌─────────────────┐
│   POSICIONES    │ (Vista calculada o tabla desnormalizada)
├─────────────────┤
│ torneo_id       │
│ equipo_id       │
│ partidos_jugados│
│ partidos_ganados│
│ partidos_perdidos│
│ puntos_favor    │
│ puntos_contra   │
│ diferencia      │
│ puntos          │
└─────────────────┘
```

---

## 6. Arquitectura Propuesta

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │   PWA React     │    │   Web Pública   │                 │
│  │  (Planillero)   │    │   (Espectador)  │                 │
│  │                 │    │                 │                 │
│  │ - Carga partido │    │ - Ver marcador  │                 │
│  │ - Offline mode  │    │ - Ver tabla     │                 │
│  │ - IndexedDB     │    │ - Ver fixture   │                 │
│  └────────┬────────┘    └────────┬────────┘                 │
│           │                      │                          │
└───────────┼──────────────────────┼──────────────────────────┘
            │                      │
            │    HTTPS / WSS       │
            ▼                      ▼
┌─────────────────────────────────────────────────────────────┐
│                       SUPABASE                               │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │   PostgreSQL    │    │    Realtime     │                 │
│  │                 │◄───│   (WebSocket)   │                 │
│  │ - Torneos       │    │                 │                 │
│  │ - Equipos       │    │ - Broadcast     │                 │
│  │ - Jugadores     │    │ - Presence      │                 │
│  │ - Partidos      │    │                 │                 │
│  │ - Acciones      │    └─────────────────┘                 │
│  └─────────────────┘                                        │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │      Auth       │    │    Storage      │                 │
│  │                 │    │                 │                 │
│  │ - JWT Tokens    │    │ - Escudos       │                 │
│  │ - Roles         │    │ - Fotos         │                 │
│  └─────────────────┘    └─────────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
            │
            │  Hosting
            ▼
┌─────────────────────────────────────────────────────────────┐
│                        VERCEL                                │
│                                                             │
│  - Deploy automático desde GitHub                           │
│  - SSL gratuito                                             │
│  - CDN global                                               │
│  - Preview deployments                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Interfaces de Usuario (Wireframes Básicos)

### 7.1 Pantalla de Carga de Partido (Planillero)

```
┌─────────────────────────────────────────────────────────────┐
│  ◄ Volver          PARTIDO EN VIVO            Q2  05:32    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌───────────────────┐     ┌───────────────────┐          │
│   │    CLUB NORTE     │     │    CLUB SUR       │          │
│   │                   │     │                   │          │
│   │       45          │     │       42          │          │
│   │                   │     │                   │          │
│   │  Faltas Eq: ●●●○  │     │  Faltas Eq: ●●○○  │          │
│   └───────────────────┘     └───────────────────┘          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  EQUIPO ACTIVO: [CLUB NORTE ▼]                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐              │
│  │  4  │  │  7  │  │ 10  │  │ 11  │  │ 23  │   Jugadores  │
│  │     │  │     │  │     │  │     │  │     │   en cancha  │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘              │
│                                                             │
│  JUGADOR SELECCIONADO: #10 - Juan Pérez                    │
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │         │  │         │  │         │  │         │       │
│  │  +1 PT  │  │  +2 PTS │  │  +3 PTS │  │  FALTA  │       │
│  │         │  │         │  │         │  │         │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  FALTA EQUIPO   │  │ DESHACER ÚLTIMO │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [  FIN CUARTO  ]              [  FINALIZAR PARTIDO  ]     │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Pantalla Pública (Espectador)

```
┌─────────────────────────────────────────────────────────────┐
│              🏀 LIGA METROPOLITANA 2026                     │
│                    EN VIVO AHORA                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                                                     │  │
│   │   🔴 CLUB NORTE        45 - 42        CLUB SUR     │  │
│   │                                                     │  │
│   │                    2do Cuarto                       │  │
│   │                                                     │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│   ÚLTIMAS JUGADAS:                                         │
│   ────────────────                                         │
│   • +2 pts - #10 J. Pérez (Norte)         hace 30 seg     │
│   • Falta - #23 M. García (Sur)           hace 1 min      │
│   • +3 pts - #7 L. Rodríguez (Sur)        hace 2 min      │
│                                                             │
│   ────────────────────────────────────────────────────────  │
│                                                             │
│   PARCIALES:                                               │
│   Q1: Norte 18 - 15 Sur                                    │
│   Q2: Norte 27 - 27 Sur  (en curso)                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Plan de Desarrollo (Sprints)

### Sprint 0 - Setup (1 semana)
- [ ] Crear proyecto Supabase
- [ ] Crear esquema de base de datos
- [ ] Configurar proyecto React + Vite
- [ ] Configurar deploy en Vercel
- [ ] Crear repositorio GitHub

### Sprint 1 - Backend Base (1 semana)
- [ ] Implementar tablas: torneos, equipos, jugadores
- [ ] Configurar Row Level Security (RLS)
- [ ] Crear datos de prueba
- [ ] Probar queries básicas

### Sprint 2 - Partidos (2 semanas)
- [ ] Implementar tabla partidos y acciones
- [ ] Crear lógica de carga de partido
- [ ] Implementar cálculo de marcador
- [ ] Configurar Supabase Realtime

### Sprint 3 - Frontend Planillero (2 semanas)
- [ ] UI de selección de partido
- [ ] UI de carga en vivo
- [ ] Integración con Supabase
- [ ] Botones de acciones rápidas

### Sprint 4 - Frontend Público (1 semana)
- [ ] Vista de partido en vivo
- [ ] Tabla de posiciones
- [ ] Lista de partidos

### Sprint 5 - Offline & Polish (1 semana)
- [ ] Implementar IndexedDB
- [ ] Lógica de sincronización
- [ ] PWA manifest
- [ ] Testing y bugfixes

**Total estimado MVP: 8 semanas**

---

## 9. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Conflictos de sincronización offline | Media | Alto | Timestamp + last-write-wins + log de conflictos |
| Pérdida de conexión durante partido | Alta | Alto | Cola de acciones local + retry automático |
| Supabase free tier insuficiente | Baja | Medio | Monitorear uso, migrar a paid si necesario |
| Baja adopción por planilleros | Media | Alto | UI muy simple, capacitación, feedback continuo |

---

## 10. Criterios de Aceptación MVP

El MVP se considera exitoso si:

1. ✅ Se puede cargar un partido completo desde la app
2. ✅ El marcador se actualiza en tiempo real para espectadores
3. ✅ La tabla de posiciones se actualiza automáticamente al finalizar
4. ✅ Funciona offline y sincroniza al recuperar conexión
5. ✅ Al menos 5 partidos de prueba completados sin errores críticos

---

## Apéndice A: Glosario

| Término | Definición |
|---------|------------|
| **CABB** | Confederación Argentina de Básquetbol |
| **FIBA** | Federación Internacional de Baloncesto |
| **PWA** | Progressive Web App |
| **Planillero** | Persona encargada de registrar las acciones del partido |
| **Cuarto** | Período de 10 minutos de juego (FIBA) |
| **Overtime** | Tiempo suplementario en caso de empate |


# 🏀 BuzzerLive

Sistema de gestión de partidos de básquet con seguimiento en tiempo real.

## 🚀 Quick Start

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

1. Creá una cuenta en [Supabase](https://supabase.com) (es gratis)
2. Creá un nuevo proyecto
3. Andá a **SQL Editor** y ejecutá el contenido de `database/schema.sql`
4. Copiá las credenciales de **Project Settings → API**

### 3. Variables de entorno

Creá un archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

### 4. Ejecutar en desarrollo

```bash
npm run dev
```

Abrí http://localhost:5173 en tu navegador.

## 📁 Estructura

```
src/
├── components/     # Componentes React
│   ├── common/     # Layout, Header, etc.
│   ├── partido/    # Componentes de carga de partido
│   └── publico/    # Componentes vista pública
├── pages/          # Páginas/Rutas
├── services/       # Cliente Supabase
├── store/          # Estado global (Zustand)
├── types/          # TypeScript types
└── hooks/          # Custom hooks
```

## 🛠️ Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Estilos**: Tailwind CSS 4
- **Backend**: Supabase (PostgreSQL + Realtime + Auth)
- **Estado**: Zustand

## 📝 Scripts

- `npm run dev` - Desarrollo
- `npm run build` - Build producción
- `npm run preview` - Preview del build

---

Desarrollado por **Raven-Net** 🦅

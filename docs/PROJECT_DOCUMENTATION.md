# Finances WebApp - Documentación del Proyecto

## Descripción General

Aplicación web de **control de gastos personales** construida con Next.js 19, React 19, TypeScript y Supabase. Permite al usuario registrar movimientos financieros categorizados por cuenta y categoría, y visualizar los últimos registros almacenados en la base de datos.

Proyecto migrado desde un template Vite + React + JavaScript a Next.js App Router + TypeScript, manteniendo la lógica de negocio existente.

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | ^15.x | Framework (App Router) |
| React | ^19.0.0 | UI Library |
| TypeScript | ^5.x | Type checking |
| @supabase/ssr | latest | Cliente Supabase con soporte SSR |
| @supabase/supabase-js | latest | Cliente de base de datos |
| Tailwind CSS | ^3.4.1 | Estilos |
| shadcn/ui | new-york style | Componentes UI (Radix + CVA) |
| next-themes | ^0.4.6 | Dark/Light mode |
| lucide-react | ^0.511.0 | Iconos |

---

## Estructura del Proyecto

```
finances-webapp/
├── .env.example                    # Variables de entorno (ejemplo)
├── .env.local                      # Variables de entorno (local, no commitear)
├── next.config.ts                  # Configuración de Next.js
├── tsconfig.json                   # Configuración de TypeScript
├── tailwind.config.ts              # Configuración de Tailwind CSS
├── postcss.config.mjs              # Configuración de PostCSS
├── components.json                 # Configuración de shadcn/ui
├── eslint.config.mjs               # Configuración de ESLint
├── proxy.ts                        # Proxy de auth (reemplaza middleware)
│
├── app/                            # App Router - Páginas y layouts
│   ├── layout.tsx                  # Layout raíz (ThemeProvider + Geist font)
│   ├── page.tsx                    # Página principal (landing/starter)
│   ├── globals.css                 # Estilos globales + variables CSS
│   │
│   ├── auth/                       # Autenticación
│   │   ├── login/page.tsx          # Formulario de login
│   │   ├── sign-up/page.tsx        # Formulario de registro
│   │   ├── sign-up-success/page.tsx # Confirmación de registro
│   │   ├── confirm/route.ts        # Confirmación de email (Route Handler)
│   │   ├── error/page.tsx          # Página de error
│   │   ├── forgot-password/page.tsx # Recuperar contraseña
│   │   └── update-password/page.tsx # Actualizar contraseña
│   │
│   ├── movimientos/                # Funcionalidad principal
│   │   └── page.tsx                # Página de movimientos (Client Component)
│   │
│   └── protected/                  # Rutas protegidas (ejemplo del template)
│       ├── layout.tsx              # Layout con nav para rutas protegidas
│       └── page.tsx                # Página de detalles de usuario
│
├── components/                     # Componentes React
│   ├── auth-button.tsx             # Botón de auth (Server Component)
│   ├── login-form.tsx              # Formulario de login (Client)
│   ├── sign-up-form.tsx            # Formulario de registro (Client)
│   ├── forgot-password-form.tsx    # Formulario de recuperar contraseña (Client)
│   ├── update-password-form.tsx    # Formulario de actualizar contraseña (Client)
│   ├── logout-button.tsx           # Botón de logout (Client)
│   ├── theme-switcher.tsx          # Switcher de tema dark/light (Client)
│   ├── hero.tsx                    # Hero section (Server)
│   ├── deploy-button.tsx           # Botón de deploy a Vercel (Server)
│   ├── env-var-warning.tsx         # Warning de env vars faltantes (Server)
│   │
│   ├── movement/                   # Lógica de movimientos
│   │   ├── movement-form.jsx       # Formulario de creación de movimientos
│   │   ├── movement-mapper.js      # Mapeo y transformación de datos
│   │   └── movement-service.js     # Servicio de acceso a datos (Supabase)
│   │
│   ├── tutorial/                   # Componentes del tutorial del template
│   │   ├── code-block.tsx
│   │   ├── connect-supabase-steps.tsx
│   │   ├── fetch-data-steps.tsx
│   │   ├── sign-up-user-steps.tsx
│   │   └── tutorial-step.tsx
│   │
│   └── ui/                         # Componentes base (shadcn/ui)
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       └── label.tsx
│
├── data/                           # Datos estáticos tipados
│   ├── cuenta.ts                   # Catálogo de cuentas bancarias
│   └── categoria.ts                # Catálogo de categorías de gastos
│
├── lib/                            # Utilidades y configuración
│   ├── utils.ts                    # Utilidad cn() para Tailwind + hasEnvVars
│   │
│   ├── catalogs/                   # Re-exports de catálogos
│   │   ├── cuentas.js              # Re-exports CUENTAS y CUENTA_DEFAULT
│   │   └── categorias.js           # Re-exports CATEGORIAS y CATEGORIA_DEFAULT
│   │
│   └── supabase/                   # Configuración de Supabase
│       ├── client.ts               # Cliente para Browser (createBrowserClient)
│       ├── server.ts               # Cliente para Server Components (createServerClient)
│       └── proxy.ts                # Lógica de actualización de sesión (para proxy)
│
└── docs/                           # Documentación
    └── PROJECT_DOCUMENTATION.md    # Este archivo
```

---

## Variables de Entorno

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu-clave-anon-o-publishable
```

> **Nota**: Las variables cambiaron del formato Vite (`VITE_*`) al formato Next.js (`NEXT_PUBLIC_*`). La clave puede ser tanto la legacy `anon` key como la nueva `publishable` key de Supabase.

---

## Scripts Disponibles

```bash
npm run dev      # Iniciar servidor de desarrollo (localhost:3000)
npm run build    # Generar build de producción
npm run start    # Iniciar servidor de producción
npm run lint     # Ejecutar ESLint
```

---

## Modelo de Datos

### Tabla `cuenta`

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID (PK) | Identificador único |
| nombre | TEXT | Nombre de la cuenta |
| tipo | TEXT | Tipo: `ingreso`, `deuda`, `retiro`, `efectivo` |
| saldo_calculado | DECIMAL | Saldo calculado |
| saldo_real | DECIMAL | Saldo real |
| frecuencia_revision | TEXT | Frecuencia: `semanal`, `mensual`, `trimestral` |
| es_default | BOOLEAN | Si es la cuenta por defecto |
| activa | BOOLEAN | Si la cuenta está activa |
| limite_credito | DECIMAL (nullable) | Límite de crédito (solo TDC) |
| dia_corte | INT (nullable) | Día de corte (solo TDC) |
| dia_pago | INT (nullable) | Día de pago (solo TDC) |
| created_at | TIMESTAMP | Fecha de creación |

### Tabla `categoria`

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID (PK) | Identificador único |
| nombre | TEXT | Nombre de la categoría |
| tipo | TEXT | Tipo: `compromiso`, `discrecional`, `suscripcion`, `ingreso`, `sistema`, `trabajo`, `hogar` |
| es_diversion | BOOLEAN | Si es categoría de diversión |
| activa | BOOLEAN | Si la categoría está activa |

### Tabla `movimiento`

| Campo | Tipo | Descripción |
|---|---|---|
| id | UUID (PK) | Identificador único |
| monto | DECIMAL | Monto del movimiento |
| descripcion | TEXT | Descripción |
| fecha | DATE | Fecha del movimiento |
| hora | TIME (nullable) | Hora del movimiento |
| cuenta_id | UUID (FK → cuenta) | Cuenta asociada |
| categoria_id | UUID (FK → categoria) | Categoría asociada |
| msi_id | UUID (nullable) | ID de MSI (meses sin intereses) |
| transferencia_id | UUID (nullable) | ID de transferencia |
| es_transferencia | BOOLEAN | Si es una transferencia |
| es_ajuste | BOOLEAN | Si es un ajuste |
| fuente | TEXT | Origen: `manual`, `automatico`, `transferencia` |
| notas | TEXT (nullable) | Notas adicionales |
| created_at | TIMESTAMP | Fecha de creación |

---

## Patrones de Código

### Server Components vs Client Components

- **Server Components** (por defecto): `app/layout.tsx`, `app/page.tsx`, `app/protected/page.tsx`, `components/auth-button.tsx`
- **Client Components** (`'use client'`): `app/movimientos/page.tsx`, `components/movement/*`, `components/login-form.tsx`, `components/theme-switcher.tsx`

### Proxy (no Middleware)

El proyecto usa `proxy.ts` en la raíz en lugar de `middleware.ts`. Esto es específico del template de Supabase con Next.js:

```ts
// proxy.ts
import { updateSession } from "@/lib/supabase/proxy";
import { type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}
```

La lógica de auth en `lib/supabase/proxy.ts` redirige a `/auth/login` si el usuario no está autenticado y no está en rutas públicas (`/`, `/auth/*`).

### Path Aliases

El proyecto usa `@/*` como alias para la raíz del proyecto:

```ts
import { createClient } from '@/lib/supabase/client'
import { CUENTAS } from '@/lib/catalogs/cuentas'
```

### Catálogos de Datos

Los catálogos (`cuenta.ts`, `categoria.ts`) están en `data/` como módulos TypeScript con datos hardcodeados. Son re-exportados desde `lib/catalogs/` para mantener la compatibilidad con los componentes existentes.

---

## Flujo de la Aplicación

```
┌─────────────────────────────────────────┐
│           app/layout.tsx                │
│  (ThemeProvider + Geist font)           │
└──────────────────┬──────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼───┐   ┌─────▼─────┐  ┌────▼────┐
│  /    │   │/movimientos│  │ /auth/* │
│ page  │   │  page.tsx  │  │  pages  │
└───────┘   └─────┬──────┘  └─────────┘
                  │
                  ├── MovementForm ──► crearMovimiento()
                  │                       │
                  │                       ▼
                  │              insertarMovimiento() ──► Supabase
                  │
                  └── fetchRecords() ──► Supabase (select + order + limit)
```

### Flujo de Autenticación

```
proxy.ts (todas las rutas)
    │
    ▼
lib/supabase/proxy.ts → updateSession()
    │
    ├── Si no hay usuario y no es / o /auth/* → redirect /auth/login
    ├── Si hay usuario → continuar
    └── Refresca cookies de sesión automáticamente
```

---

## Migración desde Vite (Referencia)

| Concepto | Vite (antes) | Next.js (ahora) |
|---|---|---|
| Entry point | `index.html` + `src/main.jsx` | `app/layout.tsx` |
| Routing | React Router manual | App Router (carpetas en `app/`) |
| Bundler | Vite | Webpack (Next.js) |
| TypeScript | Opcional | Configurado (`tsconfig.json`) |
| CSS | Manual | Tailwind CSS + CSS Variables |
| Components | JSX | TSX (mayoría) + JSX (movement/) |
| Supabase Client | `createClient()` global | `createBrowserClient()` por uso |
| Variables de entorno | `VITE_*` | `NEXT_PUBLIC_*` |
| Auth middleware | No existía | `proxy.ts` |
| UI Library | Manual | shadcn/ui (Radix + CVA) |
| CSV imports | `?raw` (Vite syntax) | Módulos TypeScript directos |

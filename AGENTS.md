# AGENTS.md - Guía para Agentes AI

Este archivo contiene instrucciones para cualquier LLM o agente AI que trabaje en este proyecto.

---

## Stack del Proyecto

- **Framework**: Next.js 15 (App Router)
- **UI**: React 19 + TypeScript
- **Estilos**: Tailwind CSS + shadcn/ui (style: new-york)
- **Base de datos**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth con SSR (`@supabase/ssr`)

---

## Convenciones de Archivos

### Extensiones

| Extensión | Uso |
|---|---|
| `.tsx` | Componentes React con JSX |
| `.ts` | Utilidades, tipos, configuración, datos |
| `.jsx` | Componentes legacy (solo en `components/movement/`) |
| `.js` | Módulos de catálogos (re-exports) |

### Naming

- **Componentes**: `kebab-case` para archivos (`movement-form.tsx`), `PascalCase` para exports (`MovementForm`)
- **Utilidades/Servicios**: `camelCase` (`movement-service.js`)
- **Constantes**: `UPPER_SNAKE_CASE` (`CUENTAS`, `CATEGORIAS`)
- **Interfaces/Types**: `PascalCase` (`Cuenta`, `Categoria`)

---

## Estructura de Directorios

```
app/              → Páginas y layouts (App Router)
components/       → Componentes React organizados por dominio
  movement/       → Lógica de movimientos (form + mapper + service)
  ui/             → Componentes base (shadcn/ui)
  tutorial/       → Componentes del template (no modificar)
data/             → Datos estáticos tipados (cuenta.ts, categoria.ts)
lib/              → Utilidades y configuración
  catalogs/       → Re-exports de catálogos
  supabase/       → Clientes de Supabase (client, server, proxy)
docs/             → Documentación del proyecto
```

---

## Reglas Importantes

### 1. Server Components vs Client Components

- **Server Components** (default): No necesitan `'use client'`. Pueden usar `async/await`.
- **Client Components**: Deben tener `'use client'` al inicio del archivo. No pueden ser Server Components.
- **Regla**: Si usa `useState`, `useEffect`, `onClick`, o eventos del navegador → necesita `'use client'`.

### 2. Supabase Client

- **Browser** (Client Components): `import { createClient } from '@/lib/supabase/client'`
- **Server** (Server Components, Route Handlers): `import { createClient } from '@/lib/supabase/server'`
- **NUNCA** crear el cliente globalmente. Siempre crear por uso.

### 3. Proxy (no Middleware)

El proyecto usa `proxy.ts` en la raíz, NO `middleware.ts`. No renombrar ni mover.

### 4. Path Aliases

Usar `@/` para importar desde la raíz del proyecto:
```ts
import { createClient } from '@/lib/supabase/client'
import { CUENTAS } from '@/lib/catalogs/cuentas'
```

### 5. Catálogos de Datos

Los datos de cuentas y categorías están en `data/cuenta.ts` y `data/categoria.ts`. Si necesitas modificar datos, editar directamente estos archivos. Los componentes importan desde `lib/catalogs/`.

---

## Cómo Agregar

### Nueva Página

1. Crear carpeta en `app/` con `page.tsx`
2. Si necesita auth, agregar al proxy en `lib/supabase/proxy.ts` si es ruta pública
3. Ejemplo: `app/mis-pagina/page.tsx`

### Nuevo Componente

1. Crear archivo en `components/` (o subcarpeta si es dominio específico)
2. Si usa hooks/estados → agregar `'use client'`
3. Usar shadcn/ui para UI base (`components/ui/`)

### Nuevo Servicio

1. Crear archivo en `components/movement/` o `lib/` según el dominio
2. Importar cliente Supabase desde `@/lib/supabase/client`
3. Seguir patrón de `movement-service.js`

### Nuevo Componente UI (shadcn)

```bash
npx shadcn@latest add [componente]
```

---

## Comandos de Verificación

```bash
npm run lint       # Verificar linting
npm run build      # Verificar que compila sin errores
npm run dev        # Iniciar servidor de desarrollo
```

**IMPORTANTE**: Después de hacer cambios, SIEMPRE ejecutar `npm run lint` y `npm run build` para verificar.

---

## Archivos Clave para Referencia

| Archivo | Propósito |
|---|---|
| `app/movimientos/page.tsx` | Página principal de funcionalidad |
| `components/movement/movement-form.jsx` | Formulario de movimientos |
| `components/movement/movement-mapper.js` | Mapeo de datos |
| `components/movement/movement-service.js` | Servicio Supabase |
| `data/cuenta.ts` | Catálogo de cuentas |
| `data/categoria.ts` | Catálogo de categorías |
| `lib/supabase/client.ts` | Cliente browser |
| `lib/supabase/server.ts` | Cliente server |
| `lib/supabase/proxy.ts` | Lógica de auth |
| `proxy.ts` | Proxy entry point |

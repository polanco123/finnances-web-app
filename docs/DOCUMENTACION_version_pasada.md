# Supabase React App - Documentación

## Descripción General

Aplicación web de **control de gastos personales** construida con React 18 y Supabase. Permite al usuario registrar movimientos financieros (gastos) categorizados por cuenta y categoría, y visualizar los últimos 10 registros almacenados en la base de datos.

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| React | ^18.2.0 | UI Framework |
| Vite | ^5.0.0 | Bundler / Dev Server |
| @supabase/supabase-js | ^2.39.0 | Cliente de base de datos |
| JavaScript (JSX) | ES6+ | Lenguaje |

---

## Estructura del Proyecto

```
supabase-react-app/
├── index.html                    # Entry point HTML
├── package.json                  # Dependencias y scripts
├── vite.config.js                # Configuración de Vite
├── .env                          # Variables de entorno (Supabase URL + Key)
├── src/
│   ├── main.jsx                  # Punto de entrada de React
│   ├── App.jsx                   # Componente raíz
│   ├── supabase.js               # Cliente Supabase
│   ├── components/
│   │   └── FormularioMovimiento.jsx  # Formulario de creación de gastos
│   ├── constants/
│   │   ├── categoras.js          # Categorías de gastos
│   │   └── cuentas.js            # Cuentas bancarias/disponibles
│   ├── mappers/
│   │   └── movimientoMapper.js   # Mapeo y transformación de datos
│   └── services/
│       └── movimientoService.js  # Capa de acceso a datos (Supabase)
```

---

## Descripción de Componentes

### `src/main.jsx`
Punto de entrada. Renderiza `<App />` dentro de `React.StrictMode` en el elemento `#root`.

### `src/App.jsx`
Componente raíz que gestiona:
- **Estado**: `records` (lista de movimientos), `loading`, `error`
- **Carga inicial**: llama a `obtenerMovimientos(10)` al montarse
- **Renderizado**: muestra el formulario de creación y la lista de los últimos 10 registros en formato JSON
- **Flujo**: después de crear un movimiento, recarga la lista automáticamente via callback `fetchRecords`

### `src/components/FormularioMovimiento.jsx`
Formulario controlado para registrar un nuevo gasto. Campos:

| Campo | Tipo | Validación |
|---|---|---|
| Monto | `number` | Requerido, mínimo 0.01 |
| Categoría | `select` | Requerido (valor por defecto: Diversión) |
| Cuenta | `select` | Requerido (valor por defecto: Suburbia) |
| Notas | `textarea` | Opcional |

**Funcionamiento**:
1. Valida que el monto sea mayor a 0
2. Mapea los datos mediante `crearMovimiento()`
3. Inserta en Supabase mediante `insertarMovimiento()`
4. Resetea el formulario y notifica al padre via `onMovimientoCreado()`

### `src/supabase.js`
Inicializa el cliente de Supabase con las variables de entorno:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### `src/services/movimientoService.js`
Capa de servicio con dos funciones:

- **`insertarMovimiento(movimiento)`** → Inserta un registro en la tabla `movimiento`
- **`obtenerMovimientos(limite)`** → Obtiene los últimos `n` registros ordenados por `created_at` descendente

### `src/mappers/movimientoMapper.js`
Mapeador de datos que incluye:

- **`CAMPOS`**: Enumeración de todos los campos del modelo `movimiento`
- **`FUENTES`**: Origen del movimiento (`manual`, `automatico`, `transferencia`)
- **`crearMovimiento()`**: Función factory que construye un objeto movimiento con valores por defecto:
  - `fecha`: fecha actual
  - `fuente`: manual
  - `es_transferencia`: false
  - `es_ajuste`: false

### `src/constants/cuentas.js`
Define las cuentas disponibles:

| Constante | Nombre | Tipo |
|---|---|---|
| `CUENTAS.SUBURBIA` | Suburbia | deuda |
| `CUENTAS.NOMINA` | BBVA Débito | ingreso |
| `CUENTAS.EFECTIVO` | Efectivo | ahorro |

**Default**: `CUENTAS.SUBURBIA`

### `src/constants/categorias.js`
Define las categorías de gastos:

| Constante | Nombre | Tipo | Es Diversión |
|---|---|---|---|
| `CATEGORIAS.TRANSPORTE` | Transporte | compromiso | No |
| `CATEGORIAS.DIVERSION` | Diversión personal | discrecional | Sí |
| `CATEGORIAS.ENTRETENIMIENTO` | Entretenimiento | deseo | Sí |

**Default**: `CATEGORIAS.DIVERSION`

---

## Modelo de Datos (Tabla `movimiento`)

```
id              UUID (PK)
monto           DECIMAL
descripcion     TEXT
fecha           DATE
hora            TIME (nullable)
cuenta_id       UUID (FK → cuenta)
categoria_id    UUID (FK → categoria)
msi_id          UUID (nullable)
transferencia_id UUID (nullable)
es_transferencia BOOLEAN
es_ajuste       BOOLEAN
fuente          TEXT (manual | automatico | transferencia)
notas           TEXT (nullable)
created_at      TIMESTAMP
```

---

## Scripts Disponibles

```bash
npm run dev      # Iniciar servidor de desarrollo
npm run build    # Generar build de producción
npm run preview  # Previsualizar build de producción
```

---

## Variables de Entorno (`.env`)

```
VITE_SUPABASE_URL=<url_del_proyecto_supabase>
VITE_SUPABASE_ANON_KEY=<clave_anonima_de_supabase>
```

---

## Flujo de la Aplicación

```
┌─────────────┐
│   main.jsx  │
└──────┬──────┘
       │
┌──────▼──────┐
│    App.jsx  │──── obtenerMovimientos() ────► Supabase
└──────┬──────┘
       │
       ├── FormularioMovimiento ──► crearMovimiento() ──► insertarMovimiento() ──► Supabase
       │
       └── Lista de registros (JSON)
```

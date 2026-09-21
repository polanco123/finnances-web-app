# Sistema de Diseño - Finanzas Web App

## Introducción

Este documento define el sistema de diseño de Finanzas Web App. Se basa en el enfoque minimalista de la página `/cuentas`, unificado con los tokens de `theme.css` para crear un sistema coherente y escalable.

**Principios:**
- Diseño flat (sin sombras)
- Paleta de colores semántica
- Tipografía clara y jerárquica
- Sistema de espaciado consistente

---

## 1. Tipografía

### Familias de fuentes

| Uso | Fuente | Pesos | Notas |
|-----|--------|-------|-------|
| **Textos generales** | Inter | 400, 500, 600, 700 | UI, labels, párrafos |
| **Datos numéricos** | JetBrains Mono | 400, 500, 600, 700 | Moneda, fechas, números |

### Escala de tamaños

| Nivel | Tamaño | Peso | Caso | Tracking | Uso |
|-------|--------|------|------|----------|-----|
| **Display** | 32px | 600 | Normal | -0.02em | Títulos principales, mastheads |
| **Heading 1** | 20px | 700 | Normal | -0.02em | Títulos de secciones |
| **Heading 2** | 16px | 600 | Normal | -0.01em | Subtítulos, encabezados |
| **Body Large** | 14px | 400 | Normal | 0 | Textos principales |
| **Body** | 13px | 400 | Normal | 0 | Párrafos, descripciones |
| **Small** | 12px | 400 | Normal | 0 | Ayuda, pie de página |
| **Label** | 11px | 600 | Uppercase | 0.06em | Labels, botones pequeños |
| **XSmall** | 10px | 400 | Normal | 0 | Información mínima |

### Ejemplos

```css
/* Display */
.display {
  font-family: var(--font-inter), sans-serif;
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

/* Heading 1 */
.h1 {
  font-family: var(--font-inter), sans-serif;
  font-size: 20px;
  font-weight: 700;
}

/* Números en moneda */
.currency {
  font-family: var(--font-jetbrains-mono), monospace;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

/* Fechas */
.date {
  font-family: var(--font-jetbrains-mono), monospace;
  font-size: 13px;
  font-weight: 400;
}
```

---

## 2. Paleta de Colores

### Colores Semánticos (Luz)

| Token | Hex | Uso | Variante Dim |
|-------|-----|-----|--------------|
| **Success** | `#1f9d6c` | Estados positivos, movimientos entrada | `#d7f0e4` |
| **Error** | `#c9433e` | Estados negativos, movimientos salida | `#fbdede` |
| **Warning** | `#b5790f` | Alertas, atención | `#f6e6c8` |

### Colores de Superficie (Luz)

| Token | Hex | Uso |
|-------|-----|-----|
| **Background** | `#f5f6f8` | Fondo de página |
| **Surface (Raised)** | `#ffffff` | Cards, containers principales |
| **Line** | `#dde1e8` | Bordes principales |
| **Line Soft** | `#eceef2` | Bordes suaves, hover states |

### Colores de Texto (Luz)

| Token | Hex | Uso |
|-------|-----|-----|
| **Ink** | `#12151c` | Texto principal |
| **Ink Dim** | `#5b6274` | Texto secundario, labels |
| **Ink Faint** | `#9aa0b0` | Texto terciario, hints |

---

### Colores Semánticos (Oscuro)

| Token | Hex | Uso | Variante Dim |
|-------|-----|-----|--------------|
| **Success** | `#3fb68b` | Estados positivos | `#1e4a3c` |
| **Error** | `#d9534f` | Estados negativos | `#4a2422` |
| **Warning** | `#e8a33d` | Alertas | `#4a3a1e` |

### Colores de Superficie (Oscuro)

| Token | Hex | Uso |
|-------|-----|-----|
| **Background** | `#0b0e14` | Fondo de página |
| **Surface (Raised)** | `#12161f` | Cards, containers principales |
| **Line** | `#262b38` | Bordes principales |
| **Line Soft** | `#1b2029` | Bordes suaves, hover states |

### Colores de Texto (Oscuro)

| Token | Hex | Uso |
|-------|-----|-----|
| **Ink** | `#f2f0ea` | Texto principal |
| **Ink Dim** | `#8b92a5` | Texto secundario, labels |
| **Ink Faint** | `#545b6b` | Texto terciario, hints |

---

### Uso de Colores Semánticos

#### Success (Verde)
- Saldos positivos
- Movimientos de entrada
- Estados completados
- Notificaciones positivas

```css
.text-success { color: var(--up); }
.bg-success-dim { background: var(--up-dim); }
.border-success { border-color: var(--up); }
```

#### Error (Rojo)
- Saldos negativos (deudas)
- Movimientos de salida
- Estados de error
- Advertencias críticas

```css
.text-error { color: var(--down); }
.bg-error-dim { background: var(--down-dim); }
.border-error { border-color: var(--down); }
```

#### Warning (Ámbar)
- Estados de atención
- Información importante
- Transacciones pendientes

```css
.text-warning { color: var(--amber); }
.bg-warning-dim { background: var(--amber-dim); }
.border-warning { border-color: var(--amber); }
```

---

## 3. Sistema de Espaciado

El espaciado se basa en un sistema de escala 4px. Todos los valores son múltiplos de 4.

| Scale | Value | Uso |
|-------|-------|-----|
| **xs** | 4px | Espacios muy pequeños, gaps mínimos |
| **sm** | 8px | Separación mínima entre elementos |
| **md** | 12px | Espacios regulares |
| **lg** | 16px | Padding estándar en cards, margin entre secciones |
| **xl** | 20px | Padding generoso |
| **2xl** | 24px | Separación grande entre grupos |
| **3xl** | 32px | Espacios amplios, padding de página |
| **4xl** | 40px | Márgenes grandes |
| **5xl** | 48px | Espacios muy amplios |

### Recomendaciones de uso

```css
/* Padding en cards/containers */
.card { padding: 16px 20px; } /* lg + xl */

/* Gap entre elementos en lista */
.list { gap: 12px; } /* md */

/* Separación entre secciones */
.section { margin-bottom: 20px; } /* xl */

/* Padding en página */
.page { padding: 32px 20px; } /* 3xl horizontal */

/* Gap en grid de 2 columnas */
.grid-2 { gap: 12px; } /* md */

/* Espacios dentro de buttons */
.button { padding: 8px 12px; } /* sm + md */
```

---

## 4. Contenedores y Componentes Base

### 4.1 Cards / Containers Principales

**Contenedor con borde y fondo (Modo Luz)**

```css
.card-raised {
  background: var(--bg-raised); /* #ffffff */
  border: 1px solid var(--line); /* #dde1e8 */
  border-radius: 16px;
  padding: 20px;
}
```

**Contenedor con borde y fondo (Modo Oscuro)**

```css
.dark .card-raised {
  background: var(--bg-raised); /* #12161f */
  border: 1px solid var(--line); /* #262b38 */
  border-radius: 16px;
  padding: 20px;
}
```

**Contenedor solo con borde (Dark mode, sin fondo)**

```css
.dark .card-borderless {
  background: transparent;
  border: none;
  border-radius: 0;
}
```

### 4.2 Tarjetas Planas (Flat Cards)

Sin sombra, solo borde y fondo. Se usa para listas y agrupaciones.

```css
.flat-card {
  background: var(--bg-raised);
  border: 1px solid var(--line);
  border-radius: 8px;
}
```

**En lista:**

```css
.list-container {
  display: flex;
  flex-direction: column;
  background: var(--bg-raised);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}

.list-item {
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}

.list-item:last-child {
  border-bottom: none;
}
```

### 4.3 Superficies Coloreadas (Semantic Background)

Para banners, alertas y contextos semánticos.

**Success**

```css
.surface-success {
  background: var(--up-dim); /* #d7f0e4 */
  border: 1px solid var(--up); /* #1f9d6c */
  border-radius: 10px;
  padding: 12px 16px;
  color: var(--ink);
}
```

**Error**

```css
.surface-error {
  background: var(--down-dim); /* #fbdede */
  border: 1px solid var(--down); /* #c9433e */
  border-radius: 10px;
  padding: 12px 16px;
  color: var(--down);
}
```

**Warning**

```css
.surface-warning {
  background: var(--amber-dim); /* #f6e6c8 */
  border: 1px solid var(--amber); /* #b5790f */
  border-radius: 10px;
  padding: 12px 16px;
  color: var(--amber);
}
```

### 4.4 Border Radius (Redondeado)

| Escala | Valor | Uso |
|--------|-------|-----|
| **xs** | 4px | Bordes muy sutiles |
| **sm** | 6px | Botones pequeños |
| **md** | 8px | Cards, containers secundarios |
| **lg** | 10px | Banners, alertas |
| **xl** | 16px | Cards principales, containers grandes |

```css
.rounded-xs { border-radius: 4px; }
.rounded-sm { border-radius: 6px; }
.rounded-md { border-radius: 8px; }
.rounded-lg { border-radius: 10px; }
.rounded-xl { border-radius: 16px; }
```

---

## 5. Componentes Comunes

### 5.1 Botones

**Primary Button**

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  font-family: var(--font-inter), sans-serif;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink);
  background: var(--bg-raised);
  border: 1px solid var(--line);
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.15s ease, opacity 0.15s ease;
}

.btn:hover:not(:disabled) {
  background: var(--line-soft);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

### 5.2 Inputs / Campos

```css
.input {
  font-family: var(--font-inter), sans-serif;
  font-size: 13px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg-raised);
  color: var(--ink);
  transition: border-color 0.15s ease;
}

.input:focus {
  outline: none;
  border-color: var(--ink);
}
```

### 5.3 Labels y Textos Secundarios

```css
.label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-dim);
}

.hint {
  font-size: 12px;
  color: var(--ink-faint);
}

.caption {
  font-family: var(--font-jetbrains-mono), monospace;
  font-size: 12px;
  color: var(--ink-faint);
}
```

---

## 6. Estados y Transiciones

### 6.1 Estados de Elementos Interactivos

```css
/* Default */
.element {
  background: var(--bg-raised);
  border: 1px solid var(--line);
  transition: all 0.15s ease;
}

/* Hover */
.element:hover {
  background: var(--bg-raised);
  border-color: var(--line-soft);
}

/* Active / Pressed */
.element:active {
  opacity: 0.9;
}

/* Disabled */
.element:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Focus (keyboard) */
.element:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
}
```

### 6.2 Transiciones

```css
/* Rápida (cambios visuales menores) */
.transition-fast {
  transition: all 0.15s ease;
}

/* Normal (cambios estándar) */
.transition-normal {
  transition: all 0.2s ease;
}

/* Lenta (cambios grandes o entradas) */
.transition-slow {
  transition: all 0.3s ease;
}
```

---

## 7. Layout y Grilla

### 7.1 Contenedor Principal

```css
.page-container {
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 32px 20px 64px;
}
```

### 7.2 Secciones

```css
.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-dim);
  margin: 0 0 12px;
}
```

### 7.3 Grid de 2 Columnas

```css
.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (max-width: 640px) {
  .grid-2 {
    grid-template-columns: 1fr;
  }
}
```

---

## 8. Dark Mode

El sistema soporta dark mode automáticamente usando CSS custom properties. Los tokens se definen en:

- Luz: `:root` en `components/{domain}/{domain}-tokens.css`
- Oscuro: `.dark` en `components/{domain}/{domain}-tokens.css`

**Implementación:**

```css
.my-component {
  color: var(--ink);
  background: var(--bg-raised);
  border-color: var(--line);
}

/* Automáticamente se adapta a dark mode */
```

---

## 9. Ejemplo de Página Completa

```html
<div class="page-container">
  <!-- Header -->
  <header class="masthead">
    <h1 class="display">Título Principal</h1>
    <button class="btn">Acción</button>
  </header>

  <!-- Summary Row -->
  <div class="grid-2">
    <div class="card-raised">
      <span class="label">Total</span>
      <span class="currency">$1,234.56</span>
      <span class="hint">10 items</span>
    </div>
    <div class="card-raised">
      <span class="label">Balance</span>
      <span class="currency">$567.89</span>
      <span class="hint">5 items</span>
    </div>
  </div>

  <!-- List Section -->
  <section class="section">
    <h2 class="section-title">Movimientos Recientes</h2>
    <div class="list-container">
      <div class="list-item">
        <div style="display: flex; justify-content: space-between;">
          <span>Compra</span>
          <span class="currency text-error">-$50.00</span>
        </div>
        <span class="hint">2026-09-20</span>
      </div>
      <div class="list-item">
        <div style="display: flex; justify-content: space-between;">
          <span>Transferencia</span>
          <span class="currency text-success">+$100.00</span>
        </div>
        <span class="hint">2026-09-19</span>
      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer style="text-align: center; font-size: 12px; color: var(--ink-faint);">
    Datos en tiempo real
  </footer>
</div>
```

---

## 10. Checklist para Rediseños

Al rediseñar una página, asegúrate de:

- [ ] Usar **Inter** para textos, **JetBrains Mono** para números
- [ ] Aplicar colores semánticos (success/error/warning)
- [ ] Usar el sistema de espaciado (múltiplos de 4px)
- [ ] Cards con borde + fondo blanco (luz) o transparente (oscuro)
- [ ] Sin sombras (flat design)
- [ ] Border radius consistente (8px, 10px o 16px)
- [ ] Dark mode automático con variables CSS
- [ ] Transiciones suaves (0.15s)
- [ ] Layout responsive con `max-width: 720px`
- [ ] Pagina padding `32px 20px` mínimo

---

## 11. Archivos de Referencia

- **Variables globales:** `lib/theme.css`
- **Tokens de cuentas:** `components/cuentas/cuentas-tokens.css`
- **Estilos de cuentas:** `components/cuentas/cuentas-page.css`
- **Fuentes de cuentas:** `components/cuentas/cuentas-fonts.ts`


## 1. Theme Dark Mode Variables

- [x] 1.1 Add `.dark` class overrides to `lib/theme.css` with dark color palette (dark backgrounds, light text, adapted primary/secondary/accent colors)
- [x] 1.2 Add glassmorphic CSS variables to `lib/theme.css`: `--theme-glass-bg`, `--theme-glass-blur`, `--theme-glass-border` for both light and dark modes

## 2. Page Layout

- [x] 2.1 Create `app/movimientos/page.css` with dark background, centered container, max-width, and responsive padding
- [x] 2.2 Update `app/movimientos/page.tsx` to import `page.css` and wrap content in a styled container div

## 3. Form Glassmorphic Styles

- [x] 3.1 Update `components/movement/movement-form.css` to add `.dark` mode styles for form container (semi-transparent bg, backdrop blur, subtle border)
- [x] 3.2 Update input/select/textarea styles for dark mode (semi-transparent backgrounds, light text, adapted borders)
- [x] 3.3 Update button styles for dark mode (lighter primary color for visibility)
- [x] 3.4 Update toggle switch styles for dark mode (adapted track and thumb colors)

## 4. List Item Glassmorphic Styles

- [x] 4.1 Update `components/movement/movement-list-item.css` to add `.dark` mode styles for list item cards (semi-transparent bg, backdrop blur, subtle border)
- [x] 4.2 Update transfer movement accent border for dark mode (glassmorphic primary color)
- [x] 4.3 Update badge styles for dark mode

## 5. Verification

- [x] 5.1 Run `npm run lint` to verify no linting errors
- [x] 5.2 Run `npm run build` to verify compilation succeeds
- [x] 5.3 Test dark mode: toggle theme and verify all components display correctly with glassmorphic effects

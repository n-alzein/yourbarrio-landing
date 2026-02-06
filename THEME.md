# Theme tokens (light theme)

## Quick brand color change
- Edit `--brand-rgb` in `app/globals.css`.
- Example: `--brand-rgb: 37, 99, 235;` (change this one line to update primary buttons, focus rings, and other brand accents).

## Navbar color
- Navbar colors are controlled by these tokens in `app/globals.css`:
  - `--yb-navbar-bg`
  - `--yb-navbar-fg`
  - `--yb-navbar-muted`
  - `--yb-navbar-border`
- The reusable `.yb-navbar` class applies a solid background with no blur/gradient or shadow.

## Where tokens live
- All light-theme tokens are centralized under `:root, .theme-light` in `app/globals.css`.
- Legacy variables (like `--background`, `--foreground`, `--accent`) are mapped to the new tokens to keep existing styles stable.

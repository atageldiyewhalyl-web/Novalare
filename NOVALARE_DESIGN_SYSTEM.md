# Novalare Design System: Dark Glass Aesthetic

This document outlines the core design principles and implementation standards used for the "Novalare Style" redesign of the Month-End Dashboard and Company Overview.

## 1. Core Aesthetic: "Dark Glass"
The goal is a premium, high-density, and futuristic feel that leverages depth and transparency.

- **Backgrounds**: Deep dark blue or pure black (`#0a0a0f` / `bg-black`).
- **Containers**: Glassmorphism using `backdrop-blur-md` and semi-transparent backgrounds.
  - **Dark Mode**: `bg-gray-900/40` or `bg-white/5` with `border-white/10`.
  - **Light Mode**: `bg-white/50` or `bg-gray-50/50` with `border-gray-100`.
- **Accents**: Subtle, blurred background circles and glows using brand colors.
  - Example: `absolute w-32 h-32 bg-[#65D3FD]/10 rounded-full blur-3xl`.

## 2. Typography
A clear hierarchy using two primary sans-serif families.

- **Headings**: `Outfit`
  - High weight (Bold/Semi-Bold), tight letter tracking (`tracking-tight`).
  - Used for Page Titles, Section Headers, and Card Titles.
- **Body & Metadata**: `Manrope`
  - Used for descriptions, labels, and small metadata.
  - Prioritizes legibility over style.

## 3. Color Palette
Vibrant, neon-inspired colors paired with deep neutrals.

- **Primary Accent**: `#65D3FD` (Cyan/Sky Glow) - Used for primary actions, bank-related icons, active states.
- **Secondary Accent**: `#4F5CFE` (Indigo/Purple Glow) - Used for invoices, secondary workflows.
- **Success**: Emerald/Green (`#10b981`) with soft glows.
- **Warning/Progress**: Sky/Amber depending on context.

## 4. Components & Interactive States
Consistency across UI elements.

### Card Standards
- Rounded corners (`rounded-2xl`).
- Interactive hover: `hover:bg-white/10` (dark), `hover:border-gray-200` (light), and slight depth lift (`hover:shadow-xl`).
- Inner gradients for hover transitions.

### Status Badges (Pill Design)
- Modern pill shape with a "dot" status indicator.
- **Completed**: Emerald dot, green background.
- **In Progress**: Pulse-animated Sky/Blue dot.
- **Not Started**: Gray dot and neutral background.

### Layout Logic
- **Density**: Prefer 2 or 3-column grids to maximize screen real estate while maintaining white space.
- **Visual Flow**: Use vibrant icon containers (box with border and soft bg) to draw the eye to key actions.

## 5. Theme Awareness
Everything must be functional and aesthetic in both themes.
- Use Tailwind's `dark:` modifier extensively.
- In Light mode, lean into transparency with white backgrounds instead of just solid grays.
- Ensure text contrast is always checked (`text-gray-900` on white, `text-white` on black).

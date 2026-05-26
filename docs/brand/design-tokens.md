# Design Tokens — Reference

Source of truth: this file. Web implementation: `lahtha-click-web/src/lib/brand/tokens.ts` (added when the frontend scaffolds).

> See [`BRAND-IDENTITY.md`](./BRAND-IDENTITY.md) for the rationale behind these values.

## Color
```css
:root {
  /* Core */
  --ink:    #0A0A0A;
  --paper:  #FFFFFF;
  --accent: #FF4D00;

  /* Neutrals (use sparingly) */
  --ink-60: #666666;
  --ink-20: #E5E5E5;

  /* Functional */
  --success: #00A86B;
  --danger:  #E11D2A;
}
```

## Typography
```css
:root {
  --font-sans:   'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif;
  --font-arabic: 'IBM Plex Sans Arabic', 'Tajawal', system-ui, sans-serif;

  /* Scale */
  --text-xs:   12px;
  --text-sm:   14px;
  --text-base: 16px;
  --text-lg:   20px;
  --text-2xl:  32px;
  --text-4xl:  56px;
  --text-6xl:  80px;
  --text-8xl:  112px;

  /* Weights */
  --weight-regular:  400;
  --weight-semibold: 600;
  --weight-black:    900;

  /* Line heights */
  --leading-tight:   1.1;
  --leading-normal:  1.5;
  --leading-relaxed: 1.7;
}
```

## Spacing (8px grid)
```css
:root {
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-6:   24px;
  --space-8:   32px;
  --space-12:  48px;
  --space-16:  64px;
  --space-24:  96px;
  --space-32:  128px;
  --space-48:  192px;
}
```

## Radius
```css
:root {
  --radius-none: 0;
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   16px;
  --radius-full: 9999px;
}
```

## Elevation
```css
:root {
  --shadow-sm: 0 1px 2px rgba(10, 10, 10, 0.06);
  --shadow-md: 0 8px 24px rgba(10, 10, 10, 0.08);
  --shadow-lg: 0 24px 56px rgba(10, 10, 10, 0.12);
}
```

## Motion
```css
:root {
  --duration-fast:   120ms;
  --duration-normal: 200ms;
  --duration-slow:   320ms;
  --ease-standard:   cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(0.3, 0, 0, 1);
}
```

## Container widths
| Token | px | Use |
|---|---|---|
| `--container-sm` | 640 | reading width |
| `--container-md` | 768 | forms |
| `--container-lg` | 1024 | dashboards |
| `--container-xl` | 1280 | content max |
| `--container-2xl` | 1440 | wide dashboards |

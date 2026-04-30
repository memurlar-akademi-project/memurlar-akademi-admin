```markdown
# Design System Specification: The Modern Archivist

## 1. Overview & Creative North Star

This design system is built for **Memurlar Akademi** to transform dense legislative data into a premium, high-end editorial experience. We are moving away from the "Generic SaaS" aesthetic—characterized by heavy shadows and rounded cards—and moving toward a **"Modern Archivist"** philosophy. 

### The Creative North Star: "Academic Authority via Spatial Precision"
The system treats the digital screen as a living document of record. It balances the gravitas of a physical legal parchment with the clinical precision of high-end Swiss typography. We break the "template" look by utilizing intentional asymmetry, expansive negative space, and a high-contrast serif-to-sans-serif typographic scale. This is not just a study tool; it is a definitive legal authority.

---

## 2. Colors & Surface Architecture

The color palette is rooted in a "Paper & Ink" philosophy. We utilize deep charcoals and sophisticated slate blues to provide professional depth without the fatigue of high-vibrancy hues.

### The "No-Line" Rule
Sectioning must never be achieved through 1px solid black or high-contrast borders. Boundaries are defined through **background color shifts**. For example, a global navigation or a sidebar should sit on `surface-container-low`, while the primary reading document rests on `surface`. This creates a sophisticated, seamless transition that feels like layers of fine paper.

### Surface Hierarchy & Nesting
Depth is achieved by "stacking" the surface-container tiers. 
- **Main Canvas:** `surface` (#f8f9fa)
- **Secondary Reference Panels:** `surface-container-low` (#f1f4f6)
- **Active Selection/High Importance:** `surface-container-highest` (#dbe4e7)

### Signature Textures: Glass & Gradients
To avoid a flat, "cheap" feel, use **Glassmorphism** for floating elements like sticky headers or quick-jump menus. Use `surface` colors at 80% opacity with a `24px` backdrop-blur. 
*   **Signature Gradient:** For primary CTAs (e.g., "Start Exam"), use a subtle linear gradient from `primary` (#5f5e5e) to `primary-dim` (#535252). This adds a "soul" to the UI that flat colors cannot replicate.

---

## 3. Typography: The Editorial Scale

Typography is our most powerful tool for conveying authority. We use a "Duotone" font strategy: **Newsreader** (Serif) for the law and **Public Sans** (Sans-serif) for the utility.

*   **Display & Headlines (Newsreader):** Used for Article titles and high-level legislation names. This provides the "Legal/Academic" weight.
    *   *Display-lg:* 3.5rem (For Major Law Titles)
    *   *Headline-md:* 1.75rem (For Article Titles)
*   **Titles & Body (Public Sans):** Used for interpretation, lists, and metadata.
    *   *Title-sm:* 1rem (Strong weight for sub-headings within articles)
    *   *Body-lg:* 1rem (Optimized for long-form reading legibility)
*   **Labels (Public Sans):** 
    *   *Label-md:* 0.75rem (For "Article 14" badges and metadata)

---

## 4. Elevation & Depth

We reject the "floating card" meta. Instead, we use **Tonal Layering**.

*   **The Layering Principle:** Rather than shadows, place a `surface-container-lowest` element on a `surface-container` background to create a soft, natural lift.
*   **Ambient Shadows:** If an element must float (e.g., a modal or dropdown), use a shadow color tinted with `on-surface` at 4%–6% opacity with a 32px blur. It should look like a soft glow, not a dark stain.
*   **The "Ghost Border" Fallback:** When separation is mandatory for accessibility, use a **Ghost Border**: `outline-variant` (#abb3b7) at **15% opacity**. This provides a guide for the eye without breaking the "No-Line" rule.

---

## 5. Components

### Article Blocks (The Core Element)
Do not use cards. Articles are defined by vertical rhythm and typographic weight.
- **Top:** Badge (`label-md`) using `secondary-container` text.
- **Title:** `headline-sm` in Newsreader.
- **Content:** `body-lg` in Public Sans.
- **Spacing:** Use 48px (3rem) bottom margin between Articles to give "The Law" room to breathe.

### Buttons
- **Primary:** `primary` (#5f5e5e) background with `on-primary` text. Corners: `sm` (0.125rem) for a sharp, professional look.
- **Tertiary (Ghost):** No background, `on-surface` text. Used for "Cancel" or "Secondary Info."

### Lists (Alpha & Numeric)
Legislative lists require strict hierarchy.
1.  **Level 1:** Numeric (1, 2, 3)
2.  **Level 2:** Alpha (a, b, c) - Use `title-sm` (Strong weight) for the letter to ensure it acts as a visual anchor.

### Input Fields
Avoid "Boxy" inputs. Use a minimalist approach: `surface-container-low` background with a `Ghost Border` only on the bottom edge. On focus, transition the bottom border to `secondary` with a 2px stroke.

### Badges
Used for section headings or status (e.g., "New Regulation"). 
- **Style:** Small caps, `label-sm`, `full` roundedness (the only exception to the sharp-corner rule), using `secondary-fixed-dim` background.

---

## 6. Do’s and Don’ts

### Do
- **Do** prioritize the vertical reading line. The document should feel like a continuous scroll of knowledge.
- **Do** use `secondary` (#526074) for accents like "Selected Text" or "Key Terms."
- **Do** use high-contrast font weights for subheadings to allow for "skimmability."

### Don’t
- **Don’t** use large rounded corners (avoid `xl` and `lg` scales). Stick to `sm` (0.125rem) or `none`.
- **Don’t** use 100% black. Use `on-background` (#2b3437) for all primary text to reduce eye strain.
- **Don’t** use divider lines to separate articles. Use `surface-container-low` background blocks or 64px of whitespace.
- **Don't** use purple or vibrant "app-like" colors. If it looks like a game, it's wrong. If it looks like a prestigious legal journal, it's right.

---

**Director’s Note:** Junior designers should focus on the *rhythm* of the typography. In a system without borders and cards, the "white space" is your architecture. If a section feels messy, do not add a border; increase the spacing and check your typographic hierarchy.```
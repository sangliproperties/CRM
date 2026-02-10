# Design Guidelines for Sangli Properties LLP Real Estate CRM

## Design Approach
**Reference-Based Approach**: Inspired by professional CRM platforms (Zoho, HubSpot) with modern dashboard aesthetics. This is a data-intensive, utility-focused application where clarity, hierarchy, and efficient workflows are paramount.

---

## Core Design Elements

### A. Color Palette

**Light Mode (Primary):**
- **Primary Blue**: 215 85% 45% - Brand color for primary actions, active states, headers
- **Gold Accent**: 45 90% 55% - Secondary accent for premium features, success states, highlights
- **Background**: 0 0% 100% - Pure white base
- **Surface**: 220 15% 97% - Light gray for cards, panels
- **Border**: 220 10% 88% - Subtle dividers
- **Text Primary**: 220 15% 15% - Main content
- **Text Secondary**: 220 10% 45% - Supporting text
- **Success**: 145 65% 42% - Closed deals, sold properties
- **Warning**: 35 85% 55% - Pending follow-ups
- **Danger**: 0 75% 55% - Urgent actions, overdue tasks

**Status Colors:**
- New Lead: 215 85% 95% (light blue background)
- Contacted: 45 90% 95% (light gold)
- Negotiation: 35 85% 95% (light orange)
- Closed: 145 65% 95% (light green)

### B. Typography
- **Primary Font**: Inter (Google Fonts) - Clean, modern, excellent for dashboards
- **Headings**: 600-700 weight
- **Body**: 400-500 weight
- **Data/Numbers**: 500-600 weight (for emphasis in charts and metrics)

### C. Layout System
**Spacing Units**: Tailwind units of 2, 4, 6, 8, 12, 16 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: space-y-6 to space-y-8
- Card margins: m-4
- Dashboard grid gaps: gap-6

**Grid Structure:**
- Sidebar: Fixed 240px width (hidden on mobile, drawer on tablet)
- Main content: flex-1 with max-w-7xl container
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 for metrics
- Tables: Full width with horizontal scroll on mobile

### D. Component Library

**Navigation & Layout:**
- **Sidebar**: White background, blue active state indicators, icon + label format, collapsible on tablet, fixed position on desktop
- **Top Bar**: Company logo left, user profile/notifications right, shadow-sm for depth
- **Breadcrumbs**: Simple text navigation with chevron separators

**Data Display:**
- **Cards**: White background, border, rounded-lg, shadow-sm, hover:shadow-md transition
- **Tables**: Striped rows (alternating surface color), sticky header, sortable columns, action buttons right-aligned
- **Status Badges**: Rounded-full pill shape, colored backgrounds matching status colors, bold text
- **Metric Cards**: Large numbers (text-3xl font-semibold), small labels (text-sm text-secondary), icon top-right, colored accent borders

**Forms & Inputs:**
- **Input Fields**: Border focus:ring-2 ring-primary, rounded-md, p-3
- **Select Dropdowns**: Consistent with inputs, chevron-down icon
- **Buttons Primary**: Blue background, white text, rounded-md, px-6 py-3, hover:opacity-90
- **Buttons Secondary**: Gold background for featured actions
- **Buttons Outline**: Border with blue or gold, transparent background, for secondary actions
- **Icon Buttons**: Rounded-full for quick actions (WhatsApp, email, edit, delete)

**Charts & Analytics:**
- **Bar Charts**: Blue primary bars, gold for comparisons
- **Line Charts**: Smooth curves, blue gradient fill beneath
- **Donut Charts**: Segmented with status colors, centered metric display
- **Funnel**: Stacked conversion stages with percentages

**Property Gallery:**
- **Cards**: Image top (aspect-ratio-video), property details below, status badge overlay on image
- **Grid Layout**: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- **Hover Effect**: scale-105 transform on image, shadow-lg on card

**Modals & Drawers:**
- **Modal**: Centered overlay, white background, max-w-2xl, rounded-lg, p-6
- **Drawer**: Slide-in from right (mobile/tablet views), fixed position, overlay backdrop

### E. Interactions
- **Hover States**: Subtle opacity changes (hover:opacity-90), shadow increases
- **Active States**: Blue ring for focused inputs, pressed button states
- **Loading States**: Skeleton loaders for tables, spinner for actions
- **Transitions**: duration-200 for smooth interactions
- **Animations**: Minimal - only fade-in for modals, slide for drawers

---

## Module-Specific Guidelines

**Dashboard:**
- 4-column metric cards at top (total leads, active leads, closed deals, available properties)
- Below: 2-column layout with sales graph (left) and lead funnel (right)
- Bottom section: Recent activities timeline + top agents leaderboard

**Lead Management:**
- Table view default with action column (edit, delete, WhatsApp, email icons)
- Filter bar above table (status, source, assigned agent dropdowns)
- "Add Lead" button top-right (gold accent)
- Lead detail drawer slides from right with full information and activity timeline

**Property Management:**
- Toggle between table and gallery views (icons top-right)
- Gallery: 3-column grid with image cards
- Property detail modal with image carousel at top
- Status badge overlays on property images

**Activity Timeline:**
- Vertical line with dots, alternating left/right content
- Icons for call, meeting, email, note
- Timestamps and agent names

---

## Responsive Behavior
- **Desktop (lg)**: Sidebar visible, 4-column metrics, 2-column charts
- **Tablet (md)**: Collapsible sidebar drawer, 2-column metrics, single-column charts
- **Mobile (base)**: Hamburger menu, single-column everything, horizontal scroll tables

---

## Images
**Logo**: "Sangli Properties LLP" - professional wordmark with optional house/building icon, placed top-left of sidebar

**Property Images**: User-uploaded photos displayed in cards and detail views, use placeholder images for demo (modern residential/commercial buildings)

**Empty States**: Simple illustrations for "No leads yet", "No properties", friendly and minimal

**No Hero Image**: This is an internal CRM dashboard application, not a marketing site - starts directly with navigation and content.
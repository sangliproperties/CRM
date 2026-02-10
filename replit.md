# Sangli Properties LLP - Real Estate CRM

## Overview
A comprehensive Real Estate CRM web application designed for Sangli Properties LLP. Its core purpose is to streamline the management of real estate operations, including lead tracking, property listings, sales management, and analytical reporting. The project aims to provide a robust, role-based system with a professional user experience, enhancing efficiency and decision-making for various stakeholders within the organization.

## User Preferences
- Clean, professional design with blue and gold accents
- Emphasis on data visualization and analytics
- Quick access to contact methods (WhatsApp, Email)
- Responsive across all devices
- Keyboard-accessible forms and navigation

## System Architecture
The application is built as a full-stack web application with a clear separation of concerns.

### Technology Stack
- **Frontend**: React + TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon)
- **Authentication**: Replit Auth (OpenID Connect)
- **State Management**: TanStack Query (React Query v5)
- **Charts**: Recharts

### User Roles & Access Control
The system implements role-based access control with four distinct roles:
1.  **Admin**: Full access to all features and all leads.
2.  **Sales Agent**: Access limited to assigned leads, properties, and clients.
3.  **Marketing Executive**: Access limited to assigned leads and contact forms.
4.  **Property Manager**: Access to properties and owners, no access to leads.

### Key Features
-   **Authentication & Authorization**: Secure login, role-based dashboards, and granular permissions.
-   **Lead Management**: Comprehensive CRUD for leads, configurable stages, source tracking, agent assignment, activity timelines, quick communication actions, and refresh button to reload leads data on-demand. Search functionality includes name, phone, email, and preferred location fields.
-   **Property Management**: CRUD for properties with various types and statuses, multiple image support, and automatic owner creation/linking. Enhanced with transaction types (Buy, Sell, Rent) and expanded categories. Properties automatically display category-appropriate default images (professional stock photos) when no custom images are provided. Location fields simplified - latitude/longitude removed, map display removed. Search functionality includes property title and location fields. Property listings display owner information (name, phone, email) using PropertyWithOwner type with LEFT JOIN to owners table, with clickable owner links for navigation. Manual property creation includes optional owner selection field showing "Name (Phone)" format, with "No Owner" as default option. Excel/PDF imports support properties without owner details.
-   **Owner & Client Management**: Dedicated databases for property owners and clients, linked to leads and properties.
-   **Dashboard & Analytics**: Real-time statistics, sales charts, lead source distribution, agent performance leaderboards, daily executive activity reports, and recent activity feeds. Dashboard data is filtered based on user roles. The daily activity report shows each executive's leads assigned today, site visits conducted, and leads closed for the current day. A refresh button allows users to reload all dashboard data on-demand. Revenue statistics are visible only to Admin users for confidentiality.
-   **Reports & Export**: Export capabilities for leads, properties, and sales data in CSV and Excel formats, including agent performance and conversion rates.
-   **Contact Form Integration**: Public API endpoint for website contact submissions, with automatic conversion to leads.
-   **PDF Document Management**: Centralized management of PDF files linked to entities (properties, leads, clients) with upload, secure download, inline viewing, and access control.
-   **Excel Import (Admin Only)**: Bulk data import for leads, properties, owners, and clients with pre-flight validation, atomic transactions, duplicate detection, custom field mapping, and detailed error reporting.
-   **User Management (Admin Only)**: Manage user accounts, roles, invitation workflows, and user deactivation/reactivation. Admins can deactivate users to prevent system access while preserving their data and linked records (leads, activities, documents). Deactivated users are automatically filtered from assignment dropdowns and cannot be assigned new work. User list displays active users on top, sorted alphabetically within each status group (active/inactive).
-   **PDF Generation**: On-demand generation of property brochures and various reports.

### Design System
-   **Color Palette**: Primary Blue (brand color), Gold Accent (secondary actions), and specific status colors for lead stages.
-   **Typography**: Inter font family, varying weights for headings and body.
-   **Components**: Sidebar navigation, responsive design, card-based layouts, table/grid views, modal dialogs, and slide-in drawers.

### API Endpoints
A comprehensive set of RESTful API endpoints supports all frontend functionalities, covering authentication, CRUD operations for all entities (leads, properties, owners, clients, documents), dashboard analytics, reporting, contact submissions, and administrative tasks like Excel import and user management.

## External Dependencies
-   **Neon (PostgreSQL)**: Managed PostgreSQL database service for persistent data storage.
-   **Replit Auth**: OpenID Connect based authentication service provided by Replit.
-   **Recharts**: JavaScript charting library for data visualization.
-   **xlsx**: Library for reading and writing Excel files for import/export functionalities.
-   **Replit Object Storage**: Secure cloud storage for managing and serving PDF documents.
-   **pdfkit**: PDF generation library used for creating property brochures and reports.
-   **WhatsApp (wa.me deep links)**: For quick direct messaging functionality.
-   **Mailto links**: For quick email functionality.
-   **Google Fonts (Inter)**: For typography.
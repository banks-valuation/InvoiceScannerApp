# Invoice Scanner and Management App

## Overview
A modern invoice management application built with React, TypeScript, and Supabase. This app allows users to scan, store, and manage invoices with automatic data extraction, cloud storage integration (Microsoft OneDrive), and Excel tracking capabilities.

## Project Status
**Last Updated:** November 14, 2025
**Status:** Fully configured and running on Replit

## Recent Changes
- **Nov 14, 2025:** Configured for Replit environment
  - Updated Vite configuration for host 0.0.0.0, port 5000
  - Set up Supabase environment variables
  - Fixed duplicate method declarations in supabaseInvoiceService.ts
  - Removed unused imports in App.tsx
  - Created workflow for frontend development server

## Tech Stack
- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Icons:** Lucide React
- **Routing:** React Router DOM
- **Date Handling:** date-fns
- **Cloud Integration:** Microsoft Graph API (OneDrive/Excel)
- **OCR:** FormExtractor AI API

## Project Architecture

### Core Features
1. **Invoice Management**
   - Create, read, update, delete invoices
   - Search and filter by customer name
   - Category-based organization
   - File upload support (images and PDFs)

2. **Authentication**
   - Supabase Auth integration
   - Row Level Security (RLS)
   - User-specific data isolation

3. **Cloud Integration** (Optional)
   - Microsoft OneDrive file upload
   - Excel spreadsheet tracking
   - OAuth 2.0 authentication

4. **OCR Processing** (Optional)
   - Automatic data extraction from invoice images
   - Customer name, date, and amount recognition

### Directory Structure
```
src/
├── components/          # React components
│   ├── AuthProvider.tsx    # Authentication context
│   ├── InvoiceList.tsx     # Main invoice listing
│   ├── InvoiceForm.tsx     # Invoice creation/editing
│   ├── SettingsPage.tsx    # App configuration
│   └── ...
├── services/            # Business logic
│   ├── invoiceService.ts   # Invoice operations
│   ├── supabaseInvoiceService.ts # Database operations
│   ├── microsoftService.ts # OneDrive/Excel integration
│   ├── ocrService.ts       # Document extraction
│   └── settingsService.ts  # User preferences
├── types/               # TypeScript definitions
├── hooks/               # Custom React hooks
└── lib/                 # Utilities and configurations
```

## Environment Configuration

### Required Environment Variables
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous/public API key

### Replit-Specific Settings
- **Dev Server:** Vite running on 0.0.0.0:5000
- **HMR:** Configured for WebSocket Secure (wss://) on port 443
- **Workflow:** Single frontend development server

## Supabase Setup

### Required Database Tables
1. **invoices**
   - Stores invoice data with file references
   - OneDrive sync status tracking
   - Row Level Security enabled

2. **user_settings**
   - User preferences and configuration
   - OneDrive folder settings
   - OCR and category preferences

### Database Migrations
Database migrations are located in `supabase/migrations/`. These need to be run in your Supabase project to set up the schema.

## Microsoft 365 Integration (Optional)

The app includes optional Microsoft 365 integration for OneDrive and Excel features. To use this:

1. Create an Azure App Registration
2. Configure Microsoft Graph API permissions:
   - `Files.ReadWrite`
   - `Sites.ReadWrite.All`
3. Update client ID and tenant ID in `src/main.tsx`
4. Set redirect URI to match your Replit domain + `/auth/callback`

See `MICROSOFT_SETUP_INSTRUCTIONS.md` for detailed setup.

## Development

### Running the App
The app is configured to run automatically via the "Frontend Dev Server" workflow. Changes to code will hot-reload automatically.

### Building for Production
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## Deployment

Configured for Replit deployment:
- Frontend serves from port 5000
- Static build output to `dist/` directory
- Environment variables managed through Replit Secrets

## Known Issues & Notes

1. **Browser Warnings:** React Router future flag warnings are present but non-critical
2. **Browserslist:** Can be updated with `npx update-browserslist-db@latest`
3. **Microsoft Integration:** Requires Azure app registration and configuration
4. **OCR Service:** Requires FormExtractor AI API key (optional feature)

## User Preferences

This section is reserved for user-specific coding preferences and workflow notes.

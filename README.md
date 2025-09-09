# Invoice Scanner and Management App

A modern, full-featured invoice management application built with React, TypeScript, and Supabase. This app allows users to scan, store, and manage invoices with automatic data extraction, cloud storage integration, and Excel tracking.

## Features

### 📱 Core Functionality
- **Invoice Scanning**: Capture invoices using camera or file upload (images and PDFs)
- **OCR Data Extraction**: Automatically extract customer name, date, and amount from uploaded documents
- **Invoice Management**: Create, edit, delete, and organize invoices
- **Search & Filter**: Find invoices by customer name and filter by category
- **Responsive Design**: Works seamlessly on desktop and mobile devices

### ☁️ Cloud Integration
- **Microsoft OneDrive**: Upload invoice files to organized folders
- **Excel Tracking**: Automatically sync invoice data to Excel spreadsheets
- **Secure Authentication**: OAuth 2.0 integration with Microsoft 365

### 🎨 User Experience
- **Modern UI**: Clean, intuitive interface with smooth animations
- **Dark/Light Themes**: Automatic theme detection and manual override
- **Modal System**: Beautiful, accessible modal dialogs
- **Loading States**: Clear feedback during operations
- **Error Handling**: Graceful error recovery with user-friendly messages

### 🔐 Security & Data
- **User Authentication**: Secure login with Supabase Auth
- **Row Level Security**: Database-level access control
- **File Storage**: Secure file uploads with Supabase Storage
- **Data Validation**: Client and server-side validation

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Build Tool**: Vite
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Cloud Integration**: Microsoft Graph API
- **OCR**: FormExtractor AI API

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Microsoft 365 account (for OneDrive integration)
- Azure App Registration (for Microsoft Graph API)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd invoice-scanner-manager
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Configure Supabase**
   - Create a new Supabase project
   - Run the database migrations (see Database Setup below)
   - Configure authentication providers if needed

5. **Start the development server**
   ```bash
   npm run dev
   ```

## Database Setup

The app uses Supabase with the following tables:

### `invoices` table
- Stores invoice data with file references
- Includes OneDrive sync status tracking
- Row Level Security enabled

### `user_settings` table
- Stores user preferences and configuration
- OneDrive folder settings
- OCR and general preferences

Run the migrations in your Supabase project to set up the database schema.

## Microsoft 365 Integration Setup

For OneDrive and Excel integration, you'll need to:

1. **Create Azure App Registration**
   - Go to [Azure Portal](https://portal.azure.com)
   - Create a new App Registration
   - Note the Client ID and Tenant ID

2. **Configure Permissions**
   - Add Microsoft Graph permissions:
     - `Files.ReadWrite`
     - `Sites.ReadWrite.All`
   - Grant admin consent

3. **Set Redirect URI**
   - Add your app's callback URL: `https://your-domain.com/auth/callback`
   - For local development: `http://localhost:5173/auth/callback`

4. **Update Configuration**
   - Update the Microsoft Service configuration in `src/main.tsx`
   - Replace the client ID and tenant ID with your values

See `MICROSOFT_SETUP_INSTRUCTIONS.md` for detailed setup instructions.

## Project Structure

```
src/
├── components/          # React components
│   ├── AuthProvider.tsx    # Authentication context
│   ├── InvoiceList.tsx     # Main invoice listing
│   ├── InvoiceForm.tsx     # Invoice creation/editing
│   ├── InvoiceCard.tsx     # Individual invoice display
│   ├── SettingsPage.tsx    # App configuration
│   ├── Modal.tsx           # Modal system
│   └── ...
├── services/            # Business logic and API calls
│   ├── invoiceService.ts   # Invoice operations
│   ├── microsoftService.ts # OneDrive/Excel integration
│   ├── settingsService.ts  # User preferences
│   ├── ocrService.ts       # Document data extraction
│   └── supabaseInvoiceService.ts # Database operations
├── types/               # TypeScript type definitions
├── hooks/               # Custom React hooks
└── lib/                 # Utilities and configurations
```

## Key Features Explained

### Invoice Processing Workflow
1. **Upload**: User captures or uploads invoice document
2. **OCR**: Automatic data extraction (if enabled)
3. **Review**: User reviews and edits extracted data
4. **Save**: Invoice stored in database with file reference
5. **Sync**: Optional upload to OneDrive and Excel tracking

### OneDrive Integration
- Files uploaded to configurable folder structure
- Sharing links generated for Excel integration
- Automatic folder creation
- File cleanup on deletion

### Excel Tracking
- Automatic spreadsheet creation
- Real-time data synchronization
- Hyperlinked file references
- Batch operations support

### Settings Management
- User-specific preferences stored in database
- OneDrive folder configuration
- OCR toggle and default categories
- Folder browser for easy setup

## Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Code Style
- TypeScript strict mode enabled
- ESLint with React and TypeScript rules
- Tailwind CSS for styling
- Component-based architecture

## Deployment

The app can be deployed to any static hosting service:

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Deploy the `dist` folder** to your hosting service

3. **Configure environment variables** on your hosting platform

4. **Update Microsoft redirect URIs** with your production domain

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Check the existing issues on GitHub
- Review the setup documentation
- Ensure all environment variables are configured correctly
- Verify Supabase and Azure configurations

## Roadmap

- [ ] Mobile app version
- [ ] Bulk import/export
- [ ] Advanced reporting
- [ ] Multi-language support
- [ ] Additional cloud storage providers
- [ ] Receipt templates and categories
- [ ] API for third-party integrations
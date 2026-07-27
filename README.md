# 🚀 OnChain Alpha Scanner

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-18.3-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-3ECF8E)](https://supabase.com/)
[![Solana](https://img.shields.io/badge/Solana-Web3.js-14F195)](https://solana.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**Advanced cryptocurrency token scanner** with on-chain analysis, security audits, and real-time market intelligence. A standalone product offering from the OnChain Alpha ecosystem.

<p align="center">
  <img src="https://img.shields.io/badge/Deployed-Vercel%20%2B%20Render-black?style=for-the-badge" alt="Deployment">
  <img src="https://img.shields.io/badge/Authentication-Supabase%20Auth-3ECF8E?style=for-the-badge" alt="Authentication">
  <img src="https://img.shields.io/badge/Payments-Phantom%20Wallet%20%2B%20Solana-purple?style=for-the-badge" alt="Payments">
  <img src="https://img.shields.io/badge/Database-PostgreSQL%20%2B%20Supabase-blue?style=for-the-badge" alt="Database">
</p>

## ✨ Features

### 🔍 **Dual Scanning Modes**
- **BASIC Scan** (2 credits) - Fast token analysis with core metrics
- **ELEVATOR Scan** (10 credits) - Deep blockchain analysis with threat intelligence

### 💳 **Credit System**
- Pay-per-scan model with no subscriptions
- Four credit packages (50, 100, 200, 500 credits)
- Phantom wallet integration for SOL payments
- Real-time balance tracking
- Transparent pricing with bulk discounts

### 🔐 **Security & Analysis**
- Token contract verification
- Tax structure analysis (buy/sell tax)
- Mintable/Freezable detection
- Wash trading detection
- Liquidity pool analysis
- Top holder concentration analysis
- Transaction velocity tracking

### 📊 **Advanced Analytics**
- Market cap charts with RSI/MACD indicators
- Momentum heatmap for buy/sell patterns
- Gini coefficient for token distribution inequality
- Holding velocity classification
- Insider threat detection (block-0 snipers)
- Creator funding risk assessment

### 🎨 **Professional UI**
- 3-theme system (Dark Blue, Cyber Green, Neon Purple)
- Glass-morphism card design
- Animated RGB borders
- Responsive design for all devices
- Real-time notifications with toast system

### 🔧 **Technical Features**
- Supabase authentication (Email + Google OAuth)
- Server-Sent Events (SSE) for real-time updates
- TypeScript for type safety
- TailwindCSS for rapid styling
- Framer Motion for smooth animations
- Recharts for data visualization

## 🏗️ Architecture

```
scanner/
├── app/                          # Next.js 15 App Router
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Scanner homepage
│   └── globals.css              # Global styles & themes
├── components/                   # UI Components
│   ├── credits/                 # Credit system components
│   │   ├── CreditBadge.tsx     # Nav bar balance display
│   │   ├── CreditStoreModal.tsx # Purchase modal
│   │   └── InsufficientCreditsModal.tsx
│   ├── TokenOverviewCard.tsx    # Token basic info
│   ├── AdvancedRiskMetricsCard.tsx
│   ├── TokenAuditCard.tsx       # Security audit
│   ├── MarketIntelligenceCard.tsx
│   ├── RecentTransactionsCard.tsx
│   └── ElevatorResultCard.tsx   # Deep scan results
├── contexts/                    # React Contexts
│   ├── AuthContext.tsx         # Supabase auth state (TO BE REPLACED)
│   ├── ThemeContext.tsx        # Theme management
│   └── CreditContext.tsx       # Credit state management
├── services/                   # API Services
│   ├── scannerApi.ts          # Backend API calls
│   └── creditApi.ts           # Credit API calls
├── hooks/                     # Custom Hooks
│   └── useEventBus.ts        # SSE connection
├── lib/                      # Utilities
│   └── supabase.ts          # Supabase config (TO BE CREATED)
└── types/                    # TypeScript Types
    ├── scanner.ts           # Scanner data interfaces
    └── credits.ts           # Credit system types
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase project for authentication and database
- Phantom wallet for Solana payments
- Backend server (NestJS) for scanner API

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/onchain-scanner.git
cd scanner

# Install dependencies
npm install

# Remove Firebase dependency (to be replaced with Supabase)
npm uninstall firebase

# Install Supabase dependencies
npm install @supabase/supabase-js

# Set up environment variables
cp .env.local.template .env.local
```

### Environment Variables

Create a `.env.local` file with:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Backend API URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000

# Treasury Wallet for Solana payments
NEXT_PUBLIC_TREASURY_WALLET=your_solana_wallet_address
```

### Development Server

```bash
# Start the development server on port 5176
npm run dev

# Open http://localhost:5176 in your browser
```

## 💳 Credit System

### Pricing Packages

| Package | Credits | Price (SOL) | Price (USD) | Bonus | Value/Credit |
|---------|---------|-------------|-------------|-------|--------------|
| Starter | 50      | 0.5 SOL     | ~$10        | -     | $0.20        |
| Basic   | 100     | 0.9 SOL     | ~$18        | 10%   | $0.18        |
| Pro     | 200     | 1.6 SOL     | ~$32        | 20%   | $0.16        |
| Premium | 500     | 3.5 SOL     | ~$70        | 30%   | $0.14        |

### Scan Costs
- **Basic Scan**: 2 credits
- **Elevator Scan**: 10 credits

## ⚠️ Firebase to Supabase Migration Notes

### Current Firebase Dependencies (TO BE REPLACED):

1. **Package Dependency**:
   - `firebase: "^12.13.0"` in package.json
   - **Action**: Remove and replace with `@supabase/supabase-js`

2. **Authentication Context**:
   - File: `contexts/AuthContext.tsx`
   - **Imports**: `firebase/auth` and `../lib/firebase`
   - **Functions**: `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `onAuthStateChanged`, `signInWithPopup`
   - **Replacement**: Replace with Supabase Auth functions

3. **Firebase Configuration**:
   - File: `lib/firebase.ts`
   - **Content**: Firebase initialization and auth export
   - **Replacement**: Create `lib/supabase.ts` with Supabase client

4. **Environment Variables**:
   - Files: `.env.production.template` and documentation references
   - **Variables**: All `NEXT_PUBLIC_FIREBASE_*` variables
   - **Replacement**: Replace with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

5. **Documentation References**:
   - Files: `goal.md`, `plan.md`, `DEPLOYMENT_GUIDE.md`
   - **Content**: All mentions of Firebase authentication
   - **Replacement**: Update to Supabase references

### Supabase Implementation Plan:

1. **Create Supabase Project**:
   - Set up new Supabase project
   - Enable email/password authentication
   - Enable Google OAuth provider
   - Create users table schema

2. **Update Authentication**:
   - Replace `AuthContext.tsx` with Supabase implementation
   - Maintain same interface (`login`, `signup`, `logout`, `loginWithGoogle`)
   - Update user state management

3. **Update Environment Configuration**:
   - Remove Firebase environment variables
   - Add Supabase environment variables
   - Update all configuration files

4. **Update Documentation**:
   - Update README.md (already completed)
   - Update goal.md and plan.md
   - Update deployment guides

## 🛠️ Development

### Available Scripts

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Lint code
npm run lint
```

### Code Structure

- **App Router**: Uses Next.js 15 App Router for file-based routing
- **Components**: Modular UI components with TypeScript interfaces
- **Contexts**: React Context API for global state management
- **Services**: API service layer with Axios interceptors
- **Hooks**: Custom React hooks for reusable logic
- **Types**: TypeScript definitions for all data structures

### Styling System

- **TailwindCSS**: Utility-first CSS framework
- **Custom Themes**: CSS custom properties for theme switching
- **Glass-morphism**: Frosted glass effect using backdrop-blur
- **RGB Borders**: Animated gradient borders using CSS animations
- **Responsive**: Mobile-first responsive design

## 🌐 Deployment

The scanner is designed for deployment on **Vercel** (frontend) and **Render** (backend) with **Supabase** for authentication and database.

### Frontend (Vercel)
```bash
# Deploy to Vercel (auto-deploys on push)
git push origin main
```

### Backend (Render)
The backend is a separate NestJS application that provides:
- Scanner API endpoints
- Credit system database
- Transaction verification
- Real-time event streaming

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for complete deployment instructions (note: needs Firebase references updated to Supabase).

## 📁 Project Files

- [goal.md](goal.md) - Project vision and objectives *(needs Firebase references updated)*
- [plan.md](plan.md) - Detailed implementation plan *(needs Firebase references updated)*
- [CREDIT_SYSTEM_IMPLEMENTATION.md](CREDIT_SYSTEM_IMPLEMENTATION.md) - Credit system specification
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Complete deployment guide *(needs Firebase references updated)*
- [SETUP_TREASURY_WALLET.md](SETUP_TREASURY_WALLET.md) - Solana wallet setup
- [TREASURY_WALLET_QUICK_START.md](TREASURY_WALLET_QUICK_START.md) - Quick wallet guide

## 🔧 Technologies Used

### Frontend
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety and developer experience
- **TailwindCSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **React Hot Toast** - Toast notifications
- **Lucide React** - Icon library
- **Recharts** - Data visualization

### Authentication & Database
- **Supabase** - Authentication and PostgreSQL database
- **@supabase/supabase-js** - Supabase client library

### Payments
- **@solana/web3.js** - Solana blockchain integration
- **Phantom Wallet** - Solana wallet for payments

### State Management
- **React Context API** - Global state management
- **Custom Hooks** - Reusable logic abstraction

### Development Tools
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

## 📈 Performance

- **Lazy Loading**: Components loaded on-demand
- **Code Splitting**: Automatic route-based code splitting
- **Image Optimization**: Next.js Image component optimization
- **Client-Side Caching**: LocalStorage for repeated scans
- **Edge Functions**: Serverless functions for API routes

## 🔐 Security

- **Input Validation**: All user inputs validated
- **XSS Protection**: React's built-in XSS protection
- **CORS Configuration**: Strict CORS policies
- **Environment Variables**: Secrets stored in environment
- **Database Transactions**: Atomic credit operations
- **Transaction Verification**: On-chain verification before crediting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Use functional components with hooks
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the documentation files in the project root
- **Issues**: Report bugs or feature requests via GitHub Issues
- **Questions**: Contact the development team via email

## 🎯 Roadmap

- [ ] Multi-chain support (Ethereum, Polygon, Arbitrum)
- [ ] Credit gifting system
- [ ] Enterprise packages
- [ ] API rate limiting
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Browser extension

## 📞 Contact

**OnChain Alpha Team**
- Website: [onchain-alpha.com](https://onchain-alpha.com)
- Email: support@onchain-alpha.com
- Twitter: [@OnChainAlpha](https://twitter.com/OnChainAlpha)

---

<div align="center">
  <p>
    <strong>OnChain Alpha Scanner</strong> - Advanced cryptocurrency token analysis powered by on-chain intelligence.
  </p>
  <p>
    Built with ❤️ by the OnChain Alpha Team
  </p>
</div>
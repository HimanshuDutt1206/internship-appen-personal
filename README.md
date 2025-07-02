# 🍎 NutriCoach AI - Smart Nutrition Tracking & Planning

A modern, intelligent nutrition tracking and meal planning application built with React, TypeScript, and Supabase. NutriCoach AI helps users achieve their health and fitness goals through personalized nutrition plans, comprehensive food logging, and progress tracking.

## ✨ Features

### 🔐 **Secure Authentication**

- **Supabase Auth Integration** - Secure user registration and login
- **Password Security** - Automatic password hashing and validation
- **Session Management** - JWT-based authentication with automatic refresh
- **Progressive Onboarding** - Guided setup flow for new users
- **User Profile Management** - Complete account management with data deletion

### 🎯 **Personalized Nutrition Planning**

- **Smart BMR & TDEE Calculations** using Mifflin-St Jeor Formula
- **Goal-Based Macro Distribution** (weight loss, muscle gain, maintenance)
- **Intelligent Water Intake Targets** based on activity level and goals
- **Multi-Unit Support** (metric/imperial measurements)
- **One-Month Timeline** with sustainable, realistic targets

### 📱 **Comprehensive Food Logging**

- **USDA FoodData Central Integration** - Access to over 1 million foods from the official USDA database
- **Smart Food Search** - Search and add foods with accurate nutrition data
- **Flexible Quantity Selection** - Choose from grams, cups, tablespoons, pieces, or custom amounts
- **Meal Category Tracking** (breakfast, lunch, dinner, snacks)
- **Detailed Macro Breakdown** (calories, protein, carbs, fats, fiber, sugar, sodium)
- **Real-Time Progress Monitoring** with visual progress bars
- **Daily Nutrition Summary** with target comparisons
- **Manual Food Entry** - Add custom foods when needed

### 📊 **Progress Tracking & Analytics**

- **Visual Progress Charts** using Recharts
- **Weight Tracking** with historical data
- **Daily Nutrition Analytics** with goal completion tracking
- **Hydration Monitoring** with intake targets
- **Weekly Goal Completion** metrics
- **Streak Tracking** for consistency motivation

### 🎨 **Modern User Experience**

- **Dark/Light Theme Support** with system preference detection
- **Mobile-First Responsive Design** optimized for all devices
- **Smooth Animations** and transitions
- **Intuitive Bottom Navigation** for easy access
- **Progressive Onboarding Flow** with step-by-step guidance
- **Row Level Security (RLS)** for data protection

## 🛠️ Tech Stack

### **Frontend**

- **React 18** - Modern React with hooks and concurrent features
- **TypeScript** - Full type safety and enhanced developer experience
- **Vite** - Fast build tool and dev server with HMR
- **Tailwind CSS** - Utility-first styling framework
- **shadcn/ui** - Modern component library built on Radix UI

### **Backend & Database**

- **Supabase** - PostgreSQL database with real-time features
- **Supabase Auth** - User authentication and session management
- **Row Level Security (RLS)** - Database-level security policies
- **Real-time Subscriptions** - Live data updates

### **State Management & Routing**

- **TanStack Query** - Server state management and caching
- **React Router DOM** - Client-side routing with navigation guards
- **React Hook Form** - Form state management with validation
- **Zod** - Runtime type validation

### **UI & Visualization**

- **Recharts** - Data visualization and interactive charts
- **Lucide React** - Beautiful and consistent icon system
- **Radix UI** - Accessible component primitives
- **next-themes** - Theme management with system preference detection

### **External APIs**

- **USDA FoodData Central** - Official nutrition database with 1M+ foods
- **RESTful API Integration** - Efficient data fetching and caching

## 🚀 Quick Start

### **Prerequisites**

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Supabase Account** - [Create account](https://supabase.com/)
- **USDA API Key** - [Get free key](https://api.data.gov/signup/)

### **Installation**

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/nutricoach-ai.git
   cd nutricoach-ai
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:

   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # USDA FoodData Central API Configuration
   # Get your API key from: https://api.data.gov/signup/
   VITE_USDA_API_KEY=your_usda_api_key
   ```

   **Note:** You can use `DEMO_KEY` for initial testing, but it has very limited rate limits.

4. **Database Setup**
   The application uses the following database schema with RLS enabled:

   **Note:** If you're upgrading from a previous version that had timeline fields, run this migration first:

   ```sql
   -- Remove timeline column from users table if it exists
   ALTER TABLE public.users DROP COLUMN IF EXISTS timeline;
   ```

   ```sql
   -- Users table for app-specific data
   CREATE TABLE public.users (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT UNIQUE NOT NULL,
     age INTEGER,
     gender TEXT,
     height TEXT,
     height_unit TEXT DEFAULT 'ft',
     weight TEXT,
     weight_unit TEXT DEFAULT 'lbs',
     activity_level TEXT,
     primary_goal TEXT,
     target_weight TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Profiles table for Supabase Auth integration
   CREATE TABLE public.profiles (
     id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     username TEXT UNIQUE,
     full_name TEXT,
     avatar_url TEXT,
     email TEXT UNIQUE
   );

   -- Nutrition Plans table
   CREATE TABLE public.nutrition_plans (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     bmr NUMERIC NOT NULL,
     tdee NUMERIC NOT NULL,
     target_calories NUMERIC NOT NULL,
     protein_grams NUMERIC NOT NULL,
     carbs_grams NUMERIC NOT NULL,
     fats_grams NUMERIC NOT NULL,
     protein_calories NUMERIC NOT NULL,
     carbs_calories NUMERIC NOT NULL,
     fats_calories NUMERIC NOT NULL,
     protein_percentage NUMERIC NOT NULL,
     carbs_percentage NUMERIC NOT NULL,
     fats_percentage NUMERIC NOT NULL,
     water_target INTEGER DEFAULT 8,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Food Logs table
   CREATE TABLE public.food_logs (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     name TEXT NOT NULL,
     calories INTEGER NOT NULL,
     protein NUMERIC DEFAULT 0,
     carbs NUMERIC DEFAULT 0,
     fats NUMERIC DEFAULT 0,
     portion TEXT NOT NULL,
     meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
     logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   -- Water Logs table
   CREATE TABLE public.water_logs (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     amount_ml INTEGER NOT NULL,
     logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );

   -- Weight Logs table
   CREATE TABLE public.weight_logs (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     weight NUMERIC NOT NULL,
     weight_unit TEXT DEFAULT 'lbs' CHECK (weight_unit IN ('lbs', 'kg')),
     logged_date DATE NOT NULL,
     notes TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );

   -- Enable RLS on all tables
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
   ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;
   ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;

   -- Create RLS policies (examples - adjust based on your needs)
   CREATE POLICY "Users can view own data" ON users
     FOR SELECT USING ((SELECT auth.jwt()->>'email') = email);

   CREATE POLICY "Users can insert own data" ON users
     FOR INSERT WITH CHECK ((SELECT auth.jwt()->>'email') = email);

   CREATE POLICY "Users can update own data" ON users
     FOR UPDATE USING ((SELECT auth.jwt()->>'email') = email);
   ```

5. **Start the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:8080`

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components (buttons, forms, etc.)
│   ├── Navigation.tsx  # Bottom navigation component
│   ├── theme-provider.tsx # Theme context provider
│   └── theme-toggle.tsx   # Dark/light mode toggle
├── hooks/              # Custom React hooks
│   ├── use-mobile.tsx  # Mobile detection hook
│   └── use-toast.ts    # Toast notification hook
├── lib/                # Core utilities and services
│   ├── auth.ts         # Authentication service wrapper
│   ├── supabase.ts     # Supabase client and TypeScript types
│   ├── nutritionCalculator.ts # BMR/TDEE calculation logic
│   ├── usdaFoodService.ts     # USDA API integration
│   └── utils.ts        # General utility functions
├── pages/              # Route components
│   ├── Login.tsx       # User authentication
│   ├── SignUp.tsx      # User registration
│   ├── Onboarding.tsx  # Progressive user setup
│   ├── Dashboard.tsx   # Main application overview
│   ├── FoodLogging.tsx # Food search and logging
│   ├── Progress.tsx    # Analytics and progress charts
│   ├── Profile.tsx     # User profile management
│   └── NotFound.tsx    # 404 error page
└── main.tsx           # Application entry point
```

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start development server with HMR
npm run build        # Build for production
npm run build:dev    # Build for development environment
npm run preview      # Preview production build locally
npm run lint         # Run ESLint for code quality
```

## 🌟 Key Features in Detail

### **Nutrition Calculator**

- Uses scientifically-proven Mifflin-St Jeor Formula for BMR calculation
- Accounts for activity level, age, gender, and goals
- Provides personalized macro distribution (protein, carbs, fats)
- Calculates optimal water intake based on multiple factors

### **Food Database Integration**

- Direct integration with USDA FoodData Central
- Over 1 million verified food entries
- Comprehensive nutrition data including micronutrients
- Smart portion size calculations and conversions

### **Progress Analytics**

- Visual charts showing weight trends over time
- Daily nutrition goal completion tracking
- Weekly progress summaries
- Streak tracking for motivation

### **Security & Privacy**

- Row Level Security (RLS) ensures data isolation
- Secure password handling with Supabase Auth
- JWT-based session management
- Complete data deletion capabilities

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [USDA FoodData Central](https://fdc.nal.usda.gov/) for comprehensive nutrition data
- [Supabase](https://supabase.com/) for backend infrastructure
- [shadcn/ui](https://ui.shadcn.com/) for beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) for styling framework

## 📞 Support

If you encounter any issues or have questions, please [open an issue](https://github.com/your-username/nutricoach-ai/issues) on GitHub.

---

**Built with ❤️ for healthier lifestyles**

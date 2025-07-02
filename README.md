# 🍎 NutriCoach AI - Smart Nutrition Tracking & Planning

A comprehensive nutrition tracking and meal planning application that combines modern web technologies with AI-powered insights. Built with React, TypeScript, and Supabase, NutriCoach AI helps users achieve their health goals through personalized nutrition plans, detailed food logging, and intelligent weight progression predictions.

## 📋 Overview

NutriCoach AI is designed to simplify nutrition tracking while providing actionable insights for your health journey. The app features:

- **Personalized nutrition planning** based on your goals, activity level, and body metrics
- **Comprehensive food database** with over 1 million foods from USDA FoodData Central
- **AI-powered weight predictions** using Google's Gemini 2.5 Flash model
- **Real-time progress tracking** with interactive charts and analytics
- **Modern, responsive design** that works seamlessly across all devices

Whether you're looking to lose weight, gain muscle, or maintain a healthy lifestyle, NutriCoach AI provides the tools and insights you need to succeed.

## ✨ Features

- **🔐 Authentication & User Management** - Secure Supabase Auth with progressive onboarding
- **🎯 Smart Nutrition Planning** - BMR/TDEE calculations with personalized macro distribution
- **🤖 AI Weight Predictions** - Gemini 2.5 Flash model for intelligent weight progression forecasts
- **📱 Comprehensive Food Logging** - USDA database with 1M+ foods and flexible portion tracking
- **📊 Progress Tracking & Analytics** - Interactive charts with daily/weekly analytics and trends
- **🎨 Modern User Experience** - Dark/light themes, mobile-responsive design, smooth animations

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Real-time)
- **AI & APIs**: Google AI Studio (Gemini 2.5 Flash), USDA FoodData Central
- **Visualization**: Recharts, Lucide React icons
- **Routing & Forms**: React Router DOM, React Hook Form

## 🚀 Setup & Installation

### **Prerequisites**

Before getting started, ensure you have:

- **Node.js** (version 18 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Supabase account** - [Sign up here](https://supabase.com/)
- **USDA API key** - [Get free key](https://api.data.gov/signup/) (or use `DEMO_KEY` for testing)
- **Google AI Studio API key** - [Get free key](https://aistudio.google.com/)

### **Installation Steps**

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

3. **Environment Configuration**

   Create a `.env.local` file in the root directory:

   ```env
   # Supabase Configuration
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # USDA FoodData Central API
   VITE_USDA_API_KEY=your_usda_api_key

   # Google AI Studio API
   VITE_GOOGLE_AI_API_KEY=your_google_ai_api_key
   ```

4. **Database Setup**

   Run these SQL commands in your Supabase dashboard to create the required tables:

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

   -- Enable Row Level Security
   ALTER TABLE users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE nutrition_plans ENABLE ROW LEVEL SECURITY;
   ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

6. **Open the application**

   Navigate to `http://localhost:5173` in your browser

## 🤖 Using AI Weight Predictions

The AI weight prediction feature is one of NutriCoach AI's standout capabilities:

### **How It Works**

1. **Data Collection**: The AI analyzes your eating patterns, nutrition adherence, weight history, and goal progress
2. **Intelligent Analysis**: Uses your BMR, TDEE, activity level, and actual calorie intake vs targets
3. **Prediction Generation**: Creates realistic weight projections based on evidence-based calculations
4. **Visual Display**: Shows predictions as an orange dotted line on your weight chart

### **Getting Started**

1. Complete the onboarding process and set your nutrition goals
2. Log at least one weight entry in the Progress section
3. Track your daily food and water intake for better accuracy
4. Click "🤖 Predict Weight Progress" on the Progress page
5. View your predictions and update them as you log more data

### **What Makes It Accurate**

- Considers your actual eating patterns, not just theoretical targets
- Analyzes day-to-day consistency and adherence to nutrition goals
- Factors in realistic weight change rates based on calorie deficits/surpluses
- Starts predictions from your most recent logged weight

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui base components
│   ├── Navigation.tsx  # Bottom navigation component
│   └── theme-*.tsx     # Theme management components
├── hooks/              # Custom React hooks
│   ├── use-mobile.tsx  # Mobile device detection
│   └── use-toast.ts    # Toast notifications
├── lib/                # Core utilities and services
│   ├── supabase.ts     # Database client and types
│   ├── nutritionCalculator.ts # BMR/TDEE calculations
│   ├── usdaFoodService.ts     # USDA API integration
│   ├── weightPredictionService.ts # AI predictions
│   └── utils.ts        # General utilities
├── pages/              # Route components
│   ├── Login.tsx       # Authentication
│   ├── Onboarding.tsx  # User setup flow
│   ├── Dashboard.tsx   # Main overview
│   ├── FoodLogging.tsx # Food search and logging
│   ├── Progress.tsx    # Charts and analytics
│   └── Profile.tsx     # User profile management
└── main.tsx           # Application entry point
```

## 🔧 Available Scripts

```bash
npm run dev          # Start development server with HMR
npm run build        # Create production build
npm run preview      # Preview production build locally
npm run lint         # Run ESLint for code quality checks
```

**Built with ❤️ for healthier lifestyles**

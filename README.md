# 🍎 NutriCoach AI - Smart Nutrition Tracking & Planning

A modern, intelligent nutrition tracking and meal planning application built with React, TypeScript, and Supabase. NutriCoach AI helps users achieve their health and fitness goals through personalized nutrition plans, comprehensive food logging, and progress tracking.

## ✨ Features

### 🎯 **Personalized Nutrition Planning**

- **Smart BMR & TDEE Calculations** using Mifflin-St Jeor Formula
- **Goal-Based Macro Distribution** (weight loss, muscle gain, maintenance)
- **Intelligent Water Intake Targets** based on activity level and goals
- **Multi-Unit Support** (metric/imperial measurements)

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
- **Historical Data Analysis**
- **Goal Achievement Tracking**
- **Hydration Monitoring**

### 🎨 **Modern User Experience**

- **Dark/Light Theme Support** with system preference detection
- **Mobile-First Responsive Design**
- **Smooth Animations** and transitions
- **Intuitive Bottom Navigation**
- **Progressive Onboarding Flow**

## 🛠️ Tech Stack

### **Frontend**

- **React 18** - Modern React with hooks
- **TypeScript** - Full type safety
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Modern component library built on Radix UI

### **Backend & Database**

- **Supabase** - PostgreSQL database with real-time features
- **Supabase Auth** - User authentication and management

### **State Management & Routing**

- **TanStack Query** - Server state management and caching
- **React Router DOM** - Client-side routing
- **React Hook Form** - Form state management with Zod validation

### **UI & Visualization**

- **Recharts** - Data visualization and charts
- **Lucide React** - Beautiful icon system
- **Radix UI** - Accessible component primitives

## 🚀 Quick Start

### **Prerequisites**

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** or **yarn** package manager
- **Supabase Account** - [Create account](https://supabase.com/)

### **Installation**

1. **Clone the repository**

   ```bash
   git clone https://github.com/HimanshuDutt1206/internship_appen.git
   cd internship_appen
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

   **Note:** You can use `DEMO_KEY` for initial testing, but it has very limited rate limits. For production use, get a free API key from [data.gov](https://api.data.gov/signup/).

4. **Database Setup**

   Set up your Supabase database with the following tables:

   ```sql
   -- Users table
   CREATE TABLE users (
     id SERIAL PRIMARY KEY,
     name VARCHAR NOT NULL,
     email VARCHAR UNIQUE NOT NULL,
     age INTEGER NOT NULL,
     gender VARCHAR NOT NULL,
     height VARCHAR NOT NULL,
     height_unit VARCHAR NOT NULL,
     weight VARCHAR NOT NULL,
     weight_unit VARCHAR NOT NULL,
     activity_level VARCHAR NOT NULL,
     primary_goal VARCHAR NOT NULL,
     target_weight VARCHAR,
     timeline VARCHAR NOT NULL,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Nutrition Plans table
   CREATE TABLE nutrition_plans (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     bmr INTEGER NOT NULL,
     tdee INTEGER NOT NULL,
     target_calories INTEGER NOT NULL,
     protein_grams INTEGER NOT NULL,
     carbs_grams INTEGER NOT NULL,
     fats_grams INTEGER NOT NULL,
     protein_calories INTEGER NOT NULL,
     carbs_calories INTEGER NOT NULL,
     fats_calories INTEGER NOT NULL,
     protein_percentage INTEGER NOT NULL,
     carbs_percentage INTEGER NOT NULL,
     fats_percentage INTEGER NOT NULL,
     water_target INTEGER NOT NULL,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );

   -- Food Logs table
   CREATE TABLE food_logs (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     name VARCHAR NOT NULL,
     calories DECIMAL NOT NULL,
     protein DECIMAL NOT NULL,
     carbs DECIMAL NOT NULL,
     fats DECIMAL NOT NULL,
     portion VARCHAR NOT NULL,
     meal_type VARCHAR NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snacks')),
     logged_at TIMESTAMP DEFAULT NOW(),
     created_at TIMESTAMP DEFAULT NOW()
   );

   -- Water Logs table
   CREATE TABLE water_logs (
     id SERIAL PRIMARY KEY,
     user_id INTEGER REFERENCES users(id),
     amount_ml INTEGER NOT NULL,
     logged_at TIMESTAMP DEFAULT NOW(),
     created_at TIMESTAMP DEFAULT NOW()
   );
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
│   ├── ui/             # shadcn/ui components
│   ├── Navigation.tsx  # Bottom navigation
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries
│   ├── nutritionCalculator.ts  # Core nutrition logic
│   ├── usdaFoodService.ts      # USDA FoodData Central API integration
│   ├── supabase.ts     # Database client & types
│   └── utils.ts        # Helper functions
├── pages/              # Route components
│   ├── Dashboard.tsx   # Main nutrition dashboard
│   ├── FoodLogging.tsx # Food tracking interface
│   ├── Onboarding.tsx  # User setup flow
│   ├── Progress.tsx    # Analytics & charts
│   ├── Profile.tsx     # User profile management
│   └── ...
└── App.tsx            # Main app component
```

## 🔧 Available Scripts

- **`npm run dev`** - Start development server
- **`npm run build`** - Build for production
- **`npm run build:dev`** - Build in development mode
- **`npm run preview`** - Preview production build
- **`npm run lint`** - Run ESLint

## 🌟 Key Features Explained

### **Nutrition Calculator Algorithm**

The app uses advanced algorithms to calculate personalized nutrition targets:

- **BMR Calculation**: Mifflin-St Jeor equation with gender-specific adjustments
- **Activity Multipliers**: 1.2x (sedentary) to 1.9x (extremely active)
- **Goal-Based Adjustments**: Caloric surplus/deficit based on timeline
- **Macro Distribution**: Protein-priority approach with optimal fat/carb ratios
- **Water Targets**: Weight-based calculations with activity and goal adjustments

### **Multi-Step Onboarding**

1. **Personal Information** - Name, email, password
2. **Health Metrics** - Age, gender, height, weight
3. **Activity Level** - From sedentary to extremely active
4. **Goals & Timeline** - Weight loss, maintenance, or muscle gain

### **Real-Time Tracking**

- Live nutrition progress bars
- Daily intake vs. target comparisons
- Meal-specific macro breakdowns
- Hydration monitoring with custom amounts

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/HimanshuDutt1206/internship_appen/issues) page
2. Create a new issue with detailed description
3. Include steps to reproduce any bugs

## 🎯 Recent Updates

- [x] **USDA FoodData Central Integration** - Access to 1M+ official nutrition data
- [x] **Smart Food Search** - Real-time search with quantity adjustment
- [x] **Flexible Measurement Units** - Grams, cups, tablespoons, pieces, custom amounts
- [x] **Account Deletion** - Complete data privacy and GDPR compliance

## 🎯 Roadmap

- [ ] **Barcode Scanning** for easy food entry
- [ ] **Recipe Builder** with automatic nutrition calculation
- [ ] **Meal Planning** with weekly planning features
- [ ] **Social Features** for sharing progress
- [ ] **Wearable Integration** for activity tracking
- [ ] **AI-Powered Recommendations** for meal suggestions
- [ ] **Offline Mode** for food logging without internet
- [ ] **Nutrition Goals Customization** for specific dietary needs

---

**Built with ❤️ for better health and nutrition tracking**

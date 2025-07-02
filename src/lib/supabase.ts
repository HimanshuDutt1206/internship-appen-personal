import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types
export interface User {
  id?: number
  name: string
  email: string
  age: number
  gender: string
  height: string
  height_unit: string
  weight: string
  weight_unit: string
  activity_level: string
  primary_goal: string
  target_weight: string
  created_at?: string
  updated_at?: string
}

export interface NutritionPlan {
  id?: number
  user_id: number
  bmr: number
  tdee: number
  target_calories: number
  protein_grams: number
  carbs_grams: number
  fats_grams: number
  protein_calories: number
  carbs_calories: number
  fats_calories: number
  protein_percentage: number
  carbs_percentage: number
  fats_percentage: number
  water_target: number
  created_at?: string
  updated_at?: string
}

export interface FoodLog {
  id?: number
  user_id: number
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  portion: string
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
  logged_at?: string
  created_at?: string
}

export interface WaterLog {
  id?: number
  user_id: number
  amount_ml: number
  logged_at?: string
  created_at?: string
}

export interface WeightLog {
  id?: number
  user_id: number
  weight: number
  weight_unit: 'lbs' | 'kg'
  logged_date: string
  notes?: string
  created_at?: string
  updated_at?: string
} 
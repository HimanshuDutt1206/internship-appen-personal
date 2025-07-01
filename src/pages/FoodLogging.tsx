import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit,
  Coffee,
  Sun,
  Moon,
  Apple,
  Scan,
  Clock,
  Target,
  Zap,
  Beef,
  Wheat,
  Droplets,
  Database,
  ChefHat,
  Loader2
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Navigation from "@/components/Navigation"
import { supabase, type FoodLog } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { 
  usdaFoodService, 
  type USDAFoodSearchResult, 
  type QuantityOption, 
  type CalculatedNutrition 
} from "@/lib/usdaFoodService"

interface FoodItem {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fats: number
  portion: string
}

interface MealLog {
  breakfast: FoodItem[]
  lunch: FoodItem[]
  dinner: FoodItem[]
  snacks: FoodItem[]
}

// Circular Progress Component
const CircularProgress = ({ 
  value, 
  max, 
  size = 120, 
  strokeWidth = 8, 
  color = "hsl(var(--primary))",
  children 
}: { 
  value: number
  max: number
  size?: number
  strokeWidth?: number
  color?: string
  children?: React.ReactNode
}) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const percentage = Math.min((value / max) * 100, 100)
  const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`
  
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="opacity-20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          className="transition-all duration-500 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  )
}

const mealIcons = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snacks: Apple
}

const sampleFoods: FoodItem[] = []

export default function FoodLogging() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedMeal, setSelectedMeal] = useState<keyof MealLog>("breakfast")
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [recentFoods, setRecentFoods] = useState<{[key in keyof MealLog]: FoodItem[]}>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: []
  })
  const [selectedRecentFood, setSelectedRecentFood] = useState<FoodItem | null>(null)
  const [showAddFoodDialog, setShowAddFoodDialog] = useState(false)
  const [dailyTargets, setDailyTargets] = useState({
    calories: 2000,
    protein: 150,
    carbs: 250,
    fats: 67
  })
  const [mealLogs, setMealLogs] = useState<MealLog>({
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: []
  })

  // USDA Search States
  const [usdaSearchQuery, setUsdaSearchQuery] = useState("")
  const [usdaSearchResults, setUsdaSearchResults] = useState<USDAFoodSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUsdaFood, setSelectedUsdaFood] = useState<USDAFoodSearchResult | null>(null)
  const [customQuantity, setCustomQuantity] = useState("")
  const [calculatedNutrition, setCalculatedNutrition] = useState<CalculatedNutrition | null>(null)
  const [showQuantityDialog, setShowQuantityDialog] = useState(false)

  const { toast } = useToast()

  // Load nutrition targets and food logs from database
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)
        
        // Get the most recent user
        const { data: userData } = await supabase
          .from('users')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (userData) {
          setCurrentUserId(userData.id)
          
          // Load nutrition targets
          const { data: planData } = await supabase
            .from('nutrition_plans')
            .select('target_calories, protein_grams, carbs_grams, fats_grams')
            .eq('user_id', userData.id)
            .single()

          if (planData) {
            setDailyTargets({
              calories: planData.target_calories,
              protein: planData.protein_grams,
              carbs: planData.carbs_grams,
              fats: planData.fats_grams
            })
          }
          
          // Load today's food logs and recent foods
          await loadTodaysFoodLogs(userData.id)
          await loadRecentFoods(userData.id)
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast({
          title: "Error",
          description: "Failed to load your nutrition data.",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  const loadTodaysFoodLogs = async (userId: number) => {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      const { data: foodLogs, error } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', `${today}T00:00:00.000Z`)
        .lt('logged_at', `${today}T23:59:59.999Z`)
        .order('logged_at', { ascending: true })

      if (error) throw error

      // Group food logs by meal type
      const groupedLogs: MealLog = {
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: []
      }

      foodLogs?.forEach((log: FoodLog) => {
        const foodItem: FoodItem = {
          id: log.id!.toString(),
          name: log.name,
          calories: log.calories,
          protein: log.protein,
          carbs: log.carbs,
          fats: log.fats,
          portion: log.portion
        }
        groupedLogs[log.meal_type].push(foodItem)
      })

      setMealLogs(groupedLogs)
    } catch (error) {
      console.error('Error loading food logs:', error)
      toast({
        title: "Error",
        description: "Failed to load your food logs.",
        variant: "destructive",
      })
    }
  }

  const [isManualEntry, setIsManualEntry] = useState(false)
  const [manualFood, setManualFood] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    portion: ""
  })

  // Edit food states
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingFood, setEditingFood] = useState<FoodItem | null>(null)
  const [editingMealType, setEditingMealType] = useState<keyof MealLog | null>(null)
  const [editFood, setEditFood] = useState({
    name: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    portion: ""
  })
  const [originalNutritionPer100g, setOriginalNutritionPer100g] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0
  })

  const filteredFoods = sampleFoods.filter(food =>
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // USDA Search Functions
  const searchUsdaFoods = async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setUsdaSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const response = await usdaFoodService.searchFoods(query, 5)
      setUsdaSearchResults(response.foods || [])
    } catch (error) {
      console.error('USDA search error:', error)
      toast({
        title: "Search Error",
        description: "Failed to search foods. Please try again.",
        variant: "destructive",
      })
      setUsdaSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleUsdaFoodSelect = (food: USDAFoodSearchResult) => {
    setSelectedUsdaFood(food)
    setCustomQuantity("100") // Default to 100g
    
    // Calculate initial nutrition with default quantity (100g)
    const initialNutrition = usdaFoodService.calculateNutrition(food, 100)
    setCalculatedNutrition(initialNutrition)
    
    setShowQuantityDialog(true)
  }

  const handleCustomQuantityChange = (value: string) => {
    setCustomQuantity(value)
    if (!selectedUsdaFood || !value) {
      setCalculatedNutrition(null)
      return
    }
    
    const quantityInGrams = parseFloat(value)
    if (isNaN(quantityInGrams) || quantityInGrams <= 0) {
      setCalculatedNutrition(null)
      return
    }
    
    const nutrition = usdaFoodService.calculateNutrition(selectedUsdaFood, quantityInGrams)
    setCalculatedNutrition(nutrition)
  }

  const addUsdaFoodToMeal = async () => {
    if (!selectedUsdaFood || !calculatedNutrition || !customQuantity || !currentUserId) return
    
    try {
      const foodName = usdaFoodService.formatFoodName(selectedUsdaFood)
      const portion = `${customQuantity}g`
      
      const foodData: Omit<FoodLog, 'id' | 'logged_at' | 'created_at'> = {
        user_id: currentUserId,
        name: foodName,
        calories: calculatedNutrition.calories,
        protein: calculatedNutrition.protein,
        carbs: calculatedNutrition.carbs,
        fats: calculatedNutrition.fats,
        portion: portion,
        meal_type: selectedMeal
      }

      const { data, error } = await supabase
        .from('food_logs')
        .insert([foodData])
        .select()
        .single()

      if (error) throw error

      // Add to local state
      const newFood: FoodItem = {
        id: data.id.toString(),
        name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        portion: data.portion
      }
      
      setMealLogs(prev => ({
        ...prev,
        [selectedMeal]: [...prev[selectedMeal], newFood]
      }))

      // Refresh recent foods
      if (currentUserId) {
        await loadRecentFoods(currentUserId)
      }

      // Reset states
      setShowQuantityDialog(false)
      setSelectedUsdaFood(null)
      setCalculatedNutrition(null)
      setCustomQuantity("")
      setUsdaSearchQuery("")
      setUsdaSearchResults([])
      
      toast({
        title: "Success",
        description: `${foodName} added successfully!`,
      })
    } catch (error) {
      console.error('Error adding USDA food:', error)
      toast({
        title: "Error",
        description: "Failed to add food. Please try again.",
        variant: "destructive",
      })
    }
  }

  const loadRecentFoods = async (userId: number) => {
    try {
      // Load recent foods for each meal type (last 4 entries for each meal)
      const mealTypes: (keyof MealLog)[] = ['breakfast', 'lunch', 'dinner', 'snacks']
      const recentFoodsData: {[key in keyof MealLog]: FoodItem[]} = {
        breakfast: [],
        lunch: [],
        dinner: [],
        snacks: []
      }

      for (const mealType of mealTypes) {
        const { data: foods, error } = await supabase
          .from('food_logs')
          .select('*')
          .eq('user_id', userId)
          .eq('meal_type', mealType)
          .order('logged_at', { ascending: false })
          .limit(4)

        if (error) {
          console.warn(`Error loading recent ${mealType} foods:`, error)
          continue
        }

        if (foods) {
          recentFoodsData[mealType] = foods.map(log => ({
            id: log.id.toString(),
            name: log.name,
            calories: log.calories,
            protein: log.protein,
            carbs: log.carbs,
            fats: log.fats,
            portion: log.portion
          }))
        }
      }

      setRecentFoods(recentFoodsData)
    } catch (error) {
      console.error('Error loading recent foods:', error)
    }
  }

  const handleRecentFoodClick = (food: FoodItem) => {
    setSelectedRecentFood(food)
    setShowAddFoodDialog(true)
  }

  const confirmAddRecentFood = async () => {
    if (selectedRecentFood) {
      await addFoodToMeal(selectedRecentFood)
      setShowAddFoodDialog(false)
      setSelectedRecentFood(null)
      
      // Refresh recent foods to get updated data
      if (currentUserId) {
        await loadRecentFoods(currentUserId)
      }
    }
  }

  const addFoodToMeal = async (food: FoodItem) => {
    if (!currentUserId) return
    
    try {
      const foodData: Omit<FoodLog, 'id' | 'logged_at' | 'created_at'> = {
        user_id: currentUserId,
        name: food.name,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fats: food.fats,
        portion: food.portion,
        meal_type: selectedMeal
      }

      const { data, error } = await supabase
        .from('food_logs')
        .insert([foodData])
        .select()
        .single()

      if (error) throw error

      // Add to local state with database ID
      const newFood: FoodItem = {
        id: data.id.toString(),
        name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        portion: data.portion
      }
      
      setMealLogs(prev => ({
        ...prev,
        [selectedMeal]: [...prev[selectedMeal], newFood]
      }))

      // Refresh recent foods to include this new addition
      if (currentUserId) {
        await loadRecentFoods(currentUserId)
      }

      toast({
        title: "Success",
        description: "Food added successfully!",
      })
    } catch (error) {
      console.error('Error adding food:', error)
      toast({
        title: "Error",
        description: "Failed to add food. Please try again.",
        variant: "destructive",
      })
    }
  }

  const removeFoodFromMeal = async (mealType: keyof MealLog, foodId: string) => {
    try {
      const { error } = await supabase
        .from('food_logs')
        .delete()
        .eq('id', parseInt(foodId))

      if (error) throw error

      // Remove from local state
      setMealLogs(prev => ({
        ...prev,
        [mealType]: prev[mealType].filter(food => food.id !== foodId)
      }))

      toast({
        title: "Success",
        description: "Food removed successfully!",
      })
    } catch (error) {
      console.error('Error removing food:', error)
      toast({
        title: "Error",
        description: "Failed to remove food. Please try again.",
        variant: "destructive",
      })
    }
  }

  const addManualFood = async () => {
    // Validate required fields
    if (!manualFood.name.trim() || !manualFood.calories.trim() || !currentUserId) {
      toast({
        title: "Validation Error",
        description: "Please enter a food name and calories.",
        variant: "destructive",
      })
      return
    }
    
    // Parse and validate numeric values
    const calories = parseInt(manualFood.calories)
    const protein = manualFood.protein ? parseFloat(manualFood.protein) : 0
    const carbs = manualFood.carbs ? parseFloat(manualFood.carbs) : 0
    const fats = manualFood.fats ? parseFloat(manualFood.fats) : 0
    
    // Check for invalid numbers and ranges (based on database constraints)
    if (isNaN(calories) || calories <= 0 || calories > 2000000000) {
      toast({
        title: "Value Out of Range",
        description: "Calories must be between 1 and 2,000,000,000. Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }
    
    if (isNaN(protein) || protein < 0 || protein > 999.99) {
      toast({
        title: "Value Out of Range",
        description: "Protein must be between 0 and 999.99 grams. Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }
    
    if (isNaN(carbs) || carbs < 0 || carbs > 999.99) {
      toast({
        title: "Value Out of Range",
        description: "Carbs must be between 0 and 999.99 grams. Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }
    
    if (isNaN(fats) || fats < 0 || fats > 999.99) {
      toast({
        title: "Value Out of Range",
        description: "Fats must be between 0 and 999.99 grams. Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }
    
    try {
      const foodData: Omit<FoodLog, 'id' | 'logged_at' | 'created_at'> = {
        user_id: currentUserId,
        name: manualFood.name.trim(),
        calories: Math.round(calories),
        protein: Math.round(protein * 10) / 10, // Round to 1 decimal place
        carbs: Math.round(carbs * 10) / 10,
        fats: Math.round(fats * 10) / 10,
        portion: manualFood.portion.trim() || "1 serving",
        meal_type: selectedMeal
      }

      const { data, error } = await supabase
        .from('food_logs')
        .insert([foodData])
        .select()
        .single()

      if (error) throw error

      // Add to local state
      const newFood: FoodItem = {
        id: data.id.toString(),
        name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        portion: data.portion
      }
      
      setMealLogs(prev => ({
        ...prev,
        [selectedMeal]: [...prev[selectedMeal], newFood]
      }))

      // Refresh recent foods to include this new addition
      if (currentUserId) {
        await loadRecentFoods(currentUserId)
      }

      setManualFood({ name: "", calories: "", protein: "", carbs: "", fats: "", portion: "" })
      setIsManualEntry(false)
      
      toast({
        title: "Success",
        description: "Food added successfully!",
      })
    } catch (error) {
      console.error('Error adding food:', error)
      toast({
        title: "Error",
        description: "Failed to add food. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Edit food functions
  const parseQuantityFromPortion = (portion: string): number => {
    // Extract number from portion string (e.g., "150g" -> 150, "2 cups" -> 2)
    const match = portion.match(/(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 100; // Default to 100 if no number found
  }

  const calculateNutritionPer100g = (food: FoodItem): { calories: number, protein: number, carbs: number, fats: number } => {
    const currentQuantity = parseQuantityFromPortion(food.portion)
    // Calculate nutrition per 100g based on current portion
    const factor = 100 / currentQuantity
    return {
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor * 10) / 10,
      carbs: Math.round(food.carbs * factor * 10) / 10,
      fats: Math.round(food.fats * factor * 10) / 10
    }
  }

  const recalculateNutritionFromPortion = (newPortion: string) => {
    const newQuantity = parseQuantityFromPortion(newPortion)
    const factor = newQuantity / 100 // Calculate factor from per-100g values
    
    setEditFood(prev => ({
      ...prev,
      portion: newPortion,
      calories: Math.round(originalNutritionPer100g.calories * factor).toString(),
      protein: (Math.round(originalNutritionPer100g.protein * factor * 10) / 10).toString(),
      carbs: (Math.round(originalNutritionPer100g.carbs * factor * 10) / 10).toString(),
      fats: (Math.round(originalNutritionPer100g.fats * factor * 10) / 10).toString()
    }))
  }

  const handleEditFood = (food: FoodItem, mealType: keyof MealLog) => {
    setEditingFood(food)
    setEditingMealType(mealType)
    
    // Calculate and store original nutrition per 100g
    const nutritionPer100g = calculateNutritionPer100g(food)
    setOriginalNutritionPer100g(nutritionPer100g)
    
    setEditFood({
      name: food.name,
      calories: food.calories.toString(),
      protein: food.protein.toString(),
      carbs: food.carbs.toString(),
      fats: food.fats.toString(),
      portion: food.portion
    })
    setIsEditDialogOpen(true)
  }

  const updateFoodLog = async () => {
    if (!editingFood || !editingMealType || !currentUserId) return

    // Validate required fields
    if (!editFood.name.trim() || !editFood.calories.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a food name and calories.",
        variant: "destructive",
      })
      return
    }

    // Parse and validate numeric values
    const calories = parseInt(editFood.calories)
    const protein = editFood.protein ? parseFloat(editFood.protein) : 0
    const carbs = editFood.carbs ? parseFloat(editFood.carbs) : 0
    const fats = editFood.fats ? parseFloat(editFood.fats) : 0

    // Check for invalid numbers and ranges (based on database constraints)
    if (isNaN(calories) || calories <= 0 || calories > 2000000000) {
      toast({
        title: "Value Out of Range",
        description: "Calories must be between 1 and 2,000,000,000. Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }

    if (isNaN(protein) || protein < 0 || protein > 999.99) {
      toast({
        title: "Value Out of Range",
        description: "Protein must be between 0 and 999.99 grams. Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }

    if (isNaN(carbs) || carbs < 0 || carbs > 999.99) {
      toast({
        title: "Value Out of Range",
        description: "Carbs must be between 0 and 999.99 grams. Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }

    if (isNaN(fats) || fats < 0 || fats > 999.99) {
      toast({
        title: "Value Out of Range",
        description: "Fats must be between 0 and 999.99 grams. Please enter a valid amount.",
        variant: "destructive",
      })
      return
    }

    try {
      const updatedFoodData = {
        name: editFood.name.trim(),
        calories: Math.round(calories),
        protein: Math.round(protein * 10) / 10,
        carbs: Math.round(carbs * 10) / 10,
        fats: Math.round(fats * 10) / 10,
        portion: editFood.portion.trim() || "1 serving"
      }

      const { data, error } = await supabase
        .from('food_logs')
        .update(updatedFoodData)
        .eq('id', parseInt(editingFood.id))
        .select()
        .single()

      if (error) throw error

      // Update local state
      const updatedFood: FoodItem = {
        id: editingFood.id,
        name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fats: data.fats,
        portion: data.portion
      }

      setMealLogs(prev => ({
        ...prev,
        [editingMealType]: prev[editingMealType].map(food => 
          food.id === editingFood.id ? updatedFood : food
        )
      }))

      // Refresh recent foods
      if (currentUserId) {
        await loadRecentFoods(currentUserId)
      }

      // Reset edit states
      setIsEditDialogOpen(false)
      setEditingFood(null)
      setEditingMealType(null)
      setEditFood({
        name: "",
        calories: "",
        protein: "",
        carbs: "",
        fats: "",
        portion: ""
      })

      toast({
        title: "Success",
        description: "Food updated successfully!",
      })
    } catch (error) {
      console.error('Error updating food:', error)
      toast({
        title: "Error",
        description: "Failed to update food. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getMealTotal = (meal: FoodItem[]) => {
    return meal.reduce((total, food) => ({
      calories: total.calories + food.calories,
      protein: total.protein + food.protein,
      carbs: total.carbs + food.carbs,
      fats: total.fats + food.fats
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 })
  }

  // Calculate daily totals from all meals
  const getDailyTotals = () => {
    const allMeals = [...mealLogs.breakfast, ...mealLogs.lunch, ...mealLogs.dinner, ...mealLogs.snacks]
    return allMeals.reduce((total, food) => ({
      calories: total.calories + food.calories,
      protein: total.protein + food.protein,
      carbs: total.carbs + food.carbs,
      fats: total.fats + food.fats
    }), { calories: 0, protein: 0, carbs: 0, fats: 0 })
  }

  const dailyTotals = getDailyTotals()

  const getRemainingAmount = (current: number, target: number) => {
    return Math.max(target - current, 0)
  }

  const nutritionData = [
    {
      name: "Calories",
      current: dailyTotals.calories,
      target: dailyTargets.calories,
      unit: "kcal",
      icon: Zap,
      color: "text-emerald-500",
      strokeColor: "#10b981"
    },
    {
      name: "Protein",
      current: dailyTotals.protein,
      target: dailyTargets.protein,
      unit: "g",
      icon: Beef,
      color: "text-rose-500",
      strokeColor: "#f43f5e"
    },
    {
      name: "Carbs",
      current: dailyTotals.carbs,
      target: dailyTargets.carbs,
      unit: "g",
      icon: Wheat,
      color: "text-amber-500",
      strokeColor: "#f59e0b"
    },
    {
      name: "Fats",
      current: dailyTotals.fats,
      target: dailyTargets.fats,
      unit: "g",
      icon: Droplets,
      color: "text-sky-500",
      strokeColor: "#0ea5e9"
    }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-50/30 dark:to-emerald-950/20">
        <div className="container mx-auto p-4 pb-20">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">
                Food Logging
              </h1>
              <p className="text-muted-foreground">Loading your nutrition data...</p>
            </div>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading your food logs...</p>
            </div>
          </div>
        </div>
        <Navigation />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-50/30 dark:to-emerald-950/20">
      <div className="container mx-auto p-4 pb-20">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">
              Food Logging
            </h1>
            <p className="text-muted-foreground">Track your meals and nutrition</p>
          </div>
          <ThemeToggle />
        </div>

        {/* Today's Progress Overview */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg border-emerald-100 dark:border-emerald-900/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300">
              <Target className="h-5 w-5" />
              <span>Today's Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {nutritionData.map((item, index) => {
                const ItemIcon = item.icon
                const percentage = Math.min((item.current / item.target) * 100, 100)
                const remaining = getRemainingAmount(item.current, item.target)
                return (
                  <div key={index} className="flex flex-col items-center space-y-3">
                    <CircularProgress
                      value={item.current}
                      max={item.target}
                      color={item.strokeColor}
                      size={90}
                    >
                      <div className="text-center">
                        <ItemIcon className={`h-5 w-5 ${item.color} mx-auto mb-1`} />
                        <div className="text-xs font-bold">{Math.round(percentage)}%</div>
                      </div>
                    </CircularProgress>
                    <div className="text-center">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(item.current)}/{item.target} {item.unit}
                      </p>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {remaining} {item.unit} left
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Tabs value={selectedMeal} onValueChange={(value) => setSelectedMeal(value as keyof MealLog)} className="mb-6">
          <TabsList className="grid w-full grid-cols-4 bg-emerald-50 dark:bg-emerald-950/50">
            {Object.entries(mealIcons).map(([meal, Icon]) => (
              <TabsTrigger key={meal} value={meal} className="flex items-center space-x-2 data-[state=active]:bg-emerald-100 dark:data-[state=active]:bg-emerald-900/50">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline capitalize">{meal}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(mealLogs).map(([mealType, foods]) => {
            const MealIcon = mealIcons[mealType as keyof typeof mealIcons]
            const totals = getMealTotal(foods)
            
            return (
              <TabsContent key={mealType} value={mealType}>
                <Card className="transition-all duration-300 hover:shadow-lg border-slate-100 dark:border-slate-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <MealIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <CardTitle className="capitalize text-slate-700 dark:text-slate-300">{mealType}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
                          {totals.calories} cal
                        </Badge>
                        <Badge variant="outline" className="border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                          {totals.protein}g protein
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {foods.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Apple className="h-12 w-12 mx-auto mb-4 opacity-50 text-emerald-400" />
                        <p>No foods logged for {mealType} yet</p>
                        <p className="text-sm">Add foods using the search below</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {foods.map((food) => (
                          <div key={food.id} className="flex items-center justify-between p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg transition-all duration-200 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30">
                            <div className="flex-1">
                              <h4 className="font-medium">{food.name}</h4>
                              <p className="text-sm text-muted-foreground">{food.portion}</p>
                              <div className="flex space-x-4 text-xs text-muted-foreground mt-1">
                                <span className="text-emerald-600 dark:text-emerald-400">{food.calories} cal</span>
                                <span className="text-rose-600 dark:text-rose-400">{food.protein}g protein</span>
                                <span className="text-amber-600 dark:text-amber-400">{food.carbs}g carbs</span>
                                <span className="text-sky-600 dark:text-sky-400">{food.fats}g fats</span>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 hover:scale-110 transition-transform hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                                onClick={() => handleEditFood(food, mealType as keyof MealLog)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 text-destructive hover:text-destructive/80 hover:scale-110 transition-all hover:bg-red-50 dark:hover:bg-red-950/50"
                                onClick={() => removeFoodFromMeal(mealType as keyof MealLog, food.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )
          })}
        </Tabs>

        {/* Food Search */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg border-sky-100 dark:border-sky-900/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-sky-700 dark:text-sky-300">
              <Search className="h-5 w-5" />
              <span>Add Food</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="usda" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="usda" className="flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>USDA Database</span>
                </TabsTrigger>
                <TabsTrigger value="manual" className="flex items-center space-x-2">
                  <ChefHat className="h-4 w-4" />
                  <span>Manual Entry</span>
                </TabsTrigger>
                <TabsTrigger value="scan" className="flex items-center space-x-2">
                  <Scan className="h-4 w-4" />
                  <span>Barcode Scan</span>
                </TabsTrigger>
              </TabsList>

              {/* USDA Database Search */}
              <TabsContent value="usda" className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search USDA food database..."
                    value={usdaSearchQuery}
                    onChange={(e) => {
                      setUsdaSearchQuery(e.target.value)
                      searchUsdaFoods(e.target.value)
                    }}
                    className="pl-10 transition-all duration-200 focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 border-emerald-200 dark:border-emerald-800"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>

                {usdaSearchResults.length > 0 && (
                  <div className="space-y-2 animate-fade-in">
                    <h3 className="font-semibold text-sm text-muted-foreground">
                      USDA Food Database Results ({usdaSearchResults.length})
                    </h3>
                    {usdaSearchResults.map((food) => (
                      <div key={food.fdcId} className="flex items-center justify-between p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg transition-all duration-200 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/30">
                        <div className="flex-1">
                          <h4 className="font-medium">{usdaFoodService.formatFoodName(food)}</h4>
                          <p className="text-sm text-muted-foreground">
                            {usdaFoodService.getFoodType(food)}
                          </p>
                          {food.foodNutrients && food.foodNutrients.length > 0 && (
                            <div className="flex space-x-4 text-xs text-muted-foreground mt-1">
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {Math.round(food.foodNutrients.find(n => n.nutrientId === 1008)?.value || 0)} cal/100g
                              </span>
                              <span className="text-rose-600 dark:text-rose-400">
                                {Math.round((food.foodNutrients.find(n => n.nutrientId === 1003)?.value || 0) * 10) / 10}g protein
                              </span>
                              <span className="text-amber-600 dark:text-amber-400">
                                {Math.round((food.foodNutrients.find(n => n.nutrientId === 1005)?.value || 0) * 10) / 10}g carbs
                              </span>
                              <span className="text-sky-600 dark:text-sky-400">
                                {Math.round((food.foodNutrients.find(n => n.nutrientId === 1004)?.value || 0) * 10) / 10}g fats
                              </span>
                            </div>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => handleUsdaFoodSelect(food)}
                          className="hover:scale-105 transition-transform"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {usdaSearchQuery && !isSearching && usdaSearchResults.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No foods found for "{usdaSearchQuery}"</p>
                    <p className="text-sm">Try a different search term</p>
                  </div>
                )}
              </TabsContent>

              {/* Manual Entry */}
              <TabsContent value="manual" className="space-y-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Food Name</Label>
                      <Input
                        value={manualFood.name}
                        onChange={(e) => setManualFood(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter food name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Portion Size</Label>
                      <Input
                        value={manualFood.portion}
                        onChange={(e) => setManualFood(prev => ({ ...prev, portion: e.target.value }))}
                        placeholder="1 serving, 100g, etc."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Calories (kcal)</Label>
                      <Input
                        type="number"
                        value={manualFood.calories}
                        onChange={(e) => setManualFood(prev => ({ ...prev, calories: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Protein (g)</Label>
                      <Input
                        type="number"
                        value={manualFood.protein}
                        onChange={(e) => setManualFood(prev => ({ ...prev, protein: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Carbs (g)</Label>
                      <Input
                        type="number"
                        value={manualFood.carbs}
                        onChange={(e) => setManualFood(prev => ({ ...prev, carbs: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Fats (g)</Label>
                      <Input
                        type="number"
                        value={manualFood.fats}
                        onChange={(e) => setManualFood(prev => ({ ...prev, fats: e.target.value }))}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={addManualFood} className="hover:scale-105 transition-transform">
                      Add Food
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* Barcode Scan */}
              <TabsContent value="scan" className="space-y-4">
                <div className="text-center py-8 text-muted-foreground">
                  <Scan className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Barcode scanning coming soon!</p>
                  <p className="text-sm">This feature will be available in a future update</p>
                </div>
              </TabsContent>
            </Tabs>



            {/* Recent Foods for Selected Meal */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm text-muted-foreground">
                  Recent {selectedMeal.charAt(0).toUpperCase() + selectedMeal.slice(1)} Foods
                </h3>
              </div>
              {recentFoods[selectedMeal].length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {recentFoods[selectedMeal].map((food) => (
                    <Button
                      key={food.id}
                      variant="outline"
                      className="h-auto p-3 justify-start hover:scale-105 transition-transform border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                      onClick={() => handleRecentFoodClick(food)}
                    >
                      <div className="text-left">
                        <p className="font-medium text-sm">{food.name}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400">{food.calories} cal</p>
                        <p className="text-xs text-muted-foreground">{food.portion}</p>
                      </div>
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No recent {selectedMeal} foods found</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Add Food Confirmation Dialog */}
      <Dialog open={showAddFoodDialog} onOpenChange={setShowAddFoodDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Food to {selectedMeal.charAt(0).toUpperCase() + selectedMeal.slice(1)}</DialogTitle>
            <DialogDescription>
              Do you want to add this food to your {selectedMeal} meal?
            </DialogDescription>
          </DialogHeader>
          {selectedRecentFood && (
            <div className="py-4">
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-lg">
                <h4 className="font-medium text-lg">{selectedRecentFood.name}</h4>
                <p className="text-sm text-muted-foreground mb-2">{selectedRecentFood.portion}</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span>Calories:</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{selectedRecentFood.calories}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Protein:</span>
                    <span className="font-medium text-rose-600 dark:text-rose-400">{selectedRecentFood.protein}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Carbs:</span>
                    <span className="font-medium text-amber-600 dark:text-amber-400">{selectedRecentFood.carbs}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fats:</span>
                    <span className="font-medium text-sky-600 dark:text-sky-400">{selectedRecentFood.fats}g</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFoodDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAddRecentFood} className="hover:scale-105 transition-transform">
              Yes, Add Food
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* USDA Food Quantity Selection Dialog */}
      <Dialog open={showQuantityDialog} onOpenChange={setShowQuantityDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Choose Quantity</DialogTitle>
            <DialogDescription>
              Select the quantity for {selectedUsdaFood ? usdaFoodService.formatFoodName(selectedUsdaFood) : "this food"}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUsdaFood && (
            <div className="space-y-6">
              {/* Food Info */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-lg">
                <h4 className="font-medium text-lg">{usdaFoodService.formatFoodName(selectedUsdaFood)}</h4>
                <p className="text-sm text-muted-foreground">{usdaFoodService.getFoodType(selectedUsdaFood)}</p>
              </div>

              {/* Quantity Input */}
              <div className="space-y-2">
                <Label className="text-base font-medium">Quantity (grams)</Label>
                <Input
                  type="number"
                  placeholder="Enter quantity in grams"
                  value={customQuantity}
                  onChange={(e) => handleCustomQuantityChange(e.target.value)}
                  className="w-full text-lg"
                  min="1"
                  step="1"
                />
                <p className="text-sm text-muted-foreground">
                  Enter the amount in grams (e.g., 100 for 100 grams)
                </p>
              </div>

              {/* Calculated Nutrition Preview */}
              {calculatedNutrition && customQuantity && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-medium">Nutrition Information</h3>
                    <Badge variant="outline" className="text-xs">
                      {customQuantity}g
                    </Badge>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span>Calories:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {calculatedNutrition.calories}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Protein:</span>
                        <span className="font-medium text-rose-600 dark:text-rose-400">
                          {calculatedNutrition.protein}g
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Carbs:</span>
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {calculatedNutrition.carbs}g
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fats:</span>
                        <span className="font-medium text-sky-600 dark:text-sky-400">
                          {calculatedNutrition.fats}g
                        </span>
                      </div>
                      {calculatedNutrition.fiber && calculatedNutrition.fiber > 0 && (
                        <div className="flex justify-between">
                          <span>Fiber:</span>
                          <span className="font-medium text-green-600 dark:text-green-400">
                            {calculatedNutrition.fiber}g
                          </span>
                        </div>
                      )}
                      {calculatedNutrition.sugar && calculatedNutrition.sugar > 0 && (
                        <div className="flex justify-between">
                          <span>Sugar:</span>
                          <span className="font-medium text-orange-600 dark:text-orange-400">
                            {calculatedNutrition.sugar}g
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuantityDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={addUsdaFoodToMeal} 
              disabled={!customQuantity || !calculatedNutrition || parseFloat(customQuantity) <= 0}
              className="hover:scale-105 transition-transform"
            >
              Add to {selectedMeal.charAt(0).toUpperCase() + selectedMeal.slice(1)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Food Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Food</DialogTitle>
            <DialogDescription>
              Update the details for {editingFood?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Food Name</Label>
                <Input
                  value={editFood.name}
                  onChange={(e) => setEditFood(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter food name"
                />
              </div>
                             <div className="space-y-2">
                 <Label>Portion Size</Label>
                 <Input
                   value={editFood.portion}
                   onChange={(e) => recalculateNutritionFromPortion(e.target.value)}
                   placeholder="1 serving, 100g, etc."
                 />
                 <p className="text-xs text-muted-foreground">
                   Change quantity to auto-calculate nutrition (e.g., "150g", "2 cups")
                 </p>
               </div>
            </div>
                         <div className="space-y-2">
               <div className="flex items-center space-x-2 mb-2">
                 <Label className="text-sm font-medium">Nutrition Values</Label>
                 <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
                   Auto-calculated from portion
                 </Badge>
               </div>
               <div className="grid grid-cols-4 gap-4">
                 <div className="space-y-2">
                   <Label className="text-sm">Calories (kcal)</Label>
                   <Input
                     type="number"
                     value={editFood.calories}
                     onChange={(e) => setEditFood(prev => ({ ...prev, calories: e.target.value }))}
                     placeholder="0"
                     className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-sm">Protein (g)</Label>
                   <Input
                     type="number"
                     value={editFood.protein}
                     onChange={(e) => setEditFood(prev => ({ ...prev, protein: e.target.value }))}
                     placeholder="0"
                     className="bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-sm">Carbs (g)</Label>
                   <Input
                     type="number"
                     value={editFood.carbs}
                     onChange={(e) => setEditFood(prev => ({ ...prev, carbs: e.target.value }))}
                     placeholder="0"
                     className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-sm">Fats (g)</Label>
                   <Input
                     type="number"
                     value={editFood.fats}
                     onChange={(e) => setEditFood(prev => ({ ...prev, fats: e.target.value }))}
                     placeholder="0"
                     className="bg-sky-50/50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800"
                   />
                 </div>
               </div>
               <p className="text-xs text-muted-foreground mt-2">
                 💡 Tip: Change the portion size above to automatically recalculate these values, or edit them manually
               </p>
             </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updateFoodLog} className="hover:scale-105 transition-transform">
              Update Food
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Navigation />
    </div>
  )
}

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress as ProgressBar } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts"
import { 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  Trophy,
  Target,
  Droplets,
  Zap,
  Beef,
  Wheat,
  Scale
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Navigation from "@/components/Navigation"
import { supabase, type WeightLog, type FoodLog, type WaterLog, type NutritionPlan } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useNavigate } from "react-router-dom"
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns"

interface WeightChartData {
  date: string
  weight: number
  formattedDate: string
  estimatedWeight?: number
  actualWeight?: number
  targetWeight?: number
}

interface DailyNutritionData {
  day: string
  date: string
  calories: number
  protein: number
  carbs: number
  fats: number
  water: number
}

interface WeeklyGoalCompletion {
  calories: number
  protein: number
  carbs: number
  fats: number
  water: number
}

interface ProgressMetrics {
  weightChange: number
  weightChangeUnit: string
  currentStreak: number
  avgGoalCompletion: number
}

export default function Progress() {
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [weightData, setWeightData] = useState<WeightChartData[]>([])
  const [dailyNutritionData, setDailyNutritionData] = useState<DailyNutritionData[]>([])
  const [weeklyGoalCompletion, setWeeklyGoalCompletion] = useState<WeeklyGoalCompletion>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    water: 0
  })
  const [progressMetrics, setProgressMetrics] = useState<ProgressMetrics>({
    weightChange: 0,
    weightChangeUnit: 'lbs',
    currentStreak: 0,
    avgGoalCompletion: 0
  })
  const [nutritionPlan, setNutritionPlan] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)

  const { toast } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    loadProgressData()
  }, [])

  const loadProgressData = async () => {
    try {
      setIsLoading(true)
      
      // Get current user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (userError) {
        if (userError.code === 'PGRST116') {
          navigate('/onboarding')
          return
        }
        throw userError
      }

      setCurrentUserId(userData.id)

      // Load data in sequence to ensure dependencies are met
      const userProfileData = await loadUserProfile(userData.id)
      const nutritionPlanData = await loadNutritionPlan(userData.id)
      await loadWeightProgressWithEstimates(userData.id, userProfileData, nutritionPlanData)
      const weeklyCompletion = await loadWeeklyNutritionData(userData.id, nutritionPlanData)
      await calculateProgressMetrics(userData.id, weeklyCompletion)

    } catch (error) {
      console.error('Error loading progress data:', error)
      toast({
        title: "Error",
        description: "Failed to load progress data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadUserProfile = async (userId: number) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      setUserProfile(data)
      return data
    } catch (error) {
      console.error('Error loading user profile:', error)
      return null
    }
  }

  const loadWeightProgressWithEstimates = async (userId: number, userProfileData: any, nutritionPlanData: any) => {
    try {
      const { data: weightLogs, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_date', { ascending: true })

      if (error) throw error

      // Generate estimated weight progression
      const estimatedData = generateEstimatedWeightProgression(userProfileData, nutritionPlanData)
      
      // Combine actual weight logs with estimated progression
      const combinedData = mergeActualAndEstimatedData(weightLogs || [], estimatedData)
      
      setWeightData(combinedData)
    } catch (error) {
      console.error('Error loading weight progress:', error)
    }
  }

  const generateEstimatedWeightProgression = (userProfile: any, nutritionPlan: any) => {
    if (!userProfile || !nutritionPlan || !userProfile.target_weight) return []

    const startWeight = parseFloat(userProfile.weight)
    const targetWeight = parseFloat(userProfile.target_weight)
    const planCreatedDate = new Date(nutritionPlan.created_at)
    const currentDate = new Date()
    
    // Calculate weekly weight change based on caloric deficit/surplus
    // For weight loss: deficit = TDEE - target_calories (positive = deficit)
    // For muscle gain: surplus = target_calories - TDEE (positive = surplus)
    let dailyCalorieChange
    if (userProfile.primary_goal === 'weight-loss') {
      dailyCalorieChange = nutritionPlan.tdee - nutritionPlan.target_calories // deficit (positive)
      dailyCalorieChange = -dailyCalorieChange // negative for weight loss
    } else if (userProfile.primary_goal === 'muscle-gain') {
      dailyCalorieChange = nutritionPlan.target_calories - nutritionPlan.tdee // surplus (positive)
      // positive for weight gain
    } else {
      dailyCalorieChange = 0 // maintenance
    }
    
    // 1 pound ≈ 3500 calories, so weekly change = (daily change * 7) / 3500
    const weeklyWeightChange = (dailyCalorieChange * 7) / 3500 // in pounds
    
    // Convert to user's weight unit if needed
    const isKg = userProfile.weight_unit === 'kg'
    let weeklyChangeInUserUnit = isKg ? weeklyWeightChange * 0.453592 : weeklyWeightChange
    
    // Ensure we have a meaningful weight change rate
    if (Math.abs(weeklyChangeInUserUnit) < 0.01) {
      // If virtually no change expected, set a minimal rate based on goal
      if (userProfile.primary_goal === 'weight-loss') {
        weeklyChangeInUserUnit = isKg ? -0.1 : -0.2 // 0.1kg or 0.2lbs loss per week
      } else if (userProfile.primary_goal === 'muscle-gain') {
        weeklyChangeInUserUnit = isKg ? 0.1 : 0.2 // 0.1kg or 0.2lbs gain per week
      } else {
        weeklyChangeInUserUnit = 0 // maintenance
      }
    }
    

    
    // Calculate estimated timeline based on goal
    const totalWeightChange = Math.abs(targetWeight - startWeight)
    const estimatedWeeksToGoal = Math.max(1, Math.ceil(totalWeightChange / Math.abs(weeklyChangeInUserUnit)))
    
    // Generate data points from plan creation to estimated completion + buffer
    const estimatedData: WeightChartData[] = []
    const bufferWeeks = 4 // Add 4 weeks buffer after estimated completion
    const totalWeeks = estimatedWeeksToGoal + bufferWeeks
    
    // Always start with the starting weight at plan creation date
    estimatedData.push({
      date: planCreatedDate.toISOString().split('T')[0],
      weight: startWeight,
      estimatedWeight: startWeight,
      targetWeight: targetWeight,
      formattedDate: format(planCreatedDate, 'MMM d')
    })
    
    // Generate weekly data points
    for (let week = 1; week <= totalWeeks; week++) {
      const currentWeekDate = new Date(planCreatedDate)
      currentWeekDate.setDate(currentWeekDate.getDate() + (week * 7))
      
      // Calculate estimated weight for this week
      // weeklyChangeInUserUnit already has the correct direction (negative for loss, positive for gain)
      let estimatedWeight = startWeight + (weeklyChangeInUserUnit * week)
      
      // Clamp to target weight once reached
      if (userProfile.primary_goal === 'weight-loss') {
        estimatedWeight = Math.max(estimatedWeight, targetWeight) // Don't go below target
      } else if (userProfile.primary_goal === 'muscle-gain') {
        estimatedWeight = Math.min(estimatedWeight, targetWeight) // Don't go above target
      }
      
      // Continue showing data points (extend chart timeline as needed)
      estimatedData.push({
        date: currentWeekDate.toISOString().split('T')[0],
        weight: estimatedWeight,
        estimatedWeight: estimatedWeight,
        targetWeight: targetWeight,
        formattedDate: format(currentWeekDate, 'MMM d')
      })
    }
    
    return estimatedData
  }

  const mergeActualAndEstimatedData = (actualLogs: WeightLog[], estimatedData: WeightChartData[]) => {
    // Create a map of dates for efficient lookup
    const dateMap = new Map<string, WeightChartData>()
    
    // Add estimated data first
    estimatedData.forEach(data => {
      dateMap.set(data.date, data)
    })
    
    // Get target weight for extending data
    const targetWeight = estimatedData.length > 0 ? estimatedData[0].targetWeight : undefined
    
    // Add actual weight logs
    actualLogs.forEach(log => {
      const dateKey = log.logged_date
      const existing = dateMap.get(dateKey)
      
      if (existing) {
        // Update existing entry with actual weight
        dateMap.set(dateKey, {
          ...existing,
          weight: log.weight,
          actualWeight: log.weight
        })
      } else {
        // Create new entry for actual weight (extend timeline if needed)
        dateMap.set(dateKey, {
          date: dateKey,
          weight: log.weight,
          actualWeight: log.weight,
          targetWeight: targetWeight,
          formattedDate: format(new Date(dateKey), 'MMM d')
        })
      }
    })
    
    // If we have actual logs that extend beyond estimated data, extend the estimated line
    if (actualLogs.length > 0 && estimatedData.length > 0) {
      const latestActualDate = new Date(Math.max(...actualLogs.map(log => new Date(log.logged_date).getTime())))
      const latestEstimatedDate = new Date(Math.max(...estimatedData.map(data => new Date(data.date).getTime())))
      
      // If actual logs go beyond estimated timeline, extend the estimated line
      if (latestActualDate > latestEstimatedDate) {
        const lastEstimatedPoint = estimatedData[estimatedData.length - 1]
        const daysDiff = Math.ceil((latestActualDate.getTime() - latestEstimatedDate.getTime()) / (1000 * 60 * 60 * 24))
        
        // Extend estimated line with flat target weight
        for (let day = 1; day <= daysDiff; day++) {
          const extendedDate = new Date(latestEstimatedDate)
          extendedDate.setDate(extendedDate.getDate() + day)
          
          const extendedDateKey = extendedDate.toISOString().split('T')[0]
          
          // Only add if we don't already have data for this date
          if (!dateMap.has(extendedDateKey)) {
            dateMap.set(extendedDateKey, {
              date: extendedDateKey,
              weight: lastEstimatedPoint.estimatedWeight || lastEstimatedPoint.weight,
              estimatedWeight: lastEstimatedPoint.estimatedWeight || lastEstimatedPoint.weight,
              targetWeight: targetWeight,
              formattedDate: format(extendedDate, 'MMM d')
            })
          }
        }
      }
    }
    
    // Convert back to array and sort by date
    const sortedData = Array.from(dateMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    

    
    return sortedData
  }

  const loadNutritionPlan = async (userId: number) => {
    try {
      const { data, error } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) throw error

      setNutritionPlan(data)
      return data
    } catch (error) {
      console.error('Error loading nutrition plan:', error)
      return null
    }
  }

  const loadWeeklyNutritionData = async (userId: number, nutritionPlanData: any = null) => {
    try {
      const now = new Date()
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
      
      // Get all days in the current week
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
      
      // Load food logs for the week
      const { data: foodLogs, error: foodError } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', weekStart.toISOString())
        .lte('logged_at', weekEnd.toISOString())

      if (foodError) throw foodError

      // Load water logs for the week
      const { data: waterLogs, error: waterError } = await supabase
        .from('water_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', weekStart.toISOString())
        .lte('logged_at', weekEnd.toISOString())

      if (waterError) throw waterError

      // Process daily data
      const dailyData: DailyNutritionData[] = weekDays.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd')
        
        // Filter logs for this day
        const dayFoodLogs = foodLogs?.filter(log => 
          isSameDay(new Date(log.logged_at || log.created_at), day)
        ) || []
        
        const dayWaterLogs = waterLogs?.filter(log => 
          isSameDay(new Date(log.logged_at || log.created_at), day)
        ) || []

        // Calculate totals for the day
        const dailyTotals = dayFoodLogs.reduce((acc, log) => ({
          calories: acc.calories + log.calories,
          protein: acc.protein + log.protein,
          carbs: acc.carbs + log.carbs,
          fats: acc.fats + log.fats
        }), { calories: 0, protein: 0, carbs: 0, fats: 0 })

        const dailyWater = dayWaterLogs.reduce((acc, log) => acc + log.amount_ml, 0) / 1000 // Convert to liters

        return {
          day: format(day, 'EEE'), // Mon, Tue, etc.
          date: dayStr,
          calories: dailyTotals.calories,
          protein: Math.round(dailyTotals.protein * 10) / 10,
          carbs: Math.round(dailyTotals.carbs * 10) / 10,
          fats: Math.round(dailyTotals.fats * 10) / 10,
          water: Math.round(dailyWater * 10) / 10
        }
      })

      setDailyNutritionData(dailyData)

      // Calculate weekly goal completion
      if (nutritionPlanData) {
        const weeklyTotals = dailyData.reduce((acc, day) => ({
          calories: acc.calories + day.calories,
          protein: acc.protein + day.protein,
          carbs: acc.carbs + day.carbs,
          fats: acc.fats + day.fats,
          water: acc.water + day.water
        }), { calories: 0, protein: 0, carbs: 0, fats: 0, water: 0 })

        const weeklyTargets = {
          calories: nutritionPlanData.target_calories * 7,
          protein: nutritionPlanData.protein_grams * 7,
          carbs: nutritionPlanData.carbs_grams * 7,
          fats: nutritionPlanData.fats_grams * 7,
          water: (nutritionPlanData.water_target / 1000) * 7 // Convert to liters
        }

        const completion = {
          calories: weeklyTargets.calories > 0 ? Math.min(Math.round((weeklyTotals.calories / weeklyTargets.calories) * 100), 100) : 0,
          protein: weeklyTargets.protein > 0 ? Math.min(Math.round((weeklyTotals.protein / weeklyTargets.protein) * 100), 100) : 0,
          carbs: weeklyTargets.carbs > 0 ? Math.min(Math.round((weeklyTotals.carbs / weeklyTargets.carbs) * 100), 100) : 0,
          fats: weeklyTargets.fats > 0 ? Math.min(Math.round((weeklyTotals.fats / weeklyTargets.fats) * 100), 100) : 0,
          water: weeklyTargets.water > 0 ? Math.min(Math.round((weeklyTotals.water / weeklyTargets.water) * 100), 100) : 0
        }

        setWeeklyGoalCompletion(completion)
        
        // Return completion for progress metrics calculation
        return completion
      }

    } catch (error) {
      console.error('Error loading weekly nutrition data:', error)
      return null
    }
  }

  const calculateProgressMetrics = async (userId: number, weeklyCompletion: WeeklyGoalCompletion | null) => {
    try {
      // Weight change calculation
      const { data: recentWeights, error: weightError } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_date', { ascending: false })
        .limit(2)

      let weightChange = 0
      let weightChangeUnit = 'lbs'
      
      if (recentWeights && recentWeights.length >= 2) {
        const latest = recentWeights[0]
        const previous = recentWeights[1]
        weightChange = latest.weight - previous.weight
        weightChangeUnit = latest.weight_unit
      }

      // Calculate current streak (days with food logs)
      let streak = 0
      const today = new Date()
      
      for (let i = 0; i < 30; i++) { // Check last 30 days
        const checkDate = subDays(today, i)
        const dayStart = format(checkDate, 'yyyy-MM-dd') + 'T00:00:00.000Z'
        const dayEnd = format(checkDate, 'yyyy-MM-dd') + 'T23:59:59.999Z'
        
        const { data: dayLogs } = await supabase
          .from('food_logs')
          .select('id')
          .eq('user_id', userId)
          .gte('logged_at', dayStart)
          .lte('logged_at', dayEnd)
          .limit(1)

        if (dayLogs && dayLogs.length > 0) {
          streak++
        } else {
          break
        }
      }

      // Calculate average goal completion
      let avgCompletion = 0
      if (weeklyCompletion) {
        avgCompletion = Math.round(
          (weeklyCompletion.calories + 
           weeklyCompletion.protein + 
           weeklyCompletion.carbs + 
           weeklyCompletion.fats + 
           weeklyCompletion.water) / 5
        )
      }

      setProgressMetrics({
        weightChange: Math.round(weightChange * 10) / 10,
        weightChangeUnit,
        currentStreak: streak,
        avgGoalCompletion: avgCompletion
      })

    } catch (error) {
      console.error('Error calculating progress metrics:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
        <div className="container mx-auto p-4 pb-20">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Progress Tracking
              </h1>
              <p className="text-muted-foreground">Loading your progress...</p>
            </div>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading your progress data...</p>
            </div>
          </div>
        </div>
        <Navigation />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
      <div className="container mx-auto p-4 pb-20">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Progress Tracking
            </h1>
            <p className="text-muted-foreground">Your wellness journey insights</p>
          </div>
          <ThemeToggle />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105">
            <CardContent className="p-4 text-center">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 ${
                progressMetrics.weightChange < 0 ? 'bg-green-500/10' : 'bg-red-500/10'
              }`}>
                {progressMetrics.weightChange < 0 ? (
                  <TrendingDown className="h-6 w-6 text-green-500" />
                ) : (
                  <TrendingUp className="h-6 w-6 text-red-500" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">
                  {progressMetrics.weightChange > 0 ? '+' : ''}{progressMetrics.weightChange}
                </p>
                <p className="text-sm text-muted-foreground">{progressMetrics.weightChangeUnit} change</p>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-blue-500" />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{progressMetrics.currentStreak}</p>
                <p className="text-sm text-muted-foreground">day streak</p>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-3">
                <Trophy className="h-6 w-6 text-purple-500" />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">--</p>
                <p className="text-sm text-muted-foreground">achievements</p>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center mx-auto mb-3">
                <Target className="h-6 w-6 text-orange-500" />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{progressMetrics.avgGoalCompletion}%</p>
                <p className="text-sm text-muted-foreground">avg goal completion</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weight Progress Chart */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Scale className="h-5 w-5" />
              <span>Weight Progress</span>
            </CardTitle>
            <CardDescription>
              Your weight journey: estimated progress vs actual results
              {userProfile?.target_weight && (
                <span className="block text-sm mt-1">
                  Target: {userProfile.target_weight} {userProfile.weight_unit}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {weightData.length > 0 ? (
              <div className="space-y-4">
                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-0.5 bg-blue-500 rounded"></div>
                    <span className="text-muted-foreground">Estimated Progress</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span className="text-muted-foreground">Actual Weight</span>
                  </div>
                  {userProfile?.target_weight && (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-0.5 bg-green-500 rounded border-dashed border-2 border-green-500"></div>
                      <span className="text-muted-foreground">Target Weight</span>
                    </div>
                  )}
                </div>

                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                      data={weightData}
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis 
                        dataKey="formattedDate" 
                        tick={{ fontSize: 11 }}
                        interval={Math.max(1, Math.floor(weightData.length / 8))}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        domain={['dataMin - 2', 'dataMax + 2']}
                        tick={{ fontSize: 11 }}
                        label={{ 
                          value: `Weight (${userProfile?.weight_unit || 'kg'})`, 
                          angle: -90, 
                          position: 'insideLeft' 
                        }}
                      />
                      <Tooltip 
                        labelFormatter={(label, payload) => {
                          if (payload && payload[0]) {
                            const data = payload[0].payload
                            return format(new Date(data.date), 'MMMM d, yyyy')
                          }
                          return label
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === 'estimatedWeight') {
                            return [`${value?.toFixed(1)} ${userProfile?.weight_unit || 'kg'}`, 'Estimated Weight']
                          } else if (name === 'actualWeight') {
                            return [`${value?.toFixed(1)} ${userProfile?.weight_unit || 'kg'}`, 'Actual Weight']
                          } else if (name === 'targetWeight') {
                            return [`${value?.toFixed(1)} ${userProfile?.weight_unit || 'kg'}`, 'Target Weight']
                          }
                          return [`${value?.toFixed(1)} ${userProfile?.weight_unit || 'kg'}`, 'Weight']
                        }}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                        filter={(label, payload) => {
                          // Only show tooltip for data points that have actual values
                          return payload && payload.some(p => p.value !== null && p.value !== undefined)
                        }}
                      />
                      
                      {/* Estimated Weight Line */}
                      <Line 
                        type="monotone" 
                        dataKey="estimatedWeight" 
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        connectNulls={true}
                        name="estimatedWeight"
                      />
                      
                      {/* Target Weight Reference Line */}
                      {userProfile?.target_weight && (
                        <Line 
                          type="monotone" 
                          dataKey="targetWeight"
                          stroke="#22c55e"
                          strokeWidth={2}
                          strokeDasharray="10 5"
                          dot={false}
                          connectNulls={true}
                          name="targetWeight"
                        />
                      )}
                      
                      {/* Actual Weight Line - render last to appear on top */}
                      <Line 
                        type="monotone" 
                        dataKey="actualWeight" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        dot={{ 
                          fill: "hsl(var(--primary))", 
                          strokeWidth: 2, 
                          r: 6,
                          stroke: "hsl(var(--background))"
                        }}
                        connectNulls={false}
                        name="actualWeight"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Progress Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Starting Weight</p>
                    <p className="text-lg font-semibold">
                      {userProfile?.weight} {userProfile?.weight_unit}
                    </p>
                  </div>
                  {weightData.find(d => d.actualWeight) && (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Current Weight</p>
                      <p className="text-lg font-semibold">
                        {weightData.filter(d => d.actualWeight).pop()?.actualWeight?.toFixed(1)} {userProfile?.weight_unit}
                      </p>
                    </div>
                  )}
                  {userProfile?.target_weight && (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Target Weight</p>
                      <p className="text-lg font-semibold text-green-600">
                        {userProfile.target_weight} {userProfile.weight_unit}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No weight progress available</p>
                  <p className="text-sm text-muted-foreground">
                    {!userProfile?.target_weight 
                      ? "Set a target weight in your profile to see estimated progress"
                      : "Start logging your weight to see progress vs estimates"
                    }
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-4"
                    onClick={() => navigate('/profile')}
                  >
                    Go to Profile
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Goal Completion */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle>Weekly Goal Completion</CardTitle>
            <CardDescription>How well you're meeting your nutrition targets</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Calories", value: weeklyGoalCompletion.calories, icon: Zap, color: "text-orange-500" },
                { name: "Protein", value: weeklyGoalCompletion.protein, icon: Beef, color: "text-red-500" },
                { name: "Carbs", value: weeklyGoalCompletion.carbs, icon: Wheat, color: "text-yellow-500" },
                { name: "Fats", value: weeklyGoalCompletion.fats, icon: Droplets, color: "text-blue-500" },
                { name: "Water", value: weeklyGoalCompletion.water, icon: Droplets, color: "text-cyan-500" },
              ].map((item, index) => {
                const ItemIcon = item.icon
                return (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="flex items-center space-x-3 w-24">
                      <ItemIcon className={`h-5 w-5 ${item.color}`} />
                      <span className="font-medium">{item.name}</span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-center">
                        <ProgressBar value={item.value} className="flex-1" />
                        <Badge variant="outline" className="ml-3">
                          {item.value}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Daily Nutrition Chart */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle>Daily Nutrition Intake</CardTitle>
            <CardDescription>This week's daily nutrition breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyNutritionData.length > 0 ? (
              <Tabs defaultValue="calories">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="calories">Calories</TabsTrigger>
                  <TabsTrigger value="protein">Protein</TabsTrigger>
                  <TabsTrigger value="carbs">Carbs</TabsTrigger>
                  <TabsTrigger value="water">Water</TabsTrigger>
                </TabsList>
                
                {["calories", "protein", "carbs", "water"].map((nutrient) => (
                  <TabsContent key={nutrient} value={nutrient}>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyNutritionData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="day" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: any) => [
                              `${value}${nutrient === 'calories' ? ' cal' : nutrient === 'water' ? ' L' : 'g'}`, 
                              nutrient.charAt(0).toUpperCase() + nutrient.slice(1)
                            ]}
                          />
                          <Bar 
                            dataKey={nutrient} 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No nutrition data available</p>
                  <p className="text-sm text-muted-foreground">Start logging your meals to see daily intake</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Navigation />
    </div>
  )
}

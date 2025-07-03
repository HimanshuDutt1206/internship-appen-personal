import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress as ProgressBar } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, ReferenceLine } from "recharts"
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
  Scale,
  Loader2
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Navigation from "@/components/Navigation"
import { supabase, type WeightLog, type FoodLog, type WaterLog, type NutritionPlan } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useNavigate } from "react-router-dom"
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns"
import { weightPredictionService, type WeightPrediction } from "@/lib/weightPredictionService"

interface WeightChartData {
  date: string
  weight: number
  formattedDate: string
  actualWeight?: number
  predictedWeight?: number
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
  const [isPredicting, setIsPredicting] = useState(false)
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const [predictions, setPredictions] = useState<WeightPrediction[]>([])

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
      await loadWeightProgress(userData.id, userProfileData, nutritionPlanData)
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

  const loadWeightProgress = async (userId: number, userProfileData: any, nutritionPlanData: any, predictionData: WeightPrediction[] = []) => {
    try {
      const { data: weightLogs, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_date', { ascending: true })

      if (error) throw error

      // Generate 31-day timeline
      const timelineData = generate31DayTimeline(userProfileData, nutritionPlanData)
      
      // Add actual weight logs and predictions to timeline
      const combinedData = mergeActualAndEstimatedData(weightLogs || [], timelineData, predictionData.length > 0 ? predictionData : predictions)
      
      setWeightData(combinedData)
    } catch (error) {
      console.error('Error loading weight progress:', error)
    }
  }

  const generate31DayTimeline = (userProfile: any, nutritionPlan: any) => {
    if (!userProfile || !nutritionPlan) return []

    const planCreatedDate = new Date(nutritionPlan.created_at)
    
    // Generate 31-day timeline starting from plan creation date (day 0)
    const timelineData: WeightChartData[] = []
    
    // Generate data points for days 0-31
    for (let day = 0; day <= 31; day++) {
      const currentDate = new Date(planCreatedDate)
      currentDate.setDate(currentDate.getDate() + day)
      
      timelineData.push({
        date: currentDate.toISOString().split('T')[0],
        weight: 0, // Will be filled by actual weights only
        formattedDate: `Day ${day}`
      })
    }
    
    return timelineData
  }

  const mergeActualAndEstimatedData = (actualLogs: WeightLog[], timelineData: WeightChartData[], predictionData: WeightPrediction[] = []) => {
    // Create a map of dates for efficient lookup
    const dateMap = new Map<string, WeightChartData>()
    
    // Add timeline data first (31-day structure)
    timelineData.forEach(data => {
      dateMap.set(data.date, data)
    })
    
    // Add actual weight logs to the timeline
    actualLogs.forEach(log => {
      const dateKey = log.logged_date
      const existing = dateMap.get(dateKey)
      
      if (existing) {
        // Update existing timeline entry with actual weight
        dateMap.set(dateKey, {
          ...existing,
          weight: log.weight,
          actualWeight: log.weight
        })
      }
      // Note: We don't add logs outside the 31-day timeline
    })
    
    // Add predicted weights to the timeline
    predictionData.forEach(prediction => {
      const existing = dateMap.get(prediction.date)
      if (existing) {
        // Update existing timeline entry with predicted weight
        dateMap.set(prediction.date, {
          ...existing,
          predictedWeight: prediction.weight
        })
      }
    })
    
    // Convert back to array and sort by date
    const sortedData = Array.from(dateMap.values()).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    
    return sortedData
  }

  const handlePredictWeight = async () => {
    if (!currentUserId) return

    try {
      setIsPredicting(true)
      setPredictionError(null)
      
      const weightPredictions = await weightPredictionService.generateWeightPredictions(currentUserId)
      setPredictions(weightPredictions)
      
      // Reload weight data with the new predictions
      const userProfileData = await loadUserProfile(currentUserId)
      const nutritionPlanData = await loadNutritionPlan(currentUserId)
      await loadWeightProgress(currentUserId, userProfileData, nutritionPlanData, weightPredictions)
      
      toast({
        title: "Predictions Generated!",
        description: "AI has predicted your weight progress based on your data.",
      })
    } catch (error: any) {
      console.error('Error generating predictions:', error)
      setPredictionError(error.message || 'Failed to generate predictions')
      toast({
        title: "Prediction Failed",
        description: error.message || "Failed to generate weight predictions. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPredicting(false)
    }
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
              Your weight journey over 31 days from plan start
            </CardDescription>
          </CardHeader>
          <CardContent>
            {weightData.length > 0 ? (
              <div className="space-y-4">
                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-primary rounded-full"></div>
                    <span className="text-muted-foreground">Logged Weight</span>
                  </div>
                  {predictions.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-0.5 bg-orange-500 rounded" style={{ borderStyle: 'dashed', borderWidth: '1px', borderColor: 'rgb(249 115 22)' }}></div>
                      <span className="text-muted-foreground">AI Predicted Weight</span>
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
                        domain={[
                          Math.min(
                            ...weightData.map(d => d.weight || d.actualWeight || d.predictedWeight).filter(Boolean),
                            userProfile?.target_weight ? parseFloat(userProfile.target_weight) : Infinity
                          ) - 2,
                          Math.max(
                            ...weightData.map(d => d.weight || d.actualWeight || d.predictedWeight).filter(Boolean),
                            userProfile?.target_weight ? parseFloat(userProfile.target_weight) : -Infinity
                          ) + 2,
                        ]}
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
                          if (name === 'actualWeight') {
                            return [`${value?.toFixed(1)} ${userProfile?.weight_unit || 'kg'}`, 'Logged Weight']
                          } else if (name === 'predictedWeight') {
                            return [`${value?.toFixed(1)} ${userProfile?.weight_unit || 'kg'}`, 'AI Predicted Weight']
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
                          return payload && payload.some(p => p.value !== null && p.value !== undefined && p.value > 0)
                        }}
                      />
                      
                      {/* Target Weight Line */}
                      {userProfile?.target_weight && (
                        <ReferenceLine
                          y={parseFloat(userProfile.target_weight)}
                          stroke="hsl(var(--primary))"
                          strokeDasharray="3 3"
                          strokeOpacity={0.7}
                          label={{
                            value: `Target: ${userProfile.target_weight} ${userProfile.weight_unit}`,
                            position: "top",
                            fill: "hsl(var(--primary))",
                            fontSize: 12,
                          }}
                        />
                      )}

                      {/* Predicted Weight Line */}
                      {predictions.length > 0 && (
                        <Line 
                          type="monotone" 
                          dataKey="predictedWeight" 
                          stroke="#f97316"
                          strokeWidth={2}
                          strokeDasharray="8 4"
                          dot={{ 
                            fill: "#f97316", 
                            strokeWidth: 1, 
                            r: 4
                          }}
                          connectNulls={true}
                          name="predictedWeight"
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
                        connectNulls={true}
                        name="actualWeight"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Weight Prediction Button */}
                <div className="pt-4 border-t">
                  <div className="flex flex-col items-center space-y-2">
                    {weightData.find(d => d.actualWeight) ? (
                      <Button
                        onClick={handlePredictWeight}
                        disabled={isPredicting}
                        className="w-full max-w-sm transition-all duration-200 hover:scale-105"
                        variant={predictions.length > 0 ? "outline" : "default"}
                      >
                        {isPredicting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Generating Predictions...
                          </>
                        ) : predictions.length > 0 ? (
                          "Update Predictions"
                        ) : (
                          "🤖 Predict Weight Progress"
                        )}
                      </Button>
                    ) : (
                      <div className="text-center text-sm text-muted-foreground">
                        Log at least one weight to generate AI predictions
                      </div>
                    )}
                    
                    {predictionError && (
                      <div className="text-center text-sm text-destructive">
                        {predictionError}
                      </div>
                    )}
                    
                    {predictions.length > 0 && (
                      <div className="text-center text-xs text-muted-foreground">
                        Showing {predictions.length} AI-predicted days
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Progress Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Starting Weight</p>
                    <p className="text-lg font-semibold">
                      {userProfile?.weight} {userProfile?.weight_unit}
                    </p>
                  </div>
                  {weightData.find(d => d.actualWeight) && (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Latest Weight</p>
                      <p className="text-lg font-semibold">
                        {weightData.filter(d => d.actualWeight).pop()?.actualWeight?.toFixed(1)} {userProfile?.weight_unit}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No weight logs available</p>
                  <p className="text-sm text-muted-foreground">
                    Start logging your weight to see your progress over the 31-day timeline
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

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress as ProgressBar } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
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
      await loadWeightProgress(userData.id)
      const nutritionPlanData = await loadNutritionPlan(userData.id)
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

  const loadWeightProgress = async (userId: number) => {
    try {
      const { data: weightLogs, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_date', { ascending: true })

      if (error) throw error

      if (weightLogs && weightLogs.length > 0) {
        const chartData: WeightChartData[] = weightLogs.map((log: WeightLog) => ({
          date: log.logged_date,
          weight: log.weight,
          formattedDate: format(new Date(log.logged_date), 'MMM d')
        }))
        
        setWeightData(chartData)
      }
    } catch (error) {
      console.error('Error loading weight progress:', error)
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
            <CardDescription>Your weight change over time</CardDescription>
          </CardHeader>
          <CardContent>
            {weightData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weightData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="formattedDate" />
                    <YAxis domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip 
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0]) {
                          const data = payload[0].payload
                          return format(new Date(data.date), 'MMMM d, yyyy')
                        }
                        return label
                      }}
                      formatter={(value: any) => [`${value} ${progressMetrics.weightChangeUnit}`, 'Weight']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 2, r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No weight data available</p>
                  <p className="text-sm text-muted-foreground">Start logging your weight to see progress</p>
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

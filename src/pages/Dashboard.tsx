
import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Apple, 
  Zap, 
  Target, 
  TrendingUp, 
  Plus,
  Droplets,
  Beef,
  Wheat,
  Gauge,
  Trash2,
  Clock
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Navigation from "@/components/Navigation"
import { supabase, type NutritionPlan, type FoodLog, type WaterLog } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useNavigate } from "react-router-dom"

interface NutritionTarget {
  calories: number
  protein: number
  carbs: number
  fats: number
  water: number // target in ml
}

interface DailyIntake {
  calories: number
  protein: number
  carbs: number
  fats: number
  water: number // current intake in ml
}

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(true)
  const [customWaterAmount, setCustomWaterAmount] = useState("")
  const [isWaterDialogOpen, setIsWaterDialogOpen] = useState(false)
  const [todaysWaterLogs, setTodaysWaterLogs] = useState<WaterLog[]>([])
  const [showWaterLogs, setShowWaterLogs] = useState(false)
  const [targets, setTargets] = useState<NutritionTarget>({
    calories: 2000,
    protein: 150,
    carbs: 250,
    fats: 67,
    water: 2500 // Default 2.5L in ml
  })

  const [intake, setIntake] = useState<DailyIntake>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    water: 0
  })

  const { toast } = useToast()
  const navigate = useNavigate()

  const loadNutritionPlan = async () => {
    try {
      setIsLoading(true)
      
      // Get the most recent user (since we don't have auth)
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (userError) {
        if (userError.code === 'PGRST116') {
          // No users found, redirect to onboarding
          navigate('/onboarding')
          return
        }
        throw userError
      }

      // Get the nutrition plan for this user
      const { data: planData, error: planError } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('user_id', userData.id)
        .single()

      if (planError) {
        if (planError.code === 'PGRST116') {
          // No plan found, redirect to onboarding to regenerate
          navigate('/onboarding')
          return
        }
        throw planError
      }

      // Update targets with real data
      setTargets({
        calories: planData.target_calories,
        protein: planData.protein_grams,
        carbs: planData.carbs_grams,
        fats: planData.fats_grams,
        water: planData.water_target // Already in ml from updated calculator
      })

      // Load today's food consumption and water intake
      await loadTodaysFoodConsumption(userData.id)
      await loadTodaysWaterConsumption(userData.id)

    } catch (error) {
      console.error('Error loading nutrition plan:', error)
      toast({
        title: "Error",
        description: "Failed to load your nutrition plan.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const loadTodaysFoodConsumption = async (userId: number) => {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      const { data: foodLogs, error } = await supabase
        .from('food_logs')
        .select('calories, protein, carbs, fats')
        .eq('user_id', userId)
        .gte('logged_at', `${today}T00:00:00.000Z`)
        .lt('logged_at', `${today}T23:59:59.999Z`)

      if (error) throw error

      // Calculate totals from all food logs
      const totals = foodLogs?.reduce((acc, log) => ({
        calories: acc.calories + log.calories,
        protein: acc.protein + log.protein,
        carbs: acc.carbs + log.carbs,
        fats: acc.fats + log.fats,
        water: acc.water // Water is tracked separately
      }), { calories: 0, protein: 0, carbs: 0, fats: 0, water: 0 }) || { calories: 0, protein: 0, carbs: 0, fats: 0, water: 0 }

      setIntake(prev => ({ ...totals, water: prev.water }))
    } catch (error) {
      console.error('Error loading food consumption:', error)
    }
  }

  const loadTodaysWaterConsumption = async (userId: number) => {
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      const { data: waterLogs, error } = await supabase
        .from('water_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', `${today}T00:00:00.000Z`)
        .lt('logged_at', `${today}T23:59:59.999Z`)
        .order('logged_at', { ascending: false })

      if (error) throw error

      // Store today's water logs for display
      setTodaysWaterLogs(waterLogs || [])

      // Calculate total water intake for today
      const totalWater = waterLogs?.reduce((acc, log) => acc + log.amount_ml, 0) || 0
      
      setIntake(prev => ({ ...prev, water: totalWater }))
    } catch (error) {
      console.error('Error loading water consumption:', error)
    }
  }

  const addWaterGlass = async () => {
    try {
      const userId = await getCurrentUserId()
      if (!userId) return

      const { error } = await supabase
        .from('water_logs')
        .insert([{
          user_id: userId,
          amount_ml: 250,
          logged_at: new Date().toISOString()
        }])

      if (error) throw error

      setIntake(prev => ({ 
        ...prev, 
        water: prev.water + 250 
      }))

      // Refresh water logs to include the new entry
      await loadTodaysWaterConsumption(userId)

      toast({
        title: "Water Added!",
        description: "Added 250ml glass of water to your intake.",
      })
    } catch (error) {
      console.error('Error adding water glass:', error)
      toast({
        title: "Error",
        description: "Failed to add water. Please try again.",
        variant: "destructive",
      })
    }
  }

  const addCustomWater = async (amount: number) => {
    try {
      const userId = await getCurrentUserId()
      if (!userId) return

      const { error } = await supabase
        .from('water_logs')
        .insert([{
          user_id: userId,
          amount_ml: amount,
          logged_at: new Date().toISOString()
        }])

      if (error) throw error

      setIntake(prev => ({ 
        ...prev, 
        water: prev.water + amount 
      }))

      // Refresh water logs to include the new entry
      await loadTodaysWaterConsumption(userId)

      toast({
        title: "Water Added!",
        description: `Added ${amount}ml of water to your intake.`,
      })
    } catch (error) {
      console.error('Error adding custom water:', error)
      toast({
        title: "Error",
        description: "Failed to add water. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getCurrentUserId = async (): Promise<number | null> => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      return userData?.id || null
    } catch (error) {
      console.error('Error getting current user ID:', error)
      return null
    }
  }

  const deleteWaterLog = async (logId: number, amount: number) => {
    try {
      const { error } = await supabase
        .from('water_logs')
        .delete()
        .eq('id', logId)

      if (error) throw error

      // Update local state immediately
      const updatedLogs = todaysWaterLogs.filter(log => log.id !== logId)
      setTodaysWaterLogs(updatedLogs)
      setIntake(prev => ({ 
        ...prev, 
        water: prev.water - amount 
      }))

      // If no more logs exist, automatically close the delete view
      if (updatedLogs.length === 0) {
        setShowWaterLogs(false)
      }

      toast({
        title: "Water Log Deleted",
        description: `Removed ${amount}ml from your intake.`,
      })
    } catch (error) {
      console.error('Error deleting water log:', error)
      toast({
        title: "Error",
        description: "Failed to delete water log. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleCustomWaterSubmit = async () => {
    const amount = parseInt(customWaterAmount)
    if (amount && amount > 0 && amount <= 2000) { // Max 2L at once
      await addCustomWater(amount)
      setCustomWaterAmount("")
      setIsWaterDialogOpen(false)
    } else {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount between 1-2000ml.",
        variant: "destructive",
      })
    }
  }

  useEffect(() => {
    loadNutritionPlan()
  }, [])

  const calculatePercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100)
  }

  const getRemainingAmount = (current: number, target: number) => {
    return Math.max(target - current, 0)
  }

  const nutritionData = [
    {
      name: "Calories",
      current: intake.calories,
      target: targets.calories,
      unit: "kcal",
      icon: Zap,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-500/10"
    },
    {
      name: "Protein",
      current: intake.protein,
      target: targets.protein,
      unit: "g",
      icon: Beef,
      color: "text-rose-500",
      bgColor: "bg-rose-50 dark:bg-rose-500/10"
    },
    {
      name: "Carbs",
      current: intake.carbs,
      target: targets.carbs,
      unit: "g",
      icon: Wheat,
      color: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-500/10"
    },
    {
      name: "Fats",
      current: intake.fats,
      target: targets.fats,
      unit: "g",
      icon: Droplets,
      color: "text-sky-500",
      bgColor: "bg-sky-50 dark:bg-sky-500/10"
    }
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-50/30 dark:to-emerald-950/20">
        <div className="container mx-auto p-4 pb-20">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-sky-600 bg-clip-text text-transparent">
                Today's Progress
              </h1>
              <p className="text-muted-foreground">Loading your personalized plan...</p>
            </div>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading your nutrition plan...</p>
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
              Today's Progress
            </h1>
            <p className="text-muted-foreground">Keep up the great work!</p>
          </div>
          <ThemeToggle />
        </div>

        {/* Today's Goals */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg border-emerald-100 dark:border-emerald-900/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300">
              <Target className="h-5 w-5" />
              <span>Today's Goals</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nutritionData.map((item, index) => {
                const ItemIcon = item.icon
                const remaining = getRemainingAmount(item.current, item.target)
                return (
                  <div key={index} className={`p-4 rounded-lg ${item.bgColor} transition-all duration-300 hover:scale-105`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <ItemIcon className={`h-5 w-5 ${item.color}`} />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <Badge variant="outline" className={`${item.color} border-current`}>
                        {Math.round(calculatePercentage(item.current, item.target))}%
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{item.current} {item.unit}</span>
                        <span className="text-muted-foreground">/{item.target} {item.unit}</span>
                      </div>
                      <Progress value={calculatePercentage(item.current, item.target)} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {remaining} {item.unit} remaining
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Water Intake */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg border-sky-100 dark:border-sky-900/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center">
                  <Droplets className="h-5 w-5 text-sky-500" />
                </div>
                <div>
                  <CardTitle className="text-lg text-sky-700 dark:text-sky-300">Water Intake</CardTitle>
                  <CardDescription>Daily hydration goal: {(targets.water / 1000).toFixed(1)}L</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={addWaterGlass}
                  className="hover:scale-105 transition-transform bg-sky-500 hover:bg-sky-600"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Glass (250ml)
                </Button>
                <Dialog open={isWaterDialogOpen} onOpenChange={setIsWaterDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="hover:scale-105 transition-transform border-sky-500 text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950"
                    >
                      Manual Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                      <DialogTitle>Add Custom Water Amount</DialogTitle>
                      <DialogDescription>
                        Enter the amount of water you drank in milliliters (ml).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="water-amount" className="text-right">
                          Amount (ml)
                        </Label>
                        <Input
                          id="water-amount"
                          type="number"
                          placeholder="250"
                          value={customWaterAmount}
                          onChange={(e) => setCustomWaterAmount(e.target.value)}
                          className="col-span-3"
                          min="1"
                          max="2000"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsWaterDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" onClick={handleCustomWaterSubmit}>
                        Add Water
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowWaterLogs(!showWaterLogs)}
                  className="hover:scale-105 transition-transform border-destructive text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {showWaterLogs ? 'Finish' : 'Delete'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-left">
                    <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                      {(intake.water / 1000).toFixed(1)}L
                    </span>
                    <span className="text-sm text-muted-foreground ml-2">
                      ({intake.water}ml)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground">
                      /{(targets.water / 1000).toFixed(1)}L
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {Math.round(calculatePercentage(intake.water, targets.water))}% complete
                    </div>
                  </div>
                </div>
                <Progress value={calculatePercentage(intake.water, targets.water)} className="h-3" />
                <p className="text-xs text-sky-600 dark:text-sky-400">
                  {getRemainingAmount(intake.water, targets.water)}ml remaining
                </p>
              </div>
              <div className="flex flex-col items-center space-y-1">
                <div className="text-xs text-muted-foreground">Glasses</div>
                <div className="flex space-x-1">
                  {Array.from({ length: Math.min(8, Math.ceil(targets.water / 250)) }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-6 rounded-full transition-all duration-300 ${
                        i < Math.floor(intake.water / 250)
                          ? "bg-sky-500 scale-110" 
                          : "bg-muted border border-muted-foreground/20"
                      }`}
                    />
                  ))}
                </div>
                <div className="text-xs text-sky-600 dark:text-sky-400">
                  {Math.floor(intake.water / 250)}/{Math.ceil(targets.water / 250)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Water Logs */}
        {showWaterLogs && todaysWaterLogs.length > 0 && (
          <Card className="mb-6 transition-all duration-300 hover:shadow-lg border-sky-100 dark:border-sky-900/50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-sky-700 dark:text-sky-300">
                <Clock className="h-5 w-5" />
                <span>Today's Water Logs</span>
                <Badge variant="secondary" className="ml-2">
                  {todaysWaterLogs.length} {todaysWaterLogs.length === 1 ? 'entry' : 'entries'}
                </Badge>
              </CardTitle>
              <CardDescription>Your water intake throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {todaysWaterLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-sky-50/50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/50 hover:bg-sky-50 dark:hover:bg-sky-950/30 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-500/20 flex items-center justify-center">
                        <Droplets className="h-4 w-4 text-sky-500" />
                      </div>
                      <div>
                        <div className="font-medium text-sky-700 dark:text-sky-300">
                          {log.amount_ml}ml
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.logged_at || '').toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteWaterLog(log.id!, log.amount_ml)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state for delete mode */}
        {showWaterLogs && todaysWaterLogs.length === 0 && (
          <Card className="mb-6 transition-all duration-300 hover:shadow-lg border-sky-100 dark:border-sky-900/50">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center mx-auto mb-4">
                <Droplets className="h-8 w-8 text-sky-500" />
              </div>
              <h3 className="font-semibold mb-2 text-sky-700 dark:text-sky-300">No Water Logs Today</h3>
              <p className="text-sm text-muted-foreground mb-4">
                You haven't logged any water intake today yet.
              </p>
              <Button
                size="sm"
                onClick={() => setShowWaterLogs(false)}
                variant="outline"
                className="border-sky-500 text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950"
              >
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-200 dark:hover:border-emerald-800">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <Apple className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="font-semibold mb-2 text-emerald-700 dark:text-emerald-300">Log Food</h3>
              <p className="text-sm text-muted-foreground">Add your meals and snacks</p>
            </CardContent>
          </Card>
          
          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-purple-100 dark:border-purple-900/50 hover:border-purple-200 dark:hover:border-purple-800">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="font-semibold mb-2 text-purple-700 dark:text-purple-300">View Progress</h3>
              <p className="text-sm text-muted-foreground">Track your journey</p>
            </CardContent>
          </Card>
          
          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer border-sky-100 dark:border-sky-900/50 hover:border-sky-200 dark:hover:border-sky-800">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-sky-500" />
              </div>
              <h3 className="font-semibold mb-2 text-sky-700 dark:text-sky-300">Adjust Goals</h3>
              <p className="text-sm text-muted-foreground">Update your targets</p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Summary */}
        <Card className="transition-all duration-300 hover:shadow-lg border-slate-100 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-slate-700 dark:text-slate-300">
              <Gauge className="h-5 w-5" />
              <span>Today's Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-500">
                  {Math.round(calculatePercentage(intake.calories, targets.calories))}%
                </p>
                <p className="text-sm text-muted-foreground">Calorie Goal</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-rose-500">
                  {Math.round(calculatePercentage(intake.protein, targets.protein))}%
                </p>
                <p className="text-sm text-muted-foreground">Protein Goal</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-sky-500">
                  {Math.round(calculatePercentage(intake.water, targets.water))}%
                </p>
                <p className="text-sm text-muted-foreground">Hydration Goal</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-500">3</p>
                <p className="text-sm text-muted-foreground">Meals Logged</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Navigation />
    </div>
  )
}

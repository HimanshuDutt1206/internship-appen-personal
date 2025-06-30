import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { 
  User, 
  Mail, 
  Scale, 
  Target, 
  Activity, 
  Settings, 
  LogOut,
  Trash2,
  Edit,
  Save,
  X,
  RefreshCcw,
  Plus,
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown
} from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Navigation from "@/components/Navigation"
import { supabase, type WeightLog } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface UserProfile {
  name: string
  email: string
  age: string
  gender: string
  height: string
  heightUnit: string
  weight: string
  weightUnit: string
  activityLevel: string
  primaryGoal: string
  targetWeight: string
  timeline: string
}

export default function Profile() {
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    email: "",
    age: "",
    gender: "",
    height: "",
    heightUnit: "ft",
    weight: "",
    weightUnit: "lbs",
    activityLevel: "",
    primaryGoal: "",
    targetWeight: "",
    timeline: ""
  })

  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile)
  
  // Weight logging state
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false)
  const [editingWeightLog, setEditingWeightLog] = useState<WeightLog | null>(null)
  const [newWeight, setNewWeight] = useState("")
  const [newWeightUnit, setNewWeightUnit] = useState<'lbs' | 'kg'>("lbs")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [weightNotes, setWeightNotes] = useState("")
  const [isLoadingWeight, setIsLoadingWeight] = useState(false)
  
  const { toast } = useToast()
  const navigate = useNavigate()

  const loadUserData = async () => {
    try {
      setIsLoading(true)
      
      // For MVP, load the most recent user (since we don't have auth)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // No users found, redirect to onboarding
          navigate('/onboarding')
          return
        }
        throw error
      }

      // Convert database data to profile format
      const userProfile: UserProfile = {
        name: data.name,
        email: data.email,
        age: data.age.toString(),
        gender: data.gender,
        height: data.height,
        heightUnit: data.height_unit,
        weight: data.weight,
        weightUnit: data.weight_unit,
        activityLevel: data.activity_level,
        primaryGoal: data.primary_goal,
        targetWeight: data.target_weight,
        timeline: data.timeline
      }

      setProfile(userProfile)
      setEditedProfile(userProfile)
      setCurrentUserId(data.id)
      setNewWeightUnit(data.weight_unit as 'lbs' | 'kg')
      
      // Load nutrition plan and weight logs for this user
      await loadNutritionPlan(data.id)
      await loadWeightLogs(data.id)
    } catch (error) {
      console.error('Error loading user data:', error)
      toast({
        title: "Error",
        description: "Failed to load profile data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadUserData()
  }, [])

  const updateEditedProfile = (field: keyof UserProfile, value: string) => {
    setEditedProfile(prev => ({ ...prev, [field]: value }))
  }

  const saveProfile = () => {
    setProfile(editedProfile)
    setIsEditing(false)
  }

  const cancelEdit = () => {
    setEditedProfile(profile)
    setIsEditing(false)
  }

  const handleRegeneratePlan = () => {
    // This will trigger plan regeneration based on current profile data
    console.log("Regenerating nutrition plan with current data:", profile)
    // TODO: Implement plan regeneration logic
  }

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true)
      
      // Get user ID first
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', profile.email)
        .single()

      if (userError) {
        throw userError
      }

      // Delete food logs first (due to foreign key constraint)
      const { error: foodLogsError } = await supabase
        .from('food_logs')
        .delete()
        .eq('user_id', userData.id)

      if (foodLogsError) {
        console.warn('Error deleting food logs:', foodLogsError)
        // Continue with deletion even if food logs deletion fails
      }

      // Delete water logs (due to foreign key constraint)
      const { error: waterLogsError } = await supabase
        .from('water_logs')
        .delete()
        .eq('user_id', userData.id)

      if (waterLogsError) {
        console.warn('Error deleting water logs:', waterLogsError)
        // Continue with deletion even if water logs deletion fails
      }

      // Delete weight logs (due to foreign key constraint)
      const { error: weightLogsError } = await supabase
        .from('weight_logs')
        .delete()
        .eq('user_id', userData.id)

      if (weightLogsError) {
        console.warn('Error deleting weight logs:', weightLogsError)
        // Continue with deletion even if weight logs deletion fails
      }

      // Delete nutrition plan (due to foreign key constraint)
      const { error: planError } = await supabase
        .from('nutrition_plans')
        .delete()
        .eq('user_id', userData.id)

      if (planError) {
        console.warn('Error deleting nutrition plan:', planError)
        // Continue with user deletion even if plan deletion fails
      }

      // Delete user (this will also cascade delete related data if constraints are set up correctly)
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('email', profile.email)

      if (deleteError) {
        throw deleteError
      }

      toast({
        title: "Account Deleted",
        description: "Your account, nutrition plan, food logs, and water logs have been permanently deleted.",
      })

      // Navigate back to onboarding
      navigate("/onboarding")
    } catch (error) {
      console.error('Error deleting account:', error)
      toast({
        title: "Error",
        description: "Failed to delete account. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const [nutritionPlan, setNutritionPlan] = useState({
    bmr: 0,
    tdee: 0,
    targetCalories: 0,
    protein: 0,
    carbs: 0,
    fats: 0
  })

  const loadNutritionPlan = async (userId: number) => {
    try {
      const { data: planData } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (planData) {
        setNutritionPlan({
          bmr: planData.bmr,
          tdee: planData.tdee,
          targetCalories: planData.target_calories,
          protein: planData.protein_grams,
          carbs: planData.carbs_grams,
          fats: planData.fats_grams
        })
      }
    } catch (error) {
      console.error('Error loading nutrition plan:', error)
    }
  }

  // Weight logging functions
  const loadWeightLogs = async (userId: number) => {
    try {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_date', { ascending: false })
        .limit(10) // Load last 10 entries

      if (error) throw error

      setWeightLogs(data || [])
    } catch (error) {
      console.error('Error loading weight logs:', error)
      toast({
        title: "Error",
        description: "Failed to load weight history.",
        variant: "destructive",
      })
    }
  }

  const openWeightDialog = (weightLog?: WeightLog) => {
    if (weightLog) {
      setEditingWeightLog(weightLog)
      setNewWeight(weightLog.weight.toString())
      setNewWeightUnit(weightLog.weight_unit)
      setSelectedDate(new Date(weightLog.logged_date))
      setWeightNotes(weightLog.notes || "")
    } else {
      setEditingWeightLog(null)
      setNewWeight("")
      setSelectedDate(new Date())
      setWeightNotes("")
    }
    setIsWeightDialogOpen(true)
  }

  const closeWeightDialog = () => {
    setIsWeightDialogOpen(false)
    setEditingWeightLog(null)
    setNewWeight("")
    setWeightNotes("")
    setSelectedDate(new Date())
  }

  const saveWeightLog = async () => {
    if (!currentUserId || !newWeight || !selectedDate) return

    try {
      setIsLoadingWeight(true)
      const weight = parseFloat(newWeight)
      
      if (isNaN(weight) || weight <= 0) {
        toast({
          title: "Invalid Weight",
          description: "Please enter a valid weight value.",
          variant: "destructive",
        })
        return
      }

      const loggedDate = format(selectedDate, 'yyyy-MM-dd')
      
      const weightData = {
        user_id: currentUserId,
        weight: weight,
        weight_unit: newWeightUnit,
        logged_date: loggedDate,
        notes: weightNotes.trim() || null
      }

      if (editingWeightLog) {
        // Update existing log
        const { error } = await supabase
          .from('weight_logs')
          .update(weightData)
          .eq('id', editingWeightLog.id)

        if (error) throw error

        toast({
          title: "Success",
          description: "Weight log updated successfully!",
        })
      } else {
        // Create new log
        const { error } = await supabase
          .from('weight_logs')
          .insert([weightData])

        if (error) {
          if (error.code === '23505') { // Unique constraint violation
            toast({
              title: "Date Already Logged",
              description: "You already have a weight entry for this date. Please edit the existing entry or choose a different date.",
              variant: "destructive",
            })
            return
          }
          throw error
        }

        toast({
          title: "Success",
          description: "Weight logged successfully!",
        })
      }

      // Reload weight logs
      await loadWeightLogs(currentUserId)
      closeWeightDialog()

    } catch (error) {
      console.error('Error saving weight log:', error)
      toast({
        title: "Error",
        description: "Failed to save weight log. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingWeight(false)
    }
  }

  const deleteWeightLog = async (weightLogId: number) => {
    if (!currentUserId) return

    try {
      const { error } = await supabase
        .from('weight_logs')
        .delete()
        .eq('id', weightLogId)

      if (error) throw error

      toast({
        title: "Success",
        description: "Weight log deleted successfully!",
      })

      // Reload weight logs
      await loadWeightLogs(currentUserId)

    } catch (error) {
      console.error('Error deleting weight log:', error)
      toast({
        title: "Error",
        description: "Failed to delete weight log. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getWeightTrend = () => {
    if (weightLogs.length < 2) return null
    
    const latest = weightLogs[0]
    const previous = weightLogs[1]
    const diff = latest.weight - previous.weight
    
    return {
      direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'same',
      amount: Math.abs(diff),
      unit: latest.weight_unit
    }
  }

  // nutritionPlan is now loaded from state

  const getActivityLevelLabel = (level: string) => {
    const labels = {
      "sedentary": "Sedentary",
      "lightly-active": "Lightly Active",
      "moderately-active": "Moderately Active",
      "very-active": "Very Active",
      "extremely-active": "Extremely Active"
    }
    return labels[level as keyof typeof labels] || level
  }

  const getGoalLabel = (goal: string) => {
    const labels = {
      "weight-loss": "Weight Loss",
      "maintenance": "Weight Maintenance",
      "muscle-gain": "Muscle Gain",
      "general-health": "General Health"
    }
    return labels[goal as keyof typeof labels] || goal
  }

  const getTimelineLabel = (timeline: string) => {
    const labels = {
      "aggressive": "Aggressive",
      "moderate": "Moderate",
      "gradual": "Gradual"
    }
    return labels[timeline as keyof typeof labels] || timeline
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-accent/20">
        <div className="container mx-auto p-4 pb-20">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Profile & Settings
              </h1>
              <p className="text-muted-foreground">Loading your profile...</p>
            </div>
            <ThemeToggle />
          </div>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading your profile...</p>
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
              Profile & Settings
            </h1>
            <p className="text-muted-foreground">Manage your account and preferences</p>
          </div>
          <ThemeToggle />
        </div>

        {/* Profile Information */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <CardTitle>Personal Information</CardTitle>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegeneratePlan}
                  className="hover:scale-105 transition-transform"
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Edit Data & Regenerate Plan
                </Button>
                <Button
                  variant={isEditing ? "destructive" : "outline"}
                  size="sm"
                  onClick={isEditing ? cancelEdit : () => setIsEditing(true)}
                  className="hover:scale-105 transition-transform"
                >
                  {isEditing ? <X className="h-4 w-4 mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isEditing ? (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={editedProfile.name}
                      onChange={(e) => updateEditedProfile("name", e.target.value)}
                      className="transition-all duration-200 focus:ring-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={editedProfile.email}
                      onChange={(e) => updateEditedProfile("email", e.target.value)}
                      className="transition-all duration-200 focus:ring-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Age</Label>
                    <Input
                      value={editedProfile.age}
                      onChange={(e) => updateEditedProfile("age", e.target.value)}
                      className="transition-all duration-200 focus:ring-2"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select value={editedProfile.gender} onValueChange={(value) => updateEditedProfile("gender", value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Height</Label>
                    <div className="flex gap-2">
                      <Input
                        value={editedProfile.height}
                        onChange={(e) => updateEditedProfile("height", e.target.value)}
                        className="flex-1"
                      />
                      <Select value={editedProfile.heightUnit} onValueChange={(value) => updateEditedProfile("heightUnit", value)}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ft">ft/in</SelectItem>
                          <SelectItem value="cm">cm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Weight</Label>
                    <div className="flex gap-2">
                      <Input
                        value={editedProfile.weight}
                        onChange={(e) => updateEditedProfile("weight", e.target.value)}
                        className="flex-1"
                      />
                      <Select value={editedProfile.weightUnit} onValueChange={(value) => updateEditedProfile("weightUnit", value)}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lbs">lbs</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button onClick={saveProfile} className="hover:scale-105 transition-transform">
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{profile.name}</p>
                      <p className="text-sm text-muted-foreground">Full Name</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{profile.email}</p>
                      <p className="text-sm text-muted-foreground">Email Address</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Scale className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{profile.age} years, {profile.height}, {profile.weight} {profile.weightUnit}</p>
                      <p className="text-sm text-muted-foreground">Physical Stats</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Activity className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{getActivityLevelLabel(profile.activityLevel)}</p>
                      <p className="text-sm text-muted-foreground">Activity Level</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Goals & Preferences */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <CardTitle>Goals & Preferences</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <Badge className="mb-2">{getGoalLabel(profile.primaryGoal)}</Badge>
                <p className="text-sm text-muted-foreground">Primary Goal</p>
              </div>
              {profile.primaryGoal !== "maintenance" && (
                <div className="text-center">
                  <Badge variant="outline" className="mb-2">{profile.targetWeight} {profile.weightUnit}</Badge>
                  <p className="text-sm text-muted-foreground">Target Weight</p>
                </div>
              )}
              <div className="text-center">
                <Badge variant="secondary" className="mb-2">{getTimelineLabel(profile.timeline)}</Badge>
                <p className="text-sm text-muted-foreground">Timeline</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Nutrition Plan */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle>Current Nutrition Plan</CardTitle>
            <CardDescription>Based on your profile and goals</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-accent/20 rounded-lg">
                <p className="text-2xl font-bold text-orange-500">{nutritionPlan.targetCalories || 'Loading...'}</p>
                <p className="text-sm text-muted-foreground">Daily Calories</p>
              </div>
              <div className="text-center p-4 bg-accent/20 rounded-lg">
                <p className="text-2xl font-bold text-red-500">{nutritionPlan.protein || 'Loading...'}g</p>
                <p className="text-sm text-muted-foreground">Protein</p>
              </div>
              <div className="text-center p-4 bg-accent/20 rounded-lg">
                <p className="text-2xl font-bold text-yellow-500">{nutritionPlan.carbs || 'Loading...'}g</p>
                <p className="text-sm text-muted-foreground">Carbs</p>
              </div>
              <div className="text-center p-4 bg-accent/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-500">{nutritionPlan.fats || 'Loading...'}g</p>
                <p className="text-sm text-muted-foreground">Fats</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-muted-foreground">
                BMR: {nutritionPlan.bmr || 'Loading...'} cal/day | TDEE: {nutritionPlan.tdee || 'Loading...'} cal/day
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Weight Logging */}
        <Card className="mb-6 transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <Scale className="h-5 w-5" />
                <CardTitle>Weight Tracking</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openWeightDialog()}
                className="hover:scale-105 transition-transform"
              >
                <Plus className="h-4 w-4 mr-2" />
                Log Weight
              </Button>
            </div>
            <CardDescription>Track your weight progress over time</CardDescription>
          </CardHeader>
          <CardContent>
            {weightLogs.length > 0 ? (
              <>
                {/* Latest Weight & Trend */}
                <div className="mb-6 p-4 bg-accent/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">
                        {weightLogs[0].weight} {weightLogs[0].weight_unit}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Latest weight ({format(new Date(weightLogs[0].logged_date), 'MMM d, yyyy')})
                      </p>
                    </div>
                    {getWeightTrend() && (
                      <div className="flex items-center space-x-2">
                        {getWeightTrend()?.direction === 'up' && (
                          <TrendingUp className="h-5 w-5 text-red-500" />
                        )}
                        {getWeightTrend()?.direction === 'down' && (
                          <TrendingDown className="h-5 w-5 text-green-500" />
                        )}
                        <span className={`text-sm font-medium ${
                          getWeightTrend()?.direction === 'up' ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {getWeightTrend()?.direction === 'up' ? '+' : '-'}{getWeightTrend()?.amount} {getWeightTrend()?.unit}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Weight History */}
                <div className="space-y-3">
                  <h4 className="font-medium">Recent Entries</h4>
                  {weightLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-background border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div>
                            <p className="font-medium">{log.weight} {log.weight_unit}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(log.logged_date), 'MMM d, yyyy')}
                            </p>
                          </div>
                          {log.notes && (
                            <div className="text-sm text-muted-foreground max-w-xs truncate">
                              "{log.notes}"
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openWeightDialog(log)}
                          className="hover:scale-105 transition-transform"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="hover:scale-105 transition-transform text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Weight Entry</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this weight entry? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteWeightLog(log.id!)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No weight entries yet</p>
                <Button
                  variant="outline"
                  onClick={() => openWeightDialog()}
                  className="hover:scale-105 transition-transform"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Log Your First Weight
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weight Logging Dialog */}
        <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingWeightLog ? 'Edit Weight Entry' : 'Log Weight'}
              </DialogTitle>
              <DialogDescription>
                {editingWeightLog 
                  ? 'Update your weight entry and notes' 
                  : 'Record your current weight with optional notes'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Weight Input */}
              <div className="space-y-2">
                <Label>Weight</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="Enter weight"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    className="flex-1"
                    min="1"
                    step="0.1"
                  />
                  <Select value={newWeightUnit} onValueChange={setNewWeightUnit}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lbs">lbs</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Any notes about your weight today..."
                  value={weightNotes}
                  onChange={(e) => setWeightNotes(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeWeightDialog}>
                Cancel
              </Button>
              <Button 
                onClick={saveWeightLog} 
                disabled={!newWeight || isLoadingWeight}
                className="hover:scale-105 transition-transform"
              >
                {isLoadingWeight ? (
                  "Saving..."
                ) : editingWeightLog ? (
                  "Update Weight"
                ) : (
                  "Log Weight"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Account Actions */}
        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <CardTitle>Account Actions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="outline" 
              className="w-full justify-start hover:scale-105 transition-transform"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <Separator />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="w-full justify-start hover:scale-105 transition-transform"
                  disabled={isDeleting}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting ? "Deleting..." : "Delete Account"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account
                    and remove all your data from our servers, including:
                    <br /><br />
                    • Your profile information
                    <br />
                    • All nutrition tracking data
                    <br />
                    • Your personalized nutrition plan
                    <br /><br />
                    You'll be redirected to the onboarding page and will need to create a new account.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Yes, delete my account"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
      
      <Navigation />
    </div>
  )
}

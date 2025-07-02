import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Scale, Ruler, Activity, Target, ChevronRight, ChevronLeft } from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { ThemeToggle } from "@/components/theme-toggle"
import { supabase, type User as UserType, type NutritionPlan } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { generateNutritionPlan } from "@/lib/nutritionCalculator"
import { AuthService, type AuthUser } from "@/lib/auth"
import { Badge } from "@/components/ui/badge"

interface OnboardingData {
  age: string
  gender: string
  height: string
  heightUnit: string
  weight: string
  weightUnit: string
  activityLevel: string
  primaryGoal: string
  targetWeight: string
}

const steps = [
  { title: "Health Metrics", icon: Scale },
  { title: "Activity Level", icon: Activity },
  { title: "Goals", icon: Target },
]

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [data, setData] = useState<OnboardingData>({
    age: "",
    gender: "",
    height: "",
    heightUnit: "ft",
    weight: "",
    weightUnit: "lbs",
    activityLevel: "",
    primaryGoal: "",
    targetWeight: "",
  })
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()

  // Check if this is a profile edit coming from the profile page
  const isProfileEdit = location.state?.isProfileEdit || false
  const existingProfileData = location.state?.existingData || null

  useEffect(() => {
    // Check if user is authenticated
    const checkAuthUser = async () => {
      const user = await AuthService.getCurrentUser()
      if (user) {
        setAuthUser(user)
      } else {
        // Redirect to login if not authenticated
        navigate("/login")
      }
    }
    
    checkAuthUser()

    // Pre-populate data if coming from profile edit
    if (isProfileEdit && existingProfileData) {
      setData({
        age: existingProfileData.age,
        gender: existingProfileData.gender,
        height: existingProfileData.height,
        heightUnit: existingProfileData.heightUnit,
        weight: existingProfileData.weight,
        weightUnit: existingProfileData.weightUnit,
        activityLevel: existingProfileData.activityLevel,
        primaryGoal: existingProfileData.primaryGoal,
        targetWeight: existingProfileData.targetWeight,
      })
    }
  }, [navigate, isProfileEdit, existingProfileData])

  const updateData = (field: keyof OnboardingData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const saveUserToSupabase = async () => {
    if (!authUser) {
      toast({
        title: "Error",
        description: "User not authenticated. Please login again.",
        variant: "destructive",
      })
      navigate("/login")
      return
    }

    try {
      setIsLoading(true)
      
      // Convert data to match database schema
      const userData: Omit<UserType, 'id' | 'created_at' | 'updated_at'> = {
        name: authUser.name || localStorage.getItem('tempUserName') || 'User',
        email: authUser.email,
        age: parseInt(data.age),
        gender: data.gender,
        height: data.height,
        height_unit: data.heightUnit,
        weight: data.weight,
        weight_unit: data.weightUnit,
        activity_level: data.activityLevel,
        primary_goal: data.primaryGoal,
        target_weight: data.targetWeight || '',
      }

      // Check if user already exists in our users table
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', authUser.email)
        .single()

      let userId: number

      if (existingUser) {
        // Update existing user
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update(userData)
          .eq('email', authUser.email)
          .select()
          .single()

        if (updateError) throw updateError
        userId = updatedUser.id
      } else {
        // Create new user
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([userData])
          .select()
          .single()

        if (insertError) throw insertError
        userId = newUser.id
      }

      // Generate nutrition plan
      const calculationData = {
        age: parseInt(data.age),
        gender: data.gender,
        height: data.height,
        height_unit: data.heightUnit,
        weight: data.weight,
        weight_unit: data.weightUnit,
        activity_level: data.activityLevel,
        primary_goal: data.primaryGoal,
        target_weight: data.targetWeight
      }

      const nutritionPlan = generateNutritionPlan(calculationData)

      // If this is a profile edit, delete the existing nutrition plan first
      if (isProfileEdit) {
        const { error: deletePlanError } = await supabase
          .from('nutrition_plans')
          .delete()
          .eq('user_id', userId)

        if (deletePlanError) {
          console.warn('Error deleting existing nutrition plan:', deletePlanError)
          // Continue with creation even if deletion fails
        }
      }

      // Create new nutrition plan
      const planData: Omit<NutritionPlan, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userId,
        ...nutritionPlan
      }

      const { error: insertPlanError } = await supabase
        .from('nutrition_plans')
        .insert([planData])

      if (insertPlanError) throw insertPlanError

      // Clean up temporary data
      localStorage.removeItem('tempUserName')

      toast({
        title: isProfileEdit ? "Plan Updated Successfully!" : "Welcome to NutriCoach AI!",
        description: isProfileEdit 
          ? "Your nutrition plan has been updated with your new information."
          : "Your personalized nutrition plan has been created successfully.",
      })

      // Navigate to dashboard after successful save
      navigate("/dashboard")
    } catch (error) {
      console.error('Error saving user data:', error)
      toast({
        title: "Error",
        description: isProfileEdit 
          ? "Failed to update your profile and plan. Please try again."
          : "Failed to save your profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1)
    } else {
      // Save user data and navigate to dashboard
      saveUserToSupabase()
    }
  }

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1)
    }
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 0:
        return data.age && data.gender && data.height && data.weight
      case 1:
        return data.activityLevel
      case 2:
        return data.primaryGoal && (data.primaryGoal === "maintenance" || data.targetWeight)
      default:
        return false
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="25"
                  value={data.age}
                  onChange={(e) => updateData("age", e.target.value)}
                  className="transition-all duration-200 focus:ring-2"
                />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={data.gender} onValueChange={(value) => updateData("gender", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
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
            
            <div className="space-y-2">
              <Label>Height</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="5'8"
                  value={data.height}
                  onChange={(e) => updateData("height", e.target.value)}
                  className="flex-1 transition-all duration-200 focus:ring-2"
                />
                <Select value={data.heightUnit} onValueChange={(value) => updateData("heightUnit", value)}>
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
              <Label>Current Weight</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="150"
                  value={data.weight}
                  onChange={(e) => updateData("weight", e.target.value)}
                  className="flex-1 transition-all duration-200 focus:ring-2"
                />
                <Select value={data.weightUnit} onValueChange={(value) => updateData("weightUnit", value)}>
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
        )

      case 1:
        return (
          <div className="space-y-6 animate-fade-in">
            <div>
              <Label className="text-base font-medium mb-4 block">What's your activity level?</Label>
              <RadioGroup value={data.activityLevel} onValueChange={(value) => updateData("activityLevel", value)} className="space-y-3">
                {[
                  { value: "sedentary", label: "Sedentary", desc: "Desk job, minimal exercise" },
                  { value: "lightly-active", label: "Lightly Active", desc: "Light exercise 1–3 days/week" },
                  { value: "moderately-active", label: "Moderately Active", desc: "Moderate exercise 3–5 days/week" },
                  { value: "very-active", label: "Very Active", desc: "Hard exercise 6–7 days/week" },
                  { value: "extremely-active", label: "Extremely Active", desc: "Physical job + training 2x/day" },
                ].map((option) => (
                  <div key={option.value} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent transition-colors duration-200">
                    <RadioGroupItem value={option.value} id={option.value} />
                    <div className="flex-1">
                      <Label htmlFor={option.value} className="font-medium cursor-pointer">{option.label}</Label>
                      <p className="text-sm text-muted-foreground">{option.desc}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-8">
            <div className="space-y-4">
              <Label className="text-base font-medium">What's your primary goal?</Label>
              <div className="bg-blue-50/50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200/50 dark:border-blue-800/50">
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium mb-1">
                  📅 One-Month Timeline
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  All nutrition plans are designed for sustainable progress over one month with healthy, realistic targets.
                </p>
              </div>
              <RadioGroup 
                value={data.primaryGoal} 
                onValueChange={(value) => updateData("primaryGoal", value)}
                className="space-y-3"
              >
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="weight-loss" id="weight-loss" />
                  <Label htmlFor="weight-loss" className="flex-1 cursor-pointer">
                    <div className="font-medium">Weight Loss</div>
                    <div className="text-sm text-muted-foreground">Reduce body weight and body fat</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="muscle-gain" id="muscle-gain" />
                  <Label htmlFor="muscle-gain" className="flex-1 cursor-pointer">
                    <div className="font-medium">Muscle Gain</div>
                    <div className="text-sm text-muted-foreground">Build lean muscle mass</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                  <RadioGroupItem value="maintenance" id="maintenance" />
                  <Label htmlFor="maintenance" className="flex-1 cursor-pointer">
                    <div className="font-medium">Maintenance</div>
                    <div className="text-sm text-muted-foreground">Maintain current weight and health</div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {data.primaryGoal && data.primaryGoal !== "maintenance" && (
              <>
                <div className="space-y-4">
                  <Label htmlFor="targetWeight" className="text-base font-medium">
                    {data.primaryGoal === "weight-loss" ? "Target Weight" : "Target Weight (Optional)"}
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      id="targetWeight"
                      placeholder={data.primaryGoal === "weight-loss" ? "e.g., 150" : "e.g., 180"}
                      value={data.targetWeight}
                      onChange={(e) => updateData("targetWeight", e.target.value)}
                      className="flex-1"
                    />
                    <Badge variant="outline" className="px-3 py-2">
                      {data.weightUnit}
                    </Badge>
                  </div>
                </div>
              </>
            )}
          </div>
        )

      default:
        return null
    }
  }

  // Show loading or redirect if no auth user
  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
        <div className="text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
      <div className="w-full max-w-md">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        <Card className="shadow-xl border-0 bg-card/95 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              {isProfileEdit 
                ? `Updating Your Plan, ${authUser.name || 'there'}! 🔄`
                : `Hi ${authUser.name || 'there'}! 👋`
              }
            </CardTitle>
            <CardDescription>
              {isProfileEdit 
                ? `Step ${currentStep + 1} of ${steps.length}: Update your ${steps[currentStep].title}`
                : `Step ${currentStep + 1} of ${steps.length}: ${steps[currentStep].title}`
              }
            </CardDescription>
            <Progress value={(currentStep + 1) * (100 / steps.length)} className="mt-4" />
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="flex justify-center mb-6">
              <div className="flex space-x-2">
                {steps.map((step, index) => {
                  const StepIcon = step.icon
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ${
                        index === currentStep
                          ? "bg-primary text-primary-foreground scale-110"
                          : index < currentStep
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <StepIcon className="h-5 w-5" />
                    </div>
                  )
                })}
              </div>
            </div>

            {renderStep()}

            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 0}
                className="transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              
              <Button
                onClick={nextStep}
                disabled={!isStepValid() || isLoading}
                className="transition-all duration-200 hover:scale-105"
              >
                {isLoading 
                  ? "Saving..." 
                  : currentStep === steps.length - 1 
                    ? (isProfileEdit ? "Update Plan" : "Complete Setup")
                    : "Next"
                }
                {!isLoading && <ChevronRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

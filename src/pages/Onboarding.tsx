
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { User, Mail, Lock, Scale, Ruler, Activity, Target, ChevronRight, ChevronLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { ThemeToggle } from "@/components/theme-toggle"
import { supabase, type User as UserType, type NutritionPlan } from "@/lib/supabase"
import { useToast } from "@/hooks/use-toast"
import { generateNutritionPlan } from "@/lib/nutritionCalculator"

interface OnboardingData {
  name: string
  email: string
  password: string
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

const steps = [
  { title: "Personal Info", icon: User },
  { title: "Health Metrics", icon: Scale },
  { title: "Activity Level", icon: Activity },
  { title: "Goals", icon: Target },
]

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [data, setData] = useState<OnboardingData>({
    name: "",
    email: "",
    password: "",
    age: "",
    gender: "",
    height: "",
    heightUnit: "ft",
    weight: "",
    weightUnit: "lbs",
    activityLevel: "",
    primaryGoal: "",
    targetWeight: "",
    timeline: "",
  })
  const navigate = useNavigate()
  const { toast } = useToast()

  const updateData = (field: keyof OnboardingData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const saveUserToSupabase = async () => {
    try {
      setIsLoading(true)
      
      // Convert data to match database schema
      const userData: Omit<UserType, 'id' | 'created_at' | 'updated_at'> = {
        name: data.name,
        email: data.email,
        age: parseInt(data.age),
        gender: data.gender,
        height: data.height,
        height_unit: data.heightUnit,
        weight: data.weight,
        weight_unit: data.weightUnit,
        activity_level: data.activityLevel,
        primary_goal: data.primaryGoal,
        target_weight: data.targetWeight || '',
        timeline: data.timeline
      }

      // Save user data first
      const { data: userResult, error: userError } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single()

      if (userError) {
        throw userError
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
        target_weight: data.targetWeight,
        timeline: data.timeline
      }

      const nutritionPlan = generateNutritionPlan(calculationData)

      // Save nutrition plan
      const planData: Omit<NutritionPlan, 'id' | 'created_at' | 'updated_at'> = {
        user_id: userResult.id,
        ...nutritionPlan
      }

      const { error: planError } = await supabase
        .from('nutrition_plans')
        .insert([planData])

      if (planError) {
        throw planError
      }

      toast({
        title: "Welcome to NutriCoach AI!",
        description: "Your personalized nutrition plan has been created successfully.",
      })

      // Navigate to dashboard after successful save
      navigate("/dashboard")
    } catch (error) {
      console.error('Error saving user data:', error)
      toast({
        title: "Error",
        description: "Failed to save your profile. Please try again.",
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
        return data.name && data.email && data.password
      case 1:
        return data.age && data.gender && data.height && data.weight
      case 2:
        return data.activityLevel
      case 3:
        return data.primaryGoal && (data.primaryGoal === "maintenance" || data.targetWeight) && data.timeline
      default:
        return false
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={data.name}
                  onChange={(e) => updateData("name", e.target.value)}
                  className="pl-10 transition-all duration-200 focus:ring-2"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={data.email}
                  onChange={(e) => updateData("email", e.target.value)}
                  className="pl-10 transition-all duration-200 focus:ring-2"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a secure password"
                  value={data.password}
                  onChange={(e) => updateData("password", e.target.value)}
                  className="pl-10 transition-all duration-200 focus:ring-2"
                />
              </div>
            </div>
          </div>
        )

      case 1:
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

      case 2:
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

      case 3:
        return (
          <div className="space-y-6 animate-fade-in">
            <div className="space-y-4">
              <Label className="text-base font-medium">What's your primary goal?</Label>
              <RadioGroup value={data.primaryGoal} onValueChange={(value) => updateData("primaryGoal", value)} className="space-y-3">
                {[
                  { value: "weight-loss", label: "Weight Loss", desc: "Lose weight in a healthy way" },
                  { value: "maintenance", label: "Weight Maintenance", desc: "Maintain current weight" },
                  { value: "muscle-gain", label: "Muscle Gain", desc: "Build muscle and strength" },
                  { value: "general-health", label: "General Health", desc: "Improve overall wellness" },
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

            {data.primaryGoal && data.primaryGoal !== "maintenance" && (
              <div className="space-y-2 animate-fade-in">
                <Label htmlFor="targetWeight">Target Weight ({data.weightUnit})</Label>
                <Input
                  id="targetWeight"
                  placeholder="Enter target weight"
                  value={data.targetWeight}
                  onChange={(e) => updateData("targetWeight", e.target.value)}
                  className="transition-all duration-200 focus:ring-2"
                />
              </div>
            )}

            <div className="space-y-4">
              <Label className="text-base font-medium">Timeline Preference</Label>
              <RadioGroup value={data.timeline} onValueChange={(value) => updateData("timeline", value)} className="space-y-3">
                {[
                  { value: "aggressive", label: "Aggressive", desc: "Faster results, more intensive" },
                  { value: "moderate", label: "Moderate", desc: "Balanced approach" },
                  { value: "gradual", label: "Gradual", desc: "Slow and steady progress" },
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

      default:
        return null
    }
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
              NutriCoach AI
            </CardTitle>
            <CardDescription>
              Step {currentStep + 1} of {steps.length}: {steps[currentStep].title}
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
                    ? "Complete Setup" 
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

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { useNavigate, Link } from "react-router-dom"
import { ThemeToggle } from "@/components/theme-toggle"
import { useToast } from "@/hooks/use-toast"
import { AuthService } from "@/lib/auth"

interface SignUpData {
  name: string
  email: string
  password: string
}

export default function SignUp() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [data, setData] = useState<SignUpData>({
    name: "",
    email: "",
    password: "",
  })
  const navigate = useNavigate()
  const { toast } = useToast()

  const updateData = (field: keyof SignUpData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const handleSignUp = async () => {
    try {
      setIsLoading(true)
      
      const result = await AuthService.signUp(data.email, data.password, data.name)
      
      if (result.user) {
        toast({
          title: "Account Created Successfully!",
          description: "Please check your email to verify your account, then complete your profile setup.",
        })
        
        // Store name temporarily for onboarding
        localStorage.setItem('tempUserName', data.name)
        
        // Navigate to onboarding to complete profile
        navigate("/onboarding")
      }
    } catch (error: any) {
      console.error('Sign up error:', error)
      toast({
        title: "Sign Up Failed",
        description: error.message || "Failed to create account. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid = () => {
    return data.name.trim() && data.email.trim() && data.password.trim() && data.password.length >= 6
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isFormValid()) {
      handleSignUp()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
      <div className="w-full max-w-md">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        
        <Card className="shadow-xl border-0 bg-card/95 backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Welcome to NutriCoach AI
            </CardTitle>
            <CardDescription className="text-lg">
              Create your account to get started with personalized nutrition tracking
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                    required
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
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a secure password (min 6 characters)"
                    value={data.password}
                    onChange={(e) => updateData("password", e.target.value)}
                    className="pl-10 pr-10 transition-all duration-200 focus:ring-2"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-8 w-8 p-0"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {data.password && data.password.length < 6 && (
                  <p className="text-sm text-destructive">Password must be at least 6 characters</p>
                )}
              </div>
              
              <Button
                type="submit"
                className="w-full transition-all duration-200 hover:scale-105"
                disabled={!isFormValid() || isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            </form>
            
            <div className="mt-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link 
                  to="/login" 
                  className="font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Login instead
                </Link>
              </p>
              
              <p className="text-xs text-muted-foreground">
                By creating an account, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
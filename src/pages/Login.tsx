import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Lock, Eye, EyeOff } from "lucide-react"
import { useNavigate, Link } from "react-router-dom"
import { ThemeToggle } from "@/components/theme-toggle"
import { useToast } from "@/hooks/use-toast"
import { AuthService } from "@/lib/auth"

interface LoginData {
  email: string
  password: string
}

export default function Login() {
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [data, setData] = useState<LoginData>({
    email: "",
    password: "",
  })
  const navigate = useNavigate()
  const { toast } = useToast()

  const updateData = (field: keyof LoginData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const handleLogin = async () => {
    try {
      setIsLoading(true)
      
      const result = await AuthService.signIn(data.email, data.password)
      
      if (result.user) {
        toast({
          title: "Welcome back!",
          description: "You have been successfully logged in.",
        })
        
        // Check if user has completed onboarding by looking for user data
        // For now, navigate directly to dashboard
        navigate("/dashboard")
      }
    } catch (error: any) {
      console.error('Login error:', error)
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid = () => {
    return data.email.trim() && data.password.trim()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (isFormValid()) {
      handleLogin()
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
              Welcome Back
            </CardTitle>
            <CardDescription className="text-lg">
              Sign in to your NutriCoach AI account
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                    placeholder="Enter your password"
                    value={data.password}
                    onChange={(e) => updateData("password", e.target.value)}
                    className="pl-10 pr-10 transition-all duration-200 focus:ring-2"
                    required
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
              </div>
              
              <Button
                type="submit"
                className="w-full transition-all duration-200 hover:scale-105"
                disabled={!isFormValid() || isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link 
                  to="/signup" 
                  className="font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Sign up instead
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 
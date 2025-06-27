
import { useLocation, useNavigate } from "react-router-dom"
import { Home, Search, TrendingUp, User } from "lucide-react"
import { Button } from "@/components/ui/button"

const navigationItems = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: Search, label: "Log Food", path: "/food-logging" },
  { icon: TrendingUp, label: "Progress", path: "/progress" },
  { icon: User, label: "Profile", path: "/profile" },
]

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t">
      <div className="flex justify-around items-center py-2 px-4 max-w-md mx-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <Button
              key={item.path}
              variant="ghost"
              size="sm"
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center space-y-1 h-auto py-2 px-3 transition-all duration-200 ${
                isActive 
                  ? "text-primary bg-primary/10 scale-110" 
                  : "text-muted-foreground hover:text-foreground hover:scale-105"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}

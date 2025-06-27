
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress as ProgressBar } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { 
  TrendingUp, 
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

const weightData = [
  { date: "Week 1", weight: 150 },
  { date: "Week 2", weight: 149.2 },
  { date: "Week 3", weight: 148.8 },
  { date: "Week 4", weight: 148.1 },
  { date: "Week 5", weight: 147.5 },
  { date: "Week 6", weight: 147.2 },
]

const dailyNutritionData = [
  { day: "Mon", calories: 1850, protein: 140, carbs: 200, fats: 65, water: 7 },
  { day: "Tue", calories: 1920, protein: 155, carbs: 180, fats: 70, water: 8 },
  { day: "Wed", calories: 1780, protein: 132, carbs: 195, fats: 62, water: 6 },
  { day: "Thu", calories: 2010, protein: 148, carbs: 220, fats: 75, water: 8 },
  { day: "Fri", calories: 1890, protein: 145, carbs: 185, fats: 68, water: 7 },
  { day: "Sat", calories: 2100, protein: 160, carbs: 240, fats: 80, water: 9 },
  { day: "Sun", calories: 1950, protein: 150, carbs: 205, fats: 72, water: 8 },
]

const achievements = [
  { id: 1, title: "7-Day Streak", description: "Logged food for 7 consecutive days", icon: Trophy, earned: true },
  { id: 2, title: "Protein Goal", description: "Hit protein target 5 days this week", icon: Beef, earned: true },
  { id: 3, title: "Hydration Hero", description: "Reached water goal every day", icon: Droplets, earned: false },
  { id: 4, title: "Calorie Control", description: "Stayed within calorie range", icon: Zap, earned: true },
]

export default function Progress() {
  const [selectedPeriod, setSelectedPeriod] = useState("weekly")

  const weeklyGoalCompletion = {
    calories: 85,
    protein: 92,
    carbs: 78,
    fats: 88,
    water: 71
  }

  const currentStreak = 12

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
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="h-6 w-6 text-green-500" />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">-2.8</p>
                <p className="text-sm text-muted-foreground">lbs this month</p>
              </div>
            </CardContent>
          </Card>

          <Card className="transition-all duration-300 hover:shadow-lg hover:scale-105">
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-3">
                <Calendar className="h-6 w-6 text-blue-500" />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{currentStreak}</p>
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
                <p className="text-2xl font-bold">3</p>
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
                <p className="text-2xl font-bold">86%</p>
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
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="date" />
                  <YAxis domain={['dataMin - 1', 'dataMax + 1']} />
                  <Tooltip />
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
                        <Tooltip />
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
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card className="transition-all duration-300 hover:shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5" />
              <span>Achievements</span>
            </CardTitle>
            <CardDescription>Your wellness milestones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map((achievement) => {
                const AchievementIcon = achievement.icon
                return (
                  <div
                    key={achievement.id}
                    className={`flex items-center space-x-4 p-4 rounded-lg border transition-all duration-300 hover:scale-105 ${
                      achievement.earned 
                        ? "bg-primary/10 border-primary/20" 
                        : "bg-muted/20 border-muted opacity-60"
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      achievement.earned ? "bg-primary/20" : "bg-muted/30"
                    }`}>
                      <AchievementIcon className={`h-6 w-6 ${
                        achievement.earned ? "text-primary" : "text-muted-foreground"
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{achievement.title}</h4>
                      <p className="text-sm text-muted-foreground">{achievement.description}</p>
                    </div>
                    {achievement.earned && (
                      <Badge className="bg-primary/20 text-primary hover:bg-primary/30">
                        Earned
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Navigation />
    </div>
  )
}

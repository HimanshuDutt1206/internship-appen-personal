import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from './supabase'
import { format, parseISO, differenceInDays } from 'date-fns'

interface UserData {
  id: number
  name: string
  email: string
  age: number
  gender: string
  height: string
  height_unit: string
  weight: string
  weight_unit: string
  activity_level: string
  primary_goal: string
  target_weight: string
  created_at: string
}

interface NutritionPlan {
  bmr: number
  tdee: number
  target_calories: number
  protein_grams: number
  carbs_grams: number
  fats_grams: number
  water_target: number
  created_at: string
}

interface FoodLog {
  calories: number
  protein: number
  carbs: number
  fats: number
  meal_type: string
  logged_at: string
}

interface WaterLog {
  amount_ml: number
  logged_at: string
}

interface WeightLog {
  weight: number
  weight_unit: string
  logged_date: string
  notes?: string
}

interface WeightPrediction {
  date: string
  weight: number
  motivationalMessage?: string
}

interface PredictionData {
  user: UserData
  nutritionPlan: NutritionPlan
  foodLogs: FoodLog[]
  waterLogs: WaterLog[]
  weightLogs: WeightLog[]
  planCreatedDate: string
  lastWeightLogDate: string | null
}

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_AI_API_KEY || '')

class WeightPredictionService {
  async collectUserData(userId: number): Promise<PredictionData | null> {
    try {
      // Get user data
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userError) throw userError

      // Get nutrition plan
      const { data: nutritionPlan, error: planError } = await supabase
        .from('nutrition_plans')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (planError) throw planError

      // Get all food logs
      const { data: foodLogs, error: foodError } = await supabase
        .from('food_logs')
        .select('calories, protein, carbs, fats, meal_type, logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: true })

      if (foodError) throw foodError

      // Get all water logs
      const { data: waterLogs, error: waterError } = await supabase
        .from('water_logs')
        .select('amount_ml, logged_at')
        .eq('user_id', userId)
        .order('logged_at', { ascending: true })

      if (waterError) throw waterError

      // Get all weight logs
      const { data: weightLogs, error: weightError } = await supabase
        .from('weight_logs')
        .select('weight, weight_unit, logged_date, notes')
        .eq('user_id', userId)
        .order('logged_date', { ascending: true })

      if (weightError) throw weightError

      // Find last weight log date
      const lastWeightLog = weightLogs && weightLogs.length > 0 
        ? weightLogs[weightLogs.length - 1] 
        : null

      return {
        user,
        nutritionPlan,
        foodLogs: foodLogs || [],
        waterLogs: waterLogs || [],
        weightLogs: weightLogs || [],
        planCreatedDate: nutritionPlan.created_at,
        lastWeightLogDate: lastWeightLog?.logged_date || null
      }
    } catch (error) {
      console.error('Error collecting user data:', error)
      return null
    }
  }

  calculateDailyBreakdown(data: PredictionData) {
    const planStartDate = parseISO(data.planCreatedDate)
    const dailyData = new Map<string, {
      day: number
      date: string
      calories: number
      protein: number
      carbs: number
      fats: number
      water: number
      loggedFood: boolean
      loggedWater: boolean
    }>()

    // Group food logs by date
    data.foodLogs.forEach(log => {
      const logDate = format(parseISO(log.logged_at), 'yyyy-MM-dd')
      const dayNumber = differenceInDays(parseISO(log.logged_at), planStartDate)
      
      if (!dailyData.has(logDate)) {
        dailyData.set(logDate, {
          day: dayNumber,
          date: logDate,
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          water: 0,
          loggedFood: false,
          loggedWater: false
        })
      }
      
      const dayData = dailyData.get(logDate)!
      dayData.calories += log.calories
      dayData.protein += log.protein
      dayData.carbs += log.carbs
      dayData.fats += log.fats
      dayData.loggedFood = true
    })

    // Group water logs by date
    data.waterLogs.forEach(log => {
      const logDate = format(parseISO(log.logged_at), 'yyyy-MM-dd')
      const dayNumber = differenceInDays(parseISO(log.logged_at), planStartDate)
      
      if (!dailyData.has(logDate)) {
        dailyData.set(logDate, {
          day: dayNumber,
          date: logDate,
          calories: 0,
          protein: 0,
          carbs: 0,
          fats: 0,
          water: 0,
          loggedFood: false,
          loggedWater: false
        })
      }
      
      const dayData = dailyData.get(logDate)!
      dayData.water += log.amount_ml
      dayData.loggedWater = true
    })

    // Convert to sorted array
    const sortedDailyData = Array.from(dailyData.values()).sort((a, b) => a.day - b.day)

    // Calculate overall statistics
    const totalDays = sortedDailyData.length
    const daysWithFood = sortedDailyData.filter(d => d.loggedFood).length
    const daysWithWater = sortedDailyData.filter(d => d.loggedWater).length
    
    const avgCalories = totalDays > 0 
      ? sortedDailyData.reduce((sum, d) => sum + d.calories, 0) / totalDays 
      : 0
    const adherence = avgCalories > 0 
      ? (avgCalories / data.nutritionPlan.target_calories) * 100 
      : 0

    return {
      dailyData: sortedDailyData,
      summary: {
        totalLoggedDays: totalDays,
        daysWithFood,
        daysWithWater,
        avgCalories: Math.round(avgCalories),
        calorieAdherence: Math.round(adherence * 10) / 10
      }
    }
  }

  createPredictionPrompt(data: PredictionData): string {
    const breakdown = this.calculateDailyBreakdown(data)
    const planStartDate = parseISO(data.planCreatedDate)
    const lastWeightDate = data.lastWeightLogDate ? parseISO(data.lastWeightLogDate) : null
    const lastWeight = data.weightLogs.length > 0 ? data.weightLogs[data.weightLogs.length - 1] : null
    
    // Calculate which day we need to predict from
    const startPredictionDay = lastWeightDate 
      ? differenceInDays(lastWeightDate, planStartDate) + 1
      : 0

    // Calculate the actual date range to predict
    const startPredictionDate = new Date(planStartDate)
    startPredictionDate.setDate(startPredictionDate.getDate() + startPredictionDay)
    
    const endPredictionDate = new Date(planStartDate)
    endPredictionDate.setDate(endPredictionDate.getDate() + 31)

    // Generate the list of dates to predict
    const datesToPredict = []
    for (let day = startPredictionDay; day <= 31; day++) {
      const date = new Date(planStartDate)
      date.setDate(date.getDate() + day)
      datesToPredict.push(format(date, 'yyyy-MM-dd'))
    }

    // Format daily nutrition data for the prompt
    const dailyNutritionData = breakdown.dailyData.length > 0 
      ? breakdown.dailyData.map(day => 
          `Day ${day.day}: ${day.calories}cal, ${Math.round(day.protein)}g protein, ${Math.round(day.carbs)}g carbs, ${Math.round(day.fats)}g fats, ${Math.round(day.water)}ml water ${!day.loggedFood ? '(no food logged)' : ''} ${!day.loggedWater ? '(no water logged)' : ''}`
        ).join('\n')
      : 'No nutrition data logged yet'

    const prompt = `
You are a nutrition and weight tracking expert AI. I need you to predict daily weight progression for a user based on their comprehensive data.

USER PROFILE:
- Age: ${data.user.age}, Gender: ${data.user.gender}
- Height: ${data.user.height} ${data.user.height_unit}
- Starting Weight: ${data.user.weight} ${data.user.weight_unit}
- Current Weight: ${lastWeight ? `${lastWeight.weight} ${lastWeight.weight_unit}` : 'Not logged yet'}
- Target Weight: ${data.user.target_weight} ${data.user.weight_unit}
- Activity Level: ${data.user.activity_level}
- Primary Goal: ${data.user.primary_goal}

NUTRITION PLAN TARGETS:
- BMR: ${data.nutritionPlan.bmr} calories
- TDEE: ${data.nutritionPlan.tdee} calories  
- Target Daily Calories: ${data.nutritionPlan.target_calories}
- Target Protein: ${data.nutritionPlan.protein_grams}g
- Target Carbs: ${data.nutritionPlan.carbs_grams}g
- Target Fats: ${data.nutritionPlan.fats_grams}g
- Target Water: ${data.nutritionPlan.water_target}ml

ACTUAL DAILY NUTRITION INTAKE:
${dailyNutritionData}

SUMMARY STATISTICS:
- Average Daily Calories: ${breakdown.summary.avgCalories} (${breakdown.summary.calorieAdherence}% of target)
- Days with food logs: ${breakdown.summary.daysWithFood}
- Days with water logs: ${breakdown.summary.daysWithWater}
- Total logged days: ${breakdown.summary.totalLoggedDays}

WEIGHT HISTORY:
${data.weightLogs.map(log => `Day ${differenceInDays(parseISO(log.logged_date), planStartDate)}: ${log.weight} ${log.weight_unit}`).join('\n')}

TASK:
Based on the user's daily eating patterns, day-to-day nutrition adherence, goal, and weight history, predict their daily weight for EACH of these specific dates:

EXACT DATES TO PREDICT (one prediction per date):
${datesToPredict.join('\n')}

Latest logged weight: ${lastWeight ? `${lastWeight.weight} ${lastWeight.weight_unit} on ${lastWeight.logged_date}` : 'None'}
Start predicting from: ${format(startPredictionDate, 'yyyy-MM-dd')} (Day ${startPredictionDay})
End predictions on: ${format(endPredictionDate, 'yyyy-MM-dd')} (Day 31)

Analyze the patterns:
1. Daily calorie intake vs target (look for patterns, consistency, over/under-eating days)
2. Weight change correlation with nutrition intake
3. Their goal (${data.user.primary_goal}) and current adherence (${breakdown.summary.calorieAdherence}%)
4. Realistic weight loss/gain rates based on actual calorie deficits/surpluses
5. Consider days with missing logs as maintenance days

Respond with ONLY a JSON array containing exactly ${datesToPredict.length} predictions in this exact format:
[
  {"date": "YYYY-MM-DD", "weight": number},
  {"date": "YYYY-MM-DD", "weight": number}
]

IMPORTANT: 
- Predict for ALL ${datesToPredict.length} dates listed above
- Start from ${lastWeight ? lastWeight.weight : data.user.weight} ${data.user.weight_unit} as your baseline
- Each prediction should be for the exact date format shown above
`

    return prompt
  }

  async generateWeightPredictions(userId: number, userProfile: any): Promise<{ predictions: WeightPrediction[]; motivationalMessage: string }> {
    try {
      // Check if API key is available
      if (!import.meta.env.VITE_GOOGLE_AI_API_KEY) {
        throw new Error('Google AI API key not found. Please add VITE_GOOGLE_AI_API_KEY to your .env.local file.')
      }

      // Collect all user data
      const data = await this.collectUserData(userId)
      if (!data) {
        throw new Error('Failed to collect user data')
      }

      // Check if we have enough data for meaningful predictions
      if (data.weightLogs.length === 0) {
        throw new Error('Need at least one weight log to generate predictions')
      }

      // Create the prediction prompt
      const predictionPrompt = this.createPredictionPrompt(data)
      console.log('Generated prompt for AI (predictions):', predictionPrompt.substring(0, 500) + '...')

      // Call Google AI API for predictions
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      
      console.log('Calling Google AI API for predictions...')
      const predictionResult = await model.generateContent(predictionPrompt)
      const predictionResponse = await predictionResult.response
      const predictionText = predictionResponse.text()
      
      console.log('AI Prediction Response:', predictionText)

      // Parse the JSON response for predictions
      let predictions: WeightPrediction[]
      try {
        const jsonMatch = predictionText.match(/\[[\s\S]*\]/)
        if (!jsonMatch) {
          console.error('Full AI prediction response:', predictionText)
          throw new Error('No valid JSON found in prediction response. The AI may have returned text instead of JSON.')
        }
        predictions = JSON.parse(jsonMatch[0])
      } catch (parseError) {
        console.error('Failed to parse AI prediction response:', predictionText)
        throw new Error(`Invalid response format from AI (predictions): ${parseError}`)
      }

      // Validate predictions
      if (!Array.isArray(predictions) || predictions.length === 0) {
        throw new Error('No predictions returned from AI')
      }

      const validPredictions = predictions.filter(pred => {
        return pred.date && 
               typeof pred.weight === 'number' && 
               pred.weight > 0 && 
               pred.weight < 1000 // Reasonable upper bound
      })

      if (validPredictions.length === 0) {
        throw new Error('No valid predictions found. AI returned invalid data format.')
      }

      console.log(`Successfully generated ${validPredictions.length} weight predictions`)

      // Determine if on track for target weight
      const day31Prediction = validPredictions.find(pred => {
        const dateDiff = differenceInDays(parseISO(pred.date), parseISO(data.nutritionPlan.created_at));
        return dateDiff === 31;
      });

      let onTrack = false;
      if (day31Prediction && userProfile?.target_weight) {
        const targetWeightNum = parseFloat(userProfile.target_weight);
        // Assuming user's goal is weight loss, check if predicted weight is <= target weight
        // Or if the goal is weight gain, check if predicted weight is >= target weight
        if (data.user.primary_goal === 'Lose weight') {
          onTrack = day31Prediction.weight <= targetWeightNum;
        } else if (data.user.primary_goal === 'Gain weight') {
          onTrack = day31Prediction.weight >= targetWeightNum;
        } else { // Maintain weight
          onTrack = Math.abs(day31Prediction.weight - targetWeightNum) < 2; // within 2 units
        }
      }

      // Generate motivational message
      const motivationalPrompt = `
You are a motivational fitness coach AI. Based on the user's weight prediction data, generate a concise motivational message (maximum 2-3 sentences).

User's Primary Goal: ${data.user.primary_goal}
User's Target Weight: ${userProfile?.target_weight} ${userProfile?.weight_unit}
Predicted Weight on Day 31: ${day31Prediction?.weight?.toFixed(1) || 'N/A'} ${userProfile?.weight_unit || ''}
Are they on track to reach their goal by Day 31: ${onTrack ? 'Yes' : 'No'}

Generate a motivational message. If they are on track, tell them they are on track to reach their goal, congratulate them and motivate them to keep going at this good pace. If they are not on track to reach their goal, motivate them to work harder so that they can reach their goal in the time frame.
`
      console.log('Generated prompt for AI (motivational message):', motivationalPrompt.substring(0, 500) + '...')

      const motivationalModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
      console.log('Calling Google AI API for motivational message...')
      const motivationalResult = await motivationalModel.generateContent(motivationalPrompt)
      const motivationalResponse = await motivationalResult.response
      const motivationalText = motivationalResponse.text()

      console.log('AI Motivational Message Response:', motivationalText)

      return { predictions: validPredictions, motivationalMessage: motivationalText };

    } catch (error: any) {
      console.error('Error generating weight predictions or motivational message:', error)
      
      if (error.message?.includes('API_KEY_INVALID')) {
        throw new Error('Invalid Google AI API key. Please check your VITE_GOOGLE_AI_API_KEY.')
      } else if (error.message?.includes('PERMISSION_DENIED')) {
        throw new Error('Permission denied. Please ensure your Google AI API key has the correct permissions.')
      } else if (error.message?.includes('QUOTA_EXCEEDED')) {
        throw new Error('API quota exceeded. Please check your Google AI Studio usage limits.')
      } else if (error.message?.includes('404')) {
        throw new Error('Model not found. The Gemini model may not be available in your region.')
      }
      
      throw error
    }
  }
}

export const weightPredictionService = new WeightPredictionService()
export type { WeightPrediction } 

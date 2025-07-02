interface UserData {
  age: number
  gender: string
  height: string
  height_unit: string
  weight: string
  weight_unit: string
  activity_level: string
  primary_goal: string
  target_weight: string
}

interface NutritionPlan {
  bmr: number
  tdee: number
  target_calories: number
  protein_grams: number
  carbs_grams: number
  fats_grams: number
  protein_calories: number
  carbs_calories: number
  fats_calories: number
  protein_percentage: number
  carbs_percentage: number
  fats_percentage: number
  water_target: number
}

// Convert height to centimeters
function convertHeightToCm(height: string, unit: string): number {
  if (unit === 'cm') {
    return parseFloat(height)
  } else {
    // Handle feet'inches format like "5'8" or just "5.8"
    const heightStr = height.replace(/['"]/g, '')
    if (heightStr.includes('.')) {
      // Handle decimal format like "5.8" (5 feet 8 inches)
      const feet = Math.floor(parseFloat(heightStr))
      const inches = (parseFloat(heightStr) - feet) * 12
      return (feet * 12 + inches) * 2.54
    } else {
      // Handle simple number as feet
      return parseFloat(heightStr) * 30.48
    }
  }
}

// Convert weight to kilograms
function convertWeightToKg(weight: string, unit: string): number {
  const weightNum = parseFloat(weight)
  return unit === 'kg' ? weightNum : weightNum * 0.453592
}

// Calculate BMR using Mifflin-St Jeor Formula
function calculateBMR(weightKg: number, heightCm: number, age: number, gender: string): number {
  const baseCalc = (10 * weightKg) + (6.25 * heightCm) - (5 * age)
  
  switch (gender.toLowerCase()) {
    case 'male':
      return baseCalc + 5
    case 'female':
      return baseCalc - 161
    case 'other':
    case 'prefer-not-to-say':
      return baseCalc - 78 // Fixed value as specified
    default:
      return baseCalc - 161 // Default to female formula
  }
}

// Calculate TDEE with activity multipliers
function calculateTDEE(bmr: number, activityLevel: string): number {
  const multipliers = {
    'sedentary': 1.2,
    'lightly-active': 1.375,
    'moderately-active': 1.55,
    'very-active': 1.725,
    'extremely-active': 1.9
  }
  
  const multiplier = multipliers[activityLevel as keyof typeof multipliers] || 1.55
  return bmr * multiplier
}

// Calculate target calories based on weight difference for ONE MONTH timeline
function calculateTargetCalories(tdee: number, currentWeightKg: number, targetWeightKg: number, goal: string): number {
  // For maintenance, ignore target weight and return TDEE
  if (goal === 'maintenance') {
    return Math.round(tdee)
  }
  
  // Calculate weight difference (positive = gain, negative = loss)
  const weightDelta = targetWeightKg - currentWeightKg
  
  // Convert weight change to total calorie change (1 kg = 7700 kcal)
  const totalCalorieChange = weightDelta * 7700
  
  // Calculate daily calorie adjustment over 30 days
  const dailyCalorieDelta = totalCalorieChange / 30
  
  // Apply adjustment to TDEE (no safety limits)
  const targetCalories = tdee + dailyCalorieDelta
  
  return Math.round(targetCalories)
}

// Calculate macronutrient distribution
function calculateMacros(targetCalories: number, weightKg: number, goal: string): {
  protein_grams: number
  carbs_grams: number
  fats_grams: number
  protein_calories: number
  carbs_calories: number
  fats_calories: number
  protein_percentage: number
  carbs_percentage: number
  fats_percentage: number
} {
  // Calculate protein requirements (priority approach)
  let proteinPerKg: number
  switch (goal) {
    case 'weight-loss':
      proteinPerKg = 2.0 // Higher protein for muscle preservation
      break
    case 'muscle-gain':
      proteinPerKg = 2.2 // Higher protein for muscle building
      break
    default:
      proteinPerKg = 1.6 // Maintenance
  }
  
  const proteinGrams = Math.round(weightKg * proteinPerKg)
  const proteinCalories = proteinGrams * 4
  
  // Calculate fat requirements (25% of calories)
  const fatCalories = Math.round(targetCalories * 0.25)
  const fatGrams = Math.round(fatCalories / 9)
  
  // Calculate carbs (remaining calories, no minimum floor)
  const remainingCalories = targetCalories - proteinCalories - fatCalories
  const carbsCalories = remainingCalories
  const carbsGrams = Math.max(0, Math.round(carbsCalories / 4)) // Clamp to 0 minimum
  
  // Calculate percentages
  const totalCalories = proteinCalories + carbsCalories + fatCalories
  const proteinPercentage = totalCalories > 0 ? Math.round((proteinCalories / totalCalories) * 100) : 0
  const carbsPercentage = totalCalories > 0 ? Math.round((carbsCalories / totalCalories) * 100) : 0
  const fatsPercentage = totalCalories > 0 ? Math.round((fatCalories / totalCalories) * 100) : 0
  
  return {
    protein_grams: proteinGrams,
    carbs_grams: carbsGrams,
    fats_grams: fatGrams,
    protein_calories: proteinCalories,
    carbs_calories: carbsCalories,
    fats_calories: fatCalories,
    protein_percentage: proteinPercentage,
    carbs_percentage: carbsPercentage,
    fats_percentage: fatsPercentage
  }
}

// Calculate comprehensive water intake target
function calculateWaterTarget(weightKg: number, activityLevel: string, primaryGoal: string): number {
  // Base water calculation using weight-based formula
  // Daily Water (liters) = Weight (kg) / 30
  const baseWaterLiters = weightKg / 30
  
  // Activity Level Adjustments
  const activityMultipliers = {
    'sedentary': 1.0,
    'lightly-active': 1.1,    // 10% increase
    'moderately-active': 1.2, // 20% increase
    'very-active': 1.3,       // 30% increase
    'extremely-active': 1.4   // 40% increase
  }
  
  const activityMultiplier = activityMultipliers[activityLevel as keyof typeof activityMultipliers] || 1.0
  let adjustedWater = baseWaterLiters * activityMultiplier
  
  // Goal-Based Modifications
  if (primaryGoal === 'weight-loss') {
    adjustedWater += 0.5 // Additional 500ml for metabolism and appetite control
  } else if (primaryGoal === 'muscle-gain') {
    adjustedWater += 0.75 // Additional 750ml for protein synthesis and recovery
  }
  // maintenance: no additional adjustment
  
  // Convert to milliliters and round
  return Math.round(adjustedWater * 1000)
}

// Main function to generate complete nutrition plan
export function generateNutritionPlan(userData: UserData): NutritionPlan {
  // Convert units
  const currentWeightKg = convertWeightToKg(userData.weight, userData.weight_unit)
  const targetWeightKg = convertWeightToKg(userData.target_weight || userData.weight, userData.weight_unit)
  const heightCm = convertHeightToCm(userData.height, userData.height_unit)
  
  // Calculate BMR and TDEE
  const bmr = calculateBMR(currentWeightKg, heightCm, userData.age, userData.gender)
  const tdee = calculateTDEE(bmr, userData.activity_level)
  
  // Calculate target calories based on weight difference
  const targetCalories = calculateTargetCalories(tdee, currentWeightKg, targetWeightKg, userData.primary_goal)
  
  // Calculate macros
  const macros = calculateMacros(targetCalories, currentWeightKg, userData.primary_goal)
  
  // Calculate water target (simplified - removed age and gender factors)
  const waterTarget = calculateWaterTarget(currentWeightKg, userData.activity_level, userData.primary_goal)
  
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target_calories: targetCalories,
    water_target: waterTarget,
    ...macros
  }
} 
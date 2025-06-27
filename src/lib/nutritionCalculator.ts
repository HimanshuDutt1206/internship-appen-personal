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
  timeline: string
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
      // Use average of male and female formulas
      const maleCalc = baseCalc + 5
      const femaleCalc = baseCalc - 161
      return (maleCalc + femaleCalc) / 2
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

// Calculate target calories based on goals
function calculateTargetCalories(tdee: number, goal: string, timeline: string, gender: string): number {
  let targetCalories = tdee
  
  if (goal === 'weight-loss') {
    const deficits = {
      'aggressive': 750,
      'moderate': 500,
      'gradual': 250
    }
    targetCalories = tdee - (deficits[timeline as keyof typeof deficits] || 500)
  } else if (goal === 'muscle-gain') {
    const surpluses = {
      'aggressive': 500,
      'moderate': 300,
      'gradual': 200
    }
    targetCalories = tdee + (surpluses[timeline as keyof typeof surpluses] || 300)
  }
  // maintenance stays at TDEE
  
  // Apply safety limits
  const minCalories = gender.toLowerCase() === 'male' ? 1500 : 1200
  const maxDeficit = Math.min(tdee - 1000, tdee * 0.25) // Cap at 25% of TDEE or 1000 cal deficit
  
  targetCalories = Math.max(targetCalories, minCalories)
  targetCalories = Math.max(targetCalories, maxDeficit)
  
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
  
  // Calculate fat requirements (25-30% of calories, minimum 20%)
  const fatPercentage = 0.25 // 25% of calories
  const fatCalories = Math.round(targetCalories * fatPercentage)
  const fatGrams = Math.round(fatCalories / 9)
  
  // Calculate carbs (remaining calories)
  const remainingCalories = targetCalories - proteinCalories - fatCalories
  const carbsCalories = Math.max(remainingCalories, 400) // Minimum 100g carbs
  const carbsGrams = Math.round(carbsCalories / 4)
  
  // Calculate percentages
  const totalCalories = proteinCalories + carbsCalories + fatCalories
  const proteinPercentage = Math.round((proteinCalories / totalCalories) * 100)
  const carbsPercentage = Math.round((carbsCalories / totalCalories) * 100)
  const fatsPercentage = Math.round((fatCalories / totalCalories) * 100)
  
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
function calculateWaterTarget(weightKg: number, activityLevel: string, age: number, gender: string, primaryGoal: string): number {
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
  // maintenance and general health: no additional adjustment
  
  // Age Considerations
  if (age >= 31 && age <= 50) {
    adjustedWater += 0.25 // Add 250ml
  } else if (age >= 51) {
    adjustedWater += 0.5 // Add 500ml due to decreased thirst sensation
  }
  // 18-30 years: no adjustment
  
  // Gender Considerations
  let genderFactor = 1.0
  if (gender.toLowerCase() === 'female') {
    genderFactor = 0.9 // Reduce by 10% due to generally lower muscle mass
  } else if (gender.toLowerCase() === 'other' || gender.toLowerCase() === 'prefer-not-to-say') {
    genderFactor = 0.95 // Use average (reduce by 5%)
  }
  // male: use full calculated amount (1.0)
  
  const finalWaterLiters = adjustedWater * genderFactor
  
  // Safety Limits
  const minWaterLiters = 2.0 // Minimum 2.0 liters
  const maxWaterLiters = 4.5 // Maximum 4.5 liters to prevent water intoxication
  
  const safeWaterLiters = Math.max(minWaterLiters, Math.min(maxWaterLiters, finalWaterLiters))
  
  // Convert to milliliters and round
  return Math.round(safeWaterLiters * 1000)
}

// Main function to generate complete nutrition plan
export function generateNutritionPlan(userData: UserData): NutritionPlan {
  // Convert units
  const weightKg = convertWeightToKg(userData.weight, userData.weight_unit)
  const heightCm = convertHeightToCm(userData.height, userData.height_unit)
  
  // Calculate BMR and TDEE
  const bmr = calculateBMR(weightKg, heightCm, userData.age, userData.gender)
  const tdee = calculateTDEE(bmr, userData.activity_level)
  
  // Calculate target calories
  const targetCalories = calculateTargetCalories(tdee, userData.primary_goal, userData.timeline, userData.gender)
  
  // Calculate macros
  const macros = calculateMacros(targetCalories, weightKg, userData.primary_goal)
  
  // Calculate water target
  const waterTarget = calculateWaterTarget(weightKg, userData.activity_level, userData.age, userData.gender, userData.primary_goal)
  
  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    target_calories: targetCalories,
    water_target: waterTarget,
    ...macros
  }
} 
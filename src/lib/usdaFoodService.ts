// USDA FoodData Central API Service
const USDA_API_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY'

export interface USDAFoodSearchResult {
  fdcId: number
  description: string
  brandName?: string
  dataType: string
  foodNutrients: USDANutrient[]
  servingSize?: number
  servingSizeUnit?: string
  householdServingFullText?: string
  brandOwner?: string
}

export interface USDANutrient {
  nutrientId: number
  nutrientName: string
  nutrientNumber: string
  unitName: string
  value: number
}

export interface USDASearchResponse {
  totalHits: number
  currentPage: number
  totalPages: number
  foods: USDAFoodSearchResult[]
}

export interface QuantityOption {
  id: string
  label: string
  value: number // grams
  unit: string
}

export interface CalculatedNutrition {
  calories: number
  protein: number
  carbs: number
  fats: number
  fiber?: number
  sugar?: number
  sodium?: number
}

// Common measurement conversions to grams
const MEASUREMENT_CONVERSIONS: Record<string, number> = {
  'cup': 240, // 1 cup ≈ 240g (varies by food type)
  'tablespoon': 15, // 1 tbsp ≈ 15g
  'teaspoon': 5, // 1 tsp ≈ 5g
  'ounce': 28.35, // 1 oz = 28.35g
  'pound': 453.592, // 1 lb = 453.592g
  'gram': 1,
  'kilogram': 1000,
}

// Food-specific serving sizes (in grams)
const FOOD_SERVING_SIZES: Record<string, number> = {
  'bread': 25, // 1 slice of bread
  'chapati': 40, // 1 medium chapati
  'roti': 40, // 1 medium roti
  'apple': 182, // 1 medium apple
  'banana': 118, // 1 medium banana
  'egg': 50, // 1 large egg
  'chicken breast': 85, // 3 oz serving
}

class USDAFoodService {
  private async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    const url = new URL(`${USDA_API_BASE_URL}${endpoint}`)
    
    // Add API key to params
    params.api_key = USDA_API_KEY
    
    // Add params to URL
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString())
      }
    })

    try {
      const response = await fetch(url.toString())
      
      if (!response.ok) {
        throw new Error(`USDA API error: ${response.status} ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('USDA API request failed:', error)
      throw error
    }
  }

  async searchFoods(query: string, pageSize: number = 5): Promise<USDASearchResponse> {
    try {
      const response = await this.makeRequest('/foods/search', {
        query: query.trim(),
        pageSize,
        pageNumber: 1,
        sortBy: 'dataType.keyword',
        sortOrder: 'asc',
        dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'] // Include multiple data types
      })

      return response
    } catch (error) {
      console.error('Food search failed:', error)
      throw new Error('Failed to search foods. Please try again.')
    }
  }

  async getFoodDetails(fdcId: number): Promise<USDAFoodSearchResult> {
    try {
      const response = await this.makeRequest(`/food/${fdcId}`)
      return response
    } catch (error) {
      console.error('Failed to get food details:', error)
      throw new Error('Failed to get food details. Please try again.')
    }
  }

  generateQuantityOptions(food: USDAFoodSearchResult): QuantityOption[] {
    const options: QuantityOption[] = []
    
    // Standard gram measurements
    options.push(
      { id: 'g-25', label: '25 grams', value: 25, unit: 'g' },
      { id: 'g-50', label: '50 grams', value: 50, unit: 'g' },
      { id: 'g-100', label: '100 grams', value: 100, unit: 'g' },
      { id: 'g-150', label: '150 grams', value: 150, unit: 'g' },
      { id: 'g-200', label: '200 grams', value: 200, unit: 'g' }
    )

    // Add serving size converted to grams if available
    if (food.servingSize && food.servingSizeUnit) {
      const servingInGrams = this.convertToGrams(food.servingSize, food.servingSizeUnit)
      if (servingInGrams > 0) {
        options.push({
          id: 'serving-g',
          label: `${Math.round(servingInGrams)}g (1 serving)`,
          value: servingInGrams,
          unit: 'g'
        })
      }
    }

    // Add household serving converted to grams if available
    if (food.householdServingFullText) {
      const servingSize = this.parseHouseholdServing(food.householdServingFullText)
      if (servingSize > 0) {
        options.push({
          id: 'household-g',
          label: `${Math.round(servingSize)}g (${food.householdServingFullText})`,
          value: servingSize,
          unit: 'g'
        })
      }
    }

    // Add food-specific options converted to grams for countable items
    const foodName = food.description.toLowerCase()
    const matchedFood = Object.keys(FOOD_SERVING_SIZES).find(key => 
      foodName.includes(key)
    )
    
    if (matchedFood) {
      const servingSize = FOOD_SERVING_SIZES[matchedFood]
      options.push(
        { id: `piece-1`, label: `${servingSize}g (1 ${matchedFood})`, value: servingSize, unit: 'g' },
        { id: `piece-2`, label: `${servingSize * 2}g (2 ${matchedFood}s)`, value: servingSize * 2, unit: 'g' },
        { id: `piece-3`, label: `${servingSize * 3}g (3 ${matchedFood}s)`, value: servingSize * 3, unit: 'g' }
      )
    }

    return options
  }

  private convertToGrams(value: number, unit: string): number {
    const unitLower = unit.toLowerCase()
    
    // Direct gram conversion
    if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') {
      return value
    }
    
    // Convert other units to grams using conversion table
    const conversionKey = Object.keys(MEASUREMENT_CONVERSIONS).find(key => 
      unitLower.includes(key) || key.includes(unitLower)
    )
    
    if (conversionKey) {
      return value * MEASUREMENT_CONVERSIONS[conversionKey]
    }
    
    // Default assumption for unknown units (treat as grams)
    return value
  }

  private parseHouseholdServing(servingText: string): number {
    // Try to extract numeric value from serving text
    const match = servingText.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      const value = parseFloat(match[1]);
      // Assume typical serving sizes if no unit is clear
      return value * (servingText.includes('cup') ? 240 : 
                     servingText.includes('tablespoon') ? 15 :
                     servingText.includes('teaspoon') ? 5 : 100);
    }
    return 100; // Default fallback
  }

  calculateNutrition(food: USDAFoodSearchResult, quantityInGrams: number): CalculatedNutrition {
    // All USDA nutrition data is per 100g
    const factor = quantityInGrams / 100;
    
    const getNutrientValue = (nutrientId: number): number => {
      const nutrient = food.foodNutrients.find(n => n.nutrientId === nutrientId)
      return nutrient ? nutrient.value * factor : 0
    }

    return {
      calories: Math.round(getNutrientValue(1008)), // Energy (kcal)
      protein: Math.round(getNutrientValue(1003) * 10) / 10, // Protein
      carbs: Math.round(getNutrientValue(1005) * 10) / 10, // Carbohydrate, by difference
      fats: Math.round(getNutrientValue(1004) * 10) / 10, // Total lipid (fat)
      fiber: Math.round(getNutrientValue(1079) * 10) / 10, // Fiber, total dietary
      sugar: Math.round(getNutrientValue(2000) * 10) / 10, // Sugars, total
      sodium: Math.round(getNutrientValue(1093) * 10) / 10, // Sodium
    }
  }

  formatFoodName(food: USDAFoodSearchResult): string {
    let name = food.description
    
    // Clean up the name
    name = name.replace(/,\s*raw$/i, '') // Remove ", raw" from end
    name = name.replace(/,\s*cooked$/i, '') // Remove ", cooked" from end
    
    // Add brand name if available and not already included
    if (food.brandName && !name.toLowerCase().includes(food.brandName.toLowerCase())) {
      name = `${food.brandName} ${name}`
    }
    
    return name
  }

  getFoodType(food: USDAFoodSearchResult): string {
    switch (food.dataType) {
      case 'Foundation':
        return 'USDA Foundation'
      case 'SR Legacy':
        return 'USDA SR Legacy'
      case 'Survey (FNDDS)':
        return 'USDA Survey'
      case 'Branded':
        return food.brandOwner || 'Branded'
      default:
        return 'USDA'
    }
  }
}

export const usdaFoodService = new USDAFoodService() 
/**
 * Google Places API Service
 * 
 * Provides accurate, real-time bowling alley identification using Google Places API.
 * This is the source of truth for location data, replacing AI inference.
 */

import { createServerSupabaseClient } from './supabase'

/**
 * Result from Google Places Nearby Search + Place Details
 */
export interface BowlingAlleyResult {
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string | null
  website: string | null
  distanceMiles: number
  confidence: number // 0-100
  source: 'google-places'
  placeId: string
  latitude: number
  longitude: number
}

/**
 * Google Places Nearby Search result structure
 */
interface PlacesNearbyResult {
  results: Array<{
    place_id: string
    name: string
    vicinity: string
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
  }>
  status: string
}

/**
 * Google Places Details result structure
 */
interface PlaceDetailsResult {
  result: {
    name: string
    formatted_address: string
    formatted_phone_number?: string
    website?: string
    address_components: Array<{
      long_name: string
      short_name: string
      types: string[]
    }>
    geometry: {
      location: {
        lat: number
        lng: number
      }
    }
  }
  status: string
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in miles
 */
export function distanceMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8 // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * Convert miles to meters for Google Places API
 */
function milesToMeters(miles: number): number {
  return Math.round(miles * 1609.34)
}

/**
 * Parse address components from Google Places API response
 */
function parseAddressComponents(components: PlaceDetailsResult['result']['address_components']) {
  let streetNumber = ''
  let route = ''
  let city = ''
  let state = ''
  let zipCode = ''

  for (const component of components) {
    if (component.types.includes('street_number')) {
      streetNumber = component.long_name
    }
    if (component.types.includes('route')) {
      route = component.long_name
    }
    if (component.types.includes('locality')) {
      city = component.long_name
    }
    if (component.types.includes('administrative_area_level_1')) {
      state = component.short_name
    }
    if (component.types.includes('postal_code')) {
      zipCode = component.long_name
    }
  }

  const address = streetNumber && route ? `${streetNumber} ${route}` : route

  return { address, city, state, zipCode }
}

/**
 * Calculate confidence based on distance
 * - 90-100: within 0.5 miles
 * - 70-89: within 1 mile
 * - 50-69: within 2 miles
 */
function calculateConfidence(distanceMiles: number): number {
  if (distanceMiles <= 0.5) {
    return 95
  } else if (distanceMiles <= 1) {
    return 80
  } else if (distanceMiles <= 2) {
    return 60
  } else {
    return 40
  }
}

/**
 * Call Google Places Nearby Search API
 */
async function nearbySearch(
  latitude: number,
  longitude: number,
  radiusMeters: number
): Promise<PlacesNearbyResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY not configured')
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
  url.searchParams.append('location', `${latitude},${longitude}`)
  url.searchParams.append('radius', radiusMeters.toString())
  url.searchParams.append('type', 'bowling_alley')
  url.searchParams.append('key', apiKey)

  console.log(`🔍 Google Places Nearby Search: ${latitude},${longitude} radius=${radiusMeters}m`)

  const response = await fetch(url.toString())
  const data = await response.json()

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error('❌ Google Places API error:', data.status, data.error_message)
    throw new Error(`Google Places API error: ${data.status}`)
  }

  return data
}

/**
 * Get detailed information about a place
 */
async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResult> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY not configured')
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
  url.searchParams.append('place_id', placeId)
  url.searchParams.append('fields', 'name,formatted_address,formatted_phone_number,website,address_components,geometry')
  url.searchParams.append('key', apiKey)

  console.log(`📋 Google Places Details: ${placeId}`)

  const response = await fetch(url.toString())
  const data = await response.json()

  if (data.status !== 'OK') {
    console.error('❌ Google Places Details API error:', data.status, data.error_message)
    throw new Error(`Google Places Details API error: ${data.status}`)
  }

  return data
}

/**
 * Find the nearest bowling alley using Google Places API
 * 
 * Implements radius expansion logic:
 * 1. Search within 0.5 miles
 * 2. If no results, expand to 1 mile
 * 3. If still no results, expand to 2 miles
 * 4. Return null if no bowling alley found
 */
export async function findNearestBowlingAlley(
  latitude: number,
  longitude: number
): Promise<BowlingAlleyResult | null> {
  try {
    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new Error('Invalid coordinates')
    }

    const radiusSteps = [
      { miles: 0.5, meters: milesToMeters(0.5) },
      { miles: 1, meters: milesToMeters(1) },
      { miles: 2, meters: milesToMeters(2) }
    ]

    let allResults: PlacesNearbyResult['results'] = []

    // Try each radius until we find results
    for (const { miles, meters } of radiusSteps) {
      console.log(`🔍 Searching for bowling alleys within ${miles} mile(s)...`)

      const searchResult = await nearbySearch(latitude, longitude, meters)

      if (searchResult.results && searchResult.results.length > 0) {
        console.log(`✅ Found ${searchResult.results.length} bowling alley(s) within ${miles} mile(s)`)
        allResults = searchResult.results
        break
      }

      console.log(`⚠️ No bowling alleys found within ${miles} mile(s)`)
    }

    if (allResults.length === 0) {
      console.log('❌ No bowling alleys found within 2 miles')
      return null
    }

    // Calculate exact distances and sort by distance
    const resultsWithDistance = allResults.map(result => ({
      ...result,
      distance: distanceMiles(
        latitude,
        longitude,
        result.geometry.location.lat,
        result.geometry.location.lng
      )
    }))

    resultsWithDistance.sort((a, b) => a.distance - b.distance)

    // Get the nearest alley
    const nearest = resultsWithDistance[0]
    console.log(`🎯 Nearest alley: ${nearest.name} at ${nearest.distance.toFixed(2)} miles`)

    // Get detailed information
    const details = await getPlaceDetails(nearest.place_id)
    const { address, city, state, zipCode } = parseAddressComponents(
      details.result.address_components
    )

    const result: BowlingAlleyResult = {
      name: details.result.name,
      address,
      city,
      state,
      zipCode,
      phone: details.result.formatted_phone_number || null,
      website: details.result.website || null,
      distanceMiles: nearest.distance,
      confidence: calculateConfidence(nearest.distance),
      source: 'google-places',
      placeId: nearest.place_id,
      latitude: details.result.geometry.location.lat,
      longitude: details.result.geometry.location.lng
    }

    console.log(`✅ Bowling alley identified: ${result.name}`)
    console.log(`   Address: ${result.address}, ${result.city}, ${result.state} ${result.zipCode}`)
    console.log(`   Distance: ${result.distanceMiles.toFixed(2)} miles`)
    console.log(`   Confidence: ${result.confidence}%`)

    return result

  } catch (error) {
    console.error('❌ Error in findNearestBowlingAlley:', error)
    throw error
  }
}

/**
 * Check if we already have this bowling alley in our database
 * First by place_id, then by approximate coordinates (within ~50m)
 */
export async function findExistingBowlingAlley(
  placeId: string,
  latitude: number,
  longitude: number
): Promise<{ id: string; name: string } | null> {
  const supabase = createServerSupabaseClient()

  // First try to find by place_id (exact match)
  const { data: byPlaceId } = await supabase
    .from('bowling_alleys')
    .select('id, name')
    .eq('google_place_id', placeId)
    .limit(1)
    .single()

  if (byPlaceId) {
    console.log(`✅ Found existing alley by place_id: ${byPlaceId.name}`)
    return byPlaceId
  }

  // Try to find by approximate coordinates (within ~0.0005 degrees ≈ 50m)
  // This handles cases where the same location might have slightly different coordinates
  const latRange = 0.0005
  const lngRange = 0.0005

  const { data: byCoords } = await supabase
    .from('bowling_alleys')
    .select('id, name, latitude, longitude')
    .gte('latitude', latitude - latRange)
    .lte('latitude', latitude + latRange)
    .gte('longitude', longitude - lngRange)
    .lte('longitude', longitude + lngRange)

  if (byCoords && byCoords.length > 0) {
    // Find the closest one
    let closest = byCoords[0]
    let minDistance = distanceMiles(latitude, longitude, byCoords[0].latitude, byCoords[0].longitude)

    for (const alley of byCoords.slice(1)) {
      const dist = distanceMiles(latitude, longitude, alley.latitude, alley.longitude)
      if (dist < minDistance) {
        minDistance = dist
        closest = alley
      }
    }

    // Only consider it a match if within 0.03 miles (≈50m)
    if (minDistance < 0.03) {
      console.log(`✅ Found existing alley by coordinates: ${closest.name} (${minDistance.toFixed(4)} miles away)`)
      return { id: closest.id, name: closest.name }
    }
  }

  console.log('⚠️ No existing alley found in database')
  return null
}

/**
 * Save a bowling alley to the database
 */
export async function saveBowlingAlley(
  result: BowlingAlleyResult,
  userId: string
): Promise<string> {
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('bowling_alleys')
    .insert({
      name: result.name,
      address: result.address,
      city: result.city,
      state: result.state,
      zip_code: result.zipCode,
      phone: result.phone,
      website: result.website,
      google_place_id: result.placeId,
      latitude: result.latitude,
      longitude: result.longitude,
      created_by_user_id: userId
    })
    .select('id')
    .single()

  if (error) {
    console.error('❌ Error saving bowling alley:', error)
    throw error
  }

  console.log(`✅ Saved bowling alley to database: ${data.id}`)
  return data.id
}


import OpenAI from 'openai'
import { supabase, createServerSupabaseClient } from './supabase'
import { ParsedScoreboard } from '@/types/database'
import fs from 'fs'
import path from 'path'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Bowling scoreboard parsing prompt
const BOWLING_SCOREBOARD_PROMPT = `
You are an expert at reading bowling scoreboards. Analyze this bowling scoreboard image and extract the structured data.

CRITICAL SCORE EXTRACTION RULES:
1. A single bowling game score can NEVER exceed 300 (perfect game)
2. Modern bowling displays show TWO types of scores:
   - GAME SCORE: Individual game score (0-300) - THIS IS WHAT WE WANT
   - SERIES TOTAL: Cumulative total across multiple games (can exceed 300) - IGNORE THIS
3. The GAME SCORE is typically displayed closer to the frame boxes
4. SERIES TOTALS are usually displayed separately, often at the top or far right
5. Look for game indicators like "G1", "G2", "G3" to identify which game is being shown
6. If you see a number > 300, it's a SERIES TOTAL - look for the actual game score elsewhere
7. When in doubt, choose the lower number that makes sense for a single game (0-300 range)

CRITICAL GAME COMPLETENESS RULES:
1. Determine if each game is COMPLETE or PARTIAL (in-progress)
2. A game is COMPLETE if the 10th frame has a total score displayed
3. A game is PARTIAL if bowling is still in progress (frames are empty or in-progress)
4. For COMPLETE games: ALL 10 frames MUST have roll data - if any frame is missing, this is a parsing error
5. For PARTIAL games: Only include frames that have been bowled (1-9 frames may be incomplete)
6. If you see a 10th frame score but frames 1-9 are not all visible or parseable, SKIP this bowler entirely
7. Better to exclude a bowler than to include incomplete data for a completed game

CRITICAL TEAM ASSIGNMENT RULES - READ CAREFULLY:
1. ALL bowlers visible on a single scoreboard screen are on the SAME TEAM - this is absolute
2. If you see 5 bowlers listed together on one screen, they are ALL teammates
3. NEVER split bowlers from the same screen into different teams
4. Each scoreboard screen = exactly ONE team

TEAM NAMING RULES:
1. For a SINGLE screen upload, ALWAYS name the team "Team A"
2. This applies even if you see multiple bowlers (they're all on Team A)
3. Team naming examples:
   - First screen uploaded = "Team A"
   - If user uploads a second screen = "Team B" 
   - If user uploads a third screen = "Team C"
   - And so on...
4. Within a single image, ALL bowlers are on the SAME team
5. If you see explicit team labels on the screen (like "Team Tigers"), use those names instead
6. Default pattern: Team A, Team B, Team C, Team D, etc.

CRITICAL: The number of bowlers does NOT determine teams. The screen/scoreboard determines teams.
- 1 bowler on a screen = Team A
- 5 bowlers on a screen = Team A (all 5 are teammates)
- 10 bowlers on a screen = Team A (all 10 are teammates)

Return a JSON object with this exact structure:
{
  "session": {
    "date_time": "ISO string or null if not visible",
    "location": "bowling alley name if visible, or null",
    "lane": "lane number if visible, or null",
    "bowling_alley_name": "name of the bowling alley if visible, or null"
  },
  "teams": [
    {
      "name": "Team A",
      "bowlers": ["Bowler Name 1", "Bowler Name 2", "Bowler Name 3"]
    }
  ],
  "bowlers": [
    {
      "name": "bowler name as it appears on the scoreboard",
      "team": "Team A (REQUIRED - must match a team name from the teams array)",
      "games": [
        {
          "game_number": 1,
          "total_score": 150,
          "frames": [
            {
              "frame_number": 1,
              "roll_1": 5,
              "roll_2": 4,
              "roll_3": null,
              "notation": "5-"
            },
            {
              "frame_number": 2,
              "roll_1": 10,
              "roll_2": null,
              "roll_3": null,
              "notation": "X"
            },
            // ... continue for all 10 frames
          ]
        }
      ]
    }
  ]
}

Rules:
1. Only include bowlers that are clearly visible on the scoreboard
2. For frames: use standard bowling notation (X for strike, / for spare, numbers for pins, - for gutter)
3. If frames are not visible but totals are, set frames to null and include total_score
4. Game numbers should be 1, 2, 3, etc. based on position (or extract from labels like "G1", "G2", "G3")
5. Only include data that is clearly legible - don't guess
6. CRITICAL: Always assign bowlers to teams based on visual grouping on the scoreboard
7. CRITICAL: Every bowler MUST have a "team" field that matches a team name in the teams array
8. The teams array lists which bowlers belong to each team - use this to set each bowler's team field
7. If teams aren't explicitly named, use "Team A", "Team B", etc. based on visual separation
8. The "teams" array should list all teams with their bowler members
9. If date/time/location are not visible, set to null
10. Lane numbers are usually small numbers (1-50 range)
11. CRITICAL: Validate that game scores are between 0-300. If you see a number > 300, it's NOT a game score
12. Look for the score that appears closest to the bowling frames, not cumulative totals
`

export async function parseBowlingScoreboard(imagePath: string): Promise<{
  success: boolean
  parsedData?: ParsedScoreboard
  rawResponse?: any
  error?: string
}> {
  try {
    // Read image file
    const imageBuffer = fs.readFileSync(imagePath)
    const base64Image = imageBuffer.toString('base64')

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: BOWLING_SCOREBOARD_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 4000,
      temperature: 0.1 // Low temperature for more consistent parsing
    })

    const rawContent = response.choices[0]?.message?.content

    if (!rawContent) {
      return {
        success: false,
        error: 'No response from OpenAI'
      }
    }

    // Try to parse JSON from response
    let parsedData: ParsedScoreboard

    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = rawContent.match(/```json\s*(\{[\s\S]*?\})\s*```/) ||
                       rawContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
                       rawContent.match(/(\{[^{}]*\{[^{}]*\}[^{}]*\})/)

      const jsonString = jsonMatch ? jsonMatch[1] : rawContent.trim()
      parsedData = JSON.parse(jsonString)

      // Validate the structure
      if (!parsedData.bowlers || !Array.isArray(parsedData.bowlers)) {
        throw new Error('Invalid bowler data structure')
      }

    } catch (parseError) {
      console.error('JSON parsing error:', parseError)
      return {
        success: false,
        rawResponse: rawContent,
        error: 'Failed to parse JSON from OpenAI response'
      }
    }

    // Validate and clean the parsed data
    const cleanedData = validateAndCleanParsedData(parsedData)

    return {
      success: true,
      parsedData: cleanedData,
      rawResponse: rawContent
    }

  } catch (error) {
    console.error('OpenAI Vision API error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

function validateAndCleanParsedData(data: any): ParsedScoreboard {
  // Validate and clean lane number (must be an integer)
  let laneNumber: number | undefined = undefined
  if (data.session?.lane) {
    if (typeof data.session.lane === 'number') {
      laneNumber = data.session.lane
    } else if (typeof data.session.lane === 'string') {
      const parsed = parseInt(data.session.lane.replace(/\D/g, ''), 10)
      if (!isNaN(parsed) && parsed > 0) {
        laneNumber = parsed
      }
    }
  }

  // Ensure session structure
  const session = {
    date_time: data.session?.date_time || undefined,
    location: data.session?.location || undefined,
    lane: laneNumber,
    bowling_alley_name: data.session?.bowling_alley_name || undefined
  }

  // Clean and validate teams
  const teams = (data.teams || [])
    .filter((team: any) => team.name && typeof team.name === 'string' && Array.isArray(team.bowlers))
    .map((team: any) => ({
      name: team.name.trim(),
      bowlers: team.bowlers.filter((name: any) => typeof name === 'string').map((name: string) => name.trim())
    }))

  // Create a mapping of bowler name -> team name from the teams array
  const bowlerTeamMapping: { [bowlerName: string]: string } = {}
  teams.forEach((team: { name: string; bowlers: string[] }) => {
    team.bowlers.forEach((bowlerName: string) => {
      bowlerTeamMapping[bowlerName.toLowerCase().trim()] = team.name
    })
  })

  // Clean and validate bowlers
  const bowlers = (data.bowlers || [])
    .filter((bowler: any) => bowler.name && typeof bowler.name === 'string')
    .map((bowler: any) => {
      const bowlerName = bowler.name.trim()
      const bowlerNameKey = bowlerName.toLowerCase()

      // Use team from bowler data, or fall back to team mapping from teams array
      const team = bowler.team || bowlerTeamMapping[bowlerNameKey] || null

      return {
        name: bowlerName,
        team: team,
        games: (bowler.games || [])
          .filter((game: any) => {
            // Handle game_number that might be a string like "G3" or a number
            if (typeof game.game_number === 'number') return true
            if (typeof game.game_number === 'string') {
              const parsed = parseInt(game.game_number.replace(/\D/g, ''), 10)
              return !isNaN(parsed) && parsed > 0
            }
            return false
          })
          .map((game: any) => {
            // Normalize game_number to always be a number
            let gameNumber = game.game_number
            if (typeof gameNumber === 'string') {
              console.log(`🔧 Converting game_number from string "${gameNumber}" to number`)
              gameNumber = parseInt(gameNumber.replace(/\D/g, ''), 10)
              console.log(`🔧 Converted to: ${gameNumber}`)
            }
            
            // Validate total_score - must be between 0-300 for a valid game
            let totalScore: number | null = null
            if (game.total_score && typeof game.total_score === 'number') {
              if (game.total_score > 300) {
                console.warn(`⚠️ Invalid score detected for ${bowlerName} Game ${gameNumber}: ${game.total_score} (exceeds 300). This is likely a series total, not a game score. Setting to null.`)
                totalScore = null
              } else if (game.total_score < 0) {
                console.warn(`⚠️ Invalid negative score detected for ${bowlerName} Game ${gameNumber}: ${game.total_score}. Setting to null.`)
                totalScore = null
              } else {
                totalScore = game.total_score
              }
            }
            
            // Process frames
            const processedFrames = game.frames && Array.isArray(game.frames)
                ? game.frames
                    .filter((frame: any) => {
                      // Handle frame_number that might be a string or number
                      if (typeof frame.frame_number === 'number') return true
                      if (typeof frame.frame_number === 'string') {
                        const parsed = parseInt(frame.frame_number.replace(/\D/g, ''), 10)
                        return !isNaN(parsed) && parsed > 0
                      }
                      return false
                    })
                    .map((frame: any) => {
                      // Normalize frame_number to always be a number
                      let frameNumber = frame.frame_number
                      if (typeof frameNumber === 'string') {
                        frameNumber = parseInt(frameNumber.replace(/\D/g, ''), 10)
                      }
                      
                      // Convert roll values from strings to numbers
                      // Handle "X" (strike) = 10, "/" (spare) = calculate from roll_1, "-" = 0
                      const convertRoll = (rollValue: any, previousRoll?: number): number | null => {
                        if (rollValue === null || rollValue === undefined) return null
                        if (typeof rollValue === 'number') return rollValue
                        if (typeof rollValue === 'string') {
                          const trimmed = rollValue.trim()
                          if (trimmed === 'X' || trimmed === 'x') return 10
                          if (trimmed === '-') return 0
                          if (trimmed === '/' && previousRoll !== undefined && previousRoll !== null) {
                            return 10 - previousRoll
                          }
                          // Try to parse as number
                          const parsed = parseInt(trimmed, 10)
                          if (!isNaN(parsed)) return parsed
                        }
                        return null
                      }
                      
                      const roll1 = convertRoll(frame.roll_1)
                      const roll2 = convertRoll(frame.roll_2, roll1 !== null ? roll1 : undefined)
                      const roll3 = convertRoll(frame.roll_3, roll2 !== null ? roll2 : undefined)
                      
                      // Debug logging for spare conversion
                      if (frame.roll_2 === '/' || (typeof frame.roll_2 === 'string' && frame.roll_2.includes('/'))) {
                        console.log(`🎳 Converting spare: Frame ${frameNumber}, roll_1=${frame.roll_1} (converted to ${roll1}), roll_2="${frame.roll_2}" (converted to ${roll2})`)
                      }
                      
                      return {
                        frame_number: frameNumber,
                        roll_1: roll1,
                        roll_2: roll2,
                        roll_3: roll3,
                        notation: frame.notation || null
                      }
                    })
                    .slice(0, 10) // Limit to 10 frames max
                : null
            
            // CRITICAL VALIDATION: Check game completeness
            // If the 10th frame has data, ALL frames 1-10 must exist
            let validatedFrames = processedFrames
            if (processedFrames && processedFrames.length > 0) {
              const has10thFrame = processedFrames.some((f: any) => f.frame_number === 10)
              
              if (has10thFrame) {
                // Game is COMPLETE - validate all frames exist
                const frameNumbers = processedFrames.map((f: any) => f.frame_number).sort((a: number, b: number) => a - b)
                const missingFrames = []
                
                for (let i = 1; i <= 10; i++) {
                  if (!frameNumbers.includes(i)) {
                    missingFrames.push(i)
                  }
                }
                
                if (missingFrames.length > 0) {
                  console.error(`❌ GAME REJECTED: ${bowlerName} Game ${gameNumber} is COMPLETE (has 10th frame) but missing frames: ${missingFrames.join(', ')}. This indicates a parsing error. Returning null frames.`)
                  validatedFrames = null
                  totalScore = null // Also clear the score since the game data is invalid
                }
              } else {
                // Game is PARTIAL - this is OK, only include frames that were bowled
                console.log(`✓ ${bowlerName} Game ${gameNumber} is PARTIAL (in-progress). Frames present: ${processedFrames.map((f: any) => f.frame_number).join(', ')}`)
              }
            }
            
            return {
              game_number: gameNumber,
              total_score: totalScore,
              frames: validatedFrames
            }
          })
      }
    })

  return {
    session,
    teams,
    bowlers
  }
}

// Utility function to get image URL for OpenAI (handles both local files and URLs)
export function getImageUrl(imagePath: string): string {
  // If it's already a URL, return as-is
  if (imagePath.startsWith('http')) {
    return imagePath
  }

  // For local files, convert to absolute path
  const absolutePath = path.resolve(imagePath)

  // In development, we'll need to serve files differently
  // For now, we'll assume the file is accessible via a local server
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const relativePath = path.relative(process.cwd(), absolutePath)

  return `${baseUrl}/${relativePath}`
}

/**
 * Bowling Alley Identification Types
 */
export interface BowlingAlleyInfo {
  name: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  website?: string
  confidence: number // 0-1, how confident we are in the identification
  source: 'google-places' | 'database' | 'manual'
  placeId?: string
  distanceMiles?: number
}

/**
 * Identify bowling alley from GPS coordinates using Google Places API
 * This is the source of truth for location data.
 */
export async function identifyBowlingAlley(
  latitude: number,
  longitude: number,
  userId: string
): Promise<BowlingAlleyInfo | null> {
  try {
    // Import the Google Places service
    const { 
      findNearestBowlingAlley, 
      findExistingBowlingAlley, 
      saveBowlingAlley 
    } = await import('./google-places')

    console.log('🔍 Identifying bowling alley using Google Places API...')

    // Call Google Places API to find the nearest bowling alley
    const googleResult = await findNearestBowlingAlley(latitude, longitude)

    if (!googleResult) {
      console.log('❌ No bowling alley found within 2 miles')
      return null
    }

    // Check if this alley already exists in our database
    const existingAlley = await findExistingBowlingAlley(
      googleResult.placeId,
      googleResult.latitude,
      googleResult.longitude
    )

    if (existingAlley) {
      console.log(`✅ Found existing alley in database: ${existingAlley.name}`)
      return {
        name: googleResult.name,
        address: googleResult.address,
        city: googleResult.city,
        state: googleResult.state,
        zipCode: googleResult.zipCode,
        phone: googleResult.phone || undefined,
        website: googleResult.website || undefined,
        confidence: googleResult.confidence / 100, // Convert to 0-1 scale
        source: 'database',
        placeId: googleResult.placeId,
        distanceMiles: googleResult.distanceMiles
      }
    }

    // Save the new alley to the database
    console.log('💾 Saving new bowling alley to database...')
    try {
      await saveBowlingAlley(googleResult, userId)
    } catch (saveError) {
      console.error('❌ Error saving bowling alley:', saveError)
      // Continue anyway, we can still return the data
    }

    return {
      name: googleResult.name,
      address: googleResult.address,
      city: googleResult.city,
      state: googleResult.state,
      zipCode: googleResult.zipCode,
      phone: googleResult.phone || undefined,
      website: googleResult.website || undefined,
      confidence: googleResult.confidence / 100, // Convert to 0-1 scale
      source: 'google-places',
      placeId: googleResult.placeId,
      distanceMiles: googleResult.distanceMiles
    }

  } catch (error) {
    console.error('❌ Error identifying bowling alley:', error)
    return null
  }
}

/**
 * Get or create bowling alley from GPS coordinates
 * Uses Google Places API as the source of truth
 */
export async function getOrCreateBowlingAlley(
  latitude: number,
  longitude: number,
  userId: string
): Promise<{ alleyId: string | null; alleyInfo: BowlingAlleyInfo | null }> {
  console.log('🏢 getOrCreateBowlingAlley called with:', { latitude, longitude, userId })
  
  try {
    // Import Google Places service
    const { findExistingBowlingAlley } = await import('./google-places')

    // Try to identify the alley using Google Places
    console.log('🔍 Calling identifyBowlingAlley...')
    const alleyInfo = await identifyBowlingAlley(latitude, longitude, userId)
    console.log('🔍 identifyBowlingAlley result:', alleyInfo)

    if (!alleyInfo) {
      console.log('❌ No alley info returned from Google Places')
      return { alleyId: null, alleyInfo: null }
    }

    // If we have a place_id, try to find existing alley by that first
    if (alleyInfo.placeId) {
      console.log('🔍 Checking for existing alley by place_id...')
      const existingByPlaceId = await findExistingBowlingAlley(
        alleyInfo.placeId,
        latitude,
        longitude
      )

      if (existingByPlaceId) {
        console.log('✅ Found existing alley by place_id:', existingByPlaceId.name, 'ID:', existingByPlaceId.id)
        return { alleyId: existingByPlaceId.id, alleyInfo }
      }
    }

    // Fallback: Try to find existing alley by coordinates
    console.log('🔍 Checking for existing alley by coordinates...')
    const { data: existingAlley, error: findError } = await supabase
      .from('bowling_alleys')
      .select('id, name')
      .eq('latitude', latitude)
      .eq('longitude', longitude)
      .limit(1)

    if (findError) {
      console.error('❌ Error finding existing alley:', findError)
      return { alleyId: null, alleyInfo }
    }

    if (existingAlley && existingAlley.length > 0) {
      console.log('✅ Found existing alley by coordinates:', existingAlley[0].name, 'ID:', existingAlley[0].id)
      return { alleyId: existingAlley[0].id, alleyInfo }
    }
    
    console.log('📝 No existing alley found, creating new record...')

    // Alley wasn't found, try to create it
    const { data: newAlley, error: createError } = await supabase
      .from('bowling_alleys')
      .insert({
        name: alleyInfo.name,
        address: alleyInfo.address,
        city: alleyInfo.city,
        state: alleyInfo.state,
        zip_code: alleyInfo.zipCode,
        phone: alleyInfo.phone,
        website: alleyInfo.website,
        google_place_id: alleyInfo.placeId,
        latitude: latitude,
        longitude: longitude,
        created_by_user_id: userId
      })
      .select('id')
      .single()

    if (createError) {
      console.error('❌ Error creating bowling alley:', createError)
      return { alleyId: null, alleyInfo }
    }

    console.log('✅ Created new bowling alley with ID:', newAlley.id)
    return { alleyId: newAlley.id, alleyInfo }

  } catch (error) {
    console.error('❌ Error in getOrCreateBowlingAlley:', error)
    return { alleyId: null, alleyInfo: null }
  }
}

import { createServerSupabaseClient } from './supabase'
import { ParsedScoreboard } from '@/types/database'
import { resolveBowlerName, createNewBowler, BowlerMatch } from './bowler-matching'
import { getOrCreateBowlingAlley } from './vision'

export interface PersistResult {
  success: boolean
  sessionId?: string
  bowlerIds?: string[]
  seriesIds?: string[]
  gameIds?: string[]
  error?: string
}

export interface NameResolutionNeeded {
  parsedName: string
  suggestions: BowlerMatch[]
  bowlerIndex: number // Index in the parsed bowlers array
}

export interface NameResolutionResult {
  needsResolution: boolean
  unresolvedNames: NameResolutionNeeded[]
  resolvedMappings: { [parsedName: string]: string } // parsedName -> bowlerId
}

/**
 * Generate a human-readable session name from a date
 * Example: "Sunday Nov 16 session"
 */
function generateSessionName(dateTime: string): string {
  const date = new Date(dateTime)
  
  // Format: "Sunday Nov 16 session"
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' })
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  
  return `${dayOfWeek} ${month} ${day} session`
}

/**
 * Find an existing session that matches the criteria
 * Matches based on: date/time (within 6 hours), location, and bowler overlap
 */
async function findMatchingSession(
  sessionDateTime: string,
  bowlingAlleyId: string | null,
  location: string | null,
  gpsLat: number | null,
  gpsLng: number | null,
  bowlerNames: string[],
  userId: string,
  supabaseClient: any
): Promise<string | null> {
  try {
    // Look for sessions within 6 hours of the target time
    const targetDate = new Date(sessionDateTime)
    const timeWindowStart = new Date(targetDate.getTime() - 3 * 60 * 60 * 1000) // 3 hours before
    const timeWindowEnd = new Date(targetDate.getTime() + 3 * 60 * 60 * 1000) // 3 hours after

    console.log('🔍 Searching for matching sessions...')
    console.log('  Time window:', timeWindowStart.toISOString(), 'to', timeWindowEnd.toISOString())
    console.log('  Bowling alley ID:', bowlingAlleyId)
    console.log('  Location:', location)
    console.log('  GPS:', gpsLat, gpsLng)
    console.log('  Bowlers:', bowlerNames)

    // Query sessions in the time window
    let query = supabaseClient
      .from('sessions')
      .select(`
        id,
        date_time,
        bowling_alley_id,
        location,
        gps_latitude,
        gps_longitude,
        series (
          id,
          bowler_id,
          bowlers:bowler_id (
            id,
            canonical_name
          )
        )
      `)
      .gte('date_time', timeWindowStart.toISOString())
      .lte('date_time', timeWindowEnd.toISOString())
      .eq('created_by_user_id', userId)

    const { data: sessions, error } = await query

    if (error) {
      console.error('Error querying sessions:', error)
      return null
    }

    if (!sessions || sessions.length === 0) {
      console.log('  No sessions found in time window')
      return null
    }

    // Filter sessions by location proximity
    // GPS coordinates within ~0.001 degrees (~100 meters) are considered same location
    const GPS_THRESHOLD = 0.001
    const candidateSessions = sessions.filter((session: any) => {
      // Match by bowling alley ID if available
      if (bowlingAlleyId && session.bowling_alley_id === bowlingAlleyId) {
        return true
      }
      
      // Match by GPS proximity if available
      if (gpsLat && gpsLng && session.gps_latitude && session.gps_longitude) {
        const latDiff = Math.abs(session.gps_latitude - gpsLat)
        const lngDiff = Math.abs(session.gps_longitude - gpsLng)
        if (latDiff < GPS_THRESHOLD && lngDiff < GPS_THRESHOLD) {
          console.log(`  Session ${session.id} matches GPS (Δlat=${latDiff.toFixed(6)}, Δlng=${lngDiff.toFixed(6)})`)
          return true
        }
      }
      
      // Match by location string if available
      if (location && session.location === location) {
        return true
      }
      
      return false
    })

    if (candidateSessions.length === 0) {
      console.log('  No sessions found matching location criteria')
      return null
    }

    console.log(`  Found ${candidateSessions.length} candidate session(s) matching location`)

    // For multi-team sessions, we need to be smarter about matching:
    // 1. If there's ANY bowler overlap, it's likely the same session (same team, additional games)
    // 2. If there's NO overlap but same time/location, it could be a different team in the same session
    // 3. We'll prefer sessions with overlap, but fall back to the most recent session without overlap
    
    let bestMatchWithOverlap: { id: string; overlap: number } | null = null
    let mostRecentSessionNoOverlap: { id: string; dateTime: string } | null = null

    for (const session of candidateSessions) {
      const sessionBowlerNames = session.series
        ?.map((s: any) => s.bowlers?.canonical_name)
        .filter(Boolean) || []

      // Calculate overlap: how many bowlers from the new upload are in this session?
      const overlap = bowlerNames.filter(name => 
        sessionBowlerNames.some((sessionName: string) => 
          sessionName.toLowerCase() === name.toLowerCase()
        )
      ).length

      console.log(`  Session ${session.id}: ${overlap}/${bowlerNames.length} bowlers match, session has ${sessionBowlerNames.length} bowlers`)

      // If there's ANY overlap, this is likely the same session (same team)
      if (overlap > 0) {
        if (!bestMatchWithOverlap || overlap > bestMatchWithOverlap.overlap) {
          bestMatchWithOverlap = { id: session.id, overlap }
        }
      } else {
        // No overlap - could be a different team
        // Track the most recent session for potential multi-team merge
        if (!mostRecentSessionNoOverlap || session.date_time > mostRecentSessionNoOverlap.dateTime) {
          mostRecentSessionNoOverlap = { id: session.id, dateTime: session.date_time }
        }
      }
    }

    // Prefer sessions with bowler overlap (same team, additional games)
    if (bestMatchWithOverlap) {
      console.log(`✅ Found matching session with bowler overlap: ${bestMatchWithOverlap.id} (${bestMatchWithOverlap.overlap} bowlers match)`)
      return bestMatchWithOverlap.id
    }

    // If no overlap, merge with the most recent session in the time window (different team)
    if (mostRecentSessionNoOverlap) {
      console.log(`✅ Found matching session without overlap (different team): ${mostRecentSessionNoOverlap.id}`)
      return mostRecentSessionNoOverlap.id
    }

    console.log('  No matching session found')
    return null

  } catch (error) {
    console.error('Error finding matching session:', error)
    return null
  }
}

/**
 * Find or create a series for a bowler in a session
 * Returns the series ID and whether games should be appended or replaced
 */
async function findOrCreateSeries(
  sessionId: string,
  bowlerId: string,
  newGames: Array<{ game_number: number }>,
  supabaseClient: any
): Promise<{ seriesId: string; existingGames: number[]; shouldAppend: boolean }> {
  // Check if series already exists for this bowler in this session
  const { data: existingSeries, error: seriesError } = await supabaseClient
    .from('series')
    .select(`
      id,
      games_count,
      games (
        game_number,
        is_partial
      )
    `)
    .eq('session_id', sessionId)
    .eq('bowler_id', bowlerId)
    .single()

  if (seriesError && seriesError.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw new Error(`Failed to query series: ${seriesError.message}`)
  }

  if (existingSeries) {
    console.log(`  Found existing series ${existingSeries.id} for bowler`)
    const existingGameNumbers = existingSeries.games?.map((g: any) => g.game_number) || []
    const newGameNumbers = newGames.map(g => g.game_number)
    
    // Check if any new games would conflict with existing games
    const conflicts = newGameNumbers.filter(n => existingGameNumbers.includes(n))
    
    if (conflicts.length > 0) {
      console.log(`  ⚠️ Game number conflicts detected: ${conflicts.join(', ')}`)
      // For now, we'll skip conflicting games
    }

    return {
      seriesId: existingSeries.id,
      existingGames: existingGameNumbers,
      shouldAppend: true
    }
  }

  // Create new series
  const { data: newSeries, error: createError } = await supabaseClient
    .from('series')
    .insert({
      session_id: sessionId,
      bowler_id: bowlerId,
      games_count: newGames.length
    })
    .select()
    .single()

  if (createError) {
    throw new Error(`Failed to create series: ${createError.message}`)
  }

  console.log(`  Created new series ${newSeries.id} for bowler`)

  return {
    seriesId: newSeries.id,
    existingGames: [],
    shouldAppend: false
  }
}

/**
 * Analyze parsed scoreboard data and determine which bowler names need user resolution
 */
export async function analyzeNameResolution(parsedData: ParsedScoreboard): Promise<NameResolutionResult> {
  const unresolvedNames: NameResolutionNeeded[] = []
  const resolvedMappings: { [parsedName: string]: string } = {}

  for (let i = 0; i < parsedData.bowlers.length; i++) {
    const bowler = parsedData.bowlers[i]
    const resolution = await resolveBowlerName(bowler.name)

    if (resolution.needs_user_input) {
      unresolvedNames.push({
        parsedName: bowler.name,
        suggestions: resolution.suggestions,
        bowlerIndex: i
      })
    } else if (resolution.resolved_bowler_id) {
      resolvedMappings[bowler.name] = resolution.resolved_bowler_id
    }
  }

  return {
    needsResolution: unresolvedNames.length > 0,
    unresolvedNames,
    resolvedMappings
  }
}

/**
 * Create bowler with resolved name mappings
 */
async function createBowlerWithMapping(parsedName: string, resolvedBowlerId: string | null, userId: string, supabaseClient: any): Promise<string> {
  if (resolvedBowlerId) {
    return resolvedBowlerId
  }

  // Create new bowler
  const bowlerId = await createNewBowler(parsedName, userId, supabaseClient)
  if (!bowlerId) {
    throw new Error(`Failed to create bowler: ${parsedName}`)
  }

  return bowlerId
}

/**
 * Persist parsed bowling scoreboard data after name resolution
 */
export async function persistParsedScoreboardWithResolution(
  uploadId: string,
  parsedData: ParsedScoreboard,
  resolvedMappings: { [parsedName: string]: string },
  userId: string,
  supabaseClient?: any
): Promise<PersistResult> {
  console.log('🔄 persistParsedScoreboardWithResolution called with:', {
    uploadId,
    bowlerCount: parsedData.bowlers.length,
    resolvedMappingsCount: Object.keys(resolvedMappings).length,
    userId
  })

  const supabase = supabaseClient || createServerSupabaseClient()
  let sessionId: string | undefined = undefined

  try {
    // 1. Get EXIF data from upload record
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('exif_datetime, exif_location_lat, exif_location_lng')
      .eq('id', uploadId)
      .single()

    if (uploadError) {
      throw new Error(`Failed to fetch upload data: ${uploadError.message}`)
    }

    // 2. Determine session date_time with priority: EXIF > AI parsed > current time
    let sessionDateTime = new Date().toISOString() // fallback

    if (upload.exif_datetime) {
      sessionDateTime = upload.exif_datetime
    } else if (parsedData.session.date_time) {
      sessionDateTime = parsedData.session.date_time
    }

    // 3. Try to identify bowling alley from GPS coordinates
    let bowlingAlleyId: string | null = null
    console.log('🎳 Checking for GPS coordinates in upload:', {
      lat: upload.exif_location_lat,
      lng: upload.exif_location_lng,
      hasLat: !!upload.exif_location_lat,
      hasLng: !!upload.exif_location_lng
    })
    
    if (upload.exif_location_lat && upload.exif_location_lng) {
      console.log('🎳 Attempting to identify bowling alley from GPS coordinates:', upload.exif_location_lat, upload.exif_location_lng)
      try {
        const alleyResult = await getOrCreateBowlingAlley(
          upload.exif_location_lat,
          upload.exif_location_lng,
          userId
        )

        if (alleyResult.alleyId) {
          bowlingAlleyId = alleyResult.alleyId
          console.log('✅ Bowling alley identified and saved:', alleyResult.alleyInfo?.name, 'ID:', alleyResult.alleyId)
        } else if (alleyResult.alleyInfo) {
          console.log('⚠️ Bowling alley identified but not saved:', alleyResult.alleyInfo.name)
        } else {
          console.log('❌ No bowling alley identified from GPS coordinates')
        }
      } catch (error) {
        console.error('❌ Error identifying bowling alley:', error)
      }
    } else {
      console.log('⚠️ No GPS coordinates available - skipping bowling alley identification')
    }

    // Try to find an existing matching session
    const bowlerNames = parsedData.bowlers.map(b => b.name)
    const matchingSessionId = await findMatchingSession(
      sessionDateTime,
      bowlingAlleyId,
      parsedData.session.location || null,
      upload.exif_location_lat,
      upload.exif_location_lng,
      bowlerNames,
      userId,
      supabase
    )

    if (matchingSessionId) {
      console.log(`✅ Using existing session: ${matchingSessionId}`)
      sessionId = matchingSessionId
    } else {
      console.log('📝 Creating new session (no match found)')

      // Generate a human-readable session name
      const sessionName = generateSessionName(sessionDateTime)
      console.log('Generated session name:', sessionName)

      // Validate and clean lane number (must be an integer)
      let laneNumber: number | null = null
      if (parsedData.session.lane) {
        const lane = parsedData.session.lane as any
        if (typeof lane === 'number') {
          laneNumber = lane
        } else if (typeof lane === 'string') {
          const parsed = parseInt(lane.replace(/\D/g, ''), 10)
          if (!isNaN(parsed) && parsed > 0) {
            laneNumber = parsed
          }
        }
      }

      // Create new session
      const sessionData = {
        name: sessionName,
        date_time: sessionDateTime,
        bowling_alley_id: bowlingAlleyId,
        location: parsedData.session.location || null,
        lane: laneNumber,
        bowling_alley_name: parsedData.session.bowling_alley_name || null,
        gps_latitude: upload.exif_location_lat,
        gps_longitude: upload.exif_location_lng,
        created_by_user_id: userId
      }

      const { data: newSession, error: sessionError } = await supabase
        .from('sessions')
        .insert(sessionData)
        .select()
        .single()

      if (sessionError) {
        throw new Error(`Failed to create session: ${sessionError.message}`)
      }

      sessionId = newSession.id
      console.log(`✅ Created new session: ${sessionId}`)
    }

    // 4. Update upload with session_id
    const { error: uploadUpdateError } = await supabase
      .from('uploads')
      .update({ session_id: sessionId })
      .eq('id', uploadId)

    if (uploadUpdateError) {
      throw new Error(`Failed to update upload: ${uploadUpdateError.message}`)
    }

    // 5. Create or find teams if they exist in parsed data
    const teamMap: { [teamName: string]: string } = {} // teamName -> teamId

    if (parsedData.teams && parsedData.teams.length > 0) {
      console.log(`Processing ${parsedData.teams.length} teams for session ${sessionId}`)

      // Get existing teams in this session to determine next team letter
      const { data: existingTeams, error: fetchError } = await supabase
        .from('teams')
        .select('id, name')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })

      if (fetchError) {
        console.error(`Error fetching existing teams: ${fetchError.message}`)
      }

      const existingTeamNames = new Set((existingTeams || []).map((t: any) => t.name))
      console.log(`📋 Existing teams in session: ${Array.from(existingTeamNames).join(', ') || 'none'}`)

      for (const teamData of parsedData.teams) {
        let teamName = teamData.name
        const teamBowlerNames = teamData.bowlers.map(name => name.toLowerCase().trim())

        console.log(`🔍 Processing team "${teamName}" with bowlers: [${teamBowlerNames.join(', ')}]`)

        // Check if an existing team in this session has the SAME bowlers
        let matchingTeam: any = null
        
        if (existingTeams && existingTeams.length > 0) {
          // Fetch team bowlers for each existing team
          for (const existingTeam of existingTeams) {
            const { data: teamBowlersData } = await supabase
              .from('team_bowlers')
              .select(`
                bowler_id,
                bowlers:bowler_id (
                  canonical_name
                )
              `)
              .eq('team_id', existingTeam.id)

            const existingBowlerNames = (teamBowlersData || [])
              .map((tb: any) => tb.bowlers?.canonical_name?.toLowerCase().trim())
              .filter(Boolean)
              .sort()

            const newBowlerNamesSorted = [...teamBowlerNames].sort()

            console.log(`  Comparing with existing team "${existingTeam.name}":`)
            console.log(`    Existing: [${existingBowlerNames.join(', ')}]`)
            console.log(`    New:      [${newBowlerNamesSorted.join(', ')}]`)

            // Check if bowler lists match exactly
            if (existingBowlerNames.length === newBowlerNamesSorted.length &&
                existingBowlerNames.every((name, idx) => name === newBowlerNamesSorted[idx])) {
              matchingTeam = existingTeam
              console.log(`  ✅ Found matching team by bowlers: ${existingTeam.name} (${existingTeam.id})`)
              break
            }
          }
        }

        if (matchingTeam) {
          // Reuse existing team with same bowlers
          teamMap[teamData.name] = matchingTeam.id
          console.log(`✅ Reusing team ${matchingTeam.id} (${matchingTeam.name}) for "${teamData.name}"`)
        } else {
          // No matching team found, need to create a new one
          
          // If AI assigned "Team A" but Team A already exists, reassign to next available letter
          if (teamName === 'Team A' && existingTeamNames.has('Team A')) {
            // Find next available team letter
            let nextLetter = 'B'
            while (existingTeamNames.has(`Team ${nextLetter}`)) {
              nextLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1)
            }
            teamName = `Team ${nextLetter}`
            console.log(`🔄 Team A already exists with different bowlers, assigning to ${teamName}`)
          }

          // Create new team
          const { data: team, error: teamError } = await supabase
            .from('teams')
            .insert({
              name: teamName,
              session_id: sessionId,
              created_by_user_id: userId
            })
            .select()
            .single()

          if (teamError) {
            throw new Error(`Failed to create team ${teamName}: ${teamError.message}`)
          }

          teamMap[teamData.name] = team.id
          existingTeamNames.add(teamName) // Add to set for next iteration
          console.log(`✅ Created new team ${team.id} for ${teamName}`)
        }
      }
    }

    // Ensure sessionId is defined before proceeding
    if (!sessionId) {
      throw new Error('Session ID is not defined. This should not happen.')
    }

    const bowlerIds: string[] = []
    const seriesIds: string[] = []
    const gameIds: string[] = []

    console.log(`Processing ${parsedData.bowlers.length} bowlers for session ${sessionId}`)

    // 6. Create bowlers with resolved mappings
    for (const bowlerData of parsedData.bowlers) {
      const resolvedBowlerId = resolvedMappings[bowlerData.name]

      const bowlerId = await createBowlerWithMapping(bowlerData.name, resolvedBowlerId, userId, supabase)
      bowlerIds.push(bowlerId)
      console.log(`Created bowler ${bowlerId} for ${bowlerData.name}`)

      // Determine bowler's team - check explicit field first, then infer from teams array
      let bowlerTeamName = bowlerData.team
      console.log(`🔍 Bowler ${bowlerData.name}: explicit team field = "${bowlerTeamName}"`)
      
      if (!bowlerTeamName && parsedData.teams) {
        // Find which team this bowler belongs to
        const teamForBowler = parsedData.teams.find(t => t.bowlers.includes(bowlerData.name))
        if (teamForBowler) {
          bowlerTeamName = teamForBowler.name
          console.log(`🔍 Inferred team "${bowlerTeamName}" for bowler ${bowlerData.name} from teams array`)
        }
      }

      console.log(`🎯 Final team for ${bowlerData.name}: "${bowlerTeamName}", teamMap has this team: ${bowlerTeamName ? !!teamMap[bowlerTeamName] : false}, teamId: ${bowlerTeamName ? teamMap[bowlerTeamName] : 'N/A'}`)

      // Associate bowler with team if they have one
      if (bowlerTeamName && teamMap[bowlerTeamName]) {
        // Check if association already exists
        const { data: existingAssociation } = await supabase
          .from('team_bowlers')
          .select('id')
          .eq('team_id', teamMap[bowlerTeamName])
          .eq('bowler_id', bowlerId)
          .maybeSingle()

        if (existingAssociation) {
          console.log(`✅ Bowler ${bowlerData.name} already associated with team ${bowlerTeamName} (association id: ${existingAssociation.id})`)
        } else {
          console.log(`📝 Creating team_bowler association: team_id=${teamMap[bowlerTeamName]}, bowler_id=${bowlerId}`)
          const { data: newAssociation, error: teamBowlerError } = await supabase
            .from('team_bowlers')
            .insert({
              team_id: teamMap[bowlerTeamName],
              bowler_id: bowlerId
            })
            .select()

          if (teamBowlerError) {
            console.error(`❌ Failed to associate bowler ${bowlerData.name} with team ${bowlerTeamName}:`, teamBowlerError)
          } else {
            console.log(`✅ Associated bowler ${bowlerData.name} with team ${bowlerTeamName} (new association:`, newAssociation, ')')
          }
        }
      } else {
        console.warn(`⚠️ No team found for bowler ${bowlerData.name} - teamName: "${bowlerTeamName}", in teamMap: ${bowlerTeamName ? bowlerTeamName in teamMap : false}`)
        console.warn(`⚠️ Available teams in teamMap:`, Object.keys(teamMap))
      }

      // Find or create series for this bowler
      const seriesInfo = await findOrCreateSeries(
        sessionId,
        bowlerId,
        bowlerData.games,
        supabase
      )

      const seriesId = seriesInfo.seriesId
      seriesIds.push(seriesId)

      // Create games and frames for this bowler
      console.log(`Processing ${bowlerData.games.length} games for bowler ${bowlerData.name}`)
      for (const gameData of bowlerData.games) {
        let gameId: string
        let shouldCreateFrames = false

        // Check if this game already exists in the series
        if (seriesInfo.existingGames.includes(gameData.game_number)) {
          // Game exists - check if we need to update it with frame data
          const { data: existingGame } = await supabase
            .from('games')
            .select('id, is_partial')
            .eq('series_id', seriesId)
            .eq('game_number', gameData.game_number)
            .single()

          if (existingGame) {
            gameId = existingGame.id
            
            // If existing game is partial but new data has frames, update it
            if (existingGame.is_partial && gameData.frames && gameData.frames.length > 0) {
              console.log(`  🔄 Updating game ${gameData.game_number} with frame data (was partial)`)
              
              const { error: updateError } = await supabase
                .from('games')
                .update({
                  total_score: gameData.total_score,
                  is_partial: false
                })
                .eq('id', gameId)

              if (updateError) {
                console.error(`  ❌ Failed to update game: ${updateError.message}`)
              }
              
              shouldCreateFrames = true
            } else {
              console.log(`  ⏭️  Skipping game ${gameData.game_number} (already complete)`)
              continue
            }
          } else {
            console.log(`  ⏭️  Skipping game ${gameData.game_number} (exists but couldn't fetch)`)
            continue
          }
        } else {
          // Create new game
          console.log(`  Creating game ${gameData.game_number} with score ${gameData.total_score}`)

          const { data: game, error: gameError } = await supabase
            .from('games')
            .insert({
              series_id: seriesId,
              game_number: gameData.game_number,
              bowler_id: bowlerId,
              total_score: gameData.total_score,
              is_partial: !gameData.frames || gameData.frames.length === 0
            })
            .select()
            .single()

          if (gameError) {
            throw new Error(`Failed to create game: ${gameError.message}`)
          }

          gameId = game.id
          console.log(`  ✅ Created game ${gameId} for game ${gameData.game_number}`)
          gameIds.push(gameId)
          shouldCreateFrames = true
        }

        // Create frames if available and needed
        if (shouldCreateFrames && gameData.frames && gameData.frames.length > 0) {
          // First, check if frames already exist (in case of race conditions)
          const { data: existingFrames } = await supabase
            .from('frames')
            .select('id')
            .eq('game_id', gameId)

          if (existingFrames && existingFrames.length > 0) {
            console.log(`  Frames already exist for game ${gameData.game_number}, skipping frame creation`)
          } else {
            console.log(`  Creating ${gameData.frames.length} frames for game ${gameData.game_number}`)
            const frameInserts = gameData.frames.map(frame => {
              // Debug logging for spare frames
              if (frame.notation && frame.notation.includes('/')) {
                console.log(`  🎳 Inserting spare frame: Frame ${frame.frame_number}, roll_1=${frame.roll_1}, roll_2=${frame.roll_2}, notation="${frame.notation}"`)
              }
              return {
                game_id: gameId,
                frame_number: frame.frame_number,
                roll_1: frame.roll_1,
                roll_2: frame.roll_2,
                roll_3: frame.roll_3,
                notation: frame.notation
              }
            })

            const { error: framesError } = await supabase
              .from('frames')
              .insert(frameInserts)

            if (framesError) {
              throw new Error(`Failed to create frames: ${framesError.message}`)
            }
            console.log(`  ✅ Created ${gameData.frames.length} frames for game ${gameData.game_number}`)
          }
        }
      }

      // Update series games_count if we appended games
      if (seriesInfo.shouldAppend) {
        const totalGames = seriesInfo.existingGames.length + 
          bowlerData.games.filter(g => !seriesInfo.existingGames.includes(g.game_number)).length

        const { error: updateError } = await supabase
          .from('series')
          .update({ games_count: totalGames })
          .eq('id', seriesId)

        if (updateError) {
          console.warn(`Failed to update series games_count: ${updateError.message}`)
        } else {
          console.log(`  ✅ Updated series games_count to ${totalGames}`)
        }
      }
    }

    return {
      success: true,
      sessionId,
      bowlerIds,
      seriesIds,
      gameIds
    }

  } catch (error) {
    console.error('Database persistence error:', error)
    return {
      sessionId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

/**
 * Persist parsed bowling scoreboard data to the database
 * For Phase 1: Single session with bowlers, games, and frames
 * @deprecated Use analyzeNameResolution + persistParsedScoreboardWithResolution instead
 */
export async function persistParsedScoreboard(
  uploadId: string,
  parsedData: ParsedScoreboard,
  userId: string
): Promise<PersistResult> {
  const supabase = createServerSupabaseClient()

  try {
    // Start a transaction-like approach (Supabase doesn't support explicit transactions in this context)
    // We'll create related records and rollback on error

    // 1. Create the session
    const sessionData = {
      date_time: parsedData.session.date_time || new Date().toISOString(),
      location: parsedData.session.location,
      lane: parsedData.session.lane,
      bowling_alley_name: parsedData.session.bowling_alley_name,
      created_by_user_id: userId
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert(sessionData)
      .select()
      .single()

    if (sessionError) {
      throw new Error(`Failed to create session: ${sessionError.message}`)
    }

    // 2. Update upload with session_id
    const { error: uploadUpdateError } = await supabase
      .from('uploads')
      .update({ session_id: session.id })
      .eq('id', uploadId)

    if (uploadUpdateError) {
      throw new Error(`Failed to update upload: ${uploadUpdateError.message}`)
    }

    const bowlerIds: string[] = []
    const seriesIds: string[] = []
    const gameIds: string[] = []

    // 3. Create bowlers and their games
    for (const bowlerData of parsedData.bowlers) {
      // Create bowler (simplified for Phase 1 - no alias resolution yet)
      const { data: bowler, error: bowlerError } = await supabase
        .from('bowlers')
        .insert({
          canonical_name: bowlerData.name,
          created_by_user_id: userId
        })
        .select()
        .single()

      if (bowlerError) {
        throw new Error(`Failed to create bowler: ${bowlerError.message}`)
      }

      bowlerIds.push(bowler.id)

      // Create series for this bowler in this session
      const { data: series, error: seriesError } = await supabase
        .from('series')
        .insert({
          session_id: session.id,
          bowler_id: bowler.id,
          games_count: bowlerData.games.length
        })
        .select()
        .single()

      if (seriesError) {
        throw new Error(`Failed to create series: ${seriesError.message}`)
      }

      seriesIds.push(series.id)

      // Create games and frames for this bowler
      for (const gameData of bowlerData.games) {
        const { data: game, error: gameError } = await supabase
          .from('games')
          .insert({
            series_id: series.id,
            game_number: gameData.game_number,
            bowler_id: bowler.id,
            total_score: gameData.total_score,
            is_partial: !gameData.frames || gameData.frames.length === 0
          })
          .select()
          .single()

        if (gameError) {
          throw new Error(`Failed to create game: ${gameError.message}`)
        }

        gameIds.push(game.id)
        console.log(`Created game ${game.id} for game ${gameData.game_number}`)

        // Create frames if available
        if (gameData.frames && gameData.frames.length > 0) {
          const frameInserts = gameData.frames.map(frame => ({
            game_id: game.id,
            frame_number: frame.frame_number,
            roll_1: frame.roll_1,
            roll_2: frame.roll_2,
            roll_3: frame.roll_3,
            notation: frame.notation
          }))

          const { error: framesError } = await supabase
            .from('frames')
            .insert(frameInserts)

          if (framesError) {
            throw new Error(`Failed to create frames: ${framesError.message}`)
          }
        }
      }
    }

    return {
      success: true,
      sessionId: session.id,
      bowlerIds,
      seriesIds,
      gameIds
    }

  } catch (error) {
    console.error('Database persistence error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

/**
 * Get bowler statistics
 */
export async function getBowlerStats(bowlerId: string) {
  const supabase = createServerSupabaseClient()

  try {
    const { data, error } = await supabase
      .rpc('get_bowler_stats', { bowler_uuid: bowlerId })

    if (error) {
      throw error
    }

    return data?.[0] || null
  } catch (error) {
    console.error('Error getting bowler stats:', error)
    return null
  }
}

/**
 * Get session details with bowlers and games
 */
export async function getSessionDetails(sessionId: string) {
  const supabase = createServerSupabaseClient()

  try {
    // Get session info
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (sessionError) throw sessionError

    // Get series with bowler info
    const { data: series, error: seriesError } = await supabase
      .from('series')
      .select(`
        *,
        bowlers: bowler_id (
          id,
          canonical_name
        )
      `)
      .eq('session_id', sessionId)

    if (seriesError) throw seriesError

    // Get games with frames
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        *,
        frames (*)
      `)
      .in('series_id', series.map(s => s.id))
      .order('game_number')

    if (gamesError) throw gamesError

    return {
      success: true,
      
      session,
      series,
      games
    }
  } catch (error) {
    console.error('Error getting session details:', error)
    return null
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

/**
 * Public API endpoint for dashboard statistics
 * No authentication required - all data is read-only
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()

    // Get total sessions (using select instead of head for count)
    const { data: sessionsData, count: totalSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id', { count: 'exact' })

    if (sessionsError) throw sessionsError

    // Get total games
    const { count: totalGames, error: gamesError } = await supabase
      .from('games')
      .select('id', { count: 'exact' })

    if (gamesError) throw gamesError

    // Get total bowlers (with at least one game)
    const { count: totalBowlers, error: bowlersError } = await supabase
      .from('bowlers')
      .select('id, games!inner(id)', { count: 'exact' })

    if (bowlersError) throw bowlersError

    // Get total bowling alleys
    const { count: totalAlleys, error: alleysError } = await supabase
      .from('bowling_alleys')
      .select('id', { count: 'exact' })

    if (alleysError) throw alleysError

    // Get highest game score - two-step process
    const { data: highestGameSimple, error: highestGameError } = await supabase
      .from('games')
      .select('id, game_number, total_score, bowler_id, series_id')
      .not('total_score', 'is', null)
      .order('total_score', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (highestGameError && highestGameError.code !== 'PGRST116') throw highestGameError

    let highestGame = null
    if (highestGameSimple) {
      // Get bowler and session details
      const { data: bowlerData } = await supabase
        .from('bowlers')
        .select('canonical_name')
        .eq('id', highestGameSimple.bowler_id)
        .single()

      const { data: seriesData } = await supabase
        .from('series')
        .select('session_id')
        .eq('id', highestGameSimple.series_id)
        .single()

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id, date_time')
        .eq('id', seriesData?.session_id)
        .single()

      highestGame = {
        ...highestGameSimple,
        bowlers: bowlerData,
        series: {
          sessions: sessionData
        }
      }
    }

    // Get highest series - two-step process
    const { data: highestSeriesSimple, error: highestSeriesError } = await supabase
      .from('series')
      .select('id, series_total, bowler_id, session_id')
      .order('series_total', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (highestSeriesError && highestSeriesError.code !== 'PGRST116') throw highestSeriesError

    let highestSeries = null
    if (highestSeriesSimple) {
      // Get bowler and session details
      const { data: bowlerData } = await supabase
        .from('bowlers')
        .select('canonical_name')
        .eq('id', highestSeriesSimple.bowler_id)
        .single()

      const { data: sessionData } = await supabase
        .from('sessions')
        .select('id, date_time')
        .eq('id', highestSeriesSimple.session_id)
        .single()

      highestSeries = {
        ...highestSeriesSimple,
        bowlers: bowlerData,
        sessions: sessionData
      }
    }

    // Get recent sessions (last 5) - two-step process like /api/sessions
    // Step 1: Get session IDs
    const { data: recentSessionIds, error: recentIdsError } = await supabase
      .from('sessions')
      .select('id, date_time')
      .order('date_time', { ascending: false })
      .limit(5)

    if (recentIdsError) throw recentIdsError

    // Step 2: Get full data with nested relations
    let recentSessions = []
    if (recentSessionIds && recentSessionIds.length > 0) {
      const ids = recentSessionIds.map(s => s.id)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select(`
          id,
          name,
          date_time,
          bowling_alleys(name),
          bowling_alley_name,
          series(
            bowlers(canonical_name)
          )
        `)
        .in('id', ids)
        .order('date_time', { ascending: false })

      if (sessionsError) throw sessionsError
      recentSessions = sessionsData || []
    }

    // Calculate average score across all games
    const { data: avgScoreData, error: avgScoreError } = await supabase
      .rpc('calculate_average_score')

    // If the function doesn't exist, calculate manually
    let averageScore = 0
    if (avgScoreError || !avgScoreData) {
      const { data: allGames, error: allGamesError } = await supabase
        .from('games')
        .select('total_score')

      if (!allGamesError && allGames && allGames.length > 0) {
        // Filter null scores in application code instead of query
        const validGames = allGames.filter(g => g.total_score !== null)
        if (validGames.length > 0) {
          const sum = validGames.reduce((acc, game) => acc + (game.total_score || 0), 0)
          averageScore = Math.round(sum / validGames.length)
        }
      }
    } else {
      averageScore = avgScoreData
    }

    // Get top bowlers by average - two-step process
    const { data: topBowlers, error: topBowlersError } = await supabase
      .rpc('get_top_bowlers', { limit_count: 5 })

    // If function doesn't exist, fetch manually
    let topBowlersList = []
    if (topBowlersError || !topBowlers) {
      // Step 1: Get all bowler IDs
      const { data: bowlerIds, error: bowlerIdsError } = await supabase
        .from('bowlers')
        .select('id, canonical_name')
        .limit(100)

      if (!bowlerIdsError && bowlerIds && bowlerIds.length > 0) {
        // Step 2: Get games for these bowlers
        const ids = bowlerIds.map(b => b.id)
        const { data: gamesData, error: gamesError } = await supabase
          .from('games')
          .select('bowler_id, total_score')
          .in('bowler_id', ids)

        if (!gamesError && gamesData) {
          // Group games by bowler
          const gamesByBowler: { [key: string]: number[] } = {}
          gamesData.forEach((game: any) => {
            if (game.total_score !== null) {
              if (!gamesByBowler[game.bowler_id]) {
                gamesByBowler[game.bowler_id] = []
              }
              gamesByBowler[game.bowler_id].push(game.total_score)
            }
          })

          // Calculate averages
          topBowlersList = bowlerIds
            .map((bowler: any) => {
              const scores = gamesByBowler[bowler.id]
              if (!scores || scores.length === 0) return null

              const avg = scores.reduce((sum: number, score: number) => sum + score, 0) / scores.length
              return {
                id: bowler.id,
                name: bowler.canonical_name,
                average_score: Math.round(avg),
                game_count: scores.length
              }
            })
            .filter(Boolean)
            .sort((a: any, b: any) => b.average_score - a.average_score)
            .slice(0, 5)
        }
      }
    } else {
      topBowlersList = topBowlers
    }

    return NextResponse.json({
      stats: {
        totalSessions: totalSessions || 0,
        totalGames: totalGames || 0,
        totalBowlers: totalBowlers || 0,
        totalAlleys: totalAlleys || 0,
        averageScore,
        highestGame: highestGame ? {
          score: highestGame.total_score,
          gameNumber: highestGame.game_number,
          bowler: (highestGame.bowlers as any)?.canonical_name,
          bowlerId: highestGame.bowler_id,
          sessionId: (highestGame.series as any)?.sessions?.id,
          date: (highestGame.series as any)?.sessions?.date_time
        } : null,
        highestSeries: highestSeries ? {
          score: highestSeries.series_total,
          bowler: (highestSeries.bowlers as any)?.canonical_name,
          bowlerId: highestSeries.bowler_id,
          sessionId: (highestSeries.sessions as any)?.id,
          date: (highestSeries.sessions as any)?.date_time
        } : null
      },
      recentSessions: recentSessions?.map((session: any) => ({
        id: session.id,
        name: session.name,
        date: session.date_time,
        alley: session.bowling_alleys?.name || session.bowling_alley_name,
        bowlerCount: new Set(session.series?.map((s: any) => s.bowlers?.canonical_name)).size
      })) || [],
      topBowlers: topBowlersList
    })

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch dashboard statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


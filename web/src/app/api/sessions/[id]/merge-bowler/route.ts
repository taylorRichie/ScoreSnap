import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('🔄 API /sessions/[id]/merge-bowler called')

  try {
    const sessionId = params.id
    const body = await request.json()
    const { seriesId, targetBowlerId, createNewBowler, newBowlerName } = body

    if (!seriesId) {
      return NextResponse.json(
        { error: 'seriesId is required' },
        { status: 400 }
      )
    }

    if (!targetBowlerId && !createNewBowler) {
      return NextResponse.json(
        { error: 'targetBowlerId or createNewBowler is required' },
        { status: 400 }
      )
    }

    if (createNewBowler && !newBowlerName) {
      return NextResponse.json(
        { error: 'newBowlerName is required when creating new bowler' },
        { status: 400 }
      )
    }

    // Get the authorization token from the request
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    const sessionToken = authHeader.substring(7)

    // Create client with the user's session token
    const { createClient } = await import('@supabase/supabase-js')
    const userClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${sessionToken}`
          }
        }
      }
    )

    // Get the authenticated user
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    // Use service role client for database operations (to bypass RLS where needed)
    const supabase = createServerSupabaseClient()

    // Verify user has access to this session
    const { data: session, error: sessionError } = await userClient
      .from('sessions')
      .select('id, created_by_user_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Check if user created this session or has an upload in it
    const { data: uploads } = await userClient
      .from('uploads')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .limit(1)

    if (session.created_by_user_id !== user.id && (!uploads || uploads.length === 0)) {
      return NextResponse.json(
        { error: 'Unauthorized to modify this session' },
        { status: 403 }
      )
    }

    // Get the series with its current bowler and games (use userClient to respect RLS)
    const { data: seriesData, error: seriesError } = await userClient
      .from('series')
      .select(`
        id,
        bowler_id,
        original_parsed_name,
        bowlers!inner (
          id,
          canonical_name
        ),
        games (
          id,
          total_score
        )
      `)
      .eq('id', seriesId)
      .eq('session_id', sessionId)
      .single()

    if (seriesError || !seriesData) {
      console.error('Series fetch error:', seriesError)
      return NextResponse.json(
        { error: 'Series not found in this session' },
        { status: 404 }
      )
    }

    const fromBowlerId = seriesData.bowler_id
    const originalName = seriesData.original_parsed_name || (seriesData.bowlers as any).canonical_name

    let finalTargetBowlerId = targetBowlerId

    // If creating a new bowler, create it first
    if (createNewBowler) {
      const { data: newBowler, error: createError } = await userClient
        .from('bowlers')
        .insert({
          canonical_name: newBowlerName,
          created_by_user_id: user.id
        })
        .select()
        .single()

      if (createError || !newBowler) {
        console.error('Bowler create error:', createError)
        return NextResponse.json(
          { error: 'Failed to create new bowler' },
          { status: 500 }
        )
      }

      finalTargetBowlerId = newBowler.id
      console.log(`✨ Created new bowler: ${newBowlerName} (${finalTargetBowlerId})`)
    }

    // Verify target bowler exists
    const { data: targetBowler, error: targetError } = await userClient
      .from('bowlers')
      .select('id, canonical_name')
      .eq('id', finalTargetBowlerId)
      .single()

    if (targetError || !targetBowler) {
      console.error('Target bowler fetch error:', targetError)
      return NextResponse.json(
        { error: 'Target bowler not found' },
        { status: 404 }
      )
    }

    // Store original_parsed_name if not already set
    if (!seriesData.original_parsed_name) {
      const { error: updateOriginalError } = await userClient
        .from('series')
        .update({ original_parsed_name: originalName })
        .eq('id', seriesId)
      
      if (updateOriginalError) {
        console.error('Failed to update original_parsed_name:', updateOriginalError)
      }
    }

    // Create merge audit record
    const { error: auditError } = await userClient
      .from('bowler_merges')
      .insert({
        series_id: seriesId,
        from_bowler_id: fromBowlerId,
        to_bowler_id: finalTargetBowlerId,
        original_name: originalName,
        session_id: sessionId,
        merged_by_user_id: user.id
      })

    if (auditError) {
      console.error('Failed to create audit record:', auditError)
      // Don't fail the whole operation
    }

    // Reassign the series to the target bowler
    const { error: updateSeriesError } = await userClient
      .from('series')
      .update({ bowler_id: finalTargetBowlerId })
      .eq('id', seriesId)

    if (updateSeriesError) {
      console.error('Series update error:', updateSeriesError)
      return NextResponse.json(
        { error: 'Failed to reassign series' },
        { status: 500 }
      )
    }

    // IMPORTANT: Also update all games in this series to point to the new bowler
    // The games table has its own bowler_id that needs to be updated
    const { error: updateGamesError } = await userClient
      .from('games')
      .update({ bowler_id: finalTargetBowlerId })
      .eq('series_id', seriesId)

    if (updateGamesError) {
      console.error('Games update error:', updateGamesError)
      return NextResponse.json(
        { error: 'Failed to reassign games' },
        { status: 500 }
      )
    }

    console.log(`✅ Merged series ${seriesId} from ${fromBowlerId} to ${finalTargetBowlerId}`)
    console.log(`✅ Updated ${seriesData.games?.length || 0} games to new bowler`)

    // Recalculate stats for both bowlers (handled by database triggers or we can do it here)
    // For now, stats will be recalculated on next page load

    return NextResponse.json({
      success: true,
      message: `Successfully merged "${originalName}" into "${targetBowler.canonical_name}"`,
      fromBowlerId,
      toBowlerId: finalTargetBowlerId,
      toBowlerName: targetBowler.canonical_name
    })

  } catch (error) {
    console.error('Merge bowler error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Admin endpoint to backfill google_place_id for existing bowling alleys
 * Only updates records that have lat/lng but no place_id
 */
export async function POST(request: NextRequest) {
  try {
    // Get the auth token from the request headers
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized - No auth token' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Create a Supabase client with the user's token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    })

    // Verify the user
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized - Invalid token' }, { status: 401 })
    }
    
    // Use service role client for database operations (to bypass RLS)
    const supabase = createServerSupabaseClient()

    console.log('🔄 Starting backfill of google_place_id for bowling alleys...')

    // Fetch all bowling alleys that have coordinates but no place_id
    const { data: alleys, error: fetchError } = await supabase
      .from('bowling_alleys')
      .select('id, name, latitude, longitude, google_place_id')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .is('google_place_id', null)

    if (fetchError) {
      console.error('❌ Error fetching bowling alleys:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch bowling alleys' }, { status: 500 })
    }

    if (!alleys || alleys.length === 0) {
      console.log('✅ No bowling alleys need backfilling')
      return NextResponse.json({ 
        message: 'No alleys need updating', 
        updated: 0 
      })
    }

    console.log(`📍 Found ${alleys.length} alleys to backfill`)

    const results = {
      total: alleys.length,
      updated: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Import Google Places API helper
    const { findNearestBowlingAlley } = await import('@/lib/google-places')

    // Process each alley
    for (const alley of alleys) {
      try {
        console.log(`\n🔍 Processing: ${alley.name}`)
        console.log(`   Coordinates: ${alley.latitude}, ${alley.longitude}`)

        // Call Google Places API to get place details
        const googleResult = await findNearestBowlingAlley(
          alley.latitude,
          alley.longitude
        )

        if (!googleResult || !googleResult.placeId) {
          console.log(`   ⚠️ No place_id found for ${alley.name}`)
          results.skipped++
          results.errors.push(`${alley.name}: No place_id found`)
          continue
        }

        console.log(`   ✅ Found place_id: ${googleResult.placeId}`)

        // Update the bowling alley record with the place_id
        const { error: updateError } = await supabase
          .from('bowling_alleys')
          .update({ google_place_id: googleResult.placeId })
          .eq('id', alley.id)

        if (updateError) {
          console.error(`   ❌ Error updating ${alley.name}:`, updateError)
          results.errors.push(`${alley.name}: ${updateError.message}`)
          continue
        }

        console.log(`   ✅ Updated ${alley.name} with place_id`)
        results.updated++

        // Add a small delay to avoid hitting API rate limits
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error) {
        console.error(`   ❌ Error processing ${alley.name}:`, error)
        results.errors.push(`${alley.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log('\n✅ Backfill complete!')
    console.log(`   Total: ${results.total}`)
    console.log(`   Updated: ${results.updated}`)
    console.log(`   Skipped: ${results.skipped}`)
    console.log(`   Errors: ${results.errors.length}`)

    return NextResponse.json({
      message: 'Backfill complete',
      ...results
    })

  } catch (error) {
    console.error('❌ Backfill error:', error)
    return NextResponse.json({ 
      error: 'Backfill failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


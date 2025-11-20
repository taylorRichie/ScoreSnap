import { NextRequest, NextResponse } from 'next/server'
import { resolveBowlerName, createNewBowler, addBowlerAlias, searchBowlers } from '@/lib/bowler-matching'

export async function POST(request: NextRequest) {
  try {
    // Get JWT token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Create Supabase client
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, parsed_name, bowler_id, alias } = body

    switch (action) {
      case 'resolve':
        // Resolve a parsed name to existing bowler or suggest matches
        const resolution = await resolveBowlerName(parsed_name)
        return NextResponse.json(resolution)

      case 'create':
        // Create a new bowler
        const newBowlerId = await createNewBowler(parsed_name, user.id)
        if (!newBowlerId) {
          return NextResponse.json(
            { error: 'Failed to create bowler' },
            { status: 500 }
          )
        }
        return NextResponse.json({ bowler_id: newBowlerId })

      case 'add_alias':
        // Add alias to existing bowler
        if (!bowler_id || !alias) {
          return NextResponse.json(
            { error: 'Missing bowler_id or alias' },
            { status: 400 }
          )
        }

        const aliasAdded = await addBowlerAlias(bowler_id, alias, 'manual')
        if (!aliasAdded) {
          return NextResponse.json(
            { error: 'Failed to add alias' },
            { status: 500 }
          )
        }
        return NextResponse.json({ success: true })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Bowler resolution error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get JWT token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)

    // Create Supabase client
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    )

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('q')

    if (!searchTerm) {
      return NextResponse.json(
        { error: 'Missing search term' },
        { status: 400 }
      )
    }

    const bowlers = await searchBowlers(searchTerm)
    return NextResponse.json({ bowlers })

  } catch (error) {
    console.error('Bowler search error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

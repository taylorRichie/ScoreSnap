import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const address = searchParams.get('address')
  const width = searchParams.get('width') || '800'
  const height = searchParams.get('height') || '400'

  if (!address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
  }

  try {
    // Construct the static map URL
    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(address)}&zoom=15&size=${width}x${height}&markers=color:red%7C${encodeURIComponent(address)}&key=${apiKey}`
    
    // Redirect to the static map URL
    return NextResponse.redirect(staticMapUrl)

  } catch (error) {
    console.error('Error generating static map:', error)
    return NextResponse.json({ 
      error: 'Failed to generate static map',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


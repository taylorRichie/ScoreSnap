import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const placeId = searchParams.get('place_id')
  const maxwidth = searchParams.get('maxwidth') || '800'

  if (!placeId) {
    return NextResponse.json({ error: 'place_id is required' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Google Places API key not configured' }, { status: 500 })
  }

  try {
    // First, get place details to retrieve photo reference
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${apiKey}`
    
    const detailsResponse = await fetch(detailsUrl)
    const detailsData = await detailsResponse.json()

    if (detailsData.status !== 'OK' || !detailsData.result?.photos?.[0]) {
      // No photo available, return error
      return NextResponse.json({ 
        error: 'No photo available',
        details: detailsData.error_message || `Status: ${detailsData.status}`
      }, { status: 404 })
    }

    const photoReference = detailsData.result.photos[0].photo_reference

    // Construct the photo URL
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${photoReference}&key=${apiKey}`

    // Redirect to the photo URL
    return NextResponse.redirect(photoUrl)

  } catch (error) {
    console.error('Error fetching place photo:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch photo',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}


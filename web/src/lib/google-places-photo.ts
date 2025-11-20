/**
 * Helper function to get Google Places photo URL
 * @param placeId - The Google Place ID
 * @param maxWidth - Maximum width of the photo (default: 800)
 * @returns Photo URL or null if no place ID
 */
export function getGooglePlacesPhotoUrl(placeId: string | null, maxWidth: number = 800): string | null {
  if (!placeId) return null

  // Return the API endpoint URL that will fetch the photo server-side
  // The API key is kept secure on the server and not exposed to the client
  return `/api/places/photo?place_id=${encodeURIComponent(placeId)}&maxwidth=${maxWidth}`
}

/**
 * Get a static Google Maps image for a location
 * @param address - Full address
 * @param width - Image width (default: 800)
 * @param height - Image height (default: 400)
 * @returns Static map URL or null
 */
export function getStaticMapUrl(address: string | null, width: number = 800, height: number = 400): string | null {
  if (!address) return null

  const encodedAddress = encodeURIComponent(address)
  
  // Use our API endpoint to fetch the static map (keeps API key secure on server)
  return `/api/places/static-map?address=${encodedAddress}&width=${width}&height=${height}`
}


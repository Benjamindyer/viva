import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DOVER = { lat: 51.1279, lng: 1.3134 }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const MAPBOX_TOKEN = Deno.env.get('MAPBOX_TOKEN')
    if (!MAPBOX_TOKEN) throw new Error('MAPBOX_TOKEN not configured')

    const { address } = await req.json()
    if (!address) throw new Error('address is required')

    // Step 1: Geocode the UK address
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?country=GB&limit=1&access_token=${MAPBOX_TOKEN}`
    const geocodeRes = await fetch(geocodeUrl)
    const geocodeData = await geocodeRes.json()

    if (!geocodeData.features?.length) {
      throw new Error('Address not found. Please check the UK address and try again.')
    }

    const [lng, lat] = geocodeData.features[0].center
    const displayName = geocodeData.features[0].place_name

    // Step 2: Get driving route from Dover to the UK address
    const routeUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${DOVER.lng},${DOVER.lat};${lng},${lat}?geometries=geojson&access_token=${MAPBOX_TOKEN}`
    const routeRes = await fetch(routeUrl)
    const routeData = await routeRes.json()

    if (!routeData.routes?.length) {
      throw new Error('Could not calculate route from Dover to address.')
    }

    const distanceMetres = routeData.routes[0].distance
    const miles = distanceMetres / 1609.34
    const routeCoords = routeData.routes[0].geometry.coordinates

    return new Response(
      JSON.stringify({ miles, displayName, lat, lng, routeCoords }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

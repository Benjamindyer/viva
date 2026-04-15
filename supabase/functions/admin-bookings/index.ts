import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

async function verifyToken(req: Request): Promise<boolean> {
  const ADMIN_JWT_SECRET = Deno.env.get('ADMIN_JWT_SECRET')
  if (!ADMIN_JWT_SECRET) return false

  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return false

  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const [headerB64, payloadB64, sigB64] = parts
    const data = `${headerB64}.${payloadB64}`

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(ADMIN_JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    )
    const sigPad = sigB64.replace(/-/g, '+').replace(/_/g, '/')
    const sigBuf = Uint8Array.from(atob(sigPad + '=='.slice((sigPad.length + 3) % 4 || 4)), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(data))
    if (!valid) return false

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp < Date.now() / 1000) return false
    return payload.role === 'admin'
  } catch {
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authorized = await verifyToken(req)
  if (!authorized) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const url = new URL(req.url)
  const path = url.pathname.replace(/.*\/admin-bookings/, '')

  try {
    // GET /bookings
    if (req.method === 'GET' && (path === '/bookings' || path === '/bookings/')) {
      const status = url.searchParams.get('status')
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false })
      if (status && status !== 'all') query = query.eq('status', status)
      const { data, error } = await query
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /bookings/:id
    const bookingIdMatch = path.match(/^\/bookings\/([^/]+)$/)
    if (req.method === 'GET' && bookingIdMatch) {
      const { data, error } = await supabase.from('bookings').select('*').eq('id', bookingIdMatch[1]).single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PATCH /bookings/:id
    if (req.method === 'PATCH' && bookingIdMatch) {
      const body = await req.json()
      const allowed = ['status', 'admin_notes', 'total_price_gbp', 'deposit_gbp', 'balance_gbp', 'booking_fee_paid']
      const update: Record<string, unknown> = {}
      for (const key of allowed) {
        if (body[key] !== undefined) update[key] = body[key]
      }
      const { data, error } = await supabase.from('bookings').update(update).eq('id', bookingIdMatch[1]).select().single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /settings
    if (req.method === 'GET' && path === '/settings') {
      const { data, error } = await supabase.from('settings').select('*')
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PATCH /settings  — body: { key: value, ... }
    if (req.method === 'PATCH' && path === '/settings') {
      const body = await req.json()
      const updates = Object.entries(body).map(([key, value]) => ({
        key, value: String(value), updated_at: new Date().toISOString()
      }))
      const { error } = await supabase.from('settings').upsert(updates, { onConflict: 'key' })
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /dates
    if (req.method === 'GET' && path === '/dates') {
      const { data, error } = await supabase.from('travel_dates').select('*').order('departure_date', { ascending: true })
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /dates
    if (req.method === 'POST' && path === '/dates') {
      const body = await req.json()
      const { data, error } = await supabase.from('travel_dates').insert(body).select().single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PATCH /dates/:id
    const dateIdMatch = path.match(/^\/dates\/([^/]+)$/)
    if (req.method === 'PATCH' && dateIdMatch) {
      const body = await req.json()
      const allowed = ['departure_date', 'direction', 'spots_available', 'active', 'notes']
      const update: Record<string, unknown> = {}
      for (const key of allowed) {
        if (body[key] !== undefined) update[key] = body[key]
      }
      const { data, error } = await supabase.from('travel_dates').update(update).eq('id', dateIdMatch[1]).select().single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // DELETE /dates/:id
    if (req.method === 'DELETE' && dateIdMatch) {
      const { error } = await supabase.from('travel_dates').delete().eq('id', dateIdMatch[1])
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /content
    if (req.method === 'GET' && path === '/content') {
      const { data, error } = await supabase.from('content').select('*')
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PATCH /content  — body: { key: value, ... }
    if (req.method === 'PATCH' && path === '/content') {
      const body = await req.json()
      const updates = Object.entries(body).map(([key, value]) => ({
        key, value: String(value), updated_at: new Date().toISOString()
      }))
      const { error } = await supabase.from('content').upsert(updates, { onConflict: 'key' })
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // GET /testimonials
    if (req.method === 'GET' && path === '/testimonials') {
      const { data, error } = await supabase.from('testimonials').select('*').order('sort_order')
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /testimonials
    if (req.method === 'POST' && path === '/testimonials') {
      const body = await req.json()
      const { data, error } = await supabase.from('testimonials').insert(body).select().single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PATCH /testimonials/:id  |  DELETE /testimonials/:id
    const testimonialIdMatch = path.match(/^\/testimonials\/([^/]+)$/)
    if (testimonialIdMatch) {
      if (req.method === 'PATCH') {
        const body = await req.json()
        const { data, error } = await supabase.from('testimonials').update(body).eq('id', testimonialIdMatch[1]).select().single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'DELETE') {
        const { error } = await supabase.from('testimonials').delete().eq('id', testimonialIdMatch[1])
        if (error) throw error
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // GET /gallery
    if (req.method === 'GET' && path === '/gallery') {
      const { data, error } = await supabase.from('gallery_items').select('*').order('sort_order')
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /gallery
    if (req.method === 'POST' && path === '/gallery') {
      const body = await req.json()
      const { data, error } = await supabase.from('gallery_items').insert(body).select().single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PATCH /gallery/:id  |  DELETE /gallery/:id
    const galleryIdMatch = path.match(/^\/gallery\/([^/]+)$/)
    if (galleryIdMatch) {
      if (req.method === 'PATCH') {
        const body = await req.json()
        const { data, error } = await supabase.from('gallery_items').update(body).eq('id', galleryIdMatch[1]).select().single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'DELETE') {
        const { error } = await supabase.from('gallery_items').delete().eq('id', galleryIdMatch[1])
        if (error) throw error
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

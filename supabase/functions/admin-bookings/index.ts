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
    const b64ToBytes = (b64url: string) => {
      const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
      const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
      return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
    }
    const sigBuf = b64ToBytes(sigB64)
    const valid = await crypto.subtle.verify('HMAC', key, sigBuf, new TextEncoder().encode(data))
    if (!valid) return false

    const payload = JSON.parse(new TextDecoder().decode(b64ToBytes(payloadB64)))
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

    // DELETE /bookings/:id
    if (req.method === 'DELETE' && bookingIdMatch) {
      const { error } = await supabase.from('bookings').delete().eq('id', bookingIdMatch[1])
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
      // Derive spots_available from crate counts if provided
      if (body.large_crates !== undefined || body.small_crates !== undefined) {
        body.spots_available = (body.large_crates ?? 2) + (body.small_crates ?? 2)
      }
      const { data, error } = await supabase.from('travel_dates').insert(body).select().single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PATCH /dates/:id
    const dateIdMatch = path.match(/^\/dates\/([^/]+)$/)
    if (req.method === 'PATCH' && dateIdMatch) {
      const body = await req.json()
      const allowed = ['departure_date', 'direction', 'spots_available', 'active', 'notes', 'large_crates', 'small_crates', 'manually_closed']
      const update: Record<string, unknown> = {}
      for (const key of allowed) {
        if (body[key] !== undefined) update[key] = body[key]
      }
      // Keep spots_available in sync with crate counts
      if (update.large_crates !== undefined || update.small_crates !== undefined) {
        const { data: current } = await supabase.from('travel_dates').select('large_crates,small_crates').eq('id', dateIdMatch[1]).single()
        update.spots_available = (Number(update.large_crates ?? current?.large_crates ?? 2)) + (Number(update.small_crates ?? current?.small_crates ?? 2))
      }
      const { data, error } = await supabase.from('travel_dates').update(update).eq('id', dateIdMatch[1]).select()
      if (error) throw error
      return new Response(JSON.stringify(data?.[0] ?? {}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

    // GET /faqs
    if (req.method === 'GET' && path === '/faqs') {
      const { data, error } = await supabase.from('faqs').select('*').order('sort_order')
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /faqs
    if (req.method === 'POST' && path === '/faqs') {
      const body = await req.json()
      const { data, error } = await supabase.from('faqs').insert(body).select().single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // PATCH /faqs/:id  |  DELETE /faqs/:id
    const faqIdMatch = path.match(/^\/faqs\/([^/]+)$/)
    if (faqIdMatch) {
      if (req.method === 'PATCH') {
        const body = await req.json()
        const { data, error } = await supabase.from('faqs').update(body).eq('id', faqIdMatch[1]).select().single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'DELETE') {
        const { error } = await supabase.from('faqs').delete().eq('id', faqIdMatch[1])
        if (error) throw error
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // GET /pages
    if (req.method === 'GET' && path === '/pages') {
      const { data, error } = await supabase.from('pages').select('*').order('sort_order')
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /pages
    if (req.method === 'POST' && path === '/pages') {
      const body = await req.json()
      const { data, error } = await supabase.from('pages').insert(body).select().single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 })
    }

    // PATCH /pages/:id  |  DELETE /pages/:id
    const pageIdMatch = path.match(/^\/pages\/([^/]+)$/)
    if (pageIdMatch) {
      if (req.method === 'PATCH') {
        const body = await req.json()
        const { data, error } = await supabase.from('pages').update({ ...body, updated_at: new Date().toISOString() }).eq('id', pageIdMatch[1]).select().single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'DELETE') {
        const { error } = await supabase.from('pages').delete().eq('id', pageIdMatch[1])
        if (error) throw error
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // GET /blog  — list all posts (admin: all; public via RLS would use anon key directly)
    if (req.method === 'GET' && path === '/blog') {
      const { data, error } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // POST /blog
    if (req.method === 'POST' && path === '/blog') {
      const body = await req.json()
      if (body.published && !body.published_at) body.published_at = new Date().toISOString()
      const { data, error } = await supabase.from('blog_posts').insert(body).select().single()
      if (error) throw error
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 })
    }

    // PATCH /blog/:id  |  DELETE /blog/:id
    const blogIdMatch = path.match(/^\/blog\/([^/]+)$/)
    if (blogIdMatch) {
      if (req.method === 'PATCH') {
        const body = await req.json()
        const allowed = ['title', 'slug', 'excerpt', 'body_html', 'hero_image_url', 'published', 'published_at', 'meta_title', 'meta_description']
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
        for (const key of allowed) {
          if (body[key] !== undefined) update[key] = body[key]
        }
        if (update.published && !update.published_at) {
          const { data: cur } = await supabase.from('blog_posts').select('published_at').eq('id', blogIdMatch[1]).single()
          if (!cur?.published_at) update.published_at = new Date().toISOString()
        }
        const { data, error } = await supabase.from('blog_posts').update(update).eq('id', blogIdMatch[1]).select().single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      if (req.method === 'DELETE') {
        const { error } = await supabase.from('blog_posts').delete().eq('id', blogIdMatch[1])
        if (error) throw error
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // DELETE /media  — body: { url: string }
    if (req.method === 'DELETE' && path === '/media') {
      const body = await req.json()
      const url: string = body.url || ''
      const match = url.match(/\/site-media\/(.+)$/)
      if (!match) {
        return new Response(JSON.stringify({ error: 'Invalid media URL' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
        })
      }
      const { error } = await supabase.storage.from('site-media').remove([match[1]])
      if (error) throw error
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

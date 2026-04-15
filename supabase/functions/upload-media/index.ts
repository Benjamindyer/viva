import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BUCKET = 'site-media'
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401,
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file || typeof file === 'string') throw new Error('No file provided')

    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`File type not allowed: ${file.type}. Use JPEG, PNG, WebP or GIF.`)
    }
    if (file.size > MAX_SIZE) {
      throw new Error(`File too large (${Math.round(file.size/1024)}KB). Maximum size is 5 MB.`)
    }

    // Ensure bucket exists (no-op if already there)
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => null)

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, arrayBuffer, { contentType: file.type, upsert: false })

    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`)

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    })
  }
})

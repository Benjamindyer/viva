import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  } catch { return false }
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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { bookingId } = await req.json()
    if (!bookingId) throw new Error('bookingId required')

    // Fetch booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings').select('*').eq('id', bookingId).single()
    if (bookingError || !booking) throw new Error('Booking not found')

    // Fetch PayPal settings
    const { data: settings } = await supabase
      .from('settings').select('key, value').in('key', ['paypal_email', 'paypal_link'])
    const paypalEmail = settings?.find(s => s.key === 'paypal_email')?.value || ''
    const paypalLink = settings?.find(s => s.key === 'paypal_link')?.value || ''

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY not configured')

    const directionLabel = booking.direction === 'spain_to_uk' ? 'Spain → UK' : 'UK → Spain'
    const depositFormatted = `£${Number(booking.deposit_gbp).toFixed(2)}`
    const balanceFormatted = `£${Number(booking.balance_gbp).toFixed(2)}`
    const totalFormatted = `£${Number(booking.total_price_gbp).toFixed(2)}`

    const paypalSection = paypalLink
      ? `<a href="${paypalLink}" style="display:inline-block;background:#0070ba;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;margin:10px 0;">Pay Deposit via PayPal — ${depositFormatted}</a>`
      : `<p>Please send the deposit of <strong>${depositFormatted}</strong> via PayPal to: <strong>${paypalEmail}</strong></p><p>Use the reference <strong>${booking.reference}</strong> as the payment note.</p>`

    const html = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#c84b31;padding:30px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">🐕 Viva Españiel</h1>
          <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Dog transport Spain &amp; UK</p>
        </div>
        <div style="padding:30px;background:#fff;">
          <h2 style="color:#1a1a2e;">Great news — your booking is confirmed!</h2>
          <p>Hi ${booking.first_name},</p>
          <p>Jon has reviewed your booking request for <strong>${booking.dog_name}</strong> and is pleased to confirm it. To secure your spot, please pay the 50% deposit using the details below.</p>

          <div style="background:#f8f9fa;border-radius:12px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 6px;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:1px;">Your reference</p>
            <p style="margin:0;font-size:24px;font-weight:700;color:#c84b31;">${booking.reference}</p>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:25px;">
            <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Direction</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #eee;">${directionLabel}</td></tr>
            <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Travel date</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #eee;">${booking.travel_date_display || 'TBC'}</td></tr>
            <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Dog</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #eee;">${booking.dog_name}</td></tr>
            <tr><td style="padding:8px 0;font-weight:700;border-bottom:2px solid #ddd;">Total</td><td style="padding:8px 0;text-align:right;font-weight:700;border-bottom:2px solid #ddd;">${totalFormatted}</td></tr>
            <tr><td style="padding:10px 0;color:#2d6a4f;font-weight:600;">Deposit due now (50%)</td><td style="padding:10px 0;text-align:right;color:#2d6a4f;font-weight:700;font-size:18px;">${depositFormatted}</td></tr>
            <tr><td style="padding:8px 0;color:#666;">Balance on delivery (50%)</td><td style="padding:8px 0;text-align:right;color:#666;">${balanceFormatted}</td></tr>
          </table>

          <div style="text-align:center;margin:25px 0;">
            ${paypalSection}
          </div>

          <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:15px;font-size:13px;margin-top:20px;">
            <strong>Important:</strong> Please include your reference number <strong>${booking.reference}</strong> as the PayPal payment note. Your spot is not confirmed until the deposit is received.
          </div>

          <p style="margin-top:20px;color:#666;font-size:14px;">The balance of ${balanceFormatted} is collected on delivery of ${booking.dog_name}.</p>
          <p style="color:#666;font-size:14px;">Any questions? Reply to this email and Jon will be in touch.</p>
        </div>
        <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#999;">
          © 2026 Viva Españiel · Spain ↔ UK dog transport
        </div>
      </div>`

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Viva Españiel <bookings@vivaespaniel.com>',
        reply_to: 'farmerpalma@gmail.com',
        to: [booking.email],
        subject: `Your Viva Españiel booking is confirmed — ${booking.reference}`,
        html,
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      throw new Error(`Email failed: ${errText}`)
    }

    // Update booking status to deposit_sent
    await supabase.from('bookings').update({ status: 'deposit_sent' }).eq('id', bookingId)

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

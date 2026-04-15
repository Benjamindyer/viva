import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateReference(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let ref = 'VE-'
  for (let i = 0; i < 6; i++) {
    ref += chars[Math.floor(Math.random() * chars.length)]
  }
  return ref
}

async function sendEmail(to: string, subject: string, html: string, resendKey: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Viva Españiel <bookings@vivaespaniel.com>',
      reply_to: 'farmerpalma@gmail.com',
      to: [to],
      subject,
      html,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const {
      direction, travelDateId, travelDateDisplay,
      firstName, lastName, email, phone,
      dogName, breed, breedDisplay, size,
      spainAddress, spainAddressDisplay,
      ukAddress, ukAddressDisplay, milesFromDover,
      basePriceGbp, mileageCostGbp, totalPriceGbp, depositGbp, balanceGbp,
    } = body

    // Validate required fields
    if (!direction || !email || !firstName || !lastName || !dogName || !totalPriceGbp) {
      throw new Error('Missing required booking fields')
    }

    // Generate unique reference (retry up to 5 times on collision)
    let reference = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      reference = generateReference()
      const { data: existing } = await supabase
        .from('bookings').select('id').eq('reference', reference).maybeSingle()
      if (!existing) break
    }

    // Insert booking
    const { error: insertError } = await supabase.from('bookings').insert({
      reference,
      direction,
      travel_date_id: travelDateId || null,
      travel_date_display: travelDateDisplay,
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      dog_name: dogName,
      breed,
      breed_display: breedDisplay,
      size,
      spain_address: spainAddress,
      spain_address_display: spainAddressDisplay,
      uk_address: ukAddress,
      uk_address_display: ukAddressDisplay,
      miles_from_dover: milesFromDover,
      base_price_gbp: basePriceGbp,
      mileage_cost_gbp: mileageCostGbp,
      total_price_gbp: totalPriceGbp,
      deposit_gbp: depositGbp,
      balance_gbp: balanceGbp,
      status: 'pending',
    })

    if (insertError) throw new Error(insertError.message)

    // Increment spots_taken on the travel date
    if (travelDateId) {
      await supabase.rpc('increment_spots_taken', { date_id: travelDateId })
    }

    // Send emails (best-effort — don't fail the booking if email fails)
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const jonEmail = Deno.env.get('JON_EMAIL') || 'jon@vivaespaniel.com'

    if (resendKey) {
      const directionLabel = direction === 'spain_to_uk' ? 'Spain → UK' : 'UK → Spain'

      // Email to customer
      const customerHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#c84b31;padding:30px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:24px;">🐕 Viva Españiel</h1>
            <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Dog transport Spain &amp; UK</p>
          </div>
          <div style="padding:30px;background:#fff;">
            <h2 style="color:#1a1a2e;">Booking Request Received</h2>
            <p>Hi ${firstName},</p>
            <p>We've received your booking request for <strong>${dogName}</strong>. Jon will review your details and be in touch within 24 hours to confirm and send PayPal payment instructions.</p>
            <div style="background:#f8f9fa;border-radius:12px;padding:20px;margin:20px 0;">
              <p style="margin:0 0 8px;font-size:14px;color:#666;">Your reference number</p>
              <p style="margin:0;font-size:28px;font-weight:700;color:#c84b31;letter-spacing:2px;">${reference}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Direction</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #eee;">${directionLabel}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Travel date</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #eee;">${travelDateDisplay || 'TBC'}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Dog</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #eee;">${dogName}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Spanish address</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #eee;">${spainAddressDisplay || spainAddress || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">UK address</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #eee;">${ukAddressDisplay || ukAddress}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Total</td><td style="padding:8px 0;text-align:right;font-weight:700;border-bottom:1px solid #eee;">£${Number(totalPriceGbp).toFixed(2)}</td></tr>
              <tr><td style="padding:8px 0;color:#2d6a4f;">Deposit due (50%)</td><td style="padding:8px 0;text-align:right;color:#2d6a4f;font-weight:600;">£${Number(depositGbp).toFixed(2)}</td></tr>
              <tr><td style="padding:8px 0;color:#666;">Balance on delivery</td><td style="padding:8px 0;text-align:right;color:#666;">£${Number(balanceGbp).toFixed(2)}</td></tr>
            </table>
            <p style="margin-top:20px;color:#666;font-size:14px;">Please do not make any travel arrangements until you receive payment confirmation from Jon.</p>
            <p style="color:#666;font-size:14px;">Any questions? Reply to this email or contact us directly.</p>
          </div>
          <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#999;">
            © 2026 Viva Españiel · Spain ↔ UK dog transport
          </div>
        </div>`

      // Alert email to Jon
      const jonHtml = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a1a2e;padding:20px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:20px;">🐕 New Booking Request</h1>
          </div>
          <div style="padding:25px;background:#fff;">
            <h2 style="color:#c84b31;font-size:24px;letter-spacing:2px;">${reference}</h2>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;width:40%;">Customer</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${firstName} ${lastName}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${phone || 'Not provided'}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Dog</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${dogName} · ${breedDisplay || breed || 'Unknown breed'} · ${size || 'Unknown size'}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Direction</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${directionLabel}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Travel date</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${travelDateDisplay || 'TBC'}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Spanish address</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${spainAddressDisplay || spainAddress || '—'}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">UK address</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${ukAddressDisplay || ukAddress}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Miles from Dover</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${Number(milesFromDover).toFixed(0)} mi</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Base price</td><td style="padding:8px 0;border-bottom:1px solid #eee;">£${Number(basePriceGbp).toFixed(2)}</td></tr>
              <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Mileage</td><td style="padding:8px 0;border-bottom:1px solid #eee;">£${Number(mileageCostGbp).toFixed(2)}</td></tr>
              <tr><td style="padding:8px 0;font-weight:700;border-bottom:1px solid #eee;">Total</td><td style="padding:8px 0;font-weight:700;border-bottom:1px solid #eee;">£${Number(totalPriceGbp).toFixed(2)}</td></tr>
              <tr><td style="padding:8px 0;color:#2d6a4f;">Deposit (50%)</td><td style="padding:8px 0;color:#2d6a4f;font-weight:600;">£${Number(depositGbp).toFixed(2)}</td></tr>
            </table>
            <p style="margin-top:20px;"><a href="https://benjamindyer.github.io/ben-dyer-projects/admin.html" style="background:#c84b31;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:600;">View in Admin →</a></p>
          </div>
        </div>`

      await Promise.allSettled([
        sendEmail(email, `Booking request received — ${reference}`, customerHtml, resendKey),
        sendEmail(jonEmail, `New booking request: ${reference} — ${firstName} ${lastName} — £${Number(totalPriceGbp).toFixed(2)}`, jonHtml, resendKey),
      ])
    }

    return new Response(
      JSON.stringify({ reference }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FROM_ADDRESS = 'Viva Españiel <bookings@vivaespaniel.com>'

// Reasonable max lengths for contact form fields
const LIMITS = {
  name: 100,
  email: 200,
  phone: 50,
  subject: 100,
  message: 5000,
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

async function sendResendEmail(opts: {
  resendKey: string,
  from: string,
  to: string,
  subject: string,
  html: string,
  reply_to?: string,
}): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from,
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.reply_to ? { reply_to: opts.reply_to } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
    throw new Error(`Resend send failed: ${err}`)
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

    const body = await req.json().catch(() => ({}))
    const name    = String(body?.name    || '').trim()
    const email   = String(body?.email   || '').trim()
    const phone   = String(body?.phone   || '').trim()
    const subject = String(body?.subject || '').trim()
    const message = String(body?.message || '').trim()
    const honeypot = String(body?.website || '').trim()

    // Honeypot: silently return 200 to confuse bots
    if (honeypot) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate required fields
    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: 'Name, email and message are required.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ error: 'Please enter a valid email address.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    if (
      name.length    > LIMITS.name    ||
      email.length   > LIMITS.email   ||
      phone.length   > LIMITS.phone   ||
      subject.length > LIMITS.subject ||
      message.length > LIMITS.message
    ) {
      return new Response(
        JSON.stringify({ error: 'One or more fields exceed the maximum length.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Read settings from content table
    const { data: settingRows } = await supabase
      .from('content')
      .select('key,value')
      .in('key', ['contact_form_to_email', 'admin_notification_email', 'admin_reply_to_email'])
    const settings: Record<string, string> = Object.fromEntries(
      (settingRows || []).map(r => [r.key, r.value])
    )
    const operatorTo = (settings['contact_form_to_email'] || '').trim()
      || (settings['admin_notification_email'] || '').trim()
      || Deno.env.get('JON_EMAIL')
      || 'vivaespaniel@gmail.com'
    const replyToForCustomer = (settings['admin_reply_to_email'] || '').trim()
      || 'vivaespaniel@gmail.com'

    // Persist submission (best-effort — don't fail the whole request if insert fails)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    const userAgent = req.headers.get('user-agent') || ''
    try {
      await supabase.from('contact_submissions').insert({
        name, email, phone, subject, message, ip, user_agent: userAgent,
      })
    } catch (logErr) {
      console.error('contact_submissions insert failed:', logErr)
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      // No email provider configured — still return ok because we persisted the message
      return new Response(JSON.stringify({ ok: true, warning: 'Email not sent (RESEND_API_KEY missing). Message persisted.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const safe = {
      name:    escapeHtml(name),
      email:   escapeHtml(email),
      phone:   escapeHtml(phone),
      subject: escapeHtml(subject),
      message: escapeHtml(message).replace(/\n/g, '<br>'),
    }

    // Operator email — Jon can hit reply to respond directly to the customer
    const operatorSubject = `New contact form: ${subject || 'No subject'} — ${name}`
    const operatorHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1a1a2e;padding:20px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:20px;">🐕 New Contact Form Submission</h1>
        </div>
        <div style="padding:25px;background:#fff;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;width:30%;">Name</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${safe.name}</td></tr>
            <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee;"><a href="mailto:${safe.email}">${safe.email}</a></td></tr>
            <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Phone</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${safe.phone || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#666;border-bottom:1px solid #eee;">Subject</td><td style="padding:8px 0;border-bottom:1px solid #eee;">${safe.subject || '—'}</td></tr>
          </table>
          <div style="margin-top:20px;padding:15px;background:#f8f9fa;border-radius:8px;font-size:14px;line-height:1.6;">
            <p style="margin:0 0 8px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Message</p>
            ${safe.message}
          </div>
          <p style="margin-top:20px;font-size:13px;color:#999;">Reply to this email to respond directly to ${safe.name}.</p>
        </div>
      </div>`

    // Customer confirmation email
    const customerSubject = 'We got your message — Viva Españiel'
    const customerHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#c84b31;padding:30px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;">🐕 Viva Españiel</h1>
          <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;">Dog transport Spain &amp; UK</p>
        </div>
        <div style="padding:30px;background:#fff;">
          <h2 style="color:#1a1a2e;">Thanks for getting in touch!</h2>
          <p>Hi ${safe.name},</p>
          <p>We've received your message and Jon will reply within 24 hours (usually much sooner on WhatsApp).</p>
          <div style="background:#f8f9fa;border-radius:12px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 8px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;">Your message</p>
            <p style="margin:0 0 8px;color:#666;font-size:13px;"><strong>Subject:</strong> ${safe.subject || '—'}</p>
            <p style="margin:0;font-size:14px;line-height:1.6;">${safe.message}</p>
          </div>
          <p style="margin-top:20px;color:#666;font-size:14px;">Need an urgent answer? Reply to this email or message Jon on WhatsApp.</p>
        </div>
        <div style="background:#f8f9fa;padding:20px;text-align:center;font-size:12px;color:#999;">
          © 2026 Viva Españiel · Spain ↔ UK dog transport
        </div>
      </div>`

    await Promise.allSettled([
      sendResendEmail({
        resendKey,
        from: FROM_ADDRESS,
        to: operatorTo,
        subject: operatorSubject,
        html: operatorHtml,
        reply_to: email,
      }),
      sendResendEmail({
        resendKey,
        from: FROM_ADDRESS,
        to: email,
        subject: customerSubject,
        html: customerHtml,
        reply_to: replyToForCustomer,
      }),
    ])

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('submit-contact error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

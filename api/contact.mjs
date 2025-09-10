// Serverless-friendly handler (e.g., Vercel/Netlify) or mount under Express as POST /api/contact
// DMARC alignment: use your domain as From and DKIM-sign with that same domain.
// ENV required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, FROM_EMAIL, TO_EMAIL, DKIM_DOMAIN, DKIM_SELECTOR, DKIM_PRIVATE_KEY

import nodemailer from 'nodemailer';

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LEN = { name: 100, email: 150, subject: 150, message: 5000 };

function bad(res, code, error){ return res.status(code).json({ error }); }
function sanitize(s){ return (s || '').toString().trim(); }
function tooLong(s, n){ return s.length > n; }

export default async function handler(req, res){
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return bad(res, 405, 'Method not allowed');
  }

  try {
    const { name, email, subject = '', message, website = '' } = req.body || {};
    const n = sanitize(name), e = sanitize(email), sub = sanitize(subject), m = sanitize(message), hp = sanitize(website);

    // Honeypot
    if (hp) return bad(res, 400, 'Invalid submission');

    // Validation
    if (!n || !e || !m) return bad(res, 400, 'Missing required fields');
    if (!RE_EMAIL.test(e)) return bad(res, 400, 'Invalid email format');
    if (tooLong(n, MAX_LEN.name) || tooLong(e, MAX_LEN.email) || tooLong(sub, MAX_LEN.subject) || tooLong(m, MAX_LEN.message)) {
      return bad(res, 400, 'Input too long');
    }

    // Build transporter with DKIM for DMARC alignment
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465, // true for 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      dkim: {
        domainName: process.env.DKIM_DOMAIN,       // e.g., yourdomain.tld
        keySelector: process.env.DKIM_SELECTOR,    // e.g., mail
        privateKey: process.env.DKIM_PRIVATE_KEY,  // PEM
      },
    });

    const from = process.env.FROM_EMAIL; // e.g., "Website Contact <contact@yourdomain.tld>"
    const to = process.env.TO_EMAIL || process.env.FROM_EMAIL;

    const text = [
      `Name: ${n}`,
      `Email: ${e}`,
      `Subject: ${sub || '(none)'}`,
      '',
      m
    ].join('\n');

    // From is your domain (aligned). User is in Reply-To, preserving DMARC alignment.
    const info = await transporter.sendMail({
      from,
      to,
      replyTo: e,
      subject: sub ? `[Contact] ${sub}` : 'New website contact message',
      text,
      headers: {
        'X-Source-App': 'Mozg-Tutoring-Y',
      },
    });

    return res.status(200).json({ ok: true, id: info.messageId });
  } catch (err) {
    console.error(err);
    return bad(res, 500, 'Server error');
  }
}
# DMARC/SPF/DKIM notes (for contact form email)

To ensure the contact form “uses DMARC of the server,” the mail must authenticate and align with your domain:
- SPF: Receiving servers verify that the connecting SMTP host is authorized by your domain.
- DKIM: Your server signs messages with a private key; receivers verify with your DNS `TXT` record.
- DMARC: Requires alignment of `From:` domain with SPF pass or DKIM pass.

Key rules:
- Set `From:` to an address at your domain (e.g., `contact@yourdomain.tld`).
- Sign with DKIM for your domain (selector like `mail`).
- Make sure SPF authorizes the SMTP host you use.
- Put the submitter’s email into `Reply-To:` (not `From:`) to keep alignment.

## Example DNS records

1) SPF (at root):
```
Type: TXT
Name: @
Value: v=spf1 include:_spf.your-smtp-provider.tld a mx ~all
```

2) DKIM (selector "mail"):
```
Type: TXT
Name: mail._domainkey
Value: v=DKIM1; k=rsa; p=BASE64_PUBLIC_KEY
```

3) DMARC:
```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc-aggregate@yourdomain.tld; ruf=mailto:dmarc-forensic@yourdomain.tld; fo=1; adkim=s; aspf=s
```

- Use strict alignment (`adkim=s; aspf=s`) if possible.
- Start with `p=none` to monitor, then move to `quarantine`/`reject` when confident.

References:
- RFC 7489 (DMARC): https://www.rfc-editor.org/rfc/rfc7489
- RFC 6376 (DKIM): https://www.rfc-editor.org/rfc/rfc6376
- RFC 7208 (SPF): https://www.rfc-editor.org/rfc/rfc7208
- dmarc.org overview: https://dmarc.org/overview/
- Nodemailer DKIM docs: https://nodemailer.com/dkim/
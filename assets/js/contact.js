// Progressive enhancement: async submission with minimal dependencies.
(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const status = document.querySelector('#contact-status');
  const submitBtn = form.querySelector('button[type="submit"]');

  function setStatus(msg, kind='help'){
    if (!status) return;
    status.className = kind;
    status.textContent = msg;
  }

  form.addEventListener('submit', async (e) => {
    // If JS fails, the form can have action="" to a server route as a fallback.
    e.preventDefault();

    // Honeypot
    const hp = form.querySelector('input[name="website"]');
    if (hp && hp.value.trim() !== '') {
      setStatus('Submission flagged as spam.', 'error');
      return;
    }

    const fd = new FormData(form);
    const payload = {
      name: (fd.get('name') || '').toString().trim(),
      email: (fd.get('email') || '').toString().trim(),
      subject: (fd.get('subject') || '').toString().trim(),
      message: (fd.get('message') || '').toString().trim(),
      // Optionally pass a simple token; prefer a real CAPTCHA in production
    };

    // Client-side validation
    if (!payload.name || !payload.email || !payload.message) {
      setStatus('Please fill in your name, email, and message.', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      setStatus('Please provide a valid email address.', 'error');
      return;
    }

    try {
      submitBtn.disabled = true;
      setStatus('Sending...', 'help');

      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setStatus('Message sent successfully. Thank you!', 'success');
      form.reset();
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || 'Unable to send message'}`, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
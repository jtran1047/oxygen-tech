// Forwards contact form submissions to the Azure Logic App so the
// Logic App URL (and its SAS signature) never appears in client-side code
// or in this repository. The URL comes from the LOGIC_APP_URL application
// setting (Azure portal > Static Web App > Environment variables).

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

module.exports = async function (context, req) {
  const b = (req.body && typeof req.body === 'object') ? req.body : {};

  // Honeypot — hidden field real users never fill. Pretend success to bots.
  if (b.website) {
    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { ok: true } };
    return;
  }

  const payload = {
    firstName: clean(b.firstName, 200),
    lastName: clean(b.lastName, 200),
    email: clean(b.email, 320),
    company: clean(b.company, 300),
    service: clean(b.service, 200),
    message: clean(b.message, 5000)
  };

  if (!Object.values(payload).some(Boolean)) {
    context.res = { status: 400, headers: { 'Content-Type': 'application/json' }, body: { error: 'Empty submission' } };
    return;
  }

  const url = process.env.LOGIC_APP_URL;
  if (!url) {
    context.log.error('LOGIC_APP_URL application setting is not configured');
    context.res = { status: 500, headers: { 'Content-Type': 'application/json' }, body: { error: 'Server not configured' } };
    return;
  }

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    context.res = {
      status: upstream.ok ? 200 : 502,
      headers: { 'Content-Type': 'application/json' },
      body: upstream.ok ? { ok: true } : { error: 'Upstream error' }
    };
  } catch (err) {
    context.log.error('Logic App forward failed', err);
    context.res = { status: 502, headers: { 'Content-Type': 'application/json' }, body: { error: 'Upstream error' } };
  }
};

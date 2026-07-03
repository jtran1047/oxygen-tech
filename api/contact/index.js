// Forwards contact form submissions to the Azure Logic App so the
// Logic App URL (and its SAS signature) never appears in client-side code.
//
// Set LOGIC_APP_URL in the Static Web App's application settings
// (Azure portal > Static Web App > Environment variables). The fallback
// below keeps the form working until that setting exists — once it is set
// and the Logic App access key has been regenerated, the fallback is dead
// and can be removed.
const FALLBACK_URL = 'https://prod-35.australiasoutheast.logic.azure.com:443/workflows/e5a073d5cbdf4393a88a485ae00f0917/triggers/When_an_HTTP_request_is_received/paths/invoke?api-version=2016-10-01&sp=%2Ftriggers%2FWhen_an_HTTP_request_is_received%2Frun&sv=1.0&sig=ayO6e-4xVATHaOqEQZwDTb_9w1dsu2qojyDxAWR-PGg';

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

  try {
    const upstream = await fetch(process.env.LOGIC_APP_URL || FALLBACK_URL, {
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

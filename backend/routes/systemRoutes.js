import express from 'express';

const router = express.Router();

const sseClients = new Set();
const accessEvents = [];
const pushAccessEvent = (evt) => {
  try {
    accessEvents.push(evt);
    if (accessEvents.length > 500) accessEvents.shift();
    const data = `data: ${JSON.stringify(evt)}\n\n`;
    for (const res of sseClients) {
      res.write(data);
    }
  } catch (_) {}
};

router.locals = router.locals || {};
router.locals.pushAccessEvent = pushAccessEvent;

/**
 * GET /gym-access-stream
 * Purpose: Stream gym access events via Server-Sent Events.
 * Params: none.
 * Response: text/event-stream of event JSON objects.
 */
router.get('/gym-access-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  for (const evt of accessEvents) {
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  }
  sseClients.add(res);
  req.on('close', () => {
    try {
      sseClients.delete(res);
    } catch (_) {}
  });
});

/**
 * GET /api/gym-access-stream
 * Purpose: Stream gym access events via Server-Sent Events.
 * Params: none.
 * Response: text/event-stream of event JSON objects.
 */
router.get('/api/gym-access-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  for (const evt of accessEvents) {
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  }
  sseClients.add(res);
  req.on('close', () => {
    try {
      sseClients.delete(res);
    } catch (_) {}
  });
});

/**
 * GET /gym-access-log
 * Purpose: Return recent gym access events.
 * Params: none.
 * Response: { ok: boolean, events: object[] }.
 */
router.get('/gym-access-log', (_req, res) => {
  res.json({ ok: true, events: accessEvents.slice(-200) });
});

/**
 * GET /api/gym-access-log
 * Purpose: Return recent gym access events.
 * Params: none.
 * Response: { ok: boolean, events: object[] }.
 */
router.get('/api/gym-access-log', (_req, res) => {
  res.json({ ok: true, events: accessEvents.slice(-200) });
});

/**
 * GET /health
 * Purpose: Health check.
 * Params: none.
 * Response: { ok: boolean }.
 */
router.get('/health', (_req, res) => {
  res.json({ ok: true });
});

/**
 * GET /api/health
 * Purpose: Health check.
 * Params: none.
 * Response: { ok: boolean }.
 */
router.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

/**
 * GET /api/gym-live-status
 * Purpose: Provide gym live status fallback response.
 * Params: none.
 * Response: { ok: boolean, people: array }.
 */
router.get('/api/gym-live-status', (_req, res) => {
  res.json({ ok: true, people: [] });
});

export default router;

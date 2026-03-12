const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders:   false,
  message: {
    success: false,
    status:  429,
    message: 'Too many requests, please try again later.',
  },
});

module.exports = limiter;

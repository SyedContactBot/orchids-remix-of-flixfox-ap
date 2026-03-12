/**
 * api/index.js
 * Vercel serverless entry point — re-exports the Express app.
 * Vercel detects `module.exports` as a Node.js HTTP handler.
 */
require('dotenv').config();
module.exports = require('../src/server.js');

function errorHandler(err, req, res, next) {
  const status  = err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${message}`);

  res.status(status).json({
    success: false,
    status,
    message,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
}

module.exports = errorHandler;

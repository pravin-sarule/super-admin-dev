const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const judgementRoutes = require('./routes/judgementRoutes');
const judmentApiRoutes = require('./judment_api/routes');
const initializeSchema = require('./db/initSchema');
const errorHandler = require('./middleware/errorHandler');
const { createLogger } = require('./utils/logger');

dotenv.config({ path: './.env' });
const logger = createLogger('Server');

const app = express();
const requestBodyLimit = String(process.env.JUDGEMENT_REQUEST_BODY_LIMIT || '250mb').trim();

const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:4000',
  'https://nexintel-super-admin.netlify.app',
  'https://super-admin-dev.netlify.app',
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));
app.use((req, res, next) => {
  const startedAt = Date.now();

  logger.flow('Incoming request', {
    method: req.method,
    path: req.originalUrl,
    hasAuthorization: Boolean(req.headers.authorization),
    contentType: req.headers['content-type'] || null,
  });

  res.on('finish', () => {
    logger.flow('Request completed', {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

app.get('/health', async (req, res) => {
  res.json({
    success: true,
    service: 'judgement-service',
    status: 'ok',
  });
});

app.use('/api/judment-api', judmentApiRoutes);
app.use('/api/judgements', judgementRoutes);
app.use(errorHandler);

const PORT = Number(process.env.PORT || 8095);

initializeSchema()
  .then(() => {
    app.listen(PORT, () => {
      logger.info('Service started', { port: PORT });
    });
  })
  .catch((error) => {
    logger.error('Service failed to initialize schema', error);
    process.exit(1);
  });

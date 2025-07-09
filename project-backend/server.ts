import express from 'express';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

// Corrected import paths to match your project structure
import { protect } from './src/middleware/auth.middleware';
import { errorHandler } from './src/middleware/error.middleware';
import authRoutes from './src/api/auth/auth.routes';
import usersRoutes from './src/api/users/users.routes';
import organizationsRoutes from './src/api/organizations/organizations.routes';
import billingRoutes from './src/api/billing/billing.routes';
import teamsRoutes from './src/api/teams/teams.routes';
import projectsRoutes from './src/api/projects/projects.routes';
import tasksRoutes from './src/api/tasks/tasks.routes';
import financesRoutes from './src/api/finances/finances.routes';
import bootstrapRoutes from './src/api/bootstrap/bootstrap.routes';
import guestsRoutes from './src/api/guests/guests.routes';
import healthRoutes from './src/api/bootstrap/health.routes';
// Corrected import to handle default export
import logger from './src/logger';

const app = express();
const port = process.env.PORT || 8080;

// --- DYNAMIC CORS CONFIGURATION ---
const frontendURL = process.env.FRONTEND_URL;

const allowedOrigins = [
  'http://localhost:5173', // For local development
  'http://localhost:3000', // For local development
  'https://mypland.com',   // Production frontend
  'https://api.mypland.com' // Production API (optional)
];

if (frontendURL) {
  allowedOrigins.push(frontendURL);
  logger.info(`Added ${frontendURL} to allowed CORS origins.`);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or server-to-server)
    // or if the origin is in our list of allowed origins.
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.error(`CORS error: Origin ${origin} not allowed.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// --- MIDDLEWARE SETUP ---
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// Use morgan for request logging. Make sure it's installed (`npm install morgan @types/morgan`)
app.use(morgan('dev'));

// --- DEBUG: Print working directory and list files ---
const fs = require('fs');
console.log('Current working directory:', process.cwd());
console.log('Backend __dirname:', __dirname);
try {
  console.log('Files in backend directory:', fs.readdirSync(__dirname));
} catch (e) {
  console.log('Could not list backend directory:', e);
}
try {
  const distPath = path.join(__dirname, '../dist');
  console.log('Files in dist directory:', fs.readdirSync(distPath));
} catch (e) {
  console.log('Could not list dist directory:', e);
}

// --- API ROUTES ---
// Public route for authentication
app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);

// Protected routes - require a valid token for all subsequent routes
app.use('/api/users', protect, usersRoutes);
app.use('/api/organizations', protect, organizationsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/teams', protect, teamsRoutes);
app.use('/api/projects', protect, projectsRoutes);
app.use('/api/tasks', protect, tasksRoutes);
app.use('/api/finances', protect, financesRoutes);
app.use('/api/bootstrap', protect, bootstrapRoutes);
app.use('/api/guests', protect, guestsRoutes);

// --- SERVE FRONTEND STATIC FILES (ALWAYS) ---
// Use the correct path for Render: backend in project-backend/, dist in project root
// Serve frontend from client/dist at the project root
const frontendDistPath = path.join(__dirname, '../../../client/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  logger.info(`Serving frontend static files from: ${frontendDistPath}`);
  // Only serve index.html for non-API routes
  app.get(/^\/(?!api\/).*/, (req, res) => {
    logger.info(`Serving index.html for route: ${req.originalUrl}`);
    res.sendFile(path.resolve(frontendDistPath, 'index.html'));
  });
} else {
  logger.warn(`Frontend build directory not found at: ${frontendDistPath}. The server will only handle API requests.`);
  app.get('/', (req, res) => {
    res.send('API is running, but frontend files were not found.');
  });
}

// --- ERROR HANDLING ---
// This should be one of the last middleware to be used
app.use(errorHandler);

// --- START SERVER ---
app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});

export default app;

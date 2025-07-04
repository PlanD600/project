import express from 'express';
import cors from 'cors';
import path from 'path';
import morgan from 'morgan';
import cookieParser from 'cookie-parser'; // Added cookie-parser back

// Corrected import paths to match your project structure
import { protect } from './src/middleware/auth.middleware';
import { errorHandler } from './src/middleware/error.middleware';
import authRoutes from './src/api/auth/auth.routes';
import usersRoutes from './src/api/users/users.routes';
import organizationsRoutes from './src/api/organizations/organizations.routes';
import teamsRoutes from './src/api/teams/teams.routes';
import projectsRoutes from './src/api/projects/projects.routes';
import tasksRoutes from './src/api/tasks/tasks.routes';
import financesRoutes from './src/api/finances/finances.routes';
import bootstrapRoutes from './src/api/bootstrap/bootstrap.routes';
import { logger } from './src/logger';

const app = express();
const port = process.env.PORT || 8080;

// --- DYNAMIC CORS CONFIGURATION ---
// This is a more robust way to handle CORS for production and development.
// It relies on an environment variable, which you'll set in Render.
const frontendURL = process.env.FRONTEND_URL;

const allowedOrigins = [
  'http://localhost:5173', // For local development
  'http://localhost:3000', // For local development
];

if (frontendURL) {
  allowedOrigins.push(frontendURL);
  logger.info(`Added ${frontendURL} to allowed CORS origins.`);
}

app.use(cors({
  origin: function (origin, callback) {
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
app.use(cookieParser()); // Use cookie-parser for handling cookies
app.use(express.json({ limit: '10mb' })); // Modern replacement for body-parser
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('dev')); // Logger for requests

// --- API ROUTES ---
// Public route for authentication
app.use('/api/auth', authRoutes);

// Protected routes - require a valid token
app.use('/api/users', protect, usersRoutes);
app.use('/api/organizations', protect, organizationsRoutes);
app.use('/api/teams', protect, teamsRoutes);
app.use('/api/projects', protect, projectsRoutes);
app.use('/api/tasks', protect, tasksRoutes);
app.use('/api/finances', protect, financesRoutes);
app.use('/api/bootstrap', protect, bootstrapRoutes);

// --- SERVE FRONTEND IN PRODUCTION ---
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.resolve();
  // Assumes the frontend build is in a 'dist' folder at the parent level
  const frontendDistPath = path.join(__dirname, 'dist');
  
  // Check if the dist folder exists
  const fs = require('fs');
  if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    // For any other route, serve the index.html
    app.get('*', (req, res) =>
      res.sendFile(path.resolve(frontendDistPath, 'index.html'))
    );
    logger.info(`Serving frontend from: ${frontendDistPath}`);
  } else {
    logger.warn(`Frontend build directory not found at: ${frontendDistPath}`);
  }
} else {
    app.get('/', (req, res) => {
        res.send('API is running in development mode...');
    });
}

// --- ERROR HANDLING ---
app.use(errorHandler);

// --- START SERVER ---
app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});

export default app;

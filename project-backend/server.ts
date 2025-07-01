
import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from './src/middleware/error.middleware';
import { connectDB } from './src/db';
import logger from './src/logger';

// Import routes
import authRoutes from './src/api/auth/auth.routes';
import usersRoutes from './src/api/users/users.routes';
import teamsRoutes from './src/api/teams/teams.routes';
import projectsRoutes from './src/api/projects/projects.routes';
import tasksRoutes from './src/api/tasks/tasks.routes';
import financesRoutes from './src/api/finances/finances.routes';
import bootstrapRoutes from './src/api/bootstrap/bootstrap.routes';


// Load environment variables from .env file
dotenv.config();

const app: Application = express();
const port = process.env.PORT || 8080;

// Middleware
const corsOptions = {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info({
        message: 'Incoming request',
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
    });
    next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/finances', financesRoutes);
app.use('/api/bootstrap', bootstrapRoutes);


// A simple health check endpoint
app.get('/api', (req: Request, res: Response) => {
  res.send('Smart Project Manager API is running!');
});

// Central Error Handler
app.use(errorHandler);

const startServer = async () => {
    try {
        await connectDB();
        app.listen(port, () => {
            logger.info(`🚀 Server is running on http://localhost:${port}`);
        });
    } catch (error) {
        logger.fatal({ message: 'Failed to start server', error });
        process.exit(1);
    }
}

startServer();
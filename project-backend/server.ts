import express from 'express';
import cors from 'cors';
import { json, urlencoded } from 'body-parser';
import cookieParser from 'cookie-parser'; // Import cookie-parser
import { protect } from './middleware/auth.middleware';

// Routes
import authRoutes from './api/auth/auth.routes';
import projectRoutes from './api/projects/projects.routes';
import taskRoutes from './api/tasks/tasks.routes';
import teamRoutes from './api/teams/teams.routes';
import financeRoutes from './api/finances/finances.routes';
import bootstrapRoutes from './api/bootstrap/bootstrap.routes';
import usersRoutes from './api/users/users.routes';

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser()); // Use cookie-parser

app.use(json({ limit: '10mb' }));
app.use(urlencoded({ limit: '10mb', extended: true }));


// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/finances', financeRoutes);
app.use('/api/bootstrap', bootstrapRoutes);
app.use('/api/users', usersRoutes);


app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
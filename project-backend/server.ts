// project-backend/server.ts

import express from 'express';
import cors from 'cors';
import { json, urlencoded } from 'body-parser';
import cookieParser from 'cookie-parser';

// Corrected import paths
import authRoutes from './src/api/auth/auth.routes';
import projectRoutes from './src/api/projects/projects.routes';
import taskRoutes from './src/api/tasks/tasks.routes';
import teamRoutes from './src/api/teams/teams.routes';
import financeRoutes from './src/api/finances/finances.routes';
import bootstrapRoutes from './src/api/bootstrap/bootstrap.routes';
import usersRoutes from './src/api/users/users.routes';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());

app.use(json({ limit: '10mb' }));
app.use(urlencoded({ limit: '10mb', extended: true }));

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
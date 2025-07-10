"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
// Corrected import paths to match your project structure
const auth_middleware_1 = require("./src/middleware/auth.middleware");
const error_middleware_1 = require("./src/middleware/error.middleware");
const auth_routes_1 = __importDefault(require("./src/api/auth/auth.routes"));
const users_routes_1 = __importDefault(require("./src/api/users/users.routes"));
const organizations_routes_1 = __importDefault(require("./src/api/organizations/organizations.routes"));
const billing_routes_1 = __importDefault(require("./src/api/billing/billing.routes"));
const teams_routes_1 = __importDefault(require("./src/api/teams/teams.routes"));
const projects_routes_1 = __importDefault(require("./src/api/projects/projects.routes"));
const tasks_routes_1 = __importDefault(require("./src/api/tasks/tasks.routes"));
const finances_routes_1 = __importDefault(require("./src/api/finances/finances.routes"));
const bootstrap_routes_1 = __importDefault(require("./src/api/bootstrap/bootstrap.routes"));
const guests_routes_1 = __importDefault(require("./src/api/guests/guests.routes"));
const health_routes_1 = __importDefault(require("./src/api/bootstrap/health.routes"));
// Corrected import to handle default export
const logger_1 = __importDefault(require("./src/logger"));
const app = (0, express_1.default)();
const port = process.env.PORT || 8080;
// --- DYNAMIC CORS CONFIGURATION ---
const frontendURL = process.env.FRONTEND_URL;
const allowedOrigins = [
    'http://localhost:5173', // For local development
    'http://localhost:3000', // For local development
    'https://mypland.com', // Production frontend
    'https://api.mypland.com' // Production API (optional)
];
if (frontendURL) {
    allowedOrigins.push(frontendURL);
    logger_1.default.info(`Added ${frontendURL} to allowed CORS origins.`);
}
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or server-to-server)
        // or if the origin is in our list of allowed origins.
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        }
        else {
            logger_1.default.error(`CORS error: Origin ${origin} not allowed.`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));
// --- MIDDLEWARE SETUP ---
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ limit: '10mb', extended: true }));
// Use morgan for request logging. Make sure it's installed (`npm install morgan @types/morgan`)
app.use((0, morgan_1.default)('dev'));
// --- DEBUG: Print working directory and list files ---
const fs = require('fs');
console.log('Current working directory:', process.cwd());
console.log('Backend __dirname:', __dirname);
try {
    console.log('Files in backend directory:', fs.readdirSync(__dirname));
}
catch (e) {
    console.log('Could not list backend directory:', e);
}
try {
    const distPath = path_1.default.join(__dirname, '../dist');
    console.log('Files in dist directory:', fs.readdirSync(distPath));
}
catch (e) {
    console.log('Could not list dist directory:', e);
}
// --- API ROUTES ---
// Public route for authentication
app.use('/api/auth', auth_routes_1.default);
app.use('/api/health', health_routes_1.default);
// Protected routes - require a valid token for all subsequent routes
app.use('/api/users', auth_middleware_1.protect, users_routes_1.default);
app.use('/api/organizations', auth_middleware_1.protect, organizations_routes_1.default);
app.use('/api/billing', billing_routes_1.default);
app.use('/api/teams', auth_middleware_1.protect, teams_routes_1.default);
app.use('/api/projects', auth_middleware_1.protect, projects_routes_1.default);
app.use('/api/tasks', auth_middleware_1.protect, tasks_routes_1.default);
app.use('/api/finances', auth_middleware_1.protect, finances_routes_1.default);
app.use('/api/bootstrap', auth_middleware_1.protect, bootstrap_routes_1.default);
app.use('/api/guests', auth_middleware_1.protect, guests_routes_1.default);
// --- SERVE FRONTEND STATIC FILES (ALWAYS) ---
// Use the correct path for Render: backend in project-backend/, dist in project root
// Serve frontend from frontend/dist at the project root
const frontendDistPath = path_1.default.join(__dirname, '../../frontend/dist');
logger_1.default.info(`Looking for frontend static files at: ${frontendDistPath}`);
if (fs.existsSync(frontendDistPath)) {
    app.use(express_1.default.static(frontendDistPath));
    logger_1.default.info(`Serving frontend static files from: ${frontendDistPath}`);
    // Only serve index.html for non-API routes
    app.get(/^\/(?!api\/).*/, (req, res) => {
        logger_1.default.info(`Serving index.html for route: ${req.originalUrl}`);
        res.sendFile(path_1.default.resolve(frontendDistPath, 'index.html'));
    });
}
else {
    logger_1.default.warn(`Frontend build directory not found at: ${frontendDistPath}. The server will only handle API requests.`);
    app.get('/', (req, res) => {
        res.send('API is running, but frontend files were not found.');
    });
}
// --- ERROR HANDLING ---
// This should be one of the last middleware to be used
app.use(error_middleware_1.errorHandler);
// --- START SERVER ---
app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
});
exports.default = app;

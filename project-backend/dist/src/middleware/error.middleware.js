"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = __importDefault(require("../logger"));
const errorHandler = (err, req, res, next) => {
    logger_1.default.error({
        message: `Error handled in ${req.method} ${req.originalUrl}`,
        error: {
            message: err.message,
            name: err.name,
            stack: err.stack,
        },
        request: {
            body: req.body,
            query: req.query,
            params: req.params,
            user: req.user,
        }
    }, 'Global error handler caught an exception');
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        message: err.message || 'An unexpected server error occurred.',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};
exports.errorHandler = errorHandler;


import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import logger from '../logger';

interface CustomError extends Error {
    statusCode?: number;
}

export const errorHandler: ErrorRequestHandler = (err: CustomError, req: Request, res: Response, next: NextFunction) => {
    logger.error(
        {
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
        },
        'Global error handler caught an exception'
    );

    const statusCode = err.statusCode || 500;
    
    res.status(statusCode).json({
        message: err.message || 'An unexpected server error occurred.',
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
};

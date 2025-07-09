"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmail = void 0;
// project-backend/src/services/emailService.ts
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = __importDefault(require("../logger"));
const transporter = nodemailer_1.default.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
    },
    tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false,
    },
});
const sendEmail = (options) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: options.to,
            subject: options.subject,
            html: options.html,
        };
        yield transporter.sendMail(mailOptions);
        logger_1.default.info(`Email sent successfully to ${options.to}`);
    }
    catch (error) {
        logger_1.default.error(`Error sending email to ${options.to}: ${error.message}`, { error: error });
        throw new Error('Failed to send email.');
    }
});
exports.sendEmail = sendEmail;
// ודא שהטרנספורטר מוכן (בדיקה פשוטה)
transporter.verify(function (error, success) {
    if (error) {
        logger_1.default.error('Email transporter verification failed:', error);
    }
    else {
        logger_1.default.info('Email transporter is ready to take messages');
    }
});

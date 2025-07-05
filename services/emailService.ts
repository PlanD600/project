// project-backend/src/services/emailService.ts
import nodemailer from 'nodemailer';
import logger from '../logger';

interface MailOptions {
    to: string;
    subject: string;
    html: string;
}

// יצירת טרנספורטר (אובייקט השולח מייל) באמצעות הגדרות SMTP
// מומלץ להשתמש ב-SendGrid, Mailgun, או שירותי מייל טרנזקציונליים אחרים בסביבת ייצור.
// לדוגמה עם Gmail (לצורך פיתוח בלבד, לא מומלץ לייצור):
// const transporter = nodemailer.createTransport({
//     service: 'gmail',
//     auth: {
//         user: process.env.EMAIL_USERNAME, // המייל שלך
//         pass: process.env.EMAIL_PASSWORD, // סיסמת האפליקציה ב-Gmail (לא הסיסמה הרגילה)
//     },
// });

// הגדרת Transporter באמצעות משתני סביבה כלליים
const transporter = nodemailer.createTransport({
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

export const sendEmail = async (options: MailOptions) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_FROM, // כתובת המייל השולחת
            to: options.to,
            subject: options.subject,
            html: options.html,
        };

        await transporter.sendMail(mailOptions);
        logger.info(`Email sent successfully to ${options.to}`);
    } catch (error) {
        logger.error(`Error sending email to ${options.to}: ${(error as Error).message}`, { error: error });
        throw new Error('Failed to send email.');
    }
};

// ודא שהטרנספורטר מוכן (בדיקה פשוטה)
transporter.verify(function (error, success) {
    if (error) {
        logger.error('Email transporter verification failed:', error);
    } else {
        logger.info('Email transporter is ready to take messages');
    }
});
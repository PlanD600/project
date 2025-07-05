

import express from 'express';
import { Router } from 'express';
import {
    registerUser,
    loginUser,
    getMe,
    logoutUser,
    uploadAvatar,
    forgotPassword, // ייבוא הפונקציה החדשה
    resetPassword,  // ייבוא הפונקציה החדשה
} from './auth.controller'; // ודא ש-auth.controller.ts מייצא את הפונקציות הללו
import { protect } from '../../middleware/auth.middleware';




const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getMe);
router.post('/me/avatar', protect, uploadAvatar);
router.post('/forgotpassword', forgotPassword); // נתיב חדש
router.patch('/resetpassword/:token', resetPassword); // נתיב חדש
export default router;
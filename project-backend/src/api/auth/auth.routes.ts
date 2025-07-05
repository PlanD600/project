

import express from 'express';
import { registerUser, loginUser, logoutUser, getMe, uploadAvatar, forgotPassword, forgotPassword,
 } from './auth.controller';
import { protect } from '../../middleware/auth.middleware';
import { Router } from 'express';



const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);
router.get('/me', protect, getMe);
router.post('/me/avatar', protect, uploadAvatar);
router.post('/forgotpassword', forgotPassword); // נתיב חדש
router.patch('/resetpassword/:token', resetPassword); // נתיב חדש
export default router;
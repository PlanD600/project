"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("./auth.controller"); // ודא ש-auth.controller.ts מייצא את הפונקציות הללו
const auth_middleware_1 = require("../../middleware/auth.middleware");
const router = express_1.default.Router();
router.post('/register', auth_controller_1.registerUser);
router.post('/login', auth_controller_1.loginUser);
router.post('/logout', auth_controller_1.logoutUser);
router.get('/me', auth_middleware_1.protect, auth_controller_1.getMe);
router.post('/me/avatar', auth_middleware_1.protect, auth_controller_1.uploadAvatar);
router.post('/forgotpassword', auth_controller_1.forgotPassword); // נתיב חדש
router.patch('/resetpassword/:token', auth_controller_1.resetPassword); // נתיב חדש
exports.default = router;

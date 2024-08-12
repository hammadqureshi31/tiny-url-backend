import express from "express";
import { handleCreateNewUser, handleLoginUser, handleLogoutUser, handleForgotPassword, handleResetPassword } from "../controller/userControls.js";
import { verifyJWT } from "../middlewear/auth.logout.js";

const router = express.Router();

router.post('/register', handleCreateNewUser);

router.post('/login', handleLoginUser);

//secured route
router.post('/logout',verifyJWT, handleLogoutUser)

router.post('/forgotPassword', handleForgotPassword)

router.post('/resetPassword/:id', handleResetPassword)

export default router;
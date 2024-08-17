import express from "express";
import { handleFindAllURLs, handleCreateNewShortID, handleFindByShortId } from "../controller/urlControls.js";
import { verifyJWT } from "../middlewear/auth.logout.js";

const router = express.Router();

router.get('/', handleFindAllURLs)

//secured route
// router.post('/', verifyJWT, handleCreateNewShortID);
router.post('/', handleCreateNewShortID);

router.get('/:shortID', handleFindByShortId)

export default router;
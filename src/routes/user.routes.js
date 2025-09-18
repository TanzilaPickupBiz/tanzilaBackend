import { Router } from "express";
import {changeCurrentPassword, getCurrentUser, getUserChannelProfile, getWatchHistory, loginUser, logoutUser, refreshAccessToken, registerUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage} from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router()

//subroutes are here
router.route("/register").post(
    upload.fields([
        {
            name : "avatar",
            maxCount : 1
        }, 
        {
            name : "coverImage",
            maxCount : 1
        }
    ]), // checking the validation 
    registerUser
)

router.route("/login").post(loginUser)

// secured routes
router.route("/logout").post(verifyJWT, logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/current-user").get(verifyJWT, getCurrentUser)
router.route("/update-account").patch(verifyJWT , updateAccountDetails)

//1st verify login user then take file from multer using upload then controller
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateUserAvatar)
router.route("/cover-image").patch(verifyJWT, upload.single("coverImage") , updateUserCoverImage)

// data will comes in params   you can write c or channel
router.route("/c/:username").get(verifyJWT, getUserChannelProfile)

router.route("/watch-history").get(verifyJWT, getWatchHistory)


export default router;
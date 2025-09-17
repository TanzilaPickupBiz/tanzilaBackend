/// this is our own middleware this only check user is there or not

import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { User } from "../models/user.model.js";

export const verifyJWT = asyncHandler(async(req, _ ,next) => { //instead of res if res is not working then you also right _ in production you see this type of code
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "") // this Authorization you can see in postman headers
    
        if(!token) {
            throw new ApiError(400 , "'Unauthorized request")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    
       const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
       if (!user) {
        //Next : discuss about frontend
        throw new ApiError(401, "Invalid Access token")
       }
    
       req.user = user ;
       next()
    } catch (error) {
        throw new ApiError(401 , error?.message || "Invalid Access Token")
    }

})
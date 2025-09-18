import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async(userId) => {
    try {
       const user=  await User.findById(userId)
       const accessToken = user.generateAccessToken()
       const refreshToken = user.generateRefreshToken()

//ow to add refresh token value in db 

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})

        //return the access and refresh token
        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler( async(req,res)=>{
    // get user details from frontend
    //validation - not empty
    //  check if user exist already using email and username
    // check for images , check for avatar
    // if available then upload them to cloudinary , avatar
    //create user object - create entry in DB
    // remove password and refresh token field from response
    // check for user creation
    // return response

    // get user details from frontend using destructuring
    const {userName , email , fullName, password} = req.body
    // console.log("email", email) ;


    // check validation field are not empty  you can do like below for all fields
    // if (fullName === "") {
    //     throw new ApiError(400 , "fulName is required")
    // }

    // check validation field are not empty  you can do like below for all fields using advanced logic
    if (
        // if any field is empty then it give true return
        [fullName , email, userName, password].some((field)=> field?.trim() === "")
    ) {
        throw new ApiError(400 , "All fields are required")
    }

    //  check if user exist already using email and username
   const existedUser = await User.findOne({
        $or: [ {userName} , {email} ]
    })
    if (existedUser) {
        throw new ApiError(409 , "User with email or userName exist")
    }
    
    // check for images , check for avatar
// this req.files access we get from multer req.body access get from express
   const avatarLocalPath = req.files?.avatar[0]?.path;  // you get the path of first property  avatar 
//    const coverImageLocalPath = req.files?.coverImage[0].path;   // you get the path of first coverImage

// check the cover image path if yes then give path if not then give empty string
let coverImageLocalPath ;
if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path
}

//    console.log(req.files, "req.files")
//    console.log(req.body, "req.body")

   if (!avatarLocalPath) {
    throw new ApiError(400 , "Avatar file is required.")
   }

    // if available then upload them to cloudinary , avatar
   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)

   if (!avatar) {
    throw new ApiError(400 , "Avatar is required.")
   }
    //create user object - create entry in DB
   const user = await User.create({
    fullName,
    avatar : avatar.url,
    coverImage : coverImage?.url || "" ,  // if coverImage is there then give url if not then empty
    email, 
    password,
    userName : userName.toLowerCase()
   })
   // if user created successfully then check by id if yes then 
   // remove password and refresh token field from response using select method
   const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
   )

//if user is not created successfully then throw error
   if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user.")
   }

    // return response

    // return res.status(201).json({createdUser});  //this is also okk  to return the response 

    //but this is in organized way 
   return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully")
   )

})

const loginUser = asyncHandler( async(req,res) =>{
    // get the data from req.body
    // check username or email is available or not 
    // find the user that in req.body is coming or not
    //if login , check password if password is not there throw error
    // if password is  there then generate access and refresh token 
    // send these token  through cookies
    //send response successfully logged in 

    const {userName, email,password} = req.body ;

    /* 
    body. If both `userName` and `email` are missing, it throws an `ApiError` with status code 400 */
    if (!userName && !email) {
        throw new ApiError(400 , "username and email is required")
    }

    // here  if you want email either userName then use this
    //  if (!(userName || email)) {
    //     throw new ApiError(400 , "username or email is required")
    // }

    const user = await User.findOne({
        $or: [ {userName} , {email} ]
    })

    if (!user) {
        throw new ApiError(404, "User does not exist")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

     if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user Credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).
    select("-password -refreshToken")   // dont send the password and refresh token after logged in

    const options = {
        httpOnly : true, // if you give both true then it will only modify be server
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken , options)
    .cookie("refreshToken", refreshToken , options)
    .json(
        new ApiResponse(
            200, 
            {
                user : loggedInUser , accessToken, refreshToken
            },
            "User logged in Successfully"
        )
    )

})

const logoutUser = asyncHandler( async(req,res)=> {
    // clear the cookies
    //reset the refreshToken from model
 // this access come from jwt token that is in routes

    await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set : { // this mngo db operator is used for update 
                refreshToken : undefined
            }
        },
        {
            new : true  // by using this you get the new return value
        }
    )

    const options ={
        httpOnly : true ,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200 , {}, "User Logged out Successfully"))

})

const refreshAccessToken = asyncHandler( async(req,res) => {
    // first access cookies  and get token  cookies for other device and body for who use mobile
    const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken ;

    // if token is not there throw error
    if (!incomingRefreshToken) {
        throw new ApiError(401 , "Unauthorized request")
    }

   try {
     //if token is there then verify 
     const decodedToken =  jwt.verify(
         incomingRefreshToken,
         process.env.REFRESH_TOKEN_SECRET
     )
 
     const user = await User.findById(decodedToken?._id);
 
     if (!user) {
         throw new ApiError(401 , "Invalid refresh token")
     }
 
     if (incomingRefreshToken !== user?.refreshToken) {
         throw new ApiError(401 , "Refresh token is expired or used")
     }
 
     const options = {
         httpOnly : true ,
         secure : true
     }
 
     // decode access and refresh token to store the values of that tokens
     const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id);
 
     return res 
     .status(200)
     .cookie("accessToken", accessToken , options )
     .cookie("refreshToken", newRefreshToken , options)
     .json(
         new ApiResponse(
             200,
             { accessToken , refreshToken : newRefreshToken },
             "Access token refreshed"
         )
     )
   } catch (error) {
    throw new ApiError(401 , error?.message || "Invalid refresh token")
   }

})

const changeCurrentPassword = asyncHandler( async(req,res) => {
    // get the data 
    const {oldPassword , newPassword} = req.body

    // first find old password of that user
    const user = await User.findById(req.user?._id)

    //  check password it give the true or false value and this is a async
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    // if password is correct throw error
    if (!isPasswordCorrect) {
        throw new ApiError(400 , "Invalid old password")
    }

    // if password is correct then save the new Password
    user.password = newPassword  // this only set te value
    await user.save({validateBeforeSave : false})  /// this save the value and dosnt validate

    return res
    .status(200)
    .json(new ApiResponse(200 , {}, "Password Changed successfully"))
})

const getCurrentUser = asyncHandler( async(req,res) => {
    return res
    .status(200)
    .json(new ApiResponse(200, req.user , "current user fetched successfully"))
})

const updateAccountDetails = asyncHandler( async(req,res)=>{
    const { fullName , email} = req.body;

    if (!fullName || !email) {
        throw new ApiError(400 , "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set : { fullName , email }
        },
        {new : true}
    ).select("-password")

    return res 
    .status(200)
    .json(new ApiResponse(200, user , "Account Details updated successfully"))
})

const updateUserAvatar = asyncHandler( async(req,res) => {
    const avatarLocalPath= req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400 , "Avatar file is missing")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new ApiError(400 , "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id ,
        {
            $set : avatar.url
        }, 
        {new : true}
    ).select("-password")

    //delete the old avatar 

    
    
    return res 
    .status(200)
    .json(new ApiResponse(200, user , "Avatar updated successfully"))
})


// update with delete
// const updateUserAvatar = asyncHandler(async (req, res) => {
//   const avatarLocalPath = req.file?.path;

//   if (!avatarLocalPath) {
//     throw new ApiError(400, "Avatar file is missing");
//   }

//   // find user
//   const user = await User.findById(req.user._id);
//   if (!user) {
//     throw new ApiError(404, "User not found");
//   }

//   // upload new avatar
//   const avatar = await uploadOnCloudinary(avatarLocalPath);
//   if (!avatar?.url) {
//     throw new ApiError(400, "Error while uploading avatar");
//   }

//   //  delete old avatar from cloudinary if exists
//   if (user.avatar?.public_id) {
//     await cloudinary.uploader.destroy(user.avatar.public_id);
//   }

//   // update user with new avatar
//   user.avatar = {
//     url: avatar.url,
//     public_id: avatar.public_id,
//   };

//   await user.save();

//   return res
//     .status(200)
//     .json(new ApiResponse(200, user, "Avatar updated successfully"));
// });


const updateUserCoverImage = asyncHandler(async (req,res) =>{
    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400 , "Cover Iage file is required")
    }

    const coverImage = uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(400 , "Error while uploading coverImage")
    }

   const user =  await User.findByIdAndUpdate(
        req.user._id ,
        {
            $set : coverImage.url
        },
        {new :true}
    )

    return res 
    .status(200)
    .json(new ApiResponse(200, user , "cover Image updated successfully"))

})


// aggregation pipeline
const getUserChannelProfile = asyncHandler( async(req,res)=>{

    const {userName} = req.params ;

    if (!userName?.trim()) {
        throw new ApiError(400 , "userName is missing")
    }

    const channel =  await User.aggregate([
        // 1st pipeline to match
        {
            $match: {
                userName : userName?.toLowerCase()
            }
        },
        // lookup to find the subscriber 
        {
            $lookup : {
                from : "subscriptions",   // in mongo the model name is converted in lowercase and plural
                localField : "_id",
                foreignField : "channel",
                as : "subscribers"
            }
        },
        // lookup to find channel or subscribed
        {
            $lookup : {
                from : "subscriptions",   // in mongo the model name is converted in lowercase and plural
                localField : "_id",
                foreignField : "subscriber",
                as : "subscribedTo"
            }
        },
        // add field in original field
        {
            $addFields : {
                subscribersCount : {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount : {
                    $size: "$subscribedTo"
                },
                isSubscribed : {
                    // $ is indicate that is field  $in meaning field present or not 
                    $cond: {
                        if : {$in : [req.user?._id, "$subscribers.subscriber"]},
                        then : true,
                        else : false,
                    }
                }
            }
        },
        //  final $project gives selected data
        {
            $project : {
                fullName : 1,
                userName : 1,
                subscribersCount : 1,
                channelsSubscribedToCount : 1,
                isSubscribed : 1 ,
                avatar : 1 ,
                coverImage : 1 ,
                email : 1 ,
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404 , "Channel does not exists")
    }

    return res
    .status(200)
    .json(new ApiResponse(200, channel[0] , "User Channel fetched successfully"))

})

//for watch history

const getWatchHistory = asyncHandler( async(req,res)=> {

    const user = await User.aggregate([
        {
            $match : {
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "watchHistory",
                foreignField : "_id",
                as : "watchHistory" ,
                // if you add sub pipeline
                pipeline : [
                    {
                        $lookup : {
                            from : "users",
                            localField : "owner",
                            foreignField : "_id",
                            as : "owner",
                            pipeline : [
                                {
                                    $project : {
                                        fullName : 1 ,
                                        userName : 1 ,
                                        avatar : 1 ,
                                    }
                                }
                            ]
                        }
                    }, 
                     // after above pipeline owner data comes in array  in below we structure the data
                    {
                        $addFields : {
                            owner : {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(new ApiResponse(200, user[0].watchHistory , "Watch History fetched successfully"))
})


export  {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}
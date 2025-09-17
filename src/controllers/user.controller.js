import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export  {
    registerUser,
    loginUser,
    logoutUser
}
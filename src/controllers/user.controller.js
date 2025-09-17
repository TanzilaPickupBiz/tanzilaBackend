import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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
    console.log("email", email) ;


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
   const existedUser = User.findOne({
        $or: [ {userName} , {email} ]
    })
    if (existedUser) {
        throw new ApiError(409 , "User with email or userName exist")
    }
    
    // check for images , check for avatar
// this req.files access we get from multer req.body access get from express
   const avatarLocalPath = req.files?.avatar[0]?.path;  // you get the path of first property  avatar 
   const coverImageLocalPath = req.files?.coverImage[0].path;   // you get the path of first coverImage

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


export  {registerUser}
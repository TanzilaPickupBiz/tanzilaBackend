import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
    {
        userName : {
            type : String,
            required : true ,
            unique : true ,
            lowercase : true ,
            trim : true ,
            index : true   //// if you need for searching field then index field will be true it is a optimized way    
        },
        email : {
            type : String ,
            required : true ,
            unique : true ,
            lowercase : true ,
            trim : true
        },
        fullName : {
            type : String ,
            required : true ,
            trim : true,
            index : true
        },
        avatar : {
            type : String ,  // Cloudinary Service to store the videos and images
            required : true,
        },
        coverImage : {
            type : String ,  // Cloudinary Service to store the videos and images
        },
        watchHistory : [
            {
                type :mongoose.Schema.Types.ObjectId,
                ref : "Video"
            }
        ],
        password : {
            type : String ,
            required : [true , 'Password is required']
        },
        refreshToken : {
            type : String 
        }
    },{timestamps : true}
)

// dont use  ()=>{} this call back because arrow fun doesnt know about this reference doesnt know about context below here context is important
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    //this upper section encrypt the password
    this.password = await bcrypt.hash(this.password, 10) // it takes rounds and which you want to hash
    next()
} )

userSchema.methods.isPasswordCorrect = async function (password){
   return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function () {
   return jwt.sign(
        {
            _id : this._id,
            email : this.email,
            userName : this.userName,
            fullName : this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn : process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id : this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn : process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const User = mongoose.model("User", userSchema)
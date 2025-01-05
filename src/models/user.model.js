import { Schema } from "mongoose";
import mongoose from "mongoose";
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"


const userSchema= new Schema({
   username:{
    type:String,
    required: true,
    unique: true,
    lowercase:true,
    trim:true,
    index:true //for searching in the MONGODB 
   },
   email:{
    type:String,
    required: true,
    unique: true,
    lowercase:true,
    trim:true,
   },
   fullName:{
    type:String,
    required: true,
    trim:true,
    index:true
   },
   avatar:{
    type:String,
    required:true
   },
   coverImage:{
    type:String //from cloudinary
   },
   watchHistory:[{
    type:Schema.Types.ObjectId, //referenccing from the video model
    ref:"Video"
   }],
   password:{
    type:String,
    required:[true,'Password is required '] //second elemet is ustom error message that will be displayed if the validation fails.
   },
   refreshToken:{
    type:String
   }
},
{
    timestamps:true
}
)

//pre is a middleware here and when save method is called the password is hashed
userSchema.pre("save",async function(next){
    if(!this.isModified("password")) return next(); //if password is not modified 
    this.password =await bcrypt.hash(this.password,10)
    next()
})

//custom method of checking the password
userSchema.methods.isPasswordCorrect=async function (password){
    return await bcrypt.compare(password,this.password)
    
}
//generate token
userSchema.methods.generateAccessToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
            fullName: this.fullName
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

//geenrate refresh token 
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id: this._id,
            
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}
export const User=mongoose.model("User",userSchema)   
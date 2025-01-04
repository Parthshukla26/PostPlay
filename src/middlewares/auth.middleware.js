//it will verify wheater there is user logged in or not 

import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"
import { User } from "../models/user.model.js";
//token is accesed first
//verified token 
//validate the token weather it is correct or not 

export const verifyJWT=asyncHandler(async(req, _ ,next)=>{ //here "res" is replaced with "_" since it was not used here

    try {
        //token is taken 
        const token =req.cookies?.accessToken||req.header("Authorization")?.replace("Bearer ","")
        if(!token){
            throw new ApiError(401, "Unauthorized request")
        }
    
        //token is decoded from secreat key
        const decodedToken =jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
    
        //finding user from id and filtering the password and refreshtoken fields 
        const user=await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if(!user){
            //Next:video disscussion about frontend 
            throw new ApiError(401,"invalid access token") 
        }
    
        //adding the user in the req variable adding the 
        req.user=user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }

})


 
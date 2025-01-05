import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

//making a method
const generateAccessAndRefreshToken = async (userId) => {
    try {
        //finding the user form user id
        const user = await User.findById(userId)

        //generating the access and refresh token  for it
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        //now refresh toen are also saved into the db
        user.refreshToken = refreshToken;

        //now here we were only updating only one field refreshtoken hence to avoid the kick in of other fields 
        //we use validateBeforeSave
        await user.save({ validateBeforeSave: false })


        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "something went wroong while generating access or refesh token ")
    }

}
//1-->>>> user register
const registerUser = asyncHandler(async (req, res) => {
    //algo
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    //only data handling 
    const { fullName, username, email, password } = req.body; //only taking data from the body files from multer as middleware 
    // console.log(req.body)
    //validtion method on all the fields   (!!! revise )
    if ([
        fullName, username, email, password
    ].some((field) => field?.trim() === "")) {
        throw new ApiError(400, "all filed are required")
    }

    //finding wheater the user already exist or not
    const existedUser = await User.findOne({
        $or: [{ username }, { email }] // $or is mongodb operator
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    //now handling the files (some what chaining is done using "?")
    const avatarLocalPath = req.files?.avatar[0]?.path;//files local path in the our server 
    // const coverImageLocalPath= req.files?.coverImage[0]?.path //file path of cover image 

    //another method for validation and cover local path finding
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    //if not uploaded to the local storage avatar check
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    //uploading in cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    console.log(avatar)
    console.log(coverImage)
    if (!avatar) {
        throw new ApiError(400, "avatar image is required")
    }

    //create the user object and make the db entry :
    //.create to push the values 
    const user = await User.create({
        fullName,
        avatar: avatar.url, //saving the avatar imag url genrated by cloudinary in string format to the db
        coverImage: coverImage?.url || "", //use the option storage 
        email,
        password,
        username: username.toLowerCase()
    })

    //checking weather the user is created or not 
    const createdUser = await User.findById(user._id).select(
        "-password -refreshtoken"  //find the user and saving the properties to the varible
        //hiding the password and refreshtoken in it
    )

    if (!createdUser) {
        throw new ApiError(500, "something went wrong the while regisstering the user")
    }

    //now sending the created user data back to frontend (res)
    return res.status(201).json(
        new ApiResponse(200, createdUser, "user is registerd sucessfully")
    )


})

//2-->>>>now for LOGIN
const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // check the existence of username or email
    //find the user 
    //password check
    //access and referesh token
    //send cookie

    const { username, email, password } = req.body;

    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    
    //validation for login with either username or email
    // if (!(username || email)) {
    //     throw new ApiError(400, "both username or email is required")
    // }

    //user is found from the db with either email or username
    const user = await User.findOne({    //imp HERE "User" is the schema stored in mongoose and it is having the findOne like properties 
        $or: [{ username}, {email }]
    })

    //if not found user
    if (!user) {
        throw new ApiError(404, "user not found")
    }

    //from coustom method checking the password
    const isPasswordValid = await user.isPasswordCorrect(password)
    //validation
    if (!isPasswordValid) {
        throw new ApiError(401, "invalid credentials")
    }

    //generetingt he access and refresh token from the user data 
    const { refreshToken, accessToken } = await generateAccessAndRefreshToken(user._id)

    //now to return the user reponse , hence making another database call for the user without the password nd accesstoken 
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //NOW Setting and sending cookies 

    //only making it modifirable from server 
    const options = {
        httpOnly: true,
        secure: true
    }

    //returning the respnse to the user

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200, {
                user: loggedInUser, accessToken, refreshToken
            },
                "user is loggned in sucessfuly "
            )
        )
    

})

// 3->>>> logout the user from removeing the refresh token from db and clearing the cookies
const logoutUser = asyncHandler(async (req, res) => {    

    //finding the user from the userid and removing its refreshtoken 
    await User.findByIdAndUpdate(
        req.user._id, {
        $unset: {
            refreshToken: 1 //setting the refreshtoken in db to undefined
        }
    },
        {
            new: true //and updated the value 
        }

    )

//also clearing the coookies 
    const options={
        httpOnly:true,
        secure:true
    }

    //clearing the cookies
 return res
 .status(200)
 .clearCookie("accessToken",options)
 .clearCookie("refreshToken",options)
 .json(new ApiResponse(200,{},"User is logged out "))
 
    
})

//4->> refresh token handler for user to again login on the basis of refreshtoken after the expirey of acesstoken 
const refreshAccessToken=asyncHandler(async (req,res)=>{

    //taking the refresh token from cookies or body(if the user req is from mobile )
    const incomingRefreshToken = req.cookies.refreshToken||req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }

// NOW decoding the refresh token and TAKING THE USER_ID out from it then ON THE ID SERCHING IN 
//DB AND UPDATING THE REFRESHTOKEN AND PROVIDING THE NEW ACCESS TOKEN

try {
    //decoded
    const decodedToken=jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
    )
    
    //finding the user 
    const user=await User.findById(decodedToken?._id)
    if (!user) {
        throw new ApiError(401, "Invalid refresh token")
    }
    
    //now applying the validation bw te incomming refesh token and the stored refeshtoken in the databases
    //if not same then error 
    if(incomingRefreshToken!==user?.refreshToken){
        throw new ApiError(401, "Refresh token is expired or used")
    }
    
    //other wise generate new refeshtoken and acesstoken
    const options={
        httpOnly:true,
        secure:true
    }
    //generating new token 
    const {accessToken,newRefreshToken}=generateAccessAndRefreshToken(user._id)
    
    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",newRefreshToken,options)
    .json( new ApiResponse(
        200,
        {
            accessToken:accessToken,
            refreshToken:newRefreshToken
        },
        "access token refreshed"
    ))
} catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")

}


})


export { registerUser, loginUser, logoutUser }
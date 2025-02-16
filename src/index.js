import 'dotenv/config';  // This should load your .env file automatically
import connectDB from "./db/index.js";  // Import with .js extension
import app from './app.js'
import dotenv from "dotenv"

dotenv.config({
    path: './.env'
})



connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log(`⚙️ Server is running at port : ${process.env.PORT}`);
    })
})
.catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
})

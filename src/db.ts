import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const dbURI = 'mongodb://localhost:27017/ClientServerDB';
        await mongoose.connect(dbURI);
        console.log(">>> DB is connected");
    } catch (error) {
        console.error("Connection error:", error);
    }
}

import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        await mongoose.connect('mongodb+srv://eduartrob2:eduartrob@actividades.i8r8wcz.mongodb.net/TheGame?retryWrites=true&w=majority&appName=actividades')
        console.log(">>> DB is connected")
    } catch (error) {
        console.log(error)
    }
}

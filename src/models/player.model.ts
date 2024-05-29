import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true, trim: true, unique: true },
    score: { type: Number, default: 0 },
    lives: {type: Number, default: 3}
});

const schemas = {
    Player: mongoose.model('Player', playerSchema),
}

export default schemas;

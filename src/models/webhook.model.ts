import mongoose from 'mongoose';

const webhookSchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
});

export const Webhook = mongoose.model('Webhook', webhookSchema);

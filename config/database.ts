import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('Chưa có MONGODB_URI');
    }
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB đã kết nối: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Lỗi: ${(error as Error).message}`);
    process.exit(1);
  }
};

export default connectDB;

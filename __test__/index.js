const mongoose = require('mongoose');
require('dotenv').config();
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Đã kết nối MongoDB Atlas!'))
  .catch((err) => console.error('❌ Kết nối thất bại:', err));

const userSchema = new mongoose.Schema({
  name: String,
  age: Number,
});

const User = mongoose.model('User', userSchema);

const user = new User({ name: 'Tuyet', age: 21 });
user.save();

const mongoose = require('mongoose');

const serverSettingsSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  wolfVoteTime: {
    type: Number,
    default: 40,
  },
  nightTime: {
    type: Number,
    default: 70,
  },
  discussTime: {
    type: Number,
    default: 90,
  },
  voteTime: {
    type: Number,
    default: 30,
  },
});

module.exports = mongoose.model('ServerSettings', serverSettingsSchema);

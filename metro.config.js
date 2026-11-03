const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

// تعطيل المراقبة تماماً لتجنب خطأ ENOSPC في Termux
config.watcher = {
  ...config.watcher,
  watchman: {
    enable: false,
  },
  node: {
    enable: false,
  },
};

module.exports = config;

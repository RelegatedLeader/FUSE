const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.alias = {
  ...config.resolver.alias,
  "node:crypto": "react-native-crypto",
  crypto: "react-native-crypto",
  stream: "readable-stream",
  string_decoder: "string_decoder",
  util: "util",
  events: "events",
  buffer: "buffer",
  process: "process",
};

module.exports = config;

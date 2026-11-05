module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // Required by react-native-reanimated (and victory-native charts):
    // must stay LAST in this array.
    plugins: ["react-native-reanimated/plugin"],
  };
};

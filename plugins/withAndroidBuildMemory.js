const { withGradleProperties } = require('@expo/config-plugins');

// Reduce the Android build's memory footprint so the EAS worker stops getting
// OOM-killed ("We've lost connection to the worker"). Two levers:
//   1. Build only the ABIs real driver phones use (arm64-v8a + armeabi-v7a)
//      instead of all four — x86/x86_64 are emulator-only and roughly double the
//      native (reanimated / worklets / New Architecture C++) compile load.
//   2. Disable parallel project builds to lower peak memory.
// Hermes and the New Architecture stay enabled (react-native-reanimated 4
// requires the New Architecture).
const GRADLE_PROPERTIES = {
  reactNativeArchitectures: 'arm64-v8a,armeabi-v7a',
  'org.gradle.parallel': 'false',
};

module.exports = function withAndroidBuildMemory(config) {
  return withGradleProperties(config, (cfg) => {
    for (const [key, value] of Object.entries(GRADLE_PROPERTIES)) {
      const existing = cfg.modResults.find(
        (item) => item.type === 'property' && item.key === key
      );
      if (existing) {
        existing.value = value;
      } else {
        cfg.modResults.push({ type: 'property', key, value });
      }
    }
    return cfg;
  });
};

const { withAppBuildGradle } = require('@expo/config-plugins');

const MULTIDEX_MARKER = 'multiDexEnabled true';

function enableMultiDex(contents) {
  if (new RegExp(`multiDexEnabled\\s+true`).test(contents)) return contents;

  const defaultConfigRegex = /(defaultConfig\s*\{)([\s\S]*?)(^    \})/m;
  const match = contents.match(defaultConfigRegex);
  if (!match) {
    throw new Error('[withKeynestAndroid] Could not find defaultConfig { } block in android/app/build.gradle');
  }
  const [full, head, body, tail] = match;
  return contents.replace(full, `${head}${body}        ${MULTIDEX_MARKER}\n${tail}`);
}

const withKeynestAndroid = (config) => {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = enableMultiDex(cfg.modResults.contents);
    return cfg;
  });
};

module.exports = withKeynestAndroid;

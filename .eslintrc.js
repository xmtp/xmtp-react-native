module.exports = {
  root: true,
  extends: ['universe/native', 'universe/web'],
  ignorePatterns: ['build'],
  plugins: ['prettier'],
  globals: {
    __dirname: true,
  },
}

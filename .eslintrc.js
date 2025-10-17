module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './example/tsconfig.json'],
  },
  plugins: ['@typescript-eslint'],
  extends: ['universe/native', 'universe/web'],
  ignorePatterns: ['build'],
  plugins: ['prettier'],
  globals: {
    __dirname: true,
  },
  rules: {
    '@typescript-eslint/no-floating-promises': ['error'],
  },
}

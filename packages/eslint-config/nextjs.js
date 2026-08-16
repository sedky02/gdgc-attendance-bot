const base = require("./base.js");

module.exports = [
  ...base,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

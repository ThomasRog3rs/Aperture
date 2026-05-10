const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "aperture",
      cwd: __dirname,
      script: "npm",
      args: "start",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        APERTURE_DATA_DIR: path.join(__dirname, "data"),
      },
    },
  ],
};
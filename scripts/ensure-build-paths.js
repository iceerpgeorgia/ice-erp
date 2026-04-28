const fs = require('fs');
const path = require('path');

const deployLogPath = path.join(process.cwd(), '_deploy-log');

if (!fs.existsSync(deployLogPath)) {
  fs.mkdirSync(deployLogPath, { recursive: true });
}
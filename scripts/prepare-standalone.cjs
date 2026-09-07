/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const standaloneRoot = path.join(projectRoot, '.next', 'standalone')

function copyDirectory(source, destination) {
  if (!fs.existsSync(source)) return
  fs.mkdirSync(path.dirname(destination), { recursive: true })
  fs.cpSync(source, destination, { recursive: true, force: true })
}

if (fs.existsSync(standaloneRoot)) {
  copyDirectory(path.join(projectRoot, 'public'), path.join(standaloneRoot, 'public'))
  copyDirectory(path.join(projectRoot, '.next', 'static'), path.join(standaloneRoot, '.next', 'static'))
}

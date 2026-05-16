/**
 * Post-install script to patch NeteaseCloudMusicApi v4.31.0
 * Fixes: anonymous_token crash and QR login endpoints
 */
const fs = require('fs')
const path = require('path')

const ncmPath = path.join(__dirname, '..', 'node_modules', 'NeteaseCloudMusicApi')

// 1. Fix anonymous_token read crash in util/request.js
const requestPath = path.join(ncmPath, 'util', 'request.js')
if (fs.existsSync(requestPath)) {
  let content = fs.readFileSync(requestPath, 'utf-8')
  const oldToken = `// 预先读取匿名token并缓存
const anonymous_token = fs.readFileSync(
  path.resolve(tmpPath, './anonymous_token'),
  'utf-8',
)`
  const newToken = `// 预先读取匿名token并缓存
let anonymous_token = ''
try {
  anonymous_token = fs.readFileSync(
    path.resolve(tmpPath, './anonymous_token'),
    'utf-8',
  )
} catch (e) {
  // file may not exist yet, will be created by main.js
}`
  if (content.includes('const anonymous_token = fs.readFileSync')) {
    content = content.replace(oldToken, newToken)
    fs.writeFileSync(requestPath, content, 'utf-8')
    console.log('[patch] Fixed anonymous_token crash in util/request.js')
  }
}

// 2. Fix login_qr_key.js - use axios directly
const qrKeyPath = path.join(ncmPath, 'module', 'login_qr_key.js')
fs.writeFileSync(qrKeyPath, `const axios = require('axios')
const { URLSearchParams } = require('url')

module.exports = async (query) => {
  const res = await axios({
    method: 'POST',
    url: 'https://interface.music.163.com/api/login/qrcode/unikey',
    data: new URLSearchParams({ type: 3 }).toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 NeteaseMusicDesktop/3.0.18.203152',
      'Referer': 'https://music.163.com',
    },
  })
  return {
    status: 200,
    body: {
      data: res.data,
      code: 200,
    },
    cookie: (res.headers['set-cookie'] || []).map(x =>
      x.replace(/\\s*Domain=[^(;|$)]+;*/, '')
    ),
  }
}
`)
console.log('[patch] Fixed login_qr_key.js')

// 3. Fix login_qr_check.js - use axios directly, fix catch block bug
const qrCheckPath = path.join(ncmPath, 'module', 'login_qr_check.js')
fs.writeFileSync(qrCheckPath, `const axios = require('axios')
const { URLSearchParams } = require('url')

module.exports = async (query) => {
  try {
    const res = await axios({
      method: 'POST',
      url: 'https://interface.music.163.com/api/login/qrcode/client/login',
      data: new URLSearchParams({ key: query.key, type: 3 }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.164 NeteaseMusicDesktop/3.0.18.203152',
        'Referer': 'https://music.163.com',
      },
    })
    const cookies = (res.headers['set-cookie'] || []).map(x =>
      x.replace(/\\s*Domain=[^(;|$)]+;*/, '')
    )
    return {
      status: 200,
      body: {
        ...res.data,
        cookie: cookies.join(';'),
      },
      cookie: cookies,
    }
  } catch (error) {
    return {
      status: 200,
      body: { code: 800, message: '二维码不存在或已过期', cookie: '' },
      cookie: [],
    }
  }
}
`)
console.log('[patch] Fixed login_qr_check.js')

console.log('[patch] All NeteaseCloudMusicApi patches applied.')

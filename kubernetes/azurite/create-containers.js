// Run inside the ready Azurite pod; uses only Node's built-in modules.
const http = require('http');
const crypto = require('crypto');
const account = process.env.BLOB_ACCOUNT;
const key = Buffer.from(process.env.BLOB_KEY, 'base64');
async function createContainer(name) {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(name)) throw new Error(`Invalid container: ${name}`);
  const path = `/${account}/${name}?restype=container`;
  const date = new Date().toUTCString();
  const version = '2019-07-07';
  const canonicalHeaders = `x-ms-date:${date}\nx-ms-version:${version}\n`;
  const resource = `/${account}/${account}/${name}\nrestype:container`;
  const stringToSign = ['PUT', '', '', '', '', '', '', '', '', '', '', ''].join('\n') + '\n' + canonicalHeaders + resource;
  const signature = crypto.createHmac('sha256', key).update(stringToSign).digest('base64');
  await new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port: 10000, path, method: 'PUT',
      headers: {'x-ms-date': date, 'x-ms-version': version, 'Content-Length': '0',
        Authorization: `SharedKey ${account}:${signature}`}}, response => {
      let body = '';
      response.on('data', chunk => body += chunk);
      response.on('end', () => {
        if (response.statusCode === 201) { console.log(`Created ${name}`); resolve(); }
        else if (response.statusCode === 409 && body.includes('ContainerAlreadyExists')) {
          console.log(`Already exists: ${name}`); resolve();
        } else reject(new Error(`Container ${name}: HTTP ${response.statusCode}: ${body}`));
      });
    });
    req.setTimeout(10000, () => req.destroy(new Error('Azurite request timed out')));
    req.on('error', reject);
    req.end();
  });
}
(async () => {
  for (const name of JSON.parse(process.env.BLOB_CONTAINERS)) await createContainer(name);
})().catch(error => { console.error(error.message); process.exitCode = 1; });

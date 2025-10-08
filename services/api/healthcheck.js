const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 4000,
  timeout: 2000,
  path: '/health'
};

const healthCheck = http.request(options, (res) => {
  console.log(`HEALTH CHECK STATUS: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

healthCheck.on('error', function (err) {
  console.error('HEALTH CHECK ERROR:', err.message);
  process.exit(1);
});

healthCheck.end();
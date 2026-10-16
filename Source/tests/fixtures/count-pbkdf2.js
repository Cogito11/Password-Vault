// Preloaded (node --require) into the native-messaging host by extension-host.test.js.
// Appends one line to $PV_PBKDF2_LOG every time the host derives a key, so the test can
// check how many 200,000-round derivations a sequence of requests really costs.
const crypto = require('crypto');
const fs = require('fs');
const real = crypto.pbkdf2Sync;
crypto.pbkdf2Sync = function () {
  fs.appendFileSync(process.env.PV_PBKDF2_LOG, 'x\n');
  return real.apply(this, arguments);
};

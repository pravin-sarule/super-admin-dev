/**
 * Jurinex Voice module entry point.
 *
 * Usage from server.js:
 *   const jurinexVoice = require('./modules/jurinex-voice');
 *   app.use('/admin/jurinex-voice', jurinexVoice(pool));
 */
module.exports = require('./jurinexVoice.routes');

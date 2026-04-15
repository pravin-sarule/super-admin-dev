async function run() {
  require('dotenv').config();
  const { bucket } = require('./config/gcs');
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  
  try {
    const res = await pool.query("SELECT ocr_json_path FROM judgment_pages WHERE document_id='d429eeb1-b26d-4fe9-89e3-0922220d6544' AND page_number=54;");
    if (!res.rows[0]) return console.log('no page');
    const path = res.rows[0].ocr_json_path;
    console.log('Path:', path);
    const file = bucket.file(path);
    const [buffer] = await file.download();
    const jsonObj = JSON.parse(buffer.toString('utf8'));
    console.log('Keys in jsonObj:', Object.keys(jsonObj));
    if (jsonObj.mode === 'async_batch') {
      const firstOutputFile = jsonObj.outputFiles[0];
      const match = firstOutputFile.match(/^gs:\/\/([^/]+)\/?(.*)$/);
      const shardFile = bucket.file(match[2]);
      const [shardBuffer] = await shardFile.download();
      const shardObj = JSON.parse(shardBuffer.toString('utf8'));
      const doc = shardObj.document || shardObj;
      const page = doc.pages[0];
      console.log('Page keys:', Object.keys(page));
      console.log('Lines length:', page.lines?.length);
      console.log('Paragraphs length:', page.paragraphs?.length);
      console.log('Blocks length:', page.blocks?.length);
      console.log('Tokens length:', page.tokens?.length);
    }
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();

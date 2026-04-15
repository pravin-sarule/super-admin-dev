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
    const path = res.rows[0].ocr_json_path;
    const file = bucket.file(path);
    const [buffer] = await file.download();
    const jsonObj = JSON.parse(buffer.toString('utf8'));
    const doc = jsonObj.document || jsonObj;
    const page = doc.pages[0];
    
    console.log(JSON.stringify(page.blocks[0], null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();

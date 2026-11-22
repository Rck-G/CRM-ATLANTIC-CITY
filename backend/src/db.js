
const sql = require('mssql');
const required = ['DB_SERVER','DB_NAME','DB_USER','DB_PASSWORD'];
function config() {
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) throw Object.assign(new Error(`Faltan variables: ${missing.join(', ')}`), { code:'CONFIG_MISSING' });
  const c = {
    server: process.env.DB_SERVER, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: {
      encrypt: String(process.env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE || 'false').toLowerCase() === 'true',
      enableArithAbort: true
    },
    pool: { min:0, max:10, idleTimeoutMillis:30000 },
    connectionTimeout:10000, requestTimeout:30000
  };
  if (process.env.DB_PORT) c.port = Number(process.env.DB_PORT);
  return c;
}
let poolPromise;
async function getPool() {
  if (!poolPromise) {
    const pool = new sql.ConnectionPool(config());
    pool.on('error', e => console.error('[SQL Server pool]', e.message));
    poolPromise = pool.connect().catch(e => { poolPromise=null; throw e; });
  }
  return poolPromise;
}
async function query(text, inputs={}) {
  const p=await getPool(), r=p.request();
  for (const [k,v] of Object.entries(inputs)) r.input(k, v);
  return r.query(text);
}
async function health() {
  try { await query('SELECT 1 AS connected, DB_NAME() AS databaseName'); return {ok:true,database:'connected'}; }
  catch(e) {
    const code=e.code || (e.originalError && e.originalError.code) || 'DB_ERROR';
    const message = code==='ESOCKET' ? 'No se pudo establecer conexión TCP. Revise TCP/IP, servidor y puerto.' :
      code==='ECONNREFUSED' ? 'SQL Server rechazó la conexión. Revise el servicio y el puerto.' :
      code==='ELOGIN' ? 'SQL Server rechazó las credenciales del usuario de aplicación.' : e.message;
    return {ok:false,database:'disconnected',code,message};
  }
}
async function close(){ if(poolPromise){const p=await poolPromise.catch(()=>null);poolPromise=null;if(p)await p.close();}}
module.exports={sql,getPool,query,health,close};

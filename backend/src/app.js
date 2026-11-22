
require('dotenv').config({path:require('path').join(__dirname,'../.env')});
const express=require('express'), path=require('path'), crypto=require('crypto');
const bcrypt=require('bcryptjs'), jwt=require('jsonwebtoken'), cors=require('cors'), helmet=require('helmet');
const rateLimit=require('express-rate-limit'), db=require('./db');
const app=express(), {sql}=db, PORT=Number(process.env.PORT||3000);
if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32) console.warn('ADVERTENCIA: JWT_SECRET debe tener al menos 32 caracteres aleatorios.');
app.disable('x-powered-by'); app.use(helmet({contentSecurityPolicy:false}));
app.use(cors({origin:process.env.FRONTEND_ORIGIN||'http://localhost:3000'})); app.use(express.json({limit:'1mb'}));
const id=()=>crypto.randomUUID(), now=()=>new Date(), asyncRoute=f=>(q,s,n)=>Promise.resolve(f(q,s,n)).catch(n);
const auth=asyncRoute(async(req,res,next)=>{
 const h=req.headers.authorization||''; if(!h.startsWith('Bearer '))return res.status(401).json({error:'Sesión no válida'});
 try {const p=jwt.verify(h.slice(7),process.env.JWT_SECRET);const r=await db.query('SELECT id,name,email,role,client_id FROM dbo.users WHERE id=@id AND is_active=1',{id:p.sub});if(!r.recordset.length)return res.status(401).json({error:'Usuario inactivo o inexistente'});req.user=r.recordset[0];next();}
 catch(e){if(e.name==='JsonWebTokenError'||e.name==='TokenExpiredError')return res.status(401).json({error:'Sesión expirada o inválida'});throw e;}
});
const roles=(...a)=>(req,res,next)=>!req.user||!a.includes(req.user.role)?res.status(403).json({error:'Permisos insuficientes'}):next();
const sign=u=>jwt.sign({sub:u.id},process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN||'8h'});
async function audit(u,action,resource,rid,outcome='SUCCESS'){await db.query(`INSERT dbo.audit_events(id,actor_id,action,resource,resource_id,outcome,created_at) VALUES(@id,@u,@a,@r,@rid,@o,SYSUTCDATETIME())`,{id:id(),u:u||null,a:action,r:resource,rid:String(rid||''),o:outcome});}
app.get('/api/health',asyncRoute(async(req,res)=>{const h=await db.health();res.status(h.ok?200:503).json(h)}));
app.get('/api/auth/bootstrap-status',asyncRoute(async(req,res)=>{const r=await db.query("SELECT COUNT_BIG(*) AS n FROM dbo.users WHERE role='ADMIN'");res.json({available:Number(r.recordset[0].n)===0})}));
app.post('/api/auth/bootstrap-admin',rateLimit({windowMs:900000,max:5}),asyncRoute(async(req,res)=>{
 const {name,email,password}=req.body||{};if(!name||!/^\S+@\S+\.\S+$/.test(email||'')||String(password||'').length<12)return res.status(400).json({error:'Nombre, correo válido y contraseña de al menos 12 caracteres requeridos'});
 const tx=new sql.Transaction(await db.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{const r=await new sql.Request(tx).query("SELECT COUNT_BIG(*) n FROM dbo.users WHERE role='ADMIN'");if(Number(r.recordset[0].n)>0){await tx.rollback();return res.status(409).json({error:'La configuración inicial ya fue completada'});}
 const uid=id(),hash=await bcrypt.hash(password,12);const q=new sql.Request(tx);q.input('id',sql.Char(36),uid).input('name',sql.NVarChar(160),name.trim()).input('email',sql.NVarChar(190),email.toLowerCase()).input('hash',sql.NVarChar(255),hash);await q.query("INSERT dbo.users(id,name,email,password_hash,role,is_active,created_at,updated_at) VALUES(@id,@name,@email,@hash,'ADMIN',1,SYSUTCDATETIME(),SYSUTCDATETIME())");await tx.commit();res.status(201).json({message:'Administrador inicial creado. Inicie sesión.'});
 }catch(e){await tx.rollback();throw e;}
}));
app.post('/api/auth/login',rateLimit({windowMs:900000,max:10,standardHeaders:true,legacyHeaders:false}),asyncRoute(async(req,res)=>{
 const email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||'');
 const r=await db.query('SELECT TOP (1) id,name,email,password_hash,role,client_id,is_active FROM dbo.users WHERE email=@email',{email});
 const u=r.recordset[0];if(!u||!u.is_active||!await bcrypt.compare(password,u.password_hash))return res.status(401).json({error:'Correo o contraseña incorrectos'});
 const user={id:u.id,name:u.name,email:u.email,role:u.role,client_id:u.client_id};res.json({token:sign(user),user});
}));
app.get('/api/auth/me',auth,(req,res)=>res.json(req.user));
app.post('/api/auth/logout',auth,(req,res)=>res.json({message:'Sesión cerrada. Elimine el token del cliente.'}));
app.post('/api/auth/register',asyncRoute(async(req,res)=>{
 const d=req.body||{};if(!d.dni||!d.firstName||!d.lastName||!/^\S+@\S+\.\S+$/.test(d.email||'')||String(d.password||'').length<10)return res.status(400).json({error:'Documento, nombres, apellidos, correo válido y contraseña de 10 caracteres requeridos'});
 const tx=new sql.Transaction(await db.getPool());await tx.begin();
 try{const cid=id(),uid=id(),hash=await bcrypt.hash(d.password,12);let q=new sql.Request(tx);
 q.input('id',sql.Char(36),cid).input('dni',sql.NVarChar(60),d.dni.trim()).input('fn',sql.NVarChar(120),d.firstName.trim()).input('ln',sql.NVarChar(120),d.lastName.trim()).input('email',sql.NVarChar(190),d.email.toLowerCase()).input('phone',sql.NVarChar(60),d.phone||null).input('consent',sql.Bit,!!d.consentMarketing);
 await q.query("INSERT dbo.clients(id,dni,first_name,last_name,email,phone,consent_marketing,vip_tier,vip_score,created_at,updated_at) VALUES(@id,@dni,@fn,@ln,@email,@phone,@consent,'SILVER',0,SYSUTCDATETIME(),SYSUTCDATETIME())");
 q=new sql.Request(tx);q.input('id',sql.Char(36),uid).input('name',sql.NVarChar(160),d.firstName.trim()+' '+d.lastName.trim()).input('email',sql.NVarChar(190),d.email.toLowerCase()).input('hash',sql.NVarChar(255),hash).input('cid',sql.Char(36),cid);
 await q.query("INSERT dbo.users(id,name,email,password_hash,role,client_id,is_active,created_at,updated_at) VALUES(@id,@name,@email,@hash,'CLIENT',@cid,1,SYSUTCDATETIME(),SYSUTCDATETIME())");await tx.commit();const user={id:uid,name:d.firstName+' '+d.lastName,email:d.email.toLowerCase(),role:'CLIENT',client_id:cid};res.status(201).json({message:'Cuenta creada',token:sign(user),user});
 }catch(e){await tx.rollback();if(e.number===2601||e.number===2627)return res.status(409).json({error:'El documento o correo ya está registrado'});throw e;}
}));
app.use('/api',auth);
const resources={
 clients:{table:'clients',roles:['ADMIN','EMPLOYEE','MARKETING'],fields:{dni:'dni',firstName:'first_name',lastName:'last_name',email:'email',phone:'phone',birthDate:'birth_date',consentMarketing:'consent_marketing',preferences:'preferences'},required:['dni','firstName','lastName'],order:'created_at'},
 campaigns:{table:'campaigns',roles:['ADMIN','MARKETING'],fields:{name:'name',description:'description',status:'status',targetTier:'target_tier',startsAt:'starts_at',endsAt:'ends_at',channel:'channel'},required:['name'],order:'created_at'},
 benefits:{table:'benefits',roles:['ADMIN','MARKETING'],fields:{campaignId:'campaign_id',name:'name',description:'description',code:'code',tier:'tier',validFrom:'valid_from',validUntil:'valid_until',maxRedemptions:'max_redemptions',status:'status'},required:['name','code'],order:'created_at'},
 tickets:{table:'tickets',roles:['ADMIN','EMPLOYEE','MARKETING','CLIENT'],fields:{clientId:'client_id',subject:'subject',description:'description',category:'category',priority:'priority',status:'status',department:'department'},required:['subject','description'],order:'created_at'},
 restaurants:{table:'restaurants',roles:['ADMIN','EMPLOYEE'],fields:{code:'code',name:'name',description:'description',location:'location',capacity:'capacity',active:'active'},required:['code','name'],order:'created_at'},
 reservations:{table:'reservations',roles:['ADMIN','EMPLOYEE','MARKETING'],fields:{restaurantId:'restaurant_id',clientId:'client_id',guestName:'guest_name',guestEmail:'guest_email',guestPhone:'guest_phone',partySize:'party_size',startsAt:'starts_at',endsAt:'ends_at',status:'status',notes:'notes'},required:['restaurantId','guestName','partySize','startsAt','endsAt'],order:'starts_at'},
 events:{table:'events',roles:['ADMIN','MARKETING'],fields:{code:'code',name:'name',description:'description',venue:'venue',startsAt:'starts_at',endsAt:'ends_at',capacity:'capacity',status:'status'},required:['code','name','startsAt','endsAt'],order:'starts_at'},
 integrations:{table:'integrations',roles:['ADMIN'],fields:{name:'name',type:'type',endpoint:'endpoint',enabled:'enabled'},required:['name','type'],order:'created_at'}
};
const types={consentMarketing:sql.Bit,active:sql.Bit,enabled:sql.Bit,capacity:sql.Int,partySize:sql.Int,maxRedemptions:sql.Int,startsAt:sql.DateTime2,endsAt:sql.DateTime2,validFrom:sql.DateTime2,validUntil:sql.DateTime2,birthDate:sql.Date};
function valType(k,v){if(types[k])return types[k];if(typeof v==='boolean')return sql.Bit;if(typeof v==='number')return sql.Decimal(14,2);return sql.NVarChar(sql.MAX);}
function bind(q,k,v){q.input(k,types[k]|| (typeof v==='boolean'?sql.Bit:typeof v==='number'?sql.Decimal(14,2):sql.NVarChar(sql.MAX)),v===undefined?null:v);}
const readRoles={
 clients:['ADMIN','EMPLOYEE','MARKETING'], campaigns:['ADMIN','EMPLOYEE','MARKETING'],
 benefits:['ADMIN','EMPLOYEE','MARKETING'], tickets:['ADMIN','EMPLOYEE','MARKETING','CLIENT'],
 restaurants:['ADMIN','EMPLOYEE','MARKETING'], reservations:['ADMIN','EMPLOYEE','MARKETING'],
 events:['ADMIN','EMPLOYEE','MARKETING'], integrations:['ADMIN']
};
for(const [key,c] of Object.entries(resources)){
 app.get('/api/'+key,asyncRoute(async(req,res)=>{
  if(key==='tickets'&&req.user.role==='CLIENT'){
   const r=await db.query('SELECT * FROM dbo.tickets WHERE client_id=@cid ORDER BY created_at DESC',{cid:req.user.client_id});return res.json(r.recordset);
  }
  if(!(readRoles[key]||[]).includes(req.user.role))return res.status(403).json({error:'Permisos insuficientes'});
  const r=key==='reservations'?await db.query(`SELECT r.*,rs.name AS restaurant_name FROM dbo.reservations r INNER JOIN dbo.restaurants rs ON rs.id=r.restaurant_id ORDER BY r.starts_at DESC`):await db.query(`SELECT * FROM dbo.${c.table} ORDER BY ${c.order} DESC`);res.json(r.recordset);
 }));
 app.post('/api/'+key,roles(...c.roles),asyncRoute(async(req,res)=>{
  const d=req.body||{};if(c.required.some(k=>d[k]===undefined||d[k]===''))return res.status(400).json({error:'Completa los campos obligatorios'});
  if(key==='tickets'&&req.user.role==='CLIENT')d.clientId=req.user.client_id;
  if(key==='reservations'){
   const start=new Date(d.startsAt),end=new Date(d.endsAt),party=Number(d.partySize);
   if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||!Number.isInteger(party)||party<1)return res.status(400).json({error:'Intervalo de fechas o cantidad de personas inválidos'});
   const tx=new sql.Transaction(await db.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
   try{let check=new sql.Request(tx);check.input('rid',sql.Char(36),d.restaurantId).input('start',sql.DateTime2,start).input('end',sql.DateTime2,end);
    const conflict=await check.query("SELECT TOP (1) id FROM dbo.reservations WITH (UPDLOCK,HOLDLOCK) WHERE restaurant_id=@rid AND status NOT IN ('CANCELLED','REJECTED') AND starts_at<@end AND ends_at>@start");
    if(conflict.recordset.length){await tx.rollback();return res.status(409).json({error:'El restaurante ya tiene una reserva en ese intervalo'});}
    const rid=id(),q=new sql.Request(tx),fields=Object.entries(c.fields).filter(([k])=>d[k]!==undefined);q.input('id',sql.Char(36),rid);
    const cols=['id'],pars=['@id'];for(const [k,col] of fields){bind(q,k,d[k]);cols.push(col);pars.push('@'+k);}
    cols.push('created_at','updated_at');pars.push('SYSUTCDATETIME()','SYSUTCDATETIME()');
    await q.query(`INSERT dbo.reservations(${cols.join(',')}) VALUES(${pars.join(',')})`);await tx.commit();await audit(req.user.id,'RESERVATIONS_CREATED','reservations',rid);return res.status(201).json({id:rid,message:'Reserva creada'});
   }catch(e){await tx.rollback();throw e;}
  }
  const idv=id(),fields=Object.entries(c.fields).filter(([k])=>d[k]!==undefined),q=(await db.getPool()).request();
  q.input('id',sql.Char(36),idv);const cols=['id'],pars=['@id'];for(const [k,col] of fields){bind(q,k,d[k]);cols.push(col);pars.push('@'+k);}
  if(key==='tickets'){q.input('createdById',sql.Char(36),req.user.id);cols.push('created_by_id');pars.push('@createdById');q.input('ticketNo',sql.NVarChar(40),'AC-'+Date.now());cols.push('ticket_no');pars.push('@ticketNo');}
  cols.push('created_at','updated_at');pars.push('SYSUTCDATETIME()','SYSUTCDATETIME()');
  await q.query(`INSERT dbo.${c.table}(${cols.join(',')}) VALUES(${pars.join(',')})`);await audit(req.user.id,key.toUpperCase()+'_CREATED',key,idv);res.status(201).json({id:idv,message:'Registro creado'});
 }));
 app.patch('/api/'+key+'/:rid',roles(...c.roles),asyncRoute(async(req,res)=>{
  const d=req.body||{},fields=Object.entries(c.fields).filter(([k])=>d[k]!==undefined);if(!fields.length)return res.status(400).json({error:'No hay cambios'});
  const q=(await db.getPool()).request();q.input('rid',sql.Char(36),req.params.rid);fields.forEach(([k,col])=>bind(q,k,d[k]));
  const sets=fields.map(([k,col])=>`${col}=@${k}`).join(',');const r=await q.query(`UPDATE dbo.${c.table} SET ${sets},updated_at=SYSUTCDATETIME() WHERE id=@rid`);
  if(!r.rowsAffected[0])return res.status(404).json({error:'Registro no encontrado'});await audit(req.user.id,key.toUpperCase()+'_UPDATED',key,req.params.rid);res.json({message:'Registro actualizado'});
 }));
}
app.get('/api/clients/:cid',asyncRoute(async(req,res)=>{
 if(req.user.role==='CLIENT'&&req.user.client_id!==req.params.cid)return res.status(403).json({error:'Permisos insuficientes'});
 const r=await db.query('SELECT * FROM dbo.clients WHERE id=@id',{id:req.params.cid});if(!r.recordset.length)return res.status(404).json({error:'Cliente no encontrado'});
 const a=await db.query('SELECT TOP (200) * FROM dbo.client_activity WHERE client_id=@id ORDER BY occurred_at DESC',{id:req.params.cid});res.json({...r.recordset[0],firstName:r.recordset[0].first_name,lastName:r.recordset[0].last_name,vipTier:r.recordset[0].vip_tier,vipScore:r.recordset[0].vip_score,activity:a.recordset});
}));
app.delete('/api/clients/:cid',roles('ADMIN','EMPLOYEE'),asyncRoute(async(req,res)=>{const r=await db.query('UPDATE dbo.clients SET updated_at=SYSUTCDATETIME() WHERE id=@id AND NOT EXISTS(SELECT 1 FROM dbo.users WHERE client_id=@id)',{id:req.params.cid});if(!r.rowsAffected[0])return res.status(409).json({error:'No se pudo eliminar: no existe o tiene cuenta vinculada. Desactiva la cuenta para conservar el historial.'});await audit(req.user.id,'CLIENT_DEACTIVATION_REQUESTED','clients',req.params.cid);res.json({message:'Registro actualizado; conserva el historial.'})}));
app.get('/api/users',roles('ADMIN'),asyncRoute(async(req,res)=>{const r=await db.query('SELECT id,name,email,role,is_active,created_at FROM dbo.users ORDER BY created_at DESC');res.json(r.recordset)}));
app.post('/api/users',roles('ADMIN'),asyncRoute(async(req,res)=>{const d=req.body||{};if(!d.name||!/^\S+@\S+\.\S+$/.test(d.email||'')||String(d.password||'').length<10||!['ADMIN','EMPLOYEE','MARKETING'].includes(d.role))return res.status(400).json({error:'Nombre, correo, contraseña (10+) y rol válido requeridos'});const uid=id();await db.query("INSERT dbo.users(id,name,email,password_hash,role,is_active,created_at,updated_at) VALUES(@id,@name,@email,@hash,@role,1,SYSUTCDATETIME(),SYSUTCDATETIME())",{id:uid,name:d.name,email:d.email.toLowerCase(),hash:await bcrypt.hash(d.password,12),role:d.role});await audit(req.user.id,'USER_CREATED','users',uid);res.status(201).json({id:uid})}));
app.patch('/api/users/:id',roles('ADMIN'),asyncRoute(async(req,res)=>{const d=req.body||{};const sets=[],p={id:req.params.id};for(const k of ['name','role','is_active'])if(d[k]!==undefined){sets.push(`${k}=@${k}`);p[k]=d[k]}if(d.password){if(String(d.password).length<10)return res.status(400).json({error:'La contraseña debe tener 10 caracteres'});sets.push('password_hash=@hash');p.hash=await bcrypt.hash(d.password,12)}if(!sets.length)return res.status(400).json({error:'No hay cambios'});const q=(await db.getPool()).request();for(const [k,v] of Object.entries(p))q.input(k,k==='id'?sql.Char(36):k==='is_active'?sql.Bit:sql.NVarChar(sql.MAX),v);const r=await q.query(`UPDATE dbo.users SET ${sets.join(',')},updated_at=SYSUTCDATETIME() WHERE id=@id`);if(!r.rowsAffected[0])return res.status(404).json({error:'Usuario no encontrado'});await audit(req.user.id,'USER_UPDATED','users',req.params.id);res.json({message:'Usuario actualizado'})}));
app.post('/api/vip/recalculate',roles('ADMIN','MARKETING'),asyncRoute(async(req,res)=>{
 const r=await db.query(`SELECT c.id,c.vip_tier,COALESCE(SUM(a.amount),0) spend,COUNT(a.id) visits FROM dbo.clients c LEFT JOIN dbo.client_activity a ON a.client_id=c.id AND a.occurred_at>=DATEADD(day,-365,SYSUTCDATETIME()) GROUP BY c.id,c.vip_tier`);
 const results=r.recordset.map(c=>{const score=Number(c.spend)/100+Number(c.visits)*10;return {clientId:c.id,previousTier:c.vip_tier,tier:score>=1000?'PLATINUM':score>=250?'GOLD':'SILVER',score};});
 if(!req.body.dryRun){const tx=new sql.Transaction(await db.getPool());await tx.begin();try{for(const x of results){const q=new sql.Request(tx);q.input('id',sql.Char(36),x.clientId).input('score',sql.Decimal(12,2),x.score).input('tier',sql.NVarChar(30),x.tier);await q.query('UPDATE dbo.clients SET vip_score=@score,vip_tier=@tier,vip_evaluated_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME() WHERE id=@id');}await tx.commit();await audit(req.user.id,'VIP_RECALCULATED','clients',results.length);}catch(e){await tx.rollback();throw e;}}
 res.json({evaluated:results.length,windowDays:365,results});
}));
app.get('/api/analytics/summary',asyncRoute(async(req,res)=>{
 const q=await db.query(`SELECT (SELECT COUNT_BIG(*) FROM dbo.clients) clients,(SELECT COUNT_BIG(*) FROM dbo.clients WHERE vip_tier<>'SILVER') vip,(SELECT COALESCE(SUM(amount),0) FROM dbo.sales WHERE status='PAID') sales,(SELECT COUNT_BIG(*) FROM dbo.sales) salesCount,(SELECT COUNT_BIG(*) FROM dbo.reservations WHERE status IN ('PENDING','CONFIRMED')) reservations,(SELECT COUNT_BIG(*) FROM dbo.tickets WHERE status NOT IN ('RESOLVED','CLOSED')) pendingTickets,(SELECT COUNT_BIG(*) FROM dbo.campaigns WHERE status='ACTIVE') activeCampaigns,(SELECT COUNT_BIG(*) FROM dbo.events WHERE starts_at>=SYSUTCDATETIME() AND status='PUBLISHED') upcomingEvents`);
 const x=q.recordset[0];res.json(Object.fromEntries(Object.entries(x).map(([k,v])=>[k,typeof v==='bigint'?Number(v):v])));
}));
app.get('/api/audit',roles('ADMIN'),asyncRoute(async(req,res)=>{const r=await db.query('SELECT TOP (500) * FROM dbo.audit_events ORDER BY created_at DESC');res.json(r.recordset)}));
app.get('/api/sales',roles('ADMIN','MARKETING'),asyncRoute(async(req,res)=>{const r=await db.query('SELECT TOP (500) * FROM dbo.sales ORDER BY sold_at DESC');res.json(r.recordset)}));
app.get('/api/integrations',roles('ADMIN'),asyncRoute(async(req,res)=>{const r=await db.query('SELECT * FROM dbo.integrations ORDER BY created_at DESC');res.json(r.recordset)}));
app.get('/api/integrations/events',roles('ADMIN'),asyncRoute(async(req,res)=>{const r=await db.query('SELECT TOP (300) * FROM dbo.integration_events ORDER BY received_at DESC');res.json(r.recordset)}));
app.post('/api/integrations/:iid/sync',roles('ADMIN'),asyncRoute(async(req,res)=>{const r=await db.query("UPDATE dbo.integrations SET last_status='MANUAL_REVIEW',last_sync_at=SYSUTCDATETIME(),updated_at=SYSUTCDATETIME() WHERE id=@id",{id:req.params.iid});if(!r.rowsAffected[0])return res.status(404).json({error:'Integración no encontrada'});res.json({message:'Solicitud registrada; no se ejecutó sincronización externa sin conector configurado.'})}));
app.post('/api/integrations/pos/sales',asyncRoute(async(req,res)=>{if(!process.env.INTEGRATION_WEBHOOK_SECRET||req.headers['x-integration-secret']!==process.env.INTEGRATION_WEBHOOK_SECRET)return res.status(401).json({error:'Credencial de integración inválida'});const d=req.body||{};if(!d.externalId||!Number.isFinite(Number(d.amount))||Number(d.amount)<0)return res.status(400).json({error:'externalId e importe válido requeridos'});const sid=id();await db.query("INSERT dbo.sales(id,external_id,client_id,source,currency,amount,status,sold_at,metadata,created_at) VALUES(@id,@ext,@cid,@source,@currency,@amount,@status,@sold, @meta,SYSUTCDATETIME())",{id:sid,ext:d.externalId,cid:d.clientId||null,source:d.source||'POS',currency:d.currency||'PEN',amount:Number(d.amount),status:d.status||'PAID',sold:d.soldAt?new Date(d.soldAt):new Date(),meta:JSON.stringify(d.metadata||{})});res.status(201).json({id:sid})}));
app.get('/api/reports/clients.csv',roles('ADMIN','MARKETING'),asyncRoute(async(req,res)=>{const r=await db.query('SELECT dni,first_name,last_name,email,phone,vip_tier,vip_score,created_at FROM dbo.clients ORDER BY created_at DESC');const cols=['dni','first_name','last_name','email','phone','vip_tier','vip_score','created_at'];const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';const csv=[cols.join(','),...r.recordset.map(x=>cols.map(k=>quote(x[k])).join(','))].join('\r\n');res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename=clientes_atlantic.csv');res.send('\ufeff'+csv)}));
app.post('/api/benefits/:bid/assign',roles('ADMIN','MARKETING'),asyncRoute(async(req,res)=>{const {clientId}=req.body||{};if(!clientId)return res.status(400).json({error:'Selecciona un cliente'});const aid=id();await db.query("INSERT dbo.benefit_assignments(id,client_id,benefit_id,assigned_at,status) VALUES(@id,@cid,@bid,SYSUTCDATETIME(),'AVAILABLE')",{id:aid,cid:clientId,bid:req.params.bid});await audit(req.user.id,'BENEFIT_ASSIGNED','benefits',req.params.bid);res.status(201).json({id:aid})}));
app.post('/api/benefits/:bid/redeem',roles('ADMIN','EMPLOYEE','CLIENT'),asyncRoute(async(req,res)=>{
 const cid=req.user.role==='CLIENT'?req.user.client_id:req.body.clientId;if(!cid)return res.status(400).json({error:'Cliente requerido'});
 const tx=new sql.Transaction(await db.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{let q=new sql.Request(tx);q.input('bid',sql.Char(36),req.params.bid).input('cid',sql.Char(36),cid);const a=await q.query("SELECT TOP (1) id FROM dbo.benefit_assignments WITH (UPDLOCK,HOLDLOCK) WHERE benefit_id=@bid AND client_id=@cid AND status='AVAILABLE'");if(!a.recordset.length){await tx.rollback();return res.status(404).json({error:'Asignación disponible no encontrada'});}
 q=new sql.Request(tx);q.input('bid',sql.Char(36),req.params.bid);const b=await q.query('SELECT max_redemptions,redeemed_count,valid_from,valid_until FROM dbo.benefits WITH (UPDLOCK,HOLDLOCK) WHERE id=@bid');if(!b.recordset.length||b.recordset[0].redeemed_count>=b.recordset[0].max_redemptions||b.recordset[0].valid_from&&b.recordset[0].valid_from>new Date()||b.recordset[0].valid_until&&b.recordset[0].valid_until<new Date())throw Error('Beneficio no disponible o vencido');
 q=new sql.Request(tx);q.input('aid',sql.Char(36),a.recordset[0].id).input('uid',sql.Char(36),req.user.id).input('bid',sql.Char(36),req.params.bid);await q.query("UPDATE dbo.benefit_assignments SET status='REDEEMED',redeemed_at=SYSUTCDATETIME(),redeemed_by=@uid WHERE id=@aid; UPDATE dbo.benefits SET redeemed_count=redeemed_count+1 WHERE id=@bid");await tx.commit();await audit(req.user.id,'BENEFIT_REDEEMED','benefits',req.params.bid);res.json({message:'Canje registrado'});
 }catch(e){await tx.rollback();res.status(409).json({error:e.message});}
}));
app.get('/api/campaigns/:cid/audience',roles('ADMIN','MARKETING','EMPLOYEE'),asyncRoute(async(req,res)=>{const c=await db.query('SELECT target_tier FROM dbo.campaigns WHERE id=@id',{id:req.params.cid});if(!c.recordset.length)return res.status(404).json({error:'Campaña no encontrada'});const tier=req.query.tier||c.recordset[0].target_tier||null;const r=await db.query('SELECT id,first_name AS firstName,last_name AS lastName,email,vip_tier AS vipTier FROM dbo.clients WHERE consent_marketing=1 AND (@tier IS NULL OR vip_tier=@tier) ORDER BY last_name,first_name',{tier});res.json({consented:r.recordset.length,totalEligible:r.recordset.length,clients:r.recordset})}));
app.post('/api/campaigns/:cid/assign-benefits',roles('ADMIN','MARKETING'),asyncRoute(async(req,res)=>{const tx=new sql.Transaction(await db.getPool());await tx.begin();try{let q=new sql.Request(tx);q.input('cid',sql.Char(36),req.params.cid);const b=await q.query('SELECT id FROM dbo.benefits WHERE campaign_id=@cid');q=new sql.Request(tx);q.input('tier',sql.NVarChar(30),req.body.tier||null);const c=await q.query('SELECT id FROM dbo.clients WHERE consent_marketing=1 AND (@tier IS NULL OR vip_tier=@tier)');let count=0;for(const ben of b.recordset)for(const cl of c.recordset){const ins=new sql.Request(tx);ins.input('id',sql.Char(36),id()).input('cid',sql.Char(36),cl.id).input('bid',sql.Char(36),ben.id);const rr=await ins.query("IF NOT EXISTS(SELECT 1 FROM dbo.benefit_assignments WHERE client_id=@cid AND benefit_id=@bid) INSERT dbo.benefit_assignments(id,client_id,benefit_id,assigned_at,status) VALUES(@id,@cid,@bid,SYSUTCDATETIME(),'AVAILABLE'); SELECT @@ROWCOUNT n");count+=rr.recordset[0].n;}await tx.commit();res.json({assigned:count,assignmentsCreated:count});}catch(e){await tx.rollback();throw e;}}));
app.get('/api/events/:eid/registrations',roles('ADMIN','MARKETING','EMPLOYEE'),asyncRoute(async(req,res)=>{const r=await db.query('SELECT * FROM dbo.event_registrations WHERE event_id=@id ORDER BY created_at DESC',{id:req.params.eid});res.json(r.recordset)}));
app.post('/api/events/:eid/register',asyncRoute(async(req,res)=>{const d=req.body||{},tx=new sql.Transaction(await db.getPool());await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);try{let q=new sql.Request(tx);q.input('id',sql.Char(36),req.params.eid);const e=await q.query("SELECT capacity,status FROM dbo.events WITH (UPDLOCK,HOLDLOCK) WHERE id=@id");if(!e.recordset.length||e.recordset[0].status!=='PUBLISHED')throw Error('Evento no disponible');q=new sql.Request(tx);q.input('id',sql.Char(36),req.params.eid);const n=await q.query("SELECT COUNT_BIG(*) n FROM dbo.event_registrations WHERE event_id=@id AND status='REGISTERED'");if(e.recordset[0].capacity&&Number(n.recordset[0].n)>=e.recordset[0].capacity)throw Error('Aforo completo');const rid=id();q=new sql.Request(tx);q.input('rid',sql.Char(36),rid).input('eid',sql.Char(36),req.params.eid).input('cid',sql.Char(36),req.user.client_id||null).input('name',sql.NVarChar(180),d.attendeeName||req.user.name).input('email',sql.NVarChar(190),d.attendeeEmail||req.user.email);await q.query("INSERT dbo.event_registrations(id,event_id,client_id,attendee_name,attendee_email,status,created_at) VALUES(@rid,@eid,@cid,@name,@email,'REGISTERED',SYSUTCDATETIME())");await tx.commit();res.status(201).json({id:rid});}catch(e){await tx.rollback();res.status(409).json({error:e.message});}}));
app.use(express.static(path.join(__dirname,'../../frontend')));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'../../frontend/index.html')));
app.use((err,req,res,next)=>{console.error('[API]',err.code||'',err.message);if(err.number===2601||err.number===2627)return res.status(409).json({error:'Ya existe un registro con esos datos'});if(['ESOCKET','ECONNREFUSED','ELOGIN'].includes(err.code))return res.status(503).json({error:'No se pudo conectar con Microsoft SQL Server. Revise servidor, puerto, TCP/IP y credenciales.'});res.status(500).json({error:'Error interno del servidor'});});
const server=app.listen(PORT,process.env.HOST||'127.0.0.1',()=>console.log(`CRM Atlantic City: http://localhost:${PORT}`));
async function shutdown(){console.log('Cerrando CRM...');server.close(async()=>{await db.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
module.exports=app;

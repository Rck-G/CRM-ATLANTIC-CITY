require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const sql = require('mssql');

if (process.env.SEED_DEMO_DATA !== 'true') {
  console.error('Bloqueado: defina SEED_DEMO_DATA=true para cargar datos ficticios.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Bloqueado: los datos y contraseñas demo no deben cargarse en producción.');
  process.exit(1);
}

const staffDemos = [
  { id: '20000000-0000-4000-8000-000000000010', name: 'ADMIN DEMO', email: 'admin@demo.atlantic.local', role: 'ADMIN', password: 'DemoAdmin#2026' },
  { id: '20000000-0000-4000-8000-000000000011', name: 'Gabriel Mendoza', email: 'manager@demo.atlantic.local', role: 'EMPLOYEE', password: 'DemoManager#2026' },
  { id: '20000000-0000-4000-8000-000000000012', name: 'Camila Rojas', email: 'marketing@demo.atlantic.local', role: 'MARKETING', password: 'DemoMarketing#2026' }
];

const demos = [
  { id: '10000000-0000-4000-8000-000000000001', userId: '20000000-0000-4000-8000-000000000001', dni: 'DEMO-1001', firstName: 'Lucía', lastName: 'Ramírez', email: 'lucia.ramirez@demo.atlantic.local', phone: '+51 900 100 101', password: 'DemoCliente#101' },
  { id: '10000000-0000-4000-8000-000000000002', userId: '20000000-0000-4000-8000-000000000002', dni: 'DEMO-1002', firstName: 'Mateo', lastName: 'Fernández', email: 'mateo.fernandez@demo.atlantic.local', phone: '+51 900 100 102', password: 'DemoCliente#102' },
  { id: '10000000-0000-4000-8000-000000000003', userId: '20000000-0000-4000-8000-000000000003', dni: 'DEMO-1003', firstName: 'Valentina', lastName: 'Torres', email: 'valentina.torres@demo.atlantic.local', phone: '+51 900 100 103', password: 'DemoCliente#103' }
];

(async () => {
  const config = {
    server: process.env.DB_SERVER, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: {
      encrypt: String(process.env.DB_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_SERVER_CERTIFICATE || 'false').toLowerCase() === 'true'
    }
  };
  if (process.env.DB_PORT) config.port = Number(process.env.DB_PORT);
  const pool = await new sql.ConnectionPool(config).connect();
  try {
    // SQL Server permite múltiples usuarios internos con client_id NULL.
    // La restricción UNIQUE simple solo admite un NULL y bloquea el segundo usuario staff.
    // Migramos de forma segura a un índice único filtrado para clientes vinculados.
    await pool.request().query(`
      DECLARE @constraintName sysname;
      SELECT TOP (1) @constraintName = kc.name
      FROM sys.key_constraints kc
      INNER JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
      INNER JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
      WHERE kc.parent_object_id = OBJECT_ID('dbo.users') AND kc.type = 'UQ' AND col.name = 'client_id';
      IF @constraintName IS NOT NULL
      BEGIN
        DECLARE @dropSql nvarchar(500);
        SET @dropSql = N'ALTER TABLE dbo.users DROP CONSTRAINT ' + QUOTENAME(@constraintName);
        EXEC sys.sp_executesql @dropSql;
      END;
      IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.users') AND name = 'UX_users_client_id_not_null')
      BEGIN
        CREATE UNIQUE INDEX UX_users_client_id_not_null ON dbo.users(client_id) WHERE client_id IS NOT NULL;
      END;
    `);
    for (const staff of staffDemos) {
      const exists = await pool.request().input('email', sql.NVarChar(190), staff.email)
        .query('SELECT id FROM dbo.users WHERE email=@email');
      if (!exists.recordset.length) {
        const hash = await bcrypt.hash(staff.password, 12);
        await pool.request().input('id', sql.Char(36), staff.id)
          .input('name', sql.NVarChar(160), staff.name)
          .input('email', sql.NVarChar(190), staff.email)
          .input('hash', sql.NVarChar(255), hash)
          .input('role', sql.NVarChar(20), staff.role)
          .query(`INSERT dbo.users(id,name,email,password_hash,role,client_id,is_active,created_at,updated_at)
                  VALUES(@id,@name,@email,@hash,@role,NULL,1,SYSUTCDATETIME(),SYSUTCDATETIME())`);
      }
      console.log(`Demo listo: ${staff.email} (${staff.role})`);
    }

    for (const c of demos) {
      const clientExists = await pool.request().input('email', sql.NVarChar(190), c.email)
        .query('SELECT id FROM dbo.clients WHERE email=@email');
      if (!clientExists.recordset.length) {
        await pool.request()
          .input('id', sql.Char(36), c.id).input('dni', sql.NVarChar(60), c.dni)
          .input('fn', sql.NVarChar(120), c.firstName).input('ln', sql.NVarChar(120), c.lastName)
          .input('email', sql.NVarChar(190), c.email).input('phone', sql.NVarChar(60), c.phone)
          .query(`INSERT dbo.clients(id,dni,first_name,last_name,email,phone,consent_marketing,vip_tier,vip_score,created_at,updated_at)
                  VALUES(@id,@dni,@fn,@ln,@email,@phone,1,'SILVER',0,SYSUTCDATETIME(),SYSUTCDATETIME())`);
      }
      const userExists = await pool.request().input('email', sql.NVarChar(190), c.email)
        .query('SELECT id FROM dbo.users WHERE email=@email');
      if (!userExists.recordset.length) {
        const client = clientExists.recordset[0]?.id || c.id;
        const hash = await bcrypt.hash(c.password, 12);
        await pool.request().input('id', sql.Char(36), c.userId)
          .input('name', sql.NVarChar(160), `${c.firstName} ${c.lastName}`)
          .input('email', sql.NVarChar(190), c.email).input('hash', sql.NVarChar(255), hash)
          .input('clientId', sql.Char(36), client)
          .query(`INSERT dbo.users(id,name,email,password_hash,role,client_id,is_active,created_at,updated_at)
                  VALUES(@id,@name,@email,@hash,'CLIENT',@clientId,1,SYSUTCDATETIME(),SYSUTCDATETIME())`);
      }
      await pool.request().input('email',sql.NVarChar(190),c.email).query('UPDATE dbo.clients SET consent_marketing=1,updated_at=SYSUTCDATETIME() WHERE email=@email');
      console.log(`Demo listo: ${c.email}`);
    }
    // Catálogo y operaciones ficticias: inserción idempotente mediante códigos estables.
    const campaigns = [
      {id:'30000000-0000-4000-8000-000000000001',name:'Noches de Lujo Atlantic',description:'Experiencias premium y atención preferente para clientes Platinum.',status:'ACTIVE',tier:'PLATINUM',channel:'EMAIL',start:1,end:60},
      {id:'30000000-0000-4000-8000-000000000002',name:'Sabores del Pacífico',description:'Promoción gastronómica para clientes Gold.',status:'ACTIVE',tier:'GOLD',channel:'IN_APP',start:0,end:45},
      {id:'30000000-0000-4000-8000-000000000003',name:'Bienvenida Atlantic',description:'Beneficios de bienvenida para nuevos clientes Silver.',status:'SCHEDULED',tier:'SILVER',channel:'SMS',start:10,end:90}
    ];
    for (const c of campaigns) {
      const start=new Date(Date.now()+c.start*86400000), end=new Date(Date.now()+c.end*86400000);
      await pool.request().input('id',sql.Char(36),c.id).input('name',sql.NVarChar(180),c.name)
        .input('description',sql.NVarChar(sql.MAX),c.description).input('status',sql.NVarChar(30),c.status)
        .input('tier',sql.NVarChar(30),c.tier).input('channel',sql.NVarChar(40),c.channel)
        .input('start',sql.DateTime2,start).input('end',sql.DateTime2,end)
        .query(`IF NOT EXISTS(SELECT 1 FROM dbo.campaigns WHERE name=@name)
          INSERT dbo.campaigns(id,name,description,status,target_tier,starts_at,ends_at,channel,created_at,updated_at)
          VALUES(@id,@name,@description,@status,@tier,@start,@end,@channel,SYSUTCDATETIME(),SYSUTCDATETIME())`);
    }

    const benefits = [
      {id:'31000000-0000-4000-8000-000000000001',campaignId:campaigns[0].id,name:'Cena degustación VIP',description:'Menú degustación para dos personas.',code:'DEMO-PLATINUM-DINNER',tier:'PLATINUM',days:60,max:30},
      {id:'31000000-0000-4000-8000-000000000002',campaignId:campaigns[1].id,name:'20% en restaurantes',description:'Descuento en establecimientos participantes.',code:'DEMO-GOLD-FOOD20',tier:'GOLD',days:45,max:100},
      {id:'31000000-0000-4000-8000-000000000003',campaignId:campaigns[2].id,name:'Bebida de bienvenida',description:'Bebida sin alcohol de cortesía.',code:'DEMO-SILVER-WELCOME',tier:'SILVER',days:90,max:150}
    ];
    for (const b of benefits) {
      const from=new Date(Date.now()-86400000), until=new Date(Date.now()+b.days*86400000);
      await pool.request().input('id',sql.Char(36),b.id).input('campaignId',sql.Char(36),b.campaignId)
        .input('name',sql.NVarChar(180),b.name).input('description',sql.NVarChar(sql.MAX),b.description)
        .input('code',sql.NVarChar(80),b.code).input('tier',sql.NVarChar(30),b.tier)
        .input('from',sql.DateTime2,from).input('until',sql.DateTime2,until).input('max',sql.Int,b.max)
        .query(`IF NOT EXISTS(SELECT 1 FROM dbo.benefits WHERE code=@code)
          INSERT dbo.benefits(id,campaign_id,name,description,code,tier,valid_from,valid_until,max_redemptions,redeemed_count,status,created_at,updated_at)
          VALUES(@id,@campaignId,@name,@description,@code,@tier,@from,@until,@max,0,'AVAILABLE',SYSUTCDATETIME(),SYSUTCDATETIME())`);
    }

    const restaurants = [
      {id:'32000000-0000-4000-8000-000000000001',code:'DEMO-REST-01',name:'Brisa Marina',description:'Cocina marina contemporánea con vista al océano.',location:'Atlantic City · Malecón',capacity:80},
      {id:'32000000-0000-4000-8000-000000000002',code:'DEMO-REST-02',name:'Sakura Lounge',description:'Experiencia japonesa, sushi y barra omakase.',location:'Atlantic City · Zona Premium',capacity:55},
      {id:'32000000-0000-4000-8000-000000000003',code:'DEMO-REST-03',name:'Terraza 21',description:'Cocina internacional y coctelería de autor sin alcohol.',location:'Atlantic City · Terraza',capacity:100}
    ];
    for (const r of restaurants) await pool.request().input('id',sql.Char(36),r.id)
      .input('code',sql.NVarChar(50),r.code).input('name',sql.NVarChar(180),r.name)
      .input('description',sql.NVarChar(sql.MAX),r.description).input('location',sql.NVarChar(255),r.location)
      .input('capacity',sql.Int,r.capacity).query(`IF NOT EXISTS(SELECT 1 FROM dbo.restaurants WHERE code=@code)
        INSERT dbo.restaurants(id,code,name,description,location,capacity,active,created_at,updated_at)
        VALUES(@id,@code,@name,@description,@location,@capacity,1,SYSUTCDATETIME(),SYSUTCDATETIME())`);

    const reservationClients=demos;
    for (let i=0;i<3;i++) {
      const start=new Date(Date.now()+(i+2)*86400000);start.setUTCHours(19+i,0,0,0);
      const end=new Date(start.getTime()+2*3600000),rid=`33000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`;
      const guest=`${reservationClients[i].firstName} ${reservationClients[i].lastName}`;
      await pool.request().input('id',sql.Char(36),rid).input('external',sql.NVarChar(150),`DEMO-RES-${i+1}`)
        .input('restaurant',sql.Char(36),restaurants[i].id).input('client',sql.Char(36),reservationClients[i].id)
        .input('guest',sql.NVarChar(180),guest).input('email',sql.NVarChar(190),reservationClients[i].email)
        .input('phone',sql.NVarChar(60),reservationClients[i].phone).input('party',sql.Int,2+i)
        .input('start',sql.DateTime2,start).input('end',sql.DateTime2,end)
        .input('notes',sql.NVarChar(sql.MAX),'Reserva ficticia de demostración')
        .query(`IF NOT EXISTS(SELECT 1 FROM dbo.reservations WHERE external_id=@external)
          INSERT dbo.reservations(id,restaurant_id,client_id,external_id,guest_name,guest_email,guest_phone,party_size,starts_at,ends_at,status,notes,source,created_at,updated_at)
          VALUES(@id,@restaurant,@client,@external,@guest,@email,@phone,@party,@start,@end,'CONFIRMED',@notes,'DEMO',SYSUTCDATETIME(),SYSUTCDATETIME())`);
    }

    const events = [
      {id:'34000000-0000-4000-8000-000000000001',code:'DEMO-EVT-01',name:'Atlantic Gourmet Night',description:'Noche gastronómica con estaciones de degustación.',venue:'Brisa Marina',days:7,capacity:80},
      {id:'34000000-0000-4000-8000-000000000002',code:'DEMO-EVT-02',name:'Sunset Jazz Experience',description:'Música en vivo y experiencia al atardecer.',venue:'Terraza 21',days:14,capacity:100},
      {id:'34000000-0000-4000-8000-000000000003',code:'DEMO-EVT-03',name:'Sakura Omakase Session',description:'Sesión especial de cocina japonesa.',venue:'Sakura Lounge',days:21,capacity:55}
    ];
    for (const e of events) {
      const start=new Date(Date.now()+e.days*86400000);start.setUTCHours(20,0,0,0);const end=new Date(start.getTime()+3*3600000);
      await pool.request().input('id',sql.Char(36),e.id).input('code',sql.NVarChar(60),e.code)
        .input('name',sql.NVarChar(180),e.name).input('description',sql.NVarChar(sql.MAX),e.description)
        .input('venue',sql.NVarChar(180),e.venue).input('start',sql.DateTime2,start)
        .input('end',sql.DateTime2,end).input('capacity',sql.Int,e.capacity)
        .query(`IF NOT EXISTS(SELECT 1 FROM dbo.events WHERE code=@code)
          INSERT dbo.events(id,code,name,description,venue,starts_at,ends_at,capacity,status,created_at,updated_at)
          VALUES(@id,@code,@name,@description,@venue,@start,@end,@capacity,'PUBLISHED',SYSUTCDATETIME(),SYSUTCDATETIME())`);
    }
    for (let i=0;i<3;i++) {
      await pool.request().input('id',sql.Char(36),`35000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`)
        .input('external',sql.NVarChar(150),`DEMO-REG-${i+1}`).input('event',sql.Char(36),events[i].id)
        .input('client',sql.Char(36),demos[i].id).input('name',sql.NVarChar(180),`${demos[i].firstName} ${demos[i].lastName}`)
        .input('email',sql.NVarChar(190),demos[i].email)
        .query(`IF NOT EXISTS(SELECT 1 FROM dbo.event_registrations WHERE external_id=@external)
          INSERT dbo.event_registrations(id,event_id,client_id,external_id,attendee_name,attendee_email,status,created_at)
          VALUES(@id,@event,@client,@external,@name,@email,'REGISTERED',SYSUTCDATETIME())`);
    }

    for (let i=0;i<3;i++) {
      await pool.request().input('id',sql.Char(36),`36000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`)
        .input('external',sql.NVarChar(150),`DEMO-SALE-${i+1}`).input('client',sql.Char(36),demos[i].id)
        .input('amount',sql.Decimal(14,2),[850,420,190][i]).input('source',sql.NVarChar(80),'DEMO POS')
        .query(`IF NOT EXISTS(SELECT 1 FROM dbo.sales WHERE external_id=@external)
          INSERT dbo.sales(id,external_id,client_id,source,currency,amount,status,sold_at,metadata,created_at)
          VALUES(@id,@external,@client,@source,'PEN',@amount,'PAID',DATEADD(day,-7,SYSUTCDATETIME()),N'{"demo":true}',SYSUTCDATETIME())`);
    }

    const ticketSamples = [
      {id:'38000000-0000-4000-8000-000000000001',no:'DEMO-TKT-001',subject:'Consulta sobre beneficio VIP',description:'El cliente solicita información sobre el canje de su beneficio.',priority:'MEDIUM',status:'IN_PROGRESS'},
      {id:'38000000-0000-4000-8000-000000000002',no:'DEMO-TKT-002',subject:'Cambio de reserva',description:'Solicitud de modificación de horario de reserva.',priority:'HIGH',status:'PENDING'},
      {id:'38000000-0000-4000-8000-000000000003',no:'DEMO-TKT-003',subject:'Información de evento',description:'Consulta sobre disponibilidad para un evento próximo.',priority:'LOW',status:'RESOLVED'}
    ];
    for (let i=0;i<ticketSamples.length;i++) {
      const t=ticketSamples[i];
      await pool.request().input('id',sql.Char(36),t.id).input('no',sql.NVarChar(40),t.no)
        .input('client',sql.Char(36),demos[i].id).input('createdBy',sql.Char(36),staffDemos[0].id)
        .input('subject',sql.NVarChar(220),t.subject).input('description',sql.NVarChar(sql.MAX),t.description)
        .input('priority',sql.NVarChar(20),t.priority).input('status',sql.NVarChar(30),t.status)
        .query(`IF NOT EXISTS(SELECT 1 FROM dbo.tickets WHERE ticket_no=@no)
          INSERT dbo.tickets(id,ticket_no,client_id,created_by_id,subject,description,category,channel,priority,status,department,created_at,updated_at)
          VALUES(@id,@no,@client,@createdBy,@subject,@description,'DEMO','WEB',@priority,@status,'Atención al cliente',SYSUTCDATETIME(),SYSUTCDATETIME())`);
    }

    // Beneficios de ejemplo asignados a clientes para que el flujo de fidelización tenga datos.
    for (let i=0;i<3;i++) await pool.request()
      .input('id',sql.Char(36),`37000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`)
      .input('client',sql.Char(36),demos[i].id).input('benefit',sql.Char(36),benefits[i].id)
      .query(`IF NOT EXISTS(SELECT 1 FROM dbo.benefit_assignments WHERE client_id=@client AND benefit_id=@benefit)
        INSERT dbo.benefit_assignments(id,client_id,benefit_id,assigned_at,status)
        VALUES(@id,@client,@benefit,SYSUTCDATETIME(),'AVAILABLE')`);

    console.log('Datos de catálogo demo: 3 campañas, 3 beneficios, 3 restaurantes, 3 reservas, 3 eventos y 3 inscripciones.');
    console.log('Datos comerciales demo: 3 ventas, 3 tickets y 3 asignaciones de beneficios.');
    console.log('Carga demo completada. Las cuentas ya existentes no fueron sobrescritas.');
    console.log('Roles demo: ADMIN (total), EMPLOYEE (operaciones), MARKETING (campañas) y CLIENT (solo sus datos).');
  } finally {
    await pool.close();
  }
})().catch(err => { console.error('No se pudieron cargar los datos demo:', err.message); process.exitCode = 1; });

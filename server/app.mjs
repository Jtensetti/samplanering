import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes,randomUUID,createHash,scrypt as rawScrypt,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync,writeFileSync,unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { openDatabase } from './db.mjs';
import { presets } from '../shared/presets.mjs';
import { schemas,parentKinds,credentials } from './schema.mjs';
const scrypt=promisify(rawScrypt), uid=()=>randomUUID(), now=()=>new Date().toISOString(), digest=s=>createHash('sha256').update(s).digest('hex');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const decode=r=>r?({...r,body:JSON.parse(r.body)}):null;
const safeUser=u=>({id:u.id,name:u.name,email:u.email});
export function createApp({dataDir=process.env.DATA_DIR||'./data',origin=process.env.APP_ORIGIN||'http://localhost:3000',production=process.env.NODE_ENV==='production',testing=false}={}) {
  if(production&&!origin.startsWith('https://')) throw new Error('APP_ORIGIN måste använda HTTPS i produktion');
  const db=openDatabase(dataDir), app=express(), clients=new Set();
  const sql=(s,...p)=>db.prepare(s).all(...p), one=(s,...p)=>db.prepare(s).get(...p), run=(s,...p)=>db.prepare(s).run(...p);
  const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}};
  const record=id=>decode(one('SELECT * FROM records WHERE id=? AND deleted IS NULL',id));
  const role=(team,user,write=false,owner=false)=>{const m=one('SELECT role FROM members WHERE team_id=? AND user_id=?',team,user);if(!m||write&&m.role==='viewer'||owner&&m.role!=='owner')fail(403,'Du har inte behörighet att göra detta.');return m.role};
  const publish=team=>{for(const c of clients){if(c.team===team)c.res.write('event: change\ndata: {}\n\n')}};
  const event=(r,user,action)=>run('INSERT INTO events(team_id,record_id,user_id,action,body,at) VALUES(?,?,?,?,?,?)',r.team_id,r.id,user,action,JSON.stringify(r.body),now());
  const notify=(team,user,id,text,dedupe=null)=>run('INSERT OR IGNORE INTO notifications(id,team_id,user_id,record_id,text,at,dedupe) VALUES(?,?,?,?,?,?,?)',uid(),team,user,id,text,now(),dedupe);
  const requireRecord=(id,user,write=false)=>{const r=record(id);if(!r)fail(404,'Innehållet finns inte längre.');role(r.team_id,user,write);return r};
  function validate(kind,body,team,parent,self='') {
    const schema=schemas[kind];if(!schema)fail(400,'Okänd innehållstyp.');
    const parsed=schema.safeParse(body);if(!parsed.success)fail(400,parsed.error.issues[0]?.message||'Kontrollera fälten.');body=parsed.data;
    const expected=parentKinds[kind],p=parent?record(parent):null;
    if(expected&&(!p||p.team_id!==team||!expected.includes(p.kind)||p.body.archived)||!expected&&parent)fail(400,'Innehållet ligger på fel plats.');
    const ref=(id,kinds,parentId)=>{const r=record(id);if(!r||r.team_id!==team||!kinds.includes(r.kind)||(parentId&&r.parent_id!==parentId))fail(400,'En koppling är ogiltig.');return r};
    const member=id=>{if(!one('SELECT 1 FROM members WHERE team_id=? AND user_id=?',team,id))fail(400,'Personen ingår inte i teamet.');};
    if(kind==='plan'&&body.defaultTemplateId)ref(body.defaultTemplateId,['template']);
    if(kind==='bucket'&&body.archived&&sql("SELECT body FROM records WHERE parent_id=? AND kind='card' AND deleted IS NULL",parent).some(r=>{const d=JSON.parse(r.body);return d.bucketId===self&&!d.archived}))fail(400,'Flytta uppgifterna innan du arkiverar kolumnen.');
    if(kind==='card') {
      ref(body.bucketId,['bucket'],parent);body.assignees.forEach(member);
      if(body.sprintId)ref(body.sprintId,['sprint'],parent);
      for(const d of body.dependencies)ref(d,['card'],parent);
      if(body.parentCardId)ref(body.parentCardId,['card'],parent);
      const reaches=(id,target,key,seen=new Set())=>{if(id===target)return true;if(seen.has(id))return false;seen.add(id);const r=record(id);const next=key==='dependencies'?r?.body.dependencies||[]:[r?.body.parentCardId].filter(Boolean);return next.some(x=>reaches(x,target,key,seen))};
      if(self&&(body.dependencies.some(x=>reaches(x,self,'dependencies'))||body.parentCardId&&reaches(body.parentCardId,self,'parentCardId')))fail(400,'Kopplingen skulle skapa en cirkel.');
      for(const [key,value] of Object.entries(body.custom)) {const f=p.body.fields.find(f=>f.id===key);if(!f)fail(400,'Fältet finns inte i planen.');if(value!==''&&((f.type==='number'&&typeof value!=='number')||(f.type==='checkbox'&&typeof value!=='boolean')||(f.type==='select'&&!f.options.includes(value))||(f.type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))))fail(400,'Ett fält innehåller fel sorts värde.');}
    }
    if(kind==='rule'){ref(body.bucketId,['bucket'],parent);if(body.action==='assign'||body.action==='notify')member(body.target);else ref(body.target,['template']);}
    if(kind==='sticky'){if(body.cardId)ref(body.cardId,['card'],parent);body.connections.forEach(x=>{if(x===self)fail(400,'En lapp kan inte kopplas till sig själv.');ref(x,['sticky'],parent)});}
    if(kind==='comment'||kind==='message')body.mentions.forEach(member);
    if(kind==='block'&&body.fileId&&!one('SELECT 1 FROM files WHERE id=? AND team_id=?',body.fileId,team))fail(400,'Filen finns inte i teamet.');
    if(kind==='template')body.blocks=body.blocks.map(b=>{const v=schemas.block.safeParse(b);if(!v.success)fail(400,'Mallen innehåller ett ogiltigt block.');if(v.data.fileId&&!one('SELECT 1 FROM files WHERE id=? AND team_id=?',v.data.fileId,team))fail(400,'Filen finns inte i teamet.');return v.data});
    return body;
  }
  const insert=(team,kind,parent,body,user)=>{const r={id:uid(),team_id:team,kind,parent_id:parent||null,body:validate(kind,body,team,parent),version:1,created_by:user,updated_at:now(),deleted:null};run('INSERT INTO records(id,team_id,kind,parent_id,body,created_by,updated_at) VALUES(?,?,?,?,?,?,?)',r.id,team,kind,r.parent_id,JSON.stringify(r.body),user,r.updated_at);event(r,user,'created');return r};
  const update=(r,body,user,action='updated')=>{const next={...r,body:validate(r.kind,body,r.team_id,r.parent_id,r.id),version:r.version+1,updated_at:now()};run('UPDATE records SET body=?,version=?,updated_at=? WHERE id=?',JSON.stringify(next.body),next.version,next.updated_at,next.id);event(next,user,action);return next};
  const version=(req,r)=>{if(Number(req.get('If-Match'))!==r.version)fail(409,'Någon har ändrat samma innehåll. Din text finns kvar. Läs in ändringen innan du sparar igen.');};
  function changes(r,previous,user) {
    if(r.kind==='card')for(const id of r.body.assignees)if(id!==user&&!previous?.body.assignees.includes(id))notify(r.team_id,id,r.id,`Du har tilldelats ${r.body.title}`);
    if(r.kind==='comment'||r.kind==='message')for(const id of r.body.mentions)if(id!==user)notify(r.team_id,id,r.parent_id,`${one('SELECT name FROM users WHERE id=?',user).name} nämnde dig: ${r.body.text.slice(0,150)}`);
  }
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy:{directives:{'default-src':["'self'"],'script-src':["'self'"],'style-src':["'self'","'unsafe-inline'"],'img-src':["'self'",'data:','blob:'],'connect-src':["'self'"],'object-src':["'none'"],'frame-ancestors':["'none'"],'upgrade-insecure-requests':production?[]:null}},strictTransportSecurity:production?undefined:false}));
  app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)){const o=req.get('Origin');if(o&&o!==origin&&!( !production&&['http://localhost:5173','http://127.0.0.1:5173'].includes(o)))return res.status(403).json({error:'Anropet kommer från fel adress.'});if(req.get('Sec-Fetch-Site')==='cross-site')return res.status(403).json({error:'Anropet kommer från fel webbplats.'});}next()});
  app.use('/api',rateLimit({windowMs:60000,limit:testing?10000:600,standardHeaders:'draft-8',legacyHeaders:false}));
  app.use(express.json({limit:'1mb'}));
  app.get('/api/health',(_req,res)=>res.json({ok:true}));
  const authLimit=rateLimit({windowMs:15*60000,limit:testing?1000:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'För många försök. Försök igen om en stund.'}});
  const session=(res,user)=>{const token=randomBytes(32).toString('hex');run('INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)',digest(token),user,Date.now()+7*86400000);res.cookie('samplanering',token,{httpOnly:true,sameSite:'lax',secure:production,maxAge:7*86400000,path:'/'});};
  app.post('/api/register',authLimit,async(req,res)=>{const p=credentials.safeParse(req.body);if(!p.success||!p.data.name)fail(400,'Ange namn, e-post och ett lösenord med minst 12 tecken.');const {email,name,password}=p.data;const salt=randomBytes(16).toString('hex'),key=await scrypt(password,salt,64);const u={id:uid(),email,name};try{run('INSERT INTO users VALUES(?,?,?,?)',u.id,email,name,`${salt}:${key.toString('hex')}`)}catch(e){if(e.code==='ERR_SQLITE_ERROR'&&String(e.message).includes('UNIQUE'))fail(409,'Kontot kunde inte skapas. Prova att logga in.');throw e}session(res,u.id);res.status(201).json(u)});
  app.post('/api/login',authLimit,async(req,res)=>{const p=credentials.safeParse(req.body);if(!p.success)fail(401,'Fel e-post eller lösenord.');const u=one('SELECT * FROM users WHERE email=?',p.data.email),[salt,key]=(u?.password||'00000000000000000000000000000000:'+ '0'.repeat(128)).split(':');const actual=await scrypt(p.data.password,salt,64);if(!u||!timingSafeEqual(actual,Buffer.from(key,'hex')))fail(401,'Fel e-post eller lösenord.');session(res,u.id);res.json(safeUser(u))});
  app.use('/api',(req,res,next)=>{const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('samplanering='))?.slice(13);const s=token&&one('SELECT u.*,s.expires,s.hash FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?',digest(token),Date.now());if(!s)return res.status(401).json({error:'Logga in för att fortsätta.'});req.user=s;next()});
  app.get('/api/me',(req,res)=>res.json(safeUser(req.user)));
  app.post('/api/logout',(req,res)=>{run('DELETE FROM sessions WHERE hash=?',req.user.hash);res.clearCookie('samplanering',{path:'/'});res.json({ok:true})});
  app.get('/api/teams',(req,res)=>res.json(sql('SELECT t.*,m.role FROM teams t JOIN members m ON m.team_id=t.id WHERE m.user_id=?',req.user.id)));
  app.post('/api/teams',(req,res)=>{const name=String(req.body.name||'').trim();if(!name||name.length>100)fail(400,'Ange ett teamnamn.');const team={id:uid(),name};transaction(()=>{run('INSERT INTO teams VALUES(?,?)',team.id,name);run('INSERT INTO members VALUES(?,?,?)',team.id,req.user.id,'owner')});res.status(201).json(team)});
  app.post('/api/teams/:team/invites',(req,res)=>{role(req.params.team,req.user.id,true,true);const grant=req.body.role;if(!['viewer','editor'].includes(grant))fail(400,'Välj en roll.');const token=randomBytes(32).toString('hex');run('INSERT INTO invites(hash,team_id,role,expires) VALUES(?,?,?,?)',digest(token),req.params.team,grant,Date.now()+7*86400000);res.json({token,expiresInDays:7})});
  app.post('/api/join',(req,res)=>{if(typeof req.body.token!=='string')fail(400,'Inbjudan saknas.');const team=transaction(()=>{const i=one('SELECT * FROM invites WHERE hash=? AND used=0 AND expires>?',digest(req.body.token),Date.now());if(!i)fail(410,'Inbjudan har redan använts eller gått ut.');run('INSERT OR IGNORE INTO members VALUES(?,?,?)',i.team_id,req.user.id,i.role);run('UPDATE invites SET used=1 WHERE hash=?',i.hash);return i.team_id});publish(team);res.json({teamId:team})});
  app.delete('/api/teams/:team/members/:user',(req,res)=>{role(req.params.team,req.user.id,true,true);const m=one('SELECT role FROM members WHERE team_id=? AND user_id=?',req.params.team,req.params.user);if(m?.role==='owner')fail(400,'Teamets ägare kan inte tas bort.');run('DELETE FROM members WHERE team_id=? AND user_id=?',req.params.team,req.params.user);publish(req.params.team);res.json({ok:true})});
  app.get('/api/state',(req,res)=>{const team=String(req.query.team||'');const access=role(team,req.user.id);res.json({team:one('SELECT * FROM teams WHERE id=?',team),role:access,members:sql('SELECT u.id,u.name,m.role FROM members m JOIN users u ON u.id=m.user_id WHERE m.team_id=?',team),records:sql('SELECT * FROM records WHERE team_id=? AND deleted IS NULL ORDER BY updated_at',team).map(decode),notifications:sql('SELECT * FROM notifications WHERE team_id=? AND user_id=? ORDER BY at DESC LIMIT 100',team,req.user.id),timer:one('SELECT * FROM timers WHERE user_id=?',req.user.id)||null})});
  app.get('/api/events',(req,res)=>{const team=String(req.query.team||'');role(team,req.user.id);res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();res.write('event: ready\ndata: {}\n\n');const c={team,res};clients.add(c);const interval=setInterval(()=>{if(!one('SELECT 1 FROM sessions s JOIN members m ON m.user_id=s.user_id WHERE s.hash=? AND s.expires>? AND m.team_id=?',req.user.hash,Date.now(),team)){res.end();return}res.write(': keepalive\n\n')},15000);req.on('close',()=>{clearInterval(interval);clients.delete(c)})});
  app.post('/api/records',(req,res)=>{const {teamId,kind,parentId=null,body}=req.body;role(teamId,req.user.id,true);const r=transaction(()=>{const r=insert(teamId,kind,parentId,body,req.user.id);if(kind==='plan')for(const [order,title]of ['Att göra','Pågår','Klart'].entries())insert(teamId,'bucket',r.id,{title,order,done:order===2},req.user.id);if(kind==='card'){const p=record(parentId);if(p.body.defaultTemplateId){const t=record(p.body.defaultTemplateId);t?.body.blocks.forEach((b,i)=>insert(teamId,'block',r.id,{...b,order:i},req.user.id))}}changes(r,null,req.user.id);return r});publish(teamId);res.status(201).json(r)});
  app.patch('/api/records/:id',(req,res)=>{const r=requireRecord(req.params.id,req.user.id,true);version(req,r);if(['comment','message','time'].includes(r.kind)&&r.created_by!==req.user.id)fail(403,'Du kan bara ändra dina egna inlägg.');const next=transaction(()=>{let next=update(r,{...r.body,...req.body},req.user.id);changes(next,r,req.user.id);if(next.kind==='card'&&next.body.bucketId!==r.body.bucketId)next=automate(next,req.user.id);if(next.kind==='card'&&next.body.done&&!r.body.done)recur(next,req.user.id);return next});publish(r.team_id);res.json(next)});
  app.delete('/api/records/:id',(req,res)=>{const r=requireRecord(req.params.id,req.user.id,true);version(req,r);if(!['block','comment','message','sticky','view','rule','time','goal'].includes(r.kind))fail(400,'Arkivera innehållet i stället.');if(['comment','message','time'].includes(r.kind)&&r.created_by!==req.user.id)fail(403,'Du kan bara ta bort dina egna inlägg.');run('UPDATE records SET deleted=?,version=version+1 WHERE id=?',now(),r.id);event(r,req.user.id,'deleted');publish(r.team_id);res.json({id:r.id,version:r.version+1})});
  app.post('/api/records/:id/restore',(req,res)=>{const r=decode(one('SELECT * FROM records WHERE id=?',req.params.id));if(!r||!r.deleted)fail(404,'Innehållet hittades inte.');role(r.team_id,req.user.id,true);version(req,r);if(['comment','message','time'].includes(r.kind)&&r.created_by!==req.user.id)fail(403,'Du kan bara återställa dina egna inlägg.');validate(r.kind,r.body,r.team_id,r.parent_id,r.id);run('UPDATE records SET deleted=NULL,version=version+1 WHERE id=?',r.id);event(r,req.user.id,'restored');publish(r.team_id);res.json(record(r.id))});
  app.get('/api/records/:id/history',(req,res)=>{const r=requireRecord(req.params.id,req.user.id);res.json(sql('SELECT e.*,u.name FROM events e JOIN users u ON u.id=e.user_id WHERE e.record_id=? OR e.record_id IN (SELECT id FROM records WHERE parent_id=?) ORDER BY e.id DESC LIMIT 150',r.id,r.id).map(e=>({...e,body:JSON.parse(e.body)})))});
  app.post('/api/plans/preset',(req,res)=>{
    const {teamId,preset,title}=req.body;role(teamId,req.user.id,true);
    const spec=Object.hasOwn(presets,preset)?presets[preset]:null;if(!spec)fail(400,'Mallen finns inte.');
    const p=transaction(()=>{
      let template=null;
      if(spec.blocks.length){
        const blocks=spec.blocks.map((b,i)=>{
          const {items,...other}=b;
          return schemas.block.parse({...other,order:i,checked:(items||[]).map(text=>({id:uid(),text,done:false}))});
        });
        template=insert(teamId,'template',null,{title:spec.name,blocks},req.user.id);
      }
      const p=insert(teamId,'plan',null,{title,defaultTemplateId:template?.id||'',fields:spec.fields.map(([label,type,options=[]])=>({id:uid(),label,type,options}))},req.user.id);
      spec.buckets.forEach((title,order)=>insert(teamId,'bucket',p.id,{title,order,done:order===spec.buckets.length-1},req.user.id));
      return p;
    });publish(teamId);res.status(201).json(p);
  });
  app.post('/api/notifications/read',(req,res)=>{role(req.body.teamId,req.user.id);run('UPDATE notifications SET read=1 WHERE user_id=? AND team_id=?',req.user.id,req.body.teamId);res.json({ok:true})});
  app.post('/api/records/:id/template',(req,res)=>{const r=requireRecord(req.params.id,req.user.id,true),t=requireRecord(req.body.templateId,req.user.id);if(!['card','doc'].includes(r.kind)||t.kind!=='template'||t.team_id!==r.team_id)fail(400,'Mallen kan inte användas här.');transaction(()=>{const max=Math.max(0,...sql('SELECT body FROM records WHERE parent_id=? AND kind=? AND deleted IS NULL',r.id,'block').map(x=>JSON.parse(x.body).order));t.body.blocks.forEach((b,i)=>insert(r.team_id,'block',r.id,{...b,order:max+i+1},req.user.id))});publish(r.team_id);res.json({ok:true})});
  const uploadDir=resolve(dataDir,'files');mkdirSync(uploadDir,{recursive:true});
  app.post('/api/files',express.raw({type:'application/octet-stream',limit:'10mb'}),(req,res)=>{const team=String(req.query.team||'');role(team,req.user.id,true);if(!Buffer.isBuffer(req.body)||!req.body.length)fail(400,'Välj en fil.');const name=String(req.query.name||'Fil').replace(/[\x00-\x1f/\\]/g,'_').slice(0,200),mime=String(req.query.mime||'application/octet-stream');const f={id:uid(),team_id:team,name,mime:['image/png','image/jpeg','image/webp','application/pdf','text/plain'].includes(mime)?mime:'application/octet-stream',size:req.body.length};writeFileSync(resolve(uploadDir,f.id),req.body,{flag:'wx'});try{run('INSERT INTO files VALUES(?,?,?,?,?)',f.id,team,f.name,f.mime,f.size)}catch(e){unlinkSync(resolve(uploadDir,f.id));throw e}res.status(201).json(f)});
  app.get('/api/files/:id',(req,res)=>{const f=one('SELECT * FROM files WHERE id=?',req.params.id);if(!f)fail(404,'Filen finns inte.');role(f.team_id,req.user.id);res.set('Content-Type',f.mime);res.set('Content-Disposition',`${f.mime.startsWith('image/')?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`);res.sendFile(resolve(uploadDir,f.id))});
  function automate(r,user){return r;} // Expanded in stage 3, with bounded server-side rules.
  function recur(r,user){}
  app.use(express.static(resolve('dist'),{index:false}));
  app.get('/{*path}',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'Adressen finns inte.'});res.sendFile(resolve('dist/index.html'))});
  app.use((err,req,res,_next)=>{const status=err.status||500;if(status>=500)console.error(err);res.status(status).json({error:status>=500?'Något gick fel. Försök igen.':err.message||'Kontrollera uppgifterna.'})});
  return {app,db,close(){for(const c of clients)c.res.end();db.close()}};
}

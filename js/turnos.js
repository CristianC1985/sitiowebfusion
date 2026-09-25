import{initializeApp}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import{getFirestore,collection,doc,getDocs,setDoc,addDoc,deleteDoc,updateDoc,writeBatch,query,where}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import{getAuth,signInWithEmailAndPassword}from"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app=initializeApp({apiKey:"AIzaSyCwB3Tpqe9EAPctSh4aB-aqf6xSUhm0Twc",authDomain:"fusion-peluqueria-e62f1.firebaseapp.com",projectId:"fusion-peluqueria-e62f1",storageBucket:"fusion-peluqueria-e62f1.firebasestorage.app",messagingSenderId:"1091187068496",appId:"1:1091187068496:web:f0c0f0dca735960a0ccb55"});
const db=getFirestore(app),auth=getAuth(app);

const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DIAS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'],MESES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],COLORES=['#94fcea','#e8c4d4','#c4e0e8','#d4c4e8','#faeac4','#c4e8c4'];
const fmt=n=>n?'$'+Math.round(n).toLocaleString('es-AR'):'Consultar';
const fmtD=d=>d?d.split('-').reverse().join('/'):'—';
const dStr=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; // fecha local (no UTC)
const today=()=>dStr(new Date());
const ini=n=>n.split(' ').map(p=>p[0]).join('').substring(0,2).toUpperCase();
const toMin=h=>{const[a,b]=h.split(':').map(Number);return a*60+b};
const toHM=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const slotId=(f,p,h)=>`${f}_${p}_${h.replace(':','')}`;
const INP='width:100%;padding:1rem 1.4rem;background:#1e1e1e;border:1px solid #333;border-radius:.8rem;color:white;font-size:1.5rem;font-family:inherit;';
const BX='background:none;border:1px solid #5a2020;color:var(--danger);cursor:pointer;font-size:1.1rem;padding:.3rem .8rem;border-radius:.6rem;font-family:inherit;';

// Datos por defecto: se muestran si Firestore está vacío y se cargan solos la primera vez que entrás al panel
const P0=[['v1','Valeria','Colorista','#94fcea'],['l2','Lucía','Estilista','#e8c4d4'],['m3','Marcos','Barbero','#c4e0e8']].map(([id,nombre,esp,color])=>({id,nombre,esp,color,entrada:'10:00',salida:'18:00',dias:[2,3,4,5,6]}));
const S0=[['Color / Tintura raíz','Color',26000,90],['Decoloración / Mechas','Color',35000,120],['Tintura raíz + Brushing','Color',41000,120],['Pack de Belleza','Combos',55000,150],['Corte Caballero','Corte',12000,30],['Corte Dama','Corte',12000,45],['Corte + Lavado + Brushing','Corte',35000,90],['Brushing / Planchita','Peinado',8000,40],['Peinados para fiestas','Peinado',18000,90],['Lavados / Tratamientos nutritivos','Tratamiento',10000,60],['Alisados','Tratamiento',45000,180],['Keratina / Botox','Tratamiento',40000,180],['Depilación','Depilación',6000,30],['Manos / Belleza de pies','Manicuria',8000,45]].map(([nombre,cat,precio,dur],i)=>({id:'s'+(i+1),nombre,cat,precio,dur,orden:i}));

let DB={profesionales:P0,servicios:S0,turnos:[]},sel={srvs:[],profId:null,fecha:null,hora:null},calFecha=new Date(),ocup=new Set();

async function cargar(){
  try{
    const[p,s]=await Promise.all([getDocs(collection(db,'profesionales')),getDocs(collection(db,'servicios'))]);
    if(!p.empty)DB.profesionales=p.docs.map(d=>({...d.data(),id:d.id}));
    if(!s.empty)DB.servicios=s.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>(a.orden??0)-(b.orden??0));
  }catch(e){console.error(e)}
  renderSrvs();
}

// ── Navegación
function irA(n){
  for(let i=1;i<=6;i++){
    $('p'+i).classList.toggle('active',i===n);
    const s=$('stp-'+i);if(s)s.className='step'+(i<n?' done':i===n?' active':'');
    if(i<5){const l=$('ln-'+i);if(l)l.className='step-line'+(i<n?' done':'')}
  }
  if(n===2)renderProfs();if(n===3)renderCal();if(n===4)renderHoras();if(n===5)renderResumen();
  window.scrollTo({top:0,behavior:'smooth'});
}
const toggleNav=()=>$('main-nav').classList.toggle('open');

// ── Servicios
function renderSrvs(){
  const cats=[...new Set(DB.servicios.map(s=>s.cat))];
  $('srvs-lista').innerHTML=cats.map(c=>`<div class="cat-label">${esc(c)}</div><div class="srv-grid">${DB.servicios.filter(s=>s.cat===c).map(s=>`<div class="srv-card${sel.srvs.includes(s.id)?' sel':''}" onclick="toggleSrv('${s.id}')"><div class="srv-nombre">${esc(s.nombre)}</div><div class="srv-dur">${s.dur} min</div><div class="srv-precio">${fmt(s.precio)}</div></div>`).join('')}</div>`).join('');
  const sv=sel.srvs.map(id=>DB.servicios.find(x=>x.id===id)).filter(Boolean);
  $('btn1').disabled=!sv.length;
  $('srvs-resumen').innerHTML=sv.length?`<strong>${esc(sv.map(s=>s.nombre).join(', '))}</strong> · Total estimado: <strong>${fmt(sv.reduce((a,s)=>a+s.precio,0))}</strong>`:'Ningún servicio seleccionado';
}
function toggleSrv(id){const i=sel.srvs.indexOf(id);i>=0?sel.srvs.splice(i,1):sel.srvs.push(id);sel.hora=null;renderSrvs()}

// ── Profesionales
function renderProfs(){
  $('profs-lista').innerHTML=`<div class="prof-card cualquiera-card${sel.profId===0?' sel':''}" onclick="selProf(0)"><div class="prof-avatar">✦</div><div class="prof-nombre">Cualquiera</div><div class="prof-esp">Primera disponible</div></div>`+
  DB.profesionales.map(p=>`<div class="prof-card${sel.profId===p.id?' sel':''}" onclick="selProf('${p.id}')"><div class="prof-avatar" style="background:${p.color}33;color:${p.color};border-color:${p.color}66;">${esc(ini(p.nombre))}</div><div class="prof-nombre">${esc(p.nombre)}</div><div class="prof-esp">${esc(p.esp||'Estilista')}</div><div class="prof-dias">${[...p.dias].sort().map(d=>DIAS[d]).join(' · ')}</div></div>`).join('');
  $('btn2').disabled=sel.profId===null;
}
function selProf(id){sel.profId=id;sel.fecha=null;sel.hora=null;renderProfs()}

// ── Calendario
const calNav=d=>{calFecha.setMonth(calFecha.getMonth()+d);renderCal()};
function renderCal(){
  const y=calFecha.getFullYear(),m=calFecha.getMonth(),td=today();
  const ps=sel.profId===0?DB.profesionales:DB.profesionales.filter(p=>p.id===sel.profId),dp=ps.flatMap(p=>p.dias);
  $('cal-label').textContent=`${MESES[m]} ${y}`;
  $('cal-dlbl').innerHTML=DIAS.map(d=>`<div class="cal-dl">${d[0]}</div>`).join('');
  let h='';for(let i=0;i<new Date(y,m,1).getDay();i++)h+='<div class="cal-d vacio"></div>';
  for(let d=1;d<=new Date(y,m+1,0).getDate();d++){
    const dd=new Date(y,m,d),ds=dStr(dd),ok=dp.includes(dd.getDay())&&ds>=td;
    h+=`<div class="cal-d${ds===sel.fecha?' sel':ds===td&&ok?' hoy':''}${ok?'':' dis'}" ${ok?`onclick="selFecha('${ds}')"`:''}>${d}</div>`;
  }
  $('cal-body').innerHTML=h;$('btn3').disabled=!sel.fecha;
}
const selFecha=ds=>{sel.fecha=ds;sel.hora=null;renderCal()};

// ── Horarios (respetan la duración total de los servicios)
const nSlots=()=>Math.ceil(sel.srvs.reduce((a,id)=>a+(DB.servicios.find(s=>s.id===id)?.dur||0),0)/30)||1;
const profsDia=()=>DB.profesionales.filter(p=>(sel.profId===0||p.id===sel.profId)&&p.dias.includes(new Date(sel.fecha+'T12:00:00').getDay()));
function libre(p,h){
  const i=toMin(h),n=nSlots();if(i<toMin(p.entrada)||i+n*30>toMin(p.salida))return false;
  for(let k=0;k<n;k++)if(ocup.has(slotId(sel.fecha,p.id,toHM(i+k*30))))return false;
  return true;
}
async function renderHoras(){
  $('lbl-fecha-hora').textContent=new Date(sel.fecha+'T12:00:00').toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long'});
  $('horas-body').innerHTML='<p>Cargando horarios…</p>';
  try{ocup=new Set((await getDocs(query(collection(db,'ocupados'),where('fecha','==',sel.fecha)))).docs.map(d=>d.id))}catch(e){console.error(e)}
  const ps=profsDia();if(!ps.length){$('horas-body').innerHTML='<p>No hay profesionales ese día.</p>';return}
  const now=new Date(),nm=now.getHours()*60+now.getMinutes(),hoy=sel.fecha===today(),hs=[];
  for(let m=Math.min(...ps.map(p=>toMin(p.entrada)));m<Math.max(...ps.map(p=>toMin(p.salida)));m+=30){const h=toHM(m);hs.push([h,ps.some(p=>libre(p,h))&&!(hoy&&m<=nm)])}
  $('horas-body').innerHTML=hs.map(([h,ok])=>`<div class="hora-btn${h===sel.hora?' sel':''}${ok?'':' ocup'}" ${ok?`onclick="selHora('${h}')"`:''}>${h}${ok?'':'<br><small>Ocupado</small>'}</div>`).join('');
  $('btn4').disabled=!sel.hora;
}
const selHora=h=>{sel.hora=h;renderHoras()};

// ── Resumen y confirmación
function renderResumen(){
  const sv=sel.srvs.map(id=>DB.servicios.find(x=>x.id===id)).filter(Boolean),pn=sel.profId===0?'Cualquier profesional':esc(DB.profesionales.find(p=>p.id===sel.profId)?.nombre||'—');
  $('resumen-box').innerHTML=`<div class="resumen-titulo">✦ Tu reserva</div><div class="res-fila"><span class="res-lbl">Servicios</span><span class="res-val">${esc(sv.map(s=>s.nombre).join(', '))}</span></div><div class="res-fila"><span class="res-lbl">Profesional</span><span class="res-val">${pn}</span></div><div class="res-fila"><span class="res-lbl">Fecha</span><span class="res-val">${fmtD(sel.fecha)}</span></div><div class="res-fila"><span class="res-lbl">Hora</span><span class="res-val acento">${sel.hora} hs</span></div><div class="res-fila"><span class="res-lbl">Duración aprox.</span><span class="res-val">${sv.reduce((a,s)=>a+s.dur,0)} min</span></div><div class="res-fila"><span class="res-lbl">Total estimado</span><span class="res-val acento">${fmt(sv.reduce((a,s)=>a+s.precio,0))}</span></div>`;
}
async function confirmarTurno(){
  const nombre=$('cli-nom').value.trim(),tel=$('cli-tel').value.trim();
  if(!nombre||!tel){alert('Completá tu nombre y WhatsApp para confirmar el turno.');return}
  const btn=document.querySelector('#p5 .btn-primary');btn.disabled=true;
  const recs=[...document.querySelectorAll('input[name="rec"]:checked')].map(c=>c.value).filter(v=>v!=='ninguno');
  const sv=sel.srvs.map(id=>DB.servicios.find(x=>x.id===id)).filter(Boolean),n=nSlots();
  for(const p of profsDia().filter(p=>libre(p,sel.hora))){
    const ref=doc(collection(db,'turnos')),b=writeBatch(db),hs=Array.from({length:n},(_,k)=>toHM(toMin(sel.hora)+k*30));
    b.set(ref,{fecha:sel.fecha,hora:sel.hora,profId:p.id,servicios:sel.srvs,slots:hs.map(h=>slotId(sel.fecha,p.id,h)),cliente:{nombre,tel,email:$('cli-email').value.trim(),nota:$('cli-nota').value.trim()},recordatorios:recs,estado:'confirmado',recEnviado:false,creado:new Date().toISOString()});
    hs.forEach(h=>b.set(doc(db,'ocupados',slotId(sel.fecha,p.id,h)),{fecha:sel.fecha,profId:p.id,hora:h,turnoId:ref.id}));
    try{await b.commit()}catch(e){console.error(e);continue} // si el horario ya estaba tomado, la regla lo rechaza y prueba con otro profesional
    const sn=sv.map(s=>s.nombre).join(', '),total=sv.reduce((a,s)=>a+s.precio,0);
    $('confirm-msg').textContent=`¡Hola ${nombre}! Tu turno quedó registrado. ¡Te esperamos el ${fmtD(sel.fecha)} a las ${sel.hora} hs!`;
    $('confirm-detalle').innerHTML=`<div class="res-fila"><span class="res-lbl">Servicios</span><span class="res-val">${esc(sn)}</span></div><div class="res-fila"><span class="res-lbl">Profesional</span><span class="res-val">${esc(p.nombre)}</span></div><div class="res-fila"><span class="res-lbl">Fecha y hora</span><span class="res-val acento">${fmtD(sel.fecha)} · ${sel.hora} hs</span></div><div class="res-fila"><span class="res-lbl">Total estimado</span><span class="res-val acento">${fmt(total)}</span></div>`;
    $('wa-link').href='https://wa.me/5491173668263?text='+encodeURIComponent(`Hola Fusión! 👋 Reservé un turno:\n\n✂️ *${sn}*\n👤 ${nombre}\n📱 ${tel}\n📅 ${fmtD(sel.fecha)} a las ${sel.hora} hs\n💇 Con: ${p.nombre}\n💰 Total estimado: ${fmt(total)}\n\n✅ Confirmado por el sistema online`);
    $('rec-info').innerHTML=recs.length?'<div style="background:rgba(148,252,234,.1);border:1px solid rgba(148,252,234,.3);border-radius:var(--radius);padding:1.4rem;font-size:1.4rem;color:#aaa;">⏰ El equipo de Fusión te enviará un recordatorio por WhatsApp.</div>':'';
    btn.disabled=false;irA(6);return;
  }
  btn.disabled=false;alert('No pudimos registrar ese horario (puede que se haya ocupado recién). Elegí otro o escribinos por WhatsApp.');irA(4);
}
const nuevoTurno=()=>{sel={srvs:[],profId:null,fecha:null,hora:null};irA(1);renderSrvs()};

// ── Admin
const abrirAdmin=()=>$('ov-admin').style.display='flex',cerrarAdmin=()=>$('ov-admin').style.display='none';
async function loginAdm(){
  try{await signInWithEmailAndPassword(auth,$('adm-mail').value.trim(),$('adm-pass').value)}catch(e){alert('Email o contraseña incorrectos');return}
  $('adm-login').style.display='none';$('adm-content').style.display='block';
  try{ // primera vez: sube servicios y profesionales por defecto
    const[p,s]=await Promise.all([getDocs(collection(db,'profesionales')),getDocs(collection(db,'servicios'))]);
    if(p.empty)for(const x of P0)await setDoc(doc(db,'profesionales',x.id),x);
    if(s.empty)for(const x of S0)await setDoc(doc(db,'servicios',x.id),x);
  }catch(e){console.error(e)}
  await cargar();await cargarTurnos();renderAdmProfs();renderAdmSrvs();
}
async function cargarTurnos(){
  try{DB.turnos=(await getDocs(collection(db,'turnos'))).docs.map(d=>({...d.data(),id:d.id}))}catch(e){console.error(e);alert('No se pudieron leer los turnos. ¿Es ese el email de admin en las reglas?')}
  renderAdmTurnos();
  $('am-tot').textContent=DB.turnos.length;$('am-hoy').textContent=DB.turnos.filter(t=>t.fecha===today()&&t.estado==='confirmado').length;$('am-prox').textContent=DB.turnos.filter(t=>t.fecha>=today()&&t.estado==='confirmado').length;
}
function admTab(id,btn){
  ['at-turnos','at-profs','at-srvs','at-recs'].forEach(t=>$(t).style.display=t===id?'block':'none');
  document.querySelectorAll('.atab').forEach(b=>b.classList.remove('act'));btn.classList.add('act');
  if(id==='at-recs')renderRecsPendientes();
}
const nomSrv=t=>t.servicios.map(id=>DB.servicios.find(x=>x.id===id)?.nombre||'?').join(', ');
let agendaFecha=new Date();
function agendaInicio(d){
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const dow=x.getDay();
  const diff=dow===0?-5:dow===1?1:2-dow;
  x.setDate(x.getDate()+diff);
  return x;
}
function agendaMover(dir){agendaFecha.setDate(agendaFecha.getDate()+dir*7);renderAgenda();}
function agendaHoy(){agendaFecha=new Date();renderAgenda();}
function agendaIrFecha(ds){if(!ds)return;agendaFecha=new Date(ds+'T12:00:00');renderAgenda();}
function agendaTurnosSemana(){
  const ini=agendaInicio(agendaFecha),fechas=[];
  for(let i=0;i<5;i++){const d=new Date(ini);d.setDate(ini.getDate()+i);fechas.push(dStr(d));}
  return fechas;
}
function renderAgenda(){
  const fechas=agendaTurnosSemana(),td=today();
  const first=new Date(fechas[0]+'T12:00:00'),last=new Date(fechas[4]+'T12:00:00');
  $('agenda-periodo').textContent=`${first.getDate()} ${MESES[first.getMonth()]} — ${last.getDate()} ${MESES[last.getMonth()]} ${last.getFullYear()}`;
  if($('adm-filt'))$('adm-filt').value='';
  $('agenda-grid').innerHTML=fechas.map(ds=>{
    const d=new Date(ds+'T12:00:00'),dia=DIAS[d.getDay()],lista=DB.turnos.filter(t=>t.fecha===ds).sort((a,b)=>a.hora.localeCompare(b.hora));
    return `<div class="agenda-dia${ds===td?' hoy':''}"><div class="agenda-dia-hdr"><div class="agenda-dia-nombre">${dia}</div><div class="agenda-dia-num">${d.getDate()}</div></div><div class="agenda-turnos">${lista.length?lista.map(t=>{
      const pr=DB.profesionales.find(p=>p.id===t.profId),c=t.cliente||{},cancel=t.estado==='cancelado';
      return `<div class="agenda-turno${cancel?' agenda-cancelado':''}" onclick="verDetalleTurno('${t.id}')"><div class="agenda-hora">${esc(t.hora)} hs</div><div class="agenda-cliente">${esc(c.nombre||'Sin nombre')}</div><div class="agenda-serv">${esc(nomSrv(t))}</div><div class="agenda-prof" style="color:${pr?.color||'#888'};">${esc(pr?.nombre||'—')}</div><div class="agenda-estado" style="color:${cancel?'var(--danger)':'var(--success)'};">${esc(t.estado)}</div></div>`;
    }).join(''):'<div class="agenda-vacio">Sin turnos</div>'}</div></div>`;
  }).join('');
}
function verDetalleTurno(id){
  const t=DB.turnos.find(x=>x.id===id);if(!t)return;
  const pr=DB.profesionales.find(p=>p.id===t.profId),c=t.cliente||{},cancel=t.estado==='cancelado';
  const tel=(c.tel||'').replace(/\D/g,'');
  const wa=tel?`https://wa.me/${tel.startsWith('549')?tel:'549'+tel}`:'';
  $('turno-detalle-body').innerHTML=`<div class="turno-detalle-row"><span>Cliente</span><span>${esc(c.nombre||'—')}</span></div><div class="turno-detalle-row"><span>Teléfono</span><span>${esc(c.tel||'—')}</span></div><div class="turno-detalle-row"><span>Email</span><span>${esc(c.email||'—')}</span></div><div class="turno-detalle-row"><span>Fecha</span><span>${fmtD(t.fecha)}</span></div><div class="turno-detalle-row"><span>Hora</span><span style="color:var(--acento)!important;">${esc(t.hora)} hs</span></div><div class="turno-detalle-row"><span>Servicios</span><span>${esc(nomSrv(t))}</span></div><div class="turno-detalle-row"><span>Profesional</span><span style="color:${pr?.color||'#eee'}!important;">${esc(pr?.nombre||'—')}</span></div><div class="turno-detalle-row"><span>Estado</span><span>${esc(t.estado)}</span></div><div class="turno-detalle-row"><span>Nota</span><span>${esc(c.nota||'Sin aclaraciones')}</span></div><div class="turno-detalle-actions">${wa?`<a class="btn btn-wa" href="${wa}" target="_blank">💬 WhatsApp</a>`:''}${!cancel&&t.estado==='confirmado'?`<button class="btn btn-danger" onclick="cerrarDetalleTurno();cancelarTurno('${t.id}')">✕ Cancelar turno</button>`:''}<button class="btn" onclick="cerrarDetalleTurno()">Cerrar</button></div>`;
  $('turno-detalle').style.display='flex';
}
function cerrarDetalleTurno(){$('turno-detalle').style.display='none'}
function renderAdmTurnos(){
  const f=$('adm-filt')?.value,l=DB.turnos.filter(t=>!f||t.fecha===f).sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.hora.localeCompare(b.hora));
  $('adm-t-turn').innerHTML=l.length?l.map(t=>{
    const pr=DB.profesionales.find(p=>p.id===t.profId),bc=t.estado==='confirmado'?'b-ok':t.estado==='cancelado'?'b-canc':'b-pend',c=t.cliente||{};
    return `<tr onclick="verDetalleTurno('${t.id}')" style="cursor:pointer;"><td style="font-size:1.2rem;">${fmtD(t.fecha)}</td><td style="font-weight:700;color:var(--acento);">${esc(t.hora)}</td><td style="font-weight:600;color:white;" title="${esc(c.nota)}">${esc(c.nombre)}</td><td><a href="tel:${esc(c.tel)}" onclick="event.stopPropagation()" style="color:var(--acento);font-size:1.2rem;">${esc(c.tel)}</a></td><td style="font-size:1.1rem;max-width:16rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(nomSrv(t))}</td><td>${pr?`<span style="color:${pr.color};">${esc(pr.nombre)}</span>`:'—'}</td><td><span class="badge ${bc}">${esc(t.estado)}</span></td><td>${t.estado==='confirmado'?`<button style="${BX}" onclick="event.stopPropagation();cancelarTurno('${t.id}')">✕</button>`:''}</td></tr>`;
  }).join(''):'<tr><td colspan="8" style="text-align:center;padding:2rem;color:#555;">Sin turnos</td></tr>';
  if($('agenda-grid'))renderAgenda();
}
async function cancelarTurno(id){
  if(!confirm('¿Cancelar este turno?'))return;
  const t=DB.turnos.find(x=>x.id===id),b=writeBatch(db);
  b.update(doc(db,'turnos',id),{estado:'cancelado'});(t.slots||[]).forEach(s=>b.delete(doc(db,'ocupados',s)));
  try{await b.commit();await cargarTurnos()}catch(e){alert('No se pudo cancelar')}
}
function renderAdmProfs(){
  $('adm-profs-lista').innerHTML=DB.profesionales.map(p=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.4rem;background:#1e1e1e;border-radius:.8rem;margin-bottom:.8rem;"><div style="color:white;font-size:1.4rem;"><span style="color:${p.color}">●</span> ${esc(p.nombre)} <span style="color:#666;font-size:1.2rem;">${esc(p.esp)} · ${[...p.dias].sort().map(d=>DIAS[d]).join(' ')} · ${p.entrada}–${p.salida}</span></div><button style="${BX}" onclick="elimProf('${p.id}')">Eliminar</button></div>`).join('');
}
const toggleFP=()=>{const f=$('form-prof');f.style.display=f.style.display==='none'?'block':'none'};
async function guardarProf(){
  const n=$('fp-nom').value.trim();if(!n){alert('Ingresá el nombre');return}
  await addDoc(collection(db,'profesionales'),{nombre:n,esp:$('fp-esp').value,entrada:$('fp-ent').value,salida:$('fp-sal').value,dias:[...document.querySelectorAll('#fp-dias input:checked')].map(c=>+c.value),color:COLORES[DB.profesionales.length%COLORES.length]});
  toggleFP();$('fp-nom').value='';await cargar();renderAdmProfs();
}
async function elimProf(id){if(!confirm('¿Eliminar?'))return;await deleteDoc(doc(db,'profesionales',id));await cargar();renderAdmProfs()}
function renderAdmSrvs(){
  $('adm-t-srvs').innerHTML=DB.servicios.map(s=>`<tr><td style="font-weight:600;color:white;">${esc(s.nombre)}</td><td style="font-size:1.1rem;">${esc(s.cat)}</td><td style="color:var(--acento);font-weight:700;">${fmt(s.precio)}</td><td>${s.dur} min</td><td><button style="${BX}" onclick="elimServ('${s.id}')">✕</button></td></tr>`).join('');
}
const toggleFS=()=>{const f=$('form-serv');f.style.display=f.style.display==='none'?'block':'none'};
async function guardarServ(){
  const n=$('fs-nom').value.trim();if(!n){alert('Completá el nombre');return}
  await addDoc(collection(db,'servicios'),{nombre:n,cat:$('fs-cat').value,precio:parseFloat($('fs-precio').value)||0,dur:parseInt($('fs-dur').value)||60,orden:Date.now()});
  toggleFS();await cargar();renderAdmSrvs();
}
async function elimServ(id){if(!confirm('¿Eliminar?'))return;await deleteDoc(doc(db,'servicios',id));await cargar();renderAdmSrvs()}

// ── Recordatorios por WhatsApp (manual, un clic por cliente)
const mañana=()=>{const m=new Date();m.setDate(m.getDate()+1);return DB.turnos.filter(t=>t.fecha===dStr(m)&&t.estado==='confirmado'&&t.recordatorios?.includes('1dia'))};
async function enviarRecordatoriosHoy(){
  const l=mañana();if(!l.length){alert('No hay turnos con recordatorio de 1 día para mañana.');return}
  for(const t of l){
    const pr=DB.profesionales.find(p=>p.id===t.profId),tel=t.cliente.tel.replace(/\D/g,'').replace(/^0/,''),full=tel.startsWith('549')?tel:'549'+tel;
    window.open(`https://wa.me/${full}?text=`+encodeURIComponent(`Hola ${t.cliente.nombre} 👋\n\nTe recordamos que *mañana* tenés turno en *Fusión Peluquería* ✂️\n\n📅 ${fmtD(t.fecha)} a las ${t.hora} hs\n✂️ ${nomSrv(t)}\n💇 Con: ${pr?.nombre||'—'}\n📍 José María Paz 1612, San Miguel\n\nSi necesitás reprogramar escribinos 😊\n¡Te esperamos! 💛`),'_blank');
    try{await updateDoc(doc(db,'turnos',t.id),{recEnviado:true});t.recEnviado=true}catch(e){console.error(e)}
  }
  renderRecsPendientes();
}
function renderRecsPendientes(){
  const m=mañana();
  $('recs-pendientes').innerHTML=m.length?`<div style="font-size:1.3rem;color:var(--acento);font-weight:700;margin-bottom:1rem;">Recordatorios para mañana (${m.length})</div>`+m.map(t=>`<div style="display:flex;justify-content:space-between;padding:.8rem 1.2rem;background:#1e1e1e;border-radius:.8rem;margin-bottom:.6rem;font-size:1.3rem;color:#ccc;"><span>${esc(t.cliente.nombre)} · ${t.hora} hs</span><span style="color:${t.recEnviado?'var(--success)':'#888'}">${t.recEnviado?'✓ Enviado':'Pendiente'}</span></div>`).join(''):'<div style="text-align:center;padding:3rem;color:#555;font-size:1.4rem;">No hay recordatorios pendientes.</div>';
}

// ── Init
Object.assign(window,{irA,toggleNav,toggleSrv,selProf,calNav,selFecha,selHora,confirmarTurno,nuevoTurno,abrirAdmin,cerrarAdmin,loginAdm,admTab,renderAdmTurnos,cancelarTurno,toggleFP,guardarProf,elimProf,toggleFS,guardarServ,elimServ,enviarRecordatoriosHoy,agendaMover,agendaHoy,agendaIrFecha,verDetalleTurno,cerrarDetalleTurno});
$('adm-login').innerHTML=`<input type="email" id="adm-mail" placeholder="Email de administrador" style="${INP}"><input type="password" id="adm-pass" placeholder="Contraseña" style="${INP}margin-top:1rem;" onkeydown="if(event.key==='Enter')loginAdm()"><button class="btn btn-primary" onclick="loginAdm()" style="margin-top:1rem;width:100%;border-radius:.8rem;">Ingresar</button>`;
document.addEventListener('keydown',e=>{if(e.key==='Escape')cerrarAdmin()});
$('ov-admin').addEventListener('click',e=>{if(e.target===$('ov-admin'))cerrarAdmin()});
cargar();

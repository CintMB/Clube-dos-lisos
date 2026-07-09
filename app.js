(function(){
  "use strict";

  var CATS=[
    {n:"Transporte",c:"#C7905A"},{n:"Delivery & comida fora",c:"#BC6B52"},
    {n:"Mercado",c:"#7C8A67"},{n:"Compras online",c:"#A8927A"},
    {n:"Assinaturas & digital",c:"#6E8C94"},{n:"Lazer & eventos",c:"#C98A4B"},
    {n:"Viagem",c:"#5F8C7D"},{n:"Saúde & farmácia",c:"#9B7B9A"},
    {n:"Moradia",c:"#4A4540"},{n:"Dívidas",c:"#8C4A52"},{n:"Diversos",c:"#A6A096"}
  ];
  var DEFAULT_METAS={};
  var DEFAULT_PLANOS=[];
  var DEFAULT_VALE_CATS={
    VA:["Mercado da semana","Feira / hortifruti","Padaria","Outros"],
    VR:["Almoço do trabalho","Jantar / date","Lanche","Delivery","Outros"]
  };
  // % sugerido de cada categoria sobre a renda (referência saudável; ~7% sobra pra guardar)
  var SUGEST={"Moradia":30,"Mercado":12,"Transporte":10,"Delivery & comida fora":8,"Saúde & farmácia":6,"Lazer & eventos":8,"Compras online":6,"Assinaturas & digital":4,"Viagem":4,"Diversos":5};
  var CUSTOM_PALETTE=["#C65D4E","#C7905A","#7C8A67","#9B7B9A","#6E8C94","#BC6B52","#5F8C7D","#8C4A52","#C98A4B","#A6A096"];
  function allCats(){return CATS.concat(state.customCats||[]);}
  function isCustomCat(n){return (state.customCats||[]).some(function(c){return c.n===n;});}
  function nextCustomColor(){var used=(state.customCats||[]).map(function(c){return c.c;});for(var i=0;i<CUSTOM_PALETTE.length;i++){if(used.indexOf(CUSTOM_PALETTE[i])<0)return CUSTOM_PALETTE[i];}return CUSTOM_PALETTE[(state.customCats||[]).length%CUSTOM_PALETTE.length];}


  var state={txs:[],metas:{},planos:[],renda:null};

  // ===================== CONFIGURE AQUI =====================
  var CLIENT_ID = "557510707009-9dvfm6rin9lprkgktq70u42s4bgpqlm0.apps.googleusercontent.com";
  // ==========================================================
  var SCOPE="openid email profile https://www.googleapis.com/auth/drive.file";
  var FILE_NAME="lisos-dados.json";
  var configured = CLIENT_ID.indexOf("COLE_SEU_CLIENT_ID")===-1 && CLIENT_ID.indexOf(".apps.googleusercontent.com")>-1;

  var userKey="lisosDados:local", memCache=null;
  function loadLocal(){try{var s=localStorage.getItem(userKey);return s?JSON.parse(s):null;}catch(e){return memCache;}}
  function persistLocal(){try{localStorage.setItem(userKey,JSON.stringify(state));}catch(e){memCache=JSON.parse(JSON.stringify(state));}}

  var token=null, tokenClient=null, driveFileId=null, clientReady=false, user=null;
  var $=function(id){return document.getElementById(id);};
  function setSync(t,c){var el=$("syncStatus");if(el){el.textContent=t;el.className="sync-status "+(c||"");}}

  function gIcon(){return '<svg width="15" height="15" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.9-4.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/><path fill="#4CAF50" d="M24 45.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 41 16.2 45.5 24 45.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.2 5.2C41.8 35.7 44.5 30.8 44.5 25c0-1.5-.2-3-.9-4.5z"/></svg>';}

  function renderAccount(){
    var el=$("account"), land=$("landLogin");
    var btn='<button class="sync-btn" id="loginBtn" type="button">'+gIcon()+' Entrar com Google</button>';
    if(user){
      var init=((user.name||user.email||"?").trim().charAt(0)||"?").toUpperCase();
      var fn=(""+(user.name||user.email)).split(" ")[0];
      if(el) el.innerHTML='<span class="user-chip"><span class="av">'+init+'</span>'+escapeHtml(fn)+'</span><button class="logout" id="logoutBtn" type="button">Sair</button>';
      if(land) land.innerHTML="";
      var lb=$("logoutBtn"); if(lb) lb.onclick=logout;
    }else{
      if(el) el.innerHTML=btn;
      if(land) land.innerHTML='<button class="cta ghost" id="loginBtn2" type="button">'+gIcon()+' Entrar com Google</button>';
      var pb=$("loginBtn"); if(pb) pb.onclick=connectDrive;
      var pb2=$("loginBtn2"); if(pb2) pb2.onclick=connectDrive;
    }
  }

  function initDrive(){
    if(!configured){setSync("Login não configurado","off");renderAccount();return;}
    if(!(window.google&&google.accounts&&google.accounts.oauth2))return;
    tokenClient=google.accounts.oauth2.initTokenClient({client_id:CLIENT_ID,scope:SCOPE,
      callback:function(resp){if(resp&&resp.access_token){token=resp.access_token;fetchUser();}else setSync("Não foi possível entrar","off");}});
    clientReady=true; setSync("Não conectado","off"); renderAccount();
  }
  function connectDrive(){
    if(location.protocol==="file:"){setSync("Login só no site publicado","off");alert("O login do Google não funciona abrindo o arquivo direto (file://).\n\nPublique no GitHub Pages e acesse pelo endereço https://… , ou rode um servidor local e abra http://localhost.\n\nO resto do app funciona normalmente mesmo assim — os dados ficam salvos neste navegador.");return;}
    if(!configured){alert("O login ainda não foi configurado pelo administrador do site.");return;}
    if(!clientReady) initDrive();
    if(!clientReady){setSync("Carregando Google…","sync");setTimeout(connectDrive,600);return;}
    setSync("Entrando…","sync"); tokenClient.requestAccessToken({prompt: token?"":"consent"});
  }
  function dh(extra){var h={Authorization:"Bearer "+token};if(extra)for(var k in extra)h[k]=extra[k];return h;}

  function fetchUser(){
    setSync("Entrando…","sync");
    fetch("https://www.googleapis.com/oauth2/v3/userinfo",{headers:dh()})
      .then(function(r){if(r.status===401)throw "401";return r.json();})
      .then(function(u){user={name:u.name||u.email||"você",email:u.email||""};userKey="lisosDados:"+(user.email||"user");renderAccount();onConnected();})
      .catch(function(){token=null;renderAccount();setSync("Não foi possível entrar","off");});
  }
  function onConnected(){
    setSync("Sincronizando…","sync");
    fetch("https://www.googleapis.com/drive/v3/files?q="+encodeURIComponent("name='"+FILE_NAME+"' and trashed=false")+"&spaces=drive&fields=files(id,name)",{headers:dh()})
      .then(function(r){if(r.status===401)throw "401";return r.json();})
      .then(function(d){
        if(d.files&&d.files.length){
          driveFileId=d.files[0].id;
          return fetch("https://www.googleapis.com/drive/v3/files/"+driveFileId+"?alt=media",{headers:dh()})
            .then(function(r){return r.json();})
            .then(function(remote){if(remote&&remote.txs){state=remote;normalizeState();persistLocal();applyState();buildMonths();render();}setSync("Salvo no Drive","ok");});
        }
        persistLocal(); return uploadDrive(true).then(function(){setSync("Salvo no Drive","ok");});
      })
      .catch(function(e){token=null;renderAccount();setSync(e==="401"?"Sessão expirou — entre de novo":"Erro ao acessar o Drive","off");});
  }
  function uploadDrive(create){
    var body=JSON.stringify(state);
    if(create||!driveFileId){
      var meta={name:FILE_NAME,mimeType:"application/json"};
      var bd="----lisos"+Date.now();
      var mp="--"+bd+"\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n"+JSON.stringify(meta)+"\r\n--"+bd+"\r\nContent-Type: application/json\r\n\r\n"+body+"\r\n--"+bd+"--";
      return fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",{method:"POST",headers:dh({"Content-Type":"multipart/related; boundary="+bd}),body:mp})
        .then(function(r){if(r.status===401)throw "401";return r.json();}).then(function(d){if(d.id)driveFileId=d.id;});
    }
    return fetch("https://www.googleapis.com/upload/drive/v3/files/"+driveFileId+"?uploadType=media",{method:"PATCH",headers:dh({"Content-Type":"application/json"}),body:body})
      .then(function(r){if(r.status===401)throw "401";});
  }
  function logout(){
    if(token){try{google.accounts.oauth2.revoke(token,function(){});}catch(e){}}
    try{localStorage.removeItem(userKey);}catch(e){}
    token=null;user=null;driveFileId=null;userKey="lisosDados:local";
    var s=loadLocal(); if(s&&s.txs){state=s;normalizeState();}else freshState();
    renderAccount();applyState();buildMonths();render();setSync(configured?"Não conectado":"Login não configurado","off");
  }

  function freshState(){state={txs:[],metas:{},planos:JSON.parse(JSON.stringify(DEFAULT_PLANOS)),customCats:[],recorrentes:[],vales:[],valeCats:JSON.parse(JSON.stringify(DEFAULT_VALE_CATS)),entradas:[],renda:null};normalizeState();}
  function normalizeState(){
    state.txs=state.txs||[];state.metas=state.metas||{};state.customCats=state.customCats||[];state.recorrentes=state.recorrentes||[];state.vales=state.vales||[];state.entradas=state.entradas||[];
    state.valeCats=state.valeCats||{};["VA","VR"].forEach(function(tp){if(!Array.isArray(state.valeCats[tp])||!state.valeCats[tp].length)state.valeCats[tp]=DEFAULT_VALE_CATS[tp].slice();});
    allCats().forEach(function(c){if(state.metas[c.n]==null)state.metas[c.n]=DEFAULT_METAS[c.n]||0;});
    if(!state.planos)state.planos=JSON.parse(JSON.stringify(DEFAULT_PLANOS));
    state.planos.forEach(function(p,i){if(!p.id)p.id="p"+i+"_"+Math.random().toString(36).slice(2,5);});
  }

  function load(cb){cb(loadLocal());}
  var saveT;
  function save(){
    persistLocal(); clearTimeout(saveT);
    saveT=setTimeout(function(){
      if(token){setSync("Salvando…","sync");uploadDrive(false).then(function(){setSync("Salvo no Drive","ok");})
        .catch(function(e){token=null;renderAccount();setSync(e==="401"?"Sessão expirou — entre de novo":"Erro ao salvar","off");});}
    },700);
  }

  var fmt=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
  function money(v){return fmt.format(v||0);}
  function parseNum(s){if(s==null)return NaN;s=(""+s).trim().replace(/[R$\s]/g,"");if(s==="")return NaN;if(s.indexOf(",")>-1)s=s.replace(/\./g,"").replace(",",".");return parseFloat(s);}
  function catColor(n){var a=allCats();for(var i=0;i<a.length;i++)if(a[i].n===n)return a[i].c;return "#A09BB0";}
  function monthKey(d){return d.slice(0,7);}
  function monthLabel(k){var ms=["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];var p=k.split("-");return ms[parseInt(p[1],10)-1]+" "+p[0];}
  function escapeHtml(s){return (""+s).replace(/[&<>"']/g,function(m){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m];});}
  function emojiFor(n){n=(""+n).toLowerCase();if(/morar|casa|apto|apart|aluguel|mudan/.test(n))return "🔑";if(/viag|trip|praia|interc/.test(n))return "✈️";if(/financ|carro|moto|ve[ií]culo/.test(n))return "🚗";if(/compr|notebook|celular|iphone|m[oó]vel/.test(n))return "🛍️";if(/reserva|emerg/.test(n))return "🛟";if(/casa?mento|noiv/.test(n))return "💍";if(/curso|facul|estud/.test(n))return "🎓";return "🎯";}

  var elRenda=$("renda"),elMonth=$("monthSel");
  function fillCatSelects(){var o=allCats().map(function(c){return '<option value="'+escapeHtml(c.n)+'">'+escapeHtml(c.n)+'</option>';}).join("");$("fCat").innerHTML=o;$("filterCat").innerHTML='<option value="">Todas</option>'+o;}
  function currentMonth(){return elMonth.value;}
  function gastoMonth(){var g=$("monthSelGastos");return (g&&g.value)?g.value:currentMonth();}
  function pad2(n){return (n<10?"0":"")+n;}
  function monthIndex(k){var p=k.split("-");return parseInt(p[0],10)*12+(parseInt(p[1],10)-1);}
  function keyFromIndex(i){var y=Math.floor(i/12),m=i%12+1;return y+"-"+pad2(m);}
  function nowMonthKey(){return new Date().toISOString().slice(0,7);}
  function daysInMonthK(k){var p=k.split("-");return new Date(parseInt(p[0],10),parseInt(p[1],10),0).getDate();}
  // ocorrências projetadas a partir das regras (fixos e parcelamentos) para um mês
  function virtualOccsForMonth(m){
    var out=[], mi=monthIndex(m), nowI=monthIndex(nowMonthKey());
    (state.recorrentes||[]).forEach(function(r){
      var si=monthIndex(r.inicio); if(mi<si)return;
      var k=mi-si+1; if(r.tipo==="parcelado" && k>(r.parcelas||1))return;
      var dia=Math.min(r.dia||1, daysInMonthK(m));
      out.push({
        id:"rec:"+r.id+":"+m, data:m+"-"+pad2(dia),
        desc:r.desc,
        valor:r.valor, categoria:r.categoria,
        parcelado:(r.tipo==="parcelado"), parc:(r.tipo==="parcelado"?(k+"/"+r.parcelas):null), fixo:(r.tipo==="fixo"),
        metodo:r.metodo||null, pago:(mi<nowI), virtual:true, ruleId:r.id
      });
    });
    return out;
  }
  function txsForMonth(m){
    var real=state.txs.filter(function(t){return monthKey(t.data)===m;});
    return real.concat(virtualOccsForMonth(m));
  }
  function buildMonths(){
    var prev=elMonth.value, keys={}, nowK=nowMonthKey(); keys[nowK]=1;
    state.txs.forEach(function(t){keys[monthKey(t.data)]=1;});
    (state.recorrentes||[]).forEach(function(r){
      var si=monthIndex(r.inicio); keys[keyFromIndex(si)]=1;
      var endI = r.tipo==="parcelado" ? si+(r.parcelas||1)-1 : monthIndex(nowK)+12; // fixo: horizonte de 12 meses
      for(var i=si;i<=endI;i++)keys[keyFromIndex(i)]=1;
    });
    var arr=Object.keys(keys).sort().reverse(); if(arr.length===0)arr=[nowK];
    elMonth.innerHTML=arr.map(function(k){return '<option value="'+k+'">'+monthLabel(k)+(k>nowK?" · futuro":"")+'</option>';}).join("");
    elMonth.value = (arr.indexOf(prev)>-1) ? prev : (arr.indexOf(nowK)>-1?nowK:arr[0]);
    var g=$("monthSelGastos");
    if(g){ var pg=g.value; g.innerHTML=arr.map(function(k){return '<option value="'+k+'">'+monthLabel(k)+(k>nowK?" · futuro":"")+'</option>';}).join(""); g.value=(arr.indexOf(pg)>-1)?pg:(arr.indexOf(nowK)>-1?nowK:arr[0]); }
  }
  function monthTxs(){return txsForMonth(currentMonth());}
  function totalsByCat(){var t={};allCats().forEach(function(c){t[c.n]=0;});monthTxs().forEach(function(x){t[x.categoria]=(t[x.categoria]||0)+x.valor;});return t;}

  function gastoMes(){return monthTxs().reduce(function(a,b){return a+b.valor;},0);}
  var ENT_TIPOS=[{v:"devido",n:"Valor devido",c:"#7C8A67"},{v:"presente",n:"Presente",c:"#C98A4B"},{v:"reembolso",n:"Reembolso convênio",c:"#6E8C94"}];
  function entTipoInfo(v){for(var i=0;i<ENT_TIPOS.length;i++)if(ENT_TIPOS[i].v===v)return ENT_TIPOS[i];return {v:v,n:v||"Entrada",c:"#A6A096"};}
  function entradasDoMes(m){m=m||currentMonth();return (state.entradas||[]).filter(function(e){return monthKey(e.data||"")===m;});}
  function entradasMes(){return entradasDoMes().reduce(function(a,b){return a+(b.valor||0);},0);}
  function sobraMes(){return state.renda!=null?state.renda-gastoMes()+entradasMes():null;}
  function render(){ renderStats(); renderSim(); renderInsights(); renderAPagar(); renderAReceber(); renderEntradas(); renderMetodoCard(); renderCats(); renderPlanos(); renderList(); renderRules(); renderTrends(); renderWelcome(); renderVales(); }
  function renderAReceber(){
    var el=$("aReceberCard"); if(!el)return;
    var rec=monthTxs().filter(function(t){return t.reemb===true && t.reembOk!==true;});
    if(rec.length===0){ el.innerHTML=""; return; }
    var tot=rec.reduce(function(a,b){return a+Math.abs(b.valor);},0);
    el.innerHTML='<div class="apagar recv"><div class="apagar-top"><span class="apagar-k">A receber este mês</span><button class="apagar-link" id="goRecv" type="button">ver →</button></div>'+
      '<div class="apagar-v num">'+money(tot)+'</div>'+
      '<div class="apagar-sub">'+rec.length+' lançamento'+(rec.length>1?'s':'')+' para reembolso ou a cobrar de alguém.</div></div>';
    var g=$("goRecv"); if(g) g.onclick=function(){ recvFilter=true; var rt=$("recvToggle"); if(rt)rt.classList.add("active"); showTab("gastos"); renderList(); };
  }
  // ---- Entradas (abatem os gastos) ----
  function addEntrada(){
    var desc=$("eDesc").value.trim(), val=parseNum($("eVal").value), data=$("eData").value, tipo=$("eTipo").value;
    if(isNaN(val)||val<=0){$("eVal").focus();return;}
    if(!data)data=new Date().toISOString().slice(0,10);
    if(!desc)desc=entTipoInfo(tipo).n;
    state.entradas=state.entradas||[];
    state.entradas.push({id:"e"+Date.now()+Math.random().toString(36).slice(2,5),desc:desc,valor:val,data:data,tipo:tipo});
    save(); $("eDesc").value="";$("eVal").value=""; render();
    toast("Entrada registrada ✓"); $("eDesc").focus();
  }
  function delEntrada(id){
    var e=(state.entradas||[]).filter(function(x){return x.id===id;})[0];
    if(e&&e.fromTx){ state.txs.forEach(function(t){if(t.id===e.fromTx)t.reembOk=false;}); }
    state.entradas=(state.entradas||[]).filter(function(x){return x.id!==id;}); save(); render(); toast("Entrada removida");
  }
  function entradaFromTx(txId){ return (state.entradas||[]).filter(function(e){return e.fromTx===txId;})[0]; }
  function marcarRecebido(tx,ok,tipo){
    state.entradas=state.entradas||[];
    if(ok){
      if(!entradaFromTx(tx.id)){
        state.entradas.push({id:"e"+Date.now()+Math.random().toString(36).slice(2,5),desc:"Recebido: "+(tx.desc||"reembolso"),valor:Math.abs(tx.valor),data:tx.data||new Date().toISOString().slice(0,10),tipo:(tipo||"reembolso"),fromTx:tx.id});
      }
      tx.reembOk=true;
    } else {
      state.entradas=(state.entradas||[]).filter(function(e){return e.fromTx!==tx.id;});
      tx.reembOk=false;
    }
  }
  // ---- sheet: escolher tipo ao marcar recebido ----
  var pendingRecvTx=null;
  function openRecvSheet(id){ pendingRecvTx=id; var o=$("recvSheet"); if(o){o.hidden=false;document.body.style.overflow="hidden";} }
  function closeRecvSheet(){ var o=$("recvSheet"); if(o)o.hidden=true; document.body.style.overflow=""; pendingRecvTx=null; }
  // ---- sheet: detalhe/edição de categoria ----
  var catDetailCat=null;
  function openCatDetail(cat){ catDetailCat=cat; renderCatDetail(); var o=$("catDetail"); if(o){o.hidden=false;document.body.style.overflow="hidden";} }
  function closeCatDetail(){ var o=$("catDetail"); if(o)o.hidden=true; document.body.style.overflow=""; catDetailCat=null; }
  function renderCatDetail(){
    if(catDetailCat==null)return;
    var t=$("catDetailTitle"); if(t)t.textContent=catDetailCat;
    var body=$("catDetailBody"); if(!body)return;
    var all=txsForMonth(currentMonth()).filter(function(x){return x.categoria===catDetailCat;});
    var reais=all.filter(function(x){return !x.virtual;}), virt=all.filter(function(x){return x.virtual;});
    var tot=all.reduce(function(a,b){return a+b.valor;},0);
    var head='<div class="ce-sum">'+money(tot)+' · '+all.length+' lançamento'+(all.length!==1?'s':'')+' em '+monthLabel(currentMonth())+'</div>';
    if(!all.length){ body.innerHTML=head+'<div class="empty" style="padding:18px">Nenhum gasto nessa categoria neste mês.</div>'; return; }
    var opts=allCats().map(function(c){return c.n;});
    var items=reais.map(function(x){
      var dd=(""+(x.data||"")).split("-");
      var sel=opts.map(function(n){return '<option value="'+escapeHtml(n)+'"'+(n===x.categoria?' selected':'')+'>'+escapeHtml(n)+'</option>';}).join("");
      return '<div class="ce-item"><div class="ce-row"><input class="ce-desc" data-id="'+x.id+'" value="'+escapeHtml(x.desc||"")+'" placeholder="Descrição"><div class="ce-valwrap"><span>R$</span><input class="ce-val num" data-id="'+x.id+'" inputmode="decimal" value="'+(""+x.valor).replace(".",",")+'"></div></div>'+
        '<div class="ce-row2"><select class="ce-cat" data-id="'+x.id+'">'+sel+'</select><span class="ce-date">'+(dd.length===3?dd[2]+"/"+dd[1]:"")+'</span><button class="ce-del" data-id="'+x.id+'" type="button">excluir</button></div></div>';
    }).join("");
    var virtNote = virt.length ? '<div class="note" style="margin-top:8px">+ '+money(virt.reduce(function(a,b){return a+b.valor;},0))+' de '+virt.length+' parcela(s)/fixo(s) projetado(s). Pra alterar, vá em <b>Fixos e parcelamentos</b>.</div>' : '';
    body.innerHTML=head+items+virtNote;
  }
  function renderEntradasList(){
    var host=$("entList"); if(!host)return;
    var arr=entradasDoMes(gastoMonth()).slice().sort(function(a,b){return (""+(b.data||"")).localeCompare(""+(a.data||""));});
    var tot=arr.reduce(function(a,b){return a+b.valor;},0), totEl=$("entTotal");
    if(totEl)totEl.textContent=arr.length?("+"+money(tot)):"";
    if(!arr.length){host.className="tx-list is-empty";host.innerHTML='<div class="empty" style="padding:18px">Nenhuma entrada neste mês. Recebeu um reembolso, um presente ou alguém te pagou o que devia? Registre acima — eu abato do total de gastos.</div>';return;}
    host.className="tx-list";
    host.innerHTML=arr.map(function(e){
      var t=entTipoInfo(e.tipo);
      return '<div class="tx"><span class="dot" style="background:'+t.c+'"></span><div class="info"><div class="desc">'+escapeHtml(e.desc)+'</div><div class="meta">'+t.n+' · '+valeDateBR(e.data)+'</div></div><div class="amt neg">+ '+money(e.valor)+'</div><button class="del" data-eid="'+e.id+'" aria-label="Remover">×</button></div>';
    }).join("");
  }
  function renderEntradasCard(){
    var el=$("entradasCard"); if(!el)return;
    var arr=entradasDoMes();
    if(!arr.length){el.innerHTML="";return;}
    var tot=arr.reduce(function(a,b){return a+b.valor;},0);
    var pills=ENT_TIPOS.map(function(t){var s=arr.filter(function(e){return e.tipo===t.v;}).reduce(function(a,b){return a+b.valor;},0);return s>0?('<span class="ent-pill"><i style="background:'+t.c+'"></i>'+t.n+' '+money(s)+'</span>'):'';}).join("");
    el.innerHTML='<div class="apagar recv"><div class="apagar-top"><span class="apagar-k">Entradas este mês</span><button class="apagar-link" id="goEnt" type="button">ver →</button></div>'+
      '<div class="apagar-v num" style="color:#566849">+'+money(tot)+'</div>'+
      '<div class="apagar-sub">Já abatido dos seus gastos · '+arr.length+' lançamento'+(arr.length>1?'s':'')+'.</div>'+
      (pills?'<div class="ent-pills">'+pills+'</div>':'')+'</div>';
    var g=$("goEnt"); if(g) g.onclick=function(){ showTab("gastos"); var s=$("entSec"); if(s&&s.scrollIntoView)s.scrollIntoView({behavior:"smooth",block:"start"}); };
  }
  function renderEntradas(){ renderEntradasList(); renderEntradasCard(); }
  // ---- Crédito x à vista (compromete o próximo mês) ----
  function metodoGrupo(t){ var m=t.metodo; if(m==="credito")return "credito"; if(m==="pix"||m==="debito"||m==="dinheiro")return "avista"; return "sem"; }
  function splitMetodoMes(){
    var s={avista:0,credito:0,sem:0,total:0};
    monthTxs().forEach(function(t){ var g=metodoGrupo(t); s[g]+=t.valor; s.total+=t.valor; });
    return s;
  }
  function renderMetodoCard(){
    var el=$("metodoCard"); if(!el)return;
    var s=splitMetodoMes();
    if(s.total<=0){el.innerHTML="";return;}
    var prox=monthLabel(keyFromIndex(monthIndex(currentMonth())+1)), atual=monthLabel(currentMonth());
    var aw=Math.round(s.avista/s.total*100), cw=Math.round(s.credito/s.total*100), sw=Math.max(0,100-aw-cw);
    var semNote = s.sem>0 ? '<div class="note" style="margin-top:10px">'+money(s.sem)+' ainda sem forma de pagamento informada — escolha "Como pagou" no gasto pra eu separar certo.</div>' : '';
    el.innerHTML='<div class="apagar"><div class="apagar-top"><span class="apagar-k">Já gastei este mês</span><span class="num" style="font-weight:700;font-variant-numeric:tabular-nums">'+money(s.total)+'</span></div>'+
      '<div class="paysplit">'+
        '<div class="pay-col avista"><div class="pay-lab"><i style="background:#7C8A67"></i>À vista</div><div class="pay-val num">'+money(s.avista)+'</div><div class="pay-sub">pix, débito, dinheiro — saiu da conta agora</div></div>'+
        '<div class="pay-col credito"><div class="pay-lab"><i style="background:#C65D4E"></i>No crédito</div><div class="pay-val num">'+money(s.credito)+'</div><div class="pay-sub">vira fatura — compromete '+prox+'</div></div>'+
      '</div>'+
      '<div class="pay-bar"><i style="width:'+aw+'%;background:#7C8A67"></i><i style="width:'+cw+'%;background:#C65D4E"></i><i style="width:'+sw+'%;background:#A6A096"></i></div>'+
      '<div class="apagar-sub" style="margin-top:10px">O que você passou no crédito em '+atual+' cai na fatura e <b>compromete sua renda de '+prox+'</b>.</div>'+
      semNote+'</div>';
  }
  function mascot(mood){
    var mouth = mood==="sad" ? "M33 53 q7 -5 14 0" : "M33 50 q7 5 14 0";
    return '<svg viewBox="0 0 80 80" aria-hidden="true">'+
      '<path d="M40 10c-15 0-25 11-25 27v24c0 3 3 5 6 3l4-2c2-1 4-1 6 0l3 2c2 1 4 1 6 0l3-2c2-1 4-1 6 0l4 2c3 2 6 0 6-3V37c0-16-10-27-25-27z" fill="#FCFAF6" stroke="#232323" stroke-width="3" stroke-linejoin="round"/>'+
      '<g fill="#232323"><rect x="21" y="31" width="16" height="12" rx="5"/><rect x="43" y="31" width="16" height="12" rx="5"/><rect x="36" y="35" width="8" height="3.4" rx="1.5"/></g>'+
      '<rect x="24" y="33.5" width="4.5" height="2.2" rx="1.1" fill="#C65D4E" opacity=".9"/>'+
      '<path d="'+mouth+'" stroke="#232323" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>';
  }
  var toastT1,toastT2;
  function toast(msg){
    var el=$("toast"); if(!el)return;
    el.textContent=msg; el.hidden=false; clearTimeout(toastT1); clearTimeout(toastT2);
    requestAnimationFrame(function(){el.classList.add("show");});
    toastT1=setTimeout(function(){el.classList.remove("show");},2200);
    toastT2=setTimeout(function(){el.hidden=true;},2500);
  }
  function renderWelcome(){
    var el=$("welcome"); if(!el)return;
    var fresh = state.txs.length===0 && (state.recorrentes||[]).length===0;
    if(!fresh){ el.innerHTML=""; return; }
    el.innerHTML='<div class="welcome">'+mascot("cool")+'<div><h3>Bora começar?</h3><p>Informe sua renda aqui em cima e traga seus gastos: importe a fatura (PDF/CSV) ou registre rapidinho no chat.</p><div class="w-cta"><button class="w-prim" id="wImport" type="button">Importar fatura</button><button class="w-ghost" id="wChat" type="button">Registrar no chat</button></div></div></div>';
    var wi=$("wImport"); if(wi) wi.onclick=function(){showTab("gastos");};
    var wc=$("wChat"); if(wc) wc.onclick=function(){openChat();};
    var t=$("termometro"); if(t)t.innerHTML=""; var ap=$("aPagarCard"); if(ap)ap.innerHTML="";
  }
  function renderRules(){
    var el=$("rulesBox"); if(!el)return;
    var rs=(state.recorrentes||[]).slice().sort(function(a,b){return a.inicio<b.inicio?1:-1;});
    if(rs.length===0){ el.innerHTML='<p class="note" style="margin:2px">Nada fixo nem parcelado ainda. Ao adicionar um gasto, marque como <b>Fixo</b> (repete todo mês) ou <b>Parcelado</b> e ele aparece sozinho nos próximos meses.</p>'; return; }
    el.innerHTML=rs.map(function(r){
      var tag=r.tipo==="fixo"?'<span class="parc">🔁 Fixo</span>':'<span class="parc">'+r.parcelas+'x</span>';
      var info=r.tipo==="fixo"?("todo mês desde "+monthLabel(r.inicio)):(r.parcelas+" parcelas desde "+monthLabel(r.inicio));
      var unid=r.tipo==="parcelado"?"/parcela":"/mês";
      return '<div class="tx"><span class="dot" style="background:'+catColor(r.categoria)+'"></span><div class="info"><div class="desc">'+escapeHtml(r.desc)+' '+tag+'</div><div class="meta">'+money(r.valor)+unid+' · '+escapeHtml(r.categoria)+' · '+info+'</div></div><button class="del" data-rid="'+r.id+'" aria-label="Remover regra">×</button></div>';
    }).join("");
  }
  function renderMoney(){ renderStats(); renderSim(); renderInsights(); renderAPagar(); renderCats(); renderPlanos(); }
  function renderStats(){
    var txs=monthTxs(), byCat=totalsByCat();
    var totalGasto=txs.reduce(function(a,b){return a+b.valor;},0);
    var ent=entradasMes();
    var parc=txs.filter(function(t){return t.parcelado;}).reduce(function(a,b){return a+b.valor;},0);
    var maxCat="—",maxV=-1; for(var k in byCat){if(byCat[k]>maxV){maxV=byCat[k];maxCat=k;}}
    var renda=state.renda, sobra=renda!=null?renda-totalGasto+ent:null, pctParc=renda?(parc/renda*100):null;
    $("stats").innerHTML=
      statCard("Gasto no mês",money(totalGasto),txs.length+" lançamentos"+(ent>0?" · −"+money(ent)+" abatido":""))+
      statCard("Parcelas no mês",money(parc),(pctParc!=null?pctParc.toFixed(0)+"% da renda":"comprometido"),true)+
      statCard("Maior categoria",maxCat,money(maxV<0?0:maxV))+
      statCard("Sobra estimada",(sobra!=null?money(sobra):"—"),(sobra!=null?(sobra>=0?"livre pra guardar":"no vermelho"):"informe a renda"),sobra!=null&&sobra<0);
  }
  function renderCats(){
    var byCat=totalsByCat(), html="", renda=state.renda, cats=allCats();
    cats.forEach(function(c){
      var sp=byCat[c.n]||0, meta=state.metas[c.n]||0, custom=isCustomCat(c.n);
      var pct=meta>0?Math.min(sp/meta*100,100):(sp>0?100:0), over=meta>0&&sp>meta;
      var sug=sugForCat(c.n), pctLine="";
      if(renda&&renda>0){
        var metaPct=Math.round(meta/renda*100);
        var sugTxt = sug!=null ? ' · sugestão '+sug+'%' : '';
        var alertPct = (sug!=null && metaPct>sug+3);
        pctLine='<div class="cat-pct'+(alertPct?' over-pct':'')+'">'+metaPct+'% da renda'+sugTxt+'</div>';
      } else if(sug!=null){
        pctLine='<div class="cat-pct">sugestão: '+sug+'% da renda</div>';
      }
      html+='<div class="cat" data-catopen="'+escapeHtml(c.n)+'"><div class="cat-top"><span class="cat-name">'+escapeHtml(c.n)+
        (over?'<span class="cat-tag tag-over">acima</span>':(meta>0&&sp>0?'<span class="cat-tag tag-ok">ok</span>':''))+
        (custom?'<button class="cat-del" data-cat="'+escapeHtml(c.n)+'" aria-label="Remover categoria">×</button>':'')+
        '</span><span class="cat-fig"><b>'+money(sp)+'</b> / meta <input class="cat-meta-edit num" data-cat="'+escapeHtml(c.n)+'" value="'+meta.toFixed(0)+'" inputmode="numeric"></span></div>'+
        '<div class="cat-bar"><div class="cat-fill'+(over?' over':'')+'" style="width:'+pct+'%;background:'+(over?'':c.c)+'"></div></div>'+pctLine+'</div>';
    });
    $("cats").innerHTML=html;
    Array.prototype.forEach.call(document.querySelectorAll(".cat-meta-edit"),function(inp){
      inp.addEventListener("change",function(){var v=parseNum(inp.value);if(isNaN(v)||v<0)v=0;state.metas[inp.getAttribute("data-cat")]=v;save();renderCats();});
    });
    Array.prototype.forEach.call(document.querySelectorAll(".cat-del"),function(b){
      b.addEventListener("click",function(){delCustomCat(b.getAttribute("data-cat"));});
    });
    // projeção total
    var proj=$("catProj"); if(proj){
      if(renda&&renda>0){
        var tot=0; cats.forEach(function(c){tot+=state.metas[c.n]||0;});
        var p=Math.round(tot/renda*100), resto=100-p;
        proj.innerHTML = resto>=0
          ? 'Suas metas somam <b>'+p+'%</b> da renda — sobra <b>'+resto+'%</b> pra guardar.'
          : 'Suas metas já passam da renda em <b class="over-pct">'+(-resto)+'%</b>. Hora de cortar alguma.';
      } else { proj.innerHTML='Informe sua renda na caixa lá em cima pra ver as metas em % da renda e a projeção.'; }
    }
  }
  function sugForCat(n){ if(SUGEST[n]!=null)return SUGEST[n]; var cc=(state.customCats||[]).filter(function(c){return c.n===n;})[0]; return (cc&&cc.sug!=null)?cc.sug:null; }
  function sugerirMetas(){
    if(!(state.renda&&state.renda>0)){ alert("Informe sua renda na aba Visão pra eu sugerir as metas."); return; }
    allCats().forEach(function(c){ var pct=sugForCat(c.n); if(pct!=null) state.metas[c.n]=Math.round(state.renda*pct/100); });
    save(); renderCats(); toast("Metas atualizadas ✓");
  }
  function addCustomCat(){
    var name=($("newCatName").value||"").trim(); if(!name)return;
    if(allCats().some(function(c){return c.n.toLowerCase()===name.toLowerCase();})){ alert("Essa categoria já existe."); return; }
    var cor=($("newCatColor")&&$("newCatColor").value)||nextCustomColor();
    var sugRaw=parseNum($("newCatSug")?$("newCatSug").value:""); var sug=(!isNaN(sugRaw)&&sugRaw>=0)?Math.round(sugRaw):null;
    state.customCats=state.customCats||[];
    state.customCats.push({n:name,c:cor,sug:sug});
    state.metas[name]=(sug!=null&&state.renda>0)?Math.round(state.renda*sug/100):0;
    save(); $("newCatName").value=""; if($("newCatSug"))$("newCatSug").value=""; fillCatSelects(); render(); toast("Categoria criada ✓");
  }
  function delCustomCat(name){
    if(!confirm('Remover a categoria "'+name+'"? Os lançamentos dela vão pra "Diversos".')) return;
    state.customCats=(state.customCats||[]).filter(function(c){return c.n!==name;});
    delete state.metas[name];
    state.txs.forEach(function(t){if(t.categoria===name)t.categoria="Diversos";});
    save(); fillCatSelects(); render(); toast("Categoria removida");
  }
  function statCard(k,v,sub,al){return '<div class="stat"><div class="k">'+k+'</div><div class="v'+(al?' alert':'')+'">'+v+'</div><div class="sub">'+sub+'</div></div>';}

  function renderSim(){
    var totalGasto=gastoMes(), ent=entradasMes(), liquido=totalGasto-ent;
    var renda=state.renda, sv=$("sobraVal"), bs=$("barSpent"), ve=$("verdict");
    if(renda==null||renda<=0){sv.textContent="—";sv.style.color="";bs.style.width="0%";ve.innerHTML="Informe sua renda pra ver quanto sobra no mês.";return;}
    var sobra=renda-liquido;
    sv.textContent=money(sobra); sv.style.color=sobra>=0?"#566849":"#B14A3C";
    bs.style.width=Math.max(0,Math.min(liquido/renda*100,100))+"%";
    if(ent>0){
      ve.innerHTML= sobra>=0
        ? 'Você gastou <span class="pill">'+money(totalGasto)+'</span>, recebeu <span class="pill">+'+money(ent)+'</span> em entradas e ficou em <span class="pill">'+money(liquido)+'</span> de <span class="pill">'+money(renda)+'</span>.'
        : '<span class="bad">Mesmo com '+money(ent)+' em entradas, os gastos passaram da renda em '+money(-sobra)+'.</span>';
    } else {
      ve.innerHTML= sobra>=0
        ? 'Você gastou <span class="pill">'+money(totalGasto)+'</span> de <span class="pill">'+money(renda)+'</span>.'
        : '<span class="bad">Os gastos passaram da renda este mês em '+money(-sobra)+'.</span>';
    }
  }

  function renderPlanos(){
    var sobra=sobraMes();
    var el=$("planos"); if(!state.planos)state.planos=[];
    if(state.planos.length===0){el.innerHTML='<div class="plano"><div class="empty" style="padding:14px">Nenhuma meta ainda. Crie uma abaixo.</div></div>';return;}
    el.innerHTML=state.planos.map(function(p){
      var v=p.valor||0, verdict="", barPct=0, over=false;
      if(p.modo==="mensal"){
        if(sobra==null){verdict='Informe sua renda na aba Visão pra calcular.';}
        else if(sobra>=v){verdict='<span class="ok2">✓ Cabe.</span> Sobraria '+money(sobra-v)+' depois desse custo.';barPct=100;}
        else{verdict='<span class="bad2">Faltam '+money(v-sobra)+'</span> por mês. É o quanto cortar dos gastos.';barPct=v>0?Math.min(sobra/v*100,100):0;over=true;}
      }else{
        if(sobra==null||sobra<=0){verdict='Sem sobra no mês ainda — ajuste renda e gastos pra começar a guardar.';}
        else{var meses=Math.ceil(v/sobra);verdict='Guardando a sobra de <b>'+money(sobra)+'/mês</b>, você junta isso em <span class="ok2">~'+meses+' '+(meses===1?'mês':'meses')+'</span>.';barPct=Math.min(sobra/v*100,100);}
      }
      return '<div class="plano"><div class="plano-ico">'+(p.emoji||"🎯")+'</div><div class="plano-body">'+
        '<div class="plano-top"><span class="plano-name">'+escapeHtml(p.nome)+'<span class="plano-mode">'+(p.modo==="mensal"?"custo mensal":"meta")+'</span></span>'+
        '<button class="plano-del" data-id="'+p.id+'" aria-label="Remover">×</button></div>'+
        '<div class="plano-fig">'+(p.modo==="mensal"?"custo":"meta")+': <input class="cat-meta-edit num" data-pid="'+p.id+'" value="'+v.toFixed(0)+'" inputmode="numeric"></div>'+
        '<div class="plano-verdict">'+verdict+'</div>'+
        '<div class="bar2"><i class="'+(over?'over':'')+'" style="width:'+barPct+'%"></i></div></div></div>';
    }).join("");
    Array.prototype.forEach.call(el.querySelectorAll(".plano-del"),function(b){b.addEventListener("click",function(){var id=b.getAttribute("data-id");state.planos=state.planos.filter(function(p){return p.id!==id;});save();render();});});
    Array.prototype.forEach.call(el.querySelectorAll("[data-pid]"),function(inp){inp.addEventListener("change",function(){var v=parseNum(inp.value);if(isNaN(v)||v<0)v=0;var id=inp.getAttribute("data-pid");state.planos.forEach(function(p){if(p.id===id)p.valor=v;});save();render();});});
  }

  function renderList(){
    var fc=$("filterCat").value;
    var txs=txsForMonth(gastoMonth()).slice().sort(function(a,b){return b.data<a.data?-1:(b.data>a.data?1:0);});
    if(fc)txs=txs.filter(function(t){return t.categoria===fc;});
    if(payFilter)txs=txs.filter(function(t){return t.pago===false;});
    if(recvFilter)txs=txs.filter(function(t){return t.reemb===true;});
    if(parcFilter)txs=txs.filter(function(t){return t.parcelado===true;});
    var tl=$("txList"), cnt=$("txCount"); if(cnt)cnt.textContent=txs.length?("· "+txs.length):"";
    if(txs.length===0){
      tl.classList.add("is-empty");
      if(fc||payFilter||recvFilter||parcFilter){ tl.innerHTML='<div class="empty-wrap"><div class="empty-art"><div class="em-t">Nenhum lançamento com esse filtro</div><div class="em-s">Troque o mês, a categoria ou os filtros aqui de cima.</div></div></div>'; return; }
      tl.innerHTML='<div class="empty-wrap"><div class="empty-art">'+mascot("sad")+'<div class="em-t">Nada por aqui ainda</div><div class="em-s">Importe sua fatura (PDF ou CSV) ali em cima, ou registre um gasto pelo botão “+”. Seus lançamentos aparecem aqui.</div></div></div>';
      return;
    }
    tl.classList.remove("is-empty");
    tl.innerHTML=txs.map(function(t){
      var neg=t.valor<0, dd=t.data.split("-");
      if(t.virtual){
        var selo=t.fixo?'<span class="parc badge-rec">🔁 fixo</span>':'<span class="parc badge-rec">parcelado</span>';
        return '<div class="tx tx-virt"><span class="dot" style="background:'+catColor(t.categoria)+'"></span><div class="info"><div class="desc">'+escapeHtml(t.desc)+'</div><div class="meta">'+dd[2]+'/'+dd[1]+' · '+escapeHtml(t.categoria)+' · '+selo+(t.metodo?' · '+labelMetodo(t.metodo):'')+(t.pago===false?' · <span class="parc">a pagar</span>':'')+'</div></div><div class="amt'+(neg?' neg':'')+'">'+money(t.valor)+'</div></div>';
      }
      var recSel = t.reemb ? (t.reembOk ? ' · <span class="parc rec">recebido ✓</span>' : ' · <span class="parc rec">a receber</span>') : '';
      var recBtn = t.reemb ? '<button class="rbtn'+(t.reembOk?' on':'')+'" data-recv="'+t.id+'" title="Marcar como recebido (vira entrada que abate)" aria-label="Recebido">✓</button>' : '';
      return '<div class="tx"><span class="dot" style="background:'+catColor(t.categoria)+'"></span><div class="info"><div class="desc">'+escapeHtml(t.desc)+'</div><div class="meta">'+dd[2]+'/'+dd[1]+' · '+catSelect(t.id,t.categoria)+(t.parcelado?' · <span class="parc">parcela'+(t.parc?(' '+t.parc):'')+'</span>':'')+(t.metodo?' · '+labelMetodo(t.metodo):'')+(t.pago===false?' · <span class="parc">a pagar</span>':'')+recSel+'</div></div><div class="amt'+(neg?' neg':'')+'">'+money(t.valor)+'</div>'+recBtn+'<button class="rbtn'+(t.reemb?' on':'')+'" data-rec="'+t.id+'" title="Marcar/desmarcar a receber (reembolso)" aria-label="A receber">↩</button><button class="del" data-id="'+t.id+'" aria-label="Remover">×</button></div>';
    }).join("");
  }
  function catSelect(id,cur){var o="";allCats().forEach(function(c){o+='<option value="'+escapeHtml(c.n)+'"'+(c.n===cur?' selected':'')+'>'+escapeHtml(c.n)+'</option>';});return '<select class="cat-sel" data-id="'+id+'" aria-label="Mudar categoria">'+o+'</select>';}


  // ---- importação de fatura em PDF (no próprio navegador) ----
  var pendingImport=null, pdfReady=false, payFilter=false, recvFilter=false, parcFilter=false, valeFilter=null, valeBreakMonth=null;
  function ensurePdf(){ if(window.pdfjsLib && !pdfReady){ pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; pdfReady=true; } return !!window.pdfjsLib; }
  function parseAmount(s){return parseFloat((""+s).replace(/\./g,"").replace(",","."));}
  function mostCommon(a){var c={},best=null,n=-1;a.forEach(function(x){c[x]=(c[x]||0)+1;if(c[x]>n){n=c[x];best=x;}});return best;}
  var KW=[
    [/uber|99 ?ride|99app|99 |trip help|dl ?\*|pg ?\*|cabify|metr[oô]|bilhete[ ]?[uú]nico|estacion/i,"Transporte"],
    [/ifood|z[eé] ?delivery|rappi|restaurante|sushi|caf[eé]|coffee|burger|jeronimo|lanch|pizza|deola|doce|food|padaria|bar e res|teg /i,"Delivery & comida fora"],
    [/dia brasil|daki|carrefour|p[aã]o de a|assa[ií]|supermerc|atacad|hortifr|sacol[aã]o|mercadinho|\bmercado\b(?! ?livre)/i,"Mercado"],
    [/mercado ?livre|mercadolivre|shopee|shein|amazon|aliexpress|daiso|kalunga|magalu|americanas|melimais|morana|tiktok shop|app ?\*blumi/i,"Compras online"],
    [/spotify|netflix|duolingo|wellhub|globo|claude|google|youtube|prime|disney|hbo|max |assinatura|followers|telemedicina/i,"Assinaturas & digital"],
    [/sympla|ingresse|cinemark|cinema|ingresso|quero2|zig|tickets|cheers|show|evento|pacaembu|q2 /i,"Lazer & eventos"],
    [/airbnb|booking|hotel|pousada|latam|gol |azul |passagem|viagem|hostel|cvc/i,"Viagem"],
    [/drogaria|farmacia|farm[aá]cia|drogasil|pacheco|sa[uú]de|clinica|laborat|hospital/i,"Saúde & farmácia"],
    [/aluguel|condom[ií]nio|enel|sabesp|claro|vivo|tim |internet|imobili|energia/i,"Moradia"]
  ];
  function categFromDesc(d){var s=(""+d).toLowerCase();for(var i=0;i<KW.length;i++){if(KW[i][0].test(s))return KW[i][1];}return "Diversos";}

  function parsePdf(file){
    return file.arrayBuffer().then(function(buf){ return pdfjsLib.getDocument({data:buf}).promise; }).then(function(pdf){
      var lines=[]; var seq=Promise.resolve();
      function doPage(pp){ return pdf.getPage(pp).then(function(pg){return pg.getTextContent();}).then(function(tc){
        var its=tc.items.filter(function(i){return i.str&&i.str.trim();}).map(function(i){return {x:i.transform[4],y:i.transform[5],s:i.str};});
        its.sort(function(a,b){return (b.y-a.y)||(a.x-b.x);});
        var rws=[],cur=null;
        its.forEach(function(it){
          if(cur && Math.abs(cur.y-it.y)<=3){ cur.items.push(it); }
          else { cur={y:it.y,items:[it]}; rws.push(cur); }
        });
        rws.forEach(function(r){
          var t=r.items.sort(function(a,b){return a.x-b.x;}).map(function(i){return i.s;}).join(" ").replace(/\s+/g," ").trim();
          if(t)lines.push(t);
        });
      }); }
      for(var p=1;p<=pdf.numPages;p++){ (function(pp){ seq=seq.then(function(){return doPage(pp);}); })(p); }
      return seq.then(function(){ var r=linesToTx(lines); r.file=file.name; return r; });
    });
  }
  function linesToTx(lines){
    var full=lines.join("\n");
    var year=mostCommon(full.match(/\b20\d{2}\b/g)||[])||(new Date().getFullYear()+"");
    var MES={JAN:1,FEV:2,MAR:3,ABR:4,MAI:5,JUN:6,JUL:7,AGO:8,SET:9,OUT:10,NOV:11,DEZ:12};
    var re=/^(\d{1,2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\b\s*(.+?)\s+(−|-)?\s*R\$\s*([\d.]+,\d{2})$/i;
    var out=[], ignored=[], declared=[], seenDecl={};
    lines.forEach(function(ln){
      var lt=ln.toLowerCase(), dm=ln.match(/r\$\s*([\d.]+,\d{2})/i), rcount=(ln.match(/r\$/gi)||[]).length;
      if(dm && rcount===1 && /total de compras|total a pagar/.test(lt)){
        var lab=/total a pagar/.test(lt)?"Total a pagar":"Total de compras";
        if(!seenDecl[lab]){seenDecl[lab]=1;declared.push({label:lab,value:parseAmount(dm[1])});}
      }
      var m=ln.match(re); if(!m)return;
      var dd=("0"+m[1]).slice(-2), mo=("0"+MES[m[2].toUpperCase()]).slice(-2);
      var rawDesc=(m[3]||"").replace(/\s+/g," ").trim(), val=parseAmount(m[5])*(m[4]?-1:1), low=rawDesc.toLowerCase();
      var isDivida=/parcelamento de fatura/.test(low);
      if(!isDivida){
        if(/cr[eé]dito de parcelamento/.test(low)){ ignored.push({desc:rawDesc, valor:val, reason:"crédito de parcelamento (estorno do valor parcelado)"}); return; }
        if(/pagamento/.test(low)){ ignored.push({desc:rawDesc, valor:val, reason:"pagamento da fatura (não é gasto)"}); return; }
        if(/saldo em aberto|total a pagar|limite/.test(low)){ ignored.push({desc:rawDesc, valor:val, reason:"linha de resumo"}); return; }
      }
      var pm=rawDesc.match(/parcela\s*(\d+)\s*\/\s*(\d+)/i);
      var parcLabel=pm?(parseInt(pm[1],10)+"/"+parseInt(pm[2],10)):null;
      var desc=rawDesc.replace(/^[^0-9A-Za-zÀ-ÿ]+/,"").replace(/^\d{4}\s+/,"").replace(/\s*[-–]\s*parcela\s*\d+\s*\/\s*\d+/i,"").replace(/\s*-\s*nupay/i,"").replace(/\s+/g," ").trim();
      if(!desc||isNaN(val)){ ignored.push({desc:rawDesc, valor:val, reason:"não foi possível interpretar"}); return; }
      out.push({data:year+"-"+mo+"-"+dd,desc:desc,valor:val,categoria:isDivida?"Dívidas":categFromDesc(desc),parcelado:!!pm,parc:parcLabel,metodo:"credito"});
    });
    return {items:out, ignored:ignored, declared:declared};
  }

  function setImp(html){ var el=$("importArea"); if(!el)return; el.innerHTML=html;
    var d=$("impDo"); if(d)d.onclick=function(){importPending(false);};
    var n=$("impNew"); if(n)n.onclick=function(){importPending(true);};
    var c=$("impCancel"); if(c)c.onclick=function(){pendingImport=null;el.innerHTML="";};
  }
  function isPdf(f){return /pdf$/i.test(f.type)||/\.pdf$/i.test(f.name);}
  function isCsv(f){return /csv|tsv/i.test(f.type)||/\.(csv|tsv)$/i.test(f.name);}
  function handleFiles(files){
    var arr=[].slice.call(files), pdfs=arr.filter(isPdf), csvs=arr.filter(isCsv);
    if(!pdfs.length && !csvs.length){ setImp('<p class="note">Selecione arquivos PDF ou CSV.</p>'); return; }
    if(pdfs.length && !ensurePdf()){ setImp('<p class="note">O leitor de PDF ainda está carregando. Tente de novo em alguns segundos.</p>'); return; }
    setImp('<p class="note"><span class="spin"></span>Lendo '+(pdfs.length+csvs.length)+' arquivo(s)…</p>');
    var agg={items:[],ignored:[],declared:[],files:[]}, seq=Promise.resolve();
    arr.forEach(function(f){
      if(!isPdf(f)&&!isCsv(f))return;
      seq=seq.then(function(){
        return (isPdf(f)?parsePdf(f):parseCsv(f)).then(function(r){
          agg.items=agg.items.concat(r.items||[]);
          (r.ignored||[]).forEach(function(x){x.file=f.name;agg.ignored.push(x);});
          (r.declared||[]).forEach(function(dl){agg.declared.push({file:f.name,label:dl.label,value:dl.value});});
          agg.files.push({name:f.name, ok:true, count:(r.items||[]).length, ign:(r.ignored||[]).length});
        }).catch(function(e){
          agg.files.push({name:f.name, ok:false, error:(e&&e.message)||"não foi possível ler o arquivo"});
        });
      });
    });
    seq.then(function(){ pendingImport=agg.items; renderImportReview(agg); });
  }
  // --- CSV ---
  function parseCSVLine(line,d){var out=[],cur="",inq=false;for(var i=0;i<line.length;i++){var ch=line[i];if(inq){if(ch=='"'){if(line[i+1]=='"'){cur+='"';i++;}else inq=false;}else cur+=ch;}else{if(ch=='"')inq=true;else if(ch===d){out.push(cur);cur="";}else cur+=ch;}}out.push(cur);return out;}
  function parseCSVAmount(s){s=(""+s).trim().replace(/[R$\s]/gi,"");if(s===""||s==="-")return NaN;if(s.indexOf(",")>-1&&s.indexOf(".")>-1)s=s.replace(/\./g,"").replace(",",".");else if(s.indexOf(",")>-1)s=s.replace(",",".");return parseFloat(s);}
  function parseCSVDate(s,yh){s=(""+s).trim();var m;
    if(m=s.match(/(\d{4})-(\d{2})-(\d{2})/))return m[1]+"-"+m[2]+"-"+m[3];
    if(m=s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\b/))return m[1]+"-"+("0"+m[2]).slice(-2)+"-"+("0"+m[3]).slice(-2);
    if(m=s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b/)){var y=m[3].length===2?"20"+m[3]:m[3];return y+"-"+("0"+m[2]).slice(-2)+"-"+("0"+m[1]).slice(-2);}
    if(m=s.match(/^(\d{1,2})[\/.](\d{1,2})$/))return (yh||new Date().getFullYear())+"-"+("0"+m[2]).slice(-2)+"-"+("0"+m[1]).slice(-2);
    var M3={jan:1,fev:2,feb:2,mar:3,abr:4,apr:4,mai:5,may:5,jun:6,jul:7,ago:8,aug:8,set:9,sep:9,out:10,oct:10,nov:11,dez:12,dec:12};
    var ns=s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
    if(m=ns.match(/^(\d{1,2})\s*(?:de\s+)?([a-z]{3,})\.?\s*(?:de\s+)?(\d{4})/)){var mi=M3[m[2].slice(0,3)];if(mi)return m[3]+"-"+("0"+mi).slice(-2)+"-"+("0"+m[1]).slice(-2);}
    if(m=ns.match(/^([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/)){var mi=M3[m[1].slice(0,3)];if(mi)return m[3]+"-"+("0"+mi).slice(-2)+"-"+("0"+m[2]).slice(-2);}
    return null;}
  function mapCsvCategory(c){c=(""+c).toLowerCase();if(!c)return null;if(/transporte|mobil|combust|posto|uber|99/.test(c))return "Transporte";if(/restaurante|aliment|comida|bar|lanch|delivery|food/.test(c))return "Delivery & comida fora";if(/supermerc|mercado|grocer/.test(c))return "Mercado";if(/viagem|hotel|hosped|airbnb/.test(c))return "Viagem";if(/compra|eletr[ôo]nic|vestu|loja|shopping|online/.test(c))return "Compras online";if(/servi[çc]o|assinatur|streaming|digital/.test(c))return "Assinaturas & digital";if(/lazer|entreten|cinema|show|evento/.test(c))return "Lazer & eventos";if(/sa[uú]de|farm[aá]cia/.test(c))return "Saúde & farmácia";if(/casa|moradia|util|alug|condom/.test(c))return "Moradia";return null;}
  function mapCols(header,sample){
    var idx={date:-1,amount:-1,desc:-1,cat:-1,parc:-1,pago:-1,metodo:-1};
    header.forEach(function(h,i){
      if(idx.date<0&&/^date$|data/.test(h))idx.date=i;
      if(idx.amount<0&&/amount|valor|value|montante|pre[çc]o/.test(h)&&!/gr[áa]fico/.test(h))idx.amount=i;
      if(idx.cat<0&&/categor/.test(h))idx.cat=i;
      if(idx.desc<0&&/title|t[ií]tulo|descri|estabelec|lan[çc]amento|hist[oó]ric|nome|merchant|gasto|item|produto/.test(h))idx.desc=i;
      if(idx.parc<0&&/parcel|vista|forma de compra/.test(h))idx.parc=i;
      if(idx.pago<0&&(/\bpago\b|quitad|est[áa]\s*pago|^status$/.test(h)))idx.pago=i;
      if(idx.metodo<0&&/(forma|m[eé]todo|modo|m[oó]dulo|meio|tipo)\s*(de\s*)?pagam|pagamento/.test(h)&&!/\bpago\b|parcel|vista/.test(h))idx.metodo=i;
    });
    if(sample){sample.forEach(function(v,i){v=(""+v).trim();if(idx.date<0&&/\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}/.test(v))idx.date=i;if(idx.amount<0&&/^-?r?\$?\d+([.,]\d+)?$/i.test(v.replace(/\s/g,"")))idx.amount=i;});}
    if(idx.desc<0){for(var i=0;i<header.length;i++){if(i!==idx.date&&i!==idx.amount&&i!==idx.cat&&i!==idx.parc&&i!==idx.pago&&i!==idx.metodo){idx.desc=i;break;}}}
    if(idx.date<0)idx.date=0; if(idx.amount<0)idx.amount=header.length-1; if(idx.desc<0)idx.desc=0;
    return idx;
  }
  function readTextSmart(file){
    return file.arrayBuffer().then(function(buf){
      var bytes=new Uint8Array(buf);
      var utf8=new TextDecoder("utf-8").decode(bytes);
      if(utf8.indexOf("\uFFFD")>-1){ try{ return new TextDecoder("iso-8859-1").decode(bytes); }catch(e){ return utf8; } }
      return utf8;
    });
  }
  function parseCsv(file){
    return readTextSmart(file).then(function(txt){
      txt=txt.replace(/^\uFEFF/,"");
      var rows=txt.split(/\r\n|\n|\r/).filter(function(l){return l.trim()!=="";}); if(!rows.length)return {items:[],ignored:[],declared:[],file:file.name};
      var d=(rows[0].split(";").length>rows[0].split(",").length)?";":(rows[0].split("\t").length>rows[0].split(",").length?"\t":",");
      var header=parseCSVLine(rows[0],d).map(function(h){return h.trim().toLowerCase();});
      var hasHeader=header.some(function(h){return /date|data|valor|amount|t[ií]tulo|descri|categor/.test(h);});
      var idx=mapCols(header, hasHeader?null:parseCSVLine(rows[0],d));
      var start=hasHeader?1:0;
      var yh=mostCommon(txt.match(/\b20\d{2}\b/g)||[])||(new Date().getFullYear()+"");
      var out=[], ignored=[];
      for(var i=start;i<rows.length;i++){
        var c=parseCSVLine(rows[i],d); if(!c.length)continue;
        var rawDate=(c[idx.date]||"").trim(), rawVal=(c[idx.amount]||"").trim(), desc=(c[idx.desc]||"").trim(), cat=idx.cat>=0?(c[idx.cat]||"").trim():"";
        var data=parseCSVDate(rawDate,yh), val=parseCSVAmount(rawVal), low=desc.toLowerCase();
        if(!data){ ignored.push({desc:desc||rawDate||("linha "+(i+1)), valor:NaN, reason:"data não reconhecida"+(rawDate?(' ("'+rawDate+'")'):"")}); continue; }
        if(isNaN(val)){ ignored.push({desc:desc||("linha "+(i+1)), valor:NaN, reason:"valor não reconhecido"+(rawVal?(' ("'+rawVal+'")'):"")}); continue; }
        var isDivida=/parcelamento de fatura/.test(low);
        if(!isDivida){
          if(/cr[eé]dito de parcelamento/.test(low)){ ignored.push({desc:desc, valor:val, reason:"crédito de parcelamento (estorno do valor parcelado)"}); continue; }
          if(/pagamento recebido|pagamento em|saldo anterior|fatura anterior/.test(low)){ ignored.push({desc:desc, valor:val, reason:"pagamento/saldo (não é gasto)"}); continue; }
        }
        var pm=desc.match(/parcela\s*(\d+)\s*\/\s*(\d+)/i);
        var parcLabel=pm?(parseInt(pm[1],10)+"/"+parseInt(pm[2],10)):null;
        var d2=desc.replace(/\s*[-–]\s*parcela\s*\d+\s*\/\s*\d+/i,"").replace(/\s*-\s*nupay/i,"").trim()||desc;
        var parcRaw=idx.parc>=0?(""+(c[idx.parc]||"")).trim().toLowerCase():"";
        var pagoRaw=idx.pago>=0?(""+(c[idx.pago]||"")).trim().toLowerCase():"";
        var metRaw=idx.metodo>=0?(""+(c[idx.metodo]||"")).trim():"";
        var isParc=!!pm;
        if(idx.parc>=0){ if(/parcel|vezes|\d+\s*x/.test(parcRaw))isParc=true; else if(/vista|[uú]nic/.test(parcRaw))isParc=false; }
        var pagoVal;
        if(idx.pago>=0){ if(/n[ãa]o|^no$|false|pendente|aberto|a\s*pagar|^0$/.test(pagoRaw))pagoVal=false; else if(/sim|yes|true|pago|quitad|paguei|✓|^x$|^1$/.test(pagoRaw))pagoVal=true; }
        var met=metRaw?normMetodo(metRaw):null;
        var tx={data:data,desc:d2||"Lançamento",valor:val,categoria:isDivida?"Dívidas":(mapCsvCategory(cat)||categFromDesc(d2)),parcelado:isParc,parc:parcLabel};
        if(met)tx.metodo=met; if(pagoVal!==undefined)tx.pago=pagoVal;
        out.push(tx);
      }
      return {items:out, ignored:ignored, declared:[], file:file.name};
    });
  }
  function ignoredBlock(ign){
    return '<p class="note" style="margin:12px 0 2px">Não importados ('+ign.length+')</p><div class="imp-list">'+
      ign.map(function(x){return '<div class="ir"><span class="d">'+escapeHtml(x.desc||"—")+'</span><span class="dt">'+escapeHtml(x.reason)+'</span></div>';}).join("")+'</div>';
  }
  function countDuplicates(items){
    var have={}; state.txs.forEach(function(t){var k=t.data+"|"+t.desc+"|"+t.valor;have[k]=(have[k]||0)+1;});
    var n=0, used={};
    items.forEach(function(t){var k=t.data+"|"+t.desc+"|"+t.valor, cap=have[k]||0, u=used[k]||0; if(u<cap){n++;used[k]=u+1;}});
    return n;
  }
  function renderImportReview(agg){
    var all=agg.items, total=all.reduce(function(a,b){return a+b.valor;},0);
    var fstat=agg.files.map(function(f){ return f.ok
      ? '<div class="imp-row"><span>✓ '+escapeHtml(f.name)+'</span><span>'+f.count+' lançamento'+(f.count===1?"":"s")+(f.ign?' · '+f.ign+' ignorado'+(f.ign===1?"":"s"):"")+'</span></div>'
      : '<div class="imp-row"><span>⚠️ '+escapeHtml(f.name)+'</span><span>'+escapeHtml(f.error)+'</span></div>'; }).join("");
    if(!all.length){
      setImp('<div class="imp-summary">'+fstat+'<div class="imp-err">Nenhum lançamento encontrado. Se o PDF for uma imagem escaneada ou estiver protegido, não há texto pra ler; o CSV pode ter um formato diferente. Você ainda pode adicionar manualmente abaixo.</div>'+(agg.ignored.length?ignoredBlock(agg.ignored):'')+'</div>');
      return;
    }
    var declHtml="", divHtml="";
    if(agg.declared.length){
      var seen={}, decl=agg.declared.filter(function(d){var k=d.label+"|"+d.value;if(seen[k])return false;seen[k]=1;return true;});
      declHtml='<p class="note" style="margin:10px 0 2px">Totais informados na fatura</p>'+decl.map(function(d){return '<div class="imp-row"><span>'+escapeHtml(d.label)+'</span><span>'+money(d.value)+'</span></div>';}).join("");
      var compras=decl.filter(function(d){return /compras/i.test(d.label);})[0];
      if(compras){
        var diff=total-compras.value, ad=Math.abs(diff);
        divHtml='<div class="imp-warn">'+(ad<=0.05
          ? 'A soma dos lançamentos confere com o total de compras da fatura <span class="div-ok">✓</span>'
          : 'Diferença de <b class="div-bad">'+money(diff)+'</b> entre a soma lida ('+money(total)+') e o "Total de compras" da fatura ('+money(compras.value)+'). Em geral vem de estornos, IOF ou parcelamentos de fatura, que não entram como compra. Confira a lista completa abaixo.')+'</div>';
      }
    }
    var dupN=countDuplicates(all);
    var dupHtml=dupN?('<div class="imp-warn">'+dupN+' destes já existem no app. "Importar tudo" vai duplicar — use "Só os novos" se preferir.</div>'):'';
    var listHtml='<p class="note" style="margin:12px 0 2px">Todos os lançamentos lidos ('+all.length+')</p><div class="imp-list">'+
      all.slice().sort(function(a,b){return a.data<b.data?-1:(a.data>b.data?1:0);}).map(function(t){var dd=t.data.split("-");return '<div class="ir"><span class="dt">'+dd[2]+'/'+dd[1]+'</span><span class="d">'+escapeHtml(t.desc)+(t.parcelado?' · parcela':'')+'</span><span class="v'+(t.valor<0?' neg':'')+'">'+money(t.valor)+'</span></div>';}).join("")+'</div>';
    var ignHtml=agg.ignored.length?ignoredBlock(agg.ignored):'';
    setImp('<div class="imp-summary"><div class="big">'+all.length+' lançamentos · '+money(total)+'</div>'+
      fstat+declHtml+divHtml+dupHtml+listHtml+ignHtml+
      '<div class="imp-actions"><button class="btn" id="impDo" type="button">Importar tudo ('+all.length+')</button>'+(dupN?'<button class="btn sec" id="impNew" type="button">Só os novos ('+(all.length-dupN)+')</button>':'')+'<button class="btn sec" id="impCancel" type="button">Cancelar</button></div>'+
      '<p class="note">As categorias são automáticas — depois é só ajustar na lista.</p></div>');
  }
  function importPending(onlyNew){
    if(!pendingImport||!pendingImport.length)return;
    var have={}; if(onlyNew){ state.txs.forEach(function(t){var k=t.data+"|"+t.desc+"|"+t.valor;have[k]=(have[k]||0)+1;}); }
    var added=0, skipped=0, used={}, stamp=Date.now().toString(36);
    pendingImport.forEach(function(t,ix){
      if(onlyNew){ var k=t.data+"|"+t.desc+"|"+t.valor, cap=have[k]||0, u=used[k]||0; if(u<cap){skipped++;used[k]=u+1;return;} used[k]=u+1; }
      var ntx={id:"imp"+stamp+ix+Math.random().toString(36).slice(2,5),data:t.data,desc:t.desc,valor:t.valor,categoria:t.categoria,parcelado:t.parcelado};
      if(t.parc!=null)ntx.parc=t.parc; if(t.metodo)ntx.metodo=t.metodo; if(t.pago!==undefined)ntx.pago=t.pago; if(t.reemb!==undefined)ntx.reemb=t.reemb;
      state.txs.push(ntx); added++;
    });
    var tot=pendingImport.reduce(function(a,b){return a+b.valor;},0);
    save(); buildMonths();
    var mc={}; pendingImport.forEach(function(t){var k=monthKey(t.data);mc[k]=(mc[k]||0)+1;});
    var best=Object.keys(mc).sort(function(a,b){return mc[b]-mc[a];})[0];
    if(best && [].slice.call(elMonth.options).some(function(o){return o.value===best;}))elMonth.value=best;
    render();
    setImp('<div class="imp-summary"><div class="imp-warn" style="background:var(--mint-soft);border-color:rgba(43,185,140,.35);color:var(--mint-ink)">✓ '+added+' lançamento'+(added===1?"":"s")+' importado'+(added===1?"":"s")+(skipped?' · '+skipped+' já existiam (pulados)':'')+' · total '+money(tot)+'. Veja na lista abaixo.</div></div>');
    toast(added+" lançamento"+(added===1?"":"s")+" importado"+(added===1?"":"s")+" ✓");
    pendingImport=null;
  }

  function renderTrends(){
    var el=$("trends"); if(!el)return;
    var nowK=nowMonthKey(), cand={};
    state.txs.forEach(function(t){var k=monthKey(t.data); if(k<=nowK)cand[k]=1;});
    (state.recorrentes||[]).forEach(function(r){
      var si=monthIndex(r.inicio), endI=r.tipo==="parcelado"?si+(r.parcelas||1)-1:monthIndex(nowK);
      endI=Math.min(endI,monthIndex(nowK));
      for(var i=si;i<=endI;i++)cand[keyFromIndex(i)]=1;
    });
    var keys=Object.keys(cand).sort(), bm={};
    keys.forEach(function(m){bm[m]=txsForMonth(m).reduce(function(a,b){return a+b.valor;},0);});
    if(keys.length<2){ el.innerHTML='<div class="panel"><p class="note" style="margin:0">Importe ou registre gastos de pelo menos dois meses pra ver as tendências aqui.</p></div>'; return; }
    var last=keys.slice(-6), max=Math.max.apply(null,last.map(function(k){return bm[k];}));
    var rows=last.map(function(k){var v=bm[k],w=max>0?Math.max(v/max*100,2):0;return '<div class="trend-row"><span class="m">'+monthLabel(k)+'</span><span class="tb"><i style="width:'+w+'%"></i></span><span class="tv">'+money(v)+'</span></div>';}).join("");
    var a=bm[last[last.length-2]], b=bm[last[last.length-1]], diff=b-a, pct=a?Math.round(diff/a*100):0;
    var ins= diff>0 ? '<span class="bad2">↑ '+money(diff)+' a mais</span> que no mês anterior ('+pct+'%).'
                    : '<span class="ok2">↓ '+money(-diff)+' a menos</span> que no mês anterior ('+Math.abs(pct)+'%).';
    el.innerHTML='<div class="panel"><div class="trend">'+rows+'</div><p class="note" style="margin-top:12px">'+ins+'</p></div>';
  }

  // ---- visões estratégicas (termômetro + a pagar) ----
  function diasNoMes(y,m){return new Date(y,m,0).getDate();}
  function callout(tone,emoji,title,msg,bonus){
    return '<div class="insight i-'+tone+'"><div class="i-emoji">'+emoji+'</div><div class="i-body"><div class="i-title">'+title+'</div><div class="i-msg">'+msg+'</div>'+(bonus?'<div class="i-bonus">'+bonus+'</div>':'')+'</div></div>';
  }
  function renderInsights(){
    var el=$("termometro"); if(!el)return;
    var renda=state.renda, gasto=gastoMes(), mk=currentMonth();
    if(renda==null||renda<=0){ el.innerHTML=callout("neutral","🧮","Falta um detalhe","Informe sua renda ali em cima pra eu poder te julgar com precisão (e com carinho)."); return; }
    var tone,emoji,title,msg, r=Math.round(gasto/renda*100);
    var nowKey=new Date().toISOString().slice(0,7), isCur=(mk===nowKey);
    if(gasto<=0){ el.innerHTML=callout("mint","🍃","Tudo quieto por aqui","Nenhum gasto registrado neste mês. Ou você tá rica, ou esqueceu de anotar — vou torcer pela primeira."); return; }
    if(isCur){
      var p=parseInt(mk.split("-")[1],10), y=parseInt(mk.split("-")[0],10), dim=diasNoMes(y,p), dia=new Date().getDate();
      var frac=Math.min(dia/dim,1), ratio=gasto/renda, pace=frac>0?ratio/frac:ratio;
      if(ratio>1){tone="bad";emoji="🆘";title="No vermelho";msg="Você já gastou mais do que ganha este mês. A matemática não tá do seu lado — e a fatura, então, nem se fala.";}
      else if(pace>=1.5&&dia>=4){tone="bad";emoji="🚨";title="Põe o pé no freio, meu bem";msg="Estamos no dia "+dia+" e você já torrou "+r+"% da renda. Viver como se não houvesse amanhã custa caro — e o amanhã, teimoso, sempre chega.";}
      else if(pace>=1.2){tone="bad";emoji="😬";title="Ritmo perigoso";msg="No embalo de hoje, o mês fecha no vermelho. Dinheiro não nasce em árvore — e o Pix não vem com adubo.";}
      else if(pace>=0.85){tone="ok";emoji="⚖️";title="No ritmo do calendário";msg="Equilíbrio raro: você gasta na mesma velocidade que o mês passa. Segura assim que sobra até pra um açaí com tudo em cima.";}
      else if(ratio<0.15&&dia>=10){tone="mint";emoji="🕵️";title="Suspeito demais";msg="Ou você tá disciplinadíssima, ou esqueceu de registrar uns gastos. Vou fingir que é a primeira.";}
      else {tone="mint";emoji="😇";title="Olha a santa";msg="Gastando com calma, no rumo certo. Tá quase virando referência de educação financeira (quase).";}
    } else {
      if(r>100){tone="bad";emoji="🥵";title="Mês no prejuízo";msg="Fechou gastando "+r+"% da renda. Corajosa.";}
      else if(r>=85){tone="bad";emoji="😮‍💨";title="No talo";msg="Apertou no fim — "+r+"% da renda foi embora. Quase sem fôlego.";}
      else if(r>=50){tone="ok";emoji="🙂";title="Mês equilibrado";msg="Gastou "+r+"% da renda e ainda sobrou um respiro.";}
      else {tone="mint";emoji="🏆";title="Mês comportado";msg="Só "+r+"% da renda foi embora. A reserva agradece.";}
    }
    var byCat=totalsByCat(), maxCat="—",maxV=-1; for(var k in byCat){if(byCat[k]>maxV){maxV=byCat[k];maxCat=k;}}
    var bonus= maxV>0? 'Maior vilão do mês: <b>'+maxCat+'</b> ('+money(maxV)+').' : '';
    el.innerHTML=callout(tone,emoji,title,msg,bonus);
  }
  function aPagarQuip(tot,renda){
    if(renda&&tot>renda*0.5) return "Isso é meio salário esperando pra evaporar.";
    if(renda&&tot>renda*0.25) return "Dá pra sentir o boleto respirando no seu pescoço.";
    return "Nada que um Pix bem planejado não resolva.";
  }
  function renderAPagar(){
    var el=$("aPagarCard"); if(!el)return;
    var pend=monthTxs().filter(function(t){return t.pago===false;});
    if(pend.length===0){ el.innerHTML=""; return; }
    var tot=pend.reduce(function(a,b){return a+b.valor;},0);
    el.innerHTML='<div class="apagar"><div class="apagar-top"><span class="apagar-k">A pagar este mês</span><button class="apagar-link" id="goPagar" type="button">ver contas →</button></div>'+
      '<div class="apagar-v num">'+money(tot)+'</div>'+
      '<div class="apagar-sub">'+pend.length+' lançamento'+(pend.length>1?'s':'')+' ainda não quitado'+(pend.length>1?'s':'')+'. '+aPagarQuip(tot,state.renda)+'</div></div>';
    var g=$("goPagar"); if(g) g.onclick=function(){ payFilter=true; var pt=$("payToggle"); if(pt)pt.classList.add("active"); showTab("gastos"); renderList(); };
  }

  // ---- gasto rápido por chat ----
  var chat={step:"idle",draft:null};
  var NUMW={zero:0,um:1,uma:1,dois:2,duas:2,tres:3,"três":3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10,onze:11,doze:12,treze:13,quatorze:14,catorze:14,quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90,cem:100,cento:100,duzentos:200,trezentos:300,quatrocentos:400,quinhentos:500,seiscentos:600,setecentos:700,oitocentos:800,novecentos:900,mil:1000};
  function palavrasParaNumero(text){
    var toks=(""+text).toLowerCase().replace(/[^a-zàáâãéêíóôõúç\s]/g," ").split(/\s+/).filter(Boolean);
    var total=0,cur=0,found=false;
    toks.forEach(function(w){ if(w==="e")return; if(NUMW[w]!=null){found=true;var v=NUMW[w]; if(v===1000){cur=(cur||1)*1000;total+=cur;cur=0;} else cur+=v; } });
    total+=cur; return found?total:null;
  }
  function parseGasto(text){
    var valor=null, num=(""+text).match(/r?\$?\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i);
    if(num){valor=parseCSVAmount(num[1]);} else {valor=palavrasParaNumero(text);}
    var desc=(""+text)
      .replace(/r\$\s*\d[\d.,]*/ig,"").replace(/\d[\d.,]*/g,"")
      .replace(/\b(reais|real|conto|contos|pila|pilas|mangos?|em|no|na|nos|nas|de|do|da|gastei|paguei|comprei|foi|num|numa|um|uma|uns|com|pra|pro|e)\b/ig," ")
      .replace(/\b(zero|um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|trezentos|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos|mil)\b/ig," ")
      .replace(/\s+/g," ").trim();
    return {valor:valor,desc:desc};
  }
  function normMetodo(v){v=(""+v).toLowerCase();if(/pix/.test(v))return "pix";if(/cr[eé]d/.test(v))return "credito";if(/d[eé]b/.test(v))return "debito";if(/dinheiro|cash|esp[eé]cie/.test(v))return "dinheiro";return v;}
  function labelMetodo(m){return {pix:"Pix",credito:"Crédito",debito:"Débito",dinheiro:"Dinheiro"}[m]||m;}
  function cap(s){s=(""+s).trim();return s?s.charAt(0).toUpperCase()+s.slice(1):s;}

  function openChat(){ $("chatOverlay").hidden=false; document.body.style.overflow="hidden"; $("chatMsgs").innerHTML=""; chat.step="start"; chat.draft={valor:null,desc:"",categoria:"Diversos",metodo:null,pago:null,tipo:"unico",parcelas:null};
    botMsg('Manda o gasto — tipo <b>"25 em Uber"</b> ou <b>"paguei 80 no mercado"</b>.'); setChips([]); setTimeout(function(){var c=$("chatText");if(c)c.focus();},120); }
  function closeChat(){ $("chatOverlay").hidden=true; document.body.style.overflow=""; }
  function botMsg(h){var m=$("chatMsgs");m.insertAdjacentHTML("beforeend",'<div class="cmsg bot">'+h+'</div>');m.scrollTop=m.scrollHeight;}
  function userMsg(t){var m=$("chatMsgs");m.insertAdjacentHTML("beforeend",'<div class="cmsg me">'+escapeHtml(t)+'</div>');m.scrollTop=m.scrollHeight;}
  function setChips(arr){var c=$("chatChips");c.innerHTML=arr.map(function(o){return '<button class="chip" type="button" data-v="'+escapeHtml(o.value)+'">'+escapeHtml(o.label)+'</button>';}).join("");Array.prototype.forEach.call(c.querySelectorAll(".chip"),function(b){b.onclick=function(){handleChat(b.getAttribute("data-v"),b.textContent);};});}
  function sendChat(){var i=$("chatText");var v=(i.value||"").trim();if(!v)return;i.value="";handleChat(v,v);}
  function askMetodo(){botMsg('Beleza — <b>'+money(chat.draft.valor)+'</b> em <b>'+escapeHtml(chat.draft.desc)+'</b>. Como você pagou?');setChips([{label:"Pix",value:"pix"},{label:"Crédito",value:"credito"},{label:"Débito",value:"debito"},{label:"Dinheiro",value:"dinheiro"}]);chat.step="metodo";}
  function confirmCateg(){botMsg('Sugeri a categoria <b>'+chat.draft.categoria+'</b>. Tá certo?');setChips([{label:"Confirmar",value:"confirmar"},{label:"Trocar categoria",value:"trocar"}]);chat.step="categoria_confirm";}
  function showCategChips(){botMsg("Escolhe a categoria:");setChips(allCats().map(function(c){return {label:c.n,value:c.n};}));chat.step="categoria_pick";}
  function askTipo(){botMsg("Esse gasto é único, fixo ou parcelado?");setChips([{label:"Único",value:"unico"},{label:"Fixo (todo mês)",value:"fixo"},{label:"Parcelado",value:"parcelado"}]);chat.step="tipo";}
  function finalize(){
    var d=chat.draft;
    if(d.tipo==="fixo"||d.tipo==="parcelado"){
      var now=new Date(), inicio=now.toISOString().slice(0,7), dia=now.getDate();
      var rule={id:"r"+Date.now()+Math.random().toString(36).slice(2,5),desc:d.desc||"Gasto",valor:d.valor,categoria:d.categoria,tipo:d.tipo,inicio:inicio,dia:dia,metodo:d.metodo};
      if(d.tipo==="parcelado")rule.parcelas=d.parcelas||1;
      state.recorrentes=state.recorrentes||[]; state.recorrentes.push(rule);
      save(); buildMonths(); if([].slice.call(elMonth.options).some(function(o){return o.value===inicio;}))elMonth.value=inicio; render();
      var resumo=d.tipo==="fixo"?("fixo de <b>"+money(d.valor)+"/mês</b>"):("parcelado em <b>"+rule.parcelas+"x de "+money(d.valor)+"</b>");
      botMsg('✓ Anotado: '+escapeHtml(d.desc||"Gasto")+' · '+d.categoria+' · '+resumo+'. Já vai aparecer nos próximos meses.');
      setChips([{label:"➕ Adicionar outro",value:"__novo"}]); chat.step="done"; return;
    }
    var hoje=new Date().toISOString().slice(0,10);
    state.txs.push({id:"c"+Date.now()+Math.random().toString(36).slice(2,5),data:hoje,desc:d.desc||"Gasto",valor:d.valor,categoria:d.categoria,parcelado:false,metodo:d.metodo,pago:d.pago});
    save(); buildMonths(); var mk=monthKey(hoje); if([].slice.call(elMonth.options).some(function(o){return o.value===mk;}))elMonth.value=mk; render();
    var tag=(d.metodo?labelMetodo(d.metodo)+" · ":"")+(d.pago?"pago":"a pagar");
    botMsg('✓ Adicionado: <b>'+money(d.valor)+'</b> · '+escapeHtml(d.desc||"Gasto")+' · '+chat.draft.categoria+' · '+tag);
    setChips([{label:"➕ Adicionar outro",value:"__novo"}]); chat.step="done";
  }
  function handleChat(value,display){
    userMsg(display);
    if(chat.step==="done"){ chat.step="start"; chat.draft={valor:null,desc:"",categoria:"Diversos",metodo:null,pago:null,tipo:"unico",parcelas:null}; if(value==="__novo"){botMsg("Manda o próximo gasto.");setChips([]);return;} }
    if(chat.step==="start"||chat.step==="ask_amount"){
      var p=parseGasto(value);
      if(chat.step==="ask_amount"&&(p.valor==null||isNaN(p.valor))){var n=parseCSVAmount(value);if(!isNaN(n))p.valor=n;}
      if(p.valor==null||isNaN(p.valor)||p.valor<=0){botMsg("Não peguei o valor. Quanto foi? (ex.: <b>25</b>)");chat.step="ask_amount";return;}
      chat.draft.valor=p.valor;
      if(p.desc){chat.draft.desc=cap(p.desc);chat.draft.categoria=categFromDesc(p.desc);}
      if(!chat.draft.desc){botMsg('Anotei <b>'+money(p.valor)+'</b>. Foi com o quê? (ex.: Uber, mercado…)');chat.step="ask_desc";return;}
      askMetodo();return;
    }
    if(chat.step==="ask_desc"){chat.draft.desc=cap(value);chat.draft.categoria=categFromDesc(value);askMetodo();return;}
    if(chat.step==="metodo"){chat.draft.metodo=normMetodo(value);if(chat.draft.metodo==="credito"){chat.draft.pago=false;botMsg("No crédito eu já marco como <b>a pagar</b>.");confirmCateg();return;}botMsg("E aí, já está pago?");setChips([{label:"Já paguei",value:"pago"},{label:"Vou pagar",value:"apagar"}]);chat.step="pago";return;}
    if(chat.step==="pago"){chat.draft.pago=/pago|paguei|sim|j[áa]|quitad/i.test(value);confirmCateg();return;}
    if(chat.step==="categoria_confirm"){if(/trocar|mudar|outra|n[ãa]o/i.test(value)){showCategChips();return;}askTipo();return;}
    if(chat.step==="categoria_pick"){if(allCats().some(function(c){return c.n===value;}))chat.draft.categoria=value;askTipo();return;}
    if(chat.step==="tipo"){var tp=/fix/i.test(value)?"fixo":(/parcel/i.test(value)?"parcelado":"unico");chat.draft.tipo=tp;if(tp==="parcelado"){botMsg("Em quantas parcelas?");setChips([{label:"3x",value:"3"},{label:"6x",value:"6"},{label:"10x",value:"10"},{label:"12x",value:"12"}]);chat.step="parcelas";return;}finalize();return;}
    if(chat.step==="parcelas"){var np=parseInt((""+value).replace(/\D/g,""),10);if(!np||np<1){botMsg("Quantas parcelas? (ex.: <b>10</b>)");chat.step="parcelas";return;}chat.draft.parcelas=np;finalize();return;}
  }

  // ---- navegação por abas ----
  var TABS=["inicio","visao","gastos","vales","metas","config"];
  // ---- Vales (VA/VR) ----
  function valeDateBR(d){if(!d)return"";var p=(""+d).split("-");return p.length===3?(p[2]+"/"+p[1]+"/"+p[0].slice(2)):d;}
  function valeBalances(){
    var b={VA:{rec:0,gasto:0,gastoMes:0},VR:{rec:0,gasto:0,gastoMes:0}}, mk=nowMonthKey();
    (state.vales||[]).forEach(function(v){
      var t=b[v.tipo]; if(!t)return;
      if(v.kind==="recarga"){t.rec+=v.valor;} else {t.gasto+=v.valor; if(monthKey(v.data||"")===mk)t.gastoMes+=v.valor;}
    });
    return b;
  }
  function renderVales(){
    var b=valeBalances();
    ["VA","VR"].forEach(function(tp){
      var saldo=b[tp].rec-b[tp].gasto, el=$("saldo"+tp);
      if(el){el.textContent=money(saldo);el.classList.toggle("neg",saldo<0);}
      var sub=$("sub"+tp);
      if(sub){var base=tp==="VA"?"mercado e supermercado":"restaurante e delivery";sub.textContent=base+" · "+money(b[tp].gastoMes)+" gastos este mês";}
    });
    renderValeBreak(); fillVCat();
    var list=$("valeList"); if(!list)return;
    var items=(state.vales||[]).slice().sort(function(a,c){return (""+(c.data||"")).localeCompare(""+(a.data||""));});
    if(valeFilter)items=items.filter(function(v){return v.tipo===valeFilter;});
    var cnt=$("valeCount"); if(cnt)cnt.textContent=items.length?("· "+items.length):"";
    if(!items.length){
      list.className="tx-list is-empty";
      list.innerHTML='<div class="empty-wrap"><div class="empty-art">'+mascot("sad")+'<div class="em-t">Nenhum movimento ainda</div><div class="em-s">Registre a recarga que cai todo mês e os gastos no VA ou VR pra acompanhar o saldo.</div></div></div>';
      return;
    }
    list.className="tx-list";
    list.innerHTML=items.map(function(v){
      var isRec=v.kind==="recarga", sign=isRec?"+ ":"− ";
      var col=isRec?(v.tipo==="VA"?"#7C8A67":"#C65D4E"):valeCatColor(v.tipo,v.cat);
      var meta=isRec?(v.tipo+' · recarga · '+valeDateBR(v.data)):(v.tipo+' · '+escapeHtml(v.cat||"Sem categoria")+' · '+valeDateBR(v.data));
      return '<div class="tx"><span class="dot" style="background:'+col+'"></span><div class="info"><div class="desc">'+escapeHtml(v.desc||(isRec?"Recarga":"Gasto"))+'</div><div class="meta">'+meta+'</div></div><div class="amt'+(isRec?" neg":"")+'">'+sign+money(v.valor)+'</div><button class="del" data-vid="'+v.id+'" aria-label="Remover">×</button></div>';
    }).join("");
  }
  function addVale(){
    var tipo=$("vTipo").value, kind=$("vKind").value, desc=$("vDesc").value.trim(), val=parseNum($("vVal").value), data=$("vData").value;
    if(isNaN(val)||val<=0){$("vVal").focus();return;}
    if(!data)data=new Date().toISOString().slice(0,10);
    if(!desc)desc=(kind==="recarga"?"Recarga":"Gasto")+" "+tipo;
    var cat=(kind==="gasto"&&$("vCat"))?$("vCat").value:null;
    state.vales=state.vales||[];
    var mov={id:"v"+Date.now()+Math.random().toString(36).slice(2,5),tipo:tipo,kind:kind,desc:desc,valor:val,data:data};
    if(cat)mov.cat=cat;
    state.vales.push(mov);
    save(); $("vDesc").value="";$("vVal").value=""; renderVales();
    toast(kind==="recarga"?("Recarga no "+tipo+" registrada ✓"):("Gasto no "+tipo+" registrado ✓"));
    $("vDesc").focus();
  }
  function valeCatsFor(tp){var a=(state.valeCats&&state.valeCats[tp])||[];return a.length?a:["Outros"];}
  function valeCatColor(tp,cat){var a=(state.valeCats&&state.valeCats[tp])||[];var i=a.indexOf(cat);return i>=0?CUSTOM_PALETTE[i%CUSTOM_PALETTE.length]:"#A6A096";}
  function fillVCat(){var sel=$("vCat");if(!sel)return;var tp=$("vTipo")?$("vTipo").value:"VA";var prev=sel.value;var cats=valeCatsFor(tp);sel.innerHTML=cats.map(function(c){return '<option value="'+escapeHtml(c)+'">'+escapeHtml(c)+'</option>';}).join("");if(cats.indexOf(prev)>=0)sel.value=prev;}
  function toggleVKind(){var g=$("vKind")?$("vKind").value==="gasto":true;var w=$("vCatWrap");if(w)w.hidden=!g;}
  function buildValeMonths(){
    var set={}, nowK=nowMonthKey(); set[nowK]=1;
    (state.vales||[]).forEach(function(v){ if(v.kind==="gasto"&&v.data) set[monthKey(v.data)]=1; });
    return Object.keys(set).sort().reverse();
  }
  function renderValeBreak(){
    var host=$("valeBreak");if(!host)return;
    var anyGasto=(state.vales||[]).some(function(v){return v.kind==="gasto";});
    if(!anyGasto){host.innerHTML="";return;}
    var months=buildValeMonths();
    if(!valeBreakMonth||months.indexOf(valeBreakMonth)<0)valeBreakMonth=months[0]||nowMonthKey();
    var mk=valeBreakMonth, agg={VA:{},VR:{}}, tot={VA:0,VR:0};
    (state.vales||[]).forEach(function(v){
      if(v.kind!=="gasto"||monthKey(v.data||"")!==mk||!agg[v.tipo])return;
      var c=v.cat||"Sem categoria";agg[v.tipo][c]=(agg[v.tipo][c]||0)+v.valor;tot[v.tipo]+=v.valor;
    });
    function block(tp,nome){
      if(tot[tp]<=0)return"";
      var rows=Object.keys(agg[tp]).map(function(c){return {c:c,v:agg[tp][c]};}).sort(function(a,b){return b.v-a.v;});
      var max=rows[0].v||1;
      var inner=rows.map(function(r){
        var pct=Math.round(r.v/tot[tp]*100),w=Math.max(4,Math.round(r.v/max*100)),col=valeCatColor(tp,r.c);
        return '<div class="vbreak-row"><div class="vbreak-top"><span class="vbreak-name"><i style="background:'+col+'"></i>'+escapeHtml(r.c)+'</span><span class="vbreak-val">'+money(r.v)+' · '+pct+'%</span></div><div class="vbreak-bar"><i style="width:'+w+'%;background:'+col+'"></i></div></div>';
      }).join("");
      return '<div class="vbreak"><div class="vbreak-h">'+nome+'<span>'+money(tot[tp])+'</span></div>'+inner+'</div>';
    }
    var sel='<select id="valeMonthSel" aria-label="Escolher mês">'+months.map(function(k){return '<option value="'+k+'"'+(k===mk?' selected':'')+'>'+monthLabel(k)+(k===nowMonthKey()?" · este mês":"")+'</option>';}).join("")+'</select>';
    var body=(tot.VA+tot.VR>0)?(block("VA","VA · alimentação")+block("VR","VR · refeição")):'<p class="note" style="margin:8px 0 0">Sem gastos de vale neste mês.</p>';
    host.innerHTML='<div class="panel"><div class="vbreak-head"><div class="phead" style="margin:0">No que foi</div>'+sel+'</div>'+body+'</div>';
    var ms=$("valeMonthSel"); if(ms) ms.onchange=function(){valeBreakMonth=this.value;renderValeBreak();};
  }
  function renderVCatManage(){
    var host=$("vCatBody");if(!host)return;
    function group(tp,nome){
      var chips=valeCatsFor(tp).map(function(c){var col=valeCatColor(tp,c);return '<span class="vchip"><i style="background:'+col+'"></i>'+escapeHtml(c)+'<button data-del-vale="'+tp+'" data-cat="'+escapeHtml(c)+'" type="button" aria-label="Remover">×</button></span>';}).join("");
      return '<div class="vcat-group"><h4>'+nome+'</h4><div class="vcat-chips">'+chips+'</div><div class="vcat-add"><input id="vAdd_'+tp+'" placeholder="Nova categoria (ex.: Lazer, Date especial)"><button data-add-vale="'+tp+'" type="button">Adicionar</button></div></div>';
    }
    host.innerHTML=group("VA","Vale-alimentação")+group("VR","Vale-refeição");
  }
  function addValeCat(tp){
    var inp=$("vAdd_"+tp);if(!inp)return;var name=(inp.value||"").trim();if(!name)return;
    state.valeCats=state.valeCats||{};state.valeCats[tp]=state.valeCats[tp]||[];
    if(state.valeCats[tp].some(function(c){return c.toLowerCase()===name.toLowerCase();})){toast("Essa categoria já existe");return;}
    state.valeCats[tp].push(name);save();renderVCatManage();fillVCat();renderValeBreak();toast("Categoria criada ✓");
  }
  function delValeCat(tp,cat){
    state.valeCats=state.valeCats||{};var a=state.valeCats[tp]||[];
    if(a.length<=1){toast("Deixe ao menos uma categoria");return;}
    state.valeCats[tp]=a.filter(function(c){return c!==cat;});save();renderVCatManage();renderVales();toast("Categoria removida");
  }

  function showTab(t){
    if(TABS.indexOf(t)<0)t="inicio";
    TABS.forEach(function(x){var s=$("tab-"+x);if(s)s.hidden=(x!==t);});
    Array.prototype.forEach.call(document.querySelectorAll(".bottomnav button"),function(b){b.classList.toggle("active",b.getAttribute("data-tab")===t);});
    if(location.hash!=="#"+t){try{history.replaceState(null,"","#"+t);}catch(e){location.hash=t;}}
    window.scrollTo(0,0);
  }

  function bind(){
    elRenda.addEventListener("input",function(){var v=parseNum(elRenda.value);state.renda=isNaN(v)?null:v;save();renderMoney();});
    var tl=$("txList");
    tl.addEventListener("click",function(e){
      var rbAny=e.target.closest&&e.target.closest(".rbtn");
      if(rbAny){
        if(rbAny.hasAttribute("data-recv")){
          var id3=rbAny.getAttribute("data-recv"); var tx3=state.txs.filter(function(t){return t.id===id3;})[0];
          if(tx3){ if(tx3.reembOk){ marcarRecebido(tx3,false); save(); render(); toast("Recebimento desfeito"); } else { openRecvSheet(tx3.id); } }
          return;
        }
        var rid=rbAny.getAttribute("data-rec"); var tx=state.txs.filter(function(t){return t.id===rid;})[0];
        if(tx){ tx.reemb=!tx.reemb; if(!tx.reemb&&tx.reembOk){marcarRecebido(tx,false);} save(); render(); toast(tx.reemb?"Marcado a receber ✓":"Desmarcado"); }
        return;
      }
      var d=e.target.closest&&e.target.closest(".del");if(d){var id=d.getAttribute("data-id");state.txs=state.txs.filter(function(t){return t.id!==id;});save();buildMonths();render();toast("Gasto removido");}
    });
    tl.addEventListener("change",function(e){var s=e.target.closest&&e.target.closest(".cat-sel");if(s){var id=s.getAttribute("data-id"),v=s.value;state.txs.forEach(function(t){if(t.id===id)t.categoria=v;});save();render();}});
    elMonth.addEventListener("change",render);
    var msg=$("monthSelGastos"); if(msg) msg.addEventListener("change",function(){ renderList(); renderEntradasList(); });
    // abrir detalhe ao tocar numa categoria
    var catsBox=$("cats"); if(catsBox) catsBox.addEventListener("click",function(e){
      if(e.target.closest&&(e.target.closest(".cat-meta-edit")||e.target.closest(".cat-del")))return;
      var c=e.target.closest&&e.target.closest("[data-catopen]"); if(c)openCatDetail(c.getAttribute("data-catopen"));
    });
    // sheet "recebido como?"
    var rs=$("recvSheet"); if(rs) rs.addEventListener("click",function(e){
      if(e.target===rs){closeRecvSheet();return;}
      var o=e.target.closest&&e.target.closest("[data-rtipo]");
      if(o){ var tx=state.txs.filter(function(t){return t.id===pendingRecvTx;})[0]; if(tx){ marcarRecebido(tx,true,o.getAttribute("data-rtipo")); save(); render(); toast("Recebido! Virou entrada ✓"); } closeRecvSheet(); }
    });
    var rc=$("recvCancel"); if(rc) rc.addEventListener("click",closeRecvSheet);
    // sheet detalhe de categoria (edição inline)
    var cd=$("catDetail"); if(cd) cd.addEventListener("click",function(e){ if(e.target===cd)closeCatDetail(); });
    var cdc=$("catDetailClose"); if(cdc) cdc.addEventListener("click",closeCatDetail);
    var cdb=$("catDetailBody");
    if(cdb){
      cdb.addEventListener("change",function(e){
        var el=e.target, id=el.getAttribute&&el.getAttribute("data-id"); if(!id)return;
        var tx=state.txs.filter(function(t){return t.id===id;})[0]; if(!tx)return;
        if(el.classList.contains("ce-desc")){ tx.desc=el.value.trim()||tx.desc; save(); render(); }
        else if(el.classList.contains("ce-val")){ var v=parseNum(el.value); if(!isNaN(v)){tx.valor=v;save();render();renderCatDetail();} }
        else if(el.classList.contains("ce-cat")){ tx.categoria=el.value; save(); render(); renderCatDetail(); }
      });
      cdb.addEventListener("click",function(e){
        var d=e.target.closest&&e.target.closest(".ce-del"); if(!d)return;
        var id=d.getAttribute("data-id"); state.txs=state.txs.filter(function(t){return t.id!==id;});
        save(); buildMonths(); render(); renderCatDetail(); toast("Gasto removido");
      });
    }
    $("filterCat").addEventListener("change",renderList);
    $("addBtn").addEventListener("click",addTx);
    var rl=$("reloadBtn"); if(rl) rl.addEventListener("click",function(){buildMonths();render();toast("Atualizado ✓");});
    var ft=$("fTipo"); if(ft) ft.addEventListener("change",toggleParcWrap);
    var rb=$("rulesBox"); if(rb) rb.addEventListener("click",function(e){var d=e.target.closest&&e.target.closest(".del");if(d&&d.getAttribute("data-rid")){var id=d.getAttribute("data-rid");var r=(state.recorrentes||[]).filter(function(x){return x.id===id;})[0];if(r&&confirm('Remover "'+r.desc+'"? Ele deixa de aparecer nos próximos meses.')){state.recorrentes=state.recorrentes.filter(function(x){return x.id!==id;});save();buildMonths();render();toast("Removido ✓");}}});
    $("addPlanoBtn").addEventListener("click",addPlano);
    var cb=$("clearBtn"); if(cb) cb.addEventListener("click",clearAll);
    var pf=$("pdfInput"); if(pf) pf.addEventListener("change",function(e){handleFiles(e.target.files);e.target.value="";});
    var fab=$("fab"); if(fab) fab.addEventListener("click",openChat);
    var cc=$("chatClose"); if(cc) cc.addEventListener("click",closeChat);
    var cs=$("chatSend"); if(cs) cs.addEventListener("click",sendChat);
    var ct=$("chatText"); if(ct) ct.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();sendChat();}});
    var co=$("chatOverlay"); if(co) co.addEventListener("click",function(e){if(e.target===co)closeChat();});
    var pt=$("payToggle"); if(pt) pt.addEventListener("click",function(){payFilter=!payFilter;pt.classList.toggle("active",payFilter);renderList();});
    var rvt=$("recvToggle"); if(rvt) rvt.addEventListener("click",function(){recvFilter=!recvFilter;rvt.classList.toggle("active",recvFilter);renderList();});
    var prt=$("parcToggle"); if(prt) prt.addEventListener("click",function(){parcFilter=!parcFilter;prt.classList.toggle("active",parcFilter);renderList();});
    var sg=$("sugBtn"); if(sg) sg.addEventListener("click",sugerirMetas);
    var ac=$("addCatBtn"); if(ac) ac.addEventListener("click",addCustomCat);
    var ae=$("addEntradaBtn"); if(ae) ae.addEventListener("click",addEntrada);
    var elst=$("entList"); if(elst) elst.addEventListener("click",function(e){var d=e.target.closest&&e.target.closest(".del");if(d&&d.getAttribute("data-eid"))delEntrada(d.getAttribute("data-eid"));});
    var av=$("addValeBtn"); if(av) av.addEventListener("click",addVale);
    var vl=$("valeList"); if(vl) vl.addEventListener("click",function(e){var d=e.target.closest&&e.target.closest(".del");if(d&&d.getAttribute("data-vid")){var id=d.getAttribute("data-vid");state.vales=(state.vales||[]).filter(function(v){return v.id!==id;});save();renderVales();toast("Movimento removido");}});
    var vfa=$("valeFilterVA"); if(vfa) vfa.addEventListener("click",function(){valeFilter=valeFilter==="VA"?null:"VA";vfa.classList.toggle("active",valeFilter==="VA");var o=$("valeFilterVR");if(o)o.classList.remove("active");renderVales();});
    var vfr=$("valeFilterVR"); if(vfr) vfr.addEventListener("click",function(){valeFilter=valeFilter==="VR"?null:"VR";vfr.classList.toggle("active",valeFilter==="VR");var o=$("valeFilterVA");if(o)o.classList.remove("active");renderVales();});
    var vt=$("vTipo"); if(vt) vt.addEventListener("change",fillVCat);
    var vk=$("vKind"); if(vk) vk.addEventListener("change",toggleVKind);
    var vcb=$("vCatBody"); if(vcb){
      vcb.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("[data-add-vale]");if(a){addValeCat(a.getAttribute("data-add-vale"));return;}var d=e.target.closest&&e.target.closest("[data-del-vale]");if(d){delValeCat(d.getAttribute("data-del-vale"),d.getAttribute("data-cat"));}});
      vcb.addEventListener("keydown",function(e){if(e.key==="Enter"){var i=e.target;if(i&&i.id&&i.id.indexOf("vAdd_")===0){e.preventDefault();addValeCat(i.id.slice(5));}}});
    }
    toggleVKind(); renderVCatManage();
    var cf=$("comoFuncionaBtn"); if(cf) cf.addEventListener("click",function(){var s=$("comoFunciona");if(s)s.scrollIntoView({behavior:"smooth",block:"start"});});
    Array.prototype.forEach.call(document.querySelectorAll(".bottomnav button"),function(b){b.addEventListener("click",function(){showTab(b.getAttribute("data-tab"));});});
    Array.prototype.forEach.call(document.querySelectorAll("[data-go]"),function(b){b.addEventListener("click",function(){showTab(b.getAttribute("data-go"));});});
    window.addEventListener("hashchange",function(){showTab((location.hash||"#inicio").slice(1));});
  }
  function addTx(){
    var desc=$("fDesc").value.trim(), val=parseNum($("fVal").value), data=$("fData").value, cat=$("fCat").value, tipo=$("fTipo").value, recv=$("fRecv")&&$("fRecv").checked, met=($("fMetodo")&&$("fMetodo").value)||null;
    if(!desc){$("fDesc").focus();return;} if(isNaN(val)){$("fVal").focus();return;} if(!data)data=new Date().toISOString().slice(0,10);
    if(tipo==="unico"){
      state.txs.push({id:"u"+Date.now()+Math.random().toString(36).slice(2,5),data:data,desc:desc,valor:val,categoria:cat,parcelado:false,reemb:!!recv,metodo:met});
    } else {
      var dia=parseInt(data.split("-")[2],10), inicio=monthKey(data);
      var rule={id:"r"+Date.now()+Math.random().toString(36).slice(2,5),desc:desc,valor:val,categoria:cat,tipo:tipo,inicio:inicio,dia:dia,metodo:met};
      if(tipo==="parcelado"){var np=parseInt($("fParcelas").value,10);if(!np||np<1){$("fParcelas").focus();return;}rule.parcelas=np;}
      state.recorrentes=state.recorrentes||[]; state.recorrentes.push(rule);
    }
    save(); $("fDesc").value="";$("fVal").value="";$("fParcelas").value="";$("fTipo").value="unico";if($("fRecv"))$("fRecv").checked=false;toggleParcWrap(); buildMonths();
    var mk=monthKey(data); if([].slice.call(elMonth.options).some(function(o){return o.value===mk;}))elMonth.value=mk;
    render(); toast(tipo==="unico"?"Gasto adicionado ✓":(tipo==="fixo"?"Gasto fixo cadastrado ✓":"Parcelamento cadastrado ✓")); $("fDesc").focus();
  }
  function toggleParcWrap(){var t=$("fTipo").value,w=$("fParcWrap"),lab=$("fValLab");if(w)w.hidden=(t!=="parcelado");if(lab)lab.textContent=(t==="parcelado")?"Valor de cada parcela (R$)":(t==="fixo"?"Valor por mês (R$)":"Valor (R$)");}
  function addPlano(){
    var nome=$("pNome").value.trim(), val=parseNum($("pVal").value), modo=$("pModo").value;
    if(!nome){$("pNome").focus();return;} if(isNaN(val)){$("pVal").focus();return;}
    state.planos.push({id:"p"+Date.now()+Math.random().toString(36).slice(2,5),nome:nome,emoji:emojiFor(nome),valor:val,modo:modo});
    save(); $("pNome").value="";$("pVal").value=""; render();
  }
  function clearAll(){
    if(!confirm("Isto apaga TODOS os seus lançamentos, metas, categorias, fixos e parcelamentos deste app. Não dá pra desfazer. Continuar?"))return;
    try{
      freshState();
      payFilter=false; var ptg=$("payToggle"); if(ptg)ptg.classList.remove("active");
      recvFilter=false; var rtg=$("recvToggle"); if(rtg)rtg.classList.remove("active");
      parcFilter=false; var prtg=$("parcToggle"); if(prtg)prtg.classList.remove("active");
      var fc=$("filterCat"); if(fc)fc.value="";
      var ft=$("fTipo"); if(ft){ft.value="unico";toggleParcWrap();}
      persistLocal(); save();
      fillCatSelects(); buildMonths(); applyState(); render();
      showTab("inicio");
      toast("Tudo limpo ✓");
    }catch(e){ alert("Não consegui limpar agora. Tente recarregar a página e repetir."); }
  }

  function applyState(){ if(state.renda!=null)elRenda.value=(""+state.renda).replace(".",",");else elRenda.value=""; var t=new Date().toISOString().slice(0,10); $("fData").value=t; var vd=$("vData"); if(vd)vd.value=t; var ed=$("eData"); if(ed)ed.value=t; }

  function boot(){
    fillCatSelects();
    load(function(saved){
      if(saved&&saved.txs){state=saved;normalizeState();} else {freshState();persistLocal();}
      renderAccount(); applyState(); buildMonths(); bind(); render();
      showTab((location.hash||"#inicio").slice(1));
      tryInit(15);
    });
  }
  function tryInit(n){
    if(window.google&&google.accounts&&google.accounts.oauth2){initDrive();}
    else if(n>0){setTimeout(function(){tryInit(n-1);},400);}
    else {setSync(configured?"Google indisponível aqui":"Login não configurado","off");renderAccount();}
  }
  // ---- Gerenciar categorias de gasto (aba Gastos) ----
  function renderGastoCats(){
    var host=$("gastoCatBody"); if(!host)return;
    var chips=allCats().map(function(c){
      var rem=isCustomCat(c.n)?'<button data-delgcat="'+escapeHtml(c.n)+'" type="button" aria-label="Remover">×</button>':'';
      return '<span class="vchip"><i style="background:'+c.c+'"></i>'+escapeHtml(c.n)+rem+'</span>';
    }).join("");
    host.innerHTML='<div class="vcat-group"><div class="vcat-chips">'+chips+'</div>'+
      '<div class="vcat-add"><input id="gAddCat" placeholder="Nova categoria (ex.: Pets, Academia)"><button id="gAddCatBtn" type="button">Adicionar</button></div></div>';
  }
  function addGastoCat(){
    var inp=$("gAddCat"); if(!inp)return; var name=(inp.value||"").trim(); if(!name)return;
    if(allCats().some(function(c){return c.n.toLowerCase()===name.toLowerCase();})){toast("Essa categoria já existe");return;}
    state.customCats=state.customCats||[];
    state.customCats.push({n:name,c:nextCustomColor(),sug:null});
    state.metas[name]=0;
    save(); inp.value=""; fillCatSelects(); render(); toast("Categoria criada ✓");
  }
  (function(){
    var gcb=$("gastoCatBody");
    if(gcb){
      gcb.addEventListener("click",function(e){
        if(e.target.closest&&e.target.closest("#gAddCatBtn")){addGastoCat();return;}
        var d=e.target.closest&&e.target.closest("[data-delgcat]"); if(d){delCustomCat(d.getAttribute("data-delgcat"));}
      });
      gcb.addEventListener("keydown",function(e){if(e.key==="Enter"&&e.target&&e.target.id==="gAddCat"){e.preventDefault();addGastoCat();}});
    }
    var _r=render; render=function(){_r.apply(this,arguments);renderGastoCats();};
  })();

  boot();
})();

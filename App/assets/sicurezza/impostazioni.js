(function(){
  'use strict';
  function avvia(){
    var root=document.getElementById('sicurezzaSettings'),api=window.vault&&window.vault.sicurezza;
    if(!root||!api)return;
    var stato=null,richiesta=0,occupato=false;
    var descrizioni={qpdf:'Verifica la struttura dei PDF prima dell’importazione e della lettura. Gli avvisi recuperabili vengono segnalati; i documenti non verificabili vengono bloccati. Non è un antivirus.',clamav:'Cerca minacce nei PDF sul tuo computer, prima di aprirli o analizzarli. Le firme si aggiornano automaticamente quando usi ZAINO; i documenti non vengono inviati online.'};
    root.innerHTML='<p class="set-note">Questi controlli valgono per tutti gli zaini su questo computer. Installazione e attivazione sono separate. I file originali restano invariati.</p>'+
      ['qpdf','clamav'].map(function(id){var nome=id==='qpdf'?'qpdf · Controllo PDF':'ClamAV · Antivirus';return '<section class="sicurezza-section" aria-labelledby="sicurezzaTitolo-'+id+'"><h3 class="set-sec-h" id="sicurezzaTitolo-'+id+'">'+nome+'</h3><p class="set-note">'+descrizioni[id]+'</p><p class="set-note" id="sicurezzaStato-'+id+'">Lettura dello stato…</p><div class="sicurezza-azioni"><button type="button" class="tbtn" id="sicurezzaInstalla-'+id+'">Installa</button><label><input type="checkbox" id="sicurezzaAttiva-'+id+'" aria-describedby="sicurezzaStato-'+id+'"> Attiva controllo</label></div></section>';}).join('')+
      '<p class="set-note" id="sicurezzaFirme"></p><button type="button" class="tbtn" id="sicurezzaAggiornaFirme">Aggiorna firme</button><p class="set-note">Se un controllo attivo non può essere completato, il PDF viene bloccato con una spiegazione. Le firme antivirus più vecchie di 7 giorni richiedono un aggiornamento. Le protezioni di base di ZAINO restano sempre applicate.</p><p class="set-note" id="sicurezzaProgresso" role="status" aria-live="polite"></p><section class="sicurezza-section"><h3 class="set-sec-h">Ultimo controllo</h3><div id="sicurezzaUltimi" class="set-note">Nessun controllo in questa sessione.</div></section><p class="set-note">Nessun controllo garantisce l’assenza di ogni minaccia. <a href="https://qpdf.readthedocs.io/en/stable/cli.html#option-check" target="_blank" rel="noopener noreferrer">Informazioni qpdf</a> · <a href="https://docs.clamav.net/manual/Usage/Scanning.html" target="_blank" rel="noopener noreferrer">Informazioni ClamAV</a></p>';
    var banner=document.createElement('div');banner.id='sicurezzaControllo';banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');banner.hidden=true;document.body.appendChild(banner);
    function testo(id,value){document.getElementById(id).textContent=value;}
    function progresso(p){
      if(!p)return;
      var fasi={preparazione:'Preparazione dei PDF',qpdf:'Verifica della struttura PDF',clamav:'Scansione antivirus dei PDF'};
      var msg=p.messaggio||p.message||fasi[p.fase]||'';
      if(fasi[p.fase]&&p.totale)msg+=' · '+(p.corrente?p.corrente+' / ':'')+p.totale;
      if(fasi[p.fase]&&p.nome)msg+=' · '+p.nome;
      if(typeof p.percentuale==='number')msg+=' '+p.percentuale+'%';
      testo('sicurezzaProgresso',msg);
      var controllo=!!fasi[p.fase];
      banner.hidden=!controllo;banner.textContent=msg||'Controllo sicurezza PDF…';
      if(p.fase==='completato'&&p.bloccati&&typeof window.toast==='function')window.toast(msg,false);
    }
    function disegna(s){
      if(!s||!s.ok){testo('sicurezzaProgresso',s&&s.error||'Stato della sicurezza non disponibile.');return;}
      stato=s;
      s.motori.forEach(function(m){
        var b=document.getElementById('sicurezzaInstalla-'+m.id),c=document.getElementById('sicurezzaAttiva-'+m.id);
        b.textContent=m.installato?'Reinstalla':'Installa';b.setAttribute('aria-disabled',String(occupato||s.inCorso||!m.disponibile));
        b.title=m.disponibile?'Installa il componente nei dati locali di ZAINO.':m.motivo||'Componente non disponibile.';
        c.checked=!!m.attivo;c.disabled=occupato||s.inCorso||(!m.pronto&&!m.attivo);
        var label=m.operativo?'Attivo':m.attivo?'Attivato · controllo sospeso':m.installato?'Installato · disattivato':'Da installare';
        testo('sicurezzaStato-'+m.id,label+(m.versione?' · '+m.versione:'')+(m.motivo?' — '+m.motivo:''));
      });
      var data=s.firme.aggiornatoAl?new Date(s.firme.aggiornatoAl).toLocaleString('it-IT'):'';
      testo('sicurezzaFirme',s.firme.pronte?'Ultima verifica delle firme: '+data+(s.firme.scadute?' · Da aggiornare':''):'Firme antivirus non ancora disponibili.');
      document.getElementById('sicurezzaAggiornaFirme').setAttribute('aria-disabled',String(occupato||s.inCorso||!s.motori.some(m=>m.id==='clamav'&&m.installato)));
      progresso(s.progress);
      var ultimi=document.getElementById('sicurezzaUltimi');ultimi.replaceChildren();
      if(!s.ultimo){ultimi.textContent='Nessun controllo in questa sessione.';return;}
      var p=document.createElement('p');p.textContent=s.ultimo.totale+' PDF · '+s.ultimo.bloccati+' bloccati · '+s.ultimo.avvisi+' con avvisi';ultimi.appendChild(p);
      s.ultimo.dettagli.forEach(function(d){var r=document.createElement('p');r.textContent=d.file+' — '+(d.error||d.avvisi.join(' '));ultimi.appendChild(r);});
    }
    async function refresh(){var n=++richiesta;try{var s=await api.stato();if(n===richiesta)disegna(s);}catch(e){testo('sicurezzaProgresso',e.message);}}
    async function esegui(fn){
      if(occupato||stato&&stato.inCorso){testo('sicurezzaProgresso','Attendi il completamento dell’operazione in corso.');return;}
      occupato=true;if(stato)disegna(stato);
      var errore='';try{var r=await fn();if(!r||!r.ok)errore=r&&r.error||'Operazione non completata.';}catch(e){errore=e.message;}
      occupato=false;await refresh();if(errore)testo('sicurezzaProgresso',errore);
    }
    ['qpdf','clamav'].forEach(function(id){
      document.getElementById('sicurezzaInstalla-'+id).addEventListener('click',function(){var m=stato&&stato.motori.find(m=>m.id===id);if(!m||!m.disponibile){testo('sicurezzaProgresso',m&&m.motivo||'Pacchetto non incluso in questa versione.');return;}esegui(()=>api.installa(id));});
      document.getElementById('sicurezzaAttiva-'+id).addEventListener('change',function(e){var valore=e.target.checked;esegui(()=>api.attiva(id,valore));});
    });
    document.getElementById('sicurezzaAggiornaFirme').addEventListener('click',function(){if(!stato||!stato.motori.some(m=>m.id==='clamav'&&m.installato)){testo('sicurezzaProgresso','Installa prima ClamAV.');return;}esegui(()=>api.aggiornaFirme());});
    api.onProgress(function(d){if(d.stato)disegna(d.stato);else progresso(d.progress);});
    document.querySelector('[data-tab="sicurezza"]').addEventListener('click',refresh);
    new MutationObserver(function(){if(!document.getElementById('settingsModal').hidden)refresh();}).observe(document.getElementById('settingsModal'),{attributes:true,attributeFilter:['hidden']});
    refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',avvia);else avvia();
})();

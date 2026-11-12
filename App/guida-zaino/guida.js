/* Guida ZAINO — indice navigabile (scrollspy), lightbox, tema, sidebar mobile */
(function(){
  var root = document.documentElement;
  [['#menuBtn','list'],['.lbx','x'],['.lbp','chevron-left'],['.lbn','chevron-right']].forEach(function(v){UiIcone.imposta(document.querySelector(v[0]),v[1]);});


  /* ---- tema chiaro/scuro (ricordato) ---- */
  var salvato = null;
  try { salvato = localStorage.getItem('guida.tema'); } catch(e){}
  if (salvato) root.setAttribute('data-theme', salvato);
  var tt = document.getElementById('temaBtn');
  function iconaTema(){var scuro=root.getAttribute('data-theme')==='scuro';UiIcone.imposta(tt,scuro?'sun':'moon',scuro?'Passa al tema chiaro':'Passa al tema scuro');}
  iconaTema();
  if (tt) tt.addEventListener('click', function(){
    var scuro = root.getAttribute('data-theme') === 'scuro' ||
      (!root.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    var nuovo = scuro ? 'chiaro' : 'scuro';
    root.setAttribute('data-theme', nuovo);
    iconaTema();
    try { localStorage.setItem('guida.tema', nuovo); } catch(e){}
  });

  /* ---- sidebar su schermi stretti ---- */
  var mb = document.getElementById('menuBtn');
  if(mb){mb.setAttribute('aria-controls','toc');mb.setAttribute('aria-expanded','false');}
  if (mb) mb.addEventListener('click', function(){
    root.setAttribute('data-nav', root.getAttribute('data-nav') === 'open' ? '' : 'open');
    mb.setAttribute('aria-expanded',String(root.getAttribute('data-nav')==='open'));
  });
  /* L'indice nasce più sotto: la delega comprende anche i collegamenti creati dopo. */
  document.getElementById('toc').addEventListener('click', function(e){
    if (e.target.closest('a')) {root.setAttribute('data-nav', '');if(mb)mb.setAttribute('aria-expanded','false');}
  });

  /* L’indice usa gli stessi margini che il browser applica ai link con #. */
  var toc = document.getElementById('toc');
  var sezioni = [...document.querySelectorAll('section.cap')];
  var voci = [];
  function voce(target, titolo, elenco, capitolo) {
    var li = document.createElement('li');
    var link = document.createElement('a');
    link.href = '#' + target.id;
    link.textContent = titolo.textContent;
    li.append(link);
    elenco.append(li);
    var voce = {target, li, link, capitolo};
    voci.push(voce);
    return voce;
  }
  sezioni.forEach(function(sec){
    var titolo = sec.querySelector('h2');
    if (!titolo) return;
    var capitolo = voce(sec, titolo, toc, null);
    var titoletti = sec.querySelectorAll('h3[id], h4[id]');
    if (!titoletti.length) return;
    var ul = document.createElement('ul');
    capitolo.li.append(ul);
    var gruppo;
    titoletti.forEach(function(titolo){
      if (titolo.tagName === 'H3') gruppo = voce(titolo, titolo, ul, capitolo);
      else if (gruppo) {
        var figli = gruppo.li.querySelector('ul');
        if (!figli) { figli = document.createElement('ul'); gruppo.li.append(figli); }
        voce(titolo, titolo, figli, gruppo);
      }
    });
  });
  var precedente;
  function evidenzia(attiva){
    if (attiva === precedente) return;
    precedente = attiva;
    voci.forEach(function(v){
      var antenato = attiva;
      while (antenato && antenato !== v) antenato = antenato.capitolo;
      v.li.classList.toggle('attivo', Boolean(antenato));
      if (v === attiva) v.link.setAttribute('aria-current', 'location');
      else v.link.removeAttribute('aria-current');
    });
    if (!attiva) return;
    var sidebar = toc.parentElement;
    var r = attiva.link.getBoundingClientRect();
    var limiti = sidebar.getBoundingClientRect();
    if (limiti.height && (r.top < limiti.top + 12 || r.bottom > limiti.bottom - 12)) {
      sidebar.scrollTop += r.top - limiti.top - (limiti.height - r.height) / 2;
    }
  }
  function accendi(){
    var limite = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    var attiva;
    voci.forEach(function(v){
      var margine = parseFloat(getComputedStyle(v.target).scrollMarginTop) || 0;
      if (v.target.getBoundingClientRect().top <= limite + margine + 3) attiva = v;
    });
    evidenzia(attiva);
  }
  var frame;
  function aggiornaIndice(){
    if (frame) return;
    frame = requestAnimationFrame(function(){ frame = null; accendi(); });
  }
  toc.addEventListener('click', function(e){
    var link = e.target.closest('a');
    var v = voci.find(function(v){ return v.link === link; });
    if (v) evidenzia(v);
  });
  window.addEventListener('scroll', aggiornaIndice, {passive:true});
  window.addEventListener('resize', aggiornaIndice);
  window.addEventListener('hashchange', aggiornaIndice);
  window.addEventListener('load', aggiornaIndice);
  new ResizeObserver(aggiornaIndice).observe(document.querySelector('article'));

  /* ---- schermate, rimandi e gallerie per split ---- */
  var schede = window.GuidaSchermate;
  var lb = document.getElementById('lb');
  var lbImg = lb.querySelector('img');
  var lbCap = lb.querySelector('figcaption');
  var lbLeg = lb.querySelector('.rimandi');
  var lbQuadro = lb.querySelector('.schermata');
  var indietro = lb.querySelector('.lbp');
  var avanti = lb.querySelector('.lbn');
  var attuale, focusPrima;

  function nodo(tag, classe, testo){
    var el = document.createElement(tag);
    if (classe) el.className = classe;
    if (testo) el.textContent = testo;
    return el;
  }
  function rimandi(quadro, legenda, punti){
    quadro.querySelectorAll('.rimando-area').forEach(function(p){ p.remove(); });
    var tela = quadro.querySelector('.schermata-tela');
    if (!tela) {
      tela = nodo('span', 'schermata-tela');
      var img = quadro.querySelector('img');
      img.before(tela); tela.append(img);
    }
    quadro.classList.toggle('ha-rimandi', Boolean(punti?.length));
    legenda.replaceChildren();
    (punti || []).forEach(function(punto){
      var box = punto.box;
      var pin = nodo('span', 'rimando-area');
      pin.style.left = box[0] + '%'; pin.style.top = box[1] + '%';
      pin.style.width = box[2] + '%'; pin.style.height = box[3] + '%';
      if (punto.sotto) pin.classList.add('rimando-sotto');
      if (punto.lato) pin.classList.add('rimando-sinistra');
      pin.setAttribute('aria-hidden', 'true');
      pin.append(nodo('span','numero-rimando',String(punto.numero)));
      tela.append(pin);
      var voce = nodo('li');
      voce.append(nodo('span','numero-rimando',String(punto.numero)),nodo('strong',null,punto.nome),document.createTextNode(' — '+punto.descrizione));
      legenda.append(voce);
    });
    legenda.hidden = !punti?.length;
  }
  function mostra(voce){
    attuale = voce;
    lbImg.src = voce.img.src;
    lbImg.alt = voce.img.alt;
    var posizione = voce.gruppo ? ' · ' + (voce.gruppo.indexOf(voce) + 1) + ' / ' + voce.gruppo.length : '';
    lbCap.textContent = voce.titolo + posizione;
    rimandi(lbQuadro, lbLeg, voce.punti);
    indietro.hidden = avanti.hidden = !voce.gruppo || voce.gruppo.length < 2;
  }
  function apri(voce){
    focusPrima = document.activeElement;
    mostra(voce);
    lb.showModal();
    document.body.classList.add('guida-lightbox');
    lb.querySelector('.lbx').focus();
  }
  function cambiaFoto(delta){
    var gruppo = attuale.gruppo;
    if (gruppo?.length > 1) mostra(gruppo[(gruppo.indexOf(attuale) + delta + gruppo.length) % gruppo.length]);
  }
  function dimensiona(img, percorso){
    var info = schede.immagini[percorso];
    if (info) {
      img.width = info[0];
      img.height = info[1];
    }
  }
  function bottoneSchermata(etichetta){
    var button = nodo('button', 'schermata');
    button.type = 'button';
    button.setAttribute('aria-label', etichetta);
    return button;
  }
  function prepara(figure, img, percorso){
    dimensiona(img, percorso);
    var titolo = figure.querySelector('figcaption')?.textContent.trim() || img.alt;
    var button = bottoneSchermata('Ingrandisci: ' + img.alt);
    img.before(button);
    button.append(img);
    var punti = figure.dataset.rimandi ? JSON.parse(figure.dataset.rimandi) : schede.immagini[percorso]?.[2];
    if (punti) {
      var legenda = nodo('ol', 'rimandi');
      if (!figure.classList.contains('figura-comandi')) figure.append(legenda);
      rimandi(button, legenda, punti);
    }
    button.addEventListener('click', function(){ apri({img, titolo, punti}); });
  }
  document.querySelectorAll('article figure img').forEach(function(img){
    prepara(img.closest('figure'), img, img.getAttribute('src').split('?')[0]);
  });
  var movimentoRidotto = matchMedia('(prefers-reduced-motion: reduce)');
  var anteprime = [];
  Object.entries(schede.gallerie).forEach(function([id, foto]){
    var titolo = document.getElementById(id);
    if (!titolo) return;
    var ciclo = ['esempio-laser','esempio-box','esempio-cerchio'].includes(id);
    var regione = nodo('div', 'galleria');
    regione.setAttribute('role', 'region');
    regione.setAttribute('aria-label', 'Schermate: ' + titolo.textContent);
    var figura = nodo('figure');
    var pulsante = bottoneSchermata('Apri la galleria: '+titolo.textContent+' ('+foto.length+' schermate)');
    var album = [], corrente = 0;
    foto.forEach(function([src, etichetta], n){
      var img = document.createElement('img');
      img.loading = ciclo ? 'eager' : 'lazy';
      img.hidden = n !== 0;
      img.src = src + (src.includes('?') ? '&' : '?') + 'v=2026111215';
      img.alt = etichetta;
      dimensiona(img, src.split('?')[0]);
      pulsante.append(img);
      album.push({img, titolo:etichetta, gruppo:album});
    });
    pulsante.addEventListener('click', function(){ apri(album[corrente]); });
    figura.append(pulsante);
    regione.append(figura);
    if (titolo.nextElementSibling?.tagName === 'P') titolo.nextElementSibling.after(regione);
    else titolo.after(regione);
    if (ciclo) anteprime.push(function(){
      var vista = regione.getBoundingClientRect();
      if (vista.bottom <= 0 || vista.top >= innerHeight || pulsante.matches(':focus-visible')) return;
      var prossimo = (corrente + 1) % album.length;
      if (!album[prossimo].img.complete || !album[prossimo].img.naturalWidth) return;
      album[corrente].img.hidden = true;
      album[prossimo].img.hidden = false;
      corrente = prossimo;
    });
  });
  if (anteprime.length) setInterval(function(){
    if (lb.open || document.hidden || movimentoRidotto.matches) return;
    anteprime.forEach(function(avanza){ avanza(); });
  }, 750);
  accendi();

  lb.addEventListener('click', function(e){ if (e.target === lb) lb.close(); });
  lb.querySelector('.lbx').addEventListener('click', function(){ lb.close(); });
  lb.addEventListener('close', function(){
    document.body.classList.remove('guida-lightbox');
    focusPrima?.focus({preventScroll:true});
  });
  indietro.addEventListener('click', function(){ cambiaFoto(-1); });
  avanti.addEventListener('click', function(){ cambiaFoto(1); });
  lb.addEventListener('keydown', function(e){
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      cambiaFoto(e.key === 'ArrowLeft' ? -1 : 1);
    }
  });
})();

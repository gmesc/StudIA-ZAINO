/* Il DOM è già prodotto dal parser di APPUNTI: non esiste una seconda grammatica
 * Markdown per Word. Qui si raccolgono contenuto, colori e immagini risolte. */
(function(root){
  'use strict';
  async function leggi(elemento,opt){
    const doc=elemento.ownerDocument,win=doc.defaultView,attese=[],avvisi=new Set();
    function colore(css){
      const canvas=doc.createElement('canvas'),ctx=canvas.getContext('2d');
      ctx.fillStyle='#111111';ctx.fillStyle=css||'#111111';ctx.fillRect(0,0,1,1);
      return Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3).map(x=>x.toString(16).padStart(2,'0')).join('');
    }
    async function immagine(src,n,icona){
      const img=new win.Image();
      await new Promise((resolve,reject)=>{
        const timer=win.setTimeout(()=>{img.src='';reject(Error('Tempo scaduto caricando l’immagine: '+n.alt));},15000);
        img.onload=()=>{win.clearTimeout(timer);resolve();};
        img.onerror=()=>{win.clearTimeout(timer);reject(Error('Immagine non disponibile: '+n.alt));};
        img.src=src;
      });
      const scala=Math.min(1,3200/img.naturalWidth,3200/img.naturalHeight);
      const canvas=doc.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scala));canvas.height=Math.max(1,Math.round(img.naturalHeight*scala));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      n.dati=canvas.toDataURL('image/png');n.larghezza=icona?16:canvas.width;n.altezza=icona?16:canvas.height;
      if(/\.gif(?:[?#]|$)|^data:image\/gif/i.test(src))avvisi.add('Le GIF sono esportate come immagini statiche.');
    }
    function visita(el){
      if(el.nodeType===3)return {tag:'#text',testo:el.nodeValue};
      if(el.nodeType!==1)return null;
      const tag=el.tagName.toLowerCase(),cl=el.classList,st=win.getComputedStyle(el);
      if(cl.contains('figmanca'))throw Error(el.textContent||'Immagine non disponibile.');
      if(['script','style'].includes(tag))return null;
      let n={tag:tag,figli:[]};
      if(cl.contains('ucallout')){n.tag='callout';n.colore=colore(st.borderLeftColor);}
      if(cl.contains('uc-head')){n.tag='p';n.testata=true;n.colore=colore(st.color);}
      if(cl.contains('figura'))n.tag='figura';
      if(cl.contains('figcap')){n.tag='p';n.didascalia=true;}
      if(tag==='mark'){n.colore=colore(st.getPropertyValue('--ev')||'#fff09b');n.tratto=el.dataset.tratto||'overlay';n.postilla=el.dataset.postilla?el.title:'';}
      if(tag==='ol')n.inizio=+el.getAttribute('start')||1;
      if(tag==='ul'||tag==='ol'){n.livello=0;for(let p=el.parentElement;p&&p!==elemento;p=p.parentElement)if(['UL','OL'].includes(p.tagName))n.livello++;}
      if(tag==='td'||tag==='th'){n.colspan=el.colSpan;n.rowspan=el.rowSpan;}
      if(tag==='a'){
        n.href=el.getAttribute('href')||'';
        const rif=opt.riferimento&&opt.riferimento(el);
        if(rif&&typeof rif.then==='function')attese.push(rif.then(v=>{n.riferimento=v||'';}));else n.riferimento=rif||'';
      }
      if(tag==='img'||tag==='svg'){
        n.tag='img';n.alt=el.getAttribute('alt')||el.getAttribute('aria-label')||'Immagine';
        const figura=el.closest('.figura');n.percento=figura?parseFloat(figura.style.getPropertyValue('--figw'))||100:100;
        let src=el.getAttribute('src');
        if(tag==='svg'){
          const copia=el.cloneNode(true);copia.setAttribute('xmlns','http://www.w3.org/2000/svg');copia.setAttribute('width','24');copia.setAttribute('height','24');
          src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new win.XMLSerializer().serializeToString(copia).replace(/currentColor/g,st.color));
        }
        if(!src)throw Error('Immagine senza sorgente: '+n.alt);
        attese.push(immagine(src,n,tag==='svg'));return n;
      }
      n.figli=Array.from(el.childNodes).map(visita).filter(Boolean);
      if(n.testata&&n.figli.length>1)n.figli.splice(1,0,{tag:'#text',testo:' '});
      return n;
    }
    const albero={tag:'root',figli:Array.from(elemento.childNodes).map(visita).filter(Boolean)};
    await Promise.all(attese);return {albero:albero,avvisi:Array.from(avvisi)};
  }
  root.AppuntiExportDOM={leggi:leggi};
}(window));

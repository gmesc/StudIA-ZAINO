'use strict';
// Nessuna lettura di file e nessuna rete: tutte le immagini arrivano incorporate.
const D=require('docx');
const M=require('../App/assets/appunti/documento');
const Carta=require('../App/assets/stampa/foglio');
const corpo=Carta.formato('testo').pt*2,linea=Math.round(Carta.formato('testo').interlinea*240);
const senzaBordi=()=>Object.fromEntries(['top','bottom','left','right','insideHorizontal','insideVertical'].map(k=>[k,{style:D.BorderStyle.NONE}]));
const LARGHEZZA=9638; // A4, margini laterali di 20 mm, come il PDF.
const px=LARGHEZZA/15;
const numero=(v,min,max,def)=>Number.isFinite(+v)?Math.min(max,Math.max(min,+v)):def;
async function crea(dati){
  M.valida(dati);
  const numerazioni=[];
  function stileRun(s={}){
    return { ...(s.font?{font:String(s.font).slice(0,100)}:{}),...(s.size?{size:numero(s.size,8,100,17)*1.5}:{}),...(s.color?{color:M.colore(s.color)}:{}),...(s.background?{shading:{fill:M.colore(s.background)}}:{}),...(s.bold!==undefined?{bold:!!s.bold}:{}),...(s.italic!==undefined?{italics:!!s.italic}:{}),...(s.underline?{underline:{}}:{}) };
  }
  function inline(n,stile={},larghezza=px){
    if(n.tag==='#text')return [new D.TextRun({...stile,text:n.testo})];
    let s={...stile,...stileRun(n.stile)};
    if(n.testata){s.bold=true;s.size=22;s.allCaps=true;}
    if(['strong','b'].includes(n.tag))s.bold=true;
    if(['em','i'].includes(n.tag))s.italics=true;
    if(n.tag==='u')s.underline={};
    if(['s','del'].includes(n.tag))s.strike=true;
    if(n.tag==='sup')s.superScript=true;
    if(n.tag==='sub')s.subScript=true;
    if(n.tag==='code'){s.font='Courier New';s.shading={fill:'F3F4F6'};}
    if(n.colore)s.color=M.colore(n.colore);
    if(n.tag==='mark'){
      if(n.tratto==='sotto')s.underline={type:D.UnderlineType.SINGLE,color:M.colore(n.colore,'EAB308')};
      else s.shading={fill:M.colore(n.colore,'FFF09B')};
      s.color='111111';
    }
    if(n.tag==='br')return [new D.TextRun({...s,break:1})];
    if(n.tag==='img'){
      const data=Buffer.from(n.dati.split(',')[1],'base64');
      if(data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Immagine PNG non valida.');
      const max=larghezza*numero(n.percento,1,100,100)/100;
      const fattore=Math.min(1,max/n.larghezza,850/n.altezza);
      return [new D.ImageRun({type:'png',data,transformation:{width:Math.round(n.larghezza*fattore),height:Math.round(n.altezza*fattore)},altText:{title:n.alt||'',description:n.alt||'',name:n.alt||'Immagine'}})];
    }
    let figli=n.figli.flatMap(f=>inline(f,s,larghezza));
    if(n.tag==='a'&&/^https?:\/\//i.test(n.href||''))figli=[new D.ExternalHyperlink({link:n.href,children:figli})];
    if(n.riferimento)figli.push(new D.TextRun({text:' [Fonte: '+n.riferimento+']',size:18,color:'555555'}));
    if(n.postilla)figli.push(new D.TextRun({text:' ('+n.postilla+')',size:18,italics:true}));
    return figli;
  }
  function paragrafo(figli,opt={}){return new D.Paragraph({spacing:{after:140,line:linea},...opt,children:figli});}
  const blocco=n=>/^(p|h[1-6]|div|pre|blockquote|ul|ol|table|hr|callout|figura)$/.test(n.tag);
  function gruppo(figli,opt={}){
    const out=[];let riga=[],prima=true;
    function opzioni(){const o={...opt};if(!prima&&o.numbering){delete o.numbering;o.indent={left:360};}prima=false;return o;}
    function scarica(){if(riga.length){out.push(paragrafo(riga,opzioni()));riga=[];}}
    for(const n of figli){if(blocco(n)){scarica();out.push(...blocchi(n,opzioni()));}else riga.push(...inline(n,opt.run||{},opt.larghezza));}
    scarica();return out;
  }
  function blocchi(n,opt={}){
    if(n.tag==='root'||n.tag==='div')return gruppo(n.figli,opt);
    if(n.tag==='callout'){
      const col=M.colore(n.colore,'0F766E');
      const children=gruppo(n.figli,{larghezza:px-24});if(!children.length)children.push(paragrafo([]));
      if(children[children.length-1] instanceof D.Table)children.push(paragrafo([]));
      return [new D.Table({width:{size:LARGHEZZA,type:D.WidthType.DXA},layout:D.TableLayoutType.FIXED,borders:senzaBordi(),columnWidths:[LARGHEZZA],rows:[new D.TableRow({children:[new D.TableCell({children,width:{size:LARGHEZZA,type:D.WidthType.DXA},shading:{fill:M.carta(col)},margins:{top:140,bottom:100,left:180,right:180},borders:{top:{style:D.BorderStyle.NONE},bottom:{style:D.BorderStyle.NONE},right:{style:D.BorderStyle.NONE},left:{style:D.BorderStyle.SINGLE,size:24,color:col}}})]})]}),paragrafo([],{spacing:{after:100,line:80}})];
    }
    if(n.tag==='ul'||n.tag==='ol'){
      const ref='elenco-'+numerazioni.length;
      numerazioni.push({reference:ref,levels:Array.from({length:9},(_,level)=>({level,format:n.tag==='ol'?D.LevelFormat.DECIMAL:D.LevelFormat.BULLET,text:n.tag==='ol'?'%'+(level+1)+'.':'•',start:numero(n.inizio,1,32767,1),alignment:D.AlignmentType.LEFT,style:{paragraph:{indent:{left:360*(level+1),hanging:240}}}}))});
      const out=[];
      for(const li of n.figli.filter(f=>f.tag==='li')){
        const parti=gruppo(li.figli,{...opt,numbering:{reference:ref,level:numero(n.livello,0,8,0)}});
        // Solo il primo paragrafo della voce porta il numero, gli altri sono continuazioni.
        out.push(...(parti.length?parti:[paragrafo([],{numbering:{reference:ref,level:0}})]));
      }
      return out;
    }
    if(n.tag==='table'){
      const righe=[];
      function raccogli(x){if(x.tag==='tr')righe.push(x);else (x.figli||[]).forEach(raccogli);}
      raccogli(n);
      if(!righe.length)return [];
      const colonne=Math.max(...righe.map(r=>r.figli.filter(c=>['td','th'].includes(c.tag)).reduce((a,c)=>a+numero(c.colspan,1,100,1),0)));
      return [new D.Table({width:{size:100,type:D.WidthType.PERCENTAGE},layout:D.TableLayoutType.FIXED,columnWidths:Array(colonne).fill(Math.round(LARGHEZZA/colonne)),rows:righe.map(r=>new D.TableRow({tableHeader:r.figli.some(c=>c.tag==='th'),children:r.figli.filter(c=>['td','th'].includes(c.tag)).map(c=>{
        const st={...(n.stile||{}),...(c.stile||{})};
        const children=gruppo(c.figli,{larghezza:Math.max(24,px/colonne*numero(c.colspan,1,100,1)-14),run:stileRun(st),alignment:['left','center','right'].includes(st.align)?st.align:undefined});if(!children.length||children[children.length-1] instanceof D.Table)children.push(paragrafo([]));
        return new D.TableCell({children,columnSpan:numero(c.colspan,1,100,1),rowSpan:numero(c.rowspan,1,100,1),shading:st.background?{fill:M.colore(st.background)}:c.tag==='th'?{fill:'F1F5F9'}:undefined,borders:st.borderColor?{bottom:{style:D.BorderStyle.SINGLE,size:6,color:M.colore(st.borderColor)}}:undefined,margins:{top:90,bottom:90,left:100,right:100}});
      })}))}),paragrafo([])];
    }
    if(n.tag==='blockquote')return gruppo(n.figli,{...opt,indent:{left:360},border:{left:{color:'A0A0A0',style:D.BorderStyle.SINGLE,size:12,space:8}}});
    if(n.tag==='hr')return [paragrafo([],{border:{bottom:{color:'CCCCCC',style:D.BorderStyle.SINGLE,size:4}}})];
    if(n.tag==='pre')return [paragrafo([...M.testo(n).split('\n').map((t,i)=>new D.TextRun({text:t,break:i?1:0,font:'Courier New',size:20}))],{shading:{fill:'F3F4F6'},spacing:{after:160,line:264}})];
    if(n.tag==='figura')return gruppo(n.figli,{...opt,alignment:D.AlignmentType.CENTER});
    if(/^h[1-6]$/.test(n.tag))return [paragrafo(inline(n),{heading:D.HeadingLevel['HEADING_'+n.tag[1]],keepNext:true})];
    // Le figure possono stare dentro un <p> nel dialetto degli appunti.
    if(n.figli.some(blocco))return gruppo(n.figli,opt);
    return [paragrafo(inline(n,opt.run||{},opt.larghezza),{...opt,...(n.didascalia?{alignment:D.AlignmentType.CENTER,style:'Didascalia'}:{}),...(n.testata?{keepNext:true}:{} )})];
  }
  const children=blocchi(dati.albero);
  const footer=new D.Footer({children:[new D.Table({width:{size:100,type:D.WidthType.PERCENTAGE},columnWidths:[7200,LARGHEZZA-7200],borders:senzaBordi(),rows:[new D.TableRow({children:[
    new D.TableCell({children:[paragrafo([new D.TextRun({text:dati.titolo,size:corpo*Carta.SCALA.pie,color:'666666'})],{spacing:{after:0}})],width:{size:7200,type:D.WidthType.DXA}}),
    new D.TableCell({children:[paragrafo([new D.TextRun({children:['pagina ',D.PageNumber.CURRENT,' di ',D.PageNumber.TOTAL_PAGES],size:corpo*Carta.SCALA.pie,color:'666666'})],{alignment:D.AlignmentType.RIGHT,spacing:{after:0}})],width:{size:LARGHEZZA-7200,type:D.WidthType.DXA}})
  ]})]})]});
  const documento=new D.Document({creator:'ZAINO',title:dati.titolo,features:{updateFields:true},styles:{default:{document:{run:{font:typeof dati.font==='string'?dati.font.slice(0,100):'Arial',size:corpo,color:'111111'},paragraph:{spacing:{line:linea,after:140}}}},paragraphStyles:[...Array.from({length:6},(_,i)=>({id:'Heading'+(i+1),name:'Heading '+(i+1),basedOn:'Normal',next:'Normal',run:{font:typeof dati.font==='string'?dati.font.slice(0,100):'Arial',bold:true,color:'111111',size:Math.round(corpo*Carta.SCALA['h'+(i+1)])},paragraph:{spacing:{before:240,after:140},keepNext:true,outlineLevel:i}})),{id:'Didascalia',name:'Didascalia',basedOn:'Normal',run:{size:18,color:'555555'}}]},numbering:{config:numerazioni},sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1417,left:1134,right:1134,footer:567}}},footers:{default:footer},children:children.length?children:[paragrafo([])]}]});
  return D.Packer.toBuffer(documento);
}
module.exports={crea};

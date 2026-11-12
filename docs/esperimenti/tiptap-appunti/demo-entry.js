import {Editor,Node} from '@tiptap/core';
import {StarterKit} from '@tiptap/starter-kit';
import {Markdown,MarkdownManager} from '@tiptap/markdown';
// Il prototipo non fa passare sintassi ZAINO sconosciute nel serializer standard.
// Questi nodi atomici conservano il sorgente; la loro edizione visuale è un passo successivo.
const Conservato=Node.create({
 name:'zainoConservato',group:'block',atom:true,
 addAttributes(){return {source:{default:''}};},
 parseHTML(){return [{tag:'pre[data-conservato]'}];},
 renderHTML({node}){return ['pre',{'data-conservato':'',contenteditable:'false'},node.attrs.source];},
 renderMarkdown(node){return node.attrs.source;},
});
const esempi=[
 ['# Biologia\n\nLa **fotosintesi** converte la luce in energia.\n\n## Le fasi\n\n- Assorbimento della luce\n- Produzione di zuccheri',
  '> [!nota] Da ricordare\n> La clorofilla assorbe la luce.',
  '[Fonte](zaino-pdf:biologia/01#p=2)',
  '![Foglia|93%](album:abcdef123456)\n<!-- zaino-figura {"id":"prova","larghezza":93} -->'],
 ['# Storia\n\nUn secondo appunto indipendente.\n\n## Cronologia\n\nSeleziona il testo e prova il **grassetto**.','Vedi [[rivoluzione-industriale]].'],
];
const bozze=new Map();let attivo=0,editor;
const stile=document.getElementById('stile');
for(let n=0;n<=6;n++){const o=document.createElement('option');o.value=n;o.textContent=n?'#'.repeat(n)+' '+(n===1?'Titolo':'Sottotitolo '+(n-1)):'¶ Testo';stile.append(o);}
function aggiorna(){
 document.getElementById('sorgente').value=editor.getMarkdown();
 stile.value=String(editor.getAttributes('heading').level||0);
 for(const b of document.querySelectorAll('[data-cmd]'))if(['toggleBold','toggleItalic','toggleBulletList'].includes(b.dataset.cmd))b.setAttribute('aria-pressed',String(editor.isActive({toggleBold:'bold',toggleItalic:'italic',toggleBulletList:'bulletList'}[b.dataset.cmd])));
}
function apri(n){
 if(editor){bozze.set(attivo,editor.getJSON());editor.destroy();}
 attivo=n;
 const extensions=[StarterKit.configure({link:{openOnClick:false}}),Markdown,Conservato];
 const parser=new MarkdownManager({extensions});
 const content=bozze.get(n)||{type:'doc',content:[...parser.parse(esempi[n][0]).content,...esempi[n].slice(1).map(source=>({type:'zainoConservato',attrs:{source}})),{type:'paragraph'}]};
 editor=new Editor({element:document.getElementById('editor'),extensions,content,onUpdate:aggiorna,onSelectionUpdate:()=>editor&&aggiorna()});
 aggiorna();
 document.getElementById('stato').textContent='Appunto di esempio '+(n+1)+' di 2.';
}
stile.onchange=()=>{const n=Number(stile.value),chain=editor.chain().focus();n?chain.setHeading({level:n}).run():chain.setParagraph().run();aggiorna();};
for(const b of document.querySelectorAll('[data-cmd]'))b.onclick=()=>{editor.chain().focus()[b.dataset.cmd]().run();aggiorna();};
document.getElementById('documento').onchange=e=>apri(Number(e.target.value));
apri(0);
// Accesso riservato alla prova automatica del laboratorio; nessuna API verso il vault.
window.LaboratorioAppunti={get editor(){return editor;},apri,esempi};

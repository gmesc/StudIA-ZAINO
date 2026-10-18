'use strict';
// La campagna completa e le riprese mirate condividono gli stessi numeri della guida.
async function barra(L,nome,host,selettori){
 const r=await L.rect(host);if(r.h>50)throw Error('Allarga il blocco: la barra numerata deve stare su una riga.');await L.banda(r,{altezza:36});
 await L.numeri(selettori.map((sel,i)=>({sel,n:i+1,dove:'b'})),{filo:r.y+r.h+6});
 await L.scatta(nome,{clip:{x:r.x,y:r.y-2,width:r.w,height:r.h+38},scala:3});await L.overlayPulisci();
}
exports.appunti=L=>barra(L,'50-notebar-numerata','#noteHost .editor-toolbar',[
 '#noteHost .notectl .tendina','#noteNew','#noteSave','#noteRen','#noteDel','#noteHost .ncb-undo','#noteHost .ncb-redo',
 ...['bold','italic','heading','quote','unordered-list','ordered-list','ncb-callout','ncb-emoji','ncb-cita','ncb-mat','link','code','preview','side-by-side','ncb-guida'].map(s=>'#noteHost .editor-toolbar button.'+s),
 '#noteStampa','#notePdf','#noteClose'
]);
exports.mappa=L=>barra(L,'68-mappabar-numerata','#mappaView .mtoolbar',[
 '#mappaView .tendina.piccola','#mNuova','#mRinomina','#mCestino','#mAnnulla','#mRipeti','#mMemorie','#mOrient','#mVista','#mStampa','#mPdf','#mAdatta','#mChiudi'
]);

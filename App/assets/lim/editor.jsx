// Unica isola React: il resto dell'app conserva i moduli e le barre esistenti.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Excalidraw,MainMenu,newElementWith,convertToExcalidrawElements,CaptureUpdateAction,restoreElements,reconcileElements,exportToCanvas,exportToSvg,exportToBlob,loadFromBlob} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
window.LimEditor={monta(host,opts){
 let api,vivo=true,inApertura=false;const root=createRoot(host);
 function palette(stato){
  const tipo={elementStroke:'tratto',elementBackground:'fondo',canvasBackground:'foglio'}[stato.openPopup];if(!tipo||inApertura)return;
  inApertura=true;
  requestAnimationFrame(()=>{
   inApertura=false;if(!vivo)return;
   const ancora=host.querySelector('.color-picker-container .active-color[aria-expanded="true"]')||host;
   const nome={tratto:'Tratto e testo',fondo:'Riempimento',foglio:'Sfondo del disegno'}[tipo];
   const chiave=tipo==='tratto'?'strokeColor':'backgroundColor',elementi=api.getSceneElements(),sel=elementi.find(e=>stato.selectedElementIds[e.id]);
   const valore=tipo==='foglio'?stato.viewBackgroundColor:sel?.[chiave]||stato[tipo==='tratto'?'currentItemStrokeColor':'currentItemBackgroundColor'];
   api.updateScene({appState:{openPopup:null},captureUpdate:CaptureUpdateAction.NEVER});
   ZainoPalette.apri({ancora,nome,valore:valore==='transparent'?'none':valore,nessuno:'Trasparente',valido:()=>vivo,onSelect:v=>api.updateScene({...LimModello.colora(api.getSceneElementsIncludingDeleted(),stato,tipo,v==='none'?'transparent':v,newElementWith),captureUpdate:CaptureUpdateAction.IMMEDIATELY})});
  });
 }
 function Editor(){
  const [sfondo,setSfondo]=React.useState(opts.data?.appState?.viewBackgroundColor);
  React.useEffect(()=>{
   // Il menu nativo ragiona sulla finestra; dentro uno split deve restare nella tela.
   let frame;const riposiziona=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
    const r=host.getBoundingClientRect(),scala=r.width/host.offsetWidth||1,left=Math.max(0,r.left)+8,top=Math.max(0,r.top)+8,right=Math.min(innerWidth,r.right)-8,bottom=Math.min(innerHeight,r.bottom)-8;
    for(const menu of host.querySelectorAll('.context-menu')){
     const pop=menu.parentElement;pop.style.width='max-content';pop.style.minWidth=Math.ceil(Math.max(0,Math.min(190,right-left))/scala)+'px';pop.style.maxWidth=Math.max(0,right-left)/scala+'px';pop.style.maxHeight=Math.max(0,bottom-top)/scala+'px';pop.style.overflow='auto';
     const b=pop.getBoundingClientRect(),dx=Math.max(left-b.left,Math.min(0,right-b.right)),dy=Math.max(top-b.top,Math.min(0,bottom-b.bottom));
     // getBoundingClientRect usa pixel visibili; gli offset restano nelle coordinate prima dello zoom del banco.
     pop.style.left=(pop.offsetLeft+dx/scala)+'px';pop.style.top=(pop.offsetTop+dy/scala)+'px';
    }
   });};
   const mutazioni=new MutationObserver(riposiziona),misure=new ResizeObserver(riposiziona);
   mutazioni.observe(host,{childList:true,subtree:true});misure.observe(host);
   return ()=>{mutazioni.disconnect();misure.disconnect();cancelAnimationFrame(frame);};
  },[]);
  return <Excalidraw langCode="it-IT" initialData={opts.data} excalidrawAPI={a=>{api=a;opts.ready(a);}} onChange={(elementi,stato,file)=>{setSfondo(stato.viewBackgroundColor);palette(stato);opts.onChange(elementi,stato,file);}} onLinkOpen={(e,event)=>{event.preventDefault();opts.link(e.link);}} handleKeyboardGlobally={false} autoFocus={false} UIOptions={{canvasActions:{loadScene:false,saveToActiveFile:false,export:false,clearCanvas:true,saveAsImage:false,toggleTheme:false},tools:{image:false}}}>
   <MainMenu><MainMenu.DefaultItems.ClearCanvas/><MainMenu.DefaultItems.ChangeCanvasBackground/>
    <MainMenu.Item aria-label="Sfondo nero" title="Sfondo nero" selected={sfondo==='#000000'} aria-pressed={sfondo==='#000000'} icon={<span className="lim-campione-nero"/>} onSelect={()=>api.updateScene({appState:{viewBackgroundColor:'#000000'},captureUpdate:CaptureUpdateAction.IMMEDIATELY})}>Nero</MainMenu.Item>
   </MainMenu>
  </Excalidraw>;
 }
 root.render(<Editor/>);
 return {smonta:()=>{vivo=false;root.unmount();},get api(){return api;}};
},converti:convertToExcalidrawElements,restore:restoreElements,reconcile:reconcileElements,exportToCanvas,exportToSvg,exportToBlob,loadFromBlob,CaptureUpdateAction};

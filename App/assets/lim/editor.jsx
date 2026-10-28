// Unica isola React: il resto dell'app conserva i moduli e le barre esistenti.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Excalidraw,MainMenu,convertToExcalidrawElements,CaptureUpdateAction,restoreElements,reconcileElements,exportToCanvas} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
window.LimEditor={monta(host,opts){
 let api;const root=createRoot(host);
 function Editor(){
  const [sfondo,setSfondo]=React.useState(opts.data?.appState?.viewBackgroundColor);
  React.useEffect(()=>{
   // Il menu nativo ragiona sulla finestra; dentro uno split deve restare nella tela.
   let frame;const riposiziona=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
    const r=host.getBoundingClientRect(),left=Math.max(0,r.left)+8,top=Math.max(0,r.top)+8,right=Math.min(innerWidth,r.right)-8,bottom=Math.min(innerHeight,r.bottom)-8;
    for(const menu of host.querySelectorAll('.context-menu')){
     const pop=menu.parentElement;pop.style.width='max-content';pop.style.minWidth=Math.max(0,Math.min(190,right-left))+'px';pop.style.maxWidth=Math.max(0,right-left)+'px';pop.style.maxHeight=Math.max(0,bottom-top)+'px';pop.style.overflow='auto';
     const b=pop.getBoundingClientRect(),dx=Math.max(left-b.left,Math.min(0,right-b.right)),dy=Math.max(top-b.top,Math.min(0,bottom-b.bottom));
     pop.style.left=(pop.offsetLeft+dx)+'px';pop.style.top=(pop.offsetTop+dy)+'px';
    }
   });};
   const mutazioni=new MutationObserver(riposiziona),misure=new ResizeObserver(riposiziona);
   mutazioni.observe(host,{childList:true,subtree:true});misure.observe(host);
   return ()=>{mutazioni.disconnect();misure.disconnect();cancelAnimationFrame(frame);};
  },[]);
  return <Excalidraw langCode="it-IT" initialData={opts.data} excalidrawAPI={a=>{api=a;opts.ready(a);}} onChange={(elementi,stato,file)=>{setSfondo(stato.viewBackgroundColor);opts.onChange(elementi,stato,file);}} onLinkOpen={(e,event)=>{event.preventDefault();opts.link(e.link);}} handleKeyboardGlobally={false} autoFocus={false} UIOptions={{canvasActions:{loadScene:false,saveToActiveFile:false,export:false,clearCanvas:true,saveAsImage:false,toggleTheme:false},tools:{image:false}}}>
   <MainMenu><MainMenu.DefaultItems.ClearCanvas/><MainMenu.DefaultItems.ChangeCanvasBackground/>
    <MainMenu.Item aria-label="Sfondo nero" title="Sfondo nero" selected={sfondo==='#000000'} aria-pressed={sfondo==='#000000'} icon={<span className="lim-campione-nero"/>} onSelect={()=>api.updateScene({appState:{viewBackgroundColor:'#000000'},captureUpdate:CaptureUpdateAction.IMMEDIATELY})}>Nero</MainMenu.Item>
   </MainMenu>
  </Excalidraw>;
 }
 root.render(<Editor/>);
 return {smonta:()=>root.unmount(),get api(){return api;}};
},converti:convertToExcalidrawElements,restore:restoreElements,reconcile:reconcileElements,exportToCanvas,CaptureUpdateAction};

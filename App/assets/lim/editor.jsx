// Unica isola React: il resto dell'app conserva i moduli e le barre esistenti.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Excalidraw,MainMenu,convertToExcalidrawElements,CaptureUpdateAction,restoreElements,reconcileElements,exportToCanvas} from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
window.LimEditor={monta(host,opts){
 let api;const root=createRoot(host);
 root.render(<Excalidraw langCode="it-IT" initialData={opts.data} excalidrawAPI={a=>{api=a;opts.ready(a);}} onChange={opts.onChange} onLinkOpen={(e,event)=>{event.preventDefault();opts.link(e.link);}} handleKeyboardGlobally={false} autoFocus={false} UIOptions={{canvasActions:{loadScene:false,saveToActiveFile:false,export:false,clearCanvas:true,saveAsImage:false,toggleTheme:false},tools:{image:false}}}>
  <MainMenu><MainMenu.DefaultItems.ClearCanvas/><MainMenu.DefaultItems.ChangeCanvasBackground/></MainMenu>
 </Excalidraw>);
 return {smonta:()=>root.unmount(),get api(){return api;}};
},converti:convertToExcalidrawElements,restore:restoreElements,reconcile:reconcileElements,exportToCanvas,CaptureUpdateAction};

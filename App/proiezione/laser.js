(function(){
 'use strict';
 const vista=document.getElementById('vista'),traccia=LaserTraccia.crea('laser',()=>vista.getBoundingClientRect());
 window.proiezione.laser(traccia.ricevi);
 const resize=new ResizeObserver(()=>{traccia.cancella();traccia.misura();});resize.observe(vista);
 window.addEventListener('beforeunload',()=>{resize.disconnect();traccia.smonta();});
}());

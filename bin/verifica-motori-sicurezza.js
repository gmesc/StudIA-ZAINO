'use strict';
const {Arch}=require('builder-util');
const {verificaTarget}=require('./prepara-motori-sicurezza');
// Il target della build può essere diverso dalla macchina che la prepara (per esempio Windows da Mac).
module.exports = async function verificaMotoriPrimaDelPacchetto(contesto) {
  const piattaforma=contesto.electronPlatformName;
  const architettura=typeof contesto.arch==='string'?contesto.arch:Arch[contesto.arch];
  if(!piattaforma||!architettura)throw Error('Piattaforma o architettura della build non disponibile.');
  verificaTarget(piattaforma,architettura);
};

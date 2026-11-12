'use strict';
const path=require('node:path');
require('esbuild').build({entryPoints:[path.join(__dirname,'demo-entry.js')],outfile:path.join(__dirname,'demo-bundle.js'),bundle:true,platform:'browser',minify:true}).catch(e=>{console.error(e.message);process.exitCode=1;});

(()=>{var U=Object.create;var T=Object.defineProperty;var W=Object.getOwnPropertyDescriptor;var _=Object.getOwnPropertyNames;var j=Object.getPrototypeOf,G=Object.prototype.hasOwnProperty;var X=(e,r)=>()=>{try{return r||e((r={exports:{}}).exports,r),r.exports}catch(t){throw r=0,t}};var K=(e,r,t,n)=>{if(r&&typeof r=="object"||typeof r=="function")for(let i of _(r))!G.call(e,i)&&i!==t&&T(e,i,{get:()=>r[i],enumerable:!(n=W(r,i))||n.enumerable});return e};var Y=(e,r,t)=>(t=e!=null?U(j(e)):{},K(r||!e||!e.__esModule?T(t,"default",{value:e,enumerable:!0}):t,e));var F=X((Ne,H)=>{"use strict";function q(e){for(var r=1;r<arguments.length;r++){var t=arguments[r];for(var n in t)Object.prototype.hasOwnProperty.call(t,n)&&(e[n]=t[n])}return e}function v(e,r){return Array(r+1).join(e)}function b(e){return e.replace(/^\n*/,"")}function w(e){for(var r=e.length;r>0&&e[r-1]===`
`;)r--;return e.substring(0,r)}function S(e){return w(b(e))}var z=["ADDRESS","ARTICLE","ASIDE","AUDIO","BLOCKQUOTE","BODY","CANVAS","CENTER","DD","DIR","DIV","DL","DT","FIELDSET","FIGCAPTION","FIGURE","FOOTER","FORM","FRAMESET","H1","H2","H3","H4","H5","H6","HEADER","HGROUP","HR","HTML","ISINDEX","LI","MAIN","MENU","NAV","NOFRAMES","NOSCRIPT","OL","OUTPUT","P","PRE","SECTION","TABLE","TBODY","TD","TFOOT","TH","THEAD","TR","UL"];function A(e){return N(e,z)}var O=["AREA","BASE","BR","COL","COMMAND","EMBED","HR","IMG","INPUT","KEYGEN","LINK","META","PARAM","SOURCE","TRACK","WBR"];function D(e){return N(e,O)}function Q(e){return L(e,O)}var B=["A","TABLE","THEAD","TBODY","TFOOT","TH","TD","IFRAME","SCRIPT","AUDIO","VIDEO"];function J(e){return N(e,B)}function Z(e){return L(e,B)}function N(e,r){return r.indexOf(e.nodeName)>=0}function L(e,r){return e.getElementsByTagName&&r.some(function(t){return e.getElementsByTagName(t).length})}var ee=[[/\\/g,"\\\\"],[/\*/g,"\\*"],[/^-/g,"\\-"],[/^\+ /g,"\\+ "],[/^(=+)/g,"\\$1"],[/^(#{1,6}) /g,"\\$1 "],[/`/g,"\\`"],[/^~~~/g,"\\~~~"],[/\[/g,"\\["],[/\]/g,"\\]"],[/^>/g,"\\>"],[/_/g,"\\_"],[/^(\d+)\. /g,"$1\\. "]];function P(e){return ee.reduce(function(r,t){return r.replace(t[0],t[1])},e)}var f={};f.paragraph={filter:"p",replacement:function(e){return`

`+e+`

`}};f.lineBreak={filter:"br",replacement:function(e,r,t){return t.br+`
`}};f.heading={filter:["h1","h2","h3","h4","h5","h6"],replacement:function(e,r,t){var n=Number(r.nodeName.charAt(1));if(t.headingStyle==="setext"&&n<3){var i=v(n===1?"=":"-",e.length);return`

`+e+`
`+i+`

`}else return`

`+v("#",n)+" "+e+`

`}};f.blockquote={filter:"blockquote",replacement:function(e){return e=S(e).replace(/^/gm,"> "),`

`+e+`

`}};f.list={filter:["ul","ol"],replacement:function(e,r){var t=r.parentNode;return t.nodeName==="LI"&&t.lastElementChild===r?`
`+e:`

`+e+`

`}};f.listItem={filter:"li",replacement:function(e,r,t){var n=t.bulletListMarker+"   ",i=r.parentNode;if(i.nodeName==="OL"){var a=i.getAttribute("start"),s=Array.prototype.indexOf.call(i.children,r);n=(a?Number(a)+s:s+1)+".  "}var o=/\n$/.test(e);return e=S(e)+(o?`
`:""),e=e.replace(/\n/gm,`
`+" ".repeat(n.length)),n+e+(r.nextSibling?`
`:"")}};f.indentedCodeBlock={filter:function(e,r){return r.codeBlockStyle==="indented"&&e.nodeName==="PRE"&&e.firstChild&&e.firstChild.nodeName==="CODE"},replacement:function(e,r,t){return`

    `+r.firstChild.textContent.replace(/\n/g,`
    `)+`

`}};f.fencedCodeBlock={filter:function(e,r){return r.codeBlockStyle==="fenced"&&e.nodeName==="PRE"&&e.firstChild&&e.firstChild.nodeName==="CODE"},replacement:function(e,r,t){for(var n=r.firstChild.getAttribute("class")||"",i=(n.match(/language-(\S+)/)||[null,""])[1],a=r.firstChild.textContent,s=t.fence.charAt(0),o=3,l=new RegExp("^"+s+"{3,}","gm"),u;u=l.exec(a);)u[0].length>=o&&(o=u[0].length+1);var c=v(s,o);return`

`+c+i+`
`+a.replace(/\n$/,"")+`
`+c+`

`}};f.horizontalRule={filter:"hr",replacement:function(e,r,t){return`

`+t.hr+`

`}};f.inlineLink={filter:function(e,r){return r.linkStyle==="inlined"&&e.nodeName==="A"&&e.getAttribute("href")},replacement:function(e,r){var t=k(r.getAttribute("href")),n=y(h(r.getAttribute("title"))),i=n?' "'+n+'"':"";return"["+e+"]("+t+i+")"}};f.referenceLink={filter:function(e,r){return r.linkStyle==="referenced"&&e.nodeName==="A"&&e.getAttribute("href")},replacement:function(e,r,t){var n=k(r.getAttribute("href")),i=h(r.getAttribute("title"));i&&(i=' "'+y(i)+'"');var a,s;switch(t.linkReferenceStyle){case"collapsed":a="["+e+"][]",s="["+e+"]: "+n+i;break;case"shortcut":a="["+e+"]",s="["+e+"]: "+n+i;break;default:var o=this.references.length+1;a="["+e+"]["+o+"]",s="["+o+"]: "+n+i}return this.references.push(s),a},references:[],append:function(e){var r="";return this.references.length&&(r=`

`+this.references.join(`
`)+`

`,this.references=[]),r}};f.emphasis={filter:["em","i"],replacement:function(e,r,t){return e.trim()?t.emDelimiter+e+t.emDelimiter:""}};f.strong={filter:["strong","b"],replacement:function(e,r,t){return e.trim()?t.strongDelimiter+e+t.strongDelimiter:""}};f.code={filter:function(e){var r=e.previousSibling||e.nextSibling,t=e.parentNode.nodeName==="PRE"&&!r;return e.nodeName==="CODE"&&!t},replacement:function(e){if(!e)return"";e=e.replace(/\r?\n|\r/g," ");for(var r=/^`|^ .*?[^ ].* $|`$/.test(e)?" ":"",t="`",n=e.match(/`+/gm)||[];n.indexOf(t)!==-1;)t=t+"`";return t+r+e+r+t}};f.image={filter:"img",replacement:function(e,r){var t=P(h(r.getAttribute("alt"))),n=k(r.getAttribute("src")||""),i=h(r.getAttribute("title")),a=i?' "'+y(i)+'"':"";return n?"!["+t+"]("+n+a+")":""}};function h(e){return e?e.replace(/(\n+\s*)+/g,`
`):""}function k(e){var r=e.replace(/([<>()])/g,"\\$1");return r.indexOf(" ")>=0?"<"+r+">":r}function y(e){return e.replace(/"/g,'\\"')}function x(e){this.options=e,this._keep=[],this._remove=[],this.blankRule={replacement:e.blankReplacement},this.keepReplacement=e.keepReplacement,this.defaultRule={replacement:e.defaultReplacement},this.array=[];for(var r in e.rules)this.array.push(e.rules[r])}x.prototype={add:function(e,r){this.array.unshift(r)},keep:function(e){this._keep.unshift({filter:e,replacement:this.keepReplacement})},remove:function(e){this._remove.unshift({filter:e,replacement:function(){return""}})},forNode:function(e){if(e.isBlank)return this.blankRule;var r;return(r=d(this.array,e,this.options))||(r=d(this._keep,e,this.options))||(r=d(this._remove,e,this.options))?r:this.defaultRule},forEach:function(e){for(var r=0;r<this.array.length;r++)e(this.array[r],r)}};function d(e,r,t){for(var n=0;n<e.length;n++){var i=e[n];if(re(i,r,t))return i}}function re(e,r,t){var n=e.filter;if(typeof n=="string"){if(n===r.nodeName.toLowerCase())return!0}else if(Array.isArray(n)){if(n.indexOf(r.nodeName.toLowerCase())>-1)return!0}else if(typeof n=="function"){if(n.call(e,r,t))return!0}else throw new TypeError("`filter` needs to be a string, array, or function")}function te(e){var r=e.element,t=e.isBlock,n=e.isVoid,i=e.isPre||function(V){return V.nodeName==="PRE"};if(!(!r.firstChild||i(r))){for(var a=null,s=!1,o=null,l=C(o,r,i);l!==r;){if(l.nodeType===3||l.nodeType===4){var u=l.data.replace(/[ \r\n\t]+/g," ");if((!a||/ $/.test(a.data))&&!s&&u[0]===" "&&(u=u.substr(1)),!u){l=m(l);continue}l.data=u,a=l}else if(l.nodeType===1)t(l)||l.nodeName==="BR"?(a&&(a.data=a.data.replace(/ $/,"")),a=null,s=!1):n(l)||i(l)?(a=null,s=!0):a&&(s=!1);else{l=m(l);continue}var c=C(o,l,i);o=l,l=c}a&&(a.data=a.data.replace(/ $/,""),a.data||m(a))}}function m(e){var r=e.nextSibling||e.parentNode;return e.parentNode.removeChild(e),r}function C(e,r,t){return e&&e.parentNode===r||t(r)?r.nextSibling||r.parentNode:r.firstChild||r.nextSibling||r.parentNode}var E=typeof window<"u"?window:{};function ne(){var e=E.DOMParser,r=!1;try{new e().parseFromString("","text/html")&&(r=!0)}catch{}return r}function ie(){var e=function(){};return ae()?e.prototype.parseFromString=function(r){var t=new window.ActiveXObject("htmlfile");return t.designMode="on",t.open(),t.write(r),t.close(),t}:e.prototype.parseFromString=function(r){var t=document.implementation.createHTMLDocument("");return t.open(),t.write(r),t.close(),t},e}function ae(){var e=!1;try{document.implementation.createHTMLDocument("").open()}catch{E.ActiveXObject&&(e=!0)}return e}var le=ne()?E.DOMParser:ie();function se(e,r){var t;if(typeof e=="string"){var n=fe().parseFromString('<x-turndown id="turndown-root">'+e+"</x-turndown>","text/html");t=n.getElementById("turndown-root")}else t=e.cloneNode(!0);return te({element:t,isBlock:A,isVoid:D,isPre:r.preformattedCode?oe:null}),t}var g;function fe(){return g=g||new le,g}function oe(e){return e.nodeName==="PRE"||e.nodeName==="CODE"}function ue(e,r){return e.isBlock=A(e),e.isCode=e.nodeName==="CODE"||e.parentNode.isCode,e.isBlank=ce(e),e.flankingWhitespace=he(e,r),e}function ce(e){return!D(e)&&!J(e)&&/^\s*$/i.test(e.textContent)&&!Q(e)&&!Z(e)}function he(e,r){if(e.isBlock||r.preformattedCode&&e.isCode)return{leading:"",trailing:""};var t=pe(e.textContent);return t.leadingAscii&&R("left",e,r)&&(t.leading=t.leadingNonAscii),t.trailingAscii&&R("right",e,r)&&(t.trailing=t.trailingNonAscii),{leading:t.leading,trailing:t.trailing}}function pe(e){var r=e.match(/^(([ \t\r\n]*)(\s*))(?:(?=\S)[\s\S]*\S)?((\s*?)([ \t\r\n]*))$/);return{leading:r[1],leadingAscii:r[2],leadingNonAscii:r[3],trailing:r[4],trailingNonAscii:r[5],trailingAscii:r[6]}}function R(e,r,t){var n,i,a;return e==="left"?(n=r.previousSibling,i=/ $/):(n=r.nextSibling,i=/^ /),n&&(n.nodeType===3?a=i.test(n.nodeValue):t.preformattedCode&&n.nodeName==="CODE"?a=!1:n.nodeType===1&&!A(n)&&(a=i.test(n.textContent))),a}var de=Array.prototype.reduce;function p(e){if(!(this instanceof p))return new p(e);var r={rules:f,headingStyle:"setext",hr:"* * *",bulletListMarker:"*",codeBlockStyle:"indented",fence:"```",emDelimiter:"_",strongDelimiter:"**",linkStyle:"inlined",linkReferenceStyle:"full",br:"  ",preformattedCode:!1,blankReplacement:function(t,n){return n.isBlock?`

`:""},keepReplacement:function(t,n){return n.isBlock?`

`+n.outerHTML+`

`:n.outerHTML},defaultReplacement:function(t,n){return n.isBlock?`

`+t+`

`:t}};this.options=q({},r,e),this.rules=new x(this.options)}p.prototype={turndown:function(e){if(!ve(e))throw new TypeError(e+" is not a string, or an element/document/fragment node.");if(e==="")return"";var r=M.call(this,new se(e,this.options));return me.call(this,r)},use:function(e){if(Array.isArray(e))for(var r=0;r<e.length;r++)this.use(e[r]);else if(typeof e=="function")e(this);else throw new TypeError("plugin must be a Function or an Array of Functions");return this},addRule:function(e,r){return this.rules.add(e,r),this},keep:function(e){return this.rules.keep(e),this},remove:function(e){return this.rules.remove(e),this},escape:function(e){return P(e)}};function M(e){var r=this;return de.call(e.childNodes,function(t,n){n=new ue(n,r.options);var i="";return n.nodeType===3?i=n.isCode?n.nodeValue:r.escape(n.nodeValue):n.nodeType===1&&(i=ge.call(r,n)),I(t,i),t},[])}function me(e){var r=this;return this.rules.forEach(function(t){typeof t.append=="function"&&I(e,t.append(r.options))}),e.join("").replace(/^[\t\r\n]+/,"").replace(/[\t\r\n\s]+$/,"")}function ge(e){var r=this.rules.forNode(e),t=M.call(this,e).join(""),n=e.flankingWhitespace;return(n.leading||n.trailing)&&(t=t.trim()),n.leading+r.replacement(t,e,this.options)+n.trailing}function I(e,r){var t=e.pop()||"",n=w(t),i=b(r),a=Math.max(t.length-n.length,r.length-i.length),s=`

`.substring(0,a);n&&e.push(n),s&&e.push(s),i&&e.push(i)}function ve(e){return e!=null&&(typeof e=="string"||e.nodeType&&(e.nodeType===1||e.nodeType===9||e.nodeType===11))}H.exports=p});var $=Y(F());window.AppuntiHtmlMarkdown=new $.default({headingStyle:"atx",bulletListMarker:"-",codeBlockStyle:"fenced"});})();

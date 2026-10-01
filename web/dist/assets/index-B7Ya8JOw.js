(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&n(o)}).observe(document,{childList:!0,subtree:!0});function e(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function n(s){if(s.ep)return;s.ep=!0;const r=e(s);fetch(s.href,r)}})();/**
 * @license
 * Copyright 2010-2024 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const Al="170",Ji={ROTATE:0,DOLLY:1,PAN:2},ji={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},bd=0,nc=1,Sd=2,nu=1,iu=2,Dn=3,bn=0,Ye=1,je=2,ti=0,xi=1,Ys=2,ic=3,sc=4,go=5,_n=100,wd=101,Ed=102,Td=103,Ad=104,oo=200,yi=201,su=202,Cd=203,Ua=204,Xs=205,Rd=206,Pd=207,Ld=208,Id=209,Dd=210,Ud=211,Nd=212,Od=213,Fd=214,Na=0,Oa=1,Fa=2,is=3,Ba=4,ka=5,za=6,Ha=7,ru=0,Bd=1,kd=2,ei=0,zd=1,Hd=2,Vd=3,Gd=4,Wd=5,qd=6,ou=7,au=300,ss=301,rs=302,Va=303,Ga=304,vo=306,os=1e3,vi=1001,Wa=1002,en=1003,Yd=1004,fr=1005,Mn=1006,Io=1007,_i=1008,On=1009,lu=1010,cu=1011,$s=1012,Cl=1013,bi=1014,xn=1015,sr=1016,Rl=1017,Pl=1018,as=1020,hu=35902,uu=1021,du=1022,mn=1023,fu=1024,pu=1025,Qi=1026,ls=1027,Ll=1028,Il=1029,mu=1030,Dl=1031,Ul=1033,Zr=33776,Jr=33777,Qr=33778,to=33779,qa=35840,Ya=35841,Xa=35842,$a=35843,ja=36196,Ka=37492,Za=37496,Ja=37808,Qa=37809,tl=37810,el=37811,nl=37812,il=37813,sl=37814,rl=37815,ol=37816,al=37817,ll=37818,cl=37819,hl=37820,ul=37821,eo=36492,dl=36494,fl=36495,gu=36283,pl=36284,ml=36285,gl=36286,Xd=3200,$d=3201,vu=0,jd=1,Zn="",we="srgb",ii="srgb-linear",_o="linear",ae="srgb",Pi=7680,rc=519,Kd=512,Zd=513,Jd=514,_u=515,Qd=516,tf=517,ef=518,nf=519,oc=35044,Qn=35048,ac="300 es",Un=2e3,ao=2001;class Ei{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){if(this._listeners===void 0)return!1;const n=this._listeners;return n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){if(this._listeners===void 0)return;const s=this._listeners[t];if(s!==void 0){const r=s.indexOf(e);r!==-1&&s.splice(r,1)}}dispatchEvent(t){if(this._listeners===void 0)return;const n=this._listeners[t.type];if(n!==void 0){t.target=this;const s=n.slice(0);for(let r=0,o=s.length;r<o;r++)s[r].call(this,t);t.target=null}}}const Be=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];let lc=1234567;const Ns=Math.PI/180,js=180/Math.PI;function Ti(){const i=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Be[i&255]+Be[i>>8&255]+Be[i>>16&255]+Be[i>>24&255]+"-"+Be[t&255]+Be[t>>8&255]+"-"+Be[t>>16&15|64]+Be[t>>24&255]+"-"+Be[e&63|128]+Be[e>>8&255]+"-"+Be[e>>16&255]+Be[e>>24&255]+Be[n&255]+Be[n>>8&255]+Be[n>>16&255]+Be[n>>24&255]).toLowerCase()}function be(i,t,e){return Math.max(t,Math.min(e,i))}function Nl(i,t){return(i%t+t)%t}function sf(i,t,e,n,s){return n+(i-t)*(s-n)/(e-t)}function rf(i,t,e){return i!==t?(e-i)/(t-i):0}function Os(i,t,e){return(1-e)*i+e*t}function of(i,t,e,n){return Os(i,t,1-Math.exp(-e*n))}function af(i,t=1){return t-Math.abs(Nl(i,t*2)-t)}function lf(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*(3-2*i))}function cf(i,t,e){return i<=t?0:i>=e?1:(i=(i-t)/(e-t),i*i*i*(i*(i*6-15)+10))}function hf(i,t){return i+Math.floor(Math.random()*(t-i+1))}function uf(i,t){return i+Math.random()*(t-i)}function df(i){return i*(.5-Math.random())}function ff(i){i!==void 0&&(lc=i);let t=lc+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function pf(i){return i*Ns}function mf(i){return i*js}function gf(i){return(i&i-1)===0&&i!==0}function vf(i){return Math.pow(2,Math.ceil(Math.log(i)/Math.LN2))}function _f(i){return Math.pow(2,Math.floor(Math.log(i)/Math.LN2))}function Mf(i,t,e,n,s){const r=Math.cos,o=Math.sin,a=r(e/2),l=o(e/2),c=r((t+n)/2),h=o((t+n)/2),u=r((t-n)/2),d=o((t-n)/2),f=r((n-t)/2),g=o((n-t)/2);switch(s){case"XYX":i.set(a*h,l*u,l*d,a*c);break;case"YZY":i.set(l*d,a*h,l*u,a*c);break;case"ZXZ":i.set(l*u,l*d,a*h,a*c);break;case"XZX":i.set(a*h,l*g,l*f,a*c);break;case"YXY":i.set(l*f,a*h,l*g,a*c);break;case"ZYZ":i.set(l*g,l*f,a*h,a*c);break;default:console.warn("THREE.MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: "+s)}}function $i(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("Invalid component type.")}}function Ge(i,t){switch(t.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("Invalid component type.")}}const Ol={DEG2RAD:Ns,RAD2DEG:js,generateUUID:Ti,clamp:be,euclideanModulo:Nl,mapLinear:sf,inverseLerp:rf,lerp:Os,damp:of,pingpong:af,smoothstep:lf,smootherstep:cf,randInt:hf,randFloat:uf,randFloatSpread:df,seededRandom:ff,degToRad:pf,radToDeg:mf,isPowerOfTwo:gf,ceilPowerOfTwo:vf,floorPowerOfTwo:_f,setQuaternionFromProperEuler:Mf,normalize:Ge,denormalize:$i};class H{constructor(t=0,e=0){H.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6],this.y=s[1]*e+s[4]*n+s[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(be(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),s=Math.sin(e),r=this.x-t.x,o=this.y-t.y;return this.x=r*n-o*s+t.x,this.y=r*s+o*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Yt{constructor(t,e,n,s,r,o,a,l,c){Yt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c)}set(t,e,n,s,r,o,a,l,c){const h=this.elements;return h[0]=t,h[1]=s,h[2]=a,h[3]=e,h[4]=r,h[5]=l,h[6]=n,h[7]=o,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],f=n[5],g=n[8],v=s[0],m=s[3],p=s[6],x=s[1],M=s[4],_=s[7],I=s[2],E=s[5],C=s[8];return r[0]=o*v+a*x+l*I,r[3]=o*m+a*M+l*E,r[6]=o*p+a*_+l*C,r[1]=c*v+h*x+u*I,r[4]=c*m+h*M+u*E,r[7]=c*p+h*_+u*C,r[2]=d*v+f*x+g*I,r[5]=d*m+f*M+g*E,r[8]=d*p+f*_+g*C,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8];return e*o*h-e*a*c-n*r*h+n*a*l+s*r*c-s*o*l}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],u=h*o-a*c,d=a*l-h*r,f=c*r-o*l,g=e*u+n*d+s*f;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const v=1/g;return t[0]=u*v,t[1]=(s*c-h*n)*v,t[2]=(a*n-s*o)*v,t[3]=d*v,t[4]=(h*e-s*l)*v,t[5]=(s*r-a*e)*v,t[6]=f*v,t[7]=(n*l-c*e)*v,t[8]=(o*e-n*r)*v,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,s,r,o,a){const l=Math.cos(r),c=Math.sin(r);return this.set(n*l,n*c,-n*(l*o+c*a)+o+t,-s*c,s*l,-s*(-c*o+l*a)+a+e,0,0,1),this}scale(t,e){return this.premultiply(Do.makeScale(t,e)),this}rotate(t){return this.premultiply(Do.makeRotation(-t)),this}translate(t,e){return this.premultiply(Do.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<9;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const Do=new Yt;function Mu(i){for(let t=i.length-1;t>=0;--t)if(i[t]>=65535)return!0;return!1}function lo(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function xf(){const i=lo("canvas");return i.style.display="block",i}const cc={};function Cs(i){i in cc||(cc[i]=!0,console.warn(i))}function yf(i,t,e){return new Promise(function(n,s){function r(){switch(i.clientWaitSync(t,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(r,e);break;default:n()}}setTimeout(r,e)})}function bf(i){const t=i.elements;t[2]=.5*t[2]+.5*t[3],t[6]=.5*t[6]+.5*t[7],t[10]=.5*t[10]+.5*t[11],t[14]=.5*t[14]+.5*t[15]}function Sf(i){const t=i.elements;t[11]===-1?(t[10]=-t[10]-1,t[14]=-t[14]):(t[10]=-t[10],t[14]=-t[14]+1)}const Qt={enabled:!0,workingColorSpace:ii,spaces:{},convert:function(i,t,e){return this.enabled===!1||t===e||!t||!e||(this.spaces[t].transfer===ae&&(i.r=Nn(i.r),i.g=Nn(i.g),i.b=Nn(i.b)),this.spaces[t].primaries!==this.spaces[e].primaries&&(i.applyMatrix3(this.spaces[t].toXYZ),i.applyMatrix3(this.spaces[e].fromXYZ)),this.spaces[e].transfer===ae&&(i.r=ts(i.r),i.g=ts(i.g),i.b=ts(i.b))),i},fromWorkingColorSpace:function(i,t){return this.convert(i,this.workingColorSpace,t)},toWorkingColorSpace:function(i,t){return this.convert(i,t,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Zn?_o:this.spaces[i].transfer},getLuminanceCoefficients:function(i,t=this.workingColorSpace){return i.fromArray(this.spaces[t].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,t,e){return i.copy(this.spaces[t].toXYZ).multiply(this.spaces[e].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace}};function Nn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function ts(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}const hc=[.64,.33,.3,.6,.15,.06],uc=[.2126,.7152,.0722],dc=[.3127,.329],fc=new Yt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),pc=new Yt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);Qt.define({[ii]:{primaries:hc,whitePoint:dc,transfer:_o,toXYZ:fc,fromXYZ:pc,luminanceCoefficients:uc,workingColorSpaceConfig:{unpackColorSpace:we},outputColorSpaceConfig:{drawingBufferColorSpace:we}},[we]:{primaries:hc,whitePoint:dc,transfer:ae,toXYZ:fc,fromXYZ:pc,luminanceCoefficients:uc,outputColorSpaceConfig:{drawingBufferColorSpace:we}}});let Li;class wf{static getDataURL(t){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let e;if(t instanceof HTMLCanvasElement)e=t;else{Li===void 0&&(Li=lo("canvas")),Li.width=t.width,Li.height=t.height;const n=Li.getContext("2d");t instanceof ImageData?n.putImageData(t,0,0):n.drawImage(t,0,0,t.width,t.height),e=Li}return e.width>2048||e.height>2048?(console.warn("THREE.ImageUtils.getDataURL: Image converted to jpg for performance reasons",t),e.toDataURL("image/jpeg",.6)):e.toDataURL("image/png")}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=lo("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const s=n.getImageData(0,0,t.width,t.height),r=s.data;for(let o=0;o<r.length;o++)r[o]=Nn(r[o]/255)*255;return n.putImageData(s,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Nn(e[n]/255)*255):e[n]=Nn(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let Ef=0;class xu{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Ef++}),this.uuid=Ti(),this.data=t,this.dataReady=!0,this.version=0}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let r;if(Array.isArray(s)){r=[];for(let o=0,a=s.length;o<a;o++)s[o].isDataTexture?r.push(Uo(s[o].image)):r.push(Uo(s[o]))}else r=Uo(s);n.url=r}return e||(t.images[this.uuid]=n),n}}function Uo(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?wf.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let Tf=0;class Ve extends Ei{constructor(t=Ve.DEFAULT_IMAGE,e=Ve.DEFAULT_MAPPING,n=vi,s=vi,r=Mn,o=_i,a=mn,l=On,c=Ve.DEFAULT_ANISOTROPY,h=Zn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Tf++}),this.uuid=Ti(),this.name="",this.source=new xu(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=r,this.minFilter=o,this.anisotropy=c,this.format=a,this.internalFormat=null,this.type=l,this.offset=new H(0,0),this.repeat=new H(1,1),this.center=new H(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Yt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.version=0,this.onUpdate=null,this.isRenderTargetTexture=!1,this.pmremVersion=0}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.6,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==au)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case os:t.x=t.x-Math.floor(t.x);break;case vi:t.x=t.x<0?0:1;break;case Wa:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case os:t.y=t.y-Math.floor(t.y);break;case vi:t.y=t.y<0?0:1;break;case Wa:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}Ve.DEFAULT_IMAGE=null;Ve.DEFAULT_MAPPING=au;Ve.DEFAULT_ANISOTROPY=1;class ie{constructor(t=0,e=0,n=0,s=1){ie.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=s}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,s){return this.x=t,this.y=e,this.z=n,this.w=s,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=this.w,o=t.elements;return this.x=o[0]*e+o[4]*n+o[8]*s+o[12]*r,this.y=o[1]*e+o[5]*n+o[9]*s+o[13]*r,this.z=o[2]*e+o[6]*n+o[10]*s+o[14]*r,this.w=o[3]*e+o[7]*n+o[11]*s+o[15]*r,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,s,r;const l=t.elements,c=l[0],h=l[4],u=l[8],d=l[1],f=l[5],g=l[9],v=l[2],m=l[6],p=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-v)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+v)<.1&&Math.abs(g+m)<.1&&Math.abs(c+f+p-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const M=(c+1)/2,_=(f+1)/2,I=(p+1)/2,E=(h+d)/4,C=(u+v)/4,P=(g+m)/4;return M>_&&M>I?M<.01?(n=0,s=.707106781,r=.707106781):(n=Math.sqrt(M),s=E/n,r=C/n):_>I?_<.01?(n=.707106781,s=0,r=.707106781):(s=Math.sqrt(_),n=E/s,r=P/s):I<.01?(n=.707106781,s=.707106781,r=0):(r=Math.sqrt(I),n=C/r,s=P/r),this.set(n,s,r,e),this}let x=Math.sqrt((m-g)*(m-g)+(u-v)*(u-v)+(d-h)*(d-h));return Math.abs(x)<.001&&(x=1),this.x=(m-g)/x,this.y=(u-v)/x,this.z=(d-h)/x,this.w=Math.acos((c+f+p-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this.w=Math.max(t.w,Math.min(e.w,this.w)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this.w=Math.max(t,Math.min(e,this.w)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Af extends Ei{constructor(t=1,e=1,n={}){super(),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=1,this.scissor=new ie(0,0,t,e),this.scissorTest=!1,this.viewport=new ie(0,0,t,e);const s={width:t,height:e,depth:1};n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Mn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1},n);const r=new Ve(s,n.mapping,n.wrapS,n.wrapT,n.magFilter,n.minFilter,n.format,n.type,n.anisotropy,n.colorSpace);r.flipY=!1,r.generateMipmaps=n.generateMipmaps,r.internalFormat=n.internalFormat,this.textures=[];const o=n.count;for(let a=0;a<o;a++)this.textures[a]=r.clone(),this.textures[a].isRenderTargetTexture=!0;this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this.depthTexture=n.depthTexture,this.samples=n.samples}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let s=0,r=this.textures.length;s<r;s++)this.textures[s].image.width=t,this.textures[s].image.height=e,this.textures[s].image.depth=n;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let n=0,s=t.textures.length;n<s;n++)this.textures[n]=t.textures[n].clone(),this.textures[n].isRenderTargetTexture=!0;const e=Object.assign({},t.texture.image);return this.texture.source=new xu(e),this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Si extends Af{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class yu extends Ve{constructor(t=null,e=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=en,this.minFilter=en,this.wrapR=vi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class Cf extends Ve{constructor(t=null,e=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:s},this.magFilter=en,this.minFilter=en,this.wrapR=vi,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Me{constructor(t=0,e=0,n=0,s=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=s}static slerpFlat(t,e,n,s,r,o,a){let l=n[s+0],c=n[s+1],h=n[s+2],u=n[s+3];const d=r[o+0],f=r[o+1],g=r[o+2],v=r[o+3];if(a===0){t[e+0]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u;return}if(a===1){t[e+0]=d,t[e+1]=f,t[e+2]=g,t[e+3]=v;return}if(u!==v||l!==d||c!==f||h!==g){let m=1-a;const p=l*d+c*f+h*g+u*v,x=p>=0?1:-1,M=1-p*p;if(M>Number.EPSILON){const I=Math.sqrt(M),E=Math.atan2(I,p*x);m=Math.sin(m*E)/I,a=Math.sin(a*E)/I}const _=a*x;if(l=l*m+d*_,c=c*m+f*_,h=h*m+g*_,u=u*m+v*_,m===1-a){const I=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=I,c*=I,h*=I,u*=I}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,s,r,o){const a=n[s],l=n[s+1],c=n[s+2],h=n[s+3],u=r[o],d=r[o+1],f=r[o+2],g=r[o+3];return t[e]=a*g+h*u+l*f-c*d,t[e+1]=l*g+h*d+c*u-a*f,t[e+2]=c*g+h*f+a*d-l*u,t[e+3]=h*g-a*u-l*d-c*f,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,s){return this._x=t,this._y=e,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,s=t._y,r=t._z,o=t._order,a=Math.cos,l=Math.sin,c=a(n/2),h=a(s/2),u=a(r/2),d=l(n/2),f=l(s/2),g=l(r/2);switch(o){case"XYZ":this._x=d*h*u+c*f*g,this._y=c*f*u-d*h*g,this._z=c*h*g+d*f*u,this._w=c*h*u-d*f*g;break;case"YXZ":this._x=d*h*u+c*f*g,this._y=c*f*u-d*h*g,this._z=c*h*g-d*f*u,this._w=c*h*u+d*f*g;break;case"ZXY":this._x=d*h*u-c*f*g,this._y=c*f*u+d*h*g,this._z=c*h*g+d*f*u,this._w=c*h*u-d*f*g;break;case"ZYX":this._x=d*h*u-c*f*g,this._y=c*f*u+d*h*g,this._z=c*h*g-d*f*u,this._w=c*h*u+d*f*g;break;case"YZX":this._x=d*h*u+c*f*g,this._y=c*f*u+d*h*g,this._z=c*h*g-d*f*u,this._w=c*h*u-d*f*g;break;case"XZY":this._x=d*h*u-c*f*g,this._y=c*f*u-d*h*g,this._z=c*h*g+d*f*u,this._w=c*h*u+d*f*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+o)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,s=Math.sin(n);return this._x=t.x*s,this._y=t.y*s,this._z=t.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],s=e[4],r=e[8],o=e[1],a=e[5],l=e[9],c=e[2],h=e[6],u=e[10],d=n+a+u;if(d>0){const f=.5/Math.sqrt(d+1);this._w=.25/f,this._x=(h-l)*f,this._y=(r-c)*f,this._z=(o-s)*f}else if(n>a&&n>u){const f=2*Math.sqrt(1+n-a-u);this._w=(h-l)/f,this._x=.25*f,this._y=(s+o)/f,this._z=(r+c)/f}else if(a>u){const f=2*Math.sqrt(1+a-n-u);this._w=(r-c)/f,this._x=(s+o)/f,this._y=.25*f,this._z=(l+h)/f}else{const f=2*Math.sqrt(1+u-n-a);this._w=(o-s)/f,this._x=(r+c)/f,this._y=(l+h)/f,this._z=.25*f}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<Number.EPSILON?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(be(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const s=Math.min(1,e/n);return this.slerp(t,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,s=t._y,r=t._z,o=t._w,a=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+o*a+s*c-r*l,this._y=s*h+o*l+r*a-n*c,this._z=r*h+o*c+n*l-s*a,this._w=o*h-n*a-s*l-r*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,s=this._y,r=this._z,o=this._w;let a=o*t._w+n*t._x+s*t._y+r*t._z;if(a<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,a=-a):this.copy(t),a>=1)return this._w=o,this._x=n,this._y=s,this._z=r,this;const l=1-a*a;if(l<=Number.EPSILON){const f=1-e;return this._w=f*o+e*this._w,this._x=f*n+e*this._x,this._y=f*s+e*this._y,this._z=f*r+e*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,a),u=Math.sin((1-e)*h)/c,d=Math.sin(e*h)/c;return this._w=o*u+this._w*d,this._x=n*u+this._x*d,this._y=s*u+this._y*d,this._z=r*u+this._z*d,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),r=Math.sqrt(n);return this.set(s*Math.sin(t),s*Math.cos(t),r*Math.sin(e),r*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class T{constructor(t=0,e=0,n=0){T.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(mc.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(mc.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[3]*n+r[6]*s,this.y=r[1]*e+r[4]*n+r[7]*s,this.z=r[2]*e+r[5]*n+r[8]*s,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,s=this.z,r=t.elements,o=1/(r[3]*e+r[7]*n+r[11]*s+r[15]);return this.x=(r[0]*e+r[4]*n+r[8]*s+r[12])*o,this.y=(r[1]*e+r[5]*n+r[9]*s+r[13])*o,this.z=(r[2]*e+r[6]*n+r[10]*s+r[14])*o,this}applyQuaternion(t){const e=this.x,n=this.y,s=this.z,r=t.x,o=t.y,a=t.z,l=t.w,c=2*(o*s-a*n),h=2*(a*e-r*s),u=2*(r*n-o*e);return this.x=e+l*c+o*u-a*h,this.y=n+l*h+a*c-r*u,this.z=s+l*u+r*h-o*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,s=this.z,r=t.elements;return this.x=r[0]*e+r[4]*n+r[8]*s,this.y=r[1]*e+r[5]*n+r[9]*s,this.z=r[2]*e+r[6]*n+r[10]*s,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Math.max(t.x,Math.min(e.x,this.x)),this.y=Math.max(t.y,Math.min(e.y,this.y)),this.z=Math.max(t.z,Math.min(e.z,this.z)),this}clampScalar(t,e){return this.x=Math.max(t,Math.min(e,this.x)),this.y=Math.max(t,Math.min(e,this.y)),this.z=Math.max(t,Math.min(e,this.z)),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Math.max(t,Math.min(e,n)))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,s=t.y,r=t.z,o=e.x,a=e.y,l=e.z;return this.x=s*l-r*a,this.y=r*o-n*l,this.z=n*a-s*o,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return No.copy(this).projectOnVector(t),this.sub(No)}reflect(t){return this.sub(No.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(be(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,s=this.z-t.z;return e*e+n*n+s*s}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const s=Math.sin(e)*t;return this.x=s*Math.sin(n),this.y=Math.cos(e)*t,this.z=s*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),s=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=s,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const No=new T,mc=new Me;class Ai{constructor(t=new T(1/0,1/0,1/0),e=new T(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(un.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(un.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=un.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const r=n.getAttribute("position");if(e===!0&&r!==void 0&&t.isInstancedMesh!==!0)for(let o=0,a=r.count;o<a;o++)t.isMesh===!0?t.getVertexPosition(o,un):un.fromBufferAttribute(r,o),un.applyMatrix4(t.matrixWorld),this.expandByPoint(un);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),pr.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),pr.copy(n.boundingBox)),pr.applyMatrix4(t.matrixWorld),this.union(pr)}const s=t.children;for(let r=0,o=s.length;r<o;r++)this.expandByObject(s[r],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,un),un.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter(vs),mr.subVectors(this.max,vs),Ii.subVectors(t.a,vs),Di.subVectors(t.b,vs),Ui.subVectors(t.c,vs),zn.subVectors(Di,Ii),Hn.subVectors(Ui,Di),ai.subVectors(Ii,Ui);let e=[0,-zn.z,zn.y,0,-Hn.z,Hn.y,0,-ai.z,ai.y,zn.z,0,-zn.x,Hn.z,0,-Hn.x,ai.z,0,-ai.x,-zn.y,zn.x,0,-Hn.y,Hn.x,0,-ai.y,ai.x,0];return!Oo(e,Ii,Di,Ui,mr)||(e=[1,0,0,0,1,0,0,0,1],!Oo(e,Ii,Di,Ui,mr))?!1:(gr.crossVectors(zn,Hn),e=[gr.x,gr.y,gr.z],Oo(e,Ii,Di,Ui,mr))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,un).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(un).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(An[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),An[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),An[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),An[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),An[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),An[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),An[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),An[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(An),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}}const An=[new T,new T,new T,new T,new T,new T,new T,new T],un=new T,pr=new Ai,Ii=new T,Di=new T,Ui=new T,zn=new T,Hn=new T,ai=new T,vs=new T,mr=new T,gr=new T,li=new T;function Oo(i,t,e,n,s){for(let r=0,o=i.length-3;r<=o;r+=3){li.fromArray(i,r);const a=s.x*Math.abs(li.x)+s.y*Math.abs(li.y)+s.z*Math.abs(li.z),l=t.dot(li),c=e.dot(li),h=n.dot(li);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>a)return!1}return!0}const Rf=new Ai,_s=new T,Fo=new T;class si{constructor(t=new T,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):Rf.setFromPoints(t).getCenter(n);let s=0;for(let r=0,o=t.length;r<o;r++)s=Math.max(s,n.distanceToSquared(t[r]));return this.radius=Math.sqrt(s),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;_s.subVectors(t,this.center);const e=_s.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),s=(n-this.radius)*.5;this.center.addScaledVector(_s,s/n),this.radius+=s}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Fo.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(_s.copy(t.center).add(Fo)),this.expandByPoint(_s.copy(t.center).sub(Fo))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}}const Cn=new T,Bo=new T,vr=new T,Vn=new T,ko=new T,_r=new T,zo=new T;class Mo{constructor(t=new T,e=new T(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Cn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=Cn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Cn.copy(this.origin).addScaledVector(this.direction,e),Cn.distanceToSquared(t))}distanceSqToSegment(t,e,n,s){Bo.copy(t).add(e).multiplyScalar(.5),vr.copy(e).sub(t).normalize(),Vn.copy(this.origin).sub(Bo);const r=t.distanceTo(e)*.5,o=-this.direction.dot(vr),a=Vn.dot(this.direction),l=-Vn.dot(vr),c=Vn.lengthSq(),h=Math.abs(1-o*o);let u,d,f,g;if(h>0)if(u=o*l-a,d=o*a-l,g=r*h,u>=0)if(d>=-g)if(d<=g){const v=1/h;u*=v,d*=v,f=u*(u+o*d+2*a)+d*(o*u+d+2*l)+c}else d=r,u=Math.max(0,-(o*d+a)),f=-u*u+d*(d+2*l)+c;else d=-r,u=Math.max(0,-(o*d+a)),f=-u*u+d*(d+2*l)+c;else d<=-g?(u=Math.max(0,-(-o*r+a)),d=u>0?-r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c):d<=g?(u=0,d=Math.min(Math.max(-r,-l),r),f=d*(d+2*l)+c):(u=Math.max(0,-(o*r+a)),d=u>0?r:Math.min(Math.max(-r,-l),r),f=-u*u+d*(d+2*l)+c);else d=o>0?-r:r,u=Math.max(0,-(o*d+a)),f=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(Bo).addScaledVector(vr,d),f}intersectSphere(t,e){Cn.subVectors(t.center,this.origin);const n=Cn.dot(this.direction),s=Cn.dot(Cn)-n*n,r=t.radius*t.radius;if(s>r)return null;const o=Math.sqrt(r-s),a=n-o,l=n+o;return l<0?null:a<0?this.at(l,e):this.at(a,e)}intersectsSphere(t){return this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,s,r,o,a,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(t.min.x-d.x)*c,s=(t.max.x-d.x)*c):(n=(t.max.x-d.x)*c,s=(t.min.x-d.x)*c),h>=0?(r=(t.min.y-d.y)*h,o=(t.max.y-d.y)*h):(r=(t.max.y-d.y)*h,o=(t.min.y-d.y)*h),n>o||r>s||((r>n||isNaN(n))&&(n=r),(o<s||isNaN(s))&&(s=o),u>=0?(a=(t.min.z-d.z)*u,l=(t.max.z-d.z)*u):(a=(t.max.z-d.z)*u,l=(t.min.z-d.z)*u),n>l||a>s)||((a>n||n!==n)&&(n=a),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,e)}intersectsBox(t){return this.intersectBox(t,Cn)!==null}intersectTriangle(t,e,n,s,r){ko.subVectors(e,t),_r.subVectors(n,t),zo.crossVectors(ko,_r);let o=this.direction.dot(zo),a;if(o>0){if(s)return null;a=1}else if(o<0)a=-1,o=-o;else return null;Vn.subVectors(this.origin,t);const l=a*this.direction.dot(_r.crossVectors(Vn,_r));if(l<0)return null;const c=a*this.direction.dot(ko.cross(Vn));if(c<0||l+c>o)return null;const h=-a*Vn.dot(zo);return h<0?null:this.at(h/o,r)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Jt{constructor(t,e,n,s,r,o,a,l,c,h,u,d,f,g,v,m){Jt.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,s,r,o,a,l,c,h,u,d,f,g,v,m)}set(t,e,n,s,r,o,a,l,c,h,u,d,f,g,v,m){const p=this.elements;return p[0]=t,p[4]=e,p[8]=n,p[12]=s,p[1]=r,p[5]=o,p[9]=a,p[13]=l,p[2]=c,p[6]=h,p[10]=u,p[14]=d,p[3]=f,p[7]=g,p[11]=v,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Jt().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,s=1/Ni.setFromMatrixColumn(t,0).length(),r=1/Ni.setFromMatrixColumn(t,1).length(),o=1/Ni.setFromMatrixColumn(t,2).length();return e[0]=n[0]*s,e[1]=n[1]*s,e[2]=n[2]*s,e[3]=0,e[4]=n[4]*r,e[5]=n[5]*r,e[6]=n[6]*r,e[7]=0,e[8]=n[8]*o,e[9]=n[9]*o,e[10]=n[10]*o,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,s=t.y,r=t.z,o=Math.cos(n),a=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(r),u=Math.sin(r);if(t.order==="XYZ"){const d=o*h,f=o*u,g=a*h,v=a*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=f+g*c,e[5]=d-v*c,e[9]=-a*l,e[2]=v-d*c,e[6]=g+f*c,e[10]=o*l}else if(t.order==="YXZ"){const d=l*h,f=l*u,g=c*h,v=c*u;e[0]=d+v*a,e[4]=g*a-f,e[8]=o*c,e[1]=o*u,e[5]=o*h,e[9]=-a,e[2]=f*a-g,e[6]=v+d*a,e[10]=o*l}else if(t.order==="ZXY"){const d=l*h,f=l*u,g=c*h,v=c*u;e[0]=d-v*a,e[4]=-o*u,e[8]=g+f*a,e[1]=f+g*a,e[5]=o*h,e[9]=v-d*a,e[2]=-o*c,e[6]=a,e[10]=o*l}else if(t.order==="ZYX"){const d=o*h,f=o*u,g=a*h,v=a*u;e[0]=l*h,e[4]=g*c-f,e[8]=d*c+v,e[1]=l*u,e[5]=v*c+d,e[9]=f*c-g,e[2]=-c,e[6]=a*l,e[10]=o*l}else if(t.order==="YZX"){const d=o*l,f=o*c,g=a*l,v=a*c;e[0]=l*h,e[4]=v-d*u,e[8]=g*u+f,e[1]=u,e[5]=o*h,e[9]=-a*h,e[2]=-c*h,e[6]=f*u+g,e[10]=d-v*u}else if(t.order==="XZY"){const d=o*l,f=o*c,g=a*l,v=a*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=d*u+v,e[5]=o*h,e[9]=f*u-g,e[2]=g*u-f,e[6]=a*h,e[10]=v*u+d}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(Pf,t,Lf)}lookAt(t,e,n){const s=this.elements;return Ze.subVectors(t,e),Ze.lengthSq()===0&&(Ze.z=1),Ze.normalize(),Gn.crossVectors(n,Ze),Gn.lengthSq()===0&&(Math.abs(n.z)===1?Ze.x+=1e-4:Ze.z+=1e-4,Ze.normalize(),Gn.crossVectors(n,Ze)),Gn.normalize(),Mr.crossVectors(Ze,Gn),s[0]=Gn.x,s[4]=Mr.x,s[8]=Ze.x,s[1]=Gn.y,s[5]=Mr.y,s[9]=Ze.y,s[2]=Gn.z,s[6]=Mr.z,s[10]=Ze.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,s=e.elements,r=this.elements,o=n[0],a=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],f=n[13],g=n[2],v=n[6],m=n[10],p=n[14],x=n[3],M=n[7],_=n[11],I=n[15],E=s[0],C=s[4],P=s[8],b=s[12],y=s[1],R=s[5],O=s[9],N=s[13],U=s[2],F=s[6],V=s[10],K=s[14],q=s[3],D=s[7],G=s[11],et=s[15];return r[0]=o*E+a*y+l*U+c*q,r[4]=o*C+a*R+l*F+c*D,r[8]=o*P+a*O+l*V+c*G,r[12]=o*b+a*N+l*K+c*et,r[1]=h*E+u*y+d*U+f*q,r[5]=h*C+u*R+d*F+f*D,r[9]=h*P+u*O+d*V+f*G,r[13]=h*b+u*N+d*K+f*et,r[2]=g*E+v*y+m*U+p*q,r[6]=g*C+v*R+m*F+p*D,r[10]=g*P+v*O+m*V+p*G,r[14]=g*b+v*N+m*K+p*et,r[3]=x*E+M*y+_*U+I*q,r[7]=x*C+M*R+_*F+I*D,r[11]=x*P+M*O+_*V+I*G,r[15]=x*b+M*N+_*K+I*et,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],s=t[8],r=t[12],o=t[1],a=t[5],l=t[9],c=t[13],h=t[2],u=t[6],d=t[10],f=t[14],g=t[3],v=t[7],m=t[11],p=t[15];return g*(+r*l*u-s*c*u-r*a*d+n*c*d+s*a*f-n*l*f)+v*(+e*l*f-e*c*d+r*o*d-s*o*f+s*c*h-r*l*h)+m*(+e*c*u-e*a*f-r*o*u+n*o*f+r*a*h-n*c*h)+p*(-s*a*h-e*l*u+e*a*d+s*o*u-n*o*d+n*l*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const s=this.elements;return t.isVector3?(s[12]=t.x,s[13]=t.y,s[14]=t.z):(s[12]=t,s[13]=e,s[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],s=t[2],r=t[3],o=t[4],a=t[5],l=t[6],c=t[7],h=t[8],u=t[9],d=t[10],f=t[11],g=t[12],v=t[13],m=t[14],p=t[15],x=u*m*c-v*d*c+v*l*f-a*m*f-u*l*p+a*d*p,M=g*d*c-h*m*c-g*l*f+o*m*f+h*l*p-o*d*p,_=h*v*c-g*u*c+g*a*f-o*v*f-h*a*p+o*u*p,I=g*u*l-h*v*l-g*a*d+o*v*d+h*a*m-o*u*m,E=e*x+n*M+s*_+r*I;if(E===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const C=1/E;return t[0]=x*C,t[1]=(v*d*r-u*m*r-v*s*f+n*m*f+u*s*p-n*d*p)*C,t[2]=(a*m*r-v*l*r+v*s*c-n*m*c-a*s*p+n*l*p)*C,t[3]=(u*l*r-a*d*r-u*s*c+n*d*c+a*s*f-n*l*f)*C,t[4]=M*C,t[5]=(h*m*r-g*d*r+g*s*f-e*m*f-h*s*p+e*d*p)*C,t[6]=(g*l*r-o*m*r-g*s*c+e*m*c+o*s*p-e*l*p)*C,t[7]=(o*d*r-h*l*r+h*s*c-e*d*c-o*s*f+e*l*f)*C,t[8]=_*C,t[9]=(g*u*r-h*v*r-g*n*f+e*v*f+h*n*p-e*u*p)*C,t[10]=(o*v*r-g*a*r+g*n*c-e*v*c-o*n*p+e*a*p)*C,t[11]=(h*a*r-o*u*r-h*n*c+e*u*c+o*n*f-e*a*f)*C,t[12]=I*C,t[13]=(h*v*s-g*u*s+g*n*d-e*v*d-h*n*m+e*u*m)*C,t[14]=(g*a*s-o*v*s-g*n*l+e*v*l+o*n*m-e*a*m)*C,t[15]=(o*u*s-h*a*s+h*n*l-e*u*l-o*n*d+e*a*d)*C,this}scale(t){const e=this.elements,n=t.x,s=t.y,r=t.z;return e[0]*=n,e[4]*=s,e[8]*=r,e[1]*=n,e[5]*=s,e[9]*=r,e[2]*=n,e[6]*=s,e[10]*=r,e[3]*=n,e[7]*=s,e[11]*=r,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],s=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,s))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),s=Math.sin(e),r=1-n,o=t.x,a=t.y,l=t.z,c=r*o,h=r*a;return this.set(c*o+n,c*a-s*l,c*l+s*a,0,c*a+s*l,h*a+n,h*l-s*o,0,c*l-s*a,h*l+s*o,r*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,s,r,o){return this.set(1,n,r,0,t,1,o,0,e,s,1,0,0,0,0,1),this}compose(t,e,n){const s=this.elements,r=e._x,o=e._y,a=e._z,l=e._w,c=r+r,h=o+o,u=a+a,d=r*c,f=r*h,g=r*u,v=o*h,m=o*u,p=a*u,x=l*c,M=l*h,_=l*u,I=n.x,E=n.y,C=n.z;return s[0]=(1-(v+p))*I,s[1]=(f+_)*I,s[2]=(g-M)*I,s[3]=0,s[4]=(f-_)*E,s[5]=(1-(d+p))*E,s[6]=(m+x)*E,s[7]=0,s[8]=(g+M)*C,s[9]=(m-x)*C,s[10]=(1-(d+v))*C,s[11]=0,s[12]=t.x,s[13]=t.y,s[14]=t.z,s[15]=1,this}decompose(t,e,n){const s=this.elements;let r=Ni.set(s[0],s[1],s[2]).length();const o=Ni.set(s[4],s[5],s[6]).length(),a=Ni.set(s[8],s[9],s[10]).length();this.determinant()<0&&(r=-r),t.x=s[12],t.y=s[13],t.z=s[14],dn.copy(this);const c=1/r,h=1/o,u=1/a;return dn.elements[0]*=c,dn.elements[1]*=c,dn.elements[2]*=c,dn.elements[4]*=h,dn.elements[5]*=h,dn.elements[6]*=h,dn.elements[8]*=u,dn.elements[9]*=u,dn.elements[10]*=u,e.setFromRotationMatrix(dn),n.x=r,n.y=o,n.z=a,this}makePerspective(t,e,n,s,r,o,a=Un){const l=this.elements,c=2*r/(e-t),h=2*r/(n-s),u=(e+t)/(e-t),d=(n+s)/(n-s);let f,g;if(a===Un)f=-(o+r)/(o-r),g=-2*o*r/(o-r);else if(a===ao)f=-o/(o-r),g=-o*r/(o-r);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+a);return l[0]=c,l[4]=0,l[8]=u,l[12]=0,l[1]=0,l[5]=h,l[9]=d,l[13]=0,l[2]=0,l[6]=0,l[10]=f,l[14]=g,l[3]=0,l[7]=0,l[11]=-1,l[15]=0,this}makeOrthographic(t,e,n,s,r,o,a=Un){const l=this.elements,c=1/(e-t),h=1/(n-s),u=1/(o-r),d=(e+t)*c,f=(n+s)*h;let g,v;if(a===Un)g=(o+r)*u,v=-2*u;else if(a===ao)g=r*u,v=-1*u;else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+a);return l[0]=2*c,l[4]=0,l[8]=0,l[12]=-d,l[1]=0,l[5]=2*h,l[9]=0,l[13]=-f,l[2]=0,l[6]=0,l[10]=v,l[14]=-g,l[3]=0,l[7]=0,l[11]=0,l[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let s=0;s<16;s++)if(e[s]!==n[s])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const Ni=new T,dn=new Jt,Pf=new T(0,0,0),Lf=new T(1,1,1),Gn=new T,Mr=new T,Ze=new T,gc=new Jt,vc=new Me;class ln{constructor(t=0,e=0,n=0,s=ln.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=s}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,s=this._order){return this._x=t,this._y=e,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const s=t.elements,r=s[0],o=s[4],a=s[8],l=s[1],c=s[5],h=s[9],u=s[2],d=s[6],f=s[10];switch(e){case"XYZ":this._y=Math.asin(be(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(-h,f),this._z=Math.atan2(-o,r)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-be(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(a,f),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,r),this._z=0);break;case"ZXY":this._x=Math.asin(be(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-o,c)):(this._y=0,this._z=Math.atan2(l,r));break;case"ZYX":this._y=Math.asin(-be(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(l,r)):(this._x=0,this._z=Math.atan2(-o,c));break;case"YZX":this._z=Math.asin(be(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,r)):(this._x=0,this._y=Math.atan2(a,f));break;case"XZY":this._z=Math.asin(-be(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(a,r)):(this._x=Math.atan2(-h,f),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return gc.makeRotationFromQuaternion(t),this.setFromRotationMatrix(gc,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return vc.setFromEuler(this),this.setFromQuaternion(vc,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}ln.DEFAULT_ORDER="XYZ";class Fl{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let If=0;const _c=new T,Oi=new Me,Rn=new Jt,xr=new T,Ms=new T,Df=new T,Uf=new Me,Mc=new T(1,0,0),xc=new T(0,1,0),yc=new T(0,0,1),bc={type:"added"},Nf={type:"removed"},Fi={type:"childadded",child:null},Ho={type:"childremoved",child:null};class Pe extends Ei{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:If++}),this.uuid=Ti(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Pe.DEFAULT_UP.clone();const t=new T,e=new ln,n=new Me,s=new T(1,1,1);function r(){n.setFromEuler(e,!1)}function o(){e.setFromQuaternion(n,void 0,!1)}e._onChange(r),n._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new Jt},normalMatrix:{value:new Yt}}),this.matrix=new Jt,this.matrixWorld=new Jt,this.matrixAutoUpdate=Pe.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Pe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Fl,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Oi.setFromAxisAngle(t,e),this.quaternion.multiply(Oi),this}rotateOnWorldAxis(t,e){return Oi.setFromAxisAngle(t,e),this.quaternion.premultiply(Oi),this}rotateX(t){return this.rotateOnAxis(Mc,t)}rotateY(t){return this.rotateOnAxis(xc,t)}rotateZ(t){return this.rotateOnAxis(yc,t)}translateOnAxis(t,e){return _c.copy(t).applyQuaternion(this.quaternion),this.position.add(_c.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Mc,t)}translateY(t){return this.translateOnAxis(xc,t)}translateZ(t){return this.translateOnAxis(yc,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(Rn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?xr.copy(t):xr.set(t,e,n);const s=this.parent;this.updateWorldMatrix(!0,!1),Ms.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Rn.lookAt(Ms,xr,this.up):Rn.lookAt(xr,Ms,this.up),this.quaternion.setFromRotationMatrix(Rn),s&&(Rn.extractRotation(s.matrixWorld),Oi.setFromRotationMatrix(Rn),this.quaternion.premultiply(Oi.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent(bc),Fi.child=t,this.dispatchEvent(Fi),Fi.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Nf),Ho.child=t,this.dispatchEvent(Ho),Ho.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),Rn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),Rn.multiply(t.parent.matrixWorld)),t.applyMatrix4(Rn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent(bc),Fi.child=t,this.dispatchEvent(Fi),Fi.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,s=this.children.length;n<s;n++){const o=this.children[n].getObjectByProperty(t,e);if(o!==void 0)return o}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ms,t,Df),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Ms,Uf,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,s=e.length;n<s;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const s=this.children;for(let r=0,o=s.length;r<o;r++)s[r].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.6,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.visibility=this._visibility,s.active=this._active,s.bounds=this._bounds.map(a=>({boxInitialized:a.boxInitialized,boxMin:a.box.min.toArray(),boxMax:a.box.max.toArray(),sphereInitialized:a.sphereInitialized,sphereRadius:a.sphere.radius,sphereCenter:a.sphere.center.toArray()})),s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.geometryCount=this._geometryCount,s.matricesTexture=this._matricesTexture.toJSON(t),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(s.boundingSphere={center:s.boundingSphere.center.toArray(),radius:s.boundingSphere.radius}),this.boundingBox!==null&&(s.boundingBox={min:s.boundingBox.min.toArray(),max:s.boundingBox.max.toArray()}));function r(a,l){return a[l.uuid]===void 0&&(a[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=r(t.geometries,this.geometry);const a=this.geometry.parameters;if(a!==void 0&&a.shapes!==void 0){const l=a.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];r(t.shapes,u)}else r(t.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(r(t.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const a=[];for(let l=0,c=this.material.length;l<c;l++)a.push(r(t.materials,this.material[l]));s.material=a}else s.material=r(t.materials,this.material);if(this.children.length>0){s.children=[];for(let a=0;a<this.children.length;a++)s.children.push(this.children[a].toJSON(t).object)}if(this.animations.length>0){s.animations=[];for(let a=0;a<this.animations.length;a++){const l=this.animations[a];s.animations.push(r(t.animations,l))}}if(e){const a=o(t.geometries),l=o(t.materials),c=o(t.textures),h=o(t.images),u=o(t.shapes),d=o(t.skeletons),f=o(t.animations),g=o(t.nodes);a.length>0&&(n.geometries=a),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),f.length>0&&(n.animations=f),g.length>0&&(n.nodes=g)}return n.object=s,n;function o(a){const l=[];for(const c in a){const h=a[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const s=t.children[n];this.add(s.clone())}return this}}Pe.DEFAULT_UP=new T(0,1,0);Pe.DEFAULT_MATRIX_AUTO_UPDATE=!0;Pe.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const fn=new T,Pn=new T,Vo=new T,Ln=new T,Bi=new T,ki=new T,Sc=new T,Go=new T,Wo=new T,qo=new T,Yo=new ie,Xo=new ie,$o=new ie;class pn{constructor(t=new T,e=new T,n=new T){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,s){s.subVectors(n,e),fn.subVectors(t,e),s.cross(fn);const r=s.lengthSq();return r>0?s.multiplyScalar(1/Math.sqrt(r)):s.set(0,0,0)}static getBarycoord(t,e,n,s,r){fn.subVectors(s,e),Pn.subVectors(n,e),Vo.subVectors(t,e);const o=fn.dot(fn),a=fn.dot(Pn),l=fn.dot(Vo),c=Pn.dot(Pn),h=Pn.dot(Vo),u=o*c-a*a;if(u===0)return r.set(0,0,0),null;const d=1/u,f=(c*l-a*h)*d,g=(o*h-a*l)*d;return r.set(1-f-g,g,f)}static containsPoint(t,e,n,s){return this.getBarycoord(t,e,n,s,Ln)===null?!1:Ln.x>=0&&Ln.y>=0&&Ln.x+Ln.y<=1}static getInterpolation(t,e,n,s,r,o,a,l){return this.getBarycoord(t,e,n,s,Ln)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(r,Ln.x),l.addScaledVector(o,Ln.y),l.addScaledVector(a,Ln.z),l)}static getInterpolatedAttribute(t,e,n,s,r,o){return Yo.setScalar(0),Xo.setScalar(0),$o.setScalar(0),Yo.fromBufferAttribute(t,e),Xo.fromBufferAttribute(t,n),$o.fromBufferAttribute(t,s),o.setScalar(0),o.addScaledVector(Yo,r.x),o.addScaledVector(Xo,r.y),o.addScaledVector($o,r.z),o}static isFrontFacing(t,e,n,s){return fn.subVectors(n,e),Pn.subVectors(t,e),fn.cross(Pn).dot(s)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,s){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[s]),this}setFromAttributeAndIndices(t,e,n,s){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,s),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return fn.subVectors(this.c,this.b),Pn.subVectors(this.a,this.b),fn.cross(Pn).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return pn.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return pn.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,s,r){return pn.getInterpolation(t,this.a,this.b,this.c,e,n,s,r)}containsPoint(t){return pn.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return pn.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,s=this.b,r=this.c;let o,a;Bi.subVectors(s,n),ki.subVectors(r,n),Go.subVectors(t,n);const l=Bi.dot(Go),c=ki.dot(Go);if(l<=0&&c<=0)return e.copy(n);Wo.subVectors(t,s);const h=Bi.dot(Wo),u=ki.dot(Wo);if(h>=0&&u<=h)return e.copy(s);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return o=l/(l-h),e.copy(n).addScaledVector(Bi,o);qo.subVectors(t,r);const f=Bi.dot(qo),g=ki.dot(qo);if(g>=0&&f<=g)return e.copy(r);const v=f*c-l*g;if(v<=0&&c>=0&&g<=0)return a=c/(c-g),e.copy(n).addScaledVector(ki,a);const m=h*g-f*u;if(m<=0&&u-h>=0&&f-g>=0)return Sc.subVectors(r,s),a=(u-h)/(u-h+(f-g)),e.copy(s).addScaledVector(Sc,a);const p=1/(m+v+d);return o=v*p,a=d*p,e.copy(n).addScaledVector(Bi,o).addScaledVector(ki,a)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const bu={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Wn={h:0,s:0,l:0},yr={h:0,s:0,l:0};function jo(i,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?i+(t-i)*6*e:e<1/2?t:e<2/3?i+(t-i)*6*(2/3-e):i}class Et{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const s=t;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=we){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Qt.toWorkingColorSpace(this,e),this}setRGB(t,e,n,s=Qt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Qt.toWorkingColorSpace(this,s),this}setHSL(t,e,n,s=Qt.workingColorSpace){if(t=Nl(t,1),e=be(e,0,1),n=be(n,0,1),e===0)this.r=this.g=this.b=n;else{const r=n<=.5?n*(1+e):n+e-n*e,o=2*n-r;this.r=jo(o,r,t+1/3),this.g=jo(o,r,t),this.b=jo(o,r,t-1/3)}return Qt.toWorkingColorSpace(this,s),this}setStyle(t,e=we){function n(r){r!==void 0&&parseFloat(r)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(t)){let r;const o=s[1],a=s[2];switch(o){case"rgb":case"rgba":if(r=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(255,parseInt(r[1],10))/255,Math.min(255,parseInt(r[2],10))/255,Math.min(255,parseInt(r[3],10))/255,e);if(r=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setRGB(Math.min(100,parseInt(r[1],10))/100,Math.min(100,parseInt(r[2],10))/100,Math.min(100,parseInt(r[3],10))/100,e);break;case"hsl":case"hsla":if(r=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(a))return n(r[4]),this.setHSL(parseFloat(r[1])/360,parseFloat(r[2])/100,parseFloat(r[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(t)){const r=s[1],o=r.length;if(o===3)return this.setRGB(parseInt(r.charAt(0),16)/15,parseInt(r.charAt(1),16)/15,parseInt(r.charAt(2),16)/15,e);if(o===6)return this.setHex(parseInt(r,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=we){const n=bu[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Nn(t.r),this.g=Nn(t.g),this.b=Nn(t.b),this}copyLinearToSRGB(t){return this.r=ts(t.r),this.g=ts(t.g),this.b=ts(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=we){return Qt.fromWorkingColorSpace(ke.copy(this),t),Math.round(be(ke.r*255,0,255))*65536+Math.round(be(ke.g*255,0,255))*256+Math.round(be(ke.b*255,0,255))}getHexString(t=we){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Qt.workingColorSpace){Qt.fromWorkingColorSpace(ke.copy(this),e);const n=ke.r,s=ke.g,r=ke.b,o=Math.max(n,s,r),a=Math.min(n,s,r);let l,c;const h=(a+o)/2;if(a===o)l=0,c=0;else{const u=o-a;switch(c=h<=.5?u/(o+a):u/(2-o-a),o){case n:l=(s-r)/u+(s<r?6:0);break;case s:l=(r-n)/u+2;break;case r:l=(n-s)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=Qt.workingColorSpace){return Qt.fromWorkingColorSpace(ke.copy(this),e),t.r=ke.r,t.g=ke.g,t.b=ke.b,t}getStyle(t=we){Qt.fromWorkingColorSpace(ke.copy(this),t);const e=ke.r,n=ke.g,s=ke.b;return t!==we?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(t,e,n){return this.getHSL(Wn),this.setHSL(Wn.h+t,Wn.s+e,Wn.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(Wn),t.getHSL(yr);const n=Os(Wn.h,yr.h,e),s=Os(Wn.s,yr.s,e),r=Os(Wn.l,yr.l,e);return this.setHSL(n,s,r),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,s=this.b,r=t.elements;return this.r=r[0]*e+r[3]*n+r[6]*s,this.g=r[1]*e+r[4]*n+r[7]*s,this.b=r[2]*e+r[5]*n+r[8]*s,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const ke=new Et;Et.NAMES=bu;let Of=0;class us extends Ei{static get type(){return"Material"}get type(){return this.constructor.type}set type(t){}constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Of++}),this.uuid=Ti(),this.name="",this.blending=xi,this.side=bn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=Ua,this.blendDst=Xs,this.blendEquation=_n,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Et(0,0,0),this.blendAlpha=0,this.depthFunc=is,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=rc,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Pi,this.stencilZFail=Pi,this.stencilZPass=Pi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const s=this[e];if(s===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.6,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==xi&&(n.blending=this.blending),this.side!==bn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==Ua&&(n.blendSrc=this.blendSrc),this.blendDst!==Xs&&(n.blendDst=this.blendDst),this.blendEquation!==_n&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==is&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==rc&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Pi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Pi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Pi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(r){const o=[];for(const a in r){const l=r[a];delete l.metadata,o.push(l)}return o}if(e){const r=s(t.textures),o=s(t.images);r.length>0&&(n.textures=r),o.length>0&&(n.images=o)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const s=e.length;n=new Array(s);for(let r=0;r!==s;++r)n[r]=e[r].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}onBuild(){console.warn("Material: onBuild() has been removed.")}}class Sn extends us{static get type(){return"MeshBasicMaterial"}constructor(t){super(),this.isMeshBasicMaterial=!0,this.color=new Et(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ln,this.combine=ru,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const xe=new T,br=new H;class Re{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=oc,this.updateRanges=[],this.gpuType=xn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let s=0,r=this.itemSize;s<r;s++)this.array[t+s]=e.array[n+s];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)br.fromBufferAttribute(this,e),br.applyMatrix3(t),this.setXY(e,br.x,br.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)xe.fromBufferAttribute(this,e),xe.applyMatrix3(t),this.setXYZ(e,xe.x,xe.y,xe.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)xe.fromBufferAttribute(this,e),xe.applyMatrix4(t),this.setXYZ(e,xe.x,xe.y,xe.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)xe.fromBufferAttribute(this,e),xe.applyNormalMatrix(t),this.setXYZ(e,xe.x,xe.y,xe.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)xe.fromBufferAttribute(this,e),xe.transformDirection(t),this.setXYZ(e,xe.x,xe.y,xe.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=$i(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=Ge(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=$i(e,this.array)),e}setX(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=$i(e,this.array)),e}setY(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=$i(e,this.array)),e}setZ(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=$i(e,this.array)),e}setW(t,e){return this.normalized&&(e=Ge(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=Ge(e,this.array),n=Ge(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,s){return t*=this.itemSize,this.normalized&&(e=Ge(e,this.array),n=Ge(n,this.array),s=Ge(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this}setXYZW(t,e,n,s,r){return t*=this.itemSize,this.normalized&&(e=Ge(e,this.array),n=Ge(n,this.array),s=Ge(s,this.array),r=Ge(r,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=s,this.array[t+3]=r,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==oc&&(t.usage=this.usage),t}}class Su extends Re{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class wu extends Re{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class jt extends Re{constructor(t,e,n){super(new Float32Array(t),e,n)}}let Ff=0;const on=new Jt,Ko=new Pe,zi=new T,Je=new Ai,xs=new Ai,Ce=new T;class pe extends Ei{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Ff++}),this.uuid=Ti(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(Mu(t)?wu:Su)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const r=new Yt().getNormalMatrix(t);n.applyNormalMatrix(r),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(t),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return on.makeRotationFromQuaternion(t),this.applyMatrix4(on),this}rotateX(t){return on.makeRotationX(t),this.applyMatrix4(on),this}rotateY(t){return on.makeRotationY(t),this.applyMatrix4(on),this}rotateZ(t){return on.makeRotationZ(t),this.applyMatrix4(on),this}translate(t,e,n){return on.makeTranslation(t,e,n),this.applyMatrix4(on),this}scale(t,e,n){return on.makeScale(t,e,n),this.applyMatrix4(on),this}lookAt(t){return Ko.lookAt(t),Ko.updateMatrix(),this.applyMatrix4(Ko.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(zi).negate(),this.translate(zi.x,zi.y,zi.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const n=[];for(let s=0,r=t.length;s<r;s++){const o=t[s];n.push(o.x,o.y,o.z||0)}this.setAttribute("position",new jt(n,3))}else{for(let n=0,s=e.count;n<s;n++){const r=t[n];e.setXYZ(n,r.x,r.y,r.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Ai);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new T(-1/0,-1/0,-1/0),new T(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,s=e.length;n<s;n++){const r=e[n];Je.setFromBufferAttribute(r),this.morphTargetsRelative?(Ce.addVectors(this.boundingBox.min,Je.min),this.boundingBox.expandByPoint(Ce),Ce.addVectors(this.boundingBox.max,Je.max),this.boundingBox.expandByPoint(Ce)):(this.boundingBox.expandByPoint(Je.min),this.boundingBox.expandByPoint(Je.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new si);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new T,1/0);return}if(t){const n=this.boundingSphere.center;if(Je.setFromBufferAttribute(t),e)for(let r=0,o=e.length;r<o;r++){const a=e[r];xs.setFromBufferAttribute(a),this.morphTargetsRelative?(Ce.addVectors(Je.min,xs.min),Je.expandByPoint(Ce),Ce.addVectors(Je.max,xs.max),Je.expandByPoint(Ce)):(Je.expandByPoint(xs.min),Je.expandByPoint(xs.max))}Je.getCenter(n);let s=0;for(let r=0,o=t.count;r<o;r++)Ce.fromBufferAttribute(t,r),s=Math.max(s,n.distanceToSquared(Ce));if(e)for(let r=0,o=e.length;r<o;r++){const a=e[r],l=this.morphTargetsRelative;for(let c=0,h=a.count;c<h;c++)Ce.fromBufferAttribute(a,c),l&&(zi.fromBufferAttribute(t,c),Ce.add(zi)),s=Math.max(s,n.distanceToSquared(Ce))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.position,s=e.normal,r=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new Re(new Float32Array(4*n.count),4));const o=this.getAttribute("tangent"),a=[],l=[];for(let P=0;P<n.count;P++)a[P]=new T,l[P]=new T;const c=new T,h=new T,u=new T,d=new H,f=new H,g=new H,v=new T,m=new T;function p(P,b,y){c.fromBufferAttribute(n,P),h.fromBufferAttribute(n,b),u.fromBufferAttribute(n,y),d.fromBufferAttribute(r,P),f.fromBufferAttribute(r,b),g.fromBufferAttribute(r,y),h.sub(c),u.sub(c),f.sub(d),g.sub(d);const R=1/(f.x*g.y-g.x*f.y);isFinite(R)&&(v.copy(h).multiplyScalar(g.y).addScaledVector(u,-f.y).multiplyScalar(R),m.copy(u).multiplyScalar(f.x).addScaledVector(h,-g.x).multiplyScalar(R),a[P].add(v),a[b].add(v),a[y].add(v),l[P].add(m),l[b].add(m),l[y].add(m))}let x=this.groups;x.length===0&&(x=[{start:0,count:t.count}]);for(let P=0,b=x.length;P<b;++P){const y=x[P],R=y.start,O=y.count;for(let N=R,U=R+O;N<U;N+=3)p(t.getX(N+0),t.getX(N+1),t.getX(N+2))}const M=new T,_=new T,I=new T,E=new T;function C(P){I.fromBufferAttribute(s,P),E.copy(I);const b=a[P];M.copy(b),M.sub(I.multiplyScalar(I.dot(b))).normalize(),_.crossVectors(E,b);const R=_.dot(l[P])<0?-1:1;o.setXYZW(P,M.x,M.y,M.z,R)}for(let P=0,b=x.length;P<b;++P){const y=x[P],R=y.start,O=y.count;for(let N=R,U=R+O;N<U;N+=3)C(t.getX(N+0)),C(t.getX(N+1)),C(t.getX(N+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new Re(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let d=0,f=n.count;d<f;d++)n.setXYZ(d,0,0,0);const s=new T,r=new T,o=new T,a=new T,l=new T,c=new T,h=new T,u=new T;if(t)for(let d=0,f=t.count;d<f;d+=3){const g=t.getX(d+0),v=t.getX(d+1),m=t.getX(d+2);s.fromBufferAttribute(e,g),r.fromBufferAttribute(e,v),o.fromBufferAttribute(e,m),h.subVectors(o,r),u.subVectors(s,r),h.cross(u),a.fromBufferAttribute(n,g),l.fromBufferAttribute(n,v),c.fromBufferAttribute(n,m),a.add(h),l.add(h),c.add(h),n.setXYZ(g,a.x,a.y,a.z),n.setXYZ(v,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,f=e.count;d<f;d+=3)s.fromBufferAttribute(e,d+0),r.fromBufferAttribute(e,d+1),o.fromBufferAttribute(e,d+2),h.subVectors(o,r),u.subVectors(s,r),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Ce.fromBufferAttribute(t,e),Ce.normalize(),t.setXYZ(e,Ce.x,Ce.y,Ce.z)}toNonIndexed(){function t(a,l){const c=a.array,h=a.itemSize,u=a.normalized,d=new c.constructor(l.length*h);let f=0,g=0;for(let v=0,m=l.length;v<m;v++){a.isInterleavedBufferAttribute?f=l[v]*a.data.stride+a.offset:f=l[v]*h;for(let p=0;p<h;p++)d[g++]=c[f++]}return new Re(d,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new pe,n=this.index.array,s=this.attributes;for(const a in s){const l=s[a],c=t(l,n);e.setAttribute(a,c)}const r=this.morphAttributes;for(const a in r){const l=[],c=r[a];for(let h=0,u=c.length;h<u;h++){const d=c[h],f=t(d,n);l.push(f)}e.morphAttributes[a]=l}e.morphTargetsRelative=this.morphTargetsRelative;const o=this.groups;for(let a=0,l=o.length;a<l;a++){const c=o[a];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.6,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const l in n){const c=n[l];t.data.attributes[l]=c.toJSON(t.data)}const s={};let r=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const f=c[u];h.push(f.toJSON(t.data))}h.length>0&&(s[l]=h,r=!0)}r&&(t.data.morphAttributes=s,t.data.morphTargetsRelative=this.morphTargetsRelative);const o=this.groups;o.length>0&&(t.data.groups=JSON.parse(JSON.stringify(o)));const a=this.boundingSphere;return a!==null&&(t.data.boundingSphere={center:a.center.toArray(),radius:a.radius}),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone(e));const s=t.attributes;for(const c in s){const h=s[c];this.setAttribute(c,h.clone(e))}const r=t.morphAttributes;for(const c in r){const h=[],u=r[c];for(let d=0,f=u.length;d<f;d++)h.push(u[d].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;const o=t.groups;for(let c=0,h=o.length;c<h;c++){const u=o[c];this.addGroup(u.start,u.count,u.materialIndex)}const a=t.boundingBox;a!==null&&(this.boundingBox=a.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const wc=new Jt,ci=new Mo,Sr=new si,Ec=new T,wr=new T,Er=new T,Tr=new T,Zo=new T,Ar=new T,Tc=new T,Cr=new T;class tt extends Pe{constructor(t=new pe,e=new Sn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}getVertexPosition(t,e){const n=this.geometry,s=n.attributes.position,r=n.morphAttributes.position,o=n.morphTargetsRelative;e.fromBufferAttribute(s,t);const a=this.morphTargetInfluences;if(r&&a){Ar.set(0,0,0);for(let l=0,c=r.length;l<c;l++){const h=a[l],u=r[l];h!==0&&(Zo.fromBufferAttribute(u,t),o?Ar.addScaledVector(Zo,h):Ar.addScaledVector(Zo.sub(e),h))}e.add(Ar)}return e}raycast(t,e){const n=this.geometry,s=this.material,r=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Sr.copy(n.boundingSphere),Sr.applyMatrix4(r),ci.copy(t.ray).recast(t.near),!(Sr.containsPoint(ci.origin)===!1&&(ci.intersectSphere(Sr,Ec)===null||ci.origin.distanceToSquared(Ec)>(t.far-t.near)**2))&&(wc.copy(r).invert(),ci.copy(t.ray).applyMatrix4(wc),!(n.boundingBox!==null&&ci.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,ci)))}_computeIntersections(t,e,n){let s;const r=this.geometry,o=this.material,a=r.index,l=r.attributes.position,c=r.attributes.uv,h=r.attributes.uv1,u=r.attributes.normal,d=r.groups,f=r.drawRange;if(a!==null)if(Array.isArray(o))for(let g=0,v=d.length;g<v;g++){const m=d[g],p=o[m.materialIndex],x=Math.max(m.start,f.start),M=Math.min(a.count,Math.min(m.start+m.count,f.start+f.count));for(let _=x,I=M;_<I;_+=3){const E=a.getX(_),C=a.getX(_+1),P=a.getX(_+2);s=Rr(this,p,t,n,c,h,u,E,C,P),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{const g=Math.max(0,f.start),v=Math.min(a.count,f.start+f.count);for(let m=g,p=v;m<p;m+=3){const x=a.getX(m),M=a.getX(m+1),_=a.getX(m+2);s=Rr(this,o,t,n,c,h,u,x,M,_),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}else if(l!==void 0)if(Array.isArray(o))for(let g=0,v=d.length;g<v;g++){const m=d[g],p=o[m.materialIndex],x=Math.max(m.start,f.start),M=Math.min(l.count,Math.min(m.start+m.count,f.start+f.count));for(let _=x,I=M;_<I;_+=3){const E=_,C=_+1,P=_+2;s=Rr(this,p,t,n,c,h,u,E,C,P),s&&(s.faceIndex=Math.floor(_/3),s.face.materialIndex=m.materialIndex,e.push(s))}}else{const g=Math.max(0,f.start),v=Math.min(l.count,f.start+f.count);for(let m=g,p=v;m<p;m+=3){const x=m,M=m+1,_=m+2;s=Rr(this,o,t,n,c,h,u,x,M,_),s&&(s.faceIndex=Math.floor(m/3),e.push(s))}}}}function Bf(i,t,e,n,s,r,o,a){let l;if(t.side===Ye?l=n.intersectTriangle(o,r,s,!0,a):l=n.intersectTriangle(s,r,o,t.side===bn,a),l===null)return null;Cr.copy(a),Cr.applyMatrix4(i.matrixWorld);const c=e.ray.origin.distanceTo(Cr);return c<e.near||c>e.far?null:{distance:c,point:Cr.clone(),object:i}}function Rr(i,t,e,n,s,r,o,a,l,c){i.getVertexPosition(a,wr),i.getVertexPosition(l,Er),i.getVertexPosition(c,Tr);const h=Bf(i,t,e,n,wr,Er,Tr,Tc);if(h){const u=new T;pn.getBarycoord(Tc,wr,Er,Tr,u),s&&(h.uv=pn.getInterpolatedAttribute(s,a,l,c,u,new H)),r&&(h.uv1=pn.getInterpolatedAttribute(r,a,l,c,u,new H)),o&&(h.normal=pn.getInterpolatedAttribute(o,a,l,c,u,new T),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const d={a,b:l,c,normal:new T,materialIndex:0};pn.getNormal(wr,Er,Tr,d.normal),h.face=d,h.barycoord=u}return h}class qe extends pe{constructor(t=1,e=1,n=1,s=1,r=1,o=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:s,heightSegments:r,depthSegments:o};const a=this;s=Math.floor(s),r=Math.floor(r),o=Math.floor(o);const l=[],c=[],h=[],u=[];let d=0,f=0;g("z","y","x",-1,-1,n,e,t,o,r,0),g("z","y","x",1,-1,n,e,-t,o,r,1),g("x","z","y",1,1,t,n,e,s,o,2),g("x","z","y",1,-1,t,n,-e,s,o,3),g("x","y","z",1,-1,t,e,n,s,r,4),g("x","y","z",-1,-1,t,e,-n,s,r,5),this.setIndex(l),this.setAttribute("position",new jt(c,3)),this.setAttribute("normal",new jt(h,3)),this.setAttribute("uv",new jt(u,2));function g(v,m,p,x,M,_,I,E,C,P,b){const y=_/C,R=I/P,O=_/2,N=I/2,U=E/2,F=C+1,V=P+1;let K=0,q=0;const D=new T;for(let G=0;G<V;G++){const et=G*R-N;for(let dt=0;dt<F;dt++){const Ht=dt*y-O;D[v]=Ht*x,D[m]=et*M,D[p]=U,c.push(D.x,D.y,D.z),D[v]=0,D[m]=0,D[p]=E>0?1:-1,h.push(D.x,D.y,D.z),u.push(dt/C),u.push(1-G/P),K+=1}}for(let G=0;G<P;G++)for(let et=0;et<C;et++){const dt=d+et+F*G,Ht=d+et+F*(G+1),Q=d+(et+1)+F*(G+1),ot=d+(et+1)+F*G;l.push(dt,Ht,ot),l.push(Ht,Q,ot),q+=6}a.addGroup(f,q,b),f+=q,d+=K}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new qe(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function cs(i){const t={};for(const e in i){t[e]={};for(const n in i[e]){const s=i[e][n];s&&(s.isColor||s.isMatrix3||s.isMatrix4||s.isVector2||s.isVector3||s.isVector4||s.isTexture||s.isQuaternion)?s.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=s.clone():Array.isArray(s)?t[e][n]=s.slice():t[e][n]=s}}return t}function We(i){const t={};for(let e=0;e<i.length;e++){const n=cs(i[e]);for(const s in n)t[s]=n[s]}return t}function kf(i){const t=[];for(let e=0;e<i.length;e++)t.push(i[e].clone());return t}function Eu(i){const t=i.getRenderTarget();return t===null?i.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Qt.workingColorSpace}const zf={clone:cs,merge:We};var Hf=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,Vf=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class nn extends us{static get type(){return"ShaderMaterial"}constructor(t){super(),this.isShaderMaterial=!0,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=Hf,this.fragmentShader=Vf,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=cs(t.uniforms),this.uniformsGroups=kf(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const s in this.uniforms){const o=this.uniforms[s].value;o&&o.isTexture?e.uniforms[s]={type:"t",value:o.toJSON(t).uuid}:o&&o.isColor?e.uniforms[s]={type:"c",value:o.getHex()}:o&&o.isVector2?e.uniforms[s]={type:"v2",value:o.toArray()}:o&&o.isVector3?e.uniforms[s]={type:"v3",value:o.toArray()}:o&&o.isVector4?e.uniforms[s]={type:"v4",value:o.toArray()}:o&&o.isMatrix3?e.uniforms[s]={type:"m3",value:o.toArray()}:o&&o.isMatrix4?e.uniforms[s]={type:"m4",value:o.toArray()}:e.uniforms[s]={value:o}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class Tu extends Pe{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Jt,this.projectionMatrix=new Jt,this.projectionMatrixInverse=new Jt,this.coordinateSystem=Un}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const qn=new T,Ac=new H,Cc=new H;class tn extends Tu{constructor(t=50,e=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=js*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(Ns*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return js*2*Math.atan(Math.tan(Ns*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){qn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(qn.x,qn.y).multiplyScalar(-t/qn.z),qn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(qn.x,qn.y).multiplyScalar(-t/qn.z)}getViewSize(t,e){return this.getViewBounds(t,Ac,Cc),e.subVectors(Cc,Ac)}setViewOffset(t,e,n,s,r,o){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(Ns*.5*this.fov)/this.zoom,n=2*e,s=this.aspect*n,r=-.5*s;const o=this.view;if(this.view!==null&&this.view.enabled){const l=o.fullWidth,c=o.fullHeight;r+=o.offsetX*s/l,e-=o.offsetY*n/c,s*=o.width/l,n*=o.height/c}const a=this.filmOffset;a!==0&&(r+=t*a/this.getFilmWidth()),this.projectionMatrix.makePerspective(r,r+s,e,e-n,t,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const Hi=-90,Vi=1;class Gf extends Pe{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new tn(Hi,Vi,t,e);s.layers=this.layers,this.add(s);const r=new tn(Hi,Vi,t,e);r.layers=this.layers,this.add(r);const o=new tn(Hi,Vi,t,e);o.layers=this.layers,this.add(o);const a=new tn(Hi,Vi,t,e);a.layers=this.layers,this.add(a);const l=new tn(Hi,Vi,t,e);l.layers=this.layers,this.add(l);const c=new tn(Hi,Vi,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,s,r,o,a,l]=e;for(const c of e)this.remove(c);if(t===Un)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),r.up.set(0,0,-1),r.lookAt(0,1,0),o.up.set(0,0,1),o.lookAt(0,-1,0),a.up.set(0,1,0),a.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===ao)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),r.up.set(0,0,1),r.lookAt(0,1,0),o.up.set(0,0,-1),o.lookAt(0,-1,0),a.up.set(0,-1,0),a.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[r,o,a,l,c,h]=this.children,u=t.getRenderTarget(),d=t.getActiveCubeFace(),f=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const v=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,s),t.render(e,r),t.setRenderTarget(n,1,s),t.render(e,o),t.setRenderTarget(n,2,s),t.render(e,a),t.setRenderTarget(n,3,s),t.render(e,l),t.setRenderTarget(n,4,s),t.render(e,c),n.texture.generateMipmaps=v,t.setRenderTarget(n,5,s),t.render(e,h),t.setRenderTarget(u,d,f),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class Au extends Ve{constructor(t,e,n,s,r,o,a,l,c,h){t=t!==void 0?t:[],e=e!==void 0?e:ss,super(t,e,n,s,r,o,a,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class Wf extends Si{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},s=[n,n,n,n,n,n];this.texture=new Au(s,e.mapping,e.wrapS,e.wrapT,e.magFilter,e.minFilter,e.format,e.type,e.anisotropy,e.colorSpace),this.texture.isRenderTargetTexture=!0,this.texture.generateMipmaps=e.generateMipmaps!==void 0?e.generateMipmaps:!1,this.texture.minFilter=e.minFilter!==void 0?e.minFilter:Mn}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},s=new qe(5,5,5),r=new nn({name:"CubemapFromEquirect",uniforms:cs(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ye,blending:ti});r.uniforms.tEquirect.value=e;const o=new tt(s,r),a=e.minFilter;return e.minFilter===_i&&(e.minFilter=Mn),new Gf(1,10,this).update(t,o),e.minFilter=a,o.geometry.dispose(),o.material.dispose(),this}clear(t,e,n,s){const r=t.getRenderTarget();for(let o=0;o<6;o++)t.setRenderTarget(this,o),t.clear(e,n,s);t.setRenderTarget(r)}}const Jo=new T,qf=new T,Yf=new Yt;class Kn{constructor(t=new T(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,s){return this.normal.set(t,e,n),this.constant=s,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const s=Jo.subVectors(n,e).cross(qf.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(s,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(Jo),s=this.normal.dot(n);if(s===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const r=-(t.start.dot(this.normal)+this.constant)/s;return r<0||r>1?null:e.copy(t.start).addScaledVector(n,r)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||Yf.getNormalMatrix(t),s=this.coplanarPoint(Jo).applyMatrix4(t),r=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(r),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const hi=new si,Pr=new T;class Bl{constructor(t=new Kn,e=new Kn,n=new Kn,s=new Kn,r=new Kn,o=new Kn){this.planes=[t,e,n,s,r,o]}set(t,e,n,s,r,o){const a=this.planes;return a[0].copy(t),a[1].copy(e),a[2].copy(n),a[3].copy(s),a[4].copy(r),a[5].copy(o),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=Un){const n=this.planes,s=t.elements,r=s[0],o=s[1],a=s[2],l=s[3],c=s[4],h=s[5],u=s[6],d=s[7],f=s[8],g=s[9],v=s[10],m=s[11],p=s[12],x=s[13],M=s[14],_=s[15];if(n[0].setComponents(l-r,d-c,m-f,_-p).normalize(),n[1].setComponents(l+r,d+c,m+f,_+p).normalize(),n[2].setComponents(l+o,d+h,m+g,_+x).normalize(),n[3].setComponents(l-o,d-h,m-g,_-x).normalize(),n[4].setComponents(l-a,d-u,m-v,_-M).normalize(),e===Un)n[5].setComponents(l+a,d+u,m+v,_+M).normalize();else if(e===ao)n[5].setComponents(a,u,v,M).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),hi.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),hi.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(hi)}intersectsSprite(t){return hi.center.set(0,0,0),hi.radius=.7071067811865476,hi.applyMatrix4(t.matrixWorld),this.intersectsSphere(hi)}intersectsSphere(t){const e=this.planes,n=t.center,s=-t.radius;for(let r=0;r<6;r++)if(e[r].distanceToPoint(n)<s)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const s=e[n];if(Pr.x=s.normal.x>0?t.max.x:t.min.x,Pr.y=s.normal.y>0?t.max.y:t.min.y,Pr.z=s.normal.z>0?t.max.z:t.min.z,s.distanceToPoint(Pr)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}function Cu(){let i=null,t=!1,e=null,n=null;function s(r,o){e(r,o),n=i.requestAnimationFrame(s)}return{start:function(){t!==!0&&e!==null&&(n=i.requestAnimationFrame(s),t=!0)},stop:function(){i.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(r){e=r},setContext:function(r){i=r}}}function Xf(i){const t=new WeakMap;function e(a,l){const c=a.array,h=a.usage,u=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,h),a.onUploadCallback();let f;if(c instanceof Float32Array)f=i.FLOAT;else if(c instanceof Uint16Array)a.isFloat16BufferAttribute?f=i.HALF_FLOAT:f=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)f=i.SHORT;else if(c instanceof Uint32Array)f=i.UNSIGNED_INT;else if(c instanceof Int32Array)f=i.INT;else if(c instanceof Int8Array)f=i.BYTE;else if(c instanceof Uint8Array)f=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)f=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:f,bytesPerElement:c.BYTES_PER_ELEMENT,version:a.version,size:u}}function n(a,l,c){const h=l.array,u=l.updateRanges;if(i.bindBuffer(c,a),u.length===0)i.bufferSubData(c,0,h);else{u.sort((f,g)=>f.start-g.start);let d=0;for(let f=1;f<u.length;f++){const g=u[d],v=u[f];v.start<=g.start+g.count+1?g.count=Math.max(g.count,v.start+v.count-g.start):(++d,u[d]=v)}u.length=d+1;for(let f=0,g=u.length;f<g;f++){const v=u[f];i.bufferSubData(c,v.start*h.BYTES_PER_ELEMENT,h,v.start,v.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(a){return a.isInterleavedBufferAttribute&&(a=a.data),t.get(a)}function r(a){a.isInterleavedBufferAttribute&&(a=a.data);const l=t.get(a);l&&(i.deleteBuffer(l.buffer),t.delete(a))}function o(a,l){if(a.isInterleavedBufferAttribute&&(a=a.data),a.isGLBufferAttribute){const h=t.get(a);(!h||h.version<a.version)&&t.set(a,{buffer:a.buffer,type:a.type,bytesPerElement:a.elementSize,version:a.version});return}const c=t.get(a);if(c===void 0)t.set(a,e(a,l));else if(c.version<a.version){if(c.size!==a.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,a,l),c.version=a.version}}return{get:s,remove:r,update:o}}class ze extends pe{constructor(t=1,e=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:s};const r=t/2,o=e/2,a=Math.floor(n),l=Math.floor(s),c=a+1,h=l+1,u=t/a,d=e/l,f=[],g=[],v=[],m=[];for(let p=0;p<h;p++){const x=p*d-o;for(let M=0;M<c;M++){const _=M*u-r;g.push(_,-x,0),v.push(0,0,1),m.push(M/a),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let x=0;x<a;x++){const M=x+c*p,_=x+c*(p+1),I=x+1+c*(p+1),E=x+1+c*p;f.push(M,_,E),f.push(_,I,E)}this.setIndex(f),this.setAttribute("position",new jt(g,3)),this.setAttribute("normal",new jt(v,3)),this.setAttribute("uv",new jt(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ze(t.width,t.height,t.widthSegments,t.heightSegments)}}var $f=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,jf=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Kf=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Zf=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Jf=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Qf=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,tp=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,ep=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,np=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,ip=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,sp=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,rp=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,op=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,ap=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,lp=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,cp=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,hp=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,up=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,dp=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,fp=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,pp=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,mp=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,gp=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,vp=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,_p=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Mp=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,xp=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,yp=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,bp=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Sp=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,wp="gl_FragColor = linearToOutputTexel( gl_FragColor );",Ep=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Tp=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,Ap=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,Cp=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,Rp=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Pp=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Lp=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Ip=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Dp=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Up=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Np=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Op=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Fp=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,Bp=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,kp=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,zp=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Hp=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Vp=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Gp=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Wp=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,qp=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Yp=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Xp=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,$p=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,jp=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Kp=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Zp=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Jp=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Qp=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,tm=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,em=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,nm=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,im=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,sm=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,rm=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,om=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,am=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,lm=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,cm=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,hm=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,um=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,dm=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,fm=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,pm=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,mm=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,gm=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,vm=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,_m=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Mm=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,xm=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,ym=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,bm=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,Sm=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,wm=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Em=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,Tm=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Am=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Cm=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Rm=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		return step( compare, unpackRGBAToDepth( texture2D( depths, uv ) ) );
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		float hard_shadow = step( compare , distribution.x );
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,Pm=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Lm=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Im=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Dm=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,Um=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Nm=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Om=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Fm=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,Bm=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,km=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,zm=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Hm=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Vm=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
		
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
		
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		
		#else
		
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Gm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Wm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,qm=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Ym=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Xm=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,$m=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,jm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Km=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Zm=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Jm=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Qm=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,t0=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,e0=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,n0=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,i0=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,s0=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,r0=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,o0=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,a0=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,l0=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,c0=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,h0=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,u0=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,d0=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,f0=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,p0=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,m0=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,g0=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,v0=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,_0=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,M0=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,x0=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,y0=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,b0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,S0=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,w0=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,E0=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,T0=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,$t={alphahash_fragment:$f,alphahash_pars_fragment:jf,alphamap_fragment:Kf,alphamap_pars_fragment:Zf,alphatest_fragment:Jf,alphatest_pars_fragment:Qf,aomap_fragment:tp,aomap_pars_fragment:ep,batching_pars_vertex:np,batching_vertex:ip,begin_vertex:sp,beginnormal_vertex:rp,bsdfs:op,iridescence_fragment:ap,bumpmap_pars_fragment:lp,clipping_planes_fragment:cp,clipping_planes_pars_fragment:hp,clipping_planes_pars_vertex:up,clipping_planes_vertex:dp,color_fragment:fp,color_pars_fragment:pp,color_pars_vertex:mp,color_vertex:gp,common:vp,cube_uv_reflection_fragment:_p,defaultnormal_vertex:Mp,displacementmap_pars_vertex:xp,displacementmap_vertex:yp,emissivemap_fragment:bp,emissivemap_pars_fragment:Sp,colorspace_fragment:wp,colorspace_pars_fragment:Ep,envmap_fragment:Tp,envmap_common_pars_fragment:Ap,envmap_pars_fragment:Cp,envmap_pars_vertex:Rp,envmap_physical_pars_fragment:zp,envmap_vertex:Pp,fog_vertex:Lp,fog_pars_vertex:Ip,fog_fragment:Dp,fog_pars_fragment:Up,gradientmap_pars_fragment:Np,lightmap_pars_fragment:Op,lights_lambert_fragment:Fp,lights_lambert_pars_fragment:Bp,lights_pars_begin:kp,lights_toon_fragment:Hp,lights_toon_pars_fragment:Vp,lights_phong_fragment:Gp,lights_phong_pars_fragment:Wp,lights_physical_fragment:qp,lights_physical_pars_fragment:Yp,lights_fragment_begin:Xp,lights_fragment_maps:$p,lights_fragment_end:jp,logdepthbuf_fragment:Kp,logdepthbuf_pars_fragment:Zp,logdepthbuf_pars_vertex:Jp,logdepthbuf_vertex:Qp,map_fragment:tm,map_pars_fragment:em,map_particle_fragment:nm,map_particle_pars_fragment:im,metalnessmap_fragment:sm,metalnessmap_pars_fragment:rm,morphinstance_vertex:om,morphcolor_vertex:am,morphnormal_vertex:lm,morphtarget_pars_vertex:cm,morphtarget_vertex:hm,normal_fragment_begin:um,normal_fragment_maps:dm,normal_pars_fragment:fm,normal_pars_vertex:pm,normal_vertex:mm,normalmap_pars_fragment:gm,clearcoat_normal_fragment_begin:vm,clearcoat_normal_fragment_maps:_m,clearcoat_pars_fragment:Mm,iridescence_pars_fragment:xm,opaque_fragment:ym,packing:bm,premultiplied_alpha_fragment:Sm,project_vertex:wm,dithering_fragment:Em,dithering_pars_fragment:Tm,roughnessmap_fragment:Am,roughnessmap_pars_fragment:Cm,shadowmap_pars_fragment:Rm,shadowmap_pars_vertex:Pm,shadowmap_vertex:Lm,shadowmask_pars_fragment:Im,skinbase_vertex:Dm,skinning_pars_vertex:Um,skinning_vertex:Nm,skinnormal_vertex:Om,specularmap_fragment:Fm,specularmap_pars_fragment:Bm,tonemapping_fragment:km,tonemapping_pars_fragment:zm,transmission_fragment:Hm,transmission_pars_fragment:Vm,uv_pars_fragment:Gm,uv_pars_vertex:Wm,uv_vertex:qm,worldpos_vertex:Ym,background_vert:Xm,background_frag:$m,backgroundCube_vert:jm,backgroundCube_frag:Km,cube_vert:Zm,cube_frag:Jm,depth_vert:Qm,depth_frag:t0,distanceRGBA_vert:e0,distanceRGBA_frag:n0,equirect_vert:i0,equirect_frag:s0,linedashed_vert:r0,linedashed_frag:o0,meshbasic_vert:a0,meshbasic_frag:l0,meshlambert_vert:c0,meshlambert_frag:h0,meshmatcap_vert:u0,meshmatcap_frag:d0,meshnormal_vert:f0,meshnormal_frag:p0,meshphong_vert:m0,meshphong_frag:g0,meshphysical_vert:v0,meshphysical_frag:_0,meshtoon_vert:M0,meshtoon_frag:x0,points_vert:y0,points_frag:b0,shadow_vert:S0,shadow_frag:w0,sprite_vert:E0,sprite_frag:T0},gt={common:{diffuse:{value:new Et(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Yt},alphaMap:{value:null},alphaMapTransform:{value:new Yt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Yt}},envmap:{envMap:{value:null},envMapRotation:{value:new Yt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Yt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Yt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Yt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Yt},normalScale:{value:new H(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Yt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Yt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Yt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Yt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Et(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Et(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Yt},alphaTest:{value:0},uvTransform:{value:new Yt}},sprite:{diffuse:{value:new Et(16777215)},opacity:{value:1},center:{value:new H(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Yt},alphaMap:{value:null},alphaMapTransform:{value:new Yt},alphaTest:{value:0}}},vn={basic:{uniforms:We([gt.common,gt.specularmap,gt.envmap,gt.aomap,gt.lightmap,gt.fog]),vertexShader:$t.meshbasic_vert,fragmentShader:$t.meshbasic_frag},lambert:{uniforms:We([gt.common,gt.specularmap,gt.envmap,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.fog,gt.lights,{emissive:{value:new Et(0)}}]),vertexShader:$t.meshlambert_vert,fragmentShader:$t.meshlambert_frag},phong:{uniforms:We([gt.common,gt.specularmap,gt.envmap,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.fog,gt.lights,{emissive:{value:new Et(0)},specular:{value:new Et(1118481)},shininess:{value:30}}]),vertexShader:$t.meshphong_vert,fragmentShader:$t.meshphong_frag},standard:{uniforms:We([gt.common,gt.envmap,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.roughnessmap,gt.metalnessmap,gt.fog,gt.lights,{emissive:{value:new Et(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:$t.meshphysical_vert,fragmentShader:$t.meshphysical_frag},toon:{uniforms:We([gt.common,gt.aomap,gt.lightmap,gt.emissivemap,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.gradientmap,gt.fog,gt.lights,{emissive:{value:new Et(0)}}]),vertexShader:$t.meshtoon_vert,fragmentShader:$t.meshtoon_frag},matcap:{uniforms:We([gt.common,gt.bumpmap,gt.normalmap,gt.displacementmap,gt.fog,{matcap:{value:null}}]),vertexShader:$t.meshmatcap_vert,fragmentShader:$t.meshmatcap_frag},points:{uniforms:We([gt.points,gt.fog]),vertexShader:$t.points_vert,fragmentShader:$t.points_frag},dashed:{uniforms:We([gt.common,gt.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:$t.linedashed_vert,fragmentShader:$t.linedashed_frag},depth:{uniforms:We([gt.common,gt.displacementmap]),vertexShader:$t.depth_vert,fragmentShader:$t.depth_frag},normal:{uniforms:We([gt.common,gt.bumpmap,gt.normalmap,gt.displacementmap,{opacity:{value:1}}]),vertexShader:$t.meshnormal_vert,fragmentShader:$t.meshnormal_frag},sprite:{uniforms:We([gt.sprite,gt.fog]),vertexShader:$t.sprite_vert,fragmentShader:$t.sprite_frag},background:{uniforms:{uvTransform:{value:new Yt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:$t.background_vert,fragmentShader:$t.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Yt}},vertexShader:$t.backgroundCube_vert,fragmentShader:$t.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:$t.cube_vert,fragmentShader:$t.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:$t.equirect_vert,fragmentShader:$t.equirect_frag},distanceRGBA:{uniforms:We([gt.common,gt.displacementmap,{referencePosition:{value:new T},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:$t.distanceRGBA_vert,fragmentShader:$t.distanceRGBA_frag},shadow:{uniforms:We([gt.lights,gt.fog,{color:{value:new Et(0)},opacity:{value:1}}]),vertexShader:$t.shadow_vert,fragmentShader:$t.shadow_frag}};vn.physical={uniforms:We([vn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Yt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Yt},clearcoatNormalScale:{value:new H(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Yt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Yt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Yt},sheen:{value:0},sheenColor:{value:new Et(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Yt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Yt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Yt},transmissionSamplerSize:{value:new H},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Yt},attenuationDistance:{value:0},attenuationColor:{value:new Et(0)},specularColor:{value:new Et(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Yt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Yt},anisotropyVector:{value:new H},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Yt}}]),vertexShader:$t.meshphysical_vert,fragmentShader:$t.meshphysical_frag};const Lr={r:0,b:0,g:0},ui=new ln,A0=new Jt;function C0(i,t,e,n,s,r,o){const a=new Et(0);let l=r===!0?0:1,c,h,u=null,d=0,f=null;function g(x){let M=x.isScene===!0?x.background:null;return M&&M.isTexture&&(M=(x.backgroundBlurriness>0?e:t).get(M)),M}function v(x){let M=!1;const _=g(x);_===null?p(a,l):_&&_.isColor&&(p(_,1),M=!0);const I=i.xr.getEnvironmentBlendMode();I==="additive"?n.buffers.color.setClear(0,0,0,1,o):I==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,o),(i.autoClear||M)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function m(x,M){const _=g(M);_&&(_.isCubeTexture||_.mapping===vo)?(h===void 0&&(h=new tt(new qe(1,1,1),new nn({name:"BackgroundCubeMaterial",uniforms:cs(vn.backgroundCube.uniforms),vertexShader:vn.backgroundCube.vertexShader,fragmentShader:vn.backgroundCube.fragmentShader,side:Ye,depthTest:!1,depthWrite:!1,fog:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(I,E,C){this.matrixWorld.copyPosition(C.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),s.update(h)),ui.copy(M.backgroundRotation),ui.x*=-1,ui.y*=-1,ui.z*=-1,_.isCubeTexture&&_.isRenderTargetTexture===!1&&(ui.y*=-1,ui.z*=-1),h.material.uniforms.envMap.value=_,h.material.uniforms.flipEnvMap.value=_.isCubeTexture&&_.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=M.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(A0.makeRotationFromEuler(ui)),h.material.toneMapped=Qt.getTransfer(_.colorSpace)!==ae,(u!==_||d!==_.version||f!==i.toneMapping)&&(h.material.needsUpdate=!0,u=_,d=_.version,f=i.toneMapping),h.layers.enableAll(),x.unshift(h,h.geometry,h.material,0,0,null)):_&&_.isTexture&&(c===void 0&&(c=new tt(new ze(2,2),new nn({name:"BackgroundMaterial",uniforms:cs(vn.background.uniforms),vertexShader:vn.background.vertexShader,fragmentShader:vn.background.fragmentShader,side:bn,depthTest:!1,depthWrite:!1,fog:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),s.update(c)),c.material.uniforms.t2D.value=_,c.material.uniforms.backgroundIntensity.value=M.backgroundIntensity,c.material.toneMapped=Qt.getTransfer(_.colorSpace)!==ae,_.matrixAutoUpdate===!0&&_.updateMatrix(),c.material.uniforms.uvTransform.value.copy(_.matrix),(u!==_||d!==_.version||f!==i.toneMapping)&&(c.material.needsUpdate=!0,u=_,d=_.version,f=i.toneMapping),c.layers.enableAll(),x.unshift(c,c.geometry,c.material,0,0,null))}function p(x,M){x.getRGB(Lr,Eu(i)),n.buffers.color.setClear(Lr.r,Lr.g,Lr.b,M,o)}return{getClearColor:function(){return a},setClearColor:function(x,M=1){a.set(x),l=M,p(a,l)},getClearAlpha:function(){return l},setClearAlpha:function(x){l=x,p(a,l)},render:v,addToRenderList:m}}function R0(i,t){const e=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let r=s,o=!1;function a(y,R,O,N,U){let F=!1;const V=u(N,O,R);r!==V&&(r=V,c(r.object)),F=f(y,N,O,U),F&&g(y,N,O,U),U!==null&&t.update(U,i.ELEMENT_ARRAY_BUFFER),(F||o)&&(o=!1,_(y,R,O,N),U!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,t.get(U).buffer))}function l(){return i.createVertexArray()}function c(y){return i.bindVertexArray(y)}function h(y){return i.deleteVertexArray(y)}function u(y,R,O){const N=O.wireframe===!0;let U=n[y.id];U===void 0&&(U={},n[y.id]=U);let F=U[R.id];F===void 0&&(F={},U[R.id]=F);let V=F[N];return V===void 0&&(V=d(l()),F[N]=V),V}function d(y){const R=[],O=[],N=[];for(let U=0;U<e;U++)R[U]=0,O[U]=0,N[U]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:R,enabledAttributes:O,attributeDivisors:N,object:y,attributes:{},index:null}}function f(y,R,O,N){const U=r.attributes,F=R.attributes;let V=0;const K=O.getAttributes();for(const q in K)if(K[q].location>=0){const G=U[q];let et=F[q];if(et===void 0&&(q==="instanceMatrix"&&y.instanceMatrix&&(et=y.instanceMatrix),q==="instanceColor"&&y.instanceColor&&(et=y.instanceColor)),G===void 0||G.attribute!==et||et&&G.data!==et.data)return!0;V++}return r.attributesNum!==V||r.index!==N}function g(y,R,O,N){const U={},F=R.attributes;let V=0;const K=O.getAttributes();for(const q in K)if(K[q].location>=0){let G=F[q];G===void 0&&(q==="instanceMatrix"&&y.instanceMatrix&&(G=y.instanceMatrix),q==="instanceColor"&&y.instanceColor&&(G=y.instanceColor));const et={};et.attribute=G,G&&G.data&&(et.data=G.data),U[q]=et,V++}r.attributes=U,r.attributesNum=V,r.index=N}function v(){const y=r.newAttributes;for(let R=0,O=y.length;R<O;R++)y[R]=0}function m(y){p(y,0)}function p(y,R){const O=r.newAttributes,N=r.enabledAttributes,U=r.attributeDivisors;O[y]=1,N[y]===0&&(i.enableVertexAttribArray(y),N[y]=1),U[y]!==R&&(i.vertexAttribDivisor(y,R),U[y]=R)}function x(){const y=r.newAttributes,R=r.enabledAttributes;for(let O=0,N=R.length;O<N;O++)R[O]!==y[O]&&(i.disableVertexAttribArray(O),R[O]=0)}function M(y,R,O,N,U,F,V){V===!0?i.vertexAttribIPointer(y,R,O,U,F):i.vertexAttribPointer(y,R,O,N,U,F)}function _(y,R,O,N){v();const U=N.attributes,F=O.getAttributes(),V=R.defaultAttributeValues;for(const K in F){const q=F[K];if(q.location>=0){let D=U[K];if(D===void 0&&(K==="instanceMatrix"&&y.instanceMatrix&&(D=y.instanceMatrix),K==="instanceColor"&&y.instanceColor&&(D=y.instanceColor)),D!==void 0){const G=D.normalized,et=D.itemSize,dt=t.get(D);if(dt===void 0)continue;const Ht=dt.buffer,Q=dt.type,ot=dt.bytesPerElement,mt=Q===i.INT||Q===i.UNSIGNED_INT||D.gpuType===Cl;if(D.isInterleavedBufferAttribute){const lt=D.data,Pt=lt.stride,Ft=D.offset;if(lt.isInstancedInterleavedBuffer){for(let ft=0;ft<q.locationSize;ft++)p(q.location+ft,lt.meshPerAttribute);y.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=lt.meshPerAttribute*lt.count)}else for(let ft=0;ft<q.locationSize;ft++)m(q.location+ft);i.bindBuffer(i.ARRAY_BUFFER,Ht);for(let ft=0;ft<q.locationSize;ft++)M(q.location+ft,et/q.locationSize,Q,G,Pt*ot,(Ft+et/q.locationSize*ft)*ot,mt)}else{if(D.isInstancedBufferAttribute){for(let lt=0;lt<q.locationSize;lt++)p(q.location+lt,D.meshPerAttribute);y.isInstancedMesh!==!0&&N._maxInstanceCount===void 0&&(N._maxInstanceCount=D.meshPerAttribute*D.count)}else for(let lt=0;lt<q.locationSize;lt++)m(q.location+lt);i.bindBuffer(i.ARRAY_BUFFER,Ht);for(let lt=0;lt<q.locationSize;lt++)M(q.location+lt,et/q.locationSize,Q,G,et*ot,et/q.locationSize*lt*ot,mt)}}else if(V!==void 0){const G=V[K];if(G!==void 0)switch(G.length){case 2:i.vertexAttrib2fv(q.location,G);break;case 3:i.vertexAttrib3fv(q.location,G);break;case 4:i.vertexAttrib4fv(q.location,G);break;default:i.vertexAttrib1fv(q.location,G)}}}}x()}function I(){P();for(const y in n){const R=n[y];for(const O in R){const N=R[O];for(const U in N)h(N[U].object),delete N[U];delete R[O]}delete n[y]}}function E(y){if(n[y.id]===void 0)return;const R=n[y.id];for(const O in R){const N=R[O];for(const U in N)h(N[U].object),delete N[U];delete R[O]}delete n[y.id]}function C(y){for(const R in n){const O=n[R];if(O[y.id]===void 0)continue;const N=O[y.id];for(const U in N)h(N[U].object),delete N[U];delete O[y.id]}}function P(){b(),o=!0,r!==s&&(r=s,c(r.object))}function b(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:a,reset:P,resetDefaultState:b,dispose:I,releaseStatesOfGeometry:E,releaseStatesOfProgram:C,initAttributes:v,enableAttribute:m,disableUnusedAttributes:x}}function P0(i,t,e){let n;function s(c){n=c}function r(c,h){i.drawArrays(n,c,h),e.update(h,n,1)}function o(c,h,u){u!==0&&(i.drawArraysInstanced(n,c,h,u),e.update(h,n,u))}function a(c,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,u);let f=0;for(let g=0;g<u;g++)f+=h[g];e.update(f,n,1)}function l(c,h,u,d){if(u===0)return;const f=t.get("WEBGL_multi_draw");if(f===null)for(let g=0;g<c.length;g++)o(c[g],h[g],d[g]);else{f.multiDrawArraysInstancedWEBGL(n,c,0,h,0,d,0,u);let g=0;for(let v=0;v<u;v++)g+=h[v]*d[v];e.update(g,n,1)}}this.setMode=s,this.render=r,this.renderInstances=o,this.renderMultiDraw=a,this.renderMultiDrawInstances=l}function L0(i,t,e,n){let s;function r(){if(s!==void 0)return s;if(t.has("EXT_texture_filter_anisotropic")===!0){const C=t.get("EXT_texture_filter_anisotropic");s=i.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function o(C){return!(C!==mn&&n.convert(C)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function a(C){const P=C===sr&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(C!==On&&n.convert(C)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&C!==xn&&!P)}function l(C){if(C==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp";const h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=e.logarithmicDepthBuffer===!0,d=e.reverseDepthBuffer===!0&&t.has("EXT_clip_control"),f=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),v=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),p=i.getParameter(i.MAX_VERTEX_ATTRIBS),x=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),M=i.getParameter(i.MAX_VARYING_VECTORS),_=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),I=g>0,E=i.getParameter(i.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:l,textureFormatReadable:o,textureTypeReadable:a,precision:c,logarithmicDepthBuffer:u,reverseDepthBuffer:d,maxTextures:f,maxVertexTextures:g,maxTextureSize:v,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:x,maxVaryings:M,maxFragmentUniforms:_,vertexTextures:I,maxSamples:E}}function I0(i){const t=this;let e=null,n=0,s=!1,r=!1;const o=new Kn,a=new Yt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const f=u.length!==0||d||n!==0||s;return s=d,n=u.length,f},this.beginShadows=function(){r=!0,h(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(u,d){e=h(u,d,0)},this.setState=function(u,d,f){const g=u.clippingPlanes,v=u.clipIntersection,m=u.clipShadows,p=i.get(u);if(!s||g===null||g.length===0||r&&!m)r?h(null):c();else{const x=r?0:n,M=x*4;let _=p.clippingState||null;l.value=_,_=h(g,d,M,f);for(let I=0;I!==M;++I)_[I]=e[I];p.clippingState=_,this.numIntersection=v?this.numPlanes:0,this.numPlanes+=x}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,d,f,g){const v=u!==null?u.length:0;let m=null;if(v!==0){if(m=l.value,g!==!0||m===null){const p=f+v*4,x=d.matrixWorldInverse;a.getNormalMatrix(x),(m===null||m.length<p)&&(m=new Float32Array(p));for(let M=0,_=f;M!==v;++M,_+=4)o.copy(u[M]).applyMatrix4(x,a),o.normal.toArray(m,_),m[_+3]=o.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=v,t.numIntersection=0,m}}function D0(i){let t=new WeakMap;function e(o,a){return a===Va?o.mapping=ss:a===Ga&&(o.mapping=rs),o}function n(o){if(o&&o.isTexture){const a=o.mapping;if(a===Va||a===Ga)if(t.has(o)){const l=t.get(o).texture;return e(l,o.mapping)}else{const l=o.image;if(l&&l.height>0){const c=new Wf(l.height);return c.fromEquirectangularTexture(i,o),t.set(o,c),o.addEventListener("dispose",s),e(c.texture,o.mapping)}else return null}}return o}function s(o){const a=o.target;a.removeEventListener("dispose",s);const l=t.get(a);l!==void 0&&(t.delete(a),l.dispose())}function r(){t=new WeakMap}return{get:n,dispose:r}}class Ru extends Tu{constructor(t=-1,e=1,n=1,s=-1,r=.1,o=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=s,this.near=r,this.far=o,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,s,r,o){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=s,this.view.width=r,this.view.height=o,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let r=n-t,o=n+t,a=s+e,l=s-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;r+=c*this.view.offsetX,o=r+c*this.view.width,a-=h*this.view.offsetY,l=a-h*this.view.height}this.projectionMatrix.makeOrthographic(r,o,a,l,this.near,this.far,this.coordinateSystem),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}const Ki=4,Rc=[.125,.215,.35,.446,.526,.582],gi=20,Qo=new Ru,Pc=new Et;let ta=null,ea=0,na=0,ia=!1;const mi=(1+Math.sqrt(5))/2,Gi=1/mi,Lc=[new T(-mi,Gi,0),new T(mi,Gi,0),new T(-Gi,0,mi),new T(Gi,0,mi),new T(0,mi,-Gi),new T(0,mi,Gi),new T(-1,1,-1),new T(1,1,-1),new T(-1,1,1),new T(1,1,1)];class vl{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,s=100){ta=this._renderer.getRenderTarget(),ea=this._renderer.getActiveCubeFace(),na=this._renderer.getActiveMipmapLevel(),ia=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(256);const r=this._allocateTargets();return r.depthBuffer=!0,this._sceneToCubeUV(t,n,s,r),e>0&&this._blur(r,0,0,e),this._applyPMREM(r),this._cleanup(r),r}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Uc(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Dc(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(ta,ea,na),this._renderer.xr.enabled=ia,t.scissorTest=!1,Ir(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===ss||t.mapping===rs?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),ta=this._renderer.getRenderTarget(),ea=this._renderer.getActiveCubeFace(),na=this._renderer.getActiveMipmapLevel(),ia=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:Mn,minFilter:Mn,generateMipmaps:!1,type:sr,format:mn,colorSpace:ii,depthBuffer:!1},s=Ic(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Ic(t,e,n);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=U0(r)),this._blurMaterial=N0(r,t,e)}return s}_compileMaterial(t){const e=new tt(this._lodPlanes[0],t);this._renderer.compile(e,Qo)}_sceneToCubeUV(t,e,n,s){const a=new tn(90,1,e,n),l=[1,-1,1,1,1,1],c=[1,1,1,-1,-1,-1],h=this._renderer,u=h.autoClear,d=h.toneMapping;h.getClearColor(Pc),h.toneMapping=ei,h.autoClear=!1;const f=new Sn({name:"PMREM.Background",side:Ye,depthWrite:!1,depthTest:!1}),g=new tt(new qe,f);let v=!1;const m=t.background;m?m.isColor&&(f.color.copy(m),t.background=null,v=!0):(f.color.copy(Pc),v=!0);for(let p=0;p<6;p++){const x=p%3;x===0?(a.up.set(0,l[p],0),a.lookAt(c[p],0,0)):x===1?(a.up.set(0,0,l[p]),a.lookAt(0,c[p],0)):(a.up.set(0,l[p],0),a.lookAt(0,0,c[p]));const M=this._cubeSize;Ir(s,x*M,p>2?M:0,M,M),h.setRenderTarget(s),v&&h.render(g,a),h.render(t,a)}g.geometry.dispose(),g.material.dispose(),h.toneMapping=d,h.autoClear=u,t.background=m}_textureToCubeUV(t,e){const n=this._renderer,s=t.mapping===ss||t.mapping===rs;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=Uc()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Dc());const r=s?this._cubemapMaterial:this._equirectMaterial,o=new tt(this._lodPlanes[0],r),a=r.uniforms;a.envMap.value=t;const l=this._cubeSize;Ir(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(o,Qo)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;const s=this._lodPlanes.length;for(let r=1;r<s;r++){const o=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),a=Lc[(s-r-1)%Lc.length];this._blur(t,r-1,r,o,a)}e.autoClear=n}_blur(t,e,n,s,r){const o=this._pingPongRenderTarget;this._halfBlur(t,o,e,n,s,"latitudinal",r),this._halfBlur(o,t,n,n,s,"longitudinal",r)}_halfBlur(t,e,n,s,r,o,a){const l=this._renderer,c=this._blurMaterial;o!=="latitudinal"&&o!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new tt(this._lodPlanes[s],c),d=c.uniforms,f=this._sizeLods[n]-1,g=isFinite(r)?Math.PI/(2*f):2*Math.PI/(2*gi-1),v=r/g,m=isFinite(r)?1+Math.floor(h*v):gi;m>gi&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${gi}`);const p=[];let x=0;for(let C=0;C<gi;++C){const P=C/v,b=Math.exp(-P*P/2);p.push(b),C===0?x+=b:C<m&&(x+=2*b)}for(let C=0;C<p.length;C++)p[C]=p[C]/x;d.envMap.value=t.texture,d.samples.value=m,d.weights.value=p,d.latitudinal.value=o==="latitudinal",a&&(d.poleAxis.value=a);const{_lodMax:M}=this;d.dTheta.value=g,d.mipInt.value=M-n;const _=this._sizeLods[s],I=3*_*(s>M-Ki?s-M+Ki:0),E=4*(this._cubeSize-_);Ir(e,I,E,3*_,2*_),l.setRenderTarget(e),l.render(u,Qo)}}function U0(i){const t=[],e=[],n=[];let s=i;const r=i-Ki+1+Rc.length;for(let o=0;o<r;o++){const a=Math.pow(2,s);e.push(a);let l=1/a;o>i-Ki?l=Rc[o-i+Ki-1]:o===0&&(l=0),n.push(l);const c=1/(a-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],f=6,g=6,v=3,m=2,p=1,x=new Float32Array(v*g*f),M=new Float32Array(m*g*f),_=new Float32Array(p*g*f);for(let E=0;E<f;E++){const C=E%3*2/3-1,P=E>2?0:-1,b=[C,P,0,C+2/3,P,0,C+2/3,P+1,0,C,P,0,C+2/3,P+1,0,C,P+1,0];x.set(b,v*g*E),M.set(d,m*g*E);const y=[E,E,E,E,E,E];_.set(y,p*g*E)}const I=new pe;I.setAttribute("position",new Re(x,v)),I.setAttribute("uv",new Re(M,m)),I.setAttribute("faceIndex",new Re(_,p)),t.push(I),s>Ki&&s--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function Ic(i,t,e){const n=new Si(i,t,e);return n.texture.mapping=vo,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Ir(i,t,e,n,s){i.viewport.set(t,e,n,s),i.scissor.set(t,e,n,s)}function N0(i,t,e){const n=new Float32Array(gi),s=new T(0,1,0);return new nn({name:"SphericalGaussianBlur",defines:{n:gi,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:kl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:ti,depthTest:!1,depthWrite:!1})}function Dc(){return new nn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:kl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:ti,depthTest:!1,depthWrite:!1})}function Uc(){return new nn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:kl(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:ti,depthTest:!1,depthWrite:!1})}function kl(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function O0(i){let t=new WeakMap,e=null;function n(a){if(a&&a.isTexture){const l=a.mapping,c=l===Va||l===Ga,h=l===ss||l===rs;if(c||h){let u=t.get(a);const d=u!==void 0?u.texture.pmremVersion:0;if(a.isRenderTargetTexture&&a.pmremVersion!==d)return e===null&&(e=new vl(i)),u=c?e.fromEquirectangular(a,u):e.fromCubemap(a,u),u.texture.pmremVersion=a.pmremVersion,t.set(a,u),u.texture;if(u!==void 0)return u.texture;{const f=a.image;return c&&f&&f.height>0||h&&f&&s(f)?(e===null&&(e=new vl(i)),u=c?e.fromEquirectangular(a):e.fromCubemap(a),u.texture.pmremVersion=a.pmremVersion,t.set(a,u),a.addEventListener("dispose",r),u.texture):null}}}return a}function s(a){let l=0;const c=6;for(let h=0;h<c;h++)a[h]!==void 0&&l++;return l===c}function r(a){const l=a.target;l.removeEventListener("dispose",r);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function o(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:o}}function F0(i){const t={};function e(n){if(t[n]!==void 0)return t[n];let s;switch(n){case"WEBGL_depth_texture":s=i.getExtension("WEBGL_depth_texture")||i.getExtension("MOZ_WEBGL_depth_texture")||i.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":s=i.getExtension("EXT_texture_filter_anisotropic")||i.getExtension("MOZ_EXT_texture_filter_anisotropic")||i.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":s=i.getExtension("WEBGL_compressed_texture_s3tc")||i.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":s=i.getExtension("WEBGL_compressed_texture_pvrtc")||i.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:s=i.getExtension(n)}return t[n]=s,s}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){const s=e(n);return s===null&&Cs("THREE.WebGLRenderer: "+n+" extension not supported."),s}}}function B0(i,t,e,n){const s={},r=new WeakMap;function o(u){const d=u.target;d.index!==null&&t.remove(d.index);for(const g in d.attributes)t.remove(d.attributes[g]);for(const g in d.morphAttributes){const v=d.morphAttributes[g];for(let m=0,p=v.length;m<p;m++)t.remove(v[m])}d.removeEventListener("dispose",o),delete s[d.id];const f=r.get(d);f&&(t.remove(f),r.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,e.memory.geometries--}function a(u,d){return s[d.id]===!0||(d.addEventListener("dispose",o),s[d.id]=!0,e.memory.geometries++),d}function l(u){const d=u.attributes;for(const g in d)t.update(d[g],i.ARRAY_BUFFER);const f=u.morphAttributes;for(const g in f){const v=f[g];for(let m=0,p=v.length;m<p;m++)t.update(v[m],i.ARRAY_BUFFER)}}function c(u){const d=[],f=u.index,g=u.attributes.position;let v=0;if(f!==null){const x=f.array;v=f.version;for(let M=0,_=x.length;M<_;M+=3){const I=x[M+0],E=x[M+1],C=x[M+2];d.push(I,E,E,C,C,I)}}else if(g!==void 0){const x=g.array;v=g.version;for(let M=0,_=x.length/3-1;M<_;M+=3){const I=M+0,E=M+1,C=M+2;d.push(I,E,E,C,C,I)}}else return;const m=new(Mu(d)?wu:Su)(d,1);m.version=v;const p=r.get(u);p&&t.remove(p),r.set(u,m)}function h(u){const d=r.get(u);if(d){const f=u.index;f!==null&&d.version<f.version&&c(u)}else c(u);return r.get(u)}return{get:a,update:l,getWireframeAttribute:h}}function k0(i,t,e){let n;function s(d){n=d}let r,o;function a(d){r=d.type,o=d.bytesPerElement}function l(d,f){i.drawElements(n,f,r,d*o),e.update(f,n,1)}function c(d,f,g){g!==0&&(i.drawElementsInstanced(n,f,r,d*o,g),e.update(f,n,g))}function h(d,f,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,f,0,r,d,0,g);let m=0;for(let p=0;p<g;p++)m+=f[p];e.update(m,n,1)}function u(d,f,g,v){if(g===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let p=0;p<d.length;p++)c(d[p]/o,f[p],v[p]);else{m.multiDrawElementsInstancedWEBGL(n,f,0,r,d,0,v,0,g);let p=0;for(let x=0;x<g;x++)p+=f[x]*v[x];e.update(p,n,1)}}this.setMode=s,this.setIndex=a,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function z0(i){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(r,o,a){switch(e.calls++,o){case i.TRIANGLES:e.triangles+=a*(r/3);break;case i.LINES:e.lines+=a*(r/2);break;case i.LINE_STRIP:e.lines+=a*(r-1);break;case i.LINE_LOOP:e.lines+=a*r;break;case i.POINTS:e.points+=a*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",o);break}}function s(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:s,update:n}}function H0(i,t,e){const n=new WeakMap,s=new ie;function r(o,a,l){const c=o.morphTargetInfluences,h=a.morphAttributes.position||a.morphAttributes.normal||a.morphAttributes.color,u=h!==void 0?h.length:0;let d=n.get(a);if(d===void 0||d.count!==u){let b=function(){C.dispose(),n.delete(a),a.removeEventListener("dispose",b)};d!==void 0&&d.texture.dispose();const f=a.morphAttributes.position!==void 0,g=a.morphAttributes.normal!==void 0,v=a.morphAttributes.color!==void 0,m=a.morphAttributes.position||[],p=a.morphAttributes.normal||[],x=a.morphAttributes.color||[];let M=0;f===!0&&(M=1),g===!0&&(M=2),v===!0&&(M=3);let _=a.attributes.position.count*M,I=1;_>t.maxTextureSize&&(I=Math.ceil(_/t.maxTextureSize),_=t.maxTextureSize);const E=new Float32Array(_*I*4*u),C=new yu(E,_,I,u);C.type=xn,C.needsUpdate=!0;const P=M*4;for(let y=0;y<u;y++){const R=m[y],O=p[y],N=x[y],U=_*I*4*y;for(let F=0;F<R.count;F++){const V=F*P;f===!0&&(s.fromBufferAttribute(R,F),E[U+V+0]=s.x,E[U+V+1]=s.y,E[U+V+2]=s.z,E[U+V+3]=0),g===!0&&(s.fromBufferAttribute(O,F),E[U+V+4]=s.x,E[U+V+5]=s.y,E[U+V+6]=s.z,E[U+V+7]=0),v===!0&&(s.fromBufferAttribute(N,F),E[U+V+8]=s.x,E[U+V+9]=s.y,E[U+V+10]=s.z,E[U+V+11]=N.itemSize===4?s.w:1)}}d={count:u,texture:C,size:new H(_,I)},n.set(a,d),a.addEventListener("dispose",b)}if(o.isInstancedMesh===!0&&o.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",o.morphTexture,e);else{let f=0;for(let v=0;v<c.length;v++)f+=c[v];const g=a.morphTargetsRelative?1:1-f;l.getUniforms().setValue(i,"morphTargetBaseInfluence",g),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,e),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:r}}function V0(i,t,e,n){let s=new WeakMap;function r(l){const c=n.render.frame,h=l.geometry,u=t.get(l,h);if(s.get(u)!==c&&(t.update(u),s.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",a)===!1&&l.addEventListener("dispose",a),s.get(l)!==c&&(e.update(l.instanceMatrix,i.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,i.ARRAY_BUFFER),s.set(l,c))),l.isSkinnedMesh){const d=l.skeleton;s.get(d)!==c&&(d.update(),s.set(d,c))}return u}function o(){s=new WeakMap}function a(l){const c=l.target;c.removeEventListener("dispose",a),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:r,dispose:o}}class Pu extends Ve{constructor(t,e,n,s,r,o,a,l,c,h=Qi){if(h!==Qi&&h!==ls)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");n===void 0&&h===Qi&&(n=bi),n===void 0&&h===ls&&(n=as),super(null,s,r,o,a,l,h,n,c),this.isDepthTexture=!0,this.image={width:t,height:e},this.magFilter=a!==void 0?a:en,this.minFilter=l!==void 0?l:en,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}const Lu=new Ve,Nc=new Pu(1,1),Iu=new yu,Du=new Cf,Uu=new Au,Oc=[],Fc=[],Bc=new Float32Array(16),kc=new Float32Array(9),zc=new Float32Array(4);function ds(i,t,e){const n=i[0];if(n<=0||n>0)return i;const s=t*e;let r=Oc[s];if(r===void 0&&(r=new Float32Array(s),Oc[s]=r),t!==0){n.toArray(r,0);for(let o=1,a=0;o!==t;++o)a+=e,i[o].toArray(r,a)}return r}function Te(i,t){if(i.length!==t.length)return!1;for(let e=0,n=i.length;e<n;e++)if(i[e]!==t[e])return!1;return!0}function Ae(i,t){for(let e=0,n=t.length;e<n;e++)i[e]=t[e]}function xo(i,t){let e=Fc[t];e===void 0&&(e=new Int32Array(t),Fc[t]=e);for(let n=0;n!==t;++n)e[n]=i.allocateTextureUnit();return e}function G0(i,t){const e=this.cache;e[0]!==t&&(i.uniform1f(this.addr,t),e[0]=t)}function W0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2fv(this.addr,t),Ae(e,t)}}function q0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(i.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(Te(e,t))return;i.uniform3fv(this.addr,t),Ae(e,t)}}function Y0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4fv(this.addr,t),Ae(e,t)}}function X0(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix2fv(this.addr,!1,t),Ae(e,t)}else{if(Te(e,n))return;zc.set(n),i.uniformMatrix2fv(this.addr,!1,zc),Ae(e,n)}}function $0(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix3fv(this.addr,!1,t),Ae(e,t)}else{if(Te(e,n))return;kc.set(n),i.uniformMatrix3fv(this.addr,!1,kc),Ae(e,n)}}function j0(i,t){const e=this.cache,n=t.elements;if(n===void 0){if(Te(e,t))return;i.uniformMatrix4fv(this.addr,!1,t),Ae(e,t)}else{if(Te(e,n))return;Bc.set(n),i.uniformMatrix4fv(this.addr,!1,Bc),Ae(e,n)}}function K0(i,t){const e=this.cache;e[0]!==t&&(i.uniform1i(this.addr,t),e[0]=t)}function Z0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2iv(this.addr,t),Ae(e,t)}}function J0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Te(e,t))return;i.uniform3iv(this.addr,t),Ae(e,t)}}function Q0(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4iv(this.addr,t),Ae(e,t)}}function tg(i,t){const e=this.cache;e[0]!==t&&(i.uniform1ui(this.addr,t),e[0]=t)}function eg(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(i.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(Te(e,t))return;i.uniform2uiv(this.addr,t),Ae(e,t)}}function ng(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(i.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(Te(e,t))return;i.uniform3uiv(this.addr,t),Ae(e,t)}}function ig(i,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(i.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(Te(e,t))return;i.uniform4uiv(this.addr,t),Ae(e,t)}}function sg(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let r;this.type===i.SAMPLER_2D_SHADOW?(Nc.compareFunction=_u,r=Nc):r=Lu,e.setTexture2D(t||r,s)}function rg(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture3D(t||Du,s)}function og(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTextureCube(t||Uu,s)}function ag(i,t,e){const n=this.cache,s=e.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),e.setTexture2DArray(t||Iu,s)}function lg(i){switch(i){case 5126:return G0;case 35664:return W0;case 35665:return q0;case 35666:return Y0;case 35674:return X0;case 35675:return $0;case 35676:return j0;case 5124:case 35670:return K0;case 35667:case 35671:return Z0;case 35668:case 35672:return J0;case 35669:case 35673:return Q0;case 5125:return tg;case 36294:return eg;case 36295:return ng;case 36296:return ig;case 35678:case 36198:case 36298:case 36306:case 35682:return sg;case 35679:case 36299:case 36307:return rg;case 35680:case 36300:case 36308:case 36293:return og;case 36289:case 36303:case 36311:case 36292:return ag}}function cg(i,t){i.uniform1fv(this.addr,t)}function hg(i,t){const e=ds(t,this.size,2);i.uniform2fv(this.addr,e)}function ug(i,t){const e=ds(t,this.size,3);i.uniform3fv(this.addr,e)}function dg(i,t){const e=ds(t,this.size,4);i.uniform4fv(this.addr,e)}function fg(i,t){const e=ds(t,this.size,4);i.uniformMatrix2fv(this.addr,!1,e)}function pg(i,t){const e=ds(t,this.size,9);i.uniformMatrix3fv(this.addr,!1,e)}function mg(i,t){const e=ds(t,this.size,16);i.uniformMatrix4fv(this.addr,!1,e)}function gg(i,t){i.uniform1iv(this.addr,t)}function vg(i,t){i.uniform2iv(this.addr,t)}function _g(i,t){i.uniform3iv(this.addr,t)}function Mg(i,t){i.uniform4iv(this.addr,t)}function xg(i,t){i.uniform1uiv(this.addr,t)}function yg(i,t){i.uniform2uiv(this.addr,t)}function bg(i,t){i.uniform3uiv(this.addr,t)}function Sg(i,t){i.uniform4uiv(this.addr,t)}function wg(i,t,e){const n=this.cache,s=t.length,r=xo(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTexture2D(t[o]||Lu,r[o])}function Eg(i,t,e){const n=this.cache,s=t.length,r=xo(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTexture3D(t[o]||Du,r[o])}function Tg(i,t,e){const n=this.cache,s=t.length,r=xo(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTextureCube(t[o]||Uu,r[o])}function Ag(i,t,e){const n=this.cache,s=t.length,r=xo(e,s);Te(n,r)||(i.uniform1iv(this.addr,r),Ae(n,r));for(let o=0;o!==s;++o)e.setTexture2DArray(t[o]||Iu,r[o])}function Cg(i){switch(i){case 5126:return cg;case 35664:return hg;case 35665:return ug;case 35666:return dg;case 35674:return fg;case 35675:return pg;case 35676:return mg;case 5124:case 35670:return gg;case 35667:case 35671:return vg;case 35668:case 35672:return _g;case 35669:case 35673:return Mg;case 5125:return xg;case 36294:return yg;case 36295:return bg;case 36296:return Sg;case 35678:case 36198:case 36298:case 36306:case 35682:return wg;case 35679:case 36299:case 36307:return Eg;case 35680:case 36300:case 36308:case 36293:return Tg;case 36289:case 36303:case 36311:case 36292:return Ag}}class Rg{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=lg(e.type)}}class Pg{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=Cg(e.type)}}class Lg{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const s=this.seq;for(let r=0,o=s.length;r!==o;++r){const a=s[r];a.setValue(t,e[a.id],n)}}}const sa=/(\w+)(\])?(\[|\.)?/g;function Hc(i,t){i.seq.push(t),i.map[t.id]=t}function Ig(i,t,e){const n=i.name,s=n.length;for(sa.lastIndex=0;;){const r=sa.exec(n),o=sa.lastIndex;let a=r[1];const l=r[2]==="]",c=r[3];if(l&&(a=a|0),c===void 0||c==="["&&o+2===s){Hc(e,c===void 0?new Rg(a,i,t):new Pg(a,i,t));break}else{let u=e.map[a];u===void 0&&(u=new Lg(a),Hc(e,u)),e=u}}}class no{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let s=0;s<n;++s){const r=t.getActiveUniform(e,s),o=t.getUniformLocation(e,r.name);Ig(r,o,this)}}setValue(t,e,n,s){const r=this.map[e];r!==void 0&&r.setValue(t,n,s)}setOptional(t,e,n){const s=e[n];s!==void 0&&this.setValue(t,n,s)}static upload(t,e,n,s){for(let r=0,o=e.length;r!==o;++r){const a=e[r],l=n[a.id];l.needsUpdate!==!1&&a.setValue(t,l.value,s)}}static seqWithValue(t,e){const n=[];for(let s=0,r=t.length;s!==r;++s){const o=t[s];o.id in e&&n.push(o)}return n}}function Vc(i,t,e){const n=i.createShader(t);return i.shaderSource(n,e),i.compileShader(n),n}const Dg=37297;let Ug=0;function Ng(i,t){const e=i.split(`
`),n=[],s=Math.max(t-6,0),r=Math.min(t+6,e.length);for(let o=s;o<r;o++){const a=o+1;n.push(`${a===t?">":" "} ${a}: ${e[o]}`)}return n.join(`
`)}const Gc=new Yt;function Og(i){Qt._getMatrix(Gc,Qt.workingColorSpace,i);const t=`mat3( ${Gc.elements.map(e=>e.toFixed(4))} )`;switch(Qt.getTransfer(i)){case _o:return[t,"LinearTransferOETF"];case ae:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",i),[t,"LinearTransferOETF"]}}function Wc(i,t,e){const n=i.getShaderParameter(t,i.COMPILE_STATUS),s=i.getShaderInfoLog(t).trim();if(n&&s==="")return"";const r=/ERROR: 0:(\d+)/.exec(s);if(r){const o=parseInt(r[1]);return e.toUpperCase()+`

`+s+`

`+Ng(i.getShaderSource(t),o)}else return s}function Fg(i,t){const e=Og(t);return[`vec4 ${i}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function Bg(i,t){let e;switch(t){case zd:e="Linear";break;case Hd:e="Reinhard";break;case Vd:e="Cineon";break;case Gd:e="ACESFilmic";break;case qd:e="AgX";break;case ou:e="Neutral";break;case Wd:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+i+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const Dr=new T;function kg(){Qt.getLuminanceCoefficients(Dr);const i=Dr.x.toFixed(4),t=Dr.y.toFixed(4),e=Dr.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function zg(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Rs).join(`
`)}function Hg(i){const t=[];for(const e in i){const n=i[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function Vg(i,t){const e={},n=i.getProgramParameter(t,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const r=i.getActiveAttrib(t,s),o=r.name;let a=1;r.type===i.FLOAT_MAT2&&(a=2),r.type===i.FLOAT_MAT3&&(a=3),r.type===i.FLOAT_MAT4&&(a=4),e[o]={type:r.type,location:i.getAttribLocation(t,o),locationSize:a}}return e}function Rs(i){return i!==""}function qc(i,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Yc(i,t){return i.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const Gg=/^[ \t]*#include +<([\w\d./]+)>/gm;function _l(i){return i.replace(Gg,qg)}const Wg=new Map;function qg(i,t){let e=$t[t];if(e===void 0){const n=Wg.get(t);if(n!==void 0)e=$t[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return _l(e)}const Yg=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Xc(i){return i.replace(Yg,Xg)}function Xg(i,t,e,n){let s="";for(let r=parseInt(t);r<parseInt(e);r++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return s}function $c(i){let t=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?t+=`
#define HIGH_PRECISION`:i.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function $g(i){let t="SHADOWMAP_TYPE_BASIC";return i.shadowMapType===nu?t="SHADOWMAP_TYPE_PCF":i.shadowMapType===iu?t="SHADOWMAP_TYPE_PCF_SOFT":i.shadowMapType===Dn&&(t="SHADOWMAP_TYPE_VSM"),t}function jg(i){let t="ENVMAP_TYPE_CUBE";if(i.envMap)switch(i.envMapMode){case ss:case rs:t="ENVMAP_TYPE_CUBE";break;case vo:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Kg(i){let t="ENVMAP_MODE_REFLECTION";if(i.envMap)switch(i.envMapMode){case rs:t="ENVMAP_MODE_REFRACTION";break}return t}function Zg(i){let t="ENVMAP_BLENDING_NONE";if(i.envMap)switch(i.combine){case ru:t="ENVMAP_BLENDING_MULTIPLY";break;case Bd:t="ENVMAP_BLENDING_MIX";break;case kd:t="ENVMAP_BLENDING_ADD";break}return t}function Jg(i){const t=i.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Qg(i,t,e,n){const s=i.getContext(),r=e.defines;let o=e.vertexShader,a=e.fragmentShader;const l=$g(e),c=jg(e),h=Kg(e),u=Zg(e),d=Jg(e),f=zg(e),g=Hg(r),v=s.createProgram();let m,p,x=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Rs).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(Rs).join(`
`),p.length>0&&(p+=`
`)):(m=[$c(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Rs).join(`
`),p=[$c(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",e.reverseDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==ei?"#define TONE_MAPPING":"",e.toneMapping!==ei?$t.tonemapping_pars_fragment:"",e.toneMapping!==ei?Bg("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",$t.colorspace_pars_fragment,Fg("linearToOutputTexel",e.outputColorSpace),kg(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(Rs).join(`
`)),o=_l(o),o=qc(o,e),o=Yc(o,e),a=_l(a),a=qc(a,e),a=Yc(a,e),o=Xc(o),a=Xc(a),e.isRawShaderMaterial!==!0&&(x=`#version 300 es
`,m=[f,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",e.glslVersion===ac?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===ac?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const M=x+m+o,_=x+p+a,I=Vc(s,s.VERTEX_SHADER,M),E=Vc(s,s.FRAGMENT_SHADER,_);s.attachShader(v,I),s.attachShader(v,E),e.index0AttributeName!==void 0?s.bindAttribLocation(v,0,e.index0AttributeName):e.morphTargets===!0&&s.bindAttribLocation(v,0,"position"),s.linkProgram(v);function C(R){if(i.debug.checkShaderErrors){const O=s.getProgramInfoLog(v).trim(),N=s.getShaderInfoLog(I).trim(),U=s.getShaderInfoLog(E).trim();let F=!0,V=!0;if(s.getProgramParameter(v,s.LINK_STATUS)===!1)if(F=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,v,I,E);else{const K=Wc(s,I,"vertex"),q=Wc(s,E,"fragment");console.error("THREE.WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(v,s.VALIDATE_STATUS)+`

Material Name: `+R.name+`
Material Type: `+R.type+`

Program Info Log: `+O+`
`+K+`
`+q)}else O!==""?console.warn("THREE.WebGLProgram: Program Info Log:",O):(N===""||U==="")&&(V=!1);V&&(R.diagnostics={runnable:F,programLog:O,vertexShader:{log:N,prefix:m},fragmentShader:{log:U,prefix:p}})}s.deleteShader(I),s.deleteShader(E),P=new no(s,v),b=Vg(s,v)}let P;this.getUniforms=function(){return P===void 0&&C(this),P};let b;this.getAttributes=function(){return b===void 0&&C(this),b};let y=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return y===!1&&(y=s.getProgramParameter(v,Dg)),y},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(v),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=Ug++,this.cacheKey=t,this.usedTimes=1,this.program=v,this.vertexShader=I,this.fragmentShader=E,this}let tv=0;class ev{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,s=this._getShaderStage(e),r=this._getShaderStage(n),o=this._getShaderCacheForMaterial(t);return o.has(s)===!1&&(o.add(s),s.usedTimes++),o.has(r)===!1&&(o.add(r),r.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new nv(t),e.set(t,n)),n}}class nv{constructor(t){this.id=tv++,this.code=t,this.usedTimes=0}}function iv(i,t,e,n,s,r,o){const a=new Fl,l=new ev,c=new Set,h=[],u=s.logarithmicDepthBuffer,d=s.vertexTextures;let f=s.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function v(b){return c.add(b),b===0?"uv":`uv${b}`}function m(b,y,R,O,N){const U=O.fog,F=N.geometry,V=b.isMeshStandardMaterial?O.environment:null,K=(b.isMeshStandardMaterial?e:t).get(b.envMap||V),q=K&&K.mapping===vo?K.image.height:null,D=g[b.type];b.precision!==null&&(f=s.getMaxPrecision(b.precision),f!==b.precision&&console.warn("THREE.WebGLProgram.getParameters:",b.precision,"not supported, using",f,"instead."));const G=F.morphAttributes.position||F.morphAttributes.normal||F.morphAttributes.color,et=G!==void 0?G.length:0;let dt=0;F.morphAttributes.position!==void 0&&(dt=1),F.morphAttributes.normal!==void 0&&(dt=2),F.morphAttributes.color!==void 0&&(dt=3);let Ht,Q,ot,mt;if(D){const oe=vn[D];Ht=oe.vertexShader,Q=oe.fragmentShader}else Ht=b.vertexShader,Q=b.fragmentShader,l.update(b),ot=l.getVertexShaderID(b),mt=l.getFragmentShaderID(b);const lt=i.getRenderTarget(),Pt=i.state.buffers.depth.getReversed(),Ft=N.isInstancedMesh===!0,ft=N.isBatchedMesh===!0,bt=!!b.map,j=!!b.matcap,it=!!K,L=!!b.aoMap,At=!!b.lightMap,at=!!b.bumpMap,wt=!!b.normalMap,ct=!!b.displacementMap,Bt=!!b.emissiveMap,pt=!!b.metalnessMap,A=!!b.roughnessMap,S=b.anisotropy>0,W=b.clearcoat>0,Z=b.dispersion>0,rt=b.iridescence>0,nt=b.sheen>0,It=b.transmission>0,vt=S&&!!b.anisotropyMap,Tt=W&&!!b.clearcoatMap,Kt=W&&!!b.clearcoatNormalMap,ht=W&&!!b.clearcoatRoughnessMap,Ct=rt&&!!b.iridescenceMap,kt=rt&&!!b.iridescenceThicknessMap,zt=nt&&!!b.sheenColorMap,Rt=nt&&!!b.sheenRoughnessMap,Zt=!!b.specularMap,Xt=!!b.specularColorMap,ce=!!b.specularIntensityMap,B=It&&!!b.transmissionMap,_t=It&&!!b.thicknessMap,J=!!b.gradientMap,st=!!b.alphaMap,St=b.alphaTest>0,xt=!!b.alphaHash,Gt=!!b.extensions;let ge=ei;b.toneMapped&&(lt===null||lt.isXRRenderTarget===!0)&&(ge=i.toneMapping);const Fe={shaderID:D,shaderType:b.type,shaderName:b.name,vertexShader:Ht,fragmentShader:Q,defines:b.defines,customVertexShaderID:ot,customFragmentShaderID:mt,isRawShaderMaterial:b.isRawShaderMaterial===!0,glslVersion:b.glslVersion,precision:f,batching:ft,batchingColor:ft&&N._colorsTexture!==null,instancing:Ft,instancingColor:Ft&&N.instanceColor!==null,instancingMorph:Ft&&N.morphTexture!==null,supportsVertexTextures:d,outputColorSpace:lt===null?i.outputColorSpace:lt.isXRRenderTarget===!0?lt.texture.colorSpace:ii,alphaToCoverage:!!b.alphaToCoverage,map:bt,matcap:j,envMap:it,envMapMode:it&&K.mapping,envMapCubeUVHeight:q,aoMap:L,lightMap:At,bumpMap:at,normalMap:wt,displacementMap:d&&ct,emissiveMap:Bt,normalMapObjectSpace:wt&&b.normalMapType===jd,normalMapTangentSpace:wt&&b.normalMapType===vu,metalnessMap:pt,roughnessMap:A,anisotropy:S,anisotropyMap:vt,clearcoat:W,clearcoatMap:Tt,clearcoatNormalMap:Kt,clearcoatRoughnessMap:ht,dispersion:Z,iridescence:rt,iridescenceMap:Ct,iridescenceThicknessMap:kt,sheen:nt,sheenColorMap:zt,sheenRoughnessMap:Rt,specularMap:Zt,specularColorMap:Xt,specularIntensityMap:ce,transmission:It,transmissionMap:B,thicknessMap:_t,gradientMap:J,opaque:b.transparent===!1&&b.blending===xi&&b.alphaToCoverage===!1,alphaMap:st,alphaTest:St,alphaHash:xt,combine:b.combine,mapUv:bt&&v(b.map.channel),aoMapUv:L&&v(b.aoMap.channel),lightMapUv:At&&v(b.lightMap.channel),bumpMapUv:at&&v(b.bumpMap.channel),normalMapUv:wt&&v(b.normalMap.channel),displacementMapUv:ct&&v(b.displacementMap.channel),emissiveMapUv:Bt&&v(b.emissiveMap.channel),metalnessMapUv:pt&&v(b.metalnessMap.channel),roughnessMapUv:A&&v(b.roughnessMap.channel),anisotropyMapUv:vt&&v(b.anisotropyMap.channel),clearcoatMapUv:Tt&&v(b.clearcoatMap.channel),clearcoatNormalMapUv:Kt&&v(b.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:ht&&v(b.clearcoatRoughnessMap.channel),iridescenceMapUv:Ct&&v(b.iridescenceMap.channel),iridescenceThicknessMapUv:kt&&v(b.iridescenceThicknessMap.channel),sheenColorMapUv:zt&&v(b.sheenColorMap.channel),sheenRoughnessMapUv:Rt&&v(b.sheenRoughnessMap.channel),specularMapUv:Zt&&v(b.specularMap.channel),specularColorMapUv:Xt&&v(b.specularColorMap.channel),specularIntensityMapUv:ce&&v(b.specularIntensityMap.channel),transmissionMapUv:B&&v(b.transmissionMap.channel),thicknessMapUv:_t&&v(b.thicknessMap.channel),alphaMapUv:st&&v(b.alphaMap.channel),vertexTangents:!!F.attributes.tangent&&(wt||S),vertexColors:b.vertexColors,vertexAlphas:b.vertexColors===!0&&!!F.attributes.color&&F.attributes.color.itemSize===4,pointsUvs:N.isPoints===!0&&!!F.attributes.uv&&(bt||st),fog:!!U,useFog:b.fog===!0,fogExp2:!!U&&U.isFogExp2,flatShading:b.flatShading===!0,sizeAttenuation:b.sizeAttenuation===!0,logarithmicDepthBuffer:u,reverseDepthBuffer:Pt,skinning:N.isSkinnedMesh===!0,morphTargets:F.morphAttributes.position!==void 0,morphNormals:F.morphAttributes.normal!==void 0,morphColors:F.morphAttributes.color!==void 0,morphTargetsCount:et,morphTextureStride:dt,numDirLights:y.directional.length,numPointLights:y.point.length,numSpotLights:y.spot.length,numSpotLightMaps:y.spotLightMap.length,numRectAreaLights:y.rectArea.length,numHemiLights:y.hemi.length,numDirLightShadows:y.directionalShadowMap.length,numPointLightShadows:y.pointShadowMap.length,numSpotLightShadows:y.spotShadowMap.length,numSpotLightShadowsWithMaps:y.numSpotLightShadowsWithMaps,numLightProbes:y.numLightProbes,numClippingPlanes:o.numPlanes,numClipIntersection:o.numIntersection,dithering:b.dithering,shadowMapEnabled:i.shadowMap.enabled&&R.length>0,shadowMapType:i.shadowMap.type,toneMapping:ge,decodeVideoTexture:bt&&b.map.isVideoTexture===!0&&Qt.getTransfer(b.map.colorSpace)===ae,decodeVideoTextureEmissive:Bt&&b.emissiveMap.isVideoTexture===!0&&Qt.getTransfer(b.emissiveMap.colorSpace)===ae,premultipliedAlpha:b.premultipliedAlpha,doubleSided:b.side===je,flipSided:b.side===Ye,useDepthPacking:b.depthPacking>=0,depthPacking:b.depthPacking||0,index0AttributeName:b.index0AttributeName,extensionClipCullDistance:Gt&&b.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(Gt&&b.extensions.multiDraw===!0||ft)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:b.customProgramCacheKey()};return Fe.vertexUv1s=c.has(1),Fe.vertexUv2s=c.has(2),Fe.vertexUv3s=c.has(3),c.clear(),Fe}function p(b){const y=[];if(b.shaderID?y.push(b.shaderID):(y.push(b.customVertexShaderID),y.push(b.customFragmentShaderID)),b.defines!==void 0)for(const R in b.defines)y.push(R),y.push(b.defines[R]);return b.isRawShaderMaterial===!1&&(x(y,b),M(y,b),y.push(i.outputColorSpace)),y.push(b.customProgramCacheKey),y.join()}function x(b,y){b.push(y.precision),b.push(y.outputColorSpace),b.push(y.envMapMode),b.push(y.envMapCubeUVHeight),b.push(y.mapUv),b.push(y.alphaMapUv),b.push(y.lightMapUv),b.push(y.aoMapUv),b.push(y.bumpMapUv),b.push(y.normalMapUv),b.push(y.displacementMapUv),b.push(y.emissiveMapUv),b.push(y.metalnessMapUv),b.push(y.roughnessMapUv),b.push(y.anisotropyMapUv),b.push(y.clearcoatMapUv),b.push(y.clearcoatNormalMapUv),b.push(y.clearcoatRoughnessMapUv),b.push(y.iridescenceMapUv),b.push(y.iridescenceThicknessMapUv),b.push(y.sheenColorMapUv),b.push(y.sheenRoughnessMapUv),b.push(y.specularMapUv),b.push(y.specularColorMapUv),b.push(y.specularIntensityMapUv),b.push(y.transmissionMapUv),b.push(y.thicknessMapUv),b.push(y.combine),b.push(y.fogExp2),b.push(y.sizeAttenuation),b.push(y.morphTargetsCount),b.push(y.morphAttributeCount),b.push(y.numDirLights),b.push(y.numPointLights),b.push(y.numSpotLights),b.push(y.numSpotLightMaps),b.push(y.numHemiLights),b.push(y.numRectAreaLights),b.push(y.numDirLightShadows),b.push(y.numPointLightShadows),b.push(y.numSpotLightShadows),b.push(y.numSpotLightShadowsWithMaps),b.push(y.numLightProbes),b.push(y.shadowMapType),b.push(y.toneMapping),b.push(y.numClippingPlanes),b.push(y.numClipIntersection),b.push(y.depthPacking)}function M(b,y){a.disableAll(),y.supportsVertexTextures&&a.enable(0),y.instancing&&a.enable(1),y.instancingColor&&a.enable(2),y.instancingMorph&&a.enable(3),y.matcap&&a.enable(4),y.envMap&&a.enable(5),y.normalMapObjectSpace&&a.enable(6),y.normalMapTangentSpace&&a.enable(7),y.clearcoat&&a.enable(8),y.iridescence&&a.enable(9),y.alphaTest&&a.enable(10),y.vertexColors&&a.enable(11),y.vertexAlphas&&a.enable(12),y.vertexUv1s&&a.enable(13),y.vertexUv2s&&a.enable(14),y.vertexUv3s&&a.enable(15),y.vertexTangents&&a.enable(16),y.anisotropy&&a.enable(17),y.alphaHash&&a.enable(18),y.batching&&a.enable(19),y.dispersion&&a.enable(20),y.batchingColor&&a.enable(21),b.push(a.mask),a.disableAll(),y.fog&&a.enable(0),y.useFog&&a.enable(1),y.flatShading&&a.enable(2),y.logarithmicDepthBuffer&&a.enable(3),y.reverseDepthBuffer&&a.enable(4),y.skinning&&a.enable(5),y.morphTargets&&a.enable(6),y.morphNormals&&a.enable(7),y.morphColors&&a.enable(8),y.premultipliedAlpha&&a.enable(9),y.shadowMapEnabled&&a.enable(10),y.doubleSided&&a.enable(11),y.flipSided&&a.enable(12),y.useDepthPacking&&a.enable(13),y.dithering&&a.enable(14),y.transmission&&a.enable(15),y.sheen&&a.enable(16),y.opaque&&a.enable(17),y.pointsUvs&&a.enable(18),y.decodeVideoTexture&&a.enable(19),y.decodeVideoTextureEmissive&&a.enable(20),y.alphaToCoverage&&a.enable(21),b.push(a.mask)}function _(b){const y=g[b.type];let R;if(y){const O=vn[y];R=zf.clone(O.uniforms)}else R=b.uniforms;return R}function I(b,y){let R;for(let O=0,N=h.length;O<N;O++){const U=h[O];if(U.cacheKey===y){R=U,++R.usedTimes;break}}return R===void 0&&(R=new Qg(i,y,b,r),h.push(R)),R}function E(b){if(--b.usedTimes===0){const y=h.indexOf(b);h[y]=h[h.length-1],h.pop(),b.destroy()}}function C(b){l.remove(b)}function P(){l.dispose()}return{getParameters:m,getProgramCacheKey:p,getUniforms:_,acquireProgram:I,releaseProgram:E,releaseShaderCache:C,programs:h,dispose:P}}function sv(){let i=new WeakMap;function t(o){return i.has(o)}function e(o){let a=i.get(o);return a===void 0&&(a={},i.set(o,a)),a}function n(o){i.delete(o)}function s(o,a,l){i.get(o)[a]=l}function r(){i=new WeakMap}return{has:t,get:e,remove:n,update:s,dispose:r}}function rv(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.material.id!==t.material.id?i.material.id-t.material.id:i.z!==t.z?i.z-t.z:i.id-t.id}function jc(i,t){return i.groupOrder!==t.groupOrder?i.groupOrder-t.groupOrder:i.renderOrder!==t.renderOrder?i.renderOrder-t.renderOrder:i.z!==t.z?t.z-i.z:i.id-t.id}function Kc(){const i=[];let t=0;const e=[],n=[],s=[];function r(){t=0,e.length=0,n.length=0,s.length=0}function o(u,d,f,g,v,m){let p=i[t];return p===void 0?(p={id:u.id,object:u,geometry:d,material:f,groupOrder:g,renderOrder:u.renderOrder,z:v,group:m},i[t]=p):(p.id=u.id,p.object=u,p.geometry=d,p.material=f,p.groupOrder=g,p.renderOrder=u.renderOrder,p.z=v,p.group=m),t++,p}function a(u,d,f,g,v,m){const p=o(u,d,f,g,v,m);f.transmission>0?n.push(p):f.transparent===!0?s.push(p):e.push(p)}function l(u,d,f,g,v,m){const p=o(u,d,f,g,v,m);f.transmission>0?n.unshift(p):f.transparent===!0?s.unshift(p):e.unshift(p)}function c(u,d){e.length>1&&e.sort(u||rv),n.length>1&&n.sort(d||jc),s.length>1&&s.sort(d||jc)}function h(){for(let u=t,d=i.length;u<d;u++){const f=i[u];if(f.id===null)break;f.id=null,f.object=null,f.geometry=null,f.material=null,f.group=null}}return{opaque:e,transmissive:n,transparent:s,init:r,push:a,unshift:l,finish:h,sort:c}}function ov(){let i=new WeakMap;function t(n,s){const r=i.get(n);let o;return r===void 0?(o=new Kc,i.set(n,[o])):s>=r.length?(o=new Kc,r.push(o)):o=r[s],o}function e(){i=new WeakMap}return{get:t,dispose:e}}function av(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new T,color:new Et};break;case"SpotLight":e={position:new T,direction:new T,color:new Et,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new T,color:new Et,distance:0,decay:0};break;case"HemisphereLight":e={direction:new T,skyColor:new Et,groundColor:new Et};break;case"RectAreaLight":e={color:new Et,position:new T,halfWidth:new T,halfHeight:new T};break}return i[t.id]=e,e}}}function lv(){const i={};return{get:function(t){if(i[t.id]!==void 0)return i[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new H};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new H};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new H,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[t.id]=e,e}}}let cv=0;function hv(i,t){return(t.castShadow?2:0)-(i.castShadow?2:0)+(t.map?1:0)-(i.map?1:0)}function uv(i){const t=new av,e=lv(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new T);const s=new T,r=new Jt,o=new Jt;function a(c){let h=0,u=0,d=0;for(let b=0;b<9;b++)n.probe[b].set(0,0,0);let f=0,g=0,v=0,m=0,p=0,x=0,M=0,_=0,I=0,E=0,C=0;c.sort(hv);for(let b=0,y=c.length;b<y;b++){const R=c[b],O=R.color,N=R.intensity,U=R.distance,F=R.shadow&&R.shadow.map?R.shadow.map.texture:null;if(R.isAmbientLight)h+=O.r*N,u+=O.g*N,d+=O.b*N;else if(R.isLightProbe){for(let V=0;V<9;V++)n.probe[V].addScaledVector(R.sh.coefficients[V],N);C++}else if(R.isDirectionalLight){const V=t.get(R);if(V.color.copy(R.color).multiplyScalar(R.intensity),R.castShadow){const K=R.shadow,q=e.get(R);q.shadowIntensity=K.intensity,q.shadowBias=K.bias,q.shadowNormalBias=K.normalBias,q.shadowRadius=K.radius,q.shadowMapSize=K.mapSize,n.directionalShadow[f]=q,n.directionalShadowMap[f]=F,n.directionalShadowMatrix[f]=R.shadow.matrix,x++}n.directional[f]=V,f++}else if(R.isSpotLight){const V=t.get(R);V.position.setFromMatrixPosition(R.matrixWorld),V.color.copy(O).multiplyScalar(N),V.distance=U,V.coneCos=Math.cos(R.angle),V.penumbraCos=Math.cos(R.angle*(1-R.penumbra)),V.decay=R.decay,n.spot[v]=V;const K=R.shadow;if(R.map&&(n.spotLightMap[I]=R.map,I++,K.updateMatrices(R),R.castShadow&&E++),n.spotLightMatrix[v]=K.matrix,R.castShadow){const q=e.get(R);q.shadowIntensity=K.intensity,q.shadowBias=K.bias,q.shadowNormalBias=K.normalBias,q.shadowRadius=K.radius,q.shadowMapSize=K.mapSize,n.spotShadow[v]=q,n.spotShadowMap[v]=F,_++}v++}else if(R.isRectAreaLight){const V=t.get(R);V.color.copy(O).multiplyScalar(N),V.halfWidth.set(R.width*.5,0,0),V.halfHeight.set(0,R.height*.5,0),n.rectArea[m]=V,m++}else if(R.isPointLight){const V=t.get(R);if(V.color.copy(R.color).multiplyScalar(R.intensity),V.distance=R.distance,V.decay=R.decay,R.castShadow){const K=R.shadow,q=e.get(R);q.shadowIntensity=K.intensity,q.shadowBias=K.bias,q.shadowNormalBias=K.normalBias,q.shadowRadius=K.radius,q.shadowMapSize=K.mapSize,q.shadowCameraNear=K.camera.near,q.shadowCameraFar=K.camera.far,n.pointShadow[g]=q,n.pointShadowMap[g]=F,n.pointShadowMatrix[g]=R.shadow.matrix,M++}n.point[g]=V,g++}else if(R.isHemisphereLight){const V=t.get(R);V.skyColor.copy(R.color).multiplyScalar(N),V.groundColor.copy(R.groundColor).multiplyScalar(N),n.hemi[p]=V,p++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=gt.LTC_FLOAT_1,n.rectAreaLTC2=gt.LTC_FLOAT_2):(n.rectAreaLTC1=gt.LTC_HALF_1,n.rectAreaLTC2=gt.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;const P=n.hash;(P.directionalLength!==f||P.pointLength!==g||P.spotLength!==v||P.rectAreaLength!==m||P.hemiLength!==p||P.numDirectionalShadows!==x||P.numPointShadows!==M||P.numSpotShadows!==_||P.numSpotMaps!==I||P.numLightProbes!==C)&&(n.directional.length=f,n.spot.length=v,n.rectArea.length=m,n.point.length=g,n.hemi.length=p,n.directionalShadow.length=x,n.directionalShadowMap.length=x,n.pointShadow.length=M,n.pointShadowMap.length=M,n.spotShadow.length=_,n.spotShadowMap.length=_,n.directionalShadowMatrix.length=x,n.pointShadowMatrix.length=M,n.spotLightMatrix.length=_+I-E,n.spotLightMap.length=I,n.numSpotLightShadowsWithMaps=E,n.numLightProbes=C,P.directionalLength=f,P.pointLength=g,P.spotLength=v,P.rectAreaLength=m,P.hemiLength=p,P.numDirectionalShadows=x,P.numPointShadows=M,P.numSpotShadows=_,P.numSpotMaps=I,P.numLightProbes=C,n.version=cv++)}function l(c,h){let u=0,d=0,f=0,g=0,v=0;const m=h.matrixWorldInverse;for(let p=0,x=c.length;p<x;p++){const M=c[p];if(M.isDirectionalLight){const _=n.directional[u];_.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),_.direction.sub(s),_.direction.transformDirection(m),u++}else if(M.isSpotLight){const _=n.spot[f];_.position.setFromMatrixPosition(M.matrixWorld),_.position.applyMatrix4(m),_.direction.setFromMatrixPosition(M.matrixWorld),s.setFromMatrixPosition(M.target.matrixWorld),_.direction.sub(s),_.direction.transformDirection(m),f++}else if(M.isRectAreaLight){const _=n.rectArea[g];_.position.setFromMatrixPosition(M.matrixWorld),_.position.applyMatrix4(m),o.identity(),r.copy(M.matrixWorld),r.premultiply(m),o.extractRotation(r),_.halfWidth.set(M.width*.5,0,0),_.halfHeight.set(0,M.height*.5,0),_.halfWidth.applyMatrix4(o),_.halfHeight.applyMatrix4(o),g++}else if(M.isPointLight){const _=n.point[d];_.position.setFromMatrixPosition(M.matrixWorld),_.position.applyMatrix4(m),d++}else if(M.isHemisphereLight){const _=n.hemi[v];_.direction.setFromMatrixPosition(M.matrixWorld),_.direction.transformDirection(m),v++}}}return{setup:a,setupView:l,state:n}}function Zc(i){const t=new uv(i),e=[],n=[];function s(h){c.camera=h,e.length=0,n.length=0}function r(h){e.push(h)}function o(h){n.push(h)}function a(){t.setup(e)}function l(h){t.setupView(e,h)}const c={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:s,state:c,setupLights:a,setupLightsView:l,pushLight:r,pushShadow:o}}function dv(i){let t=new WeakMap;function e(s,r=0){const o=t.get(s);let a;return o===void 0?(a=new Zc(i),t.set(s,[a])):r>=o.length?(a=new Zc(i),o.push(a)):a=o[r],a}function n(){t=new WeakMap}return{get:e,dispose:n}}class fv extends us{static get type(){return"MeshDepthMaterial"}constructor(t){super(),this.isMeshDepthMaterial=!0,this.depthPacking=Xd,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class pv extends us{static get type(){return"MeshDistanceMaterial"}constructor(t){super(),this.isMeshDistanceMaterial=!0,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}const mv=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,gv=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function vv(i,t,e){let n=new Bl;const s=new H,r=new H,o=new ie,a=new fv({depthPacking:$d}),l=new pv,c={},h=e.maxTextureSize,u={[bn]:Ye,[Ye]:bn,[je]:je},d=new nn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new H},radius:{value:4}},vertexShader:mv,fragmentShader:gv}),f=d.clone();f.defines.HORIZONTAL_PASS=1;const g=new pe;g.setAttribute("position",new Re(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const v=new tt(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=nu;let p=this.type;this.render=function(E,C,P){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||E.length===0)return;const b=i.getRenderTarget(),y=i.getActiveCubeFace(),R=i.getActiveMipmapLevel(),O=i.state;O.setBlending(ti),O.buffers.color.setClear(1,1,1,1),O.buffers.depth.setTest(!0),O.setScissorTest(!1);const N=p!==Dn&&this.type===Dn,U=p===Dn&&this.type!==Dn;for(let F=0,V=E.length;F<V;F++){const K=E[F],q=K.shadow;if(q===void 0){console.warn("THREE.WebGLShadowMap:",K,"has no shadow.");continue}if(q.autoUpdate===!1&&q.needsUpdate===!1)continue;s.copy(q.mapSize);const D=q.getFrameExtents();if(s.multiply(D),r.copy(q.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(r.x=Math.floor(h/D.x),s.x=r.x*D.x,q.mapSize.x=r.x),s.y>h&&(r.y=Math.floor(h/D.y),s.y=r.y*D.y,q.mapSize.y=r.y)),q.map===null||N===!0||U===!0){const et=this.type!==Dn?{minFilter:en,magFilter:en}:{};q.map!==null&&q.map.dispose(),q.map=new Si(s.x,s.y,et),q.map.texture.name=K.name+".shadowMap",q.camera.updateProjectionMatrix()}i.setRenderTarget(q.map),i.clear();const G=q.getViewportCount();for(let et=0;et<G;et++){const dt=q.getViewport(et);o.set(r.x*dt.x,r.y*dt.y,r.x*dt.z,r.y*dt.w),O.viewport(o),q.updateMatrices(K,et),n=q.getFrustum(),_(C,P,q.camera,K,this.type)}q.isPointLightShadow!==!0&&this.type===Dn&&x(q,P),q.needsUpdate=!1}p=this.type,m.needsUpdate=!1,i.setRenderTarget(b,y,R)};function x(E,C){const P=t.update(v);d.defines.VSM_SAMPLES!==E.blurSamples&&(d.defines.VSM_SAMPLES=E.blurSamples,f.defines.VSM_SAMPLES=E.blurSamples,d.needsUpdate=!0,f.needsUpdate=!0),E.mapPass===null&&(E.mapPass=new Si(s.x,s.y)),d.uniforms.shadow_pass.value=E.map.texture,d.uniforms.resolution.value=E.mapSize,d.uniforms.radius.value=E.radius,i.setRenderTarget(E.mapPass),i.clear(),i.renderBufferDirect(C,null,P,d,v,null),f.uniforms.shadow_pass.value=E.mapPass.texture,f.uniforms.resolution.value=E.mapSize,f.uniforms.radius.value=E.radius,i.setRenderTarget(E.map),i.clear(),i.renderBufferDirect(C,null,P,f,v,null)}function M(E,C,P,b){let y=null;const R=P.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(R!==void 0)y=R;else if(y=P.isPointLight===!0?l:a,i.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0){const O=y.uuid,N=C.uuid;let U=c[O];U===void 0&&(U={},c[O]=U);let F=U[N];F===void 0&&(F=y.clone(),U[N]=F,C.addEventListener("dispose",I)),y=F}if(y.visible=C.visible,y.wireframe=C.wireframe,b===Dn?y.side=C.shadowSide!==null?C.shadowSide:C.side:y.side=C.shadowSide!==null?C.shadowSide:u[C.side],y.alphaMap=C.alphaMap,y.alphaTest=C.alphaTest,y.map=C.map,y.clipShadows=C.clipShadows,y.clippingPlanes=C.clippingPlanes,y.clipIntersection=C.clipIntersection,y.displacementMap=C.displacementMap,y.displacementScale=C.displacementScale,y.displacementBias=C.displacementBias,y.wireframeLinewidth=C.wireframeLinewidth,y.linewidth=C.linewidth,P.isPointLight===!0&&y.isMeshDistanceMaterial===!0){const O=i.properties.get(y);O.light=P}return y}function _(E,C,P,b,y){if(E.visible===!1)return;if(E.layers.test(C.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&y===Dn)&&(!E.frustumCulled||n.intersectsObject(E))){E.modelViewMatrix.multiplyMatrices(P.matrixWorldInverse,E.matrixWorld);const N=t.update(E),U=E.material;if(Array.isArray(U)){const F=N.groups;for(let V=0,K=F.length;V<K;V++){const q=F[V],D=U[q.materialIndex];if(D&&D.visible){const G=M(E,D,b,y);E.onBeforeShadow(i,E,C,P,N,G,q),i.renderBufferDirect(P,null,N,G,E,q),E.onAfterShadow(i,E,C,P,N,G,q)}}}else if(U.visible){const F=M(E,U,b,y);E.onBeforeShadow(i,E,C,P,N,F,null),i.renderBufferDirect(P,null,N,F,E,null),E.onAfterShadow(i,E,C,P,N,F,null)}}const O=E.children;for(let N=0,U=O.length;N<U;N++)_(O[N],C,P,b,y)}function I(E){E.target.removeEventListener("dispose",I);for(const P in c){const b=c[P],y=E.target.uuid;y in b&&(b[y].dispose(),delete b[y])}}}const _v={[Na]:Oa,[Fa]:za,[Ba]:Ha,[is]:ka,[Oa]:Na,[za]:Fa,[Ha]:Ba,[ka]:is};function Mv(i,t){function e(){let B=!1;const _t=new ie;let J=null;const st=new ie(0,0,0,0);return{setMask:function(St){J!==St&&!B&&(i.colorMask(St,St,St,St),J=St)},setLocked:function(St){B=St},setClear:function(St,xt,Gt,ge,Fe){Fe===!0&&(St*=ge,xt*=ge,Gt*=ge),_t.set(St,xt,Gt,ge),st.equals(_t)===!1&&(i.clearColor(St,xt,Gt,ge),st.copy(_t))},reset:function(){B=!1,J=null,st.set(-1,0,0,0)}}}function n(){let B=!1,_t=!1,J=null,st=null,St=null;return{setReversed:function(xt){if(_t!==xt){const Gt=t.get("EXT_clip_control");_t?Gt.clipControlEXT(Gt.LOWER_LEFT_EXT,Gt.ZERO_TO_ONE_EXT):Gt.clipControlEXT(Gt.LOWER_LEFT_EXT,Gt.NEGATIVE_ONE_TO_ONE_EXT);const ge=St;St=null,this.setClear(ge)}_t=xt},getReversed:function(){return _t},setTest:function(xt){xt?lt(i.DEPTH_TEST):Pt(i.DEPTH_TEST)},setMask:function(xt){J!==xt&&!B&&(i.depthMask(xt),J=xt)},setFunc:function(xt){if(_t&&(xt=_v[xt]),st!==xt){switch(xt){case Na:i.depthFunc(i.NEVER);break;case Oa:i.depthFunc(i.ALWAYS);break;case Fa:i.depthFunc(i.LESS);break;case is:i.depthFunc(i.LEQUAL);break;case Ba:i.depthFunc(i.EQUAL);break;case ka:i.depthFunc(i.GEQUAL);break;case za:i.depthFunc(i.GREATER);break;case Ha:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}st=xt}},setLocked:function(xt){B=xt},setClear:function(xt){St!==xt&&(_t&&(xt=1-xt),i.clearDepth(xt),St=xt)},reset:function(){B=!1,J=null,st=null,St=null,_t=!1}}}function s(){let B=!1,_t=null,J=null,st=null,St=null,xt=null,Gt=null,ge=null,Fe=null;return{setTest:function(oe){B||(oe?lt(i.STENCIL_TEST):Pt(i.STENCIL_TEST))},setMask:function(oe){_t!==oe&&!B&&(i.stencilMask(oe),_t=oe)},setFunc:function(oe,cn,En){(J!==oe||st!==cn||St!==En)&&(i.stencilFunc(oe,cn,En),J=oe,st=cn,St=En)},setOp:function(oe,cn,En){(xt!==oe||Gt!==cn||ge!==En)&&(i.stencilOp(oe,cn,En),xt=oe,Gt=cn,ge=En)},setLocked:function(oe){B=oe},setClear:function(oe){Fe!==oe&&(i.clearStencil(oe),Fe=oe)},reset:function(){B=!1,_t=null,J=null,st=null,St=null,xt=null,Gt=null,ge=null,Fe=null}}}const r=new e,o=new n,a=new s,l=new WeakMap,c=new WeakMap;let h={},u={},d=new WeakMap,f=[],g=null,v=!1,m=null,p=null,x=null,M=null,_=null,I=null,E=null,C=new Et(0,0,0),P=0,b=!1,y=null,R=null,O=null,N=null,U=null;const F=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let V=!1,K=0;const q=i.getParameter(i.VERSION);q.indexOf("WebGL")!==-1?(K=parseFloat(/^WebGL (\d)/.exec(q)[1]),V=K>=1):q.indexOf("OpenGL ES")!==-1&&(K=parseFloat(/^OpenGL ES (\d)/.exec(q)[1]),V=K>=2);let D=null,G={};const et=i.getParameter(i.SCISSOR_BOX),dt=i.getParameter(i.VIEWPORT),Ht=new ie().fromArray(et),Q=new ie().fromArray(dt);function ot(B,_t,J,st){const St=new Uint8Array(4),xt=i.createTexture();i.bindTexture(B,xt),i.texParameteri(B,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(B,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let Gt=0;Gt<J;Gt++)B===i.TEXTURE_3D||B===i.TEXTURE_2D_ARRAY?i.texImage3D(_t,0,i.RGBA,1,1,st,0,i.RGBA,i.UNSIGNED_BYTE,St):i.texImage2D(_t+Gt,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,St);return xt}const mt={};mt[i.TEXTURE_2D]=ot(i.TEXTURE_2D,i.TEXTURE_2D,1),mt[i.TEXTURE_CUBE_MAP]=ot(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),mt[i.TEXTURE_2D_ARRAY]=ot(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),mt[i.TEXTURE_3D]=ot(i.TEXTURE_3D,i.TEXTURE_3D,1,1),r.setClear(0,0,0,1),o.setClear(1),a.setClear(0),lt(i.DEPTH_TEST),o.setFunc(is),at(!1),wt(nc),lt(i.CULL_FACE),L(ti);function lt(B){h[B]!==!0&&(i.enable(B),h[B]=!0)}function Pt(B){h[B]!==!1&&(i.disable(B),h[B]=!1)}function Ft(B,_t){return u[B]!==_t?(i.bindFramebuffer(B,_t),u[B]=_t,B===i.DRAW_FRAMEBUFFER&&(u[i.FRAMEBUFFER]=_t),B===i.FRAMEBUFFER&&(u[i.DRAW_FRAMEBUFFER]=_t),!0):!1}function ft(B,_t){let J=f,st=!1;if(B){J=d.get(_t),J===void 0&&(J=[],d.set(_t,J));const St=B.textures;if(J.length!==St.length||J[0]!==i.COLOR_ATTACHMENT0){for(let xt=0,Gt=St.length;xt<Gt;xt++)J[xt]=i.COLOR_ATTACHMENT0+xt;J.length=St.length,st=!0}}else J[0]!==i.BACK&&(J[0]=i.BACK,st=!0);st&&i.drawBuffers(J)}function bt(B){return g!==B?(i.useProgram(B),g=B,!0):!1}const j={[_n]:i.FUNC_ADD,[wd]:i.FUNC_SUBTRACT,[Ed]:i.FUNC_REVERSE_SUBTRACT};j[Td]=i.MIN,j[Ad]=i.MAX;const it={[oo]:i.ZERO,[yi]:i.ONE,[su]:i.SRC_COLOR,[Ua]:i.SRC_ALPHA,[Dd]:i.SRC_ALPHA_SATURATE,[Ld]:i.DST_COLOR,[Rd]:i.DST_ALPHA,[Cd]:i.ONE_MINUS_SRC_COLOR,[Xs]:i.ONE_MINUS_SRC_ALPHA,[Id]:i.ONE_MINUS_DST_COLOR,[Pd]:i.ONE_MINUS_DST_ALPHA,[Ud]:i.CONSTANT_COLOR,[Nd]:i.ONE_MINUS_CONSTANT_COLOR,[Od]:i.CONSTANT_ALPHA,[Fd]:i.ONE_MINUS_CONSTANT_ALPHA};function L(B,_t,J,st,St,xt,Gt,ge,Fe,oe){if(B===ti){v===!0&&(Pt(i.BLEND),v=!1);return}if(v===!1&&(lt(i.BLEND),v=!0),B!==go){if(B!==m||oe!==b){if((p!==_n||_!==_n)&&(i.blendEquation(i.FUNC_ADD),p=_n,_=_n),oe)switch(B){case xi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Ys:i.blendFunc(i.ONE,i.ONE);break;case ic:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case sc:i.blendFuncSeparate(i.ZERO,i.SRC_COLOR,i.ZERO,i.SRC_ALPHA);break;default:console.error("THREE.WebGLState: Invalid blending: ",B);break}else switch(B){case xi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case Ys:i.blendFunc(i.SRC_ALPHA,i.ONE);break;case ic:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case sc:i.blendFunc(i.ZERO,i.SRC_COLOR);break;default:console.error("THREE.WebGLState: Invalid blending: ",B);break}x=null,M=null,I=null,E=null,C.set(0,0,0),P=0,m=B,b=oe}return}St=St||_t,xt=xt||J,Gt=Gt||st,(_t!==p||St!==_)&&(i.blendEquationSeparate(j[_t],j[St]),p=_t,_=St),(J!==x||st!==M||xt!==I||Gt!==E)&&(i.blendFuncSeparate(it[J],it[st],it[xt],it[Gt]),x=J,M=st,I=xt,E=Gt),(ge.equals(C)===!1||Fe!==P)&&(i.blendColor(ge.r,ge.g,ge.b,Fe),C.copy(ge),P=Fe),m=B,b=!1}function At(B,_t){B.side===je?Pt(i.CULL_FACE):lt(i.CULL_FACE);let J=B.side===Ye;_t&&(J=!J),at(J),B.blending===xi&&B.transparent===!1?L(ti):L(B.blending,B.blendEquation,B.blendSrc,B.blendDst,B.blendEquationAlpha,B.blendSrcAlpha,B.blendDstAlpha,B.blendColor,B.blendAlpha,B.premultipliedAlpha),o.setFunc(B.depthFunc),o.setTest(B.depthTest),o.setMask(B.depthWrite),r.setMask(B.colorWrite);const st=B.stencilWrite;a.setTest(st),st&&(a.setMask(B.stencilWriteMask),a.setFunc(B.stencilFunc,B.stencilRef,B.stencilFuncMask),a.setOp(B.stencilFail,B.stencilZFail,B.stencilZPass)),Bt(B.polygonOffset,B.polygonOffsetFactor,B.polygonOffsetUnits),B.alphaToCoverage===!0?lt(i.SAMPLE_ALPHA_TO_COVERAGE):Pt(i.SAMPLE_ALPHA_TO_COVERAGE)}function at(B){y!==B&&(B?i.frontFace(i.CW):i.frontFace(i.CCW),y=B)}function wt(B){B!==bd?(lt(i.CULL_FACE),B!==R&&(B===nc?i.cullFace(i.BACK):B===Sd?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Pt(i.CULL_FACE),R=B}function ct(B){B!==O&&(V&&i.lineWidth(B),O=B)}function Bt(B,_t,J){B?(lt(i.POLYGON_OFFSET_FILL),(N!==_t||U!==J)&&(i.polygonOffset(_t,J),N=_t,U=J)):Pt(i.POLYGON_OFFSET_FILL)}function pt(B){B?lt(i.SCISSOR_TEST):Pt(i.SCISSOR_TEST)}function A(B){B===void 0&&(B=i.TEXTURE0+F-1),D!==B&&(i.activeTexture(B),D=B)}function S(B,_t,J){J===void 0&&(D===null?J=i.TEXTURE0+F-1:J=D);let st=G[J];st===void 0&&(st={type:void 0,texture:void 0},G[J]=st),(st.type!==B||st.texture!==_t)&&(D!==J&&(i.activeTexture(J),D=J),i.bindTexture(B,_t||mt[B]),st.type=B,st.texture=_t)}function W(){const B=G[D];B!==void 0&&B.type!==void 0&&(i.bindTexture(B.type,null),B.type=void 0,B.texture=void 0)}function Z(){try{i.compressedTexImage2D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function rt(){try{i.compressedTexImage3D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function nt(){try{i.texSubImage2D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function It(){try{i.texSubImage3D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function vt(){try{i.compressedTexSubImage2D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function Tt(){try{i.compressedTexSubImage3D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function Kt(){try{i.texStorage2D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function ht(){try{i.texStorage3D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function Ct(){try{i.texImage2D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function kt(){try{i.texImage3D.apply(i,arguments)}catch(B){console.error("THREE.WebGLState:",B)}}function zt(B){Ht.equals(B)===!1&&(i.scissor(B.x,B.y,B.z,B.w),Ht.copy(B))}function Rt(B){Q.equals(B)===!1&&(i.viewport(B.x,B.y,B.z,B.w),Q.copy(B))}function Zt(B,_t){let J=c.get(_t);J===void 0&&(J=new WeakMap,c.set(_t,J));let st=J.get(B);st===void 0&&(st=i.getUniformBlockIndex(_t,B.name),J.set(B,st))}function Xt(B,_t){const st=c.get(_t).get(B);l.get(_t)!==st&&(i.uniformBlockBinding(_t,st,B.__bindingPointIndex),l.set(_t,st))}function ce(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),o.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),h={},D=null,G={},u={},d=new WeakMap,f=[],g=null,v=!1,m=null,p=null,x=null,M=null,_=null,I=null,E=null,C=new Et(0,0,0),P=0,b=!1,y=null,R=null,O=null,N=null,U=null,Ht.set(0,0,i.canvas.width,i.canvas.height),Q.set(0,0,i.canvas.width,i.canvas.height),r.reset(),o.reset(),a.reset()}return{buffers:{color:r,depth:o,stencil:a},enable:lt,disable:Pt,bindFramebuffer:Ft,drawBuffers:ft,useProgram:bt,setBlending:L,setMaterial:At,setFlipSided:at,setCullFace:wt,setLineWidth:ct,setPolygonOffset:Bt,setScissorTest:pt,activeTexture:A,bindTexture:S,unbindTexture:W,compressedTexImage2D:Z,compressedTexImage3D:rt,texImage2D:Ct,texImage3D:kt,updateUBOMapping:Zt,uniformBlockBinding:Xt,texStorage2D:Kt,texStorage3D:ht,texSubImage2D:nt,texSubImage3D:It,compressedTexSubImage2D:vt,compressedTexSubImage3D:Tt,scissor:zt,viewport:Rt,reset:ce}}function Jc(i,t,e,n){const s=xv(n);switch(e){case uu:return i*t;case fu:return i*t;case pu:return i*t*2;case Ll:return i*t/s.components*s.byteLength;case Il:return i*t/s.components*s.byteLength;case mu:return i*t*2/s.components*s.byteLength;case Dl:return i*t*2/s.components*s.byteLength;case du:return i*t*3/s.components*s.byteLength;case mn:return i*t*4/s.components*s.byteLength;case Ul:return i*t*4/s.components*s.byteLength;case Zr:case Jr:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Qr:case to:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ya:case $a:return Math.max(i,16)*Math.max(t,8)/4;case qa:case Xa:return Math.max(i,8)*Math.max(t,8)/2;case ja:case Ka:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*8;case Za:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Ja:return Math.floor((i+3)/4)*Math.floor((t+3)/4)*16;case Qa:return Math.floor((i+4)/5)*Math.floor((t+3)/4)*16;case tl:return Math.floor((i+4)/5)*Math.floor((t+4)/5)*16;case el:return Math.floor((i+5)/6)*Math.floor((t+4)/5)*16;case nl:return Math.floor((i+5)/6)*Math.floor((t+5)/6)*16;case il:return Math.floor((i+7)/8)*Math.floor((t+4)/5)*16;case sl:return Math.floor((i+7)/8)*Math.floor((t+5)/6)*16;case rl:return Math.floor((i+7)/8)*Math.floor((t+7)/8)*16;case ol:return Math.floor((i+9)/10)*Math.floor((t+4)/5)*16;case al:return Math.floor((i+9)/10)*Math.floor((t+5)/6)*16;case ll:return Math.floor((i+9)/10)*Math.floor((t+7)/8)*16;case cl:return Math.floor((i+9)/10)*Math.floor((t+9)/10)*16;case hl:return Math.floor((i+11)/12)*Math.floor((t+9)/10)*16;case ul:return Math.floor((i+11)/12)*Math.floor((t+11)/12)*16;case eo:case dl:case fl:return Math.ceil(i/4)*Math.ceil(t/4)*16;case gu:case pl:return Math.ceil(i/4)*Math.ceil(t/4)*8;case ml:case gl:return Math.ceil(i/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function xv(i){switch(i){case On:case lu:return{byteLength:1,components:1};case $s:case cu:case sr:return{byteLength:2,components:1};case Rl:case Pl:return{byteLength:2,components:4};case bi:case Cl:case xn:return{byteLength:4,components:1};case hu:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${i}.`)}function yv(i,t,e,n,s,r,o){const a=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new H,h=new WeakMap;let u;const d=new WeakMap;let f=!1;try{f=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(A,S){return f?new OffscreenCanvas(A,S):lo("canvas")}function v(A,S,W){let Z=1;const rt=pt(A);if((rt.width>W||rt.height>W)&&(Z=W/Math.max(rt.width,rt.height)),Z<1)if(typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&A instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&A instanceof ImageBitmap||typeof VideoFrame<"u"&&A instanceof VideoFrame){const nt=Math.floor(Z*rt.width),It=Math.floor(Z*rt.height);u===void 0&&(u=g(nt,It));const vt=S?g(nt,It):u;return vt.width=nt,vt.height=It,vt.getContext("2d").drawImage(A,0,0,nt,It),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+rt.width+"x"+rt.height+") to ("+nt+"x"+It+")."),vt}else return"data"in A&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+rt.width+"x"+rt.height+")."),A;return A}function m(A){return A.generateMipmaps}function p(A){i.generateMipmap(A)}function x(A){return A.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:A.isWebGL3DRenderTarget?i.TEXTURE_3D:A.isWebGLArrayRenderTarget||A.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function M(A,S,W,Z,rt=!1){if(A!==null){if(i[A]!==void 0)return i[A];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let nt=S;if(S===i.RED&&(W===i.FLOAT&&(nt=i.R32F),W===i.HALF_FLOAT&&(nt=i.R16F),W===i.UNSIGNED_BYTE&&(nt=i.R8)),S===i.RED_INTEGER&&(W===i.UNSIGNED_BYTE&&(nt=i.R8UI),W===i.UNSIGNED_SHORT&&(nt=i.R16UI),W===i.UNSIGNED_INT&&(nt=i.R32UI),W===i.BYTE&&(nt=i.R8I),W===i.SHORT&&(nt=i.R16I),W===i.INT&&(nt=i.R32I)),S===i.RG&&(W===i.FLOAT&&(nt=i.RG32F),W===i.HALF_FLOAT&&(nt=i.RG16F),W===i.UNSIGNED_BYTE&&(nt=i.RG8)),S===i.RG_INTEGER&&(W===i.UNSIGNED_BYTE&&(nt=i.RG8UI),W===i.UNSIGNED_SHORT&&(nt=i.RG16UI),W===i.UNSIGNED_INT&&(nt=i.RG32UI),W===i.BYTE&&(nt=i.RG8I),W===i.SHORT&&(nt=i.RG16I),W===i.INT&&(nt=i.RG32I)),S===i.RGB_INTEGER&&(W===i.UNSIGNED_BYTE&&(nt=i.RGB8UI),W===i.UNSIGNED_SHORT&&(nt=i.RGB16UI),W===i.UNSIGNED_INT&&(nt=i.RGB32UI),W===i.BYTE&&(nt=i.RGB8I),W===i.SHORT&&(nt=i.RGB16I),W===i.INT&&(nt=i.RGB32I)),S===i.RGBA_INTEGER&&(W===i.UNSIGNED_BYTE&&(nt=i.RGBA8UI),W===i.UNSIGNED_SHORT&&(nt=i.RGBA16UI),W===i.UNSIGNED_INT&&(nt=i.RGBA32UI),W===i.BYTE&&(nt=i.RGBA8I),W===i.SHORT&&(nt=i.RGBA16I),W===i.INT&&(nt=i.RGBA32I)),S===i.RGB&&W===i.UNSIGNED_INT_5_9_9_9_REV&&(nt=i.RGB9_E5),S===i.RGBA){const It=rt?_o:Qt.getTransfer(Z);W===i.FLOAT&&(nt=i.RGBA32F),W===i.HALF_FLOAT&&(nt=i.RGBA16F),W===i.UNSIGNED_BYTE&&(nt=It===ae?i.SRGB8_ALPHA8:i.RGBA8),W===i.UNSIGNED_SHORT_4_4_4_4&&(nt=i.RGBA4),W===i.UNSIGNED_SHORT_5_5_5_1&&(nt=i.RGB5_A1)}return(nt===i.R16F||nt===i.R32F||nt===i.RG16F||nt===i.RG32F||nt===i.RGBA16F||nt===i.RGBA32F)&&t.get("EXT_color_buffer_float"),nt}function _(A,S){let W;return A?S===null||S===bi||S===as?W=i.DEPTH24_STENCIL8:S===xn?W=i.DEPTH32F_STENCIL8:S===$s&&(W=i.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):S===null||S===bi||S===as?W=i.DEPTH_COMPONENT24:S===xn?W=i.DEPTH_COMPONENT32F:S===$s&&(W=i.DEPTH_COMPONENT16),W}function I(A,S){return m(A)===!0||A.isFramebufferTexture&&A.minFilter!==en&&A.minFilter!==Mn?Math.log2(Math.max(S.width,S.height))+1:A.mipmaps!==void 0&&A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?S.mipmaps.length:1}function E(A){const S=A.target;S.removeEventListener("dispose",E),P(S),S.isVideoTexture&&h.delete(S)}function C(A){const S=A.target;S.removeEventListener("dispose",C),y(S)}function P(A){const S=n.get(A);if(S.__webglInit===void 0)return;const W=A.source,Z=d.get(W);if(Z){const rt=Z[S.__cacheKey];rt.usedTimes--,rt.usedTimes===0&&b(A),Object.keys(Z).length===0&&d.delete(W)}n.remove(A)}function b(A){const S=n.get(A);i.deleteTexture(S.__webglTexture);const W=A.source,Z=d.get(W);delete Z[S.__cacheKey],o.memory.textures--}function y(A){const S=n.get(A);if(A.depthTexture&&(A.depthTexture.dispose(),n.remove(A.depthTexture)),A.isWebGLCubeRenderTarget)for(let Z=0;Z<6;Z++){if(Array.isArray(S.__webglFramebuffer[Z]))for(let rt=0;rt<S.__webglFramebuffer[Z].length;rt++)i.deleteFramebuffer(S.__webglFramebuffer[Z][rt]);else i.deleteFramebuffer(S.__webglFramebuffer[Z]);S.__webglDepthbuffer&&i.deleteRenderbuffer(S.__webglDepthbuffer[Z])}else{if(Array.isArray(S.__webglFramebuffer))for(let Z=0;Z<S.__webglFramebuffer.length;Z++)i.deleteFramebuffer(S.__webglFramebuffer[Z]);else i.deleteFramebuffer(S.__webglFramebuffer);if(S.__webglDepthbuffer&&i.deleteRenderbuffer(S.__webglDepthbuffer),S.__webglMultisampledFramebuffer&&i.deleteFramebuffer(S.__webglMultisampledFramebuffer),S.__webglColorRenderbuffer)for(let Z=0;Z<S.__webglColorRenderbuffer.length;Z++)S.__webglColorRenderbuffer[Z]&&i.deleteRenderbuffer(S.__webglColorRenderbuffer[Z]);S.__webglDepthRenderbuffer&&i.deleteRenderbuffer(S.__webglDepthRenderbuffer)}const W=A.textures;for(let Z=0,rt=W.length;Z<rt;Z++){const nt=n.get(W[Z]);nt.__webglTexture&&(i.deleteTexture(nt.__webglTexture),o.memory.textures--),n.remove(W[Z])}n.remove(A)}let R=0;function O(){R=0}function N(){const A=R;return A>=s.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+A+" texture units while this GPU supports only "+s.maxTextures),R+=1,A}function U(A){const S=[];return S.push(A.wrapS),S.push(A.wrapT),S.push(A.wrapR||0),S.push(A.magFilter),S.push(A.minFilter),S.push(A.anisotropy),S.push(A.internalFormat),S.push(A.format),S.push(A.type),S.push(A.generateMipmaps),S.push(A.premultiplyAlpha),S.push(A.flipY),S.push(A.unpackAlignment),S.push(A.colorSpace),S.join()}function F(A,S){const W=n.get(A);if(A.isVideoTexture&&ct(A),A.isRenderTargetTexture===!1&&A.version>0&&W.__version!==A.version){const Z=A.image;if(Z===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(Z.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{Q(W,A,S);return}}e.bindTexture(i.TEXTURE_2D,W.__webglTexture,i.TEXTURE0+S)}function V(A,S){const W=n.get(A);if(A.version>0&&W.__version!==A.version){Q(W,A,S);return}e.bindTexture(i.TEXTURE_2D_ARRAY,W.__webglTexture,i.TEXTURE0+S)}function K(A,S){const W=n.get(A);if(A.version>0&&W.__version!==A.version){Q(W,A,S);return}e.bindTexture(i.TEXTURE_3D,W.__webglTexture,i.TEXTURE0+S)}function q(A,S){const W=n.get(A);if(A.version>0&&W.__version!==A.version){ot(W,A,S);return}e.bindTexture(i.TEXTURE_CUBE_MAP,W.__webglTexture,i.TEXTURE0+S)}const D={[os]:i.REPEAT,[vi]:i.CLAMP_TO_EDGE,[Wa]:i.MIRRORED_REPEAT},G={[en]:i.NEAREST,[Yd]:i.NEAREST_MIPMAP_NEAREST,[fr]:i.NEAREST_MIPMAP_LINEAR,[Mn]:i.LINEAR,[Io]:i.LINEAR_MIPMAP_NEAREST,[_i]:i.LINEAR_MIPMAP_LINEAR},et={[Kd]:i.NEVER,[nf]:i.ALWAYS,[Zd]:i.LESS,[_u]:i.LEQUAL,[Jd]:i.EQUAL,[ef]:i.GEQUAL,[Qd]:i.GREATER,[tf]:i.NOTEQUAL};function dt(A,S){if(S.type===xn&&t.has("OES_texture_float_linear")===!1&&(S.magFilter===Mn||S.magFilter===Io||S.magFilter===fr||S.magFilter===_i||S.minFilter===Mn||S.minFilter===Io||S.minFilter===fr||S.minFilter===_i)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(A,i.TEXTURE_WRAP_S,D[S.wrapS]),i.texParameteri(A,i.TEXTURE_WRAP_T,D[S.wrapT]),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,D[S.wrapR]),i.texParameteri(A,i.TEXTURE_MAG_FILTER,G[S.magFilter]),i.texParameteri(A,i.TEXTURE_MIN_FILTER,G[S.minFilter]),S.compareFunction&&(i.texParameteri(A,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(A,i.TEXTURE_COMPARE_FUNC,et[S.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(S.magFilter===en||S.minFilter!==fr&&S.minFilter!==_i||S.type===xn&&t.has("OES_texture_float_linear")===!1)return;if(S.anisotropy>1||n.get(S).__currentAnisotropy){const W=t.get("EXT_texture_filter_anisotropic");i.texParameterf(A,W.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,s.getMaxAnisotropy())),n.get(S).__currentAnisotropy=S.anisotropy}}}function Ht(A,S){let W=!1;A.__webglInit===void 0&&(A.__webglInit=!0,S.addEventListener("dispose",E));const Z=S.source;let rt=d.get(Z);rt===void 0&&(rt={},d.set(Z,rt));const nt=U(S);if(nt!==A.__cacheKey){rt[nt]===void 0&&(rt[nt]={texture:i.createTexture(),usedTimes:0},o.memory.textures++,W=!0),rt[nt].usedTimes++;const It=rt[A.__cacheKey];It!==void 0&&(rt[A.__cacheKey].usedTimes--,It.usedTimes===0&&b(S)),A.__cacheKey=nt,A.__webglTexture=rt[nt].texture}return W}function Q(A,S,W){let Z=i.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(Z=i.TEXTURE_2D_ARRAY),S.isData3DTexture&&(Z=i.TEXTURE_3D);const rt=Ht(A,S),nt=S.source;e.bindTexture(Z,A.__webglTexture,i.TEXTURE0+W);const It=n.get(nt);if(nt.version!==It.__version||rt===!0){e.activeTexture(i.TEXTURE0+W);const vt=Qt.getPrimaries(Qt.workingColorSpace),Tt=S.colorSpace===Zn?null:Qt.getPrimaries(S.colorSpace),Kt=S.colorSpace===Zn||vt===Tt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,S.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,S.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Kt);let ht=v(S.image,!1,s.maxTextureSize);ht=Bt(S,ht);const Ct=r.convert(S.format,S.colorSpace),kt=r.convert(S.type);let zt=M(S.internalFormat,Ct,kt,S.colorSpace,S.isVideoTexture);dt(Z,S);let Rt;const Zt=S.mipmaps,Xt=S.isVideoTexture!==!0,ce=It.__version===void 0||rt===!0,B=nt.dataReady,_t=I(S,ht);if(S.isDepthTexture)zt=_(S.format===ls,S.type),ce&&(Xt?e.texStorage2D(i.TEXTURE_2D,1,zt,ht.width,ht.height):e.texImage2D(i.TEXTURE_2D,0,zt,ht.width,ht.height,0,Ct,kt,null));else if(S.isDataTexture)if(Zt.length>0){Xt&&ce&&e.texStorage2D(i.TEXTURE_2D,_t,zt,Zt[0].width,Zt[0].height);for(let J=0,st=Zt.length;J<st;J++)Rt=Zt[J],Xt?B&&e.texSubImage2D(i.TEXTURE_2D,J,0,0,Rt.width,Rt.height,Ct,kt,Rt.data):e.texImage2D(i.TEXTURE_2D,J,zt,Rt.width,Rt.height,0,Ct,kt,Rt.data);S.generateMipmaps=!1}else Xt?(ce&&e.texStorage2D(i.TEXTURE_2D,_t,zt,ht.width,ht.height),B&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,ht.width,ht.height,Ct,kt,ht.data)):e.texImage2D(i.TEXTURE_2D,0,zt,ht.width,ht.height,0,Ct,kt,ht.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){Xt&&ce&&e.texStorage3D(i.TEXTURE_2D_ARRAY,_t,zt,Zt[0].width,Zt[0].height,ht.depth);for(let J=0,st=Zt.length;J<st;J++)if(Rt=Zt[J],S.format!==mn)if(Ct!==null)if(Xt){if(B)if(S.layerUpdates.size>0){const St=Jc(Rt.width,Rt.height,S.format,S.type);for(const xt of S.layerUpdates){const Gt=Rt.data.subarray(xt*St/Rt.data.BYTES_PER_ELEMENT,(xt+1)*St/Rt.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,xt,Rt.width,Rt.height,1,Ct,Gt)}S.clearLayerUpdates()}else e.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,0,Rt.width,Rt.height,ht.depth,Ct,Rt.data)}else e.compressedTexImage3D(i.TEXTURE_2D_ARRAY,J,zt,Rt.width,Rt.height,ht.depth,0,Rt.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Xt?B&&e.texSubImage3D(i.TEXTURE_2D_ARRAY,J,0,0,0,Rt.width,Rt.height,ht.depth,Ct,kt,Rt.data):e.texImage3D(i.TEXTURE_2D_ARRAY,J,zt,Rt.width,Rt.height,ht.depth,0,Ct,kt,Rt.data)}else{Xt&&ce&&e.texStorage2D(i.TEXTURE_2D,_t,zt,Zt[0].width,Zt[0].height);for(let J=0,st=Zt.length;J<st;J++)Rt=Zt[J],S.format!==mn?Ct!==null?Xt?B&&e.compressedTexSubImage2D(i.TEXTURE_2D,J,0,0,Rt.width,Rt.height,Ct,Rt.data):e.compressedTexImage2D(i.TEXTURE_2D,J,zt,Rt.width,Rt.height,0,Rt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Xt?B&&e.texSubImage2D(i.TEXTURE_2D,J,0,0,Rt.width,Rt.height,Ct,kt,Rt.data):e.texImage2D(i.TEXTURE_2D,J,zt,Rt.width,Rt.height,0,Ct,kt,Rt.data)}else if(S.isDataArrayTexture)if(Xt){if(ce&&e.texStorage3D(i.TEXTURE_2D_ARRAY,_t,zt,ht.width,ht.height,ht.depth),B)if(S.layerUpdates.size>0){const J=Jc(ht.width,ht.height,S.format,S.type);for(const st of S.layerUpdates){const St=ht.data.subarray(st*J/ht.data.BYTES_PER_ELEMENT,(st+1)*J/ht.data.BYTES_PER_ELEMENT);e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,st,ht.width,ht.height,1,Ct,kt,St)}S.clearLayerUpdates()}else e.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,ht.width,ht.height,ht.depth,Ct,kt,ht.data)}else e.texImage3D(i.TEXTURE_2D_ARRAY,0,zt,ht.width,ht.height,ht.depth,0,Ct,kt,ht.data);else if(S.isData3DTexture)Xt?(ce&&e.texStorage3D(i.TEXTURE_3D,_t,zt,ht.width,ht.height,ht.depth),B&&e.texSubImage3D(i.TEXTURE_3D,0,0,0,0,ht.width,ht.height,ht.depth,Ct,kt,ht.data)):e.texImage3D(i.TEXTURE_3D,0,zt,ht.width,ht.height,ht.depth,0,Ct,kt,ht.data);else if(S.isFramebufferTexture){if(ce)if(Xt)e.texStorage2D(i.TEXTURE_2D,_t,zt,ht.width,ht.height);else{let J=ht.width,st=ht.height;for(let St=0;St<_t;St++)e.texImage2D(i.TEXTURE_2D,St,zt,J,st,0,Ct,kt,null),J>>=1,st>>=1}}else if(Zt.length>0){if(Xt&&ce){const J=pt(Zt[0]);e.texStorage2D(i.TEXTURE_2D,_t,zt,J.width,J.height)}for(let J=0,st=Zt.length;J<st;J++)Rt=Zt[J],Xt?B&&e.texSubImage2D(i.TEXTURE_2D,J,0,0,Ct,kt,Rt):e.texImage2D(i.TEXTURE_2D,J,zt,Ct,kt,Rt);S.generateMipmaps=!1}else if(Xt){if(ce){const J=pt(ht);e.texStorage2D(i.TEXTURE_2D,_t,zt,J.width,J.height)}B&&e.texSubImage2D(i.TEXTURE_2D,0,0,0,Ct,kt,ht)}else e.texImage2D(i.TEXTURE_2D,0,zt,Ct,kt,ht);m(S)&&p(Z),It.__version=nt.version,S.onUpdate&&S.onUpdate(S)}A.__version=S.version}function ot(A,S,W){if(S.image.length!==6)return;const Z=Ht(A,S),rt=S.source;e.bindTexture(i.TEXTURE_CUBE_MAP,A.__webglTexture,i.TEXTURE0+W);const nt=n.get(rt);if(rt.version!==nt.__version||Z===!0){e.activeTexture(i.TEXTURE0+W);const It=Qt.getPrimaries(Qt.workingColorSpace),vt=S.colorSpace===Zn?null:Qt.getPrimaries(S.colorSpace),Tt=S.colorSpace===Zn||It===vt?i.NONE:i.BROWSER_DEFAULT_WEBGL;i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,S.flipY),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),i.pixelStorei(i.UNPACK_ALIGNMENT,S.unpackAlignment),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,Tt);const Kt=S.isCompressedTexture||S.image[0].isCompressedTexture,ht=S.image[0]&&S.image[0].isDataTexture,Ct=[];for(let st=0;st<6;st++)!Kt&&!ht?Ct[st]=v(S.image[st],!0,s.maxCubemapSize):Ct[st]=ht?S.image[st].image:S.image[st],Ct[st]=Bt(S,Ct[st]);const kt=Ct[0],zt=r.convert(S.format,S.colorSpace),Rt=r.convert(S.type),Zt=M(S.internalFormat,zt,Rt,S.colorSpace),Xt=S.isVideoTexture!==!0,ce=nt.__version===void 0||Z===!0,B=rt.dataReady;let _t=I(S,kt);dt(i.TEXTURE_CUBE_MAP,S);let J;if(Kt){Xt&&ce&&e.texStorage2D(i.TEXTURE_CUBE_MAP,_t,Zt,kt.width,kt.height);for(let st=0;st<6;st++){J=Ct[st].mipmaps;for(let St=0;St<J.length;St++){const xt=J[St];S.format!==mn?zt!==null?Xt?B&&e.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,St,0,0,xt.width,xt.height,zt,xt.data):e.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,St,Zt,xt.width,xt.height,0,xt.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):Xt?B&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,St,0,0,xt.width,xt.height,zt,Rt,xt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,St,Zt,xt.width,xt.height,0,zt,Rt,xt.data)}}}else{if(J=S.mipmaps,Xt&&ce){J.length>0&&_t++;const st=pt(Ct[0]);e.texStorage2D(i.TEXTURE_CUBE_MAP,_t,Zt,st.width,st.height)}for(let st=0;st<6;st++)if(ht){Xt?B&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,0,0,0,Ct[st].width,Ct[st].height,zt,Rt,Ct[st].data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,0,Zt,Ct[st].width,Ct[st].height,0,zt,Rt,Ct[st].data);for(let St=0;St<J.length;St++){const Gt=J[St].image[st].image;Xt?B&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,St+1,0,0,Gt.width,Gt.height,zt,Rt,Gt.data):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,St+1,Zt,Gt.width,Gt.height,0,zt,Rt,Gt.data)}}else{Xt?B&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,0,0,0,zt,Rt,Ct[st]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,0,Zt,zt,Rt,Ct[st]);for(let St=0;St<J.length;St++){const xt=J[St];Xt?B&&e.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,St+1,0,0,zt,Rt,xt.image[st]):e.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+st,St+1,Zt,zt,Rt,xt.image[st])}}}m(S)&&p(i.TEXTURE_CUBE_MAP),nt.__version=rt.version,S.onUpdate&&S.onUpdate(S)}A.__version=S.version}function mt(A,S,W,Z,rt,nt){const It=r.convert(W.format,W.colorSpace),vt=r.convert(W.type),Tt=M(W.internalFormat,It,vt,W.colorSpace),Kt=n.get(S),ht=n.get(W);if(ht.__renderTarget=S,!Kt.__hasExternalTextures){const Ct=Math.max(1,S.width>>nt),kt=Math.max(1,S.height>>nt);rt===i.TEXTURE_3D||rt===i.TEXTURE_2D_ARRAY?e.texImage3D(rt,nt,Tt,Ct,kt,S.depth,0,It,vt,null):e.texImage2D(rt,nt,Tt,Ct,kt,0,It,vt,null)}e.bindFramebuffer(i.FRAMEBUFFER,A),wt(S)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,Z,rt,ht.__webglTexture,0,at(S)):(rt===i.TEXTURE_2D||rt>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&rt<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,Z,rt,ht.__webglTexture,nt),e.bindFramebuffer(i.FRAMEBUFFER,null)}function lt(A,S,W){if(i.bindRenderbuffer(i.RENDERBUFFER,A),S.depthBuffer){const Z=S.depthTexture,rt=Z&&Z.isDepthTexture?Z.type:null,nt=_(S.stencilBuffer,rt),It=S.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,vt=at(S);wt(S)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,vt,nt,S.width,S.height):W?i.renderbufferStorageMultisample(i.RENDERBUFFER,vt,nt,S.width,S.height):i.renderbufferStorage(i.RENDERBUFFER,nt,S.width,S.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,It,i.RENDERBUFFER,A)}else{const Z=S.textures;for(let rt=0;rt<Z.length;rt++){const nt=Z[rt],It=r.convert(nt.format,nt.colorSpace),vt=r.convert(nt.type),Tt=M(nt.internalFormat,It,vt,nt.colorSpace),Kt=at(S);W&&wt(S)===!1?i.renderbufferStorageMultisample(i.RENDERBUFFER,Kt,Tt,S.width,S.height):wt(S)?a.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,Kt,Tt,S.width,S.height):i.renderbufferStorage(i.RENDERBUFFER,Tt,S.width,S.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function Pt(A,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(i.FRAMEBUFFER,A),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const Z=n.get(S.depthTexture);Z.__renderTarget=S,(!Z.__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),F(S.depthTexture,0);const rt=Z.__webglTexture,nt=at(S);if(S.depthTexture.format===Qi)wt(S)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,rt,0,nt):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_ATTACHMENT,i.TEXTURE_2D,rt,0);else if(S.depthTexture.format===ls)wt(S)?a.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,rt,0,nt):i.framebufferTexture2D(i.FRAMEBUFFER,i.DEPTH_STENCIL_ATTACHMENT,i.TEXTURE_2D,rt,0);else throw new Error("Unknown depthTexture format")}function Ft(A){const S=n.get(A),W=A.isWebGLCubeRenderTarget===!0;if(S.__boundDepthTexture!==A.depthTexture){const Z=A.depthTexture;if(S.__depthDisposeCallback&&S.__depthDisposeCallback(),Z){const rt=()=>{delete S.__boundDepthTexture,delete S.__depthDisposeCallback,Z.removeEventListener("dispose",rt)};Z.addEventListener("dispose",rt),S.__depthDisposeCallback=rt}S.__boundDepthTexture=Z}if(A.depthTexture&&!S.__autoAllocateDepthBuffer){if(W)throw new Error("target.depthTexture not supported in Cube render targets");Pt(S.__webglFramebuffer,A)}else if(W){S.__webglDepthbuffer=[];for(let Z=0;Z<6;Z++)if(e.bindFramebuffer(i.FRAMEBUFFER,S.__webglFramebuffer[Z]),S.__webglDepthbuffer[Z]===void 0)S.__webglDepthbuffer[Z]=i.createRenderbuffer(),lt(S.__webglDepthbuffer[Z],A,!1);else{const rt=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,nt=S.__webglDepthbuffer[Z];i.bindRenderbuffer(i.RENDERBUFFER,nt),i.framebufferRenderbuffer(i.FRAMEBUFFER,rt,i.RENDERBUFFER,nt)}}else if(e.bindFramebuffer(i.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer===void 0)S.__webglDepthbuffer=i.createRenderbuffer(),lt(S.__webglDepthbuffer,A,!1);else{const Z=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,rt=S.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,rt),i.framebufferRenderbuffer(i.FRAMEBUFFER,Z,i.RENDERBUFFER,rt)}e.bindFramebuffer(i.FRAMEBUFFER,null)}function ft(A,S,W){const Z=n.get(A);S!==void 0&&mt(Z.__webglFramebuffer,A,A.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),W!==void 0&&Ft(A)}function bt(A){const S=A.texture,W=n.get(A),Z=n.get(S);A.addEventListener("dispose",C);const rt=A.textures,nt=A.isWebGLCubeRenderTarget===!0,It=rt.length>1;if(It||(Z.__webglTexture===void 0&&(Z.__webglTexture=i.createTexture()),Z.__version=S.version,o.memory.textures++),nt){W.__webglFramebuffer=[];for(let vt=0;vt<6;vt++)if(S.mipmaps&&S.mipmaps.length>0){W.__webglFramebuffer[vt]=[];for(let Tt=0;Tt<S.mipmaps.length;Tt++)W.__webglFramebuffer[vt][Tt]=i.createFramebuffer()}else W.__webglFramebuffer[vt]=i.createFramebuffer()}else{if(S.mipmaps&&S.mipmaps.length>0){W.__webglFramebuffer=[];for(let vt=0;vt<S.mipmaps.length;vt++)W.__webglFramebuffer[vt]=i.createFramebuffer()}else W.__webglFramebuffer=i.createFramebuffer();if(It)for(let vt=0,Tt=rt.length;vt<Tt;vt++){const Kt=n.get(rt[vt]);Kt.__webglTexture===void 0&&(Kt.__webglTexture=i.createTexture(),o.memory.textures++)}if(A.samples>0&&wt(A)===!1){W.__webglMultisampledFramebuffer=i.createFramebuffer(),W.__webglColorRenderbuffer=[],e.bindFramebuffer(i.FRAMEBUFFER,W.__webglMultisampledFramebuffer);for(let vt=0;vt<rt.length;vt++){const Tt=rt[vt];W.__webglColorRenderbuffer[vt]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,W.__webglColorRenderbuffer[vt]);const Kt=r.convert(Tt.format,Tt.colorSpace),ht=r.convert(Tt.type),Ct=M(Tt.internalFormat,Kt,ht,Tt.colorSpace,A.isXRRenderTarget===!0),kt=at(A);i.renderbufferStorageMultisample(i.RENDERBUFFER,kt,Ct,A.width,A.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+vt,i.RENDERBUFFER,W.__webglColorRenderbuffer[vt])}i.bindRenderbuffer(i.RENDERBUFFER,null),A.depthBuffer&&(W.__webglDepthRenderbuffer=i.createRenderbuffer(),lt(W.__webglDepthRenderbuffer,A,!0)),e.bindFramebuffer(i.FRAMEBUFFER,null)}}if(nt){e.bindTexture(i.TEXTURE_CUBE_MAP,Z.__webglTexture),dt(i.TEXTURE_CUBE_MAP,S);for(let vt=0;vt<6;vt++)if(S.mipmaps&&S.mipmaps.length>0)for(let Tt=0;Tt<S.mipmaps.length;Tt++)mt(W.__webglFramebuffer[vt][Tt],A,S,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,Tt);else mt(W.__webglFramebuffer[vt],A,S,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+vt,0);m(S)&&p(i.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(It){for(let vt=0,Tt=rt.length;vt<Tt;vt++){const Kt=rt[vt],ht=n.get(Kt);e.bindTexture(i.TEXTURE_2D,ht.__webglTexture),dt(i.TEXTURE_2D,Kt),mt(W.__webglFramebuffer,A,Kt,i.COLOR_ATTACHMENT0+vt,i.TEXTURE_2D,0),m(Kt)&&p(i.TEXTURE_2D)}e.unbindTexture()}else{let vt=i.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(vt=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),e.bindTexture(vt,Z.__webglTexture),dt(vt,S),S.mipmaps&&S.mipmaps.length>0)for(let Tt=0;Tt<S.mipmaps.length;Tt++)mt(W.__webglFramebuffer[Tt],A,S,i.COLOR_ATTACHMENT0,vt,Tt);else mt(W.__webglFramebuffer,A,S,i.COLOR_ATTACHMENT0,vt,0);m(S)&&p(vt),e.unbindTexture()}A.depthBuffer&&Ft(A)}function j(A){const S=A.textures;for(let W=0,Z=S.length;W<Z;W++){const rt=S[W];if(m(rt)){const nt=x(A),It=n.get(rt).__webglTexture;e.bindTexture(nt,It),p(nt),e.unbindTexture()}}}const it=[],L=[];function At(A){if(A.samples>0){if(wt(A)===!1){const S=A.textures,W=A.width,Z=A.height;let rt=i.COLOR_BUFFER_BIT;const nt=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,It=n.get(A),vt=S.length>1;if(vt)for(let Tt=0;Tt<S.length;Tt++)e.bindFramebuffer(i.FRAMEBUFFER,It.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Tt,i.RENDERBUFFER,null),e.bindFramebuffer(i.FRAMEBUFFER,It.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Tt,i.TEXTURE_2D,null,0);e.bindFramebuffer(i.READ_FRAMEBUFFER,It.__webglMultisampledFramebuffer),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,It.__webglFramebuffer);for(let Tt=0;Tt<S.length;Tt++){if(A.resolveDepthBuffer&&(A.depthBuffer&&(rt|=i.DEPTH_BUFFER_BIT),A.stencilBuffer&&A.resolveStencilBuffer&&(rt|=i.STENCIL_BUFFER_BIT)),vt){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,It.__webglColorRenderbuffer[Tt]);const Kt=n.get(S[Tt]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Kt,0)}i.blitFramebuffer(0,0,W,Z,0,0,W,Z,rt,i.NEAREST),l===!0&&(it.length=0,L.length=0,it.push(i.COLOR_ATTACHMENT0+Tt),A.depthBuffer&&A.resolveDepthBuffer===!1&&(it.push(nt),L.push(nt),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,L)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,it))}if(e.bindFramebuffer(i.READ_FRAMEBUFFER,null),e.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),vt)for(let Tt=0;Tt<S.length;Tt++){e.bindFramebuffer(i.FRAMEBUFFER,It.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+Tt,i.RENDERBUFFER,It.__webglColorRenderbuffer[Tt]);const Kt=n.get(S[Tt]).__webglTexture;e.bindFramebuffer(i.FRAMEBUFFER,It.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+Tt,i.TEXTURE_2D,Kt,0)}e.bindFramebuffer(i.DRAW_FRAMEBUFFER,It.__webglMultisampledFramebuffer)}else if(A.depthBuffer&&A.resolveDepthBuffer===!1&&l){const S=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[S])}}}function at(A){return Math.min(s.maxSamples,A.samples)}function wt(A){const S=n.get(A);return A.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function ct(A){const S=o.render.frame;h.get(A)!==S&&(h.set(A,S),A.update())}function Bt(A,S){const W=A.colorSpace,Z=A.format,rt=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||W!==ii&&W!==Zn&&(Qt.getTransfer(W)===ae?(Z!==mn||rt!==On)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",W)),S}function pt(A){return typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement?(c.width=A.naturalWidth||A.width,c.height=A.naturalHeight||A.height):typeof VideoFrame<"u"&&A instanceof VideoFrame?(c.width=A.displayWidth,c.height=A.displayHeight):(c.width=A.width,c.height=A.height),c}this.allocateTextureUnit=N,this.resetTextureUnits=O,this.setTexture2D=F,this.setTexture2DArray=V,this.setTexture3D=K,this.setTextureCube=q,this.rebindTextures=ft,this.setupRenderTarget=bt,this.updateRenderTargetMipmap=j,this.updateMultisampleRenderTarget=At,this.setupDepthRenderbuffer=Ft,this.setupFrameBufferTexture=mt,this.useMultisampledRTT=wt}function bv(i,t){function e(n,s=Zn){let r;const o=Qt.getTransfer(s);if(n===On)return i.UNSIGNED_BYTE;if(n===Rl)return i.UNSIGNED_SHORT_4_4_4_4;if(n===Pl)return i.UNSIGNED_SHORT_5_5_5_1;if(n===hu)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===lu)return i.BYTE;if(n===cu)return i.SHORT;if(n===$s)return i.UNSIGNED_SHORT;if(n===Cl)return i.INT;if(n===bi)return i.UNSIGNED_INT;if(n===xn)return i.FLOAT;if(n===sr)return i.HALF_FLOAT;if(n===uu)return i.ALPHA;if(n===du)return i.RGB;if(n===mn)return i.RGBA;if(n===fu)return i.LUMINANCE;if(n===pu)return i.LUMINANCE_ALPHA;if(n===Qi)return i.DEPTH_COMPONENT;if(n===ls)return i.DEPTH_STENCIL;if(n===Ll)return i.RED;if(n===Il)return i.RED_INTEGER;if(n===mu)return i.RG;if(n===Dl)return i.RG_INTEGER;if(n===Ul)return i.RGBA_INTEGER;if(n===Zr||n===Jr||n===Qr||n===to)if(o===ae)if(r=t.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(n===Zr)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Jr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Qr)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===to)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=t.get("WEBGL_compressed_texture_s3tc"),r!==null){if(n===Zr)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Jr)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Qr)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===to)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===qa||n===Ya||n===Xa||n===$a)if(r=t.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(n===qa)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===Ya)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Xa)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===$a)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===ja||n===Ka||n===Za)if(r=t.get("WEBGL_compressed_texture_etc"),r!==null){if(n===ja||n===Ka)return o===ae?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(n===Za)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===Ja||n===Qa||n===tl||n===el||n===nl||n===il||n===sl||n===rl||n===ol||n===al||n===ll||n===cl||n===hl||n===ul)if(r=t.get("WEBGL_compressed_texture_astc"),r!==null){if(n===Ja)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Qa)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===tl)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===el)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===nl)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===il)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===sl)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===rl)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===ol)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===al)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===ll)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===cl)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===hl)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===ul)return o===ae?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===eo||n===dl||n===fl)if(r=t.get("EXT_texture_compression_bptc"),r!==null){if(n===eo)return o===ae?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===dl)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===fl)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===gu||n===pl||n===ml||n===gl)if(r=t.get("EXT_texture_compression_rgtc"),r!==null){if(n===eo)return r.COMPRESSED_RED_RGTC1_EXT;if(n===pl)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===ml)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===gl)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===as?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:e}}class Sv extends tn{constructor(t=[]){super(),this.isArrayCamera=!0,this.cameras=t}}class fe extends Pe{constructor(){super(),this.isGroup=!0,this.type="Group"}}const wv={type:"move"};class ra{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new fe,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new fe,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new T,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new T),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new fe,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new T,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new T),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let s=null,r=null,o=null;const a=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){o=!0;for(const v of t.hand.values()){const m=e.getJointPose(v,n),p=this._getHandJoint(c,v);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),f=.02,g=.005;c.inputState.pinching&&d>f+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&d<=f-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(r=e.getPose(t.gripSpace,n),r!==null&&(l.matrix.fromArray(r.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,r.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(r.linearVelocity)):l.hasLinearVelocity=!1,r.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(r.angularVelocity)):l.hasAngularVelocity=!1));a!==null&&(s=e.getPose(t.targetRaySpace,n),s===null&&r!==null&&(s=r),s!==null&&(a.matrix.fromArray(s.transform.matrix),a.matrix.decompose(a.position,a.rotation,a.scale),a.matrixWorldNeedsUpdate=!0,s.linearVelocity?(a.hasLinearVelocity=!0,a.linearVelocity.copy(s.linearVelocity)):a.hasLinearVelocity=!1,s.angularVelocity?(a.hasAngularVelocity=!0,a.angularVelocity.copy(s.angularVelocity)):a.hasAngularVelocity=!1,this.dispatchEvent(wv)))}return a!==null&&(a.visible=s!==null),l!==null&&(l.visible=r!==null),c!==null&&(c.visible=o!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new fe;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}const Ev=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Tv=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class Av{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e,n){if(this.texture===null){const s=new Ve,r=t.properties.get(s);r.__webglTexture=e.texture,(e.depthNear!=n.depthNear||e.depthFar!=n.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=s}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,n=new nn({vertexShader:Ev,fragmentShader:Tv,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new tt(new ze(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class Cv extends Ei{constructor(t,e){super();const n=this;let s=null,r=1,o=null,a="local-floor",l=1,c=null,h=null,u=null,d=null,f=null,g=null;const v=new Av,m=e.getContextAttributes();let p=null,x=null;const M=[],_=[],I=new H;let E=null;const C=new tn;C.viewport=new ie;const P=new tn;P.viewport=new ie;const b=[C,P],y=new Sv;let R=null,O=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(Q){let ot=M[Q];return ot===void 0&&(ot=new ra,M[Q]=ot),ot.getTargetRaySpace()},this.getControllerGrip=function(Q){let ot=M[Q];return ot===void 0&&(ot=new ra,M[Q]=ot),ot.getGripSpace()},this.getHand=function(Q){let ot=M[Q];return ot===void 0&&(ot=new ra,M[Q]=ot),ot.getHandSpace()};function N(Q){const ot=_.indexOf(Q.inputSource);if(ot===-1)return;const mt=M[ot];mt!==void 0&&(mt.update(Q.inputSource,Q.frame,c||o),mt.dispatchEvent({type:Q.type,data:Q.inputSource}))}function U(){s.removeEventListener("select",N),s.removeEventListener("selectstart",N),s.removeEventListener("selectend",N),s.removeEventListener("squeeze",N),s.removeEventListener("squeezestart",N),s.removeEventListener("squeezeend",N),s.removeEventListener("end",U),s.removeEventListener("inputsourceschange",F);for(let Q=0;Q<M.length;Q++){const ot=_[Q];ot!==null&&(_[Q]=null,M[Q].disconnect(ot))}R=null,O=null,v.reset(),t.setRenderTarget(p),f=null,d=null,u=null,s=null,x=null,Ht.stop(),n.isPresenting=!1,t.setPixelRatio(E),t.setSize(I.width,I.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(Q){r=Q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(Q){a=Q,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||o},this.setReferenceSpace=function(Q){c=Q},this.getBaseLayer=function(){return d!==null?d:f},this.getBinding=function(){return u},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function(Q){if(s=Q,s!==null){if(p=t.getRenderTarget(),s.addEventListener("select",N),s.addEventListener("selectstart",N),s.addEventListener("selectend",N),s.addEventListener("squeeze",N),s.addEventListener("squeezestart",N),s.addEventListener("squeezeend",N),s.addEventListener("end",U),s.addEventListener("inputsourceschange",F),m.xrCompatible!==!0&&await e.makeXRCompatible(),E=t.getPixelRatio(),t.getSize(I),s.renderState.layers===void 0){const ot={antialias:m.antialias,alpha:!0,depth:m.depth,stencil:m.stencil,framebufferScaleFactor:r};f=new XRWebGLLayer(s,e,ot),s.updateRenderState({baseLayer:f}),t.setPixelRatio(1),t.setSize(f.framebufferWidth,f.framebufferHeight,!1),x=new Si(f.framebufferWidth,f.framebufferHeight,{format:mn,type:On,colorSpace:t.outputColorSpace,stencilBuffer:m.stencil})}else{let ot=null,mt=null,lt=null;m.depth&&(lt=m.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,ot=m.stencil?ls:Qi,mt=m.stencil?as:bi);const Pt={colorFormat:e.RGBA8,depthFormat:lt,scaleFactor:r};u=new XRWebGLBinding(s,e),d=u.createProjectionLayer(Pt),s.updateRenderState({layers:[d]}),t.setPixelRatio(1),t.setSize(d.textureWidth,d.textureHeight,!1),x=new Si(d.textureWidth,d.textureHeight,{format:mn,type:On,depthTexture:new Pu(d.textureWidth,d.textureHeight,mt,void 0,void 0,void 0,void 0,void 0,void 0,ot),stencilBuffer:m.stencil,colorSpace:t.outputColorSpace,samples:m.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1})}x.isXRRenderTarget=!0,this.setFoveation(l),c=null,o=await s.requestReferenceSpace(a),Ht.setContext(s),Ht.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return v.getDepthTexture()};function F(Q){for(let ot=0;ot<Q.removed.length;ot++){const mt=Q.removed[ot],lt=_.indexOf(mt);lt>=0&&(_[lt]=null,M[lt].disconnect(mt))}for(let ot=0;ot<Q.added.length;ot++){const mt=Q.added[ot];let lt=_.indexOf(mt);if(lt===-1){for(let Ft=0;Ft<M.length;Ft++)if(Ft>=_.length){_.push(mt),lt=Ft;break}else if(_[Ft]===null){_[Ft]=mt,lt=Ft;break}if(lt===-1)break}const Pt=M[lt];Pt&&Pt.connect(mt)}}const V=new T,K=new T;function q(Q,ot,mt){V.setFromMatrixPosition(ot.matrixWorld),K.setFromMatrixPosition(mt.matrixWorld);const lt=V.distanceTo(K),Pt=ot.projectionMatrix.elements,Ft=mt.projectionMatrix.elements,ft=Pt[14]/(Pt[10]-1),bt=Pt[14]/(Pt[10]+1),j=(Pt[9]+1)/Pt[5],it=(Pt[9]-1)/Pt[5],L=(Pt[8]-1)/Pt[0],At=(Ft[8]+1)/Ft[0],at=ft*L,wt=ft*At,ct=lt/(-L+At),Bt=ct*-L;if(ot.matrixWorld.decompose(Q.position,Q.quaternion,Q.scale),Q.translateX(Bt),Q.translateZ(ct),Q.matrixWorld.compose(Q.position,Q.quaternion,Q.scale),Q.matrixWorldInverse.copy(Q.matrixWorld).invert(),Pt[10]===-1)Q.projectionMatrix.copy(ot.projectionMatrix),Q.projectionMatrixInverse.copy(ot.projectionMatrixInverse);else{const pt=ft+ct,A=bt+ct,S=at-Bt,W=wt+(lt-Bt),Z=j*bt/A*pt,rt=it*bt/A*pt;Q.projectionMatrix.makePerspective(S,W,Z,rt,pt,A),Q.projectionMatrixInverse.copy(Q.projectionMatrix).invert()}}function D(Q,ot){ot===null?Q.matrixWorld.copy(Q.matrix):Q.matrixWorld.multiplyMatrices(ot.matrixWorld,Q.matrix),Q.matrixWorldInverse.copy(Q.matrixWorld).invert()}this.updateCamera=function(Q){if(s===null)return;let ot=Q.near,mt=Q.far;v.texture!==null&&(v.depthNear>0&&(ot=v.depthNear),v.depthFar>0&&(mt=v.depthFar)),y.near=P.near=C.near=ot,y.far=P.far=C.far=mt,(R!==y.near||O!==y.far)&&(s.updateRenderState({depthNear:y.near,depthFar:y.far}),R=y.near,O=y.far),C.layers.mask=Q.layers.mask|2,P.layers.mask=Q.layers.mask|4,y.layers.mask=C.layers.mask|P.layers.mask;const lt=Q.parent,Pt=y.cameras;D(y,lt);for(let Ft=0;Ft<Pt.length;Ft++)D(Pt[Ft],lt);Pt.length===2?q(y,C,P):y.projectionMatrix.copy(C.projectionMatrix),G(Q,y,lt)};function G(Q,ot,mt){mt===null?Q.matrix.copy(ot.matrixWorld):(Q.matrix.copy(mt.matrixWorld),Q.matrix.invert(),Q.matrix.multiply(ot.matrixWorld)),Q.matrix.decompose(Q.position,Q.quaternion,Q.scale),Q.updateMatrixWorld(!0),Q.projectionMatrix.copy(ot.projectionMatrix),Q.projectionMatrixInverse.copy(ot.projectionMatrixInverse),Q.isPerspectiveCamera&&(Q.fov=js*2*Math.atan(1/Q.projectionMatrix.elements[5]),Q.zoom=1)}this.getCamera=function(){return y},this.getFoveation=function(){if(!(d===null&&f===null))return l},this.setFoveation=function(Q){l=Q,d!==null&&(d.fixedFoveation=Q),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=Q)},this.hasDepthSensing=function(){return v.texture!==null},this.getDepthSensingMesh=function(){return v.getMesh(y)};let et=null;function dt(Q,ot){if(h=ot.getViewerPose(c||o),g=ot,h!==null){const mt=h.views;f!==null&&(t.setRenderTargetFramebuffer(x,f.framebuffer),t.setRenderTarget(x));let lt=!1;mt.length!==y.cameras.length&&(y.cameras.length=0,lt=!0);for(let Ft=0;Ft<mt.length;Ft++){const ft=mt[Ft];let bt=null;if(f!==null)bt=f.getViewport(ft);else{const it=u.getViewSubImage(d,ft);bt=it.viewport,Ft===0&&(t.setRenderTargetTextures(x,it.colorTexture,d.ignoreDepthValues?void 0:it.depthStencilTexture),t.setRenderTarget(x))}let j=b[Ft];j===void 0&&(j=new tn,j.layers.enable(Ft),j.viewport=new ie,b[Ft]=j),j.matrix.fromArray(ft.transform.matrix),j.matrix.decompose(j.position,j.quaternion,j.scale),j.projectionMatrix.fromArray(ft.projectionMatrix),j.projectionMatrixInverse.copy(j.projectionMatrix).invert(),j.viewport.set(bt.x,bt.y,bt.width,bt.height),Ft===0&&(y.matrix.copy(j.matrix),y.matrix.decompose(y.position,y.quaternion,y.scale)),lt===!0&&y.cameras.push(j)}const Pt=s.enabledFeatures;if(Pt&&Pt.includes("depth-sensing")){const Ft=u.getDepthInformation(mt[0]);Ft&&Ft.isValid&&Ft.texture&&v.init(t,Ft,s.renderState)}}for(let mt=0;mt<M.length;mt++){const lt=_[mt],Pt=M[mt];lt!==null&&Pt!==void 0&&Pt.update(lt,ot,c||o)}et&&et(Q,ot),ot.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:ot}),g=null}const Ht=new Cu;Ht.setAnimationLoop(dt),this.setAnimationLoop=function(Q){et=Q},this.dispose=function(){}}}const di=new ln,Rv=new Jt;function Pv(i,t){function e(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,Eu(i)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function s(m,p,x,M,_){p.isMeshBasicMaterial||p.isMeshLambertMaterial?r(m,p):p.isMeshToonMaterial?(r(m,p),u(m,p)):p.isMeshPhongMaterial?(r(m,p),h(m,p)):p.isMeshStandardMaterial?(r(m,p),d(m,p),p.isMeshPhysicalMaterial&&f(m,p,_)):p.isMeshMatcapMaterial?(r(m,p),g(m,p)):p.isMeshDepthMaterial?r(m,p):p.isMeshDistanceMaterial?(r(m,p),v(m,p)):p.isMeshNormalMaterial?r(m,p):p.isLineBasicMaterial?(o(m,p),p.isLineDashedMaterial&&a(m,p)):p.isPointsMaterial?l(m,p,x,M):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function r(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,e(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===Ye&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,e(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===Ye&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,e(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,e(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,e(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);const x=t.get(p),M=x.envMap,_=x.envMapRotation;M&&(m.envMap.value=M,di.copy(_),di.x*=-1,di.y*=-1,di.z*=-1,M.isCubeTexture&&M.isRenderTargetTexture===!1&&(di.y*=-1,di.z*=-1),m.envMapRotation.value.setFromMatrix4(Rv.makeRotationFromEuler(di)),m.flipEnvMap.value=M.isCubeTexture&&M.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,e(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,e(p.aoMap,m.aoMapTransform))}function o(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform))}function a(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,x,M){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*x,m.scale.value=M*.5,p.map&&(m.map.value=p.map,e(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function h(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function u(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function d(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,e(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,e(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function f(m,p,x){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,e(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,e(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,e(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,e(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,e(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Ye&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,e(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,e(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=x.texture,m.transmissionSamplerSize.value.set(x.width,x.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,e(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,e(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,e(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,e(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,e(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function v(m,p){const x=t.get(p).light;m.referencePosition.value.setFromMatrixPosition(x.matrixWorld),m.nearDistance.value=x.shadow.camera.near,m.farDistance.value=x.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function Lv(i,t,e,n){let s={},r={},o=[];const a=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(x,M){const _=M.program;n.uniformBlockBinding(x,_)}function c(x,M){let _=s[x.id];_===void 0&&(g(x),_=h(x),s[x.id]=_,x.addEventListener("dispose",m));const I=M.program;n.updateUBOMapping(x,I);const E=t.render.frame;r[x.id]!==E&&(d(x),r[x.id]=E)}function h(x){const M=u();x.__bindingPointIndex=M;const _=i.createBuffer(),I=x.__size,E=x.usage;return i.bindBuffer(i.UNIFORM_BUFFER,_),i.bufferData(i.UNIFORM_BUFFER,I,E),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,M,_),_}function u(){for(let x=0;x<a;x++)if(o.indexOf(x)===-1)return o.push(x),x;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(x){const M=s[x.id],_=x.uniforms,I=x.__cache;i.bindBuffer(i.UNIFORM_BUFFER,M);for(let E=0,C=_.length;E<C;E++){const P=Array.isArray(_[E])?_[E]:[_[E]];for(let b=0,y=P.length;b<y;b++){const R=P[b];if(f(R,E,b,I)===!0){const O=R.__offset,N=Array.isArray(R.value)?R.value:[R.value];let U=0;for(let F=0;F<N.length;F++){const V=N[F],K=v(V);typeof V=="number"||typeof V=="boolean"?(R.__data[0]=V,i.bufferSubData(i.UNIFORM_BUFFER,O+U,R.__data)):V.isMatrix3?(R.__data[0]=V.elements[0],R.__data[1]=V.elements[1],R.__data[2]=V.elements[2],R.__data[3]=0,R.__data[4]=V.elements[3],R.__data[5]=V.elements[4],R.__data[6]=V.elements[5],R.__data[7]=0,R.__data[8]=V.elements[6],R.__data[9]=V.elements[7],R.__data[10]=V.elements[8],R.__data[11]=0):(V.toArray(R.__data,U),U+=K.storage/Float32Array.BYTES_PER_ELEMENT)}i.bufferSubData(i.UNIFORM_BUFFER,O,R.__data)}}}i.bindBuffer(i.UNIFORM_BUFFER,null)}function f(x,M,_,I){const E=x.value,C=M+"_"+_;if(I[C]===void 0)return typeof E=="number"||typeof E=="boolean"?I[C]=E:I[C]=E.clone(),!0;{const P=I[C];if(typeof E=="number"||typeof E=="boolean"){if(P!==E)return I[C]=E,!0}else if(P.equals(E)===!1)return P.copy(E),!0}return!1}function g(x){const M=x.uniforms;let _=0;const I=16;for(let C=0,P=M.length;C<P;C++){const b=Array.isArray(M[C])?M[C]:[M[C]];for(let y=0,R=b.length;y<R;y++){const O=b[y],N=Array.isArray(O.value)?O.value:[O.value];for(let U=0,F=N.length;U<F;U++){const V=N[U],K=v(V),q=_%I,D=q%K.boundary,G=q+D;_+=D,G!==0&&I-G<K.storage&&(_+=I-G),O.__data=new Float32Array(K.storage/Float32Array.BYTES_PER_ELEMENT),O.__offset=_,_+=K.storage}}}const E=_%I;return E>0&&(_+=I-E),x.__size=_,x.__cache={},this}function v(x){const M={boundary:0,storage:0};return typeof x=="number"||typeof x=="boolean"?(M.boundary=4,M.storage=4):x.isVector2?(M.boundary=8,M.storage=8):x.isVector3||x.isColor?(M.boundary=16,M.storage=12):x.isVector4?(M.boundary=16,M.storage=16):x.isMatrix3?(M.boundary=48,M.storage=48):x.isMatrix4?(M.boundary=64,M.storage=64):x.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",x),M}function m(x){const M=x.target;M.removeEventListener("dispose",m);const _=o.indexOf(M.__bindingPointIndex);o.splice(_,1),i.deleteBuffer(s[M.id]),delete s[M.id],delete r[M.id]}function p(){for(const x in s)i.deleteBuffer(s[x]);o=[],s={},r={}}return{bind:l,update:c,dispose:p}}class Iv{constructor(t={}){const{canvas:e=xf(),context:n=null,depth:s=!0,stencil:r=!1,alpha:o=!1,antialias:a=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reverseDepthBuffer:d=!1}=t;this.isWebGLRenderer=!0;let f;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");f=n.getContextAttributes().alpha}else f=o;const g=new Uint32Array(4),v=new Int32Array(4);let m=null,p=null;const x=[],M=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this._outputColorSpace=we,this.toneMapping=ei,this.toneMappingExposure=1;const _=this;let I=!1,E=0,C=0,P=null,b=-1,y=null;const R=new ie,O=new ie;let N=null;const U=new Et(0);let F=0,V=e.width,K=e.height,q=1,D=null,G=null;const et=new ie(0,0,V,K),dt=new ie(0,0,V,K);let Ht=!1;const Q=new Bl;let ot=!1,mt=!1;const lt=new Jt,Pt=new Jt,Ft=new T,ft=new ie,bt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let j=!1;function it(){return P===null?q:1}let L=n;function At(w,k){return e.getContext(w,k)}try{const w={alpha:!0,depth:s,stencil:r,antialias:a,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${Al}`),e.addEventListener("webglcontextlost",st,!1),e.addEventListener("webglcontextrestored",St,!1),e.addEventListener("webglcontextcreationerror",xt,!1),L===null){const k="webgl2";if(L=At(k,w),L===null)throw At(k)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(w){throw console.error("THREE.WebGLRenderer: "+w.message),w}let at,wt,ct,Bt,pt,A,S,W,Z,rt,nt,It,vt,Tt,Kt,ht,Ct,kt,zt,Rt,Zt,Xt,ce,B;function _t(){at=new F0(L),at.init(),Xt=new bv(L,at),wt=new L0(L,at,t,Xt),ct=new Mv(L,at),wt.reverseDepthBuffer&&d&&ct.buffers.depth.setReversed(!0),Bt=new z0(L),pt=new sv,A=new yv(L,at,ct,pt,wt,Xt,Bt),S=new D0(_),W=new O0(_),Z=new Xf(L),ce=new R0(L,Z),rt=new B0(L,Z,Bt,ce),nt=new V0(L,rt,Z,Bt),zt=new H0(L,wt,A),ht=new I0(pt),It=new iv(_,S,W,at,wt,ce,ht),vt=new Pv(_,pt),Tt=new ov,Kt=new dv(at),kt=new C0(_,S,W,ct,nt,f,l),Ct=new vv(_,nt,wt),B=new Lv(L,Bt,wt,ct),Rt=new P0(L,at,Bt),Zt=new k0(L,at,Bt),Bt.programs=It.programs,_.capabilities=wt,_.extensions=at,_.properties=pt,_.renderLists=Tt,_.shadowMap=Ct,_.state=ct,_.info=Bt}_t();const J=new Cv(_,L);this.xr=J,this.getContext=function(){return L},this.getContextAttributes=function(){return L.getContextAttributes()},this.forceContextLoss=function(){const w=at.get("WEBGL_lose_context");w&&w.loseContext()},this.forceContextRestore=function(){const w=at.get("WEBGL_lose_context");w&&w.restoreContext()},this.getPixelRatio=function(){return q},this.setPixelRatio=function(w){w!==void 0&&(q=w,this.setSize(V,K,!1))},this.getSize=function(w){return w.set(V,K)},this.setSize=function(w,k,X=!0){if(J.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}V=w,K=k,e.width=Math.floor(w*q),e.height=Math.floor(k*q),X===!0&&(e.style.width=w+"px",e.style.height=k+"px"),this.setViewport(0,0,w,k)},this.getDrawingBufferSize=function(w){return w.set(V*q,K*q).floor()},this.setDrawingBufferSize=function(w,k,X){V=w,K=k,q=X,e.width=Math.floor(w*X),e.height=Math.floor(k*X),this.setViewport(0,0,w,k)},this.getCurrentViewport=function(w){return w.copy(R)},this.getViewport=function(w){return w.copy(et)},this.setViewport=function(w,k,X,$){w.isVector4?et.set(w.x,w.y,w.z,w.w):et.set(w,k,X,$),ct.viewport(R.copy(et).multiplyScalar(q).round())},this.getScissor=function(w){return w.copy(dt)},this.setScissor=function(w,k,X,$){w.isVector4?dt.set(w.x,w.y,w.z,w.w):dt.set(w,k,X,$),ct.scissor(O.copy(dt).multiplyScalar(q).round())},this.getScissorTest=function(){return Ht},this.setScissorTest=function(w){ct.setScissorTest(Ht=w)},this.setOpaqueSort=function(w){D=w},this.setTransparentSort=function(w){G=w},this.getClearColor=function(w){return w.copy(kt.getClearColor())},this.setClearColor=function(){kt.setClearColor.apply(kt,arguments)},this.getClearAlpha=function(){return kt.getClearAlpha()},this.setClearAlpha=function(){kt.setClearAlpha.apply(kt,arguments)},this.clear=function(w=!0,k=!0,X=!0){let $=0;if(w){let z=!1;if(P!==null){const ut=P.texture.format;z=ut===Ul||ut===Dl||ut===Il}if(z){const ut=P.texture.type,yt=ut===On||ut===bi||ut===$s||ut===as||ut===Rl||ut===Pl,Dt=kt.getClearColor(),Ut=kt.getClearAlpha(),Vt=Dt.r,Wt=Dt.g,Nt=Dt.b;yt?(g[0]=Vt,g[1]=Wt,g[2]=Nt,g[3]=Ut,L.clearBufferuiv(L.COLOR,0,g)):(v[0]=Vt,v[1]=Wt,v[2]=Nt,v[3]=Ut,L.clearBufferiv(L.COLOR,0,v))}else $|=L.COLOR_BUFFER_BIT}k&&($|=L.DEPTH_BUFFER_BIT),X&&($|=L.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),L.clear($)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",st,!1),e.removeEventListener("webglcontextrestored",St,!1),e.removeEventListener("webglcontextcreationerror",xt,!1),Tt.dispose(),Kt.dispose(),pt.dispose(),S.dispose(),W.dispose(),nt.dispose(),ce.dispose(),B.dispose(),It.dispose(),J.dispose(),J.removeEventListener("sessionstart",$l),J.removeEventListener("sessionend",jl),oi.stop()};function st(w){w.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),I=!0}function St(){console.log("THREE.WebGLRenderer: Context Restored."),I=!1;const w=Bt.autoReset,k=Ct.enabled,X=Ct.autoUpdate,$=Ct.needsUpdate,z=Ct.type;_t(),Bt.autoReset=w,Ct.enabled=k,Ct.autoUpdate=X,Ct.needsUpdate=$,Ct.type=z}function xt(w){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",w.statusMessage)}function Gt(w){const k=w.target;k.removeEventListener("dispose",Gt),ge(k)}function ge(w){Fe(w),pt.remove(w)}function Fe(w){const k=pt.get(w).programs;k!==void 0&&(k.forEach(function(X){It.releaseProgram(X)}),w.isShaderMaterial&&It.releaseShaderCache(w))}this.renderBufferDirect=function(w,k,X,$,z,ut){k===null&&(k=bt);const yt=z.isMesh&&z.matrixWorld.determinant()<0,Dt=Md(w,k,X,$,z);ct.setMaterial($,yt);let Ut=X.index,Vt=1;if($.wireframe===!0){if(Ut=rt.getWireframeAttribute(X),Ut===void 0)return;Vt=2}const Wt=X.drawRange,Nt=X.attributes.position;let te=Wt.start*Vt,he=(Wt.start+Wt.count)*Vt;ut!==null&&(te=Math.max(te,ut.start*Vt),he=Math.min(he,(ut.start+ut.count)*Vt)),Ut!==null?(te=Math.max(te,0),he=Math.min(he,Ut.count)):Nt!=null&&(te=Math.max(te,0),he=Math.min(he,Nt.count));const ue=he-te;if(ue<0||ue===1/0)return;ce.setup(z,$,Dt,X,Ut);let Xe,se=Rt;if(Ut!==null&&(Xe=Z.get(Ut),se=Zt,se.setIndex(Xe)),z.isMesh)$.wireframe===!0?(ct.setLineWidth($.wireframeLinewidth*it()),se.setMode(L.LINES)):se.setMode(L.TRIANGLES);else if(z.isLine){let Ot=$.linewidth;Ot===void 0&&(Ot=1),ct.setLineWidth(Ot*it()),z.isLineSegments?se.setMode(L.LINES):z.isLineLoop?se.setMode(L.LINE_LOOP):se.setMode(L.LINE_STRIP)}else z.isPoints?se.setMode(L.POINTS):z.isSprite&&se.setMode(L.TRIANGLES);if(z.isBatchedMesh)if(z._multiDrawInstances!==null)se.renderMultiDrawInstances(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount,z._multiDrawInstances);else if(at.get("WEBGL_multi_draw"))se.renderMultiDraw(z._multiDrawStarts,z._multiDrawCounts,z._multiDrawCount);else{const Ot=z._multiDrawStarts,Tn=z._multiDrawCounts,re=z._multiDrawCount,hn=Ut?Z.get(Ut).bytesPerElement:1,Ri=pt.get($).currentProgram.getUniforms();for(let Ke=0;Ke<re;Ke++)Ri.setValue(L,"_gl_DrawID",Ke),se.render(Ot[Ke]/hn,Tn[Ke])}else if(z.isInstancedMesh)se.renderInstances(te,ue,z.count);else if(X.isInstancedBufferGeometry){const Ot=X._maxInstanceCount!==void 0?X._maxInstanceCount:1/0,Tn=Math.min(X.instanceCount,Ot);se.renderInstances(te,ue,Tn)}else se.render(te,ue)};function oe(w,k,X){w.transparent===!0&&w.side===je&&w.forceSinglePass===!1?(w.side=Ye,w.needsUpdate=!0,dr(w,k,X),w.side=bn,w.needsUpdate=!0,dr(w,k,X),w.side=je):dr(w,k,X)}this.compile=function(w,k,X=null){X===null&&(X=w),p=Kt.get(X),p.init(k),M.push(p),X.traverseVisible(function(z){z.isLight&&z.layers.test(k.layers)&&(p.pushLight(z),z.castShadow&&p.pushShadow(z))}),w!==X&&w.traverseVisible(function(z){z.isLight&&z.layers.test(k.layers)&&(p.pushLight(z),z.castShadow&&p.pushShadow(z))}),p.setupLights();const $=new Set;return w.traverse(function(z){if(!(z.isMesh||z.isPoints||z.isLine||z.isSprite))return;const ut=z.material;if(ut)if(Array.isArray(ut))for(let yt=0;yt<ut.length;yt++){const Dt=ut[yt];oe(Dt,X,z),$.add(Dt)}else oe(ut,X,z),$.add(ut)}),M.pop(),p=null,$},this.compileAsync=function(w,k,X=null){const $=this.compile(w,k,X);return new Promise(z=>{function ut(){if($.forEach(function(yt){pt.get(yt).currentProgram.isReady()&&$.delete(yt)}),$.size===0){z(w);return}setTimeout(ut,10)}at.get("KHR_parallel_shader_compile")!==null?ut():setTimeout(ut,10)})};let cn=null;function En(w){cn&&cn(w)}function $l(){oi.stop()}function jl(){oi.start()}const oi=new Cu;oi.setAnimationLoop(En),typeof self<"u"&&oi.setContext(self),this.setAnimationLoop=function(w){cn=w,J.setAnimationLoop(w),w===null?oi.stop():oi.start()},J.addEventListener("sessionstart",$l),J.addEventListener("sessionend",jl),this.render=function(w,k){if(k!==void 0&&k.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(I===!0)return;if(w.matrixWorldAutoUpdate===!0&&w.updateMatrixWorld(),k.parent===null&&k.matrixWorldAutoUpdate===!0&&k.updateMatrixWorld(),J.enabled===!0&&J.isPresenting===!0&&(J.cameraAutoUpdate===!0&&J.updateCamera(k),k=J.getCamera()),w.isScene===!0&&w.onBeforeRender(_,w,k,P),p=Kt.get(w,M.length),p.init(k),M.push(p),Pt.multiplyMatrices(k.projectionMatrix,k.matrixWorldInverse),Q.setFromProjectionMatrix(Pt),mt=this.localClippingEnabled,ot=ht.init(this.clippingPlanes,mt),m=Tt.get(w,x.length),m.init(),x.push(m),J.enabled===!0&&J.isPresenting===!0){const ut=_.xr.getDepthSensingMesh();ut!==null&&Lo(ut,k,-1/0,_.sortObjects)}Lo(w,k,0,_.sortObjects),m.finish(),_.sortObjects===!0&&m.sort(D,G),j=J.enabled===!1||J.isPresenting===!1||J.hasDepthSensing()===!1,j&&kt.addToRenderList(m,w),this.info.render.frame++,ot===!0&&ht.beginShadows();const X=p.state.shadowsArray;Ct.render(X,w,k),ot===!0&&ht.endShadows(),this.info.autoReset===!0&&this.info.reset();const $=m.opaque,z=m.transmissive;if(p.setupLights(),k.isArrayCamera){const ut=k.cameras;if(z.length>0)for(let yt=0,Dt=ut.length;yt<Dt;yt++){const Ut=ut[yt];Zl($,z,w,Ut)}j&&kt.render(w);for(let yt=0,Dt=ut.length;yt<Dt;yt++){const Ut=ut[yt];Kl(m,w,Ut,Ut.viewport)}}else z.length>0&&Zl($,z,w,k),j&&kt.render(w),Kl(m,w,k);P!==null&&(A.updateMultisampleRenderTarget(P),A.updateRenderTargetMipmap(P)),w.isScene===!0&&w.onAfterRender(_,w,k),ce.resetDefaultState(),b=-1,y=null,M.pop(),M.length>0?(p=M[M.length-1],ot===!0&&ht.setGlobalState(_.clippingPlanes,p.state.camera)):p=null,x.pop(),x.length>0?m=x[x.length-1]:m=null};function Lo(w,k,X,$){if(w.visible===!1)return;if(w.layers.test(k.layers)){if(w.isGroup)X=w.renderOrder;else if(w.isLOD)w.autoUpdate===!0&&w.update(k);else if(w.isLight)p.pushLight(w),w.castShadow&&p.pushShadow(w);else if(w.isSprite){if(!w.frustumCulled||Q.intersectsSprite(w)){$&&ft.setFromMatrixPosition(w.matrixWorld).applyMatrix4(Pt);const yt=nt.update(w),Dt=w.material;Dt.visible&&m.push(w,yt,Dt,X,ft.z,null)}}else if((w.isMesh||w.isLine||w.isPoints)&&(!w.frustumCulled||Q.intersectsObject(w))){const yt=nt.update(w),Dt=w.material;if($&&(w.boundingSphere!==void 0?(w.boundingSphere===null&&w.computeBoundingSphere(),ft.copy(w.boundingSphere.center)):(yt.boundingSphere===null&&yt.computeBoundingSphere(),ft.copy(yt.boundingSphere.center)),ft.applyMatrix4(w.matrixWorld).applyMatrix4(Pt)),Array.isArray(Dt)){const Ut=yt.groups;for(let Vt=0,Wt=Ut.length;Vt<Wt;Vt++){const Nt=Ut[Vt],te=Dt[Nt.materialIndex];te&&te.visible&&m.push(w,yt,te,X,ft.z,Nt)}}else Dt.visible&&m.push(w,yt,Dt,X,ft.z,null)}}const ut=w.children;for(let yt=0,Dt=ut.length;yt<Dt;yt++)Lo(ut[yt],k,X,$)}function Kl(w,k,X,$){const z=w.opaque,ut=w.transmissive,yt=w.transparent;p.setupLightsView(X),ot===!0&&ht.setGlobalState(_.clippingPlanes,X),$&&ct.viewport(R.copy($)),z.length>0&&ur(z,k,X),ut.length>0&&ur(ut,k,X),yt.length>0&&ur(yt,k,X),ct.buffers.depth.setTest(!0),ct.buffers.depth.setMask(!0),ct.buffers.color.setMask(!0),ct.setPolygonOffset(!1)}function Zl(w,k,X,$){if((X.isScene===!0?X.overrideMaterial:null)!==null)return;p.state.transmissionRenderTarget[$.id]===void 0&&(p.state.transmissionRenderTarget[$.id]=new Si(1,1,{generateMipmaps:!0,type:at.has("EXT_color_buffer_half_float")||at.has("EXT_color_buffer_float")?sr:On,minFilter:_i,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Qt.workingColorSpace}));const ut=p.state.transmissionRenderTarget[$.id],yt=$.viewport||R;ut.setSize(yt.z,yt.w);const Dt=_.getRenderTarget();_.setRenderTarget(ut),_.getClearColor(U),F=_.getClearAlpha(),F<1&&_.setClearColor(16777215,.5),_.clear(),j&&kt.render(X);const Ut=_.toneMapping;_.toneMapping=ei;const Vt=$.viewport;if($.viewport!==void 0&&($.viewport=void 0),p.setupLightsView($),ot===!0&&ht.setGlobalState(_.clippingPlanes,$),ur(w,X,$),A.updateMultisampleRenderTarget(ut),A.updateRenderTargetMipmap(ut),at.has("WEBGL_multisampled_render_to_texture")===!1){let Wt=!1;for(let Nt=0,te=k.length;Nt<te;Nt++){const he=k[Nt],ue=he.object,Xe=he.geometry,se=he.material,Ot=he.group;if(se.side===je&&ue.layers.test($.layers)){const Tn=se.side;se.side=Ye,se.needsUpdate=!0,Jl(ue,X,$,Xe,se,Ot),se.side=Tn,se.needsUpdate=!0,Wt=!0}}Wt===!0&&(A.updateMultisampleRenderTarget(ut),A.updateRenderTargetMipmap(ut))}_.setRenderTarget(Dt),_.setClearColor(U,F),Vt!==void 0&&($.viewport=Vt),_.toneMapping=Ut}function ur(w,k,X){const $=k.isScene===!0?k.overrideMaterial:null;for(let z=0,ut=w.length;z<ut;z++){const yt=w[z],Dt=yt.object,Ut=yt.geometry,Vt=$===null?yt.material:$,Wt=yt.group;Dt.layers.test(X.layers)&&Jl(Dt,k,X,Ut,Vt,Wt)}}function Jl(w,k,X,$,z,ut){w.onBeforeRender(_,k,X,$,z,ut),w.modelViewMatrix.multiplyMatrices(X.matrixWorldInverse,w.matrixWorld),w.normalMatrix.getNormalMatrix(w.modelViewMatrix),z.onBeforeRender(_,k,X,$,w,ut),z.transparent===!0&&z.side===je&&z.forceSinglePass===!1?(z.side=Ye,z.needsUpdate=!0,_.renderBufferDirect(X,k,$,z,w,ut),z.side=bn,z.needsUpdate=!0,_.renderBufferDirect(X,k,$,z,w,ut),z.side=je):_.renderBufferDirect(X,k,$,z,w,ut),w.onAfterRender(_,k,X,$,z,ut)}function dr(w,k,X){k.isScene!==!0&&(k=bt);const $=pt.get(w),z=p.state.lights,ut=p.state.shadowsArray,yt=z.state.version,Dt=It.getParameters(w,z.state,ut,k,X),Ut=It.getProgramCacheKey(Dt);let Vt=$.programs;$.environment=w.isMeshStandardMaterial?k.environment:null,$.fog=k.fog,$.envMap=(w.isMeshStandardMaterial?W:S).get(w.envMap||$.environment),$.envMapRotation=$.environment!==null&&w.envMap===null?k.environmentRotation:w.envMapRotation,Vt===void 0&&(w.addEventListener("dispose",Gt),Vt=new Map,$.programs=Vt);let Wt=Vt.get(Ut);if(Wt!==void 0){if($.currentProgram===Wt&&$.lightsStateVersion===yt)return tc(w,Dt),Wt}else Dt.uniforms=It.getUniforms(w),w.onBeforeCompile(Dt,_),Wt=It.acquireProgram(Dt,Ut),Vt.set(Ut,Wt),$.uniforms=Dt.uniforms;const Nt=$.uniforms;return(!w.isShaderMaterial&&!w.isRawShaderMaterial||w.clipping===!0)&&(Nt.clippingPlanes=ht.uniform),tc(w,Dt),$.needsLights=yd(w),$.lightsStateVersion=yt,$.needsLights&&(Nt.ambientLightColor.value=z.state.ambient,Nt.lightProbe.value=z.state.probe,Nt.directionalLights.value=z.state.directional,Nt.directionalLightShadows.value=z.state.directionalShadow,Nt.spotLights.value=z.state.spot,Nt.spotLightShadows.value=z.state.spotShadow,Nt.rectAreaLights.value=z.state.rectArea,Nt.ltc_1.value=z.state.rectAreaLTC1,Nt.ltc_2.value=z.state.rectAreaLTC2,Nt.pointLights.value=z.state.point,Nt.pointLightShadows.value=z.state.pointShadow,Nt.hemisphereLights.value=z.state.hemi,Nt.directionalShadowMap.value=z.state.directionalShadowMap,Nt.directionalShadowMatrix.value=z.state.directionalShadowMatrix,Nt.spotShadowMap.value=z.state.spotShadowMap,Nt.spotLightMatrix.value=z.state.spotLightMatrix,Nt.spotLightMap.value=z.state.spotLightMap,Nt.pointShadowMap.value=z.state.pointShadowMap,Nt.pointShadowMatrix.value=z.state.pointShadowMatrix),$.currentProgram=Wt,$.uniformsList=null,Wt}function Ql(w){if(w.uniformsList===null){const k=w.currentProgram.getUniforms();w.uniformsList=no.seqWithValue(k.seq,w.uniforms)}return w.uniformsList}function tc(w,k){const X=pt.get(w);X.outputColorSpace=k.outputColorSpace,X.batching=k.batching,X.batchingColor=k.batchingColor,X.instancing=k.instancing,X.instancingColor=k.instancingColor,X.instancingMorph=k.instancingMorph,X.skinning=k.skinning,X.morphTargets=k.morphTargets,X.morphNormals=k.morphNormals,X.morphColors=k.morphColors,X.morphTargetsCount=k.morphTargetsCount,X.numClippingPlanes=k.numClippingPlanes,X.numIntersection=k.numClipIntersection,X.vertexAlphas=k.vertexAlphas,X.vertexTangents=k.vertexTangents,X.toneMapping=k.toneMapping}function Md(w,k,X,$,z){k.isScene!==!0&&(k=bt),A.resetTextureUnits();const ut=k.fog,yt=$.isMeshStandardMaterial?k.environment:null,Dt=P===null?_.outputColorSpace:P.isXRRenderTarget===!0?P.texture.colorSpace:ii,Ut=($.isMeshStandardMaterial?W:S).get($.envMap||yt),Vt=$.vertexColors===!0&&!!X.attributes.color&&X.attributes.color.itemSize===4,Wt=!!X.attributes.tangent&&(!!$.normalMap||$.anisotropy>0),Nt=!!X.morphAttributes.position,te=!!X.morphAttributes.normal,he=!!X.morphAttributes.color;let ue=ei;$.toneMapped&&(P===null||P.isXRRenderTarget===!0)&&(ue=_.toneMapping);const Xe=X.morphAttributes.position||X.morphAttributes.normal||X.morphAttributes.color,se=Xe!==void 0?Xe.length:0,Ot=pt.get($),Tn=p.state.lights;if(ot===!0&&(mt===!0||w!==y)){const rn=w===y&&$.id===b;ht.setState($,w,rn)}let re=!1;$.version===Ot.__version?(Ot.needsLights&&Ot.lightsStateVersion!==Tn.state.version||Ot.outputColorSpace!==Dt||z.isBatchedMesh&&Ot.batching===!1||!z.isBatchedMesh&&Ot.batching===!0||z.isBatchedMesh&&Ot.batchingColor===!0&&z.colorTexture===null||z.isBatchedMesh&&Ot.batchingColor===!1&&z.colorTexture!==null||z.isInstancedMesh&&Ot.instancing===!1||!z.isInstancedMesh&&Ot.instancing===!0||z.isSkinnedMesh&&Ot.skinning===!1||!z.isSkinnedMesh&&Ot.skinning===!0||z.isInstancedMesh&&Ot.instancingColor===!0&&z.instanceColor===null||z.isInstancedMesh&&Ot.instancingColor===!1&&z.instanceColor!==null||z.isInstancedMesh&&Ot.instancingMorph===!0&&z.morphTexture===null||z.isInstancedMesh&&Ot.instancingMorph===!1&&z.morphTexture!==null||Ot.envMap!==Ut||$.fog===!0&&Ot.fog!==ut||Ot.numClippingPlanes!==void 0&&(Ot.numClippingPlanes!==ht.numPlanes||Ot.numIntersection!==ht.numIntersection)||Ot.vertexAlphas!==Vt||Ot.vertexTangents!==Wt||Ot.morphTargets!==Nt||Ot.morphNormals!==te||Ot.morphColors!==he||Ot.toneMapping!==ue||Ot.morphTargetsCount!==se)&&(re=!0):(re=!0,Ot.__version=$.version);let hn=Ot.currentProgram;re===!0&&(hn=dr($,k,z));let Ri=!1,Ke=!1,ms=!1;const de=hn.getUniforms(),gn=Ot.uniforms;if(ct.useProgram(hn.program)&&(Ri=!0,Ke=!0,ms=!0),$.id!==b&&(b=$.id,Ke=!0),Ri||y!==w){ct.buffers.depth.getReversed()?(lt.copy(w.projectionMatrix),bf(lt),Sf(lt),de.setValue(L,"projectionMatrix",lt)):de.setValue(L,"projectionMatrix",w.projectionMatrix),de.setValue(L,"viewMatrix",w.matrixWorldInverse);const Bn=de.map.cameraPosition;Bn!==void 0&&Bn.setValue(L,Ft.setFromMatrixPosition(w.matrixWorld)),wt.logarithmicDepthBuffer&&de.setValue(L,"logDepthBufFC",2/(Math.log(w.far+1)/Math.LN2)),($.isMeshPhongMaterial||$.isMeshToonMaterial||$.isMeshLambertMaterial||$.isMeshBasicMaterial||$.isMeshStandardMaterial||$.isShaderMaterial)&&de.setValue(L,"isOrthographic",w.isOrthographicCamera===!0),y!==w&&(y=w,Ke=!0,ms=!0)}if(z.isSkinnedMesh){de.setOptional(L,z,"bindMatrix"),de.setOptional(L,z,"bindMatrixInverse");const rn=z.skeleton;rn&&(rn.boneTexture===null&&rn.computeBoneTexture(),de.setValue(L,"boneTexture",rn.boneTexture,A))}z.isBatchedMesh&&(de.setOptional(L,z,"batchingTexture"),de.setValue(L,"batchingTexture",z._matricesTexture,A),de.setOptional(L,z,"batchingIdTexture"),de.setValue(L,"batchingIdTexture",z._indirectTexture,A),de.setOptional(L,z,"batchingColorTexture"),z._colorsTexture!==null&&de.setValue(L,"batchingColorTexture",z._colorsTexture,A));const gs=X.morphAttributes;if((gs.position!==void 0||gs.normal!==void 0||gs.color!==void 0)&&zt.update(z,X,hn),(Ke||Ot.receiveShadow!==z.receiveShadow)&&(Ot.receiveShadow=z.receiveShadow,de.setValue(L,"receiveShadow",z.receiveShadow)),$.isMeshGouraudMaterial&&$.envMap!==null&&(gn.envMap.value=Ut,gn.flipEnvMap.value=Ut.isCubeTexture&&Ut.isRenderTargetTexture===!1?-1:1),$.isMeshStandardMaterial&&$.envMap===null&&k.environment!==null&&(gn.envMapIntensity.value=k.environmentIntensity),Ke&&(de.setValue(L,"toneMappingExposure",_.toneMappingExposure),Ot.needsLights&&xd(gn,ms),ut&&$.fog===!0&&vt.refreshFogUniforms(gn,ut),vt.refreshMaterialUniforms(gn,$,q,K,p.state.transmissionRenderTarget[w.id]),no.upload(L,Ql(Ot),gn,A)),$.isShaderMaterial&&$.uniformsNeedUpdate===!0&&(no.upload(L,Ql(Ot),gn,A),$.uniformsNeedUpdate=!1),$.isSpriteMaterial&&de.setValue(L,"center",z.center),de.setValue(L,"modelViewMatrix",z.modelViewMatrix),de.setValue(L,"normalMatrix",z.normalMatrix),de.setValue(L,"modelMatrix",z.matrixWorld),$.isShaderMaterial||$.isRawShaderMaterial){const rn=$.uniformsGroups;for(let Bn=0,kn=rn.length;Bn<kn;Bn++){const ec=rn[Bn];B.update(ec,hn),B.bind(ec,hn)}}return hn}function xd(w,k){w.ambientLightColor.needsUpdate=k,w.lightProbe.needsUpdate=k,w.directionalLights.needsUpdate=k,w.directionalLightShadows.needsUpdate=k,w.pointLights.needsUpdate=k,w.pointLightShadows.needsUpdate=k,w.spotLights.needsUpdate=k,w.spotLightShadows.needsUpdate=k,w.rectAreaLights.needsUpdate=k,w.hemisphereLights.needsUpdate=k}function yd(w){return w.isMeshLambertMaterial||w.isMeshToonMaterial||w.isMeshPhongMaterial||w.isMeshStandardMaterial||w.isShadowMaterial||w.isShaderMaterial&&w.lights===!0}this.getActiveCubeFace=function(){return E},this.getActiveMipmapLevel=function(){return C},this.getRenderTarget=function(){return P},this.setRenderTargetTextures=function(w,k,X){pt.get(w.texture).__webglTexture=k,pt.get(w.depthTexture).__webglTexture=X;const $=pt.get(w);$.__hasExternalTextures=!0,$.__autoAllocateDepthBuffer=X===void 0,$.__autoAllocateDepthBuffer||at.has("WEBGL_multisampled_render_to_texture")===!0&&(console.warn("THREE.WebGLRenderer: Render-to-texture extension was disabled because an external texture was provided"),$.__useRenderToTexture=!1)},this.setRenderTargetFramebuffer=function(w,k){const X=pt.get(w);X.__webglFramebuffer=k,X.__useDefaultFramebuffer=k===void 0},this.setRenderTarget=function(w,k=0,X=0){P=w,E=k,C=X;let $=!0,z=null,ut=!1,yt=!1;if(w){const Ut=pt.get(w);if(Ut.__useDefaultFramebuffer!==void 0)ct.bindFramebuffer(L.FRAMEBUFFER,null),$=!1;else if(Ut.__webglFramebuffer===void 0)A.setupRenderTarget(w);else if(Ut.__hasExternalTextures)A.rebindTextures(w,pt.get(w.texture).__webglTexture,pt.get(w.depthTexture).__webglTexture);else if(w.depthBuffer){const Nt=w.depthTexture;if(Ut.__boundDepthTexture!==Nt){if(Nt!==null&&pt.has(Nt)&&(w.width!==Nt.image.width||w.height!==Nt.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");A.setupDepthRenderbuffer(w)}}const Vt=w.texture;(Vt.isData3DTexture||Vt.isDataArrayTexture||Vt.isCompressedArrayTexture)&&(yt=!0);const Wt=pt.get(w).__webglFramebuffer;w.isWebGLCubeRenderTarget?(Array.isArray(Wt[k])?z=Wt[k][X]:z=Wt[k],ut=!0):w.samples>0&&A.useMultisampledRTT(w)===!1?z=pt.get(w).__webglMultisampledFramebuffer:Array.isArray(Wt)?z=Wt[X]:z=Wt,R.copy(w.viewport),O.copy(w.scissor),N=w.scissorTest}else R.copy(et).multiplyScalar(q).floor(),O.copy(dt).multiplyScalar(q).floor(),N=Ht;if(ct.bindFramebuffer(L.FRAMEBUFFER,z)&&$&&ct.drawBuffers(w,z),ct.viewport(R),ct.scissor(O),ct.setScissorTest(N),ut){const Ut=pt.get(w.texture);L.framebufferTexture2D(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,L.TEXTURE_CUBE_MAP_POSITIVE_X+k,Ut.__webglTexture,X)}else if(yt){const Ut=pt.get(w.texture),Vt=k||0;L.framebufferTextureLayer(L.FRAMEBUFFER,L.COLOR_ATTACHMENT0,Ut.__webglTexture,X||0,Vt)}b=-1},this.readRenderTargetPixels=function(w,k,X,$,z,ut,yt){if(!(w&&w.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let Dt=pt.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&yt!==void 0&&(Dt=Dt[yt]),Dt){ct.bindFramebuffer(L.FRAMEBUFFER,Dt);try{const Ut=w.texture,Vt=Ut.format,Wt=Ut.type;if(!wt.textureFormatReadable(Vt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!wt.textureTypeReadable(Wt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}k>=0&&k<=w.width-$&&X>=0&&X<=w.height-z&&L.readPixels(k,X,$,z,Xt.convert(Vt),Xt.convert(Wt),ut)}finally{const Ut=P!==null?pt.get(P).__webglFramebuffer:null;ct.bindFramebuffer(L.FRAMEBUFFER,Ut)}}},this.readRenderTargetPixelsAsync=async function(w,k,X,$,z,ut,yt){if(!(w&&w.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let Dt=pt.get(w).__webglFramebuffer;if(w.isWebGLCubeRenderTarget&&yt!==void 0&&(Dt=Dt[yt]),Dt){const Ut=w.texture,Vt=Ut.format,Wt=Ut.type;if(!wt.textureFormatReadable(Vt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!wt.textureTypeReadable(Wt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");if(k>=0&&k<=w.width-$&&X>=0&&X<=w.height-z){ct.bindFramebuffer(L.FRAMEBUFFER,Dt);const Nt=L.createBuffer();L.bindBuffer(L.PIXEL_PACK_BUFFER,Nt),L.bufferData(L.PIXEL_PACK_BUFFER,ut.byteLength,L.STREAM_READ),L.readPixels(k,X,$,z,Xt.convert(Vt),Xt.convert(Wt),0);const te=P!==null?pt.get(P).__webglFramebuffer:null;ct.bindFramebuffer(L.FRAMEBUFFER,te);const he=L.fenceSync(L.SYNC_GPU_COMMANDS_COMPLETE,0);return L.flush(),await yf(L,he,4),L.bindBuffer(L.PIXEL_PACK_BUFFER,Nt),L.getBufferSubData(L.PIXEL_PACK_BUFFER,0,ut),L.deleteBuffer(Nt),L.deleteSync(he),ut}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")}},this.copyFramebufferToTexture=function(w,k=null,X=0){w.isTexture!==!0&&(Cs("WebGLRenderer: copyFramebufferToTexture function signature has changed."),k=arguments[0]||null,w=arguments[1]);const $=Math.pow(2,-X),z=Math.floor(w.image.width*$),ut=Math.floor(w.image.height*$),yt=k!==null?k.x:0,Dt=k!==null?k.y:0;A.setTexture2D(w,0),L.copyTexSubImage2D(L.TEXTURE_2D,X,0,0,yt,Dt,z,ut),ct.unbindTexture()},this.copyTextureToTexture=function(w,k,X=null,$=null,z=0){w.isTexture!==!0&&(Cs("WebGLRenderer: copyTextureToTexture function signature has changed."),$=arguments[0]||null,w=arguments[1],k=arguments[2],z=arguments[3]||0,X=null);let ut,yt,Dt,Ut,Vt,Wt,Nt,te,he;const ue=w.isCompressedTexture?w.mipmaps[z]:w.image;X!==null?(ut=X.max.x-X.min.x,yt=X.max.y-X.min.y,Dt=X.isBox3?X.max.z-X.min.z:1,Ut=X.min.x,Vt=X.min.y,Wt=X.isBox3?X.min.z:0):(ut=ue.width,yt=ue.height,Dt=ue.depth||1,Ut=0,Vt=0,Wt=0),$!==null?(Nt=$.x,te=$.y,he=$.z):(Nt=0,te=0,he=0);const Xe=Xt.convert(k.format),se=Xt.convert(k.type);let Ot;k.isData3DTexture?(A.setTexture3D(k,0),Ot=L.TEXTURE_3D):k.isDataArrayTexture||k.isCompressedArrayTexture?(A.setTexture2DArray(k,0),Ot=L.TEXTURE_2D_ARRAY):(A.setTexture2D(k,0),Ot=L.TEXTURE_2D),L.pixelStorei(L.UNPACK_FLIP_Y_WEBGL,k.flipY),L.pixelStorei(L.UNPACK_PREMULTIPLY_ALPHA_WEBGL,k.premultiplyAlpha),L.pixelStorei(L.UNPACK_ALIGNMENT,k.unpackAlignment);const Tn=L.getParameter(L.UNPACK_ROW_LENGTH),re=L.getParameter(L.UNPACK_IMAGE_HEIGHT),hn=L.getParameter(L.UNPACK_SKIP_PIXELS),Ri=L.getParameter(L.UNPACK_SKIP_ROWS),Ke=L.getParameter(L.UNPACK_SKIP_IMAGES);L.pixelStorei(L.UNPACK_ROW_LENGTH,ue.width),L.pixelStorei(L.UNPACK_IMAGE_HEIGHT,ue.height),L.pixelStorei(L.UNPACK_SKIP_PIXELS,Ut),L.pixelStorei(L.UNPACK_SKIP_ROWS,Vt),L.pixelStorei(L.UNPACK_SKIP_IMAGES,Wt);const ms=w.isDataArrayTexture||w.isData3DTexture,de=k.isDataArrayTexture||k.isData3DTexture;if(w.isRenderTargetTexture||w.isDepthTexture){const gn=pt.get(w),gs=pt.get(k),rn=pt.get(gn.__renderTarget),Bn=pt.get(gs.__renderTarget);ct.bindFramebuffer(L.READ_FRAMEBUFFER,rn.__webglFramebuffer),ct.bindFramebuffer(L.DRAW_FRAMEBUFFER,Bn.__webglFramebuffer);for(let kn=0;kn<Dt;kn++)ms&&L.framebufferTextureLayer(L.READ_FRAMEBUFFER,L.COLOR_ATTACHMENT0,pt.get(w).__webglTexture,z,Wt+kn),w.isDepthTexture?(de&&L.framebufferTextureLayer(L.DRAW_FRAMEBUFFER,L.COLOR_ATTACHMENT0,pt.get(k).__webglTexture,z,he+kn),L.blitFramebuffer(Ut,Vt,ut,yt,Nt,te,ut,yt,L.DEPTH_BUFFER_BIT,L.NEAREST)):de?L.copyTexSubImage3D(Ot,z,Nt,te,he+kn,Ut,Vt,ut,yt):L.copyTexSubImage2D(Ot,z,Nt,te,he+kn,Ut,Vt,ut,yt);ct.bindFramebuffer(L.READ_FRAMEBUFFER,null),ct.bindFramebuffer(L.DRAW_FRAMEBUFFER,null)}else de?w.isDataTexture||w.isData3DTexture?L.texSubImage3D(Ot,z,Nt,te,he,ut,yt,Dt,Xe,se,ue.data):k.isCompressedArrayTexture?L.compressedTexSubImage3D(Ot,z,Nt,te,he,ut,yt,Dt,Xe,ue.data):L.texSubImage3D(Ot,z,Nt,te,he,ut,yt,Dt,Xe,se,ue):w.isDataTexture?L.texSubImage2D(L.TEXTURE_2D,z,Nt,te,ut,yt,Xe,se,ue.data):w.isCompressedTexture?L.compressedTexSubImage2D(L.TEXTURE_2D,z,Nt,te,ue.width,ue.height,Xe,ue.data):L.texSubImage2D(L.TEXTURE_2D,z,Nt,te,ut,yt,Xe,se,ue);L.pixelStorei(L.UNPACK_ROW_LENGTH,Tn),L.pixelStorei(L.UNPACK_IMAGE_HEIGHT,re),L.pixelStorei(L.UNPACK_SKIP_PIXELS,hn),L.pixelStorei(L.UNPACK_SKIP_ROWS,Ri),L.pixelStorei(L.UNPACK_SKIP_IMAGES,Ke),z===0&&k.generateMipmaps&&L.generateMipmap(Ot),ct.unbindTexture()},this.copyTextureToTexture3D=function(w,k,X=null,$=null,z=0){return w.isTexture!==!0&&(Cs("WebGLRenderer: copyTextureToTexture3D function signature has changed."),X=arguments[0]||null,$=arguments[1]||null,w=arguments[2],k=arguments[3],z=arguments[4]||0),Cs('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(w,k,X,$,z)},this.initRenderTarget=function(w){pt.get(w).__webglFramebuffer===void 0&&A.setupRenderTarget(w)},this.initTexture=function(w){w.isCubeTexture?A.setTextureCube(w,0):w.isData3DTexture?A.setTexture3D(w,0):w.isDataArrayTexture||w.isCompressedArrayTexture?A.setTexture2DArray(w,0):A.setTexture2D(w,0),ct.unbindTexture()},this.resetState=function(){E=0,C=0,P=null,ct.reset(),ce.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Un}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorspace=Qt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Qt._getUnpackColorSpace()}}class Nu extends Pe{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new ln,this.environmentIntensity=1,this.environmentRotation=new ln,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class Dv extends Ve{constructor(t=null,e=1,n=1,s,r,o,a,l,c=en,h=en,u,d){super(null,o,a,l,c,h,s,r,u,d),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class Qc extends Re{constructor(t,e,n,s=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=s}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const Wi=new Jt,th=new Jt,Ur=[],eh=new Ai,Uv=new Jt,ys=new tt,bs=new si;class Ps extends tt{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new Qc(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let s=0;s<n;s++)this.setMatrixAt(s,Uv)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new Ai),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Wi),eh.copy(t.boundingBox).applyMatrix4(Wi),this.boundingBox.union(eh)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new si),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Wi),bs.copy(t.boundingSphere).applyMatrix4(Wi),this.boundingSphere.union(bs)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const n=e.morphTargetInfluences,s=this.morphTexture.source.data.data,r=n.length+1,o=t*r+1;for(let a=0;a<n.length;a++)n[a]=s[o+a]}raycast(t,e){const n=this.matrixWorld,s=this.count;if(ys.geometry=this.geometry,ys.material=this.material,ys.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),bs.copy(this.boundingSphere),bs.applyMatrix4(n),t.ray.intersectsSphere(bs)!==!1))for(let r=0;r<s;r++){this.getMatrixAt(r,Wi),th.multiplyMatrices(n,Wi),ys.matrixWorld=th,ys.raycast(t,Ur);for(let o=0,a=Ur.length;o<a;o++){const l=Ur[o];l.instanceId=r,l.object=this,e.push(l)}Ur.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new Qc(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const n=e.morphTargetInfluences,s=n.length+1;this.morphTexture===null&&(this.morphTexture=new Dv(new Float32Array(s*this.count),s,this.count,Ll,xn));const r=this.morphTexture.source.data.data;let o=0;for(let c=0;c<n.length;c++)o+=n[c];const a=this.geometry.morphTargetsRelative?1:1-o,l=s*t;r[l]=a,r.set(n,l+1)}updateMorphTargets(){}dispose(){return this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null),this}}class Nv extends us{static get type(){return"PointsMaterial"}constructor(t){super(),this.isPointsMaterial=!0,this.color=new Et(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const nh=new Jt,Ml=new Mo,Nr=new si,Or=new T;class Ov extends Pe{constructor(t=new pe,e=new Nv){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const n=this.geometry,s=this.matrixWorld,r=t.params.Points.threshold,o=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Nr.copy(n.boundingSphere),Nr.applyMatrix4(s),Nr.radius+=r,t.ray.intersectsSphere(Nr)===!1)return;nh.copy(s).invert(),Ml.copy(t.ray).applyMatrix4(nh);const a=r/((this.scale.x+this.scale.y+this.scale.z)/3),l=a*a,c=n.index,u=n.attributes.position;if(c!==null){const d=Math.max(0,o.start),f=Math.min(c.count,o.start+o.count);for(let g=d,v=f;g<v;g++){const m=c.getX(g);Or.fromBufferAttribute(u,m),ih(Or,m,l,s,t,e,this)}}else{const d=Math.max(0,o.start),f=Math.min(u.count,o.start+o.count);for(let g=d,v=f;g<v;g++)Or.fromBufferAttribute(u,g),ih(Or,g,l,s,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const s=e[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let r=0,o=s.length;r<o;r++){const a=s[r].name||String(r);this.morphTargetInfluences.push(0),this.morphTargetDictionary[a]=r}}}}}function ih(i,t,e,n,s,r,o){const a=Ml.distanceSqToPoint(i);if(a<e){const l=new T;Ml.closestPointToPoint(i,l),l.applyMatrix4(n);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;r.push({distance:c,distanceToRay:Math.sqrt(a),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}class yo extends Ve{constructor(t,e,n,s,r,o,a,l,c){super(t,e,n,s,r,o,a,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class wn{constructor(){this.type="Curve",this.arcLengthDivisions=200}getPoint(){return console.warn("THREE.Curve: .getPoint() not implemented."),null}getPointAt(t,e){const n=this.getUtoTmapping(t);return this.getPoint(n,e)}getPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return e}getSpacedPoints(t=5){const e=[];for(let n=0;n<=t;n++)e.push(this.getPointAt(n/t));return e}getLength(){const t=this.getLengths();return t[t.length-1]}getLengths(t=this.arcLengthDivisions){if(this.cacheArcLengths&&this.cacheArcLengths.length===t+1&&!this.needsUpdate)return this.cacheArcLengths;this.needsUpdate=!1;const e=[];let n,s=this.getPoint(0),r=0;e.push(0);for(let o=1;o<=t;o++)n=this.getPoint(o/t),r+=n.distanceTo(s),e.push(r),s=n;return this.cacheArcLengths=e,e}updateArcLengths(){this.needsUpdate=!0,this.getLengths()}getUtoTmapping(t,e){const n=this.getLengths();let s=0;const r=n.length;let o;e?o=e:o=t*n[r-1];let a=0,l=r-1,c;for(;a<=l;)if(s=Math.floor(a+(l-a)/2),c=n[s]-o,c<0)a=s+1;else if(c>0)l=s-1;else{l=s;break}if(s=l,n[s]===o)return s/(r-1);const h=n[s],d=n[s+1]-h,f=(o-h)/d;return(s+f)/(r-1)}getTangent(t,e){let s=t-1e-4,r=t+1e-4;s<0&&(s=0),r>1&&(r=1);const o=this.getPoint(s),a=this.getPoint(r),l=e||(o.isVector2?new H:new T);return l.copy(a).sub(o).normalize(),l}getTangentAt(t,e){const n=this.getUtoTmapping(t);return this.getTangent(n,e)}computeFrenetFrames(t,e){const n=new T,s=[],r=[],o=[],a=new T,l=new Jt;for(let f=0;f<=t;f++){const g=f/t;s[f]=this.getTangentAt(g,new T)}r[0]=new T,o[0]=new T;let c=Number.MAX_VALUE;const h=Math.abs(s[0].x),u=Math.abs(s[0].y),d=Math.abs(s[0].z);h<=c&&(c=h,n.set(1,0,0)),u<=c&&(c=u,n.set(0,1,0)),d<=c&&n.set(0,0,1),a.crossVectors(s[0],n).normalize(),r[0].crossVectors(s[0],a),o[0].crossVectors(s[0],r[0]);for(let f=1;f<=t;f++){if(r[f]=r[f-1].clone(),o[f]=o[f-1].clone(),a.crossVectors(s[f-1],s[f]),a.length()>Number.EPSILON){a.normalize();const g=Math.acos(be(s[f-1].dot(s[f]),-1,1));r[f].applyMatrix4(l.makeRotationAxis(a,g))}o[f].crossVectors(s[f],r[f])}if(e===!0){let f=Math.acos(be(r[0].dot(r[t]),-1,1));f/=t,s[0].dot(a.crossVectors(r[0],r[t]))>0&&(f=-f);for(let g=1;g<=t;g++)r[g].applyMatrix4(l.makeRotationAxis(s[g],f*g)),o[g].crossVectors(s[g],r[g])}return{tangents:s,normals:r,binormals:o}}clone(){return new this.constructor().copy(this)}copy(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}toJSON(){const t={metadata:{version:4.6,type:"Curve",generator:"Curve.toJSON"}};return t.arcLengthDivisions=this.arcLengthDivisions,t.type=this.type,t}fromJSON(t){return this.arcLengthDivisions=t.arcLengthDivisions,this}}class zl extends wn{constructor(t=0,e=0,n=1,s=1,r=0,o=Math.PI*2,a=!1,l=0){super(),this.isEllipseCurve=!0,this.type="EllipseCurve",this.aX=t,this.aY=e,this.xRadius=n,this.yRadius=s,this.aStartAngle=r,this.aEndAngle=o,this.aClockwise=a,this.aRotation=l}getPoint(t,e=new H){const n=e,s=Math.PI*2;let r=this.aEndAngle-this.aStartAngle;const o=Math.abs(r)<Number.EPSILON;for(;r<0;)r+=s;for(;r>s;)r-=s;r<Number.EPSILON&&(o?r=0:r=s),this.aClockwise===!0&&!o&&(r===s?r=-s:r=r-s);const a=this.aStartAngle+t*r;let l=this.aX+this.xRadius*Math.cos(a),c=this.aY+this.yRadius*Math.sin(a);if(this.aRotation!==0){const h=Math.cos(this.aRotation),u=Math.sin(this.aRotation),d=l-this.aX,f=c-this.aY;l=d*h-f*u+this.aX,c=d*u+f*h+this.aY}return n.set(l,c)}copy(t){return super.copy(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}toJSON(){const t=super.toJSON();return t.aX=this.aX,t.aY=this.aY,t.xRadius=this.xRadius,t.yRadius=this.yRadius,t.aStartAngle=this.aStartAngle,t.aEndAngle=this.aEndAngle,t.aClockwise=this.aClockwise,t.aRotation=this.aRotation,t}fromJSON(t){return super.fromJSON(t),this.aX=t.aX,this.aY=t.aY,this.xRadius=t.xRadius,this.yRadius=t.yRadius,this.aStartAngle=t.aStartAngle,this.aEndAngle=t.aEndAngle,this.aClockwise=t.aClockwise,this.aRotation=t.aRotation,this}}class Fv extends zl{constructor(t,e,n,s,r,o){super(t,e,n,n,s,r,o),this.isArcCurve=!0,this.type="ArcCurve"}}function Hl(){let i=0,t=0,e=0,n=0;function s(r,o,a,l){i=r,t=a,e=-3*r+3*o-2*a-l,n=2*r-2*o+a+l}return{initCatmullRom:function(r,o,a,l,c){s(o,a,c*(a-r),c*(l-o))},initNonuniformCatmullRom:function(r,o,a,l,c,h,u){let d=(o-r)/c-(a-r)/(c+h)+(a-o)/h,f=(a-o)/h-(l-o)/(h+u)+(l-a)/u;d*=h,f*=h,s(o,a,d,f)},calc:function(r){const o=r*r,a=o*r;return i+t*r+e*o+n*a}}}const Fr=new T,oa=new Hl,aa=new Hl,la=new Hl;class bo extends wn{constructor(t=[],e=!1,n="centripetal",s=.5){super(),this.isCatmullRomCurve3=!0,this.type="CatmullRomCurve3",this.points=t,this.closed=e,this.curveType=n,this.tension=s}getPoint(t,e=new T){const n=e,s=this.points,r=s.length,o=(r-(this.closed?0:1))*t;let a=Math.floor(o),l=o-a;this.closed?a+=a>0?0:(Math.floor(Math.abs(a)/r)+1)*r:l===0&&a===r-1&&(a=r-2,l=1);let c,h;this.closed||a>0?c=s[(a-1)%r]:(Fr.subVectors(s[0],s[1]).add(s[0]),c=Fr);const u=s[a%r],d=s[(a+1)%r];if(this.closed||a+2<r?h=s[(a+2)%r]:(Fr.subVectors(s[r-1],s[r-2]).add(s[r-1]),h=Fr),this.curveType==="centripetal"||this.curveType==="chordal"){const f=this.curveType==="chordal"?.5:.25;let g=Math.pow(c.distanceToSquared(u),f),v=Math.pow(u.distanceToSquared(d),f),m=Math.pow(d.distanceToSquared(h),f);v<1e-4&&(v=1),g<1e-4&&(g=v),m<1e-4&&(m=v),oa.initNonuniformCatmullRom(c.x,u.x,d.x,h.x,g,v,m),aa.initNonuniformCatmullRom(c.y,u.y,d.y,h.y,g,v,m),la.initNonuniformCatmullRom(c.z,u.z,d.z,h.z,g,v,m)}else this.curveType==="catmullrom"&&(oa.initCatmullRom(c.x,u.x,d.x,h.x,this.tension),aa.initCatmullRom(c.y,u.y,d.y,h.y,this.tension),la.initCatmullRom(c.z,u.z,d.z,h.z,this.tension));return n.set(oa.calc(l),aa.calc(l),la.calc(l)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(s.clone())}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const s=this.points[e];t.points.push(s.toArray())}return t.closed=this.closed,t.curveType=this.curveType,t.tension=this.tension,t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(new T().fromArray(s))}return this.closed=t.closed,this.curveType=t.curveType,this.tension=t.tension,this}}function sh(i,t,e,n,s){const r=(n-t)*.5,o=(s-e)*.5,a=i*i,l=i*a;return(2*e-2*n+r+o)*l+(-3*e+3*n-2*r-o)*a+r*i+e}function Bv(i,t){const e=1-i;return e*e*t}function kv(i,t){return 2*(1-i)*i*t}function zv(i,t){return i*i*t}function Fs(i,t,e,n){return Bv(i,t)+kv(i,e)+zv(i,n)}function Hv(i,t){const e=1-i;return e*e*e*t}function Vv(i,t){const e=1-i;return 3*e*e*i*t}function Gv(i,t){return 3*(1-i)*i*i*t}function Wv(i,t){return i*i*i*t}function Bs(i,t,e,n,s){return Hv(i,t)+Vv(i,e)+Gv(i,n)+Wv(i,s)}class Ou extends wn{constructor(t=new H,e=new H,n=new H,s=new H){super(),this.isCubicBezierCurve=!0,this.type="CubicBezierCurve",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new H){const n=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Bs(t,s.x,r.x,o.x,a.x),Bs(t,s.y,r.y,o.y,a.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class qv extends wn{constructor(t=new T,e=new T,n=new T,s=new T){super(),this.isCubicBezierCurve3=!0,this.type="CubicBezierCurve3",this.v0=t,this.v1=e,this.v2=n,this.v3=s}getPoint(t,e=new T){const n=e,s=this.v0,r=this.v1,o=this.v2,a=this.v3;return n.set(Bs(t,s.x,r.x,o.x,a.x),Bs(t,s.y,r.y,o.y,a.y),Bs(t,s.z,r.z,o.z,a.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this.v3.copy(t.v3),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t.v3=this.v3.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this.v3.fromArray(t.v3),this}}class Fu extends wn{constructor(t=new H,e=new H){super(),this.isLineCurve=!0,this.type="LineCurve",this.v1=t,this.v2=e}getPoint(t,e=new H){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new H){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Yv extends wn{constructor(t=new T,e=new T){super(),this.isLineCurve3=!0,this.type="LineCurve3",this.v1=t,this.v2=e}getPoint(t,e=new T){const n=e;return t===1?n.copy(this.v2):(n.copy(this.v2).sub(this.v1),n.multiplyScalar(t).add(this.v1)),n}getPointAt(t,e){return this.getPoint(t,e)}getTangent(t,e=new T){return e.subVectors(this.v2,this.v1).normalize()}getTangentAt(t,e){return this.getTangent(t,e)}copy(t){return super.copy(t),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class Bu extends wn{constructor(t=new H,e=new H,n=new H){super(),this.isQuadraticBezierCurve=!0,this.type="QuadraticBezierCurve",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new H){const n=e,s=this.v0,r=this.v1,o=this.v2;return n.set(Fs(t,s.x,r.x,o.x),Fs(t,s.y,r.y,o.y)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class ku extends wn{constructor(t=new T,e=new T,n=new T){super(),this.isQuadraticBezierCurve3=!0,this.type="QuadraticBezierCurve3",this.v0=t,this.v1=e,this.v2=n}getPoint(t,e=new T){const n=e,s=this.v0,r=this.v1,o=this.v2;return n.set(Fs(t,s.x,r.x,o.x),Fs(t,s.y,r.y,o.y),Fs(t,s.z,r.z,o.z)),n}copy(t){return super.copy(t),this.v0.copy(t.v0),this.v1.copy(t.v1),this.v2.copy(t.v2),this}toJSON(){const t=super.toJSON();return t.v0=this.v0.toArray(),t.v1=this.v1.toArray(),t.v2=this.v2.toArray(),t}fromJSON(t){return super.fromJSON(t),this.v0.fromArray(t.v0),this.v1.fromArray(t.v1),this.v2.fromArray(t.v2),this}}class zu extends wn{constructor(t=[]){super(),this.isSplineCurve=!0,this.type="SplineCurve",this.points=t}getPoint(t,e=new H){const n=e,s=this.points,r=(s.length-1)*t,o=Math.floor(r),a=r-o,l=s[o===0?o:o-1],c=s[o],h=s[o>s.length-2?s.length-1:o+1],u=s[o>s.length-3?s.length-1:o+2];return n.set(sh(a,l.x,c.x,h.x,u.x),sh(a,l.y,c.y,h.y,u.y)),n}copy(t){super.copy(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(s.clone())}return this}toJSON(){const t=super.toJSON();t.points=[];for(let e=0,n=this.points.length;e<n;e++){const s=this.points[e];t.points.push(s.toArray())}return t}fromJSON(t){super.fromJSON(t),this.points=[];for(let e=0,n=t.points.length;e<n;e++){const s=t.points[e];this.points.push(new H().fromArray(s))}return this}}var co=Object.freeze({__proto__:null,ArcCurve:Fv,CatmullRomCurve3:bo,CubicBezierCurve:Ou,CubicBezierCurve3:qv,EllipseCurve:zl,LineCurve:Fu,LineCurve3:Yv,QuadraticBezierCurve:Bu,QuadraticBezierCurve3:ku,SplineCurve:zu});class Xv extends wn{constructor(){super(),this.type="CurvePath",this.curves=[],this.autoClose=!1}add(t){this.curves.push(t)}closePath(){const t=this.curves[0].getPoint(0),e=this.curves[this.curves.length-1].getPoint(1);if(!t.equals(e)){const n=t.isVector2===!0?"LineCurve":"LineCurve3";this.curves.push(new co[n](e,t))}return this}getPoint(t,e){const n=t*this.getLength(),s=this.getCurveLengths();let r=0;for(;r<s.length;){if(s[r]>=n){const o=s[r]-n,a=this.curves[r],l=a.getLength(),c=l===0?0:1-o/l;return a.getPointAt(c,e)}r++}return null}getLength(){const t=this.getCurveLengths();return t[t.length-1]}updateArcLengths(){this.needsUpdate=!0,this.cacheLengths=null,this.getCurveLengths()}getCurveLengths(){if(this.cacheLengths&&this.cacheLengths.length===this.curves.length)return this.cacheLengths;const t=[];let e=0;for(let n=0,s=this.curves.length;n<s;n++)e+=this.curves[n].getLength(),t.push(e);return this.cacheLengths=t,t}getSpacedPoints(t=40){const e=[];for(let n=0;n<=t;n++)e.push(this.getPoint(n/t));return this.autoClose&&e.push(e[0]),e}getPoints(t=12){const e=[];let n;for(let s=0,r=this.curves;s<r.length;s++){const o=r[s],a=o.isEllipseCurve?t*2:o.isLineCurve||o.isLineCurve3?1:o.isSplineCurve?t*o.points.length:t,l=o.getPoints(a);for(let c=0;c<l.length;c++){const h=l[c];n&&n.equals(h)||(e.push(h),n=h)}}return this.autoClose&&e.length>1&&!e[e.length-1].equals(e[0])&&e.push(e[0]),e}copy(t){super.copy(t),this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const s=t.curves[e];this.curves.push(s.clone())}return this.autoClose=t.autoClose,this}toJSON(){const t=super.toJSON();t.autoClose=this.autoClose,t.curves=[];for(let e=0,n=this.curves.length;e<n;e++){const s=this.curves[e];t.curves.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.autoClose=t.autoClose,this.curves=[];for(let e=0,n=t.curves.length;e<n;e++){const s=t.curves[e];this.curves.push(new co[s.type]().fromJSON(s))}return this}}class ho extends Xv{constructor(t){super(),this.type="Path",this.currentPoint=new H,t&&this.setFromPoints(t)}setFromPoints(t){this.moveTo(t[0].x,t[0].y);for(let e=1,n=t.length;e<n;e++)this.lineTo(t[e].x,t[e].y);return this}moveTo(t,e){return this.currentPoint.set(t,e),this}lineTo(t,e){const n=new Fu(this.currentPoint.clone(),new H(t,e));return this.curves.push(n),this.currentPoint.set(t,e),this}quadraticCurveTo(t,e,n,s){const r=new Bu(this.currentPoint.clone(),new H(t,e),new H(n,s));return this.curves.push(r),this.currentPoint.set(n,s),this}bezierCurveTo(t,e,n,s,r,o){const a=new Ou(this.currentPoint.clone(),new H(t,e),new H(n,s),new H(r,o));return this.curves.push(a),this.currentPoint.set(r,o),this}splineThru(t){const e=[this.currentPoint.clone()].concat(t),n=new zu(e);return this.curves.push(n),this.currentPoint.copy(t[t.length-1]),this}arc(t,e,n,s,r,o){const a=this.currentPoint.x,l=this.currentPoint.y;return this.absarc(t+a,e+l,n,s,r,o),this}absarc(t,e,n,s,r,o){return this.absellipse(t,e,n,n,s,r,o),this}ellipse(t,e,n,s,r,o,a,l){const c=this.currentPoint.x,h=this.currentPoint.y;return this.absellipse(t+c,e+h,n,s,r,o,a,l),this}absellipse(t,e,n,s,r,o,a,l){const c=new zl(t,e,n,s,r,o,a,l);if(this.curves.length>0){const u=c.getPoint(0);u.equals(this.currentPoint)||this.lineTo(u.x,u.y)}this.curves.push(c);const h=c.getPoint(1);return this.currentPoint.copy(h),this}copy(t){return super.copy(t),this.currentPoint.copy(t.currentPoint),this}toJSON(){const t=super.toJSON();return t.currentPoint=this.currentPoint.toArray(),t}fromJSON(t){return super.fromJSON(t),this.currentPoint.fromArray(t.currentPoint),this}}class Ue extends pe{constructor(t=[new H(0,-.5),new H(.5,0),new H(0,.5)],e=12,n=0,s=Math.PI*2){super(),this.type="LatheGeometry",this.parameters={points:t,segments:e,phiStart:n,phiLength:s},e=Math.floor(e),s=be(s,0,Math.PI*2);const r=[],o=[],a=[],l=[],c=[],h=1/e,u=new T,d=new H,f=new T,g=new T,v=new T;let m=0,p=0;for(let x=0;x<=t.length-1;x++)switch(x){case 0:m=t[x+1].x-t[x].x,p=t[x+1].y-t[x].y,f.x=p*1,f.y=-m,f.z=p*0,v.copy(f),f.normalize(),l.push(f.x,f.y,f.z);break;case t.length-1:l.push(v.x,v.y,v.z);break;default:m=t[x+1].x-t[x].x,p=t[x+1].y-t[x].y,f.x=p*1,f.y=-m,f.z=p*0,g.copy(f),f.x+=v.x,f.y+=v.y,f.z+=v.z,f.normalize(),l.push(f.x,f.y,f.z),v.copy(g)}for(let x=0;x<=e;x++){const M=n+x*h*s,_=Math.sin(M),I=Math.cos(M);for(let E=0;E<=t.length-1;E++){u.x=t[E].x*_,u.y=t[E].y,u.z=t[E].x*I,o.push(u.x,u.y,u.z),d.x=x/e,d.y=E/(t.length-1),a.push(d.x,d.y);const C=l[3*E+0]*_,P=l[3*E+1],b=l[3*E+0]*I;c.push(C,P,b)}}for(let x=0;x<e;x++)for(let M=0;M<t.length-1;M++){const _=M+x*t.length,I=_,E=_+t.length,C=_+t.length+1,P=_+1;r.push(I,E,P),r.push(C,P,E)}this.setIndex(r),this.setAttribute("position",new jt(o,3)),this.setAttribute("uv",new jt(a,2)),this.setAttribute("normal",new jt(c,3))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ue(t.points,t.segments,t.phiStart,t.phiLength)}}class So extends Ue{constructor(t=1,e=1,n=4,s=8){const r=new ho;r.absarc(0,-e/2,t,Math.PI*1.5,0),r.absarc(0,e/2,t,0,Math.PI*.5),super(r.getPoints(n),s),this.type="CapsuleGeometry",this.parameters={radius:t,length:e,capSegments:n,radialSegments:s}}static fromJSON(t){return new So(t.radius,t.length,t.capSegments,t.radialSegments)}}class Ks extends pe{constructor(t=1,e=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:t,segments:e,thetaStart:n,thetaLength:s},e=Math.max(3,e);const r=[],o=[],a=[],l=[],c=new T,h=new H;o.push(0,0,0),a.push(0,0,1),l.push(.5,.5);for(let u=0,d=3;u<=e;u++,d+=3){const f=n+u/e*s;c.x=t*Math.cos(f),c.y=t*Math.sin(f),o.push(c.x,c.y,c.z),a.push(0,0,1),h.x=(o[d]/t+1)/2,h.y=(o[d+1]/t+1)/2,l.push(h.x,h.y)}for(let u=1;u<=e;u++)r.push(u,u+1,0);this.setIndex(r),this.setAttribute("position",new jt(o,3)),this.setAttribute("normal",new jt(a,3)),this.setAttribute("uv",new jt(l,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Ks(t.radius,t.segments,t.thetaStart,t.thetaLength)}}class ne extends pe{constructor(t=1,e=1,n=1,s=32,r=1,o=!1,a=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:s,heightSegments:r,openEnded:o,thetaStart:a,thetaLength:l};const c=this;s=Math.floor(s),r=Math.floor(r);const h=[],u=[],d=[],f=[];let g=0;const v=[],m=n/2;let p=0;x(),o===!1&&(t>0&&M(!0),e>0&&M(!1)),this.setIndex(h),this.setAttribute("position",new jt(u,3)),this.setAttribute("normal",new jt(d,3)),this.setAttribute("uv",new jt(f,2));function x(){const _=new T,I=new T;let E=0;const C=(e-t)/n;for(let P=0;P<=r;P++){const b=[],y=P/r,R=y*(e-t)+t;for(let O=0;O<=s;O++){const N=O/s,U=N*l+a,F=Math.sin(U),V=Math.cos(U);I.x=R*F,I.y=-y*n+m,I.z=R*V,u.push(I.x,I.y,I.z),_.set(F,C,V).normalize(),d.push(_.x,_.y,_.z),f.push(N,1-y),b.push(g++)}v.push(b)}for(let P=0;P<s;P++)for(let b=0;b<r;b++){const y=v[b][P],R=v[b+1][P],O=v[b+1][P+1],N=v[b][P+1];(t>0||b!==0)&&(h.push(y,R,N),E+=3),(e>0||b!==r-1)&&(h.push(R,O,N),E+=3)}c.addGroup(p,E,0),p+=E}function M(_){const I=g,E=new H,C=new T;let P=0;const b=_===!0?t:e,y=_===!0?1:-1;for(let O=1;O<=s;O++)u.push(0,m*y,0),d.push(0,y,0),f.push(.5,.5),g++;const R=g;for(let O=0;O<=s;O++){const U=O/s*l+a,F=Math.cos(U),V=Math.sin(U);C.x=b*V,C.y=m*y,C.z=b*F,u.push(C.x,C.y,C.z),d.push(0,y,0),E.x=F*.5+.5,E.y=V*.5*y+.5,f.push(E.x,E.y),g++}for(let O=0;O<s;O++){const N=I+O,U=R+O;_===!0?h.push(U,U+1,N):h.push(U+1,U,N),P+=3}c.addGroup(p,P,_===!0?1:2),p+=P}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new ne(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class wo extends pe{constructor(t=[],e=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:s};const r=[],o=[];a(s),c(n),h(),this.setAttribute("position",new jt(r,3)),this.setAttribute("normal",new jt(r.slice(),3)),this.setAttribute("uv",new jt(o,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function a(x){const M=new T,_=new T,I=new T;for(let E=0;E<e.length;E+=3)f(e[E+0],M),f(e[E+1],_),f(e[E+2],I),l(M,_,I,x)}function l(x,M,_,I){const E=I+1,C=[];for(let P=0;P<=E;P++){C[P]=[];const b=x.clone().lerp(_,P/E),y=M.clone().lerp(_,P/E),R=E-P;for(let O=0;O<=R;O++)O===0&&P===E?C[P][O]=b:C[P][O]=b.clone().lerp(y,O/R)}for(let P=0;P<E;P++)for(let b=0;b<2*(E-P)-1;b++){const y=Math.floor(b/2);b%2===0?(d(C[P][y+1]),d(C[P+1][y]),d(C[P][y])):(d(C[P][y+1]),d(C[P+1][y+1]),d(C[P+1][y]))}}function c(x){const M=new T;for(let _=0;_<r.length;_+=3)M.x=r[_+0],M.y=r[_+1],M.z=r[_+2],M.normalize().multiplyScalar(x),r[_+0]=M.x,r[_+1]=M.y,r[_+2]=M.z}function h(){const x=new T;for(let M=0;M<r.length;M+=3){x.x=r[M+0],x.y=r[M+1],x.z=r[M+2];const _=m(x)/2/Math.PI+.5,I=p(x)/Math.PI+.5;o.push(_,1-I)}g(),u()}function u(){for(let x=0;x<o.length;x+=6){const M=o[x+0],_=o[x+2],I=o[x+4],E=Math.max(M,_,I),C=Math.min(M,_,I);E>.9&&C<.1&&(M<.2&&(o[x+0]+=1),_<.2&&(o[x+2]+=1),I<.2&&(o[x+4]+=1))}}function d(x){r.push(x.x,x.y,x.z)}function f(x,M){const _=x*3;M.x=t[_+0],M.y=t[_+1],M.z=t[_+2]}function g(){const x=new T,M=new T,_=new T,I=new T,E=new H,C=new H,P=new H;for(let b=0,y=0;b<r.length;b+=9,y+=6){x.set(r[b+0],r[b+1],r[b+2]),M.set(r[b+3],r[b+4],r[b+5]),_.set(r[b+6],r[b+7],r[b+8]),E.set(o[y+0],o[y+1]),C.set(o[y+2],o[y+3]),P.set(o[y+4],o[y+5]),I.copy(x).add(M).add(_).divideScalar(3);const R=m(I);v(E,y+0,x,R),v(C,y+2,M,R),v(P,y+4,_,R)}}function v(x,M,_,I){I<0&&x.x===1&&(o[M]=x.x-1),_.x===0&&_.z===0&&(o[M]=I/2/Math.PI+.5)}function m(x){return Math.atan2(x.z,-x.x)}function p(x){return Math.atan2(-x.y,Math.sqrt(x.x*x.x+x.z*x.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new wo(t.vertices,t.indices,t.radius,t.details)}}class fs extends ho{constructor(t){super(t),this.uuid=Ti(),this.type="Shape",this.holes=[]}getPointsHoles(t){const e=[];for(let n=0,s=this.holes.length;n<s;n++)e[n]=this.holes[n].getPoints(t);return e}extractPoints(t){return{shape:this.getPoints(t),holes:this.getPointsHoles(t)}}copy(t){super.copy(t),this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const s=t.holes[e];this.holes.push(s.clone())}return this}toJSON(){const t=super.toJSON();t.uuid=this.uuid,t.holes=[];for(let e=0,n=this.holes.length;e<n;e++){const s=this.holes[e];t.holes.push(s.toJSON())}return t}fromJSON(t){super.fromJSON(t),this.uuid=t.uuid,this.holes=[];for(let e=0,n=t.holes.length;e<n;e++){const s=t.holes[e];this.holes.push(new ho().fromJSON(s))}return this}}const $v={triangulate:function(i,t,e=2){const n=t&&t.length,s=n?t[0]*e:i.length;let r=Hu(i,0,s,e,!0);const o=[];if(!r||r.next===r.prev)return o;let a,l,c,h,u,d,f;if(n&&(r=Qv(i,t,r,e)),i.length>80*e){a=c=i[0],l=h=i[1];for(let g=e;g<s;g+=e)u=i[g],d=i[g+1],u<a&&(a=u),d<l&&(l=d),u>c&&(c=u),d>h&&(h=d);f=Math.max(c-a,h-l),f=f!==0?32767/f:0}return Zs(r,o,e,a,l,f,0),o}};function Hu(i,t,e,n,s){let r,o;if(s===h_(i,t,e,n)>0)for(r=t;r<e;r+=n)o=rh(r,i[r],i[r+1],o);else for(r=e-n;r>=t;r-=n)o=rh(r,i[r],i[r+1],o);return o&&Eo(o,o.next)&&(Qs(o),o=o.next),o}function wi(i,t){if(!i)return i;t||(t=i);let e=i,n;do if(n=!1,!e.steiner&&(Eo(e,e.next)||me(e.prev,e,e.next)===0)){if(Qs(e),e=t=e.prev,e===e.next)break;n=!0}else e=e.next;while(n||e!==t);return t}function Zs(i,t,e,n,s,r,o){if(!i)return;!o&&r&&s_(i,n,s,r);let a=i,l,c;for(;i.prev!==i.next;){if(l=i.prev,c=i.next,r?Kv(i,n,s,r):jv(i)){t.push(l.i/e|0),t.push(i.i/e|0),t.push(c.i/e|0),Qs(i),i=c.next,a=c.next;continue}if(i=c,i===a){o?o===1?(i=Zv(wi(i),t,e),Zs(i,t,e,n,s,r,2)):o===2&&Jv(i,t,e,n,s,r):Zs(wi(i),t,e,n,s,r,1);break}}}function jv(i){const t=i.prev,e=i,n=i.next;if(me(t,e,n)>=0)return!1;const s=t.x,r=e.x,o=n.x,a=t.y,l=e.y,c=n.y,h=s<r?s<o?s:o:r<o?r:o,u=a<l?a<c?a:c:l<c?l:c,d=s>r?s>o?s:o:r>o?r:o,f=a>l?a>c?a:c:l>c?l:c;let g=n.next;for(;g!==t;){if(g.x>=h&&g.x<=d&&g.y>=u&&g.y<=f&&Zi(s,a,r,l,o,c,g.x,g.y)&&me(g.prev,g,g.next)>=0)return!1;g=g.next}return!0}function Kv(i,t,e,n){const s=i.prev,r=i,o=i.next;if(me(s,r,o)>=0)return!1;const a=s.x,l=r.x,c=o.x,h=s.y,u=r.y,d=o.y,f=a<l?a<c?a:c:l<c?l:c,g=h<u?h<d?h:d:u<d?u:d,v=a>l?a>c?a:c:l>c?l:c,m=h>u?h>d?h:d:u>d?u:d,p=xl(f,g,t,e,n),x=xl(v,m,t,e,n);let M=i.prevZ,_=i.nextZ;for(;M&&M.z>=p&&_&&_.z<=x;){if(M.x>=f&&M.x<=v&&M.y>=g&&M.y<=m&&M!==s&&M!==o&&Zi(a,h,l,u,c,d,M.x,M.y)&&me(M.prev,M,M.next)>=0||(M=M.prevZ,_.x>=f&&_.x<=v&&_.y>=g&&_.y<=m&&_!==s&&_!==o&&Zi(a,h,l,u,c,d,_.x,_.y)&&me(_.prev,_,_.next)>=0))return!1;_=_.nextZ}for(;M&&M.z>=p;){if(M.x>=f&&M.x<=v&&M.y>=g&&M.y<=m&&M!==s&&M!==o&&Zi(a,h,l,u,c,d,M.x,M.y)&&me(M.prev,M,M.next)>=0)return!1;M=M.prevZ}for(;_&&_.z<=x;){if(_.x>=f&&_.x<=v&&_.y>=g&&_.y<=m&&_!==s&&_!==o&&Zi(a,h,l,u,c,d,_.x,_.y)&&me(_.prev,_,_.next)>=0)return!1;_=_.nextZ}return!0}function Zv(i,t,e){let n=i;do{const s=n.prev,r=n.next.next;!Eo(s,r)&&Vu(s,n,n.next,r)&&Js(s,r)&&Js(r,s)&&(t.push(s.i/e|0),t.push(n.i/e|0),t.push(r.i/e|0),Qs(n),Qs(n.next),n=i=r),n=n.next}while(n!==i);return wi(n)}function Jv(i,t,e,n,s,r){let o=i;do{let a=o.next.next;for(;a!==o.prev;){if(o.i!==a.i&&a_(o,a)){let l=Gu(o,a);o=wi(o,o.next),l=wi(l,l.next),Zs(o,t,e,n,s,r,0),Zs(l,t,e,n,s,r,0);return}a=a.next}o=o.next}while(o!==i)}function Qv(i,t,e,n){const s=[];let r,o,a,l,c;for(r=0,o=t.length;r<o;r++)a=t[r]*n,l=r<o-1?t[r+1]*n:i.length,c=Hu(i,a,l,n,!1),c===c.next&&(c.steiner=!0),s.push(o_(c));for(s.sort(t_),r=0;r<s.length;r++)e=e_(s[r],e);return e}function t_(i,t){return i.x-t.x}function e_(i,t){const e=n_(i,t);if(!e)return t;const n=Gu(e,i);return wi(n,n.next),wi(e,e.next)}function n_(i,t){let e=t,n=-1/0,s;const r=i.x,o=i.y;do{if(o<=e.y&&o>=e.next.y&&e.next.y!==e.y){const d=e.x+(o-e.y)*(e.next.x-e.x)/(e.next.y-e.y);if(d<=r&&d>n&&(n=d,s=e.x<e.next.x?e:e.next,d===r))return s}e=e.next}while(e!==t);if(!s)return null;const a=s,l=s.x,c=s.y;let h=1/0,u;e=s;do r>=e.x&&e.x>=l&&r!==e.x&&Zi(o<c?r:n,o,l,c,o<c?n:r,o,e.x,e.y)&&(u=Math.abs(o-e.y)/(r-e.x),Js(e,i)&&(u<h||u===h&&(e.x>s.x||e.x===s.x&&i_(s,e)))&&(s=e,h=u)),e=e.next;while(e!==a);return s}function i_(i,t){return me(i.prev,i,t.prev)<0&&me(t.next,i,i.next)<0}function s_(i,t,e,n){let s=i;do s.z===0&&(s.z=xl(s.x,s.y,t,e,n)),s.prevZ=s.prev,s.nextZ=s.next,s=s.next;while(s!==i);s.prevZ.nextZ=null,s.prevZ=null,r_(s)}function r_(i){let t,e,n,s,r,o,a,l,c=1;do{for(e=i,i=null,r=null,o=0;e;){for(o++,n=e,a=0,t=0;t<c&&(a++,n=n.nextZ,!!n);t++);for(l=c;a>0||l>0&&n;)a!==0&&(l===0||!n||e.z<=n.z)?(s=e,e=e.nextZ,a--):(s=n,n=n.nextZ,l--),r?r.nextZ=s:i=s,s.prevZ=r,r=s;e=n}r.nextZ=null,c*=2}while(o>1);return i}function xl(i,t,e,n,s){return i=(i-e)*s|0,t=(t-n)*s|0,i=(i|i<<8)&16711935,i=(i|i<<4)&252645135,i=(i|i<<2)&858993459,i=(i|i<<1)&1431655765,t=(t|t<<8)&16711935,t=(t|t<<4)&252645135,t=(t|t<<2)&858993459,t=(t|t<<1)&1431655765,i|t<<1}function o_(i){let t=i,e=i;do(t.x<e.x||t.x===e.x&&t.y<e.y)&&(e=t),t=t.next;while(t!==i);return e}function Zi(i,t,e,n,s,r,o,a){return(s-o)*(t-a)>=(i-o)*(r-a)&&(i-o)*(n-a)>=(e-o)*(t-a)&&(e-o)*(r-a)>=(s-o)*(n-a)}function a_(i,t){return i.next.i!==t.i&&i.prev.i!==t.i&&!l_(i,t)&&(Js(i,t)&&Js(t,i)&&c_(i,t)&&(me(i.prev,i,t.prev)||me(i,t.prev,t))||Eo(i,t)&&me(i.prev,i,i.next)>0&&me(t.prev,t,t.next)>0)}function me(i,t,e){return(t.y-i.y)*(e.x-t.x)-(t.x-i.x)*(e.y-t.y)}function Eo(i,t){return i.x===t.x&&i.y===t.y}function Vu(i,t,e,n){const s=kr(me(i,t,e)),r=kr(me(i,t,n)),o=kr(me(e,n,i)),a=kr(me(e,n,t));return!!(s!==r&&o!==a||s===0&&Br(i,e,t)||r===0&&Br(i,n,t)||o===0&&Br(e,i,n)||a===0&&Br(e,t,n))}function Br(i,t,e){return t.x<=Math.max(i.x,e.x)&&t.x>=Math.min(i.x,e.x)&&t.y<=Math.max(i.y,e.y)&&t.y>=Math.min(i.y,e.y)}function kr(i){return i>0?1:i<0?-1:0}function l_(i,t){let e=i;do{if(e.i!==i.i&&e.next.i!==i.i&&e.i!==t.i&&e.next.i!==t.i&&Vu(e,e.next,i,t))return!0;e=e.next}while(e!==i);return!1}function Js(i,t){return me(i.prev,i,i.next)<0?me(i,t,i.next)>=0&&me(i,i.prev,t)>=0:me(i,t,i.prev)<0||me(i,i.next,t)<0}function c_(i,t){let e=i,n=!1;const s=(i.x+t.x)/2,r=(i.y+t.y)/2;do e.y>r!=e.next.y>r&&e.next.y!==e.y&&s<(e.next.x-e.x)*(r-e.y)/(e.next.y-e.y)+e.x&&(n=!n),e=e.next;while(e!==i);return n}function Gu(i,t){const e=new yl(i.i,i.x,i.y),n=new yl(t.i,t.x,t.y),s=i.next,r=t.prev;return i.next=t,t.prev=i,e.next=s,s.prev=e,n.next=e,e.prev=n,r.next=n,n.prev=r,n}function rh(i,t,e,n){const s=new yl(i,t,e);return n?(s.next=n.next,s.prev=n,n.next.prev=s,n.next=s):(s.prev=s,s.next=s),s}function Qs(i){i.next.prev=i.prev,i.prev.next=i.next,i.prevZ&&(i.prevZ.nextZ=i.nextZ),i.nextZ&&(i.nextZ.prevZ=i.prevZ)}function yl(i,t,e){this.i=i,this.x=t,this.y=e,this.prev=null,this.next=null,this.z=0,this.prevZ=null,this.nextZ=null,this.steiner=!1}function h_(i,t,e,n){let s=0;for(let r=t,o=e-n;r<e;r+=n)s+=(i[o]-i[r])*(i[r+1]+i[o+1]),o=r;return s}class ks{static area(t){const e=t.length;let n=0;for(let s=e-1,r=0;r<e;s=r++)n+=t[s].x*t[r].y-t[r].x*t[s].y;return n*.5}static isClockWise(t){return ks.area(t)<0}static triangulateShape(t,e){const n=[],s=[],r=[];oh(t),ah(n,t);let o=t.length;e.forEach(oh);for(let l=0;l<e.length;l++)s.push(o),o+=e[l].length,ah(n,e[l]);const a=$v.triangulate(n,s);for(let l=0;l<a.length;l+=3)r.push(a.slice(l,l+3));return r}}function oh(i){const t=i.length;t>2&&i[t-1].equals(i[0])&&i.pop()}function ah(i,t){for(let e=0;e<t.length;e++)i.push(t[e].x),i.push(t[e].y)}class Ci extends pe{constructor(t=new fs([new H(.5,.5),new H(-.5,.5),new H(-.5,-.5),new H(.5,-.5)]),e={}){super(),this.type="ExtrudeGeometry",this.parameters={shapes:t,options:e},t=Array.isArray(t)?t:[t];const n=this,s=[],r=[];for(let a=0,l=t.length;a<l;a++){const c=t[a];o(c)}this.setAttribute("position",new jt(s,3)),this.setAttribute("uv",new jt(r,2)),this.computeVertexNormals();function o(a){const l=[],c=e.curveSegments!==void 0?e.curveSegments:12,h=e.steps!==void 0?e.steps:1,u=e.depth!==void 0?e.depth:1;let d=e.bevelEnabled!==void 0?e.bevelEnabled:!0,f=e.bevelThickness!==void 0?e.bevelThickness:.2,g=e.bevelSize!==void 0?e.bevelSize:f-.1,v=e.bevelOffset!==void 0?e.bevelOffset:0,m=e.bevelSegments!==void 0?e.bevelSegments:3;const p=e.extrudePath,x=e.UVGenerator!==void 0?e.UVGenerator:u_;let M,_=!1,I,E,C,P;p&&(M=p.getSpacedPoints(h),_=!0,d=!1,I=p.computeFrenetFrames(h,!1),E=new T,C=new T,P=new T),d||(m=0,f=0,g=0,v=0);const b=a.extractPoints(c);let y=b.shape;const R=b.holes;if(!ks.isClockWise(y)){y=y.reverse();for(let j=0,it=R.length;j<it;j++){const L=R[j];ks.isClockWise(L)&&(R[j]=L.reverse())}}const N=ks.triangulateShape(y,R),U=y;for(let j=0,it=R.length;j<it;j++){const L=R[j];y=y.concat(L)}function F(j,it,L){return it||console.error("THREE.ExtrudeGeometry: vec does not exist"),j.clone().addScaledVector(it,L)}const V=y.length,K=N.length;function q(j,it,L){let At,at,wt;const ct=j.x-it.x,Bt=j.y-it.y,pt=L.x-j.x,A=L.y-j.y,S=ct*ct+Bt*Bt,W=ct*A-Bt*pt;if(Math.abs(W)>Number.EPSILON){const Z=Math.sqrt(S),rt=Math.sqrt(pt*pt+A*A),nt=it.x-Bt/Z,It=it.y+ct/Z,vt=L.x-A/rt,Tt=L.y+pt/rt,Kt=((vt-nt)*A-(Tt-It)*pt)/(ct*A-Bt*pt);At=nt+ct*Kt-j.x,at=It+Bt*Kt-j.y;const ht=At*At+at*at;if(ht<=2)return new H(At,at);wt=Math.sqrt(ht/2)}else{let Z=!1;ct>Number.EPSILON?pt>Number.EPSILON&&(Z=!0):ct<-Number.EPSILON?pt<-Number.EPSILON&&(Z=!0):Math.sign(Bt)===Math.sign(A)&&(Z=!0),Z?(At=-Bt,at=ct,wt=Math.sqrt(S)):(At=ct,at=Bt,wt=Math.sqrt(S/2))}return new H(At/wt,at/wt)}const D=[];for(let j=0,it=U.length,L=it-1,At=j+1;j<it;j++,L++,At++)L===it&&(L=0),At===it&&(At=0),D[j]=q(U[j],U[L],U[At]);const G=[];let et,dt=D.concat();for(let j=0,it=R.length;j<it;j++){const L=R[j];et=[];for(let At=0,at=L.length,wt=at-1,ct=At+1;At<at;At++,wt++,ct++)wt===at&&(wt=0),ct===at&&(ct=0),et[At]=q(L[At],L[wt],L[ct]);G.push(et),dt=dt.concat(et)}for(let j=0;j<m;j++){const it=j/m,L=f*Math.cos(it*Math.PI/2),At=g*Math.sin(it*Math.PI/2)+v;for(let at=0,wt=U.length;at<wt;at++){const ct=F(U[at],D[at],At);lt(ct.x,ct.y,-L)}for(let at=0,wt=R.length;at<wt;at++){const ct=R[at];et=G[at];for(let Bt=0,pt=ct.length;Bt<pt;Bt++){const A=F(ct[Bt],et[Bt],At);lt(A.x,A.y,-L)}}}const Ht=g+v;for(let j=0;j<V;j++){const it=d?F(y[j],dt[j],Ht):y[j];_?(C.copy(I.normals[0]).multiplyScalar(it.x),E.copy(I.binormals[0]).multiplyScalar(it.y),P.copy(M[0]).add(C).add(E),lt(P.x,P.y,P.z)):lt(it.x,it.y,0)}for(let j=1;j<=h;j++)for(let it=0;it<V;it++){const L=d?F(y[it],dt[it],Ht):y[it];_?(C.copy(I.normals[j]).multiplyScalar(L.x),E.copy(I.binormals[j]).multiplyScalar(L.y),P.copy(M[j]).add(C).add(E),lt(P.x,P.y,P.z)):lt(L.x,L.y,u/h*j)}for(let j=m-1;j>=0;j--){const it=j/m,L=f*Math.cos(it*Math.PI/2),At=g*Math.sin(it*Math.PI/2)+v;for(let at=0,wt=U.length;at<wt;at++){const ct=F(U[at],D[at],At);lt(ct.x,ct.y,u+L)}for(let at=0,wt=R.length;at<wt;at++){const ct=R[at];et=G[at];for(let Bt=0,pt=ct.length;Bt<pt;Bt++){const A=F(ct[Bt],et[Bt],At);_?lt(A.x,A.y+M[h-1].y,M[h-1].x+L):lt(A.x,A.y,u+L)}}}Q(),ot();function Q(){const j=s.length/3;if(d){let it=0,L=V*it;for(let At=0;At<K;At++){const at=N[At];Pt(at[2]+L,at[1]+L,at[0]+L)}it=h+m*2,L=V*it;for(let At=0;At<K;At++){const at=N[At];Pt(at[0]+L,at[1]+L,at[2]+L)}}else{for(let it=0;it<K;it++){const L=N[it];Pt(L[2],L[1],L[0])}for(let it=0;it<K;it++){const L=N[it];Pt(L[0]+V*h,L[1]+V*h,L[2]+V*h)}}n.addGroup(j,s.length/3-j,0)}function ot(){const j=s.length/3;let it=0;mt(U,it),it+=U.length;for(let L=0,At=R.length;L<At;L++){const at=R[L];mt(at,it),it+=at.length}n.addGroup(j,s.length/3-j,1)}function mt(j,it){let L=j.length;for(;--L>=0;){const At=L;let at=L-1;at<0&&(at=j.length-1);for(let wt=0,ct=h+m*2;wt<ct;wt++){const Bt=V*wt,pt=V*(wt+1),A=it+At+Bt,S=it+at+Bt,W=it+at+pt,Z=it+At+pt;Ft(A,S,W,Z)}}}function lt(j,it,L){l.push(j),l.push(it),l.push(L)}function Pt(j,it,L){ft(j),ft(it),ft(L);const At=s.length/3,at=x.generateTopUV(n,s,At-3,At-2,At-1);bt(at[0]),bt(at[1]),bt(at[2])}function Ft(j,it,L,At){ft(j),ft(it),ft(At),ft(it),ft(L),ft(At);const at=s.length/3,wt=x.generateSideWallUV(n,s,at-6,at-3,at-2,at-1);bt(wt[0]),bt(wt[1]),bt(wt[3]),bt(wt[1]),bt(wt[2]),bt(wt[3])}function ft(j){s.push(l[j*3+0]),s.push(l[j*3+1]),s.push(l[j*3+2])}function bt(j){r.push(j.x),r.push(j.y)}}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON(),e=this.parameters.shapes,n=this.parameters.options;return d_(e,n,t)}static fromJSON(t,e){const n=[];for(let r=0,o=t.shapes.length;r<o;r++){const a=e[t.shapes[r]];n.push(a)}const s=t.options.extrudePath;return s!==void 0&&(t.options.extrudePath=new co[s.type]().fromJSON(s)),new Ci(n,t.options)}}const u_={generateTopUV:function(i,t,e,n,s){const r=t[e*3],o=t[e*3+1],a=t[n*3],l=t[n*3+1],c=t[s*3],h=t[s*3+1];return[new H(r,o),new H(a,l),new H(c,h)]},generateSideWallUV:function(i,t,e,n,s,r){const o=t[e*3],a=t[e*3+1],l=t[e*3+2],c=t[n*3],h=t[n*3+1],u=t[n*3+2],d=t[s*3],f=t[s*3+1],g=t[s*3+2],v=t[r*3],m=t[r*3+1],p=t[r*3+2];return Math.abs(a-h)<Math.abs(o-c)?[new H(o,1-l),new H(c,1-u),new H(d,1-g),new H(v,1-p)]:[new H(a,1-l),new H(h,1-u),new H(f,1-g),new H(m,1-p)]}};function d_(i,t,e){if(e.shapes=[],Array.isArray(i))for(let n=0,s=i.length;n<s;n++){const r=i[n];e.shapes.push(r.uuid)}else e.shapes.push(i.uuid);return e.options=Object.assign({},t),t.extrudePath!==void 0&&(e.options.extrudePath=t.extrudePath.toJSON()),e}class rr extends wo{constructor(t=1,e=0){const n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],r=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,r,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new rr(t.radius,t.detail)}}class Vl extends wo{constructor(t=1,e=0){const n=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1],s=[0,2,4,0,4,3,0,3,5,0,5,2,1,2,5,1,5,3,1,3,4,1,4,2];super(n,s,t,e),this.type="OctahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new Vl(t.radius,t.detail)}}class or extends pe{constructor(t=1,e=32,n=16,s=0,r=Math.PI*2,o=0,a=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:s,phiLength:r,thetaStart:o,thetaLength:a},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const l=Math.min(o+a,Math.PI);let c=0;const h=[],u=new T,d=new T,f=[],g=[],v=[],m=[];for(let p=0;p<=n;p++){const x=[],M=p/n;let _=0;p===0&&o===0?_=.5/e:p===n&&l===Math.PI&&(_=-.5/e);for(let I=0;I<=e;I++){const E=I/e;u.x=-t*Math.cos(s+E*r)*Math.sin(o+M*a),u.y=t*Math.cos(o+M*a),u.z=t*Math.sin(s+E*r)*Math.sin(o+M*a),g.push(u.x,u.y,u.z),d.copy(u).normalize(),v.push(d.x,d.y,d.z),m.push(E+_,1-M),x.push(c++)}h.push(x)}for(let p=0;p<n;p++)for(let x=0;x<e;x++){const M=h[p][x+1],_=h[p][x],I=h[p+1][x],E=h[p+1][x+1];(p!==0||o>0)&&f.push(M,_,E),(p!==n-1||l<Math.PI)&&f.push(_,I,E)}this.setIndex(f),this.setAttribute("position",new jt(g,3)),this.setAttribute("normal",new jt(v,3)),this.setAttribute("uv",new jt(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new or(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class To extends pe{constructor(t=1,e=.4,n=12,s=48,r=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:s,arc:r},n=Math.floor(n),s=Math.floor(s);const o=[],a=[],l=[],c=[],h=new T,u=new T,d=new T;for(let f=0;f<=n;f++)for(let g=0;g<=s;g++){const v=g/s*r,m=f/n*Math.PI*2;u.x=(t+e*Math.cos(m))*Math.cos(v),u.y=(t+e*Math.cos(m))*Math.sin(v),u.z=e*Math.sin(m),a.push(u.x,u.y,u.z),h.x=t*Math.cos(v),h.y=t*Math.sin(v),d.subVectors(u,h).normalize(),l.push(d.x,d.y,d.z),c.push(g/s),c.push(f/n)}for(let f=1;f<=n;f++)for(let g=1;g<=s;g++){const v=(s+1)*f+g-1,m=(s+1)*(f-1)+g-1,p=(s+1)*(f-1)+g,x=(s+1)*f+g;o.push(v,m,x),o.push(m,p,x)}this.setIndex(o),this.setAttribute("position",new jt(a,3)),this.setAttribute("normal",new jt(l,3)),this.setAttribute("uv",new jt(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new To(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class ar extends pe{constructor(t=new ku(new T(-1,-1,0),new T(-1,1,0),new T(1,1,0)),e=64,n=1,s=8,r=!1){super(),this.type="TubeGeometry",this.parameters={path:t,tubularSegments:e,radius:n,radialSegments:s,closed:r};const o=t.computeFrenetFrames(e,r);this.tangents=o.tangents,this.normals=o.normals,this.binormals=o.binormals;const a=new T,l=new T,c=new H;let h=new T;const u=[],d=[],f=[],g=[];v(),this.setIndex(g),this.setAttribute("position",new jt(u,3)),this.setAttribute("normal",new jt(d,3)),this.setAttribute("uv",new jt(f,2));function v(){for(let M=0;M<e;M++)m(M);m(r===!1?e:0),x(),p()}function m(M){h=t.getPointAt(M/e,h);const _=o.normals[M],I=o.binormals[M];for(let E=0;E<=s;E++){const C=E/s*Math.PI*2,P=Math.sin(C),b=-Math.cos(C);l.x=b*_.x+P*I.x,l.y=b*_.y+P*I.y,l.z=b*_.z+P*I.z,l.normalize(),d.push(l.x,l.y,l.z),a.x=h.x+n*l.x,a.y=h.y+n*l.y,a.z=h.z+n*l.z,u.push(a.x,a.y,a.z)}}function p(){for(let M=1;M<=e;M++)for(let _=1;_<=s;_++){const I=(s+1)*(M-1)+(_-1),E=(s+1)*M+(_-1),C=(s+1)*M+_,P=(s+1)*(M-1)+_;g.push(I,E,P),g.push(E,C,P)}}function x(){for(let M=0;M<=e;M++)for(let _=0;_<=s;_++)c.x=M/e,c.y=_/s,f.push(c.x,c.y)}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}toJSON(){const t=super.toJSON();return t.path=this.parameters.path.toJSON(),t}static fromJSON(t){return new ar(new co[t.path.type]().fromJSON(t.path),t.tubularSegments,t.radius,t.radialSegments,t.closed)}}class Mt extends us{static get type(){return"MeshStandardMaterial"}constructor(t){super(),this.isMeshStandardMaterial=!0,this.defines={STANDARD:""},this.color=new Et(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Et(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=vu,this.normalScale=new H(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new ln,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.defines={STANDARD:""},this.color.copy(t.color),this.roughness=t.roughness,this.metalness=t.metalness,this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.roughnessMap=t.roughnessMap,this.metalnessMap=t.metalnessMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.envMapIntensity=t.envMapIntensity,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class sn extends Mt{static get type(){return"MeshPhysicalMaterial"}constructor(t){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:"",PHYSICAL:""},this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new H(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return be(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new Et(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new Et(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new Et(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(t)}get anisotropy(){return this._anisotropy}set anisotropy(t){this._anisotropy>0!=t>0&&this.version++,this._anisotropy=t}get clearcoat(){return this._clearcoat}set clearcoat(t){this._clearcoat>0!=t>0&&this.version++,this._clearcoat=t}get iridescence(){return this._iridescence}set iridescence(t){this._iridescence>0!=t>0&&this.version++,this._iridescence=t}get dispersion(){return this._dispersion}set dispersion(t){this._dispersion>0!=t>0&&this.version++,this._dispersion=t}get sheen(){return this._sheen}set sheen(t){this._sheen>0!=t>0&&this.version++,this._sheen=t}get transmission(){return this._transmission}set transmission(t){this._transmission>0!=t>0&&this.version++,this._transmission=t}copy(t){return super.copy(t),this.defines={STANDARD:"",PHYSICAL:""},this.anisotropy=t.anisotropy,this.anisotropyRotation=t.anisotropyRotation,this.anisotropyMap=t.anisotropyMap,this.clearcoat=t.clearcoat,this.clearcoatMap=t.clearcoatMap,this.clearcoatRoughness=t.clearcoatRoughness,this.clearcoatRoughnessMap=t.clearcoatRoughnessMap,this.clearcoatNormalMap=t.clearcoatNormalMap,this.clearcoatNormalScale.copy(t.clearcoatNormalScale),this.dispersion=t.dispersion,this.ior=t.ior,this.iridescence=t.iridescence,this.iridescenceMap=t.iridescenceMap,this.iridescenceIOR=t.iridescenceIOR,this.iridescenceThicknessRange=[...t.iridescenceThicknessRange],this.iridescenceThicknessMap=t.iridescenceThicknessMap,this.sheen=t.sheen,this.sheenColor.copy(t.sheenColor),this.sheenColorMap=t.sheenColorMap,this.sheenRoughness=t.sheenRoughness,this.sheenRoughnessMap=t.sheenRoughnessMap,this.transmission=t.transmission,this.transmissionMap=t.transmissionMap,this.thickness=t.thickness,this.thicknessMap=t.thicknessMap,this.attenuationDistance=t.attenuationDistance,this.attenuationColor.copy(t.attenuationColor),this.specularIntensity=t.specularIntensity,this.specularIntensityMap=t.specularIntensityMap,this.specularColor.copy(t.specularColor),this.specularColorMap=t.specularColorMap,this}}class Gl extends Pe{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new Et(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}class f_ extends Gl{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Pe.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Et(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const ca=new Jt,lh=new T,ch=new T;class Wu{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new H(512,512),this.map=null,this.mapPass=null,this.matrix=new Jt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Bl,this._frameExtents=new H(1,1),this._viewportCount=1,this._viewports=[new ie(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;lh.setFromMatrixPosition(t.matrixWorld),e.position.copy(lh),ch.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(ch),e.updateMatrixWorld(),ca.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ca),n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(ca)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}const hh=new Jt,Ss=new T,ha=new T;class p_ extends Wu{constructor(){super(new tn(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new H(4,2),this._viewportCount=6,this._viewports=[new ie(2,1,1,1),new ie(0,1,1,1),new ie(3,1,1,1),new ie(1,1,1,1),new ie(3,0,1,1),new ie(1,0,1,1)],this._cubeDirections=[new T(1,0,0),new T(-1,0,0),new T(0,0,1),new T(0,0,-1),new T(0,1,0),new T(0,-1,0)],this._cubeUps=[new T(0,1,0),new T(0,1,0),new T(0,1,0),new T(0,1,0),new T(0,0,1),new T(0,0,-1)]}updateMatrices(t,e=0){const n=this.camera,s=this.matrix,r=t.distance||n.far;r!==n.far&&(n.far=r,n.updateProjectionMatrix()),Ss.setFromMatrixPosition(t.matrixWorld),n.position.copy(Ss),ha.copy(n.position),ha.add(this._cubeDirections[e]),n.up.copy(this._cubeUps[e]),n.lookAt(ha),n.updateMatrixWorld(),s.makeTranslation(-Ss.x,-Ss.y,-Ss.z),hh.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(hh)}}class qu extends Gl{constructor(t,e,n=0,s=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new p_}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}}class m_ extends Wu{constructor(){super(new Ru(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class ua extends Gl{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Pe.DEFAULT_UP),this.updateMatrix(),this.target=new Pe,this.shadow=new m_}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}const uh=new Jt;class g_{constructor(t,e,n=0,s=1/0){this.ray=new Mo(t,e),this.near=n,this.far=s,this.camera=null,this.layers=new Fl,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):console.error("THREE.Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return uh.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(uh),this}intersectObject(t,e=!0,n=[]){return bl(t,this,n,e),n.sort(dh),n}intersectObjects(t,e=!0,n=[]){for(let s=0,r=t.length;s<r;s++)bl(t[s],this,n,e);return n.sort(dh),n}}function dh(i,t){return i.distance-t.distance}function bl(i,t,e,n){let s=!0;if(i.layers.test(t.layers)&&i.raycast(t,e)===!1&&(s=!1),s===!0&&n===!0){const r=i.children;for(let o=0,a=r.length;o<a;o++)bl(r[o],t,e,!0)}}class fh{constructor(t=1,e=0,n=0){return this.radius=t,this.phi=e,this.theta=n,this}set(t,e,n){return this.radius=t,this.phi=e,this.theta=n,this}copy(t){return this.radius=t.radius,this.phi=t.phi,this.theta=t.theta,this}makeSafe(){return this.phi=Math.max(1e-6,Math.min(Math.PI-1e-6,this.phi)),this}setFromVector3(t){return this.setFromCartesianCoords(t.x,t.y,t.z)}setFromCartesianCoords(t,e,n){return this.radius=Math.sqrt(t*t+e*e+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(t,n),this.phi=Math.acos(be(e/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}}class v_ extends Ei{constructor(t,e=null){super(),this.object=t,this.domElement=e,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(){}disconnect(){}dispose(){}update(){}}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:Al}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=Al);const ph={type:"change"},Wl={type:"start"},Yu={type:"end"},zr=new Mo,mh=new Kn,__=Math.cos(70*Ol.DEG2RAD),Se=new T,$e=2*Math.PI,le={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},da=1e-6;class M_ extends v_{constructor(t,e=null){super(t,e),this.state=le.NONE,this.enabled=!0,this.target=new T,this.cursor=new T,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Ji.ROTATE,MIDDLE:Ji.DOLLY,RIGHT:Ji.PAN},this.touches={ONE:ji.ROTATE,TWO:ji.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new T,this._lastQuaternion=new Me,this._lastTargetPosition=new T,this._quat=new Me().setFromUnitVectors(t.up,new T(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new fh,this._sphericalDelta=new fh,this._scale=1,this._panOffset=new T,this._rotateStart=new H,this._rotateEnd=new H,this._rotateDelta=new H,this._panStart=new H,this._panEnd=new H,this._panDelta=new H,this._dollyStart=new H,this._dollyEnd=new H,this._dollyDelta=new H,this._dollyDirection=new T,this._mouse=new H,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=y_.bind(this),this._onPointerDown=x_.bind(this),this._onPointerUp=b_.bind(this),this._onContextMenu=R_.bind(this),this._onMouseWheel=E_.bind(this),this._onKeyDown=T_.bind(this),this._onTouchStart=A_.bind(this),this._onTouchMove=C_.bind(this),this._onMouseDown=S_.bind(this),this._onMouseMove=w_.bind(this),this._interceptControlDown=P_.bind(this),this._interceptControlUp=L_.bind(this),this.domElement!==null&&this.connect(),this.update()}connect(){this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(t){t.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=t}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(ph),this.update(),this.state=le.NONE}update(t=null){const e=this.object.position;Se.copy(e).sub(this.target),Se.applyQuaternion(this._quat),this._spherical.setFromVector3(Se),this.autoRotate&&this.state===le.NONE&&this._rotateLeft(this._getAutoRotationAngle(t)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,s=this.maxAzimuthAngle;isFinite(n)&&isFinite(s)&&(n<-Math.PI?n+=$e:n>Math.PI&&(n-=$e),s<-Math.PI?s+=$e:s>Math.PI&&(s-=$e),n<=s?this._spherical.theta=Math.max(n,Math.min(s,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+s)/2?Math.max(n,this._spherical.theta):Math.min(s,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let r=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),r=o!=this._spherical.radius}if(Se.setFromSpherical(this._spherical),Se.applyQuaternion(this._quatInverse),e.copy(this.target).add(Se),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){const a=Se.length();o=this._clampDistance(a*this._scale);const l=a-o;this.object.position.addScaledVector(this._dollyDirection,l),this.object.updateMatrixWorld(),r=!!l}else if(this.object.isOrthographicCamera){const a=new T(this._mouse.x,this._mouse.y,0);a.unproject(this.object);const l=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),r=l!==this.object.zoom;const c=new T(this._mouse.x,this._mouse.y,0);c.unproject(this.object),this.object.position.sub(c).add(a),this.object.updateMatrixWorld(),o=Se.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(zr.origin.copy(this.object.position),zr.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(zr.direction))<__?this.object.lookAt(this.target):(mh.setFromNormalAndCoplanarPoint(this.object.up,this.target),zr.intersectPlane(mh,this.target))))}else if(this.object.isOrthographicCamera){const o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),r=!0)}return this._scale=1,this._performCursorZoom=!1,r||this._lastPosition.distanceToSquared(this.object.position)>da||8*(1-this._lastQuaternion.dot(this.object.quaternion))>da||this._lastTargetPosition.distanceToSquared(this.target)>da?(this.dispatchEvent(ph),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(t){return t!==null?$e/60*this.autoRotateSpeed*t:$e/60/60*this.autoRotateSpeed}_getZoomScale(t){const e=Math.abs(t*.01);return Math.pow(.95,this.zoomSpeed*e)}_rotateLeft(t){this._sphericalDelta.theta-=t}_rotateUp(t){this._sphericalDelta.phi-=t}_panLeft(t,e){Se.setFromMatrixColumn(e,0),Se.multiplyScalar(-t),this._panOffset.add(Se)}_panUp(t,e){this.screenSpacePanning===!0?Se.setFromMatrixColumn(e,1):(Se.setFromMatrixColumn(e,0),Se.crossVectors(this.object.up,Se)),Se.multiplyScalar(t),this._panOffset.add(Se)}_pan(t,e){const n=this.domElement;if(this.object.isPerspectiveCamera){const s=this.object.position;Se.copy(s).sub(this.target);let r=Se.length();r*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*t*r/n.clientHeight,this.object.matrix),this._panUp(2*e*r/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(t*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(e*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(t,e){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const n=this.domElement.getBoundingClientRect(),s=t-n.left,r=e-n.top,o=n.width,a=n.height;this._mouse.x=s/o*2-1,this._mouse.y=-(r/a)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(t){return Math.max(this.minDistance,Math.min(this.maxDistance,t))}_handleMouseDownRotate(t){this._rotateStart.set(t.clientX,t.clientY)}_handleMouseDownDolly(t){this._updateZoomParameters(t.clientX,t.clientX),this._dollyStart.set(t.clientX,t.clientY)}_handleMouseDownPan(t){this._panStart.set(t.clientX,t.clientY)}_handleMouseMoveRotate(t){this._rotateEnd.set(t.clientX,t.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const e=this.domElement;this._rotateLeft($e*this._rotateDelta.x/e.clientHeight),this._rotateUp($e*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(t){this._dollyEnd.set(t.clientX,t.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(t){this._panEnd.set(t.clientX,t.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(t){this._updateZoomParameters(t.clientX,t.clientY),t.deltaY<0?this._dollyIn(this._getZoomScale(t.deltaY)):t.deltaY>0&&this._dollyOut(this._getZoomScale(t.deltaY)),this.update()}_handleKeyDown(t){let e=!1;switch(t.code){case this.keys.UP:t.ctrlKey||t.metaKey||t.shiftKey?this._rotateUp($e*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,this.keyPanSpeed),e=!0;break;case this.keys.BOTTOM:t.ctrlKey||t.metaKey||t.shiftKey?this._rotateUp(-$e*this.rotateSpeed/this.domElement.clientHeight):this._pan(0,-this.keyPanSpeed),e=!0;break;case this.keys.LEFT:t.ctrlKey||t.metaKey||t.shiftKey?this._rotateLeft($e*this.rotateSpeed/this.domElement.clientHeight):this._pan(this.keyPanSpeed,0),e=!0;break;case this.keys.RIGHT:t.ctrlKey||t.metaKey||t.shiftKey?this._rotateLeft(-$e*this.rotateSpeed/this.domElement.clientHeight):this._pan(-this.keyPanSpeed,0),e=!0;break}e&&(t.preventDefault(),this.update())}_handleTouchStartRotate(t){if(this._pointers.length===1)this._rotateStart.set(t.pageX,t.pageY);else{const e=this._getSecondPointerPosition(t),n=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._rotateStart.set(n,s)}}_handleTouchStartPan(t){if(this._pointers.length===1)this._panStart.set(t.pageX,t.pageY);else{const e=this._getSecondPointerPosition(t),n=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._panStart.set(n,s)}}_handleTouchStartDolly(t){const e=this._getSecondPointerPosition(t),n=t.pageX-e.x,s=t.pageY-e.y,r=Math.sqrt(n*n+s*s);this._dollyStart.set(0,r)}_handleTouchStartDollyPan(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enablePan&&this._handleTouchStartPan(t)}_handleTouchStartDollyRotate(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enableRotate&&this._handleTouchStartRotate(t)}_handleTouchMoveRotate(t){if(this._pointers.length==1)this._rotateEnd.set(t.pageX,t.pageY);else{const n=this._getSecondPointerPosition(t),s=.5*(t.pageX+n.x),r=.5*(t.pageY+n.y);this._rotateEnd.set(s,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const e=this.domElement;this._rotateLeft($e*this._rotateDelta.x/e.clientHeight),this._rotateUp($e*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(t){if(this._pointers.length===1)this._panEnd.set(t.pageX,t.pageY);else{const e=this._getSecondPointerPosition(t),n=.5*(t.pageX+e.x),s=.5*(t.pageY+e.y);this._panEnd.set(n,s)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(t){const e=this._getSecondPointerPosition(t),n=t.pageX-e.x,s=t.pageY-e.y,r=Math.sqrt(n*n+s*s);this._dollyEnd.set(0,r),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const o=(t.pageX+e.x)*.5,a=(t.pageY+e.y)*.5;this._updateZoomParameters(o,a)}_handleTouchMoveDollyPan(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enablePan&&this._handleTouchMovePan(t)}_handleTouchMoveDollyRotate(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enableRotate&&this._handleTouchMoveRotate(t)}_addPointer(t){this._pointers.push(t.pointerId)}_removePointer(t){delete this._pointerPositions[t.pointerId];for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId){this._pointers.splice(e,1);return}}_isTrackingPointer(t){for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId)return!0;return!1}_trackPointer(t){let e=this._pointerPositions[t.pointerId];e===void 0&&(e=new H,this._pointerPositions[t.pointerId]=e),e.set(t.pageX,t.pageY)}_getSecondPointerPosition(t){const e=t.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[e]}_customWheelEvent(t){const e=t.deltaMode,n={clientX:t.clientX,clientY:t.clientY,deltaY:t.deltaY};switch(e){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return t.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}}function x_(i){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(i.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(i)&&(this._addPointer(i),i.pointerType==="touch"?this._onTouchStart(i):this._onMouseDown(i)))}function y_(i){this.enabled!==!1&&(i.pointerType==="touch"?this._onTouchMove(i):this._onMouseMove(i))}function b_(i){switch(this._removePointer(i),this._pointers.length){case 0:this.domElement.releasePointerCapture(i.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Yu),this.state=le.NONE;break;case 1:const t=this._pointers[0],e=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:e.x,pageY:e.y});break}}function S_(i){let t;switch(i.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case Ji.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(i),this.state=le.DOLLY;break;case Ji.ROTATE:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=le.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=le.ROTATE}break;case Ji.PAN:if(i.ctrlKey||i.metaKey||i.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(i),this.state=le.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(i),this.state=le.PAN}break;default:this.state=le.NONE}this.state!==le.NONE&&this.dispatchEvent(Wl)}function w_(i){switch(this.state){case le.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(i);break;case le.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(i);break;case le.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(i);break}}function E_(i){this.enabled===!1||this.enableZoom===!1||this.state!==le.NONE||(i.preventDefault(),this.dispatchEvent(Wl),this._handleMouseWheel(this._customWheelEvent(i)),this.dispatchEvent(Yu))}function T_(i){this.enabled===!1||this.enablePan===!1||this._handleKeyDown(i)}function A_(i){switch(this._trackPointer(i),this._pointers.length){case 1:switch(this.touches.ONE){case ji.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(i),this.state=le.TOUCH_ROTATE;break;case ji.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(i),this.state=le.TOUCH_PAN;break;default:this.state=le.NONE}break;case 2:switch(this.touches.TWO){case ji.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(i),this.state=le.TOUCH_DOLLY_PAN;break;case ji.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(i),this.state=le.TOUCH_DOLLY_ROTATE;break;default:this.state=le.NONE}break;default:this.state=le.NONE}this.state!==le.NONE&&this.dispatchEvent(Wl)}function C_(i){switch(this._trackPointer(i),this.state){case le.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(i),this.update();break;case le.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(i),this.update();break;case le.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(i),this.update();break;case le.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(i),this.update();break;default:this.state=le.NONE}}function R_(i){this.enabled!==!1&&i.preventDefault()}function P_(i){i.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function L_(i){i.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}const Ao=.03;function lr(i,t,e,n,s,r){const o=[];for(let a=0;a<=r;a++){const l=n+(s-n)*a/r;o.push(new H(i+Math.cos(l)*e,t+Math.sin(l)*e))}return o}function I_(i,t){const e=[];for(let n=0;n<i.length;n++){const s=i[Math.max(0,n-1)],r=i[Math.min(i.length-1,n+1)],o=r.x-s.x,a=r.y-s.y,l=Math.hypot(o,a)||1,c=a/l,h=-o/l;e.push(new H(Math.max(0,i[n].x-c*t),i[n].y-h*t))}return e}function fa(i){const t=[];for(const e of i){const n=t[t.length-1];(!n||n.distanceTo(e)>1e-4)&&t.push(e)}return t}function Co(i,t,e,n){const s=n.bottomY??0,r=I_(t,e),o=t[t.length-1],a=r[r.length-1],l=(o.x+a.x)/2,c=(o.x-a.x)/2,h=Math.max(o.y,a.y),u=lr(l,h,c*1.25,0,Math.PI,8).map(M=>new H(M.x,M.y)),d=h+c*1.25,f=fa([new H(0,s),...t]),g=n.roundBottom?r[0].y:Math.max(r[0].y,s+e),v=fa([new H(0,g),...r.map(M=>new H(M.x,Math.max(M.y,g)))]),m=fa([...f,...u,...[...v].reverse()]);let p=0;for(const M of m)p=Math.max(p,M.x);const x={type:i,shell:m,inner:v,outer:f,wall:e,rimY:d,innerBottomY:g,innerTopY:a.y,maxOuterRadius:Math.max(p,n.footRadius??0),rimOuterRadius:o.x+c*.25,rimInnerRadius:a.x,spout:n.spout??0,nominalMl:n.nominalMl,graduations:n.graduations,gradTitle:n.gradTitle,baseOffsetY:(n.baseOffsetY??0)+Ao,footHeight:n.footHeight??0,footRadius:n.footRadius??0,rack:n.rack??!1,volTable:new Float32Array(1),volStep:.02};return D_(x),x}function D_(i){const t=i.innerTopY-i.innerBottomY,e=Math.max(2,Math.ceil(t/i.volStep)+1),n=new Float32Array(e);let s=0,r=ye(i,i.innerBottomY);for(let o=1;o<e;o++){const a=i.innerBottomY+o*i.volStep,l=ye(i,a);s+=Math.PI*i.volStep*(r*r+r*l+l*l)/3,n[o]=s,r=l}i.volTable=n}function ye(i,t){const e=i.inner;if(t<=e[0].y)return t<e[0].y-1e-6?0:U_(e,t);for(let n=0;n<e.length-1;n++){const s=e[n],r=e[n+1];if(!(r.y-s.y<1e-6)&&t>=s.y&&t<=r.y){const o=(t-s.y)/(r.y-s.y);return s.x+(r.x-s.x)*o}}return e[e.length-1].x}function U_(i,t){let e=0;for(const n of i)Math.abs(n.y-t)<1e-4&&(e=Math.max(e,n.x));return e}function zs(i,t){const e=i.outer;for(let n=0;n<e.length-1;n++){const s=e[n],r=e[n+1];if(!(r.y-s.y<1e-6)&&t>=s.y&&t<=r.y)return s.x+(r.x-s.x)*(t-s.y)/(r.y-s.y)}return t<e[0].y?e[0].x:e[e.length-1].x}function tr(i,t){if(t<=0)return i.innerBottomY;const e=i.volTable,n=e.length;if(t>=e[n-1]){const a=i.rimInnerRadius;return i.innerBottomY+(n-1)*i.volStep+(t-e[n-1])/(Math.PI*a*a)}let s=0,r=n-1;for(;r-s>1;){const a=s+r>>1;e[a]<t?s=a:r=a}const o=s+(t-e[s])/Math.max(1e-9,e[r]-e[s]);return i.innerBottomY+o*i.volStep}function Hs(i,t,e,n=0){const s=[];if(n>0)for(let r=n;r<=t+1e-6;r+=n)Math.abs(r/i-Math.round(r/i))<1e-6||s.push({ml:r,major:!1});for(let r=i;r<=t+1e-6;r+=i){const o=Math.abs(r/e-Math.round(r/e))<1e-6;s.push({ml:r,major:!0,label:o?String(Math.round(r)):void 0})}return s}function pa(i,t,e,n,s,r){const o=Math.min(.55,t*.18),a=[...lr(t-o,o,o,-Math.PI/2,0,6),new H(t,e*.5),new H(t,e-.25)];return Co(i,a,n,{nominalMl:s,graduations:r,gradTitle:`${s} mL`,spout:Math.max(.35,t*.11)})}function N_(){const o=[...lr(3.65,.6,.6,-Math.PI/2,.2,7)],a=new H(1.7+.45,9.2),l=o[o.length-1];for(let c=1;c<=6;c++){const h=c/6;o.push(new H(l.x+(a.x-l.x)*h,l.y+(a.y-l.y)*h))}for(let c=1;c<=5;c++){const h=c/5,u=1-(1-h)*(1-h);o.push(new H(a.x+(1.7-a.x)*u,9.2+(10.2-9.2)*h))}return o.push(new H(1.7,13.5-.6)),o.push(new H(1.7+.12,13.5-.3)),Co("erlenmeyer-250",o,.18,{nominalMl:250,graduations:Hs(50,250,50,25).filter(c=>c.ml<=250),gradTitle:"250 mL"})}function O_(){const n=[...lr(1.32,1.3,.3,-Math.PI/2,0,4),new H(1.62,12.75),new H(1.62,24.3)];return Co("cylinder-100",n,.17,{nominalMl:100,graduations:Hs(10,100,10,1),gradTitle:"100 mL",spout:.35,bottomY:1,footHeight:1,footRadius:3.8})}function F_(){const e=[...lr(0,1.25,1.25,-Math.PI/2+.12,0,10),new H(1.25,7.5),new H(1.25,14.75)];return Co("test-tube",e,.11,{nominalMl:30,graduations:[],gradTitle:"",roundBottom:!0,baseOffsetY:1.2,rack:!0})}const gh=new Map;function B_(i){let t=gh.get(i);if(t)return t;switch(i){case"beaker-50":t=pa(i,2.1,5.5,.14,50,Hs(10,50,10));break;case"beaker-1000":t=pa(i,5.25,14.5,.22,1e3,Hs(100,1e3,200,50));break;case"erlenmeyer-250":t=N_();break;case"cylinder-100":t=O_();break;case"test-tube":t=F_();break;case"beaker-250":default:t=pa("beaker-250",3.5,9.5,.18,250,Hs(50,250,50,25));break}return gh.set(i,t),t}function k_(i){return i.rimY+i.baseOffsetY}function z_(i){return i.rack?6.5:i.maxOuterRadius+i.spout}const Xu={value:800};function vh(i,t){Xu.value=i/(2*Math.tan(Ol.degToRad(t)/2))}class io{points;cap;live=0;pos;vel;col;life;maxLife;size0;size1;alpha;gravity;drag;kind;seed;aSize;aAlpha;geo;material;fadeIn=.15;behaviour;constructor(t,e,n={}){this.cap=t,this.pos=new Float32Array(t*3),this.vel=new Float32Array(t*3),this.col=new Float32Array(t*3),this.life=new Float32Array(t),this.maxLife=new Float32Array(t),this.size0=new Float32Array(t),this.size1=new Float32Array(t),this.alpha=new Float32Array(t),this.gravity=new Float32Array(t),this.drag=new Float32Array(t),this.kind=new Uint8Array(t),this.seed=new Float32Array(t),this.aSize=new Float32Array(t),this.aAlpha=new Float32Array(t),this.geo=new pe,this.geo.setAttribute("position",new Re(this.pos,3).setUsage(Qn)),this.geo.setAttribute("aColor",new Re(this.col,3).setUsage(Qn)),this.geo.setAttribute("aSize",new Re(this.aSize,1).setUsage(Qn)),this.geo.setAttribute("aAlpha",new Re(this.aAlpha,1).setUsage(Qn)),this.geo.setDrawRange(0,0),this.geo.boundingSphere=new si(new T,1e4),this.material=new nn({uniforms:{uMap:{value:e},uScale:Xu,uMinPx:{value:n.minPx??0}},vertexShader:`
        attribute float aSize;
        attribute float aAlpha;
        attribute vec3 aColor;
        uniform float uScale;
        uniform float uMinPx;
        varying float vA;
        varying vec3 vC;
        void main() {
          vec4 mv = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp( max( aSize * uScale / max( -mv.z, 0.1 ), uMinPx ), 0.0, 512.0 );
          vA = aAlpha;
          vC = aColor;
        }`,fragmentShader:`
        uniform sampler2D uMap;
        varying float vA;
        varying vec3 vC;
        void main() {
          vec4 t = texture2D( uMap, gl_PointCoord );
          float a = t.a * vA;
          if ( a < 0.003 ) discard;
          gl_FragColor = vec4( vC * t.rgb, a );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,transparent:!0,depthWrite:!1,blending:n.additive?Ys:xi}),this.points=new Ov(this.geo,this.material),this.points.frustumCulled=!1,this.points.renderOrder=n.renderOrder??4,this.points.raycast=()=>{},this.points.visible=!1}spawn(t,e,n,s,r,o,a,l,c,h,u,d,f,g=0,v=0,m=0){if(this.live>=this.cap)return-1;const p=this.live++,x=p*3;return this.pos[x]=t,this.pos[x+1]=e,this.pos[x+2]=n,this.vel[x]=s,this.vel[x+1]=r,this.vel[x+2]=o,this.col[x]=u,this.col[x+1]=d,this.col[x+2]=f,this.life[p]=0,this.maxLife[p]=a,this.size0[p]=l,this.size1[p]=c,this.alpha[p]=h,this.gravity[p]=g,this.drag[p]=v,this.kind[p]=m,this.seed[p]=Math.random()*100,p}kill(t){const e=--this.live;if(t===e)return;const n=t*3,s=e*3;for(let r=0;r<3;r++)this.pos[n+r]=this.pos[s+r],this.vel[n+r]=this.vel[s+r],this.col[n+r]=this.col[s+r];this.life[t]=this.life[e],this.maxLife[t]=this.maxLife[e],this.size0[t]=this.size0[e],this.size1[t]=this.size1[e],this.alpha[t]=this.alpha[e],this.gravity[t]=this.gravity[e],this.drag[t]=this.drag[e],this.kind[t]=this.kind[e],this.seed[t]=this.seed[e]}clear(){this.live=0}update(t){let e=0;for(;e<this.live;){if(this.life[e]+=t,this.life[e]>=this.maxLife[e]||this.behaviour&&!this.behaviour(e,t)){this.kill(e);continue}const n=e*3;this.vel[n+1]-=this.gravity[e]*t;const s=Math.max(0,1-this.drag[e]*t);this.vel[n]*=s,this.vel[n+1]*=s,this.vel[n+2]*=s,this.pos[n]+=this.vel[n]*t,this.pos[n+1]+=this.vel[n+1]*t,this.pos[n+2]+=this.vel[n+2]*t;const r=this.life[e]/this.maxLife[e];this.aSize[e]=this.size0[e]+(this.size1[e]-this.size0[e])*r;const o=this.fadeIn>0?Math.min(1,r/this.fadeIn):1,a=Math.min(1,(1-r)/.35);this.aAlpha[e]=this.alpha[e]*o*a,e++}this.geo.setDrawRange(0,this.live),this.points.visible=this.live>0,this.live>0&&(this.geo.attributes.position.needsUpdate=!0,this.geo.attributes.aColor.needsUpdate=!0,this.geo.attributes.aSize.needsUpdate=!0,this.geo.attributes.aAlpha.needsUpdate=!0)}setRenderOrder(t){this.points.renderOrder=t}dispose(){this.geo.dispose(),this.material.dispose()}}let ma=null;function H_(){return ma||(ma=new rr(1,2)),ma}function V_(){return new nn({uniforms:{uTint:{value:new Et(1,1,1)},uOpacity:{value:1}},vertexShader:`
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec4 p = vec4( position, 1.0 );
        vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
          n = mat3( instanceMatrix ) * n;
        #endif
        vec4 mv = modelViewMatrix * p;
        vN = normalize( normalMatrix * n );
        vV = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,fragmentShader:`
      uniform vec3 uTint;
      uniform float uOpacity;
      varying vec3 vN;
      varying vec3 vV;
      void main() {
        vec3 n = normalize( vN );
        vec3 v = normalize( vV );
        float nv = abs( dot( n, v ) );
        float rim = pow( 1.0 - nv, 2.2 );
        vec3 l = normalize( vec3( 0.35, 0.85, 0.4 ) );
        float spec = pow( max( dot( reflect( -v, n ), l ), 0.0 ), 60.0 );
        float a = clamp( 0.04 + rim * 0.85 + spec * 0.9, 0.0, 1.0 ) * uOpacity;
        vec3 c = mix( uTint * 0.9, vec3( 1.0 ), 0.55 + spec * 0.45 );
        gl_FragColor = vec4( c, a );
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,transparent:!0,depthWrite:!1})}class G_{mesh;material;cap;live=0;p;v;r;wob;age;squash;m=new Jt;q=new Me;s=new T;t=new T;constructor(t){this.cap=t,this.material=V_(),this.mesh=new Ps(H_(),this.material,t),this.mesh.instanceMatrix.setUsage(Qn),this.mesh.count=0,this.mesh.frustumCulled=!1,this.mesh.renderOrder=4,this.mesh.raycast=()=>{},this.mesh.visible=!1,this.p=new Float32Array(t*3),this.v=new Float32Array(t),this.r=new Float32Array(t),this.wob=new Float32Array(t),this.age=new Float32Array(t),this.squash=new Float32Array(t)}spawn(t,e,n,s,r,o=0){if(this.live>=this.cap)return;const a=this.live++;this.p[a*3]=t,this.p[a*3+1]=e,this.p[a*3+2]=n,this.r[a]=s,this.v[a]=r,this.wob[a]=Math.random()*6.28,this.age[a]=0,this.squash[a]=o}kill(t){const e=--this.live;t!==e&&(this.p[t*3]=this.p[e*3],this.p[t*3+1]=this.p[e*3+1],this.p[t*3+2]=this.p[e*3+2],this.r[t]=this.r[e],this.v[t]=this.v[e],this.wob[t]=this.wob[e],this.age[t]=this.age[e],this.squash[t]=this.squash[e])}clear(){this.live=0,this.mesh.count=0,this.mesh.visible=!1}update(t,e,n,s,r){let o=0;for(;o<this.live;){const a=o*3;this.age[o]+=t;const l=Math.min(1,this.age[o]/.12),c=this.v[o]*l;let h=this.p[a],u=this.p[a+1]+c*t,d=this.p[a+2];const f=this.wob[o]+this.age[o]*(9+this.r[o]*20),g=.25*this.r[o]+.02;if(h+=Math.cos(f)*g*t*6,d+=Math.sin(f*1.3)*g*t*6,s!==0){const M=Math.cos(s*t),_=Math.sin(s*t),I=h*M-d*_;d=h*_+d*M,h=I}this.r[o]*=1+t*.04;const v=Math.max(.05,n(u)-this.r[o]),m=Math.hypot(h,d);if(m>v&&(h*=v/m,d*=v/m),u+this.r[o]*.3>=e){r(h,e,d,this.r[o]),this.kill(o);continue}this.p[a]=h,this.p[a+1]=u,this.p[a+2]=d;const p=this.r[o],x=this.squash[o];if(x>0){const M=Math.sin(this.age[o]*14+this.wob[o])*.18*x;this.s.set(p*(1.15+M),p*(.8-M),p*(1.1-M*.5))}else this.s.set(p,p*.92,p);this.t.set(h,u,d),this.m.compose(this.t,this.q,this.s),this.mesh.setMatrixAt(o,this.m),o++}this.mesh.count=this.live,this.mesh.visible=this.live>0,this.live>0&&(this.mesh.instanceMatrix.needsUpdate=!0)}setRenderOrder(t){this.mesh.renderOrder=t}dispose(){this.material.dispose(),this.mesh.dispose()}}const W_=(()=>{const i=new ze(1,1,1,1);return i.translate(0,.5,0),i})();function q_(i=0){return new nn({uniforms:{uTime:{value:0},uSeed:{value:i},uLum:{value:0},uEmit:{value:new Et(1,.8,.2)},uEmitAmt:{value:0},uIntensity:{value:0},uSize:{value:new H(2,5)},uInnerCone:{value:1}},vertexShader:`
      uniform vec2 uSize;
      varying vec2 vUv;
      void main() {
        vec3 center = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
        vec3 toCam = cameraPosition - center;
        vec3 right = normalize( vec3( toCam.z, 0.0, -toCam.x ) + vec3( 1e-5, 0.0, 0.0 ) );
        vec3 wp = center + right * position.x * uSize.x + vec3( 0.0, 1.0, 0.0 ) * position.y * uSize.y;
        vUv = vec2( position.x + 0.5, position.y );
        gl_Position = projectionMatrix * viewMatrix * vec4( wp, 1.0 );
      }`,fragmentShader:`
      uniform float uTime;
      uniform float uSeed;
      uniform float uLum;
      uniform vec3 uEmit;
      uniform float uEmitAmt;
      uniform float uIntensity;
      uniform float uInnerCone;
      varying vec2 vUv;
      float hash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
      float noise( vec2 p ) {
        vec2 i = floor( p ); vec2 f = fract( p );
        f = f * f * ( 3.0 - 2.0 * f );
        return mix( mix( hash( i ), hash( i + vec2( 1.0, 0.0 ) ), f.x ), mix( hash( i + vec2( 0.0, 1.0 ) ), hash( i + vec2( 1.0, 1.0 ) ), f.x ), f.y );
      }
      float fbm( vec2 p ) {
        float v = 0.0; float a = 0.5;
        for ( int i = 0; i < 4; i++ ) { v += a * noise( p ); p *= 2.03; a *= 0.5; }
        return v;
      }
      void main() {
        float t = uTime + uSeed * 13.7;
        vec2 uv = vUv;
        float n = fbm( vec2( uv.x * 3.0 + uSeed, uv.y * 2.2 - t * 2.6 ) );
        float n2 = fbm( vec2( uv.x * 6.0 - uSeed, uv.y * 4.0 - t * 4.1 ) );
        float y = uv.y;
        float x = ( uv.x - 0.5 ) * 2.0;
        x += ( n - 0.5 ) * 0.55 * y + sin( t * 7.0 + y * 6.0 ) * 0.04 * y;
        float w = pow( max( y, 0.0 ), 0.42 ) * pow( max( 1.0 - y, 0.0 ), 0.75 ) * 1.75 + 1e-3;
        float d = abs( x ) / w;
        float tip = y + ( n2 - 0.5 ) * 0.35;
        float body = smoothstep( 1.0, 0.45, d ) * smoothstep( 0.98, 0.55, tip ) * smoothstep( 0.0, 0.05, y );
        // inner premixed cone
        float ih = 0.42;
        float iw = 0.5 * w * max( 0.0, 1.0 - y / ih );
        float inner = smoothstep( 1.0, 0.3, abs( x ) / max( iw, 1e-3 ) ) * step( y, ih ) * uInnerCone;
        vec3 blue = vec3( 0.18, 0.38, 1.0 );
        vec3 hot = mix( vec3( 1.0, 0.42, 0.08 ), vec3( 1.0, 0.86, 0.5 ), smoothstep( 0.2, 1.0, 1.0 - d ) );
        vec3 outer = mix( blue * 0.55, hot, uLum );
        outer = mix( outer, uEmit * 1.2, uEmitAmt );
        float a = body * mix( 0.35, 1.0, uLum ) + body * uEmitAmt * 0.5;
        vec3 col = outer * a + blue * inner * 1.3 * ( 1.0 - uLum * 0.6 );
        gl_FragColor = vec4( col * uIntensity, 1.0 );
        #include <colorspace_fragment>
      }`,transparent:!0,depthWrite:!1,blending:Ys,toneMapped:!1})}class $u{group=new fe;meshes=[];mats=[];offsets=[];intensity=0;target=0;constructor(t){for(let e=0;e<t;e++){const n=q_(e*1.37+Math.random()),s=new tt(W_,n);s.frustumCulled=!1,s.renderOrder=900,s.raycast=()=>{},this.meshes.push(s),this.mats.push(n),this.offsets.push(new H),this.group.add(s)}this.group.visible=!1}configure(t,e,n,s){const r=this.meshes.length;for(let o=0;o<r;o++){const a=o/r*Math.PI*2+.4,l=r===1?0:t*(o===0?0:.55);this.offsets[o].set(Math.cos(a)*l,Math.sin(a)*l),this.meshes[o].position.set(this.offsets[o].x,0,this.offsets[o].y);const c=this.mats[o],h=o===0?1:.75;c.uniforms.uSize.value.set(e*h,n*h*(.85+.3*Math.sin(o*2.1))),s.luminosity!==void 0&&(c.uniforms.uLum.value=s.luminosity),s.emitter&&c.uniforms.uEmit.value.copy(s.emitter),s.emitterAmount!==void 0&&(c.uniforms.uEmitAmt.value=s.emitterAmount)}}setInnerCone(t){for(const e of this.mats)e.uniforms.uInnerCone.value=t?1:0}setTarget(t){this.target=Math.max(0,t)}tick(t,e){if(this.intensity+=(this.target-this.intensity)*Math.min(1,t*6),this.target===0&&this.intensity<.01&&(this.intensity=0),this.group.visible=this.intensity>.005,!this.group.visible)return;const n=.85+.15*Math.sin(e*23)*Math.sin(e*7.3);for(const s of this.mats)s.uniforms.uTime.value=e,s.uniforms.uIntensity.value=this.intensity*n}brightness(t){return this.intensity*(.8+.2*Math.sin(t*31)*Math.sin(t*11.7))}dispose(){for(const t of this.mats)t.dispose()}}function Ne(i,t){const e=document.createElement("canvas");return e.width=i,e.height=t,[e,e.getContext("2d")]}function ni(i){let t=i>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function Oe(i,t,e=!1){const n=new yo(i);return t&&(n.colorSpace=we),e&&(n.wrapS=os,n.wrapT=os),n.anisotropy=8,n.needsUpdate=!0,n}const _h=new Map;function Ee(i,t){let e=_h.get(i);return e||(e=t(),_h.set(i,e)),e}function Sl(){return Ee("soft",()=>{const[i,t]=Ne(64,64),e=t.createRadialGradient(32,32,0,32,32,32);return e.addColorStop(0,"rgba(255,255,255,1)"),e.addColorStop(.35,"rgba(255,255,255,0.65)"),e.addColorStop(1,"rgba(255,255,255,0)"),t.fillStyle=e,t.fillRect(0,0,64,64),Oe(i,!1)})}function Y_(){return Ee("smoke",()=>{const[t,e]=Ne(128,128),n=ni(7);e.clearRect(0,0,128,128);for(let r=0;r<26;r++){const o=n()*Math.PI*2,a=n()*128*.22,l=128/2+Math.cos(o)*a,c=128/2+Math.sin(o)*a,h=128*(.16+n()*.2),u=e.createRadialGradient(l,c,0,l,c,h);u.addColorStop(0,`rgba(255,255,255,${.18+n()*.12})`),u.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=u,e.fillRect(0,0,128,128)}const s=e.getImageData(0,0,128,128);for(let r=0;r<128;r++)for(let o=0;o<128;o++){const a=(o-64)/64,l=(r-128/2)/(128/2),c=Math.max(0,1-Math.sqrt(a*a+l*l)),h=(r*128+o)*4+3;s.data[h]=Math.min(255,s.data[h]*Math.min(1,c*2.2))}return e.putImageData(s,0,0),Oe(t,!1)})}function X_(){return Ee("ring",()=>{const[t,e]=Ne(256,256),n=e.createRadialGradient(256/2,256/2,256*.3,256/2,256/2,256/2);return n.addColorStop(0,"rgba(255,255,255,0)"),n.addColorStop(.45,"rgba(255,255,255,0.9)"),n.addColorStop(.6,"rgba(255,255,255,0.35)"),n.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=n,e.fillRect(0,0,256,256),Oe(t,!1)})}function $_(){return Ee("blob",()=>{const[t,e]=Ne(128,128),n=e.createRadialGradient(128/2,128/2,0,128/2,128/2,128/2);return n.addColorStop(0,"rgba(0,0,0,0.85)"),n.addColorStop(.55,"rgba(0,0,0,0.5)"),n.addColorStop(.8,"rgba(0,0,0,0.12)"),n.addColorStop(1,"rgba(0,0,0,0)"),e.fillStyle=n,e.fillRect(0,0,128,128),Oe(t,!1)})}function j_(){return Ee("droplets",()=>{const[t,e]=Ne(512,512),n=ni(42);e.clearRect(0,0,512,512),e.fillStyle="rgba(255,255,255,0.10)",e.fillRect(0,0,512,512);const s=(r,o,a)=>{const l=e.createRadialGradient(r-a*.3,o-a*.35,a*.05,r,o,a);l.addColorStop(0,"rgba(255,255,255,0.95)"),l.addColorStop(.35,"rgba(235,242,248,0.35)"),l.addColorStop(.85,"rgba(200,210,220,0.55)"),l.addColorStop(1,"rgba(200,210,220,0)"),e.fillStyle=l,e.beginPath(),e.ellipse(r,o,a,a*(.9+n()*.25),0,0,Math.PI*2),e.fill()};for(let r=0;r<2600;r++)s(n()*512,n()*512,.8+Math.pow(n(),3)*3.5);for(let r=0;r<90;r++)s(n()*512,n()*512,4+n()*6);for(let r=0;r<7;r++){const o=n()*512;let a=n()*512*.5;const l=60+n()*200;e.strokeStyle="rgba(230,238,245,0.35)",e.lineWidth=2+n()*2,e.beginPath(),e.moveTo(o,a);for(let c=0;c<l;c+=8)a+=8,e.lineTo(o+Math.sin(c*.05)*1.5,a);e.stroke(),s(o,a,4+n()*3)}return Oe(t,!1,!0)})}function K_(){const i=Ee("counter_map",()=>{const[n,s]=Ne(1024,1024),r=ni(11);s.fillStyle="#25282b",s.fillRect(0,0,1024,1024);for(let o=0;o<160;o++){const a=r()*1024,l=r()*1024,c=40+r()*140,h=s.createRadialGradient(a,l,0,a,l,c),u=r()<.5?"255,255,255":"0,0,0";h.addColorStop(0,`rgba(${u},0.035)`),h.addColorStop(1,`rgba(${u},0)`),s.fillStyle=h,s.fillRect(a-c,l-c,c*2,c*2)}for(let o=0;o<26e3;o++){const a=r();s.fillStyle=a<.5?`rgba(120,124,128,${.15+r()*.3})`:`rgba(10,10,12,${.2+r()*.3})`;const l=r()<.97?1:2;s.fillRect(r()*1024,r()*1024,l,l)}return Oe(n,!0,!0)}),t=Ee("counter_rough",()=>{const[n,s]=Ne(512,512),r=ni(13);s.fillStyle="rgb(105,105,105)",s.fillRect(0,0,512,512);for(let o=0;o<220;o++){const a=r()*512,l=r()*512,c=20+r()*90,h=s.createRadialGradient(a,l,0,a,l,c),u=r()<.5?150:70;h.addColorStop(0,`rgba(${u},${u},${u},0.35)`),h.addColorStop(1,`rgba(${u},${u},${u},0)`),s.fillStyle=h,s.fillRect(a-c,l-c,c*2,c*2)}s.strokeStyle="rgba(160,160,160,0.08)";for(let o=0;o<60;o++){s.lineWidth=4+r()*10,s.beginPath();const a=r()*512,l=r()*512;s.arc(a,l,30+r()*120,r()*6,r()*6+1.5),s.stroke()}return Oe(n,!1,!0)});return{map:i,roughnessMap:t}}function Z_(){const i=t=>{const[n,s]=Ne(1024,1024),r=ni(21),o=1024/4,a=1024/8,l=6;s.fillStyle=t==="map"?"#b9bcbc":t==="rough"?"rgb(235,235,235)":"rgb(0,0,0)",s.fillRect(0,0,1024,1024);for(let c=0;c<8;c++){const h=c%2===0?0:o/2;for(let u=-1;u<5;u++){const d=u*o+h+l/2,f=c*a+l/2,g=o-l,v=a-l;if(t==="map"){const m=238+Math.floor(r()*10),p=s.createLinearGradient(d,f,d,f+v);p.addColorStop(0,`rgb(${m},${m},${m-2})`),p.addColorStop(1,`rgb(${m-8},${m-8},${m-9})`),s.fillStyle=p}else t==="rough"?s.fillStyle="rgb(40,40,40)":s.fillStyle="rgb(255,255,255)";s.beginPath(),s.roundRect(d,f,g,v,7),s.fill(),t==="bump"&&(s.strokeStyle="rgba(0,0,0,0.25)",s.lineWidth=6,s.stroke())}}return Oe(n,t==="map",!0)};return{map:Ee("tile_map",()=>i("map")),roughnessMap:Ee("tile_rough",()=>i("rough")),bumpMap:Ee("tile_bump",()=>i("bump"))}}function J_(i="#d9dcd6"){return Ee("paint"+i,()=>{const[e,n]=Ne(512,512),s=ni(31);n.fillStyle=i,n.fillRect(0,0,512,512);for(let r=0;r<9e3;r++)n.fillStyle=s()<.5?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)",n.fillRect(s()*512,s()*512,2,2);return Oe(e,!0,!0)})}function ju(){return Ee("wood",()=>{const[e,n]=Ne(1024,128),s=ni(5);n.fillStyle="#a77b4f",n.fillRect(0,0,1024,128);for(let r=0;r<90;r++){const o=s()*128,a=2+s()*6,l=.002+s()*.01;n.strokeStyle=s()<.5?`rgba(90,58,30,${.12+s()*.2})`:`rgba(210,170,120,${.08+s()*.12})`,n.lineWidth=.6+s()*2.2,n.beginPath();for(let c=0;c<=1024;c+=8){const h=o+Math.sin(c*l+r)*a;c===0?n.moveTo(c,h):n.lineTo(c,h)}n.stroke()}return Oe(e,!0,!0)})}function Q_(){return Ee("floor",()=>{const[t,e]=Ne(512,512),n=ni(3);e.fillStyle="#8d9293",e.fillRect(0,0,512,512);for(let s=0;s<12e3;s++){const r=n();e.fillStyle=r<.33?"rgba(255,255,255,0.18)":r<.66?"rgba(40,44,48,0.18)":"rgba(120,130,140,0.25)",e.fillRect(n()*512,n()*512,2+n()*2,2+n()*2)}return e.strokeStyle="rgba(60,60,60,0.25)",e.lineWidth=2,e.strokeRect(0,0,512,512),Oe(t,!0,!0)})}function tM(){return Ee("cabinet",()=>{const[e,n]=Ne(1024,512);n.fillStyle="#d4d8d6",n.fillRect(0,0,1024,512);const s=4;for(let r=0;r<s;r++){const o=r*1024/s;n.strokeStyle="rgba(0,0,0,0.35)",n.lineWidth=4,n.strokeRect(o+6,8,1024/s-12,110),n.strokeRect(o+6,130,1024/s-12,372),n.fillStyle="#8a9096",n.fillRect(o+1024/s/2-40,52,80,10),n.fillRect(o+1024/s/2-40,160,80,10)}return Oe(e,!0)})}function eM(){return Ee("window",()=>{const[e,n]=Ne(512,512),s=n.createLinearGradient(0,0,0,512);s.addColorStop(0,"#dfeefc"),s.addColorStop(.6,"#f4f8fb"),s.addColorStop(1,"#e8eef0"),n.fillStyle=s,n.fillRect(0,0,512,512),n.fillStyle="rgba(150,170,160,0.35)",n.beginPath(),n.moveTo(0,512*.78);for(let r=0;r<=512;r+=16)n.lineTo(r,512*.78-Math.abs(Math.sin(r*.03))*40-Math.sin(r*.011)*20);return n.lineTo(512,512),n.lineTo(0,512),n.fill(),n.fillStyle="#c9cdd0",n.fillRect(512/2-6,0,12,512),n.fillRect(0,512/2-6,512,12),n.lineWidth=16,n.strokeStyle="#c9cdd0",n.strokeRect(0,0,512,512),Oe(e,!0)})}function nM(){return Ee("hotglow",()=>{const[t,e]=Ne(256,256);e.fillStyle="#000",e.fillRect(0,0,256,256);const n=e.createRadialGradient(256/2,256/2,0,256/2,256/2,256*.48);n.addColorStop(0,"rgba(255,90,20,0.55)"),n.addColorStop(.7,"rgba(255,60,10,0.4)"),n.addColorStop(1,"rgba(255,40,0,0)"),e.fillStyle=n,e.fillRect(0,0,256,256);for(let s=18;s<256*.44;s+=13)e.strokeStyle="rgba(255,120,40,0.85)",e.lineWidth=5,e.beginPath(),e.arc(256/2,256/2,s,0,Math.PI*2),e.stroke();return Oe(t,!0)})}function iM(){return Ee("hottop",()=>{const[t,e]=Ne(256,256);return e.fillStyle="#eef0ee",e.fillRect(0,0,256,256),e.strokeStyle="rgba(120,120,120,0.45)",e.lineWidth=2,e.beginPath(),e.arc(256/2,256/2,256*.4,0,Math.PI*2),e.stroke(),e.fillStyle="rgba(200,40,30,0.7)",e.font="bold 14px sans-serif",e.textAlign="center",e.fillText("⚠ HOT SURFACE",256/2,242),Oe(t,!0)})}function sM(i,t,e,n){return Ee("grad_"+i,()=>{const r=n?2048:1024,[o,a]=Ne(256,r);a.clearRect(0,0,256,r),a.fillStyle="rgba(250,250,248,0.96)",a.strokeStyle="rgba(250,250,248,0.96)";const l=n?30:34;for(const h of t){const u=(1-h.v)*r,d=h.major?n?90:80:45;a.fillRect(256*.5-d,u-(h.major?2.5:1.6),d,h.major?5:3.2),h.label&&(a.font=`600 ${l}px "Helvetica Neue", Arial, sans-serif`,a.textAlign="left",a.textBaseline="middle",a.fillText(h.label,256*.5+10,u))}if(e){a.font=`600 ${l}px "Helvetica Neue", Arial, sans-serif`,a.textAlign="center",a.textBaseline="middle";const h=t.length?(1-Math.max(...t.map(d=>d.v)))*r:r*.2,u=Math.max(l,h-l*1.6);a.fillText(e,256*.5,u),a.font=`500 ${Math.round(l*.6)}px Arial, sans-serif`,a.fillText("BORO 3.3",256*.5,u+l*.95)}const c=Oe(o,!0);return c.anisotropy=4,c})}function rM(){return Ee("thermoscale",()=>{const[e,n]=Ne(64,2048);n.fillStyle="#f3f1e8",n.fillRect(0,0,64,2048),n.fillStyle="#1b1b1b";for(let s=-20;s<=110;s+=1){const o=2048-(s+20)/130*2048*.96-2048*.02,a=s%10===0,l=s%5===0;n.fillRect(0,o-1,a?30:l?22:14,a?3:2),a&&(n.save(),n.translate(54,o),n.rotate(-Math.PI/2),n.font="bold 18px Arial",n.textAlign="center",n.fillText(String(s),0,0),n.restore())}return Oe(e,!0)})}let oM=null,aM=null,lM=null,ws=null,fi=null,Es=null,Hr=null;const Mh=new Map;function cM(){return oM??=new Vl(1,0)}function hM(){return aM??=new rr(1,1)}function uM(){return lM??=new rr(1,1)}function dM(){if(ws)return ws;const i=new fs;return i.moveTo(0,0),i.lineTo(1,.15),i.lineTo(.35,1),i.lineTo(0,0),ws=new Ci(i,{depth:.06,bevelEnabled:!1}),ws.center(),ws}function Ku(){if(fi)return fi;const i=40,t=[],e=[],n=5,s=.32;for(let r=0;r<=i;r++){const o=r/i,a=(o-.5)*n,l=Math.sin(o*Math.PI*2.2)*.35+o*.2,c=Math.cos(o*Math.PI*1.3)*.45,h=Math.sin(o*5)*.4;t.push(a,l+Math.cos(h)*s*.5,c+Math.sin(h)*s*.5),t.push(a,l-Math.cos(h)*s*.5,c-Math.sin(h)*s*.5)}for(let r=0;r<i;r++){const o=r*2;e.push(o,o+1,o+2,o+1,o+3,o+2)}return fi=new pe,fi.setAttribute("position",new jt(t,3)),fi.setIndex(e),fi.computeVertexNormals(),fi}function fM(){return Es||(Es=new So(.3,1.6,6,16),Es.rotateZ(Math.PI/2),Es)}function pM(){if(Hr)return Hr;const i=[new H(0,0),new H(.8,0),new H(.82,.02),new H(1,.94),new H(.98,1),new H(0,1)];return Hr=new Ue(i,32),Hr}function mM(i){let t=Mh.get(i.type);if(t)return t;const e=i.inner.filter(n=>n.x>.01).map(n=>new H(Math.max(.01,n.x-.03),n.y));return t=new Ue(e,48),Mh.set(i.type,t),t}const gM=()=>new sn({color:16777215,roughness:.08,metalness:0,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:2.2,transparent:!0,opacity:.9,flatShading:!0}),Yn=new Jt,pi=new Me,xh=new ln,Xn=new T,an=new T,yh=new Et;function Lt(i,t){return i+Math.random()*(t-i)}function Qe(i,t){const e=Math.sin(i*127.1+t*311.7)*43758.5453;return e-Math.floor(e)}class vM{constructor(t,e){this.profile=t,this.liquid=e;const n=t;this.floorY=-n.baseOffsetY,this.bubbles=new G_(220),this.smoke=new io(170,Y_()),this.smoke.fadeIn=.2,this.splash=new io(140,Sl()),this.splash.fadeIn=0,this.precip=new io(300,Sl(),{minPx:3}),this.precip.fadeIn=.3,this.flame=new $u(n.rimInnerRadius>2?4:2),this.group.add(this.bubbles.mesh,this.smoke.points,this.splash.points,this.precip.points,this.flame.group),this.smoke.behaviour=(a,l)=>this.smokeBehaviour(a,l),this.splash.behaviour=(a,l)=>this.splashBehaviour(a,l),this.precip.behaviour=(a,l)=>this.precipBehaviour(a,l),this.foamMat=new Mt({color:16777215,roughness:.3,metalness:0,envMapIntensity:1.2}),this.foam=new Ps(uM(),this.foamMat,260),this.foam.count=0,this.foam.visible=!1,this.foam.frustumCulled=!1,this.foam.raycast=()=>{},this.foam.instanceMatrix.setUsage(Qn);for(let a=0;a<260;a++){const l=Math.floor(a/52);this.foamCells.push({u:Math.sqrt(Math.random()),v:Math.random()*Math.PI*2,layer:l,r:Lt(.6,1.25),ph:Math.random()*6.28}),this.foam.setColorAt(a,yh.setScalar(Lt(.9,1)))}this.group.add(this.foam),this.condMat=new nn({uniforms:{uMap:{value:j_()},uAmount:{value:0},uFill:e.uniforms.uFill,uTop:{value:n.innerTopY}},vertexShader:`
        varying vec3 vObj;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vObj = position;
          vec4 mv = modelViewMatrix * vec4( position, 1.0 );
          vN = normalize( normalMatrix * normal );
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,fragmentShader:`
        uniform sampler2D uMap;
        uniform float uAmount;
        uniform float uFill;
        uniform float uTop;
        varying vec3 vObj;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float y = vObj.y;
          if ( y < uFill + 0.12 ) discard;
          float a0 = atan( vObj.z, vObj.x );
          float circ = length( vObj.xz ) * 6.2832;
          vec2 uv = vec2( a0 / 6.2832 * circ / 4.0, y / 4.0 );
          vec4 t = texture2D( uMap, uv );
          float band = smoothstep( uFill + 0.12, uFill + 0.9, y ) * ( 1.0 - smoothstep( uTop - 0.6, uTop, y ) * 0.6 );
          float nv = abs( dot( normalize( vN ), normalize( vV ) ) );
          float a = t.a * uAmount * band * ( 0.7 + 0.3 * ( 1.0 - nv ) );
          if ( a < 0.004 ) discard;
          gl_FragColor = vec4( vec3( 0.92, 0.95, 0.97 ) * ( 0.75 + 0.35 * t.r ), a );
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,transparent:!0,depthWrite:!1,side:je}),this.cond=new tt(mM(n),this.condMat),this.cond.visible=!1,this.cond.raycast=()=>{},this.group.add(this.cond),this.bedMat=new Mt({color:16777215,roughness:.92,metalness:0}),this.crystals=new Ps(cM(),gM(),48),this.crystals.count=0,this.crystals.visible=!1,this.crystals.raycast=()=>{},this.lumps=new Ps(hM(),new Mt({color:16777215,roughness:.7,transparent:!0,opacity:.92}),40),this.lumps.count=0,this.lumps.visible=!1,this.lumps.raycast=()=>{},this.lumps.instanceMatrix.setUsage(Qn),this.group.add(this.crystals,this.lumps),this.ribbonMat=new Mt({color:13158604,metalness:1,roughness:.32,side:je}),this.ribbon=new tt(Ku(),this.ribbonMat),this.ribbon.visible=!1,this.ribbon.castShadow=!1,this.ribbon.raycast=()=>{};const s=Math.min(1,(n.rimInnerRadius*2-.4)/5);this.ribbon.userData.baseScale=Math.max(.35,s),this.group.add(this.ribbon),this.stirBar=new tt(fM(),new Mt({color:16185074,roughness:.45,metalness:0}));const r=Math.min(1.25,ye(n,n.innerBottomY+.3)*2*.8/2.2);this.stirBar.scale.setScalar(Math.max(.35,r)),this.stirBar.position.y=n.innerBottomY+.3*this.stirBar.scale.y,this.stirBar.visible=!1,this.stirBar.raycast=()=>{},this.group.add(this.stirBar),this.stopper=new tt(pM(),new Mt({color:5974556,roughness:.75,metalness:0}));const o=n.rimInnerRadius+.25;this.stopper.scale.set(o,Math.min(3,Math.max(1.6,o*1.1)),o),this.stopper.userData.homeY=n.rimY-this.stopper.scale.y*.65,this.stopper.position.y=this.stopper.userData.homeY,this.stopper.castShadow=!0,this.stopper.visible=!1,this.stopper.raycast=()=>{},this.group.add(this.stopper),this.setRenderOrderBase(0)}group=new fe;onBurst;snap=null;bubbles;smoke;splash;precip;flame;foam;foamMat;foamCells=[];foamLevel=0;foamTarget=0;cond;condMat;condLevel=0;bedSide=null;bedTop=null;bedMat;bed={yb:0,rp:0,H:0,rS:0,wet:!1,vol:-1};bedTargetVol=0;bedVol=0;bedColor=new Et(1,1,1);bedColorTarget=new Et(1,1,1);bedSeed=Math.random()*10;crystals;crystalCount=0;crystalPolar=[];lumps;lumpCount=0;lumpState=[];ribbon;ribbonMat;ribbonScale=0;ribbonTarget=0;ribbonFloating=!1;stirBar;stirRpm=0;stirAngle=0;stopper;stopperFlying=!1;stopperV=new T;stopperW=new T;stopperT=0;sealed=!1;shards=null;shardState=[];puddle=null;puddleMat=null;puddleR=0;puddleTarget=0;burst=!1;failed=new Set;seenEvents=new Set;spawnAcc={bubbles:0,boil:0,steam:0,fume:0,precip:0,spill:0};spillTime=0;suspendedColor=new Et(1,1,1);suspendedTargetCount=0;suspendedDiameterUm=10;settleFrac=0;time=0;appHex="";appColor=new Et(1,1,1);renderBase=0;floorY;setRenderOrderBase(t){this.renderBase=t,this.bubbles.setRenderOrder(t+4),this.precip.setRenderOrder(t+4),this.splash.setRenderOrder(t+4),this.smoke.setRenderOrder(t+6),this.cond.renderOrder=t+4,this.crystals.renderOrder=t+4,this.lumps.renderOrder=t+4,this.flame.group.children.forEach(e=>e.renderOrder=t+4),this.shards&&(this.shards.renderOrder=t+6),this.puddle&&(this.puddle.renderOrder=t)}stopperTopY(){return this.stopper.userData.homeY+this.stopper.scale.y}setSealed(t){this.burst&&(t=!1),t&&!this.sealed&&(this.stopperFlying=!1,this.stopper.position.set(0,this.stopper.userData.homeY,0),this.stopper.rotation.set(0,0,0)),this.sealed=t,this.stopperFlying||(this.stopper.visible=t)}setStirring(t){this.stirRpm=Math.max(0,t),this.liquid.setStirring(this.stirRpm)}applySnapshot(t){this.snap=t,this.safe("solids",()=>this.processSolids(t.solids||[],t.total_liquid_ml)),this.safe("events",()=>{t.sealed!==this.sealed&&!t.burst&&this.setSealed(t.sealed);for(const e of t.events||[]){const n=`${e.kind}@${e.t_sim_s.toFixed(3)}`;this.seenEvents.has(n)||(this.seenEvents.add(n),this.seenEvents.size>300&&this.seenEvents.clear(),e.kind==="stopper_pop"?this.popStopper():e.kind==="burst"?this.triggerBurst():e.kind==="boil_over"?this.spillTime=1.6:e.kind==="splatter"&&this.spatter(10))}t.burst&&!this.burst&&this.triggerBurst()}),this.safe("gas/foam",()=>{this.foamTarget=Math.max(0,Math.min(1,t.foam||0)),this.condLevel=Math.max(0,Math.min(1,t.condensation||0)),this.liquid.setBoil(t.boil_intensity||0);let e=0;for(const n of t.gas_fluxes||[])e+=n.rate_ml_s;this.liquid.setGasAgitation(Math.min(1,e/4))})}processSolids(t,e){let n=0,s=0,r=0,o=0,a=0,l=0,c=0,h=0,u=0,d=0,f=0,g=0,v=.92,m=null,p=0;const x=new Et(1,1,1);for(const I of t){if(I.mass_g<=1e-6)continue;if(I.kind==="metal"){m||(m=I);continue}const E=1-Math.max(0,Math.min(1,I.suspended_fraction)),C=Math.max(0,I.settled_volume_ml)*E;n+=C;const P=I.mass_g*E+1e-9;r+=I.rgb[0]*P,o+=I.rgb[1]*P,a+=I.rgb[2]*P,s+=P;const b=I.mass_g*I.suspended_fraction;e>.05&&(l+=b,c+=I.rgb[0]*b,h+=I.rgb[1]*b,u+=I.rgb[2]*b,p+=I.particle_diameter_um*b),I.kind==="crystal"&&(d+=I.mass_g*E,v=Math.min(v,.35)),(I.kind==="gel"||I.kind==="curds")&&(f+=I.mass_g,g+=b,x.setRGB(I.rgb[0],I.rgb[1],I.rgb[2]),v=Math.min(v,I.kind==="gel"?.4:.8))}this.bedTargetVol=n,s>0&&this.bedColorTarget.setRGB(r/s,o/s,a/s),this.bedMat.roughness=v,l>1e-5?(this.suspendedColor.setRGB(c/l,h/l,u/l),this.suspendedDiameterUm=p/l,this.suspendedTargetCount=Math.min(this.precip.cap,Math.floor(30+Math.sqrt(l)*520))):this.suspendedTargetCount=0;const M=d>1e-4?Math.min(48,Math.floor(6+Math.sqrt(d)*40)):0;M!==this.crystalCount&&(this.crystalCount=M,this.layoutCrystals(s>0?this.bedColorTarget:new Et(1,1,1)));const _=f>1e-4?Math.min(40,Math.floor(4+Math.sqrt(f)*30)):0;_!==this.lumpCount&&(this.lumpCount=_,this.layoutLumps(x,f>0?g/f:0)),m?(this.ribbonTarget=Math.max(.05,Math.min(1,m.remaining_fraction??1)),this.ribbonFloating=!!m.floating,this.ribbonMat.color.setRGB(m.rgb[0],m.rgb[1],m.rgb[2])):this.ribbonTarget=0}layoutCrystals(t){const e=this.profile,n=this.crystalCount;this.crystals.count=n,this.crystals.visible=n>0,this.crystalPolar=[];for(let s=0;s<n;s++)this.crystalPolar.push({a:Qe(s,1)*Math.PI*2,f:Math.sqrt(Qe(s,2)),s:(.07+Qe(s,3)*.13)*Math.min(1.2,e.rimInnerRadius/3),rot:Qe(s,4)}),this.crystals.setColorAt(s,yh.copy(t).multiplyScalar(.85+Qe(s,8)*.25));this.crystals.instanceColor&&(this.crystals.instanceColor.needsUpdate=!0),this.placeCrystals()}placeCrystals(){const t=this.crystalCount;if(t===0)return;const e=Math.max(.1,Math.max(this.bed.rS,this.bed.rp)*.85);for(let n=0;n<t;n++){const s=this.crystalPolar[n];if(!s)break;const r=s.f*e,o=s.s;an.set(Math.cos(s.a)*r,this.bedSurfaceAt(r)+o*.4,Math.sin(s.a)*r),pi.setFromEuler(xh.set(Qe(n,4)*3,Qe(n,5)*3,Qe(n,6)*3)),Xn.set(o,o*(1.1+Qe(n,7)*.7),o),Yn.compose(an,pi,Xn),this.crystals.setMatrixAt(n,Yn)}this.crystals.instanceMatrix.needsUpdate=!0}layoutLumps(t,e){const n=this.profile,s=this.lumpCount;this.lumps.count=s,this.lumps.visible=s>0,this.lumps.material.color.copy(t),this.lumpState=[];for(let r=0;r<s;r++){const o=Qe(r,11)<e;this.lumpState.push({x:0,y:0,z:0,s:(.12+Qe(r,12)*.23)*Math.min(1.3,n.rimInnerRadius/3),floatY:Qe(r,13),susp:o,ph:Qe(r,14)*6.28})}}popStopper(){if(!this.stopper.visible&&!this.sealed)return;this.stopperFlying=!0,this.stopperT=0,this.stopper.visible=!0,this.stopperV.set(Lt(-25,25),Lt(160,220),Lt(-10,25)),this.stopperW.set(Lt(-12,12),Lt(-6,6),Lt(-12,12)),this.sealed=!1;const t=this.profile.rimY;for(let e=0;e<26;e++){const n=Math.random()*Math.PI*2,s=Lt(10,40);this.smoke.spawn(Math.cos(n)*.5,t+.5,Math.sin(n)*.5,Math.cos(n)*s,Lt(10,60),Math.sin(n)*s,Lt(.6,1.2),1,5,.22,.95,.96,.97,0,3.5,3)}}spatter(t){const e=this.liquid.fillY,n=new Et(this.liquid.getApparentHex());for(let s=0;s<t;s++){const r=Math.random()*Math.PI*2;this.splash.spawn(Math.cos(r)*.5,e,Math.sin(r)*.5,Math.cos(r)*Lt(5,20),Lt(40,90),Math.sin(r)*Lt(5,20),1.5,.25,.2,.9,n.r,n.g,n.b,981,0,0)}}triggerBurst(){if(this.burst)return;this.burst=!0;const t=this.profile,e=this.liquid.volumeMl,n=new Et(this.liquid.getApparentHex());this.onBurst?.(),this.bubbles.clear(),this.precip.clear(),this.foam.visible=!1,this.cond.visible=!1,this.crystals.visible=!1,this.lumps.visible=!1,this.ribbon.visible=!1,this.stirBar.visible=!1,this.bedSide&&(this.bedSide.visible=!1),this.bedTop&&(this.bedTop.visible=!1),this.sealed&&this.popStopper();const s=34,r=new sn({color:15923445,roughness:.04,metalness:0,transparent:!0,opacity:.38,envMapIntensity:2,clearcoat:1,side:je,depthWrite:!1});this.shards=new Ps(dM(),r,s),this.shards.frustumCulled=!1,this.shards.instanceMatrix.setUsage(Qn),this.shards.raycast=()=>{},this.group.add(this.shards);for(let o=0;o<s;o++){const a=Math.random()*Math.PI*2,l=Lt(.2,t.rimY),c=zs(t,l),h=Lt(40,140);this.shardState.push({p:new T(Math.cos(a)*c,l,Math.sin(a)*c),v:new T(Math.cos(a)*h,Lt(30,160),Math.sin(a)*h),r:new ln(Lt(0,6),Lt(0,6),Lt(0,6)),w:new T(Lt(-20,20),Lt(-20,20),Lt(-20,20)),s:Lt(.4,1.6)*Math.min(1.5,t.rimInnerRadius/2.5),rest:!1})}for(let o=0;o<60;o++){const a=Math.random()*Math.PI*2,l=Lt(20,90);this.splash.spawn(Math.cos(a)*1,Lt(.5,Math.max(1,this.liquid.fillY)),Math.sin(a)*1,Math.cos(a)*l,Lt(20,120),Math.sin(a)*l,2,Lt(.2,.5),.15,.85,n.r,n.g,n.b,981,.2,0)}e>.5&&this.ensurePuddle(n,Math.min(30,Math.sqrt(e/(Math.PI*.22)))),this.setRenderOrderBase(this.renderBase)}ensurePuddle(t,e){if(this.puddle)this.puddleMat&&this.puddleMat.color.lerp(t,.5);else{this.puddleMat=new sn({color:t,roughness:.03,metalness:0,transparent:!0,opacity:.55,clearcoat:1,envMapIntensity:1.5,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2});const n=new Ks(1,48),s=n.attributes.position;for(let r=1;r<s.count;r++){const o=s.getX(r),a=s.getY(r),l=Math.atan2(a,o),c=1+.12*Math.sin(l*3+1)+.08*Math.sin(l*7+2)+.05*Math.sin(l*11);s.setXY(r,o*c,a*c)}n.rotateX(-Math.PI/2),this.puddle=new tt(n,this.puddleMat),this.puddle.position.y=this.floorY+.04,this.puddle.scale.setScalar(.01),this.puddle.raycast=()=>{},this.puddle.receiveShadow=!0,this.group.add(this.puddle),this.puddle.renderOrder=this.renderBase}this.puddleTarget=Math.max(this.puddleTarget,e)}splashAt(t,e,n,s,r){const o=this.liquid.fillY;this.liquid.impact(t,e,r,this.time);for(let a=0;a<s;a++){const l=Math.random()*Math.PI*2,c=Lt(3,14)*r;this.splash.spawn(t,o+.05,e,Math.cos(l)*c,Lt(15,45)*r,Math.sin(l)*c,.6,Lt(.08,.18),.06,.8,n.r,n.g,n.b,981,0,1)}}smokeBehaviour(t,e){const n=this.smoke.kind[t],s=t*3,r=this.smoke.pos,o=this.smoke.vel,a=this.profile,l=this.smoke.seed[t],c=this.smoke.life[t];if(n===0||n===1){o[s]+=Math.sin(c*1.7+l)*2.5*e,o[s+2]+=Math.cos(c*1.3+l*1.7)*2.5*e;const h=r[s+1];if(h<a.rimY){const u=Math.max(.2,ye(a,Math.min(h,a.innerTopY))-.3),d=Math.hypot(r[s],r[s+2]);d>u&&(r[s]*=u/d,r[s+2]*=u/d)}}else if(n===2){const h=r[s+1],u=Math.hypot(r[s],r[s+2])+1e-4,d=r[s]/u,f=r[s+2]/u,g=a.rimOuterRadius+.4;if(h>=a.rimY-.3&&u<g)o[s]+=d*9*e,o[s+2]+=f*9*e,o[s+1]=Math.max(o[s+1]-6*e,-.5);else if(u>=g&&h>this.floorY+.6){o[s+1]-=14*e,o[s+1]=Math.max(o[s+1],-8);const v=zs(a,Math.max(0,Math.min(h,a.rimY)))+.6;u<v&&(r[s]=d*v,r[s+2]=f*v)}else if(h<=this.floorY+.6)r[s+1]=this.floorY+.6,o[s+1]=0,o[s]+=d*2.5*e,o[s+2]+=f*2.5*e;else if(h<a.rimY-.3){o[s+1]=Math.max(o[s+1],.8);const v=Math.max(.2,ye(a,Math.min(h,a.innerTopY))-.3);u>v&&(r[s]=d*v,r[s+2]=f*v)}}return!0}splashBehaviour(t,e){const n=this.splash.kind[t],s=t*3,r=this.splash.pos,o=this.splash.vel;if(n===1){if(o[s+1]<0&&r[s+1]<this.liquid.fillY)return!1}else if(n===4){const a=this.profile,l=r[s+1],c=Math.hypot(r[s],r[s+2])+1e-4,h=zs(a,Math.max(0,Math.min(l,a.rimY)))+.15;l>this.floorY+.1?(r[s]*=h/c,r[s+2]*=h/c):(r[s+1]=this.floorY+.1,o[s+1]=0,o[s]=r[s]/c*2,o[s+2]=r[s+2]/c*2)}return r[s+1]<this.floorY+.05&&(r[s+1]=this.floorY+.05,o[s+1]=0,o[s]*=.5,o[s+2]*=.5),!0}precipBehaviour(t,e){const n=t*3,s=this.precip.pos,r=this.profile,o=this.liquid.fillY,a=this.precip.seed[t],l=this.stirRpm>0?Math.min(4.5,this.stirRpm/60*6.283*.12):.12+(this.snap?.boil_intensity??0)*2,c=s[n],h=s[n+2],u=Math.cos(l*e),d=Math.sin(l*e);s[n]=c*u-h*d,s[n+2]=c*d+h*u;const f=Math.min(1.2,.02+25e-5*this.suspendedDiameterUm*this.suspendedDiameterUm)*(this.stirRpm>0?.15:1);s[n+1]+=(-f+Math.sin(this.time*1.3+a)*.25)*e,s[n]+=Math.sin(this.time*2.1+a*3.1)*.15*e,s[n+2]+=Math.cos(this.time*1.9+a*2.3)*.15*e;const g=this.bedLevelY(),v=s[n+1];if(v<Math.max(g,r.innerBottomY)+.04)return!1;v>o-.05&&(s[n+1]=o-.05);const m=Math.max(.05,ye(r,s[n+1])-.08),p=Math.hypot(s[n],s[n+2]);return p>m&&(s[n]*=m/p,s[n+2]*=m/p),!0}safe(t,e){try{e()}catch(n){if(this.failed.has(t))return;this.failed.add(t),console.warn(`[effects] ${t} failed (the other effects keep running)`,n)}}tick(t,e){this.time=e;const n=this.snap,s=this.profile,r=this.liquid,o=r.fillY,a=r.volumeMl>.05&&!this.burst,l=r.surfaceRadius,c=r.getApparentHex();c!==this.appHex&&(this.appHex=c,this.appColor.set(c));const h=this.appColor;this.safe("bubbles",()=>{if(n&&a){for(const f of n.gas_fluxes)this.spawnGas(f,t,o);if(n.boil_intensity>.01)for(this.spawnAcc.boil+=n.boil_intensity*55*t;this.spawnAcc.boil>=1;){this.spawnAcc.boil-=1;const f=ye(s,s.innerBottomY+.3)*.8,g=Math.random()*Math.PI*2,v=Math.sqrt(Math.random())*f,m=Lt(.12,.42)*Math.min(1.2,s.rimInnerRadius/2.5)*(.5+n.boil_intensity*.6);this.bubbles.spawn(Math.cos(g)*v,s.innerBottomY+m,Math.sin(g)*v,m,Lt(16,32),1)}}const u=this.stirRpm>0?Math.min(4.5,this.stirRpm/60*6.283*.12):0,d={n:0};this.bubbles.material.uniforms.uTint.value.copy(h),this.bubbles.update(t,a?o:-1e3,f=>ye(s,Math.min(f,s.innerTopY)),u,(f,g,v,m)=>{if(d.n++,d.n<6&&(this.splash.spawn(f,g+.02,v,0,m*6,0,.12,m*1.6,m*3.2,.45,1,1,1,0,0,1),m>.12&&Math.random()<.5)){const p=Math.random()*6.28;this.splash.spawn(f,g+.05,v,Math.cos(p)*8,Lt(25,60),Math.sin(p)*8,.5,m*.5,m*.3,.8,h.r,h.g,h.b,981,0,1)}})}),this.safe("foam",()=>{this.foamLevel+=(this.foamTarget-this.foamLevel)*Math.min(1,t*1.5),this.updateFoam(e,o,a,h)}),this.safe("condensation",()=>{const u=this.cond.visible?this.condMat.uniforms.uAmount.value:0,d=this.burst?0:this.condLevel,f=u+(d-u)*Math.min(1,t*.8);this.condMat.uniforms.uAmount.value=f,this.cond.visible=f>.01}),this.safe("steam/fumes",()=>{if(n&&!this.burst){const u=n.vapour_visibility;if(u>.01)for(this.spawnAcc.steam+=u*20*t;this.spawnAcc.steam>=1;){this.spawnAcc.steam-=1;const d=Math.random()*Math.PI*2,f=Math.sqrt(Math.random())*l*.8,g=a?o+.2:s.innerBottomY+.5,v=Math.min(2,l*.5);this.smoke.spawn(Math.cos(d)*f,g,Math.sin(d)*f,Lt(-.5,.5),Lt(3.5,7),Lt(-.5,.5),Lt(2.4,3.6),v,v*3.5+2,Math.min(.2,.06+u*.1),.94,.95,.97,-.6,.35,0)}for(const d of n.fumes)this.spawnFume(d,t,a?o:s.innerBottomY+.5,l)}}),this.safe("spill",()=>{if(this.spillTime>0&&!this.burst){for(this.spillTime-=t,this.spawnAcc.spill+=40*t;this.spawnAcc.spill>=1;){this.spawnAcc.spill-=1;const u=Math.random()*Math.PI*2,d=s.rimOuterRadius+.15,g=this.foamLevel>.2||Math.random()<.4?new Et(.95,.96,.97):h;this.splash.spawn(Math.cos(u)*d,s.rimY,Math.sin(u)*d,0,Lt(-3,0),0,Lt(1.5,2.5),Lt(.35,.6),Lt(.5,.9),.85,g.r,g.g,g.b,60,.5,4)}this.ensurePuddle(h,s.maxOuterRadius+2.5)}}),this.safe("precipitate cloud",()=>{const u=a?this.suspendedTargetCount:0;if(this.precip.live<u)for(this.spawnAcc.precip+=Math.max(30,u)*t*2;this.spawnAcc.precip>=1&&this.precip.live<u;){this.spawnAcc.precip-=1;const d=Lt(s.innerBottomY+.2,Math.max(s.innerBottomY+.3,o-.1)),f=ye(s,d)*.92,g=Math.random()*Math.PI*2,v=Math.sqrt(Math.random())*f,m=Lt(.85,1.1),p=this.suspendedColor,x=Lt(.12,.3)*Math.min(1.2,Math.max(.6,s.rimInnerRadius/3));this.precip.spawn(Math.cos(g)*v,d,Math.sin(g)*v,0,0,0,Lt(5,10),x,x*1.2,.7,p.r*m,p.g*m,p.b*m,0,0,0)}else if(this.precip.live>u+10)for(let d=u;d<this.precip.live;d++)this.precip.maxLife[d]=Math.min(this.precip.maxLife[d],this.precip.life[d]+.8)}),this.safe("settled bed",()=>{this.bedVol+=(this.bedTargetVol-this.bedVol)*Math.min(1,t*1.2),this.bedColor.lerp(this.bedColorTarget,Math.min(1,t*2)),this.bedMat.color.copy(this.bedColor),this.updateBed()}),this.safe("lumps",()=>{this.lumpCount>0&&!this.burst&&this.updateLumps(e,o,a)}),this.safe("metal ribbon",()=>{if(this.ribbonScale+=(this.ribbonTarget-this.ribbonScale)*Math.min(1,t*1.5),this.ribbonScale>.03&&!this.burst){this.ribbon.visible=!0;const u=this.ribbon.userData.baseScale,d=u*this.ribbonScale,f=n?n.gas_fluxes.some(x=>x.nucleation==="solid"&&x.rate_ml_s>.01):!1;this.ribbon.scale.set(d,u*(.6+.4*this.ribbonScale),u);const g=a?Math.max(s.innerBottomY+.4,o-.35):s.innerBottomY+.3,v=this.bedLevelY()+.35,m=this.ribbonFloating?g:v;this.ribbon.position.y+=(m-this.ribbon.position.y)*Math.min(1,t*2);const p=f?Math.sin(e*9)*.04:0;this.ribbon.position.y+=p,this.ribbon.rotation.set(.25+Math.sin(e*.7)*(f?.08:0),e*(f?.25:.02),.1)}else this.ribbon.visible=!1}),this.safe("stir bar",()=>{this.stirRpm>0&&!this.burst?(this.stirBar.visible=!0,this.stirAngle+=Math.min(30,this.stirRpm/60*6.283)*t,this.stirBar.rotation.y=this.stirAngle):this.stirBar.visible=!1}),this.safe("flame",()=>{const u=n?.flame;if(u&&u.power_w>.5&&!this.burst){const d=Math.min(24,3.5+Math.sqrt(u.power_w)*1.6),f=Math.max(1.5,l*1.5),g=u.emitter_rgb?new Et(u.emitter_rgb[0],u.emitter_rgb[1],u.emitter_rgb[2]):void 0;this.flame.configure(l*.6,f,d,{luminosity:Math.max(0,Math.min(1,u.luminosity)),emitter:g,emitterAmount:g?.75:0}),this.flame.setTarget(Math.min(1.6,.6+u.power_w/300)),this.flame.group.position.y=a?o:s.innerBottomY+.2}else this.flame.setTarget(0);this.flame.tick(t,e)}),this.safe("stopper",()=>{this.stopperFlying&&this.updateStopper(t)}),this.safe("shards/puddle",()=>{this.shards&&this.updateShards(t),this.puddle&&(this.puddleR+=(this.puddleTarget-this.puddleR)*Math.min(1,t*1.8),this.puddle.scale.setScalar(Math.max(.01,this.puddleR)))}),this.safe("smoke",()=>this.smoke.update(t)),this.safe("splash",()=>this.splash.update(t)),this.safe("precipitate particles",()=>this.precip.update(t))}spawnGas(t,e,n){if(t.rate_ml_s<=1e-4)return;const s=this.profile;let r=Math.max(.4,Math.min(6,t.bubble_diameter_mm||2)),o=t.rate_ml_s/(Math.PI/6*Math.pow(r/10,3));const a=170;o>a&&(r=Math.min(7,r*Math.cbrt(o/a)),o=a),this.spawnAcc.bubbles+=o*e;const l=r/20,c=Math.min(30,5+r*5.5),h=this.bedLevelY();let u=0;for(;this.spawnAcc.bubbles>=1&&u++<40;){this.spawnAcc.bubbles-=1;const d=l*Lt(.6,1.3);let f=0,g=0,v=0;const m=Math.max(s.innerBottomY+.2,n-.2);if(t.nucleation==="wall"){g=Lt(s.innerBottomY+.15,m);const p=ye(s,g)-d-.02,x=Math.random()*Math.PI*2;f=Math.cos(x)*p,v=Math.sin(x)*p}else if(t.nucleation==="solid")if(this.ribbon.visible)an.set(Lt(-2.5,2.5),Lt(-.3,.3),Lt(-.4,.4)),this.ribbon.localToWorld(an),this.group.worldToLocal(an),f=an.x,g=Math.min(an.y,m),v=an.z;else{g=Math.max(h,s.innerBottomY)+.05+d;const p=ye(s,g)*.85,x=Math.random()*Math.PI*2,M=Math.sqrt(Math.random())*p;f=Math.cos(x)*M,v=Math.sin(x)*M}else{g=Lt(s.innerBottomY+.15,m);const p=ye(s,g)*.9,x=Math.random()*Math.PI*2,M=Math.sqrt(Math.random())*p;f=Math.cos(x)*M,v=Math.sin(x)*M}this.bubbles.spawn(f,g,v,d,c*Lt(.8,1.2))}this.spawnAcc.bubbles>2&&(this.spawnAcc.bubbles=2)}spawnFume(t,e,n,s){if(!(t.intensity<=.005))for(this.spawnAcc.fume+=t.intensity*26*e;this.spawnAcc.fume>=1;){this.spawnAcc.fume-=1;const r=Math.random()*Math.PI*2,o=Math.sqrt(Math.random())*s*.8,a=Math.min(1.8,s*.5),l=Math.min(.5,.08+t.opacity*.35)*Math.min(1,.4+t.intensity);t.denser_than_air?this.smoke.spawn(Math.cos(r)*o,n+.2,Math.sin(r)*o,0,Lt(1.2,2.5),0,Lt(4,6),a,a*3+2,l,t.rgb[0],t.rgb[1],t.rgb[2],0,.6,2):this.smoke.spawn(Math.cos(r)*o,n+.2,Math.sin(r)*o,Lt(-.4,.4),Lt(3,6),Lt(-.4,.4),Lt(2.5,3.5),a,a*3+2,l,t.rgb[0],t.rgb[1],t.rgb[2],-.4,.3,1)}}updateFoam(t,e,n,s){const r=this.profile,o=n?this.foamLevel:0;if(o<.02){this.foam.visible=!1;return}const a=Math.max(.3,Math.min(r.rimY+1-e,1.2+r.rimInnerRadius*.8)),l=o*a,c=Math.min(.32,Math.max(.1,r.rimInnerRadius*.08)),h=c*1.3;let u=0;const d=(this.snap?.gas_fluxes.length??0)>0?1:.3;for(let f=0;f<this.foamCells.length;f++){const g=this.foamCells[f],v=g.layer*h;if(v>l+h*.5||g.layer===0&&g.u>.15+o*3)continue;const m=e+v+c*.4,p=Math.max(.1,ye(this.profile,Math.min(m,r.innerTopY))-c*.6),x=m>r.innerTopY?(m-r.innerTopY)*.6:0,M=g.u*(p+x),_=Math.sin(t*2.5+g.ph)*.08*d,I=c*g.r*(1+_)*(v>l?Math.max(.2,1-(v-l)/(h*.5)):1);an.set(Math.cos(g.v)*M,m,Math.sin(g.v)*M),Xn.set(I,I*.85,I),Yn.compose(an,pi.identity(),Xn),this.foam.setMatrixAt(u,Yn),u++}this.foam.count=u,this.foam.visible=u>0,this.foamMat.color.setRGB(.9+s.r*.1,.9+s.g*.1,.9+s.b*.1),this.foam.instanceMatrix.needsUpdate=!0}floorYAt(t){const e=this.profile.inner;for(let n=0;n<e.length-1;n++){const s=e[n],r=e[n+1];if(r.x>=t&&r.x>s.x&&s.x<=t)return s.y+(r.y-s.y)*(t-s.x)/Math.max(1e-6,r.x-s.x)}return this.profile.innerBottomY}bedSurfaceAt(t){const{yb:e,rp:n,H:s}=this.bed,r=n>1e-4?Math.max(0,1-t/n*(t/n)):0;return Math.max(this.floorYAt(t)+.012,e+s*r)}bedLevelY(){const t=this.profile;return this.bedVol<.003?t.innerBottomY:this.bed.yb+this.bed.H*.5}updateBed(){const t=this.profile,e=this.bedVol;if(e<.003||this.burst){this.bed.vol=-1,this.bedSide&&(this.bedSide.visible=!1),this.bedTop&&(this.bedTop.visible=!1);return}const n=this.liquid.volumeMl>.3,s=n?.2:.34,r=Math.max(.12,ye(t,t.innerBottomY+.25)-.05);let o=Math.max(Math.cbrt(2*e/(Math.PI*s)),Math.min(.5,r)),a=t.innerBottomY,l=s*o;if(o>r){o=r,l=s*r;const E=Math.PI*o*o*l/2;a=tr(t,Math.max(0,e-E))}a=Math.min(a,t.innerTopY-.4),l=Math.min(l,Math.max(.05,t.innerTopY-.2-a));const c=ye(t,Math.max(a,t.innerBottomY+.05))-.04,h=a>t.innerBottomY+.03,u=h?Math.max(.1,c):Math.max(.1,Math.min(o,c)),d=this.bed,f=d.vol>=0&&d.wet===n&&Math.abs(e-d.vol)/Math.max(e,.02)<.015;if(this.bed={yb:a,rp:o,H:l,rS:u,wet:n,vol:f?d.vol:e},f&&this.bedSide&&this.bedTop){this.bedSide.visible=h,this.bedTop.visible=!0;return}let g=null;if(h){const E=[];for(const C of t.inner)C.y<a&&E.push(new H(Math.max(0,C.x-.04),C.y+.01));E.push(new H(u,this.bedSurfaceAt(u))),g=new Ue(E,48)}const v=20,m=48,p=new Float32Array((1+v*m)*3),x=this.bedSeed,M=[],_=(E,C,P)=>{const b=this.bedSurfaceAt(P),y=o>1e-4?Math.max(0,1-P/o):0,R=(Math.sin(E*5.3+x)*Math.cos(C*4.1-x)*.5+Math.sin(E*12.1+C*9.7)*.25)*(.012+Math.min(.05,l*.12)*Math.min(1,y*2));return Math.min(t.innerTopY-.1,b+R)};p[0]=0,p[1]=_(0,0,0),p[2]=0;for(let E=1;E<=v;E++){const C=u*E/v;for(let P=0;P<m;P++){const b=P/m*Math.PI*2,y=Math.cos(b)*C,R=Math.sin(b)*C,O=(1+(E-1)*m+P)*3;p[O]=y,p[O+1]=_(y,R,C),p[O+2]=R}}for(let E=0;E<m;E++)M.push(0,1+(E+1)%m,1+E);for(let E=1;E<v;E++){const C=1+(E-1)*m,P=1+E*m;for(let b=0;b<m;b++){const y=(b+1)%m;M.push(C+b,C+y,P+b,C+y,P+y,P+b)}}const I=new pe;I.setAttribute("position",new Re(p,3)),I.setIndex(M),I.computeVertexNormals(),this.bedTop?(this.bedTop.geometry.dispose(),this.bedTop.geometry=I,this.bedSide.geometry.dispose(),this.bedSide.geometry=g??new pe):(this.bedTop=new tt(I,this.bedMat),this.bedTop.raycast=()=>{},this.bedTop.receiveShadow=!0,this.bedTop.frustumCulled=!1,this.bedSide=new tt(g??new pe,this.bedMat),this.bedSide.raycast=()=>{},this.bedSide.receiveShadow=!0,this.bedSide.frustumCulled=!1,this.group.add(this.bedSide,this.bedTop)),this.bedSide.visible=h,this.bedTop.visible=!0,this.placeCrystals()}updateLumps(t,e,n){const s=this.profile,r=Math.max(this.bedLevelY(),s.innerBottomY);for(let o=0;o<this.lumpCount;o++){const a=this.lumpState[o];let l;a.susp&&n?l=r+.3+a.floatY*Math.max(.2,e-r-.6)+Math.sin(t*.6+a.ph)*.15:l=r+a.s*.5;const c=Math.max(.1,ye(s,l)-a.s),h=a.ph+(a.susp?t*.15:0)+(this.stirRpm>0?t*1.5:0),u=c*(.2+.75*(a.ph*7.3%1));a.x=Math.cos(h)*u,a.z=Math.sin(h)*u,a.y=l,an.set(a.x,a.y,a.z),pi.setFromEuler(xh.set(a.ph,a.ph*2,0)),Xn.set(a.s,a.s*.7,a.s*.9),Yn.compose(an,pi,Xn),this.lumps.setMatrixAt(o,Yn)}this.lumps.instanceMatrix.needsUpdate=!0}updateStopper(t){this.stopperT+=t;const e=this.stopper;this.stopperV.y-=981*t,e.position.addScaledVector(this.stopperV,t),e.rotation.x+=this.stopperW.x*t,e.rotation.y+=this.stopperW.y*t,e.rotation.z+=this.stopperW.z*t;const n=this.floorY+e.scale.y*.5;e.position.y<n&&(e.position.y=n,this.stopperV.y=Math.abs(this.stopperV.y)*.35,this.stopperV.x*=.6,this.stopperV.z*=.6,this.stopperW.multiplyScalar(.5),this.stopperV.y<20&&(this.stopperV.set(0,0,0),this.stopperW.set(0,0,0),e.rotation.x=Math.PI/2)),this.stopperT>6&&(this.stopperFlying=!1,e.visible=this.sealed,e.position.set(0,e.userData.homeY,0),e.rotation.set(0,0,0))}updateShards(t){const e=this.shards;let n=!1;for(let s=0;s<this.shardState.length;s++){const r=this.shardState[s];if(!r.rest){n=!0,r.v.y-=981*t,r.p.addScaledVector(r.v,t),r.r.x+=r.w.x*t,r.r.y+=r.w.y*t,r.r.z+=r.w.z*t;const o=this.floorY+.04;r.p.y<o&&(r.p.y=o,r.v.y=Math.abs(r.v.y)*.25,r.v.x*=.45,r.v.z*=.45,r.w.multiplyScalar(.4),r.v.y<15&&(r.rest=!0,r.r.x=Math.PI/2+Lt(-.1,.1),r.r.y=Lt(-.1,.1)))}pi.setFromEuler(r.r),Xn.setScalar(r.s),Yn.compose(r.p,pi,Xn),e.setMatrixAt(s,Yn)}e.count=this.shardState.length,n&&(e.instanceMatrix.needsUpdate=!0)}flameStrength(t){return this.flame.brightness(t)}flameLocalY(){return this.flame.group.position.y+3}isAnimating(){return this.stopperFlying||!!this.shards&&this.shardState.some(t=>!t.rest)||this.stirRpm>0||this.bubbles.live>0}dispose(){this.bubbles.dispose(),this.smoke.dispose(),this.splash.dispose(),this.precip.dispose(),this.flame.dispose(),this.foamMat.dispose(),this.foam.dispose(),this.condMat.dispose(),this.bedMat.dispose(),this.bedSide?.geometry.dispose(),this.bedTop?.geometry.dispose(),this.crystals.material.dispose(),this.crystals.dispose(),this.lumps.material.dispose(),this.lumps.dispose(),this.ribbonMat.dispose(),this.stirBar.material.dispose(),this.stopper.material.dispose(),this.shards&&(this.shards.material.dispose(),this.shards.dispose()),this.puddle&&(this.puddle.geometry.dispose(),this.puddleMat?.dispose())}}const _M={tint:15923445,baseAlpha:.035,fresnelAlpha:.55,edgeTint:7316885,roughness:.03,envMapIntensity:1.6};function uo(i,t={}){const e={..._M,...t},n=new sn({color:e.tint,metalness:0,roughness:e.roughness,ior:1.47,specularIntensity:1,clearcoat:.6,clearcoatRoughness:.02,envMapIntensity:e.envMapIntensity,transparent:!0,opacity:e.baseAlpha,depthWrite:!1,side:je});n.blending=go,n.blendEquation=_n,n.blendSrc=yi,n.blendDst=Xs,n.blendSrcAlpha=yi,n.blendDstAlpha=Xs,n.defines={...n.defines||{},...i?{GLASS_FAR:""}:{GLASS_NEAR:""}};const s=new Et(e.edgeTint),r=e.fresnelAlpha;return n.onBeforeCompile=o=>{o.uniforms.uFresnelAlpha={value:r},o.uniforms.uEdgeTint={value:s},o.vertexShader=o.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vGW;
varying vec3 vGC;`).replace("#include <project_vertex>",`#include <project_vertex>
        vec4 gwp = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          gwp = instanceMatrix * gwp;
          vGC = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
        #else
          vGC = ( modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
        #endif
        vGW = ( modelMatrix * gwp ).xyz;`),o.fragmentShader=o.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vGW;
varying vec3 vGC;
uniform float uFresnelAlpha;
uniform vec3 uEdgeTint;`).replace("void main() {",`void main() {
        {
          vec2 toFrag = vGW.xz - vGC.xz;
          vec2 toCam = cameraPosition.xz - vGC.xz;
          float sideTest = dot( toFrag, toCam );
          #ifdef GLASS_FAR
            if ( sideTest > 0.0 ) discard;
          #else
            if ( sideTest <= 0.0 ) discard;
          #endif
        }`).replace("#include <opaque_fragment>",`{
          float glNV = abs( dot( normalize( normal ), normalize( vViewPosition ) ) );
          float glF = pow( 1.0 - glNV, 3.0 );
          float glA = clamp( diffuseColor.a + glF * uFresnelAlpha, 0.0, 1.0 );
          vec3 glSpec = max( outgoingLight - totalDiffuse, vec3( 0.0 ) );
          vec3 col = totalDiffuse * glA + glSpec + uEdgeTint * glF * glA * 0.35;
          gl_FragColor = vec4( col, glA );
        }`)},n.customProgramCacheKey=()=>i?"glass_far":"glass_near",n}let ga=null;function Zu(){return ga||(ga=[uo(!0),uo(!1)]),ga}function er(i,t=Zu()){const e=new tt(i,t[1]),n=new tt(i,t[0]);return e.renderOrder=5,n.renderOrder=1,e.add(n),{near:e,far:n}}const es=32,Ju=400,Qu=10;let Vr=null;function MM(){if(Vr)return Vr;const i=(n,s,r,o)=>{const a=(n-s)/(n<s?r:o);return Math.exp(-.5*a*a)},t=[],e=[0,0,0];for(let n=0;n<es;n++){const s=Ju+Qu*n,r=1.056*i(s,599.8,37.9,31)+.362*i(s,442,16,26.7)-.065*i(s,501.1,20.4,26.2),o=.821*i(s,568.8,46.9,40.5)+.286*i(s,530.9,16.3,31.1),a=1.217*i(s,437,11.8,36)+.681*i(s,459,26,13.8),l=[3.2406*r-1.5372*o-.4986*a,-.9689*r+1.8758*o+.0415*a,.0557*r-.204*o+1.057*a];for(let c=0;c<3;c++)t.push(l[c]),e[c]+=l[c]}for(let n=0;n<es;n++)for(let s=0;s<3;s++)t[n*3+s]/=e[s];return Vr={n_bins:es,rgb_weights:t},Vr}function td(i,t,e){const n=i&&i.rgb_weights&&i.rgb_weights.length>=es*3?i:MM();let s=0,r=0,o=0;for(let a=0;a<es;a++){const l=t[a]||0,c=Math.pow(10,-l*e);s+=n.rgb_weights[a*3+0]*c,r+=n.rgb_weights[a*3+1]*c,o+=n.rgb_weights[a*3+2]*c}return[Math.max(0,Math.min(1,s)),Math.max(0,Math.min(1,r)),Math.max(0,Math.min(1,o))]}const De=4,fo=`
uniform float uFill;
uniform float uYb;
uniform float uR;
uniform float uConeA;
uniform float uConeB;
uniform float uTime;
uniform float uRipple;
uniform float uVortex;
uniform float uMeniscus;
uniform float uTopClamp;
uniform vec2 uSlosh;
uniform vec3 uUpObj;
uniform vec4 uImpact;
uniform int uLayerCount;
uniform float uLayerTop[${De}];
uniform vec3 uKOld[${De}];
uniform vec3 uKNew[${De}];
uniform vec4 uScat[${De}];
uniform float uMix;

float lqSurf( vec2 xz ) {
  float rr = length( xz );
  float r = rr / max( uR, 1e-3 );
  float h = 0.0;
  // free-surface tilt so the surface stays level in world space while the vessel tilts
  vec3 up = uUpObj;
  h += -( up.x * xz.x + up.z * xz.y ) / max( up.y, 0.3 );
  h += dot( uSlosh, xz );
  // meniscus (water wets glass): rises ~1 mm within ~1.5 mm of the wall
  h += uMeniscus * exp( -max( uR - rr, 0.0 ) / 0.13 );
  // stirring vortex (Rankine-like), roughly volume-neutral
  h += uVortex * ( 0.3 - 1.0 / ( 1.0 + 9.0 * r * r ) );
  // ripples
  float t = uTime;
  h += uRipple * (
      0.45 * sin( xz.x * 3.1 + t * 2.3 ) * sin( xz.y * 2.7 - t * 1.9 )
    + 0.30 * sin( rr * 5.0 - t * 4.2 )
    + 0.25 * sin( ( xz.x - xz.y ) * 7.3 + t * 5.7 ) );
  // impact ring from pours / drops
  float age = t - uImpact.z;
  if ( age > 0.0 && age < 2.5 ) {
    float d = distance( xz, uImpact.xy );
    float ring = d - age * 9.0;
    h += uImpact.w * sin( ring * 5.0 ) * exp( -ring * ring * 1.5 ) * exp( -age * 1.8 ) * 0.12;
  }
  return h;
}

float lqSurfY( vec2 xz ) {
  return min( uFill + lqSurf( xz ), uTopClamp );
}
`,ed=`
attribute float aTop;
varying vec3 vObj;
varying vec3 vRay;
varying float vTop;
vec3 lqDisplace( vec3 p, out vec3 n ) {
  if ( aTop > 0.5 ) {
    vec2 xz = p.xz * uR;
    float h0 = lqSurf( xz );
    float e = 0.05 * uR + 0.02;
    float hx = lqSurf( xz + vec2( e, 0.0 ) );
    float hz = lqSurf( xz + vec2( 0.0, e ) );
    n = normalize( vec3( -( hx - h0 ) / e, 1.0, -( hz - h0 ) / e ) );
    return vec3( xz.x, min( uFill + h0, uTopClamp ), xz.y );
  }
  n = normal;
  return p;
}
`,nd=`
varying vec3 vObj;
varying vec3 vRay;
varying float vTop;

float lqExit( vec3 p, vec3 d ) {
  float A = uConeA;
  float B = uConeB;
  float ry = A + B * p.y;
  float a = d.x * d.x + d.z * d.z - B * B * d.y * d.y;
  float b = 2.0 * ( p.x * d.x + p.z * d.z - B * d.y * ry );
  float c = p.x * p.x + p.z * p.z - ry * ry;
  float t = 1e4;
  if ( abs( a ) > 1e-6 ) {
    float disc = b * b - 4.0 * a * c;
    if ( disc > 0.0 ) {
      float s = sqrt( disc );
      float t1 = ( -b - s ) / ( 2.0 * a );
      float t2 = ( -b + s ) / ( 2.0 * a );
      float tn = min( t1, t2 );
      float tf = max( t1, t2 );
      // The wall fragment sits ON the real wall, which the fitted cone only approximates (round tube bottoms, shoulders),
      // so p can be a hair outside the cone and the near root is a spurious re-entry: always leave through the far root.
      // (Taking the nearest positive root made most of a test tube's liquid optically clear.)
      if ( a > 0.0 ) {
        if ( tf > 0.02 ) t = tf;
      } else {
        if ( tn > 0.02 ) t = tn;
        else if ( tf > 0.02 ) t = tf;
      }
    }
  }
  if ( d.y < -1e-4 ) t = min( t, ( uYb - p.y ) / d.y );
  if ( d.y > 1e-4 ) t = min( t, ( uFill - p.y ) / d.y );
  return clamp( t, 0.0, 4.0 * uR + ( uFill - uYb ) + 1.0 );
}

float lqSeg( vec3 p, vec3 d, float tExit, float lo, float hi ) {
  if ( abs( d.y ) < 1e-4 ) return ( p.y >= lo && p.y <= hi ) ? tExit : 0.0;
  float t0 = ( lo - p.y ) / d.y;
  float t1 = ( hi - p.y ) / d.y;
  float tmin = max( min( t0, t1 ), 0.0 );
  float tmax = min( max( t0, t1 ), tExit );
  return max( tmax - tmin, 0.0 );
}

// returns extinction optical depth (rgb) and writes in-scatter colour weight
vec3 lqOptics( out vec3 scatterCol, out float scatterAmt ) {
  vec3 p = vObj;
  vec3 d = normalize( vRay );
  float tExit = lqExit( p, d );
  float swirl = 0.5 + 0.5 * sin( p.x * 1.7 + sin( p.y * 2.1 + uTime * 1.3 ) * 1.6 + p.z * 1.3 - uTime * 0.7 );
  float depthN = ( uFill - p.y ) / max( uFill - uYb, 0.5 );
  float m = uMix >= 0.999 ? 1.0 : clamp( ( uMix * 1.45 - depthN * 0.6 - 0.2 + ( swirl - 0.5 ) * 0.55 ) * 3.0, 0.0, 1.0 );
  vec3 od = vec3( 0.0 );
  float sod = 0.0;
  scatterCol = vec3( 0.0 );
  scatterAmt = 0.0;
  float lo = -1e3;
  for ( int i = 0; i < ${De}; i++ ) {
    if ( i >= uLayerCount ) break;
    float hi = ( i == uLayerCount - 1 ) ? 1e3 : uLayerTop[ i ];
    float len = lqSeg( p, d, tExit, lo, hi );
    vec3 k = mix( uKOld[ i ], uKNew[ i ], m );
    float s = uScat[ i ].w;
    float before = exp( -sod );
    float added = before * ( 1.0 - exp( -s * len ) );
    // scattered light is itself tinted by the dissolved absorber over ~1 cm
    scatterCol += uScat[ i ].rgb * exp( -k * 0.6 ) * added;
    scatterAmt += added;
    od += k * len;
    sod += s * len;
    lo = hi;
  }
  // Even "clear" water is not invisible: a blue-green absorption over the chord (plus ~1 cm of "free" path so thin
  // films still read) gives the liquid body a readable tint at bench distance, without any per-reagent data.
  od += vec3( 0.09, 0.05, 0.026 ) * ( 1.0 + min( tExit, 6.0 ) );
  return od + vec3( sod );
}
`,bh=new Map;let In=null;function xM(i){let t=bh.get(i.type);if(t)return t;const e=i.inner.map(s=>new H(Math.max(0,s.x-.02),s.y+.005));t=new Ue(e,64);const n=t.attributes.position.count;return t.setAttribute("aTop",new Re(new Float32Array(n),1)),bh.set(i.type,t),t}function yM(){if(In)return In;const i=22,t=72,e=[],n=[],s=[],r=[];e.push(0,0,0),n.push(0,1,0),s.push(1);for(let o=1;o<=i;o++){const a=o/i,l=Math.min(.995,1-Math.pow(1-a,1.7));for(let c=0;c<t;c++){const h=c/t*Math.PI*2;e.push(Math.cos(h)*l,0,Math.sin(h)*l),n.push(0,1,0),s.push(1)}}for(let o=0;o<t;o++)r.push(0,1+(o+1)%t,1+o);for(let o=1;o<i;o++){const a=1+(o-1)*t,l=1+o*t;for(let c=0;c<t;c++){const h=(c+1)%t;r.push(a+c,a+h,l+c),r.push(a+h,l+h,l+c)}}return In=new pe,In.setAttribute("position",new jt(e,3)),In.setAttribute("normal",new jt(n,3)),In.setAttribute("aTop",new jt(s,1)),In.setIndex(r),In.boundingSphere=new si(new T,1e4),In}function bM(){const i=()=>Array.from({length:De},()=>new T);return{uFill:{value:0},uYb:{value:0},uR:{value:1},uConeA:{value:1},uConeB:{value:0},uTime:{value:0},uRipple:{value:.004},uVortex:{value:0},uMeniscus:{value:.09},uTopClamp:{value:100},uSlosh:{value:new H},uUpObj:{value:new T(0,1,0)},uImpact:{value:new ie(0,0,-100,0)},uLayerCount:{value:1},uLayerTop:{value:new Array(De).fill(0)},uKOld:{value:i()},uKNew:{value:i()},uScat:{value:Array.from({length:De},()=>new ie(1,1,1,0))},uMix:{value:1}}}function SM(i){const t=new nn({uniforms:i,vertexShader:`
      ${fo}
      ${ed}
      void main() {
        vec3 n;
        vec3 p = lqDisplace( position, n );
        vObj = p;
        vTop = aTop;
        vec3 camObj = ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;
        vRay = p - camObj;
        gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
      }`,fragmentShader:`
      ${fo}
      ${nd}
      void main() {
        if ( vTop < 0.5 && vObj.y > lqSurfY( vObj.xz ) ) discard;
        vec3 sc; float sa;
        vec3 od = lqOptics( sc, sa );
        vec3 T = exp( -od );
        if ( vTop < 0.5 ) {
          // refraction hint: a liquid column bends light away at its silhouette, so edges read darker
          vec3 nrm = normalize( vec3( vObj.x, 0.0, vObj.z ) + vec3( 1e-4 ) );
          float edge = 1.0 - abs( dot( nrm, normalize( vRay ) ) );
          T *= mix( 1.0, 0.45, pow( edge, 2.2 ) );
        }
        gl_FragColor = vec4( pow( T, vec3( 1.0 / 2.2 ) ), 1.0 );
      }`,transparent:!0,depthWrite:!1,side:bn});return t.blending=go,t.blendEquation=_n,t.blendSrc=oo,t.blendDst=su,t.blendSrcAlpha=oo,t.blendDstAlpha=yi,t.toneMapped=!1,t}function wM(i){const t=new sn({color:16777215,roughness:.035,metalness:0,ior:1.333,specularIntensity:1,envMapIntensity:1.25,transparent:!0,depthWrite:!1,side:bn});return t.blending=go,t.blendEquation=_n,t.blendSrc=yi,t.blendDst=yi,t.blendSrcAlpha=oo,t.blendDstAlpha=yi,t.onBeforeCompile=e=>{Object.assign(e.uniforms,i),e.vertexShader=e.vertexShader.replace("#include <common>",`#include <common>
${fo}
${ed}`).replace("#include <beginnormal_vertex>",`vec3 lqN;
        vec3 lqP = lqDisplace( position, lqN );
        vec3 objectNormal = lqN;
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`).replace("#include <begin_vertex>",`vec3 transformed = lqP;
        vObj = lqP;
        vTop = aTop;
        vRay = lqP - ( inverse( modelMatrix ) * vec4( cameraPosition, 1.0 ) ).xyz;`),e.fragmentShader=e.fragmentShader.replace("#include <common>",`#include <common>
${fo}
${nd}`).replace("#include <color_fragment>",`#include <color_fragment>
        float lqSY = lqSurfY( vObj.xz );
        if ( vTop < 0.5 && vObj.y > lqSY ) discard;
        vec3 lqSc; float lqSa;
        vec3 lqOd = lqOptics( lqSc, lqSa );
        diffuseColor.rgb = lqSa > 1e-4 ? lqSc / lqSa : vec3( 1.0 );`).replace("#include <opaque_fragment>",`{
          vec3 lqSpec = max( outgoingLight - totalDiffuse, vec3( 0.0 ) );
          float specScale = vTop > 0.5 ? 1.0 : 0.35;
          float iface = 0.0;
          if ( vTop < 0.5 ) {
            for ( int i = 0; i < ${De-1}; i++ ) {
              if ( i >= uLayerCount - 1 ) break;
              iface = max( iface, 1.0 - smoothstep( 0.0, 0.08, abs( vObj.y - uLayerTop[ i ] ) ) );
            }
          }
          // bright meniscus line just under the free surface + a faint sheen on the surface disc itself
          float lqLine = vTop < 0.5 ? 1.0 - smoothstep( 0.0, 0.16, lqSY - vObj.y ) : 0.0;
          // free surface: faint sheen + a bright meniscus ring where it meets the wall (outlines the level from any angle)
          float lqRing = vTop > 0.5 ? smoothstep( 0.86, 0.995, length( vObj.xz ) / max( uR, 1e-3 ) ) : 0.0;
          vec3 lqBase = vTop > 0.5 ? vec3( 0.03, 0.034, 0.038 ) + vec3( 0.07, 0.075, 0.08 ) * lqRing : vec3( 0.0 );
          gl_FragColor = vec4( totalDiffuse * lqSa * 1.1 + lqSpec * specScale + vec3( 0.16 ) * iface + vec3( 0.34, 0.36, 0.38 ) * lqLine + lqBase, 1.0 );
        }`)},t.customProgramCacheKey=()=>"liquid_surface_v3",t}const Sh=new T,wh=new Jt;function EM(i,t,e){return"#"+new Et().setRGB(Math.min(1,Math.max(0,i)),Math.min(1,Math.max(0,t)),Math.min(1,Math.max(0,e)),ii).getHexString(we)}class TM{constructor(t){this.profile=t,this.uniforms=bM(),this.uniforms.uYb.value=t.innerBottomY,this.uniforms.uTopClamp.value=t.innerTopY-.05,this._fillY=t.innerBottomY,this.Lref=Math.max(1,2*ye(t,t.innerBottomY+1)*.8),this.absorbMat=SM(this.uniforms),this.surfaceMat=wM(this.uniforms);const e=xM(t),n=yM();this.sideAbsorb=new tt(e,this.absorbMat),this.sideSurface=new tt(e,this.surfaceMat),this.topAbsorb=new tt(n,this.absorbMat),this.topSurface=new tt(n,this.surfaceMat);for(const s of[this.sideAbsorb,this.sideSurface,this.topAbsorb,this.topSurface])s.frustumCulled=!1,s.raycast=()=>{};this.sideAbsorb.add(this.sideSurface,this.topAbsorb,this.topSurface),this.root.add(this.sideAbsorb),this.setRenderOrderBase(0),this.sideAbsorb.visible=!1}root=new fe;sideAbsorb;sideSurface;topAbsorb;topSurface;uniforms;absorbMat;surfaceMat;Lref;targetCount=1;targets=Array.from({length:De},()=>({topMl:0,k:new T,scat:new ie(1,1,1,0)}));curTopMl=new Array(De).fill(0);totalMlTarget=0;totalMl=0;mixing=!1;rippleBase=.004;boil=0;gasAgitation=0;stirRpm=0;vortexCur=0;sloshAmp=0;sloshPhase=0;sloshDir=new H(1,0);_fillY;apparent="#f4f8fb";setRenderOrderBase(t){this.sideAbsorb.renderOrder=t+2,this.topAbsorb.renderOrder=t+2,this.sideSurface.renderOrder=t+3,this.topSurface.renderOrder=t+3}get fillY(){return this._fillY}get volumeMl(){return this.totalMl}get surfaceRadius(){return this.uniforms.uR.value}setLayers(t,e,n){(!(e>=0)||!isFinite(e))&&(e=0);const s=Math.min(De,t.length),r=t.reduce((c,h)=>c+Math.max(0,h.volume_ml||0),0),o=r>0?e/r:1;let a=0,l=s!==this.targetCount;for(let c=0;c<s;c++){const h=t[c];a+=Math.max(0,h.volume_ml||0)*o;const u=this.targets[c];u.topMl=a;const d=td(n,h.absorbance_per_cm??[],this.Lref),f=-Math.log(Math.max(d[0],.001))/this.Lref,g=-Math.log(Math.max(d[1],.001))/this.Lref,v=-Math.log(Math.max(d[2],.001))/this.Lref;this.kChange(u.k,f,g,v)&&(l=!0),u.k.set(f,g,v);const m=h.scatter_rgb??[1,1,1];u.scat.set(m[0],m[1],m[2],Math.max(0,h.scatter_per_cm||0))}s===0&&(this.targets[0].topMl=e,this.targets[0].k.set(0,0,0),this.targets[0].scat.set(1,1,1,0)),this.commitTargets(Math.max(1,s),e,l)}setSimple(t,e,n=.85){const s=new Et(e),r=Math.max(0,Math.min(1,n)),o=-Math.log(Math.max(s.r,.02))/this.Lref*r,a=-Math.log(Math.max(s.g,.02))/this.Lref*r,l=-Math.log(Math.max(s.b,.02))/this.Lref*r,c=this.targets[0],h=this.kChange(c.k,o,a,l);c.k.set(o,a,l),c.scat.set(1,1,1,0),c.topMl=t,this.commitTargets(1,t,h)}kChange(t,e,n,s){const r=Math.max(Math.abs(t.x-e),Math.abs(t.y-n),Math.abs(t.z-s)),o=Math.max(t.x,t.y,t.z,e,n,s,.05);return r>.04&&r/o>.18}commitTargets(t,e,n){const s=this.uniforms,r=this.totalMl<=1e-6&&e>0;if(this.targetCount=t,this.totalMlTarget=Math.max(0,e),r){for(let o=0;o<De;o++)s.uKOld.value[o].copy(this.targets[o].k),s.uKNew.value[o].copy(this.targets[o].k),s.uScat.value[o].copy(this.targets[o].scat),this.curTopMl[o]=this.targets[o].topMl*0;s.uMix.value=1,this.mixing=!1}else if(n){const o=s.uMix.value;for(let a=0;a<De;a++)s.uKOld.value[a].lerp(s.uKNew.value[a],o),s.uKNew.value[a].copy(this.targets[a].k);s.uMix.value=0,this.mixing=!0}else for(let o=0;o<De;o++)s.uKNew.value[o].copy(this.targets[o].k),this.mixing||s.uKOld.value[o].copy(this.targets[o].k);s.uLayerCount.value=t,this.updateApparent()}updateApparent(){let t=0,e=-1,n=0;for(let h=0;h<this.targetCount;h++){const u=this.targets[h].topMl-n;n=this.targets[h].topMl,u>e&&(e=u,t=h)}const s=this.targets[t],r=this.Lref,o=1-Math.exp(-s.scat.w*r),a=Math.exp(-s.k.x*r)*(1-o)+s.scat.x*o,l=Math.exp(-s.k.y*r)*(1-o)+s.scat.y*o,c=Math.exp(-s.k.z*r)*(1-o)+s.scat.z*o;this.apparent=EM(a,l,c)}getApparentHex(){return this.apparent}setStirring(t){this.stirRpm=Math.max(0,t)}setBoil(t){this.boil=Math.max(0,Math.min(1,t))}setGasAgitation(t){this.gasAgitation=Math.max(0,Math.min(1,t))}impact(t,e,n,s){const r=this.uniforms.uImpact.value;s-r.z<.25&&r.w>n||r.set(t,e,s,Math.min(1.5,n))}slosh(t,e=Math.random()-.5,n=Math.random()-.5){this.sloshAmp=Math.min(.12,this.sloshAmp+t),this.sloshDir.set(e,n).normalize(),this.sloshPhase=0}tick(t,e,n){const s=this.uniforms,r=this.profile;s.uTime.value=e,isFinite(this.totalMl)||(this.totalMl=0),isFinite(this.totalMlTarget)||(this.totalMlTarget=0);const o=this.totalMlTarget-this.totalMl;this.totalMl+=o*Math.min(1,t*4),Math.abs(o)<.002&&(this.totalMl=this.totalMlTarget);const a=tr(r,this.totalMl);this._fillY=a,s.uFill.value=a;const l=this.totalMl>.02;this.sideAbsorb.visible=l;const c=this.totalMlTarget>1e-6?this.totalMl/this.totalMlTarget:0;for(let m=0;m<De;m++){const p=this.targets[m].topMl*c;this.curTopMl[m]+=(p-this.curTopMl[m])*Math.min(1,t*5),s.uLayerTop.value[m]=tr(r,this.curTopMl[m]),s.uScat.value[m].lerp(this.targets[m].scat,Math.min(1,t*2.5))}const h=Math.max(.05,ye(r,Math.min(a,r.innerTopY))),u=r.innerBottomY+Math.min(.6,(a-r.innerBottomY)*.3),d=ye(r,u);s.uR.value=h;const f=a-u;if(f>.3?(s.uConeB.value=(h-d)/f,s.uConeA.value=h-s.uConeB.value*a):(s.uConeB.value=0,s.uConeA.value=h),this.mixing&&(s.uMix.value=Math.min(1,s.uMix.value+t/.9),s.uMix.value>=1)){this.mixing=!1;for(let m=0;m<De;m++)s.uKOld.value[m].copy(s.uKNew.value[m])}wh.copy(n).invert(),Sh.set(0,1,0).transformDirection(wh),s.uUpObj.value.lerp(Sh,Math.min(1,t*10)).normalize();const g=this.rippleBase+this.boil*.11+this.gasAgitation*.05+Math.min(.03,this.stirRpm/3e4);s.uRipple.value+=(g-s.uRipple.value)*Math.min(1,t*3);const v=Math.min(h*.45,this.stirRpm/1e3*1.6*Math.min(1,h/2.5))*(a-r.innerBottomY>1?1:0);if(this.vortexCur+=(v-this.vortexCur)*Math.min(1,t*1.5),s.uVortex.value=this.vortexCur,this.sloshAmp>1e-4){this.sloshPhase+=t;const m=this.sloshAmp*Math.exp(-this.sloshPhase*2.2)*Math.cos(this.sloshPhase*12.5);s.uSlosh.value.set(this.sloshDir.x*m,this.sloshDir.y*m),this.sloshPhase>3&&(this.sloshAmp=0,s.uSlosh.value.set(0,0))}}diagnose(){if(this.totalMlTarget<=.05)return null;if(!this.sideAbsorb.visible&&this.totalMl>.02)return"liquid mesh hidden although volume > 0";if(this.sideAbsorb.visible){let e=this.sideAbsorb;for(;e;){if(!e.visible)return`liquid ancestor "${e.name||e.type}" is hidden`;e=e.parent}}const t=this.uniforms;for(const e of["uFill","uYb","uR","uConeA","uConeB","uTopClamp"])if(!isFinite(t[e].value))return`uniform ${e} is not finite`;return t.uR.value>.05?t.uFill.value>t.uYb.value?null:"fill height is not above the vessel floor":"liquid surface radius is ~0"}dispose(){this.absorbMat.dispose(),this.surfaceMat.dispose()}}function va(i,t,e,n,s,r=.12){const o=[new H(0,0)],a=Math.min(.6,i*.18);for(let c=0;c<=5;c++){const h=-Math.PI/2+c/5*(Math.PI/2);o.push(new H(i-a+Math.cos(h)*a,a+Math.sin(h)*a))}o.push(new H(i,t));for(let c=1;c<=8;c++){const h=c/8,u=Math.sin(h*Math.PI/2);o.push(new H(i+(e-i)*u,t+n*h))}const l=t+n;return o.push(new H(e,l+s-r*2)),o.push(new H(e+r,l+s-r)),o.push(new H(e+r*.6,l+s)),o.push(new H(e*.85,l+s)),o}const ps={liquid:{R:3.7,body:va(3.7,11.2,1.3,2.4,1.6),fillY:10.2,neckR:1.3,neckTopY:11.2+2.4+1.6,capR:1.62,capH:2.1,labelY0:2.2,labelY1:7.45,height:11.2+2.4+1.6+1.6},jar:{R:3.4,body:va(3.4,8.6,2.55,.9,1,.1),fillY:6.9,neckR:2.55,neckTopY:8.6+.9+1,capR:2.85,capH:1.9,labelY0:1.2,labelY1:6.1,height:8.6+.9+1+1.5},dropper:{R:2,body:va(2,6,.8,1,.9,.08),fillY:5,neckR:.8,neckTopY:7+.9,capR:1.05,capH:1.4,labelY0:.9,labelY1:3.75,height:7+.9+3.6}},Eh=new Map;function Fn(i,t){let e=Eh.get(i);return e||(e=t(),Eh.set(i,e)),e}const Vs=new Map;function ri(i,t){let e=Vs.get(i);return e||(e=t(),Vs.set(i,e)),e}function Th(i){return Fn("body_"+i,()=>new Ue(ps[i].body,48).translate(0,Ao,0))}function AM(i,t){return Fn(`content_${i}_${t?"s":"l"}`,()=>{const e=ps[i],n=.22,s=[];for(const r of e.body){if(r.y>e.fillY)break;s.push(new H(Math.max(0,r.x-n),Math.max(r.y,n)))}return s.push(new H(e.R-n,e.fillY)),s.push(new H(0,e.fillY+(t?.5:0))),new Ue(s,40).translate(0,Ao,0)})}function Ah(i){return Fn("cap_"+i,()=>{const t=ps[i],e=new ne(t.capR,t.capR,t.capH,48,1),n=e.attributes.position;for(let s=0;s<n.count;s++){const r=n.getX(s),o=n.getZ(s);if(Math.hypot(r,o)<t.capR*.99)continue;const l=Math.atan2(o,r),c=1+.025*Math.sign(Math.sin(l*24));n.setX(s,r*c),n.setZ(s,o*c)}return e.computeVertexNormals(),e.translate(0,t.capH/2,0),e})}function CM(i){return Fn("label_"+i,()=>{const t=ps[i],e=1.9,n=new ne(t.R+.04,t.R+.04,t.labelY1-t.labelY0,48,1,!0,-e/2,e);return n.translate(0,(t.labelY0+t.labelY1)/2+Ao,0),n})}function RM(i){return Fn("proxy_"+i,()=>{const t=ps[i],e=new ne(t.R,t.R,t.height,10);return e.translate(0,t.height/2,0),e})}const Ch=()=>ri("cap",()=>new Mt({color:1776670,roughness:.42,metalness:0}));let PM=null;function LM(){return PM??=[uo(!0,{tint:8011026,baseAlpha:.2,fresnelAlpha:.3,edgeTint:10115610,roughness:.05,envMapIntensity:1.4}),uo(!1,{tint:8011026,baseAlpha:.2,fresnelAlpha:.3,edgeTint:10115610,roughness:.05,envMapIntensity:1.4})]}const IM=()=>ri("capw",()=>new Mt({color:15328988,roughness:.5,metalness:0})),DM=()=>ri("hdpe",()=>new sn({color:15855592,roughness:.55,metalness:0,sheen:.4,sheenRoughness:.6,sheenColor:new Et(16777215)})),UM=()=>ri("bulb",()=>new Mt({color:8003346,roughness:.6,metalness:0})),NM=()=>ri("pipette",()=>new sn({color:16777215,roughness:.03,transparent:!0,opacity:.25,envMapIntensity:2,depthWrite:!1})),OM=()=>ri("proxy",()=>new Sn({visible:!1}));function Rh(i,t){const e=`c_${t?"s":"l"}_${i}`;if(Vs.size>160)for(const[n,s]of Vs)n.startsWith("c_")&&(s.dispose(),Vs.delete(n));return ri(e,()=>{const n=new Et(i);if(t)return new Mt({color:n,roughness:.95,metalness:0});const r=n.r*.3+n.g*.59+n.b*.11>.85;return new sn({color:r?n.clone().multiply(new Et(.8,.93,1)):n,roughness:.05,metalness:0,transparent:!0,opacity:r?.4:.8,depthWrite:!1,envMapIntensity:1.2})})}function id(i){return i?"#f4f3ef":"#f2f6f8"}function sd(i,t=""){return/^(Mg|Zn|Al|Fe|Cu|Sn|Pb|Ni|Ca|Na|K|Li)$/.test(i.trim())||/ribbon|turnings|granules|wire|foil/i.test(t)}const FM={0:"₀",1:"₁",2:"₂",3:"₃",4:"₄",5:"₅",6:"₆",7:"₇",8:"₈",9:"₉"};function BM(i){return i.replace(/([A-Za-z\)\]])(\d+)/g,(t,e,n)=>e+n.split("").map(s=>FM[s]??s).join(""))}function Ph(i,t,e,n,s="700",r='"Helvetica Neue", Arial, sans-serif'){let o=n;for(i.font=`${s} ${o}px ${r}`;i.measureText(t).width>e&&o>12;)o-=2,i.font=`${s} ${o}px ${r}`;return o}function kM(i,t,e,n,s){i.save(),i.translate(t,e),i.save(),i.rotate(Math.PI/4);const r=n/Math.SQRT2;i.fillStyle="#ffffff",i.fillRect(-r/2,-r/2,r,r),i.strokeStyle="#d0191b",i.lineWidth=n*.08,i.strokeRect(-r/2+i.lineWidth/2,-r/2+i.lineWidth/2,r-i.lineWidth,r-i.lineWidth),i.restore(),i.fillStyle="#111",i.strokeStyle="#111";const o=n/10,a=(l,c,h)=>{i.beginPath(),i.moveTo(l,c+2.2*o*h),i.bezierCurveTo(l-2*o*h,c+1.6*o*h,l-1.6*o*h,c-.6*o*h,l-.2*o*h,c-2.4*o*h),i.bezierCurveTo(l,c-1*o*h,l+.9*o*h,c-1.2*o*h,l+.7*o*h,c-2*o*h),i.bezierCurveTo(l+2.2*o*h,c-.6*o*h,l+1.9*o*h,c+1.7*o*h,l,c+2.2*o*h),i.fill()};switch(s){case"GHS01":{i.beginPath(),i.arc(0,.8*o,1.3*o,0,Math.PI*2),i.fill(),i.lineWidth=o*.4;for(let l=0;l<8;l++){const c=l/8*Math.PI*2;i.beginPath(),i.moveTo(Math.cos(c)*1.8*o,.8*o+Math.sin(c)*1.8*o),i.lineTo(Math.cos(c)*2.8*o,.8*o+Math.sin(c)*2.8*o),i.stroke()}break}case"GHS02":a(0,0,1),i.fillRect(-2.2*o,2.4*o,4.4*o,.5*o);break;case"GHS03":i.lineWidth=o*.6,i.beginPath(),i.arc(0,1.4*o,1.3*o,0,Math.PI*2),i.stroke(),a(0,-.9*o,.75);break;case"GHS04":i.save(),i.rotate(-.5),i.beginPath(),i.roundRect(-3*o,-.9*o,6*o,1.8*o,.9*o),i.fill(),i.restore();break;case"GHS05":i.fillRect(-2.6*o,2*o,5.2*o,.6*o),i.beginPath(),i.moveTo(-2.2*o,-2.6*o),i.lineTo(-.9*o,-2.6*o),i.lineTo(-1.2*o,-.6*o),i.lineTo(-1.9*o,-.6*o),i.fill(),i.beginPath(),i.moveTo(.9*o,-2.6*o),i.lineTo(2.2*o,-2.6*o),i.lineTo(1.9*o,-.6*o),i.lineTo(1.2*o,-.6*o),i.fill(),i.beginPath(),i.arc(-1.55*o,.4*o,.4*o,0,Math.PI*2),i.fill(),i.beginPath(),i.arc(1.55*o,.4*o,.4*o,0,Math.PI*2),i.fill(),i.fillRect(.6*o,1*o,2.2*o,.9*o);break;case"GHS06":i.beginPath(),i.ellipse(0,-.9*o,1.6*o,1.5*o,0,0,Math.PI*2),i.fill(),i.fillStyle="#fff",i.beginPath(),i.arc(-.6*o,-1*o,.42*o,0,Math.PI*2),i.fill(),i.beginPath(),i.arc(.6*o,-1*o,.42*o,0,Math.PI*2),i.fill(),i.strokeStyle="#111",i.lineWidth=o*.55,i.beginPath(),i.moveTo(-2.2*o,.9*o),i.lineTo(2.2*o,2.6*o),i.stroke(),i.beginPath(),i.moveTo(2.2*o,.9*o),i.lineTo(-2.2*o,2.6*o),i.stroke();break;case"GHS07":i.font=`900 ${n*.55}px Arial`,i.textAlign="center",i.textBaseline="middle",i.fillText("!",0,o*.3);break;case"GHS08":i.beginPath(),i.arc(0,-2*o,.7*o,0,Math.PI*2),i.fill(),i.beginPath(),i.moveTo(-1.8*o,2.6*o),i.lineTo(-1.6*o,-.6*o),i.quadraticCurveTo(0,-1.4*o,1.6*o,-.6*o),i.lineTo(1.8*o,2.6*o),i.fill(),i.fillStyle="#fff";for(let l=0;l<8;l++){const c=l/8*Math.PI*2;i.beginPath(),i.moveTo(0,.6*o),i.lineTo(Math.cos(c)*1.1*o,.6*o+Math.sin(c)*1.1*o),i.lineTo(Math.cos(c+.4)*.4*o,.6*o+Math.sin(c+.4)*.4*o),i.fill()}break;case"GHS09":i.lineWidth=o*.45,i.beginPath(),i.moveTo(-1.6*o,.4*o),i.lineTo(-1.6*o,-2.4*o),i.stroke(),i.beginPath(),i.moveTo(-1.6*o,-1.4*o),i.lineTo(-2.6*o,-2.2*o),i.stroke(),i.beginPath(),i.moveTo(-1.6*o,-1*o),i.lineTo(-.5*o,-2*o),i.stroke(),i.beginPath(),i.ellipse(.9*o,1.6*o,1.4*o,.6*o,0,0,Math.PI*2),i.fill(),i.beginPath(),i.moveTo(2.2*o,1.6*o),i.lineTo(2.9*o,1*o),i.lineTo(2.9*o,2.2*o),i.fill(),i.fillRect(-2.8*o,2.6*o,5.6*o,.35*o);break;default:i.font=`700 ${n*.18}px Arial`,i.textAlign="center",i.textBaseline="middle",i.fillText(s,0,0)}i.restore()}function zM(i,t){const s=document.createElement("canvas");s.width=512,s.height=384;const r=s.getContext("2d");r.fillStyle="#fbfaf5",r.fillRect(0,0,512,384);const o=r.createLinearGradient(0,0,512,0);o.addColorStop(0,"rgba(0,0,0,0.06)"),o.addColorStop(.5,"rgba(0,0,0,0)"),o.addColorStop(1,"rgba(0,0,0,0.06)"),r.fillStyle=o,r.fillRect(0,0,512,384);const a=i.signal_word||"",l=a==="Danger"?"#c4161c":a==="Warning"?"#e06a00":"#1f5fa8";r.fillStyle=l,r.fillRect(0,0,512,54),r.fillStyle="#fff",r.font='700 26px "Helvetica Neue", Arial, sans-serif',r.textAlign="left",r.textBaseline="middle",r.fillText(a?a.toUpperCase():"LABORATORY REAGENT",22,28),r.textAlign="right",r.font="600 20px Arial, sans-serif";const c=i.form==="solid"||i.by_mass?"SOLID":i.form==="liquid"?"LIQUID":i.form==="solution"?"SOLUTION":"";r.fillText(c,490,28),r.textAlign="left",r.fillStyle="#16181b";const h=i.name||"Reagent",u=Ph(r,h,468,t==="dropper"?52:46);r.textBaseline="alphabetic",r.fillText(h,22,70+u);const d=BM(i.formula||"");let f=70+u+14;if(d){const _=Ph(r,d,468,42,"600",'"Times New Roman", Georgia, serif');r.fillStyle="#23384f",r.fillText(d,22,f+_),f+=_+10}if(i.concentration_m!==void 0&&i.concentration_m!==null&&i.concentration_m>0){const _=i.concentration_m,I=_>=1?`${_.toFixed(_%1===0?1:2)} M`:_>=.01?`${_.toFixed(2)} M`:`${(_*1e3).toFixed(1)} mM`;r.font='700 34px "Helvetica Neue", Arial, sans-serif',r.fillStyle="#16181b",r.fillText(I,22,f+34),f+=44}const g=(i.ghs||[]).slice(0,4),v=g.length>2?78:92;let m=490-v/2;const p=362-v/2-18;for(let _=g.length-1;_>=0;_--)kM(r,m,p,v,g[_]),m-=v*.92;r.fillStyle="rgba(30,30,30,0.6)",r.font="500 15px Arial, sans-serif",r.textAlign="left";let x=0;for(const _ of i.id)x=x*31+_.charCodeAt(0)>>>0;r.fillText(`Lot ${x%9e4+1e4} · Store tightly closed`,22,366),r.strokeStyle="rgba(0,0,0,0.25)",r.lineWidth=3,r.strokeRect(1.5,1.5,509,381);const M=new yo(s);return M.colorSpace=we,M.anisotropy=4,M}function rd(i){return i.dropper?"dropper":i.form==="solid"||i.by_mass?"jar":"liquid"}function od(){const i=new fe,t=new tt(Fn("pipette_tube",()=>{const n=[new H(.06,0),new H(.12,.4),new H(.26,2.4),new H(.28,7.4),new H(.34,7.6)];return new Ue(n,16)}),NM());t.renderOrder=950;const e=new tt(Fn("pipette_bulb",()=>{const n=[new H(.42,0)];for(let s=0;s<=10;s++){const r=s/10;n.push(new H(.42+Math.sin(r*Math.PI)*.38*(r<.7?1:1-(r-.7)*2.5),.2+r*2.4))}return n.push(new H(0,2.7)),new Ue(n,20)}),UM());return e.position.y=7.4,e.name="bulb",e.castShadow=!0,i.add(t,e),i}function HM(){const i=new fe,t=ri("steel",()=>new Mt({color:14277855,metalness:1,roughness:.22})),e=new tt(Fn("spat_blade",()=>{const s=new fs;s.moveTo(-.5,0),s.quadraticCurveTo(-.6,.65,0,.7),s.lineTo(3.2,.25),s.lineTo(3.2,-.25),s.lineTo(0,-.7),s.quadraticCurveTo(-.6,-.65,-.5,0);const r=new Ci(s,{depth:.05,bevelEnabled:!1});return r.rotateX(-Math.PI/2),r}),t),n=new tt(Fn("spat_handle",()=>{const s=new ne(.18,.18,12,12);return s.rotateZ(Math.PI/2),s.translate(9.2,.05,0),s}),t);return e.castShadow=!0,n.castShadow=!0,i.add(e,n),i}function ad(i){const t=rd(i),e=ps[t],n=t==="jar",s=new fe;s.name=`bottle_${i.id}`;const r=i.bottle_colour??"clear",o=i.colorHex&&i.colorHex!==""?i.colorHex:id(n);let a=null,l;const c=r==="white"&&t!=="jar";if(c)l=new tt(Th(t),DM()),l.castShadow=!0,l.receiveShadow=!0;else{const M=er(Th(t),r==="amber"?LM():Zu());l=M.near,a=M.far}l.raycast=()=>{},a&&(a.raycast=()=>{}),s.add(l);let h=null;c||(h=new tt(AM(t,n),Rh(o,n)),h.raycast=()=>{},s.add(h));const u=zM(i,t),d=new Mt({map:u,roughness:.75,metalness:0,transparent:!0,emissive:16777215,emissiveIntensity:0,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),f=new tt(CM(t),d);f.raycast=()=>{},f.receiveShadow=!0,s.add(f);let g,v=null;if(t==="dropper"){const M=new fe,_=new tt(Ah(t),Ch());_.position.y=e.neckTopY-.6,_.castShadow=!0;const I=od();I.position.y=.9,I.scale.setScalar(1);const E=I.getObjectByName("bulb");E.position.y=e.neckTopY-.6+e.capH-.9-.2,M.add(_,I),s.add(M),g=M,v=M}else{const M=new tt(Ah(t),r==="white"?IM():Ch());M.position.y=e.neckTopY-.9,M.castShadow=!0,M.raycast=()=>{},s.add(M),g=M}g.traverse(M=>M.raycast=()=>{});const m=new tt(RM(t),OM());m.visible=!1,m.userData.pick={type:"bottle",id:i.id},s.add(m),s.userData.pick={type:"bottle",id:i.id};const p=new T(e.neckR+.1,e.neckTopY,0),x={group:s,kind:t,cap:g,dropperParts:v,pickProxy:m,height:e.height,radius:e.R,lipLocal:p,contentHex:o,setContentColor:M=>{x.contentHex=M,h&&(h.material=Rh(M,n))},setRenderOrderBase:M=>{l.renderOrder=M+5,a&&(a.renderOrder=M+1),h&&(h.renderOrder=M+2),f.renderOrder=M+6},setHover:M=>{d.emissiveIntensity=M?.14:0},dispose:()=>{u.dispose(),d.dispose(),s.parent?.remove(s)}};return x}function VM(i){return{id:i.id,name:i.name,formula:i.formula,concentration_m:i.form==="solution"?i.concentration_m:void 0,ghs:i.ghs,signal_word:i.signal_word,bottle_colour:i.bottle_colour,form:i.form,dropper:i.dropper,by_mass:i.by_mass}}const Lh=new Set;function qi(i,...t){Lh.has(i)||(Lh.add(i),console.warn(`[glassware] ${i}`,...t))}let ld=null;function GM(i){ld=i}const Ih=new Map,Gr=new Map;let Wr=null,qr=null,_a=null,Ma=null,Yr=null,xa=null,Dh=new Map;function Uh(){return Yr||(Yr=new ze(1,1),Yr.rotateX(-Math.PI/2)),Yr}function WM(i){let t=Ih.get(i.type);if(t)return t;if(t=new Ue(i.shell,96),i.spout>0){const e=t.attributes.position,n=.9+i.rimInnerRadius*.12,s=i.rimY-n;for(let r=0;r<e.count;r++){const o=e.getY(r);if(o<=s)continue;const a=e.getX(r),l=e.getZ(r),c=Math.atan2(l,a),h=Math.exp(-Math.pow(c/.3,2));if(h<.001)continue;const u=Math.pow((o-s)/n,2.2),d=Math.hypot(a,l),f=d+i.spout*h*u;e.setXYZ(r,a/d*f,o-.12*h*u,l/d*f)}t.computeBoundingSphere()}return Ih.set(i.type,t),t}function qM(i){if(Gr.has(i.type))return Gr.get(i.type);if(!i.graduations.length)return Gr.set(i.type,null),null;const t=i.innerBottomY,e=tr(i,i.nominalMl),n=Math.min(i.rimY-.4,e+(i.type==="cylinder-100"?1.2:1.8)),s=[],r=40;for(let d=0;d<=r;d++){const f=t+(n-t)*d/r;s.push(new H(zs(i,f)+.012,f))}const o=zs(i,(t+n)/2),a=Math.max(.4,Math.min(1.3,2.5/o)),l=new Ue(s,16,-a/2,a),c=i.graduations.map(d=>({v:(tr(i,d.ml)-t)/(n-t),major:d.major,label:d.label})),h=sM(i.type,c,i.gradTitle,i.type==="cylinder-100"),u={geo:l,tex:h};return Gr.set(i.type,u),u}function YM(){if(qr)return{geos:qr,mat:_a};const i=12,t=5.5,e=new qe(i,1.2,t);e.translate(0,.6,0);const n=new fs;n.moveTo(-i/2,-t/2),n.lineTo(i/2,-t/2),n.lineTo(i/2,t/2),n.lineTo(-i/2,t/2),n.lineTo(-i/2,-t/2);for(const a of[-3.8,0,3.8]){const l=new ho;l.absarc(a,0,1.42,0,Math.PI*2,!0),n.holes.push(l)}const s=new Ci(n,{depth:.7,bevelEnabled:!0,bevelThickness:.08,bevelSize:.08,bevelSegments:1,curveSegments:24});s.rotateX(Math.PI/2),s.translate(0,8.2,0);const r=new qe(.8,7.4,t*.8);r.translate(0,1.2+3.7,0),qr={base:e,plate:s,post:r};const o=ju().clone();return o.needsUpdate=!0,o.repeat.set(.15,1),_a=new Mt({map:o,roughness:.55,metalness:0,color:14206896}),{geos:qr,mat:_a}}function XM(){return Ma||(Ma=new Sn({map:$_(),color:0,transparent:!0,opacity:.5,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-4})),Ma}function $M(){return xa||(xa=new Sn({visible:!1})),xa}function jM(i,t){let e=Dh.get(i);return e||(e=new Mt({map:t,color:16777215,roughness:.45,metalness:0,transparent:!0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-2}),Dh.set(i,e)),e}function KM(i){const t=B_(i.type),e=new fe;e.name=`vessel_${i.id}`,e.userData.pick={type:"vessel",id:i.id};const n=new fe;n.position.y=t.baseOffsetY,e.add(n);const{near:s,far:r}=er(WM(t));s.raycast=()=>{},r.raycast=()=>{},n.add(s);const o=[];if(t.footHeight>0){Wr||(Wr=new ne(t.footRadius,t.footRadius*1.02,t.footHeight,6,1),Wr.translate(0,t.footHeight/2,0));const U=er(Wr);U.near.raycast=()=>{},U.far.raycast=()=>{},n.add(U.near),o.push(U.near)}let a=null;const l=qM(t);l&&(a=new tt(l.geo,jM(t.type,l.tex)),a.raycast=()=>{},n.add(a));const c=new fe;if(e.add(c),t.rack){const{geos:U,mat:F}=YM(),V=new tt(U.base,F),K=new tt(U.plate,F),q=new tt(U.post,F),D=new tt(U.post,F);q.position.x=-5.6,D.position.x=5.6;for(const G of[V,K,q,D])G.castShadow=!0,G.receiveShadow=!0,G.raycast=()=>{},c.add(G)}const h=new TM(t);n.add(h.root);const u=h.sideAbsorb,d=new vM(t,h);n.add(d.group);const f=z_(t),g=k_(t),v=new tt(Uh(),XM()),m=t.rack?15:f*2.6;v.scale.set(m,1,t.rack?9:m),v.position.y=.04,v.renderOrder=0,v.raycast=()=>{},e.add(v);const p=new Sn({map:X_(),color:8177919,transparent:!0,opacity:0,depthWrite:!1,blending:Ys,polygonOffset:!0,polygonOffsetFactor:-6}),x=new tt(Uh(),p),M=f*2*1.75;x.scale.set(M,1,M),x.position.y=.06,x.visible=!1,x.raycast=()=>{},e.add(x);const _=new ne(f,f,g+1,12);_.translate(0,(g+1)/2,0);const I=new tt(_,$M());I.visible=!1,I.userData.pick={type:"vessel",id:i.id},e.add(I);let E=!1,C=!1,P=0,b=0,y=!1,R=0,O=0;const N={group:e,glassMesh:s,liquidMesh:u,vesselState:i,effects:d,profile:t,glassRoot:n,liquid:h,pickProxy:I,lastSnapshot:null,height:g,footprint:f,updateLiquid:(U,F,V=.85)=>{i.currentVolumeMl=U,i.liquidColor=F,h.setSimple(U,F,V)},applyVisual:(U,F,V)=>{N.lastSnapshot=U,i.currentVolumeMl=U.total_liquid_ml,i.temperatureK=U.temperature_k,U.ph!==null&&U.ph!==void 0&&(i.ph=U.ph);try{h.setLayers(U.layers||[],U.total_liquid_ml,V??ld),i.liquidColor=h.getApparentHex()}catch(K){qi("liquid.setLayers failed (falling back to a clear liquid of the same volume)",K);try{h.setSimple(U.total_liquid_ml||0,i.liquidColor||"#e8f4fa",.3)}catch(q){qi("liquid.setSimple failed",q)}}try{d.applySnapshot(U)}catch(K){qi("effects.applySnapshot failed",K)}O<=0&&(O=.6)},setStirring:U=>{d.setStirring(U),i.stirring=U>0},setSelected:U=>{E=U},getLiquidColorHex:()=>h.getApparentHex(),tick:(U,F)=>{try{N.lastSnapshot||d.setSealed(i.isSealed),h.tick(U,F,n.matrixWorld)}catch(D){qi("liquid.tick failed",D)}try{d.tick(U,F)}catch(D){qi("effects.tick failed",D)}if(O>0&&(O-=U,O<=0)){const D=h.diagnose();D&&qi(`vessel ${i.id}: ${D}`,{volumeMl:h.volumeMl,fillY:h.fillY})}P+=((E?.85:C?.35:0)-P)*Math.min(1,U*8),p.opacity=P*(E?.85+.15*Math.sin(F*2.5):1),x.visible=P>.01;const K=Math.max(0,e.position.y-b);v.position.y=b-e.position.y+.04,x.position.y=b-e.position.y+.06;const q=Math.max(0,1-K/25);v.visible=q>.02&&!y,v.scale.set(m*(1+K*.04),1,(t.rack?9:m)*(1+K*.04))},setHover:U=>{C=U},setRenderOrderBase:U=>{if(U!==R){R=U,s.renderOrder=U+5,r.renderOrder=U+1;for(const F of o)F.renderOrder=U+5,F.children[0].renderOrder=U+1;a&&(a.renderOrder=U+6),h.setRenderOrderBase(U),d.setRenderOrderBase(U),x.renderOrder=U,v.renderOrder=U}},setGroundY:U=>{b=U},lipLocal:()=>{const U=t.rimOuterRadius+t.spout*.9;return new T(U,t.rimY+t.baseOffsetY-(t.spout>0?.12:0),0)},probeLocal:(U,F)=>{const V=U==="thermo"?-.75:-2.35,K=new T(Math.cos(V),0,Math.sin(V)),q=t.innerBottomY+.45+F,D=Math.max(0,ye(t,q+.6)-F-.2),G=Math.max(0,t.rimInnerRadius-F-.12),et=K.clone().multiplyScalar(D);et.y=q+t.baseOffsetY;const dt=K.clone().multiplyScalar(G-D);return dt.y=t.rimY-q,dt.normalize(),{tip:et,up:dt}},stopperTopLocal:()=>d.stopperTopY()+t.baseOffsetY,surfaceLocalY:()=>h.fillY+t.baseOffsetY,isBurst:()=>y,setRackVisible:U=>{c.visible=U},dispose:()=>{h.dispose(),d.dispose(),p.dispose(),_.dispose(),e.parent?.remove(e)}};return d.onBurst=()=>{y=!0,s.visible=!1;for(const U of o)U.visible=!1;a&&(a.visible=!1),h.root.visible=!1},N.setRenderOrderBase(10),h.setSimple(i.currentVolumeMl,i.liquidColor||"#f4f8fb",0),N}const wl=.34,Xr=2.6,ya=26;class ZM{group=new fe;liquidColumn;attachedBundle=null;displayedTempK=295.15;tauSeconds=4;constructor(){this.group.name="instrument_thermometer";const t=wl,e=[new H(0,0)];for(let h=0;h<=6;h++){const u=-Math.PI/2+h/6*(Math.PI/2);e.push(new H(Math.cos(u)*.36,.36+Math.sin(u)*.36))}e.push(new H(.36,1.6)),e.push(new H(t*.85,2)),e.push(new H(t,2.3)),e.push(new H(t,27.6));for(let h=1;h<=6;h++){const u=h/6*(Math.PI/2);e.push(new H(Math.cos(u)*t,27.6+Math.sin(u)*t))}const n=new Ue(e,24),{near:s}=er(n);s.raycast=()=>{},s.traverse(h=>h.raycast=()=>{}),this.group.add(s);const r=new Mt({color:13112861,roughness:.3,emissive:3801088}),o=new tt(new So(.24,1.1,6,16),r);o.position.y=.95,this.group.add(o);const a=new ne(.055,.055,1,8);a.translate(0,.5,0),this.liquidColumn=new tt(a,r),this.liquidColumn.position.set(0,1.5,.07),this.group.add(this.liquidColumn);const l=new tt(new ze(.42,ya-Xr+1.2),new Mt({map:rM(),roughness:.5}));l.position.set(0,(Xr+ya)/2,-.06),this.group.add(l);const c=new tt(new To(.25,.06,6,16),new Mt({color:12106946,metalness:1,roughness:.3}));c.position.y=28.15,this.group.add(c),this.group.traverse(h=>{h.raycast=()=>{},h.isMesh&&h!==s&&(h.castShadow=!0)}),this.update(null,0)}attachTo(t){this.attachedBundle=t}getAttached(){return this.attachedBundle}update(t,e){const n=t?t.temperature_k:this.displayedTempK,s=Math.min(1,e/this.tauSeconds);this.displayedTempK+=(n-this.displayedTempK)*s;const r=this.displayedTempK-273.15,o=Math.max(-25,Math.min(112,r)),a=Xr+(o+20)/130*(ya-Xr);this.liquidColumn.scale.set(1,Math.max(.05,a-1.5),1)}readout(){const t=Math.round(this.displayedTempK*10)/10,e=Math.round((t-273.15)*10)/10;return{temperature_k:t,temperature_c:e,formatted:`${e.toFixed(1)} °C`}}}class cd{constructor(t,e,n={bg:"#aebd98",fg:"#18210f",ghost:"rgba(24,33,15,0.07)"}){this.opts=n,this.canvas=document.createElement("canvas"),this.canvas.width=512,this.canvas.height=Math.round(512*e/t),this.ctx=this.canvas.getContext("2d"),this.texture=new yo(this.canvas),this.texture.colorSpace=we,this.texture.anisotropy=4;const s=new Sn({map:this.texture,toneMapped:!1});this.mesh=new tt(new ze(t,e),s),this.mesh.raycast=()=>{}}mesh;canvas;ctx;texture;last="";set(t,e=""){const n=t+"|"+e;if(n===this.last)return;this.last=n;const{ctx:s,canvas:r}=this,o=r.width,a=r.height,l=s.createLinearGradient(0,0,0,a);l.addColorStop(0,this.opts.bg),l.addColorStop(1,JM(this.opts.bg,-18)),s.fillStyle=l,s.fillRect(0,0,o,a);const c=Math.round(a*.62);s.font=`700 ${c}px "DSEG7 Classic", "Courier New", monospace`,s.textAlign="right",s.textBaseline="middle";const h=o-(this.opts.unit?o*.2:o*.06);s.fillStyle=this.opts.ghost,s.fillText("8888.88".slice(-Math.max(4,t.length)),h,a*.56),s.fillStyle=this.opts.fg,s.fillText(t,h,a*.56),this.opts.unit&&(s.textAlign="left",s.font=`700 ${Math.round(a*.26)}px Arial, sans-serif`,s.fillText(this.opts.unit,h+o*.03,a*.66)),(this.opts.caption||e)&&(s.textAlign="left",s.font=`600 ${Math.round(a*.16)}px Arial, sans-serif`,s.fillText(e||this.opts.caption||"",o*.04,a*.16));const u=s.createLinearGradient(0,0,o,a);u.addColorStop(0,"rgba(255,255,255,0.18)"),u.addColorStop(.4,"rgba(255,255,255,0.0)"),s.fillStyle=u,s.fillRect(0,0,o,a),this.texture.needsUpdate=!0}}function JM(i,t){const e=new Et(i),n=s=>Math.max(0,Math.min(255,Math.round(s*255+t)));return`rgb(${n(e.r)},${n(e.g)},${n(e.b)})`}function yn(i,t,e,n){const s=new fs,r=-i/2,o=-e/2;s.moveTo(r+n,o),s.lineTo(r+i-n,o),s.quadraticCurveTo(r+i,o,r+i,o+n),s.lineTo(r+i,o+e-n),s.quadraticCurveTo(r+i,o+e,r+i-n,o+e),s.lineTo(r+n,o+e),s.quadraticCurveTo(r,o+e,r,o+e-n),s.lineTo(r,o+n),s.quadraticCurveTo(r,o,r+n,o);const a=Math.min(n*.5,t*.2),l=new Ci(s,{depth:t-a*2,bevelEnabled:!0,bevelThickness:a,bevelSize:a,bevelSegments:3,curveSegments:6});return l.rotateX(-Math.PI/2),l.translate(0,a,0),l}function QM(i,t,e){const n=i.parent;if(!n){i.position.copy(t),i.quaternion.copy(e);return}n.updateWorldMatrix(!0,!1);const s=new Jt().copy(n.matrixWorld).invert(),r=new Jt().compose(t,e,new T(1,1,1));r.premultiply(s);const o=new T;r.decompose(i.position,i.quaternion,o)}const Jn=.6;class ql{group=new fe;probe=new fe;lcd;displayedPh=null;tauSeconds=3;immersed=!0;cable;cableMat;lastCableKey="";socketLocal=new T(0,5.2,-8.4);constructor(){this.group.name="instrument_ph_meter";const t=new Mt({color:15198694,roughness:.45,metalness:0}),e=new Mt({color:2896182,roughness:.5,metalness:0}),n=new tt(yn(16,4.5,18,1.2),t);n.castShadow=!0,n.receiveShadow=!0,this.group.add(n);const s=new tt(yn(14.5,1,11,.8),e);s.position.set(0,4.3,.8),s.rotation.x=.32,s.castShadow=!0,this.group.add(s),this.lcd=new cd(9.5,4.2,{bg:"#b4c39c",fg:"#151d0e",ghost:"rgba(21,29,14,0.08)",unit:"pH",caption:"ATC  25.0°C"}),this.lcd.mesh.position.set(0,5.84,-.6),this.lcd.mesh.rotation.x=-Math.PI/2+.32,this.group.add(this.lcd.mesh);const r=yn(2.4,.5,1.3,.3),o=new Mt({color:9082012,roughness:.6});for(let l=0;l<3;l++){const c=new tt(r,l===2?new Mt({color:3046706,roughness:.5}):o);c.position.set(-3.3+l*3.3,4.2,4.2),c.rotation.x=.32,this.group.add(c)}const a=new tt(new ne(.6,.6,1.2,16),new Mt({color:12633288,metalness:1,roughness:.3}));a.rotation.x=Math.PI/2,a.position.set(0,2.6,-9.2),this.group.add(a),this.socketLocal.set(0,2.6,-9.6),this.buildProbe(),this.group.add(this.probe),this.cableMat=new Mt({color:1776928,roughness:.55}),this.cable=new tt(new pe,this.cableMat),this.cable.castShadow=!0,this.group.add(this.cable),this.group.traverse(l=>l.raycast=()=>{}),this.lcd.set("---")}buildProbe(){const t=[new H(0,0),new H(.28,.06),new H(.42,.3),new H(.45,.55),new H(.38,.9),new H(.5,1.1),new H(.5,2.2)],{near:e}=er(new Ue(t,20));this.probe.add(e);const n=new tt(new ne(.3,.3,1.6,12),new Mt({color:14279914,roughness:.2,transparent:!0,opacity:.6}));n.position.y=1.4,this.probe.add(n);const s=new Mt({color:2303787,roughness:.35,metalness:0}),r=new tt(new ne(Jn,Jn,11.5,20),s);r.position.y=2.1+5.75,r.castShadow=!0,this.probe.add(r);const o=new tt(new ne(Jn+.02,Jn+.02,1,20,1,!0),new Mt({color:3817800,roughness:.4}));o.position.y=2.4,this.probe.add(o);const a=new tt(new ne(.42,Jn,1.6,16),new Mt({color:1402304,roughness:.45}));a.position.y=2.1+11.5+.8,this.probe.add(a);const l=new tt(new ne(.18,.3,1.6,10),s);l.position.y=2.1+11.5+2.4,this.probe.add(l)}static PROBE_LENGTH=17;setProbeWorldPose(t,e){QM(this.probe,t,e),this.updateCable()}updateCable(){this.group.updateWorldMatrix(!0,!1);const t=new T(0,ql.PROBE_LENGTH-.2,0).applyQuaternion(this.probe.quaternion).add(this.probe.position),e=`${t.x.toFixed(2)},${t.y.toFixed(2)},${t.z.toFixed(2)}`;if(e===this.lastCableKey)return;this.lastCableKey=e;const n=this.socketLocal.clone(),s=new T(0,1,0).applyQuaternion(this.probe.quaternion),r=t.clone().addScaledVector(s,4),o=t.clone().lerp(n,.5),a=t.distanceTo(n);o.y=Math.max(.6,Math.min(t.y,n.y)-a*.25);const l=n.clone().add(new T(0,0,-3));l.y=1;const c=new bo([t,r,o,l,n]),h=new ar(c,48,.22,8,!1);this.cable.geometry.dispose(),this.cable.geometry=h}attachTo(t){}setImmersed(t){this.immersed=t}update(t,e){if(!(!!t&&this.immersed&&t.total_liquid_ml>.1&&t.ph!==null&&!t.burst)){this.displayedPh=null,this.lcd.set("---");return}const s=t.ph;if(this.displayedPh===null)this.displayedPh=7+(s-7)*.35;else{const a=Math.min(1,e/this.tauSeconds);this.displayedPh+=(s-this.displayedPh)*a}const r=Math.round(this.displayedPh*100)/100,o=t.temperature_k-273.15;this.lcd.set(r.toFixed(2),`ATC  ${o.toFixed(1)}°C`)}readout(){if(this.displayedPh===null)return{ph:null,formatted:"---"};const t=Math.round(this.displayedPh*100)/100;return{ph:t,formatted:t.toFixed(2)}}}class tx{group=new fe;lcd;displayedMassG=0;tareOffsetG=0;attachedGlassMassG=0;attached=!1;tauSeconds=.8;constructor(){this.group.name="instrument_balance";const t=new tt(yn(20,6.5,27,1.5),new Mt({color:15527660,roughness:.42,metalness:0}));t.castShadow=!0,t.receiveShadow=!0,this.group.add(t);const e=new Mt({color:14804199,metalness:1,roughness:.18}),n=new tt(new ne(6.5,6.4,.35,48),e);n.position.set(0,6.85,-3),n.castShadow=!0,n.receiveShadow=!0,this.group.add(n);const s=new tt(new ne(1.2,1.5,.4,16),e);s.position.set(0,6.6,-3),this.group.add(s);const r=new tt(yn(14,.6,5.5,.6),new Mt({color:2830389,roughness:.5}));r.position.set(0,6.3,10.2),r.rotation.x=.25,this.group.add(r),this.lcd=new cd(8.5,2.6,{bg:"#0f1a14",fg:"#a8f7c0",ghost:"rgba(168,247,192,0.06)",unit:"g"}),this.lcd.mesh.position.set(-1.6,6.95,10.1),this.lcd.mesh.rotation.x=-Math.PI/2+.25,this.group.add(this.lcd.mesh);const o=new Mt({color:6253428,roughness:.6});for(let l=0;l<2;l++){const c=new tt(yn(1.6,.35,1.1,.25),o);c.position.set(4.3+l*1.9,6.85,10.4),c.rotation.x=.25,this.group.add(c)}const a=new Mt({color:546,roughness:.8});for(const[l,c]of[[-8.5,-11.5],[8.5,-11.5],[-8.5,11.5],[8.5,11.5]]){const h=new tt(new ne(.7,.8,.4,12),a);h.position.set(l,-.1,c),this.group.add(h)}this.group.traverse(l=>l.raycast=()=>{}),this.renderScreen(0)}attachTo(t){if(this.attached=!!t,t)switch(t.vesselState.type){case"beaker-50":this.attachedGlassMassG=35;break;case"beaker-250":this.attachedGlassMassG=110;break;case"beaker-1000":this.attachedGlassMassG=320;break;case"erlenmeyer-250":this.attachedGlassMassG=130;break;case"cylinder-100":this.attachedGlassMassG=145;break;case"test-tube":this.attachedGlassMassG=18;break;default:this.attachedGlassMassG=60;break}else this.attachedGlassMassG=0}tare(){this.tareOffsetG+=this.displayedMassG}update(t,e){const s=(t&&this.attached&&!t.burst?this.attachedGlassMassG+t.contents_mass_g:0)-this.tareOffsetG,r=Math.min(1,e/this.tauSeconds);this.displayedMassG+=(s-this.displayedMassG)*r,this.renderScreen(Math.round(this.displayedMassG*100)/100)}renderScreen(t){this.lcd.set(t.toFixed(2))}readout(){const t=Math.round(this.displayedMassG*100)/100;return{mass_g:t,formatted:`${t.toFixed(2)} g`}}}class ex{group=new fe;needle;dial=new fe;displayedPressureAtm=1;tauSeconds=.5;attached=!1;constructor(){this.group.name="instrument_pressure_gauge";const t=new Mt({color:13215050,metalness:1,roughness:.28}),e=new tt(new ne(.22,.22,3.2,12),t);e.position.y=1.6,this.group.add(e);const n=new tt(new ne(.55,.55,.7,6),t);n.position.y=3.2,this.group.add(n),this.dial.position.y=3.2+2.9,this.group.add(this.dial);const s=new Mt({color:13949148,metalness:1,roughness:.25}),r=new tt(new ne(2.9,2.9,1.3,40),s);r.rotation.x=Math.PI/2,this.dial.add(r);const o=new tt(new To(2.85,.18,10,40),s);o.position.z=.66,this.dial.add(o);const a=document.createElement("canvas");a.width=512,a.height=512;const l=a.getContext("2d");l.fillStyle="#fbfbf8",l.beginPath(),l.arc(256,256,250,0,Math.PI*2),l.fill();const c=Math.PI*.75,h=Math.PI*1.5;l.strokeStyle="#d32f2f",l.lineWidth=22,l.beginPath(),l.arc(256,256,200,c+2/3*h,c+h),l.stroke(),l.strokeStyle="#1b1b1b",l.fillStyle="#1b1b1b";for(let m=0;m<=3.0001;m+=.1){const p=c+m/3*h,x=Math.abs(m*2-Math.round(m*2))<.001;l.lineWidth=x?6:3,l.beginPath(),l.moveTo(256+Math.cos(p)*220,256+Math.sin(p)*220),l.lineTo(256+Math.cos(p)*(x?180:200),256+Math.sin(p)*(x?180:200)),l.stroke(),x&&(l.font="bold 40px Arial",l.textAlign="center",l.textBaseline="middle",l.fillText(m.toFixed(1),256+Math.cos(p)*145,256+Math.sin(p)*145))}l.font="600 34px Arial",l.textAlign="center",l.fillText("atm",256,340),l.font="500 22px Arial",l.fillText("GAUGE",256,372);const u=new yo(a);u.colorSpace=we,u.anisotropy=4;const d=new tt(new Ks(2.7,48),new Mt({map:u,roughness:.6}));d.position.z=.66,this.dial.add(d);const f=new qe(.1,2.3,.05);f.translate(0,.85,0),this.needle=new tt(f,new Mt({color:12000284,roughness:.4})),this.needle.position.z=.72,this.dial.add(this.needle);const g=new tt(new ne(.22,.22,.15,12),new Mt({color:546,metalness:.5}));g.rotation.x=Math.PI/2,g.position.z=.75,this.dial.add(g);const v=new tt(new Ks(2.75,40),new sn({color:16777215,transparent:!0,opacity:.08,roughness:.02,envMapIntensity:2,depthWrite:!1}));v.position.z=.8,this.dial.add(v),this.group.traverse(m=>{m.raycast=()=>{},m.isMesh&&(m.castShadow=!0)}),this.group.visible=!1,this.setNeedle(0)}faceToward(t){const e=new T;this.group.getWorldPosition(e),this.dial.rotation.y=Math.atan2(t.x-e.x,t.z-e.z)}attachTo(t){this.attached=!!t,t||(this.group.visible=!1)}setNeedle(t){const e=Math.max(0,Math.min(3,t))/3,n=Math.PI*.75+e*Math.PI*1.5;this.needle.rotation.z=-n-Math.PI/2}update(t,e){if(!t)return;if(!this.attached||!t.sealed||t.burst){this.group.visible=!1,this.displayedPressureAtm+=(1-this.displayedPressureAtm)*Math.min(1,e/this.tauSeconds);return}this.group.visible=!0;const n=Math.min(1,e/this.tauSeconds);this.displayedPressureAtm+=(t.pressure_atm-this.displayedPressureAtm)*n,this.setNeedle(this.displayedPressureAtm-1)}readout(){const t=Math.round(this.displayedPressureAtm*100)/100,e=Math.max(0,Math.round((t-1)*100)/100);return{pressure_atm:t,gauge_atm:e,formatted:`${e.toFixed(2)} atm (g)`}}}const Gs=10;class nx{group=new fe;topLocal=new T(0,Gs,-2);ceramicTop;topMat;heaterKnob;stirKnob;heatLed;stirLed;glow=0;heaterWatts=0;isStirring=!1;stirRpm=0;constructor(){this.group.name="equipment_hotplate";const t=new Mt({color:15330280,roughness:.4,metalness:0}),e=new tt(yn(19,9.4,24,1.4),t);e.castShadow=!0,e.receiveShadow=!0,this.group.add(e);const n=new Mt({color:12172995,metalness:1,roughness:.35}),s=new tt(yn(19,.4,19.4,1),n);s.position.set(0,9.3,-2),s.castShadow=!0,this.group.add(s),this.topMat=new Mt({map:iM(),roughness:.18,metalness:0,emissive:new Et(1,.28,.06),emissiveMap:nM(),emissiveIntensity:0}),this.ceramicTop=new tt(yn(18,.32,18,.8),this.topMat),this.ceramicTop.position.set(0,Gs-.32,-2),this.ceramicTop.receiveShadow=!0,this.group.add(this.ceramicTop);const r=new tt(yn(17,.3,3.6,.4),new Mt({color:3225405,roughness:.55}));r.position.set(0,9.38,9.6),this.group.add(r),this.heaterKnob=this.makeKnob(14172949),this.heaterKnob.position.set(-4.5,9.7,9.6),this.stirKnob=this.makeKnob(2001125),this.stirKnob.position.set(4.5,9.7,9.6),this.group.add(this.heaterKnob,this.stirKnob),this.heatLed=new Mt({color:4194304,emissive:16722448,emissiveIntensity:0}),this.stirLed=new Mt({color:10752,emissive:3211104,emissiveIntensity:0});const o=new or(.22,10,8),a=new tt(o,this.heatLed);a.position.set(-1.2,9.6,9.6);const l=new tt(o,this.stirLed);l.position.set(1.2,9.6,9.6),this.group.add(a,l);const c=new Mt({color:1907997,roughness:.9});for(const[h,u]of[[-8,-10],[8,-10],[-8,10],[8,10]]){const d=new tt(new ne(.9,1,.5,12),c);d.position.set(h,-.15,u),this.group.add(d)}this.group.traverse(h=>h.raycast=()=>{})}makeKnob(t){const e=new fe,n=new tt(new ne(1.25,1.35,1.2,28),new Mt({color:2040358,roughness:.35}));n.position.y=.6,n.castShadow=!0;const s=new tt(new qe(.22,.1,.9),new Mt({color:t,roughness:.4}));return s.position.set(0,1.22,-.6),e.add(n,s),e}attachTo(t){if(t){const e=this.topLocal.clone();this.group.localToWorld(e),t.group.position.copy(e)}}setPower(t){this.heaterWatts=Math.max(0,Math.min(1e3,t)),this.heaterKnob.rotation.y=-(this.heaterWatts/1e3)*Math.PI*1.5,this.heatLed.emissiveIntensity=this.heaterWatts>0?2.5:0}setStir(t,e=400){this.isStirring=t,this.stirRpm=t?e:0,this.stirKnob.rotation.y=t?-(e/1500)*Math.PI*1.5:0,this.stirLed.emissiveIntensity=t?2:0}getControls(){return{heater_w:this.heaterWatts,stirring:this.isStirring,stir_rpm:this.stirRpm}}update(t,e){}animate(t){const e=this.heaterWatts/1e3;this.glow+=(e-this.glow)*Math.min(1,t/4),this.topMat.emissiveIntensity=Math.pow(this.glow,.8)*2.4}}const so=15.5;class ix{group=new fe;flame;isActive=!1;powerWatts=0;time=0;constructor(){this.group.name="equipment_burner";const t=new Mt({color:2764339,roughness:.55,metalness:.6}),e=[new H(0,0),new H(4.6,0),new H(4.6,.5),new H(4,1),new H(1.6,1.8),new H(.9,2.2),new H(0,2.2)],n=new tt(new Ue(e,40),t);n.castShadow=!0,n.receiveShadow=!0,this.group.add(n);const s=new Mt({color:13214809,metalness:1,roughness:.3}),r=new tt(new ne(.55,.6,so-2.2,24),s);r.position.y=2.2+(so-2.2)/2,r.castShadow=!0,this.group.add(r);const o=new tt(new ne(.75,.75,1.4,24),s);o.position.y=3.6,this.group.add(o);const a=new tt(new ne(.3,.35,3.2,12),s);a.rotation.z=Math.PI/2,a.position.set(-2,1.9,0),this.group.add(a);const l=new bo([new T(-3.5,1.9,0),new T(-6.5,1.2,1.5),new T(-9,.5,6),new T(-12,.45,14),new T(-16,.45,20)]),c=new tt(new ar(l,40,.42,10,!1),new Mt({color:12601117,roughness:.6}));c.castShadow=!0,this.group.add(c),this.flame=new $u(1),this.flame.configure(0,2,9,{luminosity:0,emitterAmount:0}),this.flame.setInnerCone(!0),this.flame.group.position.y=so,this.group.add(this.flame.group),this.group.traverse(h=>h.raycast=()=>{})}ignite(t=800){this.isActive=!0,this.powerWatts=t,this.flame.setTarget(1)}extinguish(){this.isActive=!1,this.powerWatts=0,this.flame.setTarget(0)}update(t,e){}animate(t){this.time+=t,this.flame.tick(t,this.time)}brightness(){return this.flame.brightness(this.time)*.5}getControls(){return{burner_w:this.isActive?this.powerWatts:0,igniter:this.isActive}}}class sx extends Nu{constructor(){super();const t=new qe;t.deleteAttribute("uv");const e=new Mt({side:Ye}),n=new Mt,s=new qu(16777215,900,28,2);s.position.set(.418,16.199,.3),this.add(s);const r=new tt(t,e);r.position.set(-.757,13.219,.717),r.scale.set(31.713,28.305,28.591),this.add(r);const o=new tt(t,n);o.position.set(-10.906,2.009,1.846),o.rotation.set(0,-.195,0),o.scale.set(2.328,7.905,4.651),this.add(o);const a=new tt(t,n);a.position.set(-5.607,-.754,-.758),a.rotation.set(0,.994,0),a.scale.set(1.97,1.534,3.955),this.add(a);const l=new tt(t,n);l.position.set(6.167,.857,7.803),l.rotation.set(0,.561,0),l.scale.set(3.927,6.285,3.687),this.add(l);const c=new tt(t,n);c.position.set(-2.017,.018,6.124),c.rotation.set(0,.333,0),c.scale.set(2.002,4.566,2.064),this.add(c);const h=new tt(t,n);h.position.set(2.291,-.756,-2.621),h.rotation.set(0,-.286,0),h.scale.set(1.546,1.552,1.496),this.add(h);const u=new tt(t,n);u.position.set(-2.193,-.369,-5.547),u.rotation.set(0,.516,0),u.scale.set(3.875,3.487,2.986),this.add(u);const d=new tt(t,Yi(50));d.position.set(-16.116,14.37,8.208),d.scale.set(.1,2.428,2.739),this.add(d);const f=new tt(t,Yi(50));f.position.set(-16.109,18.021,-8.207),f.scale.set(.1,2.425,2.751),this.add(f);const g=new tt(t,Yi(17));g.position.set(14.904,12.198,-1.832),g.scale.set(.15,4.265,6.331),this.add(g);const v=new tt(t,Yi(43));v.position.set(-.462,8.89,14.52),v.scale.set(4.38,5.441,.088),this.add(v);const m=new tt(t,Yi(20));m.position.set(3.235,11.486,-12.541),m.scale.set(2.5,2,.1),this.add(m);const p=new tt(t,Yi(100));p.position.set(0,20,0),p.scale.set(1,.1,1),this.add(p)}dispose(){const t=new Set;this.traverse(e=>{e.isMesh&&(t.add(e.geometry),t.add(e.material))});for(const e of t)e.dispose()}}function Yi(i){const t=new Sn;return t.color.setScalar(i),t}const qt={xMin:-120,xMax:120,zMin:-45,zMax:32,thickness:3.2,floorY:-90},_e={tiers:[1.6,21.6,41.6],slots:9,spacing:12.6,z:-36.5,xCenter:0};function rx(i,t){const e=new vl(t),n=e.fromScene(new sx,.04);i.environment=n.texture,i.environmentIntensity=.62,e.dispose(),i.background=new Et(14015198);const s=new f_(16054267,5985872,.35);i.add(s);const r=new ua(16774374,2.3);r.position.set(-55,170,95),r.target.position.set(0,0,-6),r.castShadow=!0,r.shadow.mapSize.set(2048,2048);const o=r.shadow.camera;o.left=-135,o.right=135,o.top=95,o.bottom=-95,o.near=40,o.far=380,r.shadow.bias=-4e-4,r.shadow.normalBias=.1,r.shadow.radius=3,i.add(r,r.target);const a=new ua(14477311,.55);a.position.set(110,80,70),i.add(a);const l=new ua(16777215,.35);l.position.set(30,120,-120),i.add(l);const c=new qu(16751164,0,160,2);c.position.set(0,20,0),i.add(c);const h=K_(),u=h.map.clone();u.repeat.set(2.2,.75),u.needsUpdate=!0;const d=h.roughnessMap.clone();d.repeat.set(2.2,.75),d.needsUpdate=!0;const f=new sn({map:u,roughnessMap:d,roughness:.55,metalness:0,clearcoat:.35,clearcoatRoughness:.35,envMapIntensity:.8}),g=qt.xMax-qt.xMin,v=qt.zMax-qt.zMin,m=new fs,p=1.2;m.moveTo(qt.xMin,qt.zMin),m.lineTo(qt.xMax,qt.zMin),m.lineTo(qt.xMax,qt.zMax-p),m.quadraticCurveTo(qt.xMax,qt.zMax,qt.xMax-p,qt.zMax),m.lineTo(qt.xMin+p,qt.zMax),m.quadraticCurveTo(qt.xMin,qt.zMax,qt.xMin,qt.zMax-p),m.lineTo(qt.xMin,qt.zMin);const x=new Ci(m,{depth:qt.thickness-.8,bevelEnabled:!0,bevelThickness:.4,bevelSize:.4,bevelSegments:3,curveSegments:4});x.rotateX(Math.PI/2),x.translate(0,-.4,0);{const ft=x.attributes.position,bt=new Float32Array(ft.count*2);for(let j=0;j<ft.count;j++)bt[j*2]=(ft.getX(j)-qt.xMin)/g,bt[j*2+1]=(ft.getZ(j)-qt.zMin)/v+ft.getY(j)*.01;x.setAttribute("uv",new Re(bt,2))}const M=new tt(x,f);M.receiveShadow=!0,M.castShadow=!1,i.add(M);const _=tM().clone();_.repeat.set(3,1),_.wrapS=os,_.needsUpdate=!0;const I=new Mt({map:_,roughness:.6,metalness:0}),E=new tt(new qe(g-4,90-qt.thickness-10,v-6),[new Mt({color:13225419,roughness:.7}),new Mt({color:13225419,roughness:.7}),new Mt({color:13225419,roughness:.7}),new Mt({color:13225419,roughness:.7}),I,new Mt({color:13225419,roughness:.7})]),C=90-qt.thickness-10;E.position.set(0,-3.2-C/2,(qt.zMin+qt.zMax)/2-2),E.receiveShadow=!0,i.add(E);const P=new tt(new qe(g-6,10,v-12),new Mt({color:2961459,roughness:.8}));P.position.set(0,qt.floorY+5,(qt.zMin+qt.zMax)/2-5),i.add(P);const b=Q_().clone();b.repeat.set(12,12),b.needsUpdate=!0;const y=new tt(new ze(600,600),new Mt({map:b,roughness:.75}));y.rotation.x=-Math.PI/2,y.position.set(0,qt.floorY,100),y.receiveShadow=!0,i.add(y);const R=Z_(),O=ft=>{const bt=ft.clone();return bt.repeat.set(320/60,75/30),bt.needsUpdate=!0,bt},N=new Mt({map:O(R.map),roughnessMap:O(R.roughnessMap),bumpMap:O(R.bumpMap),bumpScale:.6,roughness:1,metalness:0}),U=new tt(new ze(320,75),N);U.position.set(0,37.5,qt.zMin),U.receiveShadow=!0,i.add(U);const F=J_("#dfe3dd").clone();F.repeat.set(4,2),F.needsUpdate=!0;const V=new Mt({map:F,roughness:.92,metalness:0}),K=new tt(new ze(320,140),V);K.position.set(0,145,qt.zMin),i.add(K);const q=new tt(new ze(320,90),V);q.position.set(0,qt.floorY/2,qt.zMin-.2),i.add(q);for(const ft of[-160,160]){const bt=new tt(new ze(400,310),V);bt.position.set(ft,qt.floorY+155,155),bt.rotation.y=ft<0?Math.PI/2:-Math.PI/2,bt.receiveShadow=!0,i.add(bt)}const D=new tt(new ze(110,90),new Sn({map:eM(),toneMapped:!1,color:16777215}));D.position.set(-159.5,70,40),D.rotation.y=Math.PI/2,i.add(D);const G=new tt(new qe(8,2,116),new Mt({color:15330280,roughness:.5}));G.position.set(-157,24,40),i.add(G);const et=new tt(new ze(320,400),new Mt({color:15922161,roughness:.95}));et.rotation.x=Math.PI/2,et.position.set(0,220,155),i.add(et);for(const ft of[-60,60]){const bt=new tt(new ze(60,30),new Sn({color:16777215,toneMapped:!1}));bt.rotation.x=Math.PI/2,bt.position.set(ft,219.5,20),i.add(bt)}const dt=ju().clone();dt.repeat.set(1.5,1),dt.needsUpdate=!0;const Ht=new Mt({map:dt,roughness:.6,metalness:0,color:15260875}),Q=new Mt({color:12830924,metalness:1,roughness:.32}),ot=_e.slots*_e.spacing+4,mt=13,lt=_e.xCenter-ot/2;for(let ft=0;ft<_e.tiers.length;ft++){const bt=_e.tiers[ft],j=new tt(new qe(ot,1.6,mt),Ht);j.position.set(_e.xCenter,bt-.8,_e.z),j.castShadow=!0,j.receiveShadow=!0,i.add(j);const it=new tt(new ne(.35,.35,ot,10),Q);it.rotation.z=Math.PI/2,it.position.set(_e.xCenter,bt+3,_e.z+mt/2-.4),it.castShadow=!0,i.add(it);for(const L of[lt+.4,lt+ot-.4]){const At=new tt(new ne(.3,.3,3,8),Q);At.position.set(L,bt+1.5,_e.z+mt/2-.4),i.add(At)}}const Pt=_e.tiers[_e.tiers.length-1]+24;for(const ft of[lt+.9,lt+ot-.9])for(const bt of[_e.z-mt/2+.9,_e.z+mt/2-.9]){const j=new tt(new ne(.75,.75,Pt,14),Q);j.position.set(ft,Pt/2,bt),j.castShadow=!0,i.add(j)}const Ft=_e.tiers.map(ft=>{const bt=[];for(let j=0;j<_e.slots;j++)bt.push(new T(_e.xCenter-(_e.slots-1)*_e.spacing/2+j*_e.spacing,ft,_e.z));return bt});return ox(i),{keyLight:r,fireLight:c,shelfSlots:Ft,dispose:()=>n.dispose()}}function ox(i){const t=new sn({color:15987954,roughness:.4,transmission:0,transparent:!0,opacity:.92,sheen:.3}),e=[new H(0,0),new H(3.6,0),new H(3.9,.6),new H(3.9,14),new H(3,16),new H(1.4,17.2),new H(1.4,18),new H(0,18)],n=new fe,s=new tt(new Ue(e,32),t);s.castShadow=!0,n.add(s);const r=new Mt({color:3112912,roughness:.45}),o=new tt(new ne(1.7,1.7,1.8,24),r);o.position.y=18.8,n.add(o);const a=new tt(new ar(new bo([new T(0,19.6,0),new T(0,23,0),new T(1.5,25,0),new T(5,24,0)]),20,.22,8),new Mt({color:15790318,roughness:.5}));n.add(a),n.position.set(-104,0,-20),n.rotation.y=.6,i.add(n);const l=new tt(new ne(6,6,24,40),new Mt({color:16184816,roughness:.95}));l.rotation.z=Math.PI/2,l.position.set(104,7.2,-32),l.castShadow=!0,l.receiveShadow=!0,i.add(l);const c=new tt(new qe(30,1,10),new Mt({color:12107201,metalness:1,roughness:.35}));c.position.set(104,.5,-32),i.add(c)}const ax={liquid:[0,1,2],dropper:[1,0,2],jar:[2,1,0]};class lx{constructor(t,e){this.scene=t,this.slots=e,this.occupied=e.map(n=>n.map(()=>null))}entries=new Map;meta=new Map;occupied;clock=0;busy=new Set;onChange;get capacity(){return this.slots.reduce((t,e)=>t+e.length,0)}getMeta(t){return this.meta.get(t)}get(t){return this.entries.get(t)?.asm}assemblies(){return Array.from(this.entries.values(),t=>t.asm)}touch(t){const e=this.entries.get(t);e&&(e.lastUsed=++this.clock)}setBusy(t,e){e?this.busy.add(t):this.busy.delete(t)}add(t){const e=this.meta.get(t.id);e?.colorHex&&!t.colorHex&&(t={...t,colorHex:e.colorHex}),this.meta.set(t.id,t);const n=this.entries.get(t.id);if(n)return n.lastUsed=++this.clock,n.asm;const s=rd(t);let r=this.freeSlot(s);if(!r){const l=this.lru();if(!l)return;r={tier:l.tier,slot:l.slot},this.evict(l.input.id)}const o=ad(t),a=this.slots[r.tier][r.slot];return o.group.position.copy(a),o.group.rotation.y=cx(t.id)%100/100*.3-.15,this.scene.add(o.group),this.occupied[r.tier][r.slot]=t.id,this.entries.set(t.id,{input:t,asm:o,tier:r.tier,slot:r.slot,lastUsed:++this.clock}),this.onChange?.(),o}evict(t){const e=this.entries.get(t);e&&(this.occupied[e.tier][e.slot]=null,this.entries.delete(t),e.asm.dispose(),this.onChange?.())}homeOf(t){const e=this.entries.get(t);return e?this.slots[e.tier][e.slot].clone():void 0}freeSlot(t){for(const e of ax[t]){if(e>=this.slots.length)continue;const n=this.occupied[e];for(let s=0;s<n.length;s++)if(!n[s])return{tier:e,slot:s}}return null}lru(){let t=null;for(const e of this.entries.values())this.busy.has(e.input.id)||(!t||e.lastUsed<t.lastUsed)&&(t=e);return t}}function cx(i){let t=0;for(let e=0;e<i.length;e++)t=t*31+i.charCodeAt(e)>>>0;return t}class hx{tasks=[];finish=new Map;add(t,e){this.tasks.push(t),e&&this.finish.set(t,e)}tick(t,e){for(let n=0;n<this.tasks.length;){const s=this.tasks[n];let r=!0;try{r=s.update(t,e)}catch(o){console.error("[bench] animation task failed",o),r=!0}if(r){this.tasks.splice(n,1);const o=this.finish.get(s);o&&(this.finish.delete(s),o())}else n++}}get active(){return this.tasks.length>0}isBusy(t){return this.tasks.some(e=>e.owns?.includes(t))}}const He={inOut:i=>i<.5?2*i*i:1-Math.pow(-2*i+2,2)/2,out:i=>1-(1-i)*(1-i),in:i=>i*i,smooth:i=>i*i*(3-2*i)};function cr(i){let t=!1;return()=>{if(!t){t=!0;try{i?.()}catch(e){console.error("[bench] onComplete threw",e)}}}}const Mi=981,po=new T(0,1,0);function ux(i,t,e,n,s){const a=[],l=[],c=[],h=[],u=new T().crossVectors(t,po).normalize(),d=new T,f=new T,g=new T,v=new T;for(let p=0;p<=40;p++){const x=p/40;d.copy(i).addScaledVector(t,e*x),d.y-=n*x*x,f.copy(t).multiplyScalar(e).addScaledVector(po,-2*n*x).normalize(),g.copy(u),v.crossVectors(f,g).normalize();const M=s*(1-.45*Math.sqrt(x));for(let _=0;_<=10;_++){const I=_/10*Math.PI*2,E=g.x*Math.cos(I)+v.x*Math.sin(I),C=g.y*Math.cos(I)+v.y*Math.sin(I),P=g.z*Math.cos(I)+v.z*Math.sin(I);a.push(d.x+E*M,d.y+C*M,d.z+P*M),l.push(E,C,P),c.push(x)}}for(let p=0;p<40;p++)for(let x=0;x<10;x++){const M=p*11+x,_=M+10+1;h.push(M,_,M+1,_,_+1,M+1)}const m=new pe;return m.setAttribute("position",new jt(a,3)),m.setAttribute("normal",new jt(l,3)),m.setAttribute("aS",new jt(c,1)),m.setIndex(h),m}function dx(i){const t=new Et(i),e=t.r*.3+t.g*.59+t.b*.11,n={value:0},s={value:0},r={value:0},o=new sn({color:e>.82?new Et(15660795):t,roughness:.04,metalness:0,ior:1.333,transparent:!0,opacity:e>.82?.32:.82,envMapIntensity:1.6,depthWrite:!1,clearcoat:.5});return o.onBeforeCompile=a=>{a.uniforms.uHead=n,a.uniforms.uTail=s,a.uniforms.uTimeS=r,a.vertexShader=a.vertexShader.replace("#include <common>",`#include <common>
attribute float aS;
varying float vS;
uniform float uTimeS;`).replace("#include <begin_vertex>",`#include <begin_vertex>
vS = aS;
transformed += normal * 0.03 * sin( aS * 40.0 - uTimeS * 30.0 );`),a.fragmentShader=a.fragmentShader.replace("#include <common>",`#include <common>
varying float vS;
uniform float uHead;
uniform float uTail;`).replace("void main() {",`void main() {
if ( vS > uHead || vS < uTail ) discard;`)},o.customProgramCacheKey=()=>"pour_stream",{mat:o,head:n,tail:s,time:r}}function Nh(i,t,e,n,s){const r=t.object,o=r.position.clone(),a=r.quaternion.clone(),l=e.group.position.clone(),c=l.y+e.profile.rimY+e.profile.baseOffsetY,h=e.profile.rimOuterRadius,u=new T(o.x-l.x,0,o.z-l.z);u.lengthSq()<1e-4&&u.set(-1,0,0),u.normalize();const d=u.clone().negate(),f=Math.atan2(u.z,-u.x),g=new Me().setFromAxisAngle(po,f),v=l.clone().addScaledVector(u,h+.45),m=t.lipLocal.x,p=t.lipHeight,x=t.bodyRadius,M=pt=>Math.max(0,p*Math.cos(pt)+(x-m)*Math.sin(pt),p*Math.cos(pt)-(x+m)*Math.sin(pt)),_=t.isBottle?1.15:Math.max(.35,Math.min(1.45,Math.atan2(Math.max(.2,p-t.fillHeight),Math.max(.5,m)))),I=t.isBottle?1.85:Math.min(1.95,_+.4),E=Math.max(t.groundY,0),C=Math.max(c+1,E+.8+M(_-.2)),P=pt=>Math.max(C,E+.8+M(pt)),b=new Me,y=new T,R=(pt,A,S)=>{b.setFromAxisAngle(new T(0,0,1),-pt),S.copy(g).multiply(b),y.copy(t.lipLocal).applyQuaternion(S),A.set(v.x,P(pt),v.z).sub(y)},O=new T,N=new Me;R(0,O,N),O.y+=1.5;const U=new T,F=new Me;R(Math.max(0,_-.25),U,F);const V=new T(v.x,C,v.z).addScaledVector(d,.1),K=l.y+e.surfaceLocalY(),q=Math.max(.5,V.y-K),D=h+.45-e.profile.rimInnerRadius*.25,G=ux(V,d,D,q,t.isBottle?.27:.34),et=dx(n),dt=new tt(G,et.mat);dt.frustumCulled=!1,dt.raycast=()=>{},dt.visible=!1,i.add(dt);const Ht=new T(V.x,K,V.z).addScaledVector(d,D),Q=new Et(n),ot=Math.sqrt(2*q/Mi),mt=.5,lt=.35,Pt=.85,Ft=.25,ft=.55,bt=mt+lt,j=bt+Pt,it=j+Ft+ft;let L=0,At=!1,at=0;const wt=cr(s);t.onStart?.(),t.temporary&&r.scale.setScalar(.01);const ct=new T,Bt=new Me;return{owns:[r,e.group],update:(pt,A)=>{if(L+=pt,et.time.value=A,dt.renderOrder=e.glassMesh.renderOrder-1,L<mt){const S=He.inOut(L/mt);ct.lerpVectors(o,O,S),ct.y+=Math.sin(S*Math.PI)*6,Bt.slerpQuaternions(a,N,S),r.position.copy(ct),r.quaternion.copy(Bt),t.temporary&&r.scale.setScalar(Math.max(.01,Math.min(1,L/.25)))}else if(L<j+Ft){let S;if(L<bt?S=_*He.inOut((L-mt)/lt):L<j?S=_+(I-_)*He.smooth((L-bt)/Pt):S=I+(Math.max(0,_-.25)-I)*He.inOut((L-j)/Ft),R(S,ct,Bt),L<mt+.08&&ct.lerp(O,1-(L-mt)/.08),r.position.copy(ct),r.quaternion.copy(Bt),L>=bt){dt.visible=!0;const W=L-bt;if(et.head.value=Math.min(1,Math.sqrt(Math.min(1,.5*Mi*W*W/q+W*1.5))),L>j){const Z=L-j;et.tail.value=Math.min(1.01,Math.sqrt(Math.min(1,.5*Mi*Z*Z/q+Z*2)))}if(!At&&W>=ot*.9){At=!0;const Z=e.glassRoot.worldToLocal(Ht.clone());e.effects.splashAt(Z.x,Z.z,Q,10,1),e.liquid.slosh(.03,d.x,d.z),wt()}if(At&&L<j+.1&&A-at>.12){at=A;const Z=e.glassRoot.worldToLocal(Ht.clone());e.effects.splashAt(Z.x,Z.z,Q,2,.6)}}}else if(L<it){dt.visible=et.tail.value<1;const S=L-j;et.tail.value=Math.min(1.01,Math.sqrt(Math.min(1,.5*Mi*S*S/q+S*2)));const W=He.inOut((L-j-Ft)/ft);ct.lerpVectors(U,o,W),ct.y+=Math.sin(W*Math.PI)*5,Bt.slerpQuaternions(F,a,W),r.position.copy(ct),r.quaternion.copy(Bt),t.temporary&&r.scale.setScalar(Math.max(.01,Math.min(1,(it-L)/.25)))}else return r.position.copy(o),r.quaternion.copy(a),i.remove(dt),G.dispose(),et.mat.dispose(),wt(),t.onEnd?.(),!0;return!1}}}let Oh=null;function fx(i,t,e,n,s,r,o){Oh??=new or(.23,14,10);const a=od();i.add(a);const l=new Et(s),c=l.r*.3+l.g*.59+l.b*.11,h=new sn({color:c>.82?15660795:l,roughness:.03,transparent:!0,opacity:c>.82?.45:.85,envMapIntensity:2,depthWrite:!1}),u=e.group.position.clone(),d=u.y+e.profile.rimY+e.profile.baseOffsetY,f=new T(t.x-u.x,0,t.z-u.z);f.lengthSq()<1e-4&&f.set(-1,0,0),f.normalize();const g=u.clone().addScaledVector(f,e.profile.rimInnerRadius*.25);g.y=d+3;const v=o.fromAbove?g.clone().add(new T(0,14,0)):t.clone();a.position.copy(v);const m=a.getObjectByName("bulb"),p=Math.max(1,Math.min(8,Math.round(n))),x=p>4?.2:.3,M=.6,_=M+.15,I=_+(p-1)*x,E=()=>e.group.position.y+e.surfaceLocalY(),C=[];let P=0,b=0,y=-1;const R=cr(r);return o.onStart?.(),{owns:[e.group],update:O=>{if(b+=O,b<M){const F=He.inOut(b/M);a.position.lerpVectors(v,g,F),a.position.y+=Math.sin(F*Math.PI)*8}else y<0&&a.position.copy(g);if(P<p&&b>=_+P*x){const F=new tt(Oh,h);F.position.copy(g).add(new T(0,-.15,0)),F.raycast=()=>{},F.renderOrder=e.glassMesh.renderOrder-1,i.add(F),C.push({m:F,v:0,done:!1}),P++}const N=P<p&&b>_-.1?Math.max(0,1-Math.abs((b-_)%x/x-.5)*2):0;m.scale.set(1+N*.12,1-N*.22,1+N*.12);for(const F of C)if(!F.done&&(F.v+=Mi*O,F.m.position.y-=F.v*O,F.m.scale.set(1,1+Math.min(.5,F.v/400),1),F.m.position.y<=E())){F.done=!0,i.remove(F.m);const V=e.glassRoot.worldToLocal(F.m.position.clone());e.effects.splashAt(V.x,V.z,l,4,.5),R()}if(P>=p&&C.every(F=>F.done)&&y<0&&b>I+.25&&(y=b),y>=0){const F=Math.min(1,(b-y)/.6);if(a.position.lerpVectors(g,v,He.inOut(F)),a.position.y+=Math.sin(F*Math.PI)*8,F>=1){i.remove(a);for(const V of C)i.remove(V.m);return h.dispose(),R(),o.onEnd?.(),!0}}if(b>8){i.remove(a);for(const F of C)i.remove(F.m);return h.dispose(),R(),o.onEnd?.(),!0}return!1}}}function px(i,t,e,n,s,r,o){const a=e.group.position.clone(),l=a.y+e.profile.rimY+e.profile.baseOffsetY,c=()=>e.group.position.y+e.surfaceLocalY(),h=cr(r),u=new Et(n);if(o.onStart?.(),s){const U=new tt(Ku(),new Mt({color:u.getHex()===16777215?12632774:u,metalness:1,roughness:.3,side:je})),F=Math.min(1,(e.profile.rimInnerRadius*2-.4)/5);U.scale.setScalar(Math.max(.35,F)),U.castShadow=!0,U.position.set(a.x,l+9,a.z),i.add(U);let V=0,K=0,q=!1;return{owns:[e.group],update:D=>{if(K+=D,K<.35)return U.position.y=l+9-He.out(K/.35)*3,!1;if(!q&&(V+=Mi*.6*D,U.position.y-=V*D,U.rotation.x+=D*4,U.rotation.y+=D*2,U.position.y<=c()+.1||K>3)){q=!0;const G=e.glassRoot.worldToLocal(U.position.clone());return e.effects.splashAt(G.x,G.z,new Et(e.getLiquidColorHex()),8,.8),h(),i.remove(U),U.material.dispose(),o.onEnd?.(),!0}return!1}}}const d=HM(),f=new T(t.x-a.x,0,t.z-a.z);f.lengthSq()<1e-4&&f.set(-1,0,0),f.normalize();const g=Math.atan2(f.z,-f.x),v=new Mt({color:u,roughness:.95}),m=new tt(new or(.55,14,8),v);m.scale.set(1,.45,.8),m.position.set(.3,.15,0),d.add(m);const p=a.clone().addScaledVector(f,e.profile.rimInnerRadius*.3);p.y=l+2.5;const x=new Me().setFromAxisAngle(po,g+Math.PI),M=t.clone();d.position.copy(M),d.quaternion.copy(x),i.add(d);const _=new io(160,Sl());_.fadeIn=0,_.points.renderOrder=e.glassMesh.renderOrder-1,i.add(_.points);const I=.6,E=.3,C=.6,P=.55;let b=0,y=0;const R=new T(1,0,0),O=new Me,N=new T;return{owns:[e.group],update:(U,F)=>{if(b+=U,b<I){const K=He.inOut(b/I);d.position.lerpVectors(M,p,K),d.position.y+=Math.sin(K*Math.PI)*8}else if(b<I+E+C){d.position.copy(p);const K=Math.min(1,(b-I)/E);if(O.setFromAxisAngle(R,He.inOut(K)*1.25),d.quaternion.copy(x).multiply(O),b>I+E*.5)for(m.scale.multiplyScalar(Math.max(0,1-U*3)),y+=220*U;y>=1;){y-=1,N.set(.3+Math.random()*.6,0,(Math.random()-.5)*.8).applyQuaternion(d.quaternion).add(d.position);const q=.85+Math.random()*.3;_.spawn(N.x,N.y,N.z,(Math.random()-.5)*3,-Math.random()*5,(Math.random()-.5)*3,2,.28,.22,.95,u.r*q,u.g*q,u.b*q,Mi*.5,1.5,0)}}else if(b<I+E+C+P){const K=He.inOut((b-I-E-C)/P);d.position.lerpVectors(p,M,K),d.position.y+=Math.sin(K*Math.PI)*8,d.quaternion.copy(x)}const V=c();for(let K=0;K<_.live;K++)if(_.pos[K*3+1]<=V){if(_.life[K]<_.maxLife[K]-.01){const q=e.glassRoot.worldToLocal(N.set(_.pos[K*3],V,_.pos[K*3+2]));Math.random()<.08&&e.liquid.impact(q.x,q.z,.3,F),h()}_.maxLife[K]=_.life[K]}return _.update(U),b>=I+E+C+P&&_.live===0?(i.remove(d),i.remove(_.points),_.dispose(),m.geometry.dispose(),v.dispose(),h(),o.onEnd?.(),!0):b>8?(i.remove(d),i.remove(_.points),_.dispose(),h(),o.onEnd?.(),!0):!1}}}function Fh(i,t,e,n=0){const s=i.position.clone(),r=Math.max(s.y,t.y,n)+5,o=.35,a=Math.min(1,.4+s.distanceTo(t)/120),l=.35;let c=0;const h=cr(e);return{owns:[i],update:u=>{if(c+=u,c<o){const d=He.inOut(c/o);i.position.set(s.x,s.y+(r-s.y)*d,s.z)}else if(c<o+a){const d=He.inOut((c-o)/a);i.position.set(s.x+(t.x-s.x)*d,r,s.z+(t.z-s.z)*d)}else if(c<o+a+l){const d=He.out((c-o-a)/l);i.position.set(t.x,r+(t.y-r)*d,t.z)}else return i.position.copy(t),h(),!0;return!1}}}function mx(i){if(!i)return null;const t=i.includes("25")||i.includes("1 atm")||i.includes("760 mm"),e=i.match(/([-+]?[0-9]*\.?[0-9]+)\s*(?:°|deg|degrees)?\s*([CFK])/i);if(e){let n=parseFloat(e[1]);const s=e[2].toUpperCase();return s==="F"?n=(n-32)*(5/9):s==="K"&&(n=n-273.15),{value:Math.round(n*10)/10,unit:"°C",originalText:i,isStandardConditions:t}}return null}function gx(i){if(!i)return null;const t=i.includes("20")||i.includes("25")||i.includes("4 °C"),e=i.match(/([0-9]*\.?[0-9]+)\s*(?:g\/cm3|g\/cm\^?3|g\/cu\.?\s?cm|g\/mL|g\/cc|kg\/m3)/i);if(e){let n=parseFloat(e[1]);return i.toLowerCase().includes("kg/m3")&&(n=n/1e3),{value:Math.round(n*1e3)/1e3,unit:"g/cm³",originalText:i,isStandardConditions:t}}return null}function ba(i,t){if(i.length===0)return t;const e=i.filter(o=>o.isStandardConditions),s=(e.length>0?e:i).map(o=>o.value).sort((o,a)=>o-a),r=Math.floor(s.length/2);return s.length%2===0?(s[r-1]+s[r])/2:s[r]}function vx(i){if(!i)return[];const t=i.match(/H[0-9]{3}[a-zA-Z]*/g);return t?Array.from(new Set(t)):[]}function _x(i,t){const e=new Set(t),n={},s=o=>{const a=o?.Value?.StringWithMarkup;return Array.isArray(a)?a.map(l=>typeof l?.String=="string"?l.String:"").filter(Boolean):[]},r=(o,a)=>{if(!(!o||typeof o!="object"||a>8)){if(typeof o.TOCHeading=="string"&&e.has(o.TOCHeading)){const l=n[o.TOCHeading]??=[];for(const c of o.Information??[])l.push(...s(c))}if(Array.isArray(o.Section))for(const l of o.Section)r(l,a+1);o.Record&&r(o.Record,a+1)}};return r(i,0),n}function Mx(i){const t=i.slice(0,4).join(" ; ").toLowerCase(),e=[["solid",/\b(solid|powder|crystal\w*|flakes?|granul\w*|pellets?|prills?|needles?|plates?|lumps?|tablets?|dust|metal)\b/],["liquid",/\b(liquid|solution|oil|oily|syrup\w*)\b/],["gas",/\b(gas|vapou?r)\b/]];let n;for(const[s,r]of e){const o=r.exec(t);o&&(!n||o.index<n.i)&&(n={k:s,i:o.index})}return n?.k}const xx=[[/\b(colou?rless|clear|transparent)\b/,"#e8f4fa"],[/\bwhite\b/,"#f4f3ef"],[/\b(yellow|straw)\b/,"#e8d34a"],[/\borange\b/,"#e98a2b"],[/\bred\b/,"#c8332c"],[/\bpink\b/,"#e79bb4"],[/\b(purple|violet|lilac)\b/,"#7b4fa8"],[/\bblue\b/,"#3d6fc4"],[/\bgreen\b/,"#4f9a55"],[/\bbrown\b/,"#7b5233"],[/\bblack\b/,"#262626"],[/\b(gr[ae]y|silver\w*)\b/,"#9b9da0"]];function yx(i){const t=i.slice(0,4).join(" ; ").toLowerCase();let e;for(const[n,s]of xx){const r=n.exec(t);r&&(!e||r.index<e.i)&&(e={c:s,i:r.index})}if(e)return/\b(pale|light)\b/.test(t)&&e.c!=="#e8f4fa"&&e.c!=="#f4f3ef"?Bh(e.c,"#ffffff",.45):/\bdark\b/.test(t)?Bh(e.c,"#000000",.4):e.c}function Bh(i,t,e){const n=[1,3,5].map(r=>parseInt(i.slice(r,r+2),16)),s=[1,3,5].map(r=>parseInt(t.slice(r,r+2),16));return"#"+n.map((r,o)=>Math.round(r+(s[o]-r)*e).toString(16).padStart(2,"0")).join("")}function nr(i){const t=i.userOverrides?.mp_c;if(typeof t=="number"&&isFinite(t))return t>28;if(i.state)return i.state==="solid";const e=i.sourcedProperties?.mp_c;return typeof e=="number"&&isFinite(e)&&e>28}const $r=new T(0,0,6),bx=new T(46,0,-14),Sx=new T(80,0,-4),Sa=new T(-80,0,-12);class wx{scene;camera;renderer;controls;onSelectObject;onDeselect;instruments;onPourRequested;container;room;glasswareMap=new Map;shelf;animator=new hx;raycaster=new g_;pointer=new H;opticsTables=null;slots=[];slotOwner=[];vesselSlot=new Map;hotPlateVessel=null;selectedId=null;hoverKey=null;hoverDirty=!1;pointerInside=!1;downPos=null;thermoMotion;phMotion;thermoPark={pos:new T(26,wl+.05,7),up:new T(1,0,0)};phPark={pos:new T(33,Jn+.05,2.5),up:new T(.97,0,-.1).normalize()};transient=new Set;cameraTween=null;time=0;lastFrame=performance.now();shadowTimer=0;tickWarned=new Set;shadowDirty=!0;rafId=0;resizeObserver;footprints;constructor(t){this.container=t;const e=Math.max(1,t.clientWidth),n=Math.max(1,t.clientHeight);this.scene=new Nu,this.camera=new tn(40,e/n,4,900),this.camera.position.set(0,50,102),this.renderer=new Iv({antialias:!0,alpha:!1,powerPreference:"high-performance"}),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.setSize(e,n),this.renderer.outputColorSpace=we,this.renderer.toneMapping=ou,this.renderer.toneMappingExposure=1,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=iu,this.renderer.shadowMap.autoUpdate=!1,this.renderer.domElement.style.display="block",this.renderer.domElement.style.touchAction="none",t.appendChild(this.renderer.domElement),vh(n*this.renderer.getPixelRatio(),this.camera.fov),this.controls=new M_(this.camera,this.renderer.domElement),this.controls.target.set(0,15,-8),this.controls.enableDamping=!0,this.controls.dampingFactor=.08,this.controls.enablePan=!1,this.controls.minDistance=16,this.controls.maxDistance=190,this.controls.minPolarAngle=.12,this.controls.maxPolarAngle=1.38,this.controls.minAzimuthAngle=-1.35,this.controls.maxAzimuthAngle=1.35,this.controls.rotateSpeed=.6,this.controls.zoomSpeed=.9,this.controls.update(),this.room=rx(this.scene,this.renderer),this.shelf=new lx(this.scene,this.room.shelfSlots),this.shelf.onChange=()=>this.shadowDirty=!0;const s=new ZM,r=new ql,o=new tx,a=new ex,l=new nx,c=new ix;l.group.position.copy($r),r.group.position.copy(bx),r.group.rotation.y=-.35,o.group.position.copy(Sx),o.group.rotation.y=-.3,c.group.position.copy(Sa),c.group.rotation.y=.4,this.scene.add(s.group,r.group,o.group,a.group,l.group,c.group),this.instruments={thermometer:s,phMeter:r,balance:o,pressureGauge:a,hotPlate:l,burner:c},this.thermoMotion={bundle:null,t:1,fromPos:new T,fromQuat:new Me},this.phMotion={bundle:null,t:1,fromPos:new T,fromQuat:new Me},this.updateProbes(0,!0),this.footprints=[{x0:-9.5,x1:9.5,z0:$r.z-12,z1:$r.z+12},{x0:36,x1:57,z0:-26,z1:-2},{x0:67,x1:93,z0:-19,z1:11},{x0:-97,x1:-73,z0:-18,z1:10}],this.buildSlots(),this.resizeObserver=new ResizeObserver(()=>this.onResize()),this.resizeObserver.observe(t),window.addEventListener("resize",this.onResize);const h=this.renderer.domElement;h.addEventListener("pointerdown",this.onPointerDown),h.addEventListener("pointerup",this.onPointerUp),h.addEventListener("pointermove",this.onPointerMove),h.addEventListener("pointerleave",this.onPointerLeave),this.animate()}buildSlots(){const n=[];for(const r of[-24,24,-39,39,-54,54,-69,69])n.push(new T(r,0,12));for(const r of[0,-15,15,-30,30,-45,45,-60,60])n.push(new T(r,0,-15));const s=7;this.slots=n.filter(r=>!this.footprints.some(o=>r.x>o.x0-s&&r.x<o.x1+s&&r.z>o.z0-s&&r.z<o.z1+s)),this.slotOwner=this.slots.map(()=>null)}allocSlot(t){let e=this.slotOwner.indexOf(null);if(e<0){const n=this.slots.length;this.slots.push(new T(-75+n%6*14,0,22)),this.slotOwner.push(null),e=this.slots.length-1}return this.slotOwner[e]=t,this.vesselSlot.set(t,e),e}freeSlotOf(t){const e=this.vesselSlot.get(t);e!==void 0&&(this.slotOwner[e]=null,this.vesselSlot.delete(t))}hotPlateTopWorld(){return this.instruments.hotPlate.topLocal.clone().add($r)}groundAt(t,e){const n=this.hotPlateTopWorld();return Math.abs(t-n.x)<9&&Math.abs(e-n.z)<9?Gs:0}addVessel(t,e,n){const s=this.glasswareMap.get(t.id);if(s)return s;const r=KM(t),o=this.allocSlot(t.id);return r.group.position.copy(this.slots[o]),r.group.rotation.y=0,this.scene.add(r.group),this.glasswareMap.set(t.id,r),this.shadowDirty=!0,r}removeVessel(t){const e=this.glasswareMap.get(t);e&&(this.selectedId===t&&this.setSelectedVessel(null),this.hotPlateVessel===t&&(this.hotPlateVessel=null),this.freeSlotOf(t),this.glasswareMap.delete(t),e.dispose(),this.scene.remove(e.group),this.shadowDirty=!0)}getGlassware(t){return this.glasswareMap.get(t)}getAllVessels(){return Array.from(this.glasswareMap.values()).map(t=>t.vesselState)}addReagentBottle(t){this.shelf.add(VM(t))}addBottle(t,e,n){const s=nr(t);this.shelf.add({id:t.id,name:t.name,formula:t.formula,ghs:t.ghs,signal_word:t.ghs&&t.ghs.length?"Warning":"",bottle_colour:"clear",form:s?"solid":"solution",by_mass:s,colorHex:t.color})}setBottleContentColor(t,e){const n=this.shelf.getMeta(t);n&&(n.colorHex=e),this.shelf.get(t)?.setContentColor(e)}setOpticsTables(t){this.opticsTables=t,GM(t)}getOpticsTables(){return this.opticsTables}setSelectedVessel(t){const e=t?this.glasswareMap.get(t)??null:null,n=e?t:null;for(const[c,h]of this.glasswareMap)h.setSelected(c===n);const{thermometer:s,phMeter:r,balance:o,pressureGauge:a}=this.instruments,l=!!e&&(e.vesselState.isSealed||this.isSealed(e));a.attachTo(l?e:null),e&&!e.lastSnapshot&&e.effects.setSealed(e.vesselState.isSealed),n!==this.selectedId&&(this.selectedId=n,s.attachTo(e),r.attachTo(e),o.attachTo(e),this.startProbeMotion(this.thermoMotion,s.group,e),this.startProbeMotion(this.phMotion,r.probe,e))}isSealed(t){return t.lastSnapshot?t.lastSnapshot.sealed&&!t.lastSnapshot.burst:t.vesselState.isSealed}startProbeMotion(t,e,n){e.updateWorldMatrix(!0,!1),e.getWorldPosition(t.fromPos),e.getWorldQuaternion(t.fromQuat),t.bundle=n,t.t=0}updateInstruments(t,e){const{thermometer:n,phMeter:s,balance:r,pressureGauge:o,hotPlate:a,burner:l}=this.instruments,c=this.selectedId?this.glasswareMap.get(this.selectedId):void 0;if(c){const h=c.probeLocal("ph",Jn).tip;s.setImmersed(c.surfaceLocalY()-h.y>.5&&this.phMotion.t>=1);const u=t.sealed&&!t.burst;o.attachTo(u?c:null)}else s.setImmersed(!1);n.update(t,e),s.update(t,e),r.update(t,e),o.update(t,e),a.update(t,e),l.update(t,e)}probeTarget(t,e,n,s,r){const o=t.bundle;if(o&&this.glasswareMap.has(o.vesselState.id)&&!o.isBurst()){o.group.updateWorldMatrix(!0,!1);const{tip:a,up:l}=o.probeLocal(e,n);s.copy(a).applyMatrix4(o.group.matrixWorld);const c=l.clone().transformDirection(o.group.matrixWorld);r.setFromUnitVectors(new T(0,1,0),c),e==="thermo"&&this.spinToCamera(s,c,r)}else{const a=e==="thermo"?this.thermoPark:this.phPark;if(s.copy(a.pos),r.setFromUnitVectors(new T(0,1,0),a.up),e==="thermo"){const l=new Me().setFromAxisAngle(a.up,-Math.PI/2);r.premultiply(l)}}}spinToCamera(t,e,n){const s=new T(0,0,1).applyQuaternion(n),r=this.camera.position.clone().sub(t);if(r.addScaledVector(e,-r.dot(e)),r.lengthSq()<1e-6)return;r.normalize();const o=Math.atan2(new T().crossVectors(s,r).dot(e),s.dot(r));n.premultiply(new Me().setFromAxisAngle(e,o))}tmpPos=new T;tmpQuat=new Me;updateProbes(t,e=!1){const{thermometer:n,phMeter:s}=this.instruments,r=(l,c,h,u)=>{if(this.probeTarget(l,c,h,this.tmpPos,this.tmpQuat),e&&(l.t=1),l.t<1){l.t=Math.min(1,l.t+t/1);const d=He.inOut(l.t),f=l.fromPos.clone().lerp(this.tmpPos,d);f.y+=Math.sin(d*Math.PI)*18;const g=l.fromQuat.clone().slerp(this.tmpQuat,d);u(f,g),this.shadowDirty=!0}else u(this.tmpPos,this.tmpQuat)};r(this.thermoMotion,"thermo",wl,(l,c)=>{n.group.position.copy(l),n.group.quaternion.copy(c)}),r(this.phMotion,"ph",Jn,(l,c)=>s.setProbeWorldPose(l,c));const o=this.selectedId?this.glasswareMap.get(this.selectedId):void 0,a=this.instruments.pressureGauge;if(o&&a.group.visible){o.group.updateWorldMatrix(!0,!1);const l=new T(0,o.stopperTopLocal()-.6,0).applyMatrix4(o.group.matrixWorld);a.group.position.copy(l),a.group.quaternion.copy(o.group.quaternion),a.faceToward(this.camera.position)}}placeVesselOnHotPlate(t){const e=this.hotPlateVessel;if(t!==null&&!this.glasswareMap.has(t)||t!==null&&e===t)return null;let n=null;if(e&&this.glasswareMap.has(e)){const s=this.glasswareMap.get(e),r=this.allocSlot(e);this.animator.add(Fh(s.group,this.slots[r].clone(),()=>s.liquid.slosh(.04),Gs+s.height*.2)),n=e}if(this.hotPlateVessel=null,t!==null){const s=this.glasswareMap.get(t);this.freeSlotOf(t),this.hotPlateVessel=t,this.animator.add(Fh(s.group,this.hotPlateTopWorld(),()=>s.liquid.slosh(.05),Gs))}return this.shadowDirty=!0,n}getHotPlateVesselId(){return this.hotPlateVessel}registerTransient(t){const e={object:t.group,setRenderOrderBase:t.setRenderOrderBase};return this.transient.add(e),()=>this.transient.delete(e)}tempBottle(t,e,n,s){const r=this.shelf.getMeta(t),o=r?{...r}:{id:t,name:Ex(t),formula:"",bottle_colour:"clear",form:"solution",colorHex:n};s==="liquid"&&(o.dropper=!1,o.form==="solid"&&(o.form="solution"),o.by_mass=!1);const a=ad(o),l=e.group.position,c=l.x>0?1:-1;let h=l.x+c*18;return(h>qt.xMax-10||h<qt.xMin+10)&&(h=l.x-c*18),a.group.position.set(h,this.groundAt(h,l.z+4),Math.min(qt.zMax-6,l.z+4)),this.scene.add(a.group),a}frameForAddition(t){this.camera.position.distanceTo(t.group.position)>80&&!this.downPos&&this.focusVessel(t.vesselState.id,58)}animatePour(t,e,n,s){const r=Ea(s);try{const o=this.glasswareMap.get(e);if(!o||o.isBurst()||t===e){r();return}this.frameForAddition(o);const a=this.glasswareMap.get(t);if(a&&!this.animator.isBusy(a.group)&&!a.isBurst()){const g=a.lipLocal(),v=a.lastSnapshot?a.getLiquidColorHex():n||a.getLiquidColorHex(),m={object:a.group,lipLocal:g,lipHeight:g.y,bodyRadius:a.profile.maxOuterRadius,isBottle:!1,fillHeight:a.surfaceLocalY(),groundY:a.group.position.y,onStart:()=>a.setRackVisible(!1),onEnd:()=>{a.setRackVisible(!0),this.shadowDirty=!0}};this.animator.add(Nh(this.scene,m,o,v,r),r);return}let l=this.shelf.get(t),c=!1;l&&this.animator.isBusy(l.group)&&(l=void 0),l&&l.kind!=="liquid"&&(l=void 0),l?this.shelf.touch(t):(l=this.tempBottle(t,o,n,"liquid"),c=!0);const h=l;let u=null;const d=wa(n,h.contentHex),f={object:h.group,lipLocal:h.lipLocal,lipHeight:h.lipLocal.y,bodyRadius:h.radius,isBottle:!0,fillHeight:0,groundY:h.group.position.y,temporary:c,onStart:()=>{h.cap.visible=!1,c?u=this.registerTransient(h):this.shelf.setBusy(t,!0)},onEnd:()=>{h.cap.visible=!0,this.shadowDirty=!0,c?(u?.(),h.dispose()):this.shelf.setBusy(t,!1)}};this.animator.add(Nh(this.scene,f,o,d,r),r)}catch(o){console.error("[bench] animatePour failed",o),r()}}animateDrops(t,e,n,s,r){const o=Ea(r);try{const a=this.glasswareMap.get(e);if(!a||a.isBurst()){o();return}this.frameForAddition(a);const l=this.shelf.get(t);let c,h=!1,u,d;if(l&&l.dropperParts&&l.dropperParts.visible){this.shelf.touch(t),c=new T(0,l.lipLocal.y-7,0),l.group.localToWorld(c);const g=l.dropperParts;u=()=>{g.visible=!1,this.shelf.setBusy(t,!0)},d=()=>{g.visible=!0,this.shelf.setBusy(t,!1)}}else c=a.group.position.clone(),h=!0;const f=wa(s,l?.contentHex??this.shelfMetaColor(t,!1));this.animator.add(fx(this.scene,c,a,n,f,o,{onStart:u,onEnd:d,fromAbove:h}),o)}catch(a){console.error("[bench] animateDrops failed",a),o()}}animateSolidAddition(t,e,n,s){const r=Ea(s);try{const o=this.glasswareMap.get(e);if(!o||o.isBurst()){r();return}this.frameForAddition(o);const a=this.shelf.getMeta(t),l=a?sd(a.formula,a.name)&&(a.form==="solid"||!!a.by_mass):/(^|[_\-\s])(mg|zn|fe|al|cu|sn)([_\-\s]|$)/i.test(t),c=this.shelf.get(t);let h;c?(this.shelf.touch(t),h=new T(0,c.height+2,0),c.group.localToWorld(h)):h=o.group.position.clone().add(new T(-14,o.height+10,6));const u=wa(n,c?.contentHex??this.shelfMetaColor(t,!0));this.animator.add(px(this.scene,h,o,u,l,r,{onStart:()=>c&&this.shelf.setBusy(t,!0),onEnd:()=>{this.shelf.setBusy(t,!1),this.shadowDirty=!0}}),r)}catch(o){console.error("[bench] animateSolidAddition failed",o),r()}}shelfMetaColor(t,e){const n=this.shelf.getMeta(t);return n?n.colorHex||id(e):void 0}triggerBurst(t){const e=this.glasswareMap.get(t);e&&(e.effects.triggerBurst(),this.shadowDirty=!0)}focusVessel(t,e){const n=this.glasswareMap.get(t);if(!n)return;const s=this.controls.target.clone(),r=this.camera.position.clone(),o=n.group.position.clone().add(new T(0,n.height*.45,0)),a=r.clone().sub(s),l=Ol.clamp(e??Math.max(32,n.height*3.4),this.controls.minDistance,Math.min(a.length(),90)),c=o.clone().add(a.normalize().multiplyScalar(l));let h=0;const u={update:d=>{if(this.cameraTween!==u)return!0;h=Math.min(1,h+d/.85);const f=He.inOut(h);return this.controls.target.lerpVectors(s,o,f),this.camera.position.lerpVectors(r,c,f),h>=1?(this.cameraTween=null,!0):!1}};this.cameraTween=u,this.animator.add(u)}setPointer(t){const e=this.renderer.domElement.getBoundingClientRect();this.pointer.x=(t.clientX-e.left)/Math.max(1,e.width)*2-1,this.pointer.y=-((t.clientY-e.top)/Math.max(1,e.height))*2+1}pick(){this.raycaster.setFromCamera(this.pointer,this.camera);const t=[];for(const n of this.glasswareMap.values())n.isBurst()||t.push(n.pickProxy);for(const n of this.shelf.assemblies())t.push(n.pickProxy);for(const n of t)n.updateWorldMatrix(!0,!1);const e=this.raycaster.intersectObjects(t,!1);for(const n of e){const s=n.object.userData.pick;if(s)return s}return null}onPointerDown=t=>{this.downPos={x:t.clientX,y:t.clientY,t:performance.now(),button:t.button}};onPointerUp=t=>{const e=this.downPos;if(this.downPos=null,!e||e.button!==0||t.button!==0||Math.hypot(t.clientX-e.x,t.clientY-e.y)>5||performance.now()-e.t>800)return;this.setPointer(t);const s=this.pick();s?(s.type==="bottle"&&this.shelf.touch(s.id),this.onSelectObject?.(s.type,s.id)):this.onDeselect?.()};onPointerMove=t=>{this.pointerInside=!0,this.setPointer(t),this.hoverDirty=!0};onPointerLeave=()=>{this.pointerInside=!1,this.hoverDirty=!0};updateHover(){if(!this.hoverDirty)return;this.hoverDirty=!1;const t=!!this.downPos,e=this.pointerInside&&!t?this.pick():null,n=e?`${e.type}:${e.id}`:null;if(n!==this.hoverKey){this.hoverKey=n;for(const[s,r]of this.glasswareMap)r.setHover(e?.type==="vessel"&&e.id===s);for(const s of this.shelf.assemblies())s.setHover(e?.type==="bottle"&&s.group.userData.pick?.id===e.id);this.renderer.domElement.style.cursor=e?"pointer":"grab"}}onResize=()=>{const t=Math.max(1,this.container.clientWidth),e=Math.max(1,this.container.clientHeight);this.camera.aspect=t/e,this.camera.updateProjectionMatrix(),this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2)),this.renderer.setSize(t,e),vh(e*this.renderer.getPixelRatio(),this.camera.fov)};sortRenderOrder(){const t=this.camera.position,e=[];for(const n of this.glasswareMap.values())e.push({d:n.group.position.distanceToSquared(t),set:n.setRenderOrderBase});for(const n of this.shelf.assemblies())e.push({d:n.group.position.distanceToSquared(t),set:n.setRenderOrderBase});for(const n of this.transient)e.push({d:n.object.position.distanceToSquared(t),set:n.setRenderOrderBase});e.sort((n,s)=>s.d-n.d);for(let n=0;n<e.length;n++)e[n].set(10+n*10)}animate=()=>{this.rafId=requestAnimationFrame(this.animate);const t=performance.now(),e=Math.min(.05,Math.max(0,(t-this.lastFrame)/1e3));this.lastFrame=t,this.time+=e;const n=this.time;this.downPos&&(this.cameraTween=null),this.controls.update();const s=this.animator.active;this.animator.tick(e,n);let r=0;const o=new T,a=this.room.fireLight.position;for(const u of this.glasswareMap.values())try{u.setGroundY(this.groundAt(u.group.position.x,u.group.position.z)),u.tick(e,n);const d=u.effects.flameStrength(n);d>r&&(r=d,o.set(0,u.profile.baseOffsetY+u.effects.flameLocalY(),0).applyMatrix4(u.group.matrixWorld),a.copy(o))}catch(d){this.tickWarned.has(u.vesselState.id)||(this.tickWarned.add(u.vesselState.id),console.warn(`[bench] vessel ${u.vesselState.id} tick failed`,d))}const{hotPlate:l,burner:c}=this.instruments;l.animate(e),c.animate(e);const h=c.brightness();h>r&&(r=h,a.set(Sa.x,so+4,Sa.z)),this.room.fireLight.intensity=r*1500,this.updateProbes(e),this.updateHover(),this.sortRenderOrder(),this.shadowTimer+=e,(this.shadowDirty||s||this.shadowTimer>.5)&&(this.renderer.shadowMap.needsUpdate=!0,this.shadowDirty=!1,this.shadowTimer=0),this.renderer.render(this.scene,this.camera)};dispose(){cancelAnimationFrame(this.rafId),this.resizeObserver.disconnect(),window.removeEventListener("resize",this.onResize),this.controls.dispose();for(const t of Array.from(this.glasswareMap.keys()))this.removeVessel(t);this.room.dispose(),this.renderer.dispose(),this.renderer.domElement.remove()}}function wa(i,t){if(!i)return t||"#f2f6f8";if(!t)return i;const e=new Et(i),n=Math.min(e.r,e.g,e.b)>.8,s=new Et(t),r=Math.max(s.r,s.g,s.b)-Math.min(s.r,s.g,s.b)>.12||Math.max(s.r,s.g,s.b)<.5;return n&&r?t:i}function Ea(i){const t=cr(i);return setTimeout(t,7e3),t}function Ex(i){return i.replace(/[_-]+/g," ").replace(/\b\w/g,t=>t.toUpperCase())}class Tx{worker;pendingRequests=new Map;reqSeq=0;vesselHandles=new Map;activeVesselIds=[];speedMultiplier=1;isPaused=!1;simIntervalId=null;onSnapshotUpdated;constructor(t){this.worker=t,this.worker.addEventListener("message",this.handleWorkerMessage),this.startSimulationClock()}handleWorkerMessage=t=>{const{type:e,payload:n,requestId:s,error:r}=t.data;if(s&&this.pendingRequests.has(s)){const{resolve:o,reject:a}=this.pendingRequests.get(s);this.pendingRequests.delete(s),r?a(new Error(r)):o(n)}};sendRequest(t,e={}){return new Promise((n,s)=>{const r=`req_${++this.reqSeq}_${Date.now()}`;this.pendingRequests.set(r,{resolve:n,reject:s}),this.worker.postMessage({type:t,payload:e,requestId:r})})}async getOpticsTables(){return this.sendRequest("OPTICS_TABLES")}async getReagentCatalog(){return this.sendRequest("REAGENT_CATALOG")}async createVessel(t,e){const n=await this.sendRequest("VESSEL_NEW",{config:e});return this.vesselHandles.set(t,n.handle),this.activeVesselIds.includes(t)||this.activeVesselIds.push(t),n.handle}async freeVessel(t){const e=this.vesselHandles.get(t);if(e===void 0)return!1;const n=await this.sendRequest("VESSEL_FREE",{handle:e});return this.vesselHandles.delete(t),this.activeVesselIds=this.activeVesselIds.filter(s=>s!==t),n.ok}async dose(t,e){const n=this.vesselHandles.get(t);if(n===void 0)throw new Error(`Vessel ${t} not found`);const s=await this.sendRequest("VESSEL_DOSE",{handle:n,dose:e});return await this.fetchSnapshot(t),s}async removeLiquid(t,e,n=!1){const s=this.vesselHandles.get(t);if(s===void 0)throw new Error(`Vessel ${t} not found`);const r=await this.sendRequest("VESSEL_REMOVE_LIQUID",{handle:s,volume_ml:e,include_solids:n});return await this.fetchSnapshot(t),r}async addPortion(t,e){const n=this.vesselHandles.get(t);if(n===void 0)throw new Error(`Vessel ${t} not found`);const s=await this.sendRequest("VESSEL_ADD_PORTION",{handle:n,portion:e});return await this.fetchSnapshot(t),s}async control(t,e){const n=this.vesselHandles.get(t);if(n===void 0)throw new Error(`Vessel ${t} not found`);return this.sendRequest("VESSEL_CONTROL",{handle:n,controls:e})}async step(t,e){const n=this.vesselHandles.get(t);if(n===void 0)throw new Error(`Vessel ${t} not found`);const s=await this.sendRequest("VESSEL_STEP",{handle:n,dt_s:e});return await this.fetchSnapshot(t),s}async equilibrate(t,e=60){const n=this.vesselHandles.get(t);if(n===void 0)throw new Error(`Vessel ${t} not found`);const s=await this.sendRequest("VESSEL_EQUILIBRATE",{handle:n,max_sim_s:e});return await this.fetchSnapshot(t),s}async fetchSnapshot(t){const e=this.vesselHandles.get(t);if(e===void 0)return null;const n=await this.sendRequest("VESSEL_SNAPSHOT",{handle:e});return this.onSnapshotUpdated&&this.onSnapshotUpdated(t,n),n}async registerCustomCompound(t){return this.sendRequest("REGISTER_COMPOUND",t)}async importCompound(t){return this.sendRequest("IMPORT_COMPOUND",t)}async registerCustomReaction(t){return this.sendRequest("REGISTER_REACTION",t)}startSimulationClock(){let t=performance.now();this.simIntervalId=setInterval(async()=>{const e=performance.now(),n=(e-t)/1e3;if(t=e,this.isPaused||this.activeVesselIds.length===0)return;const s=n*this.speedMultiplier,r=this.activeVesselIds.map(o=>this.vesselHandles.get(o)).filter(o=>o!==void 0);if(r.length>0)try{const o=await this.sendRequest("STEP_ALL",{handles:r,dt_s:Math.min(s,1)});for(const a of this.activeVesselIds){const l=this.vesselHandles.get(a);l!==void 0&&o[String(l)]&&this.onSnapshotUpdated&&this.onSnapshotUpdated(a,o[String(l)])}}catch{}},50)}dispose(){this.simIntervalId&&clearInterval(this.simIntervalId)}}function hd(i){const t=i.split(".").filter(Boolean);let e=0;const n=[];for(const r of t){if(r==="O"||r==="[OH2]"){e+=1;continue}let o=0;if(r.includes("+")){const l=r.match(/\+(\d*)/);o=l&&l[1]?parseInt(l[1],10):1}else if(r.includes("-")){const l=r.match(/-(\d*)/);o=l&&l[1]?-parseInt(l[1],10):-1}let a=r.replace(/[\[\]\+\-0-9]/g,"");r.includes("Na")?a="Na+":r.includes("Cl")?a="Cl-":r.includes("K")?a="K+":r.includes("Ca")?a="Ca+2":r.includes("Cu")?a="Cu+2":r.includes("Fe")?a=o===3?"Fe+3":"Fe+2":r.includes("SO4")||r.includes("S(=O)(=O)")?a="SO4-2":r.includes("NO3")?a="NO3-":r.includes("CO3")||r.includes("C(=O)")?a="CO3-2":r.includes("OH")?a="OH-":a=r,n.push({fragmentSmiles:r,formula:a,charge:o})}const s={};for(const r of n)s[r.formula]?s[r.formula].stoichiometry+=1:s[r.formula]={...r,stoichiometry:1};return e>0&&(s.H2O={fragmentSmiles:"O",formula:"H2O",charge:0,stoichiometry:e}),{originalSmiles:i,isHydrate:e>0,waterHydrateNumber:e,components:Object.values(s)}}const Ax="ReactionChamberDB",Cx=1;let Ls=null,ns=null;const Is=new Map,Ds=new Map;function Us(){if(ns)try{ns.close()}catch{}ns=null,Ls=null}function Rx(){return typeof indexedDB>"u"?Promise.reject(new Error("IndexedDB not available")):ns?Promise.resolve(ns):Ls||(Ls=new Promise((i,t)=>{try{const e=indexedDB.open(Ax,Cx);e.onupgradeneeded=()=>{const n=e.result;n.objectStoreNames.contains("compounds")||n.createObjectStore("compounds",{keyPath:"inchi_key"}),n.objectStoreNames.contains("bench_state")||n.createObjectStore("bench_state",{keyPath:"id"}),n.objectStoreNames.contains("user_overrides")||n.createObjectStore("user_overrides",{keyPath:"inchi_key"})},e.onsuccess=()=>{const n=e.result;ns=n,n.onclose=()=>{Us()},n.onversionchange=()=>{Us()},i(n)},e.onerror=()=>{const n=e.error||new Error("Failed to open IndexedDB");Us(),t(n)},e.onblocked=()=>{console.warn("[IndexedDB] Database open blocked by another connection")}}catch(e){Us(),t(e)}}),Ls)}async function hr(i,t,e,n=!1){const s=await Rx();return new Promise((r,o)=>{let a;try{a=s.transaction(i,t)}catch(h){const u=h?.message||String(h);return!n&&(u.includes("closing")||u.includes("closed")||h?.name==="InvalidStateError")?(console.warn("[IndexedDB] Connection closing or invalid state. Reopening and retrying transaction..."),Us(),r(hr(i,t,e,!0))):o(h)}const l=a.objectStore(i);let c;a.oncomplete=()=>r(c),a.onerror=()=>{const h=a.error||new Error("IndexedDB transaction error");o(h)},a.onabort=()=>{const h=a.error||new Error("IndexedDB transaction aborted");o(h)};try{const h=e(l,a);h&&typeof h.then=="function"?h.then(u=>{c=u}).catch(u=>{try{a.abort()}catch{}o(u)}):c=h}catch(h){try{a.abort()}catch{}o(h)}})}async function kh(i){if(!(!i||!i.inchi_key)){Is.set(i.inchi_key,i);try{await hr("compounds","readwrite",t=>{t.put(i)})}catch(t){console.warn("[IndexedDB] Failed to cache compound in IndexedDB (using memory cache):",t)}}}async function Px(i){if(!i)return null;if(Is.has(i))return Is.get(i);try{const t=await hr("compounds","readonly",e=>new Promise((n,s)=>{const r=e.get(i);r.onsuccess=()=>n(r.result||null),r.onerror=()=>s(r.error)}));return t&&Is.set(i,t),t}catch(t){return console.warn("[IndexedDB] Failed to get cached compound from IndexedDB:",t),Is.get(i)||null}}async function Lx(i,t){if(i){Ds.set(i,t);try{await hr("user_overrides","readwrite",e=>{e.put({inchi_key:i,overrides:t,updatedAt:Date.now()})})}catch(e){console.warn("[IndexedDB] Failed to save user overrides in IndexedDB:",e)}}}async function Ix(i){if(!i)return null;if(Ds.has(i))return Ds.get(i)||null;try{const t=await hr("user_overrides","readonly",e=>new Promise((n,s)=>{const r=e.get(i);r.onsuccess=()=>n(r.result?r.result.overrides:null),r.onerror=()=>s(r.error)}));return t&&Ds.set(i,t),t}catch(t){return console.warn("[IndexedDB] Failed to get user overrides from IndexedDB:",t),Ds.get(i)||null}}let Ts=null;async function Ro(){if(Ts)return Ts;try{const i=await fetch("/data/bundle.json");if(i.ok)return Ts=(await i.json()).species||{},console.log(`[DataBundle] Loaded ${Object.keys(Ts||{}).length} bundle species.`),Ts||{}}catch(i){console.warn("[DataBundle] Failed to fetch bundle.json, running standalone:",i)}return{}}class Dx{queue=[];processing=!1;minIntervalMs=210;push(t){return new Promise((e,n)=>{this.queue.push(async()=>{try{const s=await t();e(s)}catch(s){n(s)}}),this.process()})}async process(){if(!(this.processing||this.queue.length===0)){for(this.processing=!0;this.queue.length>0;){const t=this.queue.shift();t&&(await t(),await new Promise(e=>setTimeout(e,this.minIntervalMs)))}this.processing=!1}}}const Ux=new Dx;async function Nx(i){const t=i.trim();if(!t)return[];const e=await Ro(),n=[],s=t.toLowerCase();for(const r of Object.values(e))if((r.name.toLowerCase().includes(s)||r.formula.toLowerCase().includes(s))&&(n.push(r.name),n.length>=6))break;try{const r=`https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(t)}/json?limit=6`,o=await fetch(r);if(o.ok){const l=(await o.json())?.dictionary_terms?.compound||[];return Array.from(new Set([...n,...l])).slice(0,8)}}catch{}return n.slice(0,8)}async function Ox(i){const t=i.trim(),e=await Ro(),n=Object.values(e).find(s=>s.name.toLowerCase()===t.toLowerCase()||s.cid&&String(s.cid)===t);if(n)try{const s=await Px(n.inchi_key);if(s)return s}catch{}try{return await Ux.push(async()=>{const r=`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(t)}/property/Title,IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey,Charge/JSON`,o=await fetch(r);if(!o.ok)throw new Error(`PubChem returned ${o.status}`);const l=(await o.json())?.PropertyTable?.Properties?.[0];if(!l)throw new Error("Compound not found in PubChem");const c=l.CanonicalSMILES||"",h=l.InChIKey||"",u=hd(c);let d=n?n.mp_c:20,f=n?n.bp_c:100,g=n?n.density:1,v=n?n.ghs:[],m=n?.physical_state,p=n?.color;try{const M=`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${l.CID}/JSON`,_=await fetch(M);if(_.ok){const I=await _.json(),E=JSON.stringify(I),C=vx(E);C.length>0&&(v=C);const P=_x(I,["Physical Description","Color/Form","Melting Point","Boiling Point","Density"]),b=[...P["Physical Description"]??[],...P["Color/Form"]??[]];if(m=m??Mx(b),p=p??yx(b),!n){const y=O=>(P[O]??[]).map(N=>mx(N)).filter(N=>!!N),R=(P.Density??[]).map(O=>gx(O)).filter(O=>!!O);d=ba(y("Melting Point"),d),f=ba(y("Boiling Point"),f),g=ba(R,g)}}}catch{}const x={inchi_key:h,cid:l.CID,name:l.Title||t,formula:l.MolecularFormula||"",smiles:c,charge:l.Charge||0,mw:parseFloat(l.MolecularWeight)||0,mp_c:d,bp_c:f,density:g,solubility:n?n.solubility:"soluble",ghs:v,tier:"tabulated",source:"PubChem PUG REST",physical_state:m,color:p};try{await kh(x)}catch{}return x})}catch{if(n){try{await kh(n)}catch{}return n}throw new Error(`Could not find or import "${t}".`)}}function mo(i,t){try{const e=window.localStorage.getItem(i);return e===null?t:JSON.parse(e)}catch{return t}}function Ws(i,t){try{window.localStorage.setItem(i,JSON.stringify(t))}catch{}}const Ta=[{id:"all",label:"All"},{id:"solution",label:"Solutions"},{id:"liquid",label:"Liquids"},{id:"solid",label:"Solids"},{id:"indicator",label:"Indicators"},{id:"imported",label:"Imported"}],zh="rc.recent.v1",Aa="rc.imported.v1",Fx=24,Hh=200,Bx="#e8f4fa";class kx{catalog=[];imported=[];models=new Map;recent=[];items=new Map;ordered=[];hay=new Map;onChange;constructor(){this.recent=mo(zh,[]).filter(e=>typeof e=="string");const t=mo(Aa,[]);this.imported=Array.isArray(t)?t.filter(e=>e&&typeof e.id=="string"):[],this.rebuild()}setCatalog(t){this.catalog=t.slice(),this.rebuild()}catalogEntries(){return this.catalog}importedBottles(){return this.imported}addImported(t){const e=this.imported.find(n=>n.inchi_key&&n.inchi_key===t.inchi_key);return e?this.items.get(`pc:${e.id}`):(this.imported.unshift(t),this.imported.length>Hh&&(this.imported.length=Hh),Ws(Aa,this.imported),this.rebuild(),this.items.get(`pc:${t.id}`))}setModel(t,e){this.models.set(t,e),this.rebuild()}modelOf(t){return this.models.get(t)}persistImported(){Ws(Aa,this.imported)}markUsed(t){this.recent=[t,...this.recent.filter(e=>e!==t)].slice(0,Fx),Ws(zh,this.recent),this.onChange?.()}rebuild(){this.items.clear(),this.hay.clear(),this.ordered=[];for(const t of this.catalog){const e={kind:"catalog",key:`cat:${t.id}`,id:t.id,entry:t};this.items.set(e.key,e),this.ordered.push(e)}for(const t of this.imported){const e={kind:"imported",key:`pc:${t.id}`,id:t.id,bottle:t,model:this.models.get(t.id)};this.items.set(e.key,e),this.ordered.push(e)}this.onChange?.()}get(t){return this.items.get(t)}findByShelfId(t){return this.items.get(`cat:${t}`)??this.items.get(`pc:${t}`)}recentItems(){return this.recent.map(t=>this.items.get(t)).filter(t=>!!t)}get size(){return this.ordered.length}catalogMatchFor(t){const e=Vh(t.formula);if(e)return this.catalog.find(n=>n.id!==t.id&&Vh(n.formula)===e)}matchesFilter(t,e){if(e==="all")return!0;if(e==="imported")return t.kind==="imported";if(t.kind!=="catalog")return!1;const n=t.entry;return e==="indicator"?!!n.dropper:e==="solid"?n.form==="solid"||n.by_mass:e==="liquid"?n.form==="liquid"&&!n.dropper:e==="solution"?n.form==="solution"&&!n.dropper:!0}search(t,e,n){const s=t.trim().toLowerCase(),r=s.split(/\s+/).filter(Boolean),o=[];return this.ordered.forEach((a,l)=>{if(!this.matchesFilter(a,e))return;if(r.length===0){o.push({it:a,s:0,i:l});return}const c=this.haystack(a);if(!r.every(f=>c.includes(f)))return;const h=ir(a).toLowerCase(),u=Yl(a).toLowerCase();let d=5;u===s?d=0:h.startsWith(s)?d=1:h.includes(` ${s}`)||h.includes(`(${s}`)?d=2:u.startsWith(s)?d=3:h.includes(s)&&(d=4),o.push({it:a,s:d,i:l})}),o.sort((a,l)=>a.s-l.s||a.i-l.i),{items:o.slice(0,n).map(a=>a.it),total:o.length}}haystack(t){let e=this.hay.get(t.key);return e===void 0&&(e=t.kind==="catalog"?`${t.entry.name} ${t.entry.formula} ${t.entry.id} ${t.entry.label}`.toLowerCase():`${t.bottle.name} ${t.bottle.formula} ${t.bottle.cid??""}`.toLowerCase(),this.hay.set(t.key,e)),e}}function Vh(i){const t=(i||"").replace(/\s+/g,""),e=t.split(/[·.*•]/)[0],n=new Map;let s=0;const r=o=>{for(;s<e.length;){const a=e[s];if(a==="("||a==="["){s++;const l=new Map(n);if(n.clear(),!r(o+1))return!1;const c=new Map(n);let h="";for(;s<e.length&&/[0-9]/.test(e[s]);)h+=e[s++];const u=h?parseInt(h,10):1;n.clear(),l.forEach((d,f)=>n.set(f,d)),c.forEach((d,f)=>n.set(f,(n.get(f)??0)+d*u))}else{if(a===")"||a==="]")return s++,o>0;if(/[A-Z]/.test(a)){let l=a;s++,s<e.length&&/[a-z]/.test(e[s])&&(l+=e[s++]);let c="";for(;s<e.length&&/[0-9]/.test(e[s]);)c+=e[s++];n.set(l,(n.get(l)??0)+(c?parseInt(c,10):1))}else return!1}}return o===0};return!e||!r(0)||n.size===0?t.toLowerCase():Array.from(n.entries()).sort((o,a)=>o[0]<a[0]?-1:1).map(([o,a])=>`${o}${a}`).join("")}function Yl(i){return i.kind==="catalog"?i.entry.formula:i.bottle.formula}function ir(i){const t=i.kind==="catalog"?i.entry.name:i.bottle.name;return t.replace(/\s*\((dropper|powder|solid|liquid)\)\s*$/i,"").replace(/\s+\d[\d.]*\s*(M|%)(\s*\([^)]*\))?\s*$/i,"").trim()||t}function qs(i){return i.kind==="imported"?i.model?.modelable&&i.model.entry?i.model.entry.by_mass?"g":"ml":nr(i.bottle)?"g":"ml":i.entry.dropper?"drops":i.entry.by_mass?"g":"ml"}function ud(i){if(i.kind==="imported"){const n=i.model;if(n?.modelable&&n.entry){if(n.entry.by_mass)return"imported solid · reacts";const s=n.entry.concentration_m;return s?`imported · ${s>=1?s.toFixed(1):s.toPrecision(2)} M solution · reacts`:"imported · reacts"}return n?nr(i.bottle)?"imported solid · visual only":"imported · visual only":nr(i.bottle)?"imported solid":"imported"}const t=i.entry,e=t.name.match(/(\d[\d.]*\s*%)/);if(t.dropper)return e?`${e[1]} · drops`:"dropper";if(t.by_mass||t.form==="solid")return"solid";if(t.form==="liquid")return e?`${e[1]} liquid`:"liquid";if(t.concentration_m!==void 0&&t.concentration_m!==null){const n=t.concentration_m;return`${n>=1?n.toFixed(1):n.toPrecision(2)} M`}return e?e[1]:"solution"}const zx={GHS01:"Explosive",GHS02:"Flammable",GHS03:"Oxidiser",GHS04:"Gas under pressure",GHS05:"Corrosive",GHS06:"Toxic",GHS07:"Harmful / irritant",GHS08:"Health hazard",GHS09:"Environmental hazard"};function dd(i){return(i??[]).map(t=>zx[t]??t)}function fd(i){return i.kind==="catalog"?i.entry.signal_word:i.bottle.ghs&&i.bottle.ghs.length>0?"Warning":""}function Hx(i){return i.kind==="catalog"?i.entry.ghs:i.bottle.ghs}function Vx(i){return i.kind==="catalog"?i.entry.bottle_colour:"custom"}function Gx(i){return i.kind==="imported"&&/^#[0-9a-f]{6}$/i.test(i.bottle.color)?i.bottle.color:Bx}function Gh(i){const t=new Et(i);return[t.r,t.g,t.b]}const Wh=(i,t,e)=>{const n=Math.min(1,Math.max(0,(e-i)/(t-i)));return n*n*(3-2*n)};function Wx(i,t=3){const e=i.map(s=>-Math.log10(Math.min(1,Math.max(.02,s)))/t),n=[];for(let s=0;s<es;s++){const r=Ju+Qu*s,o=1-Wh(470,530,r),a=Wh(560,620,r),l=Math.max(0,1-Math.abs(r-545)/65),c=o+l+a||1;n.push((a*e[0]+l*e[1]+o*e[2])/c)}return n}const qx=.2;class Yx{items=new Map;lastT=new Map;has(t){return(this.items.get(t)?.length??0)>0}clear(t){this.items.delete(t),this.lastT.delete(t)}add(t,e){this.put(t,[e])}put(t,e){if(e.length===0)return;const n=this.items.get(t)??[];for(const s of e){const r=n.find(o=>o.key===s.key&&o.kind===s.kind&&!!o.ghost==!!s.ghost);if(r){const o=r.mass_g,a=s.mass_g;if(o+a>0)for(let l=0;l<3;l++)r.rgb[l]=(r.rgb[l]*o+s.rgb[l]*a)/(o+a);r.mass_g+=s.mass_g,r.volume_ml+=s.volume_ml}else n.push({...s,rgb:[...s.rgb]})}this.items.set(t,n)}take(t,e){const n=this.items.get(t);if(!n||n.length===0)return[];const s=Math.min(1,Math.max(0,e)),r=[];for(const o of n)r.push({...o,rgb:[...o.rgb],mass_g:o.mass_g*s,volume_ml:o.volume_ml*s}),o.mass_g*=1-s,o.volume_ml*=1-s;return this.items.set(t,n.filter(o=>o.mass_g>1e-5||o.volume_ml>1e-4)),r}apply(t,e,n){const s=this.items.get(t);if(!s||s.length===0)return this.lastT.set(t,e.t_sim_s),e;const r=Math.max(0,Math.min(5,e.t_sim_s-(this.lastT.get(t)??e.t_sim_s)));this.lastT.set(t,e.t_sim_s);const o=e.layers.map(f=>({...f}));let a=e.total_liquid_ml,l=0;const c=e.solids.slice(),h=e.species.slice();for(const f of s){if(f.kind!=="liquid"||f.volume_ml<=1e-4)continue;const g=Wx(f.rgb),v=o.find(p=>p.phase==="aqueous");if(v){const p=v.volume_ml,x=f.volume_ml;v.absorbance_per_cm=v.absorbance_per_cm.map((M,_)=>(M*p+g[_]*x)/(p+x)),v.scatter_per_cm=v.scatter_per_cm*p/(p+x),v.volume_ml=p+x}else o.unshift({phase:"aqueous",volume_ml:f.volume_ml,density_g_ml:f.density_g_ml,refractive_index:1.333,absorbance_per_cm:g,scatter_per_cm:0,scatter_rgb:[1,1,1]});a+=f.volume_ml;const m=f.volume_ml*f.density_g_ml;l+=m,h.push(qh(f,m,f.mw||60,"aqueous",a))}const u=a>.5,d=qx*(n?3:1);for(const f of s){if(f.kind!=="solid")continue;let g=f.mass_g;if(f.ghost){u&&r>0&&g>0&&(g=Math.pow(Math.max(0,Math.cbrt(g)-d*r/3),3)),f.mass_g=g;const m=e.solids.filter(p=>f.ghost.species.includes(p.species)).reduce((p,x)=>p+x.mass_g,0);g=Math.max(0,g-m)}else l+=g,h.push(qh(f,g,f.mw||100,"solid",a));if(g<=1e-5)continue;const v=Math.min(25,Math.max(.3,f.density_g_ml||1.5));c.push({species:f.ghost?`ghost:${f.key}`:f.key,name:f.name,mass_g:g,settled_volume_ml:g/v*1.6,suspended_fraction:u?.1:0,particle_diameter_um:30,rgb:f.rgb,kind:"powder",remaining_fraction:1})}return this.items.set(t,s.filter(f=>f.kind==="liquid"?f.volume_ml>1e-4:f.mass_g>1e-5)),{...e,layers:o,total_liquid_ml:a,solids:c,species:h,contents_mass_g:e.contents_mass_g+l}}}function qh(i,t,e,n,s){const r=t/Math.max(1,e);return{id:i.key,name:i.name,formula:i.formula||i.name,charge:0,phase:n,amount_mol:r,conc_m:n==="solid"||s<=.01?null:r/(s/1e3),activity:null,tier:"speculative"}}const pd="rc.reagentColors.v1",Yh=6,ro=new Map(Object.entries(mo(pd,{}))),Ca=new Map;let Xh=Promise.resolve(),Xx=0;function $h(i,t,e){return"#"+new Et().setRGB(Math.min(1,Math.max(0,i)),Math.min(1,Math.max(0,t)),Math.min(1,Math.max(0,e)),ii).getHexString(we)}function $x(i,t){const e=i.solids.find(l=>l.mass_g>1e-6);if(i.total_liquid_ml<=.01)return e?$h(e.rgb[0],e.rgb[1],e.rgb[2]):null;const n=i.layers[i.layers.length-1];if(!n)return null;const[s,r,o]=td(t,n.absorbance_per_cm,Yh),a=Math.exp(-n.scatter_per_cm*Yh);return $h(s*a+n.scatter_rgb[0]*(1-a),r*a+n.scatter_rgb[1]*(1-a),o*a+n.scatter_rgb[2]*(1-a))}function jx(i){return i.by_mass?{reagent_id:i.id,mass_g:2}:{reagent_id:i.id,volume_ml:50}}function md(i){return ro.get(i)}function Kx(i,t,e){const n=ro.get(t.id);if(n)return Promise.resolve(n);if(!e)return Promise.resolve(null);const s=Ca.get(t.id);if(s)return s;const r=Xh.then(async()=>{const o=`__colour_probe_${++Xx}`;try{await i.createVessel(o,{type:"beaker-250",capacity_ml:250,glass_mass_g:110,inner_radius_cm:3.5}),await i.dose(o,jx(t));const a=await i.fetchSnapshot(o),l=a?$x(a,e):null;return l&&(ro.set(t.id,l),Ws(pd,Object.fromEntries(ro))),l}catch{return null}finally{i.freeVessel(o).catch(()=>{}),Ca.delete(t.id)}});return Xh=r.catch(()=>null),Ca.set(t.id,r),r}const El=[{type:"beaker-50",label:"Beaker 50 mL",capacityMl:50,icon:"beaker",glassMassG:35,innerRadiusCm:2},{type:"beaker-250",label:"Beaker 250 mL",capacityMl:250,icon:"beaker",glassMassG:110,innerRadiusCm:3.5},{type:"beaker-1000",label:"Beaker 1 L",capacityMl:1e3,icon:"beaker",glassMassG:320,innerRadiusCm:5.5},{type:"erlenmeyer-250",label:"Flask 250 mL",capacityMl:250,icon:"erlenmeyer",glassMassG:130,innerRadiusCm:4},{type:"cylinder-100",label:"Cylinder 100 mL",capacityMl:100,icon:"cylinder",glassMassG:140,innerRadiusCm:1.5},{type:"test-tube",label:"Test tube",capacityMl:30,icon:"testTube",glassMassG:20,innerRadiusCm:.9}];function gd(i){return El.find(t=>t.type===i)??El[1]}const Zx=.05,jh=400,Jx=2e4;class Po{constructor(t,e){this.bench=t,this.sim=e}vessels=new Map;controls=new Map;latest=new Map;flammableAdded=new Set;visual=new Yx;nextId=1;typeCounters=new Map;hotPlateId=null;selectedId=null;onVesselsChanged;onSelectionChanged;onControlsChanged;list(){return Array.from(this.vessels.values())}get(t){return this.vessels.get(t)}has(t){return this.vessels.has(t)}ctl(t){let e=this.controls.get(t);return e||(e={heaterW:0,stirring:!1,stirRpm:0,iceBath:!1},this.controls.set(t,e)),e}snapshot(t){return this.latest.get(t)}isOnHotPlate(t){return(this.bench.getHotPlateVesselId()??this.hotPlateId)===t}freeCapacityMl(t){const e=this.vessels.get(t);if(!e)return 0;const n=this.latest.get(t),s=n?n.total_liquid_ml:e.currentVolumeMl;return Math.max(0,e.capacityMl-s)}volumeMl(t){const e=this.latest.get(t);return e?e.total_liquid_ml:this.vessels.get(t)?.currentVolumeMl??0}hasFlammable(t){const e=this.latest.get(t);return!e||e.total_liquid_ml<=.01?!1:e.layers.some(n=>n.phase==="organic")||e.species.some(n=>n.phase==="organic"&&n.amount_mol>1e-6)?!0:this.flammableAdded.has(t)}ingest(t,e){const n=this.vessels.get(t);if(!n)return null;const s=this.visual.apply(t,e,this.ctl(t).stirring);this.latest.set(t,s),n.currentVolumeMl=s.total_liquid_ml,n.temperatureK=s.temperature_k,n.ph=s.ph!==null?s.ph:void 0;const r=n.isSealed!==s.sealed;return n.isSealed=s.sealed,n.contents=s.species.map(o=>({name:o.name,formula:o.formula,amountMol:o.amount_mol,concentrationM:o.conc_m!==null?o.conc_m:0})),r&&t===this.selectedId&&this.bench.setSelectedVessel(t),s}async spawn(t){const e=gd(t),n=(this.typeCounters.get(t)??0)+1;this.typeCounters.set(t,n);const s={id:`vessel_${this.nextId++}`,name:n>1?`${e.label} (${n})`:e.label,type:t,capacityMl:e.capacityMl,currentVolumeMl:0,liquidColor:"#e8f4fa",liquidOpacity:.6,temperatureK:298.15,isSealed:!1,stirring:!1,contents:[]},o=this.bench.addVessel(s)?.vesselState??s;this.vessels.set(s.id,o),this.ctl(s.id);const a={type:t,capacity_ml:e.capacityMl,glass_mass_g:e.glassMassG,inner_radius_cm:e.innerRadiusCm,temperature_k:298.15,room_k:295.15,sealed:!1,stopper_pop_atm:2.2,burst_atm:6};return await this.sim.createVessel(s.id,a),this.onVesselsChanged?.(),o}async remove(t){if(this.vessels.has(t)){this.isOnHotPlate(t)&&(this.bench.placeVesselOnHotPlate(null),this.hotPlateId=null,this.bench.instruments?.hotPlate?.setPower(0),this.bench.instruments?.hotPlate?.setStir(!1,0)),this.vessels.delete(t),this.controls.delete(t),this.latest.delete(t),this.flammableAdded.delete(t),this.visual.clear(t);try{await this.sim.freeVessel(t)}finally{if(this.bench.removeVessel(t),this.selectedId===t){const e=this.list()[0]?.id??null;this.select(e)}this.onVesselsChanged?.()}}}select(t){t!==null&&!this.vessels.has(t)||(this.selectedId=t,this.bench.setSelectedVessel(t),this.onSelectionChanged?.(t))}moveToHotPlate(t){if(this.isOnHotPlate(t)){this.hotPlateId=t;return}const n=this.bench.placeVesselOnHotPlate(t)??(this.hotPlateId!==t?this.hotPlateId:null);if(this.hotPlateId=t,n&&n!==t&&this.vessels.has(n)){const s=this.ctl(n);s.heaterW=0,s.stirring=!1,s.stirRpm=0,this.sim.control(n,{heater_w:0,stirring:!1,stir_rpm:0}).catch(()=>{}),this.bench.getGlassware(n)?.setStirring(0);const r=this.vessels.get(n);r&&(r.stirring=!1),this.onControlsChanged?.(n)}this.syncHotPlate(t)}syncHotPlate(t){const e=this.ctl(t),n=this.bench.instruments?.hotPlate;n?.setPower(e.heaterW),n?.setStir(e.stirring,e.stirring?e.stirRpm||jh:0)}async setHeat(t,e){const n=this.ctl(t),s=Math.max(0,Math.min(1e3,Math.round(e)));(s>0||this.isOnHotPlate(t))&&this.moveToHotPlate(t),n.heaterW=s,this.isOnHotPlate(t)&&this.bench.instruments?.hotPlate?.setPower(s),await this.sim.control(t,{heater_w:s})}async setStir(t,e){const n=this.ctl(t);e&&this.moveToHotPlate(t),n.stirring=e,n.stirRpm=e?jh:0;const s=this.vessels.get(t);s&&(s.stirring=e),this.isOnHotPlate(t)&&this.bench.instruments?.hotPlate?.setStir(e,n.stirRpm),this.bench.getGlassware(t)?.setStirring(n.stirRpm),await this.sim.control(t,{stirring:e,stir_rpm:n.stirRpm})}async setIceBath(t,e){this.ctl(t).iceBath=e,await this.sim.control(t,{bath_k:e?273.15:null})}async setSealed(t,e){const n=this.vessels.get(t);n&&(n.isSealed=e),await this.sim.control(t,{sealed:e}),t===this.selectedId&&this.bench.setSelectedVessel(t)}async ignite(t){await this.sim.control(t,{igniter:!0}),await new Promise(e=>window.setTimeout(e,450)),this.vessels.has(t)&&await this.sim.control(t,{igniter:!1})}static addedVolumeMl(t,e){const n=qs(t);return n==="drops"?e*Zx:n==="g"?0:e}engineEntry(t){return t.kind==="catalog"?t.entry:t.model?.modelable&&t.model.entry?t.model.entry:void 0}async addReagent(t,e,n){if(!this.vessels.has(e))throw new Error("That vessel is no longer on the bench.");if(!(n>0))throw new Error("Enter an amount greater than zero.");const s=Po.addedVolumeMl(t,n),r=this.freeCapacityMl(e);if(s>r+1e-6)throw new Error(`Only ${r.toFixed(1)} mL of space left.`);const o=Gx(t),a=this.engineEntry(t);if(!a&&t.kind==="imported"){const c=t.bottle,h=qs(t);if(await this.animate(g=>{h==="g"?this.bench.animateSolidAddition(t.id,e,o,g):this.bench.animatePour(t.id,e,o,g)}),!this.vessels.has(e))throw new Error("That vessel was removed before the addition finished.");const u=c.userOverrides?.density??c.sourcedProperties?.density,d=typeof u=="number"&&isFinite(u)&&u>.05&&u<25?u:h==="g"?1.6:1,f={key:c.id,name:c.name,formula:c.formula,kind:h==="g"?"solid":"liquid",rgb:Gh(/^#[0-9a-f]{6}$/i.test(c.color)?c.color:h==="g"?"#f4f3ef":"#e8f4fa"),mass_g:h==="g"?n:0,volume_ml:h==="g"?0:n,density_g_ml:d,mw:c.mw||0};return this.visual.add(e,f),await this.sim.fetchSnapshot(e),"visual"}if(!a)throw new Error("Unknown reagent.");const l=qs(t);if(await this.animate(c=>{l==="drops"?this.bench.animateDrops(t.id,e,Math.round(n),o,c):l==="g"?this.bench.animateSolidAddition(t.id,e,o,c):this.bench.animatePour(t.id,e,o,c)}),!this.vessels.has(e))throw new Error("That vessel was removed before the addition finished.");if(l==="drops")await this.sim.dose(e,{reagent_id:a.id,drops:Math.round(n)});else if(l==="g"){if(!sd(a.formula,a.name)){const c=t.kind==="imported"&&/^#[0-9a-f]{6}$/i.test(t.bottle.color)?t.bottle.color:void 0;this.visual.add(e,{key:a.id,name:a.name,formula:a.formula,kind:"solid",rgb:Gh(md(a.id)??c??"#f4f3ef"),mass_g:n,volume_ml:0,density_g_ml:a.density_g_ml||1.6,mw:0,ghost:{species:Object.keys(a.composition)}})}await this.sim.dose(e,{reagent_id:a.id,mass_g:n})}else await this.sim.dose(e,{reagent_id:a.id,volume_ml:n});return a.ghs.includes("GHS02")&&this.flammableAdded.add(e),"dosed"}maxPourMl(t,e){return Math.max(0,Math.min(this.volumeMl(t),this.freeCapacityMl(e)))}async pour(t,e,n){if(!this.vessels.has(t)||!this.vessels.has(e))throw new Error("Pick two vessels on the bench.");const s=Math.min(n,this.maxPourMl(t,e));if(!(s>.01))throw new Error("Nothing to pour, or the target is full.");let r="#e8f4fa";try{r=this.bench.getGlassware(t)?.getLiquidColorHex()||r}catch{}const o=this.volumeMl(t),a=await this.sim.removeLiquid(t,s,!0),l=this.visual.take(t,o>0?s/o:1);this.flammableAdded.has(t)&&this.flammableAdded.add(e),await this.animate(c=>this.bench.animatePour(t,e,r,c)),this.vessels.has(e)&&(this.visual.put(e,l),await this.sim.addPortion(e,a))}async empty(t){this.vessels.has(t)&&(await this.sim.removeLiquid(t,1e5,!0),this.visual.clear(t),this.flammableAdded.delete(t),await this.sim.fetchSnapshot(t))}animate(t){return new Promise(e=>{let n=!1;const s=()=>{n||(n=!0,e())};window.setTimeout(s,Jx);try{t(s)}catch(r){console.warn("[Lab] animation failed",r),s()}})}}function Y(i,t={},...e){const n=document.createElement(i);for(const[s,r]of Object.entries(t))r==null||r===!1||(s==="class"?n.className=String(r):s==="text"?n.textContent=String(r):s==="html"?n.innerHTML=String(r):r===!0?n.setAttribute(s,""):n.setAttribute(s,String(r)));for(const s of e)s==null||s===!1||n.append(typeof s=="string"?document.createTextNode(s):s);return n}function Ie(i){return i.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function Le(i,t){i.textContent!==t&&(i.textContent=t)}const Qx={0:"₀",1:"₁",2:"₂",3:"₃",4:"₄",5:"₅",6:"₆",7:"₇",8:"₈",9:"₉"},Kh={0:"⁰",1:"¹",2:"²",3:"³",4:"⁴",5:"⁵",6:"⁶",7:"⁷",8:"⁸",9:"⁹","+":"⁺","-":"⁻"};function hs(i){if(!i)return"";let t=i,e="";const n=t.match(/\((s|l|g|aq)\)$/);n&&(e=n[0],t=t.slice(0,-e.length));let s="";const r=t.match(/([+-])(\d*)$/);return r&&t.length>r[0].length&&/[A-Za-z0-9)\]]/.test(t[t.length-r[0].length-1])&&(s=(r[2]&&r[2]!=="1"?r[2]:"").split("").map(a=>Kh[a]).join("")+Kh[r[1]],t=t.slice(0,-r[0].length)),t=t.replace(/([A-Za-z)\]])(\d+)/g,(o,a,l)=>a+l.split("").map(c=>Qx[c]).join("")),t+s+e}function ty(i){const t=Math.abs(i);return t>=.1?`${i.toFixed(2)} M`:t>=1e-4?`${(i*1e3).toPrecision(3)} mM`:t>=1e-7?`${(i*1e6).toPrecision(3)} µM`:`${i.toExponential(1)} M`}function ey(i){const t=Math.abs(i);return t>=.1?`${i.toFixed(2)} mol`:t>=1e-4?`${(i*1e3).toPrecision(3)} mmol`:`${(i*1e6).toPrecision(3)} µmol`}function vd(i){const t=Math.max(0,i),e=Math.floor(t/60),n=t-e*60;return`${String(e).padStart(2,"0")}:${n.toFixed(1).padStart(4,"0")}`}function Zh(i){if(!(i instanceof HTMLElement))return!1;const t=i.tagName;if(i.isContentEditable||t==="TEXTAREA"||t==="SELECT")return!0;if(t==="INPUT"){const e=i.type;return!["button","checkbox","radio","range","submit","reset"].includes(e)}return!1}const ny={search:'<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',close:'<path d="M6 6l12 12M18 6L6 18"/>',chevronDown:'<path d="M6 9l6 6 6-6"/>',chevronUp:'<path d="M6 15l6-6 6 6"/>',more:'<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',details:'<path d="M4 19h16"/><path d="M4 15l4-5 4 3 5-7 3 4"/>',focus:'<path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><circle cx="12" cy="12" r="2.5"/>',trash:'<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>',play:'<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>',pause:'<path d="M8 5v14M16 5v14" stroke-width="3"/>',flame:'<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 01-10 0c0-2.5 1.4-3.8 2.4-5 .3 1.6 1 2.6 2 3 0-3 0-5.5.6-8z"/>',heat:'<path d="M8 4c-1.5 2 1.5 3.5 0 6M12 4c-1.5 2 1.5 3.5 0 6M16 4c-1.5 2 1.5 3.5 0 6"/><rect x="4" y="13" width="16" height="4" rx="1"/><path d="M6 20h12"/>',stir:'<path d="M20 12a8 8 0 11-2.3-5.6"/><path d="M20 4v4.5h-4.5"/><rect x="9" y="11" width="6" height="2" rx="1" fill="currentColor"/>',ice:'<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5"/>',stopper:'<path d="M8 4h8l-1 7H9z"/><path d="M7 13h10v7a1 1 0 01-1 1H8a1 1 0 01-1-1z"/>',pour:'<path d="M4 7l6-3 2 4-6 3z"/><path d="M11 8c2 2 2 5 2 7"/><path d="M8 15h10l-1 6H9z"/>',drop:'<path d="M12 3.5c3 4 5.5 6.8 5.5 10a5.5 5.5 0 01-11 0c0-3.2 2.5-6 5.5-10z"/>',scoop:'<path d="M3 20l8-8"/><path d="M11 12c1-3 4-6 7-6 1 0 2 1 2 2 0 3-3 6-6 7z"/>',plus:'<path d="M12 5v14M5 12h14"/>',info:'<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>',warning:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.01"/>',check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',cloud:'<path d="M7 18h10a4 4 0 00.5-8A6 6 0 006 9.5 4.3 4.3 0 007 18z"/><path d="M12 10.5v6M9.5 14l2.5 2.5 2.5-2.5"/>',list:'<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',bucket:'<path d="M5 8h14l-1.5 12h-11z"/><path d="M8 8a4 4 0 018 0"/>',spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',test:'<path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3"/><path d="M7.5 15h9"/>',beaker:'<path d="M5 4h14M6 4v15a1 1 0 001 1h10a1 1 0 001-1V4"/><path d="M6 12h12" opacity=".45"/>',erlenmeyer:'<path d="M9.5 3h5M10 3v6l-5.5 10a1 1 0 00.9 1.5h13.2a1 1 0 00.9-1.5L14 9V3"/><path d="M7 15h10" opacity=".45"/>',cylinder:'<path d="M8 3h8M9 3v16M15 3v16M6 21h12M9 19h6"/><path d="M9 7h2M9 10h3M9 13h2M9 16h3" opacity=".6"/>',testTube:'<path d="M9 3h6M10 3v14a2 2 0 004 0V3"/><path d="M10 12h4" opacity=".45"/>'};function ee(i,t=18,e=""){return`<svg class="ic ${e}" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ny[i]}</svg>`}class iy{el;onToggleDetails;detailsBtn;moreBtn;menu;statusDot;engineRow;serverRow;engine={s:"pending",text:"Starting…"};server={s:"pending",text:"Checking…"};constructor(t){this.el=Y("header",{class:"topbar"});const e=Y("div",{class:"brand"});e.innerHTML='<svg class="brand-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><path d="M9.5 3h5M10 3v6l-5.5 10a1 1 0 00.9 1.5h13.2a1 1 0 00.9-1.5L14 9V3"/><path d="M6.6 15.5h10.8" /><circle cx="11" cy="17.6" r=".7" fill="currentColor"/><circle cx="13.6" cy="16.9" r=".5" fill="currentColor"/></svg><span class="brand-name">Reaction Chamber</span>';const n=Y("div",{class:"topbar-right"});this.statusDot=Y("span",{class:"status-dot",role:"img"}),this.detailsBtn=Y("button",{class:"btn btn-bar",type:"button","aria-pressed":"false",title:"Details (A)"}),this.detailsBtn.innerHTML=`${ee("details",16)}<span>Details</span><kbd>A</kbd>`,this.detailsBtn.addEventListener("click",()=>this.onToggleDetails?.()),this.moreBtn=Y("button",{class:"icon-btn btn-bar-icon",type:"button","aria-label":"More","aria-haspopup":"menu","aria-expanded":"false","aria-controls":"more-menu",html:ee("more",18)}),this.menu=Y("div",{class:"menu",id:"more-menu",role:"menu",hidden:!0,"aria-label":"More"});for(const r of t){const o=Y("button",{class:"menu-item",role:"menuitem",type:"button",tabindex:"-1"});o.innerHTML=`${ee(r.icon,16)}<span class="mi-label"></span>`,o.querySelector(".mi-label").textContent=r.label,r.hint&&o.append(Y("span",{class:"mi-hint",text:r.hint})),o.addEventListener("click",()=>{this.closeMenu(!1),r.action()}),this.menu.append(o)}this.menu.append(Y("div",{class:"menu-sep",role:"separator"})),this.engineRow=Y("div",{class:"menu-status"}),this.serverRow=Y("div",{class:"menu-status"}),this.menu.append(this.engineRow,this.serverRow),this.moreBtn.addEventListener("click",()=>this.menu.hidden?this.openMenu():this.closeMenu(!0)),this.menu.addEventListener("keydown",r=>this.onMenuKey(r)),document.addEventListener("pointerdown",r=>{!this.menu.hidden&&!this.menu.contains(r.target)&&!this.moreBtn.contains(r.target)&&this.closeMenu(!1)});const s=Y("div",{class:"menu-wrap"},this.moreBtn,this.menu);n.append(this.statusDot,this.detailsBtn,s),this.el.append(e,n),this.paintStatus()}setDetailsOpen(t){this.detailsBtn.setAttribute("aria-pressed",String(t))}setEngineStatus(t,e){this.engine={s:t,text:e},this.paintStatus()}setServerStatus(t,e){this.server={s:t,text:e},this.paintStatus()}get menuOpen(){return!this.menu.hidden}closeMenu(t){this.menu.hidden||(this.menu.hidden=!0,this.moreBtn.setAttribute("aria-expanded","false"),t&&this.moreBtn.focus())}openMenu(){this.menu.hidden=!1,this.moreBtn.setAttribute("aria-expanded","true"),this.menu.querySelector(".menu-item")?.focus()}onMenuKey(t){const e=Array.from(this.menu.querySelectorAll(".menu-item")),n=e.indexOf(document.activeElement);if(t.key==="ArrowDown"||t.key==="ArrowUp"){t.preventDefault();const s=e.length;e[(n+(t.key==="ArrowDown"?1:s-1)+s)%s]?.focus()}else t.key==="Home"?(t.preventDefault(),e[0]?.focus()):t.key==="End"?(t.preventDefault(),e[e.length-1]?.focus()):t.key==="Escape"?(t.preventDefault(),t.stopPropagation(),this.closeMenu(!0)):t.key==="Tab"&&this.closeMenu(!1)}paintStatus(){const t=(e,n,s)=>{e.innerHTML="",e.append(Y("span",{class:`status-dot is-${s.s}`,"aria-hidden":"true"}),Y("span",{class:"ms-name",text:n}),Y("span",{class:"ms-val",text:s.text}))};t(this.engineRow,"Chemistry engine",this.engine),t(this.serverRow,"Local server",this.server),this.statusDot.className=`status-dot is-${this.engine.s}`,this.statusDot.setAttribute("aria-label",`Chemistry engine: ${this.engine.text}`),this.statusDot.title=`Chemistry engine: ${this.engine.text} · Local server: ${this.server.text}`}}const sy={ml:'<path d="M9 3h6v3l2 2v12a1 1 0 01-1 1H8a1 1 0 01-1-1V8l2-2z"/><path class="sw-fill" d="M7.6 13h8.8v6.4a.6.6 0 01-.6.6H8.2a.6.6 0 01-.6-.6z"/>',drops:'<path d="M10.5 2.5h3v3h-3z"/><path d="M9.5 5.5h5l1.5 3V20a1 1 0 01-1 1H9a1 1 0 01-1-1V8.5z"/><path class="sw-fill" d="M8.6 14h6.8v5.4a.6.6 0 01-.6.6H9.2a.6.6 0 01-.6-.6z"/>',g:'<path d="M6 6h12v2H6z"/><path d="M6.5 8h11v11a2 2 0 01-2 2h-7a2 2 0 01-2-2z"/><path class="sw-fill" d="M7.2 14h9.6v5a1.4 1.4 0 01-1.4 1.4H8.6A1.4 1.4 0 017.2 19z"/>'};function _d(i){const t=sy[qs(i)],e=Vx(i),n=i.kind==="imported"&&/^#[0-9a-f]{6}$/i.test(i.bottle.color)?` style="--sw:${i.bottle.color}"`:"";return`<span class="swatch swatch-${e}"${n} aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">${t}</svg></span>`}const Ra=50;class ry{constructor(t,e){this.lib=t,this.addCard=e,this.el=Y("aside",{class:"panel panel-left",id:"reagent-panel","aria-label":"Reagents"}),this.build(),this.lib.onChange=()=>this.queueRender()}el;onSelect;onImportPubChem;onSpawnGlassware;search;clearBtn;filterRow;results;pubchemSection;countEl;filter="all";selectedKey=null;renderQueued=!1;pcTimer=0;pcSeq=0;importing=!1;pcNames=[];pcState="idle";focusSearch(t){this.setCollapsed(!1),t!==void 0&&(this.search.value=t,this.onQueryChanged()),this.search.focus(),this.search.select()}setSelected(t){this.selectedKey=t,this.results.querySelectorAll(".r-row").forEach(e=>{e.setAttribute("aria-current",String(e.dataset.key===t))})}setCollapsed(t){this.el.dataset.collapsed=String(t),this.el.querySelector(".panel-collapse")?.setAttribute("aria-expanded",String(!t)),t||this.el.dispatchEvent(new CustomEvent("panel-expanded",{bubbles:!0}))}get collapsed(){return this.el.dataset.collapsed==="true"}queueRender(){this.renderQueued||(this.renderQueued=!0,requestAnimationFrame(()=>{this.renderQueued=!1,this.renderResults()}))}build(){const t=Y("header",{class:"panel-head"});t.innerHTML='<h2 class="panel-title">Reagents</h2>',this.countEl=Y("span",{class:"panel-count"});const e=Y("button",{class:"icon-btn panel-collapse","aria-label":"Show or hide reagents","aria-expanded":"true","aria-controls":"reagent-panel-body",html:ee("chevronUp",16)});e.addEventListener("click",()=>this.setCollapsed(!this.collapsed)),t.append(this.countEl,e);const n=Y("div",{class:"panel-body",id:"reagent-panel-body"}),s=Y("div",{class:"search"});s.innerHTML=ee("search",16,"search-ic"),this.search=Y("input",{type:"search",class:"search-input",placeholder:"Search reagents or PubChem","aria-label":"Search reagents or PubChem",autocomplete:"off",spellcheck:"false"}),this.clearBtn=Y("button",{class:"icon-btn search-clear","aria-label":"Clear search",hidden:!0,html:ee("close",14)}),this.clearBtn.addEventListener("click",()=>{this.search.value="",this.onQueryChanged(),this.search.focus()}),this.search.addEventListener("input",()=>this.onQueryChanged()),this.search.addEventListener("keydown",l=>this.onSearchKey(l)),s.append(this.search,this.clearBtn),this.filterRow=Y("div",{class:"filter-row",role:"group","aria-label":"Filter reagents"});for(const l of Ta){const c=Y("button",{class:"filter-chip",type:"button","aria-pressed":String(l.id===this.filter),text:l.label});c.addEventListener("click",()=>{this.filter=this.filter===l.id&&l.id!=="all"?"all":l.id,this.filterRow.querySelectorAll(".filter-chip").forEach((h,u)=>h.setAttribute("aria-pressed",String(Ta[u].id===this.filter))),this.renderResults()}),this.filterRow.append(c)}this.results=Y("div",{class:"results","aria-label":"Reagent results"}),this.pubchemSection=Y("div",{class:"pc-section"});const r=Y("div",{class:"panel-scroll"},this.results,this.pubchemSection);r.addEventListener("keydown",l=>this.onResultsKey(l));const o=Y("footer",{class:"glass-row"});o.append(Y("div",{class:"eyebrow",text:"Add glassware"}));const a=Y("div",{class:"glass-grid"});for(const l of El){const c=Y("button",{class:"glass-btn",type:"button","aria-label":`Add ${l.label}`,title:`Add ${l.label}`});c.innerHTML=`${ee(l.icon,22)}<span>${l.label}</span>`,c.addEventListener("click",()=>this.onSpawnGlassware?.(l.type)),a.append(c)}o.append(a),n.append(s,this.filterRow,r,this.addCard.el,o),this.el.append(t,n),this.renderResults()}onQueryChanged(){this.clearBtn.hidden=this.search.value.length===0,this.renderResults(),this.schedulePubChem()}renderResults(){const t=this.search.value.trim();Le(this.countEl,this.lib.size?String(this.lib.size):""),this.results.innerHTML="";const e=t===""&&this.filter==="all"?this.lib.recentItems().slice(0,8):[];e.length&&this.results.append(this.section("Recently used",e));const{items:n,total:s}=this.lib.search(t,this.filter,Ra),r=new Set(e.map(l=>l.key)),o=n.filter(l=>!r.has(l.key)),a=t?"Matches":this.filter==="all"?e.length?"All reagents":"Reagents":Ta.find(l=>l.id===this.filter).label;if(o.length)this.results.append(this.section(a,o)),s>Ra&&this.results.append(Y("p",{class:"more-hint",text:`${s-Ra} more — type to narrow the list`}));else if(!e.length){const l=this.lib.size===0?"Loading reagents…":this.filter==="imported"&&!t?"Nothing imported yet. Search PubChem above to import any compound.":t?`No reagent matches “${t}”.`:"Nothing here.";this.results.append(Y("p",{class:"empty-hint",text:l}))}this.renderPubChem(this.pcNames,this.pcState)}section(t,e){const n=Y("div",{class:"r-section"});n.append(Y("div",{class:"eyebrow",text:t}));const s=Y("ul",{class:"r-list",role:"list"});for(const r of e)s.append(Y("li",{},this.row(r)));return n.append(s),n}row(t){const e=Y("button",{class:"r-row",type:"button","aria-current":String(t.key===this.selectedKey)});e.dataset.key=t.key;const n=fd(t),s=hs(Yl(t));return e.innerHTML=_d(t),e.append(Y("span",{class:"r-main"},Y("span",{class:"r-name",text:ir(t)}),Y("span",{class:"r-sub",text:`${s} · ${ud(t)}`}))),t.kind==="imported"&&e.append(Y("span",{class:"r-tag",text:"PubChem"})),n&&e.append(Y("span",{class:`hz-dot ${n==="Danger"?"is-danger":"is-warning"}`,role:"img","aria-label":`Hazard: ${n}`,title:n})),e.addEventListener("click",()=>this.onSelect?.(t)),e}schedulePubChem(){window.clearTimeout(this.pcTimer);const t=this.search.value.trim();if(t.length<2){this.renderPubChem([],"idle");return}if(this.renderPubChem([],t.length>=3?"loading":"idle"),t.length<3)return;const e=++this.pcSeq;this.pcTimer=window.setTimeout(async()=>{let n=[];try{n=await Nx(t)}catch{n=[]}e!==this.pcSeq||this.search.value.trim()!==t||this.renderPubChem(n.slice(0,6),"done")},320)}renderPubChem(t,e){this.pcNames=t,this.pcState=e;const n=this.search.value.trim();if(this.pubchemSection.innerHTML="",n.length<2)return;this.pubchemSection.append(Y("div",{class:"eyebrow",text:"PubChem"}));const s=Y("button",{class:"pc-row pc-primary",type:"button",disabled:this.importing});s.innerHTML=ee("cloud",16),s.append(Y("span",{text:this.importing?"Importing…":`Import “${n}” from PubChem`})),s.addEventListener("click",()=>this.importName(n)),this.pubchemSection.append(s),e==="loading"&&this.pubchemSection.append(Y("p",{class:"pc-status",text:"Looking up suggestions…"}));const r=n.toLowerCase();for(const o of t.filter(a=>a.toLowerCase()!==r)){const a=Y("button",{class:"pc-row",type:"button",disabled:this.importing});a.innerHTML=ee("plus",14),a.append(Y("span",{text:o})),a.addEventListener("click",()=>this.importName(o)),this.pubchemSection.append(a)}this.pubchemSection.append(Y("p",{class:"pc-status",text:"Imported compounds react when the engine can derive their ions from the formula (salts, acids, bases)."}))}async importName(t){if(!(this.importing||!this.onImportPubChem)){this.importing=!0,this.renderPubChem(this.pcNames,"idle");try{await this.onImportPubChem(t),this.search.value="",this.onQueryChanged()}finally{this.importing=!1,this.renderPubChem([],"idle")}}}rows(){return Array.from(this.el.querySelectorAll(".r-row, .pc-row:not([disabled])"))}onSearchKey(t){if(t.key==="ArrowDown")t.preventDefault(),this.rows()[0]?.focus();else if(t.key==="Enter"){t.preventDefault();const e=this.results.querySelector(".r-row"),n=this.search.value.trim(),{total:s}=this.lib.search(n,this.filter,1);n&&s===0?this.importName(n):e?.click()}else t.key==="Escape"&&this.search.value&&(t.preventDefault(),t.stopPropagation(),this.search.value="",this.onQueryChanged())}onResultsKey(t){if(t.key!=="ArrowDown"&&t.key!=="ArrowUp")return;const e=this.rows(),n=e.indexOf(document.activeElement);n<0||(t.preventDefault(),t.key==="ArrowUp"&&n===0?this.search.focus():e[Math.max(0,Math.min(e.length-1,n+(t.key==="ArrowDown"?1:-1)))]?.focus())}}const Pa={ml:{values:[1,5,10,25,50],def:10,unit:"mL",step:.5,max:1e3},g:{values:[.1,.5,1,2],def:.5,unit:"g",step:.05,max:50},drops:{values:[1,3,5,10],def:3,unit:"drops",step:1,max:100}};class oy{constructor(t){this.host=t,this.el=Y("section",{class:"add-card","aria-label":"Add reagent",hidden:!0})}el;item=null;onAdd;onClose;onProperties;onUseCatalog;amount=10;targetId=null;busy=!1;mode="ml";amountInput;presetBtns=[];vesselChips;warnEl;addBtn;addLabel;get isOpen(){return!this.el.hidden}show(t,e){this.item=t,this.mode=qs(t),this.amount=Pa[this.mode].def;const n=this.host.vessels();this.targetId=e&&n.some(s=>s.id===e)?e:n[0]?.id??null,this.busy=!1,this.build(),this.el.hidden=!1,this.refresh()}hide(){this.el.hidden||(this.el.hidden=!0,this.item=null,this.onClose?.())}setDefaultVessel(t){!this.item||this.busy||!t||(this.targetId=t,this.renderVesselChips(),this.refresh())}vesselsChanged(){if(!this.item)return;const t=this.host.vessels();(!this.targetId||!t.some(e=>e.id===this.targetId))&&(this.targetId=t[0]?.id??null),this.renderVesselChips(),this.refresh()}build(){const t=this.item,e=Pa[this.mode];this.el.innerHTML="";const n=fd(t),s=dd(Hx(t)),r=Y("div",{class:"add-head"});r.innerHTML=_d(t);const o=Y("div",{class:"add-titles"},Y("h3",{class:"add-name",text:ir(t)}),Y("div",{class:"add-sub",text:`${hs(Yl(t))} · ${ud(t)}`})),a=Y("button",{class:"icon-btn","aria-label":"Close add card",html:ee("close",16)});if(a.addEventListener("click",()=>this.hide()),r.append(o,a),this.el.append(r),(n||s.length)&&this.el.append(Y("div",{class:`add-hazard ${n==="Danger"?"is-danger":"is-warning"}`},Y("span",{class:"hz-dot","aria-hidden":"true"}),Y("span",{text:[n,s.join(", ")].filter(Boolean).join(" · ")}))),t.kind==="imported"){const g=Y("div",{class:"add-note"}),v=t.model;let m;v?.modelable?m=`Reacts — ${v.reason}. Imported solids are dosed by mass, liquids as a 0.10 M aqueous solution.`:v?m=`Visual only — ${v.reason}`:m="Checking whether the engine can model this compound…",g.innerHTML=`${ee("info",14)}<span></span>`,g.querySelector("span").textContent=m,this.el.append(g);const p=this.host.catalogMatchFor(t),x=Y("div",{class:"add-links"});if(p){const _=Y("button",{class:"link-btn",text:`Also in stock: ${p.name}`});_.addEventListener("click",()=>this.onUseCatalog?.(p)),x.append(_)}const M=Y("button",{class:"link-btn",html:`${ee("list",14)} Properties`});M.addEventListener("click",()=>this.onProperties?.(t)),x.append(M),this.el.append(x)}const l=`add-amount-${Math.random().toString(36).slice(2,7)}`,c=Y("div",{class:"field"});c.append(Y("label",{class:"field-label",for:l,text:"Amount"}));const h=Y("div",{class:"chip-row",role:"group","aria-label":"Amount presets"});this.presetBtns=e.values.map(g=>{const v=Y("button",{class:"chip",type:"button","aria-pressed":"false",text:`${g} ${e.unit==="drops"?g===1?"drop":"drops":e.unit}`});return v.dataset.v=String(g),v.addEventListener("click",()=>{this.amount=g,this.amountInput.value=String(g),this.refresh()}),h.append(v),v});const u=Y("div",{class:"num-input"});this.amountInput=Y("input",{id:l,type:"number",inputmode:"decimal",min:String(e.step),max:String(e.max),step:String(e.step),value:String(this.amount)}),this.amountInput.addEventListener("input",()=>{const g=parseFloat(this.amountInput.value);this.amount=isFinite(g)?g:0,this.refresh()}),this.amountInput.addEventListener("keydown",g=>{g.key==="Enter"&&(g.preventDefault(),this.submit())}),u.append(this.amountInput,Y("span",{class:"num-unit",text:e.unit})),c.append(Y("div",{class:"amount-line"},h,u)),this.el.append(c);const d=Y("div",{class:"field"});d.append(Y("div",{class:"field-label",id:`${l}-into`,text:"Into"})),this.vesselChips=Y("div",{class:"chip-row",role:"radiogroup","aria-labelledby":`${l}-into`}),d.append(this.vesselChips),this.el.append(d),this.renderVesselChips(),this.warnEl=Y("div",{class:"add-warn",role:"status","aria-live":"polite"}),this.el.append(this.warnEl),this.addBtn=Y("button",{class:"btn btn-primary btn-block",type:"button"});const f=this.mode==="drops"?ee("drop",16):this.mode==="g"?ee("scoop",16):ee("pour",16);this.addBtn.innerHTML=f,this.addLabel=Y("span"),this.addBtn.append(this.addLabel),this.addBtn.addEventListener("click",()=>this.submit()),this.el.append(this.addBtn)}renderVesselChips(){if(!this.vesselChips)return;this.vesselChips.innerHTML="";const t=this.host.vessels();if(t.length===0){this.vesselChips.append(Y("span",{class:"muted",text:"No glassware on the bench — add some below."}));return}for(const e of t){const n=e.id===this.targetId,s=Y("button",{class:"chip chip-vessel",type:"button",role:"radio","aria-checked":n?"true":"false",tabindex:n?"0":"-1",text:e.name});s.addEventListener("click",()=>{this.targetId=e.id,this.renderVesselChips(),this.refresh(),this.vesselChips.querySelector('[aria-checked="true"]')?.focus()}),s.addEventListener("keydown",r=>{if(r.key!=="ArrowRight"&&r.key!=="ArrowLeft")return;r.preventDefault();const o=t.findIndex(l=>l.id===this.targetId),a=t[(o+(r.key==="ArrowRight"?1:t.length-1))%t.length];this.targetId=a.id,this.renderVesselChips(),this.refresh(),this.vesselChips.querySelector('[aria-checked="true"]')?.focus()}),this.vesselChips.append(s)}}refresh(){if(!this.item||!this.addBtn)return;const t=Pa[this.mode];for(const o of this.presetBtns)o.setAttribute("aria-pressed",String(Number(o.dataset.v)===this.amount));const e=this.host.vessels().find(o=>o.id===this.targetId),n=this.mode==="drops"?this.amount===1?"drop":"drops":t.unit,s=`${+this.amount.toFixed(3)} ${n}`;let r="";if(!e)r="Add a beaker or flask to the bench first.";else if(this.host.isBroken(e.id))r=`${e.name} is broken. Pick another vessel.`;else if(!(this.amount>0))r="Enter an amount greater than zero.";else{const o=Po.addedVolumeMl(this.item,this.amount),a=this.host.freeCapacityMl(e.id);o>a+1e-6&&(r=`Too much: ${e.name} has ${a.toFixed(1)} mL of space left.`)}Le(this.warnEl,r),this.warnEl.hidden=!r,Le(this.addLabel,this.busy?"Adding…":e?`Add ${s} to ${e.name}`:"Add"),this.addBtn.disabled=this.busy||!!r,this.addBtn.setAttribute("aria-busy",String(this.busy))}async submit(){if(!(!this.item||!this.targetId||this.busy)&&(this.refresh(),!this.addBtn.disabled)){this.busy=!0,this.refresh();try{await this.onAdd?.(this.item,this.targetId,this.amount)}finally{this.busy=!1,this.refresh()}}}}let $n=null;function ay(){return $n||($n=document.createElement("div"),$n.className="toast-region",$n.setAttribute("role","status"),$n.setAttribute("aria-live","polite"),document.body.appendChild($n),$n)}function ve(i,t="info",e=4200){const n=ay(),s=document.createElement("div");s.className=`toast toast-${t}`,t==="error"&&s.setAttribute("role","alert");const r=t==="success"?"check":t==="error"||t==="warning"?"warning":"info";s.innerHTML=`${ee(r,16)}<span class="toast-msg"></span><button class="toast-close" aria-label="Dismiss">${ee("close",14)}</button>`,s.querySelector(".toast-msg").textContent=i;const o=()=>{s.classList.add("leaving"),window.setTimeout(()=>s.remove(),220)};for(s.querySelector(".toast-close")?.addEventListener("click",o),n.appendChild(s);n.children.length>4;)n.firstElementChild?.remove();window.setTimeout(o,t==="error"?e*1.6:e)}const Tl={burst:"Vessel burst",stopper_pop:"Stopper popped",ignition:"Ignited",flame_out:"Flame went out",boil_over:"Boiled over",splatter:"Splattered",dry_out:"Boiled dry",conservation_warning:"Conservation warning",solver_warning:"Solver warning",precipitate_formed:"Precipitate",solid_dissolved:"Solid gone",gas_evolved:"Gas",colour_change:"Colour change",temperature_change:"Temperature",complex_formed:"Complex"},ly=new Set(["precipitate_formed","solid_dissolved","gas_evolved","colour_change","temperature_change","complex_formed"]);function cy(i){const t=e=>{const n=Math.min(1,Math.max(0,e));return Math.round(255*(n<=.0031308?12.92*n:1.055*Math.pow(n,.4166666666666667)-.055))};return`rgb(${t(i[0])}, ${t(i[1])}, ${t(i[2])})`}const Jh=6;function jr(i,t){i.catch(e=>{const n=e instanceof Error?e.message:String(e);ve(`Couldn't ${t}: ${n}`,"error")})}class hy{constructor(t){this.deps=t,this.el=Y("aside",{class:"panel panel-right",id:"vessel-panel","aria-label":"Selected vessel"}),this.empty=Y("div",{class:"panel-empty"}),this.empty.innerHTML=`${ee("beaker",36)}<p class="empty-title">Click a beaker on the bench</p><p class="muted">Its temperature, pH, contents and controls appear here.</p>`,this.content=Y("div",{class:"vp"}),this.el.append(this.empty,this.content),this.show(null)}el;id=null;empty;content;r={};heat;heatVal;heatNote;toggles={};igniteBtn;contentRows=[];contentEmpty;eventsList;eventsSec;lastEventsLen=-1;contentOrder=[];contentSlots=0;lastContentsAt=0;pourTargets;pourTarget=null;pourRange;pourNum;pourBtn;pourLabel;pourBusy=!1;pourSec;brokenBanner;heatTimer=0;get vesselId(){return this.id}show(t){this.id=t,this.lastEventsLen=-1,this.contentOrder=[],this.contentSlots=0,this.lastContentsAt=0;const e=t?this.deps.lab.get(t):void 0;if(this.empty.hidden=!!e,this.content.hidden=!e,this.el.dataset.empty=String(!e),!e)return;this.build(),this.syncControls();const n=this.deps.lab.snapshot(e.id);n&&this.update(n)}vesselsChanged(){if(this.id){if(!this.deps.lab.has(this.id)){this.show(null);return}this.renderPourTargets()}}build(){const t=this.deps.lab,e=t.get(this.id),n=gd(e.type);this.content.innerHTML="",this.r={};const s=Y("header",{class:"vp-head"}),r=Y("div",{class:"vp-titles"},Y("h2",{class:"vp-name",text:e.name}));this.r.sub=Y("div",{class:"vp-sub",text:`${n.capacityMl} mL`}),r.append(this.r.sub);const o=Y("button",{class:"icon-btn","aria-label":"Focus camera on this vessel (F)",title:"Focus camera (F)",html:ee("focus",18)});o.addEventListener("click",()=>this.deps.focusVessel(e.id));const a=Y("button",{class:"icon-btn btn-danger-quiet","aria-label":"Remove vessel from bench",title:"Remove vessel",html:ee("trash",18)});this.confirmable(a,"Remove?",()=>jr(t.remove(e.id),"remove the vessel")),s.append(r,Y("div",{class:"vp-actions"},o,a)),this.brokenBanner=Y("div",{class:"vp-banner",role:"alert",hidden:!0}),this.brokenBanner.innerHTML=`${ee("warning",16)}<span>The glass shattered from over-pressure. Remove it and start again.</span>`;const l=Y("div",{class:"readouts",role:"group","aria-label":"Live readings"}),c=(R,O,N="")=>{const U=Y("div",{class:`ro ro-${R}`}),F=Y("output",{class:"ro-val","aria-live":"off",text:"—"});return U.append(Y("span",{class:"ro-label",text:O}),F),N&&U.append(Y("span",{class:"ro-unit",text:N})),this.r[R]=F,this.r[`${R}Cell`]=U,l.append(U),U};c("temp","Temp"),c("ph","pH");const h=c("vol","Volume"),u=Y("div",{class:"ro-gauge","aria-hidden":"true"},Y("div",{class:"ro-gauge-fill"}));this.r.gaugeFill=u.firstElementChild,h.append(u),c("mass","Mass"),c("press","Pressure"),this.eventsSec=Y("section",{class:"vp-sec vp-events",hidden:!0,"aria-label":"Events"}),this.eventsList=Y("ol",{class:"events","aria-live":"polite"}),this.eventsSec.append(Y("h3",{class:"eyebrow",text:"Reaction log"}),this.eventsList);const d=Y("section",{class:"vp-sec","aria-label":"Controls"});d.append(Y("h3",{class:"eyebrow",text:"Controls"}));const f=`heat-${e.id}`,g=Y("div",{class:"heat"}),v=Y("label",{class:"heat-label",for:f});v.innerHTML=`${ee("heat",18)}<span>Heat</span>`,this.heatVal=Y("span",{class:"heat-val",text:"Off"}),this.heat=Y("input",{id:f,class:"range",type:"range",min:"0",max:"1000",step:"50",value:"0"}),this.heat.addEventListener("input",()=>{const R=Number(this.heat.value);this.paintHeat(R),window.clearTimeout(this.heatTimer),this.heatTimer=window.setTimeout(()=>{if(!this.id)return;const O=this.id;jr(t.setHeat(O,R).then(()=>this.updateSub()),"set the heat")},120)}),g.append(v,this.heat,this.heatVal),this.heatNote=Y("p",{class:"hint-line",text:"Turning on heat or stirring moves this vessel onto the hot plate."});const m=Y("div",{class:"toggle-row"}),p=(R,O,N,U)=>{const F=Y("button",{class:"toggle",type:"button","aria-pressed":"false"});F.innerHTML=`${ee(O,18)}<span>${N}</span>`,F.addEventListener("click",()=>{const V=F.getAttribute("aria-pressed")!=="true";F.setAttribute("aria-pressed",String(V)),U(V).then(()=>this.updateSub()).catch(K=>{F.setAttribute("aria-pressed",String(!V)),ve(`Couldn't change ${N.toLowerCase()}: ${K instanceof Error?K.message:String(K)}`,"error")})}),this.toggles[R]=F,m.append(F)};p("stir","stir","Stir",R=>t.setStir(e.id,R)),p("ice","ice","Ice bath",R=>t.setIceBath(e.id,R)),p("stopper","stopper","Stopper",R=>t.setSealed(e.id,R)),this.igniteBtn=Y("button",{class:"btn btn-warm btn-block",type:"button",hidden:!0}),this.igniteBtn.innerHTML=`${ee("flame",16)}<span>Ignite with lighter</span>`,this.igniteBtn.addEventListener("click",()=>jr(t.ignite(e.id),"ignite")),d.append(g,this.heatNote,m,this.igniteBtn);const x=Y("section",{class:"vp-sec","aria-label":"Contents"}),M=Y("div",{class:"sec-head"},Y("h3",{class:"eyebrow",text:"Contents"})),_=Y("button",{class:"link-btn",type:"button",text:"Show all in Details"});_.addEventListener("click",()=>this.deps.openDetails()),M.append(_);const I=Y("ul",{class:"contents",role:"list"});this.contentRows=[];for(let R=0;R<Jh;R++){const O=Y("span",{class:"c-formula"}),N=Y("span",{class:"c-name"}),U=Y("span",{class:"c-amt"}),F=Y("li",{hidden:!0},Y("span",{class:"c-id"},O,N),U);I.append(F),this.contentRows.push({li:F,f:O,n:N,a:U})}this.contentEmpty=Y("p",{class:"muted",text:"Empty. Pick a reagent on the left to add it."}),x.append(M,I,this.contentEmpty),this.pourSec=Y("section",{class:"vp-sec","aria-label":"Pour into another vessel"}),this.pourSec.append(Y("h3",{class:"eyebrow",text:"Pour into"})),this.pourTargets=Y("div",{class:"chip-row",role:"radiogroup","aria-label":"Pour target"});const E=Y("div",{class:"pour-amt"}),C=`pour-${e.id}`;this.pourRange=Y("input",{class:"range",type:"range",min:"0",max:"0",step:"1",value:"0","aria-label":"Amount to pour in millilitres"}),this.pourNum=Y("input",{id:C,type:"number",min:"0",step:"1",value:"0",inputmode:"decimal","aria-label":"Amount to pour (mL)"}),this.pourRange.addEventListener("input",()=>{this.pourNum.value=this.pourRange.value,this.refreshPour()}),this.pourNum.addEventListener("input",()=>{this.pourRange.value=this.pourNum.value,this.refreshPour()});const P=Y("div",{class:"num-input num-sm"},this.pourNum,Y("span",{class:"num-unit",text:"mL"}));E.append(this.pourRange,P);const b=Y("div",{class:"chip-row chip-row-tight",role:"group","aria-label":"Pour presets"});for(const[R,O]of[["10 mL",10],["25 mL",25],["Half",-.5],["All",-1]]){const N=Y("button",{class:"chip",type:"button",text:R});N.addEventListener("click",()=>{const U=Number(this.pourRange.max),F=this.id?t.volumeMl(this.id):0,V=O<0?Math.min(U,F*-O):Math.min(U,O);this.setPourValue(V)}),b.append(N)}this.pourBtn=Y("button",{class:"btn btn-primary btn-block",type:"button"}),this.pourBtn.innerHTML=ee("pour",16),this.pourLabel=Y("span",{text:"Pour"}),this.pourBtn.append(this.pourLabel),this.pourBtn.addEventListener("click",()=>this.doPour());const y=Y("button",{class:"btn btn-ghost btn-block",type:"button"});y.innerHTML=`${ee("bucket",16)}<span>Empty into waste</span>`,this.confirmable(y,"Tap again to empty",()=>jr(t.empty(e.id).then(()=>ve(`Emptied ${e.name}.`,"success")),"empty the vessel")),this.pourSec.append(this.pourTargets,E,b,this.pourBtn,y),this.r.pourEmptyBtn=y,this.content.append(s,this.brokenBanner,l,this.eventsSec,d,x,this.pourSec),this.renderPourTargets(),this.updateSub()}confirmable(t,e,n){let s=!1,r=0;const o=t.innerHTML,a=t.getAttribute("aria-label");t.addEventListener("click",()=>{if(!s){s=!0,t.classList.add("is-armed"),t.innerHTML=`${ee("warning",16)}<span>${e}</span>`,t.setAttribute("aria-label",`${e} Press again to confirm.`),r=window.setTimeout(l,4e3);return}l(),n()});const l=()=>{s=!1,window.clearTimeout(r),t.classList.remove("is-armed"),t.innerHTML=o,a?t.setAttribute("aria-label",a):t.removeAttribute("aria-label")}}syncControls(){if(!this.id||!this.heat)return;const t=this.deps.lab.ctl(this.id),e=this.deps.lab.get(this.id);document.activeElement!==this.heat&&(this.heat.value=String(t.heaterW),this.paintHeat(t.heaterW)),this.toggles.stir.setAttribute("aria-pressed",String(t.stirring)),this.toggles.ice.setAttribute("aria-pressed",String(t.iceBath)),this.toggles.stopper.setAttribute("aria-pressed",String(!!e?.isSealed)),this.updateSub()}paintHeat(t){Le(this.heatVal,t<=0?"Off":`${t} W`),this.heat.setAttribute("aria-valuetext",t<=0?"Off":`${t} watts`),this.heat.style.setProperty("--fill",`${t/1e3*100}%`),this.heat.classList.toggle("is-hot",t>0)}updateSub(){if(!this.id||!this.r.sub)return;const t=this.deps.lab,e=t.get(this.id);if(!e)return;const n=[`${e.capacityMl} mL`],s=t.isOnHotPlate(this.id);s&&n.push("on hot plate"),e.isSealed&&n.push("stoppered"),t.ctl(this.id).iceBath&&n.push("in ice bath"),Le(this.r.sub,n.join(" · ")),this.heatNote.hidden=s}update(t){if(!this.id||this.content.hidden)return;const e=this.deps.lab,n=e.get(this.id);if(!n)return;const s=this.deps.readouts();Le(this.r.temp,s.temperature),Le(this.r.ph,t.total_liquid_ml>.05?s.ph:"—"),Le(this.r.mass,s.mass);const r=t.total_liquid_ml;Le(this.r.vol,`${r<10?r.toFixed(1):r.toFixed(0)} mL`),this.r.gaugeFill.style.transform=`scaleY(${Math.min(1,r/n.capacityMl)})`,this.r.volCell.title=`${r.toFixed(1)} of ${n.capacityMl} mL`,this.r.pressCell.hidden=!t.sealed,t.sealed&&Le(this.r.press,s.pressure),this.brokenBanner.hidden=!t.burst,this.el.classList.toggle("is-broken",t.burst),this.toggles.stopper.getAttribute("aria-pressed")==="true"!==t.sealed&&(this.toggles.stopper.setAttribute("aria-pressed",String(t.sealed)),this.updateSub()),this.igniteBtn.hidden=!(e.hasFlammable(this.id)&&!t.flame&&!t.burst),this.updateContents(t),this.updateEvents(t),this.refreshPour()}updateContents(t){const e=performance.now();if(e-this.lastContentsAt<250)return;this.lastContentsAt=e;const n=new Map;for(const h of t.species)h.phase==="gas"||h.id==="H2O"||n.set(`${h.id}|${h.phase}`,h);const s=this.contentOrder.filter(h=>(n.get(h)?.amount_mol??0)>5e-10),r=new Set(s),o=[...n.values()].filter(h=>!r.has(`${h.id}|${h.phase}`)&&h.amount_mol>1e-9).sort((h,u)=>u.amount_mol-h.amount_mol||(h.id<u.id?-1:1));for(const h of o)s.push(`${h.id}|${h.phase}`);const a=h=>n.get(h).amount_mol;for(let h=0,u=!0;u&&h<s.length+2;h++){u=!1;for(let d=1;d<s.length;d++)a(s[d])>a(s[d-1])*1.5&&([s[d-1],s[d]]=[s[d],s[d-1]],u=!0)}this.contentOrder=s;const l=s.slice(0,Jh).map(h=>n.get(h));this.contentSlots=Math.max(this.contentSlots,l.length);const c=t.total_liquid_ml>.01||this.contentSlots>0;this.contentEmpty.hidden!==c&&(this.contentEmpty.hidden=c),this.contentRows.forEach((h,u)=>{const d=l[u],f=u>=this.contentSlots;h.li.hidden!==f&&(h.li.hidden=f);const g=!d&&!f;if(h.li.classList.contains("is-ghost")!==g&&h.li.classList.toggle("is-ghost",g),!d)return;const v=hs(d.formula||d.id);Le(h.f,v),Le(h.n,d.name&&d.name!==d.formula&&d.name!==d.id?d.name:""),Le(h.a,d.conc_m!==null&&d.phase!=="solid"?ty(d.conc_m):ey(d.amount_mol))})}updateEvents(t){const e=t.events??[],n=e.length?e[e.length-1].seq??e.length:0;if(n===this.lastEventsLen)return;this.lastEventsLen=n;const s=[];for(const o of e){const a=s[s.length-1];a&&a.kind===o.kind&&a.detail===o.detail&&o.t_sim_s-a.t_sim_s<5||s.push(o)}const r=s.slice(-8).reverse();this.eventsSec.hidden=r.length===0,this.eventsList.innerHTML="";for(const o of r){const a=Y("li",{class:`ev ev-${o.kind}`});if(ly.has(o.kind)){if(o.rgb){const l=Y("span",{class:"ev-dot","aria-hidden":"true"});l.style.background=cy(o.rgb),a.append(l)}a.append(Y("span",{class:"ev-detail ev-sentence",text:o.detail??Tl[o.kind]}))}else a.append(Y("span",{class:"ev-kind",text:Tl[o.kind]??o.kind})),o.detail&&a.append(Y("span",{class:"ev-detail",text:o.detail}));a.append(Y("time",{class:"ev-t",text:vd(o.t_sim_s)})),this.eventsList.append(a)}}renderPourTargets(){if(!this.id||!this.pourTargets)return;const t=this.deps.lab.list().filter(e=>e.id!==this.id);(!this.pourTarget||!t.some(e=>e.id===this.pourTarget))&&(this.pourTarget=t[0]?.id??null),this.pourTargets.innerHTML="",t.length===0&&this.pourTargets.append(Y("span",{class:"muted",text:"Add another vessel to pour into."}));for(const e of t){const n=e.id===this.pourTarget,s=Y("button",{class:"chip chip-vessel",type:"button",role:"radio","aria-checked":String(n),tabindex:n?"0":"-1",text:e.name});s.addEventListener("click",()=>{this.pourTarget=e.id,this.renderPourTargets(),this.pourTargets.querySelector('[aria-checked="true"]')?.focus()}),s.addEventListener("keydown",r=>{if(r.key!=="ArrowRight"&&r.key!=="ArrowLeft")return;r.preventDefault();const o=t.findIndex(a=>a.id===this.pourTarget);this.pourTarget=t[(o+(r.key==="ArrowRight"?1:t.length-1))%t.length].id,this.renderPourTargets(),this.pourTargets.querySelector('[aria-checked="true"]')?.focus()}),this.pourTargets.append(s)}this.refreshPour()}setPourValue(t){const e=Math.max(0,Math.round(t*10)/10);this.pourRange.value=String(e),this.pourNum.value=String(e),this.refreshPour()}refreshPour(){if(!this.id||!this.pourBtn)return;const t=this.deps.lab,e=this.pourTarget?t.get(this.pourTarget):void 0,n=t.volumeMl(this.id),s=e?t.maxPourMl(this.id,e.id):0,r=String(Math.floor(s*10)/10);this.pourRange.max!==r&&(this.pourRange.max=r,this.pourNum.max=r);let o=parseFloat(this.pourNum.value);isFinite(o)||(o=0),o>s&&document.activeElement!==this.pourNum&&(o=Math.floor(s*10)/10,this.pourNum.value=String(o),this.pourRange.value=String(o)),this.pourRange.style.setProperty("--fill",`${s>0?Math.min(o,s)/s*100:0}%`);const a=!!t.snapshot(this.id)?.burst;let l;this.pourBusy?l="Pouring…":e?n<=.01?l="Nothing to pour":s<=.01?l=`${e.name} is full`:o>s+1e-6?l=`Max ${s.toFixed(1)} mL`:l=`Pour ${+o.toFixed(1)} mL into ${e.name}`:l="No other vessel",Le(this.pourLabel,l),this.pourBtn.disabled=this.pourBusy||a||!e||!(o>.01)||o>s+1e-6,this.r.pourEmptyBtn.disabled=n<=.01&&!t.snapshot(this.id)?.solids.length}doPour(){if(!this.id||!this.pourTarget||this.pourBusy)return;const t=this.id,e=this.pourTarget,n=parseFloat(this.pourNum.value);this.pourBusy=!0,this.refreshPour(),this.deps.lab.pour(t,e,n).catch(s=>ve(`Couldn't pour: ${s instanceof Error?s.message:String(s)}`,"error")).finally(()=>{this.pourBusy=!1,this.refreshPour()})}}const Qh=[1,5,20];class uy{constructor(t){this.sim=t,this.el=Y("div",{class:"timebar",role:"toolbar","aria-label":"Simulation time"}),this.playBtn=Y("button",{class:"icon-btn time-play",type:"button"}),this.playBtn.addEventListener("click",()=>this.togglePause()),this.clock=Y("span",{class:"time-clock","aria-label":"Simulated time",text:"00:00.0"});const e=Y("div",{class:"seg",role:"group","aria-label":"Speed"});for(const n of Qh){const s=Y("button",{class:"seg-btn",type:"button","aria-pressed":String(n===t.speedMultiplier),text:`${n}×`,"aria-label":`${n} times speed`});s.addEventListener("click",()=>this.setSpeed(n)),e.append(s),this.speedBtns.push(s)}this.el.append(this.playBtn,this.clock,e),this.paint()}el;playBtn;clock;speedBtns=[];togglePause(){this.sim.isPaused=!this.sim.isPaused,this.paint()}setSpeed(t){this.sim.speedMultiplier=t,this.paint()}setClock(t){Le(this.clock,vd(t))}paint(){const t=this.sim.isPaused;this.playBtn.innerHTML=ee(t?"play":"pause",16),this.playBtn.setAttribute("aria-label",t?"Resume simulation (Space)":"Pause simulation (Space)"),this.playBtn.title=t?"Resume (Space)":"Pause (Space)",this.el.classList.toggle("is-paused",t),this.speedBtns.forEach((e,n)=>e.setAttribute("aria-pressed",String(Qh[n]===this.sim.speedMultiplier)))}}const Xi={temp:"#d1495b",ph:"#0f7c86",press:"#6a4fb3"};class dy{el;isVisible=!1;onVisibilityChange;snap=null;history=[];vesselId=null;canvas;subtitle;lastTable=0;lastPlot=0;maxHistoryS=600;constructor(){this.el=Y("aside",{class:"drawer",id:"details-drawer","aria-label":"Details",hidden:!0,tabindex:"-1"}),this.el.innerHTML=`
      <header class="drawer-head">
        <div>
          <h2 class="drawer-title">Details</h2>
          <p class="drawer-sub"></p>
        </div>
        <button class="icon-btn drawer-close" aria-label="Close details (A)">${ee("close",18)}</button>
      </header>
      <div class="drawer-body">
        <section class="d-sec">
          <h3 class="eyebrow">Last 10 minutes</h3>
          <div class="plot-wrap"><canvas class="plot" height="170" role="img" aria-label="Temperature, pH and pressure over time"></canvas></div>
          <div class="legend">
            <span><i style="background:${Xi.temp}"></i>Temperature (270–380 K)</span>
            <span><i style="background:${Xi.ph}"></i>pH (0–14)</span>
            <span><i style="background:${Xi.press}"></i>Pressure (0.5–4 atm)</span>
          </div>
        </section>
        <div class="d-grid">
          <section class="d-card"><h3 class="eyebrow">Conservation</h3><dl class="kv" data-k="cons"></dl></section>
          <section class="d-card"><h3 class="eyebrow">Heat &amp; mass</h3><dl class="kv" data-k="energy"></dl></section>
        </div>
        <section class="d-sec">
          <h3 class="eyebrow">Reactions</h3>
          <div class="table-wrap"><table class="dtable">
            <thead><tr><th>Equation</th><th>Kind</th><th class="num">Rate mol/(L·s)</th><th class="num">log Q/K</th><th>Data</th><th>Source</th></tr></thead>
            <tbody data-k="rxn"></tbody></table></div>
        </section>
        <section class="d-sec">
          <h3 class="eyebrow">Species</h3>
          <div class="table-wrap"><table class="dtable">
            <thead><tr><th>Species</th><th>Phase</th><th class="num">Amount (mol)</th><th class="num">Conc (M)</th><th class="num">Activity</th><th>Data</th></tr></thead>
            <tbody data-k="sp"></tbody></table></div>
        </section>
      </div>`,document.body.appendChild(this.el),this.canvas=this.el.querySelector("canvas.plot"),this.subtitle=this.el.querySelector(".drawer-sub"),this.el.querySelector(".drawer-close")?.addEventListener("click",()=>this.hide()),window.addEventListener("resize",()=>this.isVisible&&this.drawPlot())}show(){this.isVisible=!0,this.el.hidden=!1,requestAnimationFrame(()=>this.el.classList.add("is-open")),this.render(!0),this.onVisibilityChange?.(!0)}hide(){this.isVisible&&(this.isVisible=!1,this.el.classList.remove("is-open"),this.el.hidden=!0,this.onVisibilityChange?.(!1))}toggle(){this.isVisible?this.hide():this.show()}setVessel(t,e){if(t===this.vesselId){Le(this.subtitle,t?e:"No vessel selected");return}this.vesselId=t,this.history=[],this.snap=null,Le(this.subtitle,t?e:"No vessel selected"),this.render(!0)}updateSnapshot(t){this.snap=t;const e=this.history[this.history.length-1];e&&t.t_sim_s<e.t&&(this.history=[]),this.history.push({t:t.t_sim_s,tempK:t.temperature_k,ph:t.ph,pressureAtm:t.pressure_atm});const n=t.t_sim_s-this.maxHistoryS;for(;this.history.length&&this.history[0].t<n;)this.history.shift();this.isVisible&&this.render(!1)}render(t){const e=performance.now();if((t||e-this.lastPlot>100)&&(this.lastPlot=e,this.drawPlot()),!t&&e-this.lastTable<250)return;this.lastTable=e;const n=this.snap,s=o=>this.el.querySelector(`[data-k="${o}"]`);if(!n){s("cons").innerHTML="<dt>—</dt><dd></dd>",s("energy").innerHTML="<dt>—</dt><dd></dd>",s("rxn").innerHTML='<tr><td colspan="6" class="empty-cell">No data yet</td></tr>',s("sp").innerHTML='<tr><td colspan="6" class="empty-cell">No data yet</td></tr>';return}const r=n.conservation;s("cons").innerHTML=`
      <dt>Status</dt><dd class="${r.ok?"ok":"bad"}">${r.ok?"Balanced":"Check failed"}</dd>
      <dt>Charge error</dt><dd>${r.charge_err_mol.toExponential(2)} mol</dd>
      <dt>Element error</dt><dd>${(r.max_element_rel_err*100).toFixed(4)} %</dd>
      <dt>Energy error</dt><dd>${(r.energy_rel_err*100).toFixed(4)} %</dd>`,s("energy").innerHTML=`
      <dt>Temperature</dt><dd>${n.temperature_k.toFixed(2)} K · ${(n.temperature_k-273.15).toFixed(2)} °C</dd>
      <dt>Contents</dt><dd>${n.contents_mass_g.toFixed(2)} g</dd>
      <dt>Lost as gas</dt><dd>${n.mass_lost_g.toFixed(2)} g</dd>
      <dt>Heater</dt><dd>${n.heat_input_w.toFixed(0)} W</dd>
      <dt>Reaction heat</dt><dd>${n.net_reaction_heat_w.toFixed(1)} W</dd>
      <dt>Ionic strength</dt><dd>${n.ionic_strength!==null?n.ionic_strength.toFixed(4)+" M":"—"}</dd>`,s("rxn").innerHTML=n.reactions.length?n.reactions.map(o=>`<tr class="${o.active?"":"is-idle"}">
              <td class="mono">${Ie(o.equation)}</td>
              <td><span class="tag">${Ie(o.kind)}</span></td>
              <td class="num mono">${o.rate.toExponential(2)}</td>
              <td class="num mono">${o.log_q_over_k!==null?o.log_q_over_k.toFixed(2):"—"}</td>
              <td><span class="tier tier-${Ie(o.tier)}">${Ie(o.tier)}</span></td>
              <td class="src">${Ie(o.source)}</td></tr>`).join(""):'<tr><td colspan="6" class="empty-cell">No reactions running</td></tr>',s("sp").innerHTML=n.species.length?n.species.slice().sort((o,a)=>a.amount_mol-o.amount_mol).map(o=>`<tr>
              <td><span class="mono">${Ie(hs(o.formula||o.id))}</span>${o.name&&o.name!==o.formula&&o.name!==o.id?` <span class="muted">${Ie(o.name)}</span>`:""}</td>
              <td><span class="tag">${Ie(o.phase)}</span></td>
              <td class="num mono">${o.amount_mol.toExponential(3)}</td>
              <td class="num mono">${o.conc_m!==null?o.conc_m.toExponential(3):"—"}</td>
              <td class="num mono">${o.activity!==null?o.activity.toExponential(3):"—"}</td>
              <td><span class="tier tier-${Ie(o.tier)}">${Ie(o.tier)}</span></td></tr>`).join(""):'<tr><td colspan="6" class="empty-cell">Empty</td></tr>'}drawPlot(){const t=this.canvas,e=t.parentElement?.clientWidth||600,n=170,s=Math.min(window.devicePixelRatio||1,2);(t.width!==Math.round(e*s)||t.height!==Math.round(n*s))&&(t.width=Math.round(e*s),t.height=Math.round(n*s),t.style.width=`${e}px`,t.style.height=`${n}px`);const r=t.getContext("2d");if(!r)return;r.setTransform(s,0,0,s,0,0),r.clearRect(0,0,e,n),r.strokeStyle="rgba(29,39,48,0.08)",r.lineWidth=1;for(let f=1;f<5;f++){const g=Math.round(n/5*f)+.5;r.beginPath(),r.moveTo(0,g),r.lineTo(e,g),r.stroke()}const o=this.history;if(o.length<2){r.fillStyle="rgba(29,39,48,0.45)",r.font="12px Archivo, system-ui, sans-serif",r.fillText("Waiting for data…",12,n/2);return}const a=o[0].t,l=Math.max(a+5,o[o.length-1].t),c=8,h=f=>c+(f-a)/(l-a)*(e-c*2),u=(f,g,v)=>n-c-(f-g)/(v-g)*(n-c*2),d=(f,g,v,m)=>{r.strokeStyle=f,r.lineWidth=2,r.lineJoin="round",r.beginPath();let p=!1;for(const x of o){const M=g(x);if(M===null){p=!1;continue}const _=u(Math.max(v,Math.min(m,M)),v,m);p?r.lineTo(h(x.t),_):(r.moveTo(h(x.t),_),p=!0)}r.stroke()};d(Xi.temp,f=>f.tempK,270,380),d(Xi.ph,f=>f.ph,0,14),d(Xi.press,f=>f.pressureAtm,.5,4)}}class Xl{dialog;body;footer;titleEl;onClose;constructor(t,e={}){this.dialog=document.createElement("dialog"),this.dialog.className=`modal ${e.wide?"modal-wide":""} ${e.className??""}`;const n=`modal-title-${Math.random().toString(36).slice(2,8)}`;this.dialog.setAttribute("aria-labelledby",n),this.dialog.innerHTML=`
      <header class="modal-head">
        <h2 class="modal-title" id="${n}"></h2>
        <button class="icon-btn modal-x" aria-label="Close">${ee("close",18)}</button>
      </header>
      <div class="modal-body"></div>
      <footer class="modal-foot" hidden></footer>`,this.titleEl=this.dialog.querySelector(".modal-title"),this.titleEl.textContent=t,this.body=this.dialog.querySelector(".modal-body"),this.footer=this.dialog.querySelector(".modal-foot"),this.dialog.querySelector(".modal-x")?.addEventListener("click",()=>this.close()),this.dialog.addEventListener("click",s=>{s.target===this.dialog&&this.close()}),this.dialog.addEventListener("close",()=>this.onClose?.()),document.body.appendChild(this.dialog)}setTitle(t){this.titleEl.textContent=t}open(){this.dialog.open||this.dialog.showModal()}close(){this.dialog.open&&this.dialog.close()}get isOpen(){return this.dialog.open}}function fy(){return document.querySelector("dialog[open]")!==null}class py{modal;onRegisterCompound;onRegisterReaction;constructor(){this.modal=new Xl("Custom chemistry",{className:"modal-custom"}),this.modal.body.innerHTML=`
      <div class="tabs" role="tablist" aria-label="What to register">
        <button class="tab" role="tab" id="cc-tab-comp" aria-controls="cc-pane-comp" aria-selected="true">Compound</button>
        <button class="tab" role="tab" id="cc-tab-rxn" aria-controls="cc-pane-rxn" aria-selected="false" tabindex="-1">Reaction</button>
      </div>

      <form class="form" id="cc-pane-comp" role="tabpanel" aria-labelledby="cc-tab-comp" novalidate>
        <p class="form-desc">Adds a reagent the engine can react with. The formula is parsed into elements automatically.</p>
        <div class="form-grid">
          <label class="f">Name<input name="id" type="text" placeholder="e.g. potassium permanganate" required /></label>
          <label class="f">Formula<input name="formula" type="text" placeholder="e.g. KMnO4" required spellcheck="false" /></label>
          <label class="f">Form
            <select name="form">
              <option value="solution">Aqueous solution</option>
              <option value="liquid">Pure liquid</option>
              <option value="solid">Solid</option>
            </select>
          </label>
          <label class="f">Concentration (M)<input name="conc" type="number" step="0.01" min="0" placeholder="0.10" /></label>
          <label class="f">Density (g/mL)<input name="density" type="number" step="0.01" min="0" value="1.0" /></label>
          <label class="f">Bottle
            <select name="bottle">
              <option value="clear">Clear glass</option>
              <option value="amber">Amber glass</option>
              <option value="white">White plastic</option>
            </select>
          </label>
        </div>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Register compound</button></div>
      </form>

      <form class="form" id="cc-pane-rxn" role="tabpanel" aria-labelledby="cc-tab-rxn" hidden novalidate>
        <p class="form-desc">A reversible equilibrium or an irreversible (Arrhenius) reaction between registered species.</p>
        <div class="form-grid">
          <label class="f f-wide">Reaction ID<input name="id" type="text" placeholder="e.g. esterification" required /></label>
          <label class="f f-wide">Equation<input name="equation" type="text" placeholder="A + B <=> C + D   or   A + B -> C + D(g)" required spellcheck="false" /></label>
          <label class="f">Type
            <select name="type">
              <option value="equilibrium">Equilibrium</option>
              <option value="kinetic">Kinetic (Arrhenius)</option>
            </select>
          </label>
          <label class="f">log₁₀ K or Arrhenius A<input name="k" type="number" step="0.1" value="0" /></label>
          <label class="f">ΔH (kJ/mol)<input name="dh" type="number" step="1" value="0" /></label>
          <label class="f">Eₐ (J/mol)<input name="ea" type="number" step="1000" value="20000" /></label>
        </div>
        <p class="form-error" role="alert" hidden></p>
        <div class="form-actions"><button class="btn btn-primary" type="submit">Register reaction</button></div>
      </form>`,this.bind()}show(){this.modal.open(),this.modal.body.querySelector("form:not([hidden]) input")?.focus()}hide(){this.modal.close()}bind(){const t=this.modal.body,e=Array.from(t.querySelectorAll('[role="tab"]')),n=l=>{e.forEach((c,h)=>{c.setAttribute("aria-selected",String(l===h)),c.tabIndex=l===h?0:-1,t.querySelector(`#${c.getAttribute("aria-controls")}`).hidden=l!==h}),e[l].focus()};e.forEach((l,c)=>{l.addEventListener("click",()=>n(c)),l.addEventListener("keydown",h=>{(h.key==="ArrowRight"||h.key==="ArrowLeft")&&(h.preventDefault(),n((c+1)%e.length))})});const s=t.querySelector("#cc-pane-comp"),r=t.querySelector("#cc-pane-rxn"),o=(l,c)=>{const h=l.querySelector(".form-error");h.textContent=c,h.hidden=!c},a=(l,c)=>(l.elements.namedItem(c)?.value??"").trim();s.addEventListener("submit",async l=>{l.preventDefault();const c=a(s,"id"),h=a(s,"formula"),u=a(s,"form"),d=a(s,"conc")?parseFloat(a(s,"conc")):void 0,f=parseFloat(a(s,"density"))||1,g=a(s,"bottle");if(!c||!h)return o(s,"Enter a name and a formula.");if(u==="solution"&&!(d&&d>0))return o(s,"Enter a concentration for a solution.");o(s,"");const v=c.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")||h,m={};u==="solution"&&d?(m[h]=d/1e3,m.H2O=.055):u==="solid"?m[`${h}(s)`]=.01:m[h]=.02;const p={id:v,name:c,formula:h,form:u,concentration_m:d,density_g_ml:f,ghs:["GHS07"],signal_word:"Warning",bottle_colour:g,composition:m,label:h,by_mass:u==="solid"};(await this.onRegisterCompound?.(p)??!1)&&(s.reset(),this.hide())}),r.addEventListener("submit",async l=>{l.preventDefault();const c=a(r,"id"),h=a(r,"equation");if(!c||!h)return o(r,"Enter a reaction ID and an equation.");if(!/(<=>|->|→|⇌)/.test(h))return o(r,"Use “<=>” for an equilibrium or “->” for a one-way reaction.");o(r,""),(await this.onRegisterReaction?.({id:c,equation:h,type:a(r,"type"),k:parseFloat(a(r,"k"))||0,delta_h_kj:parseFloat(a(r,"dh"))||0,ea:parseFloat(a(r,"ea"))||0})??!1)&&(r.reset(),this.hide())})}}const La=[{key:"mp_c",label:"Melting point (°C)",type:"number",step:"0.1"},{key:"bp_c",label:"Boiling point (°C)",type:"number",step:"0.1"},{key:"density",label:"Density (g/cm³)",type:"number",step:"0.001"},{key:"solubility",label:"Solubility",type:"text"}];class my{modal;bottle=null;onBottleUpdated;onAddToVessel;constructor(){this.modal=new Xl("Compound",{className:"modal-bottle"})}async showBottle(t){this.bottle=t;try{const e=await Ix(t.inchi_key);e&&(t.userOverrides={...e})}catch{}this.render(),this.modal.open()}hide(){this.modal.close()}render(){const t=this.bottle;if(!t)return;const e=t.userOverrides||{};this.modal.setTitle(t.name);let n="";try{n=hd(t.smiles).components.map(l=>`<span class="pill mono">${Ie(hs(l.formula))} ×${l.stoichiometry}</span>`).join("")}catch{n=""}const s=dd(t.ghs),r=La.some(a=>e[a.key]!==void 0);this.modal.body.innerHTML=`
      <p class="bc-sub"><span class="mono">${Ie(hs(t.formula))}</span> · ${t.mw?t.mw.toFixed(2)+" g/mol":""}${t.cid?` · CID ${t.cid}`:""}</p>
      <p class="add-note">Visual only — imported from PubChem, so it has no reaction data.</p>
      ${s.length?`<p class="add-hazard is-warning"><span class="hz-dot" aria-hidden="true"></span>${Ie(s.join(", "))}</p>`:""}
      <form class="form" novalidate>
        <div class="form-grid">
          ${La.map(a=>{const l=t.sourcedProperties[a.key],c=e[a.key]!==void 0?e[a.key]:l;return`<label class="f">${a.label}${e[a.key]!==void 0?' <span class="tag tag-user">edited</span>':""}
              <input name="${a.key}" type="${a.type}" ${a.step?`step="${a.step}"`:""} value="${Ie(String(c??""))}" />
              <span class="f-hint">PubChem: ${Ie(String(l??"—"))}</span></label>`}).join("")}
        </div>
        ${n?`<div class="bc-frag"><span class="eyebrow">Dissolves into</span><div class="pill-row">${n}</div></div>`:""}
        <details class="bc-ids"><summary>Identifiers</summary>
          <dl class="kv"><dt>InChIKey</dt><dd class="mono">${Ie(t.inchi_key)}</dd><dt>SMILES</dt><dd class="mono">${Ie(t.smiles)}</dd></dl>
        </details>
        <div class="form-actions">
          <button class="btn btn-ghost" type="button" data-act="reset" ${r?"":"disabled"}>Reset to PubChem values</button>
          <button class="btn btn-ghost" type="submit">Save changes</button>
          <button class="btn btn-primary" type="button" data-act="add">Add to a vessel</button>
        </div>
      </form>`;const o=this.modal.body.querySelector("form");o.addEventListener("submit",async a=>{a.preventDefault();const l={};for(const c of La){const h=o.elements.namedItem(c.key).value.trim(),u=t.sourcedProperties[c.key];if(c.type==="number"){const d=parseFloat(h);isFinite(d)&&d!==u&&(l[c.key]=d)}else h&&h!==u&&(l[c.key]=h)}t.userOverrides=l,await this.persist(t),ve("Saved changes.","success"),this.render()}),o.querySelector('[data-act="reset"]')?.addEventListener("click",async()=>{t.userOverrides={},await this.persist(t),ve("Reset to PubChem values.","success"),this.render()}),o.querySelector('[data-act="add"]')?.addEventListener("click",()=>{this.hide(),this.onAddToVessel?.(t)})}async persist(t){try{await Lx(t.inchi_key,t.userOverrides)}catch{}this.onBottleUpdated?.(t)}}const tu="rc.hint.dismissed.v2";function gy(i){if(mo(tu,!1))return null;const t=Y("div",{class:"hint",role:"note"});t.innerHTML=`${ee("info",16)}<span class="hint-text"></span>`,t.querySelector(".hint-text").textContent=i;const e=Y("button",{class:"icon-btn","aria-label":"Dismiss hint",html:ee("close",14)});return e.addEventListener("click",()=>{Ws(tu,!0),t.remove()}),t.append(e),t}let As=null,Ia=!1;async function vy(i,t,e){if(As||(As=new Xl("Self-test · M0–M5 validation gates",{wide:!0,className:"modal-test"})),As.open(),Ia)return;Ia=!0;const n=Y("ol",{class:"test-log","aria-live":"polite"});As.body.innerHTML="",As.body.append(n);const s=(r,o="info")=>{n.append(Y("li",{class:`test-step is-${o}`,text:r})),n.lastElementChild?.scrollIntoView({block:"nearest"})};try{s("[M0] Worker & WASM roundtrip");try{const o=await new Promise((a,l)=>{const c=window.setTimeout(()=>{i.removeEventListener("message",h),l(new Error("timed out after 5 s"))},5e3),h=u=>{u.data?.type==="WASM_ROUNDTRIP_RESPONSE"&&u.data.requestId==="gate-test"&&(window.clearTimeout(c),i.removeEventListener("message",h),a({wasmResponse:u.data.payload.wasmResponse,latency:Date.now()-u.data.payload.timestamp}))};i.addEventListener("message",h),i.postMessage({type:"WASM_ROUNDTRIP",payload:{message:"Gate Test Ping"},requestId:"gate-test"})});s(`Pass — WASM roundtrip "${o.wasmResponse}" (${o.latency} ms)`,"pass")}catch(o){s(`Fail — WASM roundtrip: ${o.message}`,"fail")}s("[M0] Local server GFN2-xTB job");try{const o=await fetch("/api/xtb/trivial-test",{method:"POST",headers:{"Content-Type":"application/json",Authorization:e?`Bearer ${e}`:""}});if(o.ok){const a=await o.json();s(`Pass — ${a.species} energy = ${Number(a.energy_hartree).toFixed(6)} Eh (${a.method}, ${a.runtime_sec}s)`,"pass")}else s(`Fail — xTB request returned status ${o.status} (is the local server running?)`,"fail")}catch(o){s(`Fail — xTB server call: ${o.message}`,"fail")}s("[M1] Chemical import database");try{const o=await Ro();s(`Pass — import database active with ${Object.keys(o).length} species`,"pass")}catch(o){s(`Fail — ${o.message}`,"fail")}s("[M2] Data bundle v1 & conflict report");try{const o=await fetch("/data/conflict_report.json");if(o.ok){const a=await o.json();s(`Pass — ${a.conflicts_resolved}/${a.spot_checked_conflicts_analyzed} conflicts resolved`,"pass"),s(`Pass — ${a.total_species_in_database} species mapped by InChIKey`,"pass")}else s("Fail — could not load conflict_report.json","fail")}catch(o){s(`Fail — ${o.message}`,"fail")}s("[M5] Optics, catalog, speciation & conservation");try{const o=await t.getOpticsTables();s(`Pass — optics tables: ${o.n_bins} wavelength bins (400–710 nm)`,"pass");const a=await t.getReagentCatalog();s(`Pass — reagent catalog: ${a.length} reagents`,"pass");const l=`selftest_${Date.now()}`;await t.createVessel(l,{type:"beaker-250",capacity_ml:250,glass_mass_g:110,inner_radius_cm:3.5});try{await t.dose(l,{reagent_id:"hcl_0_1m",volume_ml:25}),await t.dose(l,{reagent_id:"naoh_0_1m",volume_ml:25});const c=await t.fetchSnapshot(l);c&&c.ph!==null?(s(`Pass — 25 mL 0.1 M HCl + 25 mL 0.1 M NaOH: pH ${c.ph.toFixed(2)}, ${c.total_liquid_ml.toFixed(1)} mL`,"pass"),s(`Pass — charge balance error ${c.conservation.charge_err_mol.toExponential(2)} mol`,"pass")):s("Fail — no aqueous phase after titration","fail")}finally{await t.freeVessel(l)}}catch(o){s(`Fail — ${o.message}`,"fail")}const r=n.querySelectorAll(".is-fail").length;s(r===0?"All gates passed.":`${r} check(s) failed.`,r===0?"pass":"fail")}finally{Ia=!1}}const Kr=new Worker(new URL("/assets/simulation.worker-D-SgYrwk.js",import.meta.url),{type:"module"});let Da=new URLSearchParams(window.location.search).get("token")||"";const _y=8,My=new Set(["stopper_pop","ignition","flame_out","boil_over","dry_out","splatter"]),xy=new Set(["precipitate_formed","gas_evolved","colour_change","temperature_change"]);function jn(i){return i instanceof Error?i.message:String(i)}function eu(i,t,e){return new Promise((n,s)=>{const r=window.setTimeout(()=>s(new Error(`${e} timed out`)),t);i.then(o=>{window.clearTimeout(r),n(o)},o=>{window.clearTimeout(r),s(o)})})}async function yy(){const i=document.getElementById("app"),t=document.getElementById("bench-container"),e=document.getElementById("loading"),n=document.getElementById("loading-detail"),s=D=>n.textContent=D,r=new wx(t),o=new Tx(Kr),a=new kx,l=new Po(r,o);let c=null;const h=new dy,u=new py,d=new my,f=new iy([{label:"Import from PubChem",hint:"Search box",icon:"cloud",action:()=>v.focusSearch()},{label:"Custom chemistry…",icon:"plus",action:()=>u.show()},{label:"Run self-test",icon:"test",action:()=>vy(Kr,o,Da)}]);f.onToggleDetails=()=>h.toggle(),h.onVisibilityChange=D=>f.setDetailsOpen(D);const g=new oy({vessels:()=>l.list(),freeCapacityMl:D=>l.freeCapacityMl(D),isBroken:D=>!!l.snapshot(D)?.burst,catalogMatchFor:D=>D.kind==="imported"?a.catalogMatchFor(D.bottle):void 0}),v=new ry(a,g),m=async D=>{try{const G=D.userOverrides?.density??D.sourcedProperties?.density,et=await o.importCompound({id:D.id,name:D.name,formula:D.formula,smiles:D.smiles||void 0,mw:D.mw||void 0,density:typeof G=="number"&&isFinite(G)?G:void 0,state:nr(D)?"solid":D.state==="gas"?"gas":"liquid",ghs:[]});return a.setModel(D.id,et),et}catch(G){console.warn("[Main] compound modelling failed",D.name,G);return}},p=()=>{const D=r.instruments,G=l.selectedId?l.snapshot(l.selectedId):void 0,et=(dt,Ht)=>{try{return dt()??Ht}catch{return Ht}};return{temperature:et(()=>D?.thermometer?.readout().formatted,G?`${(G.temperature_k-273.15).toFixed(1)} °C`:"—"),ph:et(()=>D?.phMeter?.readout().formatted,G?.ph!=null?G.ph.toFixed(2):"—"),mass:et(()=>D?.balance?.readout().formatted,G?`${G.contents_mass_g.toFixed(2)} g`:"—"),pressure:et(()=>D?.pressureGauge?.readout().formatted,G?`${(G.pressure_atm-1).toFixed(2)} atm (g)`:"—")}},x=new hy({lab:l,readouts:p,focusVessel:D=>r.focusVessel(D),openDetails:()=>h.show()}),M=new uy(o),_=Y("div",{class:"sheet-switch",role:"tablist","aria-label":"Panels"}),I=["reagents","vessel"].map(D=>{const G=Y("button",{class:"seg-btn",role:"tab",type:"button","aria-selected":"false",text:D==="reagents"?"Reagents":"Vessel"});return G.addEventListener("click",()=>E(D)),_.append(G),G}),E=D=>{i.dataset.sheet=D,I[0].setAttribute("aria-selected",String(D==="reagents")),I[1].setAttribute("aria-selected",String(D==="vessel"))};E("reagents"),v.el.addEventListener("panel-expanded",()=>E("reagents"));const C=Y("div",{class:"bottom-dock"}),P=gy("Search for a reagent on the left or click a bottle on the shelf · drag the bench to look around");P&&C.append(P),C.append(M.el),i.append(f.el,v.el,x.el,C,_);const b=new Set,y=D=>{try{if(D.kind==="catalog"){const G=D.entry;r.addReagentBottle(G);const et=md(G.id);et?r.setBottleContentColor(G.id,et):Kx(o,G,c).then(dt=>{dt&&r.setBottleContentColor(G.id,dt)})}else b.has(D.id)||(r.addBottle(D.bottle),b.add(D.id))}catch(G){console.warn("[Main] shelf placement failed",G)}},R=D=>{y(D),v.setCollapsed(!1),v.setSelected(D.key),E("reagents"),g.show(D,l.selectedId)};v.onSelect=R,g.onClose=()=>v.setSelected(null),g.onProperties=D=>{D.kind==="imported"&&d.showBottle(D.bottle)},g.onUseCatalog=D=>{const G=a.get(`cat:${D.id}`);G&&R(G)},g.onAdd=async(D,G,et)=>{try{const dt=await l.addReagent(D,G,et);a.markUsed(D.key),y(D),dt==="visual"&&ve(`Added ${ir(D)} — visual only: the engine has no reaction chemistry for this compound.`,"info")}catch(dt){ve(`Couldn't add ${ir(D)}: ${jn(dt)}`,"error")}},d.onAddToVessel=D=>{const G=a.get(`pc:${D.id}`);G&&R(G)},d.onBottleUpdated=D=>{a.persistImported(),m(D)},v.onImportPubChem=async D=>{try{const G=await Ox(D),et={id:G.inchi_key?`pc_${G.inchi_key.slice(0,14)}`:`pc_${Date.now()}`,cid:G.cid,name:G.name,formula:G.formula,smiles:G.smiles,inchi_key:G.inchi_key,mw:G.mw,sourcedProperties:{mp_c:G.mp_c,bp_c:G.bp_c,density:G.density,solubility:G.solubility},userOverrides:{},color:G.color||"#e8f4fa",ghs:G.ghs||[],remainingMl:500,state:G.physical_state},dt=a.addImported(et),Ht=await m(dt.kind==="imported"?dt.bottle:et),Q=a.get(dt.key)??dt;R(Q),Ht?.modelable?ve(`Imported ${G.name} from PubChem. ${Ht.reason}.`,"success"):ve(`Imported ${G.name} from PubChem. It's visual only — ${Ht?.reason??"no reaction model available"}.`,"info")}catch(G){ve(`Couldn't import “${D}” from PubChem: ${jn(G)}`,"error")}},v.onSpawnGlassware=D=>{l.spawn(D).then(G=>l.select(G.id)).catch(G=>ve(`Couldn't add glassware: ${jn(G)}`,"error"))},u.onRegisterCompound=async D=>{try{await o.registerCustomCompound(D);let G=await o.getReagentCatalog();G.some(dt=>dt.id===D.id)||(G=[...G,D]),a.setCatalog(G);const et=a.get(`cat:${D.id}`);return et&&R(et),ve(`Registered ${D.name}. Find it in Reagents.`,"success"),!0}catch(G){return ve(`Couldn't register the compound: ${jn(G)}`,"error"),!1}},u.onRegisterReaction=async D=>{try{return await o.registerCustomReaction(D),ve(`Registered reaction ${D.id}.`,"success"),!0}catch(G){return ve(`Couldn't register the reaction: ${jn(G)}`,"error"),!1}},l.onSelectionChanged=D=>{x.show(D),g.setDefaultVessel(D);const G=D?l.get(D):void 0;h.setVessel(D,G?.name??"");const et=D?l.snapshot(D):void 0;et&&(h.updateSnapshot(et),M.setClock(et.t_sim_s)),D&&!g.isOpen&&E("vessel")},l.onVesselsChanged=()=>{x.vesselsChanged(),g.vesselsChanged()},l.onControlsChanged=D=>{D===l.selectedId&&x.syncControls()},r.onSelectObject=(D,G)=>{if(D==="vessel")l.select(G),E("vessel");else{const et=a.findByShelfId(G);et&&R(et)}},r.onDeselect=()=>g.hide();const O=new Map,N=new Map;let U=0;const F=new Set;let V=0;o.onSnapshotUpdated=(D,G)=>{const et=l.ingest(D,G);if(!et)return;const dt=performance.now(),Ht=O.get(D)??dt-50;O.set(D,dt);const Q=Math.min(.25,Math.max(.001,(dt-Ht)/1e3)),ot=r.getGlassware(D);if(ot)try{ot.applyVisual(et,Q,c)}catch(ft){console.warn("[Main] applyVisual failed",ft)}const mt=l.get(D)?.name??"Vessel";et.burst&&!F.has(D)&&(F.add(D),r.triggerBurst(D),ve(`${mt} burst — the pressure was too high.`,"error"));const lt=et.events??[],Pt=lt.reduce((ft,bt)=>Math.max(ft,bt.seq??0),0),Ft=N.get(D);if(Ft===void 0)N.set(D,Pt);else if(Pt>Ft){const ft=lt.filter(it=>(it.seq??0)>Ft),bt=Array.from(new Set(ft.filter(it=>My.has(it.kind)).map(it=>it.kind)));for(const it of bt)ve(`${mt}: ${Tl[it]??it}`,it==="ignition"||it==="boil_over"?"warning":"info");const j=ft.find(it=>xy.has(it.kind)&&it.detail);j&&dt-U>4e3&&(U=dt,ve(`${mt}: ${j.detail}`,"info")),N.set(D,Pt)}if(D===l.selectedId){try{r.updateInstruments(et,Q)}catch(ft){console.warn("[Main] updateInstruments failed",ft)}x.update(et),h.updateSnapshot(et),M.setClock(et.t_sim_s)}g.isOpen&&dt-V>250&&(V=dt,g.refresh())},window.addEventListener("keydown",D=>{if(D.defaultPrevented||fy()||D.metaKey||D.ctrlKey||D.altKey)return;if(D.key==="Escape"){f.menuOpen?f.closeMenu(!0):g.isOpen?g.hide():h.isVisible?h.hide():Zh(D.target)||l.select(null);return}if(Zh(D.target))return;const et=!!D.target.closest?.('button, a, input, select, textarea, [role="menuitem"], [role="tab"]');D.key==="a"||D.key==="A"?(D.preventDefault(),h.toggle()):D.key===" "&&!et?(D.preventDefault(),M.togglePause()):(D.key==="f"||D.key==="F")&&l.selectedId?(D.preventDefault(),r.focusVessel(l.selectedId)):D.key==="/"&&!et&&(D.preventDefault(),v.focusSearch())}),Kr.addEventListener("message",D=>{const{type:G,payload:et}=D.data??{};G==="WASM_READY"?f.setEngineStatus("ok","Ready"):G==="WASM_ROUNDTRIP_RESPONSE"?f.setEngineStatus("ok",`Ready · ${Date.now()-et.timestamp} ms`):G==="WASM_ERROR"&&(f.setEngineStatus("error","Failed to load"),ve("The chemistry engine failed to load. Reload the page to try again.","error"))}),Kr.postMessage({type:"WASM_ROUNDTRIP",payload:{message:"Reaction Chamber heartbeat"},requestId:"init-ping"}),fetch("/api/health").then(D=>f.setServerStatus(D.ok?"ok":"warn",D.ok?"Online":"Not running (optional)")).catch(()=>f.setServerStatus("warn","Not running (optional)")),Da||fetch("/api/session-token").then(D=>D.ok?D.json():null).then(D=>{D?.token&&(Da=D.token)}).catch(()=>{}),Ro().catch(()=>{}),s("Loading the chemistry engine…");try{c=await eu(o.getOpticsTables(),2e4,"Loading optics tables"),r.setOpticsTables(c)}catch(D){console.warn("[Main] optics tables unavailable",D)}s("Stocking the reagent shelf…");try{a.setCatalog(await eu(o.getReagentCatalog(),2e4,"Loading the reagent catalog"))}catch(D){ve(`Couldn't load reagents: ${jn(D)}`,"error")}await Promise.all(a.importedBottles().map(D=>m(D)));const K=a.recentItems();(K.length?K:a.search("","all",_y).items).slice().reverse().forEach(y),s("Setting out glassware…");try{const D=await l.spawn("beaker-250");l.moveToHotPlate(D.id),await l.spawn("cylinder-100"),await l.spawn("erlenmeyer-250"),l.select(D.id)}catch(D){ve(`Couldn't set out glassware: ${jn(D)}`,"error")}e.classList.add("is-done"),window.setTimeout(()=>e.remove(),400)}window.addEventListener("DOMContentLoaded",()=>{yy().catch(i=>{console.error("[Main] startup failed",i);const t=document.getElementById("loading-detail");t&&(t.textContent=`Startup failed: ${jn(i)}`)})});
